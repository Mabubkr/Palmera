// PalmTrace app — Dashboard, tree administration, settings tabs, code generator, new tree
// (split from the former single app.js; files are classic scripts loaded in order by index.html)

function dashView() {
  const st = Store.get();
  const activeCrops = (st.crops || []).filter(c => c.active);
  const years = [...new Set([
    ...(st.seasons || []).map(s => String(s.season_year)),
    ...st.operations.map(o => yearOf(o.at)),
    ...st.yields.map(y => String(y.season)),
    String(new Date().getFullYear())
  ])].sort();
  const lastYear = String(+dashYear - 1);

  const me = session();
  const isRestrictedRole = me && (me.role === "engineer" || me.role === "worker") && me.role !== "admin" && me.role !== "super_admin";
  const userWorkPlots = isRestrictedRole ? new Set(getActiveRoleWorkPlots(me, st)) : null;
  const userAllowedSectors = (isRestrictedRole && userWorkPlots && userWorkPlots.size > 0)
    ? new Set(st.plots.filter(p => userWorkPlots.has(p.id) || userWorkPlots.has(p.code)).map(p => p.sector || p.sector_id))
    : null;
  const scopedBasePalms = (isRestrictedRole && userWorkPlots && userWorkPlots.size > 0)
    ? st.palms.filter(p => !p.archived && userWorkPlots.has(p.plot))
    : st.palms.filter(p => !p.archived);

  // Multi-crop asset partitioning using matchesCropFilter
  const targetPalms = dashCrop === "all" ? scopedBasePalms : scopedBasePalms.filter(p => matchesCropFilter(p.cropId, dashCrop));
  const targetPalmIds = new Set(targetPalms.map(p => p.id));
  const palmsCount = scopedBasePalms.filter(p => matchesCropFilter(p.cropId, "palm")).length;
  const olivesCount = scopedBasePalms.filter(p => matchesCropFilter(p.cropId, "olive")).length;

  // Yields filtered by selected crop and seasons
  const yldLast = st.yields.filter(y => String(y.season) === lastYear && (dashCrop === "all" || matchesCropFilter(y.cropId, dashCrop))).reduce((a,b)=>a+(+b.kg||0),0);
  const yldNow = st.yields.filter(y => String(y.season) === dashYear && (dashCrop === "all" || matchesCropFilter(y.cropId, dashCrop))).reduce((a,b)=>a+(+b.kg||0),0);
  const opsY = st.operations.filter(o => yearOf(o.at) === dashYear && (dashCrop === "all" || targetPalmIds.has(o.palmId)));
  const today = new Date().toISOString().slice(0,10);

  if (dashOpType) {
    const ops = opsY.filter(o => o.typeId === dashOpType).sort((a,b)=> new Date(b.at)-new Date(a.at));
    return `<div class="card">
      <button class="btn btn-ghost" style="width:auto" data-act="dash-back-type">رجوع</button>
      <h3>${typeName(dashOpType)} — ${ops.length} عملية</h3>
      ${ops.map(o => {
        const p = palmById(o.palmId);
        return `<div class="list-item" data-go="op-detail" data-id="${o.id}" style="cursor:pointer">
          <div>${cropIcon(p?.cropId||"palm", 14)} ${codeHtml(p?.code)} • ${p?.variety||""}<div class="muted">${fmtDate(o.at)} • ${o.notes||""}</div></div>
        </div>`;
      }).join("") || "<div class='muted'>لا يوجد</div>"}
    </div>`;
  }
  if (dashPlot) {
    const palms = targetPalms.filter(p => p.plot === dashPlot);
    const slice = paginate(palms, palmPage);
    return `<div class="card">
      <button class="btn btn-ghost" style="width:auto" data-act="dash-back-plot">رجوع للقطاع</button>
      <h3>${plotName(dashPlot)} (${dashCrop==='all'?'كل المحاصيل':cropName(dashCrop)})</h3>
      <p class="muted">${palms.length} أصل — ${hasPerm("ops_record") ? "اضغط الأصل لعرض عملياته أو إضافة عملية" : "اضغط الأصل لعرض تفاصيله وسجل عملياته"}</p>
      ${slice.map(p => `<div class="list-item" data-act="open-palm" data-id="${p.id}" style="cursor:pointer">
        <div>${cropIcon(p.cropId||"palm", 14)} ${codeHtml(p.code)}<div class="muted">${p.variety} • ${p.status} • ${p.offshootCount ? 'فسائل '+p.offshootCount : ''}</div></div>
      </div>`).join("")}
      ${pager(palms.length, palmPage, "palm-page")}
    </div>`;
  }
  if (dashSector) {
    const plots = st.plots.filter(p => p.sector === dashSector);
    return `<div class="card">
      <button class="btn btn-ghost" style="width:auto" data-act="dash-back-sec">رجوع للمؤشرات</button>
      <h3>${sectorName(dashSector)}</h3>
      ${plots.map(pl => {
        const palms = targetPalms.filter(p => p.plot === pl.id);
        const ops = (_s => opsY.filter(o => _s.has(o.palmId)))(new Set(palms.map(p => p.id)));
        return `<div class="list-item" data-act="open-plot" data-id="${pl.id}" style="cursor:pointer">
          <div><b>${pl.name}</b><div class="muted">${palms.length} أصل • ${ops.length} عملية خلال ${dashYear}</div></div>
        </div>`;
      }).join("")}
    </div>`;
  }

  const todayN = opsY.filter(o => String(o.at).slice(0,10)===today).length;
  const weevilId = st.operationTypes.find(t => t.name.includes("سوسة"))?.id;
  const weevilN = weevilId ? opsY.filter(o => o.typeId === weevilId).length : 0;
  const pendingN = opsY.filter(o => o.approval !== "approved").length;

  // Nursery assets count according to crop
  const nurseryPalms = st.offshoots.filter(o=>!o.newPalmId && o.nsStatus!=="issued").length + (st.nurseryItems||[]).filter(n=>(n.cropId||"palm")==="palm" && n.nsStatus!=="issued").length;
  const nurseryOlives = (st.nurseryItems||[]).filter(n=>n.cropId==="olive" && n.nsStatus!=="issued").length;
  const nurseryNow = dashCrop === "palm" ? nurseryPalms : dashCrop === "olive" ? nurseryOlives : (nurseryPalms + nurseryOlives);
  const nurseryPurchased = (st.nurseryItems||[]).filter(n => dashCrop === "all" || (n.cropId||"palm") === dashCrop).length;
  const newlyPlantedCount = targetPalms.filter(p => {
    const yr = String(p.plantDate || p.createdAt || '').slice(0, 4);
    return yr === String(dashYear);
  }).length;

  // Operation types counts filtered by target operations
  const relevantTypes = dashCrop === "all" ? st.operationTypes : st.operationTypes.filter(t => !t.cropId || t.cropId === "all" || t.cropId === dashCrop);
  const typeCounts = relevantTypes.map(t => ({ t, n: opsY.filter(o => o.typeId === t.id).length }));
  const maxType = Math.max(1, ...typeCounts.map(x => x.n));

  // Varieties distribution strictly for targetPalms
  const varPalette = ["#1B5E20", "#C85A2E", "#D4A373", "#2E7D32", "#E65100", "#5D4037", "#00796B", "#388E3C", "#8D6E63", "#795548"];
  const varMap = {};
  targetPalms.forEach(p => {
    const v = p.variety || "غير محدد";
    varMap[v] = (varMap[v] || 0) + 1;
  });
  const totalCount = Math.max(1, targetPalms.length);
  const varList = Object.entries(varMap).map(([name, count], i) => {
    const cropOfVar = targetPalms.find(p => p.variety === name)?.cropId || (dashCrop === "all" ? "palm" : dashCrop);
    return {
      name,
      cropId: cropOfVar,
      count,
      pct: Math.round((count / totalCount) * 100),
      color: varPalette[i % varPalette.length]
    };
  });

  let donutOffset = 0;
  const C = 251.327; // 2 * PI * 40
  const donutCircles = varList.map(item => {
    const dash = (item.count / totalCount) * C;
    const circle = `<circle cx="50" cy="50" r="40" fill="transparent" stroke="${item.color}" stroke-width="14" stroke-dasharray="${dash.toFixed(2)} ${(C - dash).toFixed(2)}" stroke-dashoffset="${(-donutOffset).toFixed(2)}" data-act="dash-variety" data-id="${item.name}" style="cursor:pointer"><title>${item.name}: ${item.count} أصل (${item.pct}%)</title></circle>`;
    donutOffset += dash;
    return circle;
  }).join("");

  const varLegend = varList.map(item => `
    <div class="donut-leg-item" data-act="dash-variety" data-id="${item.name}" title="انقر لتصفية صنف ${item.name}">
      <div style="display:flex;align-items:center;gap:4px">
        <span class="donut-dot" style="background:${item.color}"></span>
        ${cropIcon(item.cropId, 13)}
        <b>${item.name}</b>
      </div>
      <div class="muted">${item.count} <span style="font-size:11px;margin-right:4px">(${item.pct}%)</span></div>
    </div>
  `).join("");

  // Health status strictly for targetPalms
  const healthStatuses = [
    { label: "سليمة", color: "#2E7D32", count: targetPalms.filter(p => (p.status||"سليمة") === "سليمة").length },
    { label: "تحت المراقبة", color: "#E65100", count: targetPalms.filter(p => p.status === "تحت المراقبة").length },
    { label: "مصابة", color: "#C62828", count: targetPalms.filter(p => p.status === "مصابة").length }
  ];
  const maxHealth = Math.max(1, ...healthStatuses.map(h => h.count));

  const chartTitle = dashCrop === "palm" ? "توزيع أصناف نخيل التمر" : dashCrop === "olive" ? "توزيع أصناف أشجار الزيتون" : `توزيع الأصناف (${targetPalms.length} أصل)`;
  const healthTitle = dashCrop === "palm" ? "الحالة الصحية لنخيل التمر" : dashCrop === "olive" ? "الحالة الصحية لأشجار الزيتون" : "الحالة الصحية للأشجار";

  return `
    <!-- Compact Top Bar: Header & Crop Segmented Control (Max Height 36px) -->
    <div class="dash-top-bar">
      <div class="dash-title-group">
        <h3>لوحة التحكم والمؤشرات</h3>
        <div class="dash-crop-pills">
          <button type="button" class="crop-pill ${dashCrop==='all'?'active':''}" data-act="dash-crop-filter" data-id="all">🌐 الكل (${scopedBasePalms.length})</button>
          ${activeCrops.map(c => {
            const cid = c.code || c.id;
            const cnt = scopedBasePalms.filter(p => matchesCropFilter(p.cropId, cid)).length;
            return `<button type="button" class="crop-pill ${dashCrop===cid?'active':''}" data-act="dash-crop-filter" data-id="${cid}">${cropIcon(cid, 14)} ${c.name} (${cnt})</button>`;
          }).join("")}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <label class="muted" style="margin:0;font-size:12px">السنة</label>
        <select id="dyear" style="width:auto;padding:3px 8px;font-size:12px;border-radius:6px">
          ${years.map(y => {
            const sObj = (st.seasons || []).find(s => String(s.season_year) === String(y));
            const statusLabel = sObj ? (sObj.status === 'closed' ? ' (🔒 مقفل)' : ' (نشط)') : '';
            return `<option value="${y}" ${y===dashYear?"selected":""}>${y}${statusLabel}</option>`;
          }).join("")}
        </select>
        <button class="btn btn-ghost icon-btn btn-compact" data-act="open-season-modal" title="إدارة المواسم الزراعية والترحيل السنوي">📅 إدارة المواسم</button>
        <button class="btn btn-ghost icon-btn btn-compact" data-act="export-ops">تصدير العمليات</button>
      </div>
    </div>

    ${(() => {
      const sObj = (st.seasons || []).find(s => String(s.season_year) === String(dashYear));
      if (sObj && sObj.status === 'closed') {
        return `
          <div style="background:#FFFBEB;border:1.5px solid #F59E0B;border-radius:8px;padding:8px 14px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;color:#92400E;font-size:12.5px">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:18px">🔒</span>
              <div>
                <b>موسم ${dashYear} الزراعي مقفل ومؤرشف</b>
                <div style="font-size:11px;color:#B45309">${sObj.notes || 'تم إقفال العمليات وترحيل الأرصدة للموسم التالي. البيانات معروضة للتدقيق التاريخي فقط.'} ${sObj.closed_by ? `(أقفله: ${sObj.closed_by})` : ''}</div>
              </div>
            </div>
            <span class="chip" style="background:#F59E0B;color:#fff;font-weight:700">أرشيف للقراءة فقط</span>
          </div>
        `;
      }
      return '';
    })()}

    <!-- Dashboard Board: Reorderable / Draggable Widgets -->
    ${(() => {
      const wKpi = wrapDashWidget("kpi", "شريط المؤشرات الإحصائية الرئيسية", `
        <div class="dash-kpi-ribbon">
          <!-- Action Required Group -->
          <div class="kpi-ribbon-group" style="border-right:3.5px solid #dc2626">
            <div class="kpi-ribbon-item ${pendingN ? 'warn-item' : ''}" data-act="dash-pending" title="عرض العمليات المعلقة للاعتماد">
              <b>${pendingN}</b>
              <span>معلّق للاعتماد</span>
            </div>
            ${(() => {
              const dueS = dueSchedulesFor(session());
              return `
                <div class="kpi-ribbon-item ${dueS.length ? 'warn-item' : ''}" data-go="ops-admin" data-id="schedules" title="عرض جداول الرعاية المستحقة">
                  <b>${dueS.length}</b>
                  <span>تذكيرات رعاية</span>
                </div>
              `;
            })()}
            <div class="kpi-ribbon-item ${weevilN ? 'alert-item' : ''}" data-act="dash-weevil" title="عرض بلاغات سوسة النخيل والآفات">
              <b>${weevilN}</b>
              <span>بلاغات آفات</span>
            </div>
          </div>

          <!-- Field Activity Today -->
          <div class="kpi-ribbon-group" style="border-right:3.5px solid #0284c7">
            <div class="kpi-ribbon-item" data-act="dash-today" title="عرض عمليات اليوم">
              <b style="color:#0284c7">${todayN}</b>
              <span>عمليات اليوم</span>
            </div>
            <div class="kpi-ribbon-item" data-go="yields" title="عرض حصاد الموسم الحالي">
              <b>${Number(yldNow).toLocaleString()} <small style="font-size:11px">كجم</small></b>
              <span>محصول ${dashYear}</span>
            </div>
          </div>

          <!-- Assets Summary -->
          <div class="kpi-ribbon-group" style="border-right:3.5px solid #16a34a">
            <div class="kpi-ribbon-item success-item" data-go="palms" title="${dashCrop === 'palm' ? 'إجمالي نخيل التمر (' + targetPalms.length + ')' : dashCrop === 'olive' ? 'إجمالي أشجار الزيتون (' + targetPalms.length + ')' : 'إجمالي كل النخيل والأشجار (' + targetPalms.length + ')'}">
              <b>${targetPalms.length}</b>
              <span>${dashCrop === 'palm' ? 'نخيل التمر' : dashCrop === 'olive' ? 'أشجار الزيتون' : 'إجمالي الأشجار'}</span>
            </div>
            <div class="kpi-ribbon-item success-item" data-go="palms" title="الأشجار المزروعة أو المضافة حديثاً للنظام في موسم ${dashYear}">
              <b style="color:#059669">${newlyPlantedCount}</b>
              <span>جديدة ومزروعة</span>
            </div>
            <div class="kpi-ribbon-item" data-go="nursery" title="أصول وفسائل المشتل">
              <b style="color:#16a34a">${nurseryNow}</b>
              <span>المشتل الآن</span>
            </div>
          </div>

          <!-- More Metrics Modal Opener -->
          <button type="button" class="btn kpi-ribbon-more-btn" data-act="open-dash-kpi-modal" title="استعراض باقي المؤشرات والإنتاج ومقارنة المواسم">
            📊 باقي المؤشرات والإنتاج ▾
          </button>
        </div>
        ${renderDashKpiModal(st, { lastYear, yldLast, yldNow, nurseryPurchased, targetPalms, palmsCount, olivesCount, newlyPlantedCount })}
        ${renderSeasonModal(st)}
      `);

      const wFeed = wrapDashWidget("feed", "نبض الحقل والميدان — موجز الأنشطة المباشر", renderLiveActivityFeed(st));

      const wCharts = wrapDashWidget("charts", "مخططات توزيع الأصناف والسلامة الصحية", `
        <div class="dash-charts">
          <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <h3>${chartTitle}</h3>
              <span class="muted" style="font-size:12px">مخطط الأصناف (دائري)</span>
            </div>
            <div class="donut-box">
              <svg viewBox="0 0 100 100" class="donut-svg">
                <g transform="rotate(-90 50 50)">
                  ${donutCircles}
                </g>
                <text x="50" y="47" text-anchor="middle" font-size="14" font-weight="800" fill="var(--green)">${targetPalms.length}</text>
                <text x="50" y="61" text-anchor="middle" font-size="9" fill="#666">${cropSingle(dashCrop==='all'?'':dashCrop)||'أصل'}</text>
              </svg>
              <div class="donut-legend">
                ${varLegend || "<div class='muted'>لا أصناف مطابقة</div>"}
              </div>
            </div>
          </div>
          <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <h3>${healthTitle}</h3>
              <span class="muted" style="font-size:12px">مخطط السلامة (شريطي)</span>
            </div>
            <div style="margin-top:10px">
              ${healthStatuses.map(h => `
                <div class="bar-row" data-act="dash-status" data-id="${h.label}" title="عرض الأشجار بحالة: ${h.label}">
                  <div class="bar-lab" style="font-weight:700">${h.label}</div>
                  <div class="bar-track"><div class="bar-fill" style="background:${h.color};width:${Math.round(h.count/maxHealth*100)}%"></div></div>
                  <b>${h.count}</b>
                </div>
              `).join("")}
            </div>
            <div style="margin-top:16px;padding:8px 12px;background:#F7F3EA;border-radius:8px;font-size:12px" class="muted">
              💡 انقر على أي صنف أو حالة للانتقال المباشر وتصفية الأشجار المطابقة.
            </div>
          </div>
        </div>
      `);

      const wOps = wrapDashWidget("ops", "توزيع العمليات الميدانية وهيكل القطاعات", `
        <div class="dash-split">
          <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <h3>توزيع العمليات ${dashYear} ${dashCrop!=='all'?`(${cropName(dashCrop)})`:''}</h3>
              <span class="muted" style="font-size:12px">مخطط النشاط (شريطي)</span>
            </div>
            ${typeCounts.filter(x=>x.n>0 || ["تقليم","تلقيح","إصابة سوسة","تسميد عضوي","تسميد كيميائي"].includes(x.t.name)).map(x => `
              <div class="bar-row" data-act="open-type" data-id="${x.t.id}" title="عرض عمليات ${x.t.name}">
                <div class="bar-lab">${cropIcon(x.t.cropId, 13)} ${x.t.name}</div>
                <div class="bar-track"><div class="bar-fill ${x.t.name.includes("سوسة")?"bad":""}" style="width:${Math.round(x.n/maxType*100)}%"></div></div>
                <b>${x.n}</b>
              </div>`).join("") || "<div class='muted'>لا عمليات مسجلة</div>"}
          </div>
          <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <h3>ملخص القطاعات (أصول ثابتة)</h3>
              <span class="muted" style="font-size:12px">تتبع هرمي</span>
            </div>
            ${(isRestrictedRole && userAllowedSectors ? st.sectors.filter(s => userAllowedSectors.has(s.id)) : st.sectors).map(sec => {
              const plots = st.plots.filter(p => p.sector === sec.id && (!userWorkPlots || userWorkPlots.has(p.id) || userWorkPlots.has(p.code)));
              const plotIdSet = new Set(plots.map(pl => pl.id));
              const palms = targetPalms.filter(p => plotIdSet.has(p.plot));
              const palmIdSet = new Set(palms.map(p => p.id));
              const ops = opsY.filter(o => palmIdSet.has(o.palmId));
              const pct = palms.length ? Math.min(100, Math.round(ops.length / Math.max(1, palms.length) * 100)) : 0;
              return `<div class="sec-card" data-act="open-sec" data-id="${sec.id}" title="عرض قطع وأصول ${sec.name}">
                <div><b>${sec.name}</b><div class="muted">${plots.length} قطعة • ${palms.length} ${cropSingle(dashCrop==='all'?'':dashCrop)||'أصل'}</div></div>
                <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
                <span class="muted">${ops.length} عملية ${dashYear}</span>
              </div>`;
            }).join("")}
          </div>
        </div>
      `);

      const wMap = { kpi: wKpi, feed: wFeed, charts: wCharts, ops: wOps };
      const currentOrder = getDashWidgetsOrder();
      const widgetsHtml = currentOrder.map(id => wMap[id] || "").join("");

      return `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span class="muted" style="font-size:11.5px">💡 يمكنك سحب أي قسم من مقبض السحب (⠿) أو استخدام الأسهم لإعادة ترتيب مكونات الشاشة</span>
          <button type="button" class="btn btn-ghost" data-act="reset-dash-layout" style="font-size:11.5px;padding:3px 10px;border:1px solid var(--line);border-radius:6px;width:auto" title="إعادة ترتيب الشاشة للوضع القياسي">
            🔄 إعادة ضبط الترتيب
          </button>
        </div>
        <div class="dash-widgets-container" id="dash_widgets_container">
          ${widgetsHtml}
        </div>
      `;
    })()}
    ${renderActivityDrawer(st)}`;
}

