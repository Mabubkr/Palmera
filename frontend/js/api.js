/**
 * PalmTrace Data Access Layer & Sync Engine (API & Offline-First Abstraction)
 * يضمن تشغيل النظام أوفلاين كـ Demo أو أونلاين بالاتصال بقاعدة البيانات.
 */
/**
 * ListSync — local copies of the two big lists: trees (palms) and field operations.
 * - Saved in IndexedDB per user and list, in compact columnar form.
 * - Each sync downloads only rows changed since the saved version (server "palmsSync"/"operationsSync").
 * - After merging a delta, row count and id checksum must match the server, otherwise the
 *   list is reloaded in full.
 * - When the server is unreachable, the saved lists are shown so field work continues offline.
 */
const ListSync = (() => {
  const DB_NAME = "palmtrace-cache";
  const STORE = "kv";
  const mem = {}; // name -> { key, version, lookupsHash, cols, rows }

  function idb() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") return reject(new Error("no indexedDB"));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function idbGet(key) {
    try {
      const db = await idb();
      return await new Promise(res => {
        const r = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
        r.onsuccess = () => res(r.result || null);
        r.onerror = () => res(null);
      });
    } catch { return null; }
  }
  async function idbPut(key, val) {
    try {
      const db = await idb();
      await new Promise(res => {
        const tx = db.transaction(STORE, "readwrite");
        if (val === null) tx.objectStore(STORE).delete(key); else tx.objectStore(STORE).put(val, key);
        tx.oncomplete = res; tx.onerror = res;
      });
    } catch {}
  }
  const keyFor = (name, session) => (session && session.id) ? `${name}:${session.id}` : null;

  async function load(name, session) {
    const key = keyFor(name, session);
    if (!key) return null;
    if (mem[name] && mem[name].key === key) return mem[name];
    const saved = await idbGet(key);
    mem[name] = (saved && saved.cols && saved.rows) ? { ...saved, key } : null;
    return mem[name];
  }

  function expand(cols, rows) {
    return rows.map(r => {
      const o = {};
      for (let i = 0; i < cols.length; i++) o[cols[i]] = r[i];
      return o;
    });
  }

  // Same checksum as the server (backend/lib/bootstrap.js idHash)
  function idHash(ids) {
    let acc = 0;
    for (const id of ids) {
      const str = String(id);
      let h = 0x811c9dc5;
      for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
      acc = (acc ^ h) >>> 0;
    }
    return acc;
  }

  // sortRows(rows, cols) keeps the order the screens expect.
  // Returns merged objects, or null when a delta does not reproduce the server's list.
  function apply(name, session, base, ps, sortRows) {
    const key = keyFor(name, session);
    let cols = ps.cols || [];
    let rows;
    if (ps.mode === "delta" && base) {
      if (cols.length && base.cols.join("|") !== cols.join("|")) return null;
      cols = base.cols;
      const idIdx = cols.indexOf("id");
      const byId = new Map(base.rows.map(r => [r[idIdx], r]));
      (ps.deleted || []).forEach(id => byId.delete(id));
      (ps.rows || []).forEach(r => byId.set(r[idIdx], r));
      rows = Array.from(byId.values());
      const ids = rows.map(r => r[idIdx]);
      if (rows.length !== ps.total || idHash(ids) !== ps.idHash) return null;
    } else if (ps.mode === "full") {
      rows = ps.rows || [];
    } else {
      return null;
    }
    if (sortRows && cols.length) rows = sortRows(rows, cols);
    mem[name] = { key, version: ps.version, lookupsHash: ps.lookupsHash, cols, rows };
    if (key) idbPut(key, { version: ps.version, lookupsHash: ps.lookupsHash, cols, rows });
    return expand(cols, rows);
  }

  async function reset(name, session) {
    mem[name] = null;
    const key = keyFor(name, session);
    if (key) await idbPut(key, null);
  }

  return { load, apply, reset, expand };
})();

// Ordering used by the screens
const byIdAsc = (rows, cols) => { const i = cols.indexOf("id"); return rows.sort((a, b) => a[i] - b[i]); };
const byAtDesc = (rows, cols) => { const i = cols.indexOf("at"); return rows.sort((a, b) => String(b[i] || "").localeCompare(String(a[i] || ""))); };

