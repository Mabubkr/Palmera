// PalmTrace app — Users, permissions matrix, scope assignment, roles, import view
// (split from the former single app.js; files are classic scripts loaded in order by index.html)

let asgUserId = "";
let mapQ = "", mapSec = "", mapPlot = "", mapVar = "", mapSt = "", mapCrop = "";
let showPlotImportModal = false;
let showInvestorImportModal = false;
let showSeedlingImportModal = false;
let parsedSeedlingsData = [];
let selectedSeedlingsFileName = "";
let invTab = "map";
let invPalmQ = "", invVarF = "", invSecF = "";
const crudScreens = [
  ["palms","النخيل والحقل"],["gis","الخريطة ونظام GIS"],["ops","العمليات والخدمات"],["nursery","المشتل والإكثار"],
  ["fertilizers","الأسمدة والمخزون"],["yields","المحصول والحصاد"],["reports","التقارير والمؤشرات"],
  ["zakat","حسابات الزكاة"],["farmers","المزارعون والعقود"],["users","المستخدمون والفرق"],["settings","الإعدادات العامة"],
  ["ai","الزراعة الذكية (Agri-AI)"]
];

function mxChecked(role, screen, key) {
  if (!role) return false;
  if ((role.perms || []).includes("all")) return true;
  const m = role.matrix && role.matrix[screen];
  if (m) return m.includes(key);
  const map = { palms:"palms", ops:"ops", nursery:"nursery", fertilizers:"fertilizers", yields:"yields", reports:"reports", zakat:"zakat", farmers:"farmers", users:"users", settings:"settings" };
  if (key === "r") return (role.perms || []).includes(map[screen]) || (role.perms || []).includes(screen);
  if (key === "a") return screen === "ops" && (role.perms || []).includes("approve");
  return false;
}

function updatePermActiveBadges() {
  $$(".perm-module-card").forEach(card => {
    const mod = card.dataset.module;
    if (!mod) return;
    const cbs = $$(`.rmx-user[data-s="${mod}"]`);
    const checked = cbs.filter(c => c.checked).length;
    const badge = card.querySelector(".perm-active-count");
    if (badge) {
      badge.textContent = `${checked}/${cbs.length} صلاحيات نشطة`;
    }
  });
}
window.updatePermActiveBadges = updatePermActiveBadges;