let browseCrop = "";
function palmsTabs() {
  const canAddPalms = hasPerm("palms_add");
  const canImportPalms = hasPerm("palms_import");
  const st = Store.get();
  const crops = (st.crops || []).filter(c => c.active);

  const me = session();
  const isRestrictedRole = me && (me.role === "engineer" || me.role === "worker") && me.role !== "admin" && me.role !== "super_admin";
  const currentUserPlots = getActiveRoleWorkPlots(me, st);
  const userAssignedPlots = new Set(currentUserPlots);

  let userAllowedSectors = null;
  if (isRestrictedRole && userAssignedPlots.size > 0) {
    userAllowedSectors = new Set(
      st.plots
        .filter(p => userAssignedPlots.has(p.id) || userAssignedPlots.has(p.code))
        .map(p => p.sector || p.sector_id)
    );
    if (!browseSec || !userAllowedSectors.has(browseSec)) {
      browseSec = Array.from(userAllowedSectors)[0] || null;
      browsePlot = null;
    }
  }

  // Filter allowed sectors
  const allowedSectors = (st.sectors || [])
    .filter(s => !s.isDeleted && !s.archived && !s.is_deleted)
    .filter(s => !userAllowedSectors || userAllowedSectors.has(s.id));

  // Filter scoped plots
  let scopedPlots = st.plots.filter(p => !browseSec || p.sector === browseSec);
  if (isRestrictedRole && userAssignedPlots.size > 0) {
    scopedPlots = scopedPlots.filter(p => userAssignedPlots.has(p.id) || userAssignedPlots.has(p.code));
  } else if (isRestrictedRole && userAllowedSectors) {
    scopedPlots = scopedPlots.filter(p => userAllowedSectors.has(p.sector));
  }

  // Base palms scoped to user's assigned scope
  let basePalms = st.palms.filter(p => !p.archived);
  if (isRestrictedRole && userAssignedPlots.size > 0) {
    basePalms = basePalms.filter(p => userAssignedPlots.has(p.plot));
  } else if (isRestrictedRole && userAllowedSectors) {
    basePalms = basePalms.filter(p => userAllowedSectors.has(plotSectorOf(p.plot)));
  }

  const _browseFamily = new Set(browsePlot ? plotFamilyIds(browsePlot) : []);
  const allTrees = basePalms.filter(p => (!browseSec || plotSectorOf(p.plot) === browseSec) && (!browsePlot || _browseFamily.has(p.plot)));
  const filteredTrees = (browseCrop && browseCrop !== "all") ? allTrees.filter(p => matchesCropFilter(p.cropId, browseCrop)) : allTrees;
  const count = filteredTrees.length;

  // Breakdown text
  const cropCounts = {};
  allTrees.forEach(p => {
    const cid = p.cropId || "palm";
    cropCounts[cid] = (cropCounts[cid] || 0) + 1;
  });
  const breakdownText = Object.keys(cropCounts).map(cid => {
    const c = crops.find(x => x.id === cid || x.code === cid) || { name: cropName(cid), single: "أصل" };
    return `${cropIcon(cid, 14)} <b>${cropCounts[cid]}</b> ${c.name}`;
  }).join(" • ");

  return `<div class="page-head">
    <div>
      <h3>الأشجار والحقل</h3>
      <div class="muted">تصفح هرمي حسب القطاع والقطعة والمحصول + بحث عام بالكود</div>
    </div>
    <div class="actions" style="margin:0">
      <button class="btn btn-ghost icon-btn" data-act="open-print-scope-modal" style="border:1px solid var(--green-d);color:var(--green-d);font-weight:700">🖨️ طباعة باركود (قطاع / قطعة)</button>
      ${canAddPalms ? `
        <button class="btn btn-primary icon-btn" data-go="palm-new">+ إضافة شجرة / أصل</button>
        <button class="btn btn-primary icon-btn" data-go="generate">إنشاء أكواد</button>
      ` : ""}
      ${canImportPalms ? `
        <button class="btn btn-ghost icon-btn" data-go="import">استيراد CSV</button>
      ` : ""}
    </div>
  </div>
  <div class="ptabs" style="margin:4px 0 10px 0">
    <button class="${(!browseCrop || browseCrop==='all')?'on':''}" data-act="filter-field-crop" data-id="all">كل المحاصيل (${allTrees.length})</button>
    ${crops.map(c => {
      const cid = c.code || c.id;
      const n = allTrees.filter(p => matchesCropFilter(p.cropId, cid)).length;
      return `<button class="${browseCrop===cid?'on':''}" data-act="filter-field-crop" data-id="${cid}">${cropIcon(cid, 16)} ${c.name} (${n})</button>`;
    }).join("")}
  </div>
  <div class="card filter-bar" style="margin-bottom:12px;grid-template-columns:1.4fr repeat(3,minmax(120px,1fr)) auto">
    <input id="globalsearch" placeholder="امسح أو اكتب الكود الكامل للانتقال مباشرة" />
    <select id="fsec"><option value="">${userAllowedSectors && userAllowedSectors.size === 1 ? 'القطاع المصرح' : 'كل القطاعات'}</option>${allowedSectors.map(s=>`<option value="${s.id}" ${browseSec===s.id?"selected":""}>${s.name}</option>`)}</select>
    <select id="fplot"><option value="">${userAssignedPlots.size ? 'كل القطع المصرحة' : 'كل القطع'}</option>${plotOptionsHtml(scopedPlots, { selected: browsePlot, label: p => p.name || p.id })}</select>
    <div class="muted" style="align-self:center;font-size:12px">${count} أصل في النطاق ${breakdownText ? `(${breakdownText})` : ""}</div>
    <button class="btn btn-ghost icon-btn" data-act="jump-code">انتقال</button>
  </div>`;
}
let setTab = "co", setForm = "", varCropFilter = "all", opsCropFilter = "all", fertCropFilter = "all", nurCropFilter = "all", varSearchQuery = "", opsTypeSearch = "";
let editCropId = null, editVarId = null, editOpId = null, editFertId = null, editPrepId = null, editCatId = null, editOsPrepId = null;
let fertTab = "stock", fertQ = "", fertVoucherFilter = "all", showSupplyForm = false, showVoucherForm = false, showFertNewForm = false, quickSupplyFertId = null, quickIssueFertId = null;
function settingsTabs() {
  const tabs = [
    ["co", "🏢 " + t("settings_tab_co", "بيانات الشركة")],
    ["ai", "✨ " + t("settings_tab_ai", "الذكاء الاصطناعي (AI)")],
    ["crops", "🌾 " + t("settings_tab_crops", "المحاصيل والزراعات")],
    ["var", "🌱 " + t("settings_tab_var", "أصناف المزروعات")],
    ["ops", "⚙️ " + t("settings_tab_ops", "تصنيفات العمليات")],
    ["fert", "📦 " + t("settings_tab_fert", "الأسمدة والمخزون")],
    ["nur", "🌱 " + t("settings_tab_nur", "المشتل والتكاثر")],
    ["contracts", "📜 " + t("settings_tab_contracts", "قوالب التعاقدات")],
    ["i18n", "🌐 " + t("settings_tab_i18n", "اللغات والترجمة")]
  ];
  return `<div class="page-head" style="margin-bottom:8px">
      <div>
        <h3 style="margin:0">${t("settings_title", "إعدادات النظام والشركة")}</h3>
        <div class="muted" style="font-size:12px">${t("settings_sub", "إدارة هوية الشركة، محاصيل المزرعة، الأصناف، والعمليات بديناميكية كاملة")}</div>
      </div>
    </div>
    <div class="ptabs" style="display:flex;gap:4px;overflow-x:auto;padding:4px;background:#F1F5F9;border-radius:10px;margin-bottom:14px">
      ${tabs.map(([k,l])=>`<button class="${setTab===k?"on":""}" data-act="set-tab" data-id="${k}" style="padding:6px 14px;font-size:12.5px;font-weight:600;border-radius:8px;white-space:nowrap">${l}</button>`).join("")}
    </div>`;
}