const Api = (() => {
  const API_URL = (typeof window !== "undefined" && window.location && window.location.origin && window.location.origin.startsWith("http")) ? `${window.location.origin}/api` : "http://localhost:3000/api";
  let _isOnline = false;
  let _syncing = false;

  function setOnline(state) {
    const changed = (_isOnline !== state);
    _isOnline = state;
    if (changed && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("palmtrace:health-change", { detail: { isOnline: state } }));
    }
  }

  function isOnline() {
    return _isOnline;
  }

  async function checkHealth() {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setOnline(false);
      return false;
    }
    try {
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;
      const res = await fetch(`${API_URL}/health`, {
        method: "GET",
        cache: "no-store",
        signal: controller ? controller.signal : undefined
      });
      if (timeoutId) clearTimeout(timeoutId);
      const ct = res.headers.get("content-type") || "";
      if (res.ok && ct.includes("application/json")) {
        const data = await res.json().catch(() => null);
        if (data && data.status === "online") {
          setOnline(true);
          return true;
        }
      }
    } catch {
      setOnline(false);
      return false;
    }
    setOnline(false);
    return false;
  }

  function getHeaders(extra = {}) {
    const s = (typeof session === "function") ? session() : null;
    return {
      "Content-Type": "application/json",
      "x-user-id": s?.id || "",
      ...extra
    };
  }

  // مصادقة تسجيل الدخول عبر الخادم وقاعدة البيانات
  async function login(username, password) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success && data.user) {
          if (typeof Auth !== "undefined") {
            Auth.setToken(data.token);
            Auth.rememberOfflineLogin(data.user, password);
          }
          return { success: true, user: data.user };
        }
        return { success: false, error: data.error || "بيانات الدخول غير صحيحة" };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
    return { success: false, error: "offline" };
  }

  // تغيير كلمة المرور للمستخدم
  async function changePassword(userId, oldPassword, newPassword, username) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/auth/change-password`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({ userId, oldPassword, newPassword, username })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) return { success: true, ...data };
        return { success: false, error: data.error || "فشل تغيير كلمة المرور" };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    return { success: false, error: "offline" };
  }

  // طلب استعادة كلمة المرور
  async function forgotPassword(identifier) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/auth/forgot-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) return { success: true, ...data };
        return { success: false, error: data.error || "فشل إرسال طلب الاستعادة" };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    return { success: false, error: "offline" };
  }

  // تعيين كلمة المرور برمز الاستعادة
  async function resetPassword(token, newPassword) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/auth/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, newPassword })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) return { success: true, ...data };
        return { success: false, error: data.error || "فشل إعادة تعيين كلمة المرور" };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    return { success: false, error: "offline" };
  }

  // إنشاء مستخدم جديد عبر الإدارة مع كلمة مرور مؤقتة
  async function createUser(userData) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/users`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(userData)
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) return { success: true, ...data };
        return { success: false, error: data.error || "فشل حفظ المستخدم" };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    return { success: false, error: "offline" };
  }

  // إعادة تعيين كلمة مرور المستخدم إدارياً
  async function adminResetPassword(userId) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/users/${encodeURIComponent(userId)}/reset-password`, {
          method: "POST",
          headers: getHeaders()
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) return { success: true, ...data };
        return { success: false, error: data.error || "فشل إعادة تعيين كلمة المرور" };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    return { success: false, error: "offline" };
  }

  // حذف مستخدم
  async function deleteUser(userId) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/users/${encodeURIComponent(userId)}`, {
          method: "DELETE",
          headers: getHeaders()
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) return { success: true, ...data };
        return { success: false, error: data.error || "فشل حذف المستخدم" };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    return { success: false, error: "offline" };
  }

  // مزامنة طابور العمليات المعلقة عند توفر الشبكة
  async function syncQueue() {
    if (_syncing) return;
    const isUp = await checkHealth();
    if (!isUp) return;

    const st = Store.get();
    const pendingOps = (st.operations || []).filter(o => o.status !== "synced");
    const pendingQueue = (st.queue || []).filter(q => q.status !== "synced");
    if (pendingOps.length === 0 && pendingQueue.length === 0) return;

    _syncing = true;
    try {
      const payload = pendingOps.length > 0 ? pendingOps : [];
      if (payload.length > 0) {
        const res = await fetch(`${API_URL}/sync`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({ operations: payload })
        });

        const ct = res.headers.get("content-type") || "";
        if (res.ok && ct.includes("application/json")) {
          const data = await res.json().catch(() => ({}));
          const syncedIds = new Set(payload.map(p => p.id));
          st.operations.forEach(o => { if (syncedIds.has(o.id)) o.status = "synced"; });
          st.queue.forEach(q => { q.status = "synced"; });
          Store.set({ operations: st.operations, queue: st.queue });
          if (typeof toast === "function") {
            toast(`📡 تمت مزامنة ${data.processed || payload.length} حركة مع قاعدة البيانات بنجاح`);
          }
          if (typeof render === "function") render();
        }
      } else {
        st.queue.forEach(q => { q.status = "synced"; });
        Store.set({ queue: st.queue });
        if (typeof render === "function") render();
      }
    } catch (err) {
      console.warn("تعذرت المزامنة التلقائية مع الخادم:", err);
    } finally {
      _syncing = false;
    }
  }

  // مزامنة شاملة لكافة بيانات المزرعة إلى قاعدة بيانات SQLite (القطاعات، القطع، الأشجار، الفسائل، العمليات)
  async function syncAllToDatabase(options = {}) {
    if (_syncing) return { success: false, message: "عملية مزامنة أخرى جارية حالياً" };
    const isUp = await checkHealth();
    if (!isUp) {
      if (options.manual && typeof toast === "function") {
        toast("⚠️ خادم قاعدة البيانات المركزية غير متصل (http://localhost:3000)");
      }
      return { success: false, error: "offline" };
    }

    _syncing = true;
    try {
      const st = Store.get();
      const allPalms = st.palms || [];
      let palmsToSync = [];
      if (options.newPalms && Array.isArray(options.newPalms)) {
        palmsToSync = options.newPalms;
      } else if (options.palms && Array.isArray(options.palms)) {
        palmsToSync = options.palms;
      } else if (options.forceFull || options.manual || allPalms.length <= 500) {
        palmsToSync = allPalms;
      } else {
        palmsToSync = allPalms.filter(p => p && (p.isOffline || p.status === "pending" || p._dirty || p._new));
      }

      const allOff = st.offshoots || [];
      const offshootsToSync = (options.forceFull || options.manual || allOff.length <= 100)
        ? allOff
        : allOff.filter(o => o && (o.isOffline || o.status === "pending" || o._dirty));

      const payload = {
        sectors: st.sectors || [],
        plots: st.plots || [],
        crops: st.crops || [],
        propagationSourceTypes: st.propagationSourceTypes || [],
        palms: palmsToSync,
        offshoots: offshootsToSync,
        operations: (st.operations || st.queue || []).filter(o => o && o.status !== "synced")
      };

      const res = await fetch(`${API_URL}/sync/all`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });

      const ct = res.headers.get("content-type") || "";
      if (res.ok && ct.includes("application/json")) {
        const data = await res.json().catch(() => ({}));
        if (st.operations) st.operations.forEach(o => { o.status = "synced"; });
        if (st.queue) st.queue.forEach(q => { q.status = "synced"; });
        Store.set({ operations: st.operations, queue: st.queue });

        const secCount = data.counts?.sectors || payload.sectors.length;
        const plotCount = data.counts?.plots || payload.plots.length;
        const palmCount = data.counts?.palms || payload.palms.length;

        if (typeof toast === "function") {
          toast(`🗄️ تم حفظ وتحديث قاعدة البيانات: ${secCount} قطاع، ${plotCount} قطعة، ${palmCount} أصل بنجاح!`);
        }
        return { success: true, data };
      } else {
        let errMsg = "تعذر الاتصال بخادم قاعدة البيانات";
        if (ct.includes("application/json")) {
          const errData = await res.json().catch(() => ({}));
          errMsg = errData.error || errMsg;
        }
        throw new Error(errMsg);
      }
    } catch (err) {
      console.error("فشل مزامنة قاعدة البيانات الشاملة:", err);
      if (typeof toast === "function") toast(`⚠️ خطأ في مزامنة قاعدة البيانات: ${err.message}`);
      return { success: false, error: err.message };
    } finally {
      _syncing = false;
    }
  }

  // حفظ قطاع جديد
  async function createSector(sec) {
    if (await checkHealth()) {
      try {
        await fetch(`${API_URL}/sectors`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(sec)
        });
      } catch (err) {
        console.warn("حفظ محلي فقط — تعذر إرسال القطاع للسيرفر:", err);
      }
    }
  }

  // حفظ قطعة جديدة
  async function createPlot(plot) {
    if (await checkHealth()) {
      try {
        await fetch(`${API_URL}/plots`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(plot)
        });
      } catch (err) {
        console.warn("حفظ محلي فقط — تعذر إرسال القطعة للسيرفر:", err);
      }
    }
  }

  // تعديل بيانات قطاع
  async function updateSector(id, data) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/sectors/${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify(data)
        });
        return await res.json();
      } catch (err) {
        console.warn("تعذر تحديث القطاع في الخادم:", err);
      }
    }
    return { success: false, error: "offline" };
  }

  // فحص تبعيات القطاع وتأثير الحذف
  async function getSectorImpact(id) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/sectors/${encodeURIComponent(id)}/impact`, {
          headers: getHeaders()
        });
        return await res.json();
      } catch (err) {
        console.warn("تعذر فحص تبعيات القطاع في الخادم:", err);
      }
    }
    return null;
  }

  // حذف قطاع مشروط (حذف متسلسل آمن عند خلوه من العمليات)
  async function deleteSector(id) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/sectors/${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: getHeaders()
        });
        return await res.json();
      } catch (err) {
        console.warn("تعذر حذف القطاع في الخادم:", err);
        return { success: false, error: err.message };
      }
    }
    return { success: false, error: "offline" };
  }

  // أرشفة قطاع وقائي (Soft Delete عند وجود عمليات)
  async function archiveSector(id) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/sectors/${encodeURIComponent(id)}/archive`, {
          method: "POST",
          headers: getHeaders()
        });
        return await res.json();
      } catch (err) {
        console.warn("تعذر أرشفة القطاع في الخادم:", err);
        return { success: false, error: err.message };
      }
    }
    return { success: false, error: "offline" };
  }

  // جلب أحدث البيانات من قاعدة البيانات المركزية ومطابقتها محلياً لمشروع محدد
  let _isPulling = false;
  let _listRetrying = false;
  let _lastPullTime = 0;
  const PULL_COOLDOWN_MS = 60000;
  async function hydrateOffline() {
    try {
      const st = Store.get();
      if (!st.session) return;
      const isLocal = p => p && (p.status === "pending" || p.isOffline || p._dirty || p._new);
      let changed = false;
      if (!(st.palms || []).some(p => !isLocal(p))) {
        const base = await ListSync.load("palms", st.session);
        if (base) { st.palms = [...(st.palms || []).filter(isLocal), ...ListSync.expand(base.cols, base.rows)]; changed = true; }
      }
      if (!(st.operations || []).some(o => o && o.status === "synced")) {
        const base = await ListSync.load("operations", st.session);
        if (base) {
          const saved = ListSync.expand(base.cols, base.rows).map(o => ({ ...o, status: o.status || "synced" }));
          st.operations = [...(st.operations || []), ...saved];
          changed = true;
        }
      }
      if (changed && typeof render === "function") render();
    } catch (e) {
      console.warn("Offline cache unavailable:", e);
    }
  }

  // Nursery stage + details of offshoots/seedlings. Records stay marked _nsDirty until the server
  // confirms, so a change made offline survives a refresh and is sent on the next sync.
  const NURSERY_META_KEYS = ["preps", "status", "statusDesc", "approval", "receivedBy", "receivedAt", "receivedByName", "cullReason", "cullDate", "cullNotes",
    "dispatchedToUser", "dispatchedToUserName", "dispatchedToPlot", "dispatchedAt", "dispenseNotes"];
  async function saveNurseryState(list) {
    const recs = (list || []).filter(Boolean);
    if (!recs.length) return { success: true, saved: 0 };
    const items = recs.map(r => {
      const meta = {};
      NURSERY_META_KEYS.forEach(k => { if (r[k] !== undefined) meta[k] = r[k]; });
      return { id: r.id, stage: r.nsStatus, meta };
    });
    try {
      const res = await fetch(`${API_URL}/offshoots/nursery-state`, { method: "POST", headers: getHeaders(), body: JSON.stringify({ items }) });
      if (!res.ok) return { success: false };
      const j = await res.json();
      const missing = new Set((j.missing || []).map(String));
      const st = Store.get();
      const ids = new Set(recs.map(r => String(r.id)));
      [...(st.offshoots || []), ...(st.nurseryItems || [])].forEach(o => { if (o && ids.has(String(o.id)) && !missing.has(String(o.id))) delete o._nsDirty; });
      Store.set({ offshoots: st.offshoots, nurseryItems: st.nurseryItems || [] });
      return j;
    } catch (err) {
      return { success: false, offline: true };
    }
  }
  async function flushNurseryState() {
    const st = Store.get();
    const dirty = [...(st.offshoots || []), ...(st.nurseryItems || [])].filter(o => o && o._nsDirty);
    if (dirty.length) await saveNurseryState(dirty);
  }

  async function pullLatest(overrideProjectId = null, force = false) {
    if (_isPulling) return false;
    const now = Date.now();
    if (!force && (now - _lastPullTime < PULL_COOLDOWN_MS)) {
      return false;
    }
    _isPulling = true;
    try {
      const isUp = await checkHealth();
      if (!isUp) {
        // Offline: show the trees and operations saved on this device from the last sync
        await hydrateOffline(st0 => st0);
        return false;
      }
      { // send nursery changes made offline before the server copy replaces the local one
        try { await flushNurseryState(); } catch (e) {}
      }

      const st = Store.get();
      const currentProjId = overrideProjectId || st.activeProjectId || "proj_farafra_01";
      // Trees and operations are synced incrementally: send the versions we already hold (see ListSync)
      const palmBase = await ListSync.load("palms", st.session);
      const opsBase = await ListSync.load("operations", st.session);
      let qs = "v=2";
      if (palmBase) qs += `&palmsSince=${palmBase.version}&palmsLookups=${encodeURIComponent(palmBase.lookupsHash)}`;
      if (opsBase) qs += `&opsSince=${opsBase.version}&opsLookups=${encodeURIComponent(opsBase.lookupsHash)}`;
      const res = await fetch(`${API_URL}/bootstrap?${qs}`, {
        cache: "no-store",
        headers: getHeaders({ "x-project-id": currentProjId })
      });
      if (res.ok) {
        _lastPullTime = Date.now();
        const remote = await res.json();
        if (remote.palmsSync || remote.operationsSync) {
          const palms = remote.palmsSync ? ListSync.apply("palms", st.session, palmBase, remote.palmsSync, byIdAsc) : null;
          const ops = remote.operationsSync ? ListSync.apply("operations", st.session, opsBase, remote.operationsSync, byAtDesc) : null;
          if ((remote.palmsSync && !palms) || (remote.operationsSync && !ops)) {
            if (!_listRetrying) {
              // Local copy out of step with the server: drop it and fetch the full lists once
              if (!palms) await ListSync.reset("palms", st.session);
              if (!ops) await ListSync.reset("operations", st.session);
              _isPulling = false;
              _listRetrying = true;
              try { return await pullLatest(overrideProjectId, true); } finally { _listRetrying = false; }
            }
          }
          remote.palms = palms || (st.palms || []).filter(p => !(p && (p.status === "pending" || p.isOffline || p._dirty || p._new)));
          remote.operations = ops || (st.operations || []).filter(o => o && o.status === "synced");
        }

        // تحديث الميتاداتا المؤسسية
        if (remote.companies && remote.companies.length > 0) st.companies = remote.companies;
        if (remote.projects && remote.projects.length > 0) st.projects = remote.projects;
        if (remote.settings && Object.keys(remote.settings).length > 0) {
          st.settings = { ...(st.settings || {}), ...remote.settings };
        }
        if (remote.userProjectAccess && remote.userProjectAccess.length > 0) st.userProjectAccess = remote.userProjectAccess;
        st.activeProjectId = currentProjId;
        if (remote.activeCompanyId) st.activeCompanyId = remote.activeCompanyId;

        // 1. القطاعات الخاصة بالمشروع
        st.sectors = remote.sectors || [];

        // 2. القطع الخاصة بالمشروع
        st.plots = remote.plots || [];

        // 3. النخيل والأشجار والعمليات التابعة للمشروع
        const remotePalms = remote.palms || [];
        if (remotePalms.length === 0 && (remote.sectors || []).length === 0) {
          // Clean fresh start: remote database has been intentionally purged
          st.palms = [];
          st.offshoots = [];
          st.operations = [];
          st.pendingPalms = [];
          st.pendingOffshoots = [];
          st.pendingOperations = [];
          st.yields = remote.yields || [];
        } else {
          const localPendingPalms = (st.palms || []).filter(p => p && (p.status === "pending" || p.isOffline || p._dirty || p._new));
          const remotePalmIds = new Set(remotePalms.map(r => String(r.id)));
          // A tree added on this device gets a server id; once the server copy (same code) arrives, drop the local one
          const remotePalmCodes = new Set(remotePalms.map(r => r.code).filter(Boolean));
          st.palms = [...localPendingPalms.filter(p => !remotePalmIds.has(String(p.id)) && !(p.code && remotePalmCodes.has(p.code))), ...remotePalms];
          st.palms.forEach(p => {
            if (!p.gps && p.gps_lat !== null && p.gps_lat !== undefined && p.gps_lng !== null && p.gps_lng !== undefined) {
              p.gps = `${p.gps_lat},${p.gps_lng}`;
            }
            if (!p.sector && p.sectorId) p.sector = p.sectorId;
            if (!p.sector && p.sector_id) p.sector = p.sector_id;
            if (!p.sectorId && p.sector) p.sectorId = p.sector;
            if (!p.plot && p.plotId) p.plot = p.plotId;
            if (!p.plot && p.plot_id) p.plot = p.plot_id;
            if (!p.plotId && p.plot) p.plotId = p.plot;
          });

          // 4. الفسائل والمشتل
          const localPendingOff = (st.offshoots || []).filter(os => os && (os.status === "pending" || os.isOffline));
          const localDirtyOff = new Map((st.offshoots || []).filter(os => os && os._nsDirty).map(os => [String(os.id), os]));
          const remoteOffshoots = (remote.offshoots || []).map(r => localDirtyOff.get(String(r.id)) || r); // unsent nursery edits win
          const remoteOffIds = new Set(remoteOffshoots.map(r => String(r.id)));
          st.offshoots = [...localPendingOff.filter(os => !remoteOffIds.has(String(os.id))), ...remoteOffshoots];

          // 5. العمليات الحقلية
          const localPendingOps = (st.operations || []).filter(o => o && o.status !== "synced");
          const remoteOps = (remote.operations || []).map(o => ({
            ...o,
            photos: (typeof o.photos === "string") ? (function(){ try { const p = JSON.parse(o.photos); return Array.isArray(p) ? p : (o.photos ? [o.photos] : []); } catch(e){ return o.photos ? [o.photos] : []; } })() : (Array.isArray(o.photos) ? o.photos : [])
          }));
          const remoteOpIds = new Set(remoteOps.map(r => String(r.id)));
          st.operations = [...localPendingOps.filter(o => !remoteOpIds.has(String(o.id))), ...remoteOps];
        }

        // 6. الأسمدة والمخزون
        const remoteFerts = (remote.fertilizers || []).map(f => ({
          id: f.id,
          name: f.name,
          kind: f.kind || "كيميائي",
          unit: f.unit || "كجم",
          cropId: f.cropId || f.crop_id || "all",
          stock: Number(f.stock) || 0,
          allocated: Number(f.allocated) || 0,
          consumed: Number(f.consumed) || 0,
          minAlert: Number(f.minAlert !== undefined ? f.minAlert : (f.min_alert !== undefined ? f.min_alert : 50)),
          unitCost: Number(f.unitCost !== undefined ? f.unitCost : (f.unit_cost !== undefined ? f.unit_cost : 0)),
          active: f.active === 1 || f.active === true || f.active === '1'
        }));
        if (remoteFerts && remoteFerts.length > 0) {
          st.fertilizers = remoteFerts;
        }

        // 7. الحصاد والإنتاج
        st.yields = (remote.yields || []).map(y => ({
          ...y,
          by: y.by || y.recordedBy || y.recorded_by || "u1",
          recordedByName: y.recordedByName || y.byName || y.recorded_by_name || ""
        }));

        // 7.1 سجل الرقابة والتدقيق (مزامنة للأجهزة المشتركة والموبايل)
        if (remote.auditLogs && typeof AuditLog !== "undefined" && typeof AuditLog.mergeRemote === "function") {
          AuditLog.mergeRemote(remote.auditLogs);
        }

        // 8. أذونات الصرف
        const remoteVouchers = (remote.fertilizerVouchers || []).map(v => ({
          ...v,
          id: v.id,
          type: v.type || v.voucherType || v.voucher_type || "issue",
          fertId: v.fertId || v.fertilizerId || v.fertilizer_id,
          fertName: v.fertName || "سماد",
          unit: v.unit || "كجم",
          qty: Number(v.qty) || 0,
          from: v.from || v.fromEntity || v.from_entity || "المخزن الرئيسي",
          toUser: v.toUser || v.toUserId || v.to_user_id,
          sectorId: v.sectorId || v.sector_id || "",
          status: v.status || "pending",
          date: v.date || v.voucherDate || v.voucher_date || new Date().toISOString().slice(0, 10),
          notes: v.notes || ""
        }));
        const remoteVoucherIds = new Set(remoteVouchers.map(v => String(v.id)));
        const localOnlyVouchers = (st.fertilizerVouchers || []).filter(lv => lv && lv.id && !remoteVoucherIds.has(String(lv.id)));
        st.fertilizerVouchers = [...remoteVouchers, ...localOnlyVouchers];

        // 9. تنظيف الإشعارات وعزلها للمشروع
        if (st.notifications && Array.isArray(st.notifications)) {
          st.notifications = st.notifications.filter(n => {
            if (n.projectId) return n.projectId === currentProjId;
            return currentProjId === "proj_farafra_01";
          });
        }

        // 9.1 تنظيف شحنات الزكاة المجمعة
        if (st.zakatBatches && Array.isArray(st.zakatBatches)) {
          st.zakatBatches = st.zakatBatches.filter(b => {
            if (b.projectId) return b.projectId === currentProjId;
            return currentProjId === "proj_farafra_01";
          });
        }

        // 9.2 تنظيف جداول العمليات الدورية
        if (st.operationSchedules && Array.isArray(st.operationSchedules)) {
          st.operationSchedules = st.operationSchedules.filter(s => {
            if (!s.projectId || s.projectId === currentProjId) return true;
            return false;
          });
        }

        // 9.3 تنظيف المزارعين
        if (st.farmers && Array.isArray(st.farmers)) {
          st.farmers = st.farmers.filter(f => {
            if (f.projectId) return f.projectId === currentProjId;
            return currentProjId === "proj_farafra_01";
          });
        }

        // 9.4 تحديث المستخدمين بحسب نطاق الشركة
        // 9.4 تحديث المستخدمين بحسب نطاق الشركة مع الحفاظ على كلمات المرور المؤقتة والافتراضية
        if (remote.users && remote.users.length > 0) {
          const defUsers = (typeof Store !== "undefined" && Store.def) ? (Store.def().users || []) : [];
          const defPassMap = new Map();
          defUsers.forEach(du => {
            if (du.id) defPassMap.set(du.id, du.pass || "1234");
            if (du.user) defPassMap.set(du.user, du.pass || "1234");
          });
          const localPassMap = new Map();
          (st.users || []).forEach(lu => {
            if (lu.id && lu.pass) localPassMap.set(lu.id, lu.pass);
            if (lu.user && lu.pass) localPassMap.set(lu.user, lu.pass);
          });

          const mergedUsers = remote.users.map(ru => {
            const known = ru.pass || localPassMap.get(ru.id) || localPassMap.get(ru.user) || defPassMap.get(ru.id) || defPassMap.get(ru.user);
            const fallback = ["admin", "engineer", "worker", "investor", "nursery", "storage", "care", "inv2", "inv3", "inv4"].includes(ru.user) ? "1234" : "";
            return {
              ...ru,
              pass: known || fallback
            };
          });

          const remoteUsernames = new Set(mergedUsers.map(u => (u.user || "").toLowerCase()));
          const preserved = defUsers.filter(bu => !remoteUsernames.has((bu.user || "").toLowerCase()));
          st.users = [...mergedUsers, ...preserved];
        }

        // 10. المحاصيل ومصادر الإكثار والمواسم الزراعية
        if (remote.cropPlantingSources && remote.cropPlantingSources.length > 0) {
          st.cropPlantingSources = remote.cropPlantingSources;
        }
        if (remote.crops && remote.crops.length > 0) {
          st.crops = remote.crops.map(c => {
            const cropCode = c.code || (typeof c.id === "string" ? c.id : (c.id === 1 ? "palm" : c.id === 2 ? "olive" : String(c.id)));
            const cropSources = (c.sources && c.sources.length) ? c.sources : (
              (remote.cropPlantingSources || []).filter(s => s.cropId === cropCode || s.cropId === String(c.numericId)).map(s => ({
                code: s.codeLetter || s.code,
                name: s.name,
                isDefault: Boolean(s.isDefault)
              }))
            );
            return {
              ...c,
              numericId: c.numericId || (typeof c.id === "number" ? c.id : (cropCode === "palm" ? 1 : cropCode === "olive" ? 2 : (cropCode === "mango" ? 3 : null))),
              id: cropCode,
              code: cropCode,
              yieldName: c.yield_name || c.yieldName || (cropCode === "palm" ? "التمور" : cropCode === "olive" ? "الزيتون" : cropCode === "mango" ? "ثمار المانجو" : "المحصول"),
              yield_name: c.yield_name || c.yieldName || (cropCode === "palm" ? "التمور" : cropCode === "olive" ? "الزيتون" : cropCode === "mango" ? "ثمار المانجو" : "المحصول"),
              sources: (cropSources && cropSources.length) ? cropSources : (
                cropCode === "palm" ? [{ code: "F", name: "فسيلة", isDefault: true }, { code: "N", name: "زراعة أنسجة (نخيل)", isDefault: false }] :
                cropCode === "olive" ? [{ code: "C", name: "عقلة خضرية", isDefault: true }, { code: "S", name: "شتلة بذرية", isDefault: false }] :
                cropCode === "mango" ? [{ code: "G", name: "شتلة مطعومة", isDefault: true }, { code: "A", name: "ترقيد هوائي", isDefault: false }] :
                [{ code: c.primarySourceCode || "S", name: c.offspring || "شتلة", isDefault: true }]
              )
            };
          });
        }
        if (remote.propagationSourceTypes && remote.propagationSourceTypes.length > 0) st.propagationSourceTypes = remote.propagationSourceTypes;
        if (remote.cropVarieties && remote.cropVarieties.length > 0) st.cropVarieties = remote.cropVarieties;
        if (remote.nurseryPrepTypes && remote.nurseryPrepTypes.length > 0) st.nurseryPrepTypes = remote.nurseryPrepTypes;
        if (Array.isArray(remote.zakat)) st.zakat = mergeZakat(st.zakat, remote.zakat);
        if (remote.seasons && remote.seasons.length > 0) st.seasons = remote.seasons;
        if (remote.fertilizerSeasonBalances) st.fertilizerSeasonBalances = remote.fertilizerSeasonBalances;

        // 11. تصنيفات وأنواع العمليات الحقلية بنطاق التنفيذ
        if (remote.operationTypes && remote.operationTypes.length > 0) {
          st.operationTypes = remote.operationTypes.map(ot => ({
            id: ot.id,
            catId: ot.categoryId || ot.category_id || ot.catId || 'c_d',
            name: ot.name,
            scopeType: ot.scopeType || ot.scope_type || 'both',
            isCritical: Boolean(ot.isCritical || ot.is_critical),
            requiresApproval: ot.requiresApproval !== undefined ? Boolean(ot.requiresApproval) : true,
            requiresMaterial: Boolean(ot.requiresMaterial || ot.requires_material),
            allowedKinds: ot.allowedKinds ? (typeof ot.allowedKinds === 'string' ? JSON.parse(ot.allowedKinds) : ot.allowedKinds) : [],
            cropId: ot.cropId || ot.crop_id || 'all',
            inactive: ot.active === 0 || ot.active === false
          }));
        }

        // 12. الملاحظات والتكليفات الميدانية
        if (remote.treeNotes) {
          st.treeNotes = remote.treeNotes;
        }

        // 13. العقود الاستثمارية والقطع المسندة ومصفوفة الأدوار
        if (remote.investors) {
          st.investors = remote.investors;
        }
        if (remote.contracts) {
          st.contracts = remote.contracts;
        }
        if (remote.contractPlots) {
          st.contractPlots = remote.contractPlots;
        }
        if (remote.contractTemplates) {
          st.contractTemplates = remote.contractTemplates;
        }
        if (remote.contractInvoices) {
          st.contractInvoices = remote.contractInvoices;
        }
        if (remote.availableRoles && remote.availableRoles.length > 0) {
          st.availableRoles = remote.availableRoles;
          st.roles = st.roles || [];
          remote.availableRoles.forEach(ar => {
            const existing = st.roles.find(r => r.id === ar.id);
            if (!existing) {
              st.roles.push({
                id: ar.id,
                name: ar.nameAr || ar.name,
                desc: ar.description || "",
                perms: ar.perms || [],
                matrix: ar.matrix || {}
              });
            } else {
              if (ar.nameAr) existing.name = ar.nameAr;
              if (ar.description) existing.desc = ar.description;
              if (ar.matrix) existing.matrix = ar.matrix;
              if (ar.perms) existing.perms = ar.perms;
            }
          });
        }

        // تحديث جلسة المستخدم الحالي بأحدث الأدوار والعقود المسندة
        if (st.session && remote.users) {
          const me = remote.users.find(u => u.id === st.session.id || u.user === st.session.username || u.user === st.session.user);
          if (me) {
            if (me.roles && Array.isArray(me.roles) && me.roles.length > 0) {
              st.session.roles = me.roles;
              if (!me.roles.includes(st.session.role)) {
                st.session.role = me.roles[0];
              }
            }
            if (me.contractIds) {
              st.session.contractIds = me.contractIds;
            }
          }
        }

        const prevOpsCount = (Store.get()?.operations || []).length;
        const newOpsCount = (st.operations || []).length;
        if (prevOpsCount > 0 && newOpsCount > prevOpsCount) {
          const diff = newOpsCount - prevOpsCount;
          if (typeof window !== "undefined" && typeof window.triggerPulseNotification === "function") {
            window.triggerPulseNotification(diff);
          }
        }

        Store.set(st);
        if (typeof render === "function") {
          const isBusy = (typeof window !== "undefined" && typeof window.isUserEditingOrFormActive === "function")
            ? window.isUserEditingOrFormActive()
            : (typeof document !== "undefined" && (
                (document.activeElement && ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) ||
                document.querySelector(".custom-modal-backdrop, .modal, .modal-backdrop, .modal-overlay, [role='dialog']")
              ));
          if (!isBusy) {
            render();
          }
        }
        return true;
      }
    } catch (err) {
      console.warn("تعذر جلب البيانات من السيرفر:", err);
    } finally {
      _isPulling = false;
    }
    return false;
  }

  // التبديل الفوري السلس بين المشاريع والمزارع
  async function switchProject(projectId) {
    const st = Store.get();
    const targetProj = (st.projects || []).find(p => p.id === projectId);
    if (!targetProj) {
      console.warn("المشروع المطلوب غير موجود:", projectId);
      return false;
    }

    const companyId = targetProj.companyId || targetProj.company_id || st.activeCompanyId;
    Store.set({ activeProjectId: projectId, activeCompanyId: companyId });

    if (await checkHealth()) {
      await pullLatest(projectId);
    } else {
      if (typeof render === "function") render();
    }

    if (typeof toast === "function") {
      toast(`🏢 تم الانتقال إلى مزرعة: ${targetProj.name}`);
    }
    return true;
  }

  // حفظ نخلة جديدة في السيرفر إذا كان متصلاً
  async function createPalm(palmData) {
    if (await checkHealth()) {
      try {
        await fetch(`${API_URL}/palms`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(palmData)
        });
      } catch (err) {
        console.warn("حفظ محلي فقط — تعذر إرسال النخلة للسيرفر:", err);
      }
    }
  }

  // تحديث بيانات وإحداثيات شجرة في السيرفر وقاعدة البيانات
  async function updatePalm(palmData) {
    if (!palmData) return;
    if (await checkHealth()) {
      try {
        const id = palmData.id || palmData.code;
        const res = await fetch(`${API_URL}/palms/${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify(palmData)
        });
        return await res.json().catch(() => ({}));
      } catch (err) {
        console.warn("تعذر تحديث بيانات وإحداثيات الشجرة بالسيرفر:", err);
      }
    }
  }

  // أرشفة أو إلغاء أرشفة شجرة في السيرفر
  async function archivePalm(palmId, archived, reason) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/palms/${encodeURIComponent(palmId)}/archive`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({ archived, reason })
        });
        return await res.json().catch(() => ({}));
      } catch (err) {
        console.warn("تعذر أرشفة الشجرة بالسيرفر:", err);
      }
    }
  }

  // حذف شجرة نهائياً من السيرفر
  async function deletePalm(palmId) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/palms/${encodeURIComponent(palmId)}`, {
          method: "DELETE",
          headers: getHeaders()
        });
        return await res.json().catch(() => ({}));
      } catch (err) {
        console.warn("تعذر حذف الشجرة بالسيرفر:", err);
      }
    }
  }

  // حفظ فسيلة جديدة
  async function createOffshoot(offData) {
    if (await checkHealth()) {
      try {
        await fetch(`${API_URL}/offshoots`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(offData)
        });
      } catch (err) {
        console.warn("حفظ محلي فقط — تعذر إرسال الفسيلة للسيرفر:", err);
      }
    }
  }

  // تسجيل وتوريد مجمع لفسائل المشتل
  async function bulkIntakeOffshoots(offshootsList) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/offshoots/bulk-intake`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({ offshoots: offshootsList })
        });
        return await res.json();
      } catch (err) {
        console.warn("تعذر إرسال التوريد المجمع للفسائل إلى السيرفر:", err);
      }
    }
    return { success: false, error: "offline" };
  }

  // ربط الفسيلة المصروفة بالشجرة المغروسة
  async function plantOffshoot(offshootId, palmId) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/offshoots/${encodeURIComponent(offshootId)}/plant`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({ palmId })
        });
        return await res.json();
      } catch (err) {
        console.warn("تعذر تحديث غرس الفسيلة في السيرفر:", err);
      }
    }
    return { success: false, error: "offline" };
  }

  // حفظ عملية حقلية جديدة
  async function createOperation(opData) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/operations`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(opData)
        });
        if (res.ok) {
          const st = Store.get();
          const target = (st.operations || []).find(o => o.id === opData.id);
          if (target) target.status = "synced";
          const qTarget = (st.queue || []).find(q => q.id === opData.id || q.detail === (opData.palmCode || ""));
          if (qTarget) qTarget.status = "synced";
          Store.set({ operations: st.operations, queue: st.queue });
        }
      } catch (err) {
        console.warn("حفظ محلي فقط — تعذر إرسال العملية للسيرفر:", err);
      }
    }
  }

  // اعتماد عملية حقلية بالسيرفر
  async function approveOperation(id, supervisorNotes) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/operations/${encodeURIComponent(id)}/approve`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({ supervisorNotes })
        });
        return await res.json();
      } catch (err) {
        console.warn("تعذر إرسال اعتماد العملية للسيرفر:", err);
      }
    }
    return { success: false, error: "offline" };
  }

  // رفض عملية حقلية بالسيرفر (دعم طلب إعادة العمل والإلغاء النهائي)
  async function rejectOperation(id, supervisorNotes, actionType) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/operations/${encodeURIComponent(id)}/reject`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({ supervisorNotes, actionType: actionType || "rejected" })
        });
        return await res.json();
      } catch (err) {
        console.warn("تعذر إرسال رفض العملية للسيرفر:", err);
      }
    }
    return { success: false, error: "offline" };
  }

  // اعتماد مجمع لحزمة عمليات جماعية بنقرة واحدة
  async function batchApproveOperations(batchId, ids, supervisorNotes) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/operations/batch/approve`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({ batchId, ids, supervisorNotes })
        });
        return await res.json();
      } catch (err) {
        console.warn("تعذر إرسال اعتماد الحزمة للسيرفر:", err);
      }
    }
    return { success: false, error: "offline" };
  }

  // رفض مجمع لحزمة عمليات جماعية (دعم طلب إعادة العمل والإلغاء النهائي)
  async function batchRejectOperations(batchId, ids, supervisorNotes, actionType) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/operations/batch/reject`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({ batchId, ids, supervisorNotes, actionType: actionType || "rejected" })
        });
        return await res.json();
      } catch (err) {
        console.warn("تعذر إرسال رفض الحزمة للسيرفر:", err);
      }
    }
    return { success: false, error: "offline" };
  }

  // إنشاء وتكليف ملاحظة ميدانية
  async function createTreeNote(data) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/tree-notes`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(data)
        });
        return await res.json();
      } catch (err) {
        console.warn("تعذر حفظ الملاحظة بالسيرفر:", err);
      }
    }
    return { success: false, error: "offline" };
  }

  // بدء تنفيذ تكليف ميداني
  async function startTreeNote(id) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/tree-notes/${encodeURIComponent(id)}/start`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({})
        });
        return await res.json();
      } catch (err) {}
    }
    return { success: false, error: "offline" };
  }

  // إتمام وتوثيق تكليف ميداني بصورة
  async function completeTreeNote(id, executionNotes, proofPhoto) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/tree-notes/${encodeURIComponent(id)}/complete`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({ executionNotes, executionProofPhoto: proofPhoto })
        });
        return await res.json();
      } catch (err) {
        console.warn("تعذر توثيق إتمام التكليف بالسيرفر:", err);
      }
    }
    return { success: false, error: "offline" };
  }

  // اعتماد وإغلاق ملاحظة ميدانية بواسطة المهندس
  async function closeTreeNote(id) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/tree-notes/${encodeURIComponent(id)}/close`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({})
        });
        return await res.json();
      } catch (err) {
        console.warn("تعذر إغلاق الملاحظة بالسيرفر:", err);
      }
    }
    return { success: false, error: "offline" };
  }

  // حفظ نوع عملية وإعدادات النطاق
  async function saveOperationType(typeData) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/operation-types`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(typeData)
        });
        return await res.json();
      } catch (err) {
        console.warn("تعذر حفظ نوع العملية بالسيرفر:", err);
      }
    }
    return { success: false, error: "offline" };
  }

  // حفظ شحنة حصاد
  async function createYield(yieldData) {
    if (await checkHealth()) {
      try {
        await fetch(`${API_URL}/yields`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(yieldData)
        });
      } catch (err) {
        console.warn("حفظ محلي فقط — تعذر إرسال الحصاد للسيرفر:", err);
      }
    }
  }

  // حفظ جمعية خيرية
  async function createCharity(charityData) {
    if (await checkHealth()) {
      try {
        await fetch(`${API_URL}/charities`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(charityData)
        });
      } catch (err) {
        console.warn("حفظ محلي فقط — تعذر إرسال الجمعية للسيرفر:", err);
      }
    }
  }

  // حفظ سجل زكاة
  async function createZakat(zakatData) {
    if (await checkHealth()) {
      try {
        await fetch(`${API_URL}/zakat`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(zakatData)
        });
      } catch (err) {
        console.warn("حفظ محلي فقط — تعذر إرسال الزكاة للسيرفر:", err);
      }
    }
  }

  // تحديث حالة الزكاة
  async function updateZakat(id, updateData) {
    if (await checkHealth()) {
      try {
        await fetch(`${API_URL}/zakat/${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify(updateData)
        });
      } catch (err) {
        console.warn("حفظ محلي فقط — تعذر تحديث الزكاة بالسيرفر:", err);
      }
    }
  }

  // حفظ إذن صرف أو توريد أسمدة
  async function createVoucher(voucherData) {
    if (await checkHealth()) {
      try {
        await fetch(`${API_URL}/fertilizers/vouchers`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(voucherData)
        });
      } catch (err) {
        console.warn("حفظ محلي فقط — تعذر إرسال الإذن للسيرفر:", err);
      }
    }
  }

  // تحديث حالة إذن صرف أو توريد (استلام / رفض)
  async function updateVoucher(voucherId, updateData) {
    if (!voucherId) return;
    if (await checkHealth()) {
      try {
        await fetch(`${API_URL}/fertilizers/vouchers/${encodeURIComponent(voucherId)}`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify(updateData)
        });
      } catch (err) {
        console.warn("حفظ محلي فقط — تعذر تحديث حالة الإذن بالسيرفر:", err);
      }
    }
  }

  // حفظ سماد جديد
  async function createFertilizer(fertData) {
    if (!fertData) return;
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/fertilizers`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(fertData)
        });
        return await res.json().catch(() => ({}));
      } catch (err) {
        console.warn("حفظ محلي فقط — تعذر إرسال السماد للسيرفر:", err);
      }
    }
  }

  // تحديث بيانات سماد
  async function updateFertilizer(fertData) {
    if (!fertData || !fertData.id) return;
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/fertilizers/${encodeURIComponent(fertData.id)}`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify(fertData)
        });
        return await res.json().catch(() => ({}));
      } catch (err) {
        console.warn("حفظ محلي فقط — تعذر تحديث بيانات السماد بالسيرفر:", err);
      }
    }
  }

  // تبديل حالة السماد (نشط / معطل)
  async function toggleFertilizer(fertId, active) {
    if (!fertId) return;
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/fertilizers/${encodeURIComponent(fertId)}/toggle`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({ active })
        });
        return await res.json().catch(() => ({}));
      } catch (err) {
        console.warn("حفظ محلي فقط — تعذر تبديل حالة السماد بالسيرفر:", err);
      }
    }
  }

  // حذف سماد
  async function deleteFertilizer(fertId) {
    if (!fertId) return;
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/fertilizers/${encodeURIComponent(fertId)}`, {
          method: "DELETE",
          headers: getHeaders()
        });
        return await res.json().catch(() => ({}));
      } catch (err) {
        console.warn("تعذر حذف السماد بالسيرفر:", err);
      }
    }
  }

  // حفظ أو تعديل محصول
  async function createCrop(cropData) {
    if (await checkHealth()) {
      try {
        await fetch(`${API_URL}/crops`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(cropData)
        });
      } catch (err) {
        console.warn("حفظ محلي فقط — تعذر إرسال المحصول للسيرفر:", err);
      }
    }
  }

  // تحديث بيانات محصول في السيرفر وقاعدة البيانات
  async function updateCrop(cropData) {
    if (!cropData) return;
    if (await checkHealth()) {
      try {
        const id = cropData.id || cropData.code;
        const res = await fetch(`${API_URL}/crops/${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify(cropData)
        });
        return await res.json().catch(() => ({}));
      } catch (err) {
        console.warn("تعذر حفظ بيانات المحصول بالسيرفر:", err);
      }
    }
  }

  // تبديل حالة تنشيط أو تعطيل المحصول
  async function toggleCrop(cropId, active) {
    if (!cropId) return;
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/crops/${encodeURIComponent(cropId)}/toggle`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({ active })
        });
        return await res.json().catch(() => ({}));
      } catch (err) {
        console.warn("تعذر تبديل حالة المحصول بالسيرفر:", err);
      }
    }
  }

  // حفظ نشاط مشتل وتكاثر جديد
  async function createNurseryPrep(prepData) {
    if (!prepData) return;
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/nursery-preps`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(prepData)
        });
        return await res.json().catch(() => ({}));
      } catch (err) {
        console.warn("تعذر إرسال نشاط المشتل للسيرفر:", err);
      }
    }
  }

  // تحديث بيانات نشاط مشتل
  async function updateNurseryPrep(prepData) {
    if (!prepData || !prepData.id) return;
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/nursery-preps/${encodeURIComponent(prepData.id)}`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify(prepData)
        });
        return await res.json().catch(() => ({}));
      } catch (err) {
        console.warn("تعذر تحديث نشاط المشتل بالسيرفر:", err);
      }
    }
  }

  // تبديل حالة نشاط المشتل (نشط / معطل)
  async function toggleNurseryPrep(prepId, active) {
    if (!prepId) return;
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/nursery-preps/${encodeURIComponent(prepId)}/toggle`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({ active })
        });
        return await res.json().catch(() => ({}));
      } catch (err) {
        console.warn("تعذر تبديل حالة نشاط المشتل بالسيرفر:", err);
      }
    }
  }

  // حذف نشاط مشتل
  async function deleteNurseryPrep(prepId) {
    if (!prepId) return;
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/nursery-preps/${encodeURIComponent(prepId)}`, {
          method: "DELETE",
          headers: getHeaders()
        });
        return await res.json().catch(() => ({}));
      } catch (err) {
        console.warn("تعذر حذف نشاط المشتل بالسيرفر:", err);
      }
    }
  }

  // حفظ مصدر إكثار
  async function createPropagationSourceType(srcData) {
    if (await checkHealth()) {
      try {
        await fetch(`${API_URL}/propagation-source-types`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(srcData)
        });
      } catch (err) {
        console.warn("حفظ محلي فقط — تعذر إرسال مصدر الإكثار للسيرفر:", err);
      }
    }
  }

  // حذف مصدر إكثار
  async function deletePropagationSourceType(code) {
    if (await checkHealth()) {
      try {
        await fetch(`${API_URL}/propagation-source-types/${encodeURIComponent(code)}`, {
          method: "DELETE",
          headers: getHeaders()
        });
      } catch (err) {
        console.warn("تعذر حذف مصدر الإكثار من السيرفر:", err);
      }
    }
  }

  // SaaS APIs: إدارة الشركات والمشاريع
  async function getCompanies() {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/companies`, { headers: getHeaders() });
        if (res.ok) return await res.json();
      } catch (e) {
        console.warn("Failed to fetch companies:", e);
      }
    }
    return Store.get().companies || [];
  }

  async function createCompany(companyData) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/companies`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(companyData)
        });
        return await res.json();
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
    return { success: false, error: "offline" };
  }

  async function getProjects(companyId) {
    if (await checkHealth()) {
      try {
        const url = companyId ? `${API_URL}/projects?companyId=${encodeURIComponent(companyId)}` : `${API_URL}/projects`;
        const res = await fetch(url, { headers: getHeaders() });
        if (res.ok) return await res.json();
      } catch (e) {
        console.warn("Failed to fetch projects:", e);
      }
    }
    return Store.get().projects || [];
  }

  async function createProject(projectData) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/projects`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(projectData)
        });
        const resData = await res.json();
        if (res.ok) {
          // Re-fetch projects list
          const updatedProjects = await getProjects();
          Store.set({ projects: updatedProjects });
        }
        return resData;
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
    return { success: false, error: "offline" };
  }

  async function getUserProjects(userId) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/user/projects?userId=${encodeURIComponent(userId)}`, { headers: getHeaders() });
        if (res.ok) return await res.json();
      } catch (e) {
        console.warn("Failed to fetch user projects:", e);
      }
    }
    return [];
  }

  async function setUserProjectAccess(userId, companyId, projectId, roleName, isDefault = false) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/user/projects`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({ userId, companyId: companyId || null, projectId: projectId || null, roleName, isDefault })
        });
        return await res.json();
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
    return { success: false, error: "offline" };
  }

  async function updateCompany(id, companyData) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/companies/${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify(companyData)
        });
        return await res.json();
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
    return { success: false, error: "offline" };
  }

  async function updateProject(id, projectData) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/projects/${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify(projectData)
        });
        return await res.json();
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
    return { success: false, error: "offline" };
  }

  async function updateSettings(settingsData) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/settings`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify(settingsData)
        });
        return await res.json();
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
    return { success: false, error: "offline" };
  }

  async function cloneStarterPack(projectId) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/projects/${encodeURIComponent(projectId)}/clone-starter-pack`, {
          method: "POST",
          headers: getHeaders()
        });
        return await res.json();
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
    return { success: false, error: "offline" };
  }

  async function saveUserAccess(data) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/users/access`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(data)
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.success) {
          await pullLatest();
          return { success: true, message: json.message };
        }
        return { success: false, error: json.error || "تعذر حفظ الصلاحيات" };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
    return { success: false, error: "offline" };
  }

  // 14. إدارة المواسم الزراعية والترحيل السنوي (Seasons & Rollover)
  async function getSeasons() {
    if (_isOnline) {
      try {
        const res = await fetch(`${API_URL}/seasons`, { headers: getHeaders() });
        if (res.ok) {
          const seasons = await res.json();
          const st = Store.get();
          st.seasons = seasons;
          Store.set(st);
          return seasons;
        }
      } catch (e) {
        console.warn("تعذر جلب المواسم:", e);
      }
    }
    return Store.get().seasons || [];
  }

  async function saveSeason(seasonData) {
    if (_isOnline) {
      try {
        const res = await fetch(`${API_URL}/seasons`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(seasonData)
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.success) {
          await pullLatest();
          return { success: true, message: json.message };
        }
        return { success: false, error: json.error || "تعذر حفظ الموسم" };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
    return { success: false, error: "offline" };
  }

  async function closeAndRolloverSeason(year, data = {}) {
    if (_isOnline) {
      try {
        const res = await fetch(`${API_URL}/seasons/${year}/close-rollover`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(data)
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.success) {
          await pullLatest();
          return { success: true, message: json.message, newSeasonYear: json.newSeasonYear };
        }
        return { success: false, error: json.error || "تعذر إقفال الموسم وترحيل الأرصدة" };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
    return { success: false, error: "offline" };
  }


  async function getContracts() {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/contracts`, { headers: getHeaders() });
        return await res.json();
      } catch (err) {
        console.warn("تعذر جلب العقود:", err);
      }
    }
    return Store.get().contracts || [];
  }

  async function createContract(contractData) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/contracts`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(contractData)
        });
        const data = await res.json();
        if (res.ok && data.success) {
          await pullLatest();
          return data;
        }
        return { success: false, error: data.error || "فشل حفظ العقد" };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    return { success: false, error: "offline" };
  }

  async function importInvestorsContracts(payload) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/investors/import`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok && data.success) {
          await pullLatest();
          return data;
        }
        return { success: false, error: data.error || "فشل استيراد المستثمرين والعقود" };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    return { success: false, error: "offline" };
  }

  async function getInvestors() {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/investors`, { headers: getHeaders() });
        if (res.ok) return await res.json();
      } catch (err) {}
    }
    return Store.get().investors || [];
  }

  async function createInvestor(data) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/investors`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(data)
        });
        const resData = await res.json();
        if (res.ok && resData.success) {
          await pullLatest();
          return resData;
        }
        return resData;
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    return { success: false, error: "offline" };
  }

  async function getInvestor(id) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/investors/${encodeURIComponent(id)}`, { headers: getHeaders() });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn("تعذر جلب بيانات المستثمر:", err);
      }
    }
    const st = Store.get();
    const user = (st.users || []).find(u => u.id === id);
    const contracts = (st.contracts || []).filter(c => c.investor_id === id || c.investorId === id);
    return { success: true, investor: user, contracts };
  }

  async function updateInvestor(id, data) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/investors/${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify(data)
        });
        const resData = await res.json();
        if (res.ok && resData.success) {
          await pullLatest();
          return resData;
        }
        return { success: false, error: resData.error || "فشل تحديث بيانات المستثمر" };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    const st = Store.get();
    const users = (st.users || []).map(u => u.id === id ? { ...u, ...data } : u);
    Store.set({ ...st, users });
    return { success: true, offline: true };
  }

  async function getContract(id) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/contracts/${encodeURIComponent(id)}`, { headers: getHeaders() });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn("تعذر جلب بيانات العقد:", err);
      }
    }
    const contract = (Store.get().contracts || []).find(c => c.id === id);
    return { success: true, contract };
  }

  async function updateContract(id, data) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/contracts/${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify(data)
        });
        const resData = await res.json();
        if (res.ok && resData.success) {
          await pullLatest();
          return resData;
        }
        return { success: false, error: resData.error || "فشل تحديث العقد" };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    const st = Store.get();
    const contracts = (st.contracts || []).map(c => c.id === id ? { ...c, ...data } : c);
    Store.set({ ...st, contracts });
    return { success: true, offline: true };
  }

  async function deleteContract(id) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/contracts/${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: getHeaders()
        });
        const resData = await res.json();
        if (res.ok && resData.success) {
          await pullLatest();
          return resData;
        }
        return { success: false, error: resData.error || "فشل حذف العقد" };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    const st = Store.get();
    const contracts = (st.contracts || []).filter(c => c.id !== id);
    Store.set({ ...st, contracts });
    return { success: true, offline: true };
  }

  async function getContractTemplates() {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/contract-templates`, { headers: getHeaders() });
        if (res.ok) {
          const list = await res.json();
          const templates = Array.isArray(list) ? list : (list.templates || []);
          const st = Store.get();
          Store.set({ contractTemplates: templates });
          return { success: true, templates };
        }
      } catch (err) {
        console.warn("تعذر جلب قوالب التعاقدات:", err);
      }
    }
    return { success: true, templates: Store.get().contractTemplates || [] };
  }

  async function createContractTemplate(data) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/contract-templates`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(data)
        });
        const resData = await res.json();
        if (res.ok && resData.success) {
          await pullLatest();
          return resData;
        }
        return { success: false, error: resData.error || "فشل إنشاء القالب" };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    const st = Store.get();
    const tpls = st.contractTemplates || [];
    tpls.push({ id: data.id || `tpl_${Date.now()}`, ...data });
    Store.set({ ...st, contractTemplates: tpls });
    return { success: true, offline: true };
  }

  async function updateContractTemplate(id, data) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/contract-templates/${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify(data)
        });
        const resData = await res.json();
        if (res.ok && resData.success) {
          await pullLatest();
          return resData;
        }
        return { success: false, error: resData.error || "فشل تحديث القالب" };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    const st = Store.get();
    const tpls = (st.contractTemplates || []).map(t => (t.id === id || t.code === id) ? { ...t, ...data } : t);
    Store.set({ ...st, contractTemplates: tpls });
    return { success: true, offline: true };
  }

  async function getContractInvoices(contractId) {
    if (await checkHealth()) {
      try {
        const url = contractId ? `${API_URL}/contract-invoices?contract_id=${encodeURIComponent(contractId)}` : `${API_URL}/contract-invoices`;
        const res = await fetch(url, { headers: getHeaders() });
        if (res.ok) {
          const list = await res.json();
          const invoices = Array.isArray(list) ? list : (list.invoices || []);
          const st = Store.get();
          Store.set({ contractInvoices: invoices });
          return { success: true, invoices };
        }
      } catch (err) {
        console.warn("تعذر جلب فواتير العقود:", err);
      }
    }
    const all = Store.get().contractInvoices || [];
    return { success: true, invoices: contractId ? all.filter(i => i.contract_id === contractId) : all };
  }

  async function payContractInvoice(invoiceId, amount) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/contract-invoices/${encodeURIComponent(invoiceId)}/payment`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify({ amount })
        });
        const resData = await res.json();
        if (res.ok && resData.success) {
          await pullLatest();
          return resData;
        }
        return { success: false, error: resData.error || "فشل تسجيل السداد" };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    return { success: false, error: "تسجيل السداد يتطلب اتصالاً بالخادم" };
  }

  async function getPlot(id) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/plots/${encodeURIComponent(id)}`, { headers: getHeaders() });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn("تعذر جلب بيانات القطعة:", err);
      }
    }
    const plot = (Store.get().plots || []).find(p => p.id === id);
    return { success: true, plot };
  }

  async function updatePlot(id, data) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/plots/${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify(data)
        });
        const resData = await res.json();
        if (res.ok && resData.success) {
          await pullLatest();
          return resData;
        }
        return { success: false, error: resData.error || "فشل تحديث القطعة" };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    const st = Store.get();
    const plots = (st.plots || []).map(p => p.id === id ? { ...p, ...data } : p);
    Store.set({ ...st, plots });
    return { success: true, offline: true };
  }

  // 15. Agri-AI Hub Endpoints
  async function diagnosePest(payload) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/ai/diagnose-pest`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(payload)
        });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn("AI diagnosis fetch error, using local fallback:", err);
      }
    }
    return null;
  }

  async function analyzeLabReport(payload) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/ai/analyze-lab-report`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(payload)
        });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn("AI lab analysis fetch error:", err);
      }
    }
    return null;
  }

  async function parseVoiceAction(speechText) {
    if (speechText && typeof speechText === "object") speechText = speechText.speechText;
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/ai/parse-voice-action`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({ speechText })
        });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn("AI voice parse fetch error:", err);
      }
    }
    return null;
  }

  // Short audio clip → Arabic text (server-side Gemini), for browsers without speech recognition
  async function transcribeVoice(audioBase64, mimeType) {
    try {
      const res = await fetch(`${API_URL}/ai/voice-transcribe`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ audioBase64, mimeType })
      });
      return await res.json();
    } catch (err) {
      return { success: false, error: "لا يوجد اتصال بالخادم — اكتب الأمر بدلاً من ذلك" };
    }
  }

  async function chatAgriAdvisor(payload) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/ai/agri-chat`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(payload)
        });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn("AI chat fetch error:", err);
      }
    }
    return null;
  }

  async function testAiKey(apiKey) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/ai/test-key`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({ apiKey })
        });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    return { success: false, error: "offline" };
  }

  async function getAiStatus() {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/ai/status`, { headers: getHeaders() });
        if (res.ok) return await res.json();
      } catch (err) {}
    }
    return null;
  }

  async function saveSettings(settingsObj) {
    if (await checkHealth()) {
      try {
        const res = await fetch(`${API_URL}/settings`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(settingsObj)
        });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn("Save settings network error:", err);
      }
    }
    const st = Store.get();
    st.settings = { ...(st.settings || {}), ...settingsObj };
    Store.set({ settings: st.settings });
    return { success: true, offline: true };
  }

  // ---- Zakat records: two-way sync with the server ----
  // A snapshot of what the server last confirmed lets us tell local, not-yet-sent edits apart.
  const ZAKAT_SYNC_KEY = "palmtrace_zakat_synced";
  function zakatSnapshot() { try { return JSON.parse(localStorage.getItem(ZAKAT_SYNC_KEY) || "{}"); } catch { return {}; } }
  function saveZakatSnapshot(m) { try { localStorage.setItem(ZAKAT_SYNC_KEY, JSON.stringify(m)); } catch {} }

  function hasZakatSnapshot() { try { return localStorage.getItem(ZAKAT_SYNC_KEY) !== null; } catch { return false; } }

  function mergeZakat(localList, remoteList) {
    // First sync on this device: the server is the source of truth (avoids pushing demo/stale records).
    const firstSync = !hasZakatSnapshot();
    const oldSnap = zakatSnapshot();
    const newSnap = {};
    const byId = new Map();
    (remoteList || []).forEach(z => { if (z && z.id) { byId.set(z.id, z); newSnap[z.id] = JSON.stringify(z); } });
    (localList || []).forEach(z => {
      if (!z || !z.id) return;
      const pending = !firstSync && oldSnap[z.id] !== JSON.stringify(z);
      if (pending) {
        byId.set(z.id, z);                 // unsent local change wins and will be pushed
        if (oldSnap[z.id]) newSnap[z.id] = oldSnap[z.id];
      }
    });
    saveZakatSnapshot(newSnap);
    return Array.from(byId.values());
  }

  let _zakatTimer = null;
  let _zakatBusy = false;
  function queueZakatSync() {
    if (_zakatTimer) clearTimeout(_zakatTimer);
    _zakatTimer = setTimeout(syncZakat, 1500);
  }
  async function syncZakat() {
    if (_zakatBusy || !_isOnline) return;
    const st = (typeof Store !== "undefined") ? Store.get() : null;
    if (!st || !st.session || !Array.isArray(st.zakat)) return;
    if (!hasZakatSnapshot()) return; // wait until the first server pull has been merged
    const snap = zakatSnapshot();
    const changed = st.zakat.filter(z => z && z.id && (z.investorId || z.investor_id) && snap[z.id] !== JSON.stringify(z));
    if (!changed.length) return;
    _zakatBusy = true;
    try {
      const res = await fetch(`${API_URL}/zakat`, { method: "POST", headers: getHeaders(), body: JSON.stringify({ records: changed }) });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const saved = new Set(data.savedIds || []);
        changed.forEach(z => { if (saved.has(z.id)) snap[z.id] = JSON.stringify(z); });
        saveZakatSnapshot(snap);
      }
    } catch (e) {
      console.warn("Zakat sync deferred:", e);
    } finally {
      _zakatBusy = false;
    }
  }

  return {
    isOnline: () => _isOnline,
    queueZakatSync,
    syncZakat,
    checkHealth,
    saveSettings,
    diagnosePest,
    analyzeLabReport,
    parseVoiceAction,
    transcribeVoice,
    chatAgriAdvisor,
    testAiKey,
    getAiStatus,
    getSeasons,
    saveSeason,
    closeAndRolloverSeason,
    login,
    changePassword,
    forgotPassword,
    resetPassword,
    createUser,
    adminResetPassword,
    deleteUser,
    saveUserAccess,
    syncQueue,
    syncAllToDatabase,
    createSector,
    updateSector,
    deleteSector,
    getSectorImpact,
    archiveSector,
    createPlot,
    getPlot,
    updatePlot,
    pullLatest,
    saveNurseryState,
    flushNurseryState,
    switchProject,
    createCrop,
    updateCrop,
    toggleCrop,
    createNurseryPrep,
    updateNurseryPrep,
    toggleNurseryPrep,
    deleteNurseryPrep,
    createPropagationSourceType,
    deletePropagationSourceType,
    createPalm,
    updatePalm,
    archivePalm,
    deletePalm,
    createOffshoot,
    bulkIntakeOffshoots,
    plantOffshoot,
    createOperation,
    approveOperation,
    rejectOperation,
    batchApproveOperations,
    batchRejectOperations,
    createTreeNote,
    startTreeNote,
    completeTreeNote,
    closeTreeNote,
    saveOperationType,
    createYield,
    createCharity,
    createZakat,
    updateZakat,
    createVoucher,
    updateVoucher,
    createFertilizer,
    updateFertilizer,
    toggleFertilizer,
    deleteFertilizer,
    getCompanies,
    createCompany,
    updateCompany,
    getProjects,
    createProject,
    updateProject,
    updateSettings,
    cloneStarterPack,
    getUserProjects,
    setUserProjectAccess,
    getContracts,
    getContract,
    createContract,
    updateContract,
    deleteContract,
    getContractTemplates,
    createContractTemplate,
    updateContractTemplate,
    getContractInvoices,
    payContractInvoice,
    getInvestors,
    createInvestor,
    getInvestor,
    updateInvestor,
    importInvestorsContracts,
    API_URL
  };
})();

// فحص الاتصال التلقائي والمزامنة عند بدء التشغيل والمزامنة الدورية في الخلفية
if (typeof window !== "undefined") {
  window.Api = Api;
  setTimeout(async () => {
    const isUp = await Api.checkHealth();
    if (isUp) {
      console.log("Pulling latest farm data from SQLite database...");
      await Api.pullLatest();
      console.log("Auto-syncing pending offline operations with SQLite database...");
      await Api.syncQueue();
    }
  }, 800);

  // مزامنة الحركات والعمليات الميدانية المعلقة في الخلفية كل 30 ثانية دون إعادة تحميل أصول المزرعة كاملة
  setInterval(async () => {
    const isUp = await Api.checkHealth();
    if (isUp) {
      await Api.syncQueue();
    }
  }, 30000);
}


