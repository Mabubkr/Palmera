// PalmTrace app — Operations admin, records, schedules, early-warning
// (split from the former single app.js; files are classic scripts loaded in order by index.html)

function isCritOp(o, st) {
  if (!o) return false;
  const name = typeName(o.typeId) || "";
  if (name.includes("سوسة")) return true;
  if (o.typeId === "op8" || o.typeId === "op_curative") return true;
  const state = st || (typeof Store !== "undefined" ? Store.get() : null);
  const t = state?.operationTypes?.find(x => x.id === o.typeId);
  if (t && (t.name || "").includes("سوسة")) return true;
  return false;
}

function opsFiltered() {
  const st = Store.get();
  const now = new Date();
  const curU = session();
  const isWorker = curU?.role === "worker";
  const isEng = curU?.role === "engineer";
  const isExplicitApprovedQuery = opsSt === "approved" || opsSt === "voided" || Boolean(opsQ && opsQ.trim().length > 0) || (opsRange && opsRange !== "all") || Boolean(opsCritOnly);

  return st.operations.filter(o => {
    // 1. Worker isolation: only operations performed by current worker
    if (isWorker && o.workerId !== curU?.id) return false;

    const p = palmByIdStr(o.palmId);
    const w = userBy(o.workerId);
    const opPlotId = p?.plot || o.plotId;
    const pl = st.plots.find(x => x.id === opPlotId);
    const opSecId = pl?.sector || o.sectorId;

    // 2. Engineer scoping: restricted to assigned plots if configured
    if (isEng && curU?.plots && curU.plots.length > 0) {
      if (opPlotId && !curU.plots.includes(opPlotId)) {
        const bId = plotBaseId(opPlotId);
        if (!curU.plots.some(plId => plId.startsWith(bId) || plotBaseId(plId) === bId)) return false;
      }
    }

    // 3. Hot vs. Cold Archiving: Approved and voided operations are archived from default live feed
    if (!isExplicitApprovedQuery && (o.approval === "approved" || o.approval === "voided")) return false;

    // 4. Critical operations filter: if active, only include critical/weevil operations
    if (opsCritOnly && !isCritOp(o, st)) return false;

    const opCropId = p?.cropId || o.cropId || (typeName(o.typeId).includes("زيتون") ? "olive" : "palm");
    if (opsCrop && opCropId !== opsCrop) return false;
    if (opsType && o.typeId !== opsType) return false;
    if (opsSt === "pending" && (o.approval === "approved" || o.approval === "rejected" || o.approval === "voided")) return false;
    if (opsSt === "approved" && o.approval !== "approved") return false;
    if (opsSt === "needs_rework" && o.approval !== "needs_rework" && o.approval !== "rework") return false;
    if (opsSt === "voided" && o.approval !== "voided" && o.approval !== "closed") return false;
    if (opsSt === "rejected" && o.approval !== "rejected") return false;
    if (opsSec && opSecId !== opsSec) return false;
    if (opsPlot) {
      if (opsPlot.startsWith("base:")) {
        const bId = opsPlot.slice(5);
        if (!opPlotId?.startsWith(bId) && plotBaseId(opPlotId) !== bId) return false;
      } else if (opPlotId !== opsPlot) {
        return false;
      }
    }
    if (opsQ) {
      const q = opsQ.toUpperCase();
      const hit = (p?.code||"").toUpperCase().includes(q) ||
                  (w?.name||"").includes(opsQ) ||
                  typeName(o.typeId).includes(opsQ) ||
                  (opPlotId||"").toUpperCase().includes(q) ||
                  plotName(opPlotId).includes(opsQ) ||
                  (o.notes||"").toUpperCase().includes(q);
      if (!hit) return false;
    }
    if (opsRange === "today" && String(o.at).slice(0,10) !== now.toISOString().slice(0,10)) return false;
    if (opsRange === "week") { const d = new Date(o.at); if ((now - d) > 7*86400000) return false; }
    return true;
  }).sort((a,b) => {
    let vA, vB;
    if (opsSortCol === "at") {
      vA = new Date(a.at || 0).getTime();
      vB = new Date(b.at || 0).getTime();
    } else if (opsSortCol === "palm") {
      const pA = palmByIdStr(a.palmId);
      const pB = palmByIdStr(b.palmId);
      vA = pA ? pA.code : "";
      vB = pB ? pB.code : "";
    } else if (opsSortCol === "type") {
      vA = typeName(a.typeId) || "";
      vB = typeName(b.typeId) || "";
    } else if (opsSortCol === "worker") {
      const wA = userBy(a.workerId);
      const wB = userBy(b.workerId);
      vA = wA ? wA.name : "";
      vB = wB ? wB.name : "";
    } else if (opsSortCol === "status") {
      vA = a.approval || a.status || "";
      vB = b.approval || b.status || "";
    } else {
      vA = a[opsSortCol] || "";
      vB = b[opsSortCol] || "";
    }
    if (vA < vB) return opsSortDir === "asc" ? -1 : 1;
    if (vA > vB) return opsSortDir === "asc" ? 1 : -1;
    return 0;
  });
}
function opBadge(o) {
  if (o.approval === "approved") return `<span class="status badge-ok">✓ معتمدة</span>`;
  if (o.approval === "needs_rework" || o.approval === "rework") return `<span class="status" style="background:#FFEDD5;color:#C2410C;border:1px solid #FDBA74;font-weight:700">🔄 مطلوب إعادة التنفيذ</span>`;
  if (o.approval === "voided" || o.approval === "closed") return `<span class="status" style="background:#F1F5F9;color:#64748B;border:1px solid #CBD5E1">🚫 ملغاة ومغلقة</span>`;
  if (o.approval === "rejected") return `<span class="status badge-danger">✕ مرفوضة</span>`;
  if (o.resubmitted || o.reworkAttempt) return `<span class="status badge-warn" style="background:#FEF3C7;color:#92400E;border:1px solid #FCD34D;font-weight:700">⏳ بانتظار الاعتماد (إعادة تنفيذ)</span>`;
  if ((typeName(o.typeId)||"").includes("سوسة")) return `<span class="status badge-danger">حرج / سوسة</span>`;
  return `<span class="status badge-warn">بانتظار الاعتماد</span>`;
}
function opsAdminView(extra) {
  if (extra === "schedules" || extra === "ops" || extra === "early_warning" || extra === "early-warning") {
    opsAdminTab = (extra === "early-warning" ? "early_warning" : extra);
  }
  if (!hasPerm("ops") && !hasPerm("ops_schedule_view")) {
    return `<div class="card" style="text-align:center;padding:24px">
      <h3>⚠️ غير مصرح</h3>
      <p class="muted">ليس لديك صلاحية استعراض شاشة العمليات الزراعية أو الجدولة الدورية.</p>
      <button class="btn btn-primary" data-act="back" style="margin-top:10px">رجوع</button>
    </div>`;
  }
  const st = Store.get();
  const curU = session();

  // Smart role-based default filter initialization
  if (!opsContextInitializedForUser || opsContextInitializedForUser !== curU?.id) {
    opsContextInitializedForUser = curU?.id;
    opsPage = 1;
    opsQ = "";
    opsCrop = "";
    opsType = "";
    opsSec = "";
    opsPlot = "";
    opsRange = "all";
    if (curU?.role === "engineer") {
      opsSt = "pending";
    } else if (curU?.role === "worker") {
      opsSt = "rejected";
    } else if (curU?.role === "admin" || curU?.role === "super_admin" || curU?.user === "admin") {
      opsSt = "pending";
    } else {
      opsSt = "";
    }
  }

  const canManageSchedules = curU?.role === "admin" || hasPerm("ops_schedule_manage") || hasPerm("ops");
  const canViewSchedules = curU?.role === "admin" || hasPerm("ops_schedule_view") || hasPerm("ops") || hasPerm("field") || ["admin", "engineer", "worker"].includes(curU?.role);

  const ewRules = st.earlyWarningRules || [];
  const activeEwAlerts = ewRules.filter(r => {
    if (r.active === false) return false;
    const ev = evaluateEarlyWarningRule(r, st);
    return ev.status === "due_lead" || ev.status === "active_season";
  });

  return `
    <div class="page-head">
      <div>
        <h3 style="margin:0">إدارة العمليات والجدولة الدورية والوقاية الذكية</h3>
        <div class="muted" style="font-size:12px">متابعة سجل العمليات الحقلية وتعيين جداول الرعاية وإطلاق الإنذار المبكر للمحاصيل</div>
      </div>
      <div class="actions" style="margin:0;gap:8px;display:flex;align-items:center;flex-wrap:wrap">
        ${opsAdminTab === "early_warning" ? `
          <button class="btn btn-ghost icon-btn" data-go="bulk-op" style="font-weight:700">👥 عملية جماعية</button>
          <button class="btn btn-primary icon-btn" data-act="ew-open-new-rule">➕ إضافة آفة وقاعدة إنذار جديدة</button>
        ` : opsAdminTab === "schedules" && canManageSchedules ? `
          <button class="btn btn-ghost icon-btn" data-go="bulk-op" style="font-weight:700">👥 عملية جماعية</button>
          <button class="btn btn-primary icon-btn" data-act="tog-sch-form">➕ إضافة جدول رعاية دوري جديد</button>
        ` : `
          <button class="btn btn-primary icon-btn" data-go="bulk-op">👥 عملية جماعية</button>
        `}
      </div>
    </div>

    <div class="ptabs" style="margin:6px 0 12px 0;flex-wrap:wrap;gap:6px">
      <button class="${opsAdminTab === 'ops' ? 'on' : ''}" data-act="ops-admin-tab" data-id="ops">📋 سجل العمليات الحقلية (${st.operations.length})</button>
      ${canViewSchedules ? `
        <button class="${opsAdminTab === 'schedules' ? 'on' : ''}" data-act="ops-admin-tab" data-id="schedules">
          ⏰ جداول الرعاية والتذكيرات الدورية (${(st.operationSchedules || []).filter(s=>s.active!==false).length})
        </button>
      ` : ''}
      <button class="${opsAdminTab === 'early_warning' ? 'on' : ''}" data-act="ops-admin-tab" data-id="early_warning" style="${activeEwAlerts.length ? 'border-color:#ef4444;font-weight:bold' : ''}">
        🛡️ الإنذار المبكر والوقاية الذكية (${activeEwAlerts.length})
      </button>
    </div>

    ${opsAdminTab === "early_warning" ? renderEarlyWarningSubView(st)
      : opsAdminTab === "schedules" ? renderOpsSchedulesView(st)
      : renderOpsRecordsView(st)}

    ${showEarlyWarningRuleModal ? renderEarlyWarningRuleModal(st) : ""}
    ${showEarlyWarningSopModal ? renderEarlyWarningSopModal(st) : ""}
    ${showStockCheckModal ? renderEarlyWarningStockModal(st) : ""}
    ${showOrderFromEarlyWarningModal ? renderEarlyWarningWorkOrderModal(st) : ""}
    ${showNotifyInvestorsEarlyWarningModal ? renderEarlyWarningNotifyInvestorsModal(st) : ""}
  `;
}

function renderOpsPlotPickModal(st, slice) {
  const baseCount = new Map();
  slice.forEach(o => {
    const p = palmById(o.palmId);
    if (p?.plot) {
      const bId = plotBaseId(p.plot);
      baseCount.set(bId, (baseCount.get(bId) || 0) + 1);
    }
  });
  const bases = [...baseCount.entries()].sort((a, b) => b[1] - a[1]);

  return `
    <div class="modal" style="display:flex;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.55);z-index:9999;align-items:center;justify-content:center;padding:16px">
      <div class="modal-box card" style="max-width:520px;width:100%;max-height:85vh;overflow-y:auto">
        <div class="modal-head" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <h3 style="margin:0">🎯 تحديد عمليات قطعة كاملة بالجدول</h3>
          <button class="btn btn-ghost icon-btn" data-act="close-ops-plot-pick" style="padding:4px 8px">✕</button>
        </div>
        <p class="muted" style="font-size:13px;margin-bottom:12px">
          اختر أي قطعة كاملة بالأسفل ليقوم النظام فورياً بوضع علامة الصح (Check) على كافة عملياتها وأجزائها الفرعية المعروضة بالجدول تمهيداً للاعتماد أو الرفض الجماعي:
        </p>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${bases.length ? bases.map(([bId, cnt]) => {
            const subplots = st.plots.filter(p => p.id.startsWith(bId) || plotBaseId(p) === bId);
            const partsList = subplots.map(s => s.part || s.id).filter(Boolean).join(", ");
            const bNo = plotBaseNumber(bId);
            return `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--card);border:1px solid var(--line);border-radius:8px">
                <div>
                  <div style="font-weight:700;font-size:14px">القطعة ${bNo} <span class="muted" style="font-size:12px">(${bId})</span></div>
                  <div class="muted" style="font-size:12px">الأجزاء: <b>${partsList || 'القطعة كاملة'}</b> • العمليات المعروضة: <b>${cnt} عملية</b></div>
                </div>
                <button class="btn btn-primary icon-btn" data-act="select-base-plot-ops" data-id="${bId}" style="width:auto;font-size:13px">
                  ✔ تحديد كافة عملياتها (${cnt})
                </button>
              </div>
            `;
          }).join("") : `<div class="muted" style="text-align:center;padding:16px">لا توجد عمليات بقطع واضحة في الصفحة الحالية</div>`}
        </div>
        <div style="text-align:center;margin-top:14px">
          <button class="btn btn-ghost" data-act="close-ops-plot-pick">إغلاق</button>
        </div>
      </div>
    </div>
  `;
}

let inspectedBatchId = null;

function aggregateOpsRecords(opsList) {
  const aggregated = [];
  const batchMap = new Map();

  for (const o of opsList) {
    const bId = o.batchId || o.bulkId || (o.device && o.device.startsWith("bulk:") ? o.device.slice(5) : null);
    if (bId) {
      if (!batchMap.has(bId)) {
        const group = {
          ...o,
          isBatch: true,
          batchId: bId,
          primaryId: o.id,
          ids: [o.id],
          items: [o],
          palms: [o.palmId].filter(Boolean),
          treeCount: Math.max(Number(o.treeCount) || 1, 1),
          approval: o.approval,
          status: o.status
        };
        batchMap.set(bId, group);
        aggregated.push(group);
      } else {
        const group = batchMap.get(bId);
        group.ids.push(o.id);
        group.items.push(o);
        if (o.palmId && !group.palms.includes(o.palmId)) group.palms.push(o.palmId);
        group.treeCount = Math.max(group.treeCount, group.items.length, Number(o.treeCount) || 0);
        if (o.approval !== "approved" && group.approval === "approved") {
          group.approval = o.approval;
        }
      }
    } else {
      aggregated.push(o);
    }
  }
  return aggregated;
}

let activeRejectTarget = null;
let activeRejectActionType = "needs_rework";
let activeRejectFertHandling = "waste";
let activeRejectSupervisorNote = "";
let activeReworkOpId = null;

function getOpMaterialInfo(op, st) {
  if (!op) return null;
  if (op.material && op.materialQty) {
    return {
      material: op.material,
      qty: Number(op.materialQty) || 0,
      unit: op.materialUnit || "كجم"
    };
  }
  if (op.notes) {
    const m = op.notes.match(/\[([^•\]]+?)(?:\s*•\s*([\d\.]+)\s*([^\s\]]+))?\]/);
    if (m) {
      const matName = m[1].trim();
      const qty = parseFloat(m[2] || "0");
      const unit = (m[3] || "").trim();
      const fert = (st?.fertilizers || []).find(f => f.name === matName || f.id === matName);
      if (fert || qty > 0) {
        return {
          material: fert?.name || matName,
          fertId: fert?.id,
          qty: qty,
          unit: unit || fert?.unit || "كجم"
        };
      }
    }
  }
  return null;
}