function renderAiSettingsView() {
  const st = typeof Store !== "undefined" ? Store.get() : {};
  // The stored key never leaves the server; the field is only used to enter a new key.
  const currentKey = "";
  const keyConfigured = Boolean(st.settings && (st.settings.gemini_api_key_configured || st.settings.geminiApiKey_configured));
  return `
    <div style="max-width:920px;margin:0 auto;display:flex;flex-direction:column;gap:18px">
      <div class="card" style="padding:22px;border-radius:14px;box-shadow:var(--shadow);border-top:4px solid #10B981">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;padding-bottom:12px;border-bottom:1px solid var(--line);flex-wrap:wrap;gap:10px">
          <div>
            <h4 style="margin:0;font-size:16px;font-weight:800;display:flex;align-items:center;gap:8px;color:#0F172A">
              <span>✨</span> إعدادات محرك الذكاء الاصطناعي (Google Gemini AI)
            </h4>
            <div class="muted" style="font-size:12px;margin-top:4px">
              تهيئة مفتاح Google Gemini API لتشغيل الرؤية الحاسوبية لفحص الآفات، المستشار الزراعي، والمساعد الصوتي سحابياً ومحلياً.
            </div>
          </div>
          <span class="badge" style="background:#ECFDF5;color:#065F46;border:1px solid #A7F3D0;padding:4px 10px;font-weight:700">
            ✅ المحرك السحابي النشط: Gemini Flash
          </span>
        </div>

        <div style="background:#F8FAFC;border:1.5px solid #E2E8F0;border-radius:12px;padding:16px;margin-bottom:18px">
          <label style="font-size:13px;font-weight:700;display:block;margin-bottom:6px;color:#334155">
            🔑 مفتاح Google Gemini API:
          </label>
          <div style="display:flex;gap:8px;align-items:center">
            <input type="password" id="gemini_api_key_input" value="${currentKey}" placeholder="${keyConfigured ? '✅ يوجد مفتاح محفوظ على الخادم — اكتب مفتاحاً جديداً لاستبداله' : 'الصق مفتاح API هنا'}" class="fctrl" style="flex:1;font-family:monospace;font-size:13px;letter-spacing:1px;direction:ltr" />
            <button type="button" class="btn btn-secondary" data-act="toggle-api-key-vis" style="width:auto !important;flex-shrink:0;padding:8px 14px;border-radius:8px">👁️ عرض</button>
          </div>
          <div class="muted" style="font-size:11.5px;margin-top:6px;line-height:1.5">
            💡 يمكنك الحصول على مفتاح أو تغييره مباشرة من <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:#0284C7;text-decoration:underline;font-weight:700">Google AI Studio</a>.
          </div>
        </div>

        <!-- خيار التحكم في الميكروفون الصوتي للمستشار الزراعي لترشيد الاستهلاك -->
        <div style="background:#F8FAFC;border:1.5px solid #E2E8F0;border-radius:12px;padding:16px;margin-bottom:18px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
            <div>
              <div style="font-size:13px;font-weight:700;color:#334155;display:flex;align-items:center;gap:6px">
                <span>🎙️</span> إتاحة الميكروفون الصوتي في المستشار الزراعي (Voice-to-Chat)
              </div>
              <div class="muted" style="font-size:11.5px;margin-top:2px">
                التحكم في ظهور واستخدام الميكروفون الصوتي داخل محادثة المستشار الزراعي لترشيد الاستهلاك.
              </div>
            </div>
            <label style="position:relative;display:inline-block;width:48px;height:26px;cursor:pointer">
              <input type="checkbox" id="ai_voice_chat_toggle" ${(st.settings?.ai_chat_voice_enabled !== false) ? 'checked' : ''} data-act="toggle-ai-chat-voice" style="opacity:0;width:0;height:0" />
              <span style="position:absolute;top:0;left:0;right:0;bottom:0;background:${(st.settings?.ai_chat_voice_enabled !== false) ? '#10B981' : '#CBD5E1'};border-radius:99px;transition:0.2s">
                <span style="position:absolute;height:20px;width:20px;left:${(st.settings?.ai_chat_voice_enabled !== false) ? '24px' : '4px'};bottom:3px;background:white;border-radius:50%;transition:0.2s"></span>
              </span>
            </label>
          </div>
        </div>

        <div style="display:flex;gap:10px;align-items:center;justify-content:flex-end;flex-wrap:wrap">
          <button type="button" class="btn btn-secondary" data-act="test-gemini-key" style="width:auto !important;flex-shrink:0;padding:9px 18px;font-weight:700;border-radius:9px;display:inline-flex;align-items:center;gap:6px">
            <span>🧪</span> فحص الاتصال بالمفتاح
          </button>
          <button type="button" class="btn btn-primary" data-act="save-gemini-key" style="width:auto !important;flex-shrink:0;padding:9px 24px;font-weight:800;border-radius:9px;background:#10B981;border-color:#10B981;display:inline-flex;align-items:center;gap:6px">
            <span>💾</span> حفظ وتفعيل المفتاح
          </button>
        </div>

        <div id="ai_key_test_result" style="margin-top:14px;display:none"></div>
      </div>

      <!-- بطاقة شرح الميزات المدعومة بالمفتاح -->
      <div class="card" style="padding:18px;border-radius:12px;background:#F0FDF4;border:1px solid #BBF7D0">
        <h5 style="margin:0 0 8px 0;color:#166534;font-size:13.5px;font-weight:800">🌿 الخصائص الذكية المفعلة بالمفتاح:</h5>
        <ul style="margin:0;padding-right:20px;font-size:12px;color:#15803D;line-height:1.7">
          <li><strong>رؤية الحاسوب (Vision):</strong> كشف وتشخيص دقيق لآفات وسوسة النخيل والدوباس والحشرات القشرية وتحديد نسب الإصابة بالصور.</li>
          <li><strong>المستشار الزراعي (RAG & LLM):</strong> محادثة متقدمة وتوصيات تسميد ومكافحة حيوية وكيميائية مصممة لبيئة الواحات.</li>
          <li><strong>المساعد الصوتي والميداني:</strong> تفريغ تلقائي للهجات العربية وتحويل التعليمات الصوتية لعمليات موثقة فوراً.</li>
          <li><strong>المعالجة دون اتصال (Edge-First):</strong> إذا انقطع الإنترنت في الصحراء، يستمر النظام بالعمل عبر محرك القواعد الزراعي المدمج دون توقف!</li>
        </ul>
      </div>

      <!-- إعدادات ومفاتيح بوابات الأقمار الصناعية والأرصاد وعتبات الغطاء النباتي والري (Agri-AI) -->
      ${typeof window !== "undefined" && typeof window.renderAgriSettingsTab === "function" ? window.renderAgriSettingsTab(st) : ""}
    </div>
  `;
}

function plotBaseNumber(p) {
  if (!p) return "";
  if (typeof p === "string") {
    const s = p.trim();
    const m = s.match(/^(?:.*-)?(\d+)[A-Za-z]?$/);
    if (m) return m[1].padStart(2, "0");
    const m2 = s.match(/^(.*?)_?[A-Za-z]$/);
    return m2 ? m2[1] : s;
  }
  if (p.plotNo) return String(p.plotNo).padStart(2, "0");
  const raw = p.plot || p.plot_id || p.plotId || p.id || "";
  const s = String(raw).trim();
  const m = s.match(/^(?:.*-)?(\d+)[A-Za-z]?$/);
  if (m) return m[1].padStart(2, "0");
  const m2 = s.match(/^(.*?)_?[A-Za-z]$/);
  return m2 ? m2[1] : s;
}

// Re-draw only the label-print modal (a full page render made the modal flash on every choice)
function refreshPrintScopeModal() {
  const root = document.getElementById("printScopeModalRoot");
  if (!root) return render();
  const tmp = document.createElement("div");
  tmp.innerHTML = renderPrintScopeModal(Store.get()).trim();
  const fresh = tmp.firstElementChild;
  if (fresh) root.replaceWith(fresh); else render();
}

function renderPrintScopeModal(st) {
  const crops = (st.crops || []).filter(c => c.active);
  const sec = printScopeSec || "all";
  const plotsOfSec = sec === "all" ? st.plots : st.plots.filter(p => p.sector === sec);

  // Group plots by base plot ID
  const baseMap = new Map();
  plotsOfSec.forEach(p => {
    const bId = plotBaseId(p);
    if (!baseMap.has(bId)) baseMap.set(bId, []);
    baseMap.get(bId).push(p);
  });

  const plotOptions = [`<option value="all">كافة القطع (${plotsOfSec.length} قطعة/جزء)</option>`];
  baseMap.forEach((subs, bId) => {
    const bNo = plotBaseNumber(subs[0]) || bId;
    const basePalms = st.palms.filter(p => !p.archived && (plotBaseId(p.plot) === bId || p.plot.startsWith(bId)));
    if (subs.length > 1) {
      const subLabels = subs.map(s => s.part || s.id).filter(Boolean).join(", ");
      plotOptions.push(`<option value="base:${bId}" ${printScopePlot===`base:${bId}`?"selected":""} style="font-weight:bold;color:var(--green-d)">⭐ القطعة ${bNo} (كافة الأجزاء: ${subLabels}) — [${basePalms.length} أصل]</option>`);
      subs.forEach(s => {
        const subPalms = st.palms.filter(p => !p.archived && p.plot === s.id);
        plotOptions.push(`<option value="${s.id}" ${printScopePlot===s.id?"selected":""}>&nbsp;&nbsp;&nbsp;↳ قطعة ${s.part || s.id} (${s.id}) — [${subPalms.length} أصل]</option>`);
      });
    } else {
      const s = subs[0];
      plotOptions.push(`<option value="${s.id}" ${printScopePlot===s.id?"selected":""}>${s.name} (${s.id}) — [${basePalms.length} أصل]</option>`);
    }
  });

  // Calculate matching trees
  let targetTrees = st.palms.filter(p => !p.archived);
  if (printScopeCrop !== "all") {
    targetTrees = targetTrees.filter(p => (p.cropId || "palm") === printScopeCrop);
  }
  if (sec !== "all") {
    targetTrees = (_ps => targetTrees.filter(p => _ps.get(p.plot) === sec))(new Map(st.plots.map(pl => [pl.id, pl.sector])));
  }
  if (printScopePlot && printScopePlot !== "all") {
    if (printScopePlot.startsWith("base:")) {
      const bId = printScopePlot.slice(5);
      targetTrees = targetTrees.filter(p => plotBaseId(p.plot) === bId || p.plot.startsWith(bId));
    } else {
      targetTrees = targetTrees.filter(p => p.plot === printScopePlot);
    }
  }

  const sampleCodes = targetTrees.slice(0, 3).map(p => p.code).join(" • ");

  return `
    <div id="printScopeModalRoot" class="modal" style="display:flex;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.65);z-index:9999;align-items:center;justify-content:center;padding:16px">
      <div class="modal-box card" style="max-width:540px;width:100%;max-height:85vh;overflow-y:auto;border:2px solid var(--green-d)">
        <div class="modal-head" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid var(--line);padding-bottom:8px">
          <h3 style="margin:0;color:var(--green-d)">🖨️ طباعة ملصقات الباركود والـ QR (مخصص)</h3>
          <button class="btn btn-ghost icon-btn" data-act="close-print-scope-modal" style="padding:4px 8px">✕</button>
        </div>
        <p class="muted" style="font-size:12.5px;margin-bottom:12px;line-height:1.5">
          يمكنك في أي وقت اختيار أي قطاع أو قطعة كاملة بأجزائها لطباعة ملصقات الباركود والـ QR فورياً حتى بعد إغلاق شاشة التوليد السابقة:
        </p>

        <label style="font-weight:700">1. القطاع المستهدف</label>
        <select id="ps_sec" data-act="change-print-sec" style="margin-bottom:10px">
          <option value="all">كافة قطاعات المزرعة</option>
          ${st.sectors.map(s => `<option value="${s.id}" ${sec===s.id?"selected":""}>${s.name}</option>`).join("")}
        </select>

        <label style="font-weight:700">2. القطعة المستهدفة (كاملة أو فرعية)</label>
        <select id="ps_plot" data-act="change-print-plot" style="margin-bottom:10px">
          ${plotOptions.join("")}
        </select>

        <label style="font-weight:700">3. تصفية نوع المحصول</label>
        <select id="ps_crop" data-act="change-print-crop" style="margin-bottom:12px">
          <option value="all">كافة المحاصيل</option>
          ${crops.map(c => `<option value="${c.id}" ${printScopeCrop===c.id?"selected":""}>${cropTextLabel(c)}</option>`).join("")}
        </select>

        <!-- Preview Card -->
        <div id="ps_preview" style="background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px;margin-bottom:16px;font-size:13px">
          <div style="font-weight:bold;color:var(--green-d);margin-bottom:4px">
            📋 ملخص الأصول والملصقات المحددة:
          </div>
          <div>إجمالي ملصقات QR المستهدفة للطباعة: <b style="font-size:16px;color:var(--green-d)">${targetTrees.length} ملصق</b></div>
          ${targetTrees.length ? `<div class="muted" style="font-size:11.5px;margin-top:4px">نماذج من الأكواد: ${sampleCodes}${targetTrees.length > 3 ? "..." : ""}</div>` : `<div style="color:var(--err);font-size:12px;margin-top:4px">⚠️ لا توجد أصول مسجلة في هذا النطاق المختار</div>`}
        </div>

        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-ghost" data-act="close-print-scope-modal">إلغاء</button>
          <button class="btn btn-ghost icon-btn" data-act="exec-scope-csv" ${!targetTrees.length?"disabled":""}>📊 تصدير CSV</button>
          <button class="btn btn-primary icon-btn" data-act="exec-scope-print" ${!targetTrees.length?"disabled":""} style="font-weight:bold">🖨️ بدء طباعة الباركود (${targetTrees.length})</button>
        </div>
      </div>
    </div>
  `;
}

