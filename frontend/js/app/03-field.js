// PalmTrace app — Field work: bulk operations, worker home, QR scan, field notes, rework
// (split from the former single app.js; files are classic scripts loaded in order by index.html)

const BULK_MATS = ["سماد عضوي", "NPK 20-20-20", "يوريا", "رش وقائي", "مبيد سوسة", "بدون مادة"];
let bulkMode = "plot";
let bulkSec = "";
let bulkPhotoData = null;
let bulkPickSec = "", bulkPickPlot = "";
const bulkPlots = new Set();
function scopedFieldPlots() {
  const st = Store.get();
  const u = session();
  if (u && (u.role === "worker" || u.role === "engineer")) {
    const userPlots = (Array.isArray(u.plots) && u.plots.length) ? u.plots : ((st.users || []).find(x => x.id === u.id)?.plots || []);
    if (userPlots && userPlots.length) {
      return st.plots.filter(p => userPlots.includes(p.id));
    }
  }
  return st.plots;
}

function normCropId(c) {
  if (!c || c === "all") return "all";
  const s = String(c).trim().toLowerCase();
  if (s === "1" || s === "1.0" || s === "palm" || s === "palms" || s === "نخيل") return "palm";
  if (s === "2" || s === "2.0" || s === "olive" || s === "olives" || s === "زيتون") return "olive";
  if (s === "3" || s === "3.0" || s === "mango" || s === "مانجو") return "mango";
  return s;
}

