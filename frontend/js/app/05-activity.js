// PalmTrace app — Operation/offshoot/queue views, notifications, profile, live activity feed
// (split from the former single app.js; files are classic scripts loaded in order by index.html)

function opView(palmId) {
  if (!hasPerm("ops_record")) {
    return `<div class="card" style="text-align:center;padding:24px">
      <h3>⚠️ غير مصرح</h3>
      <p class="muted">ليس لديك صلاحية تسجيل عمليات أو خدمات ميدانية على هذا الأصل.</p>
      <button class="btn btn-primary" data-act="back" style="margin-top:10px">رجوع</button>
    </div>`;
  }
  const st = Store.get();
  const p = findPalm(palmId);
  if (!p) return `<div class="card">تعذر فتح النخلة. اخترها من المسح أو الحقل أولاً.</div>
    <button class="btn btn-primary" data-go="scan">اختيار نخلة</button>`;
  const cats = st.operationCats || [];
  const reworkOpObj = activeReworkOpId ? (st.operations || []).find(x => x.id === activeReworkOpId) : null;
  const targetTypeId = reworkOpObj ? reworkOpObj.typeId : null;
  let targetCatId = cats[0]?.id;
  if (targetTypeId) {
    const foundType = (st.operationTypes || []).find(t => t.id === targetTypeId);
    if (foundType && foundType.catId) targetCatId = foundType.catId;
  }
  const pCrop = p.cropId || "palm";
  const types = typesByCat(targetCatId, "individual", pCrop);
  const dueCount = (st.operations || []).filter(o => o.palmId === p.id && o.approval !== "approved").length;
  const plotObj = (st.plots || []).find(x => x.id === p.plot);
  const secName = sectorName(plotObj?.sector || p.sector_id || "");
  const pName = plotName(p.plot);

  function getCatIcon(id) {
    if (id === "c_d") return "📅";
    if (id === "c_w") return "❄️";
    if (id === "c_f") return "🧪";
    if (id === "c_i") return "⚡";
    if (id === "c_o") return "📝";
    if (id === "c_e") return "🚨";
    return "🌿";
  }

  const reworkBanner = reworkOpObj ? `
    <div style="background:#FFF7ED;border:2px solid #EA580C;border-radius:12px;padding:12px 16px;margin-bottom:14px;box-shadow:0 4px 12px rgba(234,88,12,0.1)">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:18px">🔄</span>
          <span style="font-weight:800;font-size:13.5px;color:#C2410C">وضع إعادة تنفيذ وتصحيح عملية سابقة</span>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" data-act="cancel-rework-op" style="font-size:11px;padding:2px 8px;border:1px solid #FDBA74;border-radius:6px;background:#fff;color:#9A3412;cursor:pointer">
          إلغاء وضع التصحيح ✕
        </button>
      </div>
      <div style="font-size:12.5px;color:#7C2D12;margin-top:6px;line-height:1.6">
        <b>العملية المطلوب تصحيحها:</b> ${typeName(reworkOpObj.typeId)}<br>
        <b>توجيه المشرف / سبب الرفض:</b> <span style="background:#FEF3C7;padding:2px 6px;border-radius:4px;font-weight:700;color:#92400E">${escapeHtml(reworkOpObj.supervisorNote || 'يرجى مراجعة المعايير وإعادة التنفيذ بدقة')}</span>
      </div>
    </div>
  ` : '';

  return `<div class="quick-action-card">
    ${reworkBanner}
    <!-- 1. شريط هوية النخلة (Asset Header Bar) -->
    <div class="quick-action-header">
      <div class="asset-identity">
        <span class="palm-code-pill">${p.code}</span>
        <span class="asset-loc-text">قطاع ${secName} • قطعة ${pName}</span>
      </div>
      <div class="asset-due-badge">
        ${dueCount > 0 ? `<span class="badge-due">تستحق ${dueCount} خدمات</span>` : `<span class="badge-ok-pill">سليمة / إنتاج</span>`}
      </div>
    </div>

    <!-- 2. التصنيف (Pills / Radio Chips) -->
    <div class="field-label-sm"><span>🏷️</span> التصنيف</div>
    <div class="chips-row" id="catseg">
      ${cats.map((c,i)=>`<button type="button" class="chip-btn ${c.id === targetCatId ?"on active":""}" data-act="pick-cat" data-id="${c.id}">${getCatIcon(c.id)} ${c.name}</button>`).join("")}
    </div>
    <select id="cat" class="hidden">${cats.map(c=>`<option value="${c.id}" ${c.id === targetCatId ? "selected":""}>${c.name}</option>`)}</select>

    <!-- 3. العملية الميدانية (Dynamic Operations Grid) -->
    <div class="field-label-sm"><span>🔧</span> العملية الميدانية</div>
    <div class="chips-grid" id="typeseg">
      ${types.map((t,i)=>`<button type="button" class="chip-btn chip-sub ${(targetTypeId ? t.id === targetTypeId : i===0)?"on active":""}" data-act="pick-type" data-id="${t.id}">${t.name}</button>`).join("")}
    </div>
    <select id="otype" class="hidden">${types.map((t,i)=>`<option value="${t.id}" ${(targetTypeId ? t.id === targetTypeId : i===0)?"selected":""}>${t.name}</option>`)}</select>

    <!-- حقول المركبات والأسمدة عند اللزوم -->
    <div id="omatwrap" class="material-panel" style="display:none">
      <label data-mlabel class="field-label-sm" style="margin:2px 0 6px">المركب / السماد المطلوب</label>
      <select id="omat">${materialOptionsHtml([])}</select>
      <div class="grid grid-2" style="margin-top:6px">
        <div>
          <label style="font-size:12px;font-weight:700">الكمية المستهلكة (الجرعة)</label>
          <input id="odose_qty" type="number" step="any" placeholder="مثال: 0.5 أو 2" />
        </div>
        <div>
          <label style="font-size:12px;font-weight:700">وحدة القياس</label>
          <select id="odose_unit">
            <option value="كجم">كجم</option>
            <option value="جم">جم</option>
            <option value="لتر">لتر</option>
            <option value="شيكارة">شيكارة</option>
          </select>
        </div>
      </div>
      <input type="hidden" id="odose" />
    </div>

    <!-- 4. مؤشر النتيجة السريعة (Status Segmented Control) -->
    <div class="field-label-sm"><span>📊</span> النتيجة السريعة</div>
    <div class="status-segmented-group" id="qres_wrap">
      ${targetCatId === "c_i" ? `
        <button type="button" class="status-seg-btn seg-danger on active" data-act="pick-res" data-id="إصابة مؤكدة">
          <span>⚠️</span> إصابة مؤكدة
        </button>
        <button type="button" class="status-seg-btn seg-warning" data-act="pick-res" data-id="اشتباه / فحص">
          <span>🔍</span> اشتباه / فحص
        </button>
        <button type="button" class="status-seg-btn seg-success" data-act="pick-res" data-id="تمت المعالجة">
          <span>✓</span> تمت المعالجة
        </button>
      ` : `
        <button type="button" class="status-seg-btn seg-success on active" data-act="pick-res" data-id="تم بنجاح">
          <span>✓</span> تم بنجاح
        </button>
        <button type="button" class="status-seg-btn seg-warning" data-act="pick-res" data-id="يحتاج إعادة">
          <span>↺</span> يحتاج إعادة
        </button>
        <button type="button" class="status-seg-btn seg-partial" data-act="pick-res" data-id="تم جزئياً">
          <span>⏳</span> تم جزئياً
        </button>
      `}
    </div>
    <input type="hidden" id="qres" value="${targetCatId === 'c_i' ? 'إصابة مؤكدة' : 'تم بنجاح'}" />
    ${targetCatId !== "c_i" ? `
      <div style="margin-top:6px;font-size:11.5px;color:#B45309;display:flex;align-items:center;gap:4px">
        <span>⚠️</span> هل لاحظت إصابة أو كسر سعف أثناء التنفيذ؟
        <a href="javascript:void(0)" onclick="act('pick-cat','c_i')" style="color:#C2410C;text-decoration:underline;font-weight:700">انقر للتحويل إلى بلاغ عارض</a>
      </div>
    ` : ''}

    <!-- 5. الملاحظات المصغرة والصورة الميدانية -->
    <div class="field-label-sm"><span>📝</span> ملاحظة اختيارية</div>
    <textarea id="notes" class="compact-textarea" rows="2" placeholder="اكتب أي ملاحظة حقلية سريعة هنا..."></textarea>

    <div class="camera-action-box">
      <button type="button" class="btn-camera-action" data-act="trigger-cam">
        <span>📷</span>
        <span>التقاط صورة ميدانية سريعة</span>
      </button>
      <input id="photos" type="file" accept="image/*" capture="environment" multiple style="display:none" />
      <div class="photo-preview-grid" id="prev"></div>
    </div>

    <!-- 6. زر الحفظ الرئيسي العريض -->
    <button class="btn btn-save-action" data-act="save-op" data-id="${p.id}">
      <span>⚡</span> حفظ الخدمة الآن
    </button>
  </div>`;
}