function renderSectorEditModal(st) {
  if (!editingSectorId) return "";
  const sec = (st.sectors || []).find(s => s.id === editingSectorId);
  if (!sec) return "";

  const boundaryCount = Array.isArray(sec.boundaryCoordinates) ? sec.boundaryCoordinates.length : (sec.boundary_coordinates ? 'مسجلة' : 0);

  return `
  <div class="modal-backdrop" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px">
    <div class="card" style="max-width:440px;width:100%;border-radius:16px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.2);background:#FFF">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid #E2E8F0;padding-bottom:10px">
        <h3 style="margin:0;font-size:17px">✏️ تعديل بيانات القطاع (${sec.id})</h3>
        <button class="btn btn-ghost" data-act="close-sector-modal" style="padding:4px 8px;font-size:16px">✕</button>
      </div>
      <div style="margin-bottom:14px">
        <label class="label" style="font-weight:700;margin-bottom:4px;display:block">اسم القطاع:</label>
        <input type="text" id="edit_sec_name" class="input" value="${escapeHtml(sec.name || '')}" placeholder="مثال: بشاير 1 أو القطاع 04" style="width:100%;box-sizing:border-box" />
      </div>
      <div style="margin-bottom:14px">
        <label class="label" style="font-weight:700;margin-bottom:4px;display:block">المساحة الإجمالية (فدان):</label>
        <input type="number" step="0.1" id="edit_sec_total_area" class="input" value="${sec.total_area || sec.totalArea || ''}" placeholder="المساحة بالفدان" style="width:100%;box-sizing:border-box" />
      </div>
      <div style="margin-bottom:14px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:8px 12px;font-size:12px;color:#475569">
        🗺️ <b>الحدود الجغرافية للقطاع:</b> ${boundaryCount ? `${boundaryCount} نقطة محيطية محسوبة` : 'تُحسب تلقائياً من إحداثيات قطع القطاع'}
      </div>
      <div style="margin-bottom:16px">
        <label class="label" style="font-weight:700;margin-bottom:4px;display:block">ملاحظات / وصف:</label>
        <textarea id="edit_sec_notes" class="input" rows="3" placeholder="ملاحظات اختيارية..." style="width:100%;box-sizing:border-box">${escapeHtml(sec.notes || '')}</textarea>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-ghost" data-act="close-sector-modal">إلغاء</button>
        <button class="btn btn-primary" data-act="save-edit-sector" data-id="${sec.id}" style="font-weight:700">💾 حفظ التعديلات</button>
      </div>
    </div>
  </div>`;
}

function renderSectorDeleteModal(st) {
  if (!deletingSectorId) return "";
  const sec = (st.sectors || []).find(s => s.id === deletingSectorId);
  if (!sec) return "";

  const secPlots = (st.plots || []).filter(p => p.sector === sec.id);
  const secPalms = (st.palms || []).filter(p => !p.archived && secPlots.some(pl => pl.id === p.plot));
  const totalAssets = secPalms.length;
  const totalPlots = secPlots.length;

  const palmIdSet = new Set(secPalms.map(p => p.id));
  const operationsCount = (st.operations || []).filter(o => palmIdSet.has(o.palmId)).length;
  const yieldsCount = (st.yields || []).filter(y => y.sector_id === sec.id || y.sector === sec.id || palmIdSet.has(y.palm_id || y.palmId)).length;
  const vouchersCount = (st.fertilizerVouchers || []).filter(v => v.sector_id === sec.id || v.sector === sec.id).length;

  const canSafeDelete = (operationsCount === 0 && yieldsCount === 0 && vouchersCount === 0);

  return `
  <div class="modal-backdrop" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px">
    <div class="card" style="max-width:500px;width:100%;border-radius:16px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.2);background:#FFF">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid #E2E8F0;padding-bottom:10px">
        <h3 style="margin:0;font-size:17px;color:${canSafeDelete ? '#DC2626' : '#D97706'}">
          ${canSafeDelete ? '🗑️ تأكيد الحذف المتسلسل للقطاع' : '⚠️ أرشفة القطاع (لوجود سجلات مرتبطة)'}
        </h3>
        <button class="btn btn-ghost" data-act="close-sector-modal" style="padding:4px 8px;font-size:16px">✕</button>
      </div>

      ${canSafeDelete ? `
        <p style="font-size:14px;line-height:1.6;margin:0 0 12px;color:#334155">
          هل أنت متأكد من حذف القطاع <b>${escapeHtml(sec.name)}</b> (كود: <code>${sec.id}</code>)؟<br>
          سيتم حذف القطاع نهائياً مع كافة أصوله وأكواده (<b>${totalAssets}</b> أصل/شجرة) و (<b>${totalPlots}</b> قطعة تابعة).
        </p>
        <div style="background:#F0FDF4;border:1px solid #86EFAC;border-radius:10px;padding:10px 14px;margin-bottom:16px;font-size:12.5px;color:#166534;line-height:1.5">
          ✓ <b>إجراء آمن:</b> تم التحقق من خلو هذا القطاع تماماً من أي حركات عمليات ميدانية أو سجلات إنتاج/أسمدة. لن تتأثر أي سجلات محاسبية سابقة بحذفه.
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-ghost" data-act="close-sector-modal">تراجع</button>
          <button class="btn btn-danger" data-act="confirm-delete-sector" data-id="${sec.id}" style="background:#DC2626;color:#FFF;font-weight:800;border:none">🗑️ تأكيد الحذف المتسلسل (${totalAssets} أصل)</button>
        </div>
      ` : `
        <div style="background:#FEF2F2;border:1px solid #FCA5A5;border-radius:10px;padding:12px;margin-bottom:14px">
          <div style="font-weight:700;color:#991B1B;margin-bottom:6px">⛔ لا يمكن الحذف النهائي المادي لحماية السجلات:</div>
          <div style="font-size:13px;color:#7F1D1D;line-height:1.6">
            يحتوي هذا القطاع على <b>${operationsCount} عملية زراعية مسجلة</b> و <b>${yieldsCount} حركة إنتاج وحصاد</b>.<br>
            الحذف النهائي سيتلف شجرة الأنساب والدفاتر المحاسبية للمستثمرين.
          </div>
        </div>
        <p style="font-size:13px;line-height:1.6;margin:0 0 16px;color:#334155">
          💡 <b>الحل الموصى به:</b> يمكنك <b>أرشفة القطاع</b> لإخفائه بالكامل من شاشات العمليات والاستعراض اليومية مع الحفاظ على كامل السجلات التاريخية والتقارير المالية.
        </p>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-ghost" data-act="close-sector-modal">تراجع</button>
          <button class="btn btn-primary" data-act="confirm-archive-sector" data-id="${sec.id}" style="background:#D97706;border-color:#D97706;font-weight:700">📦 أرشفة القطاع وإيقاف تشغيله</button>
        </div>
      `}
    </div>
  </div>`;
}

