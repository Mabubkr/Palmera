// PalmTrace app — Nursery, fertilizers & vouchers, audit log, contract templates
// (split from the former single app.js; files are classic scripts loaded in order by index.html)

function osStatus(o) {
  if (o.newPalmId || o.nsStatus === "planted" || o.isPlanted) {
    return o.plantedPalmCode ? `زرعت بالحقل (${o.plantedPalmCode})` : "زرعت بالحقل";
  }
  if (o.nsStatus === "dispatched") return "بانتظار استلام الحقل ⏳";
  if (o.nsStatus === "issued") return "صُرفت ومستلمة بالحقل ✅";
  if (o.nsStatus === "ready") return "جاهزة للصرف والزراعة";
  if ((o.preps||[]).length) return "تحت التجهيز";
  if (o.approval !== "approved") return "استلام قادم / بانتظار الاعتماد";
  return "في المشتل";
}

function osStatusHtml(o) {
  if (o.newPalmId || o.nsStatus === "planted" || o.isPlanted) {
    return `<span class="badge status" style="background:#E0E7FF;color:#3730A3;font-weight:700;display:inline-flex;align-items:center;gap:4px">🌴 زرعت بالحقل ${o.plantedPalmCode ? `<bdi style="direction:ltr;font-family:monospace">(${o.plantedPalmCode})</bdi>` : ''}</span>`;
  }
  if (o.nsStatus === "dispatched") return `<span class="badge-warn status">بانتظار استلام الحقل ⏳</span>`;
  if (o.nsStatus === "issued") return `<span class="badge-ok status">صُرفت ومستلمة بالحقل ✅</span>`;
  if (o.nsStatus === "ready") return `<span class="badge-ok status">جاهزة للصرف والزراعة</span>`;
  if ((o.preps||[]).length) return `<span class="chip">تحت التجهيز</span>`;
  if (o.approval !== "approved") return `<span class="badge-warn status">استلام قادم / بانتظار الاعتماد</span>`;
  return `<span class="chip">في المشتل</span>`;
}
function osStage(o) {
  if (o.newPalmId || o.nsStatus === "planted" || o.isPlanted) return "planted";
  if (o.nsStatus === "issued" || o.nsStatus === "dispatched") return "issued";
  if (o.nsStatus === "ready") return "ready";
  if ((o.preps||[]).length) return "prep";
  if (o.approval !== "approved") return "in";
  return "stock";
}

function renderDispenseModal(st) {
  const ids = dispenseOsIds || [];
  const items = ids.map(id => st.offshoots.find(o => o.id === id) || (st.nurseryItems || []).find(n => n.id === id)).filter(Boolean);
  const codeList = items.map(x => x.tempCode || x.code || x.id).join(" ، ");
  const fieldUsers = (st.users || []).filter(u => ['engineer', 'worker', 'admin', 'supervisor'].includes(u.role));
  const defaultPlot = st.plots[0]?.id || "";

  return `
    <div class="card" style="background:#FFFBEB;border:2px solid #F59E0B;margin-bottom:14px;padding:16px;border-radius:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <h3 style="margin:0;color:#92400E">🚚 إصدار إذن صرف فسائل / شتلات للميدان</h3>
        <button class="btn btn-ghost icon-btn" data-act="cancel-os-dispense">✕ إلغاء</button>
      </div>
      <p class="muted" style="margin:8px 0 12px;font-size:13px">
        الفسائل المحددة للصرف (<b>${items.length}</b> أصل): <span style="color:#1E293B;font-weight:700">${codeList}</span>
      </p>
      <div class="grid grid-3">
        <div>
          <label style="font-weight:700">المستلم المسؤول بالموقع *</label>
          <select id="os_disp_user">
            ${fieldUsers.map(u => `<option value="${u.id}">${u.name} (${roleLabel(u.role)})</option>`).join("")}
          </select>
        </div>
        <div>
          <label style="font-weight:700">القطعة / الوجهة المستهدفة *</label>
          <select id="os_disp_plot">
            ${st.plots.map(p => `<option value="${p.id}" ${p.id===defaultPlot?'selected':''}>${p.id} — ${p.name} (${sectorName(p.sector)})</option>`).join("")}
          </select>
        </div>
        <div>
          <label style="font-weight:700">تاريخ الصرف للميدان</label>
          <input id="os_disp_date" type="date" value="${new Date().toISOString().slice(0,10)}" />
        </div>
      </div>
      <div style="margin-top:10px">
        <label style="font-weight:700">ملاحظات وتوجيهات الصرف</label>
        <input id="os_disp_notes" placeholder="مثال: صرف للزراعة المباشرة في خطوط الترقيع بالقطعة..." />
      </div>
      <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary icon-btn" data-act="confirm-os-dispense" style="width:auto">🚀 تأكيد إصدار إذن الصرف وإرسال إشعار للمستلم</button>
        <button class="btn btn-ghost icon-btn" data-act="cancel-os-dispense" style="width:auto">إلغاء</button>
      </div>
    </div>
  `;
}

function calcAgeMonths(dStr) {
  if (!dStr) return 0;
  const d = new Date(dStr);
  if (isNaN(d.getTime())) return 0;
  const now = new Date();
  const m = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  return Math.max(0, m);
}