function renderOpRejectionModal(st) {
  if (!activeRejectTarget) return "";
  const isBatch = activeRejectTarget.type === "batch";
  const isBulk = activeRejectTarget.type === "bulk";
  const isSingle = activeRejectTarget.type === "single";

  let op = null;
  let tName = "";
  let wName = "";
  let palmCode = "";
  let count = 1;
  let fertInfo = activeRejectTarget.fertInfo;

  if (isSingle) {
    op = activeRejectTarget.op || st.operations.find(x => x.id === activeRejectTarget.id);
    if (!op) return "";
    tName = typeName(op.typeId);
    const w = userBy(op.workerId);
    wName = w?.name || "فني ميداني";
    const p = palmById(op.palmId);
    palmCode = p ? `${p.code} (${p.variety || '—'} • قطعة ${plotName(p.plot)})` : (op.palmCode || "—");
    if (!fertInfo) fertInfo = getOpMaterialInfo(op, st);
  } else if (isBatch) {
    const rep = activeRejectTarget.rep || (activeRejectTarget.ops && activeRejectTarget.ops[0]);
    tName = rep ? typeName(rep.typeId) : "حزمة جماعية";
    const w = rep ? userBy(rep.workerId) : null;
    wName = w?.name || "فني ميداني";
    count = rep?.treeCount || (activeRejectTarget.ops ? activeRejectTarget.ops.length : 0);
    palmCode = `حزمة جماعية (${count} شجرة)`;
    if (!fertInfo && rep) fertInfo = getOpMaterialInfo(rep, st);
  } else if (isBulk) {
    count = activeRejectTarget.ids ? activeRejectTarget.ids.length : (activeRejectTarget.ops ? activeRejectTarget.ops.length : 0);
    tName = "عمليات متعددة محددة";
    wName = "فنيين متعددين";
    palmCode = `${count} عملية محددة`;
    if (!fertInfo && activeRejectTarget.ops) {
      const opWithMat = activeRejectTarget.ops.find(o => getOpMaterialInfo(o, st));
      if (opWithMat) fertInfo = getOpMaterialInfo(opWithMat, st);
    }
  }

  const isRework = activeRejectActionType === "needs_rework";
  const isVoid = activeRejectActionType === "voided";

  return `
    <div class="custom-modal-backdrop" data-act="close-reject-modal" style="position:fixed;inset:0;background:rgba(15,23,42,0.7);z-index:10001;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)">
      <div class="custom-modal-box" style="background:#ffffff;border-radius:16px;max-width:620px;width:100%;box-shadow:0 25px 60px rgba(0,0,0,0.35);overflow:hidden;border:1px solid #E2E8F0;direction:rtl;text-align:right;max-height:90vh;display:flex;flex-direction:column">
        
        <!-- Modal Head with X button properly placed on left edge -->
        <div style="background:#FFF1F2;border-bottom:1px solid #FECDD3;padding:14px 20px;display:flex;justify-content:space-between;align-items:center">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:38px;height:38px;border-radius:10px;background:#FEE2E2;display:flex;align-items:center;justify-content:center;font-size:18px;color:#DC2626;flex-shrink:0">
              🚫
            </div>
            <div>
              <h3 style="margin:0;font-size:15.5px;font-weight:800;color:#991B1B">مراجعة ورفض العملية الميدانية</h3>
              <div style="font-size:11.5px;color:#B91C1C;margin-top:2px">
                حدد الإجراء اللاحق للرفض لمعالجة دورة العمل وحسابات المواد
              </div>
            </div>
          </div>
          <button type="button" class="custom-modal-close" data-act="close-reject-modal" title="إغلاق النافذة" style="background:transparent;border:none;font-size:20px;color:#94A3B8;cursor:pointer;padding:4px 8px;line-height:1;width:auto;min-width:32px;display:inline-flex;align-items:center;justify-content:center;border-radius:6px">✕</button>
        </div>

        <!-- Modal Body -->
        <div style="padding:18px 20px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:14px">
          
          <!-- Target Summary Pill -->
          <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
            <div>
              <span style="font-weight:800;font-size:13.5px;color:#0F172A">${tName}</span>
              <div style="font-size:11.5px;color:#64748B;margin-top:2px">📍 ${palmCode}</div>
            </div>
            <div style="text-align:left;direction:ltr">
              <span class="badge" style="background:#E2E8F0;color:#334155;font-size:11px">👤 ${wName}</span>
            </div>
          </div>

          <!-- Step 1: Decision on Workflow -->
          <div>
            <label style="font-size:12.5px;font-weight:800;color:#1E293B;display:block;margin-bottom:8px">
              1. ما هو الإجراء التالي لهذه العملية؟
            </label>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
              <!-- Option A: Needs Rework -->
              <div data-act="set-reject-action" data-id="needs_rework" role="button" tabindex="0" style="border:2px solid ${isRework ? '#EA580C' : '#E2E8F0'};background:${isRework ? '#FFF7ED' : '#FAFAFA'};border-radius:12px;padding:12px;cursor:pointer;transition:all 0.15s ease">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                  <span style="font-size:16px">🔄</span>
                  <span style="font-weight:800;font-size:13px;color:${isRework ? '#C2410C' : '#334155'}">طلب إعادة التنفيذ</span>
                </div>
                <div style="font-size:11px;color:#64748B;line-height:1.4">
                  تظهر في حساب العامل كمهمة تصحيحية عاجلة لإعادة إنجازها وتوثيقها بدقة.
                </div>
              </div>

              <!-- Option B: Void & Close -->
              <div data-act="set-reject-action" data-id="voided" role="button" tabindex="0" style="border:2px solid ${isVoid ? '#64748B' : '#E2E8F0'};background:${isVoid ? '#F1F5F9' : '#FAFAFA'};border-radius:12px;padding:12px;cursor:pointer;transition:all 0.15s ease">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                  <span style="font-size:16px">🚫</span>
                  <span style="font-weight:800;font-size:13px;color:${isVoid ? '#0F172A' : '#334155'}">إلغاء وإغلاق نهائي</span>
                </div>
                <div style="font-size:11px;color:#64748B;line-height:1.4">
                  استبعاد العملية نهائياً ونقلها للأرشيف (تسجيل خاطئ أو مكرر أو ملغى).
                </div>
              </div>
            </div>
          </div>

          <!-- Step 2: Fertilizer / Material Handling -->
          ${fertInfo ? `
            <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:12px 14px">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
                <span style="font-size:16px">📦</span>
                <span style="font-weight:800;font-size:12.5px;color:#92400E">
                  معالجة رصيد السماد / المركب المستخدم (${fertInfo.material}: ${fertInfo.totalQty || fertInfo.qty || '—'} ${fertInfo.unit || 'كجم'})
                </span>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                <!-- Waste Option -->
                <div data-act="set-reject-fert" data-id="waste" role="button" tabindex="0" style="border:2px solid ${activeRejectFertHandling === 'waste' ? '#D97706' : '#E2E8F0'};background:${activeRejectFertHandling === 'waste' ? '#FEF3C7' : '#FFFFFF'};border-radius:8px;padding:10px;cursor:pointer">
                  <div style="font-weight:700;font-size:12px;color:#B45309;margin-bottom:2px">
                    🗑️ تسجيل كفاقد وهدر
                  </div>
                  <div style="font-size:10.5px;color:#78350F;line-height:1.3">
                    تم استهلاك المادة فعلياً بالحقل ولا يمكن استردادها (تُسجل كفاقد تشغيلي).
                  </div>
                </div>

                <!-- Refund Option -->
                <div data-act="set-reject-fert" data-id="refund" role="button" tabindex="0" style="border:2px solid ${activeRejectFertHandling === 'refund' ? '#16A34A' : '#E2E8F0'};background:${activeRejectFertHandling === 'refund' ? '#DCFCE7' : '#FFFFFF'};border-radius:8px;padding:10px;cursor:pointer">
                  <div style="font-weight:700;font-size:12px;color:#15803D;margin-bottom:2px">
                    ↩️ استرداد لعهدة المخزن
                  </div>
                  <div style="font-size:10.5px;color:#166534;line-height:1.3">
                    لم تُستخدم المادة ميدانياً وتُعاد فوراً إلى رصيد المستودع المتاح.
                  </div>
                </div>
              </div>
            </div>
          ` : ''}

          <!-- Step 3: Quick Standard Reason Tags as horizontal chips -->
          <div>
            <label style="font-size:12px;font-weight:700;color:#475569;display:block;margin-bottom:6px">
              أسباب الرفض النموذجية (انقر للإضافة السريعة):
            </label>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
              ${[
                "خلل في معايير التنفيذ الميداني",
                "المادة أو الجرعة غير مطابقة للخطة",
                "الصور والتوثيق المرفق غير واضح",
                "تم تسجيل العملية على شجرة أخرى بالخطأ",
                "تسجيل مكرر لنفس الشجرة والخدمة",
                "تنفيذ جزئي وغير مكتمل للمهمة"
              ].map(tag => `
                <button type="button" class="chip-btn" data-act="pick-reject-tag" data-id="${tag}" data-tag="${tag}" style="font-size:11.5px;padding:5px 11px;border-radius:20px;border:1px solid #CBD5E1;background:#fff;color:#334155;cursor:pointer;width:auto;display:inline-flex;align-items:center;gap:4px;box-shadow:0 1px 2px rgba(0,0,0,0.04);transition:all 0.1s">
                  + ${tag}
                </button>
              `).join("")}
            </div>
          </div>

          <!-- Step 4: Supervisor Notes Textarea -->
          <div>
            <label style="font-size:12px;font-weight:700;color:#1E293B;display:block;margin-bottom:4px">
              توجيهات وملاحظات المشرف (تصل للعامل في الإشعار وبطاقة المهمة):
            </label>
            <textarea id="reject_supervisor_note" rows="3" class="compact-textarea" style="width:100%;border:1px solid #CBD5E1;border-radius:8px;padding:8px 10px;font-size:12.5px" placeholder="وضح أسباب الرفض والتعليمات المطلوبة لتصحيح العمل...">${escapeHtml(activeRejectSupervisorNote || "")}</textarea>
          </div>

        </div>

        <!-- Modal Foot -->
        <div style="background:#F8FAFC;border-top:1px solid #E2E8F0;padding:12px 20px;display:flex;justify-content:space-between;align-items:center;gap:12px">
          <button type="button" class="btn btn-ghost" data-act="close-reject-modal" style="font-size:13px;padding:8px 20px;border-radius:8px;width:auto;cursor:pointer">
            إلغاء
          </button>
          <button type="button" class="btn btn-primary" data-act="confirm-reject-modal" style="background:${isRework ? '#EA580C' : '#475569'};border-color:${isRework ? '#EA580C' : '#475569'};font-weight:800;font-size:13px;padding:8px 22px;border-radius:8px;cursor:pointer;width:auto;box-shadow:0 2px 6px rgba(0,0,0,0.15)">
            ${isRework ? '🔄 تأكيد وطلب إعادة التنفيذ' : '🚫 تأكيد الإلغاء والإغلاق'}
          </button>
        </div>

      </div>
    </div>
  `;
}

