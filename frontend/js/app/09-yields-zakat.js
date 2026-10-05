// PalmTrace app — Operation details, harvests/yields, zakat administration
// (split from the former single app.js; files are classic scripts loaded in order by index.html)

function opDetailView(id) {
  const st = Store.get();
  const o = (st.operations || []).find(x => x.id === id);
  if (!o) return `<div class="card">غير موجودة</div>`;
  const p = palmById(o.palmId);
  const w = userBy(o.workerId);
  const canApprove = session().role === "admin" || session().role === "engineer";
  const isBatch = Boolean(o.isBatch || o.batchId || o.bulkId || (o.device && o.device.startsWith("bulk:")));
  const batchId = o.batchId || o.bulkId || (o.device && o.device.startsWith("bulk:") ? o.device.replace("bulk:", "") : null) || o.id;

  const targetScopeHtml = p ? `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      ${codeHtml(p.code)}
      <span class="badge" style="background:#F1F5F9;color:#475569">🌴 نخلة فردية (${p.variety || 'خلاص'})</span>
    </div>
  ` : (() => {
    let plotId = o.plotId;
    let sectorId = o.sectorId;
    if (!plotId && !sectorId && o.notes && o.notes.includes("[جماعي")) {
      const m = o.notes.match(/\[جماعي\s*([^\]]+)\]/);
      if (m) {
        const rawLoc = m[1].replace(/قطعة|قطاع/g, "").trim();
        const foundPl = st.plots.find(pl => pl.id === rawLoc || pl.name === rawLoc || (pl.part && pl.part === rawLoc) || (pl.name && pl.name.includes(rawLoc)));
        if (foundPl) {
          plotId = foundPl.id;
          sectorId = foundPl.sector;
        } else {
          const foundSec = st.sectors.find(s => s.id === rawLoc || s.name === rawLoc || (s.name && s.name.includes(rawLoc)));
          if (foundSec) sectorId = foundSec.id;
        }
      }
    }
    const pl = st.plots.find(pl => pl.id === plotId || pl.name === plotId);
    const secId = sectorId || pl?.sector;
    const sec = st.sectors.find(s => s.id === secId || s.name === secId);
    const secLabel = sec?.name ? (sec.name.includes("قطاع") ? sec.name : `قطاع ${sec.name}`) : (secId ? `قطاع ${secId}` : "");
    const plLabel = pl?.name ? (pl.name.includes("قطعة") ? pl.name : `قطعة ${pl.name}`) : (plotId ? `قطعة ${plotId}` : "");
    const loc = (secLabel && plLabel) ? `${secLabel} • ${plLabel}` : plLabel || secLabel || "عملية مجمعة";
    return `
      <div style="display:inline-flex;align-items:center;gap:8px;background:#EFF6FF;border:1px solid #BFDBFE;padding:6px 12px;border-radius:8px;margin-bottom:8px">
        <span style="font-size:16px">📦</span>
        <b style="color:#1D4ED8">نطاق العملية: 📍 ${loc}</b>
        <span class="badge" style="background:#2563EB;color:#fff">${o.treeCount || 1} شجرة مشمولة</span>
      </div>
    `;
  })();

  return `
    ${renderOpRejectionModal(st)}
    <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <h3 style="margin:0">${typeName(o.typeId)}</h3>
      ${isBatch ? `<button class="btn btn-ghost btn-sm" data-act="inspect-batch" data-id="${batchId}" data-batch="${batchId}" style="border:1.5px solid #3B82F6;color:#1D4ED8;background:#EFF6FF;font-weight:700">👁️ معاينة الحزمة والأشجار</button>` : ''}
    </div>
    ${targetScopeHtml}
    <p>التاريخ: <b>${fmtDate(o.at)}</b> ${o.at && o.at.includes('T') ? `<span class="muted">(${o.at.slice(11,16)})</span>` : ''}</p>
    <p>الملاحظات: ${o.notes || "—"}</p>
    <p>الحالة: ${opBadge(o)} / ${o.approval==="approved"?"معتمدة":"غير معتمدة"}</p>
    ${w ? `<div class="card" style="background:var(--green-l);margin-top:8px">
      العامل: <b>${w.name}</b><br>الجوال: ${w.phone||"—"}<br>الجهاز: ${o.device||"—"}
    </div>`:""}
    ${parsePhotos(o.photos).length ? `<div class="photo-row">${parsePhotos(o.photos).map(s=>`<img class="thumb" src="${s}">`).join("")}</div>`:""}
    ${o.supervisorNote ? `
      <div class="card" style="background:#FFFBEB;border:1.5px solid #F59E0B;border-radius:8px;padding:12px;margin:12px 0">
        <div style="font-weight:bold;color:#B45309;display:flex;align-items:center;gap:6px;margin-bottom:6px">
          <span style="font-size:18px">💬</span>
          <span>توجيه وملاحظة المشرف / المهندس:</span>
        </div>
        <div style="font-size:14px;color:#78350F;line-height:1.6;white-space:pre-wrap;background:#fff;padding:8px 12px;border-radius:6px;border:1px solid #FDE68A">
          ${o.supervisorNote}
        </div>
      </div>
    ` : ''}
    ${canApprove ? `
      <label>ملاحظة للعامل</label>
      <textarea id="snote">${o.supervisorNote||""}</textarea>
      <button class="btn btn-ghost" data-act="note-op" data-id="${o.id}" style="margin-top:8px">إرسال ملاحظة</button>
      ${o.approval!=="approved" ? (
        isBatch ? `
          <button class="btn btn-primary" data-act="batch-approve-op" data-id="${batchId}" data-batch="${batchId}" style="margin-top:8px;background:#16A34A;font-weight:700">✓ اعتماد الحزمة بالكامل</button>
          <button class="btn btn-orange" data-act="batch-reject-op" data-id="${batchId}" data-batch="${batchId}" style="margin-top:8px">✕ رفض وتحديد الإجراء</button>
        ` : `
          <button class="btn btn-primary" data-act="approve-op" data-id="${o.id}" style="margin-top:8px">اعتماد العملية</button>
          <button class="btn btn-orange" data-act="reject-op" data-id="${o.id}" style="margin-top:8px">✕ رفض وتحديد الإجراء</button>
        `
      ) : ""}
    `:""}
    ${(canEdit(o) && (session().id===o.workerId || canApprove)) || hasPerm("ops_delete") || session()?.role === "admin" ? `<button class="btn btn-ghost" data-act="del-op" data-id="${o.id}" style="margin-top:8px;color:#DC2626">🗑️ حذف العملية المسجلة</button>`:""}
  </div>`;
}

