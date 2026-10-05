// PalmTrace app — UI action handlers, part 8 of 9 (starts at: name === "ugroup")
// (split from the former single app.js; files are classic scripts loaded in order by index.html)

async function actionsPart08(name, id, el, st) {
  if (name === "ugroup") { usersGroup = id; render(); return; }
  if (name === "open-sec") {
    const me = session();
    const isRestricted = me && (me.role === "engineer" || me.role === "worker") && me.role !== "admin" && me.role !== "super_admin";
    if (isRestricted) {
      const uPlots = (me?.plots && me.plots.length > 0) ? me.plots : (st.users.find(u => u.id === me?.id || u.user === me?.user)?.plots || []);
      const allowedSecs = new Set(st.plots.filter(p => uPlots.includes(p.id) || uPlots.includes(p.code)).map(p => p.sector || p.sector_id));
      if (!allowedSecs.has(id)) {
        toast("عفواً، ليس لديك صلاحية للاطلاع على هذا القطاع 🔒");
        return;
      }
    }
    dashSector = id; dashPlot = null; render(); return;
  }
  if (name === "open-plot") { dashPlot = id; render(); return; }
  if (name === "dash-back-sec") { dashSector = null; dashPlot = null; render(); return; }
  if (name === "dash-back-plot") { dashPlot = null; render(); return; }
  if (name === "save-cur") {
    st.settings.currency = $("#ccode").value; st.settings.currencyName = $("#cname").value;
    Store.set({ settings: st.settings }); toast("حُفظت العملة"); return;
  }
  if (name === "filter-fert-crop") {
    fertCropFilter = id; render(); return;
  }
  if (name === "edit-fert") {
    editFertId = id; setForm = "edit-fert"; render(); return;
  }
  if (name === "cancel-fert-edit") {
    editFertId = null; setForm = ""; render(); return;
  }
  if (name === "save-fert-edit") {
    const targetId = id || editFertId;
    const f = (st.fertilizers||[]).find(x => x.id === targetId); if (!f) return;
    const n = ($("#ftname_edit")?.value || $("#ef_name")?.value || "").trim();
    if (!n) return toast("اسم السماد مطلوب");
    f.name = n;
    f.kind = $("#ftkind_edit")?.value || $("#ef_kind")?.value || "كيميائي";
    f.cropId = $("#ftcrop_edit")?.value || $("#ef_crop")?.value || "all";
    f.unit = $("#ftunit_edit")?.value || $("#ef_unit")?.value || "جم";
    editFertId = null;
    setForm = "";
    Store.set({ fertilizers: st.fertilizers });
    if (typeof Api !== "undefined" && Api.updateFertilizer) {
      Api.updateFertilizer(f).catch(e => console.warn("Failed to sync fertilizer edit:", e));
    }
    toast("حُفظ تعديل السماد"); render(); return;
  }
  if (name === "add-fert") {
    const nameF = ($("#ftname")?.value || "").trim();
    if (!nameF) return toast("أدخل اسم السماد");
    const cropId = $("#ftcrop")?.value || "all";
    st.fertilizers = st.fertilizers || [];
    const newFert = {
      id: Store.uid("ft"),
      name: nameF,
      kind: $("#ftkind")?.value || "كيميائي",
      unit: $("#ftunit")?.value || "جم",
      cropId,
      stock: 0,
      allocated: 0,
      consumed: 0,
      minAlert: 50,
      unitCost: 0,
      active: true
    };
    st.fertilizers.push(newFert);
    Store.set({ fertilizers: st.fertilizers });
    if (typeof Api !== "undefined" && Api.createFertilizer) {
      Api.createFertilizer(newFert).catch(e => console.warn("Failed to sync new fertilizer:", e));
    }
    toast("أُضيف المركب"); setForm = ""; render(); return;
  }
  if (name === "tog-fert") {
    const f = (st.fertilizers||[]).find(x=>x.id===id); if (!f) return;
    f.active = !f.active;
    Store.set({ fertilizers: st.fertilizers });
    if (typeof Api !== "undefined" && Api.toggleFertilizer) {
      Api.toggleFertilizer(f.id, f.active).catch(e => console.warn("Failed to sync fertilizer toggle:", e));
    }
    render(); return;
  }
  if (name === "fert-tab") {
    fertTab = id;
    showSupplyForm = false;
    showVoucherForm = false;
    showFertNewForm = false;
    render();
    return;
  }
  if (name === "filter-vch") { fertVoucherFilter = id; render(); return; }
  if (name === "tog-fert-supply") {
    const me = session();
    if (!(me?.role === "admin" || me?.role === "warehouse_mgr" || hasPerm("fert_supply_add"))) {
      return toast("ليس لديك صلاحية تسجيل توريد للمستودع");
    }
    if (showSupplyForm) {
      showSupplyForm = false;
      quickSupplyFertId = null;
    } else {
      showSupplyForm = true;
      showVoucherForm = false;
      showFertNewForm = false;
      fertTab = "stock";
    }
    render();
    if (showSupplyForm) {
      setTimeout(() => {
        document.querySelector("#f_sup_fert")?.focus();
        document.querySelector("#f_sup_fert")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 60);
    }
    return;
  }
  if (name === "tog-fert-voucher") {
    const me = session();
    if (!(me?.role === "admin" || me?.role === "warehouse_mgr" || me?.role === "engineer" || hasPerm("fert_voucher_issue"))) {
      return toast("ليس لديك صلاحية إصدار إذن صرف للميدان");
    }
    if (showVoucherForm) {
      showVoucherForm = false;
      quickIssueFertId = null;
    } else {
      showVoucherForm = true;
      showSupplyForm = false;
      showFertNewForm = false;
      fertTab = "vouchers";
    }
    render();
    if (showVoucherForm) {
      setTimeout(() => {
        document.querySelector("#f_vch_fert")?.focus();
        document.querySelector("#f_vch_fert")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 60);
    }
    return;
  }
  if (name === "tog-fert-new") {
    const me = session();
    if (!(me?.role === "admin" || me?.role === "warehouse_mgr" || hasPerm("fert_item_manage"))) {
      return toast("ليس لديك صلاحية إضافة أصناف جديدة");
    }
    if (showFertNewForm) {
      showFertNewForm = false;
    } else {
      showFertNewForm = true;
      showSupplyForm = false;
      showVoucherForm = false;
      fertTab = "stock";
    }
    render();
    if (showFertNewForm) {
      setTimeout(() => {
        document.querySelector("#f_new_name")?.focus();
        document.querySelector("#f_new_name")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 60);
    }
    return;
  }
  if (name === "quick-supply-fert") {
    const me = session();
    if (!(me?.role === "admin" || me?.role === "warehouse_mgr" || hasPerm("fert_supply_add"))) {
      return toast("ليس لديك صلاحية تسجيل توريد للمستودع");
    }
    quickSupplyFertId = id;
    showSupplyForm = true;
    showVoucherForm = false;
    showFertNewForm = false;
    fertTab = "stock";
    render();
    setTimeout(() => {
      document.querySelector("#f_sup_qty")?.focus();
      document.querySelector("#f_sup_fert")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
    return;
  }
  if (name === "quick-issue-fert") {
    const me = session();
    if (!(me?.role === "admin" || me?.role === "warehouse_mgr" || me?.role === "engineer" || hasPerm("fert_voucher_issue"))) {
      return toast("ليس لديك صلاحية إصدار إذن صرف للميدان");
    }
    quickIssueFertId = id;
    showVoucherForm = true;
    showSupplyForm = false;
    showFertNewForm = false;
    fertTab = "vouchers";
    render();
    setTimeout(() => {
      document.querySelector("#f_vch_qty")?.focus();
      document.querySelector("#f_vch_fert")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
    return;
  }
  if (name === "save-fert-supply") {
    const me = session();
    if (!(me?.role === "admin" || me?.role === "warehouse_mgr" || hasPerm("fert_supply_add"))) {
      return toast("ليس لديك صلاحية تسجيل توريد للمستودع");
    }
    const fertId = $("#f_sup_fert")?.value;
    const qty = parseFloat($("#f_sup_qty")?.value || "0");
    const cost = parseFloat($("#f_sup_cost")?.value || "0");
    const supplier = ($("#f_sup_supplier")?.value || "").trim();
    const date = $("#f_sup_date")?.value || new Date().toISOString().slice(0, 10);
    const notes = ($("#f_sup_notes")?.value || "").trim();
    if (!fertId) return toast("اختر الصنف المورّد");
    if (isNaN(qty) || qty <= 0) return toast("أدخل كمية توريد صحيحة أكبر من صفر");
    const fert = (st.fertilizers || []).find(f => f.id === fertId);
    if (!fert) return toast("المركب غير موجود");

    const validCost = (!isNaN(cost) && cost > 0) ? cost : (Number(fert.unitCost || fert.cost) || 0);
    const totalCost = qty * validCost;
    if (validCost > 0) {
      fert.unitCost = validCost;
      fert.cost = validCost;
    }

    fert.stock = (Number(fert.stock) || 0) + qty;
    st.fertilizerVouchers = st.fertilizerVouchers || [];
    const vId = `V-${date.slice(0, 4)}-${String(st.fertilizerVouchers.length + 1).padStart(3, "0")}`;
    const voucher = {
      id: vId,
      date,
      type: "supply",
      fertId: fert.id,
      fertName: fert.name,
      qty,
      unit: fert.unit,
      unitCost: validCost,
      totalCost,
      from: supplier || "مورد خارجي",
      toUser: session().id,
      sectorId: null,
      status: "received",
      notes: notes || `توريد شحنة جديدة برصيد +${qty} ${fert.unit}`,
      createdAt: new Date().toISOString()
    };
    st.fertilizerVouchers.push(voucher);
    Store.set({ fertilizers: st.fertilizers, fertilizerVouchers: st.fertilizerVouchers });
    if (typeof Api !== "undefined") {
      Api.createVoucher(voucher);
    }
    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "supply_fertilizer",
        module: "warehouse",
        severity: "info",
        title: `توريد سماد: ${fert.name}`,
        summary: `توريد ${qty} ${fert.unit} من [${fert.name}] إلى المستودع (إذن ${vId})`,
        details: { voucherId: vId, fertName: fert.name, qty, unit: fert.unit, supplier: voucher.from, totalCost },
        targetType: "voucher",
        targetId: vId,
        user: session()?.name || "مستخدم",
        role: session()?.role || "worker"
      });
    }
    toast(`تم تسجيل توريد ${qty} ${fert.unit} من ${fert.name} وتحديث رصيد المستودع`);
    showSupplyForm = false;
    quickSupplyFertId = null;
    fertTab = "stock";
    render();
    return;
  }
  if (name === "save-fert-voucher") {
    const me = session();
    if (!(me?.role === "admin" || me?.role === "warehouse_mgr" || me?.role === "engineer" || hasPerm("fert_voucher_issue"))) {
      return toast("ليس لديك صلاحية إصدار إذن صرف للميدان");
    }
    const isEngineer = me?.role === "engineer";
    const fertId = $("#f_vch_fert")?.value;
    const qty = parseFloat($("#f_vch_qty")?.value || "0");
    const toUser = $("#f_vch_user")?.value;
    const secId = $("#f_vch_sec")?.value || null;
    const date = $("#f_vch_date")?.value || new Date().toISOString().slice(0, 10);
    const notes = ($("#f_vch_notes")?.value || "").trim();
    if (!fertId) return toast("اختر السماد المطلوب صرفه");
    if (isNaN(qty) || qty <= 0) return toast("أدخل كمية صرف صحيحة");
    if (!toUser) return toast("حدد المستلم في الموقع");
    const fert = (st.fertilizers || []).find(f => f.id === fertId);
    if (!fert) return toast("السماد غير مسجل");

    let fromText = "المخزن الرئيسي";
    let voucherType = "issue";

    if (isEngineer) {
      const secSummary = getSectorFertilizerSummary(me);
      const custodyBal = secSummary.map[fertId]?.remaining || 0;
      if (custodyBal <= 0) {
        return toast("ليس لديك رصيد عهدة متبقي من هذا الصنف للصرف منه. يرجى طلب صرف عهدة من أمين المستودع أولاً.");
      }
      if (qty > custodyBal) {
        return toast(`الكمية المطلوبة (${qty} ${fert.unit}) تتجاوز رصيد العهدة المتبقي لديك (${custodyBal} ${fert.unit})`);
      }
      fromText = `عهدة قطاعات الإشراف (${me.name || 'مهندس'})`;
      voucherType = "issue_field";
      // Crucial: Engineer custody disbursement does NOT deduct central warehouse stock (fert.stock)
    } else {
      if ((Number(fert.stock) || 0) < qty) {
        return toast(`رصيد المخزن (${fert.stock} ${fert.unit}) لا يكفي لصرف ${qty} ${fert.unit}`);
      }
      fert.stock = (Number(fert.stock) || 0) - qty;
      fert.allocated = (Number(fert.allocated) || 0) + qty;
    }

    st.fertilizerVouchers = st.fertilizerVouchers || [];
    const vId = `V-${date.slice(0, 4)}-${String(st.fertilizerVouchers.length + 1).padStart(3, "0")}`;
    const voucher = {
      id: vId,
      date,
      type: voucherType,
      fertId: fert.id,
      fertName: fert.name,
      qty,
      unit: fert.unit,
      from: fromText,
      fromUserId: me.id,
      toUser,
      toUserId: toUser,
      sectorId: secId,
      status: "pending",
      notes: notes || (isEngineer ? `صرف من عهدة المهندس للفني الميداني (${secId ? (sectorName(secId) || secId) : 'العام'})` : `إذن صرف ميداني للقطاع ${secId ? (sectorName(secId) || secId) : 'العام'}`),
      createdAt: new Date().toISOString()
    };
    st.fertilizerVouchers.push(voucher);
    if (typeof Api !== "undefined") {
      Api.createVoucher(voucher);
    }

    const secObj = secId ? (st.sectors || []).find(s => s.id === secId) : null;
    const secName = secObj ? secObj.name : 'العام';
    const issuerRole = roleLabel(me.role) || "المسؤول";
    const issuerName = me.name || "إدارة المزرعة";
    st.notifications = st.notifications || [];
    st.notifications.push({
      id: Store.uid("n"),
      userId: toUser,
      senderId: me.id,
      senderName: issuerName,
      senderRole: issuerRole,
      text: isEngineer 
        ? `📦 تم صرف ${qty} ${fert.unit} من ${fert.name} من عهدة ${issuerName} (${issuerRole}) للقطاع: ${secName} (إذن ${vId}) بانتظار استلامك`
        : `📦 تم إصدار إذن صرف ${qty} ${fert.unit} من ${fert.name} (قطاع: ${secName}) برقم ${vId} من قبل ${issuerName} (${issuerRole}) بانتظار استلامك واعتمادك في الموقع`,
      at: new Date().toISOString(),
      type: "voucher",
      targetView: "fertilizers",
      targetId: vId,
      read: false
    });

    Store.set({ fertilizers: st.fertilizers, fertilizerVouchers: st.fertilizerVouchers, notifications: st.notifications });
    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: isEngineer ? "disburse_engineer_custody" : "issue_fertilizer",
        module: "warehouse",
        severity: "info",
        title: isEngineer ? `صرف سماد من العهدة: ${fert.name}` : `إذن صرف سماد: ${fert.name}`,
        summary: isEngineer 
          ? `صرف ${qty} ${fert.unit} من عهدة المهندس [${fert.name}] للفني الميداني (إذن ${vId})`
          : `إصدار إذن صرف ${qty} ${fert.unit} من [${fert.name}] للموقع (إذن ${vId})`,
        details: { voucherId: vId, fertName: fert.name, qty, unit: fert.unit, toUser, sectorId: secId, from: fromText },
        targetType: "voucher",
        targetId: vId,
        user: me.name || "مستخدم",
        role: me.role || "worker"
      });
    }
    toast(isEngineer ? `✓ تم صرف ${qty} ${fert.unit} من عهدتك برقم ${vId} وتسليمها للميدان` : `تم إصدار إذن الصرف برقم ${vId} وحجز الكمية كعهدة للموقع`);
    showVoucherForm = false;
    fertTab = "vouchers";
    render();
    return;
  }
  if (name === "accept-fert-voucher") {
    const v = (st.fertilizerVouchers || []).find(x => x.id === id);
    if (!v) return toast("الإذن غير موجود");
    const me = session();
    const recipientId = v.toUser || v.toUserId || v.to_user_id;
    const isIssue = (v.type === "issue" || v.voucherType === "issue" || v.voucher_type === "issue");
    if (isIssue && recipientId && (me?.id !== recipientId && me?.user !== recipientId && me?.role !== "admin")) {
      const recipientName = userBy(recipientId)?.name || recipientId;
      return toast(`تأكيد استلام الصرف محصور فقط في المستلم المسؤول بالموقع (${recipientName})`);
    }
    if ((v.type === "supply" || v.voucherType === "supply") && !(me?.role === "admin" || me?.role === "warehouse_mgr" || hasPerm("fert_supply_add"))) {
      return toast("اعتماد التوريد محصور في أمين المستودع والإدارة");
    }
    v.status = "received";
    v.receivedAt = new Date().toISOString();
    v.receivedBy = me?.id;
    v.receivedByName = me?.name || "المستلم المسؤول";
    const whUser = (st.users || []).find(u => u.role === "warehouse_mgr") || (st.users || []).find(u => u.role === "admin");
    if (whUser && me?.id !== whUser.id) {
      const vSecName = v.sectorId ? (sectorName(v.sectorId) || v.sectorId) : "الموقع";
      st.notifications = st.notifications || [];
      st.notifications.push({
        id: Store.uid("n"),
        userId: whUser.id,
        text: `📦 تم تأكيد استلام إذن الصرف ${v.id} (${v.fertName} - ${v.qty} ${v.unit||''}) بقطاع ${vSecName} بواسطة ${me?.name}`,
        at: new Date().toISOString(),
        type: "voucher",
        targetView: "fertilizers",
        targetId: v.id,
        read: false
      });
    }
    Store.set({ fertilizerVouchers: st.fertilizerVouchers, notifications: st.notifications });
    if (typeof Api !== "undefined" && typeof Api.updateVoucher === "function") {
      Api.updateVoucher(v.id, { status: "received", notes: v.notes });
    }
    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "accept_voucher",
        module: "warehouse",
        severity: "info",
        title: `استلام إذن صرف: ${v.fertName}`,
        summary: `تأكيد استلام ${v.qty} ${v.unit||''} من [${v.fertName}] بالموقع (إذن ${v.id}) بواسطة ${me?.name}`,
        details: { voucherId: v.id, fertName: v.fertName, qty: v.qty, sectorId: v.sectorId },
        targetType: "voucher",
        targetId: v.id,
        user: me?.name || "مستخدم",
        role: me?.role || "worker"
      });
    }
    toast(`تم اعتماد واستلام ${v.fertName} بالموقع بنجاح ✅`);
    render();
    return;
  }
  if (name === "reject-fert-voucher") {
    const v = (st.fertilizerVouchers || []).find(x => x.id === id);
    if (!v) return toast("الإذن غير موجود");
    const me = session();
    const recipientId = v.toUser || v.toUserId || v.to_user_id;
    const isIssue = (v.type === "issue" || v.voucherType === "issue" || v.voucher_type === "issue");
    if (isIssue && recipientId && (me?.id !== recipientId && me?.user !== recipientId && me?.role !== "admin")) {
      const recipientName = userBy(recipientId)?.name || recipientId;
      return toast(`رفض استلام الصرف محصور فقط في المستلم المسؤول بالموقع (${recipientName})`);
    }
    if ((v.type === "supply" || v.voucherType === "supply") && !(me?.role === "admin" || me?.role === "warehouse_mgr" || hasPerm("fert_supply_add"))) {
      return toast("رفض التوريد محصور في أمين المستودع والإدارة");
    }
    if (v.status === "pending" && isIssue) {
      const fert = (st.fertilizers || []).find(f => f.id === v.fertId || f.name === v.fertName);
      if (fert) {
        fert.stock = (Number(fert.stock) || 0) + (Number(v.qty) || 0);
        fert.allocated = Math.max(0, (Number(fert.allocated) || 0) - (Number(v.qty) || 0));
      }
    }
    v.status = "rejected";
    v.rejectedAt = new Date().toISOString();
    v.rejectedBy = me?.id;
    v.rejectedByName = me?.name || "المسؤول";
    const whUser = (st.users || []).find(u => u.role === "warehouse_mgr") || (st.users || []).find(u => u.role === "admin");
    if (whUser && me?.id !== whUser.id) {
      const vSecName = v.sectorId ? (sectorName(v.sectorId) || v.sectorId) : "الموقع";
      st.notifications = st.notifications || [];
      st.notifications.push({
        id: Store.uid("n"),
        userId: whUser.id,
        text: `⚠️ تم رفض استلام إذن الصرف ${v.id} (${v.fertName}) بقطاع ${vSecName} بواسطة ${me?.name} وأُعيد الرصيد للمستودع`,
        at: new Date().toISOString(),
        type: "voucher",
        targetView: "fertilizers",
        targetId: v.id,
        read: false
      });
    }
    Store.set({ fertilizers: st.fertilizers, fertilizerVouchers: st.fertilizerVouchers, notifications: st.notifications });
    if (typeof Api !== "undefined" && typeof Api.updateVoucher === "function") {
      Api.updateVoucher(v.id, { status: "rejected", notes: v.notes });
    }
    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "reject_voucher",
        module: "warehouse",
        severity: "warning",
        title: `رفض إذن صرف: ${v.fertName}`,
        summary: `رفض إذن الصرف ${v.id} (${v.fertName}) وإعادة الكمية لرصيد المستودع بواسطة ${me?.name}`,
        details: { voucherId: v.id, fertName: v.fertName, qty: v.qty },
        targetType: "voucher",
        targetId: v.id,
        user: me?.name || "مستخدم",
        role: me?.role || "worker"
      });
    }
    toast("تم رفض إذن الصرف وإعادة الكمية لرصيد المستودع");
    render();
    return;
  }
  if (name === "save-fert-new") {
    const me = session();
    if (!(me?.role === "admin" || me?.role === "warehouse_mgr" || hasPerm("fert_item_manage"))) {
      return toast("ليس لديك صلاحية إضافة أصناف جديدة");
    }
    const nameF = ($("#f_new_name")?.value || "").trim();
    if (!nameF) return toast("أدخل اسم المركب أو السماد");
    const cropId = $("#f_new_crop")?.value || "all";
    const kind = $("#f_new_kind")?.value || "كيميائي";
    const unit = $("#f_new_unit")?.value || "كجم";
    const stock = parseFloat($("#f_new_stock")?.value || "0");
    const minAlert = parseFloat($("#f_new_min")?.value || "100");
    const unitCost = parseFloat($("#f_new_cost")?.value || "0");

    st.fertilizers = st.fertilizers || [];
    const newFert = {
      id: Store.uid("ft"),
      name: nameF,
      cropId,
      kind,
      unit,
      stock,
      allocated: 0,
      consumed: 0,
      minAlert,
      unitCost,
      active: true
    };
    st.fertilizers.push(newFert);
    Store.set({ fertilizers: st.fertilizers });
    if (typeof Api !== "undefined" && Api.createFertilizer) {
      Api.createFertilizer(newFert).catch(e => console.warn("Failed to sync new fertilizer:", e));
    }
    toast(`تمت إضافة ${nameF} إلى قائمة الأسمدة والمخزون بنجاح`);
    showFertNewForm = false;
    fertTab = "stock";
    render();
    return;
  }
  if (name === "set-tab") { setTab = id; setForm = ""; render(); return; }
  if (name === "tog-sform") { setForm = setForm === id ? "" : id; render(); return; }
  if (name === "add-cat") {
    const n = ($("#catnew").value||"").trim(); if (!n) return toast("أدخل اسم التصنيف");
    st.operationCats = st.operationCats || [];
    st.operationCats.push({ id: Store.uid("c"), name: n });
    Store.set({ operationCats: st.operationCats }); toast("أُضيف التصنيف"); render(); return;
  }
  if (name === "ren-cat") {
    editCatId = id; render(); return;
  }
  if (name === "cancel-cat-edit") {
    editCatId = null; render(); return;
  }
  if (name === "save-cat-edit") {
    const targetId = id || editCatId;
    const c = (st.operationCats || []).find(x => x.id === targetId);
    if (!c) return;
    const n = ($("#cat_edit_name")?.value || "").trim();
    if (!n) return toast("اسم التصنيف مطلوب");
    c.name = n;
    editCatId = null;
    Store.set({ operationCats: st.operationCats });
    toast("حُفظ تعديل التصنيف");
    render(); return;
  }
  if (name === "del-cat") {
    if (st.operationTypes.some(t=>t.catId===id) || st.operations.some(o => st.operationTypes.find(t=>t.id===o.typeId)?.catId===id))
      return toast("التصنيف مستخدم — عُطّل بدل الحذف");
    Store.set({ operationCats: st.operationCats.filter(c=>c.id!==id) }); render(); return;
  }
  if (name === "filter-ops-crop") {
    opsCropFilter = id; render(); return;
  }
  if (name === "edit-optype") {
    editOpId = id; editOpTypeId = id; setForm = "edit-op"; render(); return;
  }
  if (name === "cancel-optype-edit") {
    editOpId = null; editOpTypeId = null; setForm = ""; render(); return;
  }
  if (name === "save-optype-edit") {
    const targetId = id || editOpId || editOpTypeId;
    const t = st.operationTypes.find(x => x.id === targetId); if (!t) return;
    const n = ($("#ename")?.value || $("#eop_name")?.value || "").trim();
    if (!n) return toast("اسم العملية مطلوب");
    t.name = n;
    t.catId = $("#ecat")?.value || $("#eop_cat")?.value || t.catId;
    t.cropId = $("#ecrop")?.value || $("#eop_crop")?.value || "all";
    t.scopeType = $("#escope")?.value || t.scopeType || "both";
    t.isCritical = $("#ecritical") ? $("#ecritical").checked : Boolean(t.isCritical);
    const reqMat = ($("#eneed")?.value || $("#eop_need")?.value) === "1";
    t.requiresMaterial = reqMat;
    t.allowedKinds = reqMat ? (($("#ekind")?.value || $("#eop_kind")?.value || "").split(",").map(x => x.trim()).filter(Boolean)) : [];
    editOpId = null;
    editOpTypeId = null;
    setForm = "";
    Store.set({ operationTypes: st.operationTypes });
    if (typeof Api !== "undefined" && Api.saveOperationType) {
      Api.saveOperationType(t);
    }
    toast("حُفظت تعديلات العملية"); render(); return;
  }
  if (name === "ren-optype") {
    const t = st.operationTypes.find(x=>x.id===id); if (!t) return;
    const n = prompt("اسم العملية", t.name); if (!n) return;
    t.name = n.trim();
    t.requiresMaterial = confirm("هل تتطلب هذه العملية اختيار مركب/سماد/مبيد؟") ;
    if (t.requiresMaterial) {
      const k = prompt("أنواع المواد مفصولة بفاصلة: عضوي,كيميائي,مبيد", (t.allowedKinds||[]).join(",")) || "عضوي,كيميائي";
      t.allowedKinds = k.split(",").map(s=>s.trim()).filter(Boolean);
    } else t.allowedKinds = [];
    Store.set({ operationTypes: st.operationTypes });
    if (typeof Api !== "undefined" && Api.saveOperationType) {
      Api.saveOperationType(t);
    }
    render(); return;
  }
  if (name === "del-optype") {
    if (st.operations.some(o => o.typeId === id)) {
      const t = st.operationTypes.find(x => x.id === id); if (t) t.inactive = true;
      Store.set({ operationTypes: st.operationTypes });
      if (typeof Api !== "undefined" && Api.saveOperationType && t) {
        Api.saveOperationType(t);
      }
      toast("عُطّلت العملية لأنها مرتبطة بسجلات"); render(); return;
    }
    Store.set({ operationTypes: st.operationTypes.filter(t=>t.id!==id) }); render(); return;
  }
  if (name === "tog-optype-status") {
    const t = (st.operationTypes || []).find(x => x.id === id);
    if (!t) return;
    t.inactive = !t.inactive;
    Store.set({ operationTypes: st.operationTypes });
    if (typeof Api !== "undefined" && Api.saveOperationType) {
      Api.saveOperationType(t);
    }
    toast(t.inactive ? `تم تعطيل العملية: ${t.name}` : `تم تنشيط العملية: ${t.name} بنجاح`);
    render();
    return;
  }
  if (name === "hide-char") {
    const c = st.charities.find(x=>x.id===id); if (!c) return;
    c.hidden = !c.hidden; Store.set({ charities: st.charities }); toast(c.hidden?"حُجبت عن المستثمرين":"أُظهرت للمستثمرين"); render(); return;
  }
  if (name === "n-sup-change") {
    const val = $("#nsupn_sel")?.value;
    const customInp = $("#nsupn_custom");
    if (customInp) {
      if (val === "custom") {
        customInp.classList.remove("hidden");
        customInp.focus();
      } else {
        customInp.classList.add("hidden");
      }
    }
    return;
  }
  if (name === "save-nursery") {
    const cropId = $("#ncrop_buy")?.value || buyCropSel || "palm";
    const qty = Math.max(1, parseInt($("#nqty")?.value || "1", 10));
    const prefix = ($("#nprefix")?.value || `NUR-${new Date().getFullYear()}-`).trim();
    const startSeq = parseInt($("#nseqb")?.value || "1", 10);
    const source = $("#nsrc")?.value || "F";
    const variety = $("#nvarn")?.value || "خلاص";
    const supSel = $("#nsupn_sel")?.value || "رصيد افتتاحي معتمد";
    const customSup = ($("#nsupn_custom")?.value || "").trim();
    const supplier = (supSel === "custom" && customSup) ? customSup : (supSel === "custom" ? "مشتل خارجي" : supSel);
    const initialStage = $("#ninitial_stage")?.value || "inbound";
    const entryDate = $("#ndateb")?.value || new Date().toISOString().slice(0, 10);
    const notes = ($("#nnoteb")?.value || "").trim();
    const stageDesc = (initialStage === "ready") ? "جاهزة للصرف والزراعة" : (initialStage === "rooting" ? "في التجذير والرعاية" : "بانتظار الاستلام والتجهيز");

    const createdList = [];
    for (let i = 0; i < qty; i++) {
      const curNum = startSeq + i;
      const seqStr = String(curNum).padStart(4, "0");
      const code = `${prefix}${seqStr}`;
      const offshootId = `os_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 5)}`;
      const offshootObj = {
        id: offshootId,
        motherId: null,
        motherCode: null,
        tempCode: code,
        seq: seqStr,
        date: entryDate,
        variety: variety,
        originType: "purchase",
        originLabel: "شراء / رصيد افتتاحي",
        supplier: supplier,
        nsStatus: initialStage,
        statusDesc: stageDesc,
        is_opening_stock: 1,
        isOpeningStock: 1,
        health: "healthy",
        cropId: cropId,
        source: source,
        notes: notes || "رصيد افتتاحي / شراء مشتل",
        createdAt: new Date().toISOString()
      };
      createdList.push(offshootObj);
    }

    st.offshoots = st.offshoots || [];
    st.offshoots.unshift(...createdList);
    Store.set({ offshoots: st.offshoots });

    if (typeof Api !== "undefined" && typeof Api.bulkIntakeOffshoots === "function") {
      Api.bulkIntakeOffshoots(createdList);
    }

    showBuyForm = false;
    nurseryTab = initialStage;
    const stageName = initialStage === "inbound" ? "الوارد والتوريد" : (initialStage === "rooting" ? "التجذير والرعاية" : "جاهزة للصرف");
    toast(`✅ تم تسجيل وتوريد ${qty} فسيلة بنجاح في مسار [${stageName}]`);
    render();
    return;
  }

  if (name === "save-nursery-sep") {
    const momCode = ($("#nmother_code")?.value || "").trim();
    const mom = st.palms.find(p => p.code === momCode);
    if (!mom) return toast("⚠️ يرجى اختيار كود النخلة الأم المسجلة بالحقل");
    const sepDate = $("#nsep_date")?.value || new Date().toISOString().slice(0, 10);
    const weight = parseFloat($("#nweight")?.value || "0") || null;
    const diameter = parseFloat($("#ndiameter")?.value || "0") || null;
    const health = $("#nhealth")?.value || "healthy";
    const notes = ($("#nnoteb_sep")?.value || "").trim();

    const curSeq = (st.offshoots.filter(o => o.motherId === mom.id).length + 1);
    const seqStr = `OS${String(curSeq).padStart(2, "0")}`;
    const dateTag = sepDate.slice(2, 4) + sepDate.slice(5, 7);
    const code = `${mom.code}-${seqStr}-${dateTag}`;
    const offshootId = `os_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;

    const offshootObj = {
      id: offshootId,
      motherId: mom.id,
      motherCode: mom.code,
      tempCode: code,
      seq: String(curSeq).padStart(3, "0"),
      date: sepDate,
      weight: weight,
      diameter: diameter,
      health: health,
      variety: mom.variety || "خلاص",
      originType: "internal",
      originLabel: "فصل داخلي",
      supplier: "قلع داخلي من المزرعة",
      nsStatus: "rooting",
      statusDesc: "في التجذير والرعاية",
      is_opening_stock: 0,
      isOpeningStock: 0,
      cropId: mom.cropId || "palm",
      notes: notes,
      createdAt: new Date().toISOString()
    };

    st.offshoots = st.offshoots || [];
    st.offshoots.unshift(offshootObj);
    Store.set({ offshoots: st.offshoots });

    if (typeof Api !== "undefined" && typeof Api.createOffshoot === "function") {
      Api.createOffshoot(offshootObj);
    }

    showBuyForm = false;
    nurseryTab = "rooting";
    toast(`✅ تم تسجيل الفسيلة المفصولة بنجاح: ${code} ونقلها للتجذير والرعاية 🌱`);
    render();
    return;
  }
  if (name === "add-optype") {
    const nameVal = ($("#nop_name") || $("#nname"))?.value?.trim();
    if (!nameVal) return toast("أدخل اسم العملية");
    const catVal = ($("#nop_cat") || $("#ncat"))?.value;
    const cropVal = ($("#nop_crop") || $("#ncrop"))?.value || "all";
    const scopeVal = ($("#nop_scope") || $("#nscope"))?.value || "both";
    const isCrit = ($("#nop_critical") || $("#ncritical")) ? ($("#nop_critical") || $("#ncritical")).checked : false;
    const reqMat = ($("#nop_need") || $("#nneed"))?.value === "1";
    const kindVal = ($("#nop_kind") || $("#nkind"))?.value || "";
    const newType = {
      id: Store.uid("t"),
      catId: catVal,
      name: nameVal,
      cropId: cropVal,
      scopeType: scopeVal,
      isCritical: isCrit,
      requiresMaterial: reqMat,
      allowedKinds: reqMat ? kindVal.split(",").filter(Boolean) : []
    };
    st.operationTypes.push(newType);
    setForm = "";
    Store.set({ operationTypes: st.operationTypes });
    if (typeof Api !== "undefined" && Api.saveOperationType) {
      Api.saveOperationType(newType);
    }
    toast("تمت إضافة العملية بنجاح"); render(); return;
  }
  if (name === "filter-yield-crop") {
    yieldCropFilter = id || "all"; render(); return;
  }
  if (name === "open-yield-modal") {
    showYieldModal = true;
    yieldSelectedPlots.clear();
    render();
    return;
  }
  if (name === "close-yield-modal") {
    showYieldModal = false;
    render();
    return;
  }
  if (name === "yield-crop-change") {
    yieldRegCrop = id || "palm"; render(); return;
  }
  if (name === "export-yield") {
    if (!hasPerm("yields_export") && session()?.role !== "admin") {
      return toast("ليس لديك صلاحية اعتماد وتصدير بيانات المحصول");
    }
    const rows = ["\uFEFFالشحنة,الموسم,المحصول,الموقع,الصنف,ممتاز,جيد,تالف,الإجمالي"];
    st.yields.forEach(y => {
      const cLabel = cropSingle(y.cropId || "palm");
      rows.push(`${y.batch||y.id},${y.season},${cLabel},${y.plotId||y.sectorId||""},${y.variety||""},${y.kgEx||0},${y.kgGd||0},${y.kgBad||0},${y.kg}`);
    });
    const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([rows.join("\n")],{type:"text/csv;charset=utf-8"})); a.download="سجل_الحصاد_والمحاصيل.csv"; a.click(); return;
  }

  if (name === "open-yield-details") {
    activeYieldDetailsId = id;
    render();
    return;
  }
  if (name === "close-yield-details") {
    activeYieldDetailsId = null;
    render();
    return;
  }

  if (name === "print-batch") {
    const y = st.yields.find(x => x.id === id); if (!y) return;
    printHarvestBatchSticker(y, st);
    return;
  }
  if (name === "yield-change-season") {
    yieldsSeason = id || (e.target ? e.target.value : "2026");
    render();
    return;
  }
  if (name === "yield-open-new-season") {
    if (!hasPerm("seasons_manage")) return toast("ليس لديك صلاحية إنشاء وإدارة المواسم الزراعية");
    showYieldNewSeasonModal = true;
    render();
    return;
  }
  if (name === "close-yield-new-season") {
    showYieldNewSeasonModal = false;
    render();
    return;
  }
  if (name === "confirm-yield-new-season") {
    if (!hasPerm("seasons_manage")) return toast("ليس لديك صلاحية إنشاء وإدارة المواسم الزراعية");
    const newY = ($("#new_yield_season_input")?.value || "").trim();
    if (!newY || !/^\d{4}$/.test(newY)) return toast("يرجى إدخال سنة صحيحة من 4 أرقام (مثال: 2027)");
    yieldsSeason = newY;
    showYieldNewSeasonModal = false;
    toast(`تم تفعيل دورة موسم الحصاد الجديد: ${newY}م`);
    render();
    return;
  }
  if (name === "pick-yield-base") {
    const bId = id;
    const sec = $("#ysec")?.value || "";
    const subs = st.plots.filter(p => (plotBaseId(p) === bId || p.id.startsWith(bId)) && (!sec || p.sector === sec));
    const allSelected = subs.length > 0 && subs.every(p => yieldSelectedPlots.has(p.id));
    if (allSelected) {
      subs.forEach(p => yieldSelectedPlots.delete(p.id));
    } else {
      subs.forEach(p => yieldSelectedPlots.add(p.id));
    }
    if ($("#yplot")) {
      if (yieldSelectedPlots.size === 1) {
        $("#yplot").value = [...yieldSelectedPlots][0];
      } else if (subs.length > 1 && !allSelected) {
        $("#yplot").value = `base:${bId}`;
      }
    }
    if (window._applyY) window._applyY();
    return;
  }
  if (name === "pick-yield-part") {
    if (yieldSelectedPlots.has(id)) {
      yieldSelectedPlots.delete(id);
    } else {
      yieldSelectedPlots.add(id);
    }
    if ($("#yplot") && yieldSelectedPlots.size === 1) {
      $("#yplot").value = id;
    }
    if (window._applyY) window._applyY();
    return;
  }
  if (name === "yield-select-all-plots") {
    const sec = $("#ysec")?.value || "";
    const secPlots = st.plots.filter(p => !sec || p.sector === sec);
    secPlots.forEach(p => yieldSelectedPlots.add(p.id));
    toast(`تم تحديد كافة قطع القطاع (${secPlots.length} قطعة/جزء)`);
    if (window._applyY) window._applyY();
    return;
  }
  if (name === "yield-clear-plots") {
    yieldSelectedPlots.clear();
    toast("تم مسح تحديد القطع");
    if (window._applyY) window._applyY();
    return;
  }
  if (name === "yield-drop-plot") {
    yieldSelectedPlots.delete(id);
    if (window._applyY) window._applyY();
    return;
  }
  if (name === "reset-yield-filter") {
    yieldTableSearch = "";
    yieldTableSec = "all";
    yieldTableQuality = "all";
    render();
    return;
  }
  if (name === "open-edit-yield") {
    const uRole = session()?.role || "";
    const isAdminOrEng = ["admin", "super_admin", "company_admin", "engineer", "tenant_user"].includes(uRole) || session()?.isSuperAdmin || session()?.user === "admin";
    const canEdit = hasPerm("yields_edit") || isAdminOrEng;
    if (!canEdit) return toast("ليس لديك صلاحية تعديل بيانات الحصاد والمواسم");
    editingYieldId = id;
    showEditYieldModal = true;
    render();
    return;
  }
  if (name === "close-edit-yield") {
    showEditYieldModal = false;
    editingYieldId = null;
    render();
    return;
  }
  if (name === "save-edit-yield") {
    const uRole = session()?.role || "";
    const isAdminOrEng = ["admin", "super_admin", "company_admin", "engineer", "tenant_user"].includes(uRole) || session()?.isSuperAdmin || session()?.user === "admin";
    const canEdit = hasPerm("yields_edit") || isAdminOrEng;
    if (!canEdit) return toast("ليس لديك صلاحية تعديل بيانات الحصاد والمواسم");
    const y = st.yields.find(x => x.id === id);
    if (!y) return toast("الشحنة غير موجودة");
    const newSeason = ($("#edit_yseason")?.value || "").trim() || y.season;
    const newDate = ($("#edit_ydate")?.value || "").trim() || y.date;
    const newVariety = ($("#edit_yvariety")?.value || "").trim() || y.variety;
    const newKg = parseFloat($("#edit_ykg")?.value) || 0;
    const newKgEx = parseFloat($("#edit_ykg_ex")?.value) || 0;
    const newKgGd = parseFloat($("#edit_ykg_gd")?.value) || 0;
    const newKgBad = parseFloat($("#edit_ykg_bad")?.value) || 0;
    const newNotes = ($("#edit_ynotes")?.value || "").trim();

    y.season = newSeason;
    y.date = newDate;
    y.variety = newVariety;
    y.kg = newKg;
    y.kgEx = newKgEx;
    y.kgGd = newKgGd;
    y.kgBad = newKgBad;
    y.quality = newKgEx >= newKgGd ? "ممتاز" : "جيد";
    y.notes = newNotes;

    Store.set({ yields: st.yields });
    fetch(`/api/yields/${encodeURIComponent(y.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(y)
    }).catch(() => {});

    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "update",
        module: "yields",
        severity: "info",
        title: `تعديل شحنة حصاد: ${y.batch || y.id}`,
        summary: `تم تعديل بيانات شحنة الحصاد [${y.batch || y.id}] بإجمالي ${newKg} كجم بواسطة ${session()?.name || 'المستخدم'}`,
        details: y,
        targetType: "yield",
        targetId: y.id,
        user: session()?.name || "مستخدم",
        role: session()?.role || "worker"
      });
    }

    showEditYieldModal = false;
    editingYieldId = null;
    toast(`تم تعديل بيانات الشحنة ${y.batch || y.id} بنجاح ✅`);
    render();
    return;
  }
  if (name === "del-yield") {
    const uRole = session()?.role || "";
    const isAdminOrEng = ["admin", "super_admin", "company_admin", "engineer", "tenant_user"].includes(uRole) || session()?.isSuperAdmin || session()?.user === "admin";
    const canDel = hasPerm("yields_delete") || isAdminOrEng;
    if (!canDel) return toast("ليس لديك صلاحية حذف سجلات الحصاد");
    const y = st.yields.find(x => x.id === id);
    if (!y) return;
    if (!confirm(`هل أنت متأكد من حذف سجل الشحنة (${y.batch || y.id}) بإجمالي ${y.kg} كجم؟`)) return;
    st.yields = st.yields.filter(x => x.id !== id);
    Store.set({ yields: st.yields });
    fetch(`/api/yields/${encodeURIComponent(y.id)}`, { method: 'DELETE' }).catch(() => {});
    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "delete",
        module: "yields",
        severity: "danger",
        title: `حذف شحنة حصاد: ${y.batch || y.id}`,
        summary: `تم حذف سجل شحنة الحصاد [${y.batch || y.id}] (${y.kg} كجم) بواسطة ${session()?.name}`,
        details: y,
        targetType: "yield",
        targetId: y.id,
        user: session()?.name || "مستخدم",
        role: session()?.role || "worker"
      });
    }
    toast(`تم حذف سجل الشحنة ${y.batch || y.id}`);
    render();
    return;
  }
  return ACT_NEXT;
}