function bulkTargetPalms() {
  const st = Store.get();
  const plots = scopedFieldPlots();
  const allowed = new Set(plots.map(p => String(p.id)));
  let list = st.palms.filter(p => !p.archived);
  const mode = bulkMode;
  if (mode === "sector") {
    list = list.filter(p => allowed.has(String(p.plot)));
    const sec = $("#bsec")?.value || bulkSec;
    const plotSector = new Map(st.plots.map(x => [String(x.id), x.sector]));
    list = list.filter(p => plotSector.get(String(p.plot)) === sec);
  } else if (mode === "plot") {
    list = list.filter(p => allowed.has(String(p.plot)));
    // a selected main plot includes its sub-plots
    const kids = plotChildrenMap();
    const ids = new Set([...bulkPlots].flatMap(id => plotFamilyIds(id, kids)).map(String));
    list = list.filter(p => ids.has(String(p.plot)));
  } else {
    // picks mode: match by stringified ID or by palm code
    const idStrs = new Set([...selectedPalmIds].map(String));
    list = list.filter(p => idStrs.has(String(p.id)) || (p.code && idStrs.has(String(p.code))));
  }
  const chosenCrop = $("#bcrop")?.value || bulkCrop;
  if (chosenCrop && chosenCrop !== "all") {
    const normChosen = normCropId(chosenCrop);
    list = list.filter(p => normCropId(p.cropId || "palm") === normChosen);
  }
  const opTypeId = $("#btype")?.value;
  if (opTypeId) {
    const opT = st.operationTypes.find(t => t.id === opTypeId);
    if (opT && opT.cropId && normCropId(opT.cropId) !== "all") {
      const normOpCrop = normCropId(opT.cropId);
      list = list.filter(p => normCropId(p.cropId || "palm") === normOpCrop);
    }
  }
  return list;
}
function bulkOpView() {
  if (!hasPerm("ops_bulk")) {
    return `<div class="card" style="text-align:center;padding:24px">
      <h3>⚠️ غير مصرح</h3>
      <p class="muted">ليس لديك صلاحية تنفيذ عمليات زراعية جماعية.</p>
      <button class="btn btn-primary" data-act="back" style="margin-top:10px">رجوع</button>
    </div>`;
  }
  const st = Store.get();
  const plots = scopedFieldPlots();
  const secs = [...new Set(plots.map(p => p.sector))];
  if (!bulkSec || !secs.includes(bulkSec)) bulkSec = secs[0] || "";
  if (bulkPlotSec && !secs.includes(bulkPlotSec)) bulkPlotSec = "";
  const activeCrops = (st.crops || []).filter(c => c.active);
  const types = st.operationTypes.filter(t => !t.inactive && (!t.scopeType || t.scopeType === "bulk" || t.scopeType === "both") && (bulkCrop === "all" || !t.cropId || normCropId(t.cropId) === "all" || normCropId(t.cropId) === normCropId(bulkCrop)));
  const matchingPlots = plots.filter(p => {
    if (bulkPlotSec && p.sector !== bulkPlotSec) return false;
    if (bulkPlotSearch) {
      const q = bulkPlotSearch.trim().toLowerCase();
      const full = ((p.name||"") + " " + (p.id||"")).toLowerCase();
      if (!full.includes(q)) return false;
    }
    return true;
  });

  // Calculate live targets based on scope and crop
  const targetPalms = bulkTargetPalms();
  const pCount = targetPalms.filter(p => normCropId(p.cropId || "palm") === "palm").length;
  const oCount = targetPalms.filter(p => normCropId(p.cropId) === "olive").length;
  const breakdownStr = (pCount && oCount) ? ` (${pCount} نخيل • ${oCount} زيتون)` : '';

  const curType = types[0];
  const initialOpTypeName = curType ? curType.name : "العملية";
  const validTargetsCount = targetPalms.filter(p => {
    if (!curType || !curType.cropId || normCropId(curType.cropId) === "all") return true;
    return normCropId(p.cropId || "palm") === normCropId(curType.cropId);
  }).length;

  return `<div class="bulk-op-container">
    <div class="page-head">
      <div>
        <h3 style="margin:0">تسجيل عملية ميدانية جماعية</h3>
        <div class="muted" style="font-size:12px">تطبيق عمليات الرعاية والتسميد والمكافحة على قطاع كامل أو قطع متعددة أو أشجار محددة دفعة واحدة</div>
      </div>
      <button class="btn btn-ghost icon-btn" data-act="back">↩️ عودة للعمليات</button>
    </div>

    <!-- Section 1: Scope & Crop Selection -->
    <div class="card">
      <h3 style="margin-top:0">1) النطاق المستهدف والمحصول</h3>
      
      <div class="bulk-scope-seg">
        <button type="button" class="${bulkMode==='sector'?'on':''}" data-act="bmode" data-id="sector">🌐 قطاع كامل</button>
        <button type="button" class="${bulkMode==='plot'?'on':''}" data-act="bmode" data-id="plot">🗺️ قطع متعددة</button>
        <button type="button" class="${bulkMode==='picks'?'on':''}" data-act="bmode" data-id="picks">🎯 أشجار / نخيل محدد</button>
      </div>

      ${bulkMode === "sector" ? `
        <div class="grid grid-2" style="margin-bottom:12px">
          <div>
            <label style="font-weight:700">المحصول المستهدف</label>
            <select id="bcrop" data-act="bulk-crop-change">
              <option value="all" ${bulkCrop==="all"?"selected":""}>🌐 كافة المحاصيل في القطاع</option>
              ${activeCrops.map(c => `<option value="${c.id}" ${bulkCrop===c.id?"selected":""}>${cropTextLabel(c)} فقط</option>`).join("")}
            </select>
          </div>
          <div>
            <label style="font-weight:700">القطاع المستهدف</label>
            <select id="bsec" data-act="bsec-change">
              ${secs.map(s => {
                const sPalms = activePalmsInSector(s);
                const sP = sPalms.filter(p => (p.cropId||"palm") === "palm").length;
                const sO = sPalms.filter(p => p.cropId === "olive").length;
                const desc = (sP && sO) ? `${sP} نخيل • ${sO} زيتون` : `${sPalms.length} شجرة`;
                return `<option value="${s}" ${bulkSec===s?"selected":""}>${sectorName(s)} (${desc})</option>`;
              }).join("")}
            </select>
          </div>
        </div>
        <div class="bulk-summary-strip">
          <span>🌐 القطاع المحدد: <b>${sectorName(bulkSec||secs[0])}</b></span>
          <span>🎯 إجمالي المستهدف: <b>${targetPalms.length}</b> شجرة${breakdownStr}</span>
        </div>
      ` : bulkMode === "plot" ? `
        <div class="grid grid-2" style="margin-bottom:12px">
          <div>
            <label style="font-weight:700">المحصول المستهدف</label>
            <select id="bcrop" data-act="bulk-crop-change">
              <option value="all" ${bulkCrop==="all"?"selected":""}>🌐 كافة المحاصيل في القطع المحددة</option>
              ${activeCrops.map(c => `<option value="${c.id}" ${bulkCrop===c.id?"selected":""}>${cropTextLabel(c)} فقط</option>`).join("")}
            </select>
          </div>
          <div>
            <label style="font-weight:700">تصفية القطع حسب القطاع</label>
            <select id="bplot_sec" data-act="bplot-sec-change">
              <option value="" ${!bulkPlotSec?'selected':''}>🌐 كافة القطاعات (${secs.length})</option>
              ${secs.map(s => `<option value="${s}" ${bulkPlotSec===s?'selected':''}>${sectorName(s)}</option>`).join("")}
            </select>
          </div>
        </div>

        <!-- Quick Multi-Plot Toggle Grid -->
        <div style="background:#F8FAFC;border:1.5px solid #CBD5E1;border-radius:10px;padding:12px;margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px">
            <span style="font-weight:700;font-size:13px;color:#1E293B">🗺️ اختيار سريع للقطع بالضغط المباشر:</span>
            <div style="display:flex;gap:6px">
              <button type="button" class="btn btn-sm btn-ghost" data-act="bplot-add-sec-all" style="font-size:11.5px;padding:4px 10px;border:1px solid #16A34A;color:#16A34A;font-weight:700;background:#F0FDF4">+ إضافة كافة قطع القطاع</button>
              ${bulkPlots.size > 0 ? `<button type="button" class="btn btn-sm btn-ghost" data-act="bplot-clear" style="font-size:11.5px;padding:4px 8px;color:#DC2626;border-color:#FCA5A5">مسح الكل (${bulkPlots.size})</button>` : ''}
            </div>
          </div>
          <div style="max-height:220px;overflow-y:auto;padding:2px">
            ${(() => {
              if (!matchingPlots.length) return `<span class="muted" style="font-size:12px">لا توجد قطع مطابقة</span>`;
              const kids = plotChildrenMap();
              const chip = (p, isSub) => {
                const isSel = bulkPlots.has(p.id);
                const plPalms = activePalmsInPlotFamily(p.id, kids).length;
                return `<button type="button" data-act="bplot-toggle" data-id="${p.id}" class="chip" style="cursor:pointer;border-radius:8px;font-size:12px;padding:5px 10px;font-weight:${isSub ? 600 : 800};border:1.5px solid ${isSel ? '#16A34A' : (isSub ? '#E2E8F0' : '#94A3B8')};background:${isSel ? '#DCFCE7' : '#FFFFFF'};color:${isSel ? '#166534' : '#1E293B'};transition:all 0.1s ease">${isSel ? '✓ ' : '+ '}${isSub ? '' : '📍 '}${escapeHtml(p.name || p.id)} <small style="opacity:0.75">(${plPalms} شجرة)</small></button>`;
              };
              const ids = new Set(matchingPlots.map(p => p.id));
              const bySec = new Map();
              matchingPlots.forEach(p => { if (!bySec.has(p.sector)) bySec.set(p.sector, []); bySec.get(p.sector).push(p); });
              const byNum = (a, b) => String(a.id).localeCompare(String(b.id), "en", { numeric: true });
              const hint = bulkPlotSec ? "" : `<div class="muted" style="font-size:11.5px;margin-bottom:6px">💡 اختيار القطعة الرئيسية يشمل كل قطعها الفرعية. لاختيار قطع فرعية بعينها اختر القطاع من "تصفية القطع حسب القطاع".</div>`;
              return hint + [...bySec.entries()].map(([sec, list]) => {
                const mains = list.filter(p => !(p.parentPlotId && ids.has(p.parentPlotId))).sort(byNum);
                const rows = mains.map(m => {
                  // With all sectors shown, list main plots only (each includes its sub-plots) to keep the page light
                  const subs = bulkPlotSec ? (kids.get(m.id) || []).filter(c => ids.has(c.id)).sort(byNum) : [];
                  return `<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin:0 0 6px 0">${chip(m, false)}${subs.map(c => chip(c, true)).join("")}</div>`;
                }).join("");
                return `<div style="margin-bottom:8px"><div style="font-size:11.5px;font-weight:800;color:#475569;margin:4px 0">🌐 ${escapeHtml(sectorName(sec))}</div>${rows}</div>`;
              }).join("");
            })()}
          </div>
        </div>

        <div class="bulk-search-row">
          <label style="font-weight:700;display:block;margin-bottom:4px">البحث عن قطعة محددة</label>
          <div class="bulk-search-box">
            <input id="bplot_search" value="${bulkPlotSearch||""}" placeholder="🔍 ابحث برقم أو اسم القطعة (مثال: 12 أو 03)..." />
            ${bulkPlotSearch ? `<button type="button" class="bulk-search-clear" data-act="bplot-search-clear" title="مسح نص البحث">✕</button>` : ''}
          </div>
        </div>

        <div class="bulk-plot-action-row" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
          <select id="bplotadd" style="flex:2;min-width:220px">
            ${matchingPlots.length ? plotOptionsHtml(matchingPlots, { counts: true }) : `<option value="" disabled selected>لا توجد قطع مطابقة للبحث الحالي</option>`}
          </select>
          <button type="button" class="btn btn-primary icon-btn" data-act="bplot-add" style="width:auto">➕ إضافة القطعة</button>
          ${matchingPlots.length > 1 ? `
            <button type="button" class="btn btn-ghost icon-btn" data-act="bplot-add-all" style="width:auto;color:var(--green);font-weight:700" title="إضافة كافة القطع المعروضة بالنتائج">➕ إضافة كل النتائج (${matchingPlots.length})</button>
          ` : ''}
          ${bulkPlots.size > 0 ? `
            <button type="button" class="btn btn-ghost icon-btn" data-act="bplot-clear" style="width:auto;color:#dc2626;border-color:#fca5a5">مسح المحدد</button>
          ` : ''}
        </div>

        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <label style="font-weight:700;margin:0">القطع المختارة للعملية (${bulkPlots.size} قطعة):</label>
            ${bulkPlots.size > 0 ? `<span class="muted" style="font-size:12px">انقر × لإزالة أي قطعة</span>` : ''}
          </div>
          <div class="bulk-chips-container">
            ${[...bulkPlots].map(id => {
              const plPalms = activePalmsInPlotFamily(id);
              const pCnt = plPalms.filter(x => (x.cropId||"palm") === "palm").length;
              const oCnt = plPalms.filter(x => x.cropId === "olive").length;
              const plDesc = (pCnt && oCnt) ? `${pCnt} نخيل • ${oCnt} زيتون` : `${plPalms.length} شجرة`;
              return `<span class="bulk-plot-badge">📍 ${escapeHtml(plotName(id))} <small style="opacity:0.8">(${plDesc})</small> <button type="button" class="del-btn" data-act="bplot-drop" data-id="${id}" title="إزالة">×</button></span>`;
            }).join("") || `<span class="muted" style="font-size:13px">لم يتم اختيار أي قطع بعد. استخدم القائمة أعلاه لإضافة قطع للعملية.</span>`}
          </div>
        </div>

        <div class="bulk-summary-strip">
          <span>📍 المحدد: <b>${bulkPlots.size}</b> قطعة</span>
          <span>🎯 إجمالي المستهدف: <b>${targetPalms.length}</b> شجرة${breakdownStr}</span>
        </div>
      ` : `
        <div style="margin-bottom:12px">
          <label style="font-weight:700">المحصول المستهدف</label>
          <select id="bcrop" data-act="bulk-crop-change">
            <option value="all" ${bulkCrop==="all"?"selected":""}>🌐 كافة المحاصيل</option>
            ${activeCrops.map(c => `<option value="${c.id}" ${bulkCrop===c.id?"selected":""}>${cropTextLabel(c)} فقط</option>`).join("")}
          </select>
        </div>

        <!-- Quick Tree Picker by Plot Card -->
        <div style="background:#F8FAFC;border:1.5px solid #CBD5E1;border-radius:10px;padding:12px;margin-bottom:14px">
          <div style="font-weight:800;font-size:13.5px;color:#1E293B;margin-bottom:8px;display:flex;align-items:center;gap:6px">
            <span>🎯</span> اختيار سريع وتحديد الأشجار حسب القطعة:
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:8px;margin-bottom:10px">
            <div>
              <label style="font-size:11.5px;font-weight:700">القطاع:</label>
              <select id="bpick_sec" data-act="bulk-pick-sec-change" style="width:100%;font-size:12px;padding:5px">
                ${secs.map(s => `<option value="${s}" ${(bulkPickSec||secs[0])===s?'selected':''}>${sectorName(s)}</option>`).join("")}
              </select>
            </div>
            <div>
              <label style="font-size:11.5px;font-weight:700">القطعة:</label>
              <select id="bpick_plot" data-act="bulk-pick-plot-change" style="width:100%;font-size:12px;padding:5px">
                <option value="">-- اختر قطعة لعرض أشجارها --</option>
                ${plotOptionsHtml(plots.filter(p => p.sector === (bulkPickSec || secs[0])), { selected: bulkPickPlot, counts: true })}
              </select>
            </div>
          </div>

          ${bulkPickPlot ? `
            ${(() => {
              const pPalms = activePalmsInPlotFamily(bulkPickPlot).filter(p => bulkCrop === "all" || normCropId(p.cropId||"palm") === normCropId(bulkCrop));
              return `
                <div style="background:#FFFFFF;border:1px solid #E2E8F0;border-radius:8px;padding:10px;margin-bottom:10px">
                  <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:space-between;margin-bottom:8px">
                    <div style="font-size:12px;font-weight:700;color:#0F172A">
                      أشجار القطعة (${pPalms.length} أصل):
                    </div>
                    <div style="display:flex;gap:6px;flex-wrap:wrap">
                      <button type="button" class="btn btn-sm btn-primary" data-act="bulk-pick-all-in-plot" style="font-size:11.5px;padding:4px 10px;background:#16A34A">☑️ تحديد كافة أشجار القطعة (${pPalms.length})</button>
                      <button type="button" class="btn btn-sm btn-ghost" data-act="bulk-unpick-all-in-plot" style="font-size:11.5px;padding:4px 8px;color:#DC2626;border-color:#FCA5A5">إلغاء تحديد القطعة</button>
                    </div>
                  </div>

                  <!-- Range picker -->
                  <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;background:#F1F5F9;padding:6px 10px;border-radius:6px;font-size:12px;margin-bottom:8px">
                    <span style="font-weight:700">🔢 تحديد بنطاق أرقام:</span>
                    <span>من نخلة:</span>
                    <input id="b_rng_from" type="number" min="1" placeholder="1" style="width:65px;padding:3px 6px;border-radius:4px;border:1px solid #CBD5E1;font-size:12px" />
                    <span>إلى:</span>
                    <input id="b_rng_to" type="number" min="1" placeholder="20" style="width:65px;padding:3px 6px;border-radius:4px;border:1px solid #CBD5E1;font-size:12px" />
                    <button type="button" class="btn btn-sm btn-ghost" data-act="bulk-pick-range" style="font-size:11.5px;padding:3px 10px;border:1px solid #2563EB;color:#1D4ED8;background:#EFF6FF;font-weight:700">تطبيق النطاق</button>
                  </div>

                  <!-- Interactive Tree Chips Grid -->
                  <div style="display:flex;gap:5px;flex-wrap:wrap;max-height:160px;overflow-y:auto;padding:6px;border:1px solid #E2E8F0;border-radius:6px;background:#FAFAFA">
                    ${pPalms.map(p => {
                      const isSel = selectedPalmIds.has(p.id) || selectedPalmIds.has(String(p.id));
                      return `<button type="button" class="chip" data-act="bulk-toggle-palm" data-id="${p.id}" style="cursor:pointer;border-radius:6px;font-size:11.5px;padding:4px 8px;font-weight:700;border:1.5px solid ${isSel ? '#16A34A' : '#CBD5E1'};background:${isSel ? '#DCFCE7' : '#FFFFFF'};color:${isSel ? '#166534' : '#334155'};transition:all 0.1s ease">${isSel ? '✓ ' : '+ '}${escapeHtml(p.code)}</button>`;
                    }).join("") || '<span class="muted" style="font-size:12px">لا توجد أشجار في هذه القطعة</span>'}
                  </div>
                </div>
              `;
            })()}
          ` : ''}
        </div>

        <div class="bulk-plot-action-row" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
          <input id="baddcode" placeholder="أدخل كود شجرة، أو عدة أكواد مفصولة بفواصل أو مسافات..." style="flex:2;min-width:200px" />
          <button type="button" class="btn btn-primary icon-btn" data-act="bulk-add-code" style="width:auto">➕ إضافة بالكود</button>
          <button type="button" class="btn btn-ghost icon-btn" data-act="start-scan" style="width:auto">📷 مسح QR</button>
          ${selectedPalmIds.size > 0 ? `
            <button type="button" class="btn btn-ghost icon-btn" data-act="bulk-clear-picks" style="width:auto;color:#dc2626;border-color:#fca5a5">مسح التحديد (${selectedPalmIds.size})</button>
          ` : ''}
        </div>

        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <label style="font-weight:700;margin:0">الأشجار المحددة حالياً (${selectedPalmIds.size}):</label>
            ${selectedPalmIds.size > 0 ? `<span class="muted" style="font-size:12px">انقر × لإزالة أي شجرة</span>` : ''}
          </div>
          <div class="bulk-chips-container">
            ${[...selectedPalmIds].slice(0, 40).map(id => {
              const p = st.palms.find(x => String(x.id) === String(id) || String(x.code) === String(id));
              return `<span class="bulk-plot-badge">${p ? cropIcon(p.cropId,14) : ''} ${escapeHtml(p?.code||id)} <button type="button" class="del-btn" data-act="bulk-drop" data-id="${id}">×</button></span>`;
            }).join("") || `<span class="muted" style="font-size:13px">لم تُختر أي أشجار بعد. يمكنك اختيارها من القطعة أعلاه، أو إدخال كودها، أو مسح الـ QR.</span>`}
            ${selectedPalmIds.size > 40 ? `<span class="muted" style="font-weight:700">+${selectedPalmIds.size - 40} أخرى</span>` : ''}
          </div>
        </div>

        <div class="bulk-summary-strip">
          <span>🎯 إجمالي الأشجار المحددة: <b>${selectedPalmIds.size}</b> أصل / شجرة</span>
        </div>
      `}
    </div>

    <!-- Section 2: Operation Details -->
    <div class="card" style="margin-top:14px">
      <h3 style="margin-top:0">2) تفاصيل العملية الميدانية</h3>
      
      <div class="grid grid-2" style="margin-bottom:12px">
        <div>
          <label style="font-weight:700">نوع العملية</label>
          <select id="btype" onchange="window.updateBulkLivePreview && window.updateBulkLivePreview()">
            ${types.map(t => `<option value="${t.id}">${cropIcon(t.cropId, 14)} ${t.name}</option>`).join("")}
          </select>
        </div>
        <div>
          <label style="font-weight:700">تاريخ التنفيذ</label>
          <input id="bdate" type="date" value="${new Date().toISOString().slice(0,10)}" />
        </div>
      </div>

      <div id="bmatwrap" class="grid grid-2" style="margin-bottom:12px">
        <div>
          <label data-mlabel style="font-weight:700">المركب / السماد</label>
          <select id="bmat">${materialOptionsHtml([])}</select>
        </div>
        <div>
          <label style="font-weight:700">الجرعة لكل شجرة / أصل</label>
          <div style="display:flex;gap:6px">
            <input id="bdose_qty" type="number" step="any" placeholder="مثال: 0.5" style="flex:2" />
            <select id="bdose_unit" style="flex:1">
              <option value="كجم">كجم</option>
              <option value="جم">جم</option>
              <option value="لتر">لتر</option>
              <option value="شيكارة">شيكارة</option>
            </select>
          </div>
          <input type="hidden" id="bdose" />
        </div>
      </div>

      <div style="margin-bottom:14px">
        <label style="font-weight:700">ملاحظات الميدان</label>
        <textarea id="bnotes" placeholder="سجل أي ملاحظات ميدانية تخص هذه العملية الجماعية..."></textarea>
      </div>

      <div class="bulk-photo-section">
        <label style="font-weight:700;display:block;margin-bottom:6px">📷 صورة ميدانية توثيقية (تُرفق لكل السجلات المستهدفة)</label>
        <input type="file" id="bphoto" data-act="bphoto-change" accept="image/*" capture="environment" style="display:none" />
        <div id="bphoto_dropzone" class="bulk-dropzone ${bulkPhotoData ? 'has-file' : ''}">
          ${bulkPhotoData ? `
            <div class="bulk-photo-preview-wrap">
              <img src="${bulkPhotoData}" alt="معاينة الصورة" class="bulk-photo-thumb" />
              <div class="bulk-photo-info">
                <span class="bulk-photo-name">✅ تم إرفاق صورة ميدانية</span>
                <span class="muted" style="font-size:12px">سيتم ضغطها وتضمينها بالسجلات المنفذة</span>
                <button type="button" class="btn btn-ghost icon-btn" data-act="bphoto-remove" style="color:#dc2626;border-color:#fca5a5;width:fit-content;margin-top:4px">🗑️ حذف الصورة</button>
              </div>
            </div>
          ` : `
            <div class="bulk-dropzone-prompt">
              <div style="font-size:32px;margin-bottom:6px">📸</div>
              <div style="font-weight:700;font-size:14px;color:#1e293b">انقر لالتقاط صورة بالكاميرا أو رفع ملف من الجهاز</div>
              <div class="muted" style="font-size:12px;margin-top:4px">يدعم كاميرا الهاتف الميدانية مباشرة (JPEG, PNG, WebP)</div>
            </div>
          `}
        </div>
      </div>
    </div>

    <!-- Section 3: Bottom Actions -->
    <div class="bulk-bottom-bar">
      <div id="bsum" class="bulk-bottom-summary">
        ${validTargetsCount > 0 ? `سيُطبَّق <b>${escapeHtml(initialOpTypeName)}</b> على <b>${validTargetsCount}</b> شجرة / أصل${breakdownStr}` : 'اضغط «معاينة العدد المستهدف» للتحقق من نطاق التطبيق قبل الاعتماد'}
      </div>
      <div class="bulk-bottom-actions">
        <button type="button" class="btn btn-ghost" data-act="bulk-preview">👁️ معاينة العدد المستهدف</button>
        <button type="button" class="btn btn-primary btn-bulk-apply" data-act="bulk-apply">⚡ تطبيق العملية دفعة واحدة</button>
      </div>
    </div>
  </div>`;
}