function palmsAdminView() {
  const st = Store.get();
  const crops = st.crops || [];
  const me = session();
  const isRestrictedRole = me && (me.role === "engineer" || me.role === "worker") && me.role !== "admin" && me.role !== "super_admin";
  const currentUserPlots = getActiveRoleWorkPlots(me, st);
  const userAssignedPlots = new Set(currentUserPlots);

  let userAllowedSectors = null;
  if (isRestrictedRole) {
    userAllowedSectors = new Set(
      st.plots
        .filter(p => userAssignedPlots.has(p.id) || userAssignedPlots.has(p.code))
        .map(p => p.sector || p.sector_id)
    );
    if (!browseSec || !userAllowedSectors.has(browseSec)) {
      browseSec = Array.from(userAllowedSectors)[0] || null;
      browsePlotGroup = null;
      browsePlot = null;
    }
  }

  const activeSectors = (st.sectors || [])
    .filter(s => !s.isDeleted && !s.archived && !s.is_deleted)
    .filter(s => !userAllowedSectors || userAllowedSectors.has(s.id));

  // LEVEL 1: DEFAULT (Sectors only, no sector selected, no plot, no search)
  if (!browseSec && !browsePlotGroup && !browsePlot && !palmQ) {
    return `
    ${showPrintScopeModal ? renderPrintScopeModal(st) : ""}
    ${editingSectorId ? renderSectorEditModal(st) : ""}
    ${deletingSectorId ? renderSectorDeleteModal(st) : ""}
    ${palmsTabs()}
    <div style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">
      <div style="font-weight:700;font-size:15px">قطاعات المزرعة (العرض الافتراضي)</div>
      <div class="muted" style="font-size:12px">اضغط على القطاع لاستعراض قطعه المجمعة A/B، أو استخدم ✏️ للتعديل و 🗑️ للحذف المشروط</div>
    </div>
    ${(() => {
      // الفهرسة السريعة للقطع والأصول في مسار خطي واحد O(N) للقضاء التام على تجميد المتصفح
      const plotsByNormSec = new Map();
      for (let i = 0; i < st.plots.length; i++) {
        const pl = st.plots[i];
        const sId = normalizeSectorCode(pl.sector || pl.sector_id || (pl.id ? pl.id.split('-')[0] : ''));
        let list = plotsByNormSec.get(sId);
        if (!list) { list = []; plotsByNormSec.set(sId, list); }
        list.push(pl);
      }

      const palmsByNormSec = new Map();
      for (let i = 0; i < st.palms.length; i++) {
        const p = st.palms[i];
        if (p.archived) continue;
        const sId = normalizeSectorCode(p.sector || p.sectorId || p.sector_id || (p.plot ? p.plot.split('-')[0] : ''));
        let list = palmsByNormSec.get(sId);
        if (!list) { list = []; palmsByNormSec.set(sId, list); }
        list.push(p);
      }

      return `<div class="grid grid-3 sector-cards-grid">${activeSectors.map(sec => {
        const normSec = normalizeSectorCode(sec.id);
        const secPlots = plotsByNormSec.get(normSec) || [];
        const groupMap = {};
        secPlots.forEach(p => {
          const b = plotBaseNumber(p);
          groupMap[b] = groupMap[b] || [];
          groupMap[b].push(p);
        });
        const groupCount = Object.keys(groupMap).length;

        let secPalms = palmsByNormSec.get(normSec) || [];
        if (browseCrop) secPalms = secPalms.filter(p => (p.cropId || "palm") === browseCrop);

      const byCrop = {};
      secPalms.forEach(p => {
        const c = cropOf(p);
        const cid = c.id || "palm";
        byCrop[cid] = (byCrop[cid] || 0) + 1;
      });
      const offshootTotal = secPalms.filter(p => cropOf(p).id === "palm").reduce((a, p) => a + (p.offshootCount || 0), 0);
      const cropBadges = Object.keys(byCrop).map(cid => {
        const c = findCrop(cid);
        const osTxt = (cid === "palm" && offshootTotal > 0) ? ` (${offshootTotal} فسيلة)` : "";
        return `<span>${cropIcon(cid, 16)} <b>${byCrop[cid]}</b> ${c.name}${osTxt}</span>`;
      }).join(" • ");
      const cropIconsHeader = Object.keys(byCrop).map(cid => cropIcon(cid, 18)).join(" ");

      const secAreaVal = Number(sec.totalArea || sec.total_area || 0) || secPlots.reduce((sum, p) => sum + (Number(p.areaValue || p.area_value || p.area) || 0), 0);
      const secAreaDisplay = secAreaVal > 0 ? `${secAreaVal.toFixed(2)} فدان` : 'غير محددة';

      const totalAssets = secPalms.length;
      const secPalmIds = new Set(secPalms.map(p => p.id));
      const hasOps = (st.operations || []).some(o => secPalmIds.has(o.palmId));
      const hasYields = (st.yields || []).some(y => y.sector_id === sec.id || y.sector === sec.id || secPalmIds.has(y.palm_id || y.palmId));
      const canSafeDelete = (!hasOps && !hasYields);

      return `<div class="card tile" data-act="open-bsec" data-id="${sec.id}" style="cursor:pointer;border-right:4px solid var(--green);position:relative;display:flex;flex-direction:column;justify-content:space-between">
        <div>
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
            <div>
              <b style="font-size:16px;color:var(--text)">${escapeHtml(sec.name)}</b>
              <div style="font-size:11px;color:#64748B;margin-top:2px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                <span>كود: <code style="background:#F1F5F9;padding:1px 5px;border-radius:4px">${sec.id}</code></span>
              </div>
            </div>
            <div style="display:flex;gap:4px;align-items:center">${cropIconsHeader}</div>
          </div>
          <div class="muted" style="margin-top:8px;font-size:12px;line-height:1.6">
            <div>📁 <b>${groupCount}</b> قطع رئيسية (${secPlots.filter(p => !!(p.part || p.part_letter)).length} حوشة فرعية)</div>
            <div style="font-size:11.5px;color:#0F766E;margin-top:2px">📐 إجمالي المساحة: <b>${secAreaDisplay}</b></div>
            ${sec.notes ? `<div style="font-size:11px;color:#64748B;margin-top:2px">📝 ${escapeHtml(sec.notes)}</div>` : ''}
            <div style="margin-top:4px">${cropBadges || `<span style="color:#64748B;font-weight:700">لا توجد أشجار مسجلة (قطاع فارغ)</span>`}</div>
          </div>
        </div>
        <div style="margin-top:12px;padding-top:8px;border-top:1px solid #F1F5F9;display:flex;justify-content:space-between;align-items:center;gap:6px">
          <div>
            ${secPalms.length ? `<span style="font-size:12px;font-weight:700;color:var(--green)">${secPalms.length} أصل ◀</span>` : `<span style="font-size:11px;color:#64748B">لا توجد أصول</span>`}
          </div>
          <div style="display:inline-flex;align-items:center;gap:6px">
            <button type="button" class="btn btn-sm btn-ghost" data-act="open-edit-sector" data-id="${sec.id}" title="تعديل بيانات القطاع" style="font-size:11px;padding:3px 9px;border:1px solid #CBD5E1;border-radius:6px;background:#fff;cursor:pointer">✏️ تعديل</button>
            <button type="button" class="btn btn-sm btn-ghost" data-act="prompt-delete-sector" data-id="${sec.id}" title="${canSafeDelete ? 'حذف القطاع وأصوله لعدم وجود عمليات مرتبطة' : 'أرشفة القطاع وإيقاف تشغيله'}" style="font-size:11px;padding:3px 9px;border:1px solid ${canSafeDelete ? '#FECACA' : '#FDE68A'};border-radius:6px;background:#fff;color:${canSafeDelete ? '#DC2626' : '#D97706'};cursor:pointer">${canSafeDelete ? '🗑️ حذف' : '📦 أرشفة'}</button>
          </div>
        </div>
      </div>`;
    }).join("")}</div>`;
    })()}`;
  }

  // LEVEL 2: Sector selected, but no plot group or plot selected
  if (browseSec && !browsePlotGroup && !browsePlot && !palmQ) {
    if (userAllowedSectors && !userAllowedSectors.has(browseSec)) {
      browseSec = null;
      return palmsAdminView();
    }
    const normBrowseSec = normalizeSectorCode(browseSec);
    let secPlots = st.plots.filter(p => (
      p.sector === browseSec || p.sector_id === browseSec ||
      normalizeSectorCode(p.sector || p.sector_id) === normBrowseSec
    ));
    if (isRestrictedRole) {
      secPlots = secPlots.filter(p => userAssignedPlots.has(p.id) || userAssignedPlots.has(p.code));
    }
    const groupMap = {};
    secPlots.forEach(p => {
      const b = plotBaseNumber(p);
      groupMap[b] = groupMap[b] || [];
      groupMap[b].push(p);
    });

    const secObj = st.sectors.find(s => s.id === browseSec || normalizeSectorCode(s.id) === normBrowseSec);
    const secAreaVal = Number(secObj?.totalArea || secObj?.total_area || 0) || secPlots.reduce((sum, p) => sum + (Number(p.areaValue || p.area_value || p.area) || 0), 0);
    const secAreaDisplay = secAreaVal > 0 ? `${secAreaVal.toFixed(2)} فدان` : 'غير محددة';

    // جلب أصول هذا القطاع فقط وفهرستها برقم القطعة الأساسية O(M) لمنع تجميد المتصفح
    const secPalmsRaw = (st.palms || []).filter(p => !p.archived && normalizeSectorCode(p.sector || p.sectorId || p.sector_id || (p.plot ? p.plot.split('-')[0] : '')) === normBrowseSec);
    const secPalmsTotal = browseCrop ? secPalmsRaw.filter(p => (p.cropId || "palm") === browseCrop) : secPalmsRaw;

    const palmsByBaseNo = new Map();
    for (let i = 0; i < secPalmsTotal.length; i++) {
      const p = secPalmsTotal[i];
      const bNo = plotBaseNumber(p);
      let list = palmsByBaseNo.get(bNo);
      if (!list) { list = []; palmsByBaseNo.set(bNo, list); }
      list.push(p);
    }

    return `
    ${showPrintScopeModal ? renderPrintScopeModal(st) : ""}
    ${palmsTabs()}
    <div style="margin-bottom:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:space-between">
      <span class="muted" style="font-size:12.5px">القطع مجمعة برقم القطعة الأساسي (تضم الحواشي الفرعية). اضغط على القطعة لعرض التفاصيل والأشجار.</span>
      <button class="btn btn-ghost icon-btn" data-act="print-sec-palms" data-id="${browseSec}" style="font-size:12px;color:var(--green-d);border:1px solid var(--green-d);padding:5px 12px;font-weight:bold">🖨️ طباعة باركود القطاع كاملاً (${secPalmsTotal.length} أصل)</button>
    </div>
    <div class="grid-plots-5">${Object.keys(groupMap).map(baseNo => {
      const subPlots = groupMap[baseNo] || [];
      const grpPalms = palmsByBaseNo.get(baseNo) || [];

      const byCrop = {};
      grpPalms.forEach(p => {
        const c = cropOf(p);
        const cid = c.id || "palm";
        byCrop[cid] = (byCrop[cid] || 0) + 1;
      });
      const cropSummaryList = Object.keys(byCrop).map(cid => {
        const c = findCrop(cid);
        return `${cropIcon(cid, 13)} ${byCrop[cid]} ${c.name}`;
      });
      const cropSummaryText = cropSummaryList.length > 0 ? cropSummaryList.join(" • ") : "لا توجد أصول";
      const cropIconsHeader = Object.keys(byCrop).map(cid => cropIcon(cid, 16)).join(" ");
      const basePlotId = `${browseSec}-${baseNo}`;

      // Build sleek horizontal chips for subplots (isolated spans to completely avoid any BiDi RTL/LTR inversion)
      // Only show actual sub-plots (with a part letter), not parent plots (which have empty part_letter)
      const realSubPlots = subPlots.filter(pl => (pl.part || pl.part_letter || '').trim() !== '');
      const subChips = realSubPlots.map(pl => {
        const cnt = grpPalms.filter(p => p.plot === pl.id).length;
        let partLetter = pl.part || pl.part_letter;
        if (!partLetter) {
          const m = (pl.id || '').match(/[A-Za-z]+$/);
          partLetter = m ? m[0] : (pl.name || pl.id);
        }
        const areaVal = Number(pl.areaValue || pl.area_value || pl.area || 0);
        const areaTxt = areaVal > 0 ? `${areaVal} فدان` : '';
        const cntTxt = `${cnt} أصل`;
        const metaParts = [areaTxt, cntTxt].filter(Boolean).join(" • ");
        const canManagePlots = hasPerm("plots_manage");

        return `<div class="subplot-chip ${canManagePlots ? 'clickable' : ''}" ${canManagePlots ? `data-act="open-edit-plot-modal" data-id="${pl.id}" title="تعديل بيانات الحوشة ${escapeHtml(partLetter)} مباشرة"` : `title="الحوشة ${escapeHtml(partLetter)}"`}>
          <span class="subplot-chip-part">حوشة ${escapeHtml(partLetter)}</span>
          <span class="subplot-chip-meta" dir="rtl">${metaParts}</span>
          ${canManagePlots ? `<span class="subplot-chip-pencil">✏️</span>` : ''}
        </div>`;
      }).join("");

      return `<div class="card plot-level2-card" style="border-right:4px solid var(--orange);display:flex;flex-direction:column;justify-content:space-between">
        <div>
          <!-- Header: Name, crop icons & quiet top-corner edit icon -->
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-size:16px">${cropIconsHeader || '🌴'}</span>
              <b style="font-size:16px;color:#0F172A">القطعة ${baseNo}</b>
              <span class="muted" style="font-size:11px">(${realSubPlots.length} حواشي)</span>
            </div>
            ${hasPerm("plots_manage") ? `
            <button type="button" class="btn btn-ghost icon-btn" data-act="open-edit-plot-modal" data-id="${basePlotId}" style="border:1px solid #FDE68A;background:#FFFBEB;color:#B45309;padding:3px 7px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer" title="تعديل بيانات القطعة الرئيسية ${baseNo}">
              ✏️
            </button>` : ''}
          </div>

          <!-- Subplots horizontal chips container -->
          <div class="subplot-chips-container" style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 10px">
            ${subChips || `<span class="muted" style="font-size:12px">لا توجد حواشي فرعية مسجلة</span>`}
          </div>

          <!-- Total assets summary line -->
          <div class="plot-card-total-summary" style="font-size:12px;color:#334155;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:6px 10px;margin-bottom:10px">
            📊 <b>الإجمالي:</b> <span style="font-weight:700;color:var(--green)">${grpPalms.length} أصل</span> <span style="font-size:11.5px;color:#64748B">(${cropSummaryText})</span>
          </div>
        </div>

        <!-- Footer Actions: Prominent View Trees Button + Barcode Icon Button + Round-trip Export -->
        <div style="padding-top:10px;border-top:1px solid #F1F5F9;display:flex;align-items:center;flex-wrap:wrap;gap:6px">
          <button type="button" class="btn btn-primary" data-act="open-bgroup" data-id="${baseNo}" style="flex:1;min-width:140px;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:12.5px;font-weight:700;padding:7px 12px;border-radius:8px">
            <span>👁️</span> استعراض أشجار القطعة (${grpPalms.length})
          </button>
          <button type="button" class="btn btn-ghost icon-btn" data-act="print-group-palms" data-sec="${browseSec}" data-id="${baseNo}" style="padding:7px 10px;border:1.5px solid #CBD5E1;color:#334155;background:#F8FAFC;border-radius:8px;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:4px;white-space:nowrap" title="طباعة باركود القطعة ${baseNo}">
            <span>🖨️</span> باركود
          </button>
          <button type="button" class="btn btn-ghost icon-btn" data-act="export-plot-roundtrip" data-id="${browseSec ? browseSec + '-' + baseNo : baseNo}" style="padding:7px 10px;border:1.5px solid #93C5FD;color:#1D4ED8;background:#EFF6FF;border-radius:8px;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:4px;white-space:nowrap" title="تصدير نخيل القطعة ${baseNo} للتعديل">
            <span>📥</span> تصدير للتعديل
          </button>
        </div>
      </div>`;
    }).join("")}</div>`;
  }

  // LEVEL 3: Plot group selected or specific plot selected or global search
  let currentGroupPlots = [];
  if (browsePlotGroup && browseSec) {
    const normBrowseSec = normalizeSectorCode(browseSec);
    currentGroupPlots = st.plots.filter(p => (p.sector === browseSec || p.sector_id === browseSec || normalizeSectorCode(p.sector || p.sector_id) === normBrowseSec) && plotBaseNumber(p) === browsePlotGroup);
  } else if (browsePlot) {
    const pl = st.plots.find(x => x.id === browsePlot || normalizePlotCode(x.id) === normalizePlotCode(browsePlot));
    if (pl) {
      currentGroupPlots = st.plots.filter(p => (p.sector === pl.sector || normalizeSectorCode(p.sector || p.sector_id) === normalizeSectorCode(pl.sector)) && plotBaseNumber(p) === plotBaseNumber(pl));
    }
  }

  const normBrowseSec = browseSec ? normalizeSectorCode(browseSec) : null;
  const normBrowsePlot = browsePlot ? normalizePlotCode(browsePlot) : null;
  const groupPlotSet = new Set();
  currentGroupPlots.forEach(pl => {
    groupPlotSet.add(pl.id);
    groupPlotSet.add(normalizePlotCode(pl.id));
  });

  const all = st.palms.filter(p => {
    if (isRestrictedRole && !userAssignedPlots.has(p.plot)) return false;
    if (normBrowsePlot) {
      if (p.plot !== browsePlot && normalizePlotCode(p.plot) !== normBrowsePlot) return false;
    } else if (browsePlotGroup && groupPlotSet.size) {
      if (!groupPlotSet.has(p.plot) && !groupPlotSet.has(normalizePlotCode(p.plot))) return false;
    } else if (normBrowseSec) {
      const palmSec = normalizeSectorCode(p.sector || p.sectorId || p.sector_id || (p.plot ? p.plot.split('-')[0] : ''));
      if (palmSec !== normBrowseSec) return false;
    }
    if (browseCrop && (p.cropId || "palm") !== browseCrop) return false;
    if (palmQ) {
      const q = palmQ.toUpperCase();
      const hit = p.code.toUpperCase().includes(q) || (p.variety||"").includes(palmQ) || (p.status||"").includes(palmQ) || cropName(p.cropId).includes(palmQ);
      if (!hit) return false;
    }
    return true;
  });

  all.sort((a, b) => {
    let vA, vB;
    if (palmSortCol === "code") {
      vA = a.code || ""; vB = b.code || "";
    } else if (palmSortCol === "plot") {
      vA = a.plot || ""; vB = b.plot || "";
    } else if (palmSortCol === "crop") {
      vA = cropName(a.cropId) || ""; vB = cropName(b.cropId) || "";
    } else if (palmSortCol === "variety") {
      vA = a.variety || ""; vB = b.variety || "";
    } else if (palmSortCol === "age") {
      vA = new Date(a.plantDate || 0).getTime(); vB = new Date(b.plantDate || 0).getTime();
    } else if (palmSortCol === "status") {
      vA = a.status || ""; vB = b.status || "";
    } else {
      vA = a[palmSortCol] || ""; vB = b[palmSortCol] || "";
    }
    if (vA < vB) return palmSortDir === "asc" ? -1 : 1;
    if (vA > vB) return palmSortDir === "asc" ? 1 : -1;
    return 0;
  });

  const rows = paginate(all, palmPage).map(p => {
    const last = lastOp(p.id, () => true);
    const c = cropOf(p);
    return `<tr>
      <td><input type="checkbox" class="pchk" value="${p.id}" ${selectedPalmIds.has(p.id)?"checked":""}></td>
      <td>${palmA(p.id, p.code)} <button class="btn btn-ghost icon-btn" data-act="open-palm" data-id="${p.id}">فتح</button></td>
      <td>${p.plot}</td>
      <td>${cropIcon(p.cropId||"palm", 16)} <span style="font-size:12px">${c.name}</span></td>
      <td><b>${p.variety}</b></td>
      <td>${sourceLabel(p)}</td>
      <td>${monthsSince(p.plantDate)} شهر</td>
      <td>${palmBadge(p)}</td>
      <td>${last ? typeName(last.typeId)+" · "+fmtDate(last.at) : "—"}</td>
      <td class="row-acts">
        ${hasPerm("ops_record") ? `<button class="btn btn-ghost icon-btn" data-act="go-op" data-id="${p.id}">+ عملية</button>` : ''}
        <button class="btn btn-ghost icon-btn" data-act="print-one" data-id="${p.id}">QR</button>
      </td>
    </tr>`;
  }).join("");

  const opOptions = st.operationTypes.filter(t => !t.inactive).map(t => {
    const cTag = t.cropId === "olive" ? "[زيتون] " : (t.cropId === "palm" ? "[نخيل] " : "[مشترك] ");
    return `<option value="${t.id}">${cTag}${t.name}</option>`;
  }).join("");

  const subPlotTabs = (currentGroupPlots.length > 1) ? `
    <div class="ptabs" style="margin-bottom:10px">
      <button class="${!browsePlot?'on':''}" data-act="select-sub-plot" data-id="">🌐 كافة القطع الداخلية (${currentGroupPlots.map(p=>p.part||p.id).join(" + ")})</button>
      ${currentGroupPlots.map(pl => {
        const cnt = all.filter(p => p.plot === pl.id || normalizePlotCode(p.plot) === normalizePlotCode(pl.id)).length;
        return `<button class="${browsePlot===pl.id?'on':''}" data-act="select-sub-plot" data-id="${pl.id}">🏷️ القطعة ${pl.part || pl.name || pl.id} (${cnt} أصل)</button>`;
      }).join("")}
    </div>
  ` : "";

  return `
  ${showPrintScopeModal ? renderPrintScopeModal(st) : ""}
  ${palmsTabs()}
  ${subPlotTabs}
  <div class="card">
    <div class="actions">
      <button class="btn btn-primary icon-btn" data-act="bulk-print">طباعة باركود المحدد (${selectedPalmIds.size})</button>
      <button class="btn btn-ghost icon-btn" data-act="print-current-scope" style="border:1px solid var(--green-d);color:var(--green-d);font-weight:700" title="طباعة كافة أكواد الباركود للنطاق المعروض حالياً">🖨️ طباعة باركود النطاق بالكامل (${all.length} أصل)</button>
      ${(browsePlot || browsePlotGroup) ? `
        <button class="btn btn-primary icon-btn" data-act="start-bulk-on-plot" data-id="${browsePlot || (browseSec ? browseSec + '-' + browsePlotGroup : browsePlotGroup)}" style="background:#16A34A;border-color:#15803D;color:#fff;font-weight:700">⚡ تنفيذ عملية جماعية على هذه القطعة</button>
        <button class="btn btn-ghost icon-btn" data-act="select-all-plot-palms" style="border:1.5px solid #059669;color:#059669;background:#F0FDF4;font-weight:700">☑️ تحديد كافة أشجار القطعة (${all.length})</button>
      ` : ""}
      ${selectedPalmIds.size > 0 ? `
        <button class="btn btn-primary icon-btn" data-act="bulk-op" style="background:#2563EB;border-color:#1D4ED8;color:#fff;font-weight:700">⚡ تطبيق عملية جماعية على المحدد (${selectedPalmIds.size})</button>
        <button class="btn btn-ghost icon-btn" data-act="bulk-clear-picks" style="color:#DC2626;border-color:#FCA5A5">إلغاء التحديد ✕</button>
      ` : ""}
      ${browsePlot ? `
        ${hasPerm("plots_manage") ? `<button class="btn btn-ghost icon-btn" data-act="open-edit-plot-modal" data-id="${browsePlot}" style="border:1.5px solid #F59E0B;color:#B45309;background:#FFFBEB;font-weight:700" title="تعديل بيانات وإحداثيات القطعة المعروضة">✏️ تعديل القطعة (${plotName(browsePlot)})</button>` : ''}
        ${hasPerm("plots_export") ? `<button class="btn btn-ghost icon-btn" data-act="export-plot-roundtrip" data-id="${browsePlot}" style="border:1.5px solid #2563EB;color:#1D4ED8;background:#EFF6FF;font-weight:700" title="تصدير شيت النخيل بصيغة مطابقة للاستيراد لتعديلها ثم إعادة رفعها">📥 تصدير نخيل القطعة للتعديل</button>` : ''}
        ${hasPerm("plots_gps_clear") ? `<button class="btn btn-ghost icon-btn" data-act="clear-plot-gps" data-id="${browsePlot}" style="border:1.5px solid #DC2626;color:#B91C1C;background:#FEF2F2;font-weight:700" title="تفريغ إحداثيات كافة أشجار هذه القطعة من الخريطة">🗑️ تفريغ إحداثيات القطعة</button>` : ''}
      ` : (browsePlotGroup && currentGroupPlots.length > 0 ? `
        ${hasPerm("plots_manage") ? `<button class="btn btn-ghost icon-btn" data-act="open-edit-plot-modal" data-id="${browseSec ? browseSec + '-' + browsePlotGroup : (currentGroupPlots[0]?.parentPlotId || browsePlotGroup)}" style="border:1.5px solid #F59E0B;color:#B45309;background:#FFFBEB;font-weight:700" title="تعديل بيانات وإحداثيات القطعة الرئيسية ${browsePlotGroup}">✏️ تعديل القطعة ${browsePlotGroup} (الرئيسية)</button>` : ''}
        ${currentGroupPlots.map(sp => `
          ${hasPerm("plots_manage") ? `<button class="btn btn-ghost icon-btn" data-act="open-edit-plot-modal" data-id="${sp.id}" style="border:1px solid #CBD5E1;color:#1E293B;background:#F8FAFC;font-size:12px;padding:5px 9px;border-radius:6px;font-weight:600" title="تعديل بيانات وإحداثيات القطعة الفرعية ${sp.part || sp.name || sp.id}">✏️ تعديل ${sp.part || sp.name || sp.id}</button>` : ''}
          ${hasPerm("plots_export") ? `<button class="btn btn-ghost icon-btn" data-act="export-plot-roundtrip" data-id="${sp.id}" style="border:1px solid #93C5FD;color:#1D4ED8;background:#EFF6FF;font-size:12px;padding:5px 9px;border-radius:6px;font-weight:600" title="تصدير شيت ${sp.part || sp.name || sp.id} للتعديل">📥 تصدير ${sp.part || sp.name || sp.id}</button>` : ''}
          ${hasPerm("plots_gps_clear") ? `<button class="btn btn-ghost icon-btn" data-act="clear-plot-gps" data-id="${sp.id}" style="border:1px solid #FCA5A5;color:#B91C1C;background:#FEF2F2;font-size:12px;padding:5px 9px;border-radius:6px;font-weight:600" title="تفريغ إحداثيات ${sp.part || sp.name || sp.id}">🗑️ تفريغ ${sp.part || sp.name || sp.id}</button>` : ''}
        `).join("")}
      ` : "")}
      ${(browsePlot || browsePlotGroup) ? `<button class="btn btn-ghost icon-btn" data-act="browse-all-plots">عرض كل القطع ✕</button>` : ""}
      ${palmQ ? `<button class="btn btn-ghost icon-btn" data-act="clear-palm-filter">إلغاء التصفية (${palmQ}) ✕</button>` : ""}
    </div>
    <input id="palmsearch" value="${palmQ}" placeholder="تصفية بالكود أو الصنف أو المحصول أو الحالة" />
    <div style="display:flex;justify-content:space-between;align-items:center;margin:8px 0;flex-wrap:wrap;gap:8px">
      <div class="muted" style="font-size:12.5px">${all.length} أصل / شجرة ${browsePlot ? "في " + plotName(browsePlot) : (browsePlotGroup ? "في القطعة " + browsePlotGroup : (palmQ ? "مطابقة للتصفية: " + palmQ : ""))}</div>
      <div style="display:flex;align-items:center;gap:6px">
        <span class="muted" style="font-size:12px">عرض في الصفحة:</span>
        <select id="palm_pagesize" data-act="change-palm-pagesize" style="width:auto;padding:3px 8px;font-size:12px;border-radius:6px">
          <option value="20" ${PAGE===20?"selected":""}>20 أصل</option>
          <option value="50" ${PAGE===50?"selected":""}>50 أصل</option>
          <option value="100" ${PAGE===100?"selected":""}>100 أصل</option>
          <option value="200" ${PAGE===200?"selected":""}>200 أصل</option>
          <option value="99999" ${PAGE>=99999?"selected":""}>الكل (${all.length})</option>
        </select>
      </div>
    </div>
    <div class="grid-wrap"><table class="dense">
      <thead><tr>
        <th style="width:38px;text-align:center"><input type="checkbox" id="pall"></th>
        <th class="sortable-th" data-act="sort-palms" data-col="code" title="ترتيب حسب الكود">الكود <span class="sort-icon ${palmSortCol==='code'?'active':''}">${palmSortCol==='code'?(palmSortDir==='asc'?'▲':'▼'):'⇅'}</span></th>
        <th class="sortable-th" data-act="sort-palms" data-col="plot" title="ترتيب حسب القطعة">القطعة <span class="sort-icon ${palmSortCol==='plot'?'active':''}">${palmSortCol==='plot'?(palmSortDir==='asc'?'▲':'▼'):'⇅'}</span></th>
        <th class="sortable-th" data-act="sort-palms" data-col="crop" title="ترتيب حسب المحصول">المحصول <span class="sort-icon ${palmSortCol==='crop'?'active':''}">${palmSortCol==='crop'?(palmSortDir==='asc'?'▲':'▼'):'⇅'}</span></th>
        <th class="sortable-th" data-act="sort-palms" data-col="variety" title="ترتيب حسب الصنف">الصنف <span class="sort-icon ${palmSortCol==='variety'?'active':''}">${palmSortCol==='variety'?(palmSortDir==='asc'?'▲':'▼'):'⇅'}</span></th>
        <th>المصدر</th>
        <th class="sortable-th" data-act="sort-palms" data-col="age" title="ترتيب حسب العمر">العمر <span class="sort-icon ${palmSortCol==='age'?'active':''}">${palmSortCol==='age'?(palmSortDir==='asc'?'▲':'▼'):'⇅'}</span></th>
        <th class="sortable-th" data-act="sort-palms" data-col="status" title="ترتيب حسب الحالة">الحالة <span class="sort-icon ${palmSortCol==='status'?'active':''}">${palmSortCol==='status'?(palmSortDir==='asc'?'▲':'▼'):'⇅'}</span></th>
        <th>آخر عملية</th>
        <th style="width:80px;text-align:center">إجراء</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    ${pager(all.length, palmPage, "palm-page")}
  </div>`;
}