function userMatrixTableHtml(u, defaultRoleId) {
  const st = Store.get();
  const me = session();
  const isEng = me && me.role === "engineer";
  const curRoleId = (u ? u.role : defaultRoleId) || (isEng ? "worker" : (st.roles[0]?.id || "worker"));
  const role = st.roles.find(r => r.id === curRoleId);

  const isPermActive = (mod, key, pId) => {
    if (u && u.customPerms && Array.isArray(u.customPerms)) {
      return u.customPerms.includes(pId);
    }
    if (u && u.matrix && u.matrix[mod] !== undefined) {
      return u.matrix[mod].includes(key);
    }
    return mxChecked(role, mod, key);
  };

  return `
    <div class="card" style="margin-bottom:12px;padding:16px;border-radius:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
        <div>
          <h4 style="margin:0;font-size:15px;color:var(--text);font-weight:800;display:flex;align-items:center;gap:6px">
            <span>🛡️</span> مصفوفة الصلاحيات المتقدمة
          </h4>
          <div class="muted" style="font-size:11.5px;margin-top:2px">حدد الصلاحيات بدقة أو استخدم القوالب السريعة المعدة مسبقاً</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button type="button" class="btn btn-ghost" style="padding:4px 10px;font-size:11.5px" data-act="expand-all-perm-modules">📂 فتح كل الأقسام</button>
          <button type="button" class="btn btn-ghost" style="padding:4px 10px;font-size:11.5px" data-act="collapse-all-perm-modules">📁 طي كل الأقسام</button>
        </div>
      </div>

      <!-- Quick Preset Buttons -->
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 14px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;margin-bottom:16px">
        <span style="font-size:12px;font-weight:800;color:#334155;display:inline-flex;align-items:center;gap:4px">⚡ قوالب الصلاحيات السريعة:</span>
        <button type="button" class="btn btn-ghost" style="padding:4px 12px;font-size:12px;border:1.5px solid #86EFAC;background:#F0FDF4;color:#166534;font-weight:700" data-act="apply-preset-worker">🚜 صلاحيات العامل الميداني</button>
        <button type="button" class="btn btn-ghost" style="padding:4px 12px;font-size:12px;border:1.5px solid #93C5FD;background:#EFF6FF;color:#1E40AF;font-weight:700" data-act="apply-preset-engineer">📐 صلاحيات المهندس المشرف</button>
        ${!isEng ? `
          <button type="button" class="btn btn-ghost" style="padding:4px 12px;font-size:12px;border:1.5px solid #FDE68A;background:#FEF3C7;color:#92400E;font-weight:700" data-act="user-mx-select-all">👑 صلاحيات إدارة كاملة</button>
        ` : ''}
        <button type="button" class="btn btn-ghost" style="padding:4px 12px;font-size:12px;border:1.5px solid #CBD5E1;background:#fff;color:#475569" data-act="reset-user-mx" data-id="${curRoleId}">🔄 استعادة الافتراضي (${role?.name || curRoleId})</button>
        <button type="button" class="btn btn-ghost" style="padding:4px 12px;font-size:12px;border:1.5px solid #FCA5A5;background:#FEF2F2;color:#991B1B" data-act="user-mx-clear-all">🧹 مسح الكل</button>
      </div>

      <!-- Collapsible Module Accordion Cards -->
      <div class="perm-modules-container" style="display:flex;flex-direction:column;gap:10px">
        ${PERMISSIONS_CATALOG.map((cat, idx) => {
          const mod = cat.module;
          const isModDisabled = isEng && (mod === "users" || mod === "settings" || mod === "zakat");
          const activeCount = cat.items.filter(item => !isModDisabled && isPermActive(mod, item.key, item.id)).length;

          return `
            <details class="perm-module-card" data-module="${mod}" ${idx < 2 ? 'open' : ''} style="border:1px solid #E2E8F0;border-radius:10px;overflow:hidden;background:#fff">
              <summary class="perm-module-header" onclick="if(event.target.closest('button')) event.preventDefault();" style="cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#F8FAFC;border-bottom:1px solid #E2E8F0;user-select:none">
                <div class="perm-module-title" style="display:flex;align-items:center;gap:8px">
                  <span class="perm-icon" style="font-size:18px">${cat.icon}</span>
                  <span style="font-weight:700;font-size:13.5px;color:#0F172A">${cat.moduleName}</span>
                  <span class="chip perm-active-count" style="font-size:11px;background:#F1F5F9;color:#475569">${activeCount}/${cat.items.length} صلاحيات نشطة</span>
                </div>
                <div class="perm-module-acts">
                  ${!isModDisabled ? `
                    <button type="button" class="btn btn-ghost" style="padding:3px 10px;font-size:11px;background:#fff;border:1px solid #CBD5E1" data-act="toggle-module-perms" data-id="${mod}" data-mod="${mod}">تبديل / تحديد كامل الموديول</button>
                  ` : `<span class="muted" style="font-size:11px">صلاحية إدارية عليا</span>`}
                </div>
              </summary>
              <div class="perm-grid" style="padding:12px;display:grid;grid-template-columns:repeat(auto-fill, minmax(260px, 1fr));gap:8px">
                ${cat.items.map(item => {
                  const checked = !isModDisabled && isPermActive(mod, item.key, item.id);
                  const disabled = isEng && (isModDisabled || item.key === "d" || item.key === "a");

                  return `
                    <label class="perm-item ${checked ? 'active-perm' : ''}" data-mod="${mod}" style="margin:0">
                      <input type="checkbox" class="rmx-user" data-s="${mod}" data-k="${item.key}" data-pid="${item.id}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} onchange="this.closest('.perm-item').classList.toggle('active-perm', this.checked); if(typeof updatePermActiveBadges==='function') updatePermActiveBadges();">
                      <div class="perm-item-content">
                        <div class="perm-item-title">${item.name}</div>
                        <div class="perm-item-desc">${item.desc}</div>
                      </div>
                    </label>
                  `;
                }).join("")}
              </div>
            </details>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

let embeddedFarmerQ = "";
let embeddedFarmerType = "";
let embeddedFarmerStatus = "";

function farmersEmbeddedHtml(st) {
  const me = session();
  const canManage = hasPerm("farmers_manage") || hasPerm("c", "farmers") || me?.role === "admin";
  const canDel = hasPerm("farmers_delete") || hasPerm("d", "farmers") || me?.role === "admin";
  const palms = st.palms || [];
  let allFarmers = st.farmers || [];

  const totalCount = allFarmers.length;
  const dailyCount = allFarmers.filter(f => f.type === "daily").length;
  const contractCount = allFarmers.filter(f => f.type === "contract").length;
  const activeCount = allFarmers.filter(f => f.status === "active").length;

  let filtered = allFarmers.filter(f => {
    if (embeddedFarmerType && f.type !== embeddedFarmerType) return false;
    if (embeddedFarmerStatus && f.status !== embeddedFarmerStatus) return false;
    if (embeddedFarmerQ) {
      const q = embeddedFarmerQ.toLowerCase();
      const txt = [f.name, f.phone, f.nationalId, f.specialty, f.notes].join(" ").toLowerCase();
      if (!txt.includes(q)) return false;
    }
    return true;
  });

  return `
    <div class="card" style="padding:16px;margin-bottom:14px;background:#F8FAFC;border:1.5px solid #E2E8F0;border-radius:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div>
          <h4 style="margin:0 0 4px 0;font-size:15px;color:#0F172A">👨‍🌾 كشف عمال اليومية والمزارعين المتعاقدين</h4>
          <div class="muted" style="font-size:12px">سجل العمال المستأجرين باليومية أو حسب الحاجة، وأرقام التواصل، والأجور والمربعات الموكلة إليهم</div>
        </div>
        <div>
          ${canManage ? `<button type="button" class="btn btn-primary icon-btn" data-go="farmer-new" style="background:#16A34A;border-color:#16A34A">+ إضافة عامل يومية / مزارع</button>` : ''}
        </div>
      </div>
    </div>

    <!-- KPI Cards for Daily Workers & Farmers -->
    <div class="grid grid-4" style="margin-bottom:14px">
      <div class="card" style="background:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px;padding:12px">
        <div style="font-size:11.5px;color:#64748B;font-weight:700">👥 إجمالي المسجلين</div>
        <div style="font-size:22px;font-weight:900;color:#0F172A;margin-top:2px">${totalCount} <span style="font-size:12px;font-weight:600">عامل/مزارع</span></div>
      </div>
      <div class="card" style="background:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px;padding:12px">
        <div style="font-size:11.5px;color:#64748B;font-weight:700">⏳ عمال اليومية (حسب الطلب)</div>
        <div style="font-size:22px;font-weight:900;color:#D97706;margin-top:2px">${dailyCount} <span style="font-size:12px;font-weight:600">عامل</span></div>
      </div>
      <div class="card" style="background:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px;padding:12px">
        <div style="font-size:11.5px;color:#64748B;font-weight:700">📋 عقود الرعاية والمشاركة</div>
        <div style="font-size:22px;font-weight:900;color:#0284C7;margin-top:2px">${contractCount} <span style="font-size:12px;font-weight:600">مزارع</span></div>
      </div>
      <div class="card" style="background:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px;padding:12px">
        <div style="font-size:11.5px;color:#64748B;font-weight:700">✅ النشطون حالياً</div>
        <div style="font-size:22px;font-weight:900;color:#16A34A;margin-top:2px">${activeCount} <span style="font-size:12px;font-weight:600">نشط</span></div>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="card filter-bar" style="grid-template-columns:1.5fr 1fr 1fr auto;margin-bottom:12px">
      <input id="ef_q" value="${escapeHtml(embeddedFarmerQ)}" placeholder="بحث باسم العامل، الجوال، التخصص، الرقم القومي..." onkeyup="if(event.key==='Enter'){embeddedFarmerQ=this.value;render();}" />
      <select id="ef_type" onchange="embeddedFarmerType=this.value;render();">
        <option value="" ${!embeddedFarmerType?'selected':''}>كل أنواع العمل</option>
        <option value="daily" ${embeddedFarmerType==='daily'?'selected':''}>عمالة باليومية</option>
        <option value="contract" ${embeddedFarmerType==='contract'?'selected':''}>عقد رعاية / نسبة</option>
      </select>
      <select id="ef_status" onchange="embeddedFarmerStatus=this.value;render();">
        <option value="" ${!embeddedFarmerStatus?'selected':''}>كل الحالات</option>
        <option value="active" ${embeddedFarmerStatus==='active'?'selected':''}>نشط ومتاح</option>
        <option value="inactive" ${embeddedFarmerStatus==='inactive'?'selected':''}>متوقف / غير متاح</option>
      </select>
      <button type="button" class="btn btn-ghost icon-btn" onclick="embeddedFarmerQ=$('#ef_q')?.value||'';render();">تطبيق</button>
    </div>

    <!-- Table -->
    <div class="card" style="padding:14px;border-radius:12px">
      <div class="grid-wrap">
        <table class="dense" style="width:100%;font-size:12.5px">
          <thead>
            <tr style="background:#F8FAFC">
              <th>العامل / المزارع وبيانات التواصل</th>
              <th>نوع العمل والأجر</th>
              <th>التخصص والمهارة الميدانية</th>
              <th>القطع المسندة</th>
              <th>النخيل المشمولة</th>
              <th>الحالة</th>
              <th class="sticky-act" style="text-align:center">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.length === 0 ? `
              <tr>
                <td colspan="7" style="text-align:center;padding:30px;color:#94A3B8">
                  لا توجد بيانات عمال أو مزارعين مطابقة لبحثك
                </td>
              </tr>
            ` : filtered.map(f => {
              const pCount = palms.filter(p => (f.plots||[]).includes(p.plot)).length;
              const phoneClean = (f.phone || "").replace(/[^0-9+]/g, "");
              const waLink = phoneClean ? `https://wa.me/${phoneClean.startsWith('0') ? '2' + phoneClean : phoneClean}` : "";
              const isDaily = f.type === "daily";

              return `
                <tr>
                  <td>
                    <b>${escapeHtml(f.name)}</b>
                    ${f.nationalId ? `<div class="muted" style="font-size:11px">رقم قومي: ${escapeHtml(f.nationalId)}</div>` : ''}
                    ${f.phone ? `
                      <div style="margin-top:3px;display:flex;align-items:center;gap:6px">
                        <a href="tel:${phoneClean}" style="font-size:11px;color:#0284C7;text-decoration:none;display:inline-flex;align-items:center;gap:2px">
                          📞 ${escapeHtml(f.phone)}
                        </a>
                        ${waLink ? `
                          <a href="${waLink}" target="_blank" rel="noopener" style="font-size:11px;color:#16A34A;text-decoration:none;display:inline-flex;align-items:center;gap:2px;background:#DCFCE7;padding:1px 6px;border-radius:4px" title="مراسلة عبر واتساب">
                            💬 واتساب
                          </a>
                        ` : ''}
                      </div>
                    ` : ''}
                  </td>
                  <td>
                    ${isDaily ? `
                      <span class="badge" style="background:#FEF3C7;color:#B45309;font-weight:700">عمل يومي</span>
                      <div style="margin-top:2px;font-size:11.5px;color:#475569">
                        ${f.dailyWage ? `<b>${f.dailyWage}</b> ج.م / يوم` : 'حسب الاتفاق'}
                      </div>
                    ` : `
                      <span class="badge" style="background:#E0F2FE;color:#0369A1;font-weight:700">عقد رعاية</span>
                      <div style="margin-top:2px;font-size:11px;color:#475569">
                        ${f.contractNo ? `عقد: ${escapeHtml(f.contractNo)}` : ''} ${f.sharePct ? `• ${f.sharePct}%` : ''}
                      </div>
                    `}
                  </td>
                  <td>
                    <span class="badge" style="background:#F1F5F9;color:#334155;font-weight:700">
                      ${escapeHtml(f.specialty || (isDaily ? "أعمال عامة" : "رعاية ومتابعة"))}
                    </span>
                  </td>
                  <td>
                    ${(f.plots && f.plots.length) ? f.plots.map(pid => `<span class="badge" style="margin:1px;font-size:10.5px">${escapeHtml(pid)}</span>`).join(" ") : '<span class="muted">—</span>'}
                  </td>
                  <td><b>${pCount}</b> شجرة</td>
                  <td>
                    ${f.status === "active" ? `<span class="status badge-ok">نشط</span>` : `<span class="status" style="background:#FEE2E2;color:#DC2626">متوقف</span>`}
                  </td>
                  <td class="row-acts" style="text-align:center">
                    <button type="button" class="btn btn-ghost icon-btn" data-go="farmer" data-id="${f.id}" title="عرض الملف والإنتاجية">👁️ بطاقة</button>
                    ${canManage ? `<button type="button" class="btn btn-ghost icon-btn" data-go="farmer-edit" data-id="${f.id}" title="تعديل البيانات والأجر">✏️ تعديل</button>` : ''}
                    ${canManage ? `<button type="button" class="btn btn-ghost icon-btn" data-act="tog-farmer" data-id="${f.id}">${f.status==="active"?"إيقاف":"تنشيط"}</button>` : ''}
                    ${canDel ? `<button type="button" class="btn btn-ghost icon-btn" data-act="del-farmer" data-id="${f.id}" style="color:#DC2626">🗑️</button>` : ''}
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function scopeAssignHtml(st) {
  const me = session();
  const isEng = me && me.role === "engineer";
  const users = isEng ? st.users.filter(u => u.role === "worker") : st.users.filter(u => u.role !== "admin");
  const uid = asgUserId || users[0]?.id;
  const cur = st.users.find(u => u.id === uid);
  const selected = new Set(cur?.plots || []);
  const bySec = {};
  const plotsSource = isEng ? st.plots.filter(p => (me.plots||[]).includes(p.id)) : st.plots;

  plotsSource.forEach(p => {
    bySec[p.sector] = bySec[p.sector] || {};
    const no = p.plotNo || p.id;
    bySec[p.sector][no] = bySec[p.sector][no] || [];
    bySec[p.sector][no].push(p);
  });

  const totalSectors = Object.keys(bySec).length;

  const tree = Object.keys(bySec).map(sec => {
    const groups = bySec[sec];
    const allIds = Object.values(groups).flat().map(p => p.id);
    const nSel = allIds.filter(id => selected.has(id)).length;
    const isAll = nSel === allIds.length && allIds.length > 0;
    const isPart = nSel > 0 && nSel < allIds.length;

    const plotGroupsHtml = Object.keys(groups).map(no => {
      const parts = groups[no];
      const ids = parts.map(p => p.id);
      const ns = ids.filter(id => selected.has(id)).length;
      const isGrpAll = ns === ids.length && ids.length > 0;

      return `
        <div class="plot-group" data-no="${no}">
          <div class="plot-group-header">
            <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;margin:0">
              <input type="checkbox" class="asggrp" data-ids="${ids.join(",")}" ${isGrpAll ? "checked" : ""}>
              <span>القطعة <b>${no}</b></span>
            </label>
            <span class="muted" style="font-size:11px">${ns} من ${ids.length}</span>
          </div>
          <div class="parts-grid">
            ${parts.map(p => {
              const isPChecked = selected.has(p.id);
              return `
                <label class="part-chip ${isPChecked ? 'checked' : ''}">
                  <input type="checkbox" class="asgplot" data-sec="${sec}" data-grp="${no}" value="${p.id}" ${isPChecked ? "checked" : ""}>
                  <span>${p.part || p.id}</span>
                </label>
              `;
            }).join("")}
          </div>
        </div>
      `;
    }).join("");

    return `
      <div class="sec-card ${isAll ? 'full-selection' : isPart ? 'has-selection' : ''}" data-sec="${sec}" id="seccard_${sec}">
        <div class="sec-header" data-act="asg-sec-header" data-sec="${sec}" data-id="${sec}">
          <div class="sec-title-group">
            <input type="checkbox" class="asgsec" data-sec="${sec}" data-ids="${allIds.join(",")}" ${isAll ? "checked" : ""}>
            <span>🌴 ${sectorName(sec)}</span>
            <span class="muted" style="font-size:12px;font-weight:400">(${allIds.length} قطعة)</span>
            <span class="sec-badge ${isAll ? 'all' : isPart ? 'part' : 'none'}">${isAll ? `✓ محدد بالكامل (${nSel}/${allIds.length})` : isPart ? `— محدد جزئياً (${nSel}/${allIds.length})` : `غير محدد (0/${allIds.length})`}</span>
          </div>
          <div class="sec-actions">
            <button type="button" class="btn btn-ghost icon-btn btn-sm" data-act="asg-sec-select" data-sec="${sec}" data-id="${sec}" title="تحديد كافة قطع هذا القطاع">✓ تحديد القطاع كاملاً</button>
            <button type="button" class="btn btn-ghost icon-btn btn-sm" data-act="asg-sec-clear" data-sec="${sec}" data-id="${sec}" style="color:#C62828" title="إلغاء تحديد هذا القطاع">✕ إلغاء</button>
            <button type="button" class="btn btn-ghost icon-btn btn-sm" data-act="asg-sec-toggle" data-sec="${sec}" data-id="${sec}" title="فتح/طي تفاصيل القطع">تخصيص القطع ▾</button>
          </div>
        </div>
        <div class="sec-body">
          <div class="grid grid-2" style="gap:8px">
            ${plotGroupsHtml}
          </div>
        </div>
      </div>
    `;
  }).join("");

  setTimeout(() => {
    updateSectorCheckboxStates();
  }, 20);

  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:12px">
        <div>
          <h3 style="margin:0">🗺️ إسناد النطاق الجغرافي للمستخدمين والمهندسين</h3>
          <div class="muted" style="font-size:13px">تحديد القطاعات والقطع الخاضعة لإشراف المستخدم عبر الهرم التفاعلي وكروت القطاعات المجمعة</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <label style="margin:0;font-weight:700">المستخدم المستهدف:</label>
          <select id="asguser" style="min-width:240px">${users.map(u => `<option value="${u.id}" ${u.id===uid?"selected":""}>${u.name} — ${roleLabel(u.role)}</option>`)}</select>
        </div>
      </div>

      ${cur && ((cur.roles||[]).includes('investor') || cur.role === 'investor') ? `
        <div style="background:#FEF3C7;border:1.5px solid #F59E0B;border-radius:10px;padding:12px 14px;margin:10px 0 6px;display:flex;align-items:flex-start;gap:10px">
          <span style="font-size:20px;line-height:1">ℹ️</span>
          <div style="font-size:13px;line-height:1.6;color:#92400E">
            <b style="color:#78350F;display:block;margin-bottom:2px">تنبيه حساب متعدد الأدوار (عامل ومستثمر):</b>
            نطاق الاستثمار والملكية: مُدار ومربوط تلقائياً بموجب عقود الاستثمار المعتمدة للمستخدم، ولا يتأثر بإضافة أو حذف نطاقات العمل الميداني أعلاه.
          </div>
        </div>
      ` : ''}

      <div class="actions" style="margin-top:8px;gap:8px;flex-wrap:wrap;align-items:center">
        <input id="asgq" placeholder="🔍 بحث فوري في القطاعات والقطع (مثال: Bsh07 أو 03 أو 02A)..." style="flex:1;min-width:220px;margin:0" />
        <button class="btn btn-ghost icon-btn" data-act="asg-all" title="تحديد كافة قطع وقطاعات المزرعة">✓ تحديد كل المزرعة</button>
        <button class="btn btn-ghost icon-btn" data-act="asg-none" title="إلغاء تحديد كافة القطاعات">✕ إلغاء تحديد الكل</button>
        <button class="btn btn-ghost icon-btn" data-act="asg-expand-all" title="فتح وتوسيع كافة كروت القطاعات">⊞ فتح كافة القطاعات</button>
        <button class="btn btn-ghost icon-btn" data-act="asg-collapse-all" title="طي كافة كروت القطاعات">⊟ طي كافة القطاعات</button>
        <div style="display:flex;gap:4px;align-items:center">
          <span class="muted" style="font-size:12px">أجزاء:</span>
          <button class="btn btn-ghost icon-btn btn-sm" data-act="asg-part" data-id="A">كل A</button>
          <button class="btn btn-ghost icon-btn btn-sm" data-act="asg-part" data-id="B">كل B</button>
          <button class="btn btn-ghost icon-btn btn-sm" data-act="asg-part" data-id="C">كل C</button>
          <button class="btn btn-ghost icon-btn btn-sm" data-act="asg-part" data-id="D">كل D</button>
        </div>
      </div>

      <div id="asgtree" class="asg-tree">${tree}</div>

      <div class="card" style="margin-top:14px;position:sticky;bottom:8px;display:flex;justify-content:space-between;align-items:center;background:#fff;border:2px solid var(--green);box-shadow:0 4px 14px rgba(0,0,0,0.1);z-index:99;padding:12px 18px;border-radius:12px;flex-wrap:wrap;gap:10px">
        <div>
          <span>تم إسناد <b id="asgcount" style="font-size:18px;color:var(--green)">${selected.size}</b> قطعة من إجمالي <b>${plotsSource.length}</b> قطعة عبر <b>${totalSectors}</b> قطاع للمستخدم: <b>${cur?.name||""}</b> (${roleLabel(cur?.role)})</span>
        </div>
        <button class="btn btn-primary" data-act="save-scope" style="font-size:14px;padding:8px 24px">💾 حفظ نطاق العمل</button>
      </div>
    </div>
  `;
}

function getEffectiveInventoryScope(u) {
  if (!u) return "personal";
  if (u.inventoryScope && ["personal", "sector", "all"].includes(u.inventoryScope)) {
    return u.inventoryScope;
  }
  const st = Store.get();
  const roleObj = (st.roles || []).find(r => r.id === u.role);
  if (roleObj?.inventoryScope && ["personal", "sector", "all"].includes(roleObj.inventoryScope)) {
    return roleObj.inventoryScope;
  }
  if (u.role === "admin" || u.role === "warehouse_mgr") return "all";
  if (u.role === "engineer") return "sector";
  return "personal";
}

function inventoryScopeLabel(scope) {
  if (scope === "all") return "المستودع الرئيسي بالكامل (Full Central Warehouse)";
  if (scope === "sector") return "عهدة قطاعات الإشراف (Assigned Sector Custody)";
  return "العهدة الشخصية الميدانية فقط (Personal Custody Only)";
}

function escapeRegex(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getWorkerFertilizerSummary(workerId) {
  const st = Store.get();
  const vouchers = st.fertilizerVouchers || [];
  const operations = st.operations || [];
  const fertilizers = st.fertilizers || [];

  const map = {};
  const fertMatchers = [];
  fertilizers.forEach(f => {
    map[f.id] = {
      fert: f,
      received: 0,
      consumed: 0,
      remaining: 0,
      voucherCount: 0
    };
    fertMatchers.push({
      fert: f,
      name: f.name,
      regex: new RegExp(escapeRegex(f.name) + "(?:\\s*•\\s*([\\d.]+)\\s*([^\\]]+))?")
    });
  });

  const fertLookup = new Map();
  fertilizers.forEach(f => {
    if (f.id) fertLookup.set(f.id, f);
    if (f.name) fertLookup.set(f.name, f);
  });

  const u = (st.users || []).find(usr => usr.id === workerId || usr.user === workerId) || session() || {};
  const isTargetWorker = (recipientId) => {
    if (!recipientId) return false;
    return recipientId === workerId || recipientId === u.id || recipientId === u.user;
  };

  vouchers.forEach(v => {
    const toId = v.toUser || v.toUserId || v.to_user_id;
    if (isTargetWorker(toId) && (v.type === "issue" || v.voucherType === "issue") && v.status === "received") {
      const fert = fertLookup.get(v.fertId) || fertLookup.get(v.fertName);
      if (fert && map[fert.id]) {
        map[fert.id].received += Number(v.qty) || 0;
        map[fert.id].voucherCount++;
      }
    }
  });

  operations.forEach(o => {
    if ((o.workerId === workerId || o.workerId === u.id || o.workerId === u.user) && o.notes) {
      fertMatchers.forEach(({ fert, name, regex }) => {
        if (o.notes.includes(name)) {
          const match = o.notes.match(regex);
          if (match && match[1]) {
            let qty = parseFloat(match[1]) || 0;
            const unit = (match[2] || "").trim();
            if (fert.unit === "كجم" && unit === "جم") qty = qty / 1000;
            else if (fert.unit === "جم" && unit === "كجم") qty = qty * 1000;
            map[fert.id].consumed += qty;
          }
        }
      });
    }
  });

  Object.values(map).forEach(item => {
    item.remaining = Math.max(0, item.received - item.consumed);
  });

  return map;
}

function getSectorFertilizerSummary(u) {
  const st = Store.get();
  const vouchers = st.fertilizerVouchers || [];
  const operations = st.operations || [];
  const fertilizers = st.fertilizers || [];
  const assignedPlots = new Set(u.plots || []);
  const supervisedSectors = new Set();

  const plotSecMap = new Map();
  (st.plots || []).forEach(p => {
    if (p && p.id && p.sector) plotSecMap.set(p.id, p.sector);
  });

  (u.plots || []).forEach(pId => {
    const sec = plotSecMap.get(pId);
    if (sec) supervisedSectors.add(sec);
  });
  if (!supervisedSectors.size) {
    (st.sectors || []).forEach(s => supervisedSectors.add(s.id));
  }

  const map = {};
  const fertMatchers = [];
  const fertLookup = new Map();
  fertilizers.forEach(f => {
    map[f.id] = {
      fert: f,
      received: 0,
      consumed: 0,
      remaining: 0,
      voucherCount: 0
    };
    fertMatchers.push({
      fert: f,
      name: f.name,
      regex: new RegExp(escapeRegex(f.name) + "(?:\\s*•\\s*([\\d.]+)\\s*([^\\]]+))?")
    });
    if (f.id) fertLookup.set(f.id, f);
    if (f.name) fertLookup.set(f.name, f);
  });

  vouchers.forEach(v => {
    const isForSector = v.sectorId && supervisedSectors.has(v.sectorId);
    const isForUser = v.toUser === u.id;
    if ((isForSector || isForUser) && (v.type === "issue" || !v.type) && v.status === "received") {
      const fert = fertLookup.get(v.fertId) || fertLookup.get(v.fertName);
      if (fert && map[fert.id]) {
        map[fert.id].received += Number(v.qty) || 0;
        map[fert.id].voucherCount++;
      }
    }
    // Track disbursements issued by this engineer from his custody to workers
    if ((v.fromUserId === u.id || (v.from && v.from.includes(u.name))) && (v.type === "issue_field" || (v.from && v.from.includes("عهدة")))) {
      const fert = fertLookup.get(v.fertId) || fertLookup.get(v.fertName);
      if (fert && map[fert.id]) {
        map[fert.id].disbursed = (map[fert.id].disbursed || 0) + (Number(v.qty) || 0);
      }
    }
  });

  const palmPlotMap = new Map();
  (st.palms || []).forEach(p => {
    if (p) {
      if (p.id) palmPlotMap.set(p.id, p.plot);
      if (p.code) palmPlotMap.set(p.code, p.plot);
    }
  });

  operations.forEach(o => {
    const palmPlot = palmPlotMap.get(o.palmId) || palmPlotMap.get(o.palmCode);
    const inSupervisedPlot = palmPlot ? assignedPlots.has(palmPlot) : true;
    if (inSupervisedPlot && o.notes) {
      fertMatchers.forEach(({ fert, name, regex }) => {
        if (o.notes.includes(name)) {
          const match = o.notes.match(regex);
          if (match && match[1]) {
            let qty = parseFloat(match[1]) || 0;
            const unit = (match[2] || "").trim();
            if (fert.unit === "كجم" && unit === "جم") qty = qty / 1000;
            else if (fert.unit === "جم" && unit === "كجم") qty = qty * 1000;
            map[fert.id].consumed += qty;
          }
        }
      });
    }
  });

  Object.values(map).forEach(item => {
    const disbursed = item.disbursed || 0;
    item.remaining = Math.max(0, item.received - item.consumed - disbursed);
  });

  return { map, supervisedSectors };
}

function scopeChips(u) {
  const st = Store.get();
  const invScope = getEffectiveInventoryScope(u);
  const invBadge = `<span class="chip" style="font-size:11px;background:${invScope==='personal'?'#F1F5F9':invScope==='sector'?'#FEF3C7':'#DCFCE7'};color:${invScope==='personal'?'#475569':invScope==='sector'?'#92400E':'#166534'}">مخزون: ${invScope==='personal'?'شخصي':invScope==='sector'?'قطاع':'كامل'}</span>`;
  if (u.role === "admin") return `<div class="scope-box"><span class="chip">كل المزرعة</span>${invBadge}</div>`;
  const plots = (u.plots || []).map(id => st.plots.find(p => p.id === id) || { id, sector: "—" });
  if (!plots.length) return `<div class="scope-box"><span class="muted">—</span>${invBadge}</div>`;
  if (plots.length <= 2) {
    return `<div class="scope-box">${plots.map(p => `<span class="chip">${p.id}</span>`).join("")}${invBadge}</div>`;
  }
  const bySec = {};
  plots.forEach(p => { bySec[p.sector] = bySec[p.sector] || []; bySec[p.sector].push(p); });
  const secs = Object.keys(bySec);
  const shown = secs.slice(0, 2).map(sec => {
    const n = bySec[sec].length;
    const all = st.plots.filter(p => p.sector === sec).length;
    return `<span class="chip">${n === all && all ? sectorName(sec) + " كاملاً" : sectorName(sec) + " (" + n + ")"}</span>`;
  });
  const hiddenCount = plots.length - secs.slice(0, 2).reduce((a, s) => a + bySec[s].length, 0);
  if (hiddenCount > 0 || secs.length > 2) {
    shown.push(`<span class="chip more" data-act="chip-pop">+${Math.max(hiddenCount, plots.length - 2)} قطعة
      <span class="chip-pop">${plots.map(p => p.id).join(" · ")}</span></span>`);
  }
  return `<div class="scope-box">${shown.join("")}</div>`;
}

function renderUserActionDropdown(u, me, isEng, canDelUser, st) {
  const userRoles = Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : [u.role];
  const isField = ["engineer", "worker", "nursery", "nursery_mgr", "storage", "warehouse_mgr"].some(r => userRoles.includes(r));
  const isInvestor = u.role === "investor" || userRoles.includes("investor") || (st?.investors || []).some(inv => (inv.phone && u.phone && inv.phone.replace(/[^0-9]/g, '') === u.phone.replace(/[^0-9]/g, '')) || String(inv.user_id) === String(u.id));
  const isWorkerOrField = u.role === "worker" || userRoles.includes("worker") || isField;

  return `
    <div class="action-dropdown-menu">
      <button class="action-dropdown-item" data-act="edit-user" data-id="${u.id}">
        <span class="action-icon">✏️</span>
        <span>تعديل الحساب والصلاحيات</span>
      </button>
      ${isField && !isEng ? `
        <button class="action-dropdown-item" data-act="scope-user" data-id="${u.id}">
          <span class="action-icon">🗺️</span>
          <span>تخصيص النطاق الميداني</span>
        </button>
      ` : ''}
      ${isInvestor ? `
        <button class="action-dropdown-item" data-act="jump-to-investor" data-id="${u.id}" style="color:#0284C7;font-weight:700">
          <span class="action-icon">💼</span>
          <span>فتح ملف الاستثمار والعقود ↗</span>
        </button>
      ` : ''}
      ${isWorkerOrField ? `
        <button class="action-dropdown-item" data-act="open-id-card-user" data-id="${u.id}">
          <span class="action-icon">🪪</span>
          <span>طباعة بطاقة العمل (ID)</span>
        </button>
      ` : ''}
      <div class="action-dropdown-divider"></div>
      <button class="action-dropdown-item" data-act="share-creds-user" data-id="${u.id}">
        <span class="action-icon">🔑</span>
        <span>مشاركة بيانات الدخول</span>
      </button>
      <button class="action-dropdown-item" data-act="reset-pass" data-id="${u.id}">
        <span class="action-icon">🔄</span>
        <span>إعادة تعيين كلمة المرور</span>
      </button>
      <div class="action-dropdown-divider"></div>
      <button class="action-dropdown-item ${u.active === false ? 'text-success' : 'text-danger'}" data-act="tog-user" data-id="${u.id}">
        <span class="action-icon">${u.active === false ? '✅' : '⛔'}</span>
        <span>${u.active === false ? 'تنشيط الحساب' : 'تعطيل الحساب'}</span>
      </button>
      ${canDelUser && u.id !== me?.id && u.role !== 'admin' && !u.isSuperAdmin ? `
        <button class="action-dropdown-item text-danger" data-act="del-user" data-id="${u.id}" style="color:#DC2626">
          <span class="action-icon">🗑️</span>
          <span>حذف الحساب نهائياً</span>
        </button>
      ` : ''}
    </div>
  `;
}

let activeUserMenuId = null;

function usersView() {
  const me = session();
  if (me?.role !== "admin" && !hasPerm("users") && !hasPerm("users_view")) {
    return `<div class="card" style="padding:28px;text-align:center;margin-top:20px">
      <div style="font-size:36px;margin-bottom:8px">🔒</div>
      <h3 style="color:#b91c1c;margin:0 0 8px">عذراً، ليس لديك صلاحية استعراض المستخدمين</h3>
      <div class="muted" style="font-size:13px;max-width:440px;margin:0 auto 16px">تم إلغاء صلاحيات الوصول إلى هذا الموديول لحسابك أو لدورك الحالي من قبل إدارة النظام.</div>
      <button class="btn btn-primary" data-go="dash">العودة للرئيسية</button>
    </div>`;
  }
  const st = Store.get();
  const isEng = me && me.role === "engineer";
  const isSuperAdmin = Boolean(me?.isSuperAdmin === true || me?.role === "super_admin");
  const canDelUser = hasPerm("users_delete") || hasPerm("d", "users") || me?.role === "admin" || isSuperAdmin;
  const curCompId = st.activeCompanyId || me?.activeCompanyId || me?.companyId || "comp_bashayer";
  const curProjId = st.activeProjectId || me?.activeProjectId || me?.projectId || "proj_farafra_01";

  const allAvailableUsers = st.users || [];
  const isInvestorUser = u => {
    if (u.role === "investor") return true;
    if (Array.isArray(u.roles) && u.roles.includes("investor")) return true;
    return (st.investors || []).some(inv => (inv.phone && u.phone && inv.phone.replace(/[^0-9]/g, '') === u.phone.replace(/[^0-9]/g, '')) || String(inv.user_id) === String(u.id));
  };

  const isOfficeRole = r => ["admin", "superadmin", "super_admin", "care", "customer_care", "accountant", "tenant_user"].includes(r);
  const isFieldRole = r => ["engineer", "worker", "nursery", "nursery_mgr", "storage", "warehouse_mgr"].includes(r);
  const isInvestorRole = r => r === "investor";

  const userHasOfficeRole = u => {
    const roles = Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : [u.role];
    return roles.some(r => isOfficeRole(r));
  };
  const userHasFieldRole = u => {
    const roles = Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : [u.role];
    return roles.some(r => isFieldRole(r));
  };
  const userHasInvestorRole = u => {
    const roles = Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : [u.role];
    return roles.some(r => isInvestorRole(r)) || (st.investors || []).some(inv => (inv.phone && u.phone && inv.phone.replace(/[^0-9]/g, '') === u.phone.replace(/[^0-9]/g, '')) || String(inv.user_id) === String(u.id));
  };

  const isStaffUser = u => userHasOfficeRole(u) || userHasFieldRole(u) || u.role !== "investor";

  const officeUsersCount = allAvailableUsers.filter(u => userHasOfficeRole(u)).length;
  const fieldUsersCount = allAvailableUsers.filter(u => userHasFieldRole(u)).length;
  const staffUsersCount = allAvailableUsers.filter(isStaffUser).length;

  if (userSegmentTab === "investor") {
    userSegmentTab = "all";
  }

  const list = allAvailableUsers.filter(u => {
    if (userSegmentTab === "office" && !userHasOfficeRole(u)) return false;
    if (userSegmentTab === "field" && !userHasFieldRole(u)) return false;
    if (userSegmentTab === "all" && !userQ && !isStaffUser(u)) return false;

    if (userRoleF) {
      const roles = Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : [u.role];
      if (!roles.includes(userRoleF)) return false;
    }
    if (userActF === "on" && u.active === false) return false;
    if (userActF === "off" && u.active !== false) return false;
    if (userSecF) {
      const ok = (u.plots||[]).some(pid => st.plots.find(p=>p.id===pid)?.sector === userSecF);
      if (!ok && u.role !== "admin") return false;
    }
    if (userQ) {
      const q = userQ.toLowerCase();
      if (![u.name,u.user,u.phone].join(" ").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return `<div class="page-head">
      <div><h3>👥 طاقم العمل وإدارة حسابات المنظومة</h3><div class="muted">${list.length} حساب مسجل بالجدول الحالي</div></div>
      <div class="actions" style="margin:0">
        <button class="btn btn-primary icon-btn" data-go="user-new">${isEng ? "+ إضافة عامل ميداني" : "+ إضافة مستخدم جديد"}</button>
        <button class="btn btn-ghost icon-btn" style="border:1.5px solid #0284C7;color:#0284C7;font-weight:700" data-go="investors-hub">💼 إدارة المستثمرين والعقود ↗</button>
        ${hasPerm("investors_import") ? `<button class="btn btn-primary icon-btn" style="background:#0284C7;border-color:#0284C7" data-act="open-investors-import">📥 استيراد المستثمرين (Excel)</button>` : ''}
        ${isEng ? "" : `<button class="btn btn-ghost icon-btn" data-go="roles">🛡️ مصفوفة الأدوار</button>`}
      </div>
    </div>

    <!-- 1. Interactive Stat Cards for User Categories (Staff All, Office, Field) -->
    <div class="user-segment-cards" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 14px;">
      <div class="user-segment-card ${userSegmentTab === 'all' ? 'active' : ''}" data-act="user-segment" data-id="all" title="عرض كل طاقم العمل والتشغيل">
        <div class="user-segment-card-info">
          <div class="user-segment-card-title">
            <span style="font-size:20px">🌐</span>
            <span>كل طاقم العمل</span>
          </div>
          <div class="user-segment-card-sub">جميع الكوادر التشغيلية والميدانية والإدارية بالمنظومة</div>
        </div>
        <div class="user-segment-card-count">${staffUsersCount} موظفاً</div>
      </div>

      <div class="user-segment-card ${userSegmentTab === 'office' ? 'active office' : ''}" data-act="user-segment" data-id="office" title="تصفية مسؤولي الإدارة والتشغيل المكتبي">
        <div class="user-segment-card-info">
          <div class="user-segment-card-title">
            <span style="font-size:20px">🏢</span>
            <span>الكادر الإداري</span>
          </div>
          <div class="user-segment-card-sub">تصفية الجدول لعرض مسؤولي الإدارة والمكتب فقط</div>
        </div>
        <div class="user-segment-card-count">${officeUsersCount} حسابات</div>
      </div>

      <div class="user-segment-card ${userSegmentTab === 'field' ? 'active' : ''}" data-act="user-segment" data-id="field" title="تصفية الكوادر الميدانية والزراعية">
        <div class="user-segment-card-info">
          <div class="user-segment-card-title">
            <span style="font-size:20px">🌾</span>
            <span>الفريق الميداني</span>
          </div>
          <div class="user-segment-card-sub">تصفية الجدول للكوادر الزراعية الميدانية (بين مهندس وعامل)</div>
        </div>
        <div class="user-segment-card-count">${fieldUsersCount} مستخدمين</div>
      </div>
    </div>

    <div class="actions" style="margin-bottom:8px">
      <button class="btn ${usersTab==="list"?"btn-primary":"btn-ghost"}" style="width:auto" data-act="utab" data-id="list">📋 جدول الحسابات (${list.length})</button>
      <button class="btn ${usersTab==="farmers"?"btn-primary":"btn-ghost"}" style="width:auto" data-act="utab" data-id="farmers">👨‍🌾 عمال اليومية والمزارعون (${(st.farmers||[]).length})</button>
      ${isEng ? "" : `<button class="btn ${usersTab==="roles"?"btn-primary":"btn-ghost"}" style="width:auto" data-go="roles">🛡️ الأدوار والمصفوفة العامة</button>`}
      <button class="btn ${usersTab==="scope"?"btn-primary":"btn-ghost"}" style="width:auto" data-act="utab" data-id="scope">📍 توزيع النطاقات الميدانية</button>
    </div>
    ${usersTab==="farmers" ? farmersEmbeddedHtml(st) : (usersTab==="scope" ? scopeAssignHtml(st) : "")}
    ${(usersTab==="scope" || usersTab==="farmers")?"":`<div class="card filter-bar" style="grid-template-columns:1.4fr 1fr 1fr 1fr auto">
      <input id="uq" value="${userQ}" placeholder="بحث بالاسم أو الجوال أو حساب الدخول" />
      <select id="urolef"><option value="">كل الأدوار</option>${st.roles.map(r=>`<option value="${r.id}" ${userRoleF===r.id?"selected":""}>${r.name}</option>`)}</select>
      <select id="usecf"><option value="">كل القطاعات</option>${st.sectors.map(s=>`<option value="${s.id}" ${userSecF===s.id?"selected":""}>${s.name}</option>`)}</select>
      <select id="uactf">
        <option value="" ${!userActF?"selected":""}>كل الحالات</option>
        <option value="on" ${userActF==="on"?"selected":""}>نشط</option>
        <option value="off" ${userActF==="off"?"selected":""}>معطل</option>
      </select>
      <button class="btn btn-ghost icon-btn" data-act="apply-users">تطبيق</button>
    </div>`}
    ${(usersTab==="scope" || usersTab==="farmers")?"":`<div class="card" style="margin-top:10px">
      <div class="actions">
        <button class="btn btn-orange icon-btn" data-act="bulk-off">تعطيل المحدد</button>
        <button class="btn btn-ghost icon-btn" data-act="export-users">تصدير السجل</button>
      </div>
      ${(() => {
        const pages = Math.max(1, Math.ceil(list.length/20));
        if (userPage>pages) userPage=pages;
        const slice = list.slice((userPage-1)*20, userPage*20);

        let theadHtml = "";
        let tbodyRowsHtml = "";

        if (userSegmentTab === "office") {
          theadHtml = `
            <tr>
              <th style="width:36px"><input type="checkbox" id="uall"></th>
              <th>المسؤول الإداري والدور</th>
              <th>بيانات الاتصال</th>
              <th>نطاق الإشراف والمستودع</th>
              <th>الحالة وآخر تسجيل دخول</th>
              <th class="sticky-act">الإجراءات</th>
            </tr>`;
          tbodyRowsHtml = slice.map(u => {
            const isInv = isInvestorUser(u);
            const invBadge = isInv ? `<button type="button" class="btn btn-ghost" data-act="jump-to-investor" data-id="${u.id}" style="padding:1px 6px;font-size:10px;background:#FEF3C7;color:#92400E;border:1px solid #FCD34D;border-radius:6px;display:inline-flex;align-items:center;gap:3px;cursor:pointer;font-weight:700" title="الانتقال المباشر لملف المستثمر والعقود">💼 مستثمر مسجل ↗</button>` : '';
            return `
            <tr class="${activeUserMenuId === u.id ? 'row-has-open-menu' : ''}">
              <td><input type="checkbox" class="uchk" value="${u.id}"></td>
              <td>
                <div style="display:flex;align-items:center;gap:10px">
                  <div style="width:38px;height:38px;border-radius:50%;overflow:hidden;background:#EFF6FF;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;border:1.5px solid #2563EB">
                    ${u.avatar ? `<img src="${u.avatar}" style="width:100%;height:100%;object-fit:cover" alt="${escapeHtml(u.name)}" />` : `🏢`}
                  </div>
                  <div>
                    <div style="font-weight:800;color:var(--text);font-size:13.5px;line-height:1.2;display:flex;align-items:center;gap:6px">
                      <span>${escapeHtml(u.name)}</span>
                      ${invBadge}
                    </div>
                    <div style="display:flex;align-items:center;gap:6px;margin-top:3px;flex-wrap:wrap">
                      ${(Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : [u.role]).map(r => `<span class="status badge-ok" style="padding:1px 6px;font-size:10.5px">${roleLabel(r)}</span>`).join(" ")}
                      <span class="muted" style="font-family:monospace;font-size:11px">@${escapeHtml(u.user)}</span>
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <div style="font-weight:700;font-size:13px;direction:ltr;text-align:right">${escapeHtml(u.phone || "—")}</div>
                <div class="muted" style="font-size:11px;margin-top:2px">رقم التواصل المعتمد</div>
              </td>
              <td>
                <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">
                  <span class="chip" style="font-size:11px;background:#EFF6FF;color:#1E40AF;border-color:#BFDBFE">🏢 إدارة عليا</span>
                  ${scopeChips(u)}
                </div>
              </td>
              <td>
                <div>
                  ${u.active === false ? `<span class="status" style="background:#FEE2E2;color:#991B1B;padding:2px 8px;font-size:11px">معطل</span>` : `<span class="status badge-ok" style="padding:2px 8px;font-size:11px">نشط</span>`}
                </div>
                <div class="muted" style="font-size:11px;margin-top:3px">${u.lastSeen ? fmtDate(u.lastSeen) : "لم يسجل دخول"}</div>
              </td>
              <td class="sticky-act ${activeUserMenuId === u.id ? 'has-open-menu' : ''}">
                ${isEng ? `<span class="muted" style="font-size:11px;padding:3px 8px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:6px;display:inline-block">👁️ عرض فقط</span>` : `
                <div class="action-menu-wrap">
                  <button class="action-menu-btn ${activeUserMenuId === u.id ? 'active' : ''}" data-act="toggle-user-menu" data-id="${u.id}" title="خيارات الإدارة">
                    <span class="dots-icon">⋮</span>
                    <span>الإجراءات</span>
                  </button>
                  ${activeUserMenuId === u.id ? renderUserActionDropdown(u, me, isEng, canDelUser, st) : ''}
                </div>`}
              </td>
            </tr>`;
          }).join("");
        } else if (userSegmentTab === "field") {
          theadHtml = `
            <tr>
              <th style="width:36px"><input type="checkbox" id="uall"></th>
              <th>المستخدم والكود الميداني</th>
              <th>الجوال وفصيلة الدم</th>
              <th>النطاق الميداني المسند</th>
              <th>بطاقة العمل (ID) والحالة</th>
              <th class="sticky-act">الإجراءات</th>
            </tr>`;
          tbodyRowsHtml = slice.map(u => {
            const isInv = isInvestorUser(u);
            const invBadge = isInv ? `<button type="button" class="btn btn-ghost" data-act="jump-to-investor" data-id="${u.id}" style="padding:1px 6px;font-size:10px;background:#FEF3C7;color:#92400E;border:1px solid #FCD34D;border-radius:6px;display:inline-flex;align-items:center;gap:3px;cursor:pointer;font-weight:700" title="الانتقال المباشر لملف المستثمر والعقود">💼 مستثمر مسجل ↗</button>` : '';
            return `
            <tr class="${activeUserMenuId === u.id ? 'row-has-open-menu' : ''}">
              <td><input type="checkbox" class="uchk" value="${u.id}"></td>
              <td>
                <div style="display:flex;align-items:center;gap:10px">
                  <div style="width:38px;height:38px;border-radius:50%;overflow:hidden;background:#F0FDF4;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;border:1.5px solid #16A34A">
                    ${u.avatar ? `<img src="${u.avatar}" style="width:100%;height:100%;object-fit:cover" alt="${escapeHtml(u.name)}" />` : `🚜`}
                  </div>
                  <div>
                    <div style="font-weight:800;color:var(--text);font-size:13.5px;line-height:1.2;display:flex;align-items:center;gap:6px">
                      <span>${escapeHtml(u.name)}</span>
                      ${invBadge}
                    </div>
                    <div style="display:flex;align-items:center;gap:6px;margin-top:3px;flex-wrap:wrap">
                      ${(Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : [u.role]).map(r => `<span class="status ${r === 'engineer' ? 'badge-ok' : r === 'investor' ? 'st-sync' : 'st-wait'}" style="padding:1px 6px;font-size:10.5px">${roleLabel(r)}</span>`).join(" ")}
                      <span class="muted" style="font-family:monospace;font-size:11px">@${escapeHtml(u.user)}</span>
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <div style="font-weight:700;font-size:13px;direction:ltr;text-align:right">${escapeHtml(u.phone || "—")}</div>
                <div style="margin-top:2px;font-size:11.5px">
                  ${u.bloodType ? `<span style="color:#DC2626;font-weight:800">🩸 ${escapeHtml(u.bloodType)}</span>` : `<span class="muted">فصيلة غير مسجلة</span>`}
                </div>
              </td>
              <td class="scope-cell">${scopeChips(u)}</td>
              <td>
                <div style="display:flex;align-items:center;gap:6px">
                  ${u.active === false ? `<span class="status" style="background:#FEE2E2;color:#991B1B;padding:2px 8px;font-size:11px">معطل</span>` : `<span class="status badge-ok" style="padding:2px 8px;font-size:11px">نشط</span>`}
                  <button class="btn btn-ghost btn-sm" data-act="open-id-card-user" data-id="${u.id}" style="padding:2px 6px;font-size:11px" title="معاينة بطاقة العمل الميدانية">🪪 بطاقة ID</button>
                </div>
                <div class="muted" style="font-size:11px;margin-top:3px">${u.lastSeen ? fmtDate(u.lastSeen) : "لم يسجل دخول"}</div>
              </td>
              <td class="sticky-act ${activeUserMenuId === u.id ? 'has-open-menu' : ''}">
                ${(isEng && u.role !== 'worker' && u.id !== me?.id) ? `<span class="muted" style="font-size:11px;padding:3px 8px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:6px;display:inline-block">👁️ عرض فقط</span>` : `
                <div class="action-menu-wrap">
                  <button class="action-menu-btn ${activeUserMenuId === u.id ? 'active' : ''}" data-act="toggle-user-menu" data-id="${u.id}" title="خيارات وإجراءات الكادر الميداني">
                    <span class="dots-icon">⋮</span>
                    <span>الإجراءات</span>
                  </button>
                  ${activeUserMenuId === u.id ? renderUserActionDropdown(u, me, isEng, canDelUser, st) : ''}
                </div>`}
              </td>
            </tr>`;
          }).join("");
        } else {
          theadHtml = `
            <tr>
              <th style="width:36px"><input type="checkbox" id="uall"></th>
              <th>المستخدم والدور الوظيفي</th>
              <th>الجوال وفصيلة الدم</th>
              <th>النطاق الميداني / الإشراف</th>
              <th>الحالة وآخر ظهور</th>
              <th class="sticky-act">الإجراءات</th>
            </tr>`;
          tbodyRowsHtml = slice.map(u => {
            const isInv = isInvestorUser(u);
            const invBadge = isInv ? `<button type="button" class="btn btn-ghost" data-act="jump-to-investor" data-id="${u.id}" style="padding:1px 6px;font-size:10px;background:#FEF3C7;color:#92400E;border:1px solid #FCD34D;border-radius:6px;display:inline-flex;align-items:center;gap:3px;cursor:pointer;font-weight:700" title="الانتقال المباشر لملف المستثمر والعقود">💼 مستثمر مسجل ↗</button>` : '';
            return `
              <tr class="${activeUserMenuId === u.id ? 'row-has-open-menu' : ''}">
                <td><input type="checkbox" class="uchk" value="${u.id}"></td>
                <td>
                  <div style="display:flex;align-items:center;gap:10px">
                    <div style="width:38px;height:38px;border-radius:50%;overflow:hidden;background:#E2E8F0;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;border:1.5px solid ${isInv ? '#D97706' : '#16A34A'}">
                      ${u.avatar ? `<img src="${u.avatar}" style="width:100%;height:100%;object-fit:cover" alt="${escapeHtml(u.name)}" />` : `👤`}
                    </div>
                    <div>
                      <div style="font-weight:800;color:var(--text);font-size:13.5px;line-height:1.2;display:flex;align-items:center;gap:6px">
                        <span>${escapeHtml(u.name)}</span>
                        ${invBadge}
                      </div>
                      <div style="display:flex;align-items:center;gap:6px;margin-top:3px;flex-wrap:wrap">
                        ${(Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : [u.role]).map(r => `<span class="status ${r === 'admin' ? 'badge-ok' : r === 'investor' ? 'st-sync' : 'st-wait'}" style="padding:1px 6px;font-size:10.5px">${roleLabel(r)}</span>`).join(" ")}
                        <span class="muted" style="font-family:monospace;font-size:11px">@${escapeHtml(u.user)}</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <div style="font-weight:700;font-size:13px;direction:ltr;text-align:right">${escapeHtml(u.phone || "—")}</div>
                  <div style="margin-top:2px;font-size:11.5px">
                    ${u.bloodType ? `<span style="color:#DC2626;font-weight:800">🩸 ${escapeHtml(u.bloodType)}</span>` : `<span class="muted">فصيلة غير مسجلة</span>`}
                  </div>
                </td>
                <td class="scope-cell">${scopeChips(u)}</td>
                <td>
                  <div>
                    ${u.active === false ? `<span class="status" style="background:#FEE2E2;color:#991B1B;padding:2px 8px;font-size:11px">معطل</span>` : `<span class="status badge-ok" style="padding:2px 8px;font-size:11px">نشط</span>`}
                  </div>
                  <div class="muted" style="font-size:11px;margin-top:3px">${u.lastSeen ? fmtDate(u.lastSeen) : "لم يسجل دخول"}</div>
                </td>
                <td class="sticky-act ${activeUserMenuId === u.id ? 'has-open-menu' : ''}">
                  ${(isEng && u.role !== 'worker' && u.id !== me?.id) ? `<span class="muted" style="font-size:11px;padding:3px 8px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:6px;display:inline-block">👁️ عرض فقط</span>` : `
                  <div class="action-menu-wrap">
                    <button class="action-menu-btn ${activeUserMenuId === u.id ? 'active' : ''}" data-act="toggle-user-menu" data-id="${u.id}" title="خيارات وإجراءات الحساب">
                      <span class="dots-icon">⋮</span>
                      <span>الإجراءات</span>
                    </button>
                    ${activeUserMenuId === u.id ? renderUserActionDropdown(u, me, isEng, canDelUser, st) : ''}
                  </div>`}
                </td>
              </tr>
            `;
          }).join("");
        }

        return `<div class="muted">${list.length} حساب — صفحة ${userPage}/${pages}</div>
      <div class="grid-wrap" style="overflow-x:auto"><table class="dense" style="width:100%;table-layout:auto">
        <thead>${theadHtml}</thead>
        <tbody>${tbodyRowsHtml}</tbody>
      </table></div>
      <div class="pager">
        <button class="btn btn-ghost icon-btn" data-act="user-page" data-id="${Math.max(1,userPage-1)}">السابق</button>
        <span>${userPage}/${pages}</span>
        <button class="btn btn-ghost icon-btn" data-act="user-page" data-id="${Math.min(pages,userPage+1)}">التالي</button>
      </div>`;
      })()}
    </div>`}`;
}

const draftScope = new Set();
function scopeOptionList() {
  const st = Store.get();
  const q = ($("#scopeq")?.value || "").toLowerCase();
  let html = `<option value="">أضف قطاعاً كاملاً أو قطعة…</option>`;
  const me = session();
  const isEng = me && me.role === "engineer";
  const allowedPlots = isEng ? (me.plots || []) : null;

  st.sectors.forEach(s => {
    let plots = st.plots.filter(p => p.sector === s.id);
    if (allowedPlots) plots = plots.filter(p => allowedPlots.includes(p.id));
    if (!plots.length) return;
    const label = `${s.name} — كامل القطاع (${plots.length})`;
    if (!isEng && (!q || label.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)))
      html += `<option value="SEC:${s.id}">${label}</option>`;
    plots.forEach(p => {
      const t = `${p.id} — ${p.name}`;
      if (!q || t.toLowerCase().includes(q)) html += `<option value="${p.id}">${t}</option>`;
    });
  });
  return html;
}

function scopeTagHtml() {
  const st = Store.get();
  if (!draftScope.size) return `<span class="muted">لم يُحدد نطاق بعد</span>`;
  const bySec = {};
  [...draftScope].forEach(id => {
    const p = st.plots.find(x => x.id === id);
    const sec = p?.sector || "—";
    bySec[sec] = bySec[sec] || [];
    bySec[sec].push(id);
  });
  return Object.keys(bySec).map(sec => {
    const all = st.plots.filter(p => p.sector === sec);
    const ids = bySec[sec];
    if (all.length && ids.length === all.length)
      return `<span class="chip">${sectorName(sec)} كاملاً <button type="button" class="chip-x" data-act="scope-drop-sec" data-id="${sec}">×</button></span>`;
    return ids.map(id => `<span class="chip">${id} <button type="button" class="chip-x" data-act="scope-drop" data-id="${id}">×</button></span>`).join("");
  }).join("");
}

function paintScopePicker() {
  if ($("#scopeadd")) $("#scopeadd").innerHTML = scopeOptionList();
  if ($("#scopetags")) $("#scopetags").innerHTML = scopeTagHtml();
  if ($("#scopecount")) $("#scopecount").textContent = draftScope.size + " قطعة محددة";
}

function scopePickerHtml(initial, targetUser) {
  draftScope.clear();
  (initial || []).forEach(id => draftScope.add(id));
  const isInvestor = targetUser && ((targetUser.roles || []).includes('investor') || targetUser.role === 'investor');
  return `<div class="card" style="background:var(--green-l)">
    <h3>🚜 النطاق الميداني لمهام العمل (خاص بدور العامل/الفني والمهندس فقط)</h3>
    <p class="muted">أضف قطاعاً كاملاً أو قطعة واحدة. يحدد هذا النطاق مهام العمل والعمليات الحقلية المكلف بها العامل/الفني.</p>
    ${isInvestor ? `
      <div style="background:#FEF3C7;border:1.5px solid #F59E0B;border-radius:10px;padding:12px 14px;margin-bottom:12px;display:flex;align-items:flex-start;gap:10px">
        <span style="font-size:20px;line-height:1">ℹ️</span>
        <div style="font-size:13px;line-height:1.6;color:#92400E">
          <b style="color:#78350F;display:block;margin-bottom:2px">نطاق الاستثمار والملكية:</b>
          مُدار ومربوط تلقائياً بموجب عقود الاستثمار المعتمدة للمستخدم، ولا يتأثر بإضافة أو حذف نطاقات العمل الميداني أعلاه.
        </div>
      </div>
    ` : ''}
    <input id="scopeq" placeholder="ابحث باسم القطاع أو رقم القطعة" />
    <div class="actions">
      <select id="scopeadd">${scopeOptionList()}</select>
      <button class="btn btn-ghost icon-btn" data-act="scope-add">إضافة</button>
      <button class="btn btn-ghost icon-btn" data-act="scope-clear">مسح الكل</button>
    </div>
    <div id="scopetags" class="scope-box" style="margin-top:10px">${scopeTagHtml()}</div>
    <div class="muted" id="scopecount">${draftScope.size} قطعة محددة</div>
  </div>`;
}

let activeUserEditTab = "basic";

function userEditView(id) {
  const st = Store.get();
  const u = st.users.find(x => x.id === id);
  if (!u) return `<div class="card">غير موجود</div>`;
  const me = session();
  const isEng = me && me.role === "engineer";
  const userRoles = Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : [u.role];
  const isInvestor = u.role === "investor" || userRoles.includes("investor") || (st.investors || []).some(inv => (inv.phone && u.phone && inv.phone.replace(/[^0-9]/g, '') === u.phone.replace(/[^0-9]/g, '')) || String(inv.user_id) === String(u.id));

  return `<div class="page-head">
      <div>
        <h3>تعديل بيانات وصلاحيات: ${escapeHtml(u.name)}</h3>
        <div class="muted">إدارة حساب الدخول، النطاق الميداني، ومصفوفة الصلاحيات</div>
      </div>
      <div class="actions" style="margin:0">
        <button class="btn btn-primary" data-act="save-user" data-id="${u.id}">💾 حفظ التغييرات</button>
        <button class="btn btn-ghost icon-btn" data-go="users">عودة</button>
      </div>
    </div>

    <!-- 3 Internal Horizontal Tabs -->
    <div class="card" style="padding:8px 12px;margin-bottom:14px;border-radius:12px;background:#fff;border:1px solid #E2E8F0">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn user-edit-nav-btn ${activeUserEditTab==='basic'?'btn-primary':'btn-ghost'}" data-act="switch-user-edit-tab" data-id="basic" style="font-weight:700;padding:6px 16px;border-radius:8px">
          👤 بيانات الحساب والدور
        </button>
        <button type="button" class="btn user-edit-nav-btn ${activeUserEditTab==='scope'?'btn-primary':'btn-ghost'}" data-act="switch-user-edit-tab" data-id="scope" style="font-weight:700;padding:6px 16px;border-radius:8px">
          🗺️ نطاق العمل الميداني
        </button>
        <button type="button" class="btn user-edit-nav-btn ${activeUserEditTab==='perms'?'btn-primary':'btn-ghost'}" data-act="switch-user-edit-tab" data-id="perms" style="font-weight:700;padding:6px 16px;border-radius:8px">
          🛡️ مصفوفة الصلاحيات
        </button>
      </div>
    </div>

    <!-- Tab 1: Basic Info & Role -->
    <div id="user-tab-pane-basic" style="display:${activeUserEditTab==='basic'?'block':'none'}">
      ${isInvestor ? `
        <div style="background:#FFFBEB;border:1.5px solid #F59E0B;border-radius:12px;padding:12px 18px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;box-shadow:0 1px 3px rgba(245,158,11,0.08)">
          <div style="display:flex;align-items:center;gap:12px">
            <span style="font-size:24px">💼</span>
            <div>
              <div style="font-weight:800;color:#92400E;font-size:14px">هذا الحساب مسجل كمستثمر وشريك بالمنظومة</div>
              <div style="font-size:12px;color:#B45309;margin-top:2px">بيانات العقود، النخيل المملوك، وحصص الأرباح والزكاة تُدار مركزياً وبشكل مستقل في موديول المستثمرين.</div>
            </div>
          </div>
          <button type="button" class="btn btn-ghost" data-act="jump-to-investor" data-id="${u.id}" style="background:#fff;border:1.5px solid #D97706;color:#92400E;font-weight:700;font-size:12.5px;padding:6px 14px;border-radius:8px">
            💼 فتح ملف المستثمر والعقود ↗
          </button>
        </div>
      ` : ''}

      <div class="card" style="border-radius:12px;padding:18px">
        <h4 style="margin:0 0 14px;font-size:15px;color:var(--text);font-weight:800">بيانات المستخدم وحساب الدخول</h4>
        <div class="grid grid-2">
          <div><label>الاسم الكامل</label><input id="uname" value="${escapeHtml(u.name||"")}" /></div>
          <div><label>اسم الدخول (Username)</label><input id="uuser" value="${escapeHtml(u.user||"")}" /></div>
          <div><label>رقم الجوال</label><input id="uphone" value="${escapeHtml(u.phone||"")}" /></div>
          <div><label>فصيلة الدم (للطوارئ وبطاقة العمل)</label>
            <select id="ublood">
              <option value="">-- غير محددة --</option>
              ${["O+", "A+", "B+", "AB+", "O-", "A-", "B-", "AB-"].map(bt => `<option value="${bt}" ${(u.bloodType||"")===bt?"selected":""}>${bt}</option>`).join("")}
            </select>
          </div>
          <div><label>الدور الأساسي</label>
            <select id="urole">
              ${isEng ? `<option value="worker" ${u.role==="worker"?"selected":""}>عامل ميداني</option>` : st.roles.map(r=>`<option value="${r.id}" ${u.role===r.id?"selected":""}>${r.name}</option>`).join("")}
            </select>
          </div>
          ${isEng ? "" : `
          <div style="grid-column: 1 / -1">
            <label style="font-weight:700;color:#0F172A;margin-bottom:6px;display:block">
              🎭 الأدوار الممنوحة للحساب (تعدد الأدوار لنفس الحساب Multi-Role Architecture)
            </label>
            <div style="display:flex;flex-wrap:wrap;gap:8px;padding:12px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px">
              ${(st.roles || []).map(r => {
                const isChecked = userRoles.includes(r.id);
                return `<label style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:#fff;border:1.5px solid ${isChecked ? '#0284C7' : '#CBD5E1'};border-radius:8px;font-size:13px;cursor:pointer;user-select:none;box-shadow:0 1px 2px rgba(0,0,0,0.04)">
                  <input type="checkbox" class="user-role-chk" value="${r.id}" ${isChecked ? 'checked' : ''} style="width:16px;height:16px;accent-color:#0284C7" />
                  <span style="font-weight:${isChecked ? 'bold' : 'normal'};color:${isChecked ? '#0369A1' : '#334155'}">${r.name}</span>
                </label>`;
              }).join("")}
            </div>
            <div class="muted" style="font-size:11px;margin-top:5px">
              💡 يتيح تحديد أكثر من دور (مثلاً: عامل ميداني + مستثمر) للمستخدم التبديل السلس والسريع بين أدواره بنقرة زر ودون الحاجة لتسجيل الخروج.
            </div>
          </div>
          `}
          <div><label>نطاق رؤية الأسمدة والمخزون (Inventory Scope)</label>
            <select id="uinventory_scope">
              <option value="" ${!u.inventoryScope ? "selected" : ""}>افتراضي حسب الدور (${inventoryScopeLabel(getEffectiveInventoryScope({ ...u, inventoryScope: null }))})</option>
              <option value="personal" ${u.inventoryScope==="personal"?"selected":""}>🔒 عهدة المستخدم الشخصية فقط (Personal Custody) — للعمال الميدانيين</option>
              <option value="sector" ${u.inventoryScope==="sector"?"selected":""}>📂 عهدة قطاعات وإشراف المستخدم (Sector Custody) — للمهندسين المشرفين</option>
              <option value="all" ${u.inventoryScope==="all"?"selected":""}>🏬 المستودع العام والمخزون المركزي (Full Warehouse) — للإدارة وأمناء المخازن</option>
            </select>
          </div>
          <div style="grid-column: 1 / -1">
            <label>الصورة الشخصية للموظف (تظهر في بطاقة العمل ID Card)</label>
            <div class="avatar-upload-box">
              <div class="avatar-preview-circle" id="edit-user-avatar-prev">
                ${u.avatar ? `<img src="${u.avatar}" alt="Avatar" />` : `👤`}
              </div>
              <div class="avatar-upload-acts">
                <input type="file" id="uavatar_input" class="avatar-file-input" data-prev="edit-user-avatar-prev" data-val="uavatar_val" accept="image/*" style="display:none" />
                <input type="hidden" id="uavatar_val" value="${escapeHtml(u.avatar || '')}" />
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                  <button type="button" class="btn btn-ghost icon-btn" data-act="trigger-avatar-upload" data-target="uavatar_input">📷 تغيير / رفع صورة</button>
                  <button type="button" class="btn btn-ghost icon-btn text-danger" data-act="clear-avatar" data-prev="edit-user-avatar-prev" data-val="uavatar_val" style="color:#DC2626">🗑️ إزالة الصورة</button>
                </div>
                <div class="muted" style="font-size:11px">تُحفظ وتُضغط تلقائياً لاستخدامها ببطاقة العمل الميدانية وأوفلاين</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab 2: Field Operational Scope -->
    <div id="user-tab-pane-scope" style="display:${activeUserEditTab==='scope'?'block':'none'}">
      ${scopePickerHtml(u.plots||[], u)}
    </div>

    <!-- Tab 3: Permissions Matrix -->
    <div id="user-tab-pane-perms" style="display:${activeUserEditTab==='perms'?'block':'none'}">
      ${userMatrixTableHtml(u, u.role)}
    </div>

    <!-- Bottom Unified Save Bar -->
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-top:16px;padding:12px 18px;background:#F8FAFC;border:1.5px solid #CBD5E1;border-radius:12px">
      <div class="muted" style="font-size:12px;font-weight:600">
        💾 يتم حفظ كافة تعديلات التبويبات الثلاثة (البيانات، النطاق الميداني، ومصفوفة الصلاحيات) بنقرة واحدة.
      </div>
      <button class="btn btn-primary" data-act="save-user" data-id="${u.id}" style="padding:9px 24px;font-size:13.5px;font-weight:700">💾 حفظ البيانات والصلاحيات والنطاق</button>
    </div>`;
}

function userNewView() {
  const st = Store.get();
  const me = session();
  const isEng = me && me.role === "engineer";
  const defRole = isEng ? "worker" : (st.roles[0]?.id || "worker");

  return `<div class="page-head">
      <h3>${isEng ? "إضافة عامل ميداني جديد" : "مستخدم جديد"}</h3>
      <button class="btn btn-ghost icon-btn" data-go="users">إلغاء وعودة</button>
    </div>
    <div class="card">
      <h3>البيانات الأساسية</h3>
      <div class="grid grid-2">
        <div><label>الاسم الكامل</label><input id="uname" placeholder="مثال: أحمد الميداني" /></div>
        <div><label>اسم الدخول (Username)</label><input id="uuser" placeholder="مثال: ahmed_worker" /></div>
        <div><label>البريد الإلكتروني (اختياري)</label><input id="uemail" type="email" placeholder="ahmed@farm.com" /></div>
        <div><label>رقم الجوال (لإرسال بيانات الدخول بالواتساب)</label><input id="uphone" placeholder="010XXXXXXXX" /></div>
        <div><label>فصيلة الدم (للطوارئ وبطاقة العمل)</label>
          <select id="ublood">
            <option value="">-- غير محددة --</option>
            ${["O+", "A+", "B+", "AB+", "O-", "A-", "B-", "AB-"].map(bt => `<option value="${bt}">${bt}</option>`).join("")}
          </select>
        </div>
        <div style="grid-column: 1 / -1">
          <label>الصورة الشخصية للموظف (تظهر في بطاقة العمل ID Card)</label>
          <div class="avatar-upload-box">
            <div class="avatar-preview-circle" id="new-user-avatar-prev">
              👤
            </div>
            <div class="avatar-upload-acts">
              <input type="file" id="new_uavatar_input" class="avatar-file-input" data-prev="new-user-avatar-prev" data-val="new_uavatar_val" accept="image/*" style="display:none" />
              <input type="hidden" id="new_uavatar_val" value="" />
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button type="button" class="btn btn-ghost icon-btn" data-act="trigger-avatar-upload" data-target="new_uavatar_input">📷 رفع صورة شخصية</button>
                <button type="button" class="btn btn-ghost icon-btn text-danger" data-act="clear-avatar" data-prev="new-user-avatar-prev" data-val="new_uavatar_val" style="color:#DC2626">🗑️ مسح</button>
              </div>
              <div class="muted" style="font-size:11px">تُحفظ وتُضغط تلقائياً لاستخدامها ببطاقة العمل الميدانية وأوفلاين</div>
            </div>
          </div>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <label style="margin:0">كلمة المرور المؤقتة</label>
            <button type="button" class="btn btn-ghost icon-btn" data-act="gen-temp-pass" style="padding:2px 8px;font-size:11px">⚡ توليد عشوائي</button>
          </div>
          <input id="upass" value="Palm#2026!xK" />
        </div>
        <div><label>الدور الوظيفي الأساسي</label>
          <select id="urole">
            ${isEng ? `<option value="worker">عامل ميداني</option>` : st.roles.map(r=>`<option value="${r.id}">${r.name}</option>`).join("")}
          </select>
        </div>
        ${isEng ? "" : `
        <div style="grid-column: 1 / -1">
          <label style="font-weight:700;color:#0F172A;margin-bottom:6px;display:block">
            🎭 الأدوار الممنوحة للحساب (تعدد الأدوار لنفس الحساب Multi-Role Architecture)
          </label>
          <div style="display:flex;flex-wrap:wrap;gap:8px;padding:12px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px">
            ${(st.roles || []).map(r => {
              const isChecked = r.id === defRole;
              return `<label style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:#fff;border:1.5px solid ${isChecked ? '#0284C7' : '#CBD5E1'};border-radius:8px;font-size:13px;cursor:pointer;user-select:none;box-shadow:0 1px 2px rgba(0,0,0,0.04)">
                <input type="checkbox" class="user-role-chk" value="${r.id}" ${isChecked ? 'checked' : ''} style="width:16px;height:16px;accent-color:#0284C7" />
                <span style="color:#334155">${r.name}</span>
              </label>`;
            }).join("")}
          </div>
          <div class="muted" style="font-size:11px;margin-top:5px">
            💡 يمكنك منح المستخدم أكثر من دور في نفس الوقت (مثل: مستثمر + عامل).
          </div>
        </div>
        `}
        <div><label>حالة الحساب</label><select id="uactive"><option value="1">نشط</option><option value="0">معطّل</option></select></div>
        <div><label>نطاق رؤية الأسمدة والمخزون (Inventory Scope)</label>
          <select id="uinventory_scope">
            <option value="">افتراضي حسب الدور الوظيفي</option>
            <option value="personal">🔒 عهدة المستخدم الشخصية فقط (Personal Custody) — للعمال الميدانيين</option>
            <option value="sector">📂 عهدة قطاعات وإشراف المستخدم (Sector Custody) — للمهندسين المشرفين</option>
            <option value="all">🏬 المستودع العام والمخزون المركزي (Full Warehouse) — للإدارة وأمناء المخازن</option>
          </select>
        </div>
        <div style="grid-column: 1 / -1; margin-top: 6px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:700;color:var(--green-d);margin:0">
            <input type="checkbox" id="umust_change" checked style="width:18px;height:18px" />
            <span>إجبار المستخدم على تغيير كلمة المرور عند أول تسجيل دخول (إجراء أمني موصى به)</span>
          </label>
        </div>
      </div>
    </div>
    ${scopePickerHtml([])}
    ${userMatrixTableHtml(null, defRole)}
    <button class="btn btn-primary" data-act="add-user" style="margin-top:10px">حفظ المستخدم والصلاحيات</button>`;
}

function rolesView() {
  const st = Store.get();
  const rid = editRoleId || st.roles[0]?.id;
  const role = st.roles.find(r => r.id === rid) || st.roles[0];
  const matrixRows = crudScreens.map(([id, n]) => `<tr>
      <td><label style="cursor:pointer" title="تحديد كامل الصلاحيات لهذه الشاشة"><input type="checkbox" class="mx-row" data-s="${id}"> <b>${n}</b></label></td>
      ${["r","c","e","d","a"].map(k => `<td><input type="checkbox" class="rmx" data-s="${id}" data-k="${k}" ${mxChecked(role,id,k)?"checked":""}></td>`).join("")}
    </tr>`).join("");
  return `<div class="page-head"><h3>الأدوار ومصفوفة الصلاحيات</h3>
      <button class="btn btn-ghost icon-btn" data-go="users">رجوع للدليل</button></div>
    <div class="card">
      <div class="grid-wrap"><table class="dense mx-table">
        <thead><tr><th>الموديول</th>${st.roles.map(r=>`<th>${r.name}</th>`).join("")}</tr></thead>
        <tbody>${crudScreens.map(([id,n]) => `<tr>
          <td>${n}</td>
          ${st.roles.map(r => `<td>${mxChecked(r,id,"r")?"✓":"—"}</td>`).join("")}
        </tr>`).join("")}</tbody>
      </table></div>
    </div>
    <div class="card" style="margin-top:12px">
      <div class="role-active-badge" style="background:#f0fdf4;border:1.5px solid #16a34a;border-radius:10px;padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:24px">🛡️</span>
          <div>
            <div style="font-size:12px;color:#166534;font-weight:600">أنت تقوم الآن بتعديل وضبط صلاحيات الدور:</div>
            <b style="font-size:16px;color:#14532d" id="activeRoleName">${role ? role.name : ''}</b> <code class="code-chip" id="activeRoleCode" style="font-size:12px;background:#dcfce7;color:#166534">${role ? role.id : ''}</code>
          </div>
        </div>
        <span class="status badge-ok" style="font-size:12px">مفعّل بالمنظومة</span>
      </div>
      <h3>إضافة / تحرير دور</h3>
      <div class="role-grid">
        <div>
          <label>الدور القائم للتحرير</label>
          <select id="erole">${st.roles.map(r=>`<option value="${r.id}" ${r.id===rid?"selected":""}>${r.name}</option>`)}</select>
          <label>اسم الدور الوظيفي</label><input id="rname" value="${role ? role.name : ''}" placeholder="مشرف عمليات ميدانية" />
          <label>كود الدور البرمجي (Role Code)</label><input id="rid" value="${role ? role.id : ''}" placeholder="field_ops" />
          <label>الوصف المهني والمسؤوليات</label><input id="rdesc" value="${role ? (role.desc||'') : ''}" placeholder="متابعة العمليات الزراعية ورعاية النخيل" />
          <p class="muted">اختر دوراً قائماً من القائمة لتعديل صلاحياته، أو اكتب اسماً وكوداً جديدين لإنشاء دور وظيفي مخصص.</p>
        </div>
        <div>
          <div class="actions">
            <button class="btn btn-ghost icon-btn" data-act="mx-all">تحديد كل القراءة</button>
            <button class="btn btn-ghost icon-btn" data-act="mx-clear">مسح المصفوفة</button>
          </div>
          <div class="grid-wrap"><table class="dense mx-table">
            <thead><tr>
              <th>الشاشة / الموديول [تحديد كامل الصلاحيات للشاشة]</th><th>قراءة</th><th>إضافة</th><th>تعديل</th><th>حذف</th><th>اعتماد</th>
            </tr></thead>
            <tbody>
              <tr style="background:#f8fafc;font-weight:700">
                <td>كافة الموديولات (تحديد عمودي شامل)</td>
                ${["r","c","e","d","a"].map(k=>`<td><input type="checkbox" class="mx-col" data-k="${k}"></td>`).join("")}
              </tr>
              ${matrixRows}
            </tbody>
          </table></div>
        </div>
      </div>
      <div class="actions" style="margin-top:12px;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary" data-act="add-role">حفظ كدور جديد</button>
        <button class="btn btn-ghost" data-act="save-role-perms">حفظ وتأكيد صلاحيات الدور المحدد</button>
        ${role && !['admin', 'super_admin', 'engineer', 'worker', 'investor', 'nursery_mgr', 'warehouse_mgr', 'customer_care', 'tenant_user'].includes(role.id) ? `<button class="btn btn-ghost icon-btn" data-act="delete-role" data-id="${role.id}" style="color:#DC2626;border:1px solid #FCA5A5;font-weight:700">🗑️ حذف هذا الدور المخصص</button>` : ''}
      </div>
    </div>`;
}

function exportPlotPalmsRoundTrip(targetPlotId) {
  if (!hasPerm("plots_export")) return toast("ليس لديك صلاحية تصدير واستيراد بيانات القطع (Round-Trip)");
  if (!targetPlotId) {
    return toast("يرجى تحديد القطعة أولاً لتصدير بياناتها", "warn");
  }
  const st = Store.get();
  const normPlot = normalizePlotCode(targetPlotId);
  const matchingPlots = (st.plots || []).filter(p => normalizePlotCode(p.id) === normPlot || normalizePlotCode(p.parentPlotId) === normPlot || p.id === targetPlotId);
  const plotIdSet = new Set(matchingPlots.map(p => p.id));
  plotIdSet.add(targetPlotId);
  plotIdSet.add(normPlot);

  const palms = (st.palms || []).filter(p => !p.archived && (plotIdSet.has(p.plot) || normalizePlotCode(p.plot) === normPlot));
  if (!palms.length) {
    return toast(`لا توجد أشجار مسجلة في القطعة (${targetPlotId}) لتصديرها`, "warn");
  }

  const headers = [
    "الكود", "المحصول", "المصدر", "الصنف", "القطعة", "التسلسل",
    "تاريخ_الزراعة", "مصدر_التفصيلي", "المورد", "ملاحظات", "الموقع",
    "الحالة", "كود_الفسيلة_الأصلية", "تاريخ_القلع", "عمر_المشتل"
  ];

  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = [headers.join(",")];
  palms.forEach(p => {
    const cropName = p.cropId === "olive" ? "زيتون" : "نخيل";
    let gpsStr = p.gps || "";
    if (!gpsStr && p.gps_lat && p.gps_lng) {
      gpsStr = `${p.gps_lat}, ${p.gps_lng}`;
    }
    const r = [
      escapeCSV(p.code),
      escapeCSV(cropName),
      escapeCSV(p.source || "F"),
      escapeCSV(p.variety || ""),
      escapeCSV(p.plot || targetPlotId),
      escapeCSV(p.seq || ""),
      escapeCSV(p.plantDate || ""),
      escapeCSV(p.originType || "internal"),
      escapeCSV(p.supplier || ""),
      escapeCSV(p.notes || ""),
      escapeCSV(gpsStr),
      escapeCSV(p.status || "سليمة"),
      escapeCSV(p.parentCode || ""),
      escapeCSV(p.offshootDate || ""),
      escapeCSV(p.nurseryAgeMonths || "")
    ];
    rows.push(r.join(","));
  });

  const csvContent = "\uFEFF" + rows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `قالب_تعديل_نخيل_${targetPlotId}_(${palms.length}_شجرة).csv`;
  a.click();
  toast(`✓ تم تصدير ${palms.length} شجرة في قالب التعديل وإعادة الرفع بنجاح`);
}
window.exportPlotPalmsRoundTrip = exportPlotPalmsRoundTrip;

function clearPlotGps(targetPlotId) {
  if (!hasPerm("plots_gps_clear")) return toast("ليس لديك صلاحية تصفير وحذف إحداثيات GPS للقطع");
  if (!targetPlotId) return;
  const normPlot = normalizePlotCode(targetPlotId);
  const st = Store.get();
  const matchingPalms = (st.palms || []).filter(p => !p.archived && (p.plot === targetPlotId || normalizePlotCode(p.plot) === normPlot));
  const countWithGps = matchingPalms.filter(p => (p.gps_lat !== null && p.gps_lat !== undefined) || (p.gps && p.gps.trim() !== '')).length;
  if (countWithGps === 0) {
    return toast(`لا توجد إحداثيات مسجلة على الخريطة لنخيل القطعة (${targetPlotId})`, "info");
  }

  if (!confirm(`هل أنت متأكد من تفريغ كافة إحداثيات الخريطة لـ (${countWithGps}) شجرة تابعة للقطعة (${targetPlotId})؟\n\nسيتم إزالة النقاط من الخريطة مع الحفاظ على كامل بيانات وسجلات الأشجار.`)) {
    return;
  }

  matchingPalms.forEach(p => {
    p.gps_lat = null;
    p.gps_lng = null;
    p.gps = "";
  });
  Store.set({ palms: st.palms });

  // Call backend to persist
  fetch(`/api/plots/${encodeURIComponent(targetPlotId)}/clear-coordinates`, { method: "POST" })
    .catch(() => {});
  if (typeof Api !== "undefined" && typeof Api.syncAllToDatabase === "function") {
    Api.syncAllToDatabase();
  }

  toast(`✓ تم تفريغ إحداثيات الخريطة لـ ${countWithGps} شجرة بنجاح`);
  render();
}
window.clearPlotGps = clearPlotGps;

function importView() {
  if (!hasPerm("palms_import")) {
    return `<div class="card" style="text-align:center;padding:24px">
      <h3>⚠️ غير مصرح</h3>
      <p class="muted">ليس لديك صلاحية استيراد ملفات الأشجار والمحاصيل.</p>
      <button class="btn btn-primary" data-act="back" style="margin-top:10px">رجوع</button>
    </div>`;
  }
  const st = Store.get();
  const allPlots = (st.plots || []).filter(p => !p.parentPlotId || (p.part || p.part_letter));

  return `${palmsTabs()}<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">
      <div>
        <h3 style="margin:0">📥 معالج استيراد وتحديث الأشجار والمحاصيل (Round-Trip)</h3>
        <p class="muted" style="margin:4px 0 0;font-size:12.5px">يدعم استيراد النخيل والزيتون، التحديث التراكمي الذكي (Upsert)، التفريغ الصريح للإحداثيات، وفحص الحدود الجغرافية.</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-ghost" data-act="dl-tpl" style="display:inline-flex;align-items:center;gap:6px">
          <span>📄</span> تحميل النموذج الفارغ
        </button>
      </div>
    </div>

    <!-- Section 1: Round-Trip Export -->
    <div style="background:#F0F9FF;border:1px solid #BAE6FD;border-radius:12px;padding:14px;margin-bottom:16px">
      <div style="font-weight:700;color:#0369A1;margin-bottom:6px;display:flex;align-items:center;gap:6px">
        <span>🔄</span> <b>دورة البيانات المغلقة: تصدير نخيل قطعة للتعديل الخارجي ثم إعادة رفعه</b>
      </div>
      <div style="font-size:12.5px;color:#0C4A6E;line-height:1.5;margin-bottom:10px">
        اختر القطعة لتنزيل كامل بيانات نخيلها وإحداثياتها بقالب مطابق 100%، عدّل ما ترغب فيه في برنامج الإكسل، ثم أعد رفعه بالأسفل:
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <select id="export_plot_select" style="max-width:320px;padding:6px 12px;font-size:13px">
          <option value="">-- اختر القطعة للتصدير --</option>
          ${allPlots.map(pl => `<option value="${pl.id}">${pl.name} (${pl.id})</option>`).join("")}
        </select>
        <button type="button" class="btn btn-primary" data-act="trigger-export-selected-plot" style="display:inline-flex;align-items:center;gap:6px">
          <span>📥</span> تصدير بيانات القطعة للتعديل (CSV)
        </button>
      </div>
    </div>

    <!-- Section 2: Upload & Mode Options -->
    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:14px;margin-bottom:14px">
      <div style="font-weight:700;color:#1E293B;margin-bottom:8px">⚙️ خيارات المعالجة عند الرفع:</div>
      <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap;font-size:13px">
        <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;margin:0">
          <input type="radio" name="import_mode" value="upsert" checked />
          <span><b>تحديث وإضافة تراكمي (Smart Upsert):</b> يحدّث السجلات الموجودة ويضيف الجديد، ويفرّغ الإحداثيات إن تُركت فارغة في الملف.</span>
        </label>
        <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;margin:0">
          <input type="radio" name="import_mode" value="wipe" />
          <span><b>استبدال كامل لنخيل القطع الواردة (Wipe & Replace):</b> يعيد بناء نخيل القطعة بالكامل من الملف المرفوع.</span>
        </label>
      </div>
    </div>

    <!-- Section 3: File Input -->
    <div>
      <label style="font-weight:700">اختر ملف الـ CSV المعدّل أو الجديد:</label>
      <input type="file" id="csv" accept=".csv,text/csv" style="margin-top:6px;width:100%" />
    </div>

    <div id="impPrev" style="margin-top:14px"></div>

    <button class="btn btn-primary" data-act="do-import" style="margin-top:12px;padding:10px 24px;font-size:14px;font-weight:700;display:inline-flex;align-items:center;gap:8px">
      <span>🚀</span> بدء استيراد وتطبيق البيانات
    </button>
  </div>`;
}

