// PalmTrace app — Tree page, import modals, investor contract modal, plot editor, GIS/sector/plot views
// (split from the former single app.js; files are classic scripts loaded in order by index.html)

function palmView(id) {
  const st = Store.get();
  const p = findPalm(id);
  if (!p) return `<div class="card">النخلة غير موجودة</div>`;
  if (session().role === "worker" && !workerAllowed(p.plot, p.id))
    return `<div class="card">غير مسموح لك بالعمل على هذه النخلة</div>`;
  const u = session();
  const allowedWorkPlots = getActiveRoleWorkPlots(u, st);
  const isWorkRestricted = (u?.role === "engineer" || u?.role === "worker") && allowedWorkPlots.length > 0;
  const canOpOnPalm = hasPerm("ops_record") && (!isWorkRestricted || allowedWorkPlots.includes(p.plot));
  const canOsOnPalm = hasPerm("nursery_offshoot_add") && (!isWorkRestricted || allowedWorkPlots.includes(p.plot));
  const kids = (st.offshoots || []).filter(o => 
    String(o.motherId) === String(p.id) ||
    String(o.motherId) === String(p.code) ||
    (o.motherCode && codesEqual(o.motherCode, p.code)) ||
    (p.code && o.tempCode && o.tempCode.startsWith(p.code)) ||
    (p.code && o.tempCode && o.tempCode.startsWith(offshootBaseMotherCode(p.code)))
  );
  const ops = st.operations.filter(o => isOpForPalm(o, p, st)).sort((a,b)=>new Date(b.at)-new Date(a.at));
  const pNotes = (st.treeNotes || []).filter(n => String(n.palmId) === String(p.id) || (p.code && n.palmCode === p.code));
  const secId = st.plots.find(x=>x.id===p.plot)?.sector;
  const effectiveGps = (p.gps_lat && p.gps_lng) ? `${p.gps_lat},${p.gps_lng}` : (p.gps || "");
  const gps = effectiveGps || "24.7136,46.6753";
  const [lat, lon] = gps.split(",").map(Number);
  const curLat = (p.gps_lat !== undefined && p.gps_lat !== null && p.gps_lat !== '') ? p.gps_lat : ((p.gps||"").split(",")[0]||"");
  const curLng = (p.gps_lng !== undefined && p.gps_lng !== null && p.gps_lng !== '') ? p.gps_lng : ((p.gps||"").split(",")[1]||"");
  const lastSpray = lastOp(p.id, o => /رش|سوسة|فطر/.test(typeName(o.typeId)+o.notes));
  const lastFert = lastOp(p.id, o => /تسميد/.test(typeName(o.typeId)));
  const lastCheck = lastOp(p.id, o => true);
  const canEditPalm = hasPerm("palms_edit");
  const canDeletePalm = hasPerm("palms_delete");
  const canApprove = session().role==="admin" || session().role==="engineer";
  if (!canEditPalm) palmEdit = false;
  if (!canDeletePalm) palmMore = false;
  const tabs = [["over","البيانات والحالة"],["kids","الفسائل والنسب ("+kids.length+")"],["ops","العمليات ("+ops.length+")"],["notes","الملاحظات والتكليفات ("+pNotes.length+")"],["map","الموقع والخريطة"]];
  return `
  ${renderFastOpModal(st)}
  ${renderFieldNoteModal(st)}
  <div class="page-head">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      ${codeHtml(p.code)} ${palmBadge(p)}
      <span class="chip" style="font-weight:bold;font-size:13px">${cropIcon(p.cropId || 'palm', 16)} ${p.variety || 'خلاص'}</span>
    </div>
    <div class="actions" style="margin:0;gap:8px">
      ${p.archived ? "" : `
        ${canOpOnPalm ? `<button class="btn btn-primary icon-btn" data-act="go-op" data-id="${p.id}">تسجيل عملية</button>` : ''}
        ${(canOpOnPalm && !st.settings?.hideQuickOp) ? `<button class="btn btn-ghost icon-btn" data-act="go-fast-op" data-id="${p.id}">⚡ عملية سريعة</button>` : ''}
        ${canOsOnPalm ? `<button class="btn btn-ghost icon-btn" data-act="go-os" data-id="${p.id}" style="border:1.5px solid #059669;color:#047857;background:#ECFDF5;font-weight:700">🌱 قلع فسيلة</button>` : ''}
        <button class="btn btn-ghost icon-btn" data-act="open-field-note-modal" data-id="${p.id}" style="border:1.5px solid #3B82F6;color:#1D4ED8;background:#EFF6FF;font-weight:700">📝 + ملاحظة / تكليف</button>
        <button class="btn btn-ghost icon-btn" data-act="ai-inspect-palm" data-id="${p.code}" style="border:1.5px solid #8B5CF6;color:#6D28D9;background:#F5F3FF;font-weight:700">✨ فحص ذكي للآفات</button>
      `}
      ${canEditPalm ? `<button class="btn ${palmEdit ? 'btn-primary' : 'btn-ghost'} icon-btn" data-act="tog-edit">${palmEdit ? "✕ إغلاق التعديل" : "✏️ تعديل البيانات"}</button>` : ""}
      ${canDeletePalm ? `<button class="btn btn-ghost icon-btn" data-act="tog-more">${palmMore?"إخفاء الإجراءات":"المزيد ▾"}</button>` : ""}
    </div>
  </div>
  ${palmMore && canDeletePalm ? `<div class="card" style="background:#FFF9E6;border-color:var(--orange);margin-bottom:12px">
    <div class="actions" style="margin:0;gap:8px">
      ${hasPerm("palms_archive") ? `
        <button class="btn ${p.archived ? 'btn-primary' : 'btn-orange'} icon-btn" data-act="archive-palm" data-id="${p.id}">
          ${p.archived ? '🌴 إلغاء الأرشفة واستعادة الشجرة' : '📦 أرشفة الشجرة (ميتة/مزالة)'}
        </button>
      ` : ''}
      ${hasPerm("palms_delete") ? `
        <button class="btn btn-danger icon-btn" data-act="del-palm" data-id="${p.id}">
          🗑️ حذف الشجرة نهائياً
        </button>
      ` : ''}
    </div>
  </div>` : ''}
  <div class="ptabs" style="margin-bottom:14px">${tabs.map(([t,l])=>`<button class="${palmTab===t?"on":""}" data-act="palm-tab" data-id="${t}">${l}</button>`).join("")}</div>
  ${palmTab==="over"?`
    ${palmEdit && canEditPalm ? `
      <div class="card" style="background:#F0FDF4;border:2px solid var(--green);border-radius:12px;margin-bottom:16px;padding:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid #BBF7D0;padding-bottom:10px">
          <h3 style="margin:0;color:#166534">✏️ تعديل بيانات الشجرة (${p.code})</h3>
          <button class="btn btn-ghost icon-btn" data-act="tog-edit">✕ إغلاق التعديل</button>
        </div>
        <div class="grid grid-3">
          <div><label>الصنف</label><select id="evar">${varietyOptions(p.variety)}</select></div>
          <div>
            <label>الحالة الصحية</label>
            <select id="estat">
              <option value="سليمة" ${p.status==="سليمة"?"selected":""}>سليمة</option>
              <option value="تحت المراقبة" ${(p.status==="تحت المراقبة" || p.statusCode==="observation" || p.statusId===2)?"selected":""}>تحت المراقبة</option>
              <option value="مصابة" ${(p.status==="مصابة" || p.statusCode==="infected" || p.statusId===3)?"selected":""}>مصابة</option>
              <option value="ميتة" ${(p.status==="ميتة" || p.statusCode==="dead" || p.statusId===5)?"selected":""}>ميتة</option>
            </select>
          </div>
          <div><label>نقل إلى قطعة</label><select id="eplot">${Store.get().plots.map(pl=>`<option value="${pl.id}" ${pl.id===p.plot?"selected":""}>${pl.id} — ${pl.name}</option>`)}</select></div>
        </div>
        <div class="grid grid-3" style="margin-top:10px">
          <div><label>كود الفسيلة الأصلية / الأم</label><input id="eparent" value="${p.parentCode||p.tempCode||""}" /></div>
          <div><label>تاريخ قلع الفسيلة</label><input id="eoffd" type="date" value="${p.offshootDate||""}" /></div>
          <div><label>عمر المشتل بالأشهر</label><input id="enage" type="number" value="${palmAges(p).nursery}" /></div>
        </div>
        <div style="margin-top:10px">
          <label>ملاحظات وسجل الشجرة</label>
          <textarea id="enotes">${p.notes||""}</textarea>
        </div>
        <div style="margin-top:12px;background:#fff;border:1px solid #E2E8F0;border-radius:8px;padding:12px">
          <div style="font-weight:700;margin-bottom:8px">📍 الإحداثيات الجغرافية وتحديث الموقع</div>
          <div class="grid grid-2">
            <div><label>خط العرض (Latitude)</label><input id="elat" value="${curLat}" placeholder="مثال: 28.358212" /></div>
            <div><label>خط الطول (Longitude)</label><input id="elng" value="${curLng}" placeholder="مثال: 28.868735" /></div>
          </div>
          <button class="btn btn-ghost icon-btn" data-act="geo-me" type="button" style="margin-top:6px">🛰️ التقاط موقعي الحالي</button>
          <div id="editmap" class="mini-map" style="margin-top:10px;height:220px;border-radius:8px"></div>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
          <button class="btn btn-ghost" data-act="tog-edit">إلغاء</button>
          <button class="btn btn-primary" data-act="edit-palm" data-id="${p.id}" style="font-weight:700">💾 حفظ التعديلات</button>
        </div>
      </div>
    ` : ''}

    <!-- KPI Summary Micro-cards -->
    <div class="grid grid-4" style="margin-bottom:14px;gap:10px">
      <div class="card kpi kpi-compact"><div class="n" style="color:var(--green)">${palmAges(p).total} شهر</div><div class="l">العمر الكلي (حقل + مشتل)</div></div>
      <div class="card kpi kpi-compact"><div class="n">${palmAges(p).nursery} شهر</div><div class="l">عمر التحضين بالمشتل</div></div>
      <div class="card kpi kpi-compact"><div class="n" style="color:#2563EB">${kids.length}</div><div class="l">فسائل منسوبة للأم</div></div>
      <div class="card kpi kpi-compact"><div class="n" style="color:#D97706">${ops.length}</div><div class="l">عمليات زراعية منفذة</div></div>
    </div>

    <!-- Balanced 2-Column Specifications -->
    <div class="grid grid-2" style="gap:14px">
      <div class="card" style="padding:16px">
        <h4 style="margin:0 0 12px;display:flex;align-items:center;gap:6px;border-bottom:1px solid #E2E8F0;padding-bottom:8px">
          🌴 الهوية الزراعية والنسب
        </h4>
        <div style="display:flex;flex-direction:column;gap:8px;font-size:13px">
          <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #F1F5F9">
            <span class="muted">المحصول والصنف:</span>
            <b>${cropOf(p).name} — ${p.variety}</b>
          </div>
          <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #F1F5F9">
            <span class="muted">الحالة الصحية:</span>
            <span>${palmStatusHtml(p)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #F1F5F9">
            <span class="muted">القطعة والموقع:</span>
            <b>${plotName(p.plot)} (قطاع ${secId ? (sectorName(secId)||secId) : '—'})</b>
          </div>
          <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #F1F5F9">
            <span class="muted">تاريخ الغرس بالحقل:</span>
            <b>${p.plantDate || "—"}</b>
          </div>
          <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #F1F5F9">
            <span class="muted">المصدر والتوريد:</span>
            <b>${p.originType === "internal" ? "داخلي (المزرعة)" : "شراء وتوريد خارجي"}</b>
          </div>
          <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #F1F5F9">
            <span class="muted">المورد / الجهة:</span>
            <b>${p.supplier || "—"}</b>
          </div>
          <div style="display:flex;justify-content:space-between;padding:4px 0">
            <span class="muted">كود الفسيلة/الأم الأصلية:</span>
            <b style="font-family:monospace">${p.parentCode || p.tempCode || "—"}</b>
          </div>
        </div>
      </div>

      <div class="card" style="padding:16px">
        <h4 style="margin:0 0 12px;display:flex;align-items:center;gap:6px;border-bottom:1px solid #E2E8F0;padding-bottom:8px">
          🛡️ الرعاية والمتابعة الميدانية
        </h4>
        <div style="display:flex;flex-direction:column;gap:8px;font-size:13px">
          <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #F1F5F9">
            <span class="muted">آخر فحص ومعاينة:</span>
            <b>${lastCheck ? fmtDate(lastCheck.at) : "لم تُسجل بعد"}</b>
          </div>
          <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #F1F5F9">
            <span class="muted">آخر عملية تسميد:</span>
            <b>${lastFert ? fmtDate(lastFert.at) : "لا يوجد"}</b>
          </div>
          <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #F1F5F9">
            <span class="muted">مكافحة السوسة والرش:</span>
            <b>${lastSpray ? fmtDate(lastSpray.at) : (p.status === "تحت المراقبة" ? "تحت المتابعة (لم تسجل مكافحة)" : ((p.status||"").includes("سوسة") || (p.status||"").includes("مصاب") ? "مصابة (تحتاج تدخل فوري)" : "سليمة (لا يوجد إصابة)"))}</b>
          </div>
          <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #F1F5F9">
            <span class="muted">الإحداثيات الجغرافية:</span>
            <b style="direction:ltr;font-family:monospace">${curLat && curLng ? `${curLat.toString().slice(0,8)}, ${curLng.toString().slice(0,8)}` : "غير مسجلة"}</b>
          </div>
          <div style="padding:4px 0">
            <span class="muted">الملاحظات:</span>
            <div style="margin-top:2px;font-style:italic;color:#475569">${p.notes || "لا توجد ملاحظات مسجلة لهذه الشجرة"}</div>
          </div>
          <div style="margin-top:8px;padding-top:8px;border-top:1px solid #E2E8F0;font-size:12px;display:flex;flex-direction:column;gap:5px;background:#F8FAFC;padding:8px 12px;border-radius:8px">
            <div style="display:flex;justify-content:space-between">
              <span class="muted">تاريخ وإثبات التكويد:</span>
              <span style="direction:ltr">${fmtDate(p.createdAt || p.created_at || p.plantDate || p.date)} ${p.createdBy || p.created_by ? `(${escapeHtml(p.createdBy || p.created_by)})` : ''}</span>
            </div>
            <div style="display:flex;justify-content:space-between">
              <span class="muted">آخر تعديل وتحديث للحالة:</span>
              <span style="font-weight:700;color:#1E293B;direction:ltr">${(p.modifiedAt || p.modified_at) ? fmtDate(p.modifiedAt || p.modified_at) : '—'} ${(p.modifiedBy || p.modified_by) ? `(${escapeHtml(p.modifiedBy || p.modified_by)})` : ''}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `:""}
  ${palmTab==="kids"?`<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;border-bottom:1px solid #E2E8F0;padding-bottom:10px">
      <h4 style="margin:0;font-size:15px;color:#0F172A">🌱 سجل الفسائل والنسب المنفصلة من هذه النخلة (${kids.length})</h4>
      ${canOsOnPalm ? `<button class="btn btn-primary icon-btn" data-act="go-os" data-id="${p.id}" style="padding:6px 14px;font-size:13px;font-weight:700">🌱 + تسجيل قلع فسيلة جديدة من هذه النخلة</button>` : ''}
    </div>
    <div class="tree-box">
      <div class="tree-node root">${p.parentId?palmA(p.parentId,"الأم ← "):""}<b>الأصل الحالي</b> ${codeHtml(p.code)}</div>
      ${kids.map(k=>{
        const isPl = Boolean(k.newPalmId || k.isPlanted || k.nsStatus === "planted");
        return `<div class="tree-node tree-child" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;padding:8px 10px">
          <div>
            <b>${osA(k.id,k.tempCode)}</b> — <span class="muted">${k.date||""}</span>
            <div style="margin-top:3px">${osStatusHtml(k)}</div>
          </div>
          ${isPl && k.newPalmId ? `<button class="btn btn-ghost icon-btn" data-go="palm" data-id="${k.newPalmId}" style="padding:4px 10px;font-size:12px">🌴 عرض الشجرة بالحقل</button>` : ''}
        </div>`;
      }).join("")||"<div class='muted' style='text-align:center;padding:16px 0'>لا توجد فسائل مسجلة لهذه النخلة بعد</div>"}
    </div>
  </div>`:""}
  ${palmTab==="ops"?`<div class="card"><table class="dense">
    <thead><tr><th>التاريخ</th><th>النوع</th><th>النطاق</th><th>العامل</th><th>الحالة</th><th></th></tr></thead>
    <tbody>${ops.map(o=>{
      const w = userBy(o.workerId);
      const isDirect = String(o.palmId) === String(p.id) || (p.code && o.palmCode === p.code);
      const isPlotOp = !isDirect && (o.plotId || (o.notes && o.notes.includes("قطعة")));
      const scopeBadge = isDirect ? `<span class="badge" style="background:#F1F5F9;color:#475569;font-size:11px">🌴 فردي</span>` :
                         isPlotOp ? `<span class="badge" style="background:#EFF6FF;color:#1D4ED8;font-size:11px">📦 جماعي (قطعة)</span>` :
                         `<span class="badge" style="background:#F0FDF4;color:#166534;font-size:11px">🌐 شامل (قطاع)</span>`;
      const isBatch = Boolean(o.isBatch || o.batchId || o.bulkId || (o.device && o.device.startsWith("bulk:")));
      const batchId = o.batchId || o.bulkId || (o.device && o.device.startsWith("bulk:") ? o.device.replace("bulk:", "") : null) || o.id;

      return `<tr>
        <td>${fmtDate(o.at)}</td>
        <td>
          <div style="font-weight:700">${typeName(o.typeId)}</div>
          ${o.notes ? `<div class="muted" style="font-size:10.5px;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${escapeHtml(o.notes)}">${escapeHtml(o.notes)}</div>` : ''}
        </td>
        <td>${scopeBadge}</td>
        <td>${w?.name||"—"}</td>
        <td>${opBadge(o)}</td>
        <td class="row-acts">
          ${canApprove && o.approval !== "approved" ? (
            isBatch ? `
              <button class="btn btn-primary icon-btn" data-act="batch-approve-op" data-id="${batchId}" data-batch="${batchId}" style="background:#16A34A;font-weight:700">✓ اعتماد الحزمة</button>
              <button class="btn btn-orange icon-btn" data-act="batch-reject-op" data-id="${batchId}" data-batch="${batchId}">✕</button>
            ` : `
              <button class="btn btn-primary icon-btn" data-act="approve-op" data-id="${o.id}">اعتماد</button>
              <button class="btn btn-orange icon-btn" data-act="reject-op" data-id="${o.id}">رفض</button>
            `
          ) : ""}
          ${isBatch ? `
            <button class="btn btn-ghost icon-btn" data-act="inspect-batch" data-id="${batchId}" data-batch="${batchId}" title="معاينة الحزمة الجماعية">👁️ معاينة الحزمة</button>
          ` : `
            <button class="btn btn-ghost icon-btn" data-go="op-detail" data-id="${o.id}">تفاصيل</button>
          `}
        </td>
      </tr>`;
    }).join("")||"<tr><td colspan='6'>لا توجد عمليات مسجلة لهذه الشجرة</td></tr>"}</tbody></table></div>`:""}
  ${palmTab==="notes"?`
    <div class="card" style="padding:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid #E2E8F0;padding-bottom:10px">
        <h4 style="margin:0;display:flex;align-items:center;gap:6px">
          <span>📝 الملاحظات والتكليفات الميدانية للشجرة</span>
          <span class="badge" style="background:#EFF6FF;color:#1D4ED8;font-size:12px">${pNotes.length}</span>
        </h4>
        <button class="btn btn-primary icon-btn" data-act="open-field-note-modal" data-id="${p.id}" style="font-size:12px;padding:5px 12px">
          + إضافة ملاحظة / تكليف
        </button>
      </div>
      ${pNotes.length ? `
        <div style="display:flex;flex-direction:column;gap:12px">
          ${pNotes.map(n => {
            const isUrgent = n.priority === 'urgent';
            const isMedium = n.priority === 'medium';
            const prioBadge = isUrgent ? '<span class="badge" style="background:#FEE2E2;color:#991B1B">🔴 عاجل</span>' :
                              isMedium ? '<span class="badge" style="background:#FEF3C7;color:#92400E">⚠️ متوسط</span>' :
                              '<span class="badge" style="background:#E0F2FE;color:#0369A1">ℹ️ عادي</span>';
            const stBadge = n.status === 'closed' ? '<span class="badge" style="background:#F1F5F9;color:#475569">🔒 مغلق ومعتمد</span>' :
                            n.status === 'completed' ? '<span class="badge" style="background:#DCFCE7;color:#166534">✓ بانتظار الاعتماد</span>' :
                            n.status === 'in_progress' ? '<span class="badge" style="background:#FEF3C7;color:#92400E">🚜 قيد التنفيذ</span>' :
                            '<span class="badge" style="background:#EFF6FF;color:#1D4ED8">⏳ قيد الانتظار</span>';
            const targetLabel = n.targetType === 'ALL_TEAM' ? 'فريق العمل الميداني (عام)' : (userBy(n.assignedTo)?.name || 'فني محدد');
            const cNotes = n.completionNotes || n.completion_notes;
            const cPhoto = n.completionPhoto || n.completion_photo;

            return `
              <div style="border:1px solid #E2E8F0;border-radius:10px;padding:12px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.03)">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:8px">
                  <div style="display:flex;align-items:center;gap:6px">
                    ${prioBadge}
                    ${stBadge}
                    <b style="font-size:14px;color:#1E293B">${n.title}</b>
                  </div>
                  ${(() => {
                    const authorObj = userBy(n.createdBy || n.authorId || n.author_id);
                    const authorName = n.authorName || authorObj?.name || 'المشرف';
                    const authorRole = roleLabel(n.authorRole || authorObj?.role || 'supervisor');
                    return `<span style="font-size:11.5px;color:#475569">بواسطة: <b>${authorName}</b> <span class="badge" style="background:#E0E7FF;color:#3730A3;font-size:10px;padding:1px 6px">${authorRole}</span> • <span class="muted">${fmtDateTime(n.createdAt || n.created_at)}</span></span>`;
                  })()}
                </div>
                ${n.notes ? `<div style="font-size:13px;color:#334155;background:#F8FAFC;padding:8px 12px;border-radius:6px;margin-bottom:8px">${n.notes}</div>` : ''}
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;font-size:12px;color:#64748B">
                  <div>الموجّه له: <b style="color:#1E293B">${targetLabel}</b></div>
                  <div style="display:flex;gap:6px">
                    ${n.status === 'pending' && (session().role === 'worker' || session().role === 'engineer' || session().role === 'admin') ? `
                      <button class="btn btn-primary btn-sm" data-act="start-note" data-id="${n.id}" style="padding:3px 10px;font-size:11.5px">🚜 بدء التنفيذ</button>
                    ` : ''}
                    ${n.status === 'in_progress' && (session().role === 'worker' || session().role === 'engineer' || session().role === 'admin') ? `
                      <button class="btn btn-primary btn-sm" data-act="open-complete-note-modal" data-id="${n.id}" style="background:#16A34A;padding:3px 10px;font-size:11.5px">📸 توثيق وإتمام</button>
                    ` : ''}
                    ${n.status === 'completed' && canApprove ? `
                      <button class="btn btn-primary btn-sm" data-act="close-note" data-id="${n.id}" style="background:#16A34A;font-weight:700;padding:3px 10px;font-size:11.5px">✓ اعتماد وإغلاق</button>
                    ` : ''}
                  </div>
                </div>
                ${cNotes || cPhoto ? `
                  <div style="margin-top:8px;padding-top:8px;border-top:1px dashed #E2E8F0;font-size:12px">
                    <div style="color:#166534;font-weight:700;margin-bottom:4px">✓ تقرير الإنجاز الميداني:</div>
                    ${cNotes ? `<div style="color:#334155;margin-bottom:4px">${cNotes}</div>` : ''}
                    ${cPhoto ? `
                      <a href="javascript:void(0)" onclick="window.viewImagePreview('${cPhoto}', 'توثيق الإنجاز الميداني')" style="display:inline-block;margin-top:4px;cursor:pointer">
                        <img src="${cPhoto}" style="max-height:80px;border-radius:6px;border:1px solid #CBD5E1" alt="توثيق الإنجاز" />
                      </a>
                    ` : ''}
                  </div>
                ` : ''}
              </div>
            `;
          }).join("")}
        </div>
      ` : `
        <div style="text-align:center;padding:30px 10px;color:var(--muted)">
          <div style="font-size:36px;margin-bottom:8px">📋</div>
          <div>لا توجد ملاحظات أو تكليفات مسجلة لهذه الشجرة حتى الآن.</div>
          <button class="btn btn-primary" data-act="open-field-note-modal" data-id="${p.id}" style="margin-top:12px">
            + إضافة أول ملاحظة / تكليف
          </button>
        </div>
      `}
    </div>
  `:""}
  ${palmTab==="map"?`<div class="card">
    ${mapsLink(gps)}
    <iframe class="mini-map" src="https://maps.google.com/maps?q=${lat},${lon}&z=18&output=embed" loading="lazy"></iframe>
    <p class="muted">موضع تقريبي داخل ${plotName(p.plot)} — ${sectorName(secId)}</p>
  </div>`:""}`;
}

function renderPlotsImportModal() {
  if (!showPlotImportModal) return "";
  return `
    <div class="modal-backdrop custom-modal-backdrop" data-act="close-plots-import" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(15,23,42,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)">
      <div class="card" style="width:100%;max-width:680px;max-height:90vh;overflow-y:auto;background:#fff;border-radius:16px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);border:1px solid #E2E8F0;padding:24px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:1px solid #F1F5F9;padding-bottom:12px">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:24px">📥</span>
            <div>
              <h3 style="margin:0;font-size:18px;color:#0F172A">استيراد وتحديث حدود وقطع الأراضي (Smart Agri-GIS)</h3>
              <div class="muted" style="font-size:12px">استيراد الإحداثيات الجغرافية للأركان الأربعة، المساحة، والتقسيم الهرمي عبر Excel</div>
            </div>
          </div>
          <button class="icon-btn" data-act="close-plots-import" style="font-size:18px;background:#F8FAFC;border:none;border-radius:50%;width:32px;height:32px;cursor:pointer">✕</button>
        </div>

        <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:14px 16px;margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
            <div>
              <div style="font-weight:bold;color:#166534;font-size:13px">📄 نموذج إكسل جاهز ومعتمد (19 عموداً A - S)</div>
              <div style="font-size:12px;color:#15803D;margin-top:2px">يشمل النموذج إحداثيات الأركان الأربعة، كود القطعة الأم والفرعية، السعة، ومصدر الري.</div>
            </div>
            <a href="/api/plots/template" target="_blank" class="btn btn-primary btn-sm" style="background:#16A34A;display:inline-flex;align-items:center;gap:6px">
              <span>⬇️</span> تحميل نموذج الإكسل
            </a>
          </div>
        </div>

        <div style="border:2px dashed #CBD5E1;border-radius:14px;padding:26px 16px;text-align:center;background:#F8FAFC;margin-bottom:16px;cursor:pointer;transition:border-color .2s, background .2s" id="plots-drop-zone">
          <input type="file" id="plots-file-input" accept=".xlsx,.xls,.csv" style="display:none" />
          <div style="font-size:36px;margin-bottom:8px">📊</div>
          <div style="font-weight:bold;font-size:14px;color:#334155;margin-bottom:4px">انقر هنا أو اسحب ملف الإكسل لاختياره</div>
          <div class="muted" style="font-size:12px">يدعم ملفات .xlsx و .xls و .csv (حجم أقصى 10 ميجابايت)</div>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-pick-plots-file" style="margin-top:10px;pointer-events:auto">اختيار ملف من الجهاز</button>
          <div id="plots-selected-file" style="margin-top:10px"></div>
        </div>

        <div id="plots-import-result" style="display:none;margin-bottom:16px"></div>

        <div style="display:flex;justify-content:flex-end;gap:10px;border-top:1px solid #F1F5F9;padding-top:14px">
          <button class="btn btn-ghost" data-act="close-plots-import">إلغاء</button>
          <button type="button" class="btn btn-primary" id="btn-do-plots-import" disabled style="min-width:140px;font-weight:bold">
            🚀 بدء الاستيراد
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderInvestorsImportModal() {
  if (!showInvestorImportModal) return "";
  return `
    <div class="modal-backdrop custom-modal-backdrop" onclick="act('close-investors-import')" data-act="close-investors-import" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(15,23,42,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)">
      <div class="card" onclick="if (!event.target.closest('[data-act]')) event.stopPropagation()" style="width:100%;max-width:740px;max-height:92vh;overflow-y:auto;background:#fff;border-radius:16px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);border:1px solid #E2E8F0;padding:24px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:1px solid #F1F5F9;padding-bottom:12px">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:24px">💼</span>
            <div>
              <h3 style="margin:0;font-size:18px;color:#0F172A">استيراد بيانات المستثمرين والعقود الاستثمارية (Excel)</h3>
              <div class="muted" style="font-size:12px">استيراد الحسابات، أرقام العقود، نسب المحصول، والأدوار الإضافية وربطها بالقطع تلقائياً</div>
            </div>
          </div>
          <button type="button" class="icon-btn" onclick="act('close-investors-import')" data-act="close-investors-import" style="font-size:18px;background:#F8FAFC;border:none;border-radius:50%;width:32px;height:32px;cursor:pointer" title="إغلاق">✕</button>
        </div>

        <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:14px 16px;margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
            <div>
              <div style="font-weight:bold;color:#166534;font-size:13px">📄 نموذج إكسل جاهز ومعتمد (12 عموداً A - L)</div>
              <div style="font-size:12px;color:#15803D;margin-top:2px">يشمل بيانات المستثمر، الأدوار الإضافية (مثل: worker)، رقم العقد، القطع المشمولة (مفصولة بفواصل)، والنسبة.</div>
            </div>
            <a href="/api/investors/template" target="_blank" class="btn btn-primary btn-sm" style="background:#16A34A;display:inline-flex;align-items:center;gap:6px">
              <span>⬇️</span> تحميل نموذج المستثمرين والعقود
            </a>
          </div>
        </div>

        <!-- 12 Columns Specification Overview -->
        <details style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:10px 14px;margin-bottom:16px">
          <summary style="font-weight:bold;font-size:12px;color:#334155;cursor:pointer">📋 تفصيل أعمدة النموذج الـ 12 المعتمدة (اضغط للاستعراض)</summary>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;margin-top:10px;font-size:11px">
            <div style="background:#fff;padding:6px 10px;border-radius:6px;border:1px solid #E2E8F0"><b>A:</b> اسم المستثمر (إلزامي)</div>
            <div style="background:#fff;padding:6px 10px;border-radius:6px;border:1px solid #E2E8F0"><b>B:</b> رقم الهاتف / الدخول (إلزامي)</div>
            <div style="background:#fff;padding:6px 10px;border-radius:6px;border:1px solid #E2E8F0"><b>C:</b> البريد الإلكتروني</div>
            <div style="background:#fff;padding:6px 10px;border-radius:6px;border:1px solid #E2E8F0"><b>D:</b> الأدوار الإضافية (مثل: worker)</div>
            <div style="background:#fff;padding:6px 10px;border-radius:6px;border:1px solid #E2E8F0"><b>E:</b> رقم العقد الاستثماري (إلزامي)</div>
            <div style="background:#fff;padding:6px 10px;border-radius:6px;border:1px solid #E2E8F0"><b>F:</b> مسمى / موضوع العقد</div>
            <div style="background:#fff;padding:6px 10px;border-radius:6px;border:1px solid #E2E8F0"><b>G:</b> تاريخ بداية العقد</div>
            <div style="background:#fff;padding:6px 10px;border-radius:6px;border:1px solid #E2E8F0"><b>H:</b> تاريخ نهاية العقد</div>
            <div style="background:#fff;padding:6px 10px;border-radius:6px;border:1px solid #E2E8F0"><b>I:</b> أكواد القطع (مفصولة بفواصل: 12A, 12B)</div>
            <div style="background:#fff;padding:6px 10px;border-radius:6px;border:1px solid #E2E8F0"><b>J:</b> إجمالي عدد النخيل بالعقد</div>
            <div style="background:#fff;padding:6px 10px;border-radius:6px;border:1px solid #E2E8F0"><b>K:</b> نسبة المستثمر من المحصول (%)</div>
            <div style="background:#fff;padding:6px 10px;border-radius:6px;border:1px solid #E2E8F0"><b>L:</b> الحالة المالية (مسدد بالكامل / أقساط)</div>
          </div>
        </details>

        <div style="border:2px dashed #CBD5E1;border-radius:14px;padding:26px 16px;text-align:center;background:#F8FAFC;margin-bottom:16px;cursor:pointer;transition:border-color .2s, background .2s" id="investors-drop-zone">
          <input type="file" id="investors-file-input" accept=".xlsx,.xls,.csv" style="display:none" />
          <div style="font-size:36px;margin-bottom:8px">📊</div>
          <div style="font-weight:bold;font-size:14px;color:#334155;margin-bottom:4px">انقر هنا أو اسحب ملف الإكسل لاختياره</div>
          <div class="muted" style="font-size:12px">يدعم ملفات .xlsx و .xls و .csv (الحد الأقصى 10 ميجابايت)</div>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-pick-investors-file" style="margin-top:10px;pointer-events:auto">اختيار ملف من الجهاز</button>
          <div id="investors-selected-file" style="margin-top:10px"></div>
        </div>

        <div id="investors-import-result" style="display:none;margin-bottom:16px"></div>

        <div style="display:flex;justify-content:flex-end;gap:10px;border-top:1px solid #F1F5F9;padding-top:14px">
          <button type="button" class="btn btn-ghost" onclick="act('close-investors-import')" data-act="close-investors-import">إلغاء</button>
          <button type="button" class="btn btn-primary" id="btn-do-investors-import" disabled style="min-width:140px;font-weight:bold">
            🚀 بدء الاستيراد
          </button>
        </div>
      </div>
    </div>
  `;
}

window.downloadSeedlingsExcelTemplate = function() {
  if (typeof XLSX === "undefined") {
    toast("تعذر العثور على مكتبة الإكسل", "warn");
    return;
  }
  const headers = [
    "المحصول",
    "الصنف",
    "الكمية",
    "مصدر الإكثار",
    "المورد / الجهة",
    "تاريخ التوريد",
    "موقع التحضين / الصوبة",
    "مرحلة المشتل",
    "تكلفة الشتلة",
    "ملاحظات"
  ];
  const sampleData = [
    ["نخيل التمر", "مجدول", 50, "فسيلة", "مشتل الواحة النموذجي", new Date().toISOString().slice(0, 10), "صوبة 1 - خط A", "الوارد والتوريد", 350, "توريد شتلات نخيل مجدول نخب أول"],
    ["أشجار الزيتون", "بيكوال", 100, "عقلة خضرية", "مشتل الأمل الزراعي", new Date().toISOString().slice(0, 10), "صوبة 2 - حوض 4", "التجذير والرعاية", 45, "عقل زيتون بيكوال للتجذير"],
    ["نخيل التمر", "برحي", 30, "نسيج", "مختبر النخيل للأنسجة", new Date().toISOString().slice(0, 10), "صوبة 1 - خط B", "جاهزة للصرف", 500, "شتلات نسيجية أقلمة ممتازة"]
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
  ws['!cols'] = [
    { wch: 15 }, { wch: 18 }, { wch: 10 }, { wch: 16 },
    { wch: 24 }, { wch: 14 }, { wch: 22 }, { wch: 18 },
    { wch: 14 }, { wch: 32 }
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "الشتلات والفسائل");
  XLSX.writeFile(wb, "نموذج_استيراد_الشتلات_PalmTrace.xlsx");
  toast("✓ تم تنزيل نموذج إكسل استيراد الشتلات بنجاح");
};

function renderSeedlingsImportModal() {
  if (!showSeedlingImportModal) return "";
  const totalCount = parsedSeedlingsData.reduce((sum, r) => sum + (Number(r.qty) || 0), 0);

  return `
    <div class="modal-backdrop custom-modal-backdrop" data-act="close-seedlings-import" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(15,23,42,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)">
      <div class="card" onclick="if (!event.target.closest('[data-act]')) event.stopPropagation()" style="width:100%;max-width:760px;max-height:92vh;overflow-y:auto;background:#fff;border-radius:16px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);border:1px solid #E2E8F0;padding:24px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:1px solid #F1F5F9;padding-bottom:12px">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:26px">🌱</span>
            <div>
              <h3 style="margin:0;font-size:18px;color:#0F172A">استيراد وتوريد الشتلات والفسائل (Excel Bulk Import)</h3>
              <div class="muted" style="font-size:12px">استيراد كميات مجمعة من أصول النخيل والزيتون والمحاصيل وإضافتها للمشتل دفعة واحدة</div>
            </div>
          </div>
          <button type="button" class="icon-btn" onclick="act('close-seedlings-import')" data-act="close-seedlings-import" style="font-size:18px;background:#F8FAFC;border:none;border-radius:50%;width:32px;height:32px;cursor:pointer">✕</button>
        </div>

        <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:14px 16px;margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
            <div>
              <div style="font-weight:bold;color:#166534;font-size:13px">📄 نموذج إكسل معتمد وجاهز للإدخال (10 أعمدة)</div>
              <div style="font-size:12px;color:#15803D;margin-top:2px">يشمل المحصول، الصنف، الكمية الموردة، مصدر الإكثار، المورد، الموقع، والمرحلة.</div>
            </div>
            <button type="button" onclick="window.downloadSeedlingsExcelTemplate()" class="btn btn-primary btn-sm" style="background:#16A34A;display:inline-flex;align-items:center;gap:6px;cursor:pointer">
              <span>⬇️</span> تحميل نموذج إكسل الشتلات
            </button>
          </div>
        </div>

        <div style="border:2px dashed #CBD5E1;border-radius:14px;padding:24px 16px;text-align:center;background:#F8FAFC;margin-bottom:16px;cursor:pointer;transition:border-color .2s, background .2s" id="seedlings-drop-zone">
          <input type="file" id="seedlings-file-input" accept=".xlsx,.xls,.csv" style="display:none" />
          <div style="font-size:36px;margin-bottom:8px">📊</div>
          <div style="font-weight:bold;font-size:14px;color:#334155;margin-bottom:4px">انقر هنا أو اسحب ملف إكسل الشتلات لاختياره</div>
          <div class="muted" style="font-size:12px">يدعم ملفات .xlsx و .xls و .csv (حجم أقصى 10 ميجابايت)</div>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-pick-seedlings-file" style="margin-top:10px;pointer-events:auto">اختيار ملف من الجهاز</button>
          <div id="seedlings-selected-file" style="margin-top:10px">
            ${selectedSeedlingsFileName ? `
              <div style="background:#F0FDF4;border:1px solid #86EFAC;color:#166534;padding:8px 14px;border-radius:8px;display:inline-flex;align-items:center;gap:8px;margin-top:10px;font-size:13px;box-shadow:0 1px 2px rgba(0,0,0,0.05)">
                <span style="font-size:16px">📄</span>
                <b>${escapeHtml(selectedSeedlingsFileName)}</b>
                <span style="color:#16A34A;font-size:14px">✓ جاهز</span>
              </div>
            ` : ''}
          </div>
        </div>

        <div id="seedlings-preview-area" style="${parsedSeedlingsData.length > 0 ? '' : 'display:none;'}margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span style="font-weight:700;font-size:13px;color:#1E293B">معاينة البيانات المستخرجة (${parsedSeedlingsData.length} دفعة • إجمالي ${totalCount} شتلة):</span>
            <span class="chip" style="background:#DCFCE7;color:#166534;font-weight:700;font-size:11px">جاهز للتوريد</span>
          </div>
          <div style="max-height:200px;overflow-y:auto;border:1px solid #E2E8F0;border-radius:8px">
            <table class="table" style="margin:0;font-size:12px">
              <thead style="position:sticky;top:0;background:#F8FAFC">
                <tr>
                  <th style="padding:6px 10px">المحصول</th>
                  <th style="padding:6px 10px">الصنف</th>
                  <th style="padding:6px 10px;text-align:center">الكمية</th>
                  <th style="padding:6px 10px">المصدر</th>
                  <th style="padding:6px 10px">المورد / الجهة</th>
                  <th style="padding:6px 10px">المرحلة بالمشتل</th>
                </tr>
              </thead>
              <tbody>
                ${parsedSeedlingsData.map(r => `
                  <tr>
                    <td style="padding:6px 10px"><b>${r.cropId === 'olive' ? '🫒 زيتون' : '🌴 نخيل'}</b></td>
                    <td style="padding:6px 10px">${escapeHtml(r.variety)}</td>
                    <td style="padding:6px 10px;text-align:center"><span class="badge" style="background:#E0F2FE;color:#0369A1;font-weight:800">${r.qty}</span></td>
                    <td style="padding:6px 10px">${escapeHtml(r.sourceName || r.source)}</td>
                    <td style="padding:6px 10px">${escapeHtml(r.supplier || '—')}</td>
                    <td style="padding:6px 10px"><span class="status badge-ok">${r.stageLabel || r.stage}</span></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>

        <div id="seedlings-import-result" style="display:none;margin-bottom:16px"></div>

        <div style="display:flex;justify-content:flex-end;gap:10px;border-top:1px solid #F1F5F9;padding-top:14px">
          <button type="button" class="btn btn-ghost" onclick="act('close-seedlings-import')" data-act="close-seedlings-import">إلغاء</button>
          <button type="button" class="btn btn-primary" id="btn-do-seedlings-import" ${parsedSeedlingsData.length > 0 ? '' : 'disabled'} style="min-width:160px;font-weight:bold;background:#16A34A;display:inline-flex;align-items:center;justify-content:center;gap:6px">
            <span>🚀</span> بدء استيراد الشتلات (${totalCount})
          </button>
        </div>
      </div>
    </div>
  `;
}

async function openInvestorContractModal(investorId, contractId) {
  editingInvestorId = investorId;
  showInvestorContractModal = true;
  editingContractSubForm = null;
  contractDraftPlots = [];
  
  if (typeof Api !== "undefined" && typeof Api.getInvestor === "function") {
    const res = await Api.getInvestor(investorId);
    if (res && (res.contracts || res.investor)) {
      editingInvestorData = {
        success: true,
        investor: res.investor || res,
        contracts: res.contracts || []
      };
    } else {
      const st = Store.get();
      const u = (st.users || []).find(x => x.id === investorId);
      const cnts = (st.contracts || []).filter(c => c.investor_id === investorId || c.investorId === investorId);
      editingInvestorData = { success: true, investor: u, contracts: cnts };
    }
  } else {
    const st = Store.get();
    const u = (st.users || []).find(x => x.id === investorId);
    const cnts = (st.contracts || []).filter(c => c.investor_id === investorId || c.investorId === investorId);
    editingInvestorData = { success: true, investor: u, contracts: cnts };
  }

  if (contractId && editingInvestorData?.contracts) {
    const targetContract = editingInvestorData.contracts.find(c => c.id === contractId);
    if (targetContract) {
      editingContractSubForm = { ...targetContract };
      contractDraftPlots = Array.isArray(targetContract.plots) ? [...targetContract.plots] : [];
    }
  }
  render();
}

function openInvestorContractByPlot(plotId, contractRef) {
  const st = Store.get();
  let contract = null;
  if (contractRef) {
    contract = (st.contracts || []).find(c => c.contract_num === contractRef || c.contractNum === contractRef);
  }
  if (!contract && plotId) {
    contract = (st.contracts || []).find(c => (c.plots || []).includes(plotId));
  }
  const investorId = contract?.investor_id || contract?.investorId;
  if (investorId) {
    openInvestorContractModal(investorId, contract.id);
  } else {
    const investorUser = (st.users || []).find(u => (u.plots || []).includes(plotId) && (u.role === "investor" || (u.roles || []).includes("investor")));
    if (investorUser) {
      openInvestorContractModal(investorUser.id);
    } else {
      toast("⚠️ تعذر العثور على مستثمر أو عقد مسجل لهذه القطعة");
    }
  }
}

async function openEditPlotModal(plotId) {
  if (!hasPerm("plots_manage")) return toast("ليس لديك صلاحية تعديل بيانات وإعدادات القطع والقطاعات");
  editingPlotId = plotId;
  showPlotEditModal = true;
  plotEditActiveTab = "general";
  
  if (typeof Api !== "undefined" && typeof Api.getPlot === "function") {
    const res = await Api.getPlot(plotId);
    if (res && res.success && res.plot) {
      editingPlotData = res.plot;
    } else if (res && (res.id || res.sector_id)) {
      editingPlotData = res;
    } else {
      editingPlotData = (Store.get().plots || []).find(p => p.id === plotId);
    }
  } else {
    editingPlotData = (Store.get().plots || []).find(p => p.id === plotId);
  }

  // If still not found (e.g. base plot 00-03 before first edit), synthesize from subplots
  if (!editingPlotData) {
    const st = Store.get();
    const subPlots = (st.plots || []).filter(p => p.parentPlotId === plotId || p.parent_plot_id === plotId || (p.id.startsWith(plotId) && p.id !== plotId));
    if (subPlots.length > 0) {
      const totalArea = subPlots.reduce((sum, sp) => sum + (Number(sp.areaValue || sp.area_value) || 0), 0);
      const secId = subPlots[0].sector;
      const baseNum = plotBaseNumber(subPlots[0]);
      editingPlotData = {
        id: plotId,
        sector: secId,
        name: `القطعة ${baseNum}`,
        parentPlotId: null,
        areaValue: totalArea > 0 ? Number(totalArea.toFixed(2)) : "",
        areaUnit: subPlots[0].areaUnit || subPlots[0].area_unit || "فدان",
        mainCrop: subPlots[0].mainCrop || subPlots[0].main_crop || "نخيل مجدول",
        irrigationSource: subPlots[0].irrigationSource || subPlots[0].irrigation_source || "",
        contractRef: null,
        targetCapacity: subPlots.reduce((sum, sp) => sum + (Number(sp.targetCapacity || sp.target_capacity) || 0), 0)
      };
    }
  }

  if (editingPlotData) {
    editingPlotData.sector = editingPlotData.sector || editingPlotData.sector_id || (editingPlotData.id ? editingPlotData.id.split('-')[0] : '');
    editingPlotData.sector_id = editingPlotData.sector;
    editingPlotData.parentPlotId = editingPlotData.parentPlotId || editingPlotData.parent_plot_id || null;
    editingPlotData.parent_plot_id = editingPlotData.parentPlotId;
  }

  plotEditCorners = [
    { label: "الشمال الشرقي (NE)", lat: "", lng: "" },
    { label: "الجنوب الشرقي (SE)", lat: "", lng: "" },
    { label: "الجنوب الغربي (SW)", lat: "", lng: "" },
    { label: "الشمال الغربي (NW)", lat: "", lng: "" }
  ];

  if (editingPlotData) {
    const coords = editingPlotData.boundaryCoordinates || editingPlotData.boundary_coordinates;
    let parsed = [];
    if (Array.isArray(coords)) parsed = coords;
    else if (typeof coords === "string" && coords.startsWith("[")) {
      try { parsed = JSON.parse(coords); } catch (e) {}
    }
    if (parsed.length >= 4) {
      plotEditCorners[0].lat = parsed[0][0] ?? parsed[0].lat ?? "";
      plotEditCorners[0].lng = parsed[0][1] ?? parsed[0].lng ?? "";
      plotEditCorners[1].lat = parsed[1][0] ?? parsed[1].lat ?? "";
      plotEditCorners[1].lng = parsed[1][1] ?? parsed[1].lng ?? "";
      plotEditCorners[2].lat = parsed[2][0] ?? parsed[2].lat ?? "";
      plotEditCorners[2].lng = parsed[2][1] ?? parsed[2].lng ?? "";
      plotEditCorners[3].lat = parsed[3][0] ?? parsed[3].lat ?? "";
      plotEditCorners[3].lng = parsed[3][1] ?? parsed[3].lng ?? "";
    } else if (editingPlotData.center_lat && editingPlotData.center_lng) {
      const cLat = Number(editingPlotData.center_lat);
      const cLng = Number(editingPlotData.center_lng);
      plotEditCorners[0] = { label: "الشمال الشرقي (NE)", lat: (cLat + 0.001).toFixed(6), lng: (cLng + 0.001).toFixed(6) };
      plotEditCorners[1] = { label: "الجنوب الشرقي (SE)", lat: (cLat - 0.001).toFixed(6), lng: (cLng + 0.001).toFixed(6) };
      plotEditCorners[2] = { label: "الجنوب الغربي (SW)", lat: (cLat - 0.001).toFixed(6), lng: (cLng - 0.001).toFixed(6) };
      plotEditCorners[3] = { label: "الشمال الغربي (NW)", lat: (cLat + 0.001).toFixed(6), lng: (cLng - 0.001).toFixed(6) };
    }
  }

  render();
}

window.openInvestorContractModal = openInvestorContractModal;
window.openInvestorContractByPlot = openInvestorContractByPlot;
window.openEditPlotModal = openEditPlotModal;

function syncDraftContractFromDom() {
  if (!editingContractSubForm) return;
  const numEl = $("#cnt_edit_num");
  if (numEl) editingContractSubForm.contract_num = numEl.value;
  const titleEl = $("#cnt_edit_title");
  if (titleEl) editingContractSubForm.title = titleEl.value;
  const startEl = $("#cnt_edit_start");
  if (startEl) editingContractSubForm.start_date = startEl.value;
  const endEl = $("#cnt_edit_end");
  if (endEl) editingContractSubForm.end_date = endEl.value;
  const palmsEl = $("#cnt_edit_palms");
  if (palmsEl) editingContractSubForm.total_palms = parseInt(palmsEl.value, 10) || 0;
  
  const tplEl = $("#cnt_edit_template");
  if (tplEl) editingContractSubForm.template_id = tplEl.value;
  const compShareEl = $("#cnt_edit_company_share");
  if (compShareEl) editingContractSubForm.company_crop_share_pct = parseFloat(compShareEl.value) || 0;
  const feeEl = $("#cnt_edit_fee_per_acre");
  if (feeEl) editingContractSubForm.annual_fee_per_acre = parseFloat(feeEl.value) || 0;
  const schedEl = $("#cnt_edit_schedule");
  if (schedEl) editingContractSubForm.payment_schedule = schedEl.value;
  const zakatChk = $("#cnt_edit_zakat_delegated");
  if (zakatChk) editingContractSubForm.zakat_delegated = zakatChk.checked ? 1 : 0;
  const zakatRateEl = $("#cnt_edit_zakat_rate");
  if (zakatRateEl) editingContractSubForm.zakat_rate_pct = parseFloat(zakatRateEl.value) || 5.0;
  const zakatDateEl = $("#cnt_edit_zakat_date");
  if (zakatDateEl) editingContractSubForm.zakat_delegation_date = zakatDateEl.value;
  const zakatDocEl = $("#cnt_edit_zakat_doc");
  if (zakatDocEl) editingContractSubForm.zakat_doc_url = zakatDocEl.value;

  const shareEl = $("#cnt_edit_share");
  if (shareEl) editingContractSubForm.investor_share_pct = parseFloat(shareEl.value) || 0;
  const finEl = $("#cnt_edit_financial");
  if (finEl) editingContractSubForm.financial_status = finEl.value;
}

window.onContractTemplateChange = function(tplId) {
  const st = Store.get();
  const tpl = (st.contractTemplates || []).find(t => t.id === tplId);
  if (!tpl) return;
  const compShareEl = document.getElementById("cnt_edit_company_share");
  const feeAcreEl = document.getElementById("cnt_edit_fee_per_acre");
  const billingWrap = document.getElementById("cnt_billing_info_wrap");
  
  if (compShareEl) compShareEl.value = tpl.default_company_share_pct ?? 25;
  if (feeAcreEl) feeAcreEl.value = tpl.default_annual_fee_per_acre ?? 0;
  if (billingWrap) {
    billingWrap.style.display = (tpl.requires_area_billing || (tpl.default_annual_fee_per_acre > 0)) ? "block" : "none";
  }
  window.updateContractLiveBreakdown();
};

window.updateContractLiveBreakdown = function() {
  const compShareEl = document.getElementById("cnt_edit_company_share");
  const zakatChkEl = document.getElementById("cnt_edit_zakat_delegated");
  const zakatRateEl = document.getElementById("cnt_edit_zakat_rate");
  const feeAcreEl = document.getElementById("cnt_edit_fee_per_acre");
  
  const compShare = parseFloat(compShareEl?.value) || 0;
  const isZakat = zakatChkEl?.checked || false;
  const zakatRate = isZakat ? (parseFloat(zakatRateEl?.value) || 5.0) : 0;
  const invNet = Math.max(0, 100 - compShare - zakatRate);
  
  const invShareInput = document.getElementById("cnt_edit_share");
  if (invShareInput) invShareInput.value = invNet;
  
  const barComp = document.getElementById("bar_comp_seg");
  const barZakat = document.getElementById("bar_zakat_seg");
  const barInv = document.getElementById("bar_inv_seg");
  const barSummary = document.getElementById("bar_summary_text");
  
  if (barComp) {
    barComp.style.width = compShare + "%";
    barComp.innerHTML = compShare > 5 ? `شركة ${compShare}%` : `${compShare}%`;
  }
  if (barZakat) {
    barZakat.style.width = zakatRate + "%";
    barZakat.style.display = zakatRate > 0 ? "block" : "none";
    barZakat.innerHTML = zakatRate > 0 ? `زكاة 5%` : "";
  }
  if (barInv) {
    barInv.style.width = invNet + "%";
    barInv.innerHTML = invNet > 5 ? `صافي المستثمر ${invNet}%` : `${invNet}%`;
  }
  if (barSummary) {
    if (isZakat) {
      barSummary.innerHTML = `🛡️ <b>تم تفعيل تفويض الزكاة الشرعية (5%)</b>: تستقطع الشركة <b>${compShare}%</b> مقابل الإدارة والتشغيل، و<b>5%</b> أمانات زكاة شرعية، ويحصل المستثمر على صافي <b>${invNet}%</b> مبرأ الذمة.`;
    } else {
      barSummary.innerHTML = `ℹ️ <b>الزكاة غير مفوضة بالشركة</b>: حصة الشركة <b>${compShare}%</b>، ويحصل المستثمر على <b>${invNet}%</b> ويلتزم بإخراج زكاة زروعه وثماره شخصياً.`;
    }
  }

  const totalAcreageEl = document.getElementById("cnt_total_acreage_val");
  const totalDueEl = document.getElementById("cnt_total_due_val");
  if (totalAcreageEl && totalDueEl) {
    const acres = parseFloat(totalAcreageEl.innerText) || 0;
    const fee = parseFloat(feeAcreEl?.value) || 0;
    const totalDue = Math.round(acres * fee);
    totalDueEl.innerText = totalDue.toLocaleString() + " ج.م";
  }
};

function renderInvestorContractEditModal() {
  if (!showInvestorContractModal) return "";
  const st = Store.get();
  const inv = editingInvestorData?.investor || (st.users || []).find(u => u.id === editingInvestorId) || {};
  const contracts = editingInvestorData?.contracts || (st.contracts || []).filter(c => 
    String(c.investor_id) === String(editingInvestorId) || 
    String(c.investorId) === String(editingInvestorId) ||
    String(c.investorUserId) === String(editingInvestorId) ||
    String(c.investor_user_id) === String(editingInvestorId) ||
    (inv.contractIds || []).includes(c.id) ||
    (inv.contractIds || []).includes(c.contractNumber) ||
    (inv.contractIds || []).includes(c.contract_num)
  );
  const invRoles = Array.isArray(inv.roles) && inv.roles.length > 0 ? inv.roles : (inv.role ? [inv.role] : ['investor']);

  const allSystemRoles = [
    { id: "investor", label: "مستثمر ومالك حصص" },
    { id: "worker", label: "عامل ميداني" },
    { id: "engineer", label: "مهندس زراعي" },
    { id: "nursery_mgr", label: "مدير مشتل" },
    { id: "warehouse_mgr", label: "أمين مستودع" },
    { id: "customer_care", label: "خدمة عملاء وزكاة" },
    { id: "admin", label: "إداري مزرعة" }
  ];

  const allPlots = st.plots || [];
  const activeContracts = (st.contracts || []).filter(c => c.status === "active" && c.id !== editingContractSubForm?.id);
  const assignedPlotSet = new Set(activeContracts.flatMap(c => c.plots || []));

  const availablePlotOptions = allPlots
    .filter(p => !contractDraftPlots.includes(p.id))
    .map(p => {
      const isAssigned = assignedPlotSet.has(p.id);
      return `<option value="${p.id}" ${isAssigned ? 'disabled style="color:#94a3b8;background:#f1f5f9"' : ''}>${p.id} - ${escapeHtml(p.name || '')} (${sectorName(p.sector)})${isAssigned ? ' [⚠️ مخصصة لمستثمر آخر]' : ''}</option>`;
    })
    .join("");

  return `
    <div class="modal-backdrop" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(15,23,42,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)">
      <div class="card" style="width:100%;max-width:880px;max-height:92vh;overflow-y:auto;background:#fff;border-radius:16px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);border:1px solid #E2E8F0;padding:24px;direction:rtl;text-align:right">
        
        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;border-bottom:1px solid #F1F5F9;padding-bottom:14px">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:42px;height:42px;border-radius:50%;background:#FEF3C7;color:#D97706;display:flex;align-items:center;justify-content:center;font-size:22px;border:1.5px solid #FDE68A">
              💼
            </div>
            <div>
              <h3 style="margin:0;font-size:18px;color:#0F172A">تعديل بيانات المستثمر والعقود الاستثمارية</h3>
              <div class="muted" style="font-size:12.5px;margin-top:2px">
                المستثمر: <b>${escapeHtml(inv.name || inv.full_name || '—')}</b> | الحساب: <span style="font-family:monospace">@${escapeHtml(inv.user || inv.username || inv.phone || '')}</span>
              </div>
            </div>
          </div>
          <button class="icon-btn" data-act="close-investor-contract-modal" style="font-size:18px;background:#F8FAFC;border:none;border-radius:50%;width:34px;height:34px;cursor:pointer">✕</button>
        </div>

        <!-- Section 1: Investor Profile -->
        <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:14px;padding:18px;margin-bottom:20px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
            <div style="font-weight:bold;font-size:14px;color:#0F172A;display:flex;align-items:center;gap:6px">
              <span>👤</span> بيانات المستثمر الأساسية والأدوار الوظيفية
            </div>
            <span class="chip" style="font-size:11px;background:#EFF6FF;color:#1E40AF">المعرف: ${inv.id || ''}</span>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:12px;margin-bottom:14px">
            <div>
              <label class="label" style="font-weight:700;font-size:12.5px;margin-bottom:4px;display:block">اسم المستثمر الكامل:</label>
              <input type="text" id="inv_edit_name" class="input" value="${escapeHtml(inv.name || inv.full_name || '')}" placeholder="الاسم الكامل" style="width:100%;box-sizing:border-box" />
            </div>
            <div>
              <label class="label" style="font-weight:700;font-size:12.5px;margin-bottom:4px;display:block">رقم الهاتف / اسم الدخول (فريد):</label>
              <input type="text" id="inv_edit_phone" class="input" value="${escapeHtml(inv.phone || inv.username || inv.user || '')}" dir="ltr" placeholder="05xxxxxxxx" style="width:100%;box-sizing:border-box;text-align:right" />
            </div>
            <div>
              <label class="label" style="font-weight:700;font-size:12.5px;margin-bottom:4px;display:block">البريد الإلكتروني:</label>
              <input type="email" id="inv_edit_email" class="input" value="${escapeHtml(inv.email || '')}" dir="ltr" placeholder="example@domain.com" style="width:100%;box-sizing:border-box;text-align:right" />
            </div>
            <div>
              <label class="label" style="font-weight:700;font-size:12.5px;margin-bottom:4px;display:block">حالة الحساب:</label>
              <select id="inv_edit_status" class="input" style="width:100%;box-sizing:border-box">
                <option value="1" ${inv.active !== false ? 'selected' : ''}>✅ نشط (مفعّل)</option>
                <option value="0" ${inv.active === false ? 'selected' : ''}>⛔ معطل (موقوف)</option>
              </select>
            </div>
          </div>

          <!-- Multi-Role Selection -->
          <div style="margin-bottom:14px">
            <label class="label" style="font-weight:700;font-size:12.5px;margin-bottom:6px;display:block">
              🛡️ الأدوار والصلاحيات المتعددة (Multi-Role):
            </label>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              ${allSystemRoles.map(r => {
                const checked = invRoles.includes(r.id);
                return `
                  <label style="display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid ${checked ? '#16A34A' : '#CBD5E1'};padding:6px 12px;border-radius:10px;cursor:pointer;font-size:12.5px;font-weight:${checked ? '700' : 'normal'};color:${checked ? '#166534' : '#334155'}">
                    <input type="checkbox" class="inv-role-chk" value="${r.id}" ${checked ? 'checked' : ''} style="margin:0;accent-color:#16A34A" />
                    <span>${r.label}</span>
                  </label>
                `;
              }).join("")}
            </div>
          </div>

          <div style="display:flex;justify-content:flex-end">
            <button class="btn btn-primary btn-sm" data-act="save-investor-profile" style="display:inline-flex;align-items:center;gap:6px;font-weight:700">
              <span>💾</span> حفظ بيانات وصلاحيات المستثمر
            </button>
          </div>
        </div>

        <!-- Section 2: Investment Contracts -->
        <div style="border:1px solid #E2E8F0;border-radius:14px;padding:18px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px">
            <div>
              <div style="font-weight:bold;font-size:15px;color:#0F172A;display:flex;align-items:center;gap:6px">
                <span>📜</span> العقود الاستثمارية والقطع المخصصة (${contracts.length})
              </div>
              <div class="muted" style="font-size:12px">إدارة حصص المستثمر، نسب المحصول، وإعادة تخصيص الحواشي والقطع لحظياً</div>
            </div>
            ${!editingContractSubForm ? `
              <button class="btn btn-primary btn-sm" data-act="new-contract-form" style="background:#0284C7;border-color:#0284C7;display:inline-flex;align-items:center;gap:6px;font-weight:700">
                <span>+</span> إضافة عقد استثماري جديد
              </button>
            ` : ''}
          </div>

          <!-- Contract Edit Sub-Form -->
          ${editingContractSubForm ? (() => {
            const templates = st.contractTemplates || [];
            const curTplId = editingContractSubForm.template_id || (templates[0]?.id || "tpl_crop_share");
            const selectedTpl = templates.find(t => t.id === curTplId) || templates[0] || {};
            
            const curCompShare = editingContractSubForm.company_crop_share_pct !== undefined && editingContractSubForm.company_crop_share_pct !== null
              ? Number(editingContractSubForm.company_crop_share_pct)
              : Number(selectedTpl.default_company_share_pct ?? 25.0);
            
            const curFeeAcre = editingContractSubForm.annual_fee_per_acre !== undefined && editingContractSubForm.annual_fee_per_acre !== null
              ? Number(editingContractSubForm.annual_fee_per_acre)
              : Number(selectedTpl.default_annual_fee_per_acre ?? 0);
            
            const curSchedule = editingContractSubForm.payment_schedule || "annual";
            const isDelegated = !!(editingContractSubForm.zakat_delegated !== undefined ? editingContractSubForm.zakat_delegated : 0);
            const curZakatRate = isDelegated ? Number(editingContractSubForm.zakat_rate_pct || 5.0) : 0;
            const curInvNet = Math.max(0, 100 - curCompShare - curZakatRate);

            // Calculate total acreage from contractDraftPlots
            const draftPlotObjs = contractDraftPlots.map(pid => allPlots.find(p => p.id === pid)).filter(Boolean);
            const totalAcreage = draftPlotObjs.reduce((sum, p) => {
              let val = Number(p.areaValue || p.area_value || 0);
              const unit = String(p.areaUnit || p.area_unit || "فدان").trim();
              if (unit === "قراط" || unit === "قيراط") val = val / 24;
              else if (unit === "سهم") val = val / 576;
              else if (unit === "متر" || unit === "م2" || unit === "m2") val = val / 4200.83;
              return sum + val;
            }, 0);
            const estimatedAnnualDue = Math.round(totalAcreage * curFeeAcre);

            return `
            <div style="background:#F0F9FF;border:1.5px solid #7DD3FC;border-radius:12px;padding:16px;margin-bottom:18px">
              <div style="font-weight:bold;font-size:14px;color:#0369A1;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">
                <div style="display:flex;align-items:center;gap:6px">
                  <span>✏️</span> <span>${editingContractSubForm.id ? `تعديل العقد: ${escapeHtml(editingContractSubForm.contract_num || editingContractSubForm.contractNum || '')}` : 'إضافة عقد استثماري جديد'}</span>
                </div>
                <span class="chip" style="background:#E0F2FE;color:#0369A1;font-weight:bold;font-size:11.5px">محرك النماذج المالية والزكاة</span>
              </div>

              <!-- Row 1: Template & Basics -->
              <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:10px;margin-bottom:12px">
                <div>
                  <label class="label" style="font-weight:700;font-size:12px;margin-bottom:3px;display:block">النموذج التعاقدي والمالي:</label>
                  <select id="cnt_edit_template" class="input" style="width:100%;box-sizing:border-box;font-weight:700;color:#0369A1" onchange="window.onContractTemplateChange(this.value)">
                    ${templates
                      .filter(t => (t.is_active !== 0 && t.is_active !== false && t.active !== 0 && t.active !== false) || t.id === curTplId)
                      .map(t => `<option value="${t.id}" ${t.id === curTplId ? 'selected' : ''}>${escapeHtml(t.name_ar)} (${t.code})${(t.is_active === 0 || t.is_active === false || t.active === 0 || t.active === false) ? ' [معطل]' : ''}</option>`).join("")}
                  </select>
                </div>
                <div>
                  <label class="label" style="font-weight:700;font-size:12px;margin-bottom:3px;display:block">رقم العقد (فريد وإلزامي):</label>
                  <input type="text" id="cnt_edit_num" class="input" value="${escapeHtml(editingContractSubForm.contract_num || editingContractSubForm.contractNum || '')}" placeholder="مثال: CNT-2026-001" style="width:100%;box-sizing:border-box" />
                </div>
                <div>
                  <label class="label" style="font-weight:700;font-size:12px;margin-bottom:3px;display:block">مسمى / عنوان العقد:</label>
                  <input type="text" id="cnt_edit_title" class="input" value="${escapeHtml(editingContractSubForm.title || '')}" placeholder="مثال: عقد استثمار حوشة 12" style="width:100%;box-sizing:border-box" />
                </div>
                <div>
                  <label class="label" style="font-weight:700;font-size:12px;margin-bottom:3px;display:block">إجمالي النخيل بالعقد:</label>
                  <input type="number" id="cnt_edit_palms" class="input" value="${editingContractSubForm.total_palms || editingContractSubForm.totalPalms || 0}" style="width:100%;box-sizing:border-box" />
                </div>
              </div>

              <!-- Row 2: Financial Model Config -->
              <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:10px;margin-bottom:12px">
                <div>
                  <label class="label" style="font-weight:700;font-size:12px;margin-bottom:3px;display:block">حصة الشركة من المحصول (%):</label>
                  <input type="number" step="0.5" id="cnt_edit_company_share" class="input" value="${curCompShare}" oninput="window.updateContractLiveBreakdown()" style="width:100%;box-sizing:border-box;font-weight:700;color:#0369A1" />
                </div>
                <div>
                  <label class="label" style="font-weight:700;font-size:12px;margin-bottom:3px;display:block">تكلفة خدمة الفدان / سنة (ج.م):</label>
                  <input type="number" step="500" id="cnt_edit_fee_per_acre" class="input" value="${curFeeAcre}" oninput="window.updateContractLiveBreakdown()" style="width:100%;box-sizing:border-box;font-weight:700;color:#B45309" />
                </div>
                <div>
                  <label class="label" style="font-weight:700;font-size:12px;margin-bottom:3px;display:block">دورية سداد رسوم الفدان:</label>
                  <select id="cnt_edit_schedule" class="input" style="width:100%;box-sizing:border-box">
                    <option value="annual" ${curSchedule === 'annual' ? 'selected' : ''}>سنوي (دفعة واحدة)</option>
                    <option value="semi_annual" ${curSchedule === 'semi_annual' ? 'selected' : ''}>نصف سنوي (دفعتان)</option>
                    <option value="quarterly" ${curSchedule === 'quarterly' ? 'selected' : ''}>ربع سنوي (4 دفعات)</option>
                  </select>
                </div>
                <div>
                  <label class="label" style="font-weight:700;font-size:12px;margin-bottom:3px;display:block">الحالة المالية للعقد:</label>
                  <select id="cnt_edit_financial" class="input" style="width:100%;box-sizing:border-box">
                    <option value="مسدد بالكامل" ${(editingContractSubForm.financial_status || editingContractSubForm.financialStatus) === 'مسدد بالكامل' ? 'selected' : ''}>مسدد بالكامل</option>
                    <option value="أقساط سنوية" ${(editingContractSubForm.financial_status || editingContractSubForm.financialStatus) === 'أقساط سنوية' ? 'selected' : ''}>أقساط سنوية</option>
                    <option value="أقساط نصف سنوية" ${(editingContractSubForm.financial_status || editingContractSubForm.financialStatus) === 'أقساط نصف سنوية' ? 'selected' : ''}>أقساط نصف سنوية</option>
                    <option value="متعثر" ${(editingContractSubForm.financial_status || editingContractSubForm.financialStatus) === 'متعثر' ? 'selected' : ''}>متعثر</option>
                  </select>
                </div>
              </div>

              <!-- Row 3: Dates -->
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
                <div>
                  <label class="label" style="font-weight:700;font-size:12px;margin-bottom:3px;display:block">تاريخ البداية:</label>
                  <input type="date" id="cnt_edit_start" class="input" value="${escapeHtml(editingContractSubForm.start_date || editingContractSubForm.startDate || '')}" style="width:100%;box-sizing:border-box" />
                </div>
                <div>
                  <label class="label" style="font-weight:700;font-size:12px;margin-bottom:3px;display:block">تاريخ النهاية:</label>
                  <input type="date" id="cnt_edit_end" class="input" value="${escapeHtml(editingContractSubForm.end_date || editingContractSubForm.endDate || '')}" style="width:100%;box-sizing:border-box" />
                </div>
              </div>

              <!-- Area-Billing Box (Dynamic GIS Calculation) -->
              <div id="cnt_billing_info_wrap" style="background:#FFFBEB;border:1.5px solid #FCD34D;border-radius:10px;padding:12px 14px;margin-bottom:12px;display:${(selectedTpl.requires_area_billing || curFeeAcre > 0) ? 'block' : 'none'}">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                  <div style="font-weight:800;font-size:13px;color:#92400E;display:flex;align-items:center;gap:6px">
                    <span>📐</span> الحساب التلقائي لرسوم خدمة الفدان (ربط مساحي GIS):
                  </div>
                  <span class="chip" style="background:#FEF3C7;color:#B45309;font-size:11px;font-weight:bold">توليد فواتير آلية</span>
                </div>
                <div style="display:flex;gap:18px;margin-top:8px;font-size:13px;color:#78350F;flex-wrap:wrap">
                  <div>إجمالي المساحة المربوطة: <b id="cnt_total_acreage_val">${totalAcreage.toFixed(2)}</b> فدان (${draftPlotObjs.length} قطع)</div>
                  <div>المطالبة السنوية الإجمالية: <b id="cnt_total_due_val" style="color:#B45309">${estimatedAnnualDue.toLocaleString()} ج.م</b></div>
                  <div class="muted" style="font-size:11.5px">تنشأ فاتورة الموسم آلياً عند حفظ العقد وتتحدث فورياً مع أي تعديل بمساحة القطع</div>
                </div>
              </div>

              <!-- Zakat Delegation Switch & Sub-Fields -->
              <div style="background:#F0FDF4;border:1.5px solid #86EFAC;border-radius:10px;padding:12px 14px;margin-bottom:12px">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:8px">
                  <label style="cursor:pointer;display:inline-flex;align-items:center;gap:8px;font-weight:800;color:#166534;font-size:13.5px">
                    <input type="checkbox" id="cnt_edit_zakat_delegated" ${isDelegated ? 'checked' : ''} onchange="window.updateContractLiveBreakdown()" style="width:18px;height:18px;accent-color:#16A34A" />
                    <span>⚖️ تفعيل تفويض الشركة بإخراج الزكاة الشرعية نيابة عن المستثمر (5% - ري بالآلات وشبكات التنقيط)</span>
                  </label>
                  <span class="badge" style="background:#DCFCE7;color:#15803D;font-weight:bold;font-size:11.5px">نصف العُشر الشرعي</span>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:10px;margin-top:8px">
                  <div>
                    <label class="label" style="font-size:11.5px;font-weight:700;margin-bottom:2px;display:block">المعدل الشرعي المعتمد (%):</label>
                    <input type="number" step="0.1" id="cnt_edit_zakat_rate" class="input" value="${editingContractSubForm.zakat_rate_pct || 5.0}" oninput="window.updateContractLiveBreakdown()" style="width:100%;box-sizing:border-box" />
                  </div>
                  <div>
                    <label class="label" style="font-size:11.5px;font-weight:700;margin-bottom:2px;display:block">تاريخ تفعيل التفويض:</label>
                    <input type="date" id="cnt_edit_zakat_date" class="input" value="${editingContractSubForm.zakat_delegation_date || new Date().toISOString().split('T')[0]}" style="width:100%;box-sizing:border-box" />
                  </div>
                  <div>
                    <label class="label" style="font-size:11.5px;font-weight:700;margin-bottom:2px;display:block">رابط / مرجع وثيقة التفويض المعتمدة:</label>
                    <input type="text" id="cnt_edit_zakat_doc" class="input" value="${escapeHtml(editingContractSubForm.zakat_doc_url || '')}" placeholder="رقم الملحق أو رابط المستند..." style="width:100%;box-sizing:border-box" />
                  </div>
                </div>
              </div>

              <!-- Dynamic Visual Breakdown Bar -->
              <div style="background:#fff;border:1.5px solid #E2E8F0;border-radius:10px;padding:12px;margin-bottom:14px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                  <div style="font-weight:800;font-size:12.5px;color:#1E293B">📊 توزيع حصص المحصول الصافية (تحديث مباشر):</div>
                  <div class="muted" style="font-size:11.5px">المعادلة: 100% - حصة الشركة - (الزكاة × التفويض)</div>
                </div>

                <div style="width:100%;height:32px;background:#F1F5F9;border-radius:8px;overflow:hidden;display:flex;font-weight:bold;font-size:12px;color:#fff;text-align:center;line-height:32px;box-shadow:inset 0 1px 2px rgba(0,0,0,0.1)">
                  <div id="bar_comp_seg" style="width:${curCompShare}%;background:#0284C7;transition:all 0.3s ease">
                    ${curCompShare > 5 ? `شركة ${curCompShare}%` : `${curCompShare}%`}
                  </div>
                  <div id="bar_zakat_seg" style="width:${curZakatRate}%;background:#059669;display:${curZakatRate > 0 ? 'block' : 'none'};transition:all 0.3s ease">
                    ${curZakatRate > 0 ? `زكاة 5%` : ''}
                  </div>
                  <div id="bar_inv_seg" style="width:${curInvNet}%;background:#16A34A;transition:all 0.3s ease">
                    ${curInvNet > 5 ? `صافي المستثمر ${curInvNet}%` : `${curInvNet}%`}
                  </div>
                </div>

                <input type="hidden" id="cnt_edit_share" value="${curInvNet}" />

                <div id="bar_summary_text" style="font-size:12px;color:#334155;margin-top:8px;padding:6px 10px;background:#F8FAFC;border-radius:6px;border:1px solid #E2E8F0;line-height:1.5">
                  ${isDelegated 
                    ? `🛡️ <b>تم تفعيل تفويض الزكاة الشرعية (5%)</b>: تستقطع الشركة <b>${curCompShare}%</b> مقابل الإدارة والتشغيل، و<b>5%</b> أمانات زكاة شرعية، ويحصل المستثمر على صافي <b>${curInvNet}%</b> مبرأ الذمة.`
                    : `ℹ️ <b>الزكاة غير مفوضة بالشركة</b>: حصة الشركة <b>${curCompShare}%</b>، ويحصل المستثمر على <b>${curInvNet}%</b> ويلتزم بإخراج زكاة زروعه وثماره شخصياً.`
                  }
                </div>
              </div>

              <!-- Interactive Plot Picker -->
              <div style="background:#fff;border:1px solid #BAE6FD;border-radius:10px;padding:12px;margin-bottom:12px">
                <div style="font-weight:bold;font-size:12.5px;color:#0369A1;margin-bottom:6px">
                  🗺️ القطع والحواشي المخصصة لهذا العقد:
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;min-height:36px;align-items:center;margin-bottom:8px">
                  ${contractDraftPlots.length > 0 ? contractDraftPlots.map(pid => {
                    const pObj = st.plots.find(x => x.id === pid);
                    const pName = pObj ? pObj.name : pid;
                    const pArea = pObj ? (Number(pObj.areaValue || pObj.area_value) || 0) : 0;
                    return `
                      <span class="chip" style="background:#0284C7;color:#fff;padding:4px 10px;border-radius:12px;font-size:12px;display:inline-flex;align-items:center;gap:6px;font-weight:bold">
                        <span>📍 ${escapeHtml(pName)} (${pid}) • ${pArea} فدان</span>
                        <button type="button" data-act="remove-draft-plot" data-id="${pid}" style="background:none;border:none;color:#fff;cursor:pointer;font-weight:bold;font-size:13px;padding:0;line-height:1" title="إزالة القطعة من العقد">✕</button>
                      </span>
                    `;
                  }).join("") : `<span class="muted" style="font-size:12px">لم يتم تخصيص قطع بعد لهذا العقد. اختر قطعة وأضفها أدناه.</span>`}
                </div>

                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding-top:6px;border-top:1px dashed #E2E8F0">
                  <select id="cnt_picker_plot_select" class="input" style="flex:1;min-width:200px">
                    <option value="">-- اختر قطعة لإضافتها لهذا العقد --</option>
                    ${availablePlotOptions}
                  </select>
                  <button class="btn btn-ghost btn-sm" data-act="add-draft-plot" style="border:1.5px solid #0284C7;color:#0284C7;font-weight:700">
                    + إضافة القطعة
                  </button>
                </div>
              </div>

              <div style="display:flex;justify-content:flex-end;gap:8px">
                <button class="btn btn-ghost btn-sm" data-act="cancel-contract-subform">إلغاء</button>
                <button class="btn btn-primary btn-sm" data-act="save-contract-subform" style="font-weight:700">
                  💾 حفظ بيانات العقد وتخصيص القطع
                </button>
              </div>
            </div>
            `;
          })() : ''}

          <!-- Table of Contracts -->
          <div class="grid-wrap" style="border:1px solid #E2E8F0;border-radius:10px;overflow:hidden">
            <table class="dense" style="width:100%">
              <thead style="background:#F8FAFC">
                <tr>
                  <th style="text-align:right">رقم ومسمى العقد</th>
                  <th style="text-align:center">النموذج التعاقدي</th>
                  <th style="text-align:right">القطع والمساحة</th>
                  <th style="text-align:center">النخيل</th>
                  <th style="text-align:center">تفويض الزكاة</th>
                  <th style="text-align:center">توزيع الحصص</th>
                  <th style="text-align:center">الحالة المالية</th>
                  <th style="text-align:center">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                ${contracts.length > 0 ? contracts.map(c => {
                  const cPlots = Array.isArray(c.plots) ? c.plots : [];
                  const plotsBadges = cPlots.length > 0
                    ? cPlots.map(pid => {
                        const pObj = st.plots.find(x => x.id === pid);
                        const areaStr = pObj && (pObj.areaValue || pObj.area_value) ? ` (${pObj.areaValue || pObj.area_value}ف)` : '';
                        return `<span class="chip" style="font-size:11px;background:#E0F2FE;color:#0369A1;border-color:#BAE6FD">📍 ${escapeHtml(pid)}${areaStr}</span>`;
                      }).join(" ")
                    : `<span class="muted" style="font-size:11px">لا توجد قطع</span>`;
                  const isPaid = (c.financial_status || c.financialStatus) === 'مسدد بالكامل';
                  const tplObj = (st.contractTemplates || []).find(t => t.id === c.template_id);
                  const isZakat = !!c.zakat_delegated;
                  const compShare = c.company_crop_share_pct ?? (tplObj?.default_company_share_pct ?? 25);
                  const invNet = c.investor_crop_share_pct ?? c.investor_share_pct ?? c.investorSharePct ?? (100 - compShare - (isZakat ? 5 : 0));

                  return `
                    <tr>
                      <td>
                        <div style="font-weight:800;color:#0F172A;font-family:monospace;font-size:13px">${escapeHtml(c.contract_num || c.contractNum || c.contractNumber || '—')}</div>
                        <div class="muted" style="font-size:11px">${escapeHtml(c.title || c.contractTitle || '—')}</div>
                      </td>
                      <td style="text-align:center">
                        <span class="chip" style="font-size:11px;font-weight:bold;background:#EFF6FF;color:#1E40AF">
                          ${escapeHtml(tplObj?.name_ar || (c.annual_fee_per_acre > 0 ? 'رعاية وتشغيل' : 'مشاركة محصول'))}
                        </span>
                        ${Number(c.annual_fee_per_acre || 0) > 0 ? `<div style="font-size:10.5px;color:#B45309;font-weight:700">${Number(c.annual_fee_per_acre).toLocaleString()} ج/فدان</div>` : ''}
                      </td>
                      <td><div style="display:flex;gap:4px;flex-wrap:wrap">${plotsBadges}</div></td>
                      <td style="text-align:center;font-weight:700">🌴 ${c.total_palms || c.totalPalms || 0}</td>
                      <td style="text-align:center">
                        ${isZakat 
                          ? `<span class="chip" style="background:#ECFDF5;color:#065F46;font-weight:bold;border:1px solid #A7F3D0;font-size:11px">✅ مفوض (5%)</span>`
                          : `<span class="chip" style="background:#FFFBEB;color:#92400E;font-size:10.5px">غير مفوض</span>`
                        }
                      </td>
                      <td style="text-align:center">
                        <div style="font-size:11.5px;white-space:nowrap">
                          <span style="color:#0284C7;font-weight:700">شركة: ${compShare}%</span> | 
                          <span style="color:#16A34A;font-weight:800">صافي: ${invNet}%</span>
                        </div>
                      </td>
                      <td style="text-align:center">
                        <span class="status ${isPaid ? 'badge-ok' : 'badge-warn'}" style="padding:2px 8px;font-size:11px">
                          ${escapeHtml(c.financial_status || c.financialStatus || 'مسدد بالكامل')}
                        </span>
                      </td>
                      <td style="text-align:center">
                        <div style="display:flex;gap:4px;justify-content:center">
                          <button class="btn btn-ghost icon-btn" data-act="edit-contract-item" data-id="${c.id}" style="font-size:11px;padding:3px 8px;border:1px solid #CBD5E1;border-radius:6px" title="تعديل هذا العقد والقطع المخصصة">
                            ✏️ تعديل
                          </button>
                          <button class="btn btn-ghost icon-btn" data-act="delete-contract-item" data-id="${c.id}" style="font-size:11px;padding:3px 8px;border:1px solid #FCA5A5;color:#DC2626;border-radius:6px" title="حذف العقد">
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join("") : `
                  <tr>
                    <td colspan="8" style="text-align:center;padding:24px" class="muted">
                      لا توجد عقود استثمارية مسجلة لهذا المستثمر بعد. اضغط «+ إضافة عقد استثماري جديد» أعلاه لإنشاء أول عقد.
                    </td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Footer -->
        <div style="display:flex;justify-content:flex-end;margin-top:18px;border-top:1px solid #F1F5F9;padding-top:14px">
          <button class="btn btn-ghost" data-act="close-investor-contract-modal">إغلاق النافذة</button>
        </div>

      </div>
    </div>
  `;
}

function renderPlotEditModal() {
  if (!showPlotEditModal || !editingPlotId) return "";
  const st = Store.get();
  const pl = editingPlotData || (st.plots || []).find(p => p.id === editingPlotId) || {};
  const secId = pl.sector || pl.sector_id || (pl.id ? pl.id.split('-')[0] : '');
  const secName = sectorName(secId);
  let curParentId = pl.parentPlotId || pl.parent_plot_id || "";

  // Is this plot a sub-plot (e.g. 12A, 12B, or part letter is set)?
  const isSubPlot = Boolean(
    curParentId ||
    pl.part || pl.part_letter ||
    (pl.id && /[A-Za-z]$/.test(pl.id))
  );

  // If curParentId is missing for a subplot, auto-derive expected parent ID (e.g. BSH05-10 for BSH05-10B)
  if (!curParentId && isSubPlot && pl.id) {
    const m = pl.id.match(/^(.*)-([0-9]+)[A-Za-z\u0600-\u06FF]*$/);
    if (m) {
      curParentId = `${m[1]}-${m[2]}`;
    }
  }

  // Candidate parent plots in this sector: plots that do not have a parent and are not this plot
  const candidateParents = (st.plots || []).filter(p => {
    const pSec = p.sector || p.sector_id;
    if (pSec !== secId || p.id === pl.id) return false;
    return !p.parentPlotId && !p.parent_plot_id;
  });

  // Ensure curParentId is included in candidate parents if missing
  if (curParentId && !candidateParents.some(p => p.id === curParentId)) {
    const baseNo = curParentId.split('-')[1] || curParentId;
    candidateParents.unshift({
      id: curParentId,
      name: `القطعة ${baseNo}`,
      areaValue: pl.areaValue || pl.area_value || 0,
      areaUnit: pl.areaUnit || pl.area_unit || 'فدان'
    });
  }

  const parentOptions = candidateParents.map(p => `
    <option value="${p.id}" ${(curParentId === p.id || pl.id.startsWith(p.id)) ? 'selected' : ''}>
      ${escapeHtml(p.name || p.id)} (${p.areaValue || p.area_value || 0} ${p.areaUnit || p.area_unit || 'فدان'})
    </option>
  `).join("");

  const currentPlotCrop = (pl.mainCrop || pl.main_crop || "").trim();

  // Categorized comprehensive crop and variety options
  const palmCrops = [
    "تمر خلاص",
    "نخيل خلاص",
    "نخيل مجدول",
    "نخيل صعيدي (سيوي)",
    "نخيل صعيدي",
    "نخيل برحي",
    "نخيل سكري",
    "نخيل عجوة"
  ];
  const oliveCrops = [
    "زيتون بيكوال",
    "زيتون كالماتا",
    "زيتون مانزانيلا",
    "زيتون كوراتينا",
    "زيتون شملالي"
  ];
  const otherCrops = [
    "برسيم حجازي",
    "محاصيل حقلية",
    "محاصيل خضر",
    "أخرى (تحديد يدوي)"
  ];

  // Dynamic custom varieties registered in system
  const customVarieties = (st.cropVarieties || []).map(v => {
    if (!v.name) return "";
    if (v.cropId === "palm") return `نخيل ${v.name}`;
    if (v.cropId === "olive") return `زيتون ${v.name}`;
    return v.name;
  }).filter(Boolean);

  const allKnownOptions = [...palmCrops, ...oliveCrops, ...otherCrops, ...customVarieties];
  const isExactKnown = allKnownOptions.includes(currentPlotCrop);

  function makeCropOption(val, label) {
    let isSelected = false;
    if (isExactKnown) {
      isSelected = (currentPlotCrop === val);
    } else if (currentPlotCrop) {
      isSelected = (val === currentPlotCrop) ||
                   (currentPlotCrop === "خلاص" && val === "تمر خلاص") ||
                   (currentPlotCrop.includes(val) || val.includes(currentPlotCrop));
    } else {
      isSelected = (val === "تمر خلاص" || val === "نخيل مجدول");
    }
    return `<option value="${escapeHtml(val)}" ${isSelected ? 'selected' : ''}>${escapeHtml(label || val)}</option>`;
  }

  const cropOptions = `
    ${(!isExactKnown && currentPlotCrop) ? `<optgroup label="📍 المحصول الحالي المسجل بالقطعة"><option value="${escapeHtml(currentPlotCrop)}" selected>${escapeHtml(currentPlotCrop)} (المسجل حالياً)</option></optgroup>` : ''}
    <optgroup label="🌴 النخيل والتمور الفاخرة">
      ${palmCrops.map(c => makeCropOption(c)).join("")}
    </optgroup>
    <optgroup label="🫒 أشجار الزيتون">
      ${oliveCrops.map(c => makeCropOption(c)).join("")}
    </optgroup>
    <optgroup label="🌾 محاصيل حقلية وأعلاف">
      ${otherCrops.map(c => makeCropOption(c)).join("")}
    </optgroup>
    ${customVarieties.length ? `
      <optgroup label="✨ أصناف مسجلة إضافية">
        ${customVarieties.map(c => makeCropOption(c)).join("")}
      </optgroup>
    ` : ''}
  `;

  const contractOptions = (st.contracts || []).map(c => `
    <option value="${c.contract_num || c.contractNum || c.id}" ${(pl.contractRef || pl.contract_ref) === (c.contract_num || c.contractNum) ? 'selected' : ''}>
      ${escapeHtml(c.contract_num || c.contractNum)} - ${escapeHtml(c.title || '')}
    </option>
  `).join("");

  const unit = pl.areaUnit || pl.area_unit || "فدان";

  return `
    <div class="modal-backdrop" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(15,23,42,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)">
      <div class="card" style="width:100%;max-width:760px;max-height:92vh;overflow-y:auto;background:#fff;border-radius:16px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);border:1px solid #E2E8F0;padding:24px;direction:rtl;text-align:right">
        
        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:1px solid #F1F5F9;padding-bottom:12px">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:40px;height:40px;border-radius:50%;background:#ECFDF5;color:#059669;display:flex;align-items:center;justify-content:center;font-size:20px;border:1.5px solid #A7F3D0">
              📍
            </div>
            <div>
              <h3 style="margin:0;font-size:18px;color:#0F172A">تعديل بيانات وإحداثيات القطعة</h3>
              <div class="muted" style="font-size:12.5px;margin-top:2px">
                القطعة: <b>${escapeHtml(pl.name || pl.id)}</b> | القطاع: <b>${escapeHtml(secName)}</b> | المعرف: <span style="font-family:monospace;font-weight:700">${pl.id}</span>
              </div>
            </div>
          </div>
          <button class="icon-btn" data-act="close-plot-edit-modal" style="font-size:18px;background:#F8FAFC;border:none;border-radius:50%;width:34px;height:34px;cursor:pointer">✕</button>
        </div>

        <!-- Navigation Tabs -->
        <div class="ptabs" style="margin-bottom:16px">
          <button class="${plotEditActiveTab === 'general' ? 'on' : ''}" data-act="switch-plot-edit-tab" data-id="general" style="font-weight:700">
            📋 البيانات الزراعية والتشغيلية
          </button>
          <button class="${plotEditActiveTab === 'gis' ? 'on' : ''}" data-act="switch-plot-edit-tab" data-id="gis" style="font-weight:700">
            🗺️ الحدود والإحداثيات الجغرافية (GIS)
          </button>
        </div>

        <!-- TAB 1: General Info -->
        ${plotEditActiveTab === 'general' ? `
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:12px;margin-bottom:16px">
            <div>
              <label class="label" style="font-weight:700;font-size:12.5px;margin-bottom:4px;display:block">اسم / كود القطعة:</label>
              <input type="text" id="plot_edit_name" class="input" value="${escapeHtml(pl.name || '')}" style="width:100%;box-sizing:border-box" placeholder="مثال: حوشة 12 أ" />
            </div>
            <div>
              ${isSubPlot ? `
                <label class="label" style="font-weight:700;font-size:12.5px;margin-bottom:4px;display:flex;align-items:center;gap:6px">
                  <span>القطعة الأم (للحواشي الفرعية):</span>
                  <span class="chip" style="font-size:10px;background:#FEF3C7;color:#92400E;padding:1px 6px">حوشة فرعية</span>
                </label>
                <select id="plot_edit_parent" class="input" style="width:100%;box-sizing:border-box">
                  <option value="">-- بدون قطعة أم (تحويل لقطعة مستقلة) --</option>
                  ${parentOptions}
                </select>
              ` : `
                <label class="label" style="font-weight:700;font-size:12.5px;margin-bottom:4px;display:block">طبيعة القطعة والتبعية:</label>
                <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:6px 10px;display:flex;align-items:center;gap:8px">
                  <span style="font-size:16px">🏛️</span>
                  <div>
                    <b style="font-size:12px;color:#166534">قطعة رئيسية مستقلة (أم)</b>
                    <div style="font-size:10.5px;color:#15803D">تمثل أصلاً رئيسياً يضم حواشي فرعية</div>
                  </div>
                  <input type="hidden" id="plot_edit_parent" value="" />
                </div>
              `}
            </div>
            <div>
              <label class="label" style="font-weight:700;font-size:12.5px;margin-bottom:4px;display:block">المساحة المقاسة ووحدة القياس:</label>
              <div style="display:flex;gap:6px">
                <input type="number" step="0.01" id="plot_edit_area_val" class="input" value="${pl.areaValue || pl.area_value || pl.area || ''}" style="flex:2;box-sizing:border-box" placeholder="المساحة" />
                <select id="plot_edit_area_unit" class="input" style="flex:1;box-sizing:border-box">
                  <option value="فدان" ${unit === 'فدان' ? 'selected' : ''}>فدان</option>
                  <option value="هكتار" ${unit === 'هكتار' ? 'selected' : ''}>هكتار</option>
                  <option value="قيراط" ${unit === 'قيراط' ? 'selected' : ''}>قيراط</option>
                  <option value="م²" ${unit === 'م²' ? 'selected' : ''}>م²</option>
                </select>
              </div>
            </div>
            <div>
              <label class="label" style="font-weight:700;font-size:12.5px;margin-bottom:4px;display:block">المحصول الأساسي المنزرع:</label>
              <select id="plot_edit_crop" class="input" style="width:100%;box-sizing:border-box">
                ${cropOptions}
              </select>
            </div>
            <div>
              <label class="label" style="font-weight:700;font-size:12.5px;margin-bottom:4px;display:block">مصدر / محبس مياه الري:</label>
              <input type="text" id="plot_edit_irrigation" class="input" value="${escapeHtml(pl.irrigationSource || pl.irrigation_source || '')}" style="width:100%;box-sizing:border-box" placeholder="مثال: بئر 1 / خط تنقيط شمالي" />
            </div>
            <div>
              <label class="label" style="font-weight:700;font-size:12.5px;margin-bottom:4px;display:block">العقد الاستثماري المخصص:</label>
              <select id="plot_edit_contract" class="input" style="width:100%;box-sizing:border-box">
                <option value="">-- غير مخصصة لعقد استثماري --</option>
                ${contractOptions}
              </select>
            </div>
          </div>
          <div style="margin-bottom:16px">
            <label class="label" style="font-weight:700;font-size:12.5px;margin-bottom:4px;display:block">ملاحظات تشغيلية إضافية:</label>
            <textarea id="plot_edit_notes" class="input" rows="2" style="width:100%;box-sizing:border-box" placeholder="أي تفاصيل خاصة بالتربة أو شبكة الري أو المستأجر...">${escapeHtml(pl.notes || '')}</textarea>
          </div>
        ` : ''}

        <!-- TAB 2: GIS Boundaries -->
        ${plotEditActiveTab === 'gis' ? `
          <div>
            <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:12px 16px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
              <div>
                <div style="font-weight:bold;color:#166534;font-size:13px">🗺️ ترسيم إحداثيات الأركان الأربعة (NE, SE, SW, NW)</div>
                <div style="font-size:12px;color:#15803D;margin-top:2px">يقوم النظام تلقائياً بحساب نقطة المركز (Centroid) ومساحة ومحيط القطاع التجميعي دون أي تعارض.</div>
              </div>
              <button type="button" class="btn btn-ghost btn-sm" data-act="plot-get-geolocation" style="border:1.5px solid #16A34A;color:#16A34A;font-weight:700;background:#fff;display:inline-flex;align-items:center;gap:6px">
                <span>📍</span> جلب موقعي الحالي (GPS)
              </button>
            </div>

            <!-- 4 Corners Table -->
            <div class="grid-wrap" style="border:1px solid #E2E8F0;border-radius:10px;overflow:hidden;margin-bottom:14px">
              <table class="dense" style="width:100%">
                <thead style="background:#F8FAFC">
                  <tr>
                    <th style="width:160px;text-align:right">الركن الجغرافي</th>
                    <th style="text-align:right">خط العرض (Latitude)</th>
                    <th style="text-align:right">خط الطول (Longitude)</th>
                  </tr>
                </thead>
                <tbody>
                  ${plotEditCorners.map((c, idx) => `
                    <tr>
                      <td style="font-weight:700;color:#334155;font-size:12.5px">
                        ${c.label}
                      </td>
                      <td>
                        <input type="number" step="0.000001" id="corner_${idx}_lat" class="input" value="${c.lat}" placeholder="27.050000" dir="ltr" style="width:100%;box-sizing:border-box;text-align:right" />
                      </td>
                      <td>
                        <input type="number" step="0.000001" id="corner_${idx}_lng" class="input" value="${c.lng}" placeholder="31.160000" dir="ltr" style="width:100%;box-sizing:border-box;text-align:right" />
                      </td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>

            <!-- Centroid Info -->
            <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:10px 14px;font-size:12.5px;color:#475569;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
              <div>
                🎯 <b>مركز القطعة المسجل:</b> خط عرض: <span style="font-family:monospace">${pl.center_lat || pl.centerLat || '—'}</span> | خط طول: <span style="font-family:monospace">${pl.center_lng || pl.centerLng || '—'}</span>
              </div>
              <span class="muted" style="font-size:11.5px">يُعاد حسابه تلقائياً عند حفظ الأركان</span>
            </div>
          </div>
        ` : ''}

        <!-- Footer Actions -->
        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;border-top:1px solid #F1F5F9;padding-top:14px">
          <button class="btn btn-ghost" data-act="close-plot-edit-modal">إلغاء</button>
          <button class="btn btn-primary" data-act="save-plot-edit" style="font-weight:700;min-width:140px">
            💾 حفظ التعديلات
          </button>
        </div>

      </div>
    </div>
  `;
}

function gisView() {
  const st = Store.get();
  const activeCrops = (st.crops || []).filter(c => c.active);
  const filteredPlots = (st.plots || []).filter(pl => {
    if (mapSec && pl.sector !== mapSec) return false;
    return true;
  });

  const _mapPlotFamily = new Set(mapPlot ? plotFamilyIds(mapPlot) : []);
  const _plotSector = new Map(st.plots.map(x => [x.id, x.sector]));
  const palms = st.palms.filter(p => {
    if (mapCrop && p.cropId !== mapCrop) return false;
    if (mapSec && _plotSector.get(p.plot) !== mapSec) return false;
    if (mapPlot && !_mapPlotFamily.has(p.plot)) return false;
    if (mapSt === "sick") {
      const isSick = (p.statusId === 2 || p.statusId === 3 || p.statusCode === "observation" || p.statusCode === "infected" || p.status === "تحت المراقبة" || (p.status||"").includes("سوسة") || (p.status||"").includes("مصاب") || (p.status||"").includes("مراقبة"));
      if (!isSick) return false;
    }
    if (mapQ && !p.code.toUpperCase().includes(mapQ.toUpperCase())) return false;
    return !p.archived;
  });

  const sick = palms.filter(p => (p.statusId === 2 || p.statusId === 3 || p.statusCode === "observation" || p.statusCode === "infected" || p.status === "تحت المراقبة" || (p.status||"").includes("سوسة") || (p.status||"").includes("مصاب") || (p.status||"").includes("مراقبة"))).length;
  const cObj = mapCrop ? activeCrops.find(c => c.id === mapCrop) : null;
  const treesLabel = cObj ? cObj.plural : "شجرة / أصل";

  const plotsWithGis = st.plots.filter(p => p.boundaryCoordinates && Array.isArray(p.boundaryCoordinates) && p.boundaryCoordinates.length >= 3);
  const totalFeddans = (st.sectors || []).reduce((acc, s) => acc + Number(s.totalArea || 0), 0);

  return `
    <div class="page-head" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
      <div>
        <h3>الخريطة التفاعلية ونظام الـ GIS</h3>
        <div class="muted">${palms.length} ${treesLabel} معروضة • ${plotsWithGis.length} قطعة بحدود جغرافية مسجلة</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" data-act="open-plots-import" style="display:inline-flex;align-items:center;gap:6px">
          <span>📥</span> استيراد قطع وحدود (Excel)
        </button>
        <a href="/api/plots/template" target="_blank" class="btn btn-ghost btn-sm" style="display:inline-flex;align-items:center;gap:6px">
          <span>📄</span> تحميل نموذج الإكسل
        </a>
      </div>
    </div>

    <!-- GIS Map Legend: Crops, Varieties, Health & Boundaries -->
    <div style="background:#ffffff;padding:12px 16px;border-radius:12px;border:1px solid #E2E8F0;box-shadow:0 1px 3px rgba(0,0,0,0.03);margin-bottom:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:8px">
        <span style="font-weight:700;font-size:12.5px;color:#1E293B;display:inline-flex;align-items:center;gap:6px">
          <span>🎨</span> <b>دليل ألوان المحاصيل والأصناف على الخريطة:</b>
        </span>
        <span class="muted" style="font-size:11px">تتحدد ألوان النقاط تلقائياً حسب نوع المحصول وصنفه وحالته الصحية</span>
      </div>
      
      <!-- Row 1: Crop and Variety Colors -->
      <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;font-size:12px;padding-bottom:8px;border-bottom:1px dashed #E2E8F0">
        <span style="display:inline-flex;align-items:center;gap:5px" title="نخيل تمر صنف مجدول (كود اللون: #6A1B9A)">
          <span style="width:11px;height:11px;background:#6A1B9A;border-radius:50%;display:inline-block;box-shadow:0 0 3px rgba(106,27,154,0.5)"></span>
          <b>نخيل مجدول</b>
        </span>
        <span style="display:inline-flex;align-items:center;gap:5px" title="نخيل تمر صنف برحي (كود اللون: #1565C0)">
          <span style="width:11px;height:11px;background:#1565C0;border-radius:50%;display:inline-block;box-shadow:0 0 3px rgba(21,101,192,0.5)"></span>
          <b>نخيل برحي</b>
        </span>
        <span style="display:inline-flex;align-items:center;gap:5px" title="نخيل أصناف أخرى (صعيدي / سكري / خضري / عام)">
          <span style="width:11px;height:11px;background:#2E7D32;border-radius:50%;display:inline-block"></span>
          <span>نخيل أصناف أخرى</span>
        </span>
        <span style="display:inline-flex;align-items:center;gap:5px" title="أشجار الزيتون بكافة أصنافها (بيكوال / منزانيللو / شملالي)">
          <span style="width:11px;height:11px;background:#33691E;border-radius:50%;display:inline-block;border:1px solid #1B380F"></span>
          <span>🫒 أشجار الزيتون</span>
        </span>
        <span style="display:inline-flex;align-items:center;gap:5px" title="أشجار مصابة بسوسة النخيل أو تحت المراقبة">
          <span style="width:11px;height:11px;background:#C62828;border-radius:50%;display:inline-block;box-shadow:0 0 4px #C62828"></span>
          <span style="color:#C62828;font-weight:700">🔴 مصاب / مراقبة</span>
        </span>
        <span style="display:inline-flex;align-items:center;gap:5px" title="أشجار ميتة أو جافة ومستبعدة">
          <span style="width:11px;height:11px;background:#6D4C41;border-radius:50%;display:inline-block"></span>
          <span style="color:#6D4C41">ميتة / جافة</span>
        </span>
      </div>

      <!-- Row 2: Boundary Layers -->
      <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;font-size:11.5px;padding-top:7px;color:#475569">
        <span style="font-weight:600">🗺️ الحدود:</span>
        <span style="display:inline-flex;align-items:center;gap:5px"><span style="width:13px;height:13px;background:rgba(34,197,94,0.25);border:2px solid #15803d;border-radius:3px"></span> قطعة رئيسية (أم)</span>
        <span style="display:inline-flex;align-items:center;gap:5px"><span style="width:13px;height:13px;background:rgba(56,189,248,0.25);border:2px dashed #0284c7;border-radius:3px"></span> حوشة فرعية</span>
        <span style="display:inline-flex;align-items:center;gap:5px"><span style="width:13px;height:13px;background:rgba(254,243,199,0.2);border:2px dashed #d97706;border-radius:3px"></span> محيط القطاع</span>
        <span style="display:inline-flex;align-items:center;gap:5px"><span style="width:11px;height:11px;border-radius:50%;border:2px solid #ef4444;background:#fee2e2"></span> ⚠️ شجرة خارج حدود القطعة</span>
      </div>
    </div>

    <div class="card filter-bar" style="grid-template-columns:1.2fr 1fr 1fr 1fr 1fr 1fr auto">
      <input id="gisq" value="${mapQ}" placeholder="بحث بالكود أو اسم القطعة للتكبير" />
      <select id="giscrop">
        <option value="">🌐 كل المحاصيل</option>
        ${activeCrops.map(c => `<option value="${c.id}" ${mapCrop===c.id?"selected":""}>${cropTextLabel(c)}</option>`).join("")}
      </select>
      <select id="gissec">
        <option value="">كل القطاعات</option>
        ${st.sectors.map(s=>`<option value="${s.id}" ${mapSec===s.id?"selected":""}>${s.name}</option>`)}
      </select>
      <select id="gisplot">
        <option value="">كل القطع (${filteredPlots.length})</option>
        ${plotOptionsHtml(filteredPlots, { selected: mapPlot, label: pl => `${pl.name} (${pl.areaValue||0} ${pl.areaUnit||'فدان'})` })}
      </select>
      <select id="gisvar">
        <option value="">كل الأصناف</option>
        ${(mapCrop ? (st.cropVarieties||[]).filter(v => v.cropId === mapCrop).map(v => `<option ${mapVar===v.name?"selected":""}>${v.name}</option>`) : (st.varieties||[]).map(v => `<option ${mapVar===v?"selected":""}>${v}</option>`)).join("")}
      </select>
      <select id="gisst">
        <option value="">كل الحالات</option>
        <option value="sick" ${mapSt==="sick"?"selected":""}>المصاب / مراقبة فقط</option>
      </select>
      <button class="btn btn-ghost icon-btn" data-act="gis-go">تطبيق</button>
    </div>

    <div id="farmmap" class="farm-map" style="min-height:540px;border-radius:14px;border:1px solid #E2E8F0;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05)"></div>

    <div class="grid grid-4" style="margin-top:12px;gap:12px">
      <div class="card kpi">
        <div class="n">${palms.length}</div>
        <div class="l">الأشجار المعروضة</div>
        <div style="font-size:11px;margin-top:4px;display:flex;gap:4px;justify-content:center;flex-wrap:wrap">
          ${activeCrops.map(c => {
            const count = palms.filter(p => p.cropId === c.id).length;
            return count ? `<span class="chip" style="font-size:11px;padding:1px 6px">${cropIcon(c.id, 13)} ${count} ${c.name}</span>` : '';
          }).join("")}
        </div>
      </div>
      <div class="card kpi">
        <div class="n">${totalFeddans.toFixed(1)}</div>
        <div class="l">إجمالي المساحة (فدان)</div>
      </div>
      <div class="card kpi">
        <div class="n">${sick}</div>
        <div class="l">مصاب / تحت المراقبة</div>
      </div>
      <div class="card kpi">
        <div class="n">${new Set(palms.map(p=>p.plot)).size || st.plots.length}</div>
        <div class="l">قطع معروضة (${plotsWithGis.length} محددة)</div>
      </div>
    </div>`;
}
function sectorView(id) {
  const st = Store.get();
  const sec = st.sectors.find(s => s.id === id);
  const plots = st.plots.filter(p => p.sector === id);
  const palms = (_s => st.palms.filter(p => _s.has(p.plot)))(new Set(plots.map(pl => pl.id)));
  const totalArea = sec?.totalArea || plots.filter(p=>!p.parentPlotId).reduce((acc, p) => acc + (p.areaValue||0), 0);

  return `
    <div class="page-head" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <div>
        <h3>${sectorName(id)}</h3>
        <div class="muted">${plots.length} قطعة • ${palms.length} نخلة • المساحة: ${totalArea} فدان</div>
      </div>
      <div>
        <button class="btn btn-primary btn-sm" onclick="mapSec='${id}';mapPlot='';go('gis')">🗺️ استعراض القطاع على الخريطة</button>
      </div>
    </div>
    <div class="grid grid-3" style="margin-top:12px">
      ${plots.map(pl => {
        const pPalms = st.palms.filter(p=>p.plot===pl.id).length;
        const subPlots = st.plots.filter(x => x.parentPlotId === pl.id);
        const parentObj = pl.parentPlotId ? st.plots.find(x => x.id === pl.parentPlotId) : null;
        return `
          <div class="card tile" data-go="plot" data-id="${pl.id}" style="border-right:4px solid ${pl.parentPlotId ? '#0284c7' : '#15803d'}">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <b>${pl.name}</b>
              <span class="chip" style="font-size:11px">${pl.id}</span>
            </div>
            ${parentObj ? `<div style="font-size:11px;color:#0284c7;margin-top:2px">🔹 فرعية من: ${parentObj.name}</div>` : ''}
            ${subPlots.length ? `<div style="font-size:11px;color:#059669;margin-top:2px">🌿 تضم ${subPlots.length} قطع تابعة</div>` : ''}
            <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
              <span class="chip" style="font-size:11px;background:#f0fdf4;color:#166534">📐 ${pl.areaValue || 0} ${pl.areaUnit || 'فدان'}</span>
              <span class="chip" style="font-size:11px">${pPalms} نخلة</span>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function plotView(id) {
  const st = Store.get();
  const pl = st.plots.find(p => p.id === id);
  if (!pl) return `<div class="card"><div class="muted">القطعة غير موجودة</div></div>`;
  const palms = st.palms.filter(p => p.plot === id);
  const density = (pl.areaValue && pl.areaValue > 0) ? (palms.length / pl.areaValue).toFixed(1) : '—';
  const parentObj = pl.parentPlotId ? st.plots.find(x => x.id === pl.parentPlotId) : null;
  const subPlots = st.plots.filter(x => x.parentPlotId === pl.id);

  return `
    <div class="page-head" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <div>
        <h3>${plotName(id)} <span class="chip" style="font-size:12px">${pl.id}</span></h3>
        <div class="muted">القطاع: <b>${sectorName(pl.sector)}</b> • ${palms.length} شجرة مسجلة</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm" style="border:1px solid #F59E0B;color:#B45309;font-weight:700" onclick="window.openEditPlotModal('${pl.id}')">✏️ تعديل بيانات وإحداثيات القطعة</button>
        <button class="btn btn-primary btn-sm" onclick="window._gisFocusPlot&&_gisFocusPlot('${pl.id}');go('gis')">🗺️ تظليل على الخريطة</button>
      </div>
    </div>

    <!-- Plot GIS Card -->
    <div class="card" style="margin-bottom:14px;background:#ffffff;border:1px solid #E2E8F0;border-radius:14px;padding:16px">
      <div class="grid grid-4" style="gap:10px">
        <div><span class="muted" style="font-size:12px">📐 المساحة المقاسة:</span><div style="font-weight:bold;font-size:15px;color:#0369a1">${pl.areaValue || 0} ${pl.areaUnit || 'فدان'}</div></div>
        <div><span class="muted" style="font-size:12px">⚡ الكثافة الزراعية:</span><div style="font-weight:bold;font-size:15px;color:#15803d">${density} شجرة/فدان</div></div>
        <div><span class="muted" style="font-size:12px">🌴 المحصول الأساسي:</span><div style="font-weight:bold;font-size:14px">${pl.mainCrop || 'نخيل'}</div></div>
        <div><span class="muted" style="font-size:12px">💧 مصدر / محبس الري:</span><div style="font-weight:bold;font-size:14px">${pl.irrigationSource || '—'}</div></div>
      </div>
      ${parentObj ? `
        <div style="margin-top:10px;padding:8px 12px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;font-size:12px;display:flex;justify-content:space-between;align-items:center">
          <div>🔹 <b>قطعة فرعية:</b> هذه الحوشة تابعة للقطعة الأم <b>${parentObj.name}</b> (${parentObj.areaValue || 0} ${parentObj.areaUnit || 'فدان'})</div>
          <button class="btn btn-ghost btn-sm" onclick="go('plot','${parentObj.id}')">الانتقال للقطعة الأم</button>
        </div>
      ` : ''}
      ${subPlots.length > 0 ? `
        <div style="margin-top:10px;padding:10px 12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:12px">
          <div style="font-weight:bold;color:#166534;margin-bottom:6px">🌿 القطع الفرعية التابعة (${subPlots.length} قطع):</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${subPlots.map(sp => `
              <span class="chip" style="cursor:pointer;background:#fff;border:1px solid #86efac" onclick="go('plot','${sp.id}')">
                📍 ${sp.name} (${sp.areaValue || 0} ${sp.areaUnit || 'فدان'})
              </span>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>

    <div class="card">
      <h4 style="margin-top:0;margin-bottom:12px">🌴 أشجار القطعة (${palms.length})</h4>
      ${palms.map(p => `<div class="list-item">${palmA(p.id, p.code)}<div class="muted">${p.variety} • ${p.status}</div></div>`).join("") || "<div class='muted'>لا نخيل مسجل في هذه القطعة</div>"}
    </div>
  `;
}
function osPrepModalHtml() {
  if (!editOsPrepId) return "";
  const st = Store.get();
  const o = st.offshoots.find(x => x.id === editOsPrepId) || (st.nurseryItems || []).find(x => x.id === editOsPrepId);
  if (!o) return "";
  if (o.newPalmId || o.isPlanted || o.nsStatus === "planted" || o.nsStatus === "dispatched" || o.nsStatus === "issued") {
    editOsPrepId = null;
    return "";
  }
  const mother = o.motherId ? palmById(o.motherId) : null;
  const oCode = o.tempCode || o.code || o.id;
  const oCrop = o.cropId || (o.tempCode ? "palm" : (["C","S","T"].includes(o.source) ? "olive" : "palm"));
  const oSource = o.source || "F";
  const allPreps = (st.nurseryPrepTypes || []).filter(t => t.active !== false);
  const validPreps = allPreps.filter(t => {
    const cropMatch = !t.cropId || t.cropId === "all" || t.cropId === oCrop;
    const srcMatch = !t.sourceCode || t.sourceCode === "all" || t.sourceCode === oSource;
    return cropMatch && srcMatch;
  });
  const prepList = validPreps.length ? validPreps : allPreps;

  return `
    <div class="modal-backdrop" style="z-index:9999">
      <div class="modal-box" style="max-width:500px;width:95%">
        <div class="modal-head">
          <h3 style="margin:0">🌿 تسجيل نشاط / معاملة للفسيلة</h3>
          <button class="btn btn-ghost icon-btn" data-act="cancel-os-prep">✕</button>
        </div>
        <div style="margin:12px 0;padding:10px 12px;background:var(--bg);border-radius:8px;font-size:13px;border:1px solid var(--line)">
          <div>الفسيلة / الأصل: <b>${codeHtml(oCode)}</b> — الصنف: <b>${o.variety || mother?.variety || "—"}</b></div>
          <div class="muted" style="margin-top:4px">الحالة الحالية بالمشتل: <b>${osStatus(o)}</b> ${mother ? `• النخلة الأم: ${mother.code}` : ""}</div>
        </div>
        <div>
          <label style="font-weight:700">نوع النشاط أو المعاملة الزراعية</label>
          <select id="single_prep_type" style="margin-bottom:12px;width:100%">
            ${prepList.map(t => `<option value="${t.id}">${t.name}${t.sourceCode && t.sourceCode !== 'all' ? ` (${t.sourceCode})` : ''}</option>`).join("")}
          </select>
          <label style="font-weight:700">تاريخ تنفيذ المعاملة</label>
          <input type="date" id="single_prep_date" value="${new Date().toISOString().split('T')[0]}" style="margin-bottom:12px;width:100%" />
          <label style="font-weight:700">ملاحظات أو توصيات خاصة (اختياري)</label>
          <input type="text" id="single_prep_notes" placeholder="مثال: إضافة مبيد فطري وقائي أو هرمون تجذير..." style="margin-bottom:12px;width:100%" />
          <label style="font-weight:700">تحديث مرحلة الأصل بالمشتل</label>
          <select id="single_prep_status" style="margin-bottom:12px;width:100%">
            <option value="prep" ${o.nsStatus === 'prep' ? 'selected' : ''}>تحت التجهيز والمعاملة (قيد المتابعة بالمشتل)</option>
            <option value="ready" ${o.nsStatus === 'ready' ? 'selected' : ''}>جاهزة للصرف والزراعة الميدانية</option>
            <option value="stock" ${o.nsStatus === 'stock' ? 'selected' : ''}>في مخزون المشتل</option>
          </select>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
          <button class="btn btn-ghost" data-act="cancel-os-prep">إلغاء</button>
          <button class="btn btn-primary" data-act="save-single-os-prep" data-id="${o.id}">حفظ النشاط 🌿</button>
        </div>
      </div>
    </div>
  `;
}
function osCardView(id) {
  const st = Store.get();
  const o = st.offshoots.find(x => x.id === id) || (st.nurseryItems||[]).find(x => x.id === id);
  if (!o) return `<div class="card">الفسيلة غير موجودة</div>`;
  const mother = findPalm(o.motherId || o.motherPalmId || o.motherCode) || (o.tempCode ? st.palms.find(p => p.code && o.tempCode.startsWith(p.code)) : null);
  const isPlanted = Boolean(o.newPalmId || o.isPlanted || o.nsStatus === "planted");
  const isDispatched = Boolean(!isPlanted && (o.nsStatus === "dispatched" || o.nsStatus === "issued"));
  const isInbound = Boolean(!isPlanted && !isDispatched && (o.approval === "pending" || o.approval === "waiting" || o.nsStatus === "inbound" || o.nsStatus === "pending" || (!o.nsStatus && !o.newPalmId)));
  const plantedPalm = isPlanted ? (findPalm(o.newPalmId) || st.palms.find(p => p.code === o.plantedPalmCode)) : null;

  return `<div class="page-head">
      <div>
        <h3>بطاقة الفسيلة</h3>
        <div class="muted">متابعة الأصل وسجل المعاملات والأنشطة الزراعية</div>
      </div>
      <div class="actions" style="margin:0">
        ${isPlanted ? `
          ${(o.newPalmId || plantedPalm?.id) ? `
            <button class="btn btn-primary icon-btn" data-go="palm" data-id="${o.newPalmId || plantedPalm?.id}">🌴 عرض بطاقة الشجرة بالحقل</button>
          ` : ''}
          <button class="btn btn-ghost icon-btn" data-act="back">← رجوع</button>
        ` : isDispatched ? `
          <span class="badge status" style="background:#FEF3C7;color:#92400E;font-weight:700;font-size:12px;padding:6px 12px">🚚 صُرفت للميدان</span>
          <button class="btn btn-ghost icon-btn" data-act="back">← رجوع</button>
        ` : `
          ${isInbound ? `<button class="btn btn-primary icon-btn" data-act="accept-inbound-os" data-id="${o.id}" style="background:#16A34A;border-color:#16A34A;font-weight:700">📥 اعتماد الاستلام بالمشتل</button>` : ''}
          <button class="btn btn-primary icon-btn" data-act="open-os-prep" data-id="${o.id}">🌿 + تسجيل نشاط / معاملة</button>
          <button class="btn btn-ghost icon-btn" data-act="ready-os" data-id="${o.id}">جاهزة للصرف</button>
          <button class="btn btn-ghost icon-btn" data-act="issue-os" data-id="${o.id}">صرف للزراعة</button>
        `}
      </div>
    </div>

    ${isInbound ? `
      <div class="card" style="background:#F0FDF4;border:1.5px solid #16A34A;border-radius:10px;padding:14px 16px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-weight:800;color:#166534;font-size:15px;display:flex;align-items:center;gap:6px">
            <span>📥</span> <span>فسيلة واردة من الحقل — بانتظار اعتماد الاستلام بالمشتل</span>
          </div>
          <div class="muted" style="font-size:13px;margin-top:4px">
            تم تسجيل قلع الفسيلة من النخلة الأم، وهي حالياً بانتظار معاينة واستلام مسؤول المشتل لإدخالها مسار التجذير والتحضين.
          </div>
        </div>
        <button class="btn btn-primary icon-btn" data-act="accept-inbound-os" data-id="${o.id}" style="background:#16A34A;border-color:#16A34A;font-weight:700;padding:8px 16px">📥 اعتماد استلام الفسيلة بالمشتل</button>
      </div>
    ` : ''}

    ${isPlanted ? `
      <div class="card" style="background:#F0FDF4;border:1.5px solid #22C55E;border-radius:10px;padding:14px 16px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-weight:800;color:#166534;font-size:15px;display:flex;align-items:center;gap:6px">
            <span>🌴</span> <span>تم تخرّج الأصل من المشتل وزراعته بنجاح بالحقل كشجرة مستقلة</span>
          </div>
          <div style="font-size:13px;color:#15803D;margin-top:4px">
            كود الشجرة بالحقل: <bdi><b style="font-family:monospace;direction:ltr;background:#DCFCE7;padding:3px 8px;border-radius:4px;border:1px solid #86EFAC">${o.plantedPalmCode || plantedPalm?.code || '—'}</b></bdi>
            ${o.plantedPlot ? ` • القطعة: <b>${plotName(o.plantedPlot)}</b>` : ''}
            ${o.plantedAt ? ` • تاريخ الغرس: <b>${fmtDate(o.plantedAt)}</b>` : ''}
          </div>
          <div style="font-size:12px;color:#475569;margin-top:6px">
            🔒 <b>ملاحظة إدارية:</b> تم إغلاق مسار معاملات المشتل لهذا الأصل نظراً لانتقاله إلى الحقل. لتسجيل أي عمليات رعاية أو تسميد أو وقاية أو حصاد جديدة، يرجى إجراؤها مباشرة من بطاقة الشجرة بالحقل.
          </div>
        </div>
        ${(o.newPalmId || plantedPalm?.id) ? `
          <button class="btn btn-primary icon-btn" data-go="palm" data-id="${o.newPalmId || plantedPalm?.id}" style="font-size:13px;padding:8px 16px">🌴 فتح بطاقة الشجرة بالحقل ←</button>
        ` : ''}
      </div>
    ` : isDispatched ? `
      <div class="card" style="background:#FFFBEB;border:1.5px solid #F59E0B;border-radius:10px;padding:14px 16px;margin-bottom:14px">
        <div style="font-weight:800;color:#92400E;font-size:15px;display:flex;align-items:center;gap:6px">
          <span>🚚</span> <span>خرجت الفسيلة من المشتل وصُرفت للميدان</span>
        </div>
        <div class="muted" style="font-size:13px;margin-top:4px">
          تم صرف وتسليم الأصل للمشرف الميداني${o.dispatchedToUserName ? ` <b>${o.dispatchedToUserName}</b>` : ''}${o.dispatchedToPlot ? ` بالقطعة <b>${plotName(o.dispatchedToPlot)}</b>` : ''}${o.dispatchedAt ? ` بتاريخ ${fmtDate(o.dispatchedAt)}` : ''}.
          المعاملات مقفلة بالمشتل لحين استكمال إجراءات الغرس والتكويد بالحقل.
        </div>
      </div>
    ` : ''}

    <div class="card">
      <div>${codeHtml(o.tempCode || o.code)}</div>
      <div class="grid grid-2" style="margin-top:8px">
        <div>الصنف: <b>${o.variety || mother?.variety || "—"}</b></div>
        <div>الحالة: <b>${osStatusHtml(o)}</b></div>
        <div>التاريخ: <b>${o.date || o.entryDate || "—"}</b></div>
        <div>النخلة الأم: <b>${mother ? palmA(mother.id, mother.code) : "شراء خارجي"}</b></div>
        ${mother ? `<div>القطاع: ${secA(st.plots.find(p=>p.id===mother.plot)?.sector)}</div><div>القطعة: ${plotA(mother.plot)}</div>`:""}
        ${isPlanted && (o.plantedPalmCode || plantedPalm?.code) ? `
          <div style="grid-column: span 2;background:#F8FAFC;padding:8px 12px;border-radius:6px;border:1px solid #E2E8F0;margin-top:4px">
            الشجرة الناتجة بالحقل: <b>${palmA(o.newPalmId || plantedPalm?.id, o.plantedPalmCode || plantedPalm?.code)}</b>
            ${o.plantedPlot ? ` • القطعة الحالية: ${plotA(o.plantedPlot)}` : ''}
          </div>
        ` : ''}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;border-top:1px solid var(--line);padding-top:10px">
        <div>
          <h3 style="margin:0">سجل أنشطة المشتل والمعاملات (${(o.preps||[]).length})</h3>
          ${isPlanted ? `<div class="muted" style="font-size:11px;margin-top:2px">الأرشيف التاريخي لأنشطة المشتل قبل التخرج والزراعة الميدانية</div>` : ''}
        </div>
        ${!isPlanted && !isDispatched ? `
          <button class="btn btn-primary icon-btn" data-act="open-os-prep" data-id="${o.id}" style="padding:4px 10px;font-size:12px">🌿 + تسجيل نشاط جديد</button>
        ` : `
          <span class="badge status" style="background:#E2E8F0;color:#475569;font-size:11px;font-weight:700">🔒 السجل مقفل (${isPlanted ? 'أصل مزروع بالحقل' : 'منصرفة للميدان'})</span>
        `}
      </div>
      <div style="margin-top:8px">
        ${(o.preps||[]).slice().reverse().map(pr => `
          <div class="list-item" style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <b>${pr.type}</b>
              ${pr.notes ? `<div class="muted" style="font-size:12px">${pr.notes}</div>` : ""}
              ${pr.by ? `<div class="muted" style="font-size:11px">المسؤول: ${pr.by}</div>` : ""}
            </div>
            <div class="muted" style="font-size:12px">${fmtDate(pr.at)}</div>
          </div>
        `).join("") || "<div class='muted' style='padding:12px 0'>لا توجد أنشطة مسجلة بالمشتل.</div>"}
      </div>
    </div>`;
}