function nextSuggestedSector() {
  const st = Store.get();
  const secs = (st.sectors || []).map(s => parseInt(toCleanDigits(s.id), 10)).filter(n => !isNaN(n));
  if (!secs.length) return "01";
  const maxSec = Math.max(...secs);
  return String(maxSec + 1).padStart(2, "0");
}

function updateGenCodesPreview(triggerId) {
  const box = $("#genPreviewBox");
  if (!box) return;
  const rawSec = toCleanDigits($("#gsec")?.value || "");
  const sec = rawSec ? rawSec.padStart(2, "0") : (genLastSector || nextSuggestedSector() || "03");
  const nplots = parseInt(toCleanDigits($("#gplots")?.value || "2"), 10) || 1;
  const start = parseInt(toCleanDigits($("#gstart")?.value || "1"), 10) || 1;
  const rawParts = ($("#gparts")?.value || "A,B").trim();
  const parts = rawParts.split(/[,،;\s]+/).map(x => x.trim().toUpperCase()).filter(Boolean);
  const partsList = parts.length ? parts : ["A"];

  const curCropId = $("#gcrop")?.value || genSelectedCrop || "palm";
  // معيار الكثافة الأكثر شيوعاً: 60 نخلة للفدان
  const stdDensity = (curCropId === "olive") ? 100 : 60;

  // حسابات المساحة وتقسيم القطع الفرعية تلقائياً
  const plotArea = parseFloat(toCleanDigits($("#gplot_area")?.value)) || 0;
  const plotAreaUnit = $("#gplot_area_unit")?.value || "فدان";
  const subPlotArea = (plotArea > 0 && partsList.length > 0) ? Number((plotArea / partsList.length).toFixed(3)) : 0;
  const secTotalArea = plotArea > 0 ? Number((plotArea * nplots).toFixed(2)) : 0;

  // تحويل المساحة إلى فدان لحساب الكثافة المعيارية بدقة (60 نخلة/فدان)
  function toFeddan(val, unit) {
    const v = parseFloat(val) || 0;
    if (v <= 0) return 0;
    if (unit === "قيراط") return v / 24;
    if (unit === "هكتار") return v * 2.381;
    if (unit === "متر مربع" || unit === "م²") return v / 4200.83;
    return v; // فدان
  }

  const plotFeddan = toFeddan(plotArea, plotAreaUnit);
  const subPlotFeddan = partsList.length > 0 ? (plotFeddan / partsList.length) : 0;
  const autoTreesPerPart = subPlotFeddan > 0 ? Math.round(subPlotFeddan * stdDensity) : 0;
  const autoTreesPlotTotal = plotFeddan > 0 ? Math.round(plotFeddan * stdDensity) : 0;

  // تحديث حقل عدد النخيل تلقائياً إذا كان التغيير قادماً من المساحة أو أجزاء القطعة أو المحصول
  const gcountEl = $("#gcount");
  if (gcountEl && (triggerId === "gplot_area" || triggerId === "gplot_area_unit" || triggerId === "gparts" || triggerId === "gcrop" || triggerId === "init")) {
    if (autoTreesPerPart > 0) {
      gcountEl.value = autoTreesPerPart;
    }
  }

  const count = parseInt(toCleanDigits(gcountEl?.value || (autoTreesPerPart ? String(autoTreesPerPart) : "10")), 10) || 1;
  const total = nplots * partsList.length * count;
  const density = (subPlotArea > 0 && count > 0) ? Number((count / subPlotArea).toFixed(1)) : 0;

  const src = $("#gsrc")?.value || (curCropId === "olive" ? "C" : (curCropId === "mango" ? "G" : "F"));
  const date = $("#gdate")?.value || new Date().toISOString().slice(0, 10);
  const mmyy = mmYY(date);

  const firstPno = String(start).padStart(2, "0");
  const firstPart = partsList[0];
  const firstCode = `${sec}-${firstPno}${firstPart}-${src}001-${mmyy}`;

  const lastPno = String(start + nplots - 1).padStart(2, "0");
  const lastPart = partsList[partsList.length - 1];
  const lastSeq = String(count).padStart(3, "0");
  const lastCode = `${sec}-${lastPno}${lastPart}-${src}${lastSeq}-${mmyy}`;

  const pCntEl = $("#prev_plots_cnt");
  const prtCntEl = $("#prev_parts_cnt");
  const trCntEl = $("#prev_trees_cnt");
  const totEl = $("#prev_total_cnt");
  const fcEl = $("#prev_first_code");
  const lcEl = $("#prev_last_code");

  if (pCntEl) pCntEl.textContent = `${nplots} قطعة`;
  if (prtCntEl) prtCntEl.textContent = `${partsList.length} أجزاء (${partsList.join(",")})`;
  if (trCntEl) trCntEl.textContent = `${count} أصل/جزء`;
  if (totEl) totEl.textContent = `${total} أصل / شجرة`;
  if (fcEl) fcEl.textContent = firstCode;
  if (lcEl) lcEl.textContent = lastCode;

  // تحديث شريط تقسيم المساحات وحساب النخيل التلقائي
  const sAreaValEl = $("#prev_sub_area_val");
  const sAreaUnitEl = $("#prev_sub_area_unit");
  const sAreaFormulaEl = $("#prev_sub_area_formula");
  const plotTreesTotEl = $("#prev_plot_trees_total");
  const secTotalAreaEl = $("#prev_sec_total_area");
  const areaChipEl = $("#prev_area_chip");
  const countHintEl = $("#gcount_hint");

  if (sAreaValEl) sAreaValEl.textContent = subPlotArea > 0 ? subPlotArea : "—";
  if (sAreaUnitEl) sAreaUnitEl.textContent = plotAreaUnit;
  if (sAreaFormulaEl) {
    sAreaFormulaEl.textContent = plotArea > 0 
      ? `(${plotArea} ${plotAreaUnit} ÷ ${partsList.length} ${partsList.length === 1 ? 'جزء' : 'أجزاء'})`
      : "(أدخل مساحة القطعة لحساب مساحة كل جزء فرعي تلقائياً)";
  }
  if (plotTreesTotEl) {
    plotTreesTotEl.textContent = autoTreesPlotTotal > 0 ? `${autoTreesPlotTotal} شجرة` : "—";
  }
  if (secTotalAreaEl) secTotalAreaEl.textContent = secTotalArea > 0 ? `${secTotalArea} ${plotAreaUnit}` : "—";

  if (countHintEl) {
    if (autoTreesPerPart > 0) {
      if (count === autoTreesPerPart) {
        countHintEl.innerHTML = `💡 محسوب آلياً: <b>${autoTreesPerPart}</b> نخلة/جزء (${autoTreesPlotTotal} للقطعة ÷ ${partsList.length} أجزاء بمعيار 60 نخلة/فدان).`;
        countHintEl.style.color = "#15803d";
      } else {
        countHintEl.innerHTML = `✏️ قيمة مخصصة يدوياً: <b>${count}</b> نخلة/جزء (المعيار الشائع المقترح: <b>${autoTreesPerPart}</b> نخلة).`;
        countHintEl.style.color = "#0369a1";
      }
    } else {
      countHintEl.innerHTML = `💡 أدخل عدد الأشجار في كل جزء فرعي.`;
      countHintEl.style.color = "#64748B";
    }
  }

  if (areaChipEl) {
    areaChipEl.innerHTML = plotArea > 0 
      ? `📐 مساحة القطعة: <b>${plotArea} ${plotAreaUnit}</b> (الفرعية: <b style="color:#15803d">${subPlotArea} ${plotAreaUnit}</b>) • الكثافة الفعلية: <b>${density}</b> ${curCropId === 'olive' ? 'شجرة' : 'نخلة'}/${plotAreaUnit} • إجمالي القطاع: <b>${secTotalArea} ${plotAreaUnit}</b>`
      : "";
  }
}
window.resetGCountToStandard = function() {
  updateGenCodesPreview("gplot_area");
};