function yieldNewSeasonModalHtml(st, curSeason) {
  const nextYear = String(new Date().getFullYear() + 1);
  return `
    <div class="modal-backdrop" style="display:flex;align-items:center;justify-content:center;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;padding:16px">
      <div class="card" style="width:100%;max-width:440px;background:#fff;border-radius:12px;box-shadow:var(--shadow);overflow:hidden">
        <div style="background:var(--green);color:#fff;padding:14px 18px;display:flex;justify-content:space-between;align-items:center">
          <h3 style="margin:0;font-size:16px;color:#fff">📅 بدء دورة موسم حصاد جديد</h3>
          <button type="button" class="btn btn-ghost" data-act="close-yield-new-season" style="color:#fff;padding:2px 8px;font-size:16px">✕</button>
        </div>
        <div style="padding:18px">
          <p style="font-size:13px;color:var(--text);line-height:1.6;margin-top:0">
            أدخل سنة موسم الحصاد الجديد (مثلاً 2027 أو 2028) لتفعيل لوحة المؤشرات، وتسجيل دفعات الحصاد، وفصل إحصائيات الإنتاجية:
          </p>
          <label style="font-weight:700;display:block;margin-bottom:6px">سنة الموسم (4 أرقام):</label>
          <input id="new_yield_season_input" type="number" value="${nextYear}" placeholder="مثال: 2027" style="font-size:18px;font-weight:bold;padding:10px;text-align:center;width:100%" />
          <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
            <button type="button" class="btn btn-ghost" data-act="close-yield-new-season">إلغاء</button>
            <button type="button" class="btn btn-primary" data-act="confirm-yield-new-season">🚀 تفعيل الموسم الجديد</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

let showEditYieldModal = false;
let editingYieldId = null;

function renderEditYieldModal(st) {
  const y = (st.yields || []).find(x => x.id === editingYieldId);
  if (!y) return "";
  const curCropObj = (st.crops || []).find(c => c.id === (y.cropId || "palm"));
  const unitName = curCropObj?.unit || "كجم";

  return `
    <div class="modal-backdrop custom-modal-backdrop" data-act="close-edit-yield" style="display:flex;align-items:center;justify-content:center;position:fixed;inset:0;background:rgba(15,23,42,0.65);z-index:9999;padding:16px;backdrop-filter:blur(4px);overflow-y:auto">
      <div class="card" style="width:100%;max-width:500px;max-height:90vh;display:flex;flex-direction:column;background:#fff;border-radius:14px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.25);overflow:hidden;margin:auto">
        <div style="background:var(--green);color:#fff;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0">
          <h3 style="margin:0;font-size:16px;color:#fff;font-weight:700">✏️ تعديل بيانات شحنة الحصاد (${escapeHtml(y.batch || y.id)})</h3>
          <button type="button" class="btn btn-ghost" data-act="close-edit-yield" style="color:#fff;background:rgba(255,255,255,0.18);border:none;border-radius:6px;width:30px;height:30px;padding:0;display:inline-flex;align-items:center;justify-content:center;font-size:15px;cursor:pointer">✕</button>
        </div>
        <div style="padding:18px;overflow-y:auto;flex:1">
          <div class="grid grid-2" style="gap:10px">
            <div>
              <label>الموسم</label>
              <input id="edit_yseason" value="${escapeHtml(String(y.season || '2026'))}" />
            </div>
            <div>
              <label>تاريخ الحصاد</label>
              <input id="edit_ydate" type="date" value="${escapeHtml(y.date || new Date().toISOString().slice(0, 10))}" />
            </div>
          </div>
          <div style="margin-top:10px">
            <label>الصنف</label>
            <input id="edit_yvariety" value="${escapeHtml(y.variety || '')}" />
          </div>
          <div class="grid grid-2" style="gap:10px;margin-top:10px">
            <div>
              <label>الوزن الكلي (${unitName})</label>
              <input id="edit_ykg" type="number" step="0.1" value="${y.kg || 0}" />
            </div>
            <div>
              <label>فرز ممتاز (${unitName})</label>
              <input id="edit_ykg_ex" type="number" step="0.1" value="${y.kgEx || 0}" />
            </div>
          </div>
          <div class="grid grid-2" style="gap:10px;margin-top:10px">
            <div>
              <label>فرز جيد (${unitName})</label>
              <input id="edit_ykg_gd" type="number" step="0.1" value="${y.kgGd || 0}" />
            </div>
            <div>
              <label>تالف / هالك (${unitName})</label>
              <input id="edit_ykg_bad" type="number" step="0.1" value="${y.kgBad || 0}" />
            </div>
          </div>
          <div style="margin-top:10px">
            <label>ملاحظات</label>
            <textarea id="edit_ynotes" style="width:100%;height:60px">${escapeHtml(y.notes || '')}</textarea>
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;background:#F8FAFC;border-top:1px solid #E2E8F0;flex-shrink:0">
          <button type="button" class="btn btn-ghost" data-act="close-edit-yield" style="border:1px solid #CBD5E1">إلغاء</button>
          <button type="button" class="btn btn-primary" data-act="save-edit-yield" data-id="${y.id}" style="font-weight:700">💾 حفظ التعديلات</button>
        </div>
      </div>
    </div>
  `;
}

function renderYieldModal(st) {
  const activeCrops = (st.crops || []).filter(c => c.active);
  const seasons = getYieldsSeasons(st);
  const season = yieldsSeason || seasons[0] || "2026";
  const curCropObj = (st.crops || []).find(c => c.id === (yieldRegCrop || "palm"));
  const unitName = curCropObj?.unit || "كجم";

  return `
    <div class="modal-backdrop" style="position:fixed;inset:0;background:rgba(15,23,42,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)">
      <div class="card" style="background:#fff;border-radius:14px;max-width:840px;width:100%;max-height:92vh;overflow-y:auto;box-shadow:0 20px 25px -5px rgba(0,0,0,0.25);padding:20px;position:relative">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--line)">
          <div>
            <h3 style="margin:0;font-size:18px;font-weight:800;color:var(--text)">📦 تسجيل شحنة حصاد جديدة</h3>
            <div class="muted" style="font-size:12px">إسناد الأوزان على مستوى القطعة كاملة أو عدة قطع/أجزاء أو التوزيع المتساوي على الأشجار</div>
          </div>
          <button class="btn btn-ghost btn-sm" data-act="close-yield-modal" style="font-size:18px;padding:4px 10px;line-height:1;border-radius:50%" title="إغلاق">✕</button>
        </div>

        <div class="grid grid-2" style="gap:14px">
          <!-- Left Column: Scope & Location -->
          <div>
            <label>نوع المحصول المحصود</label>
            <select id="ycrop">
              ${activeCrops.map(c => `<option value="${c.id}" ${(yieldRegCrop||"palm")===c.id?"selected":""}>${cropTextLabel(c)} — ${c.yieldName || 'ثمار'}</option>`).join("")}
            </select>

            <label>طريقة الإسناد</label>
            <select id="ylevel">
              <option value="plot">إجمالي على قطعة (أو عدة قطع / أجزاء مختارة)</option>
              <option value="split">توزيع متساوٍ على أشجار هذا المحصول بالقطع المحددة</option>
              <option value="sector">إجمالي على قطاع كامل</option>
              <option value="palm">شجرة / أصل محدد (كود فردي)</option>
            </select>

            <div id="ysecw">
              <label>القطاع الميداني</label>
              <select id="ysec">
                ${st.sectors.map(s=>`<option value="${s.id}">${s.name}</option>`).join("")}
              </select>
            </div>

            <div id="yplotw">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
                <label style="margin:0">القطعة المستهدفة (كاملة أو فرعية أو اختيار متعدد)</label>
                <span class="muted" style="font-size:11px" id="yplot_count_badge"></span>
              </div>
              <!-- Live filter input for plot -->
              <div style="display:flex;gap:6px;margin:4px 0;align-items:center">
                <input id="yplot_search" type="search" placeholder="🔍 فلترة سريعة برقم القطعة (مثال: 12 أو 14)..." style="flex:1;font-size:12.5px;padding:6px 10px" />
                <button type="button" class="btn btn-ghost btn-sm" data-act="yield-select-all-plots" style="width:auto;font-size:11.5px;white-space:nowrap" title="تحديد كل قطع هذا القطاع دفعة واحدة">➕ تحديد الكل</button>
                <button type="button" class="btn btn-ghost btn-sm" data-act="yield-clear-plots" style="width:auto;font-size:11.5px;white-space:nowrap" title="مسح التحديد المتعدد">مسح</button>
              </div>
              <!-- Quick Chips for Base Plots -->
              <div style="font-size:11px;color:var(--muted);margin-bottom:2px">القطع الأساسية (اضغط للتبديل والتحديد):</div>
              <div id="yplot_chips" style="display:flex;gap:4px;overflow-x:auto;padding:3px 0;margin-bottom:4px"></div>
              <!-- Sub-parts Strip for parts (A, B, etc.) -->
              <div id="yplot_parts_chips" style="display:flex;gap:4px;overflow-x:auto;padding:2px 0;margin-bottom:4px"></div>
              <!-- Selected Scope Box -->
              <div id="yplot_scope_box" style="margin-bottom:6px"></div>
              <!-- Plot Select Dropdown (for quick single selection) -->
              <select id="yplot" style="font-size:13px"></select>
            </div>

            <div id="ypalmw" class="hidden">
              <label>الشجرة / الأصل الفردي</label>
              <select id="ypalm" style="font-size:13px"></select>
            </div>
          </div>

          <!-- Right Column: Shipment Details -->
          <div>
            <label>الصنف</label>
            <select id="yvar">
              <option value="">الكل (أو غير محدد)</option>
              ${(yieldRegCrop ? (st.cropVarieties||[]).filter(v=>v.cropId===yieldRegCrop).map(v=>`<option>${v.name}</option>`) : (st.varieties||[]).map(v=>`<option>${v}</option>`)).join("")}
            </select>

            <div class="grid grid-2" style="gap:8px">
              <div><label>رقم الشحنة</label><input id="ybatch" value="BATCH-${season}-${String(st.yields.filter(y => String(y.season) === season).length+1).padStart(3,"0")}" /></div>
              <div><label>الموسم</label><input id="ys" value="${season}" /></div>
            </div>

            <div class="grid grid-2" style="gap:8px">
              <div>
                <label>تاريخ الجمع / الحصاد</label>
                <input id="ydate" type="date" value="${new Date().toISOString().slice(0,10)}" />
              </div>
              <div>
                <label title="اختياري: لتحديد عدد النخيل المجموع منه فعلياً إن لم تكن كل القطعة">الأشجار المجمُوعة (اختياري)</label>
                <input id="yharvested_count" type="number" min="1" placeholder="تلقائي: كل النطاق" style="font-size:13px" />
              </div>
            </div>

            <!-- Dynamic Location Info Box -->
            <div id="yplot_info_box" style="margin-top:10px;padding:10px 12px;background:var(--card);border:1px solid var(--line);border-radius:8px;font-size:12px;line-height:1.6">
              <div style="font-weight:700;color:var(--green-d)" id="yinfo_title">📍 جاري تحديد النطاق...</div>
              <div class="muted" id="yinfo_desc">حدد القطعة وطريقة الإسناد لاستعراض عدد الأشجار ونصيبها.</div>
            </div>
          </div>
        </div>

        <!-- Quality Weights & Live Calculator -->
        <div style="margin-top:14px;padding-top:12px;border-top:1px dashed var(--line)">
          <div style="font-weight:700;margin-bottom:8px;font-size:13.5px">⚖️ أوزان درجات الجودة المستلمة (${unitName})</div>
          <div class="grid grid-3" style="gap:10px">
            <div>
              <label style="color:var(--green-d);font-weight:700">🌟 ممتاز (${unitName})</label>
              <input id="yex" type="text" inputmode="decimal" value="0" style="font-size:16px;font-weight:bold" />
            </div>
            <div>
              <label style="color:#2563eb;font-weight:700">👍 جيد (${unitName})</label>
              <input id="ygd" type="text" inputmode="decimal" value="0" style="font-size:16px;font-weight:bold" />
            </div>
            <div>
              <label style="color:#d97706;font-weight:700">🍂 تالف / علفي (${unitName})</label>
              <input id="ybad" type="text" inputmode="decimal" value="0" style="font-size:16px;font-weight:bold" />
            </div>
          </div>

          <!-- Live Calculation Box -->
          <div id="ycalc_preview" style="margin-top:10px;padding:12px 14px;background:var(--card);border:1px solid var(--green-d);border-radius:10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
            <div>
              <div style="font-size:12px;color:var(--muted)">إجمالي وزن الشحنة المحسوب تلقائياً:</div>
              <div style="font-size:24px;font-weight:800;color:var(--green-d)" id="ycalc_total">0.00 <span style="font-size:14px">${unitName}</span></div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap" id="ycalc_breakdown">
              <span class="badge" style="background:#e8f5e9;color:#1b5e20;padding:4px 8px;font-size:12px" id="ycalc_ex_pct">🌟 ممتاز: 0%</span>
              <span class="badge" style="background:#e3f2fd;color:#0d47a1;padding:4px 8px;font-size:12px" id="ycalc_gd_pct">👍 جيد: 0%</span>
              <span class="badge" style="background:#fff3e0;color:#e65100;padding:4px 8px;font-size:12px" id="ycalc_bad_pct">🍂 تالف: 0%</span>
            </div>
            <div id="ycalc_split_info" style="font-size:12px;color:var(--text);font-weight:600;width:100%"></div>
          </div>
        </div>

        <div style="display:flex;gap:10px;margin-top:16px">
          <button class="btn btn-primary" data-act="save-yield" style="flex:2;padding:11px;font-size:14.5px;font-weight:bold">💾 حفظ واعتماد شحنة الحصاد</button>
          <button class="btn btn-ghost" data-act="close-yield-modal" style="flex:1;padding:11px">إلغاء</button>
        </div>
      </div>
    </div>
  `;
}

function renderYieldDetailsModal(st) {
  if (!activeYieldDetailsId) return "";
  const y = (st.yields || []).find(x => x.id === activeYieldDetailsId);
  if (!y) return "";

  const yCropId = y.cropId || "palm";
  const cName = cropName(yCropId);
  const cIco = cropIcon(yCropId, 24);
  const uObj = userBy(y.by || y.recordedBy || y.recorded_by);
  const supervisorName = uObj ? uObj.name : (y.recordedByName || y.recorded_by_name || "مشرف الحصاد والجودة");
  const dateStr = fmtDateTime(y.date || y.at);

  const yEx = Number(y.kgEx) || 0;
  const yGd = Number(y.kgGd) || 0;
  const yBad = Number(y.kgBad) || 0;
  const yTot = Number(y.kg) || (yEx + yGd + yBad) || 1;
  const exPct = Math.round(yEx / yTot * 100);
  const gdPct = Math.round(yGd / yTot * 100);
  const badPct = Math.max(0, 100 - exPct - gdPct);

  // Sector and plots breakdown
  const plotsArr = Array.isArray(y.plotIds) && y.plotIds.length ? y.plotIds : (y.plotId ? [y.plotId] : []);
  const secId = y.sectorId || (plotsArr[0] ? st.plots.find(p => p.id === plotsArr[0])?.sector : null);
  const secObj = st.sectors.find(s => s.id === secId || s.name === secId);
  const secName = secObj ? secObj.name : (secId ? `قطاع ${secId}` : "كافة القطاعات");

  const traceUrl = (function() {
    try {
      const origin = window.location.origin;
      const path = window.location.pathname.replace(/\/[^\/]*$/, '/');
      return origin + path + 'trace.html?batch=' + encodeURIComponent(y.batch || y.id);
    } catch (e) {
      return '/trace.html?batch=' + encodeURIComponent(y.batch || y.id);
    }
  })();

  return `
    <div class="custom-modal-backdrop" data-act="close-yield-details" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(15,23,42,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)">
      <div class="card" onclick="if (!event.target.closest('[data-act]')) event.stopPropagation()" style="width:100%;max-width:720px;max-height:92vh;overflow-y:auto;background:#fff;border-radius:16px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);border:1px solid #E2E8F0;padding:24px">
        <!-- Modal Head -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:1px solid #F1F5F9;padding-bottom:12px">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:28px">${cIco}</span>
            <div>
              <div style="display:flex;align-items:center;gap:8px">
                <h3 style="margin:0;font-size:18px;color:#0F172A">تفاصيل شحنة الحصاد المعتمدة</h3>
                <span class="chip" style="font-family:monospace;font-weight:800;background:#F0FDF4;color:#15803D;font-size:13px">${y.batch || y.id}</span>
              </div>
              <div class="muted" style="font-size:12px;margin-top:2px">الموسم: <b>${y.season || '2026'}م</b> • تاريخ وساعة التوريد: <b>${dateStr}</b></div>
            </div>
          </div>
          <button type="button" class="icon-btn" onclick="act('close-yield-details')" data-act="close-yield-details" style="font-size:18px;background:#F8FAFC;border:none;border-radius:50%;width:32px;height:32px;cursor:pointer">✕</button>
        </div>

        <!-- KPI Summary Cards -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:10px;margin-bottom:16px">
          <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:12px;text-align:center">
            <div style="font-size:11.5px;color:#64748B">إجمالي الوزن الصافي</div>
            <div style="font-size:20px;font-weight:900;color:#15803D;margin-top:2px">${Number(y.kg||0).toLocaleString()} <span style="font-size:12px">كجم</span></div>
          </div>
          <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:12px;text-align:center">
            <div style="font-size:11.5px;color:#64748B">المحصول والصنف</div>
            <div style="font-size:14px;font-weight:800;color:#0F172A;margin-top:4px">${cName} — ${y.variety || 'عام'}</div>
          </div>
          <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:12px;text-align:center">
            <div style="font-size:11.5px;color:#64748B">المسؤول عن التوريد</div>
            <div style="font-size:13.5px;font-weight:700;color:#2563EB;margin-top:4px">${supervisorName}</div>
          </div>
          <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:12px;text-align:center">
            <div style="font-size:11.5px;color:#64748B">عدد الصناديق / العبوات</div>
            <div style="font-size:18px;font-weight:800;color:#475569;margin-top:2px">${y.boxes || y.packagesCount || '—'}</div>
          </div>
        </div>

        <!-- Hidden Details: Producing Sectors & Plots -->
        <div style="background:#F1F5F9;border:1px solid #CBD5E1;border-radius:12px;padding:14px;margin-bottom:16px">
          <div style="font-weight:800;font-size:13.5px;color:#1E293B;margin-bottom:8px;display:flex;align-items:center;gap:6px">
            <span>📍 تفاصيل النطاق الميداني والقطاعات والقطع المنتجة:</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;font-size:12.5px;color:#334155">
            <div><b>القطاع المنتج الرئيسي:</b> <span class="badge" style="background:#E0F2FE;color:#0369A1;font-weight:700">${secName}</span></div>
            <div>
              <b>القطع المنتجة المشمولة (${plotsArr.length} قطعة):</b>
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
                ${plotsArr.length ? plotsArr.map(pid => {
                  const plObj = st.plots.find(p => p.id === pid);
                  const plName = plObj ? plObj.name : pid;
                  const plPalms = st.palms.filter(p => p.plot === pid && !p.archived && (p.cropId||'palm') === yCropId).length;
                  return `<span class="chip" style="background:#fff;border:1px solid #94A3B8;padding:3px 8px;font-size:11.5px;border-radius:6px"><b>${plName}</b> (${pid}) • <span style="color:#15803D;font-weight:bold">${plPalms} شجرة</span></span>`;
                }).join("") : `<span class="muted">شامل كامل القطاع (${secName})</span>`}
              </div>
            </div>
            ${y.notes ? `
              <div style="margin-top:6px;border-top:1px dashed #CBD5E1;padding-top:6px">
                <b>الملاحظات الميدانية وبيانات الناقل:</b> ${escapeHtml(y.notes)}
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Quality Breakdown -->
        <div style="border:1px solid #E2E8F0;border-radius:12px;padding:14px;margin-bottom:18px">
          <div style="font-weight:800;font-size:13px;color:#1E293B;margin-bottom:8px">⚖️ تفصيل فرز الجودة والأوزان الصافية:</div>
          <div style="display:flex;height:12px;border-radius:6px;overflow:hidden;background:#E2E8F0;margin-bottom:10px">
            <div style="width:${exPct}%;background:#16A34A" title="ممتاز: ${yEx} كجم (${exPct}%)"></div>
            <div style="width:${gdPct}%;background:#2563EB" title="جيد: ${yGd} كجم (${gdPct}%)"></div>
            <div style="width:${badPct}%;background:#D97706" title="تالف: ${yBad} كجم (${badPct}%)"></div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:10px;text-align:center">
            <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:8px">
              <div style="color:#166534;font-size:11px;font-weight:bold">🌟 فرز ممتاز (نخب أول)</div>
              <div style="font-size:16px;font-weight:900;color:#15803D;margin-top:2px">${yEx.toLocaleString()} كجم</div>
              <div style="font-size:11px;color:#166534">${exPct}%</div>
            </div>
            <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:8px">
              <div style="color:#1E40AF;font-size:11px;font-weight:bold">👍 فرز جيد (تجاري)</div>
              <div style="font-size:16px;font-weight:900;color:#2563EB;margin-top:2px">${yGd.toLocaleString()} كجم</div>
              <div style="font-size:11px;color:#1E40AF">${gdPct}%</div>
            </div>
            <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:8px">
              <div style="color:#92400E;font-size:11px;font-weight:bold">🍂 تالف / غير مطابق</div>
              <div style="font-size:16px;font-weight:900;color:#D97706;margin-top:2px">${yBad.toLocaleString()} كجم</div>
              <div style="font-size:11px;color:#92400E">${badPct}%</div>
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;border-top:1px solid #F1F5F9;padding-top:14px">
          <button type="button" class="btn btn-ghost" onclick="act('close-yield-details')" data-act="close-yield-details">إغلاق</button>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${(hasPerm("yields_edit") || session()?.role === "admin") ? `
              <button type="button" class="btn btn-ghost" data-act="open-edit-yield" data-id="${y.id}" style="border:1px solid #3B82F6;color:#1D4ED8;font-weight:700">✏️ تعديل</button>
            ` : ''}
            ${(hasPerm("yields_delete") || session()?.role === "admin") ? `
              <button type="button" class="btn btn-ghost" data-act="del-yield" data-id="${y.id}" style="border:1px solid #FCA5A5;background:#FEF2F2;color:#DC2626;font-weight:700">🗑️ حذف</button>
            ` : ''}
            <a href="${traceUrl}" target="_blank" class="btn btn-ghost" style="border:1px solid #0284C7;color:#0284C7;font-weight:700;display:inline-flex;align-items:center;gap:6px">
              <span>🌐</span> جواز السفر الرقمي (Passport)
            </a>
            <button type="button" class="btn btn-primary" data-act="print-batch" data-id="${y.id}" style="background:#16A34A;font-weight:bold;display:inline-flex;align-items:center;gap:6px">
              <span>🏷️</span> طباعة ملصق التتبع الذكي
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function yieldsView() {
  const st = Store.get();
  const seasons = getYieldsSeasons(st);
  const season = yieldsSeason || seasons[0] || "2026";
  const activeCrops = (st.crops || []).filter(c => c.active);
  let cur = st.yields.filter(y => String(y.season) === season);
  let prev = st.yields.filter(y => String(y.season) === String(+season-1));
  if (yieldCropFilter !== "all") {
    cur = cur.filter(y => matchesCropFilter(y.cropId || "palm", yieldCropFilter));
    prev = prev.filter(y => matchesCropFilter(y.cropId || "palm", yieldCropFilter));
  }
  const sum = arr => arr.reduce((a,b)=>a+(+b.kg||0),0);
  const total = sum(cur), last = sum(prev);
  const growth = last ? Math.round((total-last)/last*100) : 0;
  
  const relevantPalms = st.palms.filter(p => !p.archived && (yieldCropFilter === "all" || matchesCropFilter(p.cropId || "palm", yieldCropFilter)));
  const treesCount = Math.max(1, relevantPalms.length);
  const curCropObj = yieldCropFilter !== "all" ? activeCrops.find(c => matchesCropFilter(c.code || c.id, yieldCropFilter)) : null;
  const unitName = curCropObj?.unit || "كجم";
  const cropTitle = curCropObj ? (curCropObj.yieldName || curCropObj.name) : "كافة المحاصيل";
  const singleLabel = curCropObj ? curCropObj.single : "شجرة / أصل";

  // Calculate distinct harvested bearing palms for this season & crop
  const harvestedPalmsSet = new Set();
  cur.forEach(y => {
    if (y.level === "palm" && y.palmId) {
      harvestedPalmsSet.add(y.palmId);
    } else if (Array.isArray(y.plotIds) && y.plotIds.length) {
      y.plotIds.forEach(pid => {
        st.palms.filter(p => p.plot === pid && !p.archived && (yieldCropFilter === "all" || (p.cropId || "palm") === (y.cropId || "palm"))).forEach(p => harvestedPalmsSet.add(p.id));
      });
    } else if (y.plotId) {
      if (y.plotId.startsWith("base:")) {
        const bId = y.plotId.slice(5);
        st.palms.filter(p => (plotBaseId(p.plot) === bId || p.plot.startsWith(bId)) && !p.archived && (yieldCropFilter === "all" || (p.cropId || "palm") === (y.cropId || "palm"))).forEach(p => harvestedPalmsSet.add(p.id));
      } else {
        st.palms.filter(p => p.plot === y.plotId && !p.archived && (yieldCropFilter === "all" || (p.cropId || "palm") === (y.cropId || "palm"))).forEach(p => harvestedPalmsSet.add(p.id));
      }
    } else if (y.level === "sector" && y.sectorId) {
      st.palms.filter(p => {
        const pl = st.plots.find(x => x.id === p.plot);
        return pl?.sector === y.sectorId && !p.archived && (yieldCropFilter === "all" || (p.cropId || "palm") === (y.cropId || "palm"));
      }).forEach(p => harvestedPalmsSet.add(p.id));
    }
  });

  const totalExplicitCount = cur.reduce((a, y) => a + (Number(y.count) || 0), 0);
  const harvestedPalmsCount = harvestedPalmsSet.size > 0 ? harvestedPalmsSet.size : (totalExplicitCount > 0 ? totalExplicitCount : 0);
  const avgHarvested = harvestedPalmsCount > 0 ? (total / harvestedPalmsCount).toFixed(1) : (total / treesCount).toFixed(1);
  const avgOverallAssets = (total / treesCount).toFixed(1);

  const ex = cur.reduce((a,y)=>a+(+y.kgEx|| (y.quality==="ممتاز"?+y.kg:0) ||0),0);
  const bySec = {};
  cur.forEach(y => { const s = y.sectorId || "—"; bySec[s]=(bySec[s]||0)+(+y.kg||0); });
  const maxS = Math.max(1, ...Object.values(bySec), 1);

  // Filter shipments table
  let tableList = cur.slice().reverse();
  if (yieldTableSearch) {
    const q = yieldTableSearch.trim().toLowerCase();
    tableList = tableList.filter(y => {
      const bText = (y.batch || y.id || "").toLowerCase();
      const vText = (y.variety || "").toLowerCase();
      const locText = ((Array.isArray(y.plotIds) && y.plotIds.length) ? y.plotIds.map(p => plotName(p)).join(" ") : plotName(y.plotId)).toLowerCase();
      const uText = (userBy(y.by || y.recordedBy || y.recorded_by)?.name || y.recordedByName || y.recorded_by_name || "").toLowerCase();
      return bText.includes(q) || vText.includes(q) || locText.includes(q) || uText.includes(q);
    });
  }
  if (yieldTableSec !== "all") {
    tableList = tableList.filter(y => {
      if (y.sectorId === yieldTableSec) return true;
      if (Array.isArray(y.plotIds) && y.plotIds.length) {
        return y.plotIds.some(pid => st.plots.find(p => p.id === pid)?.sector === yieldTableSec);
      }
      if (y.plotId) {
        if (y.plotId.startsWith("base:")) {
          const bId = y.plotId.slice(5);
          return st.plots.some(p => (p.id.startsWith(bId) || plotBaseId(p) === bId) && p.sector === yieldTableSec);
        }
        return st.plots.find(p => p.id === y.plotId)?.sector === yieldTableSec;
      }
      return false;
    });
  }
  if (yieldTableQuality !== "all") {
    tableList = tableList.filter(y => y.quality === yieldTableQuality);
  }

  const uRole = session()?.role || "";
  const isAdminOrEng = ["admin", "super_admin", "company_admin", "engineer", "tenant_user"].includes(uRole) || session()?.isSuperAdmin || session()?.user === "admin";
  const canDelYield = hasPerm("yields_delete") || isAdminOrEng;
  const canEditYield = hasPerm("yields_edit") || isAdminOrEng;
  const canExportYield = hasPerm("yields_export") || isAdminOrEng;

  return `
    <!-- Top Header -->
    <div class="page-head" style="margin-bottom:8px">
      <div>
        <h3 style="margin:0;font-size:18px">🌾 إدارة ومؤشرات المحصول والحصاد</h3>
        <div class="muted" style="font-size:12px">متابعة الإنتاجية الميدانية، الجودة، وتوزيع المحاصيل على مستوى القطعة كاملة أو الأشجار</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:nowrap">
        <button class="btn btn-primary icon-btn" data-act="open-yield-modal" style="padding:6px 14px;font-weight:700">➕ تسجيل شحنة جديدة</button>
        ${canExportYield ? `<button class="btn btn-ghost icon-btn" data-act="export-yield" style="padding:6px 12px">📊 تصدير CSV</button>` : ''}
      </div>
    </div>

    <!-- Consolidated Season & Filter Toolbar -->
    <div style="display:flex;justify-content:space-between;align-items:center;background:#fff;border:1px solid var(--line);border-radius:10px;padding:8px 14px;margin-bottom:12px;flex-wrap:wrap;gap:10px">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="font-weight:700;font-size:13px;color:var(--text)">📅 الموسم:</span>
        <select id="ysel_season" data-act="yield-change-season" style="padding:4px 10px;font-size:13px;border-radius:8px;border:1.5px solid var(--green);font-weight:bold;background:#fff">
          ${seasons.map(s => `<option value="${s}" ${String(s) === String(season) ? 'selected' : ''}>موسم ${s}م</option>`).join("")}
        </select>
        ${hasPerm("seasons_manage") ? `<button class="btn btn-ghost btn-sm" data-act="yield-open-new-season" style="padding:3px 8px;font-size:11.5px;color:var(--green-d);font-weight:600" title="بدء دورة موسم سنوي جديد">➕ دورة جديدة</button>` : ''}
        <div style="width:1px;height:20px;background:#E2E8F0;margin:0 4px"></div>
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          <button class="btn ${yieldCropFilter==='all'?'btn-primary':'btn-ghost'}" style="width:auto;padding:3px 10px;font-size:12px" data-act="filter-yield-crop" data-id="all">🌐 كل الإنتاج (${st.yields.filter(y => String(y.season) === season).length})</button>
          ${activeCrops.map(c => {
            const cid = c.code || c.id;
            const cCnt = st.yields.filter(y => String(y.season) === season && matchesCropFilter(y.cropId || "palm", cid)).length;
            return `<button class="btn ${matchesCropFilter(yieldCropFilter, cid)?'btn-primary':'btn-ghost'}" style="width:auto;padding:3px 10px;font-size:12px" data-act="filter-yield-crop" data-id="${cid}">${cropIcon(c.id, 14)} ${c.yieldName || c.name} (${cCnt})</button>`;
          }).join("")}
        </div>
      </div>
      <div class="muted" style="font-size:12px">
        📊 شحنات موسم <b>${season}</b>: <b>${cur.length}</b> شحنة • الإجمالي: <b>${total.toLocaleString()}</b> ${unitName}
      </div>
    </div>

    <!-- 2-Column Analytics (Side-by-side) -->
    <div class="grid grid-2" style="gap:14px;margin-bottom:14px">
      <!-- Right Column: 3 Compact KPI Cards -->
      <div style="display:flex;flex-direction:column;gap:10px">
        <div class="card kpi" style="padding:12px 16px;margin:0">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div class="l" style="font-size:12px">إجمالي إنتاج موسم ${season} (${cropTitle})</div>
              <div class="n" style="font-size:22px;margin-top:2px">${total.toLocaleString()} <span style="font-size:13px;color:var(--muted)">${unitName}</span></div>
            </div>
            <div style="font-size:11.5px;color:${growth>=0?'var(--green-d)':'var(--err)'};font-weight:700;background:${growth>=0?'#DCFCE7':'#FEE2E2'};padding:4px 8px;border-radius:8px">
              ${growth>0?'+':''}${growth}% نمو
            </div>
          </div>
        </div>

        <div class="card kpi" style="padding:12px 16px;margin:0" title="متوسط إنتاج الشجرة المجمُوعة فعلياً مقارنة بإجمالي أصول المزرعة">
          <div class="l" style="font-size:12px">متوسط إنتاج النخلة المثمرة/المجمُوعة (${harvestedPalmsCount > 0 ? harvestedPalmsCount : treesCount} أصل)</div>
          <div class="n" style="font-size:22px;color:var(--green-d);margin-top:2px">${avgHarvested} <span style="font-size:13px;color:var(--muted)">${unitName} / نخلة</span></div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">
            مقارنة بـ <b>${avgOverallAssets}</b> ${unitName} لكافة أصول المزرعة (${treesCount} أصل)
          </div>
        </div>

        <div class="card kpi" style="padding:12px 16px;margin:0">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div class="l" style="font-size:12px">نسبة الجودة الممتازة (${ex.toLocaleString()} ${unitName})</div>
              <div class="n" style="font-size:22px;margin-top:2px">${total?Math.round(ex/total*100):0}%</div>
            </div>
            <div style="font-size:24px">🌟</div>
          </div>
        </div>
      </div>

      <!-- Left Column: Sector Production Breakdown -->
      <div class="card" style="padding:14px 16px;margin:0;display:flex;flex-direction:column;justify-content:space-between">
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <h4 style="margin:0;font-size:14px;font-weight:800;color:var(--text)">📊 إنتاج القطاعات هذا الموسم (${cropTitle})</h4>
            <span class="muted" style="font-size:11px">${Object.keys(bySec).length} قطاعات منتجة</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${Object.entries(bySec).map(([k,v]) => {
              const secPct = total > 0 ? Math.round(v / total * 100) : 0;
              return `
                <div>
                  <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
                    <span style="font-weight:700;color:var(--text)">${sectorName(k)}</span>
                    <span><b>${v.toLocaleString()}</b> ${unitName} <span class="muted" style="font-size:11px">(${secPct}%)</span></span>
                  </div>
                  <div style="height:8px;border-radius:4px;background:#F1F5F9;overflow:hidden">
                    <div style="height:100%;border-radius:4px;background:var(--green-d);width:${Math.round(v/maxS*100)}%"></div>
                  </div>
                </div>
              `;
            }).join("") || "<div class='muted' style='padding:20px;text-align:center'>لا توجد بيانات مسجلة بعد لهذا الموسم</div>"}
          </div>
        </div>
      </div>
    </div>

    <!-- Shipments Log -->
    <div class="card" style="margin-top:14px">
      <div class="page-head" style="margin-bottom:8px">
        <div>
          <h3 style="margin:0">📋 سجل الشحنات والإنتاج (${cropTitle})</h3>
          <div class="muted" style="font-size:12px">المعروض: ${tableList.length} شحنة من أصل ${cur.length}</div>
        </div>
        ${(yieldTableSearch || yieldTableSec !== "all" || yieldTableQuality !== "all") ? `<button class="btn btn-ghost icon-btn" data-act="reset-yield-filter" style="font-size:12px">✕ إعادة ضبط الفلترة</button>` : ''}
      </div>

      <!-- Filter & Search Toolbar -->
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
        <input id="ytable_search" type="search" placeholder="🔍 بحث بالشحنة، الصنف، القطعة، أو المسؤول..." value="${yieldTableSearch}" style="flex:2;min-width:180px;font-size:12.5px" />
        <select id="ytable_sec" style="flex:1;min-width:130px;font-size:12.5px">
          <option value="all">كل القطاعات</option>
          ${st.sectors.map(s=>`<option value="${s.id}" ${yieldTableSec===s.id?"selected":""}>${s.name}</option>`).join("")}
        </select>
        <select id="ytable_qual" style="flex:1;min-width:110px;font-size:12.5px">
          <option value="all" ${yieldTableQuality==='all'?'selected':''}>كل الجودات</option>
          <option value="ممتاز" ${yieldTableQuality==='ممتاز'?'selected':''}>🌟 ممتاز</option>
          <option value="جيد" ${yieldTableQuality==='جيد'?'selected':''}>👍 جيد</option>
        </select>
      </div>

      <div style="width:100%;overflow-x:hidden;border:1px solid #E2E8F0;border-radius:10px;background:#fff">
        <table class="dense" style="width:100%;table-layout:fixed;border-collapse:collapse;margin:0">
        <thead>
          <tr>
            <th style="width:15%">الشحنة</th>
            <th style="width:11%">المحصول</th>
            <th style="width:19%">الموقع الميداني</th>
            <th style="width:10%">الصنف</th>
            <th style="width:12%">الوزن الصافي</th>
            <th style="width:15%">تفصيل الجودة</th>
            <th style="width:8%">المسؤول</th>
            <th style="width:10%;text-align:center">الإجراءات</th>
          </tr>
        </thead>
        <tbody>
          ${tableList.slice(0, 60).map(y => {
            const yCropId = y.cropId || "palm";
            const cLabel = cropSingle(yCropId);
            const cIco = cropIcon(yCropId, 15);
            const locLabel = (Array.isArray(y.plotIds) && y.plotIds.length > 1) 
              ? `<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${y.plotIds.map(p => plotName(p)).join(', ')}"><b>${y.plotIds.length} قطع</b> <span class="muted" style="font-size:11px">(${y.plotIds.slice(0, 2).map(p => plotName(p)).join('، ')}${y.plotIds.length > 2 ? '...' : ''})</span></div>` 
              : `<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${y.plotId ? plotName(y.plotId) : (y.sectorId ? sectorName(y.sectorId) : y.level)}">${y.plotId ? plotName(y.plotId) : (y.sectorId ? sectorName(y.sectorId) : y.level)}</div>`;
            const yEx = Number(y.kgEx) || 0;
            const yGd = Number(y.kgGd) || 0;
            const yBad = Number(y.kgBad) || 0;
            const yTot = Number(y.kg) || (yEx + yGd + yBad) || 1;
            const exPct = Math.round(yEx / yTot * 100);
            const gdPct = Math.round(yGd / yTot * 100);
            const badPct = Math.max(0, 100 - exPct - gdPct);
            return `<tr>
              <td style="font-weight:bold;font-family:monospace;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${y.batch || y.id}">
                <button type="button" class="btn btn-ghost" data-act="open-yield-details" data-id="${y.id}" style="padding:2px 6px;font-family:monospace;font-weight:bold;color:var(--primary);cursor:pointer;font-size:12px;display:inline-flex;align-items:center;gap:4px" title="عرض تفاصيل الشحنة الميدانية والجودة">
                  <span>📦</span> ${y.batch || y.id}
                </button>
              </td>
              <td style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${cIco} ${cLabel}</td>
              <td style="font-weight:600">${locLabel}</td>
              <td style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${y.variety || "—"}</td>
              <td style="font-weight:bold;color:var(--green-d);white-space:nowrap">${Number(y.kg).toLocaleString()} ${unitName}</td>
              <td>
                <div style="display:flex;height:7px;border-radius:4px;overflow:hidden;background:#E2E8F0;margin-bottom:3px" title="ممتاز: ${yEx} (${exPct}%) | جيد: ${yGd} (${gdPct}%) | تالف: ${yBad} (${badPct}%)">
                  <div style="width:${exPct}%;background:#16A34A"></div>
                  <div style="width:${gdPct}%;background:#2563EB"></div>
                  <div style="width:${badPct}%;background:#D97706"></div>
                </div>
                <div style="display:flex;gap:4px;font-size:10px;white-space:nowrap;justify-content:space-between">
                  <span style="color:#16A34A;font-weight:600" title="ممتاز">🌟 ${yEx}</span>
                  <span style="color:#2563EB;font-weight:600" title="جيد">👍 ${yGd}</span>
                  <span style="color:#D97706;font-weight:600" title="تالف">🍂 ${yBad}</span>
                </div>
              </td>
              <td style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11.5px" title="${userBy(y.by || y.recordedBy || y.recorded_by)?.name || y.recordedByName || y.recorded_by_name || ''}">${userBy(y.by || y.recordedBy || y.recorded_by)?.name || y.recordedByName || y.recorded_by_name || (y.by ? String(y.by) : "—")}</td>
              <td style="text-align:center;white-space:nowrap">
                <button class="btn btn-ghost icon-btn" data-act="open-yield-details" data-id="${y.id}" style="color:#0284C7;padding:3px 6px;font-size:11px" title="عرض التفاصيل والجواز الرقمي">👁️</button>
                <button class="btn btn-ghost icon-btn" data-act="print-batch" data-id="${y.id}" style="padding:3px 6px;font-size:11px" title="طباعة ملصق التتبع">🏷️</button>
                ${canEditYield ? `<button class="btn btn-ghost icon-btn" data-act="open-edit-yield" data-id="${y.id}" style="color:#2563EB;padding:3px 6px;font-size:11px" title="تعديل الشحنة">✏️</button>` : ''}
                ${canDelYield ? `<button class="btn btn-ghost icon-btn" data-act="del-yield" data-id="${y.id}" style="color:var(--err);padding:3px 6px;font-size:11px" title="حذف الشحنة">🗑️</button>` : ''}
              </td>
            </tr>`;
          }).join("") || `<tr><td colspan="8" style="text-align:center;padding:16px;color:var(--muted)">لا توجد شحنات مسجلة مطابقة للبحث</td></tr>`}
        </tbody>
      </table></div>
    </div>
    ${showYieldModal ? renderYieldModal(st) : ""}
    ${activeYieldDetailsId ? renderYieldDetailsModal(st) : ""}
    ${showYieldNewSeasonModal ? yieldNewSeasonModalHtml(st, season) : ""}
    ${showEditYieldModal ? renderEditYieldModal(st) : ""}
  `;
}

function zakatAdminView() {
  const st = Store.get();
  const currentProjId = st.activeProjectId || "proj_farafra_01";
  const projBatches = (st.zakatBatches || []).filter(b => b.projectId ? b.projectId === currentProjId : currentProjId === "proj_farafra_01");
  const seasons = getZakatSeasons(st);
  const season = zakatSeason || seasons[0] || "2026";
  const rate = +(st.settings.zakatRate || 5);
  const allInvestors = st.users.filter(u => u.role === "investor");
  const signedCount = (st.zakat || []).filter(z => String(z.season) === String(season) && z.pledgeStatus === "signed").length;
  const pendingInvestorsCount = Math.max(0, allInvestors.length - signedCount);

  return `
    <!-- Consolidated Top Header: Title, 5% Badge, Season Picker & Primary Actions -->
    <div class="card" style="margin-bottom:12px;padding:12px 16px;background:#fff;border:1px solid var(--line);border-radius:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
        <!-- Title & Badges -->
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <div style="font-size:26px">⚖️</div>
          <div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <h3 style="margin:0;font-size:18px;font-weight:800;color:var(--text)">إدارة الزكاة ورعاية المستثمرين (CSR)</h3>
              <span class="chip" style="background:#DCFCE7;color:#15803D;font-weight:700;font-size:11px;padding:2px 8px;border-radius:12px;border:1px solid #86EFAC">النسبة الشرعية: ${rate}٪ (ري صناعي)</span>
            </div>
            <div class="muted" style="font-size:12px;margin-top:2px">
              شراكات مجتمعية موثقة • توثيق الإيصالات الشرعية • إبراء ذمة المستثمرين
            </div>
          </div>
        </div>

        <!-- Inline Controls: Season Selector & Actions -->
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <div style="display:inline-flex;align-items:center;gap:4px;background:#F8FAFC;border:1px solid #CBD5E1;border-radius:8px;padding:3px 8px">
            <span style="font-size:12px;font-weight:700;color:#475569">📅 الموسم:</span>
            <select id="zadm_season_sel" data-act="zakat-change-season" style="padding:3px 8px;font-size:12px;border-radius:6px;border:1px solid var(--green);font-weight:bold;background:#fff;cursor:pointer">
              ${seasons.map(s => `<option value="${s}" ${String(s) === String(season) ? 'selected' : ''}>${s}م</option>`).join("")}
            </select>
            <button class="btn btn-ghost btn-sm" data-act="zakat-open-new-season" style="padding:2px 6px;font-size:12px;color:var(--green-d);font-weight:700" title="بدء دورة موسم سنوي جديد">➕ جديد</button>
          </div>

          <!-- Quick Modal Launchers -->
          <button class="btn btn-primary btn-sm" data-act="zakat-open-bcast-modal" style="padding:6px 12px;font-size:12px">
            📢 إشعار وتفويض
            ${pendingInvestorsCount > 0 ? `<span style="background:rgba(255,255,255,0.35);padding:1px 6px;border-radius:10px;font-size:10px;font-weight:700">${pendingInvestorsCount} معلق</span>` : ""}
          </button>

          ${zakatAdminTab === "batches" ? `<button class="btn btn-primary btn-sm" data-act="zakat-open-batch-modal" style="padding:6px 12px;font-size:12px">➕ إنشاء إرسالية مجمعة</button>` : ""}
          ${zakatAdminTab === "charities" ? `<button class="btn btn-primary btn-sm" data-act="zakat-open-charity-modal" style="padding:6px 12px;font-size:12px">➕ إضافة جمعية معتمدة</button>` : ""}
          ${zakatAdminTab === "policy" ? `<button class="btn btn-primary btn-sm" data-act="zakat-print-empty-pledge" style="padding:6px 12px;font-size:12px">🖨️ طباعة نموذج التعهد</button>` : ""}
        </div>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="ptabs" style="margin:6px 0 12px;gap:6px">
      <button class="${zakatAdminTab==='kpi'?'on':''}" data-act="zakat-adm-tab" data-id="kpi">📊 لوحة الأثر والمؤشرات</button>
      <button class="${zakatAdminTab==='investors'?'on':''}" data-act="zakat-adm-tab" data-id="investors">👥 دليل المستثمرين والبحث (${allInvestors.length})</button>
      <button class="${zakatAdminTab==='batches'?'on':''}" data-act="zakat-adm-tab" data-id="batches">📦 الشحنات المجمعة (${projBatches.filter(b => String(b.season) === String(season)).length})</button>
      <button class="${zakatAdminTab==='charities'?'on':''}" data-act="zakat-adm-tab" data-id="charities">🏛️ الجمعيات المعتمدة (${st.charities.filter(c=>!c.hidden).length})</button>
      <button class="${zakatAdminTab==='policy'?'on':''}" data-act="zakat-adm-tab" data-id="policy">📜 نموذج وسياسة التعهد</button>
    </div>

    ${zakatAdminTab === "kpi" ? zakatKpiSubView(st, season, rate)
      : zakatAdminTab === "investors" ? zakatInvestorsSubView(st, season, rate)
      : zakatAdminTab === "batches" ? zakatBatchesSubView(st, season)
      : zakatAdminTab === "charities" ? zakatCharitiesSubView(st)
      : zakatPolicySubView(st)}

    ${showBroadcastZakatModal ? zakatBroadcastModalHtml(st, season) : ""}
    ${showNewSeasonModal ? zakatNewSeasonModalHtml(st) : ""}
    ${showCharityModal ? zakatCharityModalHtml(st) : ""}
    ${showBatchModal ? zakatBatchModalHtml(st, season) : ""}
    ${showSignedDocModal ? zakatSignedDocModalHtml(st) : ""}
    ${showCertModal ? zakatCertModalHtml(st) : ""}
    ${showPrintPledgeModal ? zakatPrintPledgeModalHtml(st) : ""}
  `;
}

function zakatKpiSubView(st, season, rate) {
  const currentProjId = st.activeProjectId || "proj_farafra_01";
  const projBatches = (st.zakatBatches || []).filter(b => b.projectId ? b.projectId === currentProjId : currentProjId === "proj_farafra_01");
  
  // Total farm yields for comparison
  const totalFarmDatesYield = st.yields.filter(y => String(y.season)===season && (y.cropId||"palm")==="palm").reduce((a,y)=>a+(+y.kg||0),0);
  const totalFarmOlivesYield = st.yields.filter(y => String(y.season)===season && y.cropId==="olive").reduce((a,y)=>a+(+y.kg||0),0);

  // Requirement 4: Calculate zakatable yield ONLY for contracts/plots whose owners have signed the zakat delegation
  const datesYield = st.yields.filter(y => String(y.season)===season && (y.cropId||"palm")==="palm" && isYieldZakatDelegated(y, st, season)).reduce((a,y)=>a+(+y.kg||0),0);
  const olivesYield = st.yields.filter(y => String(y.season)===season && y.cropId==="olive" && isYieldZakatDelegated(y, st, season)).reduce((a,y)=>a+(+y.kg||0),0);
  const dueDatesKg = +(datesYield * rate / 100).toFixed(2);
  const dueOlivesKg = +(olivesYield * rate / 100).toFixed(2);

  const batchDatesKg = projBatches.filter(b => String(b.season) === String(season) && (b.cropId === "palm" || !b.cropId)).reduce((a, b) => a + (+b.totalKg || 0), 0);
  const batchOlivesKg = projBatches.filter(b => String(b.season) === String(season) && b.cropId === "olive").reduce((a, b) => a + (+b.totalKg || 0), 0);
  const batchCash = projBatches.filter(b => String(b.season) === String(season)).reduce((a, b) => a + (+b.totalAmount || 0), 0);

  const transferDatesKg = (st.zakatTransfers || []).filter(t => t.kind === "kind" && (t.cropId || "palm") === "palm").reduce((a, t) => a + (+t.kg || 0), 0);
  const transferOlivesKg = (st.zakatTransfers || []).filter(t => t.kind === "kind" && t.cropId === "olive").reduce((a, t) => a + (+t.kg || 0), 0);
  const transferCash = (st.zakatTransfers || []).filter(t => t.kind !== "kind").reduce((a, t) => a + (+t.amount || 0), 0);

  const totalDisbursedDatesKg = batchDatesKg + transferDatesKg;
  const totalDisbursedOlivesKg = batchOlivesKg + transferOlivesKg;
  const totalDisbursedKg = totalDisbursedDatesKg + totalDisbursedOlivesKg;
  const totalDisbursedCash = batchCash + transferCash;

  const remainDatesKg = Math.max(0, +(dueDatesKg - totalDisbursedDatesKg).toFixed(2));
  const remainOlivesKg = Math.max(0, +(dueOlivesKg - totalDisbursedOlivesKg).toFixed(2));
  const estFamilies = Math.max(120, Math.round(totalDisbursedKg / 5));

  const allInvestors = st.users.filter(u => u.role === "investor");
  const signedPledgesCount = (st.zakat || []).filter(z => String(z.season) === String(season) && z.pledgeStatus === "signed").length;
  const pledgePct = allInvestors.length ? Math.round((signedPledgesCount / allInvestors.length) * 100) : 0;

  // Selected crop contextual values
  let selectedHarvestKg = datesYield + olivesYield;
  let selectedDueKg = +(dueDatesKg + dueOlivesKg).toFixed(1);
  let selectedDisbursedKg = totalDisbursedKg;
  let selectedRemainKg = +(remainDatesKg + remainOlivesKg).toFixed(1);
  let cropLabel = "شامل المزرعة (تمور وزيتون)";

  if (zakatCropTab === "palm") {
    selectedHarvestKg = datesYield;
    selectedDueKg = dueDatesKg;
    selectedDisbursedKg = totalDisbursedDatesKg;
    selectedRemainKg = remainDatesKg;
    cropLabel = "محصول التمور";
  } else if (zakatCropTab === "olive") {
    selectedHarvestKg = olivesYield;
    selectedDueKg = dueOlivesKg;
    selectedDisbursedKg = totalDisbursedOlivesKg;
    selectedRemainKg = remainOlivesKg;
    cropLabel = "محصول الزيتون";
  }

  return `
    <!-- Crop Filter Pills Bar -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div style="display:inline-flex;background:#F1F5F9;padding:3px;border-radius:20px;gap:4px;border:1px solid #CBD5E1">
        <button type="button" class="btn btn-ghost btn-sm" data-act="zakat-tab" data-id="all" style="border-radius:16px;padding:4px 12px;font-size:12px;font-weight:700;border:none;background:${zakatCropTab === 'all' ? 'var(--green)' : 'transparent'};color:${zakatCropTab === 'all' ? '#fff' : '#475569'};cursor:pointer">🌐 شامل المزرعة (${(datesYield + olivesYield).toLocaleString()} كجم مفوض)</button>
        <button type="button" class="btn btn-ghost btn-sm" data-act="zakat-tab" data-id="palm" style="border-radius:16px;padding:4px 12px;font-size:12px;font-weight:700;border:none;background:${zakatCropTab === 'palm' ? 'var(--green)' : 'transparent'};color:${zakatCropTab === 'palm' ? '#fff' : '#475569'};cursor:pointer">🌴 زكاة التمور (${datesYield.toLocaleString()} كجم)</button>
        <button type="button" class="btn btn-ghost btn-sm" data-act="zakat-tab" data-id="olive" style="border-radius:16px;padding:4px 12px;font-size:12px;font-weight:700;border:none;background:${zakatCropTab === 'olive' ? 'var(--green)' : 'transparent'};color:${zakatCropTab === 'olive' ? '#fff' : '#475569'};cursor:pointer">${cropIcon('olive', 14)} زكاة الزيتون (${olivesYield.toLocaleString()} كجم)</button>
      </div>
      <div class="muted" style="font-size:12px">
        الواجب الشرعي المفوض: <b>${selectedDueKg.toLocaleString()} كجم</b> (${rate}٪ ري صناعي) • إجمالي إنتاج المزرعة: <b>${(totalFarmDatesYield + totalFarmOlivesYield).toLocaleString()} كجم</b>
      </div>
    </div>

    <!-- Seasonal Execution Pipeline (Interactive 4-Step Stepper) -->
    <div class="card" style="margin-bottom:14px;padding:12px 16px;background:linear-gradient(135deg, #F8FAFC 0%, #F0FDF4 100%);border:1px solid #BBF7D0;border-radius:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">
        <div style="font-size:13px;font-weight:800;color:var(--text);display:flex;align-items:center;gap:6px">
          <span>🔄 مسار دورة الزكاة التنفيذية لموسم ${season}م</span>
          <span style="font-size:11px;font-weight:600;color:#64748B">(مراحل الحصاد، التفويض، التوزيع، وإبراء الذمة)</span>
        </div>
        <div style="font-size:11px;font-weight:700;color:#15803D;background:#DCFCE7;padding:2px 8px;border-radius:10px;border:1px solid #86EFAC">
          دورة نشطة لموسم ${season}م
        </div>
      </div>

      <div class="grid grid-4" style="gap:10px">
        <!-- Stage 1 -->
        <div style="background:#fff;border:1px solid #E2E8F0;border-top:3px solid #16A34A;border-radius:8px;padding:10px 12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <span style="font-size:11px;font-weight:700;color:#64748B">المرحلة ١</span>
            <span style="font-size:10px;font-weight:800;color:#16A34A;background:#DCFCE7;padding:1px 6px;border-radius:8px">✓ مكتمل</span>
          </div>
          <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:2px">احتساب المحصول والواجب</div>
          <div style="font-size:11px;color:#475569;line-height:1.4">
            المحصول المفوض: <b>${(datesYield + olivesYield).toLocaleString()}</b> كجم <span class="muted" style="font-size:10px">(من أصل ${(totalFarmDatesYield + totalFarmOlivesYield).toLocaleString()} كجم إجمالي المزرعة)</span><br>
            الواجب المفوض (${rate}٪): <b>${(dueDatesKg + dueOlivesKg).toLocaleString()}</b> كجم
          </div>
        </div>

        <!-- Stage 2 -->
        <div style="background:#fff;border:1px solid #E2E8F0;border-top:3px solid ${pledgePct >= 80 ? '#16A34A' : '#D97706'};border-radius:8px;padding:10px 12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <span style="font-size:11px;font-weight:700;color:#64748B">المرحلة ٢</span>
            <span style="font-size:10px;font-weight:800;color:${pledgePct >= 80 ? '#16A34A' : '#D97706'};background:${pledgePct >= 80 ? '#DCFCE7' : '#FEF3C7'};padding:1px 6px;border-radius:8px">${pledgePct}٪ تفويض</span>
          </div>
          <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:2px">تفويض المستثمرين والتعهد</div>
          <div style="font-size:11px;color:#475569;line-height:1.4">
            <b>${signedPledgesCount}</b> من أصل <b>${allInvestors.length}</b> مستثمر<br>
            <span style="color:${allInvestors.length - signedPledgesCount > 0 ? '#D97706' : '#16A34A'}">${allInvestors.length - signedPledgesCount > 0 ? `متبقي ${allInvestors.length - signedPledgesCount} تفويض` : 'اكتملت التفويضات'}</span>
          </div>
        </div>

        <!-- Stage 3 -->
        <div style="background:#fff;border:1px solid #E2E8F0;border-top:3px solid ${remainDatesKg + remainOlivesKg === 0 ? '#16A34A' : '#2563EB'};border-radius:8px;padding:10px 12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <span style="font-size:11px;font-weight:700;color:#64748B">المرحلة ٣</span>
            <span style="font-size:10px;font-weight:800;color:${remainDatesKg + remainOlivesKg === 0 ? '#16A34A' : '#2563EB'};background:${remainDatesKg + remainOlivesKg === 0 ? '#DCFCE7' : '#DBEAFE'};padding:1px 6px;border-radius:8px">${totalDisbursedKg > 0 ? 'جارٍ التسليم' : 'بانتظار الصرف'}</span>
          </div>
          <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:2px">تسليم الجمعيات المعتمدة</div>
          <div style="font-size:11px;color:#475569;line-height:1.4">
            المسلّم: <b>${totalDisbursedKg.toLocaleString()}</b> كجم عيني<br>
            النقدي: <b>${money(totalDisbursedCash)}</b>
          </div>
        </div>

        <!-- Stage 4 -->
        <div style="background:#fff;border:1px solid #E2E8F0;border-top:3px solid #8B5CF6;border-radius:8px;padding:10px 12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <span style="font-size:11px;font-weight:700;color:#64748B">المرحلة ٤</span>
            <span style="font-size:10px;font-weight:800;color:#8B5CF6;background:#EDE9FE;padding:1px 6px;border-radius:8px">${st.charities.filter(c=>!c.hidden).length} جهات شريكة</span>
          </div>
          <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:2px">توثيق الإيصالات وإبراء الذمة</div>
          <div style="font-size:11px;color:#475569;line-height:1.4">
            الإرساليات: <b>${(st.zakatBatches||[]).filter(b => String(b.season) === String(season)).length}</b> شحنة موثقة<br>
            إيصالات رسمية وشهادات سداد
          </div>
        </div>
      </div>
    </div>

    <!-- Unified Impact & Audit Grid (2 Balanced Columns) -->
    <div class="grid grid-2" style="gap:12px;margin-bottom:14px">
      <!-- Section 1: الحصاد والاستحقاق الشرعي -->
      <div class="card" style="padding:16px;background:#fff;border:1px solid var(--line);border-radius:12px;border-top:3px solid var(--green)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:18px">🌾</span>
            <b style="font-size:14px;color:var(--text)">الحصاد والاستحقاق الشرعي</b>
          </div>
          <span class="chip" style="font-size:11px;font-weight:700;background:#F1F5F9;color:#475569;border-radius:8px;padding:2px 8px">${cropLabel}</span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;text-align:center">
          <div style="background:#F8FAFC;padding:10px 6px;border-radius:8px;border:1px solid #E2E8F0">
            <div style="font-size:17px;font-weight:800;color:var(--text)">${selectedHarvestKg.toLocaleString()} <span style="font-size:10px;font-weight:normal">كجم</span></div>
            <div style="font-size:11px;color:#64748B;margin-top:2px">إجمالي المحصول</div>
          </div>
          <div style="background:#F8FAFC;padding:10px 6px;border-radius:8px;border:1px solid #E2E8F0">
            <div style="font-size:17px;font-weight:800;color:var(--green-d)">${selectedDueKg.toLocaleString()} <span style="font-size:10px;font-weight:normal">كجم</span></div>
            <div style="font-size:11px;color:#64748B;margin-top:2px">الواجب الشرعي (${rate}٪)</div>
          </div>
          <div style="background:#F8FAFC;padding:10px 6px;border-radius:8px;border:1px solid ${selectedRemainKg === 0 ? '#BBF7D0' : '#FED7AA'}">
            <div style="font-size:17px;font-weight:800;color:${selectedRemainKg === 0 ? '#16A34A' : '#C2410C'}">${selectedRemainKg.toLocaleString()} <span style="font-size:10px;font-weight:normal">كجم</span></div>
            <div style="font-size:11px;color:#64748B;margin-top:2px">${selectedRemainKg === 0 ? '✓ تم تغطية الواجب' : 'المتبقي للتسليم'}</div>
          </div>
        </div>

        <div style="margin-top:12px;padding:8px 10px;background:#F8FAFC;border-radius:8px;font-size:12px;color:#475569;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px">
          <span>📦 <b>تفصيل المحصول:</b> تمور ${datesYield.toLocaleString()} كجم • زيتون ${olivesYield.toLocaleString()} كجم</span>
          <span style="font-weight:700;color:var(--green-d)">المسلّم حتى الآن: ${selectedDisbursedKg.toLocaleString()} كجم</span>
        </div>
      </div>

      <!-- Section 2: الأثر المجتمعي ورعاية المستثمرين -->
      <div class="card" style="padding:16px;background:#fff;border:1px solid var(--line);border-radius:12px;border-top:3px solid #C85A2E">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:18px">🤝</span>
            <b style="font-size:14px;color:var(--text)">الأثر المجتمعي ورعاية المستثمرين (CSR)</b>
          </div>
          <span class="chip" style="font-size:11px;font-weight:700;background:#FEF3C7;color:#92400E;border-radius:8px;padding:2px 8px">شراكات خيرية موثقة</span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;text-align:center">
          <div style="background:#F8FAFC;padding:10px 6px;border-radius:8px;border:1px solid #E2E8F0">
            <div style="font-size:17px;font-weight:800;color:#C85A2E">${estFamilies}+</div>
            <div style="font-size:11px;color:#64748B;margin-top:2px">أسر متعففة مستفيدة</div>
          </div>
          <div style="background:#F8FAFC;padding:10px 6px;border-radius:8px;border:1px solid #E2E8F0">
            <div style="font-size:17px;font-weight:800;color:#16A34A">${pledgePct}٪</div>
            <div style="font-size:11px;color:#64748B;margin-top:2px">تفويض المستثمرين (${signedPledgesCount}/${allInvestors.length})</div>
          </div>
          <div style="background:#F8FAFC;padding:10px 6px;border-radius:8px;border:1px solid #E2E8F0">
            <div style="font-size:17px;font-weight:800;color:#2563EB">${st.charities.filter(c=>!c.hidden).length}</div>
            <div style="font-size:11px;color:#64748B;margin-top:2px">جمعيات وهيئات معتمدة</div>
          </div>
        </div>

        <div style="margin-top:12px;padding:8px 10px;background:#F8FAFC;border-radius:8px;font-size:12px;color:#475569;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px">
          <span>💰 <b>الصرف الفعلي:</b> عيني ${totalDisbursedKg.toLocaleString()} كجم • نقدي ${money(totalDisbursedCash)}</span>
          <span style="font-weight:700;color:#C85A2E">${(st.zakatBatches||[]).filter(b => String(b.season) === String(season)).length} إرسالية مجمعة</span>
        </div>
      </div>
    </div>

    ${(() => {
      const reqs = st.zakat.filter(z => z.cancelRequested);
      if (!reqs.length) return "";
      return `<div class="card" style="margin:10px 0;border:2px solid #C85A2E">
        <h3 style="color:#C85A2E">⚠️ طلبات إلغاء تفويض الزكاة (${reqs.length})</h3>
        ${reqs.map(z => {
          const inv = userBy(z.investorId);
          return `<div class="list-item">
            <div><b>${inv?.name||"—"}</b><div class="muted">موسم ${z.season||"—"} • ${money(z.amount)} • السبب: ${z.cancelReason||"بدون سبب"}</div></div>
            <div class="row-acts">
              <button class="btn btn-primary icon-btn" data-act="accept-cancel" data-id="${z.id}">قبول الإلغاء</button>
              <button class="btn btn-ghost icon-btn" data-act="reject-cancel" data-id="${z.id}">رفض</button>
            </div>
          </div>`;
        }).join("")}
      </div>`;
    })()}
  `;
}

function zakatInvestorsSubView(st, season, rate) {
  const me = session();
  const canDeleteZakat = hasPerm("zakat_delete") || hasPerm("d", "zakat") || me?.role === "admin";
  const allInvestors = st.users.filter(u => u.role === "investor");

  // Collect distinct plots owned by investors
  const distinctPlots = [...new Set(allInvestors.flatMap(u => u.plots || []))].filter(Boolean).sort();

  // Filter investors
  const filtered = allInvestors.filter(inv => {
    const zak = (st.zakat || []).find(z => z.investorId === inv.id && String(z.season) === String(season));
    const invPlots = inv.plots || [];

    if (zakatInvSearch) {
      const q = zakatInvSearch.trim().toLowerCase();
      const matchName = (inv.name || "").toLowerCase().includes(q);
      const matchPhone = (inv.phone || "").toLowerCase().includes(q);
      const matchPlot = invPlots.some(p => p.toLowerCase().includes(q));
      if (!matchName && !matchPhone && !matchPlot) return false;
    }

    if (zakatInvPlot !== "all") {
      if (!invPlots.includes(zakatInvPlot)) return false;
    }

    if (zakatInvStatus !== "all") {
      const pSt = zak?.pledgeStatus || "pending";
      const bId = zak?.batchId;
      if (zakatInvStatus === "signed" && pSt !== "signed") return false;
      if (zakatInvStatus === "pending" && pSt !== "pending") return false;
      if (zakatInvStatus === "delivered" && !bId) return false;
    }

    if (zakatInvCharity !== "all") {
      const chId = zak?.charityId || "";
      if (zakatInvCharity === "none" && chId) return false;
      if (zakatInvCharity !== "none" && chId !== zakatInvCharity) return false;
    }

    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / zakatInvSize));
  if (zakatInvPage > totalPages) zakatInvPage = totalPages;
  const startIdx = (zakatInvPage - 1) * zakatInvSize;
  const paged = filtered.slice(startIdx, startIdx + zakatInvSize);

  return `
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
        <div style="flex:2;min-width:200px">
          <label>🔍 بحث شامل (المستثمر / الهاتف / القطعة)</label>
          <input id="zinv-q" value="${escapeHtml(zakatInvSearch)}" placeholder="ابحث بالاسم أو الهاتف أو رقم القطعة (مثال: 03-12A)" />
        </div>
        <div style="flex:1;min-width:140px">
          <label>🗺️ القطعة المملوكة</label>
          <select id="zinv-plot">
            <option value="all" ${zakatInvPlot==="all"?"selected":""}>جميع القطع</option>
            ${distinctPlots.map(p => `<option value="${p}" ${zakatInvPlot===p?"selected":""}>القطعة ${p}</option>`).join("")}
          </select>
        </div>
        <div style="flex:1;min-width:140px">
          <label>📑 حالة التعهد والتفويض</label>
          <select id="zinv-status">
            <option value="all" ${zakatInvStatus==="all"?"selected":""}>جميع الحالات</option>
            <option value="signed" ${zakatInvStatus==="signed"?"selected":""}>موقع ومعتمد ✅</option>
            <option value="pending" ${zakatInvStatus==="pending"?"selected":""}>بانتظار التوقيع ⏳</option>
            <option value="delivered" ${zakatInvStatus==="delivered"?"selected":""}>مدرج في شحنة 📦</option>
          </select>
        </div>
        <div style="flex:1;min-width:140px">
          <label>🏛️ الجمعية المرغوبة</label>
          <select id="zinv-charity">
            <option value="all" ${zakatInvCharity==="all"?"selected":""}>جميع الجمعيات</option>
            ${st.charities.filter(c=>!c.hidden).map(c => `<option value="${c.id}" ${zakatInvCharity===c.id?"selected":""}>${c.name}</option>`).join("")}
            <option value="none" ${zakatInvCharity==="none"?"selected":""}>لم يحدد جمعية</option>
          </select>
        </div>
        <div style="width:110px">
          <label>عدد بالعرض</label>
          <select id="zinv-size">
            <option value="5" ${zakatInvSize===5?"selected":""}>5 في الصفحة</option>
            <option value="10" ${zakatInvSize===10?"selected":""}>10 في الصفحة</option>
            <option value="20" ${zakatInvSize===20?"selected":""}>20 في الصفحة</option>
          </select>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-primary" data-act="zakat-inv-filter">تطبيق</button>
          <button class="btn btn-ghost" data-act="zakat-inv-reset">إعادة ضبط</button>
        </div>
      </div>
    </div>

    ${zakatSelectedInvIds.size > 0 ? `
      <div class="card" style="background:#e0f2fe;border:1px solid #0284c7;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div>
          <b>تم اختيار (${zakatSelectedInvIds.size}) مستثمر</b> • يمكنك ربطهم فوراً بإرسالية زكاة مجمعة جديدة.
        </div>
        <button class="btn btn-primary" data-act="zakat-batch-from-selected">📦 إنشاء شحنة زكاة مجمعة للمحددين (${zakatSelectedInvIds.size})</button>
      </div>
    ` : ""}

    <div class="card">
      <div class="grid-wrap">
        <table class="dense">
          <thead>
            <tr>
              <th style="width:36px;text-align:center">
                <input type="checkbox" data-act="zakat-toggle-all-inv" ${paged.length && paged.every(inv => zakatSelectedInvIds.has(inv.id)) ? "checked" : ""} />
              </th>
              <th>المستثمر</th>
              <th>القطع المملوكة</th>
              <th>النصاب المقدر (${season})</th>
              <th>الجمعية المرغوبة</th>
              <th>حالة التعهد</th>
              <th>الإيصال والشحنة</th>
              <th style="text-align:center">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            ${paged.map(inv => {
              const zak = (st.zakat || []).find(z => z.investorId === inv.id && String(z.season) === String(season));
              const batch = (st.zakatBatches || []).find(b => String(b.season) === String(season) && (b.id === zak?.batchId || (b.investors && b.investors.some(i => i.investorId === inv.id))));
              const isSelected = zakatSelectedInvIds.has(inv.id);
              const dueKg = zak?.dueKg || (inv.plots?.length ? inv.plots.length * 120 : 150);
              const dueAmt = zak?.amount || (dueKg * 99);
              const pSt = zak?.pledgeStatus || "pending";
              const invCharityId = zak?.charityId || "";
              const invCharityObj = st.charities.find(c => c.id === invCharityId);

              return `<tr class="${isSelected ? 'active-row' : ''}">
                <td style="text-align:center">
                  <input type="checkbox" data-act="zakat-toggle-inv-sel" data-id="${inv.id}" ${isSelected ? "checked" : ""} />
                </td>
                <td>
                  <b>${inv.name}</b>
                  <div class="muted" style="font-size:11px">${inv.phone || "—"}</div>
                </td>
                <td>
                  ${(inv.plots || []).map(p => `<span class="badge badge-outline" style="margin:1px">${p}</span>`).join(" ") || "<span class='muted'>—</span>"}
                </td>
                <td>
                  <b style="color:var(--green-d)">${dueKg} كجم</b>
                  <div class="muted" style="font-size:11px">${money(dueAmt)}</div>
                </td>
                <td>
                  ${invCharityObj
                    ? `<span class="badge" style="background:#f0fdf4;color:#166534;font-size:11px;font-weight:bold" title="ترخيص: ${invCharityObj.licenseNo || ''}">🏛️ ${escapeHtml(invCharityObj.name)}</span>`
                    : `<span class="badge badge-outline" style="color:#64748b;font-size:10.5px">لم يحدد</span>`}
                </td>
                <td>
                  ${pSt === "signed"
                    ? `<span class="badge badge-ok" title="موقع ومفوض">✅ ${zak?.pledgeDocType === "upload" ? "مرفوع وموقع" : "موقع إلكترونياً"}</span>`
                    : `<span class="badge st-sync" title="بانتظار التوقيع">⏳ بانتظار التوقيع</span>`}
                </td>
                <td>
                  ${batch
                    ? `<span class="badge" style="background:#e0f2fe;color:#0369a1" title="${batch.batchNo}">📦 ${batch.receiptNo || batch.batchNo}</span>`
                    : `<span class="muted" style="font-size:11px">لم يدرج بعد</span>`}
                </td>
                <td style="text-align:center;white-space:nowrap">
                  ${pSt === "signed" ? `<button class="btn btn-ghost icon-btn" data-act="zakat-preview-signed" data-id="${inv.id}" title="معاينة التعهد الموثق">📄 تعهد</button>` : ""}
                  ${(pSt === "signed" && !!batch) ? `
                    <button class="btn btn-ghost icon-btn" data-act="zakat-view-cert" data-id="${inv.id}" title="إصدار واستعراض شهادة إبراء الذمة المعتمدة" style="color:var(--green-d);font-weight:bold">🏆 إصدار الشهادة</button>
                  ` : (pSt !== "signed") ? `
                    <button class="btn btn-ghost icon-btn" disabled style="opacity:0.4;cursor:not-allowed" title="لا يمكن إصدار الشهادة: بانتظار توقيع المستثمر على تفويض إخراج الزكاة">🔒 مقفلة (بانتظار التفويض)</button>
                  ` : `
                    <button class="btn btn-ghost icon-btn" disabled style="opacity:0.4;cursor:not-allowed" title="لا يمكن إصدار الشهادة: تم توقيع التفويض وبانتظار قيام الشركة بإخراج الزكاة وتسليمها للجمعية">⏳ بانتظار إخراج الزكاة</button>
                  `}
                  ${canDeleteZakat && pSt === "signed" ? `
                    <button class="btn btn-ghost icon-btn" data-act="zakat-reset-pledge" data-id="${inv.id}" title="إلغاء التفويض وإعادة ضبط استحقاق الزكاة" style="color:#DC2626">↩️ إلغاء التفويض</button>
                  ` : ""}
                </td>
              </tr>`;
            }).join("") || "<tr><td colspan='8' style='text-align:center;padding:16px' class='muted'>لا يوجد مستثمرون مطابقون لخيارات البحث</td></tr>"}
          </tbody>
        </table>
      </div>

      <div class="pagination-wrap">
        <div class="muted">
          عرض ${filtered.length ? startIdx + 1 : 0} إلى ${Math.min(startIdx + zakatInvSize, filtered.length)} من أصل ${filtered.length} مستثمر
        </div>
        <div class="pagination-btns">
          <button class="pagination-btn" data-act="zakat-inv-page" data-id="${zakatInvPage - 1}" ${zakatInvPage <= 1 ? "disabled" : ""}>السابق</button>
          ${Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
            <button class="pagination-btn ${p === zakatInvPage ? 'on' : ''}" data-act="zakat-inv-page" data-id="${p}">${p}</button>
          `).join("")}
          <button class="pagination-btn" data-act="zakat-inv-page" data-id="${zakatInvPage + 1}" ${zakatInvPage >= totalPages ? "disabled" : ""}>التالي</button>
        </div>
      </div>
    </div>
  `;
}

function zakatBatchesSubView(st, season) {
  const currentProjId = st.activeProjectId || "proj_farafra_01";
  const me = session();
  const canApproveZakat = hasPerm("zakat_approve") || hasPerm("a", "zakat") || me?.role === "admin";
  const canDeleteZakat = hasPerm("zakat_delete") || hasPerm("d", "zakat") || me?.role === "admin";
  const batches = (st.zakatBatches || []).filter(b => {
    if (season && String(b.season) !== String(season)) return false;
    if (b.projectId) return b.projectId === currentProjId;
    return currentProjId === "proj_farafra_01";
  });

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div>
        <h4 style="margin:0">شحنات الزكاة المجمعة المسلمة للجمعيات</h4>
        <div class="muted">توزيع مجمع لعدة مستثمرين بموجب إيصال رسمي واحد من الجمعية</div>
      </div>
      <button class="btn btn-primary" data-act="zakat-open-batch-modal">➕ إنشاء إرسالية مجمعة جديدة</button>
    </div>

    ${batches.length ? `
      <div style="display:flex;flex-direction:column;gap:12px">
        ${batches.map(b => {
          const ch = st.charities.find(c => c.id === b.charityId);
          const invs = b.investors || [];
          const isDraft = b.status === "draft";

          return `
            <div class="card" style="border-right:4px solid ${isDraft ? '#f59e0b' : 'var(--green)'}">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
                <div>
                  <div style="display:flex;gap:8px;align-items:center">
                    <h4 style="margin:0;color:var(--green-d)">${escapeHtml(b.batchNo)}</h4>
                    ${isDraft
                      ? `<span class="badge st-sync" style="background:#fef3c7;color:#b45309">مسودة بانتظار الاعتماد ⏳</span>`
                      : `<span class="badge badge-ok">مُسلّم وموزع معتمد ✅</span>`}
                  </div>
                  <div class="muted" style="margin-top:4px;font-size:12px">
                    🏛️ الجهة المستلمة: <b>${escapeHtml(ch?.name || "جمعية معتمدة")}</b> • ${escapeHtml(ch?.licenseNo || "ترخيص رسمي")}
                  </div>
                </div>
                <div style="text-align:left">
                  <div style="font-family:monospace;font-weight:bold;font-size:14px;color:#0284c7">إيصال رسمي: ${escapeHtml(b.receiptNo)}</div>
                  <div class="muted" style="font-size:12px">تاريخ التسليم: ${fmtDate(b.date)}</div>
                </div>
              </div>

              <div class="grid grid-3" style="margin:12px 0;padding:8px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)">
                <div><b>إجمالي الكمية:</b> ${b.totalKg} كجم (${escapeHtml(b.variety || "خلاص فاخر")})</div>
                <div><b>القيمة التقديرية:</b> ${money(b.totalAmount || 0)}</div>
                <div><b>عدد المشاركين:</b> ${invs.length} مستثمرين</div>
              </div>

              ${b.notes ? `<div style="font-size:12px;color:var(--muted);margin-bottom:10px">📝 <b>ملاحظات:</b> ${escapeHtml(b.notes)}</div>` : ""}

              <div>
                <b style="font-size:12px">المستثمرون المشاركون في الإيصال:</b>
                <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
                  ${invs.map(i => `
                    <span class="badge" style="background:#f1f5f9;color:#334155;font-size:11px;padding:4px 8px">
                      👤 ${escapeHtml(i.name)}: <b>${i.kg} كجم</b> (${money(i.amount)})
                    </span>
                  `).join("")}
                </div>
              </div>

              <div class="row-acts" style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
                <button class="btn btn-ghost icon-btn" data-act="zakat-print-receipt" data-id="${b.id}">🖨️ طباعة إيصال الجمعية</button>
                ${canApproveZakat ? `
                  <button class="btn btn-ghost icon-btn" data-act="zakat-toggle-approve-batch" data-id="${b.id}" style="${isDraft ? 'color:#15803d;font-weight:bold' : ''}">
                    ${isDraft ? "✅ اعتماد تسليم وصرف الشحنة" : "↩️ إعادة لمسودة قيد المراجعة"}
                  </button>
                ` : ""}
                ${canDeleteZakat ? `
                  <button class="btn btn-ghost icon-btn" data-act="zakat-delete-batch" data-id="${b.id}" style="color:#DC2626">
                    🗑️ إلغاء وحذف الشحنة
                  </button>
                ` : ""}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    ` : `
      <div class="card" style="text-align:center;padding:32px">
        <div style="font-size:36px;margin-bottom:8px">📦</div>
        <h4>لا توجد إرساليات زكاة مجمعة مسجلة بعد</h4>
        <p class="muted">يمكنك اختيار مجموعة من المستثمرين وإنشاء شحنة زكاة مجمعة مربوطة بإيصال الجمعية الرسمي.</p>
        <button class="btn btn-primary" data-act="zakat-open-batch-modal" style="margin-top:10px">إنشاء أول إرسالية مجمعة</button>
      </div>
    `}
  `;
}

function zakatCharitiesSubView(st) {
  const charities = st.charities || [];

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div>
        <h4 style="margin:0">دليل الجمعيات والمؤسسات الأهلية المعتمدة</h4>
        <div class="muted">جهات شريكة موثقة رسمياً لقبول وتوزيع زكاة التمور والزيتون والمبالغ النقدية</div>
      </div>
      <button class="btn btn-primary" data-act="zakat-open-charity-modal">➕ إضافة جمعية معتمدة جديدة</button>
    </div>

    <div class="grid grid-2" style="gap:12px">
      ${charities.map(c => {
        const receivedBatches = (st.zakatBatches || []).filter(b => b.charityId === c.id);
        const totalKg = receivedBatches.reduce((a, b) => a + (+b.totalKg || 0), 0);

        return `
          <div class="card" style="opacity:${c.hidden ? '0.6' : '1'};border-top:3px solid ${c.hidden ? '#94a3b8' : 'var(--green)'}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <div>
                <h4 style="margin:0;color:var(--green-d)">${c.name}</h4>
                <div style="font-size:12px;color:var(--muted);margin-top:2px">
                  📜 ترخيص: <b>${c.licenseNo || "1042 / 2018"}</b>
                </div>
              </div>
              <span class="badge ${c.hidden ? 'badge-err' : 'badge-ok'}">
                ${c.hidden ? "موقوفة مؤقتاً" : "معتمدة ونشطة ✅"}
              </span>
            </div>

            <div style="font-size:12.5px;margin:10px 0;line-height:1.7">
              <div>👤 <b>مسؤول الاتصال:</b> ${c.contactPerson || "مسؤول التبرعات"} • 📞 ${c.phone || "—"}</div>
              <div>✉️ <b>البريد:</b> ${c.email || "—"}</div>
              <div>🏦 <b>الحساب البنكي:</b> ${c.bankName || "مصرف معتمد"} • <span class="masked-code" style="font-size:11px">${c.iban || "—"}</span></div>
              <div>📦 <b>نوع التبرع المقبول:</b> ${c.receive === "both" ? "عيني تمور/زيتون ونقدي" : c.receive === "cash" ? "نقدي فقط" : "عيني فقط"}</div>
              <div>🎯 <b>الفئات المستهدفة:</b> ${(c.categories || []).join("، ") || "أسر متعففة"}</div>
              <div style="margin-top:4px;color:var(--green-d);font-weight:bold">🚚 إجمالي المستلم: ${totalKg} كجم (${receivedBatches.length} شحنات)</div>
            </div>

            <div class="row-acts" style="border-top:1px solid var(--line);padding-top:8px">
              <button class="btn btn-ghost icon-btn" data-act="zakat-edit-charity" data-id="${c.id}">✏️ تعديل البيانات</button>
              <button class="btn btn-ghost icon-btn" data-act="zakat-toggle-charity" data-id="${c.id}">
                ${c.hidden ? "🟢 تفعيل" : "🔴 إيقاف مؤقت"}
              </button>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function zakatPolicySubView(st) {
  const pol = st.settings.zakatPolicy || {
    title: "سياسة وتعهد تفويض إدارة المزرعة في إخراج زكاة الزروع والثمار",
    version: "2.1",
    updatedAt: new Date().toISOString().slice(0, 10),
    terms: `1. يفوض المستثمر إدارة المزرعة بشكل رسمي في جذاذ واحتساب نصاب الزكاة الشرعي (5% للمروي صناعياً) من محاصيل نخيل التمر وأشجار الزيتون.
2. تلتزم الشركة بفرز وتعبئة ثمار الزكاة عيناً بأعلى معايير الجودة وتسليمها مباشرة للجمعيات والمؤسسات الخيرية المعتمدة رسمياً في سجلات الوزارة.
3. يحق للمستثمر الحصول على إيصال رسمي معتمد من الجمعية المستلمة يفيد إبراء ذمته الشرعية متضمناً رقم الإيصال وتاريخ الصرف.
4. تلتزم الشركة بأعلى معايير حماية الخصوصية، حيث يتم حجب أسماء وهواتف المستثمرين الآخرين في الإرساليات المشتركة.
5. يمكن للمستثمر طباعة هذا التعهد والتوقيع يدوياً أو التوقيع إلكترونياً عبر البوابة، ويعد التوقيع ملزماً للموسم الزراعي المحدد.`
  };

  return `
    <div class="grid grid-2" style="gap:14px">
      <div class="card">
        <h4>📝 تحرير وثيقة وسياسة التعهد والخدمة</h4>
        <p class="muted" style="font-size:12px">تظهر هذه البنود للمستثمر في بوابة الزكاة للتوقيع أو الطباعة.</p>

        <label>عنوان الوثيقة</label>
        <input id="zpol-title" value="${escapeHtml(pol.title)}" />

        <div class="grid grid-2" style="gap:8px">
          <div>
            <label>رقم الإصدار</label>
            <input id="zpol-version" value="${escapeHtml(pol.version)}" />
          </div>
          <div>
            <label>تاريخ آخر اعتماد</label>
            <input value="${escapeHtml(pol.updatedAt)}" readonly />
          </div>
        </div>

        <label>بنود التفويض والسياسة الشرعية</label>
        <textarea id="zpol-terms" rows="9" style="font-size:12.5px;line-height:1.6">${escapeHtml(pol.terms)}</textarea>

        <div class="row-acts" style="margin-top:10px">
          <button class="btn btn-primary" data-act="zakat-save-policy">💾 حفظ التحديثات والاعتماد</button>
          <button class="btn btn-ghost" data-act="zakat-print-empty-pledge">🖨️ طباعة نموذج التعهد فارغاً</button>
        </div>
      </div>

      <div class="card" style="background:#fffdfa;border:1px solid #fed7aa">
        <h4 style="color:#9a3412">👁️ معاينة نموذج التعهد المطبوع</h4>
        <div style="border:2px dashed #fdba74;border-radius:8px;padding:14px;background:#fff">
          <div style="text-align:center;border-bottom:1px solid #f97316;padding-bottom:8px;margin-bottom:10px">
            <h5 style="margin:0;color:#c2410c">${pol.title}</h5>
            <div class="muted" style="font-size:11px">إصدار ${pol.version} • معتمد لموسم 2026م</div>
          </div>
          <p style="font-size:12px;line-height:1.7;white-space:pre-line;color:#374151">
            ${escapeHtml(pol.terms)}
          </p>
          <div style="margin-top:14px;padding-top:10px;border-top:1px dashed #cbd5e1;display:flex;justify-content:space-between;font-size:11px">
            <div>اسم المستثمر: ..............................<br>التوقيع: ..............................</div>
            <div style="text-align:left">ختم الشركة:<br><b>[ إدارة رعاية العملاء والزكاة ]</b></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function zakatCharityModalHtml(st) {
  const isEdit = !!editCharityId;
  const ch = isEdit ? st.charities.find(c => c.id === editCharityId) : null;

  return `
    <div class="modal-backdrop">
      <div class="modal-box" style="max-width:550px">
        <h3>${isEdit ? "✏️ تعديل بيانات الجمعية المعتمدة" : "➕ إضافة جمعية خيرية معتمدة"}</h3>
        
        <label>اسم الجمعية / الهيئة الخيرية *</label>
        <input id="ch-name" value="${escapeHtml(ch?.name || '')}" placeholder="مثال: جمعية البر الخيرية" />

        <div class="grid grid-2" style="gap:8px">
          <div>
            <label>رقم الترخيص الرسمي *</label>
            <input id="ch-license" value="${escapeHtml(ch?.licenseNo || '')}" placeholder="مثال: 1042 / 2018" />
          </div>
          <div>
            <label>نوع التبرعات المقبولة</label>
            <select id="ch-receive">
              <option value="both" ${ch?.receive==="both"?"selected":""}>عيني تمور وزيتون ونقدي</option>
              <option value="kind" ${ch?.receive==="kind"?"selected":""}>عيني فقط (تمور وزيتون)</option>
              <option value="cash" ${ch?.receive==="cash"?"selected":""}>نقدي فقط</option>
            </select>
          </div>
        </div>

        <div class="grid grid-2" style="gap:8px">
          <div>
            <label>مسؤول الاتصال</label>
            <input id="ch-person" value="${escapeHtml(ch?.contactPerson || '')}" placeholder="اسم المسؤول" />
          </div>
          <div>
            <label>رقم الهاتف المعتمد</label>
            <input id="ch-phone" value="${escapeHtml(ch?.phone || '')}" placeholder="010... / 050..." />
          </div>
        </div>

        <div class="grid grid-2" style="gap:8px">
          <div>
            <label>البريد الإلكتروني</label>
            <input id="ch-email" value="${escapeHtml(ch?.email || '')}" placeholder="zakat@charity.org" />
          </div>
          <div>
            <label>اسم المصرف / البنك</label>
            <input id="ch-bank" value="${escapeHtml(ch?.bankName || '')}" placeholder="مصرف الراجحي / البنك الأهلي" />
          </div>
        </div>

        <label>رقم الآيبان (IBAN)</label>
        <input id="ch-iban" value="${escapeHtml(ch?.iban || '')}" placeholder="SA0000000000000000000000" />

        <label>الفئات المستهدفة (افصل بينها بفاصلة)</label>
        <input id="ch-cats" value="${escapeHtml(ch?.categories ? ch.categories.join('، ') : 'أسر متعففة، رعاية الأيتام، قرى نائية')}" />

        <label>ملاحظات إضافية</label>
        <textarea id="ch-notes" rows="2">${escapeHtml(ch?.notes || '')}</textarea>

        <div class="row-acts" style="margin-top:12px">
          <button class="btn btn-primary" data-act="zakat-save-charity">💾 حفظ البيانات</button>
          <button class="btn btn-ghost" data-act="zakat-close-charity-modal">إلغاء</button>
        </div>
      </div>
    </div>
  `;
}

function zakatBroadcastModalHtml(st, season) {
  const allInvestors = st.users.filter(u => u.role === "investor");
  const seasons = getZakatSeasons(st);
  const curSeason = season || zakatSeason || "2026";
  const unpledgedCount = allInvestors.filter(inv => {
    const z = (st.zakat || []).find(x => x.investorId === inv.id && String(x.season) === String(curSeason));
    return !z || z.pledgeStatus !== "signed";
  }).length;

  return `
    <div class="modal-backdrop">
      <div class="modal-box" style="max-width:560px">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding-bottom:10px">
          <h4 style="margin:0">📢 إرسال إشعار للمستثمرين بتوفر خدمة إخراج الزكاة</h4>
          <button class="btn btn-ghost icon-btn" data-act="zakat-close-broadcast">✕</button>
        </div>

        <div style="margin:14px 0">
          <div class="grid grid-2" style="gap:10px;margin-bottom:10px">
            <div>
              <label>الموسم المستهدف *</label>
              <select id="zbcast_season">
                ${seasons.map(s => `<option value="${s}" ${String(s) === String(curSeason) ? 'selected' : ''}>موسم عام ${s}م</option>`).join("")}
              </select>
            </div>
            <div>
              <label>الشريحة المستهدفة *</label>
              <select id="zbcast_target">
                <option value="unpledged">المستثمرون غير المفوضين بعد (${unpledgedCount} مستثمر)</option>
                <option value="all">كافة المستثمرين المسجلين (${allInvestors.length} مستثمر)</option>
              </select>
            </div>
          </div>

          <label>نص الإشعار التوعوي الموجه للمستثمر *</label>
          <textarea id="zbcast_text" rows="4" style="width:100%;box-sizing:border-box;font-size:13px;line-height:1.6;padding:8px">📢 خدمة إخراج زكاة التمور والثمار لموسم ${curSeason}م: يسر إدارة المزرعة تقديم خدمة احتساب وإخراج زكاتكم وإيصالها للجمعيات الخيرية المعتمدة رسمياً. يرجى الدخول لحسابكم وتعبئة وتوقيع نموذج تفويض الزكاة.</textarea>
          
          <div class="muted" style="font-size:12px;margin-top:6px;background:#f8fafc;padding:8px;border-radius:6px;border:1px solid #e2e8f0">
            ℹ️ سيصل هذا الإشعار إلى حسابات المستثمرين المستهدفين وسيتيح لهم زر الانتقال المباشر لبوابة الزكاة لبدء تعبئة وتوقيع التفويض فوراً لموسم ${curSeason}م.
          </div>
        </div>

        <div class="row-acts" style="margin-top:14px">
          <button class="btn btn-primary" data-act="zakat-send-broadcast">📨 إرسال الإشعار للمستثمرين</button>
          <button class="btn btn-ghost" data-act="zakat-close-broadcast">إلغاء</button>
        </div>
      </div>
    </div>
  `;
}

function zakatNewSeasonModalHtml(st) {
  const nextYear = String(new Date().getFullYear() + 1);

  return `
    <div class="modal-backdrop">
      <div class="modal-box" style="max-width:500px">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding-bottom:10px">
          <h4 style="margin:0">➕ بدء دورة موسم زكاة جديد</h4>
          <button class="btn btn-ghost icon-btn" data-act="zakat-close-new-season">✕</button>
        </div>

        <div style="margin:14px 0">
          <label>السنة / الموسم الجديد *</label>
          <input id="znew_season_input" type="number" value="${nextYear}" placeholder="مثال: 2027" style="font-size:16px;font-weight:bold" />

          <div style="margin:10px 0;padding:10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;font-size:12.5px;color:#166534;line-height:1.6">
            <b>🌱 ماذا يحدث عند بدء الموسم الجديد؟</b>
            <ul style="margin:6px 0 0 16px;padding:0">
              <li>يتم تفعيل العام الجديد في محدد المواسم للزكاة.</li>
              <li>توليد سجلات استحقاق تقديرية جديدة لكافة المستثمرين بحالة <b>بانتظار التفويض السنوي الجديد</b>.</li>
              <li>تبقى كافة بيانات وتفويضات وشهادات الأعوام السابقة محفوظة وموثقة دون أي تغيير.</li>
            </ul>
          </div>
        </div>

        <div class="row-acts" style="margin-top:14px">
          <button class="btn btn-primary" data-act="zakat-confirm-new-season">✅ إنشاء وتفعيل موسم الزكاة الجديد</button>
          <button class="btn btn-ghost" data-act="zakat-close-new-season">إلغاء</button>
        </div>
      </div>
    </div>
  `;
}

function updateZakatBatchInvestorsFilter() {
  const chSel = document.querySelector("#zb-charity");
  if (!chSel) return;
  const targetCharityId = chSel.value;
  const showAll = !!document.querySelector("#zb-show-all-charities")?.checked;
  const q = (document.querySelector("#zb_inv_search")?.value || "").trim().toLowerCase();
  
  let matchCount = 0;
  let matchKg = 0;

  const rows = document.querySelectorAll(".zb-inv-row");
  rows.forEach(row => {
    const rowCharity = row.getAttribute("data-charity") || "";
    const searchData = (row.getAttribute("data-search") || "").toLowerCase();
    
    const charityMatches = showAll || (rowCharity === targetCharityId);
    const searchMatches = !q || searchData.includes(q);

    if (charityMatches && searchMatches) {
      row.style.display = "flex";
      matchCount++;
      const chk = row.querySelector(".zb-inv-check");
      matchKg += Number(chk?.getAttribute("data-kg") || 0);
    } else {
      row.style.display = "none";
      const chk = row.querySelector(".zb-inv-check");
      if (chk && !showAll && rowCharity !== targetCharityId) {
        chk.checked = false;
      }
    }
  });

  const countEl = document.querySelector("#zb-matching-count");
  if (countEl) countEl.textContent = matchCount;
  const kgEl = document.querySelector("#zb-matching-kg");
  if (kgEl) kgEl.textContent = matchKg.toLocaleString();

  const emptyMsg = document.querySelector("#zb-empty-filter-msg");
  if (emptyMsg) {
    emptyMsg.style.display = matchCount === 0 ? "block" : "none";
  }
}
window.updateZakatBatchInvestorsFilter = updateZakatBatchInvestorsFilter;

function zakatBatchModalHtml(st, season) {
  const allInvestors = st.users.filter(u => u.role === "investor");
  const curSeason = season || zakatSeason || "2026";

  return `
    <div class="modal-backdrop">
      <div class="modal-box" style="max-width:680px">
        <input type="hidden" id="zb-season" value="${curSeason}" />
        <div style="display:flex;justify-content:space-between;align-items:center">
          <h3 style="margin:0">📦 إنشاء إرسالية زكاة مجمعة (موسم ${curSeason}م)</h3>
          <span class="badge badge-outline">موسم ${curSeason}</span>
        </div>
        <p class="muted" style="font-size:12px;margin:4px 0 10px">تجميع زكاة مجموعة مستثمرين وإصدار إيصال تسليم موحد ومعتمد من الجمعية.</p>

        <label>الجمعية المستلمة *</label>
        <select id="zb-charity" onchange="updateZakatBatchInvestorsFilter()">
          ${st.charities.filter(c=>!c.hidden).map(c => `
            <option value="${c.id}">${c.name} (ترخيص: ${c.licenseNo})</option>
          `).join("")}
        </select>

        <div class="grid grid-2" style="gap:8px">
          <div>
            <label>رقم الإيصال الصادر من الجمعية *</label>
            <input id="zb-receipt" placeholder="مثال: REC-ALBIR-9842" />
          </div>
          <div>
            <label>تاريخ التسليم *</label>
            <input id="zb-date" type="date" value="${new Date().toISOString().slice(0, 10)}" />
          </div>
        </div>

        <div class="grid grid-2" style="gap:8px">
          <div>
            <label>المحصول</label>
            <select id="zb-crop">
              <option value="palm">🌴 نخيل التمر (تمور)</option>
              <option value="olive">🫒 أشجار الزيتون (ثمار وزيت)</option>
            </select>
          </div>
          <div>
            <label>الصنف / الجودة</label>
            <input id="zb-variety" value="خلاص فاخر" placeholder="خلاص فاخر / صقعي / سكري" />
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;margin-bottom:6px;gap:8px;flex-wrap:wrap">
          <label style="margin:0"><b>المستثمرون المشاركون في الإرسالية:</b></label>
          <div style="display:flex;gap:6px">
            <button type="button" class="btn btn-ghost btn-sm" data-act="zb-select-all" style="padding:2px 8px;font-size:12px">☑️ تحديد الكل</button>
            <button type="button" class="btn btn-ghost btn-sm" data-act="zb-deselect-all" style="padding:2px 8px;font-size:12px">⬜ إلغاء التحديد</button>
          </div>
        </div>

        <!-- Charity Match Indicator & Filter Toggle -->
        <div style="display:flex;justify-content:space-between;align-items:center;background:#f0fdf4;border:1.5px solid #86efac;padding:8px 12px;border-radius:8px;margin-bottom:8px;font-size:12.5px;flex-wrap:wrap;gap:6px">
          <div style="color:#166534;font-weight:bold" id="zb-charity-filter-hint">
            🏛️ المستثمرون الراغبون في هذه الجمعية: <span id="zb-matching-count" style="font-size:14px;color:#15803d">0</span> مستثمر (<span id="zb-matching-kg" style="font-size:14px;color:#15803d">0</span> كجم)
          </div>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:#334155;margin:0;font-weight:600">
            <input type="checkbox" id="zb-show-all-charities" onchange="updateZakatBatchInvestorsFilter()" /> إظهار كافة المستثمرين
          </label>
        </div>

        <div style="margin-bottom:6px">
          <input id="zb_inv_search" type="text" placeholder="🔍 بحث سريع في المستثمرين بالاسم، القطعة، أو الهاتف..." style="width:100%;font-size:12px;padding:6px 10px;border-radius:6px;box-sizing:border-box" />
        </div>
        <div id="zb_inv_list" style="max-height:200px;overflow-y:auto;border:1px solid var(--line);border-radius:6px;padding:6px">
          ${allInvestors.map(inv => {
            const zak = (st.zakat || []).find(z => z.investorId === inv.id && String(z.season) === String(curSeason));
            const isSelected = zakatSelectedInvIds.has(inv.id);
            const dueKg = zak?.dueKg || 150;
            const dueAmt = zak?.amount || (dueKg * 99);
            const pSt = zak?.pledgeStatus || "pending";
            const invCharityId = zak?.charityId || "";
            const invCharityObj = st.charities.find(c => c.id === invCharityId);
            const invCharityName = invCharityObj ? invCharityObj.name : "لم يحدد بعد";
            const searchTerms = `${inv.name} ${inv.phone || ''} ${(inv.plots || []).join(' ')} ${invCharityName}`.toLowerCase();

            return `
              <div class="zb-inv-row" data-search="${escapeHtml(searchTerms)}" data-charity="${invCharityId}" style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;border-bottom:1px solid #f1f5f9">
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin:0">
                  <input type="checkbox" class="zb-inv-check" value="${inv.id}" data-kg="${dueKg}" data-amt="${dueAmt}" ${isSelected ? "checked" : ""} />
                  <span>
                    <b>${inv.name}</b>
                    <span class="muted" style="font-size:11px">(${inv.plots?.join(', ') || 'قطعة عامة'})</span>
                    <span class="badge" style="background:#e0f2fe;color:#0369a1;font-size:10.5px;padding:1px 6px;margin:0 4px" title="رغبة المستثمر المحددة لإيصال زكاته">🏛️ ${escapeHtml(invCharityName)}</span>
                    ${pSt === 'signed' ? '<span class="badge badge-ok" style="font-size:10px;padding:1px 5px">موقع ✅</span>' : '<span class="badge st-sync" style="font-size:10px;padding:1px 5px">بانتظار التفويض</span>'}
                  </span>
                </label>
                <span style="font-size:12px;font-weight:bold;color:var(--green-d)">${dueKg} كجم • ${money(dueAmt)}</span>
              </div>
            `;
          }).join("")}
        </div>
        <div id="zb-empty-filter-msg" class="muted" style="display:none;text-align:center;padding:12px;font-size:12px;background:#f8fafc;border-radius:6px;margin-top:4px">
          لا يوجد مستثمرون مسجلون اختاروا هذه الجمعية لهذا الموسم. يمكنك تفعيل خيار "إظهار كافة المستثمرين" أعلاه لتحديد مستثمرين آخرين.
        </div>

        <label style="margin-top:8px">ملاحظات الشحن والتوزيع</label>
        <input id="zb-notes" placeholder="تم التسليم لمستودعات الجمعية المركزية وتوزيعها على الأسر المتعففة" />

        <div class="row-acts" style="margin-top:12px">
          <button class="btn btn-primary" data-act="zakat-save-batch">✅ تأكيد الصرف وإصدار الشحنة المجمعة</button>
          <button class="btn btn-ghost" data-act="zakat-close-batch-modal">إلغاء</button>
        </div>
      </div>
    </div>
  `;
}

function zakatSignedDocModalHtml(st) {
  const invId = signedDocModalData || session().id;
  const inv = userBy(invId);
  const zak = st.zakat.find(z => z.investorId === invId);
  const pol = st.settings.zakatPolicy;

  return `
    <div class="modal-backdrop">
      <div class="modal-box" style="max-width:580px">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding-bottom:8px">
          <h4 style="margin:0">📄 وثيقة تفويض وتعهد الزكاة الموقعة</h4>
          <span class="badge badge-ok">مُفوض ومعتمد رسمياً ✅</span>
        </div>

        <div style="margin:12px 0;padding:12px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;font-size:13px;line-height:1.6">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;border-bottom:1px dashed #cbd5e1;padding-bottom:6px">
            <div><b>المستثمر:</b> ${inv?.name || "مستثمر"}</div>
            <div><b>الهاتف:</b> ${inv?.phone || "—"}</div>
          </div>
          <div><b>القطع المشمولة:</b> ${(inv?.plots || []).join('، ') || "03-12A"}</div>
          <div><b>الموسم:</b> ${zak?.season || "2026"}</div>
          <div style="margin:8px 0;padding:8px;background:#fff;border-radius:4px;border:1px solid #e2e8f0">
            ${escapeHtml(pol?.terms || "يفوض المستثمر إدارة المزرعة في احتساب وتوزيع زكاة ثماره للجمعيات المعتمدة.")}
          </div>
          <div style="margin-top:10px;padding:8px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:6px;display:flex;align-items:center;gap:8px">
            <div style="font-size:24px">✍️</div>
            <div>
              <b style="color:#065f46">التوقيع الإلكتروني المعتمد:</b>
              <div style="font-size:11px;color:#047857">
                تم التوقيع بنجاح في ${fmtDate(zak?.pledgeSignedAt || new Date().toISOString())} • طريقة التوثيق: ${zak?.pledgeDocType === 'upload' ? 'نسخة موقعة يدوياً ومرفوعة' : 'توقيع رقمي موثق بالنظام'}
              </div>
            </div>
          </div>
        </div>

        <div class="row-acts">
          <button class="btn btn-primary" data-act="zakat-print-pledge">🖨️ طباعة الوثيقة</button>
          <button class="btn btn-ghost" data-act="zakat-close-signed">إغلاق</button>
        </div>
      </div>
    </div>
  `;
}

function zakatCertModalHtml(st) {
  const invId = certInvestorId || session().id;
  const inv = userBy(invId);
  const curSeason = zakatSeason || "2026";
  const zak = (st.zakat || []).find(z => z.investorId === invId && String(z.season) === String(curSeason)) || (st.zakat || []).find(z => z.investorId === invId);
  const season = zak?.season || curSeason;
  const batch = st.zakatBatches?.find(b => (b.id === zak?.batchId || (b.investors && b.investors.some(i => i.investorId === invId))));
  const ch = st.charities.find(c => c.id === (zak?.charityId || batch?.charityId));
  const kg = zak?.dueKg || 250;
  const amt = zak?.amount || (kg * 99);

  return `
    <div class="modal-backdrop">
      <div class="zakat-cert-modal">
        <div style="font-size:12px;font-weight:bold;color:#166534;letter-spacing:1px;margin-bottom:6px">
          بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
        </div>
        <div style="font-size:13px;color:#854d0e;font-weight:bold;margin-bottom:4px">
          🌴 نظام إدارة النخيل والإنتاج الزراعي 🌴
        </div>
        <h2 style="margin:4px 0 10px;color:#14532d;font-family:serif">
          شهادة شكر وتقدير وإبراء ذمة زكاة
        </h2>
        
        <p style="font-size:14px;line-height:1.8;color:#1f2937;margin:12px 0">
          تشهد إدارة المزرعة بالتعاون مع <b>${ch?.name || "الجمعيات الخيرية المعتمدة"}</b>
          بأن الشريك المستثمر المكرم:<br>
          <span style="font-size:18px;font-weight:bold;color:#166534">${inv?.name || "أحمد بن محمد العتيبي"}</span><br>
          قد أدى فريضة <b>زكاة الزروع والثمار</b> الواجبة شرعاً لموسم <b>${season}م</b> بمقدار:<br>
          <span style="font-size:16px;font-weight:bold;color:#b45309">${kg} كجم من فاخر التمور (بقيمة ${money(amt)})</span><br>
          وقد تم تسليمها وتوزيعها على مستحقيها من الأسر المتعففة بموجب الإيصال الرسمي المعتمد رقم:<br>
          <span class="masked-code" style="font-size:13px;color:#0369a1">${batch?.receiptNo || zak?.receiptNo || "REC-ALBIR-9842"}</span>
        </p>

        <div class="zakat-cert-stamp">
          ✓ إبراء ذمة رسمي ومعتمد زكوياً لموسم ${season}م
        </div>

        <div style="display:flex;justify-content:space-around;margin-top:16px;font-size:12px;color:#374151">
          <div>
            <b>مدير رعاية العملاء والزكاة</b><br>
            سارة مديرة الرعاية
          </div>
          <div>
            <b>الختم والاعتماد الرسمي</b><br>
            [ إدارة المسؤولية المجتمعية ]
          </div>
        </div>

        <div class="row-acts" style="margin-top:20px;justify-content:center">
          <button class="btn btn-primary" data-act="zakat-print-cert-btn">🖨️ طباعة الشهادة الرسمية</button>
          <button class="btn btn-ghost" data-act="zakat-close-cert">إغلاق</button>
        </div>
      </div>
    </div>
  `;
}

function zakatPrintPledgeModalHtml(st) {
  const invId = printPledgeInvestorId || session().id;
  const inv = userBy(invId);
  const pol = st.settings.zakatPolicy;

  return `
    <div class="modal-backdrop">
      <div class="modal-box" style="max-width:620px">
        <div style="text-align:center;border-bottom:2px solid var(--green);padding-bottom:10px;margin-bottom:12px">
          <h3 style="margin:0;color:var(--green-d)">${pol?.title || "نموذج تفويض وتعهد زكاة الزروع والثمار"}</h3>
          <div class="muted" style="font-size:12px">إصدار ${pol?.version || "2.1"} • لموسم الحصاد 2026م</div>
        </div>

        <div style="border:1px solid #cbd5e1;padding:12px;border-radius:6px;font-size:13px;line-height:1.7;background:#fff">
          <div style="display:flex;justify-content:space-between;border-bottom:1px dashed #cbd5e1;padding-bottom:8px;margin-bottom:8px">
            <div>اسم المستثمر: <b>${inv?.name || "......................................................."}</b></div>
            <div>رقم الهاتف: <b>${inv?.phone || "......................."}</b></div>
          </div>
          <div>القطع المملوكة: <b>${(inv?.plots || []).join('، ') || "......................................................."}</b></div>
          
          <div style="margin:10px 0;padding:10px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;white-space:pre-line">
            ${escapeHtml(pol?.terms || "")}
          </div>

          <div style="margin-top:16px;display:flex;justify-content:space-between;align-items:flex-end">
            <div>
              <div>إقرار وتوقيع المستثمر:</div>
              <div style="height:36px;border-bottom:1px solid #000;width:180px;margin-top:6px"></div>
              <div style="font-size:11px;color:var(--muted);margin-top:2px">التاريخ: .... / .... / 2026م</div>
            </div>
            <div style="text-align:left">
              <div>اعتماد وختم إدارة المزرعة:</div>
              <div style="height:48px;border:2px dashed var(--green);border-radius:50px;width:120px;display:flex;align-items:center;justify-content:center;color:var(--green-d);font-weight:bold;font-size:11px;margin-top:6px">
                معتمد
              </div>
            </div>
          </div>
        </div>

        <div class="row-acts" style="margin-top:12px">
          <button class="btn btn-primary" onclick="window.print()">🖨️ طباعة النموذج للتوقيع</button>
          <button class="btn btn-ghost" data-act="zakat-close-print-pledge">إغلاق</button>
        </div>
      </div>
    </div>
  `;
}

function printZakatBatchReceipt(batchId, st) {
  st = st || Store.get();
  const b = (st.zakatBatches || []).find(x => x.id === batchId);
  if (!b) return toast("لم يتم العثور على بيانات الشحنة المحددة");

  const ch = (st.charities || []).find(c => c.id === b.charityId);
  const curUser = session();
  const isInvestor = curUser && curUser.role === "investor";
  const invs = b.investors || [];
  const co = st.settings || {};
  const coName = co.companyName || "شركة إدارة النخيل والأصول الزراعية";

  const invRows = invs.map((i, idx) => {
    const isMe = curUser && i.id === curUser.id;
    const displayName = (isInvestor && !isMe) ? (typeof maskName === "function" ? maskName(i.name) : (i.name ? i.name.slice(0, 2) + "***" : "—")) : i.name;
    return `
      <tr>
        <td style="text-align:center">${idx + 1}</td>
        <td><b>${escapeHtml(displayName)}</b> ${isMe ? '<span style="color:#166534;font-size:11px">(حسابك)</span>' : ''}</td>
        <td style="text-align:center">${Number(i.kg || 0).toLocaleString()} كجم</td>
        <td style="text-align:center">${money(i.amount || 0)}</td>
        <td style="text-align:center;color:#166534;font-weight:bold">مُسلّم ومُبرأ الذمة ✓</td>
      </tr>
    `;
  }).join("");

  const printHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>إيصال تسليم زكاة مجمعة - ${b.receiptNo}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 14mm;
    }
    * {
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    body {
      color: #1e293b;
      background: #fff;
      margin: 0;
      padding: 0;
      font-size: 13px;
      line-height: 1.5;
    }
    .print-container {
      max-width: 800px;
      margin: 0 auto;
      border: 2px solid #0f766e;
      border-radius: 12px;
      padding: 24px;
      position: relative;
    }
    .watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-30deg);
      font-size: 80px;
      color: rgba(15, 118, 110, 0.04);
      font-weight: 900;
      pointer-events: none;
      white-space: nowrap;
      z-index: 0;
    }
    .header-table {
      width: 100%;
      border-bottom: 2px solid #0f766e;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .header-logo {
      font-size: 24px;
      font-weight: 900;
      color: #065f46;
    }
    .header-sub {
      font-size: 12px;
      color: #64748b;
      margin-top: 2px;
    }
    .receipt-title-box {
      text-align: center;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 14px;
    }
    .receipt-title {
      font-size: 18px;
      font-weight: 800;
      color: #166534;
      margin: 0;
    }
    .receipt-subtitle {
      font-size: 12px;
      color: #15803d;
      margin-top: 4px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 14px;
      font-size: 12.5px;
    }
    .meta-item b {
      color: #0f172a;
    }
    .meta-item span {
      color: #64748b;
    }
    .stats-bar {
      display: flex;
      justify-content: space-between;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 14px;
    }
    .stats-item {
      text-align: center;
    }
    .stats-item .val {
      font-size: 16px;
      font-weight: 800;
      color: #065f46;
    }
    .stats-item .lbl {
      font-size: 11px;
      color: #64748b;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: 12px;
    }
    table.data-table th {
      background: #f0fdf4;
      color: #166534;
      border: 1px solid #cbd5e1;
      padding: 7px 6px;
      font-weight: 700;
    }
    table.data-table td {
      border: 1px solid #cbd5e1;
      padding: 6px;
    }
    .notes-box {
      font-size: 11.5px;
      color: #475569;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 14px;
      line-height: 1.5;
    }
    .signatures-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-top: 18px;
      padding-top: 12px;
      border-top: 1px dashed #cbd5e1;
      page-break-inside: avoid;
    }
    .sig-box {
      text-align: center;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px;
      background: #fafafa;
    }
    .sig-title {
      font-size: 11.5px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 35px;
    }
    .sig-line {
      border-top: 1px solid #94a3b8;
      font-size: 10.5px;
      color: #64748b;
      padding-top: 4px;
    }
    .footer-stamp {
      text-align: center;
      font-size: 10px;
      color: #94a3b8;
      margin-top: 12px;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div style="text-align:center;padding:12px;" class="no-print">
    <button onclick="window.print()" style="padding:8px 24px;font-size:14px;font-weight:bold;background:#059669;color:#fff;border:none;border-radius:6px;cursor:pointer">🖨️ طباعة الآن (Print)</button>
    <button onclick="window.close()" style="padding:8px 16px;font-size:14px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;margin-right:8px;cursor:pointer">إغلاق النافذة ✕</button>
  </div>
  <div class="print-container">
    <div class="watermark">إيصال رسمي معتمد</div>
    <table class="header-table">
      <tr>
        <td style="vertical-align:middle">
          <div class="header-logo">🌴 ${escapeHtml(coName)}</div>
          <div class="header-sub">منظومة الإدارة الزراعية الذكية • إدارة الزكاة والمسؤولية المجتمعية (CSR)</div>
        </td>
        <td style="text-align:left;vertical-align:middle">
          <div style="font-size:12px;color:#64748b">تاريخ الإصدار: <b>${new Date().toLocaleDateString('ar-EG')}</b></div>
          <div style="font-size:12px;color:#64748b">رقم الشحنة: <b style="font-family:monospace;color:#0f766e">${b.batchNo}</b></div>
        </td>
      </tr>
    </table>

    <div class="receipt-title-box">
      <h1 class="receipt-title">إيصال تسليم وتوزيع شحنة زكاة مجمعة</h1>
      <div class="receipt-subtitle">وثيقة استلام وتوزيع رسمية صادرة بالتنسيق مع الجمعية الخيرية الشريكة المعتمدة</div>
    </div>

    <div class="meta-grid">
      <div class="meta-item"><span>🏛️ الجمعية المستلمة:</span> <b>${escapeHtml(ch?.name || "الجمعية المعتمدة")}</b></div>
      <div class="meta-item"><span>🧾 رقم إيصال الجمعية:</span> <b style="font-family:monospace;color:#0284c7">${escapeHtml(b.receiptNo)}</b></div>
      <div class="meta-item"><span>📜 ترخيص الجمعية:</span> <b>${escapeHtml(ch?.licenseNo || "ترخيص رسمي معتمد")}</b></div>
      <div class="meta-item"><span>📅 تاريخ التسليم الميداني:</span> <b>${fmtDate(b.date)}</b></div>
    </div>

    <div class="stats-bar">
      <div class="stats-item">
        <div class="val">${Number(b.totalKg || 0).toLocaleString()} كجم</div>
        <div class="lbl">إجمالي وزن الشحنة</div>
      </div>
      <div class="stats-item">
        <div class="val">${escapeHtml(b.variety || "تمور فاخرة")}</div>
        <div class="lbl">نوع وصنف المحصول</div>
      </div>
      <div class="stats-item">
        <div class="val">${money(b.totalAmount || 0)}</div>
        <div class="lbl">القيمة الشرعية التقديرية</div>
      </div>
      <div class="stats-item">
        <div class="val">${invs.length} مستثمرين</div>
        <div class="lbl">إجمالي المشاركين بالشحنة</div>
      </div>
    </div>

    <div style="font-weight:700;font-size:13px;margin-bottom:6px;color:#0f172a">📋 بيان المستثمرين المشاركين في الإيصال:</div>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width:35px">#</th>
          <th>اسم المستثمر</th>
          <th style="width:110px">الكمية المسلمة</th>
          <th style="width:110px">القيمة المحتسبة</th>
          <th style="width:120px">حالة الذمة</th>
        </tr>
      </thead>
      <tbody>
        ${invRows}
      </tbody>
    </table>

    ${b.notes ? `
      <div class="notes-box">
        <b>📝 ملاحظات التوزيع والاستلام:</b> ${escapeHtml(b.notes)}
      </div>
    ` : ""}

    <div class="signatures-row">
      <div class="sig-box">
        <div class="sig-title">مسؤول رعاية المستثمرين والزكاة</div>
        <div class="sig-line">الاسم والتوقيع: ............................</div>
      </div>
      <div class="sig-box">
        <div class="sig-title">مندوب الجمعية الخيرية المستلمة</div>
        <div class="sig-line">الختم والتوقيع: ............................</div>
      </div>
      <div class="sig-box">
        <div class="sig-title">إدارة الشؤون المالية والرقابة</div>
        <div class="sig-line">الاعتماد الرسمي: ............................</div>
      </div>
    </div>

    <div class="footer-stamp">
      تم إنشاء وتوثيق هذا الإيصال آلياً عبر نظام إدارة النخيل والزيتون الذكي • معرف الوثيقة: ${b.id} • رمز التحقق الرقمي المعتمد
    </div>
  </div>
</body>
</html>`;

  const printWin = window.open("", "_blank", "width=880,height=960");
  if (printWin) {
    printWin.document.open();
    printWin.document.write(printHtml);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      try { printWin.print(); } catch(e) {}
    }, 450);
  } else {
    toast("يرجى السماح بالنوافذ المنبثقة لطباعة الإيصال");
  }
}