function renderCullModal(st) {
  if (!showCullModal) return "";
  const ids = cullTargetIds || [];
  const items = ids.map(id => st.offshoots.find(o => o.id === id) || (st.nurseryItems || []).find(n => n.id === id)).filter(Boolean);
  const codeList = items.map(x => x.tempCode || x.code || x.id).join(" ، ");
  return `
    <div class="custom-modal-backdrop" data-act="close-cull-modal">
      <div class="custom-modal-box" style="max-width:520px">
        <div class="custom-modal-head" style="background:#FEF2F2;color:#991B1B">
          <h3 style="margin:0;color:#991B1B">🗑️ إهلاك واستبعاد أصول من المشتل</h3>
          <button class="custom-modal-close" data-act="close-cull-modal">✕</button>
        </div>
        <div class="custom-modal-body" style="padding:16px">
          <p class="muted" style="margin-top:0">
            أنت على وشك تسجيل استبعاد وإهلاك (<b>${items.length}</b> أصل):<br>
            <b style="color:#1E293B">${escapeHtml(codeList)}</b>
          </p>
          <div style="margin-bottom:12px">
            <label style="font-weight:700">سبب الاستبعاد / الهالك *</label>
            <select id="cull_reason_inp">
              <option value="تعفن جذور">تعفن وتلف المجموع الجذري</option>
              <option value="جفاف وموت القمة النامية">جفاف وموت القمة النامية (الجمارة)</option>
              <option value="ضعف نمو وفشل التجذير">ضعف نمو حاد وفشل خروج الجذور</option>
              <option value="إصابة فطرية أو حشرية">إصابة فطرية أو حشرية غير قابلة للعلاج</option>
              <option value="صدمة قلع ونقل">صدمة قلع ونقل شديدة</option>
              <option value="أخرى">أسباب فنية أخرى</option>
            </select>
          </div>
          <div style="margin-bottom:12px">
            <label style="font-weight:700">تاريخ الإهلاك</label>
            <input id="cull_date_inp" type="date" value="${new Date().toISOString().slice(0, 10)}" />
          </div>
          <div style="margin-bottom:14px">
            <label style="font-weight:700">ملاحظات وتوصية مهندس المشتل</label>
            <textarea id="cull_notes_inp" placeholder="تفاصيل المعاينة الفنية وسبب الاستبعاد..."></textarea>
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button class="btn btn-ghost" data-act="close-cull-modal">إلغاء</button>
            <button class="btn btn-danger" data-act="confirm-os-cull">تأكيد الإهلاك والاستبعاد 🗑️</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderCullReportModal(st) {
  if (!showCullReportModal) return "";
  const allItems = [...(st.offshoots || []), ...(st.nurseryItems || [])];
  const culled = allItems.filter(o => o.nsStatus === "culled" || o.cullReason);
  return `
    <div class="custom-modal-backdrop" data-act="close-cull-report">
      <div class="custom-modal-box" style="max-width:800px;width:95%">
        <div class="custom-modal-head" style="background:#F8FAFC">
          <h3 style="margin:0">📄 تقرير أسباب الهالك والاستبعاد بالمشتل</h3>
          <button class="custom-modal-close" data-act="close-cull-report">✕</button>
        </div>
        <div class="custom-modal-body" style="padding:16px">
          <div class="grid grid-3" style="margin-bottom:14px;gap:10px">
            <div class="card kpi kpi-compact"><div class="n" style="color:#DC2626">${culled.length}</div><div class="l">إجمالي الهالك المسجل</div></div>
            <div class="card kpi kpi-compact"><div class="n">${allItems.length}</div><div class="l">إجمالي الأصول المدخلة</div></div>
            <div class="card kpi kpi-compact"><div class="n" style="color:var(--green)">${allItems.length ? Math.round(((allItems.length - culled.length) / allItems.length) * 100) : 100}%</div><div class="l">معدل البقاء والنجاح</div></div>
          </div>
          <div class="grid-wrap" style="max-height:360px;overflow-y:auto">
            <table class="dense">
              <thead>
                <tr>
                  <th>كود الأصل</th>
                  <th>المحصول / الصنف</th>
                  <th>تاريخ الإهلاك</th>
                  <th>سبب الاستبعاد</th>
                  <th>ملاحظات المعاينة</th>
                </tr>
              </thead>
              <tbody>
                ${culled.map(c => `
                  <tr>
                    <td><span class="code-chip">${escapeHtml(c.tempCode || c.code || c.id)}</span></td>
                    <td><b>${escapeHtml(c.variety || 'خلاص')}</b></td>
                    <td>${c.cullDate || c.date || '—'}</td>
                    <td><span class="status badge-danger">${escapeHtml(c.cullReason || 'هالك عام')}</span></td>
                    <td class="muted">${escapeHtml(c.cullNotes || '—')}</td>
                  </tr>
                `).join("") || '<tr><td colspan="5" class="muted" style="text-align:center;padding:20px">لا توجد سجلات هالك مسجلة بالمشتل حالياً (نسبة النجاح 100%) 🎉</td></tr>'}
              </tbody>
            </table>
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
            <button class="btn btn-ghost" data-act="close-cull-report">إغلاق</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderBarcodeModal(st) {
  if (!showBarcodeModal) return "";
  const ids = barcodePrintIds || [];
  const items = ids.map(id => st.offshoots.find(o => o.id === id) || (st.nurseryItems || []).find(n => n.id === id)).filter(Boolean);
  return `
    <div class="custom-modal-backdrop" data-act="close-barcode-modal">
      <div class="custom-modal-box" style="max-width:700px;width:95%">
        <div class="custom-modal-head">
          <h3 style="margin:0">🏷️ بطاقات الباركود وQR للأصول المحددة</h3>
          <button class="custom-modal-close" data-act="close-barcode-modal">✕</button>
        </div>
        <div class="custom-modal-body" style="padding:16px">
          <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));gap:12px;max-height:400px;overflow-y:auto;padding:8px">
            ${items.map(it => {
              const code = it.tempCode || it.code || it.id;
              const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(code)}`;
              return `
                <div style="border:1.5px dashed #64748B;border-radius:8px;padding:10px;text-align:center;background:#fff">
                  <div style="font-size:11px;color:#64748B;font-weight:bold">PALMTRACE NURSERY</div>
                  <img src="${qrUrl}" alt="${code}" style="width:90px;height:90px;margin:6px auto;display:block" />
                  <div style="font-family:monospace;font-weight:bold;font-size:13px">${escapeHtml(code)}</div>
                  <div style="font-size:12px;color:var(--green);font-weight:bold;margin-top:2px">${escapeHtml(it.variety || 'خلاص')}</div>
                  <div style="font-size:10px;color:#94A3B8">${it.date || ''}</div>
                </div>
              `;
            }).join("")}
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
            <button class="btn btn-primary" onclick="window.print()">🖨️ طباعة البطاقات</button>
            <button class="btn btn-ghost" data-act="close-barcode-modal">إغلاق</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderFertEditModal(st) {
  if (!editingFertId) return "";
  const f = (st.fertilizers || []).find(x => x.id === editingFertId);
  if (!f) return "";
  return `
    <div class="custom-modal-backdrop" data-act="close-edit-fert">
      <div class="custom-modal-box" style="max-width:520px;width:95%">
        <div class="custom-modal-head" style="background:#F0FDF4;color:#166534">
          <h3 style="margin:0">✏️ تعديل بيانات السماد / المركب</h3>
          <button class="custom-modal-close" data-act="close-edit-fert">✕</button>
        </div>
        <div class="custom-modal-body" style="padding:16px">
          <div class="grid grid-2" style="gap:10px;margin-bottom:10px">
            <div>
              <label style="font-weight:700">اسم السماد / المركب *</label>
              <input id="efert_name" value="${escapeHtml(f.name)}" />
            </div>
            <div>
              <label style="font-weight:700">المحصول المخصص</label>
              <select id="efert_crop">
                <option value="all" ${f.cropId==='all'?'selected':''}>🌐 مشترك لكل المحاصيل</option>
                <option value="palm" ${f.cropId==='palm'?'selected':''}>🌴 نخيل التمر</option>
                <option value="olive" ${f.cropId==='olive'?'selected':''}>🫒 زيتون</option>
              </select>
            </div>
          </div>
          <div class="grid grid-3" style="gap:10px;margin-bottom:10px">
            <div>
              <label style="font-weight:700">النوع / التصنيف</label>
              <select id="efert_kind">
                <option value="كيميائي" ${f.kind==='كيميائي'?'selected':''}>كيميائي</option>
                <option value="عضوي" ${f.kind==='عضوي'?'selected':''}>عضوي</option>
                <option value="مبيد" ${f.kind==='مبيد'?'selected':''}>مبيد حشري/فطري</option>
                <option value="مغذي ورقي" ${f.kind==='مغذي ورقي'?'selected':''}>مغذي ورقي</option>
                <option value="محسن تربة" ${f.kind==='محسن تربة'?'selected':''}>محسن تربة</option>
              </select>
            </div>
            <div>
              <label style="font-weight:700">وحدة القياس</label>
              <select id="efert_unit">
                <option value="كجم" ${f.unit==='كجم'?'selected':''}>كجم</option>
                <option value="لتر" ${f.unit==='لتر'?'selected':''}>لتر</option>
                <option value="جرام" ${f.unit==='جرام'?'selected':''}>جرام</option>
                <option value="طن" ${f.unit==='طن'?'selected':''}>طن</option>
                <option value="عبوة" ${f.unit==='عبوة'?'selected':''}>عبوة</option>
              </select>
            </div>
            <div>
              <label style="font-weight:700">حد أمان المخزون</label>
              <input id="efert_min" type="number" value="${f.minAlert !== undefined ? f.minAlert : 50}" />
            </div>
          </div>
          <div class="grid grid-2" style="gap:10px;margin-bottom:12px">
            <div>
              <label style="font-weight:700">تكلفة الوحدة (${st.settings?.currency || 'ج.م'})</label>
              <input id="efert_cost" type="number" step="0.5" value="${f.unitCost || 0}" />
            </div>
            <div>
              <label style="font-weight:700">الحالة</label>
              <select id="efert_active">
                <option value="1" ${f.active!==false?'selected':''}>نشط ومتاح للصرف</option>
                <option value="0" ${f.active===false?'selected':''}>معطل ومخفي</option>
              </select>
            </div>
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
            <button class="btn btn-ghost" data-act="close-edit-fert">إلغاء</button>
            <button class="btn btn-primary" data-act="save-edit-fert" data-id="${f.id}" style="font-weight:700">💾 حفظ التعديلات</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function nurseryView() {
  const st = Store.get();
  const activeCrops = (st.crops || []).filter(c => c.active);
  const propSources = st.propagationSourceTypes || [
    { code: 'F', name: 'فسيلة' }, { code: 'N', name: 'نسيج' }, { code: 'C', name: 'عقلة خضرية' }, { code: 'S', name: 'شتلة مطعومة' }
  ];
  const allStock = [...(st.offshoots || []), ...(st.nurseryItems || [])];

  // Palm and Plots lookups for relations
  const palmMap = new Map();
  (st.palms || []).forEach(p => { if (p && p.id) palmMap.set(p.id, p); });

  // Filter stock by selected crop
  let stock = allStock;
  if (nurseryCropFilter !== "all") {
    stock = stock.filter(o => {
      const mom = palmMap.get(o.motherId);
      const cId = o.cropId || mom?.cropId || (o.tempCode ? "palm" : (["C", "S", "T"].includes(o.source) ? "olive" : "palm"));
      return matchesCropFilter(cId, nurseryCropFilter);
    });
  }

  // Pipeline categorization
  const dispensedItems = stock.filter(o => o.newPalmId || o.isPlanted || ['issued', 'dispatched', 'planted'].includes(o.nsStatus));
  const culledItems = stock.filter(o => o.nsStatus === "culled" || o.isArchived || o.isDeleted);
  const inboundItems = stock.filter(o => !dispensedItems.includes(o) && !culledItems.includes(o) && (o.nsStatus === "inbound" || o.nsStatus === "pending" || o.approval === "pending" || o.approval === "waiting" || (!o.nsStatus && !o.isOpeningStock && !o.is_opening_stock)));
  const readyItems = stock.filter(o => o.nsStatus === "ready" && !o.newPalmId && !o.isPlanted && o.nsStatus !== "culled" && !inboundItems.includes(o));
  const rootingItems = stock.filter(o => !dispensedItems.includes(o) && !culledItems.includes(o) && !readyItems.includes(o) && !inboundItems.includes(o));

  const liveN = inboundItems.length + rootingItems.length + readyItems.length;
  const incomingN = inboundItems.length;
  const readyN = readyItems.length;
  const issuedN = dispensedItems.length;

  const tabsHeader = `
    <div class="page-head">
      <div>
        <h3>المشتل والتكاثر</h3>
        <div class="muted">مسار الاستلام → التجهيز والتحضين → الجاهزية للصرف → الزراعة بالحقل</div>
      </div>
      <div class="actions" style="margin:0;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary icon-btn" data-go="scan">تسجيل قلع من الحقل</button>
        <button class="btn btn-primary icon-btn" data-act="show-buy">+ تسجيل توريد / مشتريات مشتل</button>
        ${hasPerm("seedlings_import") ? `<button class="btn btn-ghost icon-btn" data-act="open-seedlings-import" style="border:1.5px solid #16A34A;color:#16A34A;font-weight:700">📥 استيراد شتلات بإكسل</button>` : ""}
      </div>
    </div>

    <!-- Crop Filter Chips -->
    <div style="display:flex;gap:6px;margin:8px 0 10px;flex-wrap:wrap">
      <button class="btn ${nurseryCropFilter==='all'?'btn-primary':'btn-ghost'}" style="width:auto;padding:4px 10px;font-size:12px" data-act="filter-nursery-crop" data-id="all">🌐 كل الأصول (${allStock.length})</button>
      ${activeCrops.map(c => {
        const cid = c.code || c.id;
        const cnt = allStock.filter(o => {
          const mom = palmMap.get(o.motherId);
          const cId = o.cropId || mom?.cropId || (o.tempCode ? "palm" : (["C","S","T"].includes(o.source) ? "olive" : "palm"));
          return matchesCropFilter(cId, cid);
        }).length;
        return `<button class="btn ${matchesCropFilter(nurseryCropFilter, cid)?'btn-primary':'btn-ghost'}" style="width:auto;padding:4px 10px;font-size:12px" data-act="filter-nursery-crop" data-id="${cid}">${cropIcon(c.id, 14)} ${c.name} (${cnt})</button>`;
      }).join("")}
    </div>

    <!-- KPI Cards -->
    <div class="grid grid-4" style="margin-bottom:12px;gap:8px">
      <div class="card kpi kpi-compact"><div class="n">${liveN}</div><div class="l">بالمشتل الآن</div></div>
      <div class="card kpi kpi-compact"><div class="n">${incomingN}</div><div class="l">بانتظار الاستلام</div></div>
      <div class="card kpi kpi-compact"><div class="n" style="color:var(--green)">${readyN}</div><div class="l">جاهزة للصرف</div></div>
      <div class="card kpi kpi-compact"><div class="n" style="color:#2563EB">${issuedN}</div><div class="l">المنصرف للحقل</div></div>
    </div>

    <!-- Unified Lifecycle Pipeline Tabs -->
    <div class="actions" style="margin-bottom:14px;gap:8px;flex-wrap:wrap">
      <button class="btn ${nurseryTab==='inbound'?'btn-primary':'btn-ghost'}" data-act="ntab" data-id="inbound" style="width:auto;font-weight:700">
        📥 الوارد والتوريد (${inboundItems.length})
      </button>
      <button class="btn ${nurseryTab==='rooting'?'btn-primary':'btn-ghost'}" data-act="ntab" data-id="rooting" style="width:auto;font-weight:700">
        🌱 في التجذير والرعاية (${rootingItems.length})
      </button>
      <button class="btn ${nurseryTab==='ready'?'btn-primary':'btn-ghost'}" data-act="ntab" data-id="ready" style="width:auto;font-weight:700">
        ✅ جاهزة للصرف (${readyItems.length})
      </button>
      <button class="btn ${nurseryTab==='dispensed'?'btn-primary':'btn-ghost'}" data-act="ntab" data-id="dispensed" style="width:auto;font-weight:700">
        🚜 المنصرف للحقل (${dispensedItems.length})
      </button>
      <button class="btn ${nurseryTab==='rep'?'btn-primary':'btn-ghost'}" data-act="ntab" data-id="rep" style="width:auto;font-weight:700">
        📊 التجذير والهالك
      </button>
    </div>
  `;

  // 1. Rooting & Waste Report Tab
  if (nurseryTab === "rep") {
    return `
      ${tabsHeader}
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
          <h3 style="margin:0">تقرير التجذير والهالك حسب المحصول</h3>
          <button class="btn btn-ghost icon-btn" data-act="open-cull-report">📄 استخراج تقرير أسباب الهالك الكامل</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;margin-top:10px">
          ${activeCrops.map(c => {
            const cItems = allStock.filter(o => {
              const mom = palmMap.get(o.motherId);
              const cId = o.cropId || mom?.cropId || (o.tempCode ? "palm" : (["C","S","T"].includes(o.source) ? "olive" : "palm"));
              return cId === c.id;
            });
            const cTotal = cItems.length;
            const cIssued = cItems.filter(o => o.newPalmId || o.isPlanted || ['issued', 'dispatched', 'planted'].includes(o.nsStatus)).length;
            const cCulled = cItems.filter(o => o.nsStatus === "culled" || o.cullReason).length;
            const cLive = cTotal - cIssued - cCulled;
            const survRate = cTotal ? Math.round(((cTotal - cCulled) / cTotal) * 100) : 100;
            const pctGreen = cTotal ? Math.round((cLive / cTotal) * 100) : (cTotal ? 100 : 0);
            const pctYellow = cTotal ? Math.round((cIssued / cTotal) * 100) : 0;
            const pctRed = cTotal ? Math.round((cCulled / cTotal) * 100) : 0;

            return `
              <div class="card tile" style="border:1.5px solid #E2E8F0;border-radius:12px;padding:16px">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                  <div style="display:flex;align-items:center;gap:8px">
                    ${cropIcon(c.id, 20)} <h4 style="margin:0;font-size:16px">${c.name} (${c.plural})</h4>
                  </div>
                  <div style="display:flex;align-items:center;gap:10px">
                    <span class="status badge-ok" style="font-size:13px;padding:6px 12px;font-weight:700">نسبة النجاح والبقاء: ${survRate}٪</span>
                    <button class="btn btn-ghost icon-btn" data-act="open-cull-report" data-id="${c.id}" style="border:1px solid #CBD5E1;font-size:12px">📄 استخراج تقرير أسباب الهالك</button>
                  </div>
                </div>
                <div class="muted" style="margin:8px 0 12px;font-size:13px">
                  إجمالي الأصول: <b>${cTotal}</b> • صُرفت للزراعة: <b>${cIssued}</b> • بالمشتل الآن: <b>${cLive}</b> • هالك مسجّل: <b style="color:#DC2626">${cCulled}</b>
                </div>
                <div style="margin-top:8px">
                  <div style="display:flex;height:14px;border-radius:7px;overflow:hidden;background:#F1F5F9;border:1px solid #E2E8F0">
                    ${pctGreen > 0 ? `<div style="background:#16A34A;width:${pctGreen}%;transition:width 0.3s" title="بالمشتل في التجذير: ${pctGreen}%"></div>` : ''}
                    ${pctYellow > 0 ? `<div style="background:#3B82F6;width:${pctYellow}%;transition:width 0.3s" title="صرفت للحقل: ${pctYellow}%"></div>` : ''}
                    ${pctRed > 0 ? `<div style="background:#DC2626;width:${pctRed}%;transition:width 0.3s" title="هالك مسجل: ${pctRed}%"></div>` : ''}
                  </div>
                  <div style="display:flex;justify-content:space-between;font-size:11px;color:#64748B;margin-top:6px">
                    <span style="color:#16A34A">🟢 بالمشتل في التجذير: ${pctGreen}%</span>
                    <span style="color:#2563EB">🔵 صُرفت للحقل: ${pctYellow}%</span>
                    <span style="color:#DC2626">🔴 هالك مستبعد: ${pctRed}%</span>
                  </div>
                </div>
              </div>
            `;
          }).join("")}
        </div>
        <p class="muted" style="margin-top:14px;font-size:12px">يتم تحديث معدلات البقاء والتجذير تلقائياً استناداً إلى سجلات المشتل، وأذونات الصرف، وسجلات الاستبعاد المعتمدة.</p>
      </div>
      ${renderCullReportModal(st)}
    `;
  }

  // 2. Dispensed to Field Tab
  if (nurseryTab === "dispensed") {
    let allDispensed = dispensedItems;
    if (dispStatusF === "dispatched") allDispensed = allDispensed.filter(o => o.nsStatus === "dispatched");
    else if (dispStatusF === "issued") allDispensed = allDispensed.filter(o => o.nsStatus === "issued");
    else if (dispStatusF === "planted") allDispensed = allDispensed.filter(o => o.nsStatus === "planted" || o.newPalmId || o.isPlanted);

    if (dispUserF && dispUserF !== "all") {
      allDispensed = allDispensed.filter(o => o.dispatchedToUser === dispUserF || o.receivedBy === dispUserF);
    }

    if (dispQ) {
      const q = dispQ.trim().toLowerCase();
      allDispensed = allDispensed.filter(o => {
        const code = (o.tempCode || o.code || "").toLowerCase();
        const vari = (o.variety || "").toLowerCase();
        const pl = (o.dispatchedToPlot || "").toLowerCase();
        return code.includes(q) || vari.includes(q) || pl.includes(q);
      });
    }

    const me = session();
    const canAcceptAny = me?.role === "admin" || me?.role === "engineer" || me?.role === "supervisor";

    return `
      ${tabsHeader}
      ${showDispenseModal ? renderDispenseModal(st) : ''}
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">
          <div>
            <h3 style="margin:0">🚜 سجل ومتابعة المنصرف للحقل</h3>
            <div class="muted">تتبع أذونات صرف الفسائل، طلبات الاستلام بالموقع، ومطابقة ما تم زراعته بالحقل</div>
          </div>
          <button class="btn btn-ghost icon-btn" data-act="export-dispensed-csv">📊 تصدير المنصرف (CSV)</button>
        </div>

        <div class="filter-bar" style="grid-template-columns:1.4fr 1fr 1fr auto;gap:8px;margin-bottom:12px">
          <input id="disp_q" value="${dispQ}" placeholder="🔍 بحث بكود الفسيلة أو الصنف أو القطعة..." />
          <select id="disp_status" data-act="disp-status-filter">
            <option value="all" ${dispStatusF==='all'?'selected':''}>كل الحالات</option>
            <option value="dispatched" ${dispStatusF==='dispatched'?'selected':''}>⏳ بانتظار استلام الحقل</option>
            <option value="issued" ${dispStatusF==='issued'?'selected':''}>✅ مستلمة بالموقع</option>
            <option value="planted" ${dispStatusF==='planted'?'selected':''}>🌴 زُرعت بالحقل</option>
          </select>
          <select id="disp_user" data-act="disp-user-filter">
            <option value="all" ${dispUserF==='all'?'selected':''}>كل المسؤولين بالموقع</option>
            ${(st.users || []).filter(u => ['engineer', 'worker', 'admin', 'supervisor'].includes(u.role)).map(u => `<option value="${u.id}" ${dispUserF===u.id?'selected':''}>${u.name} (${roleLabel(u.role)})</option>`).join("")}
          </select>
          <button class="btn btn-primary icon-btn" data-act="apply-disp-filter">تطبيق</button>
        </div>

        <div class="grid-wrap">
          <table class="dense">
            <thead>
              <tr>
                <th>#</th>
                <th>كود الفسيلة / الأصل</th>
                <th>المحصول والصنف</th>
                <th>تاريخ الصرف</th>
                <th>القطعة المستهدفة</th>
                <th>المستلم المسؤول</th>
                <th>حالة الاستلام والميدان</th>
                <th>الإجراء</th>
              </tr>
            </thead>
            <tbody>
              ${allDispensed.map((o, idx) => {
                const mom = palmMap.get(o.motherId);
                const oCrop = o.cropId || mom?.cropId || (o.tempCode ? "palm" : "olive");
                const varName = o.variety || mom?.variety || "—";
                const dispDate = o.dispatchedAt ? o.dispatchedAt.slice(0, 10) : (o.date || "—");
                const pName = o.dispatchedToPlot ? plotName(o.dispatchedToPlot) : "—";
                const uName = o.dispatchedToUserName || (o.dispatchedToUser ? userBy(o.dispatchedToUser)?.name : "—");
                const isPending = o.nsStatus === "dispatched";
                const isPlanted = o.nsStatus === "planted" || o.newPalmId || o.isPlanted;
                const canAccept = isPending && (canAcceptAny || me?.id === o.dispatchedToUser);

                return `
                  <tr>
                    <td>${idx + 1}</td>
                    <td>${codeHtml(o.tempCode || o.code)}</td>
                    <td>${cropIcon(oCrop, 14)} <b>${escapeHtml(varName)}</b></td>
                    <td>${dispDate}</td>
                    <td>${pName}</td>
                    <td><b>${escapeHtml(uName)}</b></td>
                    <td>
                      ${isPlanted ? `<span class="badge status" style="background:#E0E7FF;color:#3730A3;font-weight:700">🌴 زُرعت ${o.plantedPalmCode ? `(${codeHtml(o.plantedPalmCode)})` : ''}</span>` :
                        isPending ? `<span class="badge-warn status">بانتظار استلام الحقل ⏳</span>` :
                        `<span class="badge-ok status">مستلمة بالحقل (جاهزة) ✅</span>`}
                    </td>
                    <td class="row-acts">
                      ${canAccept ? `<button class="btn btn-primary icon-btn" data-act="accept-os-dispatch" data-id="${o.id}">اعتماد الاستلام ✅</button>` : ''}
                      ${isPlanted && o.newPalmId ? `<button class="btn btn-ghost icon-btn" data-go="palm" data-id="${o.newPalmId}">عرض الشجرة</button>` : ''}
                    </td>
                  </tr>
                `;
              }).join("") || '<tr><td colspan="8" class="muted" style="text-align:center;padding:24px">لا توجد فسائل منصرفة مطابقة للبحث</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // 3. Purchase / Intake Modal View
  if (showBuyForm) {
    const curCrop = buyCropSel || activeCrops[0]?.id || "palm";
    const cObj = activeCrops.find(c => c.id === curCrop);
    const approved = cObj?.sources && cObj.sources.length ? cObj.sources : (propSources.map(s => s.code));
    const filteredSources = propSources.filter(s => approved.includes(s.code));
    const listSources = filteredSources.length ? filteredSources : propSources;
    const curYear = new Date().getFullYear();
    const nextSeq = String((st.offshoots || []).length + 1).padStart(4, "0");

    return `
      ${tabsHeader}
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid #E2E8F0;padding-bottom:10px">
          <div>
            <h3 style="margin:0">📥 تسجيل وتوريد فسائل وأصول المشتل</h3>
            <div class="muted" style="font-size:12px;margin-top:3px">تكويد داخلي، رصيد افتتاحي، أو أوامر شراء وتوريد مجمعة</div>
          </div>
          <button class="btn btn-ghost icon-btn" data-act="hide-buy">✕ إغلاق</button>
        </div>

        <div style="display:flex;gap:8px;margin-bottom:14px;background:#F1F5F9;padding:4px;border-radius:8px">
          <button type="button" class="btn ${nurseryIntakeMode === 'opening' ? 'btn-primary' : 'btn-ghost'}" data-act="set-intake-mode" data-id="opening" style="flex:1;font-weight:700">
            📦 رصيد افتتاحي / شراء بدون نسب
          </button>
          <button type="button" class="btn ${nurseryIntakeMode === 'internal' ? 'btn-primary' : 'btn-ghost'}" data-act="set-intake-mode" data-id="internal" style="flex:1;font-weight:700">
            🌴 قلع وفصل داخلي (بنسب لأم)
          </button>
        </div>

        ${nurseryIntakeMode === 'opening' ? `
          <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:#166534">
            💡 <b>تسجيل رصيد افتتاحي / شراء:</b> يُمكنك تسجيل كمية مجمعة وتوليد أكواد متسلسلة تلقائياً. ستظهر الفسائل في المشتل بحالة "جاهزة للصرف" ويمكن اختيارها عند زراعة الشجرة بالحقل.
          </div>
          <div class="grid grid-2">
            <div>
              <label>المحصول</label>
              <select id="ncrop_buy" data-act="buy-crop-change">
                ${activeCrops.map(c => `<option value="${c.id}" ${(buyCropSel||"palm")===c.id?"selected":""}>${cropTextLabel(c)}</option>`).join("")}
              </select>
            </div>
            <div>
              <label>الصنف</label>
              <select id="nvarn">${varietyOptions(null, curCrop)}</select>
            </div>
          </div>
          <div class="grid grid-3">
            <div><label>الكمية الواردة (العدد)</label><input id="nqty" type="number" min="1" max="1000" value="1" placeholder="مثال: 50" /></div>
            <div><label>بادئة الكود (Prefix)</label><input id="nprefix" value="NUR-${curYear}-" placeholder="NUR-${curYear}-" /></div>
            <div><label>تسلسل البداية</label><input id="nseqb" value="${nextSeq}" placeholder="0001" /></div>
          </div>
          <div class="grid grid-3">
            <div>
              <label>المصدر ونوع الإكثار</label>
              <select id="nsrc">
                ${listSources.map(s => `<option value="${s.code}">${s.code} - ${s.name}</option>`).join("")}
              </select>
            </div>
            <div>
              <label>المورد / نوع الرصيد والتوريد *</label>
              <select id="nsupn_sel" data-act="n-sup-change">
                <option value="رصيد افتتاحي معتمد">رصيد افتتاحي معتمد (المشتل الداخلي)</option>
                <option value="شراء من مشتل خارجي">شراء من مشتل خارجي معتمد</option>
                <option value="توريد مشروع زراعي">توريد مشروع زراعي / نقل بين المزارع</option>
                <option value="إهداء / جهة بحثية">إهداء / جهة بحثية وإرشادية</option>
                <option value="custom">جهة أخرى / كتابة اسم المورد...</option>
              </select>
              <input id="nsupn_custom" class="hidden" style="margin-top:6px" placeholder="اكتب اسم المورد أو المشتل الخارجي..." />
            </div>
            <div>
              <label style="font-weight:700">مسار الإدخال الأولي بالمشتل *</label>
              <select id="ninitial_stage">
                <option value="inbound" selected>📥 الوارد والتوريد (بانتظار الاستلام والتجهيز - افتراضي)</option>
                <option value="rooting">🌱 في التجذير والرعاية بالمشتل</option>
                <option value="ready">✅ جاهزة للصرف والزراعة المباشرة بالحقل</option>
              </select>
            </div>
            <div><label>تاريخ الدخول للمشتل</label><input id="ndateb" type="date" value="${new Date().toISOString().slice(0,10)}" /></div>
          </div>
          <label>ملاحظات التوريد</label>
          <textarea id="nnoteb" placeholder="أي ملاحظات حول الجودة أو الرصيد الافتتاحي..."></textarea>
          <button class="btn btn-primary" data-act="save-nursery" style="margin-top:10px;width:100%;font-weight:700">
            💾 حفظ وتوليد الأكواد في سجل المشتل وقاعدة البيانات
          </button>
        ` : `
          <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:#92400E">
            🌴 <b>قلع وفصل داخلي:</b> يتطلب تحديد النخلة الأم لتوثيق شجرة النسب وسلالة الفسيلة بدقة.
          </div>
          <div class="grid grid-2">
            <div>
              <label>كود النخلة الأم المسجلة بالحقل *</label>
              <input id="nmother_code" list="palms_list_intake" placeholder="اكتب أو اختر كود النخلة الأم..." />
              <datalist id="palms_list_intake">
                ${st.palms.filter(p => !p.archived).map(p => `<option value="${p.code}">${p.code} — صنف: ${p.variety||'—'} (${p.plot})</option>`).join("")}
              </datalist>
            </div>
            <div><label>تاريخ الفصل / القلع</label><input id="nsep_date" type="date" value="${new Date().toISOString().slice(0,10)}" /></div>
          </div>
          <div class="grid grid-3">
            <div><label>الوزن التقديري (كجم)</label><input id="nweight" type="number" step="0.5" placeholder="15" /></div>
            <div><label>القطر (سم)</label><input id="ndiameter" type="number" step="0.5" placeholder="25" /></div>
            <div>
              <label>الحالة الصحية</label>
              <select id="nhealth">
                <option value="healthy">سليمة وممتازة</option>
                <option value="moderate">متوسطة</option>
                <option value="alert">تحت الملاحظة</option>
              </select>
            </div>
          </div>
          <label>ملاحظات الفصل</label>
          <textarea id="nnoteb_sep" placeholder="ملاحظات حول عملية القلع والتحضين..."></textarea>
          <button class="btn btn-primary" data-act="save-nursery-sep" style="margin-top:10px;width:100%;font-weight:700">
            💾 تسجيل الفسيلة المفصولة وتوليد كود المشتل
          </button>
        `}
      </div>
    `;
  }

  // 4. Default Dense Inventory Pipeline Table (for inbound, rooting, ready)
  let activeList = rootingItems;
  let pipelineTitle = "فسائل وأصول في التجذير والرعاية بالمشتل";
  if (nurseryTab === "inbound") {
    activeList = inboundItems;
    pipelineTitle = "الشحنات والفسائل الواردة بانتظار الاستلام والتجهيز";
  } else if (nurseryTab === "ready") {
    activeList = readyItems;
    pipelineTitle = "الأصول المعتمدة الجاهزة للصرف والزراعة المباشرة بالحقل";
  }

  // Apply search query
  if (nurserySearchQ) {
    const sq = nurserySearchQ.trim().toLowerCase();
    activeList = activeList.filter(o => {
      const mom = palmMap.get(o.motherId);
      const code = (o.tempCode || o.code || o.id || "").toLowerCase();
      const vari = (o.variety || mom?.variety || "").toLowerCase();
      const momCode = (mom?.code || "").toLowerCase();
      const sup = (o.supplier || "").toLowerCase();
      return code.includes(sq) || vari.includes(sq) || momCode.includes(sq) || sup.includes(sq);
    });
  }

  // Sort activeList (default: newest to oldest by date)
  activeList.sort((a, b) => {
    let valA, valB;
    if (nurserySortCol === "code") {
      valA = a.tempCode || a.code || a.id || "";
      valB = b.tempCode || b.code || b.id || "";
    } else if (nurserySortCol === "variety") {
      const momA = palmMap.get(a.motherId);
      const momB = palmMap.get(b.motherId);
      valA = a.variety || momA?.variety || "";
      valB = b.variety || momB?.variety || "";
    } else if (nurserySortCol === "source") {
      valA = a.supplier || a.motherCode || a.originType || "";
      valB = b.supplier || b.motherCode || b.originType || "";
    } else if (nurserySortCol === "status") {
      valA = a.nsStatus || a.status || "";
      valB = b.nsStatus || b.status || "";
    } else {
      // date (default)
      valA = a.date || a.created_at || "";
      valB = b.date || b.created_at || "";
    }

    let cmp = 0;
    if (typeof valA === "number" && typeof valB === "number") {
      cmp = valA - valB;
    } else {
      cmp = String(valA).localeCompare(String(valB), "ar", { numeric: true });
    }
    return nurserySortDir === "desc" ? -cmp : cmp;
  });

  const visibleIds = activeList.map(o => o.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedOffshootIds.has(id));
  const nSortIcon = col => (nurserySortCol === col ? (nurserySortDir === 'asc' ? ' <span style="color:var(--green)">▲</span>' : ' <span style="color:var(--green)">▼</span>') : ' <span style="color:#94A3B8;font-size:11px">⇅</span>');

  return `
    ${tabsHeader}
    ${showDispenseModal ? renderDispenseModal(st) : ''}
    ${renderCullModal(st)}
    ${renderCullReportModal(st)}
    ${renderBarcodeModal(st)}

    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">
        <div>
          <h4 style="margin:0">${pipelineTitle}</h4>
          <div class="muted" style="font-size:12px">دفتر جرد ومتابعة سريع • عدد الأصول المعروضة: <b>${activeList.length}</b></div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <input id="n_search_q" value="${escapeHtml(nurserySearchQ)}" placeholder="🔍 بحث بكود الفسيلة أو الصنف أو الأم..." oninput="nurserySearchQ=this.value;render()" style="width:260px;margin:0" />
        </div>
      </div>

      <!-- Dense Inventory Table (Image 1 Matching) -->
      <div class="grid-wrap" id="nursery-grid">
        <table class="dense" style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:#F8FAFC;border-bottom:2px solid #E2E8F0;user-select:none">
              <th style="width:36px;text-align:center">
                <input type="checkbox" id="n_grid_all" ${allVisibleSelected ? 'checked' : ''} onchange="window._onToggleNurseryAll?.(this.checked)" title="تحديد الكل" />
              </th>
              <th style="cursor:pointer;white-space:nowrap" data-act="sort-nursery" data-id="code" title="ترتيب حسب الكود">كود الفسيلة ${nSortIcon('code')}</th>
              <th style="cursor:pointer;white-space:nowrap" data-act="sort-nursery" data-id="variety" title="ترتيب حسب الصنف">الصنف ${nSortIcon('variety')}</th>
              <th style="cursor:pointer;white-space:nowrap" data-act="sort-nursery" data-id="source" title="ترتيب حسب المصدر">المصدر والنسب ${nSortIcon('source')}</th>
              <th style="cursor:pointer;white-space:nowrap" data-act="sort-nursery" data-id="date" title="ترتيب حسب التاريخ">تاريخ الدخول / العمر ${nSortIcon('date')}</th>
              <th style="cursor:pointer;white-space:nowrap" data-act="sort-nursery" data-id="status" title="ترتيب حسب الحالة">الحالة الحالية ${nSortIcon('status')}</th>
              <th style="text-align:center;width:70px">الإجراءات السريعة</th>
            </tr>
          </thead>
          <tbody>
            ${activeList.map(o => {
              const mom = palmMap.get(o.motherId);
              const isChecked = selectedOffshootIds.has(o.id);
              const code = o.tempCode || o.code || o.id;
              const variety = o.variety || mom?.variety || "خلاص";
              const ageMonths = calcAgeMonths(o.date || o.created_at);

              let lineageHtml = `<span class="muted">رصيد افتتاحي</span>`;
              if (mom) {
                lineageHtml = `<span>الأم: <a href="#" class="lnk code-chip" style="font-size:11px" data-go="palm" data-id="${mom.id}">${escapeHtml(mom.code)}</a></span>`;
              } else if (o.supplier) {
                lineageHtml = `<span title="${escapeHtml(o.supplier)}">${escapeHtml(o.supplier.length > 25 ? o.supplier.slice(0, 23) + '...' : o.supplier)}</span>`;
              }

              let statusBadge = `<span class="status" style="background:#FFFBEB;color:#92400E;font-weight:700;border:1px solid #FDE68A">تجذير ورعاية</span>`;
              if (o.approval === "pending" || o.approval === "waiting" || o.nsStatus === "inbound" || o.nsStatus === "pending" || (!o.nsStatus && !o.isOpeningStock && !o.is_opening_stock)) {
                statusBadge = `<span class="status" style="background:#EFF6FF;color:#1E40AF;font-weight:700;border:1px solid #BFDBFE">بانتظار الاستلام</span>`;
              } else if (o.nsStatus === "ready") {
                statusBadge = `<span class="status badge-ok" style="background:#F0FDF4;color:#166534;font-weight:700;border:1px solid #BBF7D0">جاهزة للصرف</span>`;
              }

              return `
                <tr style="background:${isChecked ? '#F0FDF4' : 'inherit'};border-bottom:1px solid #F1F5F9">
                  <td style="text-align:center">
                    <input type="checkbox" class="n-grid-chk" data-id="${o.id}" ${isChecked ? 'checked' : ''} onchange="window._onToggleNurseryItem?.('${o.id}', this.checked)" />
                  </td>
                  <td>
                    <span class="code-chip" style="font-weight:700;font-size:12px">${escapeHtml(code)}</span>
                  </td>
                  <td><b>${escapeHtml(variety)}</b></td>
                  <td>${lineageHtml}</td>
                  <td>
                    <span style="font-weight:700">${ageMonths > 0 ? `${ageMonths} شهور` : 'حديث الدخول'}</span>
                    ${o.date ? `<div class="muted" style="font-size:10px">${o.date}</div>` : ''}
                  </td>
                  <td>${statusBadge}</td>
                  <td style="text-align:center;position:relative;white-space:nowrap">
                    ${nurseryTab === 'inbound' ? `
                      <button class="btn btn-primary icon-btn" data-act="accept-inbound-os" data-id="${o.id}" style="padding:4px 10px;font-size:12px;font-weight:700;margin-left:4px;background:#16A34A;border-color:#16A34A" title="اعتماد استلام الفسيلة ونقلها للتجذير بالمشتل">📥 اعتماد الاستلام</button>
                    ` : ''}
                    <button class="btn btn-ghost icon-btn" data-act="toggle-os-menu" data-id="${o.id}" style="padding:4px 10px;font-size:15px;font-weight:bold;background:#F1F5F9;color:#1E293B;border:1px solid #CBD5E1;border-radius:6px" title="الإجراءات السريعة">[ ⋮ ]</button>
                    ${activeNurseryRowMenuId === o.id ? `
                      <div class="card" style="position:absolute;left:0;top:100%;z-index:999;min-width:190px;background:#FFFFFF;box-shadow:0 10px 30px rgba(0,0,0,0.22);border:1px solid #CBD5E1;border-radius:10px;padding:6px;display:flex;flex-direction:column;gap:3px">
                        ${nurseryTab === 'inbound' ? `
                          <button data-act="accept-inbound-os" data-id="${o.id}" style="background:#F0FDF4;border:1px solid #BBF7D0;text-align:right;justify-content:flex-start;padding:8px 12px;font-size:13px;font-weight:700;color:#15803D !important;border-radius:6px;cursor:pointer;display:flex;align-items:center;gap:6px">📥 اعتماد الاستلام بالمشتل</button>
                          <button data-act="move-to-rooting" data-id="${o.id}" style="background:#F0FDF4;border:1px solid #BBF7D0;text-align:right;justify-content:flex-start;padding:8px 12px;font-size:13px;font-weight:700;color:#15803D !important;border-radius:6px;cursor:pointer;display:flex;align-items:center;gap:6px">🌱 نقل إلى التجذير والرعاية</button>
                          <button data-act="ready-os" data-id="${o.id}" style="background:#EFF6FF;border:1px solid #BFDBFE;text-align:right;justify-content:flex-start;padding:8px 12px;font-size:13px;font-weight:700;color:#1D4ED8 !important;border-radius:6px;cursor:pointer;display:flex;align-items:center;gap:6px">✅ جاهزة للصرف مباشرة</button>
                        ` : nurseryTab === 'rooting' ? `
                          <button data-act="ready-os" data-id="${o.id}" style="background:#EFF6FF;border:1px solid #BFDBFE;text-align:right;justify-content:flex-start;padding:8px 12px;font-size:13px;font-weight:700;color:#1D4ED8 !important;border-radius:6px;cursor:pointer;display:flex;align-items:center;gap:6px">✅ تحويل إلى جاهزة للصرف</button>
                          <button data-act="open-os-prep" data-id="${o.id}" style="background:#F8FAFC;border:1px solid #E2E8F0;text-align:right;justify-content:flex-start;padding:8px 12px;font-size:13px;font-weight:700;color:#0F172A !important;border-radius:6px;cursor:pointer;display:flex;align-items:center;gap:6px">🌿 تسجيل نشاط / رعاية</button>
                          <button data-act="move-to-inbound" data-id="${o.id}" style="background:#F8FAFC;border:1px solid #E2E8F0;text-align:right;justify-content:flex-start;padding:8px 12px;font-size:13px;font-weight:700;color:#475569 !important;border-radius:6px;cursor:pointer;display:flex;align-items:center;gap:6px">📥 إعادة إلى الوارد</button>
                        ` : nurseryTab === 'ready' ? `
                          <button data-act="issue-os" data-id="${o.id}" style="background:#FEF3C7;border:1px solid #FDE68A;text-align:right;justify-content:flex-start;padding:8px 12px;font-size:13px;font-weight:700;color:#B45309 !important;border-radius:6px;cursor:pointer;display:flex;align-items:center;gap:6px">🚚 صرف للزراعة بالحقل</button>
                          <button data-act="move-to-rooting" data-id="${o.id}" style="background:#F0FDF4;border:1px solid #BBF7D0;text-align:right;justify-content:flex-start;padding:8px 12px;font-size:13px;font-weight:700;color:#15803D !important;border-radius:6px;cursor:pointer;display:flex;align-items:center;gap:6px">🌱 إعادة للتجذير والرعاية</button>
                        ` : `
                          <button data-act="open-os-prep" data-id="${o.id}" style="background:#F8FAFC;border:1px solid #E2E8F0;text-align:right;justify-content:flex-start;padding:8px 12px;font-size:13px;font-weight:700;color:#0F172A !important;border-radius:6px;cursor:pointer;display:flex;align-items:center;gap:6px">🌿 تسجيل نشاط</button>
                        `}
                        <button data-act="print-os-barcode" data-id="${o.id}" style="background:#F8FAFC;border:1px solid #E2E8F0;text-align:right;justify-content:flex-start;padding:8px 12px;font-size:13px;font-weight:700;color:#0F172A !important;border-radius:6px;cursor:pointer;display:flex;align-items:center;gap:6px">🏷️ طباعة الباركود</button>
                        <button data-act="cull-os" data-id="${o.id}" style="background:#FEF2F2;border:1px solid #FECACA;text-align:right;justify-content:flex-start;padding:8px 12px;font-size:13px;font-weight:700;color:#DC2626 !important;border-radius:6px;cursor:pointer;display:flex;align-items:center;gap:6px">🗑️ إهلاك / استبعاد</button>
                        <button data-act="del-os" data-id="${o.id}" style="background:#FEF2F2;border:1px solid #FECACA;text-align:right;justify-content:flex-start;padding:8px 12px;font-size:13px;font-weight:700;color:#991B1B !important;border-radius:6px;cursor:pointer;display:flex;align-items:center;gap:6px">✕ حذف نهائي</button>
                      </div>
                    ` : ''}
                  </td>
                </tr>
              `;
            }).join("") || `<tr><td colspan="7" class="muted" style="text-align:center;padding:30px">لا توجد فسائل أو أصول في هذا المسار حالياً</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Floating Bulk Action Bar -->
    ${selectedOffshootIds.size > 0 ? `
      <div class="floating-bulk-bar" style="position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1E293B;color:#ffffff;padding:10px 22px;border-radius:50px;box-shadow:0 12px 35px rgba(0,0,0,0.45);display:flex;align-items:center;gap:12px;z-index:10000;flex-wrap:wrap">
        <span style="background:#15803D;color:#ffffff !important;font-weight:800;padding:6px 14px;border-radius:20px;font-size:13px">تم تحديد ${selectedOffshootIds.size} فسيلة</span>
        ${nurseryTab === 'inbound' ? `
          <button data-act="bulk-accept-inbound" style="background:#16A34A;color:#FFFFFF !important;font-weight:800;font-size:13px;padding:8px 16px;border-radius:24px;border:none;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 2px 8px rgba(0,0,0,0.25)">📥 اعتماد استلام المحدد بالمشتل</button>
        ` : ''}
        <button data-act="bulk-nissue" style="background:#16A34A;color:#FFFFFF !important;font-weight:800;font-size:13px;padding:8px 16px;border-radius:24px;border:none;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 2px 8px rgba(0,0,0,0.25)">🚚 صرف للزراعة بالحقل</button>
        <button data-act="bulk-nrooting" style="background:#0284C7;color:#FFFFFF !important;font-weight:800;font-size:13px;padding:8px 16px;border-radius:24px;border:none;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 2px 8px rgba(0,0,0,0.25)">🌱 نقل للتجذير</button>
        <button data-act="bulk-nready" style="background:#059669;color:#FFFFFF !important;font-weight:800;font-size:13px;padding:8px 16px;border-radius:24px;border:none;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 2px 8px rgba(0,0,0,0.25)">✅ جاهزة للمحدد</button>
        <button data-act="bulk-nbarcode" style="background:#475569;color:#FFFFFF !important;font-weight:800;font-size:13px;padding:8px 16px;border-radius:24px;border:none;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 2px 8px rgba(0,0,0,0.25)">🏷️ طباعة الباركود</button>
        <button data-act="bulk-ncull" style="background:#DC2626;color:#FFFFFF !important;font-weight:800;font-size:13px;padding:8px 16px;border-radius:24px;border:none;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 2px 8px rgba(0,0,0,0.25)">🗑️ إهلاك / استبعاد</button>
        <button data-act="clear-nursery-selection" style="background:rgba(255,255,255,0.18);color:#F8FAFC !important;font-weight:700;font-size:12px;padding:7px 14px;border-radius:24px;border:1px solid rgba(255,255,255,0.3);cursor:pointer">✕ إلغاء التحديد</button>
      </div>
    ` : ''}
  `;
}

function fertilizersView() {
  const st = Store.get();

  // Deduplicate fertilizers on-the-fly to eliminate stale duplicates
  const seenFertKeys = new Set();
  const dedupedFertList = [];
  (st.fertilizers || []).forEach(f => {
    if (!f || !f.id) return;
    const baseId = (f.id.startsWith("proj_farafra_01_ft") ? f.id.replace("proj_farafra_01_", "") : f.id).toLowerCase();
    const nameKey = (f.name || "").trim().toLowerCase();
    if (seenFertKeys.has(baseId) || (nameKey && seenFertKeys.has("name:" + nameKey))) return;
    seenFertKeys.add(baseId);
    seenFertKeys.add(f.id.toLowerCase());
    if (nameKey) seenFertKeys.add("name:" + nameKey);
    dedupedFertList.push(f);
  });
  if (dedupedFertList.length !== (st.fertilizers || []).length) {
    st.fertilizers = dedupedFertList;
    Store.set({ fertilizers: dedupedFertList });
  }

  const u = session() || {};
  const scope = getEffectiveInventoryScope(u);
  const fertilizers = st.fertilizers || [];
  const vouchers = st.fertilizerVouchers || [];
  const canIssueVoucher = (scope === "all" || scope === "sector") && (u.role === "admin" || u.role === "warehouse_mgr" || u.role === "engineer" || hasPerm("fert_voucher_issue"));
  const canSupply = scope === "all" && (u.role === "admin" || u.role === "warehouse_mgr" || hasPerm("fert_supply_add"));
  const canManageItems = scope === "all" && (u.role === "admin" || u.role === "warehouse_mgr" || hasPerm("fert_item_manage"));
  const canManage = canIssueVoucher || canSupply || canManageItems;

  let pageTitle = "📦 منظومة إدارة ومخزون الأسمدة والمغذيات";
  let pageSubtitle = "متابعة أرصدة المستودع الرئيسي، صرف العهد للميدان، اعتماد الاستلام، وتتبع الاستهلاك الفعلي للحقل";

  if (scope === "personal") {
    pageTitle = "🌾 عهدة الأسمدة والمغذيات الميدانية الشخصية";
    pageSubtitle = "متابعة العهدة المستلمة في حوزتك بالميدان، ما تم استهلاكه في الأشجار، والمتبقي معك حالياً";
  } else if (scope === "sector") {
    pageTitle = "🌱 إدارة عهدة الأسمدة بقطاعات الإشراف";
    pageSubtitle = "متابعة أرصدة العهدة المصروفة لقطاعات إشرافك، الاستهلاك الفعلي على الأشجار، وإصدار أذونات الصرف للعمال";
  }

  let headerActions = "";
  if (scope !== "personal") {
    headerActions += `
      <button class="btn btn-ghost icon-btn" data-act="export-fert-balances-csv" title="تصدير أرصدة وجرد المخزون بصيغة Excel/CSV">📊 تصدير الأرصدة (Excel)</button>
      <button class="btn btn-ghost icon-btn" data-act="print-fert-balances-pdf" title="طباعة تقرير جرد المستودع الرسمي بصيغة PDF">📄 طباعة الجرد (PDF)</button>
    `;
  }
  if (canIssueVoucher) {
    headerActions += `
      <button class="btn ${showVoucherForm ? 'btn-primary' : 'btn-ghost'} icon-btn" data-act="tog-fert-voucher">📜 + إذن صرف للميدان</button>
    `;
  }
  if (canSupply) {
    headerActions += `
      <button class="btn ${showSupplyForm ? 'btn-primary' : 'btn-ghost'} icon-btn" data-act="tog-fert-supply">🚛 + توريد جديد للمخزن</button>
    `;
  }
  if (canManageItems) {
    headerActions += `
      <button class="btn ${showFertNewForm ? 'btn-primary' : 'btn-ghost'} icon-btn" data-act="tog-fert-new">➕ إضافة صنف جديد</button>
    `;
  }

  let statBarHtml = "";
  let tabStockLabel = "";
  let tabVouchersLabel = "";
  let tabConsumptionLabel = "";

  if (scope === "personal") {
    const workerSummary = getWorkerFertilizerSummary(u.id);
    const workerItems = Object.values(workerSummary).filter(it => it.received > 0 || it.consumed > 0);
    const totalReceived = workerItems.reduce((acc, it) => acc + (it.received || 0), 0);
    const totalConsumed = workerItems.reduce((acc, it) => acc + (it.consumed || 0), 0);
    const totalRemaining = workerItems.reduce((acc, it) => acc + (it.remaining || 0), 0);
    const myVouchers = vouchers.filter(v => {
      const recipientId = v.toUser || v.toUserId || v.to_user_id;
      return recipientId === u.id || recipientId === u.user;
    });
    const pendingCount = myVouchers.filter(v => v.status === "pending").length;

    tabStockLabel = `📦 عهدتي الحالية (${workerItems.length})`;
    tabVouchersLabel = `📋 أذونات العهدة المستلمة ${pendingCount ? `<span class="badge" style="background:#C85A2E;color:#fff;font-size:11px;padding:2px 6px;border-radius:10px">${pendingCount}</span>` : ''}`;
    tabConsumptionLabel = `🌾 سجل استهلاكي بالحقل`;

    statBarHtml = `
      <div class="fert-stat-bar">
        <div class="fert-stat-pill">
          <span class="fert-pill-icon">📦</span>
          <div>
            <div class="fert-pill-val">${workerItems.length}</div>
            <div class="fert-pill-lbl">الأصناف بعهدتك</div>
          </div>
        </div>
        <div class="fert-stat-pill">
          <span class="fert-pill-icon" style="color:#D97706">🚚</span>
          <div>
            <div class="fert-pill-val" style="color:#D97706">${Math.round(totalReceived).toLocaleString()}</div>
            <div class="fert-pill-lbl">إجمالي العهدة المستلمة</div>
          </div>
        </div>
        <div class="fert-stat-pill">
          <span class="fert-pill-icon" style="color:#2563EB">🌾</span>
          <div>
            <div class="fert-pill-val" style="color:#2563EB">${Math.round(totalConsumed).toLocaleString()}</div>
            <div class="fert-pill-lbl">المنصرف والمستهلك بالحقل</div>
          </div>
        </div>
        <div class="fert-stat-pill" style="border-color:var(--green);background:#F0FDF4">
          <span class="fert-pill-icon" style="color:var(--green)">🌿</span>
          <div>
            <div class="fert-pill-val" style="color:var(--green)">${Math.round(totalRemaining).toLocaleString()}</div>
            <div class="fert-pill-lbl" style="color:var(--green-d)">المتبقي في حوزتك بالميدان</div>
          </div>
        </div>
        ${pendingCount > 0 ? `
          <div class="fert-stat-pill" style="border-color:#F59E0B;background:#FFFBEB">
            <span class="fert-pill-icon">⏳</span>
            <div>
              <div class="fert-pill-val" style="color:#B45309">${pendingCount}</div>
              <div class="fert-pill-lbl" style="color:#B45309">أذونات بانتظار استلامك</div>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  } else if (scope === "sector") {
    const secSummary = getSectorFertilizerSummary(u);
    const secItems = Object.values(secSummary.map).filter(it => it.received > 0 || it.consumed > 0);
    const totalReceived = secItems.reduce((acc, it) => acc + (it.received || 0), 0);
    const totalConsumed = secItems.reduce((acc, it) => acc + (it.consumed || 0), 0);
    const totalRemaining = secItems.reduce((acc, it) => acc + (it.remaining || 0), 0);
    const sectorVouchers = vouchers.filter(v => v.toUser === u.id || (v.sectorId && secSummary.supervisedSectors.has(v.sectorId)));
    const pendingCount = sectorVouchers.filter(v => v.status === "pending").length;

    tabStockLabel = `🌱 رصيد عهدة القطاعات (${secItems.length})`;
    tabVouchersLabel = `📋 أذونات القطاع ${pendingCount ? `<span class="badge" style="background:#C85A2E;color:#fff;font-size:11px;padding:2px 6px;border-radius:10px">${pendingCount}</span>` : ''}`;
    tabConsumptionLabel = `🌾 استهلاك قطاعات الإشراف`;

    statBarHtml = `
      <div class="fert-stat-bar">
        <div class="fert-stat-pill">
          <span class="fert-pill-icon">🌱</span>
          <div>
            <div class="fert-pill-val">${secItems.length}</div>
            <div class="fert-pill-lbl">الأصناف بقطاعاتك</div>
          </div>
        </div>
        <div class="fert-stat-pill">
          <span class="fert-pill-icon" style="color:#D97706">🚚</span>
          <div>
            <div class="fert-pill-val" style="color:#D97706">${Math.round(totalReceived).toLocaleString()}</div>
            <div class="fert-pill-lbl">رصيد عهدة قطاعات الإشراف</div>
          </div>
        </div>
        <div class="fert-stat-pill">
          <span class="fert-pill-icon" style="color:#2563EB">🌾</span>
          <div>
            <div class="fert-pill-val" style="color:#2563EB">${Math.round(totalConsumed).toLocaleString()}</div>
            <div class="fert-pill-lbl">المستهلك الفعلي بقطاعاتك</div>
          </div>
        </div>
        <div class="fert-stat-pill" style="border-color:var(--green);background:#F0FDF4">
          <span class="fert-pill-icon" style="color:var(--green)">🌿</span>
          <div>
            <div class="fert-pill-val" style="color:var(--green)">${Math.round(totalRemaining).toLocaleString()}</div>
            <div class="fert-pill-lbl" style="color:var(--green-d)">المتبقي بعهدة الموقع الميداني</div>
          </div>
        </div>
        ${pendingCount > 0 ? `
          <div class="fert-stat-pill" style="border-color:#F59E0B;background:#FFFBEB">
            <span class="fert-pill-icon">⏳</span>
            <div>
              <div class="fert-pill-val" style="color:#B45309">${pendingCount}</div>
              <div class="fert-pill-lbl" style="color:#B45309">أذونات بانتظار الاعتماد</div>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  } else {
    // scope === 'all'
    const totalStock = fertilizers.reduce((acc, f) => acc + (Number(f.stock) || 0), 0);
    const totalAllocated = fertilizers.reduce((acc, f) => acc + (Number(f.allocated) || 0), 0);
    const totalConsumed = fertilizers.reduce((acc, f) => acc + (Number(f.consumed) || 0), 0);
    const lowStockCount = fertilizers.filter(f => (Number(f.stock) || 0) <= (Number(f.minAlert) || 0)).length;
    const pendingVouchers = vouchers.filter(v => v.status === "pending").length;

    tabStockLabel = `📦 أرصدة المخزون والتوريد (${fertilizers.length})`;
    tabVouchersLabel = `📋 أذونات الصرف والاستلام ${pendingVouchers ? `<span class="badge" style="background:#C85A2E;color:#fff;font-size:11px;padding:2px 6px;border-radius:10px">${pendingVouchers}</span>` : ''}`;
    tabConsumptionLabel = `🌾 سجل استهلاك الحقل الميداني`;

    statBarHtml = `
      <div class="fert-stat-bar">
        <div class="fert-stat-pill">
          <span class="fert-pill-icon">📦</span>
          <div>
            <div class="fert-pill-val">${fertilizers.length}</div>
            <div class="fert-pill-lbl">الأصناف المسجلة</div>
          </div>
        </div>
        <div class="fert-stat-pill">
          <span class="fert-pill-icon" style="color:var(--green)">🏬</span>
          <div>
            <div class="fert-pill-val" style="color:var(--green)">${totalStock.toLocaleString()}</div>
            <div class="fert-pill-lbl">رصيد المستودع</div>
          </div>
        </div>
        <div class="fert-stat-pill">
          <span class="fert-pill-icon" style="color:#D97706">🚚</span>
          <div>
            <div class="fert-pill-val" style="color:#D97706">${totalAllocated.toLocaleString()}</div>
            <div class="fert-pill-lbl">المنصرف عهدة للموقع</div>
          </div>
        </div>
        <div class="fert-stat-pill">
          <span class="fert-pill-icon" style="color:#2563EB">🌾</span>
          <div>
            <div class="fert-pill-val" style="color:#2563EB">${totalConsumed.toLocaleString()}</div>
            <div class="fert-pill-lbl">المستهلك الفعلي بالحقل</div>
          </div>
        </div>
        ${lowStockCount > 0 ? `
          <div class="fert-stat-pill" style="border-color:#F59E0B;background:#FFFBEB">
            <span class="fert-pill-icon">⚠️</span>
            <div>
              <div class="fert-pill-val" style="color:#B45309">${lowStockCount}</div>
              <div class="fert-pill-lbl" style="color:#B45309">مركبات بحد الأمان</div>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  return `
    ${renderFertEditModal(st)}
    <div class="page-head">
      <div>
        <h3>${pageTitle}</h3>
        <div class="muted">${pageSubtitle}</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${headerActions}
      </div>
    </div>

    <div class="ptabs" style="margin-bottom:12px">
      <button class="${fertTab === 'stock' ? 'on' : ''}" data-act="fert-tab" data-id="stock">${tabStockLabel}</button>
      <button class="${fertTab === 'vouchers' ? 'on' : ''}" data-act="fert-tab" data-id="vouchers">${tabVouchersLabel}</button>
      <button class="${fertTab === 'consumption' ? 'on' : ''}" data-act="fert-tab" data-id="consumption">${tabConsumptionLabel}</button>
    </div>

    ${statBarHtml}

    ${showFertNewForm ? renderFertNewForm(st) : ""}
    ${showSupplyForm ? renderFertSupplyForm(st) : ""}
    ${showVoucherForm ? renderFertVoucherForm(st, u) : ""}

    ${fertTab === "stock" ? renderFertStockTab(st, canManage, scope, u) : ""}
    ${fertTab === "vouchers" ? renderFertVouchersTab(st, canManage, u, scope) : ""}
    ${fertTab === "consumption" ? renderFertConsumptionTab(st, scope, u) : ""}
  `;
}

function renderFertNewForm(st) {
  const activeCrops = (st.crops || []).filter(c => c.active);
  return `
    <div class="card" style="background:#F7F3EA;border:1.5px solid var(--green);margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <h4 style="margin:0">➕ إضافة صنف مركب / سماد جديد للمخزون</h4>
        <button class="btn btn-ghost icon-btn" data-act="tog-fert-new">✕ إلغاء</button>
      </div>
      <div class="grid grid-3">
        <div><label>اسم المركب أو السماد</label><input id="f_new_name" placeholder="مثال: نترات نشادر 33.5%" /></div>
        <div>
          <label>المحصول المخصص له</label>
          <select id="f_new_crop">
            <option value="all">🌐 مشترك لكافة المحاصيل</option>
            ${activeCrops.map(c => `<option value="${c.id}">${cropTextLabel(c)}</option>`).join("")}
          </select>
        </div>
        <div>
          <label>التصنيف</label>
          <select id="f_new_kind">
            <option value="عضوي">سماد عضوي</option>
            <option value="كيميائي">سماد كيميائي</option>
            <option value="عناصر صغرى">عناصر صغرى مخلبية</option>
            <option value="أحماض أمينية">أحماض أمينية ومحفزات</option>
            <option value="مخصب">مخصب / معالجة تربة</option>
            <option value="مبيد">مبيد وقائي / علاجي</option>
          </select>
        </div>
        <div>
          <label>وحدة القياس</label>
          <select id="f_new_unit">
            <option value="كجم">كجم (كيلوجرام)</option>
            <option value="لتر">لتر</option>
            <option value="شيكارة">شيكارة (50 كجم)</option>
            <option value="جم">جم (جرام)</option>
          </select>
        </div>
        <div><label>الرصيد الابتدائي بالمستودع</label><input id="f_new_stock" type="number" min="0" value="0" placeholder="0" /></div>
        <div><label>حد التنبيه وإعادة الطلب</label><input id="f_new_min" type="number" min="0" value="50" placeholder="50" /></div>
        <div><label>تكلفة الوحدة التقريبية (${st.settings?.currency || 'ج.م'})</label><input id="f_new_cost" type="number" step="any" value="0" placeholder="0" /></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-primary" data-act="save-fert-new">حفظ وإضافة للمخزن</button>
        <button class="btn btn-ghost" data-act="tog-fert-new">إلغاء</button>
      </div>
    </div>
  `;
}

window._onSupFertChange = function(fId) {
  const st = Store.get();
  const f = (st.fertilizers || []).find(item => item.id === fId);
  const costInp = document.querySelector("#f_sup_cost");
  if (costInp && f) {
    costInp.value = f.unitCost || f.cost || 0;
  }
  window._calcSupTotal?.();
};

window._calcSupTotal = function() {
  const q = parseFloat(document.querySelector("#f_sup_qty")?.value || 0);
  const c = parseFloat(document.querySelector("#f_sup_cost")?.value || 0);
  const totInp = document.querySelector("#f_sup_total");
  if (totInp) {
    const total = (q > 0 && c > 0) ? (q * c) : 0;
    totInp.value = total > 0 ? total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00";
  }
};

function renderFertSupplyForm(st) {
  const fertilizers = st.fertilizers || [];
  const curr = st.settings?.currency || 'ج.م';
  const initialFert = fertilizers.find(f => f.id === quickSupplyFertId) || fertilizers[0];
  const initialCost = initialFert ? (Number(initialFert.unitCost || initialFert.cost) || 0) : 0;
  return `
    <div class="card" style="background:#F0F7ED;border:1.5px solid var(--green);margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <h4 style="margin:0">🚛 تسجيل توريد شحنة سماد جديدة للمستودع</h4>
        <button class="btn btn-ghost icon-btn" data-act="tog-fert-supply">✕ إلغاء</button>
      </div>
      <div class="grid grid-3">
        <div>
          <label>الصنف المورّد</label>
          <select id="f_sup_fert" onchange="window._onSupFertChange?.(this.value)">
            ${fertilizers.length === 0 ? '<option value="">(لا توجد أصناف مسجلة - أضف صنفاً أولاً)</option>' : ''}
            ${fertilizers.map(f => `<option value="${f.id}" ${quickSupplyFertId === f.id ? 'selected' : ''}>${f.name} (المتاح: ${f.stock} ${f.unit})</option>`).join("")}
          </select>
        </div>
        <div><label>الكمية المورّدة</label><input id="f_sup_qty" type="number" min="1" placeholder="مثال: 5000" oninput="window._calcSupTotal?.()" /></div>
        <div><label>سعر / تكلفة شراء الوحدة (${curr})</label><input id="f_sup_cost" type="number" step="any" min="0" value="${initialCost || ''}" placeholder="0.00" oninput="window._calcSupTotal?.()" /></div>
        <div><label>إجمالي قيمة الفاتورة (${curr})</label><input id="f_sup_total" type="text" readonly style="background:#eef2f6;font-weight:bold;color:var(--primary)" placeholder="0.00" /></div>
        <div><label>اسم المورّد / جهة التوريد</label><input id="f_sup_supplier" placeholder="مثال: شركة الأسمدة الوطنية" /></div>
        <div><label>تاريخ التوريد</label><input id="f_sup_date" type="date" value="${new Date().toISOString().slice(0, 10)}" /></div>
        <div style="grid-column: span 3"><label>ملاحظات الشحنة / رقم الفاتورة</label><input id="f_sup_notes" placeholder="اختياري — رقم بوليصة الشحن أو الفاتورة" /></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-primary" data-act="save-fert-supply">اعتماد وتأكيد التوريد بالمخزن</button>
        <button class="btn btn-ghost" data-act="tog-fert-supply">إلغاء</button>
      </div>
    </div>
  `;
}

function renderFertStockTab(st, canManage, scope, u) {
  u = u || session() || {};
  scope = scope || getEffectiveInventoryScope(u);
  const fertilizers = st.fertilizers || [];
  const q = (fertQ || "").toLowerCase().trim();

  if (scope === "personal") {
    const workerSummary = getWorkerFertilizerSummary(u.id);
    const list = Object.values(workerSummary).filter(item => {
      if (item.received <= 0 && item.consumed <= 0) return false;
      const f = item.fert;
      if (!q) return true;
      return (f.name && f.name.toLowerCase().includes(q)) || (f.kind && f.kind.toLowerCase().includes(q));
    });

    const vouchers = st.fertilizerVouchers || [];
    const myPendingVouchers = vouchers.filter(v => {
      const recipientId = v.toUser || v.toUserId || v.to_user_id;
      return (recipientId === u.id || recipientId === u.user) && v.status === "pending" && (v.type === "issue" || v.voucherType === "issue");
    });

    return `
      ${myPendingVouchers.length > 0 ? `
        <div class="card" style="border:2px solid #F59E0B;background:#FFFBEB;margin-bottom:14px;padding:14px;border-radius:14px;box-shadow:0 4px 6px -1px rgba(245,158,11,0.15)">
          <div style="font-weight:800;color:#B45309;font-size:15px;margin-bottom:10px;display:flex;align-items:center;gap:6px">
            <span>📦</span>
            <span>يوجد (${myPendingVouchers.length}) إذن صرف عهدة بانتظار استلامك واعتمادك بالموقع:</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${myPendingVouchers.map(v => `
              <div style="display:flex;justify-content:space-between;align-items:center;background:#ffffff;padding:12px;border-radius:10px;border:1px solid #FDE68A;flex-wrap:wrap;gap:8px">
                <div>
                  <div style="font-weight:700;color:#1E293B;font-size:14px">${v.id} • <b>${v.fertName || fertName(v.fertId)}</b></div>
                  <div class="muted" style="font-size:12px;margin-top:2px">الكمية: <b style="color:#D97706">${v.qty} ${v.unit || 'كجم'}</b> • التاريخ: ${v.date || v.voucherDate} ${v.notes ? `• ${v.notes}` : ''}</div>
                </div>
                <div style="display:flex;gap:6px">
                  <button class="btn btn-primary" style="background:#16A34A;border-color:#15803D;font-weight:700;padding:8px 16px;font-size:13px" data-act="accept-fert-voucher" data-id="${v.id}">
                    ✅ تأكيد الاستلام بالموقع
                  </button>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      ` : ''}
      <div class="card">
        <div class="actions" style="justify-content:space-between;flex-wrap:wrap">
          <div style="display:flex;gap:8px;align-items:center;flex:1;max-width:360px">
            <input id="fert_search_inp" placeholder="🔍 بحث في عهدتي الشخصية بالميدان..." value="${fertQ || ''}" oninput="fertQ=this.value;render()" style="margin:0" />
          </div>
          <div class="muted" style="font-size:13px">عدد أصناف عهدتك: <b>${list.length}</b></div>
        </div>

        <div class="grid-wrap" style="margin-top:10px">
          <table class="dense">
            <thead>
              <tr>
                <th>المركب / السماد</th>
                <th>التصنيف</th>
                <th>الوحدة</th>
                <th>إجمالي المستلم بالعهدة</th>
                <th>المستهلك الفعلي بالحقل</th>
                <th>المتبقي في حوزتك بالميدان</th>
                <th>حالة العهدة</th>
              </tr>
            </thead>
            <tbody>
              ${list.map(item => {
                const f = item.fert;
                const rec = Math.round(item.received * 10) / 10;
                const cons = Math.round(item.consumed * 10) / 10;
                const rem = Math.round(item.remaining * 10) / 10;
                const isFinished = rem <= 0 && rec > 0;
                return `
                  <tr>
                    <td><b>${f.name}</b></td>
                    <td><span class="status ${f.kind==='عضوي'?'st-ok':f.kind==='مبيد'?'st-bad':'st-sync'}">${f.kind || 'سماد'}</span></td>
                    <td>${f.unit}</td>
                    <td><b style="color:#D97706;font-size:14px">${rec.toLocaleString()}</b></td>
                    <td><span style="color:#2563EB;font-weight:700">${cons.toLocaleString()}</span></td>
                    <td><b style="font-size:15px;color:${rem>0?'var(--green-d)':'#6B7280'}">${rem.toLocaleString()}</b></td>
                    <td>
                      ${isFinished ? `<span class="status" style="background:#F3F4F6;color:#6B7280">تم استهلاكها بالكامل</span>` :
                        rem > 0 ? `<span class="status st-ok">في حوزتك بالميدان</span>` : `<span class="status st-wait">لا يوجد رصيد</span>`}
                    </td>
                  </tr>
                `;
              }).join("") || `<tr><td colspan="7" class="muted" style="text-align:center;padding:24px">لا توجد عهدة أسمدة مسجلة باسمك حالياً</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  if (scope === "sector") {
    const secSummary = getSectorFertilizerSummary(u);
    const list = Object.values(secSummary.map).filter(item => {
      const f = item.fert;
      if (!q) return (item.received > 0 || item.consumed > 0);
      return (f.name && f.name.toLowerCase().includes(q)) || (f.kind && f.kind.toLowerCase().includes(q));
    });

    return `
      <div class="card">
        <div class="actions" style="justify-content:space-between;flex-wrap:wrap">
          <div style="display:flex;gap:8px;align-items:center;flex:1;max-width:360px">
            <input id="fert_search_inp" placeholder="🔍 بحث في عهدة قطاعات الإشراف..." value="${fertQ || ''}" oninput="fertQ=this.value;render()" style="margin:0" />
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <div class="muted" style="font-size:13px">عدد أصناف القطاع: <b>${list.length}</b></div>
            ${canManage ? `<button class="btn btn-primary icon-btn" data-act="tog-fert-voucher" title="إصدار إذن صرف لعمال القطاع">+ إذن صرف لميدان القطاع</button>` : ''}
          </div>
        </div>

        <div class="grid-wrap" style="margin-top:10px">
          <table class="dense">
            <thead>
              <tr>
                <th>المركب / السماد</th>
                <th>المحصول</th>
                <th>التصنيف</th>
                <th>الوحدة</th>
                <th>عهدة القطاع المستلمة</th>
                <th>المستهلك الفعلي بقطاعاتك</th>
                <th>المتبقي بموقع القطاع</th>
                <th>معدل الاستهلاك</th>
                ${canManage ? '<th>إجراءات</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${list.map(item => {
                const f = item.fert;
                const rec = Math.round(item.received * 10) / 10;
                const cons = Math.round(item.consumed * 10) / 10;
                const rem = Math.round(item.remaining * 10) / 10;
                const pct = rec > 0 ? Math.min(100, Math.round((cons / rec) * 100)) : 0;
                const cropBadge = f.cropId === "olive" ? `${cropIcon("olive", 14)} زيتون` : (f.cropId === "palm" ? "🌴 نخيل" : "🌐 مشترك");

                return `
                  <tr>
                    <td><b>${f.name}</b></td>
                    <td><span class="chip" style="font-size:11px">${cropBadge}</span></td>
                    <td><span class="status ${f.kind==='عضوي'?'st-ok':f.kind==='مبيد'?'st-bad':'st-sync'}">${f.kind || 'سماد'}</span></td>
                    <td>${f.unit}</td>
                    <td><b style="color:#D97706;font-size:14px">${rec.toLocaleString()}</b></td>
                    <td><span style="color:#2563EB;font-weight:700">${cons.toLocaleString()}</span></td>
                    <td><b style="font-size:14px;color:var(--green-d)">${rem.toLocaleString()}</b></td>
                    <td style="min-width:120px">
                      <div style="font-size:12px;margin-bottom:2px">${pct}% (${cons}/${rec})</div>
                      <div style="background:#E5E7EB;height:6px;border-radius:999px;overflow:hidden">
                        <div style="background:var(--green);height:100%;width:${pct}%"></div>
                      </div>
                    </td>
                    ${canManage ? `
                      <td class="row-acts">
                        <button class="btn btn-ghost icon-btn" data-act="quick-issue-fert" data-id="${f.id}" title="صرف كمية من الصنف لعمال القطاع">+ صرف للعمال</button>
                      </td>
                    ` : ''}
                  </tr>
                `;
              }).join("") || `<tr><td colspan="9" class="muted" style="text-align:center;padding:24px">لا توجد عهدة منصرفة لقطاعات إشرافك حتى الآن</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // scope === 'all' (Central Warehouse)
  const list = fertilizers.filter(f => !q || (f.name && f.name.toLowerCase().includes(q)) || (f.kind && f.kind.toLowerCase().includes(q)));
  const canSupply = u.role === "admin" || u.role === "warehouse_mgr" || hasPerm("fert_supply_add");
  const canManageItems = u.role === "admin" || u.role === "warehouse_mgr" || hasPerm("fert_item_manage");

  return `
    <div class="card">
      <div class="actions" style="justify-content:space-between;flex-wrap:wrap">
        <div style="display:flex;gap:8px;align-items:center;flex:1;max-width:360px">
          <input id="fert_search_inp" placeholder="🔍 بحث في الأسمدة والمركبات..." value="${fertQ || ''}" oninput="fertQ=this.value;render()" style="margin:0" />
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <div class="muted" style="font-size:13px">عدد الأصناف: <b>${list.length}</b></div>
          <button class="btn btn-ghost icon-btn" data-act="export-fert-balances-csv" title="تصدير أرصدة وجرد المخزون Excel/CSV">📊 تصدير Excel</button>
          <button class="btn btn-ghost icon-btn" data-act="print-fert-balances-pdf" title="طباعة تقرير جرد المستودع الرسمي PDF">📄 طباعة PDF</button>
          ${canSupply ? `<button class="btn btn-ghost icon-btn" data-act="tog-fert-supply" title="تسجيل توريد جديد للمستودع">🚛 + توريد</button>` : ''}
          ${canManageItems ? `<button class="btn btn-primary icon-btn" data-act="tog-fert-new" title="إضافة صنف جديد للمخزون">➕ صنف جديد</button>` : ''}
        </div>
      </div>

      <div class="grid-wrap" style="margin-top:10px">
        <table class="dense">
          <thead>
            <tr>
              <th>المركب / السماد</th>
              <th>المحصول</th>
              <th>النوع</th>
              <th>الوحدة</th>
              <th>المخزن الرئيسي</th>
              <th>عهدة الموقع</th>
              <th>المستهلك بالحقل</th>
              <th>الإجمالي الكلي</th>
              <th>حد الأمان</th>
              <th>حالة الرصيد</th>
              ${canManage ? '<th>إجراءات المخزن</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${list.map(f => {
              const stock = Number(f.stock) || 0;
              const allocated = Number(f.allocated) || 0;
              const consumed = Number(f.consumed) || 0;
              const minAlert = Number(f.minAlert) || 0;
              const total = stock + allocated;
              const isLow = stock <= minAlert;
              const cropBadge = f.cropId === "olive" ? `${cropIcon("olive", 14)} زيتون` : (f.cropId === "palm" ? "🌴 نخيل" : "🌐 مشترك");

              return `
                <tr>
                  <td><b>${f.name}</b></td>
                  <td><span class="chip" style="font-size:11px">${cropBadge}</span></td>
                  <td><span class="status ${f.kind==='عضوي'?'st-ok':f.kind==='مبيد'?'st-bad':'st-sync'}">${f.kind}</span></td>
                  <td>${f.unit}</td>
                  <td><b style="font-size:14px;color:${isLow?'#C62828':'var(--green-d)'}">${stock.toLocaleString()}</b></td>
                  <td><span style="color:#D97706;font-weight:700">${allocated.toLocaleString()}</span></td>
                  <td><span style="color:#2563EB">${consumed.toLocaleString()}</span></td>
                  <td><b>${total.toLocaleString()}</b></td>
                  <td class="muted">${minAlert.toLocaleString()}</td>
                  <td>
                    ${isLow ? `<span class="status st-wait" style="color:#C62828;border-color:#FFCDD2;background:#FFEBEE">⚠️ منخفض</span>` : `<span class="status st-ok">كافٍ وآمن</span>`}
                  </td>
                  ${canManage ? `
                    <td class="row-acts">
                      <button class="btn btn-ghost icon-btn" data-act="quick-supply-fert" data-id="${f.id}" title="توريد شحنة جديدة">+ توريد</button>
                      <button class="btn btn-ghost icon-btn" data-act="quick-issue-fert" data-id="${f.id}" title="صرف عهدة للميدان">صرف للموقع</button>
                      ${canManageItems ? `
                        <button class="btn btn-ghost icon-btn" data-act="edit-fert" data-id="${f.id}" title="تعديل بيانات الصنف">✏️ تعديل</button>
                        <button class="btn btn-ghost icon-btn" data-act="del-fert" data-id="${f.id}" style="color:#DC2626" title="حذف الصنف">🗑️ حذف</button>
                      ` : ''}
                    </td>
                  ` : ''}
                </tr>
              `;
            }).join("") || '<tr><td colspan="11" class="muted" style="text-align:center;padding:24px">لا توجد أسمدة مطابقة للبحث</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderFertVoucherForm(st, u) {
  // Deduplicate fertilizers for the dropdown
  const fertMap = new Map();
  (st.fertilizers || []).forEach(f => {
    if (!f || !f.id) return;
    const baseId = (f.id.startsWith("proj_farafra_01_ft") ? f.id.replace("proj_farafra_01_", "") : f.id).toLowerCase();
    if (!fertMap.has(baseId)) fertMap.set(baseId, f);
  });
  const fertilizers = Array.from(fertMap.values()).filter(f => f.active !== false);

  const sectors = st.sectors || [];
  const isEngineer = u?.role === "engineer";
  const workers = isEngineer 
    ? (st.users || []).filter(usr => usr.role === "worker" && usr.active !== false)
    : (st.users || []).filter(usr => ["worker", "engineer"].includes(usr.role) && usr.active !== false);

  // Sector fertilizer summary for engineer custody
  const secSummary = isEngineer ? getSectorFertilizerSummary(u) : null;
  const custodyFerts = isEngineer 
    ? fertilizers.filter(f => secSummary && secSummary.map[f.id] && secSummary.map[f.id].remaining > 0)
    : fertilizers;

  // Filter available sectors based on initial recipient or logged in engineer
  const initialRecipient = workers[0];
  let availableSectors = sectors;
  let isConstrained = isEngineer;
  const targetUser = isEngineer ? u : initialRecipient;
  if (targetUser && (targetUser.role === "engineer" || targetUser.role === "worker")) {
    const uPlots = (st.userPlots || []).filter(up => up.userId === targetUser.id).map(up => up.plotId);
    const userDirectPlots = targetUser.plots || [];
    const allUserPlotIds = new Set([...uPlots, ...userDirectPlots]);
    if (allUserPlotIds.size > 0) {
      const supSecIds = new Set();
      (st.plots || []).forEach(pl => {
        if (allUserPlotIds.has(pl.id) && pl.sector) supSecIds.add(pl.sector);
      });
      if (supSecIds.size > 0) {
        availableSectors = sectors.filter(s => supSecIds.has(s.id));
        isConstrained = true;
      }
    }
  }

  const formTitle = isEngineer 
    ? "📜 صرف أسمدة / مبيدات من عهدة قطاعات الإشراف إلى الميدان" 
    : "📜 إصدار إذن صرف سماد / مبيد إلى الموقع";

  return `
    <div class="card" style="background:${isEngineer ? '#F0FDF4' : '#FFF9E6'};border:1.5px solid ${isEngineer ? '#16A34A' : '#F59E0B'};margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <h4 style="margin:0;color:${isEngineer ? '#15803D' : 'inherit'}">${formTitle}</h4>
        <button class="btn btn-ghost icon-btn" data-act="tog-fert-voucher">✕ إلغاء</button>
      </div>
      ${isEngineer ? `
        <div style="background:#DCFCE7;color:#166534;padding:8px 12px;border-radius:8px;font-size:12px;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:6px">
          <span>🛡️</span>
          <span>صرف ميداني مباشر من رصيد عهدتك المعتمدة — لا يؤثر على رصيد المستودع الرئيسي.</span>
        </div>
      ` : ''}
      <div class="grid grid-3">
        <div>
          <label>${isEngineer ? 'الصنف المراد صرفه من عهدتك' : 'السماد / المركب المطلوب صرفه'}</label>
          <select id="f_vch_fert">
            ${isEngineer ? (
              custodyFerts.length === 0 
                ? '<option value="">(لا يوجد رصيد عهدة متبقي في قطاعاتك — اطلب صرف عهدة من أمين المستودع)</option>'
                : custodyFerts.map(f => `<option value="${f.id}" ${quickIssueFertId === f.id ? 'selected' : ''}>${f.name} (المتبقي في عهدتك: ${secSummary.map[f.id].remaining} ${f.unit})</option>`).join("")
            ) : (
              fertilizers.length === 0 
                ? '<option value="">(لا توجد أصناف مسجلة بالمستودع)</option>' 
                : fertilizers.map(f => `<option value="${f.id}" ${quickIssueFertId === f.id ? 'selected' : ''}>${f.name} (رصيد المخزن: ${f.stock} ${f.unit})</option>`).join("")
            )}
          </select>
        </div>
        <div>
          <label>الكمية المصروفة</label>
          <input id="f_vch_qty" type="number" min="0.1" step="any" placeholder="${isEngineer ? 'أقصى كمية: رصيد عهدتك' : 'مثال: 500'}" />
        </div>
        <div>
          <label>${isEngineer ? 'العامل / الفني المستلم في الميدان' : 'المستلم المسؤول في الموقع'}</label>
          <select id="f_vch_user" onchange="window._onVoucherRecipientChange?.(this.value)">
            ${workers.map(w => `<option value="${w.id}">${w.name} (${roleLabel(w.role)})</option>`).join("")}
          </select>
        </div>
        <div>
          <label>القطاع المستهدف بالمزرعة</label>
          <select id="f_vch_sec">
            ${!isConstrained ? '<option value="">-- عام لكل المزرعة --</option>' : ''}
            ${availableSectors.map(s => `<option value="${s.id}">${s.name} (${s.id})</option>`).join("")}
          </select>
        </div>
        <div><label>تاريخ الصرف</label><input id="f_vch_date" type="date" value="${new Date().toISOString().slice(0, 10)}" /></div>
        <div><label>الغرض والبيان</label><input id="f_vch_notes" placeholder="مثال: تسميد قطاع 03 دفعة مارس" /></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-primary" data-act="save-fert-voucher" style="${isEngineer ? 'background:#16A34A' : ''}">
          ${isEngineer ? '✓ صرف من العهدة وتسليم الفني' : 'إصدار إذن الصرف وحجز الكمية'}
        </button>
        <button class="btn btn-ghost" data-act="tog-fert-voucher">إلغاء</button>
      </div>
    </div>
  `;
}

function renderFertVouchersTab(st, canManage, u, scope) {
  u = u || session() || {};
  scope = scope || getEffectiveInventoryScope(u);
  const vouchers = st.fertilizerVouchers || [];
  const filter = fertVoucherFilter || "all";
  const canIssueVoucher = (scope === "all" || scope === "sector") && (u?.role === "admin" || u?.role === "warehouse_mgr" || u?.role === "engineer" || hasPerm("fert_voucher_issue"));

  let scopedVouchers = vouchers;
  if (scope === "personal") {
    scopedVouchers = vouchers.filter(v => v.toUser === u.id || v.toUserId === u.id || v.to_user_id === u.id || v.toUser === u.user);
  } else if (scope === "sector") {
    const secSummary = getSectorFertilizerSummary(u);
    scopedVouchers = vouchers.filter(v => (v.toUser === u.id || v.toUserId === u.id || v.to_user_id === u.id || v.toUser === u.user) || (v.sectorId && secSummary.supervisedSectors.has(v.sectorId)));
  }

  const filtered = scopedVouchers.filter(v => {
    const vType = v.type || v.voucherType || v.voucher_type || "issue";
    if (filter === "pending") return v.status === "pending";
    if (filter === "received") return v.status === "received";
    if (filter === "issue") return vType === "issue";
    if (filter === "supply") return vType === "supply";
    return true;
  });

  // Sort vouchers (default: newest to oldest by date)
  filtered.sort((a, b) => {
    let valA, valB;
    if (fertVoucherSortCol === "id") {
      valA = a.id || ""; valB = b.id || "";
    } else if (fertVoucherSortCol === "date") {
      valA = a.date || a.createdAt || ""; valB = b.date || b.createdAt || "";
    } else if (fertVoucherSortCol === "type") {
      valA = a.type || a.voucherType || a.voucher_type || "issue";
      valB = b.type || b.voucherType || b.voucher_type || "issue";
    } else if (fertVoucherSortCol === "fertName") {
      valA = a.fertName || ""; valB = b.fertName || "";
    } else if (fertVoucherSortCol === "qty") {
      valA = Number(a.qty) || 0; valB = Number(b.qty) || 0;
    } else if (fertVoucherSortCol === "from") {
      valA = a.from || ""; valB = b.from || "";
    } else if (fertVoucherSortCol === "toUser") {
      const toUserA = (st.users || []).find(usr => usr.id === a.toUser || usr.user === a.toUser)?.name || a.toUser || "";
      const toUserB = (st.users || []).find(usr => usr.id === b.toUser || usr.user === b.toUser)?.name || b.toUser || "";
      valA = toUserA; valB = toUserB;
    } else if (fertVoucherSortCol === "sector") {
      valA = a.sectorId ? (sectorName(a.sectorId) || a.sectorId) : "";
      valB = b.sectorId ? (sectorName(b.sectorId) || b.sectorId) : "";
    } else if (fertVoucherSortCol === "status") {
      valA = a.status || ""; valB = b.status || "";
    } else {
      valA = a.date || a.createdAt || ""; valB = b.date || b.createdAt || "";
    }

    let cmp = 0;
    if (typeof valA === "number" && typeof valB === "number") {
      cmp = valA - valB;
    } else {
      cmp = String(valA).localeCompare(String(valB), "ar", { numeric: true });
    }
    return fertVoucherSortDir === "desc" ? -cmp : cmp;
  });

  const pendingCount = scopedVouchers.filter(v => v.status === "pending").length;
  const sortIcon = col => (fertVoucherSortCol === col ? (fertVoucherSortDir === 'asc' ? ' <span style="color:var(--green)">▲</span>' : ' <span style="color:var(--green)">▼</span>') : ' <span style="color:#94A3B8;font-size:11px">⇅</span>');

  return `
    <div class="card">
      <div class="actions" style="justify-content:space-between;flex-wrap:wrap">
        <div class="ptabs" style="margin:0">
          <button class="${filter === 'all' ? 'on' : ''}" data-act="filter-vch" data-id="all">${scope === 'personal' ? 'كل أذونات عهدتي' : 'كل الأذونات'} (${scopedVouchers.length})</button>
          <button class="${filter === 'pending' ? 'on' : ''}" data-act="filter-vch" data-id="pending">⏳ بانتظار الاعتماد بالموقع (${pendingCount})</button>
          <button class="${filter === 'received' ? 'on' : ''}" data-act="filter-vch" data-id="received">✅ تم الاستلام بالموقع</button>
          ${scope !== 'personal' ? `<button class="${filter === 'issue' ? 'on' : ''}" data-act="filter-vch" data-id="issue">📦 أذونات الصرف</button>` : ''}
          ${scope === 'all' ? `<button class="${filter === 'supply' ? 'on' : ''}" data-act="filter-vch" data-id="supply">🚛 توريدات المخزن</button>` : ''}
        </div>
        ${canIssueVoucher ? `<button class="btn btn-primary icon-btn" data-act="tog-fert-voucher">+ إذن صرف جديد</button>` : ''}
      </div>

      <div class="grid-wrap" style="margin-top:12px">
        <table class="dense">
          <thead>
            <tr style="background:#F8FAFC;user-select:none">
              <th style="cursor:pointer;white-space:nowrap" data-act="sort-vch" data-id="id" title="ترتيب حسب رقم الإذن">رقم الإذن ${sortIcon('id')}</th>
              <th style="cursor:pointer;white-space:nowrap" data-act="sort-vch" data-id="date" title="ترتيب حسب التاريخ">التاريخ ${sortIcon('date')}</th>
              ${scope !== 'personal' ? `<th style="cursor:pointer;white-space:nowrap" data-act="sort-vch" data-id="type" title="ترتيب حسب النوع">النوع ${sortIcon('type')}</th>` : ''}
              <th style="cursor:pointer;white-space:nowrap" data-act="sort-vch" data-id="fertName" title="ترتيب حسب السماد">المركب / السماد ${sortIcon('fertName')}</th>
              <th style="cursor:pointer;white-space:nowrap" data-act="sort-vch" data-id="qty" title="ترتيب حسب الكمية">الكمية ${sortIcon('qty')}</th>
              <th style="cursor:pointer;white-space:nowrap" data-act="sort-vch" data-id="from" title="ترتيب حسب الجهة المرسلة">الجهة المرسلة ${sortIcon('from')}</th>
              <th style="cursor:pointer;white-space:nowrap" data-act="sort-vch" data-id="toUser" title="ترتيب حسب المستلم">المستلم المسؤول ${sortIcon('toUser')}</th>
              <th style="cursor:pointer;white-space:nowrap" data-act="sort-vch" data-id="sector" title="ترتيب حسب القطاع">القطاع ${sortIcon('sector')}</th>
              <th style="cursor:pointer;white-space:nowrap" data-act="sort-vch" data-id="status" title="ترتيب حسب الحالة">الحالة الميدانية ${sortIcon('status')}</th>
              <th style="text-align:center">إجراء الاعتماد</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(v => {
              const recipientId = v.toUser || v.toUserId || v.to_user_id;
              const toUserObj = (st.users || []).find(usr => usr.id === recipientId || usr.user === recipientId);
              const toUserName = toUserObj ? toUserObj.name : (recipientId || "—");
              const secName = v.sectorId ? (sectorName(v.sectorId) || v.sectorId) : "شامل المزرعة";
              const isPending = v.status === "pending";
              const vType = v.type || v.voucherType || v.voucher_type || "issue";
              let canAccept = false;
              if (isPending) {
                if (vType === "issue") {
                  canAccept = (u.id === recipientId || u.user === recipientId || u.role === "admin");
                } else if (vType === "supply") {
                  canAccept = (u.role === "admin" || u.role === "warehouse_mgr" || hasPerm("fert_supply_add"));
                }
              }

              return `
                <tr>
                  <td><b class="chip" style="font-size:12px">${v.id}</b></td>
                  <td>${v.date || ""}</td>
                  ${scope !== 'personal' ? `
                    <td>
                      ${vType === "supply" ? `<span class="chip" style="background:#E0F2FE;color:#0369A1">🚛 توريد مخزن</span>` : `<span class="chip" style="background:#FEF3C7;color:#92400E">📦 صرف للموقع</span>`}
                    </td>
                  ` : ''}
                  <td><b>${v.fertName}</b></td>
                  <td>
                    <b style="font-size:13px">${v.qty.toLocaleString()} ${v.unit}</b>
                    ${(scope !== 'personal' && v.totalCost) ? `<span style="font-size:11px;color:#15803d;display:block">💰 ${Math.round(v.totalCost).toLocaleString()} ${st.settings?.currency || 'ج.م'}</span>` : ''}
                  </td>
                  <td class="muted">${v.from || "المخزن الرئيسي"}</td>
                  <td><b>${toUserName}</b></td>
                  <td>${secName}</td>
                  <td>
                    ${isPending ? `<span class="status st-wait">⏳ بانتظار الاستلام بالموقع</span>` : v.status === "rejected" ? `<span class="status st-bad">❌ مرفوض ${v.rejectedAt ? `(${fmtDate(v.rejectedAt)})` : ""}</span>` : `<span class="status st-ok">✅ تم الاستلام والاعتماد</span>`}
                  </td>
                  <td class="row-acts">
                    ${canAccept ? `
                      <button class="btn btn-primary icon-btn" data-act="accept-fert-voucher" data-id="${v.id}" title="تأكيد الاستلام بالموقع">استلام ✅</button>
                      <button class="btn btn-ghost icon-btn" data-act="reject-fert-voucher" data-id="${v.id}" style="color:#C62828" title="رفض الإذن">رفض ✕</button>
                    ` : isPending ? `<span class="muted" style="font-size:11px">${v.type === "issue" ? `⏳ بانتظار تأكيد (${toUserName})` : `⏳ بانتظار تأكيد أمين المخزن`}</span>` : `<span class="muted" style="font-size:11px">${v.receivedAt ? `${fmtDate(v.receivedAt)} • ${v.receivedByName || userBy(v.receivedBy)?.name || toUserName}` : "معتمد"}</span>`}
                  </td>
                </tr>
              `;
            }).join("") || `<tr><td colspan="${scope !== 'personal' ? '10' : '9'}" class="muted" style="text-align:center;padding:24px">لا توجد أذونات في هذا التبويب</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderFertConsumptionTab(st, scope, u) {
  u = u || session() || {};
  scope = scope || getEffectiveInventoryScope(u);
  const fertilizers = st.fertilizers || [];
  const operations = st.operations || [];

  let scopedOps = [];
  let summaryMap = {};

  if (scope === "personal") {
    summaryMap = getWorkerFertilizerSummary(u.id);
    scopedOps = operations.filter(o => {
      if (o.workerId !== u.id) return false;
      const t = (st.operationTypes || []).find(ty => ty.id === o.typeId);
      return (t && (t.name.includes("تسميد") || t.requiresMaterial)) || (o.notes && (o.notes.includes("سماد") || o.notes.includes("NPK") || o.notes.includes("كجم") || o.notes.includes("جم")));
    });
  } else if (scope === "sector") {
    const secSummary = getSectorFertilizerSummary(u);
    summaryMap = secSummary.map;
    const assignedPlots = new Set(u.plots || []);
    scopedOps = operations.filter(o => {
      const palm = findPalm(o.palmId || o.palmCode);
      if (assignedPlots.size && palm && !assignedPlots.has(palm.plot)) return false;
      const t = (st.operationTypes || []).find(ty => ty.id === o.typeId);
      return (t && (t.name.includes("تسميد") || t.requiresMaterial)) || (o.notes && (o.notes.includes("سماد") || o.notes.includes("NPK") || o.notes.includes("كجم") || o.notes.includes("جم")));
    });
  } else {
    // scope === 'all'
    scopedOps = operations.filter(o => {
      const t = (st.operationTypes || []).find(ty => ty.id === o.typeId);
      return (t && (t.name.includes("تسميد") || t.requiresMaterial)) || (o.notes && (o.notes.includes("سماد") || o.notes.includes("NPK") || o.notes.includes("كجم") || o.notes.includes("جم")));
    });
  }

  let displayedItems = [];
  if (scope === "personal" || scope === "sector") {
    displayedItems = Object.values(summaryMap).filter(item => item.received > 0 || item.consumed > 0);
  } else {
    displayedItems = fertilizers.map(f => {
      const rate = (Number(f.stock) || 0) + (Number(f.allocated) || 0) + (Number(f.consumed) || 0);
      const consumed = Number(f.consumed) || 0;
      return {
        fert: f,
        consumed,
        totalBase: rate
      };
    });
  }

  return `
    <div class="card">
      <h4 style="margin-top:0">🌾 ${scope === 'personal' ? 'تحليل استهلاكك الميداني من واقع العمليات الزراعية' : scope === 'sector' ? 'تحليل استهلاك قطاعات إشرافك من الأسمدة' : 'تحليل استهلاك الأسمدة بالحقل من واقع العمليات الزراعية'}</h4>
      <p class="muted" style="font-size:13px">
        ${scope === 'personal' 
          ? 'يتم احتساب هذه الكميات تلقائياً عند قيامك بتسجيل عمليات التسميد الميدانية على الأشجار، وتُخصم مباشرة من عهدتك الشخصية المستلمة.'
          : scope === 'sector'
          ? 'يتم احتساب الكميات المنفذة على أشجار قطاعات إشرافك تلقائياً عند تسجيل العمليات الزراعية بواسطة فريق العمل.'
          : 'يتم احتساب هذه الكميات تلقائياً عند تسجيل المهندسين والعمال لعمليات التسميد والمكافحة الفردية أو الجماعية، ويتم خصمها من رصيد العهدة الميدانية والمخازن بدقة متناهية.'}
      </p>

      <div class="grid grid-3" style="margin-bottom:16px">
        ${displayedItems.map(item => {
          const f = item.fert;
          let consumed = 0;
          let rate = 0;
          let percent = 0;
          if (scope === "personal" || scope === "sector") {
            consumed = Math.round(item.consumed * 10) / 10;
            rate = Math.round(item.received * 10) / 10;
            percent = rate > 0 ? Math.min(100, Math.round((consumed / rate) * 100)) : 0;
          } else {
            consumed = item.consumed;
            rate = item.totalBase;
            percent = rate > 0 ? Math.min(100, Math.round((consumed / rate) * 100)) : 0;
          }
          return `
            <div style="background:#F7F3EA;padding:12px;border-radius:12px;border:1px solid var(--line)">
              <div style="display:flex;justify-content:space-between;align-items:flex-start">
                <b>${f.name}</b>
                <span class="chip" style="font-size:11px">${f.unit}</span>
              </div>
              <div style="margin:8px 0">
                <div style="font-size:20px;font-weight:800;color:#2563EB">${consumed.toLocaleString()} <span style="font-size:12px;font-weight:400">${f.unit} مستهلك</span></div>
                <div class="muted" style="font-size:12px">${scope === 'personal' ? 'من إجمالي عهدتك المستلمة' : scope === 'sector' ? 'من عهدة القطاع' : 'من إجمالي متاح ومصروف'}: ${rate.toLocaleString()} ${f.unit} (${percent}%)</div>
              </div>
              <div style="background:#E5E7EB;height:8px;border-radius:999px;overflow:hidden">
                <div style="background:var(--green);height:100%;width:${Math.min(100, percent)}%"></div>
              </div>
            </div>
          `;
        }).join("") || `<div class="muted" style="grid-column:span 3;text-align:center;padding:16px">لا يوجد استهلاك مسجل حتى الآن</div>`}
      </div>

      <h4>سجل أحدث عمليات التسميد المسجلة (${scopedOps.length})</h4>
      <div class="grid-wrap">
        <table class="dense">
          <thead>
            <tr>
              <th>تاريخ العملية</th>
              <th>العملية الزراعية</th>
              <th>الشجرة / الكود</th>
              <th>القطاع / القطعة</th>
              <th>المنفذ</th>
              <th>تفاصيل الجرعة والملاحظات</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${scopedOps.slice(-20).reverse().map(o => {
              const p = palmById(o.palmId);
              const t = (st.operationTypes || []).find(ty => ty.id === o.typeId);
              const w = (st.users || []).find(usr => usr.id === o.workerId);
              const sec = p?.plot ? (st.plots || []).find(pl => pl.id === p.plot)?.sector : "—";

              return `
                <tr>
                  <td>${fmtDate(o.at)}</td>
                  <td><b>${t ? t.name : typeName(o.typeId)}</b></td>
                  <td>${p ? codeHtml(p.code) : "عملية جماعية"}</td>
                  <td>${sec ? sectorName(sec) : "—"} / ${p?.plot || "—"}</td>
                  <td>${w ? w.name : (o.workerId || "—")}</td>
                  <td>${o.notes || "—"}</td>
                  <td><span class="status ${o.approval==='approved'?'st-ok':'st-wait'}">${o.approval==='approved'?'معتمدة':'قيد الاعتماد'}</span></td>
                </tr>
              `;
            }).join("") || '<tr><td colspan="7" class="muted" style="text-align:center;padding:20px">لا توجد عمليات تسميد مسجلة حتى الآن</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ============================================================================
// AUDIT LOG VIEW & STATE
// ============================================================================
let audSearch = "";
let audUser = "all";
let audModule = "all";
let audAction = "all";
let audPeriod = "all";
let audCompany = "all";
let audProject = "all";
let audPage = 1;
let audPageSize = (typeof localStorage !== "undefined" && parseInt(localStorage.getItem("audPageSize"), 10)) || 50;
let activeAuditDetailId = null;
let showAuditCleanModal = false;

function auditView() {
  const s = session();
  if (!s || (s.role !== "admin" && !hasPerm("audit_view") && !hasPerm("settings"))) {
    return `<div class="card" style="text-align:center;padding:40px">
      <h3>⚠️ غير مصرح</h3>
      <p class="muted">ليس لديك صلاحية لاستعراض سجل التدقيق والرقابة.</p>
      <button class="btn btn-primary" data-act="back">رجوع</button>
    </div>`;
  }

  const st = Store.get();
  const users = st.users || [];
  const companies = st.companies || [];
  const projects = st.projects || [];
  const isSuperAdmin = Boolean(s.isSuperAdmin === true || s.role === "super_admin");

  const stats = (typeof AuditLog !== "undefined") ? AuditLog.getStats({ companyId: audCompany, projectId: audProject }) : { total: 0, todayCount: 0, sensitiveCount: 0, topUser: "—" };

  const res = (typeof AuditLog !== "undefined") ? AuditLog.query({
    search: audSearch,
    user: audUser,
    module: audModule,
    action: audAction,
    period: audPeriod,
    companyId: audCompany,
    projectId: audProject,
    page: audPage,
    pageSize: audPageSize
  }) : { total: 0, page: 1, pageSize: 50, totalPages: 1, items: [] };

  const activeDetail = activeAuditDetailId && (typeof AuditLog !== "undefined") ? AuditLog.getRecordById(activeAuditDetailId) : null;

  // Detail Modal
  const detailModal = activeDetail ? `
    <div class="modal" id="audDetailModal" style="display:flex;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.65);z-index:9999;align-items:center;justify-content:center;padding:16px">
      <div class="modal-box card" style="max-width:600px;width:100%;max-height:85vh;overflow-y:auto;border:2px solid var(--green-d)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid var(--line);padding-bottom:8px">
          <h3 style="margin:0;color:var(--green-d)">🔍 تفاصيل الحركة الرقابية</h3>
          <button class="btn btn-ghost icon-btn" data-act="aud-close-detail" style="padding:4px 8px">✕</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px;margin-bottom:14px">
          <div><b>معرف السجل:</b> <span class="code-chip">${activeDetail.id}</span></div>
          <div><b>التوقيت:</b> <span style="direction:ltr;display:inline-block">${new Date(activeDetail.at).toLocaleString("ar-EG")}</span></div>
          <div><b>المستخدم:</b> ${activeDetail.userName} (@${activeDetail.user})</div>
          <div><b>الدور الوظيفي:</b> ${roleLabel(activeDetail.role)}</div>
          <div><b>القسم / الموديول:</b> ${activeDetail.moduleName || activeDetail.module}</div>
          <div><b>نوع الإجراء:</b> <span class="badge badge-${activeDetail.severity}">${activeDetail.actionLabel || activeDetail.action}</span></div>
          <div><b>الأصول المتأثرة:</b> <b>${activeDetail.targetCount || 1}</b></div>
          <div><b>النطاق:</b> ${activeDetail.targetScope || "—"}</div>
        </div>
        <div style="background:var(--card);border:1px solid var(--line);padding:10px;border-radius:6px;margin-bottom:12px;font-size:13.5px;line-height:1.6">
          <b>نص البيان والملخص:</b><br>${escapeHtml(translateAuditText(activeDetail.summary))}
        </div>
        ${activeDetail.device ? `<div class="muted" style="font-size:11.5px;margin-bottom:10px">الجهاز والمتصفح: ${activeDetail.device}</div>` : ""}
        ${activeDetail.details ? `
          <div style="margin-top:10px">
            <b>البيانات الفنية التفصيلية:</b>
            <pre style="background:#1e1e1e;color:#d4d4d4;padding:10px;border-radius:6px;font-size:11.5px;direction:ltr;text-align:left;max-height:200px;overflow-y:auto">${JSON.stringify(activeDetail.details, null, 2)}</pre>
          </div>
        ` : ""}
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;flex-wrap:wrap;gap:8px">
          <div>
            ${(s.role === "admin" && !activeDetail.reverted && activeDetail.action !== "reversal" && (activeDetail.action === "create" || activeDetail.action === "delete" || activeDetail.action === "update" || activeDetail.action === "bulk_insert" || activeDetail.action === "add")) ? `
              <button class="btn btn-orange" data-act="aud-prompt-revert" data-id="${activeDetail.id}">↩️ إجراء قيد عكسي (تراجع)</button>
            ` : ""}
          </div>
          <button class="btn btn-primary" data-act="aud-close-detail">إغلاق</button>
        </div>
      </div>
    </div>
  ` : "";

  // Revert Modal (Compensating Reversal)
  const revertModal = showAuditRevertModal && revertTargetRecordId ? (() => {
    const targetRec = (typeof AuditLog !== "undefined") ? AuditLog.getRecordById(revertTargetRecordId) : null;
    if (!targetRec) return "";
    return `
      <div class="modal" id="audRevertModal" style="display:flex;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.65);z-index:10000;align-items:center;justify-content:center;padding:16px">
        <div class="modal-box card" style="max-width:480px;width:100%;border:2px solid #d97706">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid var(--line);padding-bottom:8px">
            <h3 style="margin:0;color:#b45309">↩️ تأكيد القيد العكسي والتراجع</h3>
            <button class="btn btn-ghost icon-btn" data-act="aud-close-revert" style="padding:4px 8px">✕</button>
          </div>
          <p style="font-size:13px;line-height:1.6;margin-bottom:12px">
            وفقاً لمعايير الحوكمة والرقابة المعتمدة، لن يتم مسح الحركة الأصلية، بل سيتم تسجيل <b>قيد عكسي تعويضي (Compensating Reversal)</b> وتوثيق التراجع في السجل مع إلغاء أثر العملية على البيانات فورياً.
          </p>
          <div style="background:#fef3c7;border:1px solid #fde68a;padding:10px;border-radius:6px;margin-bottom:12px;font-size:12.5px;color:#92400e">
            <b>الإجراء المستهدف:</b> #${targetRec.id} — ${escapeHtml(translateAuditText(targetRec.summary))}
          </div>
          <label style="font-weight:bold;font-size:12.5px">سبب التراجع / القيد العكسي (إلزامي للرقابة) *:</label>
          <textarea id="aud_revert_reason" rows="3" placeholder="أدخل المبرر الإداري أو سبب الخطأ للتراجع المعتمد..." style="width:100%;box-sizing:border-box;margin-top:4px;margin-bottom:14px;padding:8px;font-size:12.5px;border-radius:6px;border:1.5px solid var(--line)"></textarea>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button class="btn btn-ghost" data-act="aud-close-revert">إلغاء</button>
            <button class="btn btn-orange" data-act="aud-exec-revert" data-id="${targetRec.id}">تأكيد القيد العكسي ↩️</button>
          </div>
        </div>
      </div>
    `;
  })() : "";

  // Clean Modal
  const cleanModal = showAuditCleanModal ? `
    <div class="modal" id="audCleanModal" style="display:flex;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.65);z-index:9999;align-items:center;justify-content:center;padding:16px">
      <div class="modal-box card" style="max-width:440px;width:100%;border:2px solid var(--orange)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid var(--line);padding-bottom:8px">
          <h3 style="margin:0;color:var(--orange)">🧹 أرشفة وتنظيف السجلات القديمة</h3>
          <button class="btn btn-ghost icon-btn" data-act="aud-close-clean" style="padding:4px 8px">✕</button>
        </div>
        <p style="font-size:13px;line-height:1.6">
          لحفظ مساحة التخزين، يمكنك أرشفة وحذف السجلات القديمة مع الإبقاء على أحدث الحركات.<br>
          <span class="muted" style="font-size:12px">💡 يُنصح بتصدير نسخة CSV أولاً قبل التنظيف.</span>
        </p>
        <label style="font-weight:bold">الاحتفاظ ببيانات آخر:</label>
        <select id="aud_clean_days" style="margin-bottom:14px">
          <option value="30">30 يوماً الأخيرة (حذف الأقدم)</option>
          <option value="60">60 يوماً الأخيرة (حذف الأقدم)</option>
          <option value="90">90 يوماً الأخيرة (حذف الأقدم)</option>
        </select>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-ghost" data-act="aud-close-clean">إلغاء</button>
          <button class="btn btn-orange" data-act="aud-exec-clean">تنفيذ التنظيف الآن</button>
        </div>
      </div>
    </div>
  ` : "";

  // Stats cards HTML
  const statsHtml = `
    <div class="grid grid-4" style="margin-bottom:16px">
      <div class="card stat-card" style="border-right:4px solid var(--green)">
        <div class="muted" style="font-size:12px">إجمالي الحركات المسجلة</div>
        <div style="font-size:22px;font-weight:bold;color:var(--green-d)">${stats.total}</div>
        <div style="font-size:11px;color:var(--muted)">سجل محفوظ محلياً</div>
      </div>
      <div class="card stat-card" style="border-right:4px solid var(--blue)">
        <div class="muted" style="font-size:12px">حركات اليوم</div>
        <div style="font-size:22px;font-weight:bold;color:var(--blue)">${stats.todayCount}</div>
        <div style="font-size:11px;color:var(--muted)">إجراء تم تنفيذه اليوم</div>
      </div>
      <div class="card stat-card" style="border-right:4px solid var(--err)">
        <div class="muted" style="font-size:12px">حركات حساسة (حذف / أرشفة)</div>
        <div style="font-size:22px;font-weight:bold;color:var(--err)">${stats.sensitiveCount}</div>
        <div style="font-size:11px;color:var(--muted)">تتطلب رقابة إدارية</div>
      </div>
      <div class="card stat-card" style="border-right:4px solid var(--orange)">
        <div class="muted" style="font-size:12px">المستخدم الأكثر نشاطاً</div>
        <div style="font-size:16px;font-weight:bold;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${stats.topUser}</div>
        <div style="font-size:11px;color:var(--muted)">حسب عدد الإجراءات</div>
      </div>
    </div>
  `;

  // Multi-tenant Filter Selectors for Super Admin or scoped badge for managers
  const tenantFilterHtml = isSuperAdmin ? `
    <select id="aud_company" data-act="aud-company-change" style="width:auto;font-weight:bold;color:var(--primary, #2e7d32);border:1.5px solid var(--primary, #2e7d32)">
      <option value="all" ${audCompany==="all"?"selected":""}>🏢 كافة الشركات (شامل)</option>
      ${companies.map(c => `<option value="${c.id}" ${audCompany===c.id?"selected":""}>🏢 ${escapeHtml(c.tradeName || c.name)}</option>`).join("")}
    </select>

    <select id="aud_project" data-act="aud-project-change" style="width:auto;font-weight:bold;color:#1565C0;border:1.5px solid #1565C0">
      <option value="all" ${audProject==="all"?"selected":""}>🌾 كافة المزارع والمشاريع</option>
      ${(audCompany === "all" ? projects : projects.filter(p => (p.companyId || p.company_id) === audCompany)).map(p => `<option value="${p.id}" ${audProject===p.id?"selected":""}>🌾 ${escapeHtml(p.name)}</option>`).join("")}
    </select>
  ` : `
    <span class="badge" style="background:#e0f2fe;color:#0369a1;padding:6px 12px;border-radius:8px;font-size:12px">
      🏢 ${escapeHtml((companies.find(c => c.id === st.activeCompanyId) || {}).name || "الشركة")}
    </span>
  `;

  // Filter bar
  const filterHtml = `
    <div class="card" style="margin-bottom:14px;padding:12px">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        ${tenantFilterHtml}
        <input id="aud_search" data-act="aud-search" value="${audSearch}" placeholder="🔍 بحث بالبيان، الكود، المستخدم، المعرف..." style="flex:1;min-width:200px" />
        
        <select id="aud_user" data-act="aud-user-change" style="width:auto">
          <option value="all" ${audUser==="all"?"selected":""}>👤 كافة المستخدمين</option>
          ${users.map(u => `<option value="${u.user}" ${audUser===u.user?"selected":""}>${u.name} (@${u.user})</option>`).join("")}
        </select>

        <select id="aud_module" data-act="aud-module-change" style="width:auto">
          <option value="all" ${audModule==="all"?"selected":""}>📁 كافة الأقسام</option>
          <option value="palms" ${audModule==="palms"?"selected":""}>🌴 الأشجار والحقل</option>
          <option value="ops" ${audModule==="ops"?"selected":""}>⚙️ العمليات الزراعية</option>
          <option value="yields" ${audModule==="yields"?"selected":""}>🌾 المحصول والإنتاج</option>
          <option value="fertilizers" ${audModule==="fertilizers"?"selected":""}>📦 الأسمدة والمخزون</option>
          <option value="nursery" ${audModule==="nursery"?"selected":""}>🌱 المشتل والتكاثر</option>
          <option value="zakat" ${audModule==="zakat"?"selected":""}>⚖️ حساب الزكاة</option>
          <option value="users" ${audModule==="users"?"selected":""}>👥 المستخدمون والصلاحيات</option>
          <option value="auth" ${audModule==="auth"?"selected":""}>🔐 الأمان والدخول</option>
          <option value="settings" ${audModule==="settings"?"selected":""}>⚙️ إعدادات النظام</option>
        </select>

        <select id="aud_action" data-act="aud-action-change" style="width:auto">
          <option value="all" ${audAction==="all"?"selected":""}>🎯 كافة أنواع الإجراءات</option>
          <option value="bulk" ${audAction==="bulk"?"selected":""}>👥 العمليات الجماعية فقط</option>
          <option value="create" ${audAction==="create"?"selected":""}>➕ الإضافة والإنشاء</option>
          <option value="update" ${audAction==="update"?"selected":""}>✏️ التعديل والتحديث</option>
          <option value="delete" ${audAction==="delete"?"selected":""}>🗑️ الحذف</option>
          <option value="archive" ${audAction==="archive"?"selected":""}>📦 الأرشفة</option>
          <option value="approve" ${audAction==="approve"?"selected":""}>✅ الاعتماد الرسمي</option>
          <option value="reject" ${audAction==="reject"?"selected":""}>❌ الرفض</option>
          <option value="login" ${audAction==="login"?"selected":""}>🔓 تسجيل الدخول</option>
          <option value="login_failed" ${audAction==="login_failed"?"selected":""}>⚠️ فشل الدخول</option>
        </select>

        <select id="aud_period" data-act="aud-period-change" style="width:auto">
          <option value="all" ${audPeriod==="all"?"selected":""}>🕒 كل الفترات</option>
          <option value="today" ${audPeriod==="today"?"selected":""}>📅 اليوم فقط</option>
          <option value="week" ${audPeriod==="week"?"selected":""}>🗓️ آخر 7 أيام</option>
          <option value="month" ${audPeriod==="month"?"selected":""}>📆 هذا الشهر</option>
        </select>

        ${(audSearch || audUser !== "all" || audModule !== "all" || audAction !== "all" || audPeriod !== "all" || audCompany !== "all" || audProject !== "all") ? `
          <button class="btn btn-ghost" data-act="aud-clear-filters" style="font-size:12px;padding:4px 8px">إلغاء التصفية ✕</button>
        ` : ""}
      </div>
    </div>
  `;

  // Rows rendering
  const rows = res.items.map(it => {
    const timeStr = fmtTime(it.at);
    const dateStr = fmtDate(it.at);
    const badgeClass = it.severity === "danger" ? "badge badge-danger" : (it.severity === "warning" ? "badge badge-warning" : (it.severity === "primary" ? "badge badge-primary" : "badge badge-success"));
    const isBulk = it.targetCount > 1 || it.action.startsWith("bulk_");
    const isReversal = it.action === "reversal";
    const canRevert = s.role === "admin" && !it.reverted && !isReversal && (it.action === "create" || it.action === "delete" || it.action === "update" || it.action === "bulk_insert" || it.action === "add");

    return `<tr>
      <td>
        <b>${dateStr}</b><br>
        <span class="muted" style="direction:ltr;font-size:11px">${timeStr}</span>
      </td>
      <td>
        <b>${escapeHtml(it.userName || it.user)}</b><br>
        <span class="muted" style="font-size:11px">@${escapeHtml(it.user)} • ${roleLabel(it.role)}</span>
      </td>
      <td>${escapeHtml(it.moduleName || it.module)}</td>
      <td>
        <span class="${badgeClass}">${escapeHtml(it.actionLabel || it.action)}</span>
        ${it.reverted ? `<div style="margin-top:3px"><span class="badge-reversal">تم التراجع</span></div>` : ""}
        ${isReversal ? `<div style="margin-top:3px"><span class="badge-reversal">قيد عكسي</span></div>` : ""}
        ${isBulk ? `<div style="margin-top:3px"><span class="chip" style="font-size:10px;font-weight:bold;background:var(--green-l);color:var(--green-d)">جماعي (${it.targetCount})</span></div>` : ""}
      </td>
      <td style="line-height:1.4">
        ${escapeHtml(translateAuditText(it.summary))}
        ${it.targetScope ? `<div class="muted" style="font-size:11px">النطاق: <b>${escapeHtml(it.targetScope)}</b></div>` : ""}
      </td>
      <td style="text-align:center">
        ${it.targetId ? `<span class="code-chip" style="font-size:11px">${escapeHtml(it.targetId)}</span>` : (it.targetCount > 1 ? `<b>${it.targetCount} أصل</b>` : "—")}
      </td>
      <td style="text-align:center">
        <div style="display:flex;gap:4px;justify-content:center;align-items:center;flex-wrap:wrap">
          <button class="btn btn-ghost btn-compact btn-icon-only" data-act="aud-show-detail" data-id="${it.id}" title="عرض التفاصيل">🔍</button>
          ${canRevert ? `
            <button class="btn btn-ghost btn-compact btn-icon-only" data-act="aud-prompt-revert" data-id="${it.id}" style="color:#d97706" title="إجراء قيد عكسي / تراجع">↩️</button>
          ` : ""}
        </div>
      </td>
    </tr>`;
  }).join("") || `<tr><td colspan="7" class="muted" style="text-align:center;padding:30px">لا توجد حركات مطابقة لشروط البحث والتصفية</td></tr>`;

  return `
    ${detailModal}
    ${cleanModal}
    ${revertModal}
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div>
        <h2 style="margin:0;color:var(--green-d)">📜 سجل التدقيق والرقابة (Audit Log)</h2>
        <div class="muted" style="font-size:12.5px">رقابة وتتبع كافة الأنشطة، الإضافات، التعديلات، والحركات الميدانية والإدارية</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button class="btn btn-ghost icon-btn" data-act="aud-export-csv" title="تصدير السجل المفلتر بالكامل إلى ملف CSV متوافق مع Excel">📊 تصدير السجل (CSV)</button>
        ${s.role === "admin" ? `<button class="btn btn-ghost icon-btn" data-act="aud-clean-modal" title="تنظيف وأرشفة السجلات القديمة">🧹 أرشفة وتنظيف</button>` : ""}
        <button class="btn btn-ghost icon-btn" data-act="aud-refresh" title="تحديث السجل">🔄 تحديث</button>
      </div>
    </div>

    ${statsHtml}
    ${filterHtml}

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">
        <div class="muted" style="font-size:13px">
          إجمالي النتائج: <b>${res.total}</b> حركة مسجلة (صفحة ${res.page} من ${res.totalPages})
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span class="muted" style="font-size:12px">عرض في الصفحة:</span>
          <select id="aud_pagesize" data-act="aud-pagesize-change" style="width:auto;padding:3px 8px;font-size:12px;border-radius:6px">
            <option value="20" ${audPageSize===20?"selected":""}>20 حركة</option>
            <option value="50" ${audPageSize===50?"selected":""}>50 حركة</option>
            <option value="100" ${audPageSize===100?"selected":""}>100 حركة</option>
            <option value="200" ${audPageSize===200?"selected":""}>200 حركة</option>
          </select>
        </div>
      </div>

      <div class="audit-table-wrap">
        <table id="audit_table">
          <thead>
            <tr>
              <th style="width:12%">التاريخ والوقت</th>
              <th style="width:14%">المستخدم</th>
              <th style="width:11%">القسم</th>
              <th style="width:13%">نوع الإجراء</th>
              <th style="width:36%">البيان والتفاصيل</th>
              <th style="width:7%;text-align:center">الهدف</th>
              <th style="width:7%;text-align:center">إجراء</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      ${pager(res.total, audPage, "aud-page")}
    </div>
  `;
}

function renderContractTemplatesView() {
  const st = Store.get();
  const templates = st.contractTemplates || [];
  
  return `
    <div class="card" style="padding:20px;border-radius:14px;box-shadow:var(--shadow)">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid var(--line)">
        <div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:22px">📜</span>
            <h3 style="margin:0;font-size:18px;font-weight:800;color:var(--text)">قوالب التعاقدات المالية وتوزيع المحصول</h3>
          </div>
          <div class="muted" style="font-size:12.5px;margin-top:4px">
            إدارة نماذج الشراكة، نسبة الشركة من المحصول، رسوم خدمة الفدان السنوية، والفوترة الآلية
          </div>
        </div>
        <button class="btn btn-primary" data-act="open-contract-tpl-modal" style="font-weight:700;display:inline-flex;align-items:center;gap:6px">
          <span>+</span> إضافة نموذج تعاقد جديد
        </button>
      </div>

      <div class="grid grid-2" style="gap:16px;margin-bottom:18px">
        ${templates.length === 0 ? `
          <div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--muted)">
            لا توجد قوالب تعاقدات مسجلة حالياً. اضغط «إضافة نموذج تعاقد جديد» للبدء.
          </div>
        ` : templates.map(tpl => {
          const compShare = Number(tpl.default_company_share_pct || 0);
          const feePerAcre = Number(tpl.default_annual_fee_per_acre || 0);
          const zakatRate = 5.0;
          const invNetWithZakat = Math.max(0, 100 - compShare - zakatRate);
          const invNetWithoutZakat = Math.max(0, 100 - compShare);

          return `
            <div class="card" style="border:1.5px solid ${tpl.is_active ? '#BAE6FD' : '#E2E8F0'};border-radius:12px;padding:16px;background:${tpl.is_active ? '#F8FAFC' : '#F1F5F9'};display:flex;flex-direction:column;justify-content:space-between">
              <div>
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
                  <div>
                    <span class="chip" style="font-size:11px;font-family:monospace;background:#E0F2FE;color:#0369A1;font-weight:bold">${escapeHtml(tpl.code || '')}</span>
                    <h4 style="margin:6px 0 2px;font-size:16px;color:#0F172A">${escapeHtml(tpl.name_ar || '')}</h4>
                  </div>
                  <span class="badge ${tpl.is_active ? 'badge-ok' : 'badge-warn'}" style="font-size:11px">
                    ${tpl.is_active ? '✅ مفعّل' : 'معطل'}
                  </span>
                </div>
                <p class="muted" style="font-size:12.5px;margin:0 0 14px;line-height:1.5">
                  ${escapeHtml(tpl.description || 'لا يوجد وصف')}
                </p>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#fff;border:1px solid #E2E8F0;border-radius:10px;padding:10px;margin-bottom:12px">
                  <div>
                    <div class="muted" style="font-size:11px">حصة الشركة من المحصول</div>
                    <div style="font-size:15px;font-weight:800;color:#0369A1">% ${compShare}</div>
                  </div>
                  <div>
                    <div class="muted" style="font-size:11px">تكلفة خدمة الفدان / سنة</div>
                    <div style="font-size:15px;font-weight:800;color:${feePerAcre > 0 ? '#B45309' : '#64748B'}">
                      ${feePerAcre > 0 ? `${feePerAcre.toLocaleString()} ج.م` : '0 ج.م (لا يوجد)'}
                    </div>
                  </div>
                  <div>
                    <div class="muted" style="font-size:11px">صافي المستثمر (مع الزكاة 5%)</div>
                    <div style="font-size:14px;font-weight:700;color:#16A34A">% ${invNetWithZakat}</div>
                  </div>
                  <div>
                    <div class="muted" style="font-size:11px">صافي المستثمر (بدون تفويض)</div>
                    <div style="font-size:14px;font-weight:700;color:#047857">% ${invNetWithoutZakat}</div>
                  </div>
                </div>

                <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
                  <span class="chip" style="font-size:11px;background:${tpl.requires_area_billing ? '#FEF3C7' : '#EFF6FF'};color:${tpl.requires_area_billing ? '#92400E' : '#1E40AF'}">
                    ${tpl.requires_area_billing ? '📐 فوترة مساحية آلية' : '🌾 مشاركة محصول فقط'}
                  </span>
                  <span class="chip" style="font-size:11px;background:#ECFDF5;color:#065F46">
                    ⚖️ تفويض الزكاة الشرعي 5%
                  </span>
                </div>
              </div>

              <div style="display:flex;justify-content:flex-end;gap:8px;border-top:1px solid #E2E8F0;padding-top:12px;margin-top:8px">
                <button class="btn btn-ghost btn-sm" data-act="edit-contract-tpl" data-id="${tpl.id}" style="border:1px solid #CBD5E1;font-weight:700">
                  ✏️ تعديل القالب
                </button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderContractTemplateModal() {
  if (!showContractTplModal) return "";
  const st = Store.get();
  const tpl = (st.contractTemplates || []).find(x => x.id === editingContractTplId) || {};
  const isEdit = !!tpl.id;

  return `
    <div class="modal-backdrop" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(15,23,42,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)">
      <div class="card" style="width:100%;max-width:540px;background:#fff;border-radius:14px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);border:1px solid #E2E8F0;padding:22px;direction:rtl;text-align:right">
        
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:1px solid #F1F5F9;padding-bottom:10px">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:20px">📜</span>
            <h3 style="margin:0;font-size:16.5px;color:#0F172A">${isEdit ? `تعديل قالب: ${escapeHtml(tpl.name_ar || '')}` : 'إضافة قالب تعاقدي مالي جديد'}</h3>
          </div>
          <button class="icon-btn" data-act="close-contract-tpl-modal" style="font-size:16px;background:none;border:none;cursor:pointer">✕</button>
        </div>

        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="grid grid-2" style="gap:10px">
            <div>
              <label class="label" style="font-weight:700;font-size:12px;margin-bottom:3px;display:block">كود / رمز النموذج (Code):</label>
              <input type="text" id="tpl_code" class="input" value="${escapeHtml(tpl.code || '')}" placeholder="مثال: MODEL_C" style="width:100%;box-sizing:border-box" ${isEdit ? 'readonly style="background:#F1F5F9"' : ''} />
            </div>
            <div>
              <label class="label" style="font-weight:700;font-size:12px;margin-bottom:3px;display:block">الاسم العربي للنموذج:</label>
              <input type="text" id="tpl_name_ar" class="input" value="${escapeHtml(tpl.name_ar || '')}" placeholder="مثال: عقد إشراف وتسويق" style="width:100%;box-sizing:border-box" />
            </div>
          </div>

          <div>
            <label class="label" style="font-weight:700;font-size:12px;margin-bottom:3px;display:block">وصف النموذج وشروط الاستثمار:</label>
            <textarea id="tpl_desc" class="input" rows="2" placeholder="وصف موجز لبنود التعاقد والمصروفات..." style="width:100%;box-sizing:border-box">${escapeHtml(tpl.description || '')}</textarea>
          </div>

          <div class="grid grid-2" style="gap:10px">
            <div>
              <label class="label" style="font-weight:700;font-size:12px;margin-bottom:3px;display:block">نسبة الشركة الافتراضية (%):</label>
              <input type="number" step="0.5" id="tpl_company_share" class="input" value="${tpl.default_company_share_pct ?? 25.0}" style="width:100%;box-sizing:border-box" />
            </div>
            <div>
              <label class="label" style="font-weight:700;font-size:12px;margin-bottom:3px;display:block">رسم خدمة الفدان السنوي (ج.م):</label>
              <input type="number" step="500" id="tpl_fee_acre" class="input" value="${tpl.default_annual_fee_per_acre ?? 0}" style="width:100%;box-sizing:border-box" />
            </div>
          </div>

          <div class="grid grid-2" style="gap:10px">
            <div>
              <label class="label" style="font-weight:700;font-size:12px;margin-bottom:3px;display:block">الفوترة المساحية الآلية:</label>
              <select id="tpl_requires_billing" class="input" style="width:100%;box-sizing:border-box">
                <option value="0" ${!tpl.requires_area_billing ? 'selected' : ''}>لا — مشاركة محصول فقط</option>
                <option value="1" ${tpl.requires_area_billing ? 'selected' : ''}>نعم — توليد فواتير سنوية حسب المساحة</option>
              </select>
            </div>
            <div>
              <label class="label" style="font-weight:700;font-size:12px;margin-bottom:3px;display:block">حالة القالب:</label>
              <select id="tpl_is_active" class="input" style="width:100%;box-sizing:border-box">
                <option value="1" ${tpl.is_active !== 0 ? 'selected' : ''}>✅ مفعّل ونشط</option>
                <option value="0" ${tpl.is_active === 0 ? 'selected' : ''}>⛔ معطل مؤقتاً</option>
              </select>
            </div>
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px;border-top:1px solid #F1F5F9;padding-top:12px">
          <button class="btn btn-ghost" data-act="close-contract-tpl-modal">إلغاء</button>
          <button class="btn btn-primary" data-act="save-contract-tpl" data-id="${tpl.id || ''}" style="font-weight:700">💾 حفظ القالب</button>
        </div>
      </div>
    </div>
  `;
}