function generateView() {
  if (!hasPerm("palms_add")) {
    return `<div class="card" style="text-align:center;padding:24px">
      <h3>⚠️ غير مصرح</h3>
      <p class="muted">ليس لديك صلاحية توليد وتكويد أكواد أشجار جديدة.</p>
      <button class="btn btn-primary" data-act="back" style="margin-top:10px">رجوع</button>
    </div>`;
  }
  const batch = Store.get().lastPrintBatch || [];
  const st = Store.get();
  const crops = (st.crops || []).filter(c => c.active);
  const curCropId = genSelectedCrop || crops[0]?.id || "palm";
  const defCrop = crops.find(c => c.id === curCropId) || crops[0] || { id: "palm", name: "نخيل التمر", plural: "نخيل" };
  const defSources = (typeof getCropPlantingSources === "function") ? getCropPlantingSources(curCropId) : (defCrop.sources || [{ code: "F", name: "فسيلة" }, { code: "N", name: "نسيج" }]);

  const staged = st.stagedBatch;
  const stagedCard = staged ? `
    <div class="card" style="border: 2px solid #0284C7; background: #F0F9FF; margin-bottom: 18px; border-radius: 12px; padding: 18px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05)">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:14px; flex-wrap:wrap">
        <div>
          <div style="display:flex; gap:8px; align-items:center; margin-bottom:6px">
            <span class="badge" style="background:#0284C7; color:#fff; font-size:12px; font-weight:700">📋 مسودة بانتظار المراجعة والاعتماد</span>
            <span class="muted" style="font-size:12px">لم يتم تثبيت الأصول في الداتا بيز بعد</span>
          </div>
          <h3 style="margin:0 0 6px 0; color:#0369A1; font-size:18px">
            ${cropIcon(staged.cropId, 22)} مراجعة مسودة القطاع: ${escapeHtml(staged.secName)} (كود: <code>${staged.secId}</code>)
          </h3>
          <div style="font-size:13px; color:#334155; line-height:1.7">
            المحصول: <b>${staged.cropName}</b> • الصنف: <b>${staged.variety}</b> • المصدر: <b>${sourceLabel({ source: staged.source, cropId: staged.cropId })}</b> • تاريخ الغرس: <b>${staged.plantDate}</b><br>
            إجمالي التوليد المقترح: <b style="color:#0369A1; font-size:15px">${staged.totalTrees} أصل / شجرة</b> موزعة على <b>${staged.totalPlots} قطعة فرعية</b>.<br>
            ${staged.subPlotArea ? `
              <div style="margin-top:3px; color:#166534">
                📐 مساحة القطعة الأساسية: <b>${staged.plotArea} ${staged.areaUnit || 'فدان'}</b> ➔ مساحة كل جزء فرعي: <b style="background:#DCFCE7; padding:2px 7px; border-radius:5px; color:#15803d">${staged.subPlotArea} ${staged.areaUnit || 'فدان'}</b>
                ${staged.totalSecArea ? `• إجمالي مساحة القطاع: <b>${staged.totalSecArea} ${staged.areaUnit || 'فدان'}</b>` : ''}
              </div>
            ` : ''}
            <span class="muted" style="font-size:11.5px">عينة الأكواد المتولدة: <code style="background:#E0F2FE; padding:1px 6px; border-radius:4px">${staged.sampleCodes.join("</code> ، <code style='background:#E0F2FE; padding:1px 6px; border-radius:4px'>")}</code> ${staged.totalTrees > 5 ? '...' : ''}</span>
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px; min-width:200px">
          <button class="btn btn-primary" data-act="commit-staged-batch" style="background:#16A34A; border-color:#16A34A; font-weight:800; font-size:14px; padding:10px 18px; box-shadow:0 2px 4px rgba(22,163,74,0.3)">
            ✅ اعتماد وتفعيل القطاع والأصول
          </button>
          <button class="btn btn-ghost" data-act="cancel-staged-batch" style="color:#DC2626; border:1px solid #FECACA; background:#fff; font-size:13px; padding:8px 14px">
            ❌ إلغاء وتراجع (حذف المسودة)
          </button>
        </div>
      </div>
    </div>
  ` : "";

  const batchCard = batch.length ? `
    <div class="card" style="border: 2px solid #2E7D32; background: rgba(46, 125, 50, 0.06); margin-bottom: 16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div>
          <h3 style="color:#1B5E20;margin:0 0 4px 0">✅ أحدث دفعة أكواد جاهزة (${batch.length} كود)</h3>
          <p class="muted" style="margin:0">تم تسجيل وتوليد الأكواد بنجاح. يمكنك تصدير ملصقات الباركود أو طباعتها فوراً، أو توليد قطاع جديد أدناه.</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-primary icon-btn" data-act="export-codes">🖨️ طباعة وتصدير الباركود (${batch.length})</button>
          <button class="btn btn-ghost icon-btn" data-go="palms">🌴 الذهاب للحقل</button>
          <button class="btn btn-ghost icon-btn" data-act="new-batch" title="إخفاء هذا الإشعار">✕ إغلاق الإشعار</button>
        </div>
      </div>
    </div>
  ` : "";

  const autoSec = genLastSector || nextSuggestedSector();
  const autoSecName = `القطاع ${autoSec}`;

  return `${palmsTabs()}${stagedCard}${batchCard}<div class="card">
    <h3>إنشاء قطاع وتوليد الأكواد</h3>
    <p class="muted" style="margin-top:-6px;margin-bottom:14px">توليد وتكويد تلقائي مجمع لقطع وأشجار القطاع وفق معايير التكويد الموحدة للمزرعة.</p>
    <!-- السطر الأول: بيانات المحصول والقطاع (4 حقول في السطر) -->
    <div class="grid grid-4" style="margin-bottom:10px">
      <div>
        <label>المحصول المستهدف</label>
        <select id="gcrop" data-act="change-gencrop">
          ${crops.map(c => `<option value="${c.id}" ${curCropId===c.id?"selected":""}>${cropTextLabel(c)}</option>`).join("")}
        </select>
      </div>
      <div>
        <label>تاريخ الزراعة</label>
        <input id="gdate" type="date" value="${new Date().toISOString().slice(0,10)}" />
      </div>
      <div>
        <label>رقم/كود القطاع <span style="color:#d32f2f">*</span></label>
        <input id="gsec" value="${escapeHtml(autoSec)}" placeholder="مثال: 04 أو 4" />
      </div>
      <div>
        <label>اسم القطاع</label>
        <input id="gsecn" value="${escapeHtml(autoSecName)}" placeholder="مثال: قطاع 4" />
      </div>
    </div>

    <!-- السطر الثاني: تقسيم القطع والمساحة (4 حقول في السطر) -->
    <div class="grid grid-4" style="margin-bottom:10px">
      <div>
        <label>عدد القطع في القطاع <span style="color:#d32f2f">*</span></label>
        <input id="gplots" type="text" inputmode="numeric" value="2" />
      </div>
      <div>
        <label>رقم أول قطعة</label>
        <input id="gstart" type="text" inputmode="numeric" value="1" />
      </div>
      <div>
        <label>مساحة القطعة الإجمالية <span class="muted" style="font-size:11px">(للقطعة الواحدة)</span></label>
        <div style="display:flex;gap:6px">
          <input id="gplot_area" type="number" step="any" min="0" value="5" placeholder="مثال: 5" style="flex:1" />
          <select id="gplot_area_unit" style="width:95px">
            <option value="فدان" selected>فدان</option>
            <option value="قيراط">قيراط</option>
            <option value="هكتار">هكتار</option>
            <option value="متر مربع">م²</option>
          </select>
        </div>
      </div>
      <div>
        <label>أجزاء كل قطعة <span style="color:#d32f2f">*</span> <span class="muted" style="font-size:11px">(مفصولة بفاصلة)</span></label>
        <input id="gparts" value="A,B" placeholder="مثال: A,B أو A,B,C,D" />
      </div>
    </div>

    <!-- شريط الحسابات الذكية الفورية -->
    <div id="genSubPlotAreaNotice" style="background:#F0FDF4;border:1.5px solid #86EFAC;border-radius:10px;padding:10px 14px;margin:2px 0 12px;font-size:12.5px;color:#166534;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:6px">
          <span>📐 <b>مساحة كل جزء فرعي:</b></span>
          <b id="prev_sub_area_val" style="font-size:14px;color:#15803d;background:#DCFCE7;padding:2px 8px;border-radius:6px">2.5</b>
          <span id="prev_sub_area_unit" style="font-weight:700">فدان</span>
          <span class="muted" id="prev_sub_area_formula" style="font-size:11px">(5 فدان ÷ 2 أجزاء)</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;border-right:1.5px solid #BBF7D0;padding-right:12px">
          <span>🌴 <b>إجمالي نخيل القطعة:</b></span>
          <b id="prev_plot_trees_total" style="font-size:14px;color:#047857;background:#DCFCE7;padding:2px 8px;border-radius:6px">300 نخلة</b>
          <span class="muted" style="font-size:11px">(بمعيار 60 نخلة/فدان)</span>
        </div>
      </div>
      <div id="prev_sec_total_area_wrap" style="font-size:12px;color:#047857">
        🌐 إجمالي مساحة القطاع: <b id="prev_sec_total_area">10 فدان</b>
      </div>
    </div>

    <!-- السطر الثالث: الأشجار والتصنيف (3 حقول في السطر) -->
    <div class="grid grid-3" style="margin-bottom:12px">
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <label id="gcount_lbl" style="margin:0 0 6px 0">عدد ${defCrop.plural || "الأشجار"} لكل جزء <span style="color:#d32f2f">*</span></label>
          <span id="gcount_auto_badge" style="font-size:11px;color:#15803d;font-weight:bold;cursor:pointer;background:#DCFCE7;padding:1px 6px;border-radius:4px" title="إعادة ضبط القيمة على المعيار الشائع (60 نخلة/فدان)" onclick="window.resetGCountToStandard && window.resetGCountToStandard()">⚡ معيار 60/فدان</span>
        </div>
        <input id="gcount" type="text" inputmode="numeric" value="150" />
        <div style="font-size:11px;color:#15803d;margin-top:3px" id="gcount_hint">
          💡 محسوب آلياً بناءً على المساحة (60 نخلة/فدان) — قابل للتعديل يدوياً.
        </div>
      </div>
      <div>
        <label style="margin:0 0 6px 0">مصدر الزراعة الافتراضي</label>
        <select id="gsrc">
          ${defSources.map(s => `<option value="${s.code}">${s.code} - ${s.name}</option>`).join("")}
        </select>
      </div>
      <div>
        <label style="margin:0 0 6px 0">الصنف الافتراضي</label>
        <select id="gvar">${varietyOptions(null, curCropId)}</select>
      </div>
    </div>

    <!-- Live Preview Box -->
    <div id="genPreviewBox" style="background:rgba(46,125,50,0.08);border:1px dashed #2E7D32;border-radius:8px;padding:12px;margin:14px 0;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div>
          <b>📊 إجمالي التوليد المتوقع:</b>
          <span id="prev_plots_cnt" style="font-weight:bold;color:#1B5E20">2 قطعة</span> × 
          <span id="prev_parts_cnt" style="font-weight:bold;color:#1B5E20">2 أجزاء (A,B)</span> × 
          <span id="prev_trees_cnt" style="font-weight:bold;color:#1B5E20">10 أصل/جزء</span> = 
          <span id="prev_total_cnt" class="badge" style="background:#1B5E20;color:#fff;font-size:13px;padding:3px 8px;border-radius:6px">20 أصل / شجرة</span>
        </div>
      </div>
      <div id="prev_area_chip" style="margin-top:6px;font-size:12px;color:#166534"></div>
      <div style="margin-top:6px;font-size:12px;color:#444;display:flex;gap:14px;flex-wrap:wrap">
        <span>🏷️ نموذج أول كود: <code id="prev_first_code" style="direction:ltr;display:inline-block;font-weight:bold">03-01A-F001-...</code></span>
        <span>🏷️ نموذج آخر كود: <code id="prev_last_code" style="direction:ltr;display:inline-block;font-weight:bold">03-02B-F010-...</code></span>
      </div>
    </div>

    <button class="btn btn-primary" data-act="gen-codes" style="margin-top:4px;width:100%;font-size:15px;padding:10px">🚀 إنشاء وتوليد الأكواد</button>
    <div id="genOut" style="margin-top:10px"></div>
  </div>`;
}