function renderBatchInspectModal(st) {
  if (!inspectedBatchId) return "";
  const batchOps = st.operations.filter(o => 
    o.batchId === inspectedBatchId || o.bulkId === inspectedBatchId || (o.device && o.device === "bulk:" + inspectedBatchId) || o.id === inspectedBatchId
  );
  if (!batchOps.length) return "";
  const rep = batchOps[0];
  const tName = typeName(rep.typeId);
  const w = userBy(rep.workerId);
  const totalTrees = rep.treeCount || batchOps.length;
  const isPending = batchOps.some(o => o.approval !== "approved" && o.approval !== "rejected");
  const isApproved = batchOps.every(o => o.approval === "approved");
  const photos = parsePhotos(rep.photos);

  let plotId = rep.plotId;
  let sectorId = rep.sectorId;
  if (!plotId && !sectorId && rep.notes && rep.notes.includes("[جماعي")) {
    const m = rep.notes.match(/\[جماعي\s*([^\]]+)\]/);
    if (m) {
      const rawLoc = m[1].replace(/قطعة|قطاع/g, "").trim();
      const foundPl = st.plots.find(p => p.id === rawLoc || p.name === rawLoc || (p.part && p.part === rawLoc) || (p.name && p.name.includes(rawLoc)));
      if (foundPl) {
        plotId = foundPl.id;
        sectorId = foundPl.sector;
      } else {
        const foundSec = st.sectors.find(s => s.id === rawLoc || s.name === rawLoc || (s.name && s.name.includes(rawLoc)));
        if (foundSec) sectorId = foundSec.id;
      }
    }
  }

  let palmList = batchOps.map(o => palmById(o.palmId)).filter(Boolean);
  if (!palmList.length && rep.palmIds && Array.isArray(rep.palmIds) && rep.palmIds.length) {
    palmList = rep.palmIds.map(pid => palmById(pid)).filter(Boolean);
  } else if (!palmList.length && plotId) {
    if (plotId.startsWith("base:")) {
      const bId = plotId.slice(5);
      palmList = st.palms.filter(p => !p.archived && ((typeof plotBaseId === "function" && plotBaseId(p.plot) === bId) || p.plot.startsWith(bId)));
    } else {
      palmList = st.palms.filter(p => !p.archived && p.plot === plotId);
    }
  } else if (!palmList.length && sectorId) {
    palmList = st.palms.filter(p => !p.archived && plotSectorOf(p.plot) === sectorId);
  }

  const pl = st.plots.find(p => p.id === plotId || p.name === plotId);
  const secId = sectorId || pl?.sector;
  const sec = st.sectors.find(s => s.id === secId || s.name === secId);
  const secLabel = sec?.name ? (sec.name.includes("قطاع") ? sec.name : `قطاع ${sec.name}`) : (secId ? `قطاع ${secId}` : "");
  const plLabel = pl?.name ? (pl.name.includes("قطعة") ? pl.name : `قطعة ${pl.name}`) : (plotId ? `قطعة ${plotId}` : "");
  const locationLabel = (secLabel && plLabel) ? `${secLabel} • ${plLabel}` :
                        plLabel ? plLabel :
                        secLabel ? `${secLabel} بالكامل` : 'حزمة مجمعة';

  return `
    <div class="custom-modal-backdrop" data-act="close-batch-modal">
      <div class="custom-modal-box" style="max-width:760px;width:95%;border-radius:14px;box-shadow:0 14px 40px rgba(0,0,0,0.3)">
        <div class="custom-modal-head" style="background:#F0FDF4;color:#166534;padding:14px 18px;border-bottom:1px solid #BBF7D0;display:flex;justify-content:space-between;align-items:center">
          <div>
            <h3 style="margin:0;display:flex;align-items:center;gap:8px;font-size:16px">
              <span>📦 تفاصيل ومعاينة الحزمة الجماعية:</span>
              <span style="font-weight:800;color:#15803D">${tName}</span>
            </h3>
            <div style="font-size:11.5px;color:#166534;margin-top:3px">
              المنفذ: <b>${w?.name || 'فني ميداني'}</b> • التاريخ: <b>${fmtDateTime(rep.at)}</b> • النطاق: <b>📍 ${locationLabel}</b> • إجمالي الأشجار: <b>${totalTrees} شجرة</b>
            </div>
          </div>
          <button class="custom-modal-close" data-act="close-batch-modal" style="background:transparent;border:none;font-size:20px;cursor:pointer;color:#64748B">✕</button>
        </div>
        <div class="custom-modal-body" style="padding:16px;max-height:75vh;overflow-y:auto">
          <!-- Summary Cards -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:8px;margin-bottom:14px">
            <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:10px;text-align:center">
              <div style="font-size:11px;color:#64748B">حجم الحزمة</div>
              <div style="font-size:18px;font-weight:800;color:#2563EB">${totalTrees} <span style="font-size:12px">شجرة</span></div>
            </div>
            <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:10px;text-align:center">
              <div style="font-size:11px;color:#64748B">حالة الاعتماد</div>
              <div style="font-size:14px;font-weight:800;color:${isApproved ? '#16A34A' : isPending ? '#D97706' : '#DC2626'}">
                ${isApproved ? '✓ معتمدة بالكامل' : isPending ? '⏳ بانتظار الاعتماد' : '✕ مرفوضة'}
              </div>
            </div>
          </div>

          <!-- Notes & Material -->
          <div style="background:#F1F5F9;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12.5px;color:#334155;line-height:1.6">
            <b>📝 البيان والملاحظات:</b> ${rep.notes ? escapeHtml(rep.notes) : 'بدون ملاحظات إضافية'}<br>
            ${rep.device ? `<span style="font-size:11px;color:#64748B">📱 معرّف الحزمة: <code>${escapeHtml(rep.device)}</code></span>` : ''}
          </div>

          <!-- Photos -->
          ${photos.length ? `
            <div style="margin-bottom:14px">
              <div style="font-weight:700;font-size:12px;margin-bottom:6px;color:#475569">📸 صور التوثيق الميداني (${photos.length}):</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                ${photos.map(p => `<img src="${p}" style="width:72px;height:72px;object-fit:cover;border-radius:8px;border:1px solid #CBD5E1;cursor:pointer" onclick="window.viewImagePreview('${p}', 'توثيق الحزمة الميدانية')" title="اضغط للتكبير">`).join("")}
              </div>
            </div>
          ` : ''}

          <!-- Trees Grid -->
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <span style="font-weight:700;font-size:12.5px;color:#1E293B">🌴 الأشجار المشمولة في هذه الحزمة (${palmList.length || totalTrees}):</span>
              <span style="font-size:11px;color:#64748B">انقر على أي نخلة لفتح بطاقتها</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(130px, 1fr));gap:6px;max-height:220px;overflow-y:auto;padding:4px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px">
              ${palmList.map(p => `
                <div style="display:flex;align-items:center;justify-content:space-between;background:#fff;border:1px solid #CBD5E1;border-radius:6px;padding:4px 8px;font-size:11.5px">
                  <code style="font-family:monospace;font-weight:700;cursor:pointer;color:var(--green-d)" data-act="go-palm-from-batch" data-id="${p.id}">${p.code}</code>
                  <span style="font-size:10px;color:#64748B">${p.variety ? p.variety.slice(0, 8) : ''}</span>
                </div>
              `).join("") || `<div class="muted" style="padding:10px">تفاصيل الأشجار غير متوفرة</div>`}
            </div>
          </div>
        </div>
        <!-- Modal Footer Actions -->
        <div class="custom-modal-foot" style="background:#F8FAFC;border-top:1px solid #E2E8F0;padding:12px 18px;display:flex;justify-content:space-between;align-items:center">
          <button class="btn btn-ghost btn-sm" data-act="close-batch-modal">إغلاق</button>
          <div style="display:flex;gap:8px">
            ${isPending ? `
              <button class="btn btn-orange btn-sm" data-act="batch-reject-op" data-id="${inspectedBatchId}" data-batch="${inspectedBatchId}">✕ رفض الحزمة بالكامل</button>
              <button class="btn btn-primary btn-sm" data-act="batch-approve-op" data-id="${inspectedBatchId}" data-batch="${inspectedBatchId}" style="background:#16A34A;font-weight:800;padding:6px 16px">✓ اعتماد الحزمة بالكامل (${totalTrees} شجرة)</button>
            ` : `
              <span class="badge" style="background:#DCFCE7;color:#166534;font-size:12px;padding:4px 12px;border-radius:8px">
                ${isApproved ? '✓ الحزمة معتمدة' : '✕ الحزمة مرفوضة'}
              </span>
            `}
            ${(hasPerm("ops_delete") || session()?.role === "admin") ? `
              <button class="btn btn-ghost btn-sm" data-act="del-batch-op" data-id="${inspectedBatchId}" data-batch="${inspectedBatchId}" style="color:#DC2626;border:1px solid #FCA5A5;background:#FEF2F2;font-weight:700">🗑️ حذف الحزمة</button>
            ` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

let showEditOpModal = false;
let editingOpId = null;

function renderEditOpModal(st) {
  if (!showEditOpModal || !editingOpId) return "";
  const o = (st.operations || []).find(x => x.id === editingOpId);
  if (!o) return "";
  const p = palmById(o.palmId);
  const opDate = o.at ? o.at.slice(0, 16) : new Date().toISOString().slice(0, 16);
  const targetLabel = p ? `${p.code} (${p.variety || '—'} • ${plotName(p.plot)})` : (o.palmCode || (o.plotId ? `قطعة ${plotName(o.plotId)}` : "") || "عملية حقلية");

  return `
    <div class="custom-modal-backdrop" data-act="close-edit-op-modal" style="position:fixed;inset:0;background:rgba(15,23,42,0.7);z-index:10001;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)">
      <div class="card" style="width:100%;max-width:520px;background:#fff;border-radius:14px;box-shadow:0 20px 40px rgba(0,0,0,0.3);overflow:hidden;padding:0">
        <div style="background:linear-gradient(135deg,#1E293B,#0F172A);color:#fff;padding:14px 18px;display:flex;justify-content:space-between;align-items:center">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:18px">✏️</span>
            <h3 style="margin:0;font-size:16px;color:#fff">تعديل العملية الزراعية</h3>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" data-act="close-edit-op-modal" style="color:#fff;padding:2px 8px;font-size:16px">✕</button>
        </div>
        <div style="padding:18px;max-height:80vh;overflow-y:auto">
          <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:#334155">
            📍 <b>الهدف:</b> ${escapeHtml(targetLabel)} • <b>الكود:</b> <code style="font-family:monospace">${o.id}</code>
          </div>

          <div class="grid grid-2" style="gap:10px;margin-bottom:10px">
            <div>
              <label style="font-size:12px;font-weight:700">نوع العملية</label>
              <select id="edit_op_type" style="width:100%;padding:8px;border-radius:6px;border:1px solid #CBD5E1">
                ${(st.operationTypes || []).map(t => `<option value="${t.id}" ${o.typeId === t.id ? 'selected' : ''}>${t.name}</option>`).join("")}
              </select>
            </div>
            <div>
              <label style="font-size:12px;font-weight:700">التاريخ والوقت</label>
              <input id="edit_op_at" type="datetime-local" value="${opDate}" style="width:100%;padding:8px;border-radius:6px;border:1px solid #CBD5E1" />
            </div>
          </div>

          <div class="grid grid-2" style="gap:10px;margin-bottom:10px">
            <div>
              <label style="font-size:12px;font-weight:700">القائم بالتنفيذ</label>
              <select id="edit_op_worker" style="width:100%;padding:8px;border-radius:6px;border:1px solid #CBD5E1">
                ${(st.users || []).filter(u => ['worker', 'engineer', 'admin'].includes(u.role)).map(u => `<option value="${u.id}" ${o.workerId === u.id ? 'selected' : ''}>${u.name} (${roleLabel(u.role)})</option>`).join("")}
              </select>
            </div>
            <div>
              <label style="font-size:12px;font-weight:700">حالة الاعتماد</label>
              <select id="edit_op_approval" style="width:100%;padding:8px;border-radius:6px;border:1px solid #CBD5E1">
                <option value="pending" ${o.approval === 'pending' ? 'selected' : ''}>⏳ بانتظار الاعتماد</option>
                <option value="approved" ${o.approval === 'approved' ? 'selected' : ''}>✓ معتمدة رسمياً</option>
                <option value="needs_rework" ${o.approval === 'needs_rework' ? 'selected' : ''}>🔄 مطلوب إعادة التنفيذ</option>
                <option value="voided" ${o.approval === 'voided' ? 'selected' : ''}>🚫 ملغاة ومغلقة</option>
                <option value="rejected" ${o.approval === 'rejected' ? 'selected' : ''}>✕ مرفوضة</option>
              </select>
            </div>
          </div>

          <div style="margin-bottom:10px">
            <label style="font-size:12px;font-weight:700">ملاحظات المنفذ / الفني</label>
            <textarea id="edit_op_notes" rows="3" style="width:100%;padding:8px;border-radius:6px;border:1px solid #CBD5E1" placeholder="أدخل الملاحظات الحقلية...">${escapeHtml(o.notes || "")}</textarea>
          </div>

          <div style="margin-bottom:14px">
            <label style="font-size:12px;font-weight:700">توجيه / ملاحظة المشرف الزراعي</label>
            <textarea id="edit_op_snote" rows="2" style="width:100%;padding:8px;border-radius:6px;border:1px solid #CBD5E1" placeholder="توجيهات أو ملاحظات إشرافية...">${escapeHtml(o.supervisorNote || "")}</textarea>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #E2E8F0;padding-top:14px">
            <button type="button" class="btn btn-ghost" data-act="close-edit-op-modal">إلغاء</button>
            <div style="display:flex;gap:8px">
              <button type="button" class="btn btn-orange" data-act="del-op" data-id="${o.id}" style="background:#FEF2F2;border:1px solid #FCA5A5;color:#DC2626">🗑️ حذف العملية</button>
              <button type="button" class="btn btn-primary" data-act="save-edit-op" data-id="${o.id}" style="background:#16A34A;font-weight:700;padding:8px 20px">💾 حفظ التعديلات</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderOpsRecordsView(st) {
  const activeCrops = (st.crops || []).filter(c => c.active);
  const allRaw = opsFiltered();
  const all = aggregateOpsRecords(allRaw);
  const pages = Math.max(1, Math.ceil(all.length / opsSize));
  if (opsPage > pages) opsPage = pages;
  const slice = all.slice((opsPage-1)*opsSize, opsPage*opsSize);
  const pending = st.operations.filter(o => o.approval !== "approved" && o.approval !== "rejected").length;
  const crit = st.operations.filter(o => isCritOp(o, st)).length;
  const approvedCount = st.operations.filter(o => o.approval === "approved").length;
  const isExplicitApprovedQuery = opsSt === "approved" || Boolean(opsQ && opsQ.trim().length > 0) || (opsRange && opsRange !== "all") || Boolean(opsCritOnly);
  const weevilType = st.operationTypes.find(x => (x.name || "").includes("سوسة"));
  const plotsOfSec = st.plots.filter(p => !opsSec || p.sector === opsSec);
  const availableOpTypes = st.operationTypes.filter(t => !opsCrop || t.cropId === "all" || t.cropId === opsCrop || !t.cropId);
  const hasAdvFilters = Boolean(opsPlot || opsType || opsCritOnly || (opsRange && opsRange !== "all") || (opsSize && opsSize !== 50));
  const selectedCount = opsSelectedIds.size;
  const allSliceSelected = slice.length > 0 && slice.every(o => opsSelectedIds.has(o.id));
  const curU = session();
  const canDelOp = hasPerm("ops_delete") || curU?.role === "admin";
  const canEditOp = hasPerm("ops_delete") || hasPerm("ops_edit") || curU?.role === "admin";

  // Group plots by base plot ID
  const baseMap = new Map();
  plotsOfSec.forEach(p => {
    const bId = plotBaseId(p);
    if (!baseMap.has(bId)) baseMap.set(bId, []);
    baseMap.get(bId).push(p);
  });
  const plotOptionsHtml = [`<option value="">كل القطع (${plotsOfSec.length})</option>`];
  baseMap.forEach((subs, bId) => {
    const bNo = plotBaseNumber(subs[0]) || bId;
    if (subs.length > 1) {
      const subLabels = subs.map(s => s.part || s.id).filter(Boolean).join(", ");
      plotOptionsHtml.push(`<option value="base:${bId}" ${opsPlot===`base:${bId}`?"selected":""} style="font-weight:bold;color:var(--green-d)">⭐ القطعة ${bNo} (كافة الأجزاء: ${subLabels})</option>`);
      subs.forEach(s => {
        plotOptionsHtml.push(`<option value="${s.id}" ${opsPlot===s.id?"selected":""}>&nbsp;&nbsp;&nbsp;↳ قطعة ${s.part || s.id} (${s.id})</option>`);
      });
    } else {
      const s = subs[0];
      plotOptionsHtml.push(`<option value="${s.id}" ${opsPlot===s.id?"selected":""}>${s.name} (${s.id})</option>`);
    }
  });

  return `
    ${renderBatchInspectModal(st)}
    ${renderOpRejectionModal(st)}
    ${renderEditOpModal(st)}
    ${showOpsPlotPickModal ? renderOpsPlotPickModal(st, slice) : ''}

    <!-- Compact 1-Line KPI Strip (Interactive Quick Filter Cards) -->
    <div class="card" style="margin-bottom:8px;padding:8px 14px;background:#fff;border:1px solid var(--line);border-radius:10px">
      <div style="display:flex;justify-content:space-around;align-items:center;flex-wrap:wrap;gap:8px">
        <div class="kpi-ops-card ${(!opsCritOnly && !opsSt && !opsType) ? 'active' : ''}" data-act="kpi-ops-filter" data-filter="all" title="عرض كافة العمليات الميدانية الحية" role="button" tabindex="0">
          <div style="width:34px;height:34px;border-radius:8px;background:#F1F5F9;display:flex;align-items:center;justify-content:center;font-size:16px">📋</div>
          <div>
            <div style="font-size:11px;color:#64748B;font-weight:600">إجمالي العمليات</div>
            <div style="font-size:16px;font-weight:800;color:var(--text)">${st.operations.length.toLocaleString()}</div>
          </div>
        </div>
        <div style="width:1px;height:26px;background:#E2E8F0"></div>
        <div class="kpi-ops-card ${(!opsCritOnly && opsSt === 'pending') ? 'active' : ''}" data-act="kpi-ops-filter" data-filter="pending" title="تصفية العمليات المعلقة بانتظار الاعتماد" role="button" tabindex="0">
          <div style="width:34px;height:34px;border-radius:8px;background:#FEF3C7;display:flex;align-items:center;justify-content:center;font-size:16px">⏳</div>
          <div>
            <div style="font-size:11px;color:#92400E;font-weight:600">معلقة للاعتماد</div>
            <div style="font-size:16px;font-weight:800;color:#D97706">${pending.toLocaleString()}</div>
          </div>
        </div>
        <div style="width:1px;height:26px;background:#E2E8F0"></div>
        <div class="kpi-ops-card ${opsCritOnly ? 'active' : ''}" data-act="kpi-ops-filter" data-filter="crit" title="تصفية بلاغات الإصابة الحرجة وسوسة النخيل" role="button" tabindex="0">
          <div style="width:34px;height:34px;border-radius:8px;background:#FEE2E2;display:flex;align-items:center;justify-content:center;font-size:16px">🚨</div>
          <div>
            <div style="font-size:11px;color:#991B1B;font-weight:600">بلاغات حرجة / سوسة</div>
            <div style="font-size:16px;font-weight:800;color:#DC2626">${crit.toLocaleString()}</div>
          </div>
        </div>
        <div style="width:1px;height:26px;background:#E2E8F0"></div>
        <div class="kpi-ops-card ${(!opsCritOnly && opsSt === 'approved') ? 'active' : ''}" data-act="kpi-ops-filter" data-filter="approved" title="استدعاء وعرض الأرشيف المعتمد رسمياً" role="button" tabindex="0">
          <div style="width:34px;height:34px;border-radius:8px;background:#DCFCE7;display:flex;align-items:center;justify-content:center;font-size:16px">✓</div>
          <div style="display:flex;align-items:baseline;gap:6px">
            <span style="font-size:17px;font-weight:800;color:#16A34A">${approvedCount.toLocaleString()}</span>
            <span style="font-size:12px;color:#166534;font-weight:700;white-space:nowrap">معتمدة رسمياً</span>
          </div>
        </div>
      </div>
    </div>

    ${opsCritOnly ? `
      <!-- Critical / Weevil Filter Notice Banner -->
      <div style="display:flex;align-items:center;justify-content:space-between;background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:6px 12px;margin-bottom:8px;font-size:12px;color:#991B1B">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:15px">🚨</span>
          <span><b>وضع البلاغات الحرجة وسوسة النخيل مفعل:</b> يتم استعراض كافة بلاغات الإصابة ومكافحة الآفات الحرجة المعتمدة والجارية (${crit}).</span>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" data-act="kpi-ops-filter" data-filter="all" style="font-size:11.5px;padding:3px 10px;background:#fff;border:1px solid #FCA5A5;color:#991B1B;font-weight:700;border-radius:6px;cursor:pointer">
          إلغاء التصفية ✕
        </button>
      </div>
    ` : (!isExplicitApprovedQuery && approvedCount > 0) ? `
      <!-- Cold Archive Notice Banner -->
      <div style="display:flex;align-items:center;justify-content:space-between;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:6px 12px;margin-bottom:8px;font-size:12px;color:#166534">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:14px">📦</span>
          <span><b>الأرشيف السريع مفعل:</b> تم عزل العمليات المعتمدة (${approvedCount.toLocaleString()}) لتسريع التصفح والتركيز على المهام التنفيذية الحية.</span>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" data-act="kpi-ops-filter" data-filter="approved" style="font-size:11.5px;padding:3px 10px;background:#DCFCE7;border:1px solid #86EFAC;color:#15803D;font-weight:700;border-radius:6px;cursor:pointer;display:inline-flex;align-items:center;gap:4px">
          عرض الأرشيف المعتمد ⤶
        </button>
      </div>
    ` : ''}

    <div class="card" style="padding:12px 16px">
      <!-- Title & Bulk Action Bar Header (Single Line Flex Nowrap) -->
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:nowrap;gap:12px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #F1F5F9">
        <div style="min-width:0;flex-shrink:1">
          <h3 style="margin:0;font-size:17px;font-weight:800;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">غرفة عمليات الحقل</h3>
          <div class="muted" style="font-size:11.5px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">سجل العمليات والمهام الميدانية مع أدوات الاعتماد والرقابة</div>
        </div>

        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;flex-wrap:nowrap">
          <!-- Bulk Action Bar -->
          <div id="ops_bulk_bar" style="display:inline-flex;align-items:center;gap:4px;background:#F8FAFC;border:1px solid #CBD5E1;border-radius:8px;padding:2px 4px">
            <button class="btn btn-primary btn-sm" data-act="bulk-approve" title="اعتماد كافة العمليات المحددة" style="font-size:12px;padding:4px 10px;display:inline-flex;align-items:center;gap:4px;cursor:pointer;white-space:nowrap">
              <span>✓ اعتماد المحدد</span>
              <span id="ops_selected_badge" style="background:rgba(255,255,255,0.35);padding:1px 5px;border-radius:10px;font-size:10px;font-weight:700;display:${selectedCount > 0 ? 'inline-block' : 'none'}">${selectedCount}</span>
            </button>
            <button class="btn btn-orange btn-sm" data-act="bulk-reject" title="رفض العمليات المحددة" style="font-size:12px;padding:4px 8px;cursor:pointer;white-space:nowrap">
              ✕ رفض المحدد
            </button>
            ${canDelOp ? `
              <button class="btn btn-ghost btn-sm" data-act="bulk-delete-ops" title="حذف كافة العمليات المحددة نهائياً" style="font-size:12px;padding:4px 8px;border:1px solid #FCA5A5;background:#FEF2F2;color:#DC2626;cursor:pointer;white-space:nowrap;font-weight:700">
                🗑️ حذف المحدد
              </button>
            ` : ''}
          </div>

          <button class="btn btn-ghost btn-sm" data-act="quick-pick-plot-ops" style="font-size:11.5px;padding:4px 9px;border:1px solid #CBD5E1;border-radius:8px;cursor:pointer;white-space:nowrap" title="تحديد كافة عمليات قطعة معينة">🎯 تحديد بالقطعة</button>
          <button class="btn btn-ghost btn-sm" data-act="export-ops" style="font-size:12px;padding:4px 8px;border:1px solid #CBD5E1;border-radius:8px;cursor:pointer;white-space:nowrap">📥 تصدير CSV</button>
        </div>
      </div>

      <!-- Primary Filter Bar (Streamlined, no overflowing text) -->
      <div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px">
        <!-- Search -->
        <div style="flex:2;min-width:220px">
          <input id="opsq" value="${escapeHtml(opsQ)}" placeholder="🔍 بحث بالكود أو العامل أو القطعة..." style="width:100%;padding:7px 12px;font-size:12px;border:1px solid #CBD5E1;border-radius:8px;background:#fff" />
        </div>

        <!-- Crop -->
        <div style="flex:1;min-width:140px">
          <select id="opscrop" style="width:100%;padding:7px 10px;font-size:12px;border:1px solid #CBD5E1;border-radius:8px;background:#fff">
            <option value="">🌐 كل المحاصيل</option>
            ${activeCrops.map(c => `<option value="${c.id}" ${opsCrop===c.id?"selected":""}>${cropTextLabel(c)}</option>`).join("")}
          </select>
        </div>

        <!-- Sector -->
        <div style="flex:1;min-width:140px">
          <select id="opssec" data-act="ops-sec-change" style="width:100%;padding:7px 10px;font-size:12px;border:1px solid #CBD5E1;border-radius:8px;background:#fff">
            <option value="">كل القطاعات</option>
            ${st.sectors.map(s => `<option value="${s.id}" ${opsSec===s.id?"selected":""}>${s.name}</option>`)}
          </select>
        </div>

        <!-- Status -->
        <div style="flex:1;min-width:130px">
          <select id="opsst" style="width:100%;padding:7px 10px;font-size:12px;border:1px solid #CBD5E1;border-radius:8px;background:#fff">
            <option value="">كل الحالات</option>
            <option value="pending" ${opsSt==="pending"?"selected":""}>⏳ بانتظار الاعتماد</option>
            <option value="needs_rework" ${opsSt==="needs_rework"?"selected":""}>🔄 مطلوب إعادة التنفيذ</option>
            <option value="approved" ${opsSt==="approved"?"selected":""}>✓ معتمدة</option>
            <option value="voided" ${opsSt==="voided"?"selected":""}>🚫 ملغاة ومغلقة</option>
            <option value="rejected" ${opsSt==="rejected"?"selected":""}>✕ مرفوضة سابقة</option>
          </select>
        </div>

        <!-- Buttons -->
        <div style="display:inline-flex;align-items:center;gap:6px">
          <button type="button" class="btn btn-ghost btn-sm" data-act="tog-ops-advanced" title="إظهار / إخفاء الفلاتر المتقدمة" style="padding:7px 12px;font-size:12px;border:1px solid ${hasAdvFilters ? 'var(--green)' : '#CBD5E1'};border-radius:8px;background:${hasAdvFilters ? 'var(--green-l)' : '#fff'};color:${hasAdvFilters ? 'var(--green-d)' : '#475569'};display:inline-flex;align-items:center;gap:5px;cursor:pointer">
            <span>⚙️ فلاتر إضافية</span>
            ${hasAdvFilters ? `<span style="background:var(--green);color:#fff;border-radius:10px;padding:0 5px;font-size:10px;font-weight:bold">●</span>` : ''}
          </button>
          <button class="btn btn-primary btn-sm" data-act="apply-ops" style="padding:7px 16px;font-size:12px;border-radius:8px;cursor:pointer">تطبيق</button>
        </div>
      </div>

      <!-- Collapsible Advanced Filters Bar -->
      <div id="ops_adv_bar" style="display:${showOpsAdvancedFilters ? 'flex' : 'none'};flex-wrap:wrap;gap:10px;padding:12px;background:#F8FAFC;border:1px dashed #CBD5E1;border-radius:8px;margin-bottom:12px;align-items:flex-end">
        <!-- Plot -->
        <div style="flex:1.5;min-width:180px">
          <label style="font-size:11px;font-weight:700;color:#64748B;display:block;margin-bottom:4px">تصفية بالقطعة:</label>
          <select id="opsplot" style="width:100%;padding:6px 10px;font-size:12px;border:1px solid #CBD5E1;border-radius:6px;background:#fff">${plotOptionsHtml.join("")}</select>
        </div>

        <!-- Op Type -->
        <div style="flex:1.5;min-width:180px">
          <label style="font-size:11px;font-weight:700;color:#64748B;display:block;margin-bottom:4px">نوع العملية الميدانية:</label>
          <select id="opstype" style="width:100%;padding:6px 10px;font-size:12px;border:1px solid #CBD5E1;border-radius:6px;background:#fff">
            <option value="">كل أنواع العمليات</option>
            <option value="__crit__" ${opsCritOnly ? "selected" : ""} style="color:#DC2626;font-weight:700">🚨 كافة البلاغات الحرجة / سوسة</option>
            ${availableOpTypes.map(t => `<option value="${t.id}" ${(!opsCritOnly && opsType===t.id)?"selected":""}>${cropIcon(t.cropId, 13)} ${t.name}</option>`)}
          </select>
        </div>

        <!-- Date Range -->
        <div style="flex:1;min-width:130px">
          <label style="font-size:11px;font-weight:700;color:#64748B;display:block;margin-bottom:4px">النطاق الزمني:</label>
          <select id="opsrange" style="width:100%;padding:6px 10px;font-size:12px;border:1px solid #CBD5E1;border-radius:6px;background:#fff">
            <option value="all" ${opsRange==="all"?"selected":""}>كل الفترة</option>
            <option value="today" ${opsRange==="today"?"selected":""}>اليوم</option>
            <option value="week" ${opsRange==="week"?"selected":""}>هذا الأسبوع</option>
          </select>
        </div>

        <!-- Page Size -->
        <div style="flex:0.8;min-width:110px">
          <label style="font-size:11px;font-weight:700;color:#64748B;display:block;margin-bottom:4px">حجم الصفحة:</label>
          <select id="opssize" style="width:100%;padding:6px 10px;font-size:12px;border:1px solid #CBD5E1;border-radius:6px;background:#fff">
            <option value="25" ${opsSize===25?"selected":""}>25 سطر</option>
            <option value="50" ${opsSize===50?"selected":""}>50 سطر</option>
            <option value="100" ${opsSize===100?"selected":""}>100 سطر</option>
            <option value="500" ${opsSize===500?"selected":""}>500 سطر</option>
          </select>
        </div>

        <!-- Reset Button -->
        <div>
          <button type="button" class="btn btn-ghost btn-sm" data-act="reset-ops-filters" style="font-size:11px;padding:6px 12px;color:#DC2626;border:1px solid #FECACA;border-radius:6px;background:#fff;cursor:pointer">✕ تفريغ الفلاتر</button>
        </div>
      </div>

      <!-- Data Table Wrapper -->
      <div class="grid-wrap" style="border:1px solid #E2E8F0;border-radius:10px 10px 0 0;overflow-x:auto">
        <table class="dense" style="margin:0;width:100%;border-collapse:collapse">
          <thead style="background:#F8FAFC;border-bottom:2px solid #E2E8F0">
            <tr>
              <th style="width:38px;text-align:center;padding:10px 8px"><input type="checkbox" id="opsall" ${allSliceSelected ? "checked" : ""} title="تحديد / إلغاء تحديد الكل"></th>
              <th class="sortable-th" data-act="sort-ops" data-col="at" title="ترتيب حسب التاريخ والوقت" style="padding:10px 8px;font-size:12px;font-weight:700;color:#475569">
                التاريخ والوقت <span class="sort-icon ${opsSortCol==='at'?'active':''}">${opsSortCol==='at'?(opsSortDir==='asc'?'▲':'▼'):'⇅'}</span>
              </th>
              <th class="sortable-th" data-act="sort-ops" data-col="palm" title="ترتيب حسب الأصل والكود" style="padding:10px 8px;font-size:12px;font-weight:700;color:#475569">
                الأصل والكود <span class="sort-icon ${opsSortCol==='palm'?'active':''}">${opsSortCol==='palm'?(opsSortDir==='asc'?'▲':'▼'):'⇅'}</span>
              </th>
              <th class="sortable-th" data-act="sort-ops" data-col="type" title="ترتيب حسب نوع العملية" style="padding:10px 8px;font-size:12px;font-weight:700;color:#475569">
                العملية المنفذة <span class="sort-icon ${opsSortCol==='type'?'active':''}">${opsSortCol==='type'?(opsSortDir==='asc'?'▲':'▼'):'⇅'}</span>
              </th>
              <th class="sortable-th" data-act="sort-ops" data-col="worker" title="ترتيب حسب المنفذ" style="padding:10px 8px;font-size:12px;font-weight:700;color:#475569">
                القائم بالتنفيذ <span class="sort-icon ${opsSortCol==='worker'?'active':''}">${opsSortCol==='worker'?(opsSortDir==='asc'?'▲':'▼'):'⇅'}</span>
              </th>
              <th class="sortable-th" data-act="sort-ops" data-col="status" title="ترتيب حسب الحالة" style="padding:10px 8px;font-size:12px;font-weight:700;color:#475569">
                الحالة <span class="sort-icon ${opsSortCol==='status'?'active':''}">${opsSortCol==='status'?(opsSortDir==='asc'?'▲':'▼'):'⇅'}</span>
              </th>
              <th style="width:145px;min-width:145px;text-align:center;padding:10px 8px;font-size:12px;font-weight:700;color:#475569">إجراءات</th>
            </tr>
          </thead>
          <tbody>${slice.map(o => {
            const p = palmByIdStr(o.palmId);
            const w = userBy(o.workerId);
            const open = opsOpen === o.id;
            const cIcon = p ? cropIcon(p.cropId, 15) : "";
            const cName = p ? cropSingle(p.cropId) : "";
            const isCrit = isCritOp(o, st);
            const isPending = o.approval !== "approved" && o.approval !== "rejected";

            if (o.isBatch) {
              const bLocation = (() => {
                let plotId = o.plotId;
                let sectorId = o.sectorId;
                if (!plotId && !sectorId && o.notes && o.notes.includes("[جماعي")) {
                  const m = o.notes.match(/\[جماعي\s*([^\]]+)\]/);
                  if (m) {
                    const rawLoc = m[1].replace(/قطعة|قطاع/g, "").trim();
                    const foundPl = st.plots.find(p => p.id === rawLoc || p.name === rawLoc || (p.part && p.part === rawLoc) || (p.name && p.name.includes(rawLoc)));
                    if (foundPl) {
                      plotId = foundPl.id;
                      sectorId = foundPl.sector;
                    } else {
                      const foundSec = st.sectors.find(s => s.id === rawLoc || s.name === rawLoc || (s.name && s.name.includes(rawLoc)));
                      if (foundSec) sectorId = foundSec.id;
                    }
                  }
                }

                const pl = st.plots.find(p => p.id === plotId || p.name === plotId);
                const secId = sectorId || pl?.sector;
                const sec = st.sectors.find(s => s.id === secId || s.name === secId);
                const secLabel = sec?.name ? (sec.name.includes("قطاع") ? sec.name : `قطاع ${sec.name}`) : (secId ? `قطاع ${secId}` : "");
                const plLabel = pl?.name ? (pl.name.includes("قطعة") ? pl.name : `قطعة ${pl.name}`) : (plotId ? `قطعة ${plotId}` : "");

                if (secLabel && plLabel) return `${secLabel} • ${plLabel}`;
                if (plLabel) return plLabel;
                if (secLabel) return `${secLabel} بالكامل`;

                if (o.notes && o.notes.includes("[جماعي")) {
                  const m = o.notes.match(/\[جماعي ([^\]]+)\]/);
                  if (m) return m[1];
                }
                return "حزمة مجمعة";
              })();

              return `<tr class="${isCrit ? 'row-crit' : isPending ? 'row-wait' : ''}" style="border-bottom:1px solid #E2E8F0;background:${isCrit ? '#FEF2F2' : '#F8FAFC'};transition:background 0.15s">
                <td style="text-align:center;padding:8px">
                  <input type="checkbox" class="opchk" value="${o.primaryId || o.id}" ${opsSelectedIds.has(o.primaryId || o.id) ? "checked" : ""}>
                </td>
                <td style="white-space:nowrap;padding:8px">
                  <div style="font-weight:700;font-size:12px;color:#1E293B">${fmtDate(o.at)}</div>
                  ${o.at && o.at.includes('T') ? `<div style="font-size:10px;color:#94A3B8;direction:ltr;text-align:right">${o.at.slice(11, 16)}</div>` : ''}
                </td>
                <td style="padding:8px">
                  <div style="display:inline-flex;align-items:center;gap:6px">
                    <button type="button" class="badge" style="background:#EFF6FF;border:1.5px solid #3B82F6;color:#1D4ED8;font-size:11.5px;font-weight:700;padding:3px 8px;border-radius:6px;cursor:pointer;display:inline-flex;align-items:center;gap:4px" data-act="inspect-batch" data-id="${o.batchId}" data-batch="${o.batchId}" title="اضغط لمعاينة أشجار وتفاصيل الحزمة">
                      <span>📦 حزمة جماعية</span>
                      <span style="background:#2563EB;color:#fff;border-radius:10px;padding:0 5px;font-size:10.5px">${o.treeCount} شجرة</span>
                      <span style="font-size:10px">🔍</span>
                    </button>
                  </div>
                  <div style="font-size:10.5px;color:#475569;margin-top:3px;font-weight:600">
                    📍 ${bLocation}
                  </div>
                </td>
                <td style="padding:8px">
                  <div style="font-weight:700;font-size:13px;color:#0F172A">
                    ${typeName(o.typeId)}
                  </div>
                  ${o.notes ? `<div class="muted" style="font-size:11px;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${escapeHtml(o.notes)}">${escapeHtml(o.notes)}</div>` : ""}
                </td>
                <td style="white-space:nowrap;padding:8px">
                  <div style="font-weight:600;font-size:12px;color:#334155">${w?.name || "—"}</div>
                  <div style="font-size:10px;color:#94A3B8">${w?.role === "admin" ? "إدارة الشركة" : w?.role === "engineer" ? "مهندس زراعي" : "فني ميداني"}</div>
                </td>
                <td style="white-space:nowrap;padding:8px">${opBadge(o)}</td>
                <td style="text-align:center;white-space:nowrap;padding:6px 8px;width:145px">
                  <div style="display:inline-flex;gap:3px;align-items:center;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:2px 4px">
                    ${o.approval !== "approved" ? `
                      <button type="button" data-act="batch-approve-op" data-id="${o.batchId}" data-batch="${o.batchId}" title="اعتماد كافة أشجار الحزمة دفعة واحدة (${o.treeCount} شجرة)" style="height:26px;padding:0 7px;border-radius:6px;background:#16A34A;color:#fff;border:none;display:inline-flex;align-items:center;gap:3px;font-weight:700;font-size:11px;cursor:pointer">✓ اعتماد</button>
                      <button type="button" data-act="batch-reject-op" data-id="${o.batchId}" data-batch="${o.batchId}" title="رفض الحزمة" style="width:26px;height:26px;border-radius:6px;background:#FEE2E2;color:#B91C1C;border:1px solid #FECACA;display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;cursor:pointer;padding:0">✕</button>
                    ` : ''}
                    <button type="button" data-act="inspect-batch" data-id="${o.batchId}" data-batch="${o.batchId}" title="معاينة تفاصيل الحزمة" style="width:26px;height:26px;border-radius:6px;background:#FFFFFF;color:#334155;border:1px solid #CBD5E1;display:inline-flex;align-items:center;justify-content:center;font-size:12px;cursor:pointer;padding:0">👁️</button>
                    ${canDelOp ? `
                      <button type="button" data-act="del-batch-op" data-id="${o.batchId}" data-batch="${o.batchId}" title="حذف الحزمة بالكامل نهائياً" style="width:26px;height:26px;border-radius:6px;background:#FFF1F2;color:#E11D48;border:1px solid #FECDD3;display:inline-flex;align-items:center;justify-content:center;font-size:12px;cursor:pointer;padding:0">🗑️</button>
                    ` : ''}
                  </div>
                </td>
              </tr>`;
            }

            return `<tr class="${isCrit ? 'row-crit' : isPending ? 'row-wait' : ''}" style="border-bottom:1px solid #F1F5F9;transition:background 0.15s">
              <td style="text-align:center;padding:8px"><input type="checkbox" class="opchk" value="${o.id}" ${opsSelectedIds.has(o.id) ? "checked" : ""}></td>
              <td style="white-space:nowrap;padding:8px">
                <div style="font-weight:700;font-size:12px;color:#1E293B">${fmtDate(o.at)}</div>
                ${o.at && o.at.includes('T') ? `<div style="font-size:10px;color:#94A3B8;direction:ltr;text-align:right">${o.at.slice(11, 16)}</div>` : ''}
              </td>
              <td style="padding:8px">
                ${p ? `
                  <div style="display:inline-flex;align-items:center;gap:4px">
                    <span>${cIcon}</span>
                    <code style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;font-weight:700;background:#F1F5F9;padding:2px 6px;border-radius:4px;border:1px solid #E2E8F0;color:var(--text)">${palmA(p.id, p.code)}</code>
                  </div>
                  <div style="font-size:10.5px;color:#64748B;margin-top:2px">${p.variety || ""} • ${plotName(p.plot)}</div>
                ` : o.plotId ? `
                  <div style="display:inline-flex;align-items:center;gap:4px">
                    <span>🗺️</span>
                    <span style="font-weight:700;font-size:12px;color:var(--text)">قطعة ${plotName(o.plotId)}</span>
                  </div>
                  <div style="font-size:10.5px;color:#64748B;margin-top:2px">عملية قطاعية شاملة (${o.treeCount || 1} شجرة)</div>
                ` : o.sectorId ? `
                  <div style="display:inline-flex;align-items:center;gap:4px">
                    <span>🌐</span>
                    <span style="font-weight:700;font-size:12px;color:var(--text)">قطاع ${sectorName(o.sectorId)}</span>
                  </div>
                  <div style="font-size:10.5px;color:#64748B;margin-top:2px">عملية شاملة للقطاع (${o.treeCount || 1} شجرة)</div>
                ` : `<span class="muted">—</span>`}
              </td>
              <td style="padding:8px">
                <div style="font-weight:700;font-size:13px;color:#0F172A">
                  ${typeName(o.typeId)}
                </div>
                ${o.notes ? `<div class="muted" style="font-size:11px;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${escapeHtml(o.notes)}">${escapeHtml(o.notes)}</div>` : ""}
              </td>
              <td style="white-space:nowrap;padding:8px">
                <div style="font-weight:600;font-size:12px;color:#334155">${w?.name || "—"}</div>
                <div style="font-size:10px;color:#94A3B8">${w?.role === "admin" ? "إدارة الشركة" : w?.role === "inspector" ? "مفتش جودة" : "فني ميداني"}</div>
              </td>
              <td style="white-space:nowrap;padding:8px">${opBadge(o)}</td>
              <td style="text-align:center;white-space:nowrap;padding:6px 8px;width:145px">
                <div style="display:inline-flex;gap:3px;align-items:center;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:2px 4px">
                  ${o.approval !== "approved" ? `
                    <button type="button" data-act="approve-op" data-id="${o.id}" title="اعتماد العملية" style="width:26px;height:26px;border-radius:6px;background:#DCFCE7;color:#15803D;border:1px solid #BBF7D0;display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;cursor:pointer;padding:0">✓</button>
                    <button type="button" data-act="reject-op" data-id="${o.id}" title="رفض العملية" style="width:26px;height:26px;border-radius:6px;background:#FEE2E2;color:#B91C1C;border:1px solid #FECACA;display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;cursor:pointer;padding:0">✕</button>
                  ` : ''}
                  <button type="button" data-act="tog-op" data-id="${o.id}" title="${open ? 'إغلاق التفاصيل' : 'عرض التفاصيل والملاحظات'}" style="width:26px;height:26px;border-radius:6px;background:${open ? '#E2E8F0' : '#FFFFFF'};color:#334155;border:1px solid #CBD5E1;display:inline-flex;align-items:center;justify-content:center;font-size:12px;cursor:pointer;padding:0">${open ? '✕' : '👁️'}</button>
                  ${canEditOp ? `
                    <button type="button" data-act="open-edit-op-modal" data-id="${o.id}" title="تعديل العملية" style="width:26px;height:26px;border-radius:6px;background:#EFF6FF;color:#1D4ED8;border:1px solid #BFDBFE;display:inline-flex;align-items:center;justify-content:center;font-size:12px;cursor:pointer;padding:0">✏️</button>
                  ` : ''}
                  ${canDelOp ? `
                    <button type="button" data-act="del-op" data-id="${o.id}" title="حذف العملية نهائياً" style="width:26px;height:26px;border-radius:6px;background:#FFF1F2;color:#E11D48;border:1px solid #FECDD3;display:inline-flex;align-items:center;justify-content:center;font-size:12px;cursor:pointer;padding:0">🗑️</button>
                  ` : ''}
                </div>
              </td>
            </tr>
            ${open ? `
            <tr class="exp" style="background:#F8FAFC">
              <td colspan="7" style="padding:12px 16px;border-top:1px dashed #CBD5E1;border-bottom:2px solid #E2E8F0">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
                  <div style="flex:1;min-width:240px">
                    <div style="font-size:12px;line-height:1.7;color:#334155">
                      ${p ? `<b>🌾 ${cName}:</b> ${p.variety || '—'} • <b>القطعة:</b> ${plotName(p.plot)} • ` : ''}
                      <b>الملاحظات:</b> ${o.notes ? `<span style="color:#0F172A;font-weight:600">${escapeHtml(o.notes)}</span>` : '<span class="muted">بدون ملاحظات إضافية</span>'}<br>
                      <b>📱 الجهاز:</b> ${o.device || "—"} • <b>📍 إحداثيات GPS:</b> ${p?.gps || "غير مسجّل"}
                    </div>
                    ${(() => {
                      const ph = parsePhotos(o.photos);
                      if (!ph.length) return '';
                      return `
                        <div style="margin-top:8px">
                          <div style="font-size:11px;font-weight:700;color:#64748B;margin-bottom:4px">📸 الصور المرفقة (${ph.length}):</div>
                          <div class="photo-row" style="display:flex;gap:6px;flex-wrap:wrap">
                            ${ph.map(s => `<img class="thumb photo-field" src="${s}" style="width:50px;height:50px;object-fit:cover;border-radius:6px;border:1px solid #CBD5E1;cursor:pointer">`).join("")}
                          </div>
                        </div>
                      `;
                    })()}
                  </div>
                  <!-- Individual Quick Action Buttons inside drawer only -->
                  <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
                    <div style="display:flex;gap:6px;flex-wrap:wrap">
                      ${o.approval !== "approved" ? `<button class="btn btn-primary btn-sm" data-act="approve-op" data-id="${o.id}" style="font-size:11px;padding:4px 10px;cursor:pointer">✓ اعتماد</button>` : ""}
                      ${o.approval !== "rejected" ? `<button class="btn btn-orange btn-sm" data-act="reject-op" data-id="${o.id}" style="font-size:11px;padding:4px 10px;cursor:pointer">✕ رفض</button>` : ""}
                      ${canEditOp ? `<button class="btn btn-ghost btn-sm" data-act="open-edit-op-modal" data-id="${o.id}" style="font-size:11px;padding:4px 10px;border:1px solid #3B82F6;color:#1D4ED8;background:#EFF6FF;cursor:pointer;font-weight:700">✏️ تعديل العملية</button>` : ""}
                      ${canDelOp ? `<button class="btn btn-ghost btn-sm" data-act="del-op" data-id="${o.id}" style="font-size:11px;padding:4px 10px;border:1px solid #DC2626;color:#DC2626;background:#FEF2F2;cursor:pointer;font-weight:700">🗑️ حذف العملية</button>` : ""}
                    </div>
                    <span class="muted" style="font-size:10px">تاريخ التسجيل: ${fmtDateTime(o.at)}</span>
                  </div>
                </div>
              </td>
            </tr>` : ''}`;
          }).join("")}</tbody>
        </table>
      </div>

      <!-- Redesigned Standard Pagination Footer -->
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;padding:10px 14px;border:1px solid #E2E8F0;border-top:none;background:#F8FAFC;border-bottom-left-radius:10px;border-bottom-right-radius:10px">
        <!-- Record count info -->
        <div style="font-size:12px;color:#64748B">
          عرض <b>${all.length ? ((opsPage - 1) * opsSize + 1) : 0}</b> إلى <b>${Math.min(opsPage * opsSize, all.length)}</b> من إجمالي <b>${all.length}</b> سجل مطابق
        </div>

        <!-- Page Navigation Controls -->
        <div style="display:inline-flex;align-items:center;gap:8px">
          <span style="font-size:12px;font-weight:600;color:#475569">صفحة <b>${opsPage}</b> من <b>${pages}</b></span>
          <div style="display:inline-flex;gap:4px">
            <button class="btn btn-ghost btn-sm" data-act="ops-page" data-id="${Math.max(1, opsPage - 1)}" ${opsPage <= 1 ? "disabled style='opacity:0.4;cursor:not-allowed;padding:4px 10px;font-size:12px;border:1px solid #CBD5E1;border-radius:6px;background:#fff'" : "style='cursor:pointer;padding:4px 10px;font-size:12px;border:1px solid #CBD5E1;border-radius:6px;background:#fff'"}>◀ السابق</button>
            <button class="btn btn-ghost btn-sm" data-act="ops-page" data-id="${Math.min(pages, opsPage + 1)}" ${opsPage >= pages ? "disabled style='opacity:0.4;cursor:not-allowed;padding:4px 10px;font-size:12px;border:1px solid #CBD5E1;border-radius:6px;background:#fff'" : "style='cursor:pointer;padding:4px 10px;font-size:12px;border:1px solid #CBD5E1;border-radius:6px;background:#fff'"}>التالي ▶</button>
          </div>
        </div>
      </div>
    </div>`;
}

