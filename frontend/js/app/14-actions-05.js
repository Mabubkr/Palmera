// PalmTrace app — UI action handlers, part 5 of 9 (starts at: name === "archive-palm")
// (split from the former single app.js; files are classic scripts loaded in order by index.html)

async function actionsPart05(name, id, el, st) {
  if (name === "archive-palm") {
    if (!hasPerm("palms_delete")) return toast("ليس لديك صلاحية أرشفة أو شطب الأشجار");
    const p = st.palms.find(x => String(x.id) === String(id) || x.code === id);
    if (!p) return toast("تعذر العثور على بيانات الشجرة", "warn");
    p.archived = !p.archived;
    if (p.archived) p.status = "ميتة";
    Store.set({ palms: st.palms });
    if (typeof Api !== "undefined" && typeof Api.archivePalm === "function") {
      Api.archivePalm(p.id, p.archived, $("#archwhy")?.value || "أرشفة");
    }
    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: p.archived ? "archive" : "unarchive",
        module: "palms",
        severity: p.archived ? "warning" : "info",
        title: `${p.archived ? "أرشفة" : "استعادة"} شجرة: ${p.code}`,
        summary: `${p.archived ? "تمت أرشفة وتغيير حالة" : "تمت استعادة"} الشجرة ${p.code}`,
        details: { id: p.id, code: p.code, archived: p.archived, status: p.status },
        targetType: "palm",
        targetId: p.id,
        targetCode: p.code,
        user: session()?.name || "مستخدم",
        role: session()?.role || "worker"
      });
    }
    toast(p.archived ? "أُرشفت النخلة" : "أُعيدت للنظام"); render(); return;
  }
  if (name === "del-palm") {
    if (!hasPerm("palms_delete")) return toast("حذف الأشجار نهائياً محصور بإدارة المنظومة فقط");
    if (!confirm("حذف النخلة نهائياً؟")) return;
    const targetPalm = st.palms.find(x => String(x.id) === String(id) || x.code === id);
    Store.set({ palms: st.palms.filter(x => String(x.id) !== String(id) && x.code !== id) });
    if (typeof Api !== "undefined" && typeof Api.deletePalm === "function") {
      Api.deletePalm(targetPalm?.id || id);
    }
    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "delete",
        module: "palms",
        severity: "danger",
        title: `حذف شجرة نهائياً: ${targetPalm?.code || id}`,
        summary: `تم حذف الشجرة ${targetPalm?.code || id} نهائياً من قاعدة البيانات`,
        details: targetPalm || { id },
        targetType: "palm",
        targetId: id,
        targetCode: targetPalm?.code,
        user: session()?.name || "مستخدم",
        role: session()?.role || "worker"
      });
    }
    toast("حُذفت النخلة"); go("palms"); return;
  }
  if (name === "open-os-prep") {
    const rec = st.offshoots.find(x => x.id === id) || (st.nurseryItems||[]).find(x => x.id === id);
    if (rec && (rec.newPalmId || rec.isPlanted || rec.nsStatus === "planted")) {
      return toast("⚠️ لا يمكن تسجيل نشاط مشتل: هذا الأصل تخرّج وزُرع بالحقل كشجرة قائمة!");
    }
    if (rec && (rec.nsStatus === "dispatched" || rec.nsStatus === "issued")) {
      return toast("⚠️ لا يمكن تسجيل نشاط مشتل: هذا الأصل صُرف من المشتل إلى الميدان!");
    }
    editOsPrepId = id; render(); return;
  }
  if (name === "cancel-os-prep") {
    editOsPrepId = null; render(); return;
  }
  if (name === "save-single-os-prep") {
    const targetId = id || editOsPrepId;
    const rec = st.offshoots.find(x => x.id === targetId) || (st.nurseryItems||[]).find(x => x.id === targetId);
    if (!rec) { editOsPrepId = null; render(); return; }
    if (rec.newPalmId || rec.isPlanted || rec.nsStatus === "planted") {
      editOsPrepId = null;
      toast("⚠️ لا يمكن إضافة معاملة: الفسيلة خرجت من المشتل وزُرعت بالحقل كأصل قائم!");
      render();
      return;
    }
    if (rec.nsStatus === "dispatched" || rec.nsStatus === "issued") {
      editOsPrepId = null;
      toast("⚠️ لا يمكن إضافة معاملة: الفسيلة صُرفت إلى الميدان!");
      render();
      return;
    }
    const typeSel = document.getElementById("single_prep_type");
    const prepTypeObj = (Store.get().nurseryPrepTypes || []).find(t => t.id === typeSel?.value);
    const typeName = prepTypeObj?.name || typeSel?.selectedOptions?.[0]?.text || "معاملة تجهيز";
    const at = document.getElementById("single_prep_date")?.value || new Date().toISOString().slice(0, 10);
    const notes = (document.getElementById("single_prep_notes")?.value || "").trim();
    const newStatus = document.getElementById("single_prep_status")?.value || rec.nsStatus || "prep";

    rec.preps = rec.preps || [];
    rec.preps.push({
      at,
      type: typeName,
      notes: notes || undefined,
      by: session()?.name || "مشرف المشتل",
      byId: session()?.id
    });
    rec.nsStatus = newStatus;
    Store.set({ offshoots: st.offshoots, nurseryItems: st.nurseryItems || [] });
    persistNursery(rec);
    editOsPrepId = null;
    toast(`تم تسجيل نشاط «${typeName}» للفسيلة بنجاح 🌿`);
    render();
    return;
  }
  if (name === "toggle-os-menu") {
    activeNurseryRowMenuId = (activeNurseryRowMenuId === id) ? null : id;
    render();
    return;
  }
  if (name === "accept-inbound-os") {
    const rec = st.offshoots.find(x => x.id === id) || (st.nurseryItems||[]).find(x => x.id === id);
    if (!rec) return;
    rec.nsStatus = "rooting";
    rec.status = "بالمشتل - تجذير";
    rec.statusDesc = "في التجذير والرعاية";
    rec.approval = "approved";
    rec.receivedBy = session()?.name || "مدير المشتل";
    rec.receivedAt = new Date().toISOString();
    activeNurseryRowMenuId = null;
    Store.set({ offshoots: st.offshoots, nurseryItems: st.nurseryItems || [] });
    persistNursery(rec);
    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "approve",
        module: "nursery",
        severity: "info",
        title: `اعتماد استلام فسيلة بالمشتل: ${rec.tempCode || rec.code || rec.id}`,
        summary: `اعتماد استلام الفسيلة وإدخالها لمسار التجذير والرعاية بواسطة ${session()?.name || 'مدير المشتل'}`,
        targetType: "offshoot",
        targetId: rec.id,
        targetCode: rec.tempCode || rec.code,
        user: session()?.name || "مدير المشتل",
        role: session()?.role || "nursery_mgr"
      });
    }
    toast(`تم اعتماد استلام الفسيلة [${rec.tempCode || rec.code || rec.id}] ونقلها للتجذير والرعاية بنجاح 🌱`);
    render(); return;
  }
  if (name === "bulk-accept-inbound") {
    if (!selectedOffshootIds.size) return toast("حدد فسائل أولاً");
    let count = 0;
    const _nsIds = [...selectedOffshootIds];
    const nowIso = new Date().toISOString();
    const uName = session()?.name || "مدير المشتل";
    selectedOffshootIds.forEach(sId => {
      const o = st.offshoots.find(x => x.id === sId) || (st.nurseryItems||[]).find(x => x.id === sId);
      if (o && !o.newPalmId && !o.isPlanted && o.nsStatus !== "culled") {
        o.nsStatus = "rooting";
        o.status = "بالمشتل - تجذير";
        o.statusDesc = "في التجذير والرعاية";
        o.approval = "approved";
        o.receivedBy = uName;
        o.receivedAt = nowIso;
        count++;
      }
    });
    selectedOffshootIds.clear();
    Store.set({ offshoots: st.offshoots, nurseryItems: st.nurseryItems || [] });
    persistNursery(_nsIds);
    toast(`تم اعتماد استلام ${count} فسيلة ونقلها للتجذير والرعاية بنجاح 🌱`);
    render(); return;
  }
  if (name === "move-to-rooting") {
    const rec = st.offshoots.find(x => x.id === id) || (st.nurseryItems||[]).find(x => x.id === id);
    if (!rec) return;
    rec.nsStatus = "rooting";
    rec.statusDesc = "في التجذير والرعاية";
    activeNurseryRowMenuId = null;
    Store.set({ offshoots: st.offshoots, nurseryItems: st.nurseryItems || [] });
    persistNursery(rec);
    toast(`تم نقل الأصل [${rec.tempCode || rec.code || rec.id}] إلى التجذير والرعاية 🌱`);
    render(); return;
  }
  if (name === "move-to-inbound") {
    const rec = st.offshoots.find(x => x.id === id) || (st.nurseryItems||[]).find(x => x.id === id);
    if (!rec) return;
    rec.nsStatus = "inbound";
    rec.statusDesc = "بانتظار الاستلام والتجهيز";
    activeNurseryRowMenuId = null;
    Store.set({ offshoots: st.offshoots, nurseryItems: st.nurseryItems || [] });
    persistNursery(rec);
    toast(`تم نقل الأصل [${rec.tempCode || rec.code || rec.id}] إلى الوارد والتوريد 📥`);
    render(); return;
  }
  if (name === "print-os-barcode") {
    barcodePrintIds = [id];
    showBarcodeModal = true;
    activeNurseryRowMenuId = null;
    render(); return;
  }
  if (name === "close-barcode-modal") {
    showBarcodeModal = false;
    barcodePrintIds = [];
    render(); return;
  }
  if (name === "cull-os") {
    cullTargetIds = [id];
    showCullModal = true;
    activeNurseryRowMenuId = null;
    render(); return;
  }
  if (name === "close-cull-modal") {
    showCullModal = false;
    cullTargetIds = [];
    render(); return;
  }
  if (name === "confirm-os-cull") {
    if (!cullTargetIds || !cullTargetIds.length) return toast("لا توجد أصول محددة للإهلاك");
    const reason = $("#cull_reason_inp")?.value || "أسباب فنية";
    const date = $("#cull_date_inp")?.value || new Date().toISOString().slice(0, 10);
    const notes = ($("#cull_notes_inp")?.value || "").trim();
    const _nsIds = [...cullTargetIds];
    cullTargetIds.forEach(cId => {
      const o = st.offshoots.find(x => x.id === cId) || (st.nurseryItems||[]).find(x => x.id === cId);
      if (!o) return;
      o.nsStatus = "culled";
      o.cullReason = reason;
      o.cullDate = date;
      o.cullNotes = notes;
      selectedOffshootIds.delete(cId);
    });
    showCullModal = false;
    cullTargetIds = [];
    Store.set({ offshoots: st.offshoots, nurseryItems: st.nurseryItems || [] });
    persistNursery(_nsIds);
    toast("تم تسجيل الإهلاك والاستبعاد بنجاح 🗑️");
    render(); return;
  }
  if (name === "open-cull-report") {
    showCullReportModal = true;
    render(); return;
  }
  if (name === "close-cull-report") {
    showCullReportModal = false;
    render(); return;
  }
  if (name === "clear-nursery-selection") {
    selectedOffshootIds.clear();
    render(); return;
  }
  if (name === "bulk-nready") {
    if (!selectedOffshootIds.size) return toast("حدد فسائل أولاً");
    let count = 0;
    const _nsIds = [...selectedOffshootIds];
    selectedOffshootIds.forEach(sId => {
      const o = st.offshoots.find(x => x.id === sId) || (st.nurseryItems||[]).find(x => x.id === sId);
      if (o && !o.newPalmId && !o.isPlanted && o.nsStatus !== "culled") {
        o.nsStatus = "ready";
        o.statusDesc = "جاهزة للصرف والزراعة";
        count++;
      }
    });
    selectedOffshootIds.clear();
    Store.set({ offshoots: st.offshoots, nurseryItems: st.nurseryItems || [] });
    persistNursery(_nsIds);
    toast(`تم اعتماد ${count} فسيلة كـ «جاهزة للصرف» بنجاح ✅`);
    render(); return;
  }
  if (name === "bulk-nrooting") {
    if (!selectedOffshootIds.size) return toast("حدد فسائل أولاً");
    let count = 0;
    const _nsIds = [...selectedOffshootIds];
    selectedOffshootIds.forEach(sId => {
      const o = st.offshoots.find(x => x.id === sId) || (st.nurseryItems||[]).find(x => x.id === sId);
      if (o && !o.newPalmId && !o.isPlanted && o.nsStatus !== "culled") {
        o.nsStatus = "rooting";
        o.statusDesc = "في التجذير والرعاية";
        count++;
      }
    });
    selectedOffshootIds.clear();
    Store.set({ offshoots: st.offshoots, nurseryItems: st.nurseryItems || [] });
    persistNursery(_nsIds);
    toast(`تم نقل ${count} فسيلة إلى «التجذير والرعاية» 🌱`);
    render(); return;
  }
  if (name === "bulk-ninbound") {
    if (!selectedOffshootIds.size) return toast("حدد فسائل أولاً");
    let count = 0;
    const _nsIds = [...selectedOffshootIds];
    selectedOffshootIds.forEach(sId => {
      const o = st.offshoots.find(x => x.id === sId) || (st.nurseryItems||[]).find(x => x.id === sId);
      if (o && !o.newPalmId && !o.isPlanted && o.nsStatus !== "culled") {
        o.nsStatus = "inbound";
        o.statusDesc = "بانتظار الاستلام والتجهيز";
        count++;
      }
    });
    selectedOffshootIds.clear();
    Store.set({ offshoots: st.offshoots, nurseryItems: st.nurseryItems || [] });
    persistNursery(_nsIds);
    toast(`تم نقل ${count} فسيلة إلى «الوارد والتوريد» 📥`);
    render(); return;
  }
  if (name === "bulk-nissue") {
    if (!selectedOffshootIds.size) return toast("حدد فسائل أولاً");
    dispenseOsIds = Array.from(selectedOffshootIds);
    showDispenseModal = true;
    render(); return;
  }
  if (name === "bulk-nbarcode") {
    if (!selectedOffshootIds.size) return toast("حدد فسائل أولاً");
    barcodePrintIds = Array.from(selectedOffshootIds);
    showBarcodeModal = true;
    render(); return;
  }
  if (name === "bulk-ncull") {
    if (!selectedOffshootIds.size) return toast("حدد فسائل أولاً");
    cullTargetIds = Array.from(selectedOffshootIds);
    showCullModal = true;
    render(); return;
  }
  if (name === "edit-fert") {
    if (tab === "settings") {
      editFertId = id; setForm = "edit-fert"; render(); return;
    }
    editingFertId = id;
    render(); return;
  }
  if (name === "close-edit-fert") {
    editingFertId = null;
    render(); return;
  }
  if (name === "save-edit-fert") {
    const f = (st.fertilizers || []).find(x => x.id === id);
    if (!f) return;
    const newName = ($("#efert_name")?.value || "").trim();
    if (!newName) return toast("أدخل اسم السماد أو المركب");
    f.name = newName;
    f.cropId = $("#efert_crop")?.value || "all";
    f.kind = $("#efert_kind")?.value || "كيميائي";
    f.unit = $("#efert_unit")?.value || "كجم";
    f.minAlert = parseFloat($("#efert_min")?.value || "50") || 50;
    f.unitCost = parseFloat($("#efert_cost")?.value || "0") || 0;
    f.active = $("#efert_active")?.value === "1";

    if (typeof Api !== "undefined" && typeof Api.updateFertilizer === "function") {
      Api.updateFertilizer(f);
    }
    editingFertId = null;
    Store.set({ fertilizers: st.fertilizers });
    toast(`تم تعديل بيانات السماد [${f.name}] بنجاح ✅`);
    render(); return;
  }
  if (name === "del-fert") {
    const f = (st.fertilizers || []).find(x => x.id === id);
    const fertName = f ? f.name : id;
    if (!confirm(`هل أنت متأكد من حذف الصنف [${fertName}] من المستودع؟`)) return;
    st.fertilizers = (st.fertilizers || []).filter(x => x.id !== id);
    if (typeof Api !== "undefined" && typeof Api.deleteFertilizer === "function") {
      Api.deleteFertilizer(id);
    }
    Store.set({ fertilizers: st.fertilizers });
    toast(`تم حذف السماد [${fertName}] بنجاح 🗑️`);
    render(); return;
  }
  if (name === "ready-os") {
    const rec = st.offshoots.find(x => x.id === id) || (st.nurseryItems||[]).find(x => x.id === id);
    if (!rec) return;
    if (rec.newPalmId || rec.isPlanted || rec.nsStatus === "planted") {
      return toast("⚠️ هذا الأصل زُرع بالحقل بالفعل كشجرة قائمة");
    }
    if (rec.nsStatus === "dispatched" || rec.nsStatus === "issued") {
      return toast("⚠️ هذا الأصل صُرف للميدان مسبقاً");
    }
    rec.nsStatus = "ready";
    rec.statusDesc = "جاهزة للصرف والزراعة";
    activeNurseryRowMenuId = null;
    Store.set({ offshoots: st.offshoots, nurseryItems: st.nurseryItems || [] });
    persistNursery(rec);
    toast(`تم تحديد الأصل [${rec.tempCode || rec.code || rec.id}] كـ «جاهز للصرف والزراعة» ✅`);
    render(); return;
  }
  if (name === "issue-os") {
    const rec = st.offshoots.find(x => x.id === id) || (st.nurseryItems||[]).find(x => x.id === id);
    if (rec && (rec.newPalmId || rec.isPlanted || rec.nsStatus === "planted")) {
      return toast("⚠️ هذا الأصل زُرع بالحقل بالفعل كشجرة قائمة");
    }
    dispenseOsIds = [id];
    showDispenseModal = true;
    render(); return;
  }
  if (name === "cancel-os-dispense") {
    showDispenseModal = false;
    dispenseOsIds = [];
    render(); return;
  }
  if (name === "confirm-os-dispense") {
    if (!dispenseOsIds || !dispenseOsIds.length) return toast("لا توجد فسائل محددة للصرف");
    const toUser = $("#os_disp_user")?.value;
    const toPlot = $("#os_disp_plot")?.value;
    const dispDate = $("#os_disp_date")?.value || new Date().toISOString().slice(0,10);
    const dispNotes = ($("#os_disp_notes")?.value || "").trim();
    const toUserObj = (st.users || []).find(u => u.id === toUser);
    const targetPlot = (st.plots || []).find(p => p.id === toPlot);
    const targetPlotName = targetPlot ? `${targetPlot.name || targetPlot.id}` : (toPlot || "الموقع");

    dispenseOsIds.forEach(osId => {
      const o = st.offshoots.find(x => x.id === osId) || (st.nurseryItems||[]).find(x => x.id === osId);
      if (!o) return;
      o.nsStatus = "dispatched";
      o.dispatchedToUser = toUser;
      o.dispatchedToUserName = toUserObj?.name || "";
      o.dispatchedToPlot = toPlot;
      o.dispatchedAt = dispDate;
      o.dispenseNotes = dispNotes;
    });

    if (toUser) {
      st.notifications = st.notifications || [];
      st.notifications.push({
        id: Store.uid("n"),
        userId: toUser,
        text: `🌱 إذن صرف فسائل: تم صرف ${dispenseOsIds.length} أصل لعهدتك بقطعة ${targetPlotName}. يرجى الفحص وتأكيد الاستلام بالموقع.`,
        at: new Date().toISOString(),
        type: "nursery_dispatch",
        targetView: "nursery",
        targetId: "dispensed",
        read: false
      });
    }

    showDispenseModal = false;
    if (typeof AuditLog !== "undefined" && dispenseOsIds.length) {
      AuditLog.log({
        action: "bulk_dispense_offshoots",
        module: "nursery",
        severity: "info",
        title: `إذن صرف فسائل (${dispenseOsIds.length} أصل)`,
        summary: `تم صرف ${dispenseOsIds.length} فسيلة/شتلة لعهدة ${toUserObj?.name || 'المستلم'} بقطعة ${targetPlotName}`,
        details: { count: dispenseOsIds.length, toUser: toUserObj?.name, toPlot: targetPlotName, dispDate, dispNotes },
        targetCount: dispenseOsIds.length,
        targetType: "nursery_bulk",
        user: session()?.name || "مستخدم",
        role: session()?.role || "worker"
      });
    }
    persistNursery(dispenseOsIds);
    dispenseOsIds = [];
    nurseryTab = "dispensed";
    Store.set({ offshoots: st.offshoots, nurseryItems: st.nurseryItems, notifications: st.notifications });
    toast(`تم إصدار إذن الصرف وإرسال إشعار للمستلم المسؤول (${toUserObj?.name || ''})`);
    render(); return;
  }
  if (name === "accept-os-dispatch") {
    const o = st.offshoots.find(x => x.id === id) || (st.nurseryItems||[]).find(x => x.id === id);
    if (!o) return toast("السجل غير موجود");
    const me = session();
    o.nsStatus = "issued";
    o.receivedAt = new Date().toISOString();
    o.receivedBy = me?.id;
    o.receivedByName = me?.name || "المستلم المسؤول";

    const nurAdmin = (st.users || []).find(u => u.role === "admin" || u.role === "nursery_mgr");
    if (nurAdmin && me?.id !== nurAdmin.id) {
      st.notifications = st.notifications || [];
      st.notifications.push({
        id: Store.uid("n"),
        userId: nurAdmin.id,
        text: `✅ تم تأكيد استلام الفسيلة / الأصل ${o.tempCode || o.code} بالحقل بواسطة ${me?.name}.`,
        at: new Date().toISOString(),
        type: "nursery_receipt",
        targetView: "nursery",
        targetId: "dispensed",
        read: false
      });
    }
    Store.set({ offshoots: st.offshoots, nurseryItems: st.nurseryItems, notifications: st.notifications });
    persistNursery(o);
    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "accept_dispatch",
        module: "nursery",
        severity: "info",
        title: `استلام فسيلة: ${o.tempCode || o.code || id}`,
        summary: `تم تأكيد استلام الفسيلة ${o.tempCode || o.code || id} بالموقع بواسطة ${me?.name}`,
        details: { id: o.id, code: o.tempCode || o.code, receivedBy: me?.name },
        targetType: "offshoot",
        targetId: id,
        user: session()?.name || "مستخدم",
        role: session()?.role || "worker"
      });
    }
    toast(`تم اعتماد واستلام الأصل (${o.tempCode || o.code}) بالحقل بنجاح ✅`);
    render(); return;
  }
  if (name === "disp-status-filter") {
    dispStatusF = id !== undefined ? id : ($("#disp_status")?.value || "all");
    render(); return;
  }
  if (name === "disp-user-filter") {
    dispUserF = id !== undefined ? id : ($("#disp_user")?.value || "all");
    render(); return;
  }
  if (name === "apply-disp-filter") {
    dispQ = $("#disp_q")?.value || "";
    dispStatusF = $("#disp_status")?.value || "all";
    dispUserF = $("#disp_user")?.value || "all";
    render(); return;
  }
  if (name === "export-dispensed-csv") {
    let allDispensed = [...st.offshoots, ...(st.nurseryItems || [])].filter(o => {
      return o.newPalmId || o.nsStatus === "issued" || o.nsStatus === "dispatched" || o.nsStatus === "planted" || o.isPlanted;
    });
    if (nurseryCropFilter !== "all") {
      allDispensed = allDispensed.filter(o => {
        const mom = palmById(o.motherId);
        const cId = o.cropId || mom?.cropId || (o.tempCode ? "palm" : (["C","S","T"].includes(o.source) ? "olive" : "palm"));
        return cId === nurseryCropFilter;
      });
    }
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
    const lines = ["\uFEFFالكود,المحصول,الصنف,تاريخ_الصرف,القطعة_المستهدفة,المستلم_المسؤول,الحالة,كود_النخلة_المزروعة,ملاحظات"];
    allDispensed.forEach(o => {
      const mom = palmById(o.motherId);
      const oCrop = o.cropId || mom?.cropId || (o.tempCode ? "palm" : "olive");
      const varName = o.variety || mom?.variety || "";
      const dispDate = o.dispatchedAt ? o.dispatchedAt.slice(0,10) : (o.date || "");
      const pName = o.dispatchedToPlot ? (plotName(o.dispatchedToPlot) || o.dispatchedToPlot) : "";
      const uName = o.dispatchedToUserName || (o.dispatchedToUser ? userBy(o.dispatchedToUser)?.name : "") || "";
      const stDesc = o.nsStatus === "planted" || o.newPalmId ? "زرعت بالحقل" : (o.nsStatus === "dispatched" ? "بانتظار استلام الحقل" : "مستلمة بالحقل");
      lines.push(`"${o.tempCode || o.code}","${cropName(oCrop)}","${varName}","${dispDate}","${pName}","${uName}","${stDesc}","${o.plantedPalmCode || ''}","${o.dispenseNotes || ''}"`);
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `تقرير_المنصرف_للحقل_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    toast("تم تصدير تقرير المنصرف بنجاح");
    return;
  }
  if (name === "prep-os") {
    const rec = st.offshoots.find(x => x.id === id) || (st.nurseryItems||[]).find(x => x.id === id);
    if (!rec) return;
    if (rec.newPalmId || rec.isPlanted || rec.nsStatus === "planted") {
      return toast("⚠️ لا يمكن تسجيل نشاط: تم نقل وزراعة هذا الأصل بالحقل!");
    }
    if (rec.nsStatus === "dispatched" || rec.nsStatus === "issued") {
      return toast("⚠️ لا يمكن تسجيل نشاط: الأصل صُرف إلى الميدان!");
    }
    rec.preps = rec.preps || [];
    const sel = document.getElementById("prep-" + id);
    const typ = (Store.get().nurseryPrepTypes||[]).find(t => t.id === sel?.value);
    rec.preps.push({ at: new Date().toISOString().slice(0, 10), type: typ?.name || sel?.selectedOptions?.[0]?.text || "تجهيز", by: session()?.name || "مشرف المشتل" });
    Store.set({ offshoots: st.offshoots, nurseryItems: st.nurseryItems || [] });
    persistNursery(rec);
    toast("تم تسجيل النشاط بنجاح"); render(); return;
  }
  if (name === "del-nitem") {
    Store.set({ nurseryItems: (st.nurseryItems||[]).filter(x => x.id !== id) }); render(); return;
  }
  if (name === "filter-nur-crop") {
    nurCropFilter = id; render(); return;
  }
  if (name === "add-prep") {
    const n = ($("#prepname").value||"").trim(); if (!n) return toast("أدخل اسم النشاط");
    const cropId = $("#prepcrop")?.value || "all";
    const sourceCode = $("#prepsrc")?.value || "all";
    st.nurseryPrepTypes = st.nurseryPrepTypes || [];
    const newPrep = { id: Store.uid("np"), name: n, cropId, sourceCode, active: true };
    st.nurseryPrepTypes.push(newPrep);
    setForm = "";
    Store.set({ nurseryPrepTypes: st.nurseryPrepTypes });
    if (typeof Api !== "undefined" && typeof Api.createNurseryPrep === "function") {
      Api.createNurseryPrep(newPrep);
    }
    toast("أُضيف نشاط التجهيز بنجاح"); render(); return;
  }
  if (name === "edit-prep") {
    editPrepId = id; setForm = "edit-prep"; render(); return;
  }
  if (name === "cancel-prep-edit") {
    editPrepId = null; setForm = ""; render(); return;
  }
  if (name === "save-prep-edit") {
    const targetId = id || editPrepId;
    const t = (st.nurseryPrepTypes||[]).find(x => x.id === targetId); if (!t) return;
    const n = ($("#prepname_edit")?.value || $("#enp_name")?.value || "").trim();
    if (!n) return toast("اسم النشاط مطلوب");
    t.name = n;
    t.cropId = $("#prepcrop_edit")?.value || $("#enp_crop")?.value || "all";
    t.sourceCode = $("#prepsrc_edit")?.value || "all";
    editPrepId = null;
    setForm = "";
    Store.set({ nurseryPrepTypes: st.nurseryPrepTypes });
    if (typeof Api !== "undefined" && typeof Api.updateNurseryPrep === "function") {
      Api.updateNurseryPrep(t);
    }
    toast("حُفظت تعديلات النشاط بنجاح"); render(); return;
  }
  if (name === "tog-prep") {
    const t = (st.nurseryPrepTypes||[]).find(x => x.id === id); if (!t) return;
    t.active = (t.active === false ? true : false);
    Store.set({ nurseryPrepTypes: st.nurseryPrepTypes });
    if (typeof Api !== "undefined" && typeof Api.toggleNurseryPrep === "function") {
      Api.toggleNurseryPrep(t.id, t.active);
    }
    toast(t.active ? `تم تنشيط ${t.name}` : `تم تعطيل ${t.name}`);
    render(); return;
  }
  if (name === "del-prep") {
    const t = (st.nurseryPrepTypes||[]).find(x => x.id === id);
    Store.set({ nurseryPrepTypes: (st.nurseryPrepTypes||[]).filter(x => x.id !== id) });
    if (typeof Api !== "undefined" && typeof Api.deleteNurseryPrep === "function") {
      Api.deleteNurseryPrep(id);
    }
    toast(t ? `تم حذف ${t.name}` : "تم الحذف");
    render(); return;
  }
  if (name === "ren-prep") {
    const t = (st.nurseryPrepTypes||[]).find(x => x.id === id); if (!t) return;
    const n = prompt("اسم النشاط", t.name); if (!n) return;
    t.name = n.trim(); Store.set({ nurseryPrepTypes: st.nurseryPrepTypes }); render(); return;
  }
  if (name === "back") { goBack(); return; }
  if (name === "toggle-outdoor") {
    localStorage.setItem("palm_outdoor", isOutdoor() ? "0" : "1");
    document.body.classList.toggle("outdoor", isOutdoor());
    render(); return;
  }
  if (name === "toggle-lang") {
    const st = Store.get();
    if (!st.settings?.showLangToggle) {
      toast("مفتاح تبديل اللغات معطّل حالياً من قبل إدارة النظام لحين اكتمال الترجمات", "warn");
      return;
    }
    I18n.toggleLang();
    render(); return;
  }
  if (name === "toggle-lang-switcher") {
    const st = Store.get();
    if (!st.settings) st.settings = {};
    const currentVal = !!st.settings.showLangToggle;
    const newVal = !currentVal;
    st.settings.showLangToggle = newVal;

    // If disabled and current language is not Arabic, restore Arabic immediately
    if (!newVal && I18n.getLang() !== "ar") {
      I18n.setLang("ar");
    }

    Store.set({ settings: st.settings });

    if (typeof AuditLog !== "undefined" && AuditLog.log) {
      AuditLog.log({
        action: "UPDATE",
        module: "settings",
        entityType: "i18n",
        entityId: "showLangToggle",
        entityName: "مفتاح تحويل اللغات",
        summary: newVal ? "تم تفعيل وإظهار مفتاح تبديل اللغات للمستخدمين" : "تم تعطيل وإخفاء مفتاح تبديل اللغات وإلزام الواجهة العربية"
      });
    }

    toast(newVal
      ? t("i18n_toggle_enabled_toast", "تم تفعيل وإظهار مفتاح تبديل اللغات للمستخدمين بنجاح")
      : t("i18n_toggle_disabled_toast", "تم تعطيل وإخفاء مفتاح تبديل اللغات وإعادة الواجهة إلى اللغة العربية")
    );
    render(); return;
  }
  if (name === "i18n-change-lang") {
    i18nEditLang = id || $("#i18n_lang_select")?.value || "en";
    render(); return;
  }
  if (name === "i18n-cat-change") {
    i18nCat = id;
    render(); return;
  }
  if (name === "i18n-search-btn") {
    i18nQuery = ($("#i18n_search")?.value || "").trim();
    render(); return;
  }
  if (name === "i18n-save") {
    const inputs = $$("input[data-i18n-key]");
    const batch = {};
    inputs.forEach(inp => {
      batch[inp.dataset.i18nKey] = inp.value;
    });
    I18n.saveBatch(i18nEditLang, batch);
    if (typeof AuditLog !== "undefined" && AuditLog.log) {
      AuditLog.log({
        action: "UPDATE",
        module: "settings",
        entityType: "i18n",
        entityId: i18nEditLang,
        entityName: "تحديث ترجمات " + i18nEditLang,
        summary: `تم حفظ ${Object.keys(batch).length} مصطلح في قاموس اللغة ${i18nEditLang}`
      });
    }
    toast(t("i18n_save_success", "تم حفظ التعديلات بنجاح وتحديث واجهة النظام"));
    render(); return;
  }
  if (name === "i18n-export") {
    I18n.exportCSV(i18nEditLang);
    if (typeof AuditLog !== "undefined" && AuditLog.log) {
      AuditLog.log({
        action: "EXPORT",
        module: "settings",
        entityType: "i18n",
        entityId: i18nEditLang,
        entityName: "تصدير قاموس " + i18nEditLang,
        summary: `تم تصدير ملف ترجمة اللغة ${i18nEditLang} بصيغة CSV`
      });
    }
    toast("تم تجهيز وتحميل ملف الترجمة CSV بنجاح"); return;
  }
  if (name === "i18n-open-import") {
    i18nShowImportModal = true;
    render(); return;
  }
  if (name === "i18n-close-import") {
    i18nShowImportModal = false;
    render(); return;
  }
  if (name === "i18n-exec-import") {
    const fileInp = $("#i18n_file_input");
    const textInp = $("#i18n_csv_pasted");
    const doImport = (txt) => {
      const cnt = I18n.importCSV(i18nEditLang, txt);
      if (cnt > 0) {
        if (typeof AuditLog !== "undefined" && AuditLog.log) {
          AuditLog.log({
            action: "IMPORT",
            module: "settings",
            entityType: "i18n",
            entityId: i18nEditLang,
            entityName: "استيراد ترجمات " + i18nEditLang,
            summary: `تم استيراد ${cnt} مصطلح بنجاح إلى قاموس ${i18nEditLang}`
          });
        }
        toast(`تم استيراد ${cnt} مصطلح بنجاح`);
      } else {
        toast("لم يتم العثور على مصطلحات مطابقة للاستيراد في الملف");
      }
      i18nShowImportModal = false;
      render();
    };

    if (fileInp && fileInp.files && fileInp.files[0]) {
      const reader = new FileReader();
      reader.onload = (e) => doImport(e.target.result);
      reader.readAsText(fileInp.files[0], "UTF-8");
    } else if (textInp && textInp.value.trim()) {
      doImport(textInp.value);
    } else {
      toast("اختر ملف CSV أو الصق النصوص أولاً");
    }
    return;
  }
  if (name === "i18n-reset") {
    if (confirm("هل أنت متأكد من استعادة القاموس الافتراضي للغة (" + i18nEditLang + ")؟ سيتم إلغاء أية تعديلات مخصصة.")) {
      I18n.resetLang(i18nEditLang);
      if (typeof AuditLog !== "undefined" && AuditLog.log) {
        AuditLog.log({
          action: "DELETE",
          module: "settings",
          entityType: "i18n",
          entityId: i18nEditLang,
          entityName: "استعادة قاموس " + i18nEditLang,
          summary: `تمت استعادة القاموس الافتراضي للغة ${i18nEditLang}`
        });
      }
      toast("تمت استعادة القاموس الافتراضي بنجاح");
      render();
    }
    return;
  }
  if (name === "pick-cat") {
    $("#cat").value = id;
    $$("#catseg button").forEach(b => {
      b.classList.toggle("on", b.dataset.id === id);
      b.classList.toggle("active", b.dataset.id === id);
    });
    const curPalmId = document.querySelector(".btn-save-action")?.dataset?.id;
    const curPalm = curPalmId ? findPalm(curPalmId) : null;
    const curCrop = curPalm?.cropId || "palm";
    const types = typesByCat(id, "individual", curCrop);
    $("#otype").innerHTML = types.map(t=>`<option value="${t.id}">${t.name}</option>`).join("");
    const box = $("#typeseg");
    if (box) box.innerHTML = types.map((t,i)=>`<button type="button" class="chip-btn chip-sub ${i===0?"on active":""}" data-act="pick-type" data-id="${t.id}">${t.name}</button>`).join("");

    // Dynamic Contextual Quick Results (Incident vs Routine/Fertilization)
    const qWrap = $("#qres_wrap");
    if (qWrap) {
      if (id === "c_i") {
        qWrap.innerHTML = `
          <button type="button" class="status-seg-btn seg-danger on active" data-act="pick-res" data-id="إصابة مؤكدة">
            <span>⚠️</span> إصابة مؤكدة
          </button>
          <button type="button" class="status-seg-btn seg-warning" data-act="pick-res" data-id="اشتباه / فحص">
            <span>🔍</span> اشتباه / فحص
          </button>
          <button type="button" class="status-seg-btn seg-success" data-act="pick-res" data-id="تمت المعالجة">
            <span>✓</span> تمت المعالجة
          </button>
        `;
        if ($("#qres")) $("#qres").value = "إصابة مؤكدة";
      } else {
        qWrap.innerHTML = `
          <button type="button" class="status-seg-btn seg-success on active" data-act="pick-res" data-id="تم بنجاح">
            <span>✓</span> تم بنجاح
          </button>
          <button type="button" class="status-seg-btn seg-warning" data-act="pick-res" data-id="يحتاج إعادة">
            <span>↺</span> يحتاج إعادة
          </button>
          <button type="button" class="status-seg-btn seg-partial" data-act="pick-res" data-id="تم جزئياً">
            <span>⏳</span> تم جزئياً
          </button>
        `;
        if ($("#qres")) $("#qres").value = "تم بنجاح";
      }
    }

    paintMaterialFields($("#otype")?.value, "#omatwrap");
    return;
  }
  if (name === "pick-type") {
    $("#otype").value = id;
    $$("#typeseg button").forEach(b => {
      b.classList.toggle("on", b.dataset.id === id);
      b.classList.toggle("active", b.dataset.id === id);
    });
    paintMaterialFields(id, "#omatwrap");
    return;
  }
  if (name === "pick-res") {
    if ($("#qres")) $("#qres").value = id;
    document.querySelectorAll("[data-act='pick-res']").forEach(b => {
      b.classList.toggle("on", b.dataset.id === id);
      b.classList.toggle("active", b.dataset.id === id);
    });
    return;
  }
  if (name === "trigger-cam") {
    $("#photos")?.click();
    return;
  }
  if (name === "jump-code") {
    const q = ($("#globalsearch")?.value || "").trim();
    if (!q) return toast("أدخل الكود");
    const p = st.palms.find(x => codesEqual(x.code, q) || x.code.toUpperCase().includes(q.toUpperCase()));
    if (!p) return toast("لا توجد نخلة بهذا الكود");
    browsePlot = p.plot; browseSec = st.plots.find(x=>x.id===p.plot)?.sector || null;
    go("palm", p.id); return;
  }
  if (name === "change-palm-pagesize") {
    const num = parseInt(id || el?.value, 10);
    PAGE = isNaN(num) ? 20 : num;
    try { localStorage.setItem("palmPageSize", String(PAGE)); } catch (e) {}
    palmPage = 1;
    render();
    return;
  }
  if (name === "change-print-sec") {
    printScopeSec = id || el?.value || "all";
    printScopePlot = "all";
    refreshPrintScopeModal();
    return;
  }
  if (name === "change-print-plot") {
    printScopePlot = id || el?.value || "all";
    refreshPrintScopeModal();
    return;
  }
  if (name === "change-print-crop") {
    printScopeCrop = id || el?.value || "all";
    refreshPrintScopeModal();
    return;
  }
  if (name === "aud-page") {
    audPage = parseInt(id, 10) || 1;
    render();
    return;
  }
  if (name === "aud-pagesize-change") {
    const num = parseInt(id || el?.value, 10);
    audPageSize = isNaN(num) ? 50 : num;
    try { localStorage.setItem("audPageSize", String(audPageSize)); } catch (e) {}
    audPage = 1;
    render();
    return;
  }
  if (name === "aud-search") {
    audSearch = (id !== undefined && typeof id === "string" ? id : (el?.value || "")).trim();
    audPage = 1;
    render();
    return;
  }
  if (name === "aud-user-change") {
    audUser = id || el?.value || "all";
    audPage = 1;
    render();
    return;
  }
  if (name === "aud-module-change") {
    audModule = id || el?.value || "all";
    audPage = 1;
    render();
    return;
  }
  if (name === "aud-action-change") {
    audAction = id || el?.value || "all";
    audPage = 1;
    render();
    return;
  }
  if (name === "aud-period-change") {
    audPeriod = id || el?.value || "all";
    audPage = 1;
    render();
    return;
  }
  if (name === "aud-company-change") {
    audCompany = id || el?.value || "all";
    audProject = "all";
    audPage = 1;
    render();
    return;
  }
  if (name === "aud-project-change") {
    audProject = id || el?.value || "all";
    audPage = 1;
    render();
    return;
  }
  if (name === "aud-clear-filters") {
    audSearch = "";
    audUser = "all";
    audModule = "all";
    audAction = "all";
    audPeriod = "all";
    audCompany = "all";
    audProject = "all";
    audPage = 1;
    render();
    return;
  }
  if (name === "aud-show-detail") {
    activeAuditDetailId = id;
    render();
    return;
  }
  if (name === "aud-close-detail") {
    activeAuditDetailId = null;
    render();
    return;
  }
  if (name === "aud-export-csv") {
    if (typeof AuditLog !== "undefined") {
      AuditLog.exportCSV({
        search: audSearch,
        user: audUser,
        module: audModule,
        action: audAction,
        period: audPeriod
      });
    }
    return;
  }
  if (name === "aud-clean-modal") {
    showAuditCleanModal = true;
    render();
    return;
  }
  if (name === "aud-close-clean") {
    showAuditCleanModal = false;
    render();
    return;
  }
  if (name === "aud-exec-clean") {
    const days = parseInt($("#aud_clean_days")?.value || "30", 10);
    const count = (typeof AuditLog !== "undefined") ? AuditLog.clearOlderThan(days) : 0;
    showAuditCleanModal = false;
    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        module: "settings",
        action: "delete",
        summary: `أرشفة وتنظيف ${count} حركة من سجل التدقيق أقدم من ${days} يوماً`,
        severity: "warning"
      });
    }
    toast(`تمت أرشفة وتنظيف ${count} حركة أقدم من ${days} يوماً بنجاح`);
    render();
    return;
  }
  if (name === "aud-refresh") {
    render();
    toast("تم تحديث سجل التدقيق والرقابة");
    return;
  }
  if (name === "aud-prompt-revert") {
    const s = session();
    if (!s || s.role !== "admin") return toast("هذا الإجراء مخصص لمدير النظام فقط");
    revertTargetRecordId = id;
    showAuditRevertModal = true;
    render();
    return;
  }
  if (name === "aud-close-revert") {
    showAuditRevertModal = false;
    revertTargetRecordId = null;
    render();
    return;
  }
  return ACT_NEXT;
}