function plantableSuckers(filterCrop = null, filterVariety = null) {
  const st = Store.get();
  const used = new Set(st.palms.map(p => p.parentCode || p.tempCode).filter(Boolean));
  const palmCodes = new Set(st.palms.map(p => p.code).filter(Boolean));
  const rows = [];
  st.offshoots.forEach(o => {
    const mom = palmById(o.motherId);
    const oCrop = o.cropId || mom?.cropId || "palm";
    if (filterCrop && oCrop !== filterCrop) return;
    if (o.newPalmId || o.nsStatus === "planted" || o.isPlanted || osStage(o) === "planted") return;
    if (used.has(o.tempCode) || (o.plantedPalmCode && palmCodes.has(o.plantedPalmCode))) return;

    const isReadyOrIssued = o.nsStatus === "ready" || o.nsStatus === "issued" || o.nsStatus === "dispatched" || osStage(o) === "ready" || osStage(o) === "issued";
    if (!isReadyOrIssued) return;

    const varName = o.variety || mom?.variety || "";
    if (filterVariety && varName && varName !== filterVariety) return;

    let statusDesc = "جاهزة بالمشتل";
    if (o.nsStatus === "dispatched") statusDesc = "صرفت للحقل (بانتظار استلام)";
    else if (o.nsStatus === "issued") statusDesc = "صرفت ومستلمة بالحقل";

    rows.push({
      id: o.id, kind: "internal", code: o.tempCode, variety: varName,
      cropId: oCrop, statusDesc, nsStatus: o.nsStatus,
      offshootDate: (o.date || o.at || "").slice(0,10), motherId: o.motherId, motherCode: mom?.code || (o.is_opening_stock ? "رصيد افتتاحي" : ""),
      supplier: o.supplier || ""
    });
  });
  (st.nurseryItems || []).forEach(n => {
    const nCrop = n.cropId || (["C", "S", "T"].includes(n.source) ? "olive" : "palm");
    if (filterCrop && nCrop !== filterCrop) return;
    if (n.newPalmId || n.nsStatus === "planted" || n.isPlanted || osStage(n) === "planted") return;
    if (used.has(n.code) || (n.plantedPalmCode && palmCodes.has(n.plantedPalmCode))) return;

    const isReadyOrIssued = n.nsStatus === "ready" || n.nsStatus === "issued" || n.nsStatus === "dispatched" || osStage(n) === "ready" || osStage(n) === "issued";
    if (!isReadyOrIssued) return;

    const varName = n.variety || "";
    if (filterVariety && varName && varName !== filterVariety) return;

    let statusDesc = "جاهزة بالمشتل";
    if (n.nsStatus === "dispatched") statusDesc = "صرفت للحقل (بانتظار استلام)";
    else if (n.nsStatus === "issued") statusDesc = "صرفت ومستلمة بالحقل";

    rows.push({
      id: n.id, kind: "buy", code: n.code, variety: varName,
      cropId: nCrop, statusDesc, nsStatus: n.nsStatus,
      offshootDate: (n.entryDate || n.at || "").slice(0,10), motherId: null, motherCode: "",
      supplier: n.supplier || ""
    });
  });
  return rows;
}

function suckerByCode(code, cropId = null) {
  if (!code) return null;
  return plantableSuckers(cropId).find(s => codesEqual(s.code, code) || normCode(s.code) === normCode(code));
}

let palmNewSuckerFilter = "all";

// Values typed in the add-tree form survive re-renders (choosing a crop or nursery offshoot re-draws the form)
let palmNewDraft = {};
const PALM_NEW_FIELDS = ["nplot", "nseq", "ndate", "nvar", "nori", "nsup", "nbatch", "nnotes", "nsource"];
document.addEventListener("input", e => { if (current === "palm-new" && e.target && PALM_NEW_FIELDS.includes(e.target.id)) palmNewDraft[e.target.id] = e.target.value; }, true);
document.addEventListener("change", e => { if (current === "palm-new" && e.target && PALM_NEW_FIELDS.includes(e.target.id)) palmNewDraft[e.target.id] = e.target.value; }, true);

function palmNewView() {
  if (!hasPerm("palms_add")) {
    return `<div class="card" style="text-align:center;padding:24px">
      <h3>⚠️ غير مصرح</h3>
      <p class="muted">ليس لديك صلاحية إضافة وتكويد أشجار جديدة في الحقل.</p>
      <button class="btn btn-primary" data-act="back" style="margin-top:10px">رجوع</button>
    </div>`;
  }
  const st = Store.get();
  const crops = (st.crops || []).filter(c => c.active);
  const curCropId = palmNewCrop || crops[0]?.id || "palm";
  const defCrop = crops.find(c => c.id === curCropId) || crops[0] || { id: "palm", name: "نخيل التمر", single: "نخلة", offspring: "فسيلة" };
  const defSources = (typeof getCropPlantingSources === "function") ? getCropPlantingSources(curCropId) : (defCrop.sources || [{ code: "F", name: "فسيلة" }, { code: "N", name: "نسيج" }]);
  
  const allStock = plantableSuckers(curCropId);
  const lineageCount = allStock.filter(s => Boolean(s.motherId || (s.motherCode && s.motherCode !== "رصيد افتتاحي"))).length;
  const openingCount = allStock.length - lineageCount;

  const stock = allStock.filter(s => {
    const hasMother = Boolean(s.motherId || (s.motherCode && s.motherCode !== "رصيد افتتاحي"));
    if (palmNewSuckerFilter === "lineage") return hasMother;
    if (palmNewSuckerFilter === "opening") return !hasMother;
    return true;
  });
  const selSucker = allStock.find(s => codesEqual(s.code, palmNewSuckerCode));

  return `${palmsTabs()}<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid var(--line);padding-bottom:10px">
      <h3 id="pnew_title" style="margin:0">+ إضافة ${defCrop.single || "أصل"} جديد (${defCrop.name})</h3>
      <button class="btn btn-ghost icon-btn" data-act="back" style="font-size:12.5px">↩️ رجوع للقائمة</button>
    </div>

    <!-- 2-Column Balanced Form Grid -->
    <div class="tree-form-grid">
      <!-- Row 1: Crop + Source -->
      <div>
        <label>المحصول <span style="color:#d32f2f">*</span></label>
        <select id="ncrop" data-act="change-pnew-crop">
          ${crops.map(c => `<option value="${c.id}" ${curCropId===c.id?"selected":""}>${cropTextLabel(c)}</option>`).join("")}
        </select>
      </div>
      <div>
        <label>مصدر الزراعة <span style="color:#d32f2f">*</span></label>
        <select id="nsource">
          ${defSources.map(s => `<option value="${s.code}" ${palmNewDraft.nsource === s.code ? "selected" : ""}>${s.name} (${s.code})</option>`).join("")}
        </select>
      </div>

      <!-- Row 2: Plot + Seq -->
      <div>
        <label>القطعة <span style="color:#d32f2f">*</span></label>
        <select id="nplot">${plotOptionsHtml(st.plots, { selected: palmNewDraft.nplot, counts: true })}</select>
      </div>
      <div>
        <label>الرقم داخل القطعة <span style="color:#d32f2f">*</span></label>
        <input id="nseq" placeholder="045" value="${escapeHtml(palmNewDraft.nseq || "")}" />
      </div>

      <!-- Row 3: Plant Date + Variety -->
      <div>
        <label>تاريخ الزراعة <span style="color:#d32f2f">*</span></label>
        <input id="ndate" type="date" value="${palmNewDraft.ndate || new Date().toISOString().slice(0,10)}" />
      </div>
      <div>
        <label>الصنف / الأصل التفصيلي <span style="color:#d32f2f">*</span></label>
        <select id="nvar">${varietyOptions(selSucker?.variety || palmNewDraft.nvar || "خلاص", curCropId)}</select>
      </div>
    </div>

    <!-- Detailed Origin -->
    <div style="margin-bottom:12px">
      <label>نوع التوريد / الأصل التفصيلي</label>
      <select id="nori">
        <option value="internal">داخلي (من المشتل / المزرعة)</option>
        <option value="purchased" ${palmNewDraft.nori === "purchased" ? "selected" : ""}>خارجي / شراء مباشر</option>
      </select>
    </div>

    <!-- Nursery Connection Box -->
    <div id="intBox" class="card ${palmNewDraft.nori === "purchased" ? "hidden" : ""}" style="background:var(--green-l);margin:12px 0;padding:14px;border-radius:10px;border:1px solid #C8E6C9">
      <h4 id="propTitle" style="margin:0 0 8px 0;color:var(--green-d)">ربط ${defCrop.offspring || "الفسيلة / الشتلة"} والنسب من المشتل</h4>
      
      <!-- Horizontal Segmented Filter Bar -->
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px">
        <span style="font-size:12px;font-weight:700;color:var(--muted)">فلترة الشتلات:</span>
        <div class="nursery-segmented-wrap">
          <button type="button" class="nursery-seg-btn ${palmNewSuckerFilter==='all'?'active':''}" data-act="filter-sucker-mode" data-id="all">
            الكل (${allStock.length})
          </button>
          <button type="button" class="nursery-seg-btn ${palmNewSuckerFilter==='lineage'?'active':''}" data-act="filter-sucker-mode" data-id="lineage">
            🌴 مفصولة من أم (${lineageCount})
          </button>
          <button type="button" class="nursery-seg-btn ${palmNewSuckerFilter==='opening'?'active':''}" data-act="filter-sucker-mode" data-id="opening">
            📦 رصيد افتتاحي / شراء (${openingCount})
          </button>
        </div>
      </div>

      <label id="propLbl" style="font-size:12.5px">اختر ${defCrop.offspring || "الفسيلة / الشتلة"} الجاهزة أو المصروفة بالمشتل (${stock.length} متاح):</label>
      <div class="nursery-picker-row">
        <div class="picker-select">
          <select id="nsucker_sel" data-act="sel-sucker" style="width:100%">
            <option value="">-- اضغط للاختيار السريع (${stock.length} شتلة متاحة حسب الفلتر) --</option>
            ${stock.map(s => {
              const hasMother = Boolean(s.motherId || (s.motherCode && s.motherCode !== "رصيد افتتاحي"));
              const lineageTag = hasMother ? `(نخلة الأم: ${s.motherCode})` : `(رصيد مشتل مباشر / شراء)`;
              const stageTag = s.nsStatus === "ready" ? "جاهزة بالمشتل" : "منصرفة للحقل";
              return `<option value="${s.code}" ${palmNewSuckerCode===s.code?'selected':''}>${s.code} — صنف: ${s.variety||'غير محدد'} • ${lineageTag} [${stageTag}]</option>`;
            }).join("")}
          </select>
        </div>
        <button type="button" class="btn btn-ghost icon-btn" data-act="start-scan" style="white-space:nowrap;padding:7px 14px">📷 مسح QR الأصل</button>
      </div>

      <div style="margin-bottom:6px">
        <input id="nsuckerq" list="sucklist" value="${palmNewSuckerCode||""}" placeholder="أو اكتب/ابحث بالكود مثل OS01 أو NUR..." style="width:100%" />
        <datalist id="sucklist">${stock.map(s=>`<option value="${s.code}">${s.variety} — ${s.motherCode||"رصيد افتتاحي/شراء"}</option>`).join("")}</datalist>
      </div>

      <div id="suckerHint" style="margin-top:6px">
        ${selSucker ? `
          <div class="chip" style="background:#DCFCE7;color:#166534;font-size:12.5px;padding:6px 12px;border:1px solid #86EFAC">
            ✅ <b>تم الربط:</b> ${codeHtml(selSucker.code)} • الصنف: <b>${selSucker.variety||'—'}</b> • ${selSucker.statusDesc} ${selSucker.motherCode ? `• الشجرة الأم: <b>${selSucker.motherCode}</b>` : '• (رصيد افتتاحي / شراء مباشر)'}
            ${selSucker.nsStatus === 'ready' ? '<span class="status st-wait" style="margin-right:6px;font-size:11px">🌿 سيتم توثيق نقل العهدة من المشتل للحقل فور الحفظ</span>' : ''}
          </div>
        ` : (stock.length ? `<span class="muted" style="font-size:12px">💡 يوجد <b>${stock.length}</b> أصل متاح وفق الفلتر لمحصول ${defCrop.name}. اختر من القائمة لتعبئة الصنف والنسب تلقائياً.</span>` : `<span style="color:#C62828;font-weight:700;font-size:12px">⚠️ لا توجد شتلات متاحة بهذا الفلتر لمحصول ${defCrop.name} في المشتل.</span>`)}
      </div>
    </div>

    <!-- Purchase Box -->
    <div id="buyBox" class="${palmNewDraft.nori === "purchased" ? "" : "hidden"} tree-form-grid" style="margin-top:10px">
      <div><label>اسم المورد</label><input id="nsup" value="${escapeHtml(palmNewDraft.nsup || "")}" /></div>
      <div><label>كود المورد / دفعة الشراء</label><input id="nbatch" placeholder="B2408-F001-0826" value="${escapeHtml(palmNewDraft.nbatch || "")}" /></div>
    </div>

    <!-- Notes -->
    <label>ملاحظات</label>
    <textarea id="nnotes" class="tree-notes-compact" placeholder="أي ملاحظات إضافية حول الأصل أو تاريخ الزراعة...">${escapeHtml(palmNewDraft.nnotes || "")}</textarea>

    <!-- Centered Action Buttons -->
    <div class="tree-actions-center">
      <button class="btn btn-primary btn-save" data-act="save-palm">💾 حفظ الشجرة / الأصل</button>
      <button class="btn btn-ghost btn-cancel" data-act="back">↩️ إلغاء / رجوع</button>
    </div>
  </div>`;
}