function renderOpsSchedulesView(st) {
  const me = session() || {};
  const canManage = hasPerm("ops_schedule_manage");
  const allSchedules = st.operationSchedules || [];
  const today = new Date().toISOString().slice(0, 10);

  let filtered = allSchedules;
  if (schFilterCrop && schFilterCrop !== "all") {
    filtered = filtered.filter(s => s.cropId === "all" || s.cropId === schFilterCrop || !s.cropId);
  }
  if (schFilterSec && schFilterSec !== "all") {
    filtered = filtered.filter(s => s.sectorId === "all" || s.sectorId === schFilterSec || !s.sectorId);
  }
  if (schFilterStatus === "due") {
    filtered = filtered.filter(s => s.active !== false && (!s.nextDueDate || s.nextDueDate <= today));
  } else if (schFilterStatus === "active") {
    filtered = filtered.filter(s => s.active !== false);
  } else if (schFilterStatus === "inactive") {
    filtered = filtered.filter(s => s.active === false);
  }

  const totalSchedules = allSchedules.length;
  const activeSchedules = allSchedules.filter(s => s.active !== false).length;
  const dueSchedules = allSchedules.filter(s => s.active !== false && (!s.nextDueDate || s.nextDueDate <= today)).length;
  const activeCrops = (st.crops || []).filter(c => c.active);

  const editSch = editScheduleId ? allSchedules.find(s => s.id === editScheduleId) : null;

  return `
    <div class="grid grid-3" style="margin-bottom:12px">
      <div class="card kpi">
        <div class="n">${totalSchedules}</div>
        <div class="l">إجمالي خطط الرعاية الدورية</div>
      </div>
      <div class="card kpi ${dueSchedules ? 'warn' : ''}">
        <div class="n" style="${dueSchedules ? 'color:var(--orange)' : ''}">${dueSchedules}</div>
        <div class="l">مستحقة التنفيذ الآن أو متأخرة</div>
      </div>
      <div class="card kpi">
        <div class="n" style="color:var(--green)">${activeSchedules}</div>
        <div class="l">خطط نشطة في المنظومة</div>
      </div>
    </div>

    ${showScheduleForm ? renderScheduleForm(st, editSch) : ''}

    <div class="card">
      <div class="page-head" style="margin-bottom:10px">
        <h3>قائمة جداول الرعاية والتذكيرات</h3>
      </div>

      <div class="filter-bar" style="grid-template-columns:1fr 1fr 1fr auto;gap:8px;margin-bottom:12px">
        <select id="schfcrop" onchange="window._setSchCrop(this.value)">
          <option value="all" ${schFilterCrop==="all"?"selected":""}>🌐 كل المحاصيل</option>
          ${activeCrops.map(c => `<option value="${c.id}" ${schFilterCrop===c.id?"selected":""}>${cropTextLabel(c)}</option>`).join("")}
        </select>
        <select id="schfsec" onchange="window._setSchSec(this.value)">
          <option value="all" ${schFilterSec==="all"||!schFilterSec?"selected":""}>كل القطاعات</option>
          ${st.sectors.map(s => `<option value="${s.id}" ${schFilterSec===s.id?"selected":""}>${s.name}</option>`)}
        </select>
        <select id="schfst" onchange="window._setSchSt(this.value)">
          <option value="all" ${schFilterStatus==="all"?"selected":""}>كل الحالات</option>
          <option value="due" ${schFilterStatus==="due"?"selected":""}>⏰ المستحقة الآن (${dueSchedules})</option>
          <option value="active" ${schFilterStatus==="active"?"selected":""}>✅ النشطة فقط (${activeSchedules})</option>
          <option value="inactive" ${schFilterStatus==="inactive"?"selected":""}>⏸️ المتوقفة مؤقتاً</option>
        </select>
        <button class="btn btn-ghost icon-btn" data-act="reset-sch-filters">إعادة ضبط</button>
      </div>

      ${filtered.length === 0 ? `
        <div class="muted" style="text-align:center;padding:24px">لا توجد جداول رعاية تطابق الفلاتر المحددة</div>
      ` : `
        <div style="display:flex;flex-direction:column;gap:10px">
          ${filtered.map(s => {
            const isDue = s.active !== false && (!s.nextDueDate || s.nextDueDate <= today);
            const isOverdue = s.active !== false && s.nextDueDate && s.nextDueDate < today;
            const opT = st.operationTypes.find(t => t.id === s.opTypeId);
            const typeLabel = opT ? `${cropIcon(opT.cropId, 13)} ${opT.name}` : (s.opName || 'عملية');
            const cropText = s.cropId && s.cropId !== "all" ? cropName(s.cropId) : "كافة المحاصيل";
            const secText = s.sectorId && s.sectorId !== "all" ? sectorName(s.sectorId) : "كل القطاعات";
            const plotText = (s.plotIds && s.plotIds.length > 1) ? `${s.plotIds.length} قطع (${s.plotIds.map(p=>plotName(p)).join(", ")})` : (s.plotId && s.plotId !== "all" ? plotName(s.plotId) : "كل القطع");
            const assignedU = s.assignedUserId && s.assignedUserId !== "all" ? userBy(s.assignedUserId)?.name : null;
            const assignedRoleLabel = s.assignedRole === "worker" ? "العمال" : s.assignedRole === "engineer" ? "المشرفون" : "الجميع";
            const assignedText = assignedU ? `${assignedU} (${assignedRoleLabel})` : assignedRoleLabel;

            const prioBadge = s.priority === "urgent" ? '<span class="status badge-danger">عاجل</span>' :
                              s.priority === "high" ? '<span class="status badge-warn">هام</span>' :
                              '<span class="status badge-info">عادي</span>';

            const statusBadge = s.active === false ? '<span class="status badge-muted">متوقف</span>' :
                                isOverdue ? '<span class="status badge-danger">متأخر التنفيذ</span>' :
                                isDue ? '<span class="status badge-warn">مستحق اليوم</span>' :
                                `<span class="status badge-ok">قادم (${s.nextDueDate})</span>`;

            return `
              <div style="border:1px solid ${isDue ? '#C85A2E' : 'var(--border)'};border-radius:8px;padding:12px;background:${isDue ? '#fffdf7' : '#fff'};box-shadow:0 1px 3px rgba(0,0,0,0.05)">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
                  <div>
                    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                      <span style="font-weight:700;font-size:15px">${s.title}</span>
                      ${prioBadge}
                      ${statusBadge}
                    </div>
                    <div class="muted" style="font-size:12px;margin-top:4px;display:flex;flex-wrap:wrap;gap:12px">
                      <span>⚙️ نوع العملية: <b>${typeLabel}</b></span>
                      <span>🌱 المحصول: <b>${cropText}</b></span>
                      <span>📍 النطاق: <b>${secText} • ${plotText}</b></span>
                      <span>🔄 التكرار: <b>كل ${s.intervalDays} يوم</b></span>
                      <span>👤 المسؤول: <b>${assignedText}</b></span>
                    </div>
                    ${s.materialName ? `
                      <div class="muted" style="font-size:12px;margin-top:4px">
                        🧪 المادة / السماد: <b>${s.materialName}</b> ${s.recommendedDose ? `• الجرعة: <b>${s.recommendedDose}</b>` : ''}
                      </div>
                    ` : ''}
                    ${s.instructions ? `
                      <div style="font-size:12px;color:#444;background:#f5f5f5;padding:6px 10px;border-radius:4px;margin-top:6px">
                        📝 ${s.instructions}
                      </div>
                    ` : ''}
                    <div class="muted" style="font-size:11px;margin-top:6px">
                      آخر إنجاز: <b>${s.lastExecutedAt || 'لم يُنفذ بعد'}</b> • الموعد القادم: <b style="${isDue ? 'color:#C85A2E' : ''}">${s.nextDueDate || 'فوري'}</b>
                    </div>
                  </div>

                  <div class="card-actions-toolbar">
                    <button class="btn btn-primary btn-compact" data-act="exec-schedule" data-id="${s.id}">⚡ تنفيذ الآن</button>
                    <button class="btn btn-ghost btn-compact" data-act="mark-sch-done" data-id="${s.id}">✔ إنجاز</button>
                    ${canManage ? `
                      <button class="btn btn-ghost btn-compact" data-act="edit-schedule" data-id="${s.id}">✏️ تعديل</button>
                      <button class="btn btn-ghost btn-compact" data-act="tog-sch-active" data-id="${s.id}">${s.active === false ? '▶️ تفعيل' : '⏸️ إيقاف'}</button>
                      <button class="btn btn-ghost btn-compact btn-icon-only" style="color:var(--danger)" data-act="del-schedule" data-id="${s.id}" title="حذف">🗑️</button>
                    ` : ''}
                  </div>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `}
    </div>
  `;
}

function saveScheduleDraftFromDom() {
  const elTitle = document.getElementById("sch_title");
  if (!elTitle) return;
  schDraft = {
    title: elTitle.value || "",
    cropId: document.getElementById("sch_crop")?.value || "all",
    opTypeId: document.getElementById("sch_type")?.value || "op1",
    sectorId: document.getElementById("sch_sec")?.value || schPlotSec || "all",
    intervalDays: document.getElementById("sch_interval")?.value ? Math.max(1, parseInt(document.getElementById("sch_interval").value, 10)) : 7,
    nextDueDate: document.getElementById("sch_next_due")?.value || new Date().toISOString().slice(0, 10),
    priority: document.getElementById("sch_priority")?.value || "normal",
    assignedRole: document.getElementById("sch_role")?.value || "worker",
    assignedUserId: document.getElementById("sch_user")?.value || "all",
    materialName: document.getElementById("sch_mat")?.value || "",
    recommendedDose: document.getElementById("sch_dose")?.value || "",
    instructions: document.getElementById("sch_notes")?.value || "",
    active: document.getElementById("sch_active") ? document.getElementById("sch_active").checked : true
  };
}

function renderScheduleForm(st, editSch) {
  const isEdit = !!editSch;
  const activeCrops = (st.crops || []).filter(c => c.active);
  const workers = (st.users || []).filter(u => u.role === "worker" || u.role === "engineer");
  const ferts = (st.fertilizers || []);

  const curData = schDraft || editSch || {};
  const title = curData.title !== undefined ? curData.title : "";
  const cropId = curData.cropId !== undefined ? curData.cropId : "all";
  const opTypeId = curData.opTypeId !== undefined ? curData.opTypeId : "op1";
  const sectorId = schPlotSec !== "" ? schPlotSec : (curData.sectorId !== undefined ? curData.sectorId : "all");
  const intervalDays = curData.intervalDays !== undefined ? curData.intervalDays : 7;
  const nextDueDate = curData.nextDueDate !== undefined ? curData.nextDueDate : new Date().toISOString().slice(0, 10);
  const priority = curData.priority !== undefined ? curData.priority : "normal";
  const assignedRole = curData.assignedRole !== undefined ? curData.assignedRole : "worker";
  const assignedUserId = curData.assignedUserId !== undefined ? curData.assignedUserId : "all";
  const materialName = curData.materialName !== undefined ? curData.materialName : "";
  const recommendedDose = curData.recommendedDose !== undefined ? curData.recommendedDose : "";
  const instructions = curData.instructions !== undefined ? curData.instructions : (curData.notes !== undefined ? curData.notes : "");
  const active = curData.active !== undefined ? curData.active : true;

  const curSec = schPlotSec !== "" ? schPlotSec : (sectorId !== "all" ? sectorId : "");
  const plots = scopedFieldPlots();
  const matchingPlots = plots.filter(p => {
    if (curSec && curSec !== "all" && p.sector !== curSec) return false;
    if (schPlotSearch) {
      const q = schPlotSearch.trim().toLowerCase();
      const full = ((p.name||"") + " " + (p.id||"")).toLowerCase();
      if (!full.includes(q)) return false;
    }
    return true;
  });

  return `
    <div class="card" style="margin-bottom:14px;border:2px solid var(--accent);background:#fcfcfc">
      <div class="page-head" style="margin-bottom:10px">
        <h3 style="margin:0">${isEdit ? '✏️ تعديل جدول الرعاية والتذكير الدوري' : '➕ إضافة جدول رعاية وتذكير دوري جديد'}</h3>
        <button class="btn btn-ghost" data-act="tog-sch-form">✕ إغلاق</button>
      </div>

      <div class="grid grid-2" style="gap:10px">
        <div>
          <label>عنوان خطة الرعاية / التذكير *</label>
          <input id="sch_title" value="${title}" placeholder="مثال: ري صيفي دوري للقطاع 03" required />
        </div>
        <div>
          <label>المحصول المستهدف</label>
          <select id="sch_crop">
            <option value="all" ${cropId==="all"?"selected":""}>🌐 كافة المحاصيل</option>
            ${activeCrops.map(c => `<option value="${c.id}" ${cropId===c.id?"selected":""}>${cropTextLabel(c)}</option>`).join("")}
          </select>
        </div>
      </div>

      <div class="grid grid-3" style="gap:10px;margin-top:8px">
        <div>
          <label>نوع العملية الحقلية *</label>
          <select id="sch_type">
            ${st.operationTypes.filter(t => !t.inactive).map(t => `<option value="${t.id}" ${opTypeId===t.id?"selected":""}>${cropEmoji(t.cropId)} ${t.name}</option>`).join("")}
          </select>
        </div>
        <div>
          <label>القطاع المستهدف</label>
          <select id="sch_sec" data-act="sch-sec-change">
            <option value="all" ${(!curSec || curSec==="all")?"selected":""}>🌐 كافة القطاعات</option>
            ${st.sectors.filter(s => !s.is_deleted && !s.isDeleted && !s.archived).map(s => `<option value="${s.id}" ${curSec===s.id?"selected":""}>${s.name}</option>`)}
          </select>
        </div>
        <div>
          <label>نطاق استهداف القطع</label>
          <select id="sch_scope_sel" data-act="sch-scope-change">
            <option value="all" ${schPlotScope==="all"?"selected":""}>كافة قطع القطاع (تطبيق كامل)</option>
            <option value="custom" ${schPlotScope==="custom"?"selected":""}>قطع محددة / قطعة كاملة بأجزائها (${schSelectedPlots.size} مختارة)</option>
          </select>
        </div>
      </div>

      ${schPlotScope === "custom" ? `
        <div class="card" style="background:#F9FAFB;border:1px solid #E5E7EB;padding:12px;margin:10px 0">
          <div style="font-weight:700;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
            <span>🎯 تحديد القطع المستهدفة للجدول (بحث وإضافة دفعة واحدة)</span>
            <span class="muted" style="font-size:12px">اكتب رقم القطعة الأساسي (مثلاً: 14) لإضافة كافة أجزائها الفرعية دفعة واحدة</span>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
            <input id="sch_plot_search" value="${schPlotSearch||""}" placeholder="🔍 ابحث برقم أو اسم القطعة الأساسي (مثال: 14 أو 15)..." style="flex:2;min-width:200px" />
            <select id="sch_plot_add" style="flex:2;min-width:220px">
              ${matchingPlots.length ? matchingPlots.map(p => {
                const plPalms = activePalmsInPlot(p.id);
                const pCnt = plPalms.filter(x => (x.cropId||"palm") === "palm").length;
                const oCnt = plPalms.filter(x => x.cropId === "olive").length;
                const plDesc = (pCnt && oCnt) ? `${pCnt} نخيل • ${oCnt} زيتون` : `${plPalms.length} شجرة`;
                return `<option value="${p.id}">${p.name} — ${p.id} (${plDesc})</option>`;
              }).join("") : `<option value="" disabled selected>لا توجد قطع مطابقة للبحث</option>`}
            </select>
            <button type="button" class="btn btn-primary icon-btn" data-act="sch-plot-add" style="width:auto">➕ إضافة القطعة</button>
            ${matchingPlots.length > 1 ? `
              <button type="button" class="btn btn-ghost icon-btn" data-act="sch-plot-add-all" style="width:auto;color:var(--green);font-weight:700" title="إضافة كافة القطع المعروضة بالنتائج">➕ إضافة كل النتائج المطابقة (${matchingPlots.length} قطعة)</button>
            ` : ''}
            <button type="button" class="btn btn-ghost icon-btn" data-act="sch-plot-clear" style="width:auto">مسح الكل</button>
          </div>
          <div class="scope-box">${[...schSelectedPlots].map(id => {
            const plPalms = activePalmsInPlot(id);
            const pCnt = plPalms.filter(x => (x.cropId||"palm") === "palm").length;
            const oCnt = plPalms.filter(x => x.cropId === "olive").length;
            const plDesc = (pCnt && oCnt) ? `${pCnt} نخيل • ${oCnt} زيتون` : `${plPalms.length}`;
            return `<span class="chip">${plotName(id)} (${plDesc}) <button type="button" class="chip-x" data-act="sch-plot-drop" data-id="${id}">×</button></span>`;
          }).join("") || "<span class='muted'>لم تُختر قطع بعد — ابحث عن القطع بالرقم الأساسي وأضفها</span>"}</div>
          ${schSelectedPlots.size ? `
            <div class="muted" style="margin-top:6px;font-size:12px">المحدد للخطة: <b>${schSelectedPlots.size}</b> قطعة • إجمالي الأشجار: <b>${st.palms.filter(p=>schSelectedPlots.has(p.plot)&&!p.archived).length}</b> شجرة</div>
          ` : ''}
        </div>
      ` : `
        <div class="muted" style="font-size:12px;padding:8px 12px;background:#F9FAFB;border:1px dashed var(--line);border-radius:8px;margin:8px 0">
          🌐 سيتم تطبيق خطة الرعاية على <b>كافة قطع ${curSec && curSec !== 'all' ? sectorName(curSec) : 'المزرعة كاملة'}</b>. لاستهداف قطعة محددة أو قطعة كاملة بأجزائها اختر "قطع محددة / قطعة كاملة" أعلاه.
        </div>
      `}

      <div class="grid grid-3" style="gap:10px;margin-top:8px">
        <div>
          <label>دورة التكرار الدوري (أيام) *</label>
          <input id="sch_interval" type="number" min="1" max="365" value="${intervalDays}" placeholder="مثال: 7" required />
        </div>
        <div>
          <label>الموعد القادم للاستحقاق *</label>
          <input id="sch_next_due" type="date" value="${nextDueDate}" required />
        </div>
        <div>
          <label>مستوى الأولوية</label>
          <select id="sch_priority">
            <option value="normal" ${priority==="normal"?"selected":""}>عادي</option>
            <option value="high" ${priority==="high"?"selected":""}>مرتفع / هام</option>
            <option value="urgent" ${priority==="urgent"?"selected":""}>عاجل جداً</option>
          </select>
        </div>
      </div>

      <div class="grid grid-2" style="gap:10px;margin-top:8px">
        <div>
          <label>الدور المسؤول عن التنفيذ</label>
          <select id="sch_role">
            <option value="worker" ${assignedRole==="worker"?"selected":""}>العمال الميدانيون (worker)</option>
            <option value="engineer" ${assignedRole==="engineer"?"selected":""}>المهندسون والمشرفون (engineer)</option>
            <option value="all" ${assignedRole==="all"?"selected":""}>الجميع</option>
          </select>
        </div>
        <div>
          <label>تخصيص مستخدم محدد (اختياري)</label>
          <select id="sch_user">
            <option value="all" ${assignedUserId==="all"?"selected":""}>🌐 غير مخصص لفرد بعينه (حسب الدور والنطاق)</option>
            ${workers.map(u => `<option value="${u.id}" ${assignedUserId===u.id?"selected":""}>${u.name} (${u.role === 'worker' ? 'عامل' : 'مهندس'})</option>`).join("")}
          </select>
        </div>
      </div>

      <div class="grid grid-2" style="gap:10px;margin-top:8px">
        <div>
          <label>المادة / السماد المقترح (اختياري)</label>
          <input id="sch_mat" list="sch_mat_list" value="${materialName}" placeholder="مثال: NPK 20-20-20 أو سماد عضوي" />
          <datalist id="sch_mat_list">
            ${ferts.map(f => `<option value="${f.name}">`).join("")}
          </datalist>
        </div>
        <div>
          <label>الجرعة الموصى بها (اختياري)</label>
          <input id="sch_dose" value="${recommendedDose}" placeholder="مثال: 0.5 كجم لكل شجرة" />
        </div>
      </div>

      <div style="margin-top:8px">
        <label>تعليمات وإرشادات العمل للمنفذ</label>
        <textarea id="sch_notes" rows="2" placeholder="أية تعليمات خاصة لطريقة الري أو الرش أو فحص الأشجار...">${instructions}</textarea>
      </div>

      <div style="margin-top:10px;display:flex;align-items:center;gap:8px">
        <input type="checkbox" id="sch_active" ${active ? "checked" : ""} style="width:18px;height:18px" />
        <label for="sch_active" style="margin:0;cursor:pointer">تفعيل هذا الجدول وإرسال التذكيرات الدورية للمسؤولين</label>
      </div>

      <div style="display:flex;gap:10px;margin-top:14px">
        <button class="btn btn-primary" data-act="save-schedule" style="min-width:140px">💾 حفظ جدول الرعاية</button>
        <button class="btn btn-ghost" data-act="tog-sch-form">إلغاء</button>
      </div>
    </div>
  `;
}

// Early Warning & Smart Crop Protection Engine (الإنذار المبكر والوقاية الذكية)
function evaluateEarlyWarningRule(rule, st, simDateStr) {
  const now = simDateStr ? new Date(simDateStr) : new Date();
  const curMonth = now.getMonth() + 1;
  const curYear = now.getFullYear();

  const startMonth = +(rule.activityStartMonth || 1);
  const endMonth = +(rule.activityEndMonth || 12);
  const leadDays = +(rule.leadDays || 14);

  let startDate = new Date(curYear, startMonth - 1, 1);
  let endDate = new Date(curYear, endMonth - 1, 28);
  if (endMonth < startMonth) {
    if (curMonth >= startMonth) {
      endDate = new Date(curYear + 1, endMonth - 1, 28);
    } else {
      startDate = new Date(curYear - 1, startMonth - 1, 1);
    }
  }

  const msPerDay = 86400000;
  const diffTime = startDate.getTime() - now.getTime();
  const daysUntilStart = Math.ceil(diffTime / msPerDay);

  let status = "watch";
  let urgencyText = "";
  let urgencyBadge = "";

  if (now >= startDate && now <= endDate) {
    status = "active_season";
    urgencyText = "ذروة النشاط الموسمي جارية الآن";
    urgencyBadge = "badge-danger";
  } else if (daysUntilStart > 0 && daysUntilStart <= leadDays) {
    status = "due_lead";
    urgencyText = `تنبيه وقائي استباقي: يبدأ موسم النشاط خلال ${daysUntilStart} يوماً`;
    urgencyBadge = "badge-warn";
  } else if (daysUntilStart <= 0 && now <= endDate) {
    status = "active_season";
    urgencyText = "ذروة النشاط الموسمي جارية الآن";
    urgencyBadge = "badge-danger";
  } else {
    status = "watch";
    const daysText = daysUntilStart > 0 ? `يبدأ بعد ${daysUntilStart} يوماً` : "انتهى موسم النشاط لهذا العام";
    urgencyText = `مراقبة دورية مستقرة (${daysText})`;
    urgencyBadge = "badge-ok";
  }

  const matName = (rule.preventiveActions?.materialName || "").trim();
  const fert = (st.fertilizers || []).find(f => f.name.trim() === matName || f.name.includes(matName) || matName.includes(f.name));
  const stockAvailable = fert ? Math.max(0, (+fert.stock - (+fert.allocated || 0))) : 0;
  const stockSufficient = fert ? (stockAvailable > (+fert.minAlert || 20)) : false;

  const affectedPalms = (st.palms || []).filter(p => {
    if (rule.cropId === "all") return true;
    return (p.cropId || "palm") === rule.cropId;
  });
  const affectedPlots = [...new Set(affectedPalms.map(p => p.plot).filter(Boolean))];
  const affectedSectors = [...new Set(affectedPlots.map(pl => pl.split("-")[0]).filter(Boolean))];

  return {
    rule,
    status,
    daysUntilStart,
    urgencyText,
    urgencyBadge,
    fert,
    materialName: matName,
    stockAvailable,
    stockSufficient,
    affectedPlots,
    affectedSectors,
    affectedPalmsCount: affectedPalms.length
  };
}

function renderEarlyWarningSubView(st) {
  const rules = st.earlyWarningRules || [];
  const evaluations = rules.map(r => evaluateEarlyWarningRule(r, st));

  // Compute summary metrics
  const dueOrActiveCount = evaluations.filter(e => e.status === "due_lead" || e.status === "active_season").length;
  const readyStockCount = evaluations.filter(e => e.stockSufficient).length;
  const stockReadinessPct = evaluations.length ? Math.round((readyStockCount / evaluations.length) * 100) : 100;
  const scheduledPestTasks = (st.operationSchedules || []).filter(s => s.opTypeId === "op_pest" && s.active !== false).length;

  // Filter evaluations
  let filtered = evaluations;
  if (earlyWarningCrop !== "all") {
    filtered = filtered.filter(e => e.rule.cropId === "all" || e.rule.cropId === earlyWarningCrop);
  }
  if (earlyWarningRiskFilter === "due") {
    filtered = filtered.filter(e => e.status === "due_lead" || e.status === "active_season");
  } else if (earlyWarningRiskFilter === "critical") {
    filtered = filtered.filter(e => e.rule.riskLevel === "critical");
  } else if (earlyWarningRiskFilter === "high") {
    filtered = filtered.filter(e => e.rule.riskLevel === "high" || e.rule.riskLevel === "critical");
  }

  const cropTitle = (c) => c === "palm" ? "🌴 نخيل التمر" : c === "olive" ? "🫒 أشجار الزيتون" : "🌐 كل المحاصيل";
  const riskBadge = (lvl) => {
    if (lvl === "critical") return `<span class="badge" style="background:#fee2e2;color:#991b1b;font-weight:bold">🔴 خطورة حرجة</span>`;
    if (lvl === "high") return `<span class="badge" style="background:#ffedd5;color:#9a3412;font-weight:bold">🟠 خطورة عالية</span>`;
    return `<span class="badge" style="background:#fef9c3;color:#854d0e;font-weight:bold">🟡 خطورة متوسطة</span>`;
  };

  return `
    <!-- Top KPI Cards -->
    <div class="grid grid-4" style="margin-bottom:14px">
      <div class="card kpi" style="border-right:4px solid #ef4444">
        <div class="n" style="color:#b91c1c">${dueOrActiveCount}</div>
        <div class="l">تنبيهات استباقية ونشطة مستحقة</div>
      </div>
      <div class="card kpi" style="border-right:4px solid var(--green)">
        <div class="n" style="color:var(--green-d)">${rules.length}</div>
        <div class="l">آفات وأمراض خاضعة للرصد والمراقبة</div>
      </div>
      <div class="card kpi" style="border-right:4px solid #0284c7">
        <div class="n" style="color:#0284c7">${stockReadinessPct}٪</div>
        <div class="l">جاهزية مخزون المبيدات والمستلزمات</div>
      </div>
      <div class="card kpi" style="border-right:4px solid #d97706">
        <div class="n" style="color:#d97706">${scheduledPestTasks}</div>
        <div class="l">خطط وقائية مجدولة بالميدان</div>
      </div>
    </div>

    <!-- Proactive IPM Information Banner -->
    <div class="card" style="margin-bottom:14px;background:linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);border:1px solid #86efac">
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <div style="font-size:32px">🛡️</div>
        <div style="flex:1">
          <h4 style="margin:0 0 4px;color:#166534">محرك الإنذار المبكر والوقاية الاستباقية (Predictive Crop Protection Engine)</h4>
          <p style="margin:0;font-size:12.5px;color:#15803d;line-height:1.6">
            يعتمد النظام مصفوفة ديناميكية للإنذار المبكر تربط أطوار نمو الأشجار والتقويم المناخي بنافذة تنبيه استباقية (Lead Time)، لتحويل تدابير الحماية إلى <b>أوامر عمل ميدانية فورية</b>، والتحقق المباشر من <b>جاهزية المستودع</b>، مع <b>إشعار المستثمرين</b> لترسيخ ثقتهم في الحماية الفنية الاحترافية لمحاصيلهم.
          </p>
        </div>
        <div>
          <button class="btn btn-primary btn-sm" data-act="ew-open-new-rule">➕ إضافة آفة وقاعدة إنذار جديدة</button>
        </div>
      </div>
    </div>

    <!-- Filter Bar -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin:6px 0 14px;flex-wrap:wrap;gap:8px">
      <div class="ptabs" style="margin:0;gap:6px">
        <button class="${earlyWarningCrop==='all'?'on':''}" data-act="early-warning-crop" data-id="all">🌐 كل المحاصيل (${evaluations.length})</button>
        <button class="${earlyWarningCrop==='palm'?'on':''}" data-act="early-warning-crop" data-id="palm">🌴 نخيل التمر (${evaluations.filter(e=>e.rule.cropId==='palm'||e.rule.cropId==='all').length})</button>
        <button class="${earlyWarningCrop==='olive'?'on':''}" data-act="early-warning-crop" data-id="olive">🫒 أشجار الزيتون (${evaluations.filter(e=>e.rule.cropId==='olive'||e.rule.cropId==='all').length})</button>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <span style="font-size:12px;font-weight:bold">تصفية الخطورة والحالة:</span>
        <select id="ew_risk_filter" data-act="early-warning-filter" style="padding:5px 10px;font-size:12.5px;border-radius:6px;border:1.5px solid var(--line)">
          <option value="all" ${earlyWarningRiskFilter==='all'?'selected':''}>جميع الحالات والمستويات</option>
          <option value="due" ${earlyWarningRiskFilter==='due'?'selected':''}>⚡ تنبيه مستحق وذروة نشاط</option>
          <option value="critical" ${earlyWarningRiskFilter==='critical'?'selected':''}>🔴 درجة خطورة حرجة</option>
          <option value="high" ${earlyWarningRiskFilter==='high'?'selected':''}>🟠 درجة خطورة عالية فأعلى</option>
        </select>
      </div>
    </div>

    <!-- Smart Alert Cards Grid -->
    ${filtered.length ? `
      <div style="display:flex;flex-direction:column;gap:14px">
        ${filtered.map(ev => {
          const r = ev.rule;
          const borderColor = ev.status === "active_season" ? "#ef4444" : ev.status === "due_lead" ? "#f59e0b" : "#10b981";
          const statusBg = ev.status === "active_season" ? "#fef2f2" : ev.status === "due_lead" ? "#fffbeb" : "#f0fdf4";

          return `
            <div class="card" style="border-right:6px solid ${borderColor};padding:14px;background:#fff;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:10px">
                <div>
                  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                    <h3 style="margin:0;font-size:16px;color:#1e293b">${r.name}</h3>
                    <span class="muted" style="font-size:12px;font-style:italic">(${r.scientificName || ""})</span>
                    <span class="badge" style="background:#e0f2fe;color:#0369a1;font-weight:600">${cropTitle(r.cropId)}</span>
                    <span class="badge" style="background:#f1f5f9;color:#475569">${r.type || "آفة"}</span>
                    ${riskBadge(r.riskLevel)}
                  </div>
                  <div style="font-size:12px;color:#64748b;margin-top:4px">
                    موسم النشاط: <b>شهور (${r.activityStartMonth} - ${r.activityEndMonth})</b> • نافذة التنبيه المسبق: <b>${r.leadDays || 14} يوماً</b>
                  </div>
                </div>

                <div style="text-align:left">
                  <div class="badge ${ev.urgencyBadge}" style="font-size:12px;padding:6px 12px;border-radius:20px;font-weight:bold">
                    ${ev.urgencyText}
                  </div>
                </div>
              </div>

              <!-- Info Breakdown Grid -->
              <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:10px;background:${statusBg};border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:12.5px;border:1px solid rgba(0,0,0,0.04)">
                <div>
                  <span style="color:#64748b">🌱 الطور الحرج للإصابة:</span>
                  <div style="font-weight:600;margin-top:2px;color:#0f172a">${r.criticalStage || "—"}</div>
                </div>
                <div>
                  <span style="color:#64748b">🌤️ محفزات الطقس والبيئة:</span>
                  <div style="font-weight:600;margin-top:2px;color:#0f172a">${r.weatherTriggers || "—"}</div>
                </div>
                <div>
                  <span style="color:#64748b">🎯 النطاق الميداني المستهدف:</span>
                  <div style="font-weight:600;margin-top:2px;color:#0f172a">
                    ${ev.affectedSectors.length ? `قطاع ${ev.affectedSectors.join("، ")} (${ev.affectedPlots.length} قطعة • ${ev.affectedPalmsCount} شجرة)` : "شامل كافة قطاعات المزرعة"}
                  </div>
                </div>
                <div>
                  <span style="color:#64748b">📦 حالة رصيد المستودع:</span>
                  <div style="margin-top:2px">
                    ${ev.stockSufficient ? `
                      <span style="color:#15803d;font-weight:bold">✅ متوفر بالمخزن (${ev.stockAvailable} ${ev.fert?.unit || "وحدة"})</span>
                    ` : `
                      <span style="color:#b91c1c;font-weight:bold">⚠️ رصيد منخفض (${ev.stockAvailable} ${ev.fert?.unit || "وحدة"}) - يلزم توريد</span>
                    `}
                    <span class="muted" style="font-size:11px">(${ev.materialName})</span>
                  </div>
                </div>
              </div>

              <!-- Preventive & Curative Summary Box -->
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:12.5px">
                <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:6px">
                  <span style="font-weight:bold;color:#1e293b;min-width:140px">🛠️ التدابير الميكانيكية:</span>
                  <span style="color:#334155">${r.preventiveActions?.mechanical || "نظافة الحقل والمتابعة الحقلية."}</span>
                </div>
                <div style="display:flex;gap:8px;align-items:flex-start">
                  <span style="font-weight:bold;color:#1e293b;min-width:140px">🧪 بروتوكول الرش الوقائي:</span>
                  <span style="color:#334155">
                    <b>المادة:</b> ${r.preventiveActions?.materialName || "—"} • 
                    <b>الجرعة الموصى بها:</b> ${r.preventiveActions?.defaultDose || "—"} • 
                    <b>فترة الأمان (PHI):</b> ${r.preventiveActions?.phi || 14} يوماً
                  </span>
                </div>
              </div>

              <!-- Action Buttons Bar -->
              <div class="card-actions-toolbar" style="border-top:1px dashed #e2e8f0;padding-top:10px">
                <button class="btn btn-primary btn-compact" data-act="ew-open-order" data-id="${r.id}" title="تحويل فوري إلى أمر عمل ميداني معتمد">
                  ⚡ تحويل لأمر عمل
                </button>
                <button class="btn btn-ghost btn-compact" data-act="ew-open-stock" data-id="${r.id}" title="التحقق من الكميات المتوفرة بالمستودع وإصدار إذن صرف">
                  📦 فحص المخزن
                </button>
                <button class="btn btn-ghost btn-compact" data-act="ew-open-notify" data-id="${r.id}" title="إشعار المستثمرين ذوي العلاقة لطمأنتهم بالتدابير الوقائية المتخذة">
                  📢 إشعار المستثمرين
                </button>
                <button class="btn btn-ghost btn-compact" data-act="ew-open-sop" data-id="${r.id}" title="استعراض بروتوكول العلاج الكامل والدليل العملي المصور">
                  📖 دليل SOP
                </button>
                <button class="btn btn-ghost btn-compact" data-act="ew-edit-rule" data-id="${r.id}" title="تعديل شروط ونافذة التنبيه لهذه الآفة">
                  ⚙️ تعديل
                </button>
                <button class="btn btn-ghost btn-compact btn-icon-only" data-act="ew-delete-rule" data-id="${r.id}" style="color:var(--err)" title="حذف القاعدة">
                  🗑️
                </button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    ` : `
      <div class="card" style="text-align:center;padding:36px 20px">
        <div style="font-size:40px;margin-bottom:10px">🛡️</div>
        <h4>لا توجد قواعد أو تنبيهات مطابقة لخيارات التصفية</h4>
        <p class="muted" style="font-size:13px;max-width:480px;margin:0 auto 14px">
          يمكنك تغيير خيارات الفلترة أو إضافة قاعدة إنذار مبكر جديدة لأي محصول مسجل بالنظام.
        </p>
        <button class="btn btn-primary" data-act="ew-open-new-rule">➕ إضافة آفة وقاعدة إنذار جديدة</button>
      </div>
    `}
  `;
}


// Early Warning Modals: Work Order, Stock Check, Notify Investors, SOP Guide, Rule Form

function renderEarlyWarningWorkOrderModal(st) {
  const rule = (st.earlyWarningRules || []).find(r => r.id === orderTargetRuleId);
  if (!rule) return "";

  const ev = evaluateEarlyWarningRule(rule, st);
  const workers = st.users.filter(u => u.role === "worker" || u.role === "engineer");
  const sectors = st.sectors || [];
  const plots = st.plots || [];

  return `
    <div class="modal" style="display:flex;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.55);z-index:9999;align-items:center;justify-content:center;padding:16px">
      <div class="modal-box card" style="max-width:560px;width:100%;max-height:90vh;overflow-y:auto;border-top:5px solid var(--green)">
        <div class="modal-head" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div>
            <h3 style="margin:0">⚡ إصدار أمر عمل ميداني وقائي</h3>
            <div class="muted" style="font-size:12px">تحويل تنبيه [${rule.name}] إلى خطة تنفيذية فورية</div>
          </div>
          <button class="btn btn-ghost icon-btn" data-act="ew-close-modal" style="padding:4px 8px">✕</button>
        </div>

        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:10px;margin-bottom:14px;font-size:12.5px;color:#166534">
          <b>🎯 تدبير استباقي مقترح:</b> ${rule.criticalStage}<br>
          <b>🧪 المادة الموصى بها:</b> ${rule.preventiveActions?.materialName || "—"} (${rule.preventiveActions?.defaultDose || "—"})
        </div>

        <div class="form-grid" style="display:flex;flex-direction:column;gap:10px">
          <div>
            <label style="display:block;font-size:12.5px;font-weight:bold;margin-bottom:4px">عنوان أمر العمل الميداني:</label>
            <input id="ew_wo_title" class="input" style="width:100%" value="مكافحة وقائية استباقية ضد ${rule.name}" />
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div>
              <label style="display:block;font-size:12.5px;font-weight:bold;margin-bottom:4px">نوع الإجراء:</label>
              <select id="ew_wo_kind" class="input" style="width:100%">
                <option value="schedule">⏰ إضافة إلى جدول الرعاية الدورية</option>
                <option value="operation">⚡ تنفيذ عملية حقلية عاجلة اليوم</option>
              </select>
            </div>
            <div>
              <label style="display:block;font-size:12.5px;font-weight:bold;margin-bottom:4px">درجة الأولوية:</label>
              <select id="ew_wo_priority" class="input" style="width:100%">
                <option value="urgent" ${rule.riskLevel==='critical'?'selected':''}>🔴 عاجل وفوري</option>
                <option value="high" ${rule.riskLevel==='high'?'selected':''}>🟠 أولوية عالية</option>
                <option value="normal" ${rule.riskLevel==='medium'?'selected':''}>🟡 اعتيادي</option>
              </select>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div>
              <label style="display:block;font-size:12.5px;font-weight:bold;margin-bottom:4px">القطاع المستهدف:</label>
              <select id="ew_wo_sec" class="input" style="width:100%">
                <option value="all">🌐 شامل كافة القطاعات</option>
                ${sectors.map(s => `<option value="${s.id}" ${ev.affectedSectors.includes(s.id)?'selected':''}>القطاع ${s.name || s.id}</option>`).join("")}
              </select>
            </div>
            <div>
              <label style="display:block;font-size:12.5px;font-weight:bold;margin-bottom:4px">القطعة:</label>
              <select id="ew_wo_plot" class="input" style="width:100%">
                <option value="all">جميع قطع القطاع</option>
                ${plots.map(p => `<option value="${p.id}">${p.name || p.id}</option>`).join("")}
              </select>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1.5fr 1fr;gap:10px">
            <div>
              <label style="display:block;font-size:12.5px;font-weight:bold;margin-bottom:4px">المادة والمبيد المطلوب:</label>
              <input id="ew_wo_mat" class="input" style="width:100%" value="${rule.preventiveActions?.materialName || ''}" />
            </div>
            <div>
              <label style="display:block;font-size:12.5px;font-weight:bold;margin-bottom:4px">الجرعة المحددة:</label>
              <input id="ew_wo_dose" class="input" style="width:100%" value="${rule.preventiveActions?.defaultDose || ''}" />
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div>
              <label style="display:block;font-size:12.5px;font-weight:bold;margin-bottom:4px">إسناد التنفيذ إلى:</label>
              <select id="ew_wo_user" class="input" style="width:100%">
                <option value="all">فريق الميدان كاملاً</option>
                ${workers.map(u => `<option value="${u.id}">${u.name} (${u.role === 'engineer' ? 'مهندس' : 'عامل'})</option>`).join("")}
              </select>
            </div>
            <div>
              <label style="display:block;font-size:12.5px;font-weight:bold;margin-bottom:4px">تاريخ التنفيذ المستهدف:</label>
              <input id="ew_wo_date" type="date" class="input" style="width:100%" value="${new Date().toISOString().slice(0, 10)}" />
            </div>
          </div>

          <div>
            <label style="display:block;font-size:12.5px;font-weight:bold;margin-bottom:4px">تعليمات وتوجيهات التنفيذ الميداني:</label>
            <textarea id="ew_wo_instructions" class="input" style="width:100%;height:70px;line-height:1.5">${rule.preventiveActions?.mechanical || ''} • ${rule.preventiveActions?.spray || ''}</textarea>
          </div>

          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:10px">
            <button class="btn btn-ghost" data-act="ew-close-modal">إلغاء</button>
            <button class="btn btn-primary" data-act="ew-create-work-order" data-id="${rule.id}">⚡ اعتماد وإصدار أمر العمل فوراً</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderEarlyWarningStockModal(st) {
  const rule = (st.earlyWarningRules || []).find(r => r.id === stockCheckTargetRuleId);
  if (!rule) return "";

  const ev = evaluateEarlyWarningRule(rule, st);
  const fert = ev.fert;
  const otherFerts = (st.fertilizers || []).filter(f => f.kind === "مبيد" || f.kind === "مخصب");

  return `
    <div class="modal" style="display:flex;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.55);z-index:9999;align-items:center;justify-content:center;padding:16px">
      <div class="modal-box card" style="max-width:540px;width:100%;max-height:85vh;overflow-y:auto;border-top:5px solid #0284c7">
        <div class="modal-head" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div>
            <h3 style="margin:0">📦 فحص وتجهيز مخزون المواد الوقائية</h3>
            <div class="muted" style="font-size:12px">مستلزمات الوقاية لـ [${rule.name}]</div>
          </div>
          <button class="btn btn-ghost icon-btn" data-act="ew-close-modal" style="padding:4px 8px">✕</button>
        </div>

        <div class="card" style="background:#f8fafc;border:1px solid #e2e8f0;margin-bottom:14px;padding:12px">
          <div style="font-size:13px;font-weight:bold;margin-bottom:6px;color:#1e293b">المادة الفعالة المطلوبة:</div>
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
            <span style="font-size:15px;color:var(--green-d);font-weight:bold">${ev.materialName || "غير محددة"}</span>
            <span class="badge" style="background:#e0f2fe;color:#0369a1">${rule.preventiveActions?.defaultDose || ""}</span>
          </div>

          <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;margin-top:12px;text-align:center">
            <div style="background:#fff;padding:8px;border-radius:6px;border:1px solid #cbd5e1">
              <div class="muted" style="font-size:11px">الرصيد بالمخزن</div>
              <div style="font-size:16px;font-weight:bold;color:${ev.stockSufficient?'#15803d':'#b91c1c'}">
                ${fert ? fert.stock : 0} ${fert?.unit || ""}
              </div>
            </div>
            <div style="background:#fff;padding:8px;border-radius:6px;border:1px solid #cbd5e1">
              <div class="muted" style="font-size:11px">الكميات المحجوزة</div>
              <div style="font-size:16px;font-weight:bold;color:#64748b">
                ${fert ? (fert.allocated || 0) : 0} ${fert?.unit || ""}
              </div>
            </div>
            <div style="background:#fff;padding:8px;border-radius:6px;border:1px solid #cbd5e1">
              <div class="muted" style="font-size:11px">الرصيد المتاح</div>
              <div style="font-size:16px;font-weight:bold;color:${ev.stockSufficient?'#15803d':'#b91c1c'}">
                ${ev.stockAvailable} ${fert?.unit || ""}
              </div>
            </div>
          </div>
        </div>

        <div style="margin-bottom:14px">
          <h4 style="margin:0 0 6px;font-size:13px">المبيدات والمركبات البديلة المتوفرة في المخزن:</h4>
          <div style="display:flex;flex-direction:column;gap:6px">
            ${otherFerts.map(f => `
              <div style="display:flex;justify-content:space-between;align-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:6px 10px;font-size:12px">
                <div>
                  <b>${f.name}</b>
                  <span class="muted">(${f.kind} • ${cropName(f.cropId)})</span>
                </div>
                <span class="badge badge-ok">${f.stock} ${f.unit} متوفر</span>
              </div>
            `).join("")}
          </div>
        </div>

        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button class="btn btn-ghost" data-act="ew-close-modal">إغلاق</button>
          <button class="btn btn-primary" data-act="ew-stock-issue-request" data-id="${fert?.id || 'ft6'}">
            ➕ إنشاء إذن صرف فوري للمهندس
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderEarlyWarningNotifyInvestorsModal(st) {
  const rule = (st.earlyWarningRules || []).find(r => r.id === notifyTargetRuleId);
  if (!rule) return "";

  const ev = evaluateEarlyWarningRule(rule, st);
  const targetPlots = new Set(ev.affectedPlots);
  const affectedInvestors = st.users.filter(u => {
    if (u.role !== "investor") return false;
    const invPlots = u.plots || [];
    return invPlots.some(p => targetPlots.has(p) || targetPlots.size === 0);
  });

  const defaultMsg = `درع الحماية الاستباقية: يسر إدارة المزرعة إحاطتكم ببدء تنفيذ حزمة الفحص والوقاية الموسمية ضد ${rule.name} لأشجاركم في القطاع (${ev.affectedSectors.join("، ") || "المزرعة"}) لضمان أعلى جودة للمحصول وحماية استثماراتكم.`;

  return `
    <div class="modal" style="display:flex;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.55);z-index:9999;align-items:center;justify-content:center;padding:16px">
      <div class="modal-box card" style="max-width:540px;width:100%;max-height:85vh;overflow-y:auto;border-top:5px solid #d97706">
        <div class="modal-head" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div>
            <h3 style="margin:0">📢 إشعار المستثمرين بالتدابير الوقائية</h3>
            <div class="muted" style="font-size:12px">تعزيز الشفافية وتأكيد جودة الإدارة الفنية (Client View)</div>
          </div>
          <button class="btn btn-ghost icon-btn" data-act="ew-close-modal" style="padding:4px 8px">✕</button>
        </div>

        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px;margin-bottom:12px;font-size:12.5px;color:#92400e">
          💡 سيتم إرسال هذا التنبيه إلى المستثمرين الذين يملكون أشجاراً في القطاعات المستهدفة ليظهر في بوابتهم ومركز إشعاراتهم.
        </div>

        <div style="margin-bottom:12px">
          <label style="display:block;font-size:12.5px;font-weight:bold;margin-bottom:4px">المستثمرون المستهدفون بالإشعار (${affectedInvestors.length}):</label>
          <div style="display:flex;gap:6px;flex-wrap:wrap;max-height:90px;overflow-y:auto;background:#f8fafc;padding:8px;border-radius:6px;border:1px solid #e2e8f0">
            ${affectedInvestors.map(inv => `
              <span class="badge" style="background:#e2e8f0;color:#334155;font-size:11.5px">👤 ${inv.name}</span>
            `).join("") || `<span class="muted">سيتم إرسال الإشعار لجميع المستثمرين المسجلين</span>`}
          </div>
        </div>

        <div style="margin-bottom:14px">
          <label style="display:block;font-size:12.5px;font-weight:bold;margin-bottom:4px">نص الرسالة التوعوية والاستباقية:</label>
          <textarea id="ew_inv_msg" class="input" style="width:100%;height:95px;line-height:1.6">${defaultMsg}</textarea>
        </div>

        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button class="btn btn-ghost" data-act="ew-close-modal">إلغاء</button>
          <button class="btn btn-primary" data-act="ew-send-investor-notif" data-id="${rule.id}">
            📢 إرسال الإشعار للمستثمرين الآن
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderEarlyWarningSopModal(st) {
  const rule = (st.earlyWarningRules || []).find(r => r.id === sopTargetRuleId);
  if (!rule) return "";

  const cur = rule.curativeProtocol || {};
  const steps = cur.steps || [];

  return `
    <div class="modal" style="display:flex;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.55);z-index:9999;align-items:center;justify-content:center;padding:16px">
      <div class="modal-box card" style="max-width:620px;width:100%;max-height:88vh;overflow-y:auto;border-top:5px solid var(--green)">
        <div class="modal-head" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div>
            <h3 style="margin:0">📖 الدليل الفني وبروتوكول العلاج والحجر (SOP)</h3>
            <div class="muted" style="font-size:12px">${rule.name} <i>(${rule.scientificName || ""})</i></div>
          </div>
          <button class="btn btn-ghost icon-btn" data-act="ew-close-modal" style="padding:4px 8px">✕</button>
        </div>

        <div style="display:flex;flex-direction:column;gap:12px;font-size:13px">
          <!-- Stage & Triggers Card -->
          <div class="card" style="background:#f8fafc;border:1px solid #e2e8f0;padding:12px">
            <h4 style="margin:0 0 8px;color:var(--green-d);font-size:13.5px">🔍 معايير الفحص والطور الحرج للإصابة:</h4>
            <div style="margin-bottom:6px"><b>الطور الحرج:</b> ${rule.criticalStage || "—"}</div>
            <div style="margin-bottom:6px"><b>محفزات الطقس والبيئة:</b> ${rule.weatherTriggers || "—"}</div>
            <div><b>موسم النشاط المتوقع:</b> شهور (${rule.activityStartMonth} - ${rule.activityEndMonth}) مع نافذة تنبيه استباقية ${rule.leadDays} يوماً.</div>
          </div>

          <!-- Preventive Measures -->
          <div class="card" style="background:#f0fdf4;border:1px solid #86efac;padding:12px">
            <h4 style="margin:0 0 8px;color:#166534;font-size:13.5px">🛡️ حزمة التدابير الوقائية الاستباقية (IPM):</h4>
            <div style="margin-bottom:8px">
              <b>1. العمليات الميكانيكية والزراعية:</b><br>
              <span style="color:#15803d;line-height:1.6">${rule.preventiveActions?.mechanical || "—"}</span>
            </div>
            <div>
              <b>2. بروتوكول الرش الوقائي:</b><br>
              <span style="color:#15803d;line-height:1.6">
                المادة المعتمدة: <b>${rule.preventiveActions?.materialName || "—"}</b> • الجرعة: <b>${rule.preventiveActions?.defaultDose || "—"}</b> • فترة الأمان (PHI): <b>${rule.preventiveActions?.phi || 14} يوماً</b>
              </span>
            </div>
          </div>

          <!-- Curative Quarantine Protocol -->
          <div class="card" style="background:#fef2f2;border:1px solid #fca5a5;padding:12px">
            <h4 style="margin:0 0 8px;color:#991b1b;font-size:13.5px">🚨 ${cur.title || "بروتوكول التدخل العلاجي الفوري وعزل البؤرة:"}</h4>
            <ol style="margin:0;padding-right:20px;color:#7f1d1d;line-height:1.7">
              ${steps.map(s => `<li>${s}</li>`).join("") || `<li>فحص النخلة/الشجرة وعزلها فورياً وتطبيق المبيد الجهازي المناسب.</li>`}
            </ol>
          </div>

          <!-- SOP Guide Note -->
          <div style="background:#f1f5f9;border-radius:6px;padding:10px;font-size:12px;color:#475569">
            <b>📘 دليل الإشراف الهندسي (SOP):</b> ${rule.guideSOP || "يجب توثيق كافة المعاملات الحقلية وتسجيل رقم الشجرة المعالجة لمتابعة كفاءة المكافحة."}
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;flex-wrap:wrap;gap:8px">
          <button class="btn btn-ghost" data-act="ew-edit-rule" data-id="${rule.id}" style="border:1.5px solid #0284C7;color:#0284C7;font-weight:700">✏️ تعديل وتحديث بيانات وبروتوكول هذا الدليل</button>
          <button class="btn btn-primary" data-act="ew-close-modal">تم الاطلاع والإغلاق</button>
        </div>
      </div>
    </div>
  `;
}

function renderEarlyWarningRuleModal(st) {
  const isEdit = Boolean(editingEarlyWarningRuleId);
  const rule = isEdit ? (st.earlyWarningRules || []).find(r => r.id === editingEarlyWarningRuleId) : null;
  const crops = st.crops || [];

  return `
    <div class="modal" style="display:flex;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.55);z-index:9999;align-items:center;justify-content:center;padding:16px">
      <div class="modal-box card" style="max-width:600px;width:100%;max-height:90vh;overflow-y:auto;border-top:5px solid var(--green)">
        <div class="modal-head" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <h3 style="margin:0">${isEdit ? "✏️ تعديل بيانات الآفة وبروتوكول الإنذار (SOP)" : "➕ إضافة آفة جديدة وقاعدة إنذار مبكر (SOP)"}</h3>
          <button class="btn btn-ghost icon-btn" data-act="ew-close-modal" style="padding:4px 8px">✕</button>
        </div>

        <div class="form-grid" style="display:flex;flex-direction:column;gap:10px">
          <div style="display:grid;grid-template-columns:1.5fr 1fr;gap:10px">
            <div>
              <label style="display:block;font-size:12.5px;font-weight:bold;margin-bottom:4px">اسم الآفة أو المرض:</label>
              <input id="ew_r_name" class="input" style="width:100%" value="${rule ? rule.name : ''}" placeholder="مثال: ذبابة ثمار الزيتون" />
            </div>
            <div>
              <label style="display:block;font-size:12.5px;font-weight:bold;margin-bottom:4px">الاسم العلمي:</label>
              <input id="ew_r_sci" class="input" style="width:100%" value="${rule ? (rule.scientificName || '') : ''}" placeholder="Bactrocera oleae" />
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
            <div>
              <label style="display:block;font-size:12.5px;font-weight:bold;margin-bottom:4px">المحصول المستهدف:</label>
              <select id="ew_r_crop" class="input" style="width:100%">
                <option value="all" ${rule?.cropId==='all'?'selected':''}>🌐 جميع المحاصيل</option>
                ${crops.map(c => `<option value="${c.id}" ${rule?.cropId===c.id?'selected':''}>${cropIcon(c.id, 14)} ${c.name}</option>`).join("")}
              </select>
            </div>
            <div>
              <label style="display:block;font-size:12.5px;font-weight:bold;margin-bottom:4px">نوع الكيان الحيوي:</label>
              <select id="ew_r_type" class="input" style="width:100%">
                <option value="حشري" ${rule?.type==='حشري'?'selected':''}>حشري</option>
                <option value="فطري" ${rule?.type==='فطري'?'selected':''}>فطري</option>
                <option value="بكتيري" ${rule?.type==='بكتيري'?'selected':''}>بكتيري</option>
                <option value="فيزيولوجي" ${rule?.type==='فيزيولوجي'?'selected':''}>فيزيولوجي / مناخي</option>
              </select>
            </div>
            <div>
              <label style="display:block;font-size:12.5px;font-weight:bold;margin-bottom:4px">درجة الخطورة:</label>
              <select id="ew_r_risk" class="input" style="width:100%">
                <option value="critical" ${rule?.riskLevel==='critical'?'selected':''}>🔴 خطورة حرجة</option>
                <option value="high" ${rule?.riskLevel==='high'?'selected':''}>🟠 خطورة عالية</option>
                <option value="medium" ${rule?.riskLevel==='medium'?'selected':''}>🟡 خطورة متوسطة</option>
              </select>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
            <div>
              <label style="display:block;font-size:12.5px;font-weight:bold;margin-bottom:4px">شهر بدء النشاط:</label>
              <input id="ew_r_smonth" type="number" min="1" max="12" class="input" style="width:100%" value="${rule ? rule.activityStartMonth : 3}" />
            </div>
            <div>
              <label style="display:block;font-size:12.5px;font-weight:bold;margin-bottom:4px">شهر نهاية النشاط:</label>
              <input id="ew_r_emonth" type="number" min="1" max="12" class="input" style="width:100%" value="${rule ? rule.activityEndMonth : 10}" />
            </div>
            <div>
              <label style="display:block;font-size:12.5px;font-weight:bold;margin-bottom:4px">نافذة التنبيه المسبق (أيام):</label>
              <input id="ew_r_lead" type="number" min="1" max="60" class="input" style="width:100%" value="${rule ? (rule.leadDays || 15) : 15}" />
            </div>
          </div>

          <div>
            <label style="display:block;font-size:12.5px;font-weight:bold;margin-bottom:4px">الطور الحرج للإصابة:</label>
            <input id="ew_r_stage" class="input" style="width:100%" value="${rule ? (rule.criticalStage || '') : ''}" placeholder="مثال: مرحلة عقد الثمار أو التكريب" />
          </div>

          <div>
            <label style="display:block;font-size:12.5px;font-weight:bold;margin-bottom:4px">محددات الطقس والبيئة المحفزة:</label>
            <input id="ew_r_weather" class="input" style="width:100%" value="${rule ? (rule.weatherTriggers || '') : ''}" placeholder="مثال: اعتدال الحرارة مع الرطوبة العالية" />
          </div>

          <div>
            <label style="display:block;font-size:12.5px;font-weight:bold;margin-bottom:4px">التدابير الميكانيكية والزراعية:</label>
            <textarea id="ew_r_mech" class="input" style="width:100%;height:60px">${rule ? (rule.preventiveActions?.mechanical || '') : ''}</textarea>
          </div>

          <div style="display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:10px">
            <div>
              <label style="display:block;font-size:12.5px;font-weight:bold;margin-bottom:4px">المادة والمبيد الوقائي:</label>
              <input id="ew_r_mat" class="input" style="width:100%" value="${rule ? (rule.preventiveActions?.materialName || '') : ''}" placeholder="اسم المبيد بالمخزن" />
            </div>
            <div>
              <label style="display:block;font-size:12.5px;font-weight:bold;margin-bottom:4px">الجرعة الموصى بها:</label>
              <input id="ew_r_dose" class="input" style="width:100%" value="${rule ? (rule.preventiveActions?.defaultDose || '') : ''}" placeholder="2 سم³ / لتر" />
            </div>
            <div>
              <label style="display:block;font-size:12.5px;font-weight:bold;margin-bottom:4px">فترة الأمان (PHI أيام):</label>
              <input id="ew_r_phi" type="number" min="0" class="input" style="width:100%" value="${rule ? (rule.preventiveActions?.phi || 14) : 14}" />
            </div>
          </div>

          <div>
            <label style="display:block;font-size:12.5px;font-weight:bold;margin-bottom:4px">خطوات بروتوكول العلاج الفوري (خطوة لكل سطر):</label>
            <textarea id="ew_r_curative" class="input" style="width:100%;height:65px">${rule && rule.curativeProtocol?.steps ? rule.curativeProtocol.steps.join("\n") : ''}</textarea>
          </div>

          <div>
            <label style="display:block;font-size:12.5px;font-weight:bold;margin-bottom:4px">📘 دليل ومعايير الإشراف الهندسي الميداني (SOP Standards):</label>
            <textarea id="ew_r_sop" class="input" style="width:100%;height:65px" placeholder="أدخل تعليمات الإشراف الهندسي والمعايير الفنية المعتمدة للمكافحة...">${rule ? (rule.guideSOP || '') : ''}</textarea>
          </div>

          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:10px">
            <button class="btn btn-ghost" data-act="ew-close-modal">إلغاء</button>
            <button class="btn btn-primary" data-act="ew-save-rule" data-id="${rule ? rule.id : ''}">💾 حفظ قاعدة الإنذار</button>
          </div>
        </div>
      </div>
    </div>
  `;
}