function offshootView(palmId) {
  if (!hasPerm("nursery_offshoot_add")) {
    return `<div class="card" style="text-align:center;padding:24px">
      <h3>⚠️ غير مصرح</h3>
      <p class="muted">ليس لديك صلاحية تسجيل قلع أو فصل فسائل.</p>
      <button class="btn btn-primary" data-act="back" style="margin-top:10px">رجوع</button>
    </div>`;
  }
  const p = findPalm(palmId);
  if (!p) return `<div class="card">تعذر تحديد النخلة الأم.</div><button class="btn btn-primary" data-go="scan">اختيار نخلة</button>`;
  const seq = nextOffshootSeq(p.id);
  const today = new Date().toISOString().slice(0,10);
  const baseCode = offshootBaseMotherCode(p.code);
  return `<div class="card">
    <h3>قلع فسيلة</h3>
    <label>الأم</label><div>${codeHtml(p.code)}</div>
    <label>الصنف (من الأم)</label><input value="${p.variety}" disabled />
    <label>التسلسل</label><input id="oseq" value="${seq}" />
    <label>تاريخ الخلع</label><input id="odate" type="date" value="${today}" />
    <label>الوزن كجم</label><input id="ow" type="number" />
    <label>القطر سم</label><input id="od" type="number" />
    <label>الحالة</label><select id="oh"><option>جيدة</option><option>متوسطة</option><option>ضعيفة</option></select>
    <label>ملاحظات</label><textarea id="onotes"></textarea>
    <div class="card" style="background:var(--green-l);margin-top:8px">الكود المؤقت: <bdi dir="ltr"><b id="tempcode" data-mother="${p.code}" style="font-family:monospace;direction:ltr;unicode-bidi:isolate;background:#fff;padding:3px 8px;border-radius:6px;border:1px solid #86EFAC">${baseCode}-OS${seq}-${mmYY(today)}</b></bdi></div>
    <p class="muted">المصدر هو النخلة الأم تلقائياً — تأخذ الفسيلة رمز الأصل (F) باعتبارها أصلاً خضرياً مستقلاً.</p>
    <button class="btn btn-orange" data-act="save-os" data-id="${p.id}" style="margin-top:10px">حفظ وإرسال للمشتل</button>
  </div>`;
}

function queueView() {
  const st = Store.get();
  // Sort queue items newest first
  const q = (st.queue || []).slice().sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
  // Sort pending ops newest first
  const ops = (st.operations || []).filter(o => o.workerId === session()?.id && o.status !== "synced").sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));

  const totalItems = q.length;
  const syncedCount = q.filter(x => x.status === "synced").length;
  const pendingCount = q.filter(x => x.status !== "synced").length + ops.length;

  return `<div class="queue-page-container" style="max-width:760px;margin:12px auto">
    <!-- ملخص حالة المزامنة -->
    <div class="card" style="margin-bottom:14px;border-radius:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div>
          <h3 style="margin:0 0 4px">📡 مركز مزامنة قاعدة البيانات والعمليات</h3>
          <p class="muted" style="margin:0;font-size:13px">تحديث قاعدة بيانات SQLite (palmtrace.db) بكافة القطاعات (بشاير 2 وغيرها)، القطع، النخيل، والحركات</p>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary" data-act="sync-all" style="width:auto;padding:10px 18px;font-size:14px;font-weight:800">
            🗄️ مزامنة قاعدة البيانات والعمليات الآن
          </button>
        </div>
      </div>

      <div class="grid grid-3" style="margin-top:14px;gap:8px">
        <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:10px;text-align:center">
          <div style="font-size:12px;color:#64748B;font-weight:700">إجمالي الحركات</div>
          <div style="font-size:20px;font-weight:900;color:#0F172A">${totalItems}</div>
        </div>
        <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:12px;padding:10px;text-align:center">
          <div style="font-size:12px;color:#047857;font-weight:700">متزامن مع الخادم</div>
          <div style="font-size:20px;font-weight:900;color:#065F46">${syncedCount}</div>
        </div>
        <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:10px;text-align:center">
          <div style="font-size:12px;color:#B45309;font-weight:700">بانتظار المزامنة</div>
          <div style="font-size:20px;font-weight:900;color:#92400E">${pendingCount}</div>
        </div>
      </div>
    </div>

    <!-- عمليات غير متزامنة تتطلب إجراء -->
    ${ops.length > 0 ? `
    <div class="card" style="margin-bottom:14px;border-radius:16px;border-right:4px solid #F59E0B">
      <h4 style="margin:0 0 10px;color:#B45309">⚠️ عمليات حقلية بانتظار الرفع (${ops.length})</h4>
      ${ops.map(o => {
        const p = palmById(o.palmId);
        return `<div class="queue-item-card pending-card" style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:#FFFDF5;border:1px solid #FDE68A;border-radius:12px;margin-bottom:8px">
          <div>
            <div style="font-weight:800;font-size:14px">${typeName(o.typeId)} ${codeHtml(p?.code)}</div>
            <div class="muted" style="font-size:12px;margin-top:3px">⏰ سُجلت: ${fmtDateTime(o.at)}</div>
            ${o.notes ? `<div style="font-size:12px;color:#4B5563;margin-top:2px">${o.notes}</div>` : ""}
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="status badge-warn">⏳ معلق</span>
            <button class="btn btn-ghost" style="width:auto;padding:6px 12px;font-size:12px" data-act="sync-one" data-id="${o.id}">مزامنة الآن</button>
          </div>
        </div>`;
      }).join("")}
    </div>` : ""}

    <!-- سجل طابور العمليات الشامل (الأحدث أولاً) -->
    <div class="card" style="border-radius:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <h4 style="margin:0">سجل حركات النظام والمزامنة (الأحدث أولاً)</h4>
        <span class="muted" style="font-size:12px">${q.length} حركة</span>
      </div>

      ${q.length === 0 ? `<div class="muted" style="text-align:center;padding:24px 0">لا توجد حركات مسجلة حتى الآن.</div>` : ""}

      <div style="display:flex;flex-direction:column;gap:8px">
        ${q.map(item => {
          const isSynced = item.status === "synced";
          return `<div class="queue-item-card" style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:#ffffff;border:1px solid #E2E8F0;border-radius:12px;border-right:4px solid ${isSynced ? "#10B981" : "#F59E0B"}">
            <div style="flex:1">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <span style="font-weight:800;font-size:14px;color:#1E293B">${item.title}</span>
                ${item.detail ? `<span class="code-chip" style="font-size:12px">${item.detail}</span>` : ""}
              </div>
              <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:5px;font-size:12px">
                <span style="color:#64748B">⏰ <b>تسجيل:</b> ${fmtDateTime(item.at)}</span>
                ${isSynced 
                  ? `<span style="color:#059669">📡 <b>مزامنة:</b> ${fmtDateTime(item.syncedAt || item.at)}</span>`
                  : `<span style="color:#D97706">⏳ <b>بانتظار المزامنة مع الخادم</b></span>`}
              </div>
            </div>
            <div>
              <span class="status ${isSynced ? "badge-ok" : "badge-warn"}" style="font-size:12px;padding:5px 10px;border-radius:20px">
                ${isSynced ? "✓ متزامن" : "⏳ معلق"}
              </span>
            </div>
          </div>`;
        }).join("")}
      </div>
    </div>
  </div>`;
}

function qitemView(id) {
  const o = Store.get().operations.find(x => x.id === id);
  if (!o) return `<div class="card">غير موجودة</div>`;
  const locked = !canEdit(o);
  const p = Store.get().palms.find(x => x.id === o.palmId);
  return `<div class="card">
    <h3>تعديل العملية</h3>
    <div>${codeHtml(p?.code)}</div>
    <p class="muted">${locked ? "معتمدة من المشرف — لا يمكن التعديل" : "يمكن التعديل ثم المزامنة"}</p>
    <label>ملاحظات</label>
    <textarea id="enotes" ${locked?"disabled":""}>${o.notes||""}</textarea>
    ${o.supervisorNote ? `<div class="card" style="background:#FFF8E1;margin-top:8px">ملاحظة المشرف: ${o.supervisorNote}</div>`:""}
    ${!locked ? `<button class="btn btn-primary" data-act="edit-op" data-id="${o.id}" style="margin-top:10px">حفظ التعديل</button>
    <button class="btn btn-ghost" data-act="sync-one" data-id="${o.id}" style="margin-top:8px">مزامنة هذه العملية</button>
    <button class="btn btn-ghost" data-act="del-op" data-id="${o.id}" style="margin-top:8px">حذف</button>`:""}
  </div>`;
}

let notifFilter = "all";