window.updateBulkLivePreview = function() {
  const targets = bulkTargetPalms();
  const n = targets.length;
  const pCnt = targets.filter(p => normCropId(p.cropId || "palm") === "palm").length;
  const oCnt = targets.filter(p => normCropId(p.cropId) === "olive").length;
  const breakdown = (pCnt && oCnt) ? ` (${pCnt} نخيل • ${oCnt} زيتون)` : '';
  const typeNameVal = typeName($("#btype")?.value);
  if ($("#bsum")) {
    $("#bsum").innerHTML = `سيُطبَّق <b>${escapeHtml(typeNameVal)}</b> على <b>${n}</b> شجرة / أصل${breakdown}`;
  }
};
function homeView() {
  const st = Store.get();
  const me = session() || {};
  if (me.role === "customer_care") {
    setTimeout(() => go("zakat-admin"), 10);
    return "";
  }
  if (me.role === "investor") {
    setTimeout(() => go("inv-home"), 10);
    return "";
  }
  const canFieldOps = me.role === "worker" || me.role === "engineer" || hasPerm("ops_record");
  const canSeeGis = Boolean(me.role === "admin" || me.role === "super_admin" || me.user === "admin" || hasPerm("gis") || hasPerm("gis_view") || hasPerm("palms") || me.role === "worker");
  const notes = st.notifications.filter(n => n.userId === me.id).slice(-5).reverse();
  const pendingOps = st.operations.filter(o => o.workerId === me.id && o.status !== "synced");
  const dueSchedules = dueSchedulesFor(me);
  const bySec = {};
  pendingOps.forEach(o => {
    const p = palmById(o.palmId);
    const sec = st.plots.find(pl => pl.id === p?.plot)?.sector || "—";
    bySec[sec] = bySec[sec] || [];
    bySec[sec].push(o);
  });
  return `
    <div class="worker-home-wrap" style="max-width:960px;margin:0 auto;padding-bottom:24px">
      ${renderFieldNoteCompleteModal(st)}
      ${renderOpRejectionModal(st)}
      ${canFieldOps ? `
        <!-- Compact Top Network & Sync Status -->
        <div style="display:flex;justify-content:space-between;align-items:center;background:#ffffff;border:1px solid #E2E8F0;border-radius:12px;padding:8px 14px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,0.04)">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#10B981;box-shadow:0 0 5px #10B981"></span>
            <span style="font-weight:700;font-size:12.5px;color:#1E293B">متصل بالشبكة</span>
            <span class="muted" style="font-size:11.5px">• ${pendingOps.length === 0 ? '0 بالانتظار (متزامن)' : `${pendingOps.length} عملية بالانتظار`}</span>
          </div>
          <button class="btn btn-ghost" data-go="queue" style="padding:3px 10px;font-size:11.5px;font-weight:700;color:var(--green);border-color:var(--green-l);border-radius:20px;white-space:nowrap">
            🔄 المزامنة (${pendingOps.length})
          </button>
        </div>
      ` : ''}

      ${me.role === "worker" ? renderWorkerReworkSection(me, st) : ""}
      ${me.role === "worker" ? renderWorkerFieldNotesSection(me, st) : renderEngineerFieldNotesReviewSection(me, st)}

      ${dueSchedules.length ? `
        <div style="margin-bottom:18px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <h3 style="margin:0;display:flex;align-items:center;gap:6px;font-size:15px;color:#0F172A">
              <span>⏰ مهام الرعاية المستحقة</span>
              <span class="badge badge-warn" style="font-size:11.5px;padding:2px 8px;border-radius:10px">${dueSchedules.length} مستحق</span>
            </h3>
            ${hasPerm("ops_schedule_manage") ? `<button class="btn btn-ghost" style="padding:3px 8px;font-size:11.5px" data-go="ops-admin" data-id="schedules">⚙️ الخطط</button>` : ''}
          </div>
          
          <!-- Responsive Balanced Grid for Schedule Cards -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:12px">
            ${dueSchedules.map(s => {
              const titleLower = (s.title + " " + (s.opName || "") + " " + (typeName(s.opTypeId) || "")).toLowerCase();
              let borderColor = "#16a34a";
              let opIcon = "🌱";
              let opTypeBadge = "تسميد وتغذية";
              if (titleLower.includes("ري") || titleLower.includes("سقيا")) {
                borderColor = "#0284c7";
                opIcon = "💧";
                opTypeBadge = "ري وتغذية صيفية";
              } else if (titleLower.includes("مكافحة") || titleLower.includes("سوسة") || titleLower.includes("رش") || titleLower.includes("وقاية")) {
                borderColor = "#dc2626";
                opIcon = "🛡️";
                opTypeBadge = "مكافحة ووقاية";
              } else if (titleLower.includes("تقليم") || titleLower.includes("تكريب") || titleLower.includes("خف")) {
                borderColor = "#d97706";
                opIcon = "✂️";
                opTypeBadge = "تقليم وتكريب";
              } else if (titleLower.includes("تلقيح")) {
                borderColor = "#8b5cf6";
                opIcon = "🌸";
                opTypeBadge = "تلقيح موسمي";
              }

              const isUrgent = s.priority === "urgent";
              const isHigh = s.priority === "high";
              const prioText = isUrgent ? "🔴 أولوية قصوى" : isHigh ? "⚠️ أولوية مرتفعة" : "دوري اعتيادي";
              const prioBg = isUrgent ? "#FEE2E2" : isHigh ? "#FEF3C7" : "#E0F2FE";
              const prioColor = isUrgent ? "#DC2626" : isHigh ? "#D97706" : "#0369A1";
              const scopeText = (s.plotIds && s.plotIds.length > 1) ? `قطاع ${s.sectorId ? sectorName(s.sectorId) : ''} • قطع: ${s.plotIds.map(p => plotName(p)).join(", ")}` : (s.plotId && s.plotId !== "all") ? `${plotName(s.plotId)}` : s.sectorId && s.sectorId !== "all" ? `قطاع ${sectorName(s.sectorId)}` : "كافة الحقل";

              return `
                <div style="background:#ffffff;border-radius:12px;box-shadow:0 2px 4px rgba(0,0,0,0.04);border:1px solid #E2E8F0;border-right:5px solid ${borderColor};padding:14px;display:flex;flex-direction:column;justify-content:space-between">
                  <div>
                    <!-- Header: Type Badge & Priority Tag -->
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:8px">
                      <div style="display:flex;align-items:center;gap:6px">
                        <span style="font-size:16px">${opIcon}</span>
                        <b style="font-size:13.5px;color:#0F172A">${s.title}</b>
                      </div>
                      <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:12px;background:${prioBg};color:${prioColor}">
                        ${prioText}
                      </span>
                    </div>

                    <!-- Subheader: Location & Frequency Chips -->
                    <div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:8px">
                      <span style="background:#F1F5F9;color:#334155;padding:3px 8px;border-radius:6px;font-size:11.5px;font-weight:700">
                        📍 ${scopeText}
                      </span>
                      <span style="background:#F8FAFC;color:#64748B;border:1px solid #E2E8F0;padding:2px 6px;border-radius:6px;font-size:11px;font-weight:600">
                        🔄 كل ${s.intervalDays} يوم
                      </span>
                    </div>

                    <!-- Dosage / Material Block -->
                    ${s.materialName ? `
                      <div style="background:#F8FAFC;border:1px dashed #CBD5E1;border-radius:6px;padding:6px 10px;margin-bottom:8px;font-size:12px;color:#1E293B">
                        🧪 <b>المادة:</b> <span style="font-weight:700;color:var(--green-d)">${s.materialName}</span>
                        ${s.recommendedDose ? `<span style="color:#64748B;margin-right:4px">(${s.recommendedDose})</span>` : ''}
                      </div>
                    ` : ''}

                    <!-- Instructions Block -->
                    ${s.instructions ? `
                      <div style="background:#F8FAFC;border-radius:6px;padding:6px 10px;margin-bottom:10px;font-size:11.5px;color:#475569;line-height:1.4">
                        📝 ${s.instructions}
                      </div>
                    ` : ''}
                  </div>

                  <!-- Actions Row: Side-by-Side Ergonomic Buttons -->
                  <div style="display:flex;gap:8px;align-items:center;margin-top:4px">
                    <button class="btn btn-primary" style="flex:1;min-height:38px;height:auto;padding:6px 10px;font-size:12px;font-weight:700;border-radius:8px;display:flex;justify-content:center;align-items:center;gap:6px;white-space:nowrap" data-act="exec-schedule" data-id="${s.id}">
                      <span>⚡ تنفيذ وتوثيق</span>
                    </button>
                    <button class="btn btn-ghost" style="height:40px;padding:0 12px;font-size:11.5px;font-weight:700;border-radius:8px;color:#475569;background:#F8FAFC;border:1px solid #CBD5E1;white-space:nowrap" data-act="mark-sch-done" data-id="${s.id}" title="تم الإنجاز دورياً">
                      ✓ إنجاز سريع
                    </button>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      ` : ''}

      ${Object.keys(bySec).map(sec => `
        <div class="card" style="margin-bottom:10px;border-radius:12px">
          <h3 style="font-size:14px;margin-bottom:8px">${sectorName(sec)}</h3>
          ${bySec[sec].map(o => {
            const p = palmById(o.palmId);
            return `<div class="list-item" data-go="qitem" data-id="${o.id}" style="cursor:pointer;padding:8px 12px">
              <div>${typeName(o.typeId)} ${codeHtml(p?.code)}<div class="muted" style="font-size:11px">${fmtDate(o.at)}</div></div>
              <span class="status st-wait" style="font-size:11px">انتظار</span>
            </div>`;
          }).join("")}
        </div>`).join("")}

      ${canFieldOps ? `
        <!-- Quick Action Dock -->
        <div class="grid ${canSeeGis ? 'grid-3' : 'grid-2'}" style="margin:14px 0 10px;gap:10px">
          <button class="big-action" data-go="scan" style="height:50px;font-size:13.5px;font-weight:800;border-radius:12px;display:flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 2px 4px rgba(0,0,0,0.05)">
            <span style="font-size:18px">📷</span> مسح / اختيار نخلة
          </button>
          <button class="big-action" data-go="bulk-op" style="height:50px;font-size:13.5px;font-weight:800;border-radius:12px;display:flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 2px 4px rgba(0,0,0,0.05)">
            <span style="font-size:18px">👥</span> عملية جماعية
          </button>
          ${canSeeGis ? `
          <button class="big-action" data-go="gis" style="height:50px;font-size:13.5px;font-weight:800;border-radius:12px;display:flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 2px 4px rgba(0,0,0,0.05);background:#F0FDF4;border:1.5px solid #86EFAC;color:#166534">
            <span style="font-size:18px">🗺️</span> الخريطة الميدانية
          </button>
          ` : ''}
          <button class="big-action" data-go="ai-hub" data-id="voice-copilot" style="height:48px;font-size:13.5px;font-weight:800;border-radius:12px;display:flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 2px 4px rgba(0,0,0,0.05);background:linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%);border:1.5px solid #818CF8;color:#3730A3;grid-column:1 / -1">
            <span style="font-size:18px">🎙️</span> ✨ المساعد الصوتي والذكي الميداني (تسجيل فوري بدون إنترنت)
          </button>
        </div>
      ` : ''}
      ${notes.length ? `<div class="card" style="margin-top:12px;border-radius:12px"><h3 style="font-size:14px">إشعارات المشرف</h3>${notes.map(n=>`<div class="list-item" style="padding:8px 12px"><div>${n.text}<div class="muted" style="font-size:11px">${fmtDate(n.at)}</div></div></div>`).join("")}</div>` : ""}
    </div>
  `;
}

function normCode(c) {
  return String(c || "").toUpperCase().replace(/[\s\-_]/g, "");
}
function codesEqual(a, b) {
  const x = normCode(a), y = normCode(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.includes(y) || y.includes(x)) return true;
  const rx = x.replace(/^([FN])(\d{2}[0-9]+[A-Z])(\d+)/, "$2$1$3");
  const ry = y.replace(/^([FN])(\d{2}[0-9]+[A-Z])(\d+)/, "$2$1$3");
  return rx === ry || rx.includes(ry) || ry.includes(rx);
}

let _palmCacheMap = null;
let _palmCachePalmsRef = null;
function getPalmMap(palms) {
  if (_palmCacheMap && _palmCachePalmsRef === palms) return _palmCacheMap;
  const m = new Map();
  for (let i = 0; i < palms.length; i++) {
    const p = palms[i];
    if (p.id !== undefined && p.id !== null) {
      m.set(String(p.id), p);
      m.set(Number(p.id), p);
    }
    if (p.code) {
      m.set(p.code, p);
      const nc = normCode(p.code);
      if (!m.has(nc)) m.set(nc, p);
    }
  }
  _palmCacheMap = m;
  _palmCachePalmsRef = palms;
  return m;
}

function findPalm(ref) {
  if (ref === null || ref === undefined || ref === "") return null;
  const st = Store.get();
  const palms = st.palms || [];
  const map = getPalmMap(palms);
  const sRef = String(ref).trim();

  // 1. المطابقة السريعة O(1)
  let found = map.get(sRef) || map.get(ref);
  if (found) return found;

  const nRef = normCode(sRef);
  found = map.get(nRef);
  if (found) return found;

  // 2. مطابقة المعرفات القديمة مثل p1 عند ترقيتها لرقم 1
  if (/^p\d+$/i.test(sRef)) {
    const num = sRef.replace(/^p/i, "");
    found = map.get(num);
    if (found) return found;
  }

  return null;
}
function palmOpenBtn(p) {
  const u = session();
  const allowedWorkPlots = getActiveRoleWorkPlots(u);
  const isWorkRestricted = (u?.role === "engineer" || u?.role === "worker") && allowedWorkPlots.length > 0;
  const canOp = hasPerm("ops_record") && (!isWorkRestricted || allowedWorkPlots.includes(p.plot));
  return `<div style="display:flex;gap:6px;align-items:center">
    ${canOp ? `<button class="btn btn-primary" style="width:auto;min-width:76px;padding:8px 12px;font-size:13px" data-act="go-op" data-id="${p.id}">+ عملية</button>` : ''}
    <button class="btn btn-ghost" style="width:auto;min-width:64px;padding:8px 10px;font-size:13px" data-act="open-palm" data-id="${p.id}">فتح</button>
  </div>`;
}

let scanTab = "scan";
let scanSec = null;
let scanPlotGroup = null;
let scanPlot = null;
let scanCrop = "";
let scanPage = 1;
let scanQ = "";
let scanRecentFilter = "all";

function scanView(extra) {
  if (extra && ["scan", "browse", "recent"].includes(extra)) {
    scanTab = extra;
  } else if (extra === "rework") {
    scanTab = "recent";
    scanRecentFilter = "rework";
  }
  const st = Store.get();
  const me = session() || {};
  if (!hasPerm("ops_record") && me.role !== "worker" && me.role !== "engineer") {
    return `<div class="card" style="text-align:center;padding:24px">
      <h3>⚠️ غير مصرح</h3>
      <p class="muted">ليس لديك صلاحية الوصول لشاشة مسح الأشجار أو تشغيل الكاميرا الميدانية.</p>
      <button class="btn btn-primary" data-act="back" style="margin-top:10px">رجوع</button>
    </div>`;
  }
  const isWorker = me.role === "worker";
  const crops = (st.crops || []).filter(c => c.active);

  // Filter allowed plots based on role
  const allowedPlots = isWorker ? st.plots.filter(p => (me.plots || []).includes(p.id)) : st.plots;
  const allowedPlotIds = new Set(allowedPlots.map(p => p.id));

  // Total allowed active trees
  const allAllowedTrees = st.palms.filter(p => !p.archived && allowedPlotIds.has(p.plot) && workerAllowed(p.plot, p.id));
  const filteredAllowedTrees = scanCrop ? allAllowedTrees.filter(p => (p.cropId || "palm") === scanCrop) : allAllowedTrees;

  // Counts by crop
  const cropCounts = {};
  allAllowedTrees.forEach(p => {
    const cid = p.cropId || "palm";
    cropCounts[cid] = (cropCounts[cid] || 0) + 1;
  });

  // Top header and mode switcher
  const headerHtml = `
    <div class="page-head" style="margin-bottom:8px">
      <div>
        <h3 style="margin:0">اختيار الشجرة وبدء العملية</h3>
        <div class="muted" style="font-size:12px">تصفح هرمي ذكي • مسح فوري بالباركود • كفاءة فائقة مع مئات الآلاف من الأشجار</div>
      </div>
      <div class="actions" style="margin:0">
        <button class="btn btn-primary icon-btn" data-act="start-scan">📷 تشغيل الكاميرا</button>
      </div>
    </div>

    <!-- Multi-crop filter tabs -->
    <div class="ptabs" style="margin:4px 0 10px 0">
      <button class="${!scanCrop ? 'on' : ''}" data-act="scan-crop" data-id="">🌐 كل المحاصيل (${allAllowedTrees.length})</button>
      ${crops.map(c => {
        const cnt = cropCounts[c.id] || 0;
        return `<button class="${scanCrop === c.id ? 'on' : ''}" data-act="scan-crop" data-id="${c.id}">${cropIcon(c.id, 15)} ${c.name} (${cnt})</button>`;
      }).join("")}
    </div>

    <!-- Mode tabs -->
    <div class="actions" style="margin-bottom:12px">
      <button class="btn ${scanTab === 'scan' ? 'btn-primary' : 'btn-ghost'}" style="width:auto;flex:1" data-act="scan-tab" data-id="scan">📷 مسح وبحث بالكود</button>
      <button class="btn ${scanTab === 'browse' ? 'btn-primary' : 'btn-ghost'}" style="width:auto;flex:1" data-act="scan-tab" data-id="browse">🧭 تصفح القطاعات والقطع</button>
      <button class="btn ${scanTab === 'recent' ? 'btn-primary' : 'btn-ghost'}" style="width:auto;flex:1" data-act="scan-tab" data-id="recent">🕒 سجل عملياتي ${workerReworkCount() ? `<span class="badge" style="background:#EA580C;color:#fff;font-size:11px;font-weight:800;padding:1px 6px;border-radius:10px;margin-right:4px">${workerReworkCount()}</span>` : ''}</button>
    </div>
  `;

  // QR Modal (used by camera)
  const qrModalHtml = `
    <div id="scanModal" class="scan-modal hidden">
      <div class="scan-box" style="position:relative;background:#0F172A;border-radius:20px;padding:16px;color:#fff;max-width:380px;width:90%;box-shadow:0 20px 25px -5px rgba(0,0,0,0.5)">
        <div style="font-weight:800;margin-bottom:8px;font-size:15px;display:flex;justify-content:space-between;align-items:center">
          <span>📷 ماسح الباركود و QR الميداني</span>
          <button class="btn btn-ghost btn-sm" data-act="stop-scan" style="color:#fff;border-color:rgba(255,255,255,0.3);padding:2px 8px;font-size:14px">✕</button>
        </div>
        <video id="scanVid" playsinline style="width:100%;border-radius:12px;max-height:220px;object-fit:cover;background:#000"></video>
        <div class="scan-frame"></div>
        <p class="muted" style="margin:8px 0 6px;font-size:12px;color:#94A3B8;text-align:center">وجّه الكاميرا لباركود الشجرة (QR / Code 128)</p>
        <div style="display:flex;gap:6px;width:100%;margin-top:4px">
          <input id="modalScanInput" placeholder="أو اكتب الكود يدوياً (مثال: 03-12A-F001)..." style="flex:1;padding:8px 12px;font-size:13px;border-radius:8px;border:1px solid #334155;background:#1E293B;color:#fff" />
          <button class="btn btn-primary" data-act="modal-apply-code" style="width:auto;padding:8px 14px;white-space:nowrap;font-weight:700">انتقال للشجرة</button>
        </div>
        <div style="margin-top:10px;text-align:center">
          <button class="btn btn-ghost" data-act="stop-scan" style="color:#CBD5E1;border-color:#475569;font-size:12px;padding:5px 14px">إغلاق النافذة</button>
        </div>
      </div>
    </div>
  `;

  // MODE 1: Scan & Instant Match
  if (scanTab === "scan") {
    const qTrim = (scanQ || "").trim();
    let directMatch = null;
    let queryHits = [];

    if (qTrim) {
      const qUpper = qTrim.toUpperCase();
      const qClean = normCode(qTrim);
      directMatch = filteredAllowedTrees.find(p => codesEqual(p.code, qTrim) || p.code.toUpperCase() === qUpper || normCode(p.code) === qClean);
      queryHits = filteredAllowedTrees.filter(p => {
        const pClean = normCode(p.code);
        return codesEqual(p.code, qTrim) ||
          p.code.toUpperCase().includes(qUpper) ||
          (pClean && qClean && (pClean.includes(qClean) || qClean.includes(pClean))) ||
          (p.variety || "").toUpperCase().includes(qUpper) ||
          (p.plot || "").toUpperCase().includes(qUpper) ||
          String(p.seq || "").includes(qTrim);
      });
    }

    const pageSize = 15;
    const totalHits = queryHits.length;
    const startIdx = (scanPage - 1) * pageSize;
    const pageHits = queryHits.slice(startIdx, startIdx + pageSize);

    return `${headerHtml}
    ${qrModalHtml}
    <div class="card" style="margin-bottom:12px">
      <div style="font-weight:700;margin-bottom:8px;font-size:15px">البحث الفوري والمسح</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <input id="scan_quick_q" value="${scanQ}" placeholder="اكتب أو امسح الكود (مثال: 03-12A-F045 أو 045 أو خلاص)..." style="flex:1;min-width:200px" />
        <button class="btn btn-primary" data-act="scan-do-search" style="width:auto">بحث</button>
        ${scanQ ? `<button class="btn btn-ghost" data-act="scan-clear-q" style="width:auto">مسح ✕</button>` : ""}
        <button class="btn btn-ghost" data-act="start-scan" style="width:auto">📷 تشغيل الكاميرا</button>
      </div>
      <div class="muted" style="font-size:11px;margin-top:6px">
        💡 مئات الآلاف من الأشجار مفهرسة ومحمية: يتم استرجاع النتائج فورا بحد أقصى ${pageSize} نتيجة في الصفحة لتفادي أي ثقل.
      </div>
    </div>

    <!-- Direct match highlight card if found -->
    ${directMatch ? `
      <div class="card" style="border:2px solid var(--green);background:var(--green-l);margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
          <div>
            <span class="status badge-ok" style="font-size:11px">✓ تطابق مباشر دقيق</span>
            <div style="margin-top:4px">${codeHtml(directMatch.code)} ${palmBadge(directMatch)}</div>
            <div class="muted" style="margin-top:4px;font-size:13px">
              ${cropIcon(directMatch.cropId||"palm", 14)} <b>${directMatch.variety}</b> • ${plotName(directMatch.plot)} • عمر الحقل: ${monthsSince(directMatch.plantDate)} شهر
            </div>
          </div>
          <div style="display:flex;gap:8px">
            ${hasPerm("ops_record") ? `<button class="btn btn-primary" style="width:auto;padding:10px 18px" data-act="go-op" data-id="${directMatch.id}">+ تسجيل عملية فوراً</button>` : ''}
            <button class="btn btn-ghost" style="width:auto;padding:10px 14px" data-act="open-palm" data-id="${directMatch.id}">فتح البطاقة</button>
          </div>
        </div>
      </div>
    ` : ""}

    <!-- Query Hits List if search performed -->
    ${qTrim ? `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <b>نتائج البحث (${totalHits} شجرة مطابقة)</b>
          <span class="muted" style="font-size:12px">عرض ${totalHits ? startIdx + 1 : 0}-${Math.min(startIdx + pageSize, totalHits)} من ${totalHits}</span>
        </div>
        ${pageHits.length ? pageHits.map(p => {
          const last = lastOp(p.id, () => true);
          return `<div class="list-item" style="padding:10px 4px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
            <div>
              <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                ${codeHtml(p.code, p.id)}
                ${palmBadge(p)}
                <span class="muted clickable-palm-variety" style="font-size:12.5px;cursor:pointer;display:inline-flex;align-items:center;gap:3px" data-act="open-palm" data-id="${p.id}" title="اضغط لفتح بطاقة وتفاصيل الشجرة">${cropIcon(p.cropId||"palm", 13)} <b style="color:#1E293B">${p.variety}</b></span>
              </div>
              <div class="muted" style="font-size:12px;margin-top:4px">
                ${plotName(p.plot)} ${last ? " • آخر عملية: " + typeName(last.typeId) + " (" + fmtDate(last.at) + ")" : ""}
              </div>
            </div>
            ${palmOpenBtn(p)}
          </div>`;
        }).join("") : `<div class="muted" style="padding:12px;text-align:center">لا توجد أشجار مطابقة لبحثك ضمن نطاقك المصرح</div>`}
        ${pager(totalHits, scanPage, "scan-page")}
      </div>
    ` : `
      <!-- Quick Plots Grid for Easy Tap Access without typing -->
      <div class="card" style="margin-top:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <b style="font-size:14px">🌱 قطعك المسندة بالقطاع (${allowedPlots.length} قطعة)</b>
          <span class="muted" style="font-size:12px">انقر على أي قطعة لاختيار الشجرة وبدء العملية</span>
        </div>
        <div class="grid grid-3" style="gap:8px">
          ${allowedPlots.slice(0, 18).map(pl => {
            const cnt = allAllowedTrees.filter(p => p.plot === pl.id).length;
            return `<div class="card tile" data-act="scan-pick-quick-plot" data-id="${pl.id}" style="cursor:pointer;padding:10px;border-right:3px solid var(--green);margin:0;background:#ffffff;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
              <div style="font-weight:800;font-size:13px;color:#0F172A">${pl.name || pl.id}</div>
              <div class="muted" style="font-size:11px;margin-top:2px">${sectorName(pl.sector)} • <b style="color:var(--green)">${cnt}</b> أصل</div>
            </div>`;
          }).join("")}
        </div>
        ${allowedPlots.length > 18 ? `
          <div style="text-align:center;margin-top:10px">
            <button class="btn btn-ghost" data-act="scan-tab" data-id="browse" style="font-size:12px">استعراض كافة القطع (${allowedPlots.length}) ◀</button>
          </div>
        ` : ''}
      </div>

      <!-- Collapsible Quick Cascading Select -->
      <details class="card" style="margin-top:10px">
        <summary style="cursor:pointer;font-weight:700">▼ خيارات إضافية: اختيار يدوي بالقوائم المنسدلة (قطاع ◀ قطعة ◀ شجرة)</summary>
        <div style="margin-top:10px">
          <label>1) القطاع</label>
          <select id="ssec"><option value="">— اختر القطاع —</option>${[...new Set(allowedPlots.map(p=>p.sector))].map(s=>`<option value="${s}">${sectorName(s)}</option>`)}</select>
          <div id="plotWrap" class="hidden" style="margin-top:8px">
            <label>2) القطعة</label>
            <select id="splot"><option value="">— اختر القطعة —</option></select>
          </div>
          <div id="palmWrap" class="hidden" style="margin-top:8px">
            <label>3) الشجرة / الأصل</label>
            <select id="spalm"><option value="">— اختر الشجرة —</option></select>
            <button class="btn btn-primary" data-act="open-sel-palm" style="margin-top:10px">فتح الشجرة وإضافة عملية</button>
          </div>
        </div>
      </details>
    `}`;
  }

  // MODE 2: Hierarchical Field Drill-Down
  if (scanTab === "browse") {
    // LEVEL 1: Sectors (no sector selected)
    if (!scanSec) {
      const secIds = [...new Set(allowedPlots.map(p => p.sector))];
      return `${headerHtml}
      ${qrModalHtml}
      <div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
        <b>قطاعات عملك الميداني (${secIds.length} قطاع)</b>
        <span class="muted" style="font-size:12px">اضغط على القطاع لاستعراض قطعه المجمعة A/B</span>
      </div>
      <div class="grid grid-3">${secIds.map(secId => {
        const sPlots = allowedPlots.filter(p => p.sector === secId);
        const groupMap = {};
        sPlots.forEach(p => {
          const b = plotBaseNumber(p);
          groupMap[b] = groupMap[b] || [];
          groupMap[b].push(p);
        });
        const groupCount = Object.keys(groupMap).length;

        let secTrees = (_s => filteredAllowedTrees.filter(p => _s.has(p.plot)))(new Set(sPlots.map(pl => pl.id)));
        const byCrop = {};
        secTrees.forEach(p => {
          const c = cropOf(p);
          const cid = c.id || "palm";
          byCrop[cid] = (byCrop[cid] || 0) + 1;
        });
        const cropBadges = Object.keys(byCrop).map(cid => {
          const c = findCrop(cid) || { name: cid, single: "أصل", id: cid };
          return `<span>${cropIcon(c.id, 14)} <b>${byCrop[cid]}</b> ${c.name}</span>`;
        }).join(" • ");

        return `<div class="card tile" data-act="scan-sec" data-id="${secId}" style="cursor:pointer;border-right:4px solid var(--green)">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <b style="font-size:16px">${sectorName(secId)}</b>
            <div style="display:flex;gap:4px">${Object.keys(byCrop).map(cid => cropIcon(cid, 16)).join(" ")}</div>
          </div>
          <div class="muted" style="margin-top:6px;font-size:12px;line-height:1.6">
            📁 <b>${groupCount}</b> قطع مجمعة (${sPlots.length} قطعة فرعية)<br>
            ${cropBadges || `<span class="muted">لا توجد أشجار مسجلة</span>`}
            <div style="margin-top:6px;font-weight:700;color:var(--green)">${secTrees.length} أصل ◀ اضغط للاستعراض</div>
          </div>
        </div>`;
      }).join("")}</div>`;
    }

    // LEVEL 2: Sector selected, no plot group selected
    if (scanSec && !scanPlotGroup) {
      const sPlots = allowedPlots.filter(p => p.sector === scanSec);
      const groupMap = {};
      sPlots.forEach(p => {
        const b = plotBaseNumber(p);
        groupMap[b] = groupMap[b] || [];
        groupMap[b].push(p);
      });

      return `${headerHtml}
      ${qrModalHtml}
      <div style="margin-bottom:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button class="btn btn-ghost" style="width:auto;padding:4px 10px;font-size:12px" data-act="scan-browse-home">🌐 كافة القطاعات</button>
        <span>◀</span>
        <span class="chip" style="font-size:12px;font-weight:700;background:var(--green-l);color:var(--green-d)">📂 ${sectorName(scanSec)}</span>
        <span class="muted" style="font-size:12px;margin-right:auto">القطع مجمعة (A/B). اضغط لعرض القطع الداخلية وأشجارها.</span>
      </div>
      <div class="grid-plots-5">${Object.keys(groupMap).map(baseNo => {
        const subPlots = groupMap[baseNo];
        let grpTrees = (_s => filteredAllowedTrees.filter(p => _s.has(p.plot)))(new Set(subPlots.map(pl => pl.id)));
        const byCrop = {};
        grpTrees.forEach(p => {
          const c = cropOf(p);
          const cid = c.id || "palm";
          byCrop[cid] = (byCrop[cid] || 0) + 1;
        });
        const cropBadges = Object.keys(byCrop).map(cid => {
          const c = findCrop(cid);
          return `<span>${cropIcon(cid, 14)} <b>${byCrop[cid]}</b> ${c.name}</span>`;
        }).join(" • ");

        const subBadges = subPlots.map(pl => {
          const cnt = grpTrees.filter(p => p.plot === pl.id).length;
          return `<span class="chip" style="font-size:11px">قطعة ${pl.part || pl.name || pl.id} (${cnt})</span>`;
        }).join(" ");

        return `<div class="card tile" data-act="scan-group" data-id="${baseNo}" style="cursor:pointer;border-right:4px solid var(--orange)">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <b style="font-size:16px">القطعة ${baseNo}</b>
            <div style="display:flex;gap:4px">${Object.keys(byCrop).map(cid => cropIcon(cid, 15)).join(" ")}</div>
          </div>
          <div class="muted" style="margin-top:6px;font-size:12px;line-height:1.6">
            <div style="margin-bottom:4px">القطع التابعة: ${subBadges}</div>
            ${cropBadges || `<span class="muted">لا توجد أصول</span>`}<br>
            <div style="margin-top:6px;font-weight:700;color:var(--green)">${grpTrees.length} أصل ◀ اضغط للاستعراض</div>
          </div>
        </div>`;
      }).join("")}</div>`;
    }

    // LEVEL 3: Plot group selected or specific plot selected
    const sPlots = allowedPlots.filter(p => p.sector === scanSec && plotBaseNumber(p) === scanPlotGroup);
    let plotTrees = filteredAllowedTrees.filter(p => {
      if (scanPlot) return p.plot === scanPlot;
      return sPlots.some(pl => pl.id === p.plot);
    });

    // Sub-filter inside plot if searched
    if (scanQ) {
      const qUpper = scanQ.toUpperCase();
      plotTrees = plotTrees.filter(p => {
        return codesEqual(p.code, scanQ) ||
          p.code.toUpperCase().includes(qUpper) ||
          (p.variety || "").toUpperCase().includes(qUpper) ||
          String(p.seq || "").includes(scanQ);
      });
    }

    const pageSize = 20;
    const totalTrees = plotTrees.length;
    const startIdx = (scanPage - 1) * pageSize;
    const pageTrees = plotTrees.slice(startIdx, startIdx + pageSize);

    const subTabs = sPlots.length > 1 ? `
      <div class="ptabs" style="margin-bottom:10px">
        <button class="${!scanPlot ? 'on' : ''}" data-act="scan-plot" data-id="">🌐 كافة القطع الداخلية (${sPlots.map(p => p.part || p.id).join(" + ")})</button>
        ${sPlots.map(pl => {
          const cnt = filteredAllowedTrees.filter(p => p.plot === pl.id).length;
          return `<button class="${scanPlot === pl.id ? 'on' : ''}" data-act="scan-plot" data-id="${pl.id}">🏷️ القطعة ${pl.part || pl.name || pl.id} (${cnt} أصل)</button>`;
        }).join("")}
      </div>
    ` : "";

    return `${headerHtml}
    ${qrModalHtml}
    <div style="margin-bottom:10px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">
      <button class="btn btn-ghost" style="width:auto;padding:4px 10px;font-size:12px" data-act="scan-browse-home">🌐 كافة القطاعات</button>
      <span>◀</span>
      <button class="btn btn-ghost" style="width:auto;padding:4px 10px;font-size:12px" data-act="scan-browse-sec">📂 ${sectorName(scanSec)}</button>
      <span>◀</span>
      <span class="chip" style="font-size:12px;font-weight:700;background:var(--green-l);color:var(--green-d)">القطعة ${scanPlotGroup}</span>
    </div>
    ${subTabs}
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
        <div>
          <b>أشجار القطعة ${scanPlotGroup} ${scanPlot ? `(القطعة الفرعية ${plotName(scanPlot)})` : ""}</b>
          <div class="muted" style="font-size:12px">إجمالي: ${totalTrees} أصل • عرض ${totalTrees ? startIdx + 1 : 0}-${Math.min(startIdx + pageSize, totalTrees)}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <input id="scan_plot_q" value="${scanQ}" placeholder="تصفية داخل القطعة..." style="max-width:200px" />
          <button class="btn btn-ghost icon-btn" data-act="scan-do-search">تصفية</button>
          ${scanQ ? `<button class="btn btn-ghost icon-btn" data-act="scan-clear-q">✕</button>` : ""}
        </div>
      </div>
      <div class="list-wrap">
        ${pageTrees.length ? pageTrees.map(p => {
          const last = lastOp(p.id, () => true);
          return `<div class="list-item" style="padding:10px 4px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
            <div>
              <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                ${codeHtml(p.code, p.id)}
                ${palmBadge(p)}
                <span class="muted clickable-palm-variety" style="font-size:12.5px;cursor:pointer;display:inline-flex;align-items:center;gap:3px" data-act="open-palm" data-id="${p.id}" title="اضغط لفتح بطاقة وتفاصيل الشجرة">${cropIcon(p.cropId||"palm", 13)} <b style="color:#1E293B">${p.variety}</b></span>
              </div>
              <div class="muted" style="font-size:12px;margin-top:4px">
                القطعة: <b>${p.plot}</b> • عمر الحقل: ${monthsSince(p.plantDate)} شهر ${last ? " • آخر عملية: " + typeName(last.typeId) + " (" + fmtDate(last.at) + ")" : ""}
              </div>
            </div>
            ${palmOpenBtn(p)}
          </div>`;
        }).join("") : `<div class="muted" style="padding:16px;text-align:center">لا توجد أشجار في هذه القطعة مطابقة للتصفية</div>`}
      </div>
      ${pager(totalTrees, scanPage, "scan-page")}
    </div>`;
  }

  // MODE 3: Recent & Active Trees + Worker Rework
  if (scanTab === "recent") {
    const reworkOps = (st.operations || []).filter(o => (isWorker ? o.workerId === me.id : true) && (o.approval === "needs_rework" || o.approval === "rework"))
      .sort((a, b) => new Date(b.rejectedAt || b.at) - new Date(a.rejectedAt || a.at));

    // Find last 15 distinct trees operated on by the current worker/team
    const ops = (st.operations || []).filter(o => isWorker ? o.workerId === me.id : true)
      .sort((a, b) => new Date(b.at) - new Date(a.at));

    const recentTreeIds = [];
    const seen = new Set();
    for (const o of ops) {
      if (!seen.has(o.palmId)) {
        seen.add(o.palmId);
        recentTreeIds.push(o.palmId);
        if (recentTreeIds.length >= 15) break;
      }
    }

    let recentTrees = recentTreeIds.map(id => st.palms.find(p => p.id === id && !p.archived && allowedPlotIds.has(p.plot))).filter(Boolean);
    if (scanCrop) recentTrees = recentTrees.filter(p => (p.cropId || "palm") === scanCrop);

    // Fallback if worker has no operations yet
    if (!recentTrees.length) {
      recentTrees = filteredAllowedTrees.slice(0, 10);
    }

    const isReworkTab = scanRecentFilter === "rework";

    return `${headerHtml}
    ${qrModalHtml}
    <div class="card">
      <!-- Sub-tabs within recent operations -->
      <div style="display:flex;gap:8px;margin-bottom:14px;border-bottom:1px solid #E2E8F0;padding-bottom:10px;flex-wrap:wrap">
        <button class="btn ${!isReworkTab ? 'btn-primary' : 'btn-ghost'}" style="width:auto;padding:6px 14px;font-size:13px;border-radius:20px" data-act="scan-recent-filter" data-id="all">
          📋 أحدث الأشجار والعمليات (${recentTrees.length})
        </button>
        <button class="btn ${isReworkTab ? 'btn-primary' : 'btn-ghost'}" style="width:auto;padding:6px 14px;font-size:13px;border-radius:20px;${reworkOps.length ? 'background:#FFF7ED;border-color:#FDBA74;color:#C2410C;font-weight:700' : ''}" data-act="scan-recent-filter" data-id="rework">
          ⚠️ مطلوب إعادة العمل (${reworkOps.length})
        </button>
      </div>

      ${isReworkTab ? `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div>
            <b style="font-size:15px;color:#C2410C">عمليات تحتاج مراجعة وإعادة عمل ميداني</b>
            <div class="muted" style="font-size:12px">عمليات رفضها المهندس المشرف مع توجيهات محددة لإعادة التنفيذ</div>
          </div>
          <span class="badge" style="background:#EA580C;color:#fff;font-weight:800;font-size:11px;padding:3px 8px;border-radius:12px">${reworkOps.length} مستحق</span>
        </div>
        ${!reworkOps.length ? `
          <div class="muted" style="padding:28px 16px;text-align:center">
            🎉 لا توجد عمليات مطلوبة لإعادة التنفيذ حالياً. جميع عملياتك معتمدة أو قيد التدقيق!
          </div>
        ` : `
          <div style="display:flex;flex-direction:column;gap:10px">
            ${reworkOps.map(o => {
              const p = palmById(o.palmId);
              return `
                <div style="background:#ffffff;border:1px solid #FED7AA;border-right:4px solid #EA580C;border-radius:10px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
                  <div style="flex:1;min-width:220px">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">
                      ${p ? codeHtml(p.code, p.id) : '<span class="muted">—</span>'}
                      <span style="font-weight:800;font-size:13.5px;color:#1E293B">${typeName(o.typeId)}</span>
                      ${p ? `<span style="font-size:11.5px;color:#64748B">(${p.variety || '—'} • قطعة ${plotName(p.plot)})</span>` : ''}
                    </div>
                    ${o.supervisorNote ? `
                      <div style="font-size:12px;background:#FEF3C7;color:#92400E;padding:6px 10px;border-radius:6px;border:1px solid #FDE68A;margin-top:4px;line-height:1.5">
                        <b>📝 توجيه المشرف / سبب الرفض:</b> ${escapeHtml(o.supervisorNote)}
                      </div>
                    ` : `
                      <div style="font-size:11.5px;color:#9A3412">يرجى مراجعة المعايير الفنية للعملية وإعادة التنفيذ والتوثيق</div>
                    `}
                    <div style="font-size:10.5px;color:#94A3B8;margin-top:6px">تاريخ الطلب: ${fmtDateTime(o.rejectedAt || o.at)}</div>
                  </div>
                  <div style="display:flex;gap:6px;align-items:center">
                    ${p ? palmOpenBtn(p) : ''}
                    <button type="button" class="btn btn-primary" data-act="rework-op" data-id="${o.id}" style="width:auto;background:#EA580C;border-color:#EA580C;font-weight:800;font-size:12px;padding:7px 14px;border-radius:8px;cursor:pointer;white-space:nowrap;box-shadow:0 2px 6px rgba(234,88,12,0.25)">
                      🔄 إعادة التنفيذ
                    </button>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        `}
      ` : `
        ${reworkOps.length ? `
          <div style="display:flex;justify-content:space-between;align-items:center;background:#FFF7ED;border:1px solid #FED7AA;border-radius:8px;padding:8px 12px;margin-bottom:12px">
            <span style="font-size:12.5px;color:#9A3412;font-weight:700">⚠️ لديك ${reworkOps.length} عملية يطلب المهندس المشرف إعادة تنفيذها</span>
            <button class="btn btn-ghost" data-act="scan-recent-filter" data-id="rework" style="width:auto;padding:3px 10px;font-size:11.5px;color:#C2410C;border-color:#FDBA74;font-weight:800">عرض العمليات ◀</button>
          </div>
        ` : ''}

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div>
            <b style="font-size:15px">أحدث الأشجار والعمليات المسجلة</b>
            <div class="muted" style="font-size:12px">أشجار قمت بالعمل عليها مؤخراً — للوصول السريع ومتابعة الصف أو الخط</div>
          </div>
          <span class="chip" style="font-size:11px">${recentTrees.length} شجرة</span>
        </div>
        <div class="list-wrap">
          ${recentTrees.map(p => {
            const last = lastOp(p.id, () => true);
            return `<div class="list-item" style="padding:10px 4px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
              <div>
                <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                  ${codeHtml(p.code, p.id)}
                  ${palmBadge(p)}
                  <span class="muted clickable-palm-variety" style="font-size:12.5px;cursor:pointer;display:inline-flex;align-items:center;gap:3px" data-act="open-palm" data-id="${p.id}" title="اضغط لفتح بطاقة وتفاصيل الشجرة">${cropIcon(p.cropId||"palm", 13)} <b style="color:#1E293B">${p.variety}</b></span>
                </div>
                <div class="muted" style="font-size:12px;margin-top:4px">
                  القطعة: <b>${plotName(p.plot)}</b> ${last ? " • آخر عملية: " + typeName(last.typeId) + " (" + fmtDate(last.at) + ")" : ""}
                </div>
              </div>
              ${palmOpenBtn(p)}
            </div>`;
          }).join("") || `<div class="muted" style="padding:16px;text-align:center">لم تسجل أي عمليات بعد</div>`}
        </div>
      `}
    </div>`;
  }

  return `${headerHtml}${qrModalHtml}`;
}

function renderFastOpModal(st) {
  if (!fastOpPalmId) return "";
  const p = findPalm(fastOpPalmId);
  if (!p) return "";
  const cropId = p.cropId || "palm";
  const allTypes = (st.operationTypes || []).filter(t => !t.inactive && (!t.scopeType || t.scopeType === "individual" || t.scopeType === "both") && (!t.cropId || t.cropId === "all" || t.cropId === cropId));
  const selectedType = fastOpSelectedType || (allTypes[0]?.id || "op_irrigation");

  return `
    <div class="custom-modal-backdrop" id="fast_op_modal_container" data-act="close-fast-op">
      <div class="custom-modal-box" style="max-width:540px;width:95%;border-radius:14px;box-shadow:0 12px 36px rgba(0,0,0,0.25)">
        <div class="custom-modal-head" style="background:#F0FDF4;color:#166534;padding:14px 18px;border-bottom:1px solid #BBF7D0;display:flex;justify-content:space-between;align-items:center">
          <h3 style="margin:0;display:flex;align-items:center;gap:8px;font-size:16px">
            ⚡ تسجيل خدمة / عملية سريعة — <span style="font-family:monospace;font-weight:800;color:#15803D">${escapeHtml(p.code)}</span>
          </h3>
          <button class="custom-modal-close" data-act="close-fast-op" style="background:transparent;border:none;font-size:18px;cursor:pointer;color:#64748B">✕</button>
        </div>
        <div class="custom-modal-body" style="padding:16px">
          <div style="margin-bottom:14px">
            <label style="font-weight:700;font-size:13px;color:#334155;margin-bottom:8px;display:block">اختر نوع العملية المنفذة:</label>
            <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(140px, 1fr));gap:8px;max-height:220px;overflow-y:auto;padding:2px">
              ${allTypes.map(t => {
                const isSel = (t.id === selectedType);
                return `
                  <div data-act="pick-fast-op-type" data-id="${t.id}"
                    style="border:2px solid ${isSel ? '#16A34A' : '#E2E8F0'};background:${isSel ? '#DCFCE7' : '#FFFFFF'};color:${isSel ? '#166534' : '#1E293B'};font-weight:700;font-size:12px;padding:10px 8px;border-radius:8px;cursor:pointer;text-align:center;display:flex;align-items:center;justify-content:center;gap:6px;box-shadow:${isSel ? '0 2px 8px rgba(22,163,74,0.25)' : 'none'};transition:all 0.15s ease">
                    <span>${cropIcon(t.cropId, 14)}</span>
                    <span>${escapeHtml(t.name)}</span>
                  </div>
                `;
              }).join("")}
            </div>
          </div>

          <div class="grid grid-2" style="gap:10px;margin-bottom:12px">
            <div>
              <label style="font-weight:700;font-size:12px">تاريخ التنفيذ</label>
              <input id="fast_op_date" type="date" value="${new Date().toISOString().slice(0, 10)}" style="margin:0" />
            </div>
            <div>
              <label style="font-weight:700;font-size:12px">حالة صحة الشجرة</label>
              <select id="fast_op_health" style="margin:0">
                <option value="سليمة" ${(p.status==='سليمة' || p.statusId===1 || p.statusCode==='healthy')?'selected':''}>سليمة</option>
                <option value="تحت المراقبة" ${(p.status==='تحت المراقبة' || p.statusId===2 || p.statusCode==='observation')?'selected':''}>تحت المراقبة</option>
                <option value="مصابة" ${(p.status==='مصابة' || p.statusId===3 || p.statusCode==='infected')?'selected':''}>مصابة</option>
                <option value="ميتة" ${(p.status==='ميتة' || p.statusId===5 || p.statusCode==='dead')?'selected':''}>ميتة</option>
              </select>
            </div>
          </div>

          <div style="margin-bottom:16px">
            <label style="font-weight:700;font-size:12px">ملاحظات أو تفاصيل سريعة</label>
            <input id="fast_op_notes" placeholder="اختياري — مثال: ري خفيف، فحص سليم، تقليم جريد..." style="margin:0" />
          </div>

          <div style="display:flex;gap:10px;justify-content:flex-end">
            <button class="btn btn-ghost" data-act="close-fast-op" style="padding:8px 16px">إلغاء</button>
            <button class="btn btn-primary" data-act="save-fast-op" data-id="${p.id}" style="font-weight:700;padding:8px 20px;background:#16A34A;display:flex;align-items:center;gap:6px">
              💾 حفظ العملية وإرسالها للاعتماد
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function isOpForPalm(o, p, st) {
  if (!p || !o) return false;
  const s = st || Store.get();
  if (String(o.palmId) === String(p.id) || (p.code && o.palmCode === p.code)) return true;

  // If specific palmIds are recorded on the operation, strictly check presence:
  if (o.palmIds && Array.isArray(o.palmIds)) {
    return o.palmIds.includes(p.id) || (p.code && o.palmIds.includes(p.code));
  }

  let opPlot = o.plotId;
  let opSec = o.sectorId;
  if (!opPlot && !opSec && o.notes && o.notes.includes("[جماعي")) {
    const m = o.notes.match(/\[جماعي\s*([^\]]+)\]/);
    if (m) {
      const rawLoc = m[1].replace(/قطعة|قطاع/g, "").trim();
      const foundPl = (s.plots || []).find(pl => pl.id === rawLoc || pl.name === rawLoc || (pl.part && pl.part === rawLoc) || (pl.name && pl.name.includes(rawLoc)));
      if (foundPl) {
        opPlot = foundPl.id;
        opSec = foundPl.sector;
      } else {
        const foundSec = (s.sectors || []).find(sec => sec.id === rawLoc || sec.name === rawLoc || (sec.name && sec.name.includes(rawLoc)));
        if (foundSec) opSec = foundSec.id;
      }
    }
  }

  const pPlot = p.plot;
  const pPlotBase = (typeof plotBaseId === "function") ? plotBaseId(pPlot) : pPlot;
  const pSecId = (s.plots || []).find(x => x.id === p.plot)?.sector;

  // Strict plot match: A batch operation on a specific plot (e.g. 1-1A) must NEVER bleed into another sub-plot (e.g. 1-1C)!
  if (pPlot && opPlot) {
    if (opPlot === pPlot) return true;
    if (opPlot.startsWith("base:") && ((typeof plotBaseId === "function") && opPlot.slice(5) === pPlotBase)) return true;
    return false;
  }

  if (pSecId && opSec && opSec === pSecId && (!opPlot || o.targetLevel === "sector")) {
    return true;
  }

  return false;
}

function lastOp(palmId, pred) {
  const p = findPalm(palmId);
  if (!p) return null;
  const st = Store.get();
  return (st.operations || []).filter(o => isOpForPalm(o, p, st) && pred(o)).sort((a,b)=>new Date(b.at)-new Date(a.at))[0];
}
let activeFieldNotePalmId = null;
let completingFieldNoteId = null;
let fieldNoteTargetType = "ALL_TEAM";

function getWorkersAllowedOnPalm(p, st) {
  if (!p) return { workers: [], isPlotSpecific: false };
  const allWorkers = (st.users || []).filter(u => u.role === "worker" && u.active !== false);
  const palmPlot = String(p.plot || "");
  const assignedWorkers = allWorkers.filter(w => {
    const directPlots = (w.plots || []).map(String);
    if (directPlots.includes(palmPlot)) return true;
    const userPlots = (st.userPlots || [])
      .filter(up => String(up.userId) === String(w.id))
      .map(up => String(up.plotId));
    if (userPlots.includes(palmPlot)) return true;
    return false;
  });
  return { workers: assignedWorkers, isPlotSpecific: true };
}

function renderFieldNoteModal(st) {
  if (!activeFieldNotePalmId) return "";
  const p = findPalm(activeFieldNotePalmId);
  if (!p) return "";
  const { workers } = getWorkersAllowedOnPalm(p, st);

  return `
    <div class="custom-modal-backdrop" data-act="close-field-note-modal">
      <div class="custom-modal-box" style="max-width:560px;width:95%;border-radius:14px;box-shadow:0 14px 40px rgba(0,0,0,0.3)">
        <div class="custom-modal-head" style="background:#EFF6FF;color:#1D4ED8;padding:14px 18px;border-bottom:1px solid #BFDBFE;display:flex;justify-content:space-between;align-items:center">
          <div>
            <h3 style="margin:0;font-size:16px;display:flex;align-items:center;gap:6px">
              <span>📝 تسجيل ملاحظة / تكليف ميداني:</span>
              <span style="font-weight:800;color:#1E40AF">${p.code}</span>
            </h3>
            <div style="font-size:11.5px;color:#3B82F6;margin-top:2px">
              ${p.variety || 'نخلة'} • ${plotName(p.plot)}
            </div>
          </div>
          <button class="custom-modal-close" data-act="close-field-note-modal" style="background:transparent;border:none;font-size:20px;cursor:pointer;color:#64748B">✕</button>
        </div>
        <div style="padding:16px 18px;display:flex;flex-direction:column;gap:12px">
          <div>
            <label style="display:block;font-size:12.5px;font-weight:700;margin-bottom:6px">نطاق التوجيه والتكليف</label>
            <div style="display:flex;gap:16px;align-items:center">
              <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-size:13px">
                <input type="radio" name="fn_target_type" value="ALL_TEAM" ${fieldNoteTargetType === "ALL_TEAM" ? "checked" : ""} data-act="fn-scope-tog" data-id="ALL_TEAM" style="accent-color:#2563EB" />
                <span>🌐 فريق العمل الميداني (عام)</span>
              </label>
              <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-size:13px">
                <input type="radio" name="fn_target_type" value="INDIVIDUAL" ${fieldNoteTargetType === "INDIVIDUAL" ? "checked" : ""} data-act="fn-scope-tog" data-id="INDIVIDUAL" style="accent-color:#2563EB" />
                <span>👤 فني / عامل محدد</span>
              </label>
            </div>
          </div>

          ${fieldNoteTargetType === "INDIVIDUAL" ? `
            <div>
              <label style="display:block;font-size:12.5px;font-weight:700;margin-bottom:4px">
                ${workers.length > 0 ? `👷 العامل المكلف بالتنفيذ (المخصصون لقطعة ${plotName(p.plot)})` : `⚠️ عمال القطعة`}
              </label>
              ${workers.length === 0 ? `
                <div style="background:#FEF2F2;border:1px solid #F87171;border-radius:8px;padding:10px 12px;color:#991B1B;font-size:12.5px;line-height:1.5">
                  ⚠️ <b>تنبيه:</b> لا يوجد فنيون أو عمال مخصصون لهذه القطعة (<b>${plotName(p.plot)}</b>) في صلاحيات النطاق.
                  <div style="font-size:11.5px;color:#B91C1C;margin-top:4px">يرجى تخصيص عمال للقطعة أولاً من إدارة الصلاحيات، أو اختيار التكليف لـ "🌐 فريق العمل الميداني (عام)".</div>
                </div>
              ` : `
                <select id="fn_assigned" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #CBD5E1">
                  ${workers.map(w => `<option value="${w.id}">${w.name} (${w.phone || w.username || 'فني'})</option>`).join("")}
                </select>
              `}
            </div>
          ` : ''}

          <div class="grid grid-2" style="gap:10px">
            <div>
              <label style="display:block;font-size:12.5px;font-weight:700;margin-bottom:4px">الأولوية ومستوى الاستعجال</label>
              <select id="fn_prio" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #CBD5E1">
                <option value="normal">ℹ️ عادي (متابعة روتينية)</option>
                <option value="medium">⚠️ متوسط الأهمية</option>
                <option value="urgent">🔴 عاجل وفوري (خلال 24 ساعة)</option>
              </select>
            </div>
            <div>
              <label style="display:block;font-size:12.5px;font-weight:700;margin-bottom:4px">عنوان أو نوع الملاحظة</label>
              <input id="fn_title" placeholder="مثال: فحص سعف مكسور / اشتباه إصابة..." style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #CBD5E1" />
            </div>
          </div>

          <div>
            <label style="display:block;font-size:12.5px;font-weight:700;margin-bottom:4px">تفاصيل التكليف والملاحظة الميدانية المطلوبة</label>
            <textarea id="fn_notes" rows="3" placeholder="اكتب التعليمات والتوجيهات الواضحة للفني الميداني..." style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #CBD5E1"></textarea>
          </div>
        </div>
        <div style="background:#F8FAFC;padding:12px 18px;border-top:1px solid #E2E8F0;display:flex;justify-content:flex-end;gap:10px;border-radius:0 0 14px 14px">
          <button class="btn btn-ghost" data-act="close-field-note-modal">إلغاء</button>
          <button class="btn btn-primary" data-act="save-field-note" style="background:#2563EB;font-weight:700">💾 حفظ وتوجيه التكليف</button>
        </div>
      </div>
    </div>
  `;
}

function renderFieldNoteCompleteModal(st) {
  if (!completingFieldNoteId) return "";
  const n = (st.treeNotes || []).find(x => x.id === completingFieldNoteId);
  if (!n) return "";
  const p = st.palms.find(x => String(x.id) === String(n.palmId) || (x.code && x.code === n.palmCode));

  return `
    <div class="custom-modal-backdrop" data-act="close-complete-note-modal">
      <div class="custom-modal-box" style="max-width:520px;width:95%;border-radius:14px;box-shadow:0 14px 40px rgba(0,0,0,0.3)">
        <div class="custom-modal-head" style="background:#F0FDF4;color:#166534;padding:14px 18px;border-bottom:1px solid #BBF7D0;display:flex;justify-content:space-between;align-items:center">
          <div>
            <h3 style="margin:0;font-size:16px;display:flex;align-items:center;gap:6px">
              <span>📸 توثيق وإتمام التكليف الميداني</span>
            </h3>
            <div style="font-size:11.5px;color:#15803D;margin-top:2px">
              الشجرة: <b>${n.palmCode || p?.code || '—'}</b> • المهمة: <b>${n.title}</b>
            </div>
          </div>
          <button class="custom-modal-close" data-act="close-complete-note-modal" style="background:transparent;border:none;font-size:20px;cursor:pointer;color:#64748B">✕</button>
        </div>
        <div style="padding:16px 18px;display:flex;flex-direction:column;gap:12px">
          ${n.notes ? `
            <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:10px;font-size:12.5px;color:#334155">
              <span class="muted" style="font-weight:700">المطلوب من المشرف:</span> ${n.notes}
            </div>
          ` : ''}
          <div>
            <label style="display:block;font-size:12.5px;font-weight:700;margin-bottom:4px">تقرير الإنجاز والملاحظات المنفذة</label>
            <textarea id="fnc_notes" rows="3" placeholder="اكتب ما تم إنجازه ميدانياً على الشجرة..." style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #CBD5E1"></textarea>
          </div>
          <div>
            <label style="display:block;font-size:12.5px;font-weight:700;margin-bottom:4px">صورة الإثبات والتوثيق الميداني (اختياري)</label>
            <input type="file" id="fnc_photo_file" accept="image/*" capture="environment" style="width:100%;padding:6px;border:1px dashed #CBD5E1;border-radius:8px;background:#F8FAFC" />
          </div>
        </div>
        <div style="background:#F8FAFC;padding:12px 18px;border-top:1px solid #E2E8F0;display:flex;justify-content:flex-end;gap:10px;border-radius:0 0 14px 14px">
          <button class="btn btn-ghost" data-act="close-complete-note-modal">إلغاء</button>
          <button class="btn btn-primary" data-act="submit-complete-note" style="background:#16A34A;font-weight:700">✓ تأكيد الإتمام وإرسال للاعتماد</button>
        </div>
      </div>
    </div>
  `;
}

function renderWorkerFieldNotesSection(me, st) {
  const myTasks = (st.treeNotes || []).filter(n => 
    (n.targetType === "ALL_TEAM" || String(n.assignedTo) === String(me.id)) &&
    (n.status === "pending" || n.status === "in_progress")
  );
  if (!myTasks.length) return "";
  
  const urgentCount = myTasks.filter(t => t.priority === "urgent").length;
  const inProgressCount = myTasks.filter(t => t.status === "in_progress").length;

  return `
    <div style="margin-bottom:18px">
      <!-- Section Header with Metrics -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <h3 style="margin:0;display:flex;align-items:center;gap:6px;font-size:15px;color:#0F172A">
          <span>📋 مهامك الميدانية المكلف بها</span>
          <span class="badge" style="background:#EF4444;color:#fff;font-size:11px;font-weight:700;padding:2px 7px;border-radius:10px">${urgentCount} عاجل</span>
          ${inProgressCount ? `<span class="badge" style="background:#3B82F6;color:#fff;font-size:11px;font-weight:700;padding:2px 7px;border-radius:10px">${inProgressCount} جاري</span>` : ''}
          <span class="badge" style="background:#F1F5F9;color:#475569;font-size:11px;font-weight:700;padding:2px 7px;border-radius:10px">إجمالي: ${myTasks.length}</span>
        </h3>
      </div>

      <!-- Responsive Balanced Grid matching dueSchedules -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:12px">
        ${myTasks.map(t => {
          const p = st.palms.find(x => String(x.id) === String(t.palmId) || (x.code && x.code === t.palmCode));
          const sec = p ? plotSectorOf(p.plot) : "";
          const isUrgent = t.priority === "urgent";
          const isInProgress = t.status === "in_progress";
          const authorObj = userBy(t.createdBy || t.authorId || t.author_id);
          const authorName = t.authorName || authorObj?.name || 'المشرف';
          const borderColor = isUrgent ? '#EF4444' : isInProgress ? '#16A34A' : '#F59E0B';
          
          return `
            <div style="background:#ffffff;border-radius:12px;box-shadow:0 2px 4px rgba(0,0,0,0.04);border:1px solid ${isUrgent ? '#FCA5A5' : isInProgress ? '#86EFAC' : '#E2E8F0'};border-right:5px solid ${borderColor};padding:14px;display:flex;flex-direction:column;justify-content:space-between">
              <div>
                <!-- Top Row: Tree Chip & Urgency & Status -->
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:8px">
                  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                    <button type="button" class="btn btn-ghost" data-go="palm" data-id="${t.palmId}" style="padding:2px 8px;font-size:12px;font-weight:800;background:#ECFDF5;color:#065F46;border:1px solid #A7F3D0;border-radius:6px;cursor:pointer">
                      🌴 ${t.palmCode || p?.code || 'شجرة'}
                    </button>
                    <span style="font-size:11px;color:#64748B;font-weight:600">${p ? `${plotName(p.plot)} ${sec ? `(ق.${sec})` : ''}` : ''}</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:6px">
                    <span style="font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:12px;background:${isUrgent ? '#FEE2E2' : '#FEF3C7'};color:${isUrgent ? '#DC2626' : '#92400E'}">
                      ${isUrgent ? '🔴 عاجل' : t.priority === 'medium' ? '⚠️ متوسط' : 'ℹ️ عادي'}
                    </span>
                    <span class="status ${isInProgress ? 'st-sync' : 'st-wait'}" style="font-size:10.5px;padding:2px 8px;border-radius:12px;font-weight:700">
                      ${isInProgress ? '🚜 جاري التنفيذ' : '⏳ بانتظارك'}
                    </span>
                  </div>
                </div>

                <!-- Main Title -->
                <div style="font-weight:800;font-size:13.5px;color:#0F172A;margin-bottom:6px;display:flex;align-items:center;gap:6px">
                  <span>⚡</span> <span>${escapeHtml(t.title)}</span>
                </div>

                <!-- Notes (Compact Clamp) -->
                ${t.notes ? `
                  <div style="font-size:11.5px;color:#475569;background:#F8FAFC;padding:6px 10px;border-radius:6px;border:1px dashed #CBD5E1;margin-bottom:8px;line-height:1.4">
                    📝 ${escapeHtml(t.notes)}
                  </div>
                ` : ''}

                <div style="font-size:10.5px;color:#94A3B8;margin-bottom:10px">
                  👤 من: <b style="color:#475569">${authorName}</b> • ${fmtDateTime(t.createdAt || t.created_at)}
                </div>
              </div>

              <!-- Bottom Action Row -->
              <div style="display:flex;gap:8px;align-items:center;margin-top:4px">
                ${!isInProgress ? `
                  <button type="button" class="btn btn-primary" data-act="start-note" data-id="${t.id}" style="flex:1;min-height:38px;height:auto;padding:6px 10px;font-size:12px;font-weight:700;border-radius:8px;display:flex;justify-content:center;align-items:center;gap:6px;white-space:nowrap">
                    <span>🚜 بدء التنفيذ</span>
                  </button>
                ` : `
                  <button type="button" class="btn btn-primary" data-act="open-complete-note-modal" data-id="${t.id}" style="flex:1;min-height:38px;height:auto;padding:6px 10px;font-size:12px;font-weight:700;border-radius:8px;background:#16A34A;border-color:#16A34A;display:flex;justify-content:center;align-items:center;gap:6px;white-space:nowrap">
                    <span>📸 إتمام وتوثيق</span>
                  </button>
                `}
                <button type="button" class="btn btn-ghost" data-go="palm" data-id="${t.palmId}" style="height:38px;padding:0 12px;font-size:11.5px;font-weight:700;border-radius:8px;color:#475569;background:#F8FAFC;border:1px solid #CBD5E1;white-space:nowrap">
                  🌴 الشجرة
                </button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderEngineerFieldNotesReviewSection(me, st) {
  const pendingClosure = (st.treeNotes || []).filter(n => n.status === "completed");
  if (!pendingClosure.length) return "";

  return `
    <div style="background:#F0FDF4;border:1.5px solid #22C55E;border-radius:12px;padding:14px;margin-bottom:16px;box-shadow:0 2px 6px rgba(34,197,94,0.08)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;border-bottom:1px solid #BBF7D0;padding-bottom:6px">
        <h3 style="margin:0;display:flex;align-items:center;gap:8px;font-size:15px;color:#166534">
          <span>📝 مهام وملاحظات ميدانية مكتملة (بانتظار الاعتماد والإغلاق)</span>
          <span class="badge" style="background:#16A34A;color:#fff;font-size:12px;padding:2px 8px;border-radius:10px">${pendingClosure.length} منجز</span>
        </h3>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${pendingClosure.map(t => {
          const p = st.palms.find(x => String(x.id) === String(t.palmId) || (x.code && x.code === t.palmCode));
          const w = userBy(t.completedBy || t.completed_by);
          const cNotes = t.completionNotes || t.completion_notes || "";
          const cPhoto = t.completionPhoto || t.completion_photo || "";
          return `
            <div style="background:#ffffff;border:1px solid #BBF7D0;border-right:4px solid #22C55E;border-radius:8px;padding:10px 14px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:6px">
                <div style="display:flex;align-items:center;gap:6px">
                  <span class="badge" style="background:#DCFCE7;color:#15803D;font-size:11px;font-weight:700">✓ تم التنفيذ</span>
                  <button class="btn btn-ghost" data-go="palm" data-id="${t.palmId}" style="padding:2px 8px;font-size:12px;font-weight:800;background:#F0FDF4;color:#15803D;border:1px solid #BBF7D0;border-radius:6px">
                    🌴 ${t.palmCode || p?.code || 'شجرة'}
                  </button>
                  <span style="font-weight:700;font-size:13px;color:#1E293B">${t.title}</span>
                </div>
                ${(() => {
                  const execRole = roleLabel(w?.role || 'worker');
                  return `<span style="font-size:11.5px;color:#475569">المنفذ: <b>${w?.name || 'فني ميداني'}</b> <span class="badge" style="background:#DCFCE7;color:#166534;font-size:10px;padding:1px 6px">${execRole}</span> • <span class="muted">${fmtDateTime(t.completedAt || t.completed_at)}</span></span>`;
                })()}
              </div>
              ${t.notes ? `<div style="font-size:12px;color:#64748B;margin-bottom:6px"><b>المطلوب أصلاً:</b> ${t.notes}</div>` : ''}
              ${cNotes ? `
                <div style="font-size:12.5px;color:#166534;background:#F0FDF4;padding:6px 10px;border-radius:6px;border:1px solid #DCFCE7;margin-bottom:6px">
                  <b>تقرير الإنجاز:</b> ${cNotes}
                </div>
              ` : ''}
              ${cPhoto ? `
                <div style="margin-bottom:8px">
                  <a href="javascript:void(0)" onclick="window.viewImagePreview('${cPhoto}', 'توثيق الإنجاز الميداني')" style="display:inline-block;cursor:pointer">
                    <img src="${cPhoto}" style="max-height:80px;border-radius:6px;border:1px solid #CBD5E1;box-shadow:0 1px 3px rgba(0,0,0,0.1)" alt="صورة الإثبات" />
                  </a>
                </div>
              ` : ''}
              <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:6px">
                <button class="btn btn-primary btn-sm" data-act="close-note" data-id="${t.id}" style="background:#16A34A;font-weight:800;padding:5px 14px">
                  ✓ اعتماد وإغلاق التكليف
                </button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderWorkerReworkSection(me, st) {
  const reworkOps = (st.operations || []).filter(o => o.workerId === me.id && (o.approval === "needs_rework" || o.approval === "rework"));
  if (!reworkOps.length) return "";
  
  return `
    <div style="margin-bottom:18px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <h3 style="margin:0;display:flex;align-items:center;gap:6px;font-size:15px;color:#C2410C">
          <span>🔄 مهام تتطلب إعادة التنفيذ والتصحيح</span>
          <span class="badge" style="background:#EA580C;color:#fff;font-weight:800;font-size:11px;padding:2px 8px;border-radius:10px">${reworkOps.length} مستحق</span>
        </h3>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:12px">
        ${reworkOps.map(o => {
          const p = palmById(o.palmId);
          return `
            <div style="background:#ffffff;border-radius:12px;box-shadow:0 2px 4px rgba(0,0,0,0.04);border:1px solid #FED7AA;border-right:5px solid #EA580C;padding:14px;display:flex;flex-direction:column;justify-content:space-between">
              <div>
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:8px">
                  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                    ${p ? codeHtml(p.code, p.id) : '<span class="muted">—</span>'}
                    <span style="font-size:11px;color:#64748B">${p ? `${plotName(p.plot)}` : ''}</span>
                  </div>
                  <span class="badge" style="background:#FFEDD5;color:#C2410C;font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:12px">
                    مطلوب إعادة التنفيذ
                  </span>
                </div>

                <div style="font-weight:800;font-size:13.5px;color:#1E293B;margin-bottom:6px">
                  ${typeName(o.typeId)} ${p?.variety ? `(${p.variety})` : ''}
                </div>

                ${o.supervisorNote ? `
                  <div style="font-size:11.5px;background:#FFF7ED;color:#9A3412;padding:6px 10px;border-radius:6px;border:1px dashed #FDBA74;margin-bottom:8px;line-height:1.4">
                    <b>📝 سبب الرفض:</b> ${escapeHtml(o.supervisorNote)}
                  </div>
                ` : `
                  <div style="font-size:11.5px;color:#9A3412;margin-bottom:8px">يرجى مراجعة معايير العملية وإعادة التنفيذ والتوثيق.</div>
                `}

                <div style="font-size:10.5px;color:#94A3B8;margin-bottom:10px">
                  تاريخ الطلب: ${fmtDateTime(o.rejectedAt || o.at)}
                </div>
              </div>

              <div>
                <button type="button" class="btn btn-primary" data-act="rework-op" data-id="${o.id}" style="width:100%;min-height:38px;height:auto;padding:6px 10px;background:#EA580C;border-color:#EA580C;font-weight:700;font-size:12px;border-radius:8px;cursor:pointer;white-space:nowrap;display:flex;justify-content:center;align-items:center;gap:6px">
                  <span>🔄 إعادة التنفيذ والتوثيق</span>
                </button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function workerReworkView() {
  const st = Store.get();
  const me = session() || {};
  const reworkOps = (st.operations || []).filter(o => o.workerId === me.id && (o.approval === "needs_rework" || o.approval === "rework"))
    .sort((a, b) => new Date(b.rejectedAt || b.at) - new Date(a.rejectedAt || a.at));

  return `
    <div class="card" style="margin-bottom:16px;border-right:5px solid #EA580C;background:linear-gradient(to left, #fff, #FFF7ED)">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:42px;height:42px;border-radius:10px;background:#FFEDD5;display:flex;align-items:center;justify-content:center;font-size:22px">
            ⚠️
          </div>
          <div>
            <h2 style="margin:0;font-size:17px;color:#C2410C;font-weight:800">مهام تحتاج مراجعة وإعادة تنفيذ</h2>
            <div class="muted" style="font-size:12px;margin-top:2px">العمليات التي قام المشرف الزراعي بمراجعتها وطلب إعادة تنفيذها وتوثيقها ميدانياً</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="badge" style="background:#EA580C;color:#fff;font-weight:800;font-size:12.5px;padding:4px 12px;border-radius:20px">${reworkOps.length} عملية مستحقة</span>
          <button class="btn btn-ghost" data-go="home" style="width:auto;padding:5px 12px;font-size:12px">الرئيسية ◀</button>
        </div>
      </div>
    </div>

    ${!reworkOps.length ? `
      <div class="card" style="text-align:center;padding:44px 20px">
        <div style="font-size:52px;margin-bottom:12px">🎉</div>
        <h3 style="margin:0 0 8px;color:#15803D;font-size:17px">رائع! لا توجد أي مهام مطلوبة لإعادة التنفيذ حالياً</h3>
        <p class="muted" style="max-width:460px;margin:0 auto 16px;font-size:13px;line-height:1.6">كافة عملياتك الميدانية السابقة تم اعتمادها أو أنها قيد المراجعة والتدقيق المنتظم من المشرف الزراعي.</p>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <button class="btn btn-primary" data-go="scan" style="width:auto;padding:8px 20px">🌴 الذهاب للأشجار والحقل</button>
          <button class="btn btn-ghost" data-go="home" style="width:auto;padding:8px 20px">🏠 العودة للرئيسية</button>
        </div>
      </div>
    ` : `
      <div style="display:flex;flex-direction:column;gap:12px">
        ${reworkOps.map(o => {
          const p = palmById(o.palmId);
          const pl = p ? st.plots.find(x => x.id === p.plot) : null;
          const secName = pl ? sectorName(pl.sector) : "";
          const supervisorUser = o.rejectedBy ? userBy(o.rejectedBy) : null;

          return `
            <div class="card" style="border:1px solid #FED7AA;border-right:5px solid #EA580C;border-radius:12px;padding:16px;box-shadow:0 3px 10px rgba(234,88,12,0.06)">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:12px">
                <div>
                  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
                    ${p ? codeHtml(p.code, p.id) : '<span class="muted">—</span>'}
                    <span style="font-weight:800;font-size:15px;color:#1E293B">${typeName(o.typeId)}</span>
                    <span class="badge" style="background:#FFF7ED;color:#C2410C;border:1px solid #FDBA74;font-size:11px;font-weight:700">مطلوب إعادة العمل</span>
                    ${o.batchId ? `<span class="chip" style="font-size:11px;background:#F1F5F9">عملية جماعية #${o.batchId}</span>` : ''}
                  </div>
                  <div class="muted" style="font-size:12.5px;line-height:1.5">
                    ${p ? `🌴 الصنف: <b style="color:#0F172A">${p.variety || '—'}</b> • القطاع: <b>${secName || '—'}</b> • القطعة: <b>${plotName(p.plot)}</b>` : 'بيانات النخلة غير متوفرة'}
                  </div>
                </div>
                <div style="text-align:left;display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                  <span class="muted" style="font-size:11px">تاريخ الرفض والملاحظة</span>
                  <b style="font-size:12px;color:#64748B">${fmtDateTime(o.rejectedAt || o.at)}</b>
                  ${supervisorUser ? `<span class="muted" style="font-size:11px">المشرف: ${escapeHtml(supervisorUser.name)}</span>` : ''}
                </div>
              </div>

              <!-- Supervisor Feedback Box -->
              <div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;padding:12px 14px;margin-bottom:14px">
                <div style="display:flex;align-items:center;gap:6px;font-weight:800;font-size:13px;color:#92400E;margin-bottom:4px">
                  <span>📝</span>
                  <span>توجيه المهندس المشرف وسبب الرفض:</span>
                </div>
                <div style="font-size:13px;color:#78350F;line-height:1.6">
                  ${escapeHtml(o.supervisorNote || 'يرجى مراجعة المعايير الفنية للعملية وإعادة تنفيذها وتوثيقها بدقة')}
                </div>
              </div>

              <!-- Footer actions -->
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;border-top:1px dashed #FED7AA;padding-top:12px">
                <div class="muted" style="font-size:11.5px">
                  ${o.at ? `التوثيق السابق: ${fmtDateTime(o.at)}` : ''}
                  ${o.notes ? ` • ملاحظتك: "${escapeHtml(o.notes)}"` : ''}
                </div>
                <div style="display:flex;gap:8px;align-items:center">
                  ${p ? `<button type="button" class="btn btn-ghost" data-act="open-palm" data-id="${p.id}" style="width:auto;padding:7px 12px;font-size:12px">📋 بطاقة النخلة</button>` : ''}
                  <button type="button" class="btn btn-primary" data-act="rework-op" data-id="${o.id}" style="width:auto;background:#EA580C;border-color:#EA580C;font-weight:800;font-size:13px;padding:8px 18px;border-radius:8px;box-shadow:0 3px 8px rgba(234,88,12,0.3);cursor:pointer">
                    🔄 إعادة التنفيذ والتوثيق الآن
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `}
  `;
}

