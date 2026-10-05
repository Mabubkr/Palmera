// ============================================================================
// PalmTrace Audit Log Engine (محرك سجل التدقيق والرقابة)
// Isolated high-capacity storage, zero-lag async logging, bulk consolidation
// ============================================================================

const AuditLog = (() => {
  const DB_NAME = "PalmTraceAuditDB";
  const DB_VERSION = 1;
  const STORE_NAME = "audit_events";
  const LS_FALLBACK_KEY = "palmtrace_audit_log_v1";
  const MAX_FALLBACK_ENTRIES = 3000;

  let db = null;
  let memCache = []; // Fast in-memory cache for instant searching and rendering
  let isReady = false;
  let initPromise = null;

  // Initialize storage (IndexedDB with LocalStorage fallback)
  function init() {
    if (initPromise) return initPromise;
    initPromise = new Promise((resolve) => {
      // 1. First load from LocalStorage to populate memCache immediately
      try {
        const raw = localStorage.getItem(LS_FALLBACK_KEY);
        if (raw) {
          memCache = JSON.parse(raw) || [];
        }
      } catch (e) {
        console.warn("AuditLog LocalStorage load warning:", e);
      }

      // 2. Open IndexedDB for massive storage capacity
      if (typeof window === "undefined" || !window.indexedDB) {
        console.warn("IndexedDB not available, using LocalStorage for AuditLog");
        isReady = true;
        return resolve();
      }

      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const idb = e.target.result;
          if (!idb.objectStoreNames.contains(STORE_NAME)) {
            const os = idb.createObjectStore(STORE_NAME, { keyPath: "id" });
            os.createIndex("by_at", "at", { unique: false });
            os.createIndex("by_user", "user", { unique: false });
            os.createIndex("by_module", "module", { unique: false });
            os.createIndex("by_action", "action", { unique: false });
          }
        };

        req.onsuccess = (e) => {
          db = e.target.result;
          isReady = true;
          // Load all records into memCache
          loadFromIdb().then(() => resolve()).catch(() => resolve());
        };

        req.onerror = (e) => {
          console.warn("IndexedDB open failed, fallback to LocalStorage:", e);
          isReady = true;
          resolve();
        };
      } catch (e) {
        console.warn("IndexedDB init exception:", e);
        isReady = true;
        resolve();
      }
    });
    return initPromise;
  }

  function loadFromIdb() {
    return new Promise((resolve) => {
      if (!db) return resolve();
      try {
        const tx = db.transaction(STORE_NAME, "readonly");
        const os = tx.objectStore(STORE_NAME);
        const req = os.getAll();
        req.onsuccess = () => {
          if (req.result && req.result.length) {
            // Sort newest first
            memCache = req.result.sort((a, b) => new Date(b.at) - new Date(a.at));
          }
          resolve();
        };
        req.onerror = () => resolve();
      } catch (err) {
        resolve();
      }
    });
  }

  // Non-blocking asynchronous log recording
  function log(entry) {
    if (!entry) return;

    // Normalize entry
    const now = new Date();
    const st = (typeof Store !== "undefined" && Store.get) ? Store.get() : {};
    const fullEntry = {
      id: "aud_" + now.getTime() + "_" + Math.random().toString(36).slice(2, 7),
      at: now.toISOString(),
      companyId: entry.companyId || st.activeCompanyId || (st.companies && st.companies[0]?.id) || null,
      projectId: entry.projectId || st.activeProjectId || (st.projects && st.projects[0]?.id) || null,
      user: entry.user || (typeof session === "function" && session()?.user) || "system",
      userName: entry.userName || (typeof session === "function" && session()?.name) || "النظام",
      role: entry.role || (typeof session === "function" && session()?.role) || "system",
      module: entry.module || "general",
      moduleName: entry.moduleName || moduleLabel(entry.module),
      action: entry.action || "action",
      actionLabel: entry.actionLabel || actionLabel(entry.action),
      summary: entry.summary || "",
      targetId: entry.targetId || "",
      targetCount: typeof entry.targetCount === "number" ? entry.targetCount : 1,
      targetScope: entry.targetScope || "",
      severity: entry.severity || detectSeverity(entry.action), // info, success, warning, danger
      details: entry.details || null,
      device: entry.device || (typeof navigator !== "undefined" ? (navigator.userAgent || "").slice(0, 80) : "Web")
    };

    // Update in-memory cache immediately (newest first)
    memCache.unshift(fullEntry);

    // Schedule background persistent write without delaying UI
    const runWrite = () => {
      // 1. Write to IndexedDB if available
      if (db) {
        try {
          const tx = db.transaction(STORE_NAME, "readwrite");
          tx.objectStore(STORE_NAME).put(fullEntry);
        } catch (e) {
          console.warn("AuditLog IndexedDB write failed:", e);
        }
      }

      // 2. Keep LocalStorage synchronized with recent window
      try {
        const trimmed = memCache.slice(0, MAX_FALLBACK_ENTRIES);
        localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(trimmed));
      } catch (e) {
        // If storage quota exceeded, prune oldest
        try {
          const reduced = memCache.slice(0, 1000);
          localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(reduced));
        } catch (e2) {}
      }

      if (typeof Api !== "undefined" && typeof Api.isOnline === "function" && Api.isOnline()) {
        try {
          const auditApiUrl = (typeof Api !== "undefined" && Api.API_URL) ? `${Api.API_URL}/audit-logs` : "/api/audit-logs";
          fetch(auditApiUrl, {
            method: "POST",
            headers: (typeof Api.getHeaders === "function") ? Api.getHeaders() : { "Content-Type": "application/json" },
            body: JSON.stringify(fullEntry)
          }).catch(() => {});
        } catch (e) {}
      }
    };

    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(runWrite, { timeout: 800 });
    } else {
      setTimeout(runWrite, 10);
    }

    return fullEntry;
  }

  // Module & Action standard Arabic labels
  function moduleLabel(m) {
    const map = {
      palms: "🌴 الأشجار والحقل",
      ops: "⚙️ العمليات الزراعية",
      operations: "⚙️ العمليات الزراعية",
      "العمليات الميدانية": "⚙️ العمليات الزراعية",
      yields: "🌾 المحصول والإنتاج",
      fertilizers: "📦 الأسمدة والمخزون",
      nursery: "🌱 المشتل والتكاثر",
      zakat: "⚖️ حساب الزكاة",
      users: "👥 المستخدمون والصلاحيات",
      settings: "⚙️ إعدادات النظام",
      farmers: "👨‍🌾 المزارعون",
      auth: "🔐 الأمان والدخول",
      general: "🌐 عام"
    };
    return map[m] || m || "عام";
  }

  function actionLabel(act) {
    const map = {
      login: "تسجيل دخول",
      login_failed: "فشل دخول",
      logout: "تسجيل خروج",
      add: "إضافة جديدة",
      create: "إنشاء",
      update: "تعديل بيانات",
      edit: "تعديل",
      delete: "حذف",
      archive: "أرشفة",
      bulk_operation: "عملية زراعية جماعية",
      bulk_gen_codes: "توليد أكواد مجمعة",
      import_csv: "استيراد CSV",
      export_csv: "تصدير بيانات",
      bulk_print: "طباعة باركود مجمع",
      approve: "اعتماد رسمي",
      approve_operation: "اعتماد عملية ميدانية",
      batch_approve_operation: "اعتماد مجمع للعمليات الميدانية",
      create_operation: "تسجيل عملية ميدانية",
      add_operation: "إضافة عملية ميدانية",
      update_operation: "تعديل عملية ميدانية",
      delete_operation: "حذف عملية ميدانية",
      update_user_scope: "تحديث نطاق صلاحيات",
      update_scope: "تحديث نطاق صلاحيات",
      commit_staged_sector: "تأكيد وإضافة قطاع",
      broadcast_zakat: "إرسال إشعار الزكاة",
      approve_zakat_batch: "اعتماد دفعة زكاة",
      unapprove_zakat_batch: "إلغاء اعتماد دفعة زكاة",
      reject: "رفض عملية",
      issue_voucher: "إصدار إذن صرف",
      receive_voucher: "استلام وتفريغ إذن",
      stock_adjust: "تسوية جردية",
      dispense: "صرف شتلات/فسائل",
      zakat_dist: "توزيع زكاة",
      role_update: "تعديل صلاحيات",
      user_toggle: "تغيير حالة حساب",
      system_reset: "إعادة ضبط النظام"
    };
    return map[act] || act;
  }

  function detectSeverity(act) {
    if (["delete", "delete_operation", "archive", "reject", "login_failed", "system_reset"].includes(act)) return "danger";
    if (["update", "update_operation", "edit", "stock_adjust", "role_update", "user_toggle"].includes(act)) return "warning";
    if (["approve", "approve_operation", "batch_approve_operation", "receive_voucher"].includes(act)) return "primary";
    if (["add", "create", "create_operation", "add_operation", "login", "bulk_operation", "bulk_gen_codes", "import_csv"].includes(act)) return "success";
    return "info";
  }

  function translateAuditText(str) {
    if (!str || typeof str !== "string") return str || "";
    let text = str;

    // Check if it mentions an operation ID like [op...]
    const opMatch = text.match(/\[(op[a-z0-9_-]+)\]/i);
    let opDetailsStr = "";
    if (opMatch && typeof Store !== "undefined" && typeof Store.get === "function") {
      try {
        const st = Store.get();
        const opId = opMatch[1];
        const foundOp = (st.operations || []).find(o => o.id === opId || o.operation_id === opId);
        if (foundOp) {
          const typeName = foundOp.typeName || (st.operationTypes || []).find(t => t.id === foundOp.typeId || t.id === foundOp.operation_type_id)?.name || "";
          const palmCode = foundOp.palmCode || foundOp.palm_id || "";
          if (typeName && palmCode) {
            opDetailsStr = ` (${typeName} للنخلة ${palmCode})`;
          } else if (typeName) {
            opDetailsStr = ` (${typeName})`;
          } else if (palmCode) {
            opDetailsStr = ` (للنخلة ${palmCode})`;
          }
        }
      } catch (e) {}
    }

    // Specific replacements for operations:
    text = text.replace(/تم تنفيذ حركة \((?:approve_operation|approve)\) على (?:العمليات الميدانية|ops)(?: \[([^\]]+)\])?/gi, (m, id) => {
      return `اعتماد عملية ميدانية${opDetailsStr}${id ? ' [' + id + ']' : ''}`;
    });
    text = text.replace(/تم تنفيذ حركة \((?:batch_approve_operation)\) على (?:العمليات الميدانية|ops)(?: \[([^\]]+)\])?/gi, (m, id) => {
      return `اعتماد مجمع للعمليات الميدانية${id ? ' [' + id + ']' : ''}`;
    });
    text = text.replace(/تم تنفيذ حركة \((?:create_operation|add_operation)\) على (?:العمليات الميدانية|ops)(?: \[([^\]]+)\])?/gi, (m, id) => {
      return `تسجيل عملية ميدانية جديدة${opDetailsStr}${id ? ' [' + id + ']' : ''}`;
    });
    text = text.replace(/تم تسجيل وإضافة العمليات الميدانية جديد(?: \[([^\]]+)\])?/gi, (m, id) => {
      return `تسجيل عملية ميدانية جديدة${opDetailsStr}${id ? ' [' + id + ']' : ''}`;
    });
    text = text.replace(/تم تحديث وتعديل العمليات الميدانية(?: \[([^\]]+)\])?/gi, (m, id) => {
      return `تعديل العملية الميدانية${opDetailsStr}${id ? ' [' + id + ']' : ''}`;
    });
    // User scope patterns:
    text = text.replace(/تم\s+update\s+user\s+scope\s+مستخدم\s*\[([^\]]+)\]\s*بنجاح/gi, "تم تحديث نطاق صلاحيات المستخدم [$1] بنجاح");
    text = text.replace(/مستخدم\s+update\s+user\s+scope\s*\[([^\]]+)\]/gi, "تحديث نطاق صلاحيات المستخدم [$1]");
    text = text.replace(/update\s+user\s+scope\s*مستخدم\s*\[([^\]]+)\]/gi, "تحديث نطاق صلاحيات المستخدم [$1]");
    text = text.replace(/update\s+user\s+scope/gi, "تحديث نطاق الصلاحيات");

    // Subtitle / chip patterns:
    text = text.replace(/إجراء\s*\((?:approve_operation|approve)\)\s*-\s*(?:العمليات الميدانية|ops)/gi, "اعتماد عملية ميدانية");
    text = text.replace(/إجراء\s*\((?:batch_approve_operation)\)\s*-\s*(?:العمليات الميدانية|ops)/gi, "اعتماد عمليات مجمعة");
    text = text.replace(/إجراء\s*\((?:create_operation|add_operation|create|add)\)\s*-\s*(?:العمليات الميدانية|ops)/gi, "تسجيل عملية ميدانية");
    text = text.replace(/إجراء\s*\((?:update_operation|update|edit)\)\s*-\s*(?:العمليات الميدانية|ops)/gi, "تعديل عملية ميدانية");
    text = text.replace(/إجراء\s*\((?:delete_operation|delete)\)\s*-\s*(?:العمليات الميدانية|ops)/gi, "حذف عملية ميدانية");
    text = text.replace(/إجراء\s*\(([^)]+)\)\s*-\s*([^\n]+)/gi, (m, a, mod) => {
      return `${actionLabel(a.trim()) || a.trim()} (${moduleLabel(mod.trim()) || mod.trim()})`;
    });

    // Operation additions & titles
    text = text.replace(/إضافة\s+العمليات\s+الميدانية\s*([a-z0-9_-]+)?/gi, (m, id) => `تسجيل عملية ميدانية${id ? ' [' + id + ']' : ''}`);
    text = text.replace(/تحديث\s+العمليات\s+الميدانية\s*([a-z0-9_-]+)?/gi, (m, id) => `تعديل عملية ميدانية${id ? ' [' + id + ']' : ''}`);
    text = text.replace(/حذف\s+العمليات\s+الميدانية\s*([a-z0-9_-]+)?/gi, (m, id) => `حذف عملية ميدانية${id ? ' [' + id + ']' : ''}`);

    // Contracts
    text = text.replace(/^عقد\s+([A-Za-z0-9_.-]+)$/i, "عقد استثماري ($1)");

    // General pattern: تم تنفيذ حركة (xxx) على yyy
    text = text.replace(/تم تنفيذ حركة \(([^)]+)\) على ([^\[\n]+?)(?:\s*\[([^\]]+)\])?$/gim, (m, rawAct, rawMod, rawId) => {
      const actAr = actionLabel(rawAct.trim()) || rawAct.trim();
      const modAr = moduleLabel(rawMod.trim()) || rawMod.trim();
      return `تم تنفيذ [${actAr}] على ${modAr}${rawId ? ' [' + rawId.trim() + ']' : ''}`;
    });

    // Pattern replacements for raw server logs
    text = text.replace(/^update\s+sector\s+([A-Za-z0-9_-]+)/i, "تحديث بيانات القطاع ($1)");
    text = text.replace(/^create\s+sector\s+([A-Za-z0-9_-]+)/i, "إضافة قطاع جديد ($1)");
    text = text.replace(/^delete\s+sector\s+([A-Za-z0-9_-]+)/i, "حذف القطاع ($1)");

    text = text.replace(/^update\s+palms?\s+([A-Za-z0-9_.-]+)/i, "تحديث بيانات النخيل ($1)");
    text = text.replace(/^create\s+palms?\s+([A-Za-z0-9_.-]+)/i, "إضافة نخلة جديدة ($1)");
    text = text.replace(/^delete\s+palms?\s+([A-Za-z0-9_.-]+)/i, "حذف النخلة ($1)");

    text = text.replace(/^update\s+plots?\s+([A-Za-z0-9_-]+)/i, "تحديث بيانات القطعة ($1)");
    text = text.replace(/^create\s+plots?\s+([A-Za-z0-9_-]+)/i, "إضافة قطعة جديدة ($1)");
    text = text.replace(/^delete\s+plots?\s+([A-Za-z0-9_-]+)/i, "حذف القطعة ($1)");

    text = text.replace(/^create\s+nursery\s+([A-Za-z0-9_-]+)/i, "إضافة شتلات جديدة بالمشتل ($1)");
    text = text.replace(/^update\s+nursery\s+([A-Za-z0-9_-]+)/i, "تحديث بيانات المشتل ($1)");

    text = text.replace(/^create\s+operations?\s+([A-Za-z0-9_-]+)/i, "تسجيل عملية ميدانية جديدة ($1)");
    text = text.replace(/^update\s+operations?\s+([A-Za-z0-9_-]+)/i, "تحديث العملية الميدانية ($1)");

    text = text.replace(/^update\s+contract\s+([A-Za-z0-9_-]+)/i, "تحديث العقد الاستثماري ($1)");
    text = text.replace(/^create\s+contract\s+([A-Za-z0-9_-]+)/i, "إنشاء عقد استثماري جديد ($1)");
    text = text.replace(/^delete\s+contract\s+([A-Za-z0-9_-]+)/i, "حذف العقد الاستثماري ($1)");

    text = text.replace(/^update\s+investor\s+([A-Za-z0-9_-]+)/i, "تحديث بيانات المستثمر ($1)");
    text = text.replace(/^create\s+investor\s+([A-Za-z0-9_-]+)/i, "إضافة مستثمر جديد ($1)");

    text = text.replace(/^update\s+fertilizers?\s+([A-Za-z0-9_-]+)/i, "تحديث بيانات الأسمدة ($1)");
    text = text.replace(/^create\s+fertilizers?\s+([A-Za-z0-9_-]+)/i, "إضافة صنف سماد ($1)");

    // Raw action names by themselves
    if (text === "approve_operation") return "اعتماد عملية ميدانية";
    if (text === "batch_approve_operation") return "اعتماد مجمع للعمليات";
    if (text === "create_operation" || text === "add_operation") return "تسجيل عملية ميدانية";
    if (text === "update_operation") return "تعديل عملية ميدانية";
    if (text === "delete_operation") return "حذف عملية ميدانية";

    return text;
  }

  // Filter & Query
  function query(opts = {}) {
    const {
      search = "",
      user = "",
      module = "",
      action = "",
      period = "all",
      dateFrom = "",
      dateTo = "",
      companyId = "all",
      projectId = "all",
      page = 1,
      pageSize = 50
    } = opts;

    let list = memCache;
    const st = (typeof Store !== "undefined" && Store.get) ? Store.get() : {};
    const me = (typeof session === "function") ? session() : null;
    const isSuperAdmin = Boolean(me?.isSuperAdmin === true || me?.role === "super_admin");

    // Scoping by Company / Project
    let filterComp = companyId;
    let filterProj = projectId;

    // Regular users are strictly restricted to their current company & project
    if (!isSuperAdmin) {
      filterComp = st.activeCompanyId || me?.activeCompanyId || me?.companyId || "comp_bashayer";
      filterProj = st.activeProjectId || me?.activeProjectId || me?.projectId || "proj_farafra_01";
    }

    if (filterComp && filterComp !== "all") {
      list = list.filter(item => {
        if (item.companyId) return item.companyId === filterComp;
        return filterComp === "comp_bashayer";
      });
    }
    if (filterProj && filterProj !== "all") {
      list = list.filter(item => {
        if (item.projectId) return item.projectId === filterProj;
        return filterProj === "proj_farafra_01";
      });
    }

    // Filter by module
    if (module && module !== "all") {
      list = list.filter(item => item.module === module);
    }

    // Filter by user
    if (user && user !== "all") {
      list = list.filter(item => item.user === user);
    }

    // Filter by action
    if (action && action !== "all") {
      list = list.filter(item => item.action === action || (action === "bulk" && item.action.startsWith("bulk_")));
    }

    // Filter by period / date
    const now = new Date();
    if (period === "today") {
      const todayStr = now.toISOString().slice(0, 10);
      list = list.filter(item => (item.at || "").slice(0, 10) === todayStr);
    } else if (period === "week") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      list = list.filter(item => new Date(item.at) >= weekAgo);
    } else if (period === "month") {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
      list = list.filter(item => new Date(item.at) >= monthAgo);
    } else if (dateFrom || dateTo) {
      if (dateFrom) list = list.filter(item => item.at.slice(0, 10) >= dateFrom);
      if (dateTo) list = list.filter(item => item.at.slice(0, 10) <= dateTo);
    }

    // Full-text search
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(item => {
        return (
          (item.summary && item.summary.toLowerCase().includes(q)) ||
          (item.user && item.user.toLowerCase().includes(q)) ||
          (item.userName && item.userName.toLowerCase().includes(q)) ||
          (item.targetId && item.targetId.toLowerCase().includes(q)) ||
          (item.actionLabel && item.actionLabel.toLowerCase().includes(q)) ||
          (item.targetScope && item.targetScope.toLowerCase().includes(q))
        );
      });
    }

    const total = list.length;
    const pSize = parseInt(pageSize, 10) || 50;
    const totalPages = Math.max(1, Math.ceil(total / pSize));
    const curPage = Math.min(Math.max(1, parseInt(page, 10) || 1), totalPages);
    const startIdx = (curPage - 1) * pSize;
    const items = list.slice(startIdx, startIdx + pSize);

    return {
      total,
      page: curPage,
      pageSize: pSize,
      totalPages,
      items
    };
  }

  // Quick Overview Stats
  function getStats(opts = {}) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const st = (typeof Store !== "undefined" && Store.get) ? Store.get() : {};
    const me = (typeof session === "function") ? session() : null;
    const isSuperAdmin = Boolean(me?.isSuperAdmin === true || me?.role === "super_admin");

    let list = memCache;
    let filterComp = opts.companyId || (isSuperAdmin ? "all" : (st.activeCompanyId || me?.activeCompanyId || me?.companyId || "comp_bashayer"));
    let filterProj = opts.projectId || (isSuperAdmin ? "all" : (st.activeProjectId || me?.activeProjectId || me?.projectId || "proj_farafra_01"));

    if (filterComp && filterComp !== "all") {
      list = list.filter(item => {
        if (item.companyId) return item.companyId === filterComp;
        return filterComp === "comp_bashayer";
      });
    }
    if (filterProj && filterProj !== "all") {
      list = list.filter(item => {
        if (item.projectId) return item.projectId === filterProj;
        return filterProj === "proj_farafra_01";
      });
    }

    const total = list.length;
    let todayCount = 0;
    let sensitiveCount = 0;
    const userCounts = {};

    list.forEach(item => {
      if ((item.at || "").slice(0, 10) === todayStr) todayCount++;
      if (item.severity === "danger" || item.action === "delete" || item.action === "archive") sensitiveCount++;
      if (item.userName) {
        userCounts[item.userName] = (userCounts[item.userName] || 0) + 1;
      }
    });

    const sortedUsers = Object.entries(userCounts).sort((a, b) => b[1] - a[1]);
    const topUser = sortedUsers.length ? `${sortedUsers[0][0]} (${sortedUsers[0][1]})` : "—";

    return {
      total,
      todayCount,
      sensitiveCount,
      topUser
    };
  }

  // Export CSV
  function exportCSV(opts = {}) {
    const { items } = query({ ...opts, page: 1, pageSize: 999999 });
    if (!items.length) {
      if (typeof toast === "function") toast("لا توجد سجلات مطابقة للتصدير");
      return;
    }

    const headers = ["المعرف", "التاريخ والوقت", "اسم المستخدم", "اسم الحساب", "الدور", "القسم", "نوع الإجراء", "البيان التفصيلي", "عدد الأصول", "النطاق", "معرف الهدف", "الجهاز"];
    const rows = [headers.join(",")];

    const clean = (val) => `"${String(val || "").replace(/"/g, '""').replace(/[\r\n]+/g, " ")}"`;

    items.forEach(it => {
      rows.push([
        clean(it.id),
        clean(it.at),
        clean(it.userName),
        clean(it.user),
        clean(it.role),
        clean(it.moduleName || it.module),
        clean(it.actionLabel || it.action),
        clean(it.summary),
        clean(it.targetCount),
        clean(it.targetScope),
        clean(it.targetId),
        clean(it.device)
      ].join(","));
    });

    const bom = "\uFEFF";
    const csvContent = bom + rows.join("\r\n");
    if (typeof document !== "undefined") {
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dt = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `سجل_التدقيق_والرقابة_${dt}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    if (typeof toast === "function") toast(`تم تصدير ${items.length} حركة بنجاح إلى ملف CSV`);
    return csvContent;
  }

  // Clear older records with confirmation
  function clearOlderThan(days = 30) {
    const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000);
    const initialCount = memCache.length;
    memCache = memCache.filter(item => new Date(item.at) >= cutoff);
    const removedCount = initialCount - memCache.length;

    // Sync IndexedDB & LocalStorage
    if (db) {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const os = tx.objectStore(STORE_NAME);
        os.clear();
        memCache.forEach(item => os.put(item));
      } catch (e) {}
    }
    try {
      localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(memCache.slice(0, MAX_FALLBACK_ENTRIES)));
    } catch (e) {}

    return removedCount;
  }

  // Compensating Reversal Action (الحركة التعويضية / تراجع رقابي معتمد)
  function revert(recordId, reason, adminUser) {
    if (!recordId) return { success: false, error: "معرف السجل غير محدد" };
    const original = memCache.find(x => x.id === recordId);
    if (!original) return { success: false, error: "السجل غير موجود" };
    if (original.reverted) return { success: false, error: "تم التراجع عن هذه الحركة مسبقاً" };

    const u = adminUser || (typeof session === "function" ? session() : { user: "admin", name: "إدارة النظام", role: "admin" });
    const now = new Date();

    // 1. Mark original record as reverted with metadata
    original.reverted = true;
    original.revertedAt = now.toISOString();
    original.revertedBy = u.name || u.user;
    original.revertReason = reason || "إدخال غير صحيح";

    // 2. Rollback underlying data state if known
    let rollbackSuccess = false;
    let rollbackMsg = "";
    try {
      if (typeof Store !== "undefined" && Store.get) {
        const st = Store.get();
        if (original.module === "ops" && original.targetId) {
          const opIdx = (st.operations || []).findIndex(o => o.id === original.targetId);
          if (opIdx >= 0) {
            st.operations.splice(opIdx, 1);
            Store.set({ operations: st.operations });
            rollbackSuccess = true;
            rollbackMsg = `تم حذف العملية الزراعية #${original.targetId} واستعادة حالة السجل`;
          }
        } else if (original.module === "fertilizers" && original.details) {
          const det = original.details;
          if (det.fertId && det.qty) {
            const fert = (st.fertilizers || []).find(f => f.id === det.fertId);
            if (fert) {
              fert.stock = (fert.stock || 0) + (original.action === "dispense" ? +det.qty : -det.qty);
              Store.set({ fertilizers: st.fertilizers });
              rollbackSuccess = true;
              rollbackMsg = `تمت استعادة رصيد السماد (${fert.name}) بمقدار ${det.qty}`;
            }
          }
        } else if (original.module === "yields" && original.targetId) {
          const yIdx = (st.yields || []).findIndex(y => y.id === original.targetId);
          if (yIdx >= 0) {
            st.yields.splice(yIdx, 1);
            Store.set({ yields: st.yields });
            rollbackSuccess = true;
            rollbackMsg = `تم حذف وتراجع شحنة الحصاد #${original.targetId}`;
          }
        }
      }
    } catch (e) {
      console.warn("Rollback execution error:", e);
    }

    // 3. Record official new compensating reversal audit event
    const revEvent = {
      id: "rev_" + Date.now().toString(36) + "_" + Math.random().toString(36).substr(2, 4),
      at: now.toISOString(),
      user: u.user,
      userName: u.name || u.user,
      role: u.role || "admin",
      module: original.module,
      moduleName: original.moduleName,
      action: "reversal",
      actionLabel: "تراجع تصحيحي",
      severity: "warning",
      targetId: original.targetId,
      targetScope: original.targetScope,
      targetCount: original.targetCount || 1,
      summary: `[قيد عكسي / تراجع معتمد]: تراجع عن الإجراء #${original.id} (${original.summary}) — سبب التراجع: ${reason} ${rollbackMsg ? `• (${rollbackMsg})` : ""}`,
      details: {
        revertedRecordId: original.id,
        originalAction: original.action,
        reason: reason,
        rollbackMsg: rollbackMsg,
        originalDetails: original.details
      }
    };

    memCache.unshift(revEvent);

    // Sync IndexedDB & LocalStorage
    if (db) {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const os = tx.objectStore(STORE_NAME);
        os.put(original);
        os.put(revEvent);
      } catch (e) {}
    }
    try {
      localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(memCache.slice(0, MAX_FALLBACK_ENTRIES)));
    } catch (e) {}

    return { success: true, reversalEvent: revEvent, rollbackMsg };
  }

  // Merge remote audit logs from central server into local storage
  function mergeRemote(remoteLogs) {
    if (!Array.isArray(remoteLogs) || !remoteLogs.length) return;
    let added = false;
    const existingIds = new Set(memCache.map(x => String(x.id)));

    remoteLogs.forEach(entry => {
      if (!entry || !entry.id) return;
      if (entry.summary) entry.summary = translateAuditText(entry.summary);
      if (entry.title) entry.title = translateAuditText(entry.title);
      if (!existingIds.has(String(entry.id))) {
        existingIds.add(String(entry.id));
        memCache.push(entry);
        added = true;
        if (db) {
          try {
            const tx = db.transaction(STORE_NAME, "readwrite");
            tx.objectStore(STORE_NAME).put(entry);
          } catch(e) {}
        }
      }
    });

    if (added) {
      memCache.sort((a, b) => new Date(b.at) - new Date(a.at));
      try {
        localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(memCache.slice(0, MAX_FALLBACK_ENTRIES)));
      } catch(e) {}
    }
  }

  // Auto initialize on load
  init();

  return {
    init,
    log,
    mergeRemote,
    query,
    getStats,
    exportCSV,
    clearOlderThan,
    revert,
    moduleLabel,
    actionLabel,
    detectSeverity,
    translateAuditText,
    getAllCount: () => memCache.length,
    getRecordById: (id) => memCache.find(x => x.id === id)
  };
})();

// Export globally
if (typeof window !== "undefined") {
  window.AuditLog = AuditLog;
}