function notificationsView() {
  const me = session();
  if (!me) return `<div class="card">يرجى تسجيل الدخول</div>`;
  const st = Store.get();
  const currentProjId = st.activeProjectId || "proj_farafra_01";
  const currentCompId = st.activeCompanyId || "comp_bashayer";
  const allUserNotifs = (st.notifications || []).filter(n => {
    if (n.userId !== me.id) return false;
    if (n.projectId && n.projectId !== currentProjId) return false;
    if (n.companyId && n.companyId !== currentCompId) return false;
    if (!n.projectId && currentProjId !== "proj_farafra_01") return false;
    if (!n.companyId && currentCompId !== "comp_bashayer") return false;
    return true;
  });
  const unreadCount = allUserNotifs.filter(n => !n.read).length;

  const canSeeOpsNotifs = me.role === "worker" || me.role === "engineer" || me.role === "admin" || hasPerm("ops_record");
  const canSeeVoucherNotifs = me.role === "warehouse_mgr" || me.role === "engineer" || me.role === "admin" || me.role === "worker" || hasPerm("fert_voucher");
  const canSeeZakatNotifs = me.role === "customer_care" || me.role === "investor" || me.role === "admin" || hasPerm("zakat");

  if (notifFilter === "routine" && !canSeeOpsNotifs) notifFilter = "all";
  if (notifFilter === "voucher" && !canSeeVoucherNotifs) notifFilter = "all";
  if (notifFilter === "zakat" && !canSeeZakatNotifs) notifFilter = "all";

  let filtered = allUserNotifs;
  if (notifFilter === "unread") filtered = allUserNotifs.filter(n => !n.read);
  else if (notifFilter === "zakat") filtered = allUserNotifs.filter(n => n.type === "zakat" || (n.text && n.text.includes("زكاة")));
  else if (notifFilter === "routine") filtered = allUserNotifs.filter(n => n.type === "routine" || (n.text && (n.text.includes("دوري") || n.text.includes("عاجل") || n.text.includes("هام"))));
  else if (notifFilter === "voucher") filtered = allUserNotifs.filter(n => n.type === "voucher" || (n.text && (n.text.includes("صرف") || n.text.includes("توريد") || n.text.includes("سماد"))));
  else if (notifFilter === "note") filtered = allUserNotifs.filter(n => n.type === "note" || n.type === "approval" || (n.text && (n.text.includes("ملاحظة") || n.text.includes("اعتماد") || n.text.includes("رفض"))));

  const sorted = [...filtered].reverse();

  return `<div class="page-head">
    <div>
      <h3>🔔 مركز الإشعارات والتنبيهات</h3>
      <div class="muted">متابعة التنبيهات الميدانية، تفويضات الزكاة، أذونات الصرف، وملاحظات الإشراف</div>
    </div>
    <div class="actions" style="margin:0">
      ${unreadCount > 0 ? `<button class="btn btn-primary icon-btn" data-act="mark-all-notifs-read">✔ تحديد الكل كمقروء (${unreadCount})</button>` : ""}
      ${allUserNotifs.length > 0 ? `<button class="btn btn-ghost icon-btn" data-act="clear-my-notifs">🗑️ مسح كافة إشعاراتي</button>` : ""}
    </div>
  </div>

  <div class="ptabs" style="margin:4px 0 14px 0">
    <button class="${notifFilter==='all'?'on':''}" data-act="notif-filter" data-id="all">كافة الإشعارات (${allUserNotifs.length})</button>
    <button class="${notifFilter==='unread'?'on':''}" data-act="notif-filter" data-id="unread">غير المقروءة (${unreadCount})</button>
    ${canSeeZakatNotifs ? `<button class="${notifFilter==='zakat'?'on':''}" data-act="notif-filter" data-id="zakat">⚖️ تفويضات وخدمات الزكاة</button>` : ''}
    ${canSeeOpsNotifs ? `<button class="${notifFilter==='routine'?'on':''}" data-act="notif-filter" data-id="routine">⏰ العمليات والرعاية</button>` : ''}
    ${canSeeVoucherNotifs ? `<button class="${notifFilter==='voucher'?'on':''}" data-act="notif-filter" data-id="voucher">📦 العهد والأسمدة</button>` : ''}
    <button class="${notifFilter==='note'?'on':''}" data-act="notif-filter" data-id="note">📝 الملاحظات والاعتمادات</button>
  </div>

  ${sorted.length === 0 ? `
    <div class="card" style="text-align:center;padding:40px;color:var(--muted)">
      <div style="font-size:40px;margin-bottom:12px">🔕</div>
      <h4>لا توجد إشعارات ${notifFilter === 'unread' ? 'غير مقروءة' : 'في هذا القسم'}</h4>
      <p class="muted">سيظهر هنا أي تكليف بمهمة، إذن صرف أسمدة، ملاحظة فنية، أو موعد رعاية مستحق.</p>
    </div>
  ` : `
    <div style="display:flex;flex-direction:column;gap:10px">
      ${sorted.map(n => {
        const isUnread = !n.read;
        let icon = "🔔";
        let badgeColor = "var(--green)";
        if (n.type === "early_warning" || (n.title && n.title.includes("درع الحماية")) || (n.text && (n.text.includes("درع الحماية") || n.text.includes("وقاية استباقية") || n.text.includes("إنذار")))) { icon = "🛡️"; badgeColor = "#10B981"; }
        else if (n.type === "routine" || (n.text && n.text.includes("عاجل"))) { icon = "⏰"; badgeColor = "#D9534F"; }
        else if (n.type === "voucher" || (n.text && (n.text.includes("صرف") || n.text.includes("سماد")))) { icon = "📦"; badgeColor = "#C85A2E"; }
        else if (n.type === "note" || (n.text && n.text.includes("ملاحظة"))) { icon = "📝"; badgeColor = "#2E7D32"; }
        else if (n.type === "approval" || (n.text && n.text.includes("اعتماد"))) { icon = "✅"; badgeColor = "#1976D2"; }
        else if (n.type === "zakat" || (n.text && n.text.includes("زكاة"))) { icon = "⚖️"; badgeColor = "#F59E0B"; }

        return `
          <div class="card notif-card" data-act="open-notif" data-id="${n.id}" style="cursor:pointer;margin:0;border-right:5px solid ${badgeColor};${isUnread ? 'background:#FDFDF9;box-shadow:0 2px 8px rgba(0,0,0,0.06);font-weight:600;' : 'opacity:0.88;'}">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
              <div style="display:flex;align-items:flex-start;gap:12px;flex:1">
                <div style="font-size:24px;line-height:1;margin-top:2px">${icon}</div>
                <div style="flex:1">
                  <div style="font-size:14px;color:var(--text);margin-bottom:5px;line-height:1.5">${n.text || ''}</div>
                  <div class="muted" style="font-size:11px;display:flex;align-items:center;gap:10px">
                    <span>🕒 ${fmtDate(n.at)} ${n.at ? new Date(n.at).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'}) : ''}</span>
                    <span style="color:${badgeColor}">اضغط للانتقال والمتابعة ◀</span>
                  </div>
                </div>
              </div>
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
                ${isUnread ? `<span class="badge" style="background:#C85A2E;color:#fff;font-size:10px;padding:2px 6px;border-radius:10px">جديد</span>` : `<span class="muted" style="font-size:11px">تم الاطلاع</span>`}
              </div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `}
  `;
}

function humanizeDevice(ua) {
  if (!ua) return "💻 كمبيوتر شخصي (Windows)";
  if (ua.includes("Windows")) return "💻 كمبيوتر شخصي (Windows)";
  if (ua.includes("Macintosh") || ua.includes("Mac OS")) return "💻 كمبيوتر شخصي (Mac)";
  if (ua.includes("Android")) return "📱 هاتف ذكي (Android)";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "📱 هاتف ذكي (iOS)";
  if (ua.includes("Linux")) return "💻 حاسوب (Linux)";
  return "💻 متصفح الويب";
}

function profileView() {
  const u = session();
  const st = Store.get();
  const sessions = u.sessions || [{ id: "this", device: navigator.userAgent || "Windows PC", at: u.lastSeen || new Date().toISOString(), current: true }];

  return `<div class="page-head"><div><h3>الحساب الشخصي</h3><div class="muted">إدارة بيانات المستخدم، الأمان، والجلسات النشطة</div></div></div>
    <div class="grid grid-2">
      <div class="card">
        <h3>بيانات الحساب</h3>
        <label>اسم المستخدم (معرف تسجيل الدخول)</label>
        <input value="${escapeHtml(u.user||"")}" readonly disabled style="background:#F1F5F9;color:#64748B;cursor:not-allowed;font-family:monospace;font-weight:700" />
        <label>الاسم الكامل</label>
        <input id="pname" value="${escapeHtml(u.name||"")}" placeholder="أدخل اسمك الكامل" />
        <label>البريد الإلكتروني</label>
        <input id="pmail" type="email" value="${escapeHtml(u.email||"")}" placeholder="user@farm.com" />
        <label>رقم الجوال</label>
        <input id="pphone" value="${escapeHtml(u.phone||"")}" placeholder="05xxxxxxxx" />
        <label>الصورة الشخصية (تظهر في بطاقة العمل ID Card والقوائم)</label>
        <div class="avatar-upload-box">
          <div class="avatar-preview-circle" id="profile-avatar-prev">
            ${u.avatar ? `<img src="${u.avatar}" alt="Avatar" />` : `👤`}
          </div>
          <div class="avatar-upload-acts">
            <input type="file" id="pavatar_input" class="avatar-file-input" data-prev="profile-avatar-prev" data-val="pavatar_val" accept="image/*" style="display:none" />
            <input type="hidden" id="pavatar_val" value="${escapeHtml(u.avatar || "")}" />
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button type="button" class="btn btn-ghost icon-btn" data-act="trigger-avatar-upload" data-target="pavatar_input">📷 رفع / تغيير الصورة</button>
              <button type="button" class="btn btn-ghost icon-btn text-danger" data-act="clear-avatar" data-prev="profile-avatar-prev" data-val="pavatar_val" style="color:#DC2626">🗑️ إزالة</button>
            </div>
            <div class="muted" style="font-size:11px">تُضغط الصورة تلقائياً لملائمة بطاقة العمل والتشغيل أوفلاين</div>
          </div>
        </div>

        <label>فصيلة الدم (للطوارئ وبطاقة العمل الميدانية)</label>
        <select id="pblood">
          <option value="">-- غير محددة --</option>
          ${["O+", "A+", "B+", "AB+", "O-", "A-", "B-", "AB-"].map(bt => `<option value="${bt}" ${(u.bloodType||"")===bt?"selected":""}>${bt}</option>`).join("")}
        </select>

        <label>لغة واجهة المنظومة</label>
        ${st.settings?.showLangToggle !== false ? `
          <select id="plang">
            <option value="ar" ${u.lang!=="en"?"selected":""}>العربية (افتراضي)</option>
            <option value="en" ${u.lang==="en"?"selected":""}>English</option>
          </select>
        ` : `
          <div style="padding:9px 12px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;font-size:13px;color:#64748B;display:flex;align-items:center;gap:6px">
            <span>🇸🇦</span>
            <span>العربية (اللغة الرسمية والافتراضية للمنظومة)</span>
          </div>
        `}
        <button class="btn btn-primary" data-act="save-profile" style="margin-top:14px;width:100%">💾 حفظ وتحديث البيانات الشخصية</button>
      </div>

      <div class="card">
        <h3>كلمة المرور والحماية</h3>
        <label>كلمة المرور الحالية</label>
        <div class="pass-wrap">
          <input id="pold" type="password" placeholder="أدخل كلمة المرور الحالية" autocomplete="current-password" />
          <button type="button" class="pass-eye-btn" data-act="toggle-pass-vis" data-target="pold">👁️</button>
        </div>
        <label>كلمة المرور الجديدة</label>
        <div class="pass-wrap">
          <input id="pnew" type="password" placeholder="6 خانات على الأقل" autocomplete="new-password" />
          <button type="button" class="pass-eye-btn" data-act="toggle-pass-vis" data-target="pnew">👁️</button>
        </div>
        <label>تأكيد كلمة المرور الجديدة</label>
        <div class="pass-wrap">
          <input id="pnew2" type="password" placeholder="أعد كتابة كلمة المرور الجديدة" autocomplete="new-password" />
          <button type="button" class="pass-eye-btn" data-act="toggle-pass-vis" data-target="pnew2">👁️</button>
        </div>
        <button class="btn btn-primary" data-act="change-pass" style="margin-top:14px;width:100%">🔒 تغيير كلمة المرور وتحديث الحساب</button>
      </div>
    </div>

    <!-- Collapsible Wallpaper / Appearance Section -->
    <details class="card" style="margin-top:14px">
      <summary style="font-weight:700;font-size:14px;color:var(--text);cursor:pointer;padding:4px 0">
        🎨 تخصيص خلفية ومظهر التطبيق (انقر هنا للتعديل)
      </summary>
      <div style="margin-top:14px;border-top:1px dashed #E2E8F0;padding-top:12px">
        <p class="muted" style="font-size:12px;margin-bottom:12px">تظهر خلفية مخصصة للواجهة مع طبقة تغشية لضمان وضوح البيانات والقراءة.</p>
        <div class="bg-grid">
          <button class="bg-swatch ${(u.bg?.type||"default")==="default"?"on":""}" data-act="bg-default">الافتراضي</button>
          ${BG_PRESETS.map(p => `<button class="bg-swatch ${u.bg?.preset===p.id?"on":""}" data-act="bg-preset" data-id="${p.id}" style="background:${p.css}">${p.name}</button>`).join("")}
        </div>
        <label style="margin-top:10px">رفع صورة مخصصة من الجهاز</label>
        <input type="file" id="bgfile" accept="image/*" />
        <label>قوة التغشية ${u.bg?.overlay ?? 48}٪</label>
        <input type="range" id="bgov" min="20" max="80" value="${u.bg?.overlay ?? 48}" />
        <div class="actions" style="margin-top:8px">
          <button class="btn btn-primary icon-btn" data-act="bg-upload">اعتماد الصورة المرفوعة</button>
          <button class="btn btn-ghost icon-btn" data-act="bg-default">إعادة الخلفية الافتراضية</button>
        </div>
      </div>
    </details>

    <div class="card" style="margin-top:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <h3 style="margin:0">🖥️ الجلسات والأجهزة النشطة</h3>
        <span class="status badge-ok" style="font-size:11px">${sessions.length} جلسة نشطة</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${sessions.map(s => `
          <div class="list-item" style="padding:10px 14px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px">
            <div style="display:flex;align-items:center;gap:10px">
              <div style="font-size:22px">💻</div>
              <div>
                <div style="font-weight:700;font-size:13px;color:#1E293B">
                  ${humanizeDevice(s.device)} ${s.current ? '<span class="chip" style="background:#DCFCE7;color:#166534;font-size:10px;padding:2px 6px;margin-right:6px">متصل الآن</span>' : ''}
                </div>
                <div class="muted" style="font-size:11px;margin-top:2px">آخر ظهور: ${fmtDate(s.at)} ${s.at ? new Date(s.at).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'}) : ''}</div>
              </div>
            </div>
            ${s.current ? '' : `<button class="btn btn-ghost icon-btn btn-sm" data-act="kick-session" data-id="${s.id}" style="color:#DC2626;border-color:#FCA5A5">إنهاء الجلسة</button>`}
          </div>
        `).join("")}
      </div>
    </div>`;
}

// ============================================================================
// Interactive Live Activity Stream & Audit Log (موجز الأنشطة التفاعلي الحي)
// ============================================================================

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  
  if (diffMs < 45000 && diffMs >= -10000) return "الآن";
  
  const diffSec = Math.floor(Math.abs(diffMs) / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffMin < 60) {
    if (diffMin <= 1) return "منذ دقيقة";
    if (diffMin === 2) return "منذ دقيقتين";
    if (diffMin <= 10) return `منذ ${diffMin} دقائق`;
    return `منذ ${diffMin} دقيقة`;
  }
  
  if (diffHr < 24) {
    if (d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
      const timeStr = d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
      return `اليوم ${timeStr}`;
    }
    if (diffHr === 1) return "منذ ساعة";
    if (diffHr === 2) return "منذ ساعتين";
    if (diffHr <= 10) return `منذ ${diffHr} ساعات`;
    return `منذ ${diffHr} ساعة`;
  }

  if (diffDays === 1 || (diffDays < 2 && d.getDate() === now.getDate() - 1)) {
    const timeStr = d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
    return `أمس ${timeStr}`;
  }

  if (diffDays < 7) {
    if (diffDays === 2) return "منذ يومين";
    return `منذ ${diffDays} أيام`;
  }

  return d.toISOString().slice(0, 10);
}

function getUnifiedActivityFeed(st, options = {}) {
  st = st || Store.get();
  const catFilter = options.category !== undefined ? options.category : (feedCategoryFilter || "all");
  const secFilter = options.sector !== undefined ? options.sector : (feedSectorFilter || "all");
  const searchQ = (options.search !== undefined ? options.search : (feedSearchQuery || "")).trim().toLowerCase();
  const maxDays = options.maxDays !== undefined ? options.maxDays : 7;
  const cutoffTime = maxDays > 0 ? (Date.now() - (maxDays * 24 * 60 * 60 * 1000)) : 0;
  const currentProjId = st.activeProjectId || "proj_farafra_01";

  const rawEvents = [];

  // 1. Operations
  (st.operations || []).forEach(o => {
    if (o.projectId && o.projectId !== currentProjId) return;
    if (cutoffTime > 0 && o.at && new Date(o.at).getTime() < cutoffTime) return;
    const t = (st.operationTypes || []).find(x => x.id === o.typeId);
    const p = palmById(o.palmId);
    if (!o.projectId && !p && currentProjId !== "proj_farafra_01") return;
    const pl = (st.plots || []).find(x => x.id === (p?.plot || o.plotId));
    const sec = pl?.sector || o.sectorId || "";
    const u = userBy(o.workerId);

    let cat = "ops";
    let sev = "success";
    let ico = "⚙️";

    const tName = t?.name || "خدمة زراعية";
    if (tName.includes("سوسة") || tName.includes("إصابة") || tName.includes("آفة") || tName.includes("علاج")) {
      cat = "critical"; sev = "danger"; ico = "🚨";
    } else if (tName.includes("ري") || tName.includes("ماء")) {
      cat = "ops"; sev = "primary"; ico = "💧";
    } else if (tName.includes("تسميد")) {
      cat = "ops"; sev = "success"; ico = "🧪";
    } else if (tName.includes("تقليم") || tName.includes("تكريب")) {
      cat = "ops"; sev = "success"; ico = "✂️";
    } else if (tName.includes("تلقيح")) {
      cat = "ops"; sev = "success"; ico = "🌾";
    } else if (tName.includes("فصل") || tName.includes("فسيل")) {
      cat = "nursery"; sev = "primary"; ico = "🌱";
    }

    const title = (o.notes && o.notes.length > 6 && !o.notes.includes("تلقائي")) 
      ? o.notes 
      : `تنفيذ [${tName}] على ${cropSingle(p?.cropId || "palm")} [${p?.code || o.palmId}]`;

    rawEvents.push({
      id: "op_" + o.id,
      rawId: o.id,
      origin: "operation",
      category: cat,
      severity: sev,
      icon: ico,
      typeId: o.typeId,
      typeName: tName,
      title,
      actor: u?.name || "مشرف الحقل",
      actorId: o.workerId,
      actorRole: u?.role === "worker" ? "عامل حقلي" : u?.role === "engineer" ? "مهندس زراعي" : "مشرف",
      at: normTs(o.at || o.createdAt) || new Date().toISOString(),
      palmId: o.palmId,
      palmCode: p?.code,
      variety: p?.variety || "—",
      cropId: p?.cropId || "palm",
      plotId: pl?.id || p?.plot,
      plotName: pl?.name,
      sectorId: sec,
      sectorName: sectorName(sec),
      notes: o.notes || "",
      photos: o.photos || [],
      approval: o.approval || "approved",
      cost: o.cost || 0,
      lat: o.lat,
      lng: o.lng,
      raw: o
    });
  });

  // 2. Incidents (Emergency / Pests)
  (st.incidents || []).forEach(inc => {
    if (inc.projectId && inc.projectId !== currentProjId) return;
    if (cutoffTime > 0 && inc.at && new Date(inc.at).getTime() < cutoffTime) return;
    const p = palmById(inc.palmId);
    if (!inc.projectId && !p && currentProjId !== "proj_farafra_01") return;
    const pl = (st.plots || []).find(x => x.id === (inc.plotId || p?.plot));
    const sec = inc.sectorId || pl?.sector || "";
    const u = userBy(inc.by);
    rawEvents.push({
      id: "inc_" + inc.id,
      rawId: inc.id,
      origin: "incident",
      category: "critical",
      severity: "danger",
      icon: "🚨",
      typeName: inc.type || "بلاغ طارئ",
      title: inc.title || `رصد عارض / إصابة [${inc.type || 'طارئة'}]`,
      actor: u?.name || "فريق الرصد",
      actorId: inc.by,
      actorRole: "راصد ميداني",
      at: inc.at || new Date().toISOString(),
      palmId: inc.palmId,
      palmCode: p?.code,
      variety: p?.variety,
      cropId: p?.cropId || "palm",
      plotId: pl?.id,
      plotName: pl?.name,
      sectorId: sec,
      sectorName: sectorName(sec),
      notes: inc.notes || "",
      photos: inc.photos || [],
      approval: "alert",
      raw: inc
    });
  });

  // 3. Nursery / Offshoots
  (st.offshoots || []).forEach(os => {
    if (os.projectId && os.projectId !== currentProjId) return;
    const mother = findPalm(os.motherId || os.motherPalmId || os.motherCode) || (os.tempCode ? st.palms.find(p => p.code && os.tempCode.startsWith(p.code)) : null);
    if (!os.projectId && !mother && currentProjId !== "proj_farafra_01") return;
    const osDate = os.at || os.createdAt || os.created_at || os.created || os.separationDate || os.separation_date || (mother ? (mother.createdAt || mother.created_at || mother.plantingDate) : null);
    if (cutoffTime > 0 && osDate && new Date(osDate).getTime() < cutoffTime) return;
    const u = userBy(os.by);
    rawEvents.push({
      id: "os_" + os.id,
      rawId: os.id,
      origin: "offshoot",
      category: "nursery",
      severity: "primary",
      icon: "🌱",
      typeName: "فصل وترقيم فسائل",
      title: `فصل وتوثيق فسيلة جديدة [${os.tempCode || os.code || os.id}] من النخلة الأم [${mother?.code || os.motherCode || 'عام'}]`,
      actor: u?.name || "فني المشتل",
      actorId: os.by,
      actorRole: "فني مشتل وتكاثر",
      at: osDate || "2026-09-25T12:00:00.000Z",
      palmId: os.motherPalmId,
      palmCode: mother?.code,
      variety: os.variety || mother?.variety || "—",
      cropId: os.cropId || "palm",
      plotId: mother?.plot,
      sectorId: "",
      notes: os.notes || `صنف ${os.variety || ''} • جاهزية الغرس بالمشتل`,
      photos: os.photos || [],
      approval: "approved",
      raw: os
    });
  });

  // 4. Yields / Harvest
  (st.yields || []).forEach(y => {
    if (y.projectId && y.projectId !== currentProjId) return;
    if (!y.projectId && currentProjId !== "proj_farafra_01") return;
    const yDate = y.date || y.at;
    if (cutoffTime > 0 && yDate && new Date(yDate).getTime() < cutoffTime) return;
    const u = userBy(y.by || y.recordedBy || y.recorded_by);
    rawEvents.push({
      id: "yd_" + y.id,
      rawId: y.id,
      origin: "yield",
      category: "yields",
      severity: "purple",
      icon: "🌾",
      typeName: "توريد حصاد",
      title: `تسجيل شحنة حصاد معتمدة [${y.batch || y.id}] بإجمالي ${Number(y.kg||0).toLocaleString()} كجم (${y.variety || 'عام'})`,
      actor: u?.name || y.recordedByName || y.recorded_by_name || "مسؤول الحصاد",
      actorId: y.by || y.recordedBy || y.recorded_by,
      actorRole: "مشرف جودة وحصاد",
      at: y.date || y.at || new Date().toISOString(),
      cropId: y.cropId || "palm",
      sectorId: y.sectorId || "",
      sectorName: sectorName(y.sectorId),
      variety: y.variety,
      notes: `فرز ممتاز: ${y.kgEx||0} كجم • جيد: ${y.kgGd||0} كجم • تالف: ${y.kgBad||0} كجم`,
      photos: [],
      approval: "approved",
      raw: y
    });
  });

  // 5. Audit Log (recent administrative actions)
  if (typeof AuditLog !== "undefined" && typeof AuditLog.query === "function") {
    try {
      const queryRes = AuditLog.query({ limit: 40, projectId: currentProjId, companyId: st.activeCompanyId });
      const audits = (queryRes && queryRes.items) ? queryRes.items : (Array.isArray(queryRes) ? queryRes : []);
      // Operations already appear as their own events: drop audit copies of them, and collapse the
      // device copy + server copy of the same administrative action.
      const opIds = new Set(rawEvents.filter(e => e.origin === "operation").map(e => String(e.rawId)));
      const seenAudit = new Map();
      audits.forEach(a => {
        if (a.action === "login" || a.action === "logout") return;
        if (a.module === "operations" || a.module === "ops") return;
        if (a.targetId && opIds.has(String(a.targetId))) return;
        const key = `${a.module}|${a.action}|${a.targetId || a.summary || ""}`;
        const tA = new Date(normTs(a.at)).getTime();
        const prev = seenAudit.get(key);
        if (prev !== undefined && Math.abs(prev - tA) < 5 * 60 * 1000) return;
        seenAudit.set(key, tA);
        if (cutoffTime > 0 && a.at && new Date(a.at).getTime() < cutoffTime) return;
        rawEvents.push({
          id: "aud_" + a.id,
          rawId: a.id,
          origin: "audit",
          category: "audit",
          severity: a.severity || "info",
          icon: a.module === "zakat" ? "⚖️" : a.module === "users" ? "👥" : a.module === "fertilizers" ? "📦" : "📋",
          typeName: translateAuditText(a.title || "إجراء إداري"),
          title: translateAuditText(a.summary || a.title || "إجراء نظام موثق"),
          actor: a.user || "إدارة النظام",
          actorRole: a.role || "إشراف",
          at: normTs(a.at),
          notes: typeof a.details === "string" ? a.details : JSON.stringify(a.details || {}),
          approval: "logged",
          raw: a
        });
      });
    } catch(e) {}
  }

  // Sort raw events newest first
  rawEvents.sort((a, b) => new Date(b.at) - new Date(a.at));

  // -------------------------------------------------------------
  // Smart Batching Algorithm (دمج التحديثات الميدانية المتزامنة)
  // -------------------------------------------------------------
  const batchedEvents = [];
  const visitedOpIds = new Set();

  for (let i = 0; i < rawEvents.length; i++) {
    const ev = rawEvents[i];
    if (visitedOpIds.has(ev.id)) continue;

    if (ev.origin === "operation" && ev.typeId) {
      const evDate = String(ev.at).slice(0, 10);
      const evTime = new Date(ev.at).getTime();

      const matchingCluster = [ev];
      for (let j = i + 1; j < rawEvents.length; j++) {
        const nextEv = rawEvents[j];
        if (visitedOpIds.has(nextEv.id) || nextEv.origin !== "operation") continue;
        
        const sameType = nextEv.typeId === ev.typeId;
        const sameActor = nextEv.actorId === ev.actorId;
        const sameSector = (!ev.sectorId || !nextEv.sectorId || nextEv.sectorId === ev.sectorId);
        const nextTime = new Date(nextEv.at).getTime();
        const timeDiffHours = Math.abs(evTime - nextTime) / (1000 * 60 * 60);

        if (sameType && sameActor && sameSector && timeDiffHours <= 3) {
          matchingCluster.push(nextEv);
          if (matchingCluster.length >= 35) break;
        }
      }

      if (matchingCluster.length >= 3) {
        matchingCluster.forEach(m => visitedOpIds.add(m.id));
        const secLabel = ev.sectorName || (ev.sectorId ? sectorName(ev.sectorId) : "المزرعة");
        const batchItem = {
          id: "batch_" + ev.typeId + "_" + (ev.actorId || "act") + "_" + evDate + "_" + i,
          isBatch: true,
          origin: "batch",
          category: ev.category,
          severity: ev.severity,
          icon: ev.icon,
          typeName: ev.typeName,
          title: `مزامنة جماعية: تنفيذ [${ev.typeName}] لـ ${matchingCluster.length} أصل في ${secLabel}`,
          actor: ev.actor,
          actorRole: ev.actorRole,
          at: ev.at,
          count: matchingCluster.length,
          sectorId: ev.sectorId,
          sectorName: secLabel,
          plotId: ev.plotId,
          cropId: ev.cropId,
          batchItems: matchingCluster,
          notes: `تم توثيق إنجاز العمل الميداني لـ ${matchingCluster.length} شجرة بواسطة ${ev.actor}`,
          photos: matchingCluster.flatMap(x => x.photos || []).slice(0, 8)
        };
        batchedEvents.push(batchItem);
        continue;
      }
    }

    visitedOpIds.add(ev.id);
    batchedEvents.push(ev);
  }

  // Calculate counts for Pill filters
  const counts = {
    all: batchedEvents.length,
    critical: batchedEvents.filter(x => x.category === "critical").length,
    ops: batchedEvents.filter(x => x.category === "ops").length,
    nursery: batchedEvents.filter(x => x.category === "nursery").length,
    yields: batchedEvents.filter(x => x.category === "yields").length,
    audit: batchedEvents.filter(x => x.category === "audit").length
  };

  // Filter events by selected category, sector, and search query
  const filteredEvents = batchedEvents.filter(ev => {
    if (catFilter !== "all" && ev.category !== catFilter) return false;
    if (secFilter !== "all" && ev.sectorId && ev.sectorId !== secFilter) return false;
    if (searchQ) {
      const searchStr = `${ev.title} ${ev.actor} ${ev.palmCode || ""} ${ev.typeName || ""} ${ev.notes || ""}`.toLowerCase();
      if (!searchStr.includes(searchQ)) return false;
    }
    return true;
  });

  const limit = options.limit !== undefined ? options.limit : (feedPageLimit || 25);
  const totalFilteredCount = filteredEvents.length;
  const paginatedEvents = filteredEvents.slice(0, limit);
  const hasMore = totalFilteredCount > paginatedEvents.length;

  return {
    events: paginatedEvents,
    counts,
    totalRawCount: rawEvents.length,
    totalFilteredCount,
    hasMore,
    limit
  };
}

function renderLiveActivityFeed(st) {
  st = st || Store.get();
  const feedData = getUnifiedActivityFeed(st);
  const events = feedData.events;
  const counts = feedData.counts || { all: 0, critical: 0, ops: 0, nursery: 0, yields: 0, audit: 0 };
  const isOnline = (typeof Api !== "undefined" && typeof Api.isOnline === "function") ? Api.isOnline() : false;
  const isPulseMuted = (typeof localStorage !== "undefined" && localStorage.getItem("palmtrace_pulse_muted") === "true");

  return `
    <div class="activity-feed-widget">
      <div class="feed-header" style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#fff;border-bottom:1px solid #F1F5F9;border-top-left-radius:12px;border-top-right-radius:12px">
        <h3 style="margin:0;font-size:15px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span>⚡ نبض الحقل والميدان — موجز الأنشطة المباشر</span>
          <span class="live-indicator ${isOnline ? '' : 'offline'}">
            <span class="live-dot"></span>
            ${isOnline ? 'متصل ولحظي (Live)' : 'غير متصل بالخادم — محلي (Offline)'}
          </span>
        </h3>
        <div style="display:flex;align-items:center;gap:6px">
          <!-- Pulse Audio Chime Mute/Unmute Toggle Button -->
          <button type="button" class="btn btn-ghost icon-btn" data-act="toggle-pulse-sound" title="${isPulseMuted ? 'تفعيل تنبيه الصوت الهادئ لنبض الحقل' : 'كتم صوت نبض الحقل'}" style="font-size:12px;padding:3px 9px;border:1px solid ${isPulseMuted ? '#CBD5E1' : '#A7F3D0'};border-radius:6px;background:${isPulseMuted ? '#F8FAFC' : '#ECFDF5'};color:${isPulseMuted ? '#64748B' : '#059669'};cursor:pointer;display:inline-flex;align-items:center;gap:4px;transition:all 0.15s">
            <span>${isPulseMuted ? '🔇' : '🔊'}</span>
            <span style="font-size:11px;font-weight:700">${isPulseMuted ? 'مكتوم' : 'صوت'}</span>
          </button>
          <div class="widget-move-btns" style="display:inline-flex;gap:3px">
            <button type="button" class="btn-w-move" data-act="move-dash-w" data-id="feed" data-dir="up" title="تحريك لأعلى" style="padding:2px 7px;font-size:11px;border-radius:4px;border:1px solid #CBD5E1;background:#F8FAFC;cursor:pointer">▲</button>
            <button type="button" class="btn-w-move" data-act="move-dash-w" data-id="feed" data-dir="down" title="تحريك لأسفل" style="padding:2px 7px;font-size:11px;border-radius:4px;border:1px solid #CBD5E1;background:#F8FAFC;cursor:pointer">▼</button>
          </div>
          <button type="button" class="btn btn-ghost icon-btn" data-act="refresh-feed" title="تحديث الأنشطة الآن" style="font-size:12px;padding:3px 10px;border:1px solid var(--line);border-radius:6px;background:#fff;cursor:pointer">
            🔄 تحديث
          </button>
        </div>
      </div>

      ${feedNewItemsCount > 0 ? `
        <div class="feed-banner-new" data-act="refresh-feed">
          ⚡ يوجد (${feedNewItemsCount}) تحديثات ميدانية جديدة وردت للتو — انقر للتحديث والعرض الفوري
        </div>
      ` : ""}

      <div class="feed-toolbar" style="padding:8px 16px;background:#fff;border-bottom:1px solid #f1f5f9;display:flex;flex-direction:column;gap:6px">
        <!-- Pill Filters -->
        <div class="feed-pills-row" style="padding-bottom:0">
          <button type="button" class="feed-pill ${feedCategoryFilter==='all'?'active':''}" data-act="feed-filter" data-id="all">
            🌐 الكل <span class="feed-pill-badge">${counts.all}</span>
          </button>
          <button type="button" class="feed-pill ${feedCategoryFilter==='critical'?'active':''}" data-act="feed-filter" data-id="critical">
            🚨 طوارئ وآفات <span class="feed-pill-badge">${counts.critical}</span>
          </button>
          <button type="button" class="feed-pill ${feedCategoryFilter==='ops'?'active':''}" data-act="feed-filter" data-id="ops">
            ⚙️ عمليات دورية <span class="feed-pill-badge">${counts.ops}</span>
          </button>
          <button type="button" class="feed-pill ${feedCategoryFilter==='nursery'?'active':''}" data-act="feed-filter" data-id="nursery">
            🌱 المشتل والفسائل <span class="feed-pill-badge">${counts.nursery}</span>
          </button>
          <button type="button" class="feed-pill ${feedCategoryFilter==='yields'?'active':''}" data-act="feed-filter" data-id="yields">
            🌾 حصاد وتوريد <span class="feed-pill-badge">${counts.yields}</span>
          </button>
          <button type="button" class="feed-pill ${feedCategoryFilter==='audit'?'active':''}" data-act="feed-filter" data-id="audit">
            📋 إجراءات رقابية <span class="feed-pill-badge">${counts.audit}</span>
          </button>
        </div>

        <!-- Filter Controls: Search & Sector in a sleek compact single row -->
        <div class="feed-filter-controls" style="display:flex;align-items:center;gap:8px">
          <input id="feed-search-input" class="feed-search-input" value="${escapeHtml(feedSearchQuery)}" placeholder="🔍 بحث سريع في الأنشطة بالمنفذ، كود النخلة، أو الملاحظات..." style="flex:2;min-width:180px;padding:5px 12px;font-size:12px" />
          <select id="feed-sec-filter" data-act="feed-sector" class="feed-sector-select" style="flex:1;max-width:220px;padding:5px 10px;font-size:12px">
            <option value="all" ${feedSectorFilter==='all'?'selected':''}>جميع القطاعات</option>
            ${st.sectors.map(s => `<option value="${s.id}" ${feedSectorFilter===s.id?'selected':''}>${s.name}</option>`).join("")}
          </select>
        </div>
      </div>

      <!-- Feed Timeline List -->
      <div class="feed-list-scroll">
        ${events.length === 0 ? `
          <div style="text-align:center;padding:36px 16px;color:#64748b">
            <div style="font-size:32px;margin-bottom:6px">📭</div>
            <b style="font-size:14px">لا توجد أنشطة مطابقة للفلتر المحدد</b>
            <div style="font-size:12px;margin-top:4px">جرب اختيار تبويب آخر أو مسح عبارة البحث لإظهار الأنشطة.</div>
            <button class="btn btn-ghost btn-sm" data-act="feed-reset-filters" style="margin-top:10px">إعادة تعيين الفلاتر</button>
          </div>
        ` : `
          <div class="feed-timeline">
            ${events.map((ev, idx) => {
              const relTime = timeAgo(ev.at);
              const isBatch = !!ev.isBatch;
              const evTime = new Date(ev.at).getTime();
              const isRecent = idx === 0 || (Date.now() - evTime < 15 * 60 * 1000);
              const pulseClass = isRecent ? 'new-live-activity' : '';

              return `
                <div class="feed-event-card ${isBatch ? 'feed-batch-card' : ''} ${pulseClass}" data-act="feed-item-click" data-id="${ev.id}">
                  <div class="feed-avatar-wrap severity-${ev.severity}">
                    ${ev.icon}
                  </div>
                  <div class="feed-content-wrap">
                    <div class="feed-top-line">
                      <div class="feed-title">${escapeHtml(ev.title)}</div>
                      <div style="display:inline-flex;align-items:center;gap:6px;flex-shrink:0">
                        ${isRecent ? `<span class="feed-live-badge">⚡ جديد</span>` : ''}
                        <div class="feed-relative-time" title="${fmtDate(ev.at)}">${relTime}</div>
                      </div>
                    </div>
                    <div class="feed-sub-meta">
                      <span>👤 <b>${escapeHtml(ev.actor)}</b> <small>(${escapeHtml(ev.actorRole||'')})</small></span>
                      ${ev.sectorName ? `<span>• 📍 ${escapeHtml(ev.sectorName)}</span>` : ""}
                      ${ev.plotName ? `<span>(${escapeHtml(ev.plotName)})</span>` : ""}
                      ${isBatch ? `
                        <span class="feed-batch-tag" title="عملية مجمعة منسقة">📦 ${ev.count} أصل مشمول • اضغط للتفاصيل ▾</span>
                      ` : ev.palmCode ? `
                        <span class="chip" style="font-family:monospace;font-size:11px">${cropIcon(ev.cropId, 11)} ${escapeHtml(ev.palmCode)}</span>
                      ` : ""}
                      <span class="feed-badge-chip ${ev.severity}">${escapeHtml(ev.typeName)}</span>
                    </div>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
          ${feedData.hasMore ? `
            <button type="button" class="feed-load-more" data-act="feed-load-more">
              📥 تحميل أنشطة أقدم (+25 نشاطاً إضافياً) • متبقي (${feedData.totalFilteredCount - events.length})
            </button>
          ` : ""}
        `}
      </div>
    </div>
  `;
}

function renderActivityDrawer(st) {
  if (!activeDrawerEventId) return "";
  st = st || Store.get();
  const feedData = getUnifiedActivityFeed(st, { category: "all", sector: "all", search: "" });
  const ev = feedData.events.find(x => x.id === activeDrawerEventId);
  if (!ev) return "";

  const isBatch = !!ev.isBatch;
  const relTime = timeAgo(ev.at);

  return `
    <div class="slide-drawer-backdrop open" data-act="close-feed-drawer"></div>
    <div class="slide-drawer-panel open">
      <div class="slide-drawer-header">
        <h4>
          <span>${ev.icon} ${escapeHtml(ev.typeName)}</span>
          <span class="feed-badge-chip ${ev.severity}" style="font-size:11px">${escapeHtml(ev.typeName)}</span>
        </h4>
        <button type="button" class="btn btn-ghost icon-btn" data-act="close-feed-drawer" style="font-size:16px;line-height:1;padding:4px 8px">✕</button>
      </div>

      <div class="slide-drawer-body">
        <!-- Main Event Card Title -->
        <div style="margin-bottom:14px">
          <div style="font-size:15.5px;font-weight:800;color:var(--text);margin-bottom:6px;line-height:1.4">
            ${escapeHtml(ev.title)}
          </div>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <span class="badge badge-outline" style="font-size:11.5px">⏱️ ${relTime}</span>
            <span class="muted" style="font-size:11.5px">(${fmtDate(ev.at)} ${new Date(ev.at).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'})})</span>
          </div>
        </div>

        <!-- Actor Card -->
        <div class="card" style="padding:10px 14px;margin-bottom:12px;background:#f8fafc;border:1px solid #e2e8f0">
          <div style="font-size:11px;color:#64748b;font-weight:700">👤 المنفذ المسؤول</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
            <b style="font-size:13.5px">${escapeHtml(ev.actor)}</b>
            <span class="badge badge-ok">${escapeHtml(ev.actorRole || "فريق العمل")}</span>
          </div>
        </div>

        <!-- Location & Asset Card -->
        ${(ev.sectorName || ev.plotName || ev.palmCode) ? `
          <div class="card" style="padding:10px 14px;margin-bottom:12px;background:#f8fafc;border:1px solid #e2e8f0">
            <div style="font-size:11px;color:#64748b;font-weight:700">📍 الموقع الميداني والأصل</div>
            <div style="margin-top:5px;font-size:12.5px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
              ${ev.sectorName ? `<span><b>القطاع:</b> ${escapeHtml(ev.sectorName)}</span>` : ""}
              ${ev.plotName ? `<span>• <b>القطعة:</b> ${escapeHtml(ev.plotName)}</span>` : ""}
              ${ev.palmCode ? `<span>• <b>كود الشجرة:</b> <span class="chip" style="font-family:monospace">${escapeHtml(ev.palmCode)}</span></span>` : ""}
              ${ev.variety ? `<span>• <b>الصنف:</b> ${escapeHtml(ev.variety)}</span>` : ""}
            </div>
          </div>
        ` : ""}

        <!-- Batched Cluster Items (If Grouped) -->
        ${isBatch ? `
          <div class="card" style="padding:12px;margin-bottom:12px;border:1.5px solid #38bdf8;background:#f0f9ff">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <b style="color:#0369a1;font-size:13px">📦 النخيل والأصول المشمولة بالعملية (${ev.count} أصل)</b>
              <span class="badge" style="background:#bae6fd;color:#0284c7">مزامنة موحدة</span>
            </div>
            <div class="muted" style="font-size:11.5px;margin-bottom:8px">تم تسجيل هذا الإجراء لجميع هذه الأشجار دفعة واحدة. اضغط على أي كود لاستعراض بطاقة الأصل:</div>
            <div style="display:flex;gap:5px;flex-wrap:wrap;max-height:180px;overflow-y:auto;padding:6px;background:#fff;border-radius:6px;border:1px solid #e0f2fe">
              ${ev.batchItems.map(item => `
                <button type="button" class="btn btn-ghost btn-sm" data-go="palm" data-id="${item.palmId}" style="padding:3px 8px;font-size:11.5px;font-family:monospace;font-weight:bold;border:1px solid #cbd5e1" title="عرض بطاقة الأصل ${item.palmCode || item.palmId}">
                  ${cropIcon(item.cropId, 12)} ${item.palmCode || item.palmId}
                </button>
              `).join("")}
            </div>
          </div>
        ` : ""}

        <!-- Field Photos -->
        ${(parsePhotos(ev.photos).length > 0) ? `
          <div style="margin-bottom:12px">
            <div style="font-size:11px;color:#64748b;font-weight:700;margin-bottom:6px">📷 الصور الميدانية المرفقة (${parsePhotos(ev.photos).length})</div>
            <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:6px">
              ${parsePhotos(ev.photos).map(src => `<img src="${src}" style="width:96px;height:72px;object-fit:cover;border-radius:6px;border:1px solid var(--line);cursor:pointer" onclick="window.viewImagePreview(this.src, 'الصورة الميدانية')" title="انقر لتكبير الصورة" />`).join("")}
            </div>
          </div>
        ` : ""}

        <!-- Notes Card -->
        ${ev.notes ? `
          <div class="card" style="padding:10px 14px;margin-bottom:12px;font-size:12.5px;line-height:1.6;background:#fff">
            <div style="font-size:11px;color:#64748b;font-weight:700;margin-bottom:4px">📝 تفاصيل وملاحظات التنفيذ</div>
            <div>${escapeHtml(ev.notes)}</div>
          </div>
        ` : ""}

        <!-- Geolocation -->
        ${(ev.lat && ev.lng) ? `
          <div style="margin-bottom:12px;padding:8px 12px;background:#f8fafc;border-radius:6px;font-size:11.5px;display:flex;justify-content:space-between;align-items:center;border:1px solid #e2e8f0">
            <span>🌐 <b>الإحداثيات:</b> ${ev.lat.toFixed(5)}, ${ev.lng.toFixed(5)}</span>
            <a href="https://maps.google.com/?q=${ev.lat},${ev.lng}" target="_blank" class="btn btn-ghost btn-sm" style="font-size:11px;padding:2px 8px">🗺️ عرض على الخريطة</a>
          </div>
        ` : ""}
      </div>

      <div class="slide-drawer-footer">
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${ev.palmId ? `<button type="button" class="btn btn-primary btn-sm" data-go="palm" data-id="${ev.palmId}">🌳 فتح سجل الشجرة</button>` : ""}
          ${ev.rawId && ev.origin === 'operation' ? `<button type="button" class="btn btn-ghost btn-sm" data-go="op-detail" data-id="${ev.rawId}" style="border:1px solid var(--line)">📑 تفاصيل العملية الكاملة</button>` : ""}
        </div>
        <button type="button" class="btn btn-ghost btn-sm" data-act="close-feed-drawer">✕ إغلاق</button>
      </div>
    </div>
  `;
}

function renderDashKpiModal(st, p) {
  if (!showDashKpiModal) return "";
  st = st || Store.get();
  p = p || {};
  const tPalms = p.targetPalms || st.palms || [];
  const pCount = p.palmsCount !== undefined ? p.palmsCount : (st.palms || []).filter(x => matchesCropFilter(x.cropId, "palm")).length;
  const oCount = p.olivesCount !== undefined ? p.olivesCount : (st.palms || []).filter(x => matchesCropFilter(x.cropId, "olive")).length;
  const yldNowVal = p.yldNow !== undefined ? p.yldNow : 0;
  const yldLastVal = p.lastYear ? (p.yldLast || 0) : 0;
  const lastYrVal = p.lastYear || String(+dashYear - 1);
  const nurPurchased = p.nurseryPurchased !== undefined ? p.nurseryPurchased : 0;
  const cropLabel = dashCrop === 'palm' ? 'نخيل التمر' : dashCrop === 'olive' ? 'أشجار الزيتون' : 'إجمالي النخيل والأشجار';
  const breakdownStr = dashCrop === 'all' 
    ? `(${pCount} نخيل • ${oCount} زيتون)` 
    : `(من إجمالي ${pCount + oCount} شجرة بالمزرعة: ${pCount} نخيل • ${oCount} زيتون)`;
  return `
    <div class="modal" id="dashKpiModal" style="display:flex;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;align-items:center;justify-content:center;padding:16px">
      <div class="modal-box card" style="max-width:580px;width:100%;max-height:85vh;overflow-y:auto;border:2px solid var(--green)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid var(--line);padding-bottom:10px">
          <h3 style="margin:0;color:var(--green-d)">📊 المؤشرات الشاملة والأرقام التفصيلية</h3>
          <button type="button" class="btn btn-ghost icon-btn" data-act="close-dash-kpi-modal" style="padding:4px 8px">✕</button>
        </div>
        
        <div class="grid grid-2" style="gap:12px;margin-bottom:14px">
          <div class="card" style="margin:0;padding:12px;background:#f8fafc">
            <h4 style="margin:0 0 8px;font-size:13.5px;color:var(--green-d)">🌳 الأصول والميادين</h4>
            <div style="font-size:12.5px;display:flex;flex-direction:column;gap:6px">
              <div>الأشجار (${cropLabel}): <b>${tPalms.length}</b> ${breakdownStr}</div>
              <div>المزروعة حديثاً لموسم ${dashYear}: <b style="color:#059669">${p.newlyPlantedCount !== undefined ? p.newlyPlantedCount : tPalms.length} شجرة</b></div>
              <div>القطاعات والقطع: <b>${st.sectors.length} قطاع / ${st.plots.length} قطعة</b></div>
              <div>المستثمرون المسجلون: <b>${st.users.filter(u=>u.role==='investor').length} مستثمر</b></div>
            </div>
          </div>
          <div class="card" style="margin:0;padding:12px;background:#f8fafc">
            <h4 style="margin:0 0 8px;font-size:13.5px;color:var(--green-d)">🌾 الحصاد والمشتل</h4>
            <div style="font-size:12.5px;display:flex;flex-direction:column;gap:6px">
              <div>محصول موسم ${dashYear}: <b>${Number(yldNowVal).toLocaleString()} كجم</b></div>
              <div>محصول موسم ${lastYrVal} السابق: <b>${Number(yldLastVal).toLocaleString()} كجم</b></div>
              <div>مشتريات وتوريد المشتل: <b>${nurPurchased} أصل</b></div>
            </div>
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:8px">
          <button type="button" class="btn btn-ghost" data-go="reports" style="width:auto">📑 الانتقال للتقارير الشاملة</button>
          <button type="button" class="btn btn-primary" data-act="close-dash-kpi-modal" style="width:auto">إغلاق</button>
        </div>
      </div>
    </div>
  `;
}

function renderSeasonModal(st) {
  if (!showSeasonModal) return "";
  st = st || Store.get();
  const seasons = (st.seasons || []).slice().sort((a,b) => Number(b.season_year) - Number(a.season_year));
  const curYear = new Date().getFullYear();

  return `
    <div class="modal" id="seasonManageModal" style="display:flex;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.65);z-index:9999;align-items:center;justify-content:center;padding:16px">
      <div class="modal-box card" style="max-width:760px;width:100%;max-height:88vh;overflow-y:auto;border:2px solid var(--green)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid var(--line);padding-bottom:10px">
          <div>
            <h3 style="margin:0;color:var(--green-d);font-size:17px">📅 إدارة المواسم والسنوات الزراعية (Agri-ERP)</h3>
            <div class="muted" style="font-size:11.5px;margin-top:2px">التحكم في دورات المواسم، إقفال الحسابات السنوية، وترحيل أرصدة المخزون للمواسم الجديدة</div>
          </div>
          <button type="button" class="btn btn-ghost icon-btn" data-act="close-season-modal" style="padding:4px 8px">✕</button>
        </div>

        ${rolloverSeasonYear ? `
          <div style="background:#FFFBEB;border:1.5px solid #F59E0B;border-radius:10px;padding:14px;margin-bottom:14px">
            <h4 style="margin:0 0 6px;color:#92400E">🔄 تأكيد إقفال موسم ${rolloverSeasonYear}م وترحيل الأرصدة</h4>
            <div style="font-size:12.5px;color:#78350F;line-height:1.6;margin-bottom:12px">
              سيقوم النظام بالإجراءات المحاسبية والزراعية التالية تلقائياً:
              <ul style="margin:6px 0;padding-right:20px">
                <li>إقفال موسم <b>${rolloverSeasonYear}م</b> واعتباره موسماً مؤرشَفاً للقراءة والتقارير فقط لحماية النزاهة المالية.</li>
                <li>احتساب المخزون الفعلي الحالي للأسمدة والمركبات وترحيله كرصيد افتتاحي لموسم <b>${+rolloverSeasonYear + 1}م</b>.</li>
                <li>تحديث أعمار فسائل وشتلات المشتل (+12 شهراً) للعام الجديد.</li>
                <li>تفعيل موسم <b>${+rolloverSeasonYear + 1}م</b> كموسم رئيسي نشط لكافة العمليات والحصاد.</li>
              </ul>
            </div>
            <div style="display:flex;gap:8px;justify-content:flex-end">
              <button class="btn btn-ghost" data-act="cancel-rollover" style="padding:6px 14px">إلغاء</button>
              <button class="btn btn-primary" data-act="confirm-season-rollover" data-id="${rolloverSeasonYear}" style="background:#D97706;border-color:#D97706;padding:6px 16px;font-weight:700">🚀 اعتماد الإقفال والترحيل</button>
            </div>
          </div>
        ` : ""}

        <!-- Seasons Table -->
        <div style="margin-bottom:16px">
          <h4 style="margin:0 0 8px;font-size:13.5px">📋 جدول دورات المواسم الزراعية</h4>
          <div class="grid-wrap"><table class="dense" style="--cell-pad: 6px 8px">
            <thead>
              <tr>
                <th>الموسم</th>
                <th>الفترة الزمنية</th>
                <th>حالة الموسم</th>
                <th>الحصاد المسجل</th>
                <th>العمليات</th>
                <th style="text-align:center">الإجراءات والترحيل</th>
              </tr>
            </thead>
            <tbody>
              ${seasons.map(s => {
                const yYields = (st.yields || []).filter(y => String(y.season) === String(s.season_year));
                const totalKg = yYields.reduce((a, b) => a + (+b.kg || 0), 0);
                const yOps = (st.operations || []).filter(o => yearOf(o.at) === String(s.season_year));
                const isCur = s.is_current || String(s.season_year) === String(dashYear);
                const isClosed = s.status === 'closed';

                return `
                  <tr style="${isCur ? 'background:#F0FDF4;' : ''}">
                    <td>
                      <b>موسم ${s.season_year}م</b>
                      ${s.is_current ? `<span class="badge" style="background:#DCFCE7;color:#166534;font-size:10px;margin-right:4px">الحالي</span>` : ''}
                    </td>
                    <td class="muted" style="font-size:11.5px">${s.start_date || (s.season_year + '-01-01')} إلى ${s.end_date || (s.season_year + '-12-31')}</td>
                    <td>
                      ${isClosed 
                        ? `<span class="status st-wait" style="font-size:11px">🔒 مغلق ومؤرشف</span>`
                        : `<span class="status st-sync" style="font-size:11px">🟢 مفتوح ونشط</span>`}
                    </td>
                    <td><b>${totalKg.toLocaleString()}</b> كجم (${yYields.length})</td>
                    <td><b>${yOps.length}</b> عملية</td>
                    <td style="text-align:center;white-space:nowrap">
                      ${!isClosed ? `
                        ${!isCur ? `
                          <button class="btn btn-ghost icon-btn" data-act="set-current-season" data-id="${s.season_year}" style="padding:3px 8px;font-size:11px;color:#16A34A;font-weight:700" title="تعيين هذا الموسم كموسم زراعي حالي نشط">
                            ⭐ تفعيل كحالي
                          </button>
                        ` : ''}
                        <button class="btn btn-ghost icon-btn" data-act="prompt-rollover" data-id="${s.season_year}" style="padding:3px 8px;font-size:11px;color:#D97706;font-weight:700" title="إقفال وترحيل الأرصدة للعام الجديد">
                          🔄 إقفال وترحيل
                        </button>
                      ` : `
                        <span class="muted" style="font-size:11px">مغلق</span>
                      `}
                    </td>
                  </tr>
                `;
              }).join("") || `<tr><td colspan="6" style="text-align:center" class="muted">لا توجد مواسم مسجلة</td></tr>`}
            </tbody>
          </table></div>
        </div>

        <!-- Add New Season Form -->
        <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:12px 14px;margin-bottom:14px">
          <h4 style="margin:0 0 8px;font-size:13px;color:var(--text)">➕ فتح دورة موسم زراعي جديد</h4>
          <div class="grid grid-4" style="gap:8px">
            <div>
              <label style="font-size:11px">سنة الموسم *</label>
              <input id="new_season_year" type="number" value="${curYear + 1}" style="font-size:12px;padding:5px 8px" />
            </div>
            <div>
              <label style="font-size:11px">تاريخ البداية</label>
              <input id="new_season_start" type="date" value="${curYear + 1}-01-01" style="font-size:12px;padding:5px 8px" />
            </div>
            <div>
              <label style="font-size:11px">تاريخ الانتهاء</label>
              <input id="new_season_end" type="date" value="${curYear + 1}-12-31" style="font-size:12px;padding:5px 8px" />
            </div>
            <div>
              <label style="font-size:11px">ملاحظات الموسم</label>
              <input id="new_season_notes" placeholder="دورة الإنتاج والتسميد..." style="font-size:12px;padding:5px 8px" />
            </div>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px">
            <button class="btn btn-ghost icon-btn" data-act="save-season-only" style="font-size:12px;padding:6px 14px;border:1px solid #CBD5E1">
              ➕ إضافة الموسم فقط (مخطط)
            </button>
            <button class="btn btn-primary icon-btn" data-act="save-new-season" style="font-size:12px;padding:6px 14px">
              ⭐ إضافة وتفعيل كموسم حالي
            </button>
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:8px">
          <button type="button" class="btn btn-ghost" data-act="close-season-modal" style="width:auto">إغلاق</button>
        </div>
      </div>
    </div>
  `;
}

function getDashWidgetsOrder() {
  const def = ["kpi", "feed", "charts", "ops"];
  try {
    const raw = localStorage.getItem("dash_widgets_order");
    if (!raw) return def;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.length === 4 && arr.includes("kpi") && arr.includes("feed") && arr.includes("charts") && arr.includes("ops")) {
      return arr;
    }
  } catch {}
  return def;
}

function setDashWidgetsOrder(order) {
  try {
    localStorage.setItem("dash_widgets_order", JSON.stringify(order));
  } catch {}
}

function wrapDashWidget(id, title, content) {
  const isFeed = (id === "feed");
  return `
    <div class="dash-widget" draggable="true" data-widget-id="${id}" id="dash_w_${id}">
      ${!isFeed ? `
        <div class="dash-widget-header">
          <span class="widget-drag-pill" title="اسحب لإعادة ترتيب هذا المكون أو استخدم أزرار الأسهم">
            <span>⠿</span> ${title}
          </span>
          <div class="widget-move-btns">
            <button type="button" class="btn-w-move" data-act="move-dash-w" data-id="${id}" data-dir="up" title="تحريك لأعلى">▲</button>
            <button type="button" class="btn-w-move" data-act="move-dash-w" data-id="${id}" data-dir="down" title="تحريك لأسفل">▼</button>
          </div>
        </div>
      ` : ""}
      <div class="dash-widget-content">
        ${content}
      </div>
    </div>
  `;
}

