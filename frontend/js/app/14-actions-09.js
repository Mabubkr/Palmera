// PalmTrace app — UI action handlers, part 9 of 9 (starts at: name === "save-yield")
// (split from the former single app.js; files are classic scripts loaded in order by index.html)

async function actionsPart09(name, id, el, st) {
  if (name === "save-yield") {
    const cropId = $("#ycrop")?.value || yieldRegCrop || "palm";
    const level = $("#ylevel").value;
    const kgEx = parseFloat(toCleanDigits($("#yex")?.value || 0)) || 0;
    const kgGd = parseFloat(toCleanDigits($("#ygd")?.value || 0)) || 0;
    const kgBad = parseFloat(toCleanDigits($("#ybad")?.value || 0)) || 0;
    const kg = +(kgEx + kgGd + kgBad).toFixed(2);
    if (!kg || kg <= 0) return toast("يرجى إدخال أوزان الجودة المستلمة للشحنة");
    const season = $("#ys")?.value || yieldsSeason || "2026";
    const sectorId = $("#ysec")?.value || "";
    
    // Multi-plot handling
    let plotId = $("#yplot")?.value || "";
    let plotIds = [];
    if (yieldSelectedPlots.size > 0) {
      plotIds = [...yieldSelectedPlots];
      plotId = plotIds.length === 1 ? plotIds[0] : plotIds.join(", ");
    } else if (plotId) {
      if (plotId.startsWith("base:")) {
        const bId = plotId.slice(5);
        plotIds = st.plots.filter(p => (plotBaseId(p) === bId || p.id.startsWith(bId)) && (!sectorId || p.sector === sectorId)).map(p => p.id);
      } else {
        plotIds = [plotId];
      }
    }

    const batch = ($("#ybatch")?.value || "").trim() || Store.uid("B");
    const userHarvestedCount = parseInt($("#yharvested_count")?.value, 10);

    // Calculate palms
    let palms = [];
    if (level === "palm") {
      const p = st.palms.find(x => x.id === $("#ypalm")?.value);
      if (p) palms = [p];
    } else if (plotIds.length > 0) {
      palms = st.palms.filter(p => plotIds.includes(p.plot) && (p.cropId || "palm") === cropId && !p.archived);
    } else if (sectorId) {
      palms = st.palms.filter(p => {
        const pl = st.plots.find(x => x.id === p.plot);
        return pl?.sector === sectorId && (p.cropId || "palm") === cropId && !p.archived;
      });
    }

    const actualCount = (!isNaN(userHarvestedCount) && userHarvestedCount > 0) ? userHarvestedCount : palms.length;

    const rec = {
      id: Store.uid("y"),
      cropId,
      level,
      palmId: level === "palm" ? $("#ypalm")?.value : null,
      plotId: (level === "plot" || level === "split") ? plotId : null,
      plotIds: (level === "plot" || level === "split") ? plotIds : [],
      sectorId,
      kg,
      kgEx,
      kgGd,
      kgBad,
      quality: kgEx >= kgGd ? "ممتاز" : "جيد",
      season,
      variety: $("#yvar")?.value || "",
      batch,
      date: $("#ydate")?.value || new Date().toISOString().slice(0, 10),
      count: actualCount,
      distributed: (level === "split" && actualCount > 0) ? +(kg / actualCount).toFixed(2) : kg,
      by: session().id
    };

    st.yields.push(rec);
    yieldSelectedPlots.clear();
    Store.set({ yields: st.yields });
    if (typeof Api !== "undefined") {
      Api.createYield(rec);
    }
    const curCropObj = (st.crops || []).find(c => c.id === cropId);
    const unitName = curCropObj?.unit || "كجم";
    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "create",
        module: "yields",
        severity: "info",
        title: `تسجيل شحنة حصاد: ${batch}`,
        summary: `تسجيل شحنة حصاد جديدة برقم [${batch}] بوزن إجمالي ${kg} ${unitName}`,
        details: { batch, cropId, kg, kgEx, kgGd, kgBad, quality: rec.quality, season, variety: rec.variety, level, plotIds, count: actualCount },
        targetType: "yield",
        targetId: rec.id,
        user: session()?.name || "مستخدم",
        role: session()?.role || "worker"
      });
    }
    toast(`تم حفظ شحنة الحصاد ${batch} بنجاح (${kg} ${unitName})`);
    showYieldModal = false;
    render();
    return;
  }
  if (false && name === "__dead_yield") { return; }
  if (name === "add-charity") {
    const nameC = ($("#cname").value||"").trim();
    const address = ($("#caddr")?.value||"").trim();
    const phone = ($("#cphone")?.value||"").trim();
    if (!nameC || !address || !phone) return toast("أدخل اسم الجهة والعنوان وبيانات التواصل");
    const newCharity = { id: Store.uid("c"), name: nameC, address, phone, receive: $("#crecv")?.value || "both", hidden: false };
    st.charities.push(newCharity);
    Store.set({ charities: st.charities });
    if (typeof Api !== "undefined") {
      Api.createCharity(newCharity);
    }
    toast("أُضيفت الجهة"); render(); return;
  }
  if (name === "ok-zakat") {
    const z = st.zakat.find(x=>x.id===id); if (!z) return;
    z.status = "approved"; Store.set({ zakat: st.zakat });
    if (typeof Api !== "undefined") {
      Api.updateZakat(z.id, { status: "approved" });
    }
    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "approve_zakat",
        module: "zakat",
        severity: "info",
        title: `اعتماد طلب زكاة: ${z.id}`,
        summary: `تم اعتماد طلب توزيع الزكاة [${z.id}] بواسطة ${session()?.name}`,
        details: z,
        targetType: "zakat",
        targetId: z.id,
        user: session()?.name || "مستخدم",
        role: session()?.role || "worker"
      });
    }
    toast("اعتُمد الطلب"); render(); return;
  }
  if (name === "no-zakat") {
    const z = st.zakat.find(x=>x.id===id); if (!z) return;
    z.status = "rejected"; Store.set({ zakat: st.zakat });
    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "reject_zakat",
        module: "zakat",
        severity: "warning",
        title: `رفض طلب زكاة: ${z.id}`,
        summary: `تم رفض طلب توزيع الزكاة [${z.id}] بواسطة ${session()?.name}`,
        details: z,
        targetType: "zakat",
        targetId: z.id,
        user: session()?.name || "مستخدم",
        role: session()?.role || "worker"
      });
    }
    toast("رُفض الطلب"); render(); return;
  }
  if (name === "zakat-change-season" || name === "inv-zakat-change-season") {
    zakatSeason = id || e?.target?.value || "2026";
    zakatSelectedInvIds.clear();
    zakatInvPage = 1;
    render(); return;
  }
  if (name === "zakat-open-broadcast" || name === "zakat-open-bcast-modal") {
    showBroadcastZakatModal = true;
    render(); return;
  }
  if (name === "zakat-close-broadcast") {
    showBroadcastZakatModal = false;
    render(); return;
  }
  if (name === "zakat-send-broadcast") {
    const bSeason = $("#zbcast_season")?.value || zakatSeason || "2026";
    const bTarget = $("#zbcast_target")?.value || "unpledged";
    const bText = $("#zbcast_text")?.value?.trim() || `📢 خدمة إخراج زكاة التمور والثمار لموسم ${bSeason}م متاحة الآن.`;
    const allInvs = st.users.filter(u => u.role === "investor");
    const targetInvs = allInvs.filter(inv => {
      if (bTarget === "all") return true;
      const z = (st.zakat || []).find(x => x.investorId === inv.id && String(x.season || "2026") === String(bSeason));
      return !z || z.pledgeStatus !== "signed";
    });

    if (!targetInvs.length) {
      toast("لا يوجد مستثمرون مستهدفون ضمن المعايير المحددة");
      return;
    }

    st.notifications = st.notifications || [];
    targetInvs.forEach(inv => {
      st.notifications.push({
        id: Store.uid("n"),
        userId: inv.id,
        text: bText,
        type: "zakat",
        targetView: "inv-zakat",
        targetSeason: bSeason,
        at: new Date().toISOString()
      });
    });

    Store.set({ notifications: st.notifications });
    showBroadcastZakatModal = false;

    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "broadcast_zakat",
        module: "zakat",
        severity: "info",
        title: `إرسال إشعار خدمة الزكاة: موسم ${bSeason}`,
        summary: `تم إرسال إشعار توعوي بخدمة إخراج الزكاة إلى ${targetInvs.length} مستثمر لموسم ${bSeason}`,
        details: { season: bSeason, target: bTarget, count: targetInvs.length, text: bText },
        targetType: "zakat",
        targetId: bSeason,
        user: session()?.name || "مدير رعاية العملاء",
        role: session()?.role || "customer_care"
      });
    }

    toast(`تم إرسال الإشعار بنجاح إلى ${targetInvs.length} مستثمر`);
    render(); return;
  }
  if (name === "zakat-open-new-season") {
    showNewSeasonModal = true;
    render(); return;
  }
  if (name === "zakat-close-new-season") {
    showNewSeasonModal = false;
    render(); return;
  }
  if (name === "zakat-confirm-new-season") {
    const inputVal = ($("#znew_season_input")?.value || "").trim();
    const newSeason = inputVal || String(new Date().getFullYear() + 1);
    const existingSeasons = getZakatSeasons(st);
    if (existingSeasons.includes(newSeason)) {
      zakatSeason = newSeason;
      showNewSeasonModal = false;
      toast(`الموسم ${newSeason} موجود بالفعل وتم الانتقال إليه`);
      render(); return;
    }

    st.zakat = st.zakat || [];
    const allInvs = st.users.filter(u => u.role === "investor");
    let addedCount = 0;
    allInvs.forEach(inv => {
      const already = st.zakat.find(z => z.investorId === inv.id && String(z.season || "2026") === String(newSeason));
      if (!already) {
        st.zakat.push({
          id: Store.uid("z"),
          investorId: inv.id,
          season: newSeason,
          amount: 24750,
          dueKg: 250,
          cropId: "palm",
          choice: "in_kind",
          charityId: st.charities[0]?.id,
          status: "pending",
          pledgeStatus: "pending",
          journeyStage: "calculation",
          cancelRequested: false
        });
        addedCount++;
      }
    });

    zakatSeason = newSeason;
    showNewSeasonModal = false;
    Store.set({ zakat: st.zakat });

    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "create_zakat_season",
        module: "zakat",
        severity: "info",
        title: `بدء موسم زكاة جديد: ${newSeason}`,
        summary: `تم بدء دورة موسم زكاة جديد لعام [${newSeason}] وتجهيز سجلات ${addedCount} مستثمر`,
        details: { season: newSeason, investorsCount: addedCount },
        targetType: "zakat",
        targetId: newSeason,
        user: session()?.name || "مدير رعاية العملاء",
        role: session()?.role || "customer_care"
      });
    }

    toast(`تم بدء دورة موسم زكاة ${newSeason} وتجهيز سجلات المستثمرين بنجاح`);
    render(); return;
  }
  if (name === "zakat-adm-tab") {
    zakatAdminTab = id || "kpi";
    render(); return;
  }
  if (name === "zakat-inv-filter") {
    zakatInvSearch = $("#zinv-q")?.value || "";
    zakatInvPlot = $("#zinv-plot")?.value || "all";
    zakatInvStatus = $("#zinv-status")?.value || "all";
    zakatInvCharity = $("#zinv-charity")?.value || "all";
    zakatInvSize = +($("#zinv-size")?.value || 5);
    zakatInvPage = 1;
    render(); return;
  }
  if (name === "zakat-inv-reset") {
    zakatInvSearch = "";
    zakatInvPlot = "all";
    zakatInvStatus = "all";
    zakatInvCharity = "all";
    zakatInvPage = 1;
    render(); return;
  }
  if (name === "zakat-inv-page") {
    zakatInvPage = Math.max(1, +id || 1);
    render(); return;
  }
  if (name === "zakat-toggle-inv-sel") {
    if (zakatSelectedInvIds.has(id)) {
      zakatSelectedInvIds.delete(id);
    } else {
      zakatSelectedInvIds.add(id);
    }
    render(); return;
  }
  if (name === "zakat-toggle-all-inv") {
    const allInvs = st.users.filter(u => u.role === "investor");
    const curSeason = zakatSeason || "2026";
    const filtered = allInvs.filter(inv => {
      const zak = st.zakat.find(z => z.investorId === inv.id && String(z.season || "2026") === String(curSeason));
      const invPlots = inv.plots || [];
      if (zakatInvSearch) {
        const q = zakatInvSearch.trim().toLowerCase();
        if (!inv.name?.toLowerCase().includes(q) && !inv.phone?.includes(q) && !invPlots.some(p => p.toLowerCase().includes(q))) return false;
      }
      if (zakatInvPlot !== "all" && !invPlots.includes(zakatInvPlot)) return false;
      if (zakatInvStatus === "signed" && zak?.pledgeStatus !== "signed") return false;
      if (zakatInvStatus === "pending" && zak?.pledgeStatus !== "pending") return false;
      if (zakatInvStatus === "delivered" && !zak?.batchId) return false;
      if (zakatInvCharity !== "all") {
        const chId = zak?.charityId || "";
        if (zakatInvCharity === "none" && chId) return false;
        if (zakatInvCharity !== "none" && chId !== zakatInvCharity) return false;
      }
      return true;
    });
    const startIdx = (zakatInvPage - 1) * zakatInvSize;
    const paged = filtered.slice(startIdx, startIdx + zakatInvSize);
    const allSelected = paged.every(inv => zakatSelectedInvIds.has(inv.id));
    paged.forEach(inv => {
      if (allSelected) zakatSelectedInvIds.delete(inv.id);
      else zakatSelectedInvIds.add(inv.id);
    });
    render(); return;
  }
  if (name === "zakat-batch-from-selected" || name === "zakat-open-batch-modal") {
    showBatchModal = true;
    render();
    setTimeout(updateZakatBatchInvestorsFilter, 30);
    return;
  }
  if (name === "zakat-close-batch-modal") {
    showBatchModal = false;
    render(); return;
  }
  if (name === "zb-select-all") {
    $$(".zb-inv-row").forEach(row => {
      if (row.style.display !== "none") {
        const chk = row.querySelector(".zb-inv-check");
        if (chk) chk.checked = true;
      }
    });
    return;
  }
  if (name === "zb-deselect-all") {
    $$(".zb-inv-check").forEach(chk => { chk.checked = false; });
    return;
  }
  if (name === "zakat-save-batch") {
    const batchSeason = $("#zb-season")?.value || zakatSeason || "2026";
    const charityId = $("#zb-charity")?.value || st.charities[0]?.id;
    const receiptNo = $("#zb-receipt")?.value?.trim() || `REC-${Date.now().toString().slice(-4)}`;
    const cropId = $("#zb-crop")?.value || "palm";
    const variety = $("#zb-variety")?.value?.trim() || "خلاص فاخر";
    const date = $("#zb-date")?.value || new Date().toISOString().slice(0, 10);
    const notes = $("#zb-notes")?.value?.trim() || "";

    const checkedBoxes = $$(".zb-inv-check:checked");
    const batchInvestors = [];
    let totalKg = 0;
    let totalAmount = 0;

    checkedBoxes.forEach(cb => {
      const invId = cb.value;
      const invUser = userBy(invId);
      const invZ = st.zakat.find(z => z.investorId === invId && String(z.season || "2026") === String(batchSeason));
      const kg = +(cb.dataset.kg || invZ?.dueKg || 120);
      const amount = +(cb.dataset.amt || invZ?.amount || (kg * 99));
      totalKg += kg;
      totalAmount += amount;
      batchInvestors.push({
        investorId: invId,
        name: invUser?.name || "مستثمر",
        phone: invUser?.phone || "—",
        kg,
        amount
      });
    });

    if (!batchInvestors.length) {
      toast("يرجى اختيار مستثمر واحد على الأقل للشحنة المجمعة");
      return;
    }

    const newBatchId = Store.uid("zb");
    const batchNo = `BATCH-ZKT-${new Date().getFullYear()}-${String((st.zakatBatches||[]).length + 1).padStart(2, "0")}`;

    const me = session();
    const canApprove = hasPerm("zakat_approve") || hasPerm("a", "zakat") || me?.role === "admin";
    const batchStatus = canApprove ? "delivered" : "draft";
    const journeyStage = canApprove ? "delivered" : "in_progress";

    const newBatch = {
      id: newBatchId,
      batchNo,
      season: batchSeason,
      type: "in_kind",
      cropId,
      variety,
      charityId,
      totalKg,
      totalAmount,
      date,
      receiptNo,
      status: batchStatus,
      notes: notes || `شحنة مجمعة مسلمة للجمعية لصالح ${batchInvestors.length} مستثمرين`,
      investors: batchInvestors
    };

    st.zakatBatches = st.zakatBatches || [];
    st.zakatBatches.unshift(newBatch);

    batchInvestors.forEach(bi => {
      let z = st.zakat.find(x => x.investorId === bi.investorId && String(x.season || "2026") === String(batchSeason));
      if (!z) {
        z = {
          id: Store.uid("z"),
          investorId: bi.investorId,
          season: batchSeason,
          cropId,
          dueKg: bi.kg,
          amount: bi.amount,
          choice: "in_kind",
          charityId,
          status: "confirmed",
          pledgeStatus: "signed",
          pledgeSignedAt: new Date().toISOString(),
          journeyStage: journeyStage,
          batchId: newBatchId,
          receiptNo,
          cancelRequested: false
        };
        st.zakat.push(z);
      } else {
        z.choice = "in_kind";
        z.charityId = charityId;
        z.batchId = newBatchId;
        z.status = "confirmed";
        z.journeyStage = journeyStage;
        z.receiptNo = receiptNo;
        if (z.pledgeStatus !== "signed") {
          z.pledgeStatus = "signed";
          z.pledgeSignedAt = new Date().toISOString();
        }
      }

      st.notifications.push({
        id: Store.uid("n"),
        userId: bi.investorId,
        text: canApprove
          ? `تم تسليم زكاة محصولك لموسم ${batchSeason}م بنجاح للجمعية (${st.charities.find(c=>c.id===charityId)?.name}) بموجب إيصال رقم ${receiptNo}`
          : `تم تسجيل شحنة زكاة مجمعة لمحصولك لموسم ${batchSeason}م قيد المراجعة والاعتماد`,
        type: "zakat",
        targetView: "inv-zakat",
        targetSeason: batchSeason,
        at: new Date().toISOString()
      });
    });

    zakatSelectedInvIds.clear();
    showBatchModal = false;
    Store.set({ zakatBatches: st.zakatBatches, zakat: st.zakat, notifications: st.notifications });

    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "create_zakat_batch",
        module: "zakat",
        severity: "info",
        title: `إنشاء شحنة زكاة مجمعة: ${batchNo}`,
        summary: `تم إنشاء إرسالية زكاة مجمعة رقم [${batchNo}] بإجمالي ${totalKg} كجم لـ ${batchInvestors.length} مستثمرين بإيصال [${receiptNo}]`,
        details: newBatch,
        targetType: "zakatBatch",
        targetId: newBatchId,
        user: session()?.name || "مدير رعاية العملاء",
        role: session()?.role || "customer_care"
      });
    }

    toast(canApprove ? "تم إنشاء واعتماد الشحنة المجمعة بنجاح" : "تم إنشاء الشحنة المجمعة كمسودة بانتظار الاعتماد");
    render(); return;
  }
  if (name === "zakat-print-receipt") {
    printZakatBatchReceipt(id, st);
    return;
  }
  if (name === "zakat-toggle-approve-batch") {
    const me = session();
    if (!hasPerm("zakat_approve") && !hasPerm("a", "zakat") && me?.role !== "admin") {
      return toast("ليس لديك صلاحية لاعتماد تسليم وصرف الزكاة");
    }
    const b = (st.zakatBatches || []).find(x => x.id === id);
    if (!b) return;
    const isApproved = b.status === "delivered" || b.status === "approved";
    b.status = isApproved ? "draft" : "delivered";

    (st.zakat || []).forEach(z => {
      if (z.batchId === id) {
        z.journeyStage = b.status === "delivered" ? "delivered" : "in_progress";
      }
    });

    Store.set({ zakatBatches: st.zakatBatches, zakat: st.zakat });
    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: isApproved ? "unapprove_zakat_batch" : "approve_zakat_batch",
        module: "zakat",
        severity: "warning",
        title: `${isApproved ? "إلغاء اعتماد" : "اعتماد"} شحنة زكاة: ${b.batchNo}`,
        summary: `تم ${isApproved ? "إلغاء اعتماد وتحويل لمسودة" : "اعتماد تسليم وصرف"} شحنة الزكاة المجمعة [${b.batchNo}] بواسطة ${me?.name}`,
        details: { batchId: b.id, batchNo: b.batchNo, status: b.status, totalKg: b.totalKg },
        targetType: "zakat_batch",
        targetId: b.id,
        user: me?.name || "مستخدم",
        role: me?.role || "admin"
      });
    }
    toast(isApproved ? "تم تحويل الشحنة إلى مسودة قيد المراجعة" : "تم اعتماد تسليم وصرف الشحنة رسمياً ✅");
    render();
    return;
  }
  if (name === "zakat-delete-batch") {
    const me = session();
    if (!hasPerm("zakat_delete") && !hasPerm("d", "zakat") && me?.role !== "admin") {
      return toast("ليس لديك صلاحية لإلغاء أو تعديل شحنات الزكاة");
    }
    const b = (st.zakatBatches || []).find(x => x.id === id);
    if (!b) return;
    if (!confirm(`هل أنت متأكد من رغبتك في إلغاء وحذف الشحنة المجمعة [${b.batchNo}]؟\n\nسيتم فك ارتباط المستثمرين المشاركين بها مع الحفاظ على سجلات استحقاقهم للتمكن من إعادة توزيعها.`)) {
      return;
    }

    st.zakatBatches = (st.zakatBatches || []).filter(x => x.id !== id);
    (st.zakat || []).forEach(z => {
      if (z.batchId === id) {
        z.batchId = null;
        z.receiptNo = null;
        if (z.journeyStage === "delivered") z.journeyStage = "signed";
      }
    });

    Store.set({ zakatBatches: st.zakatBatches, zakat: st.zakat });
    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "delete_zakat_batch",
        module: "zakat",
        severity: "warning",
        title: `حذف شحنة زكاة: ${b.batchNo}`,
        summary: `تم حذف الشحنة المجمعة [${b.batchNo}] وفك ارتباط المستثمرين بواسطة ${me?.name}`,
        details: { batchId: b.id, batchNo: b.batchNo, totalKg: b.totalKg },
        targetType: "zakat_batch",
        targetId: b.id,
        user: me?.name || "مستخدم",
        role: me?.role || "admin"
      });
    }
    toast("تم إلغاء الشحنة المجمعة وفك الارتباط بنجاح");
    render();
    return;
  }
  if (name === "zakat-reset-pledge") {
    const me = session();
    if (!hasPerm("zakat_delete") && !hasPerm("d", "zakat") && me?.role !== "admin") {
      return toast("ليس لديك صلاحية لإلغاء أو تعديل استحقاق الزكاة");
    }
    const z = (st.zakat || []).find(x => x.investorId === id && String(x.season) === String(zakatSeason || "2026"));
    const inv = (st.users || []).find(u => u.id === id);
    const invName = inv?.name || id;
    if (!confirm(`هل تريد بالتأكيد إلغاء تفويض التعهد الزكوي للمستثمر [${invName}] وإعادة ضبط حالته؟`)) {
      return;
    }
    if (z) {
      z.pledgeStatus = "pending";
      z.pledgeSignedAt = null;
      z.batchId = null;
      z.receiptNo = null;
      z.journeyStage = "calculation";
      Store.set({ zakat: st.zakat });
      if (typeof AuditLog !== "undefined") {
        AuditLog.log({
          action: "reset_zakat_pledge",
          module: "zakat",
          severity: "info",
          title: `إلغاء تفويض زكاة: ${invName}`,
          summary: `تم إلغاء تفويض التعهد الزكوي للمستثمر [${invName}] لموسم ${zakatSeason || "2026"} بواسطة ${me?.name}`,
          details: { investorId: id, season: zakatSeason || "2026" },
          targetType: "zakat_pledge",
          targetId: id,
          user: me?.name || "مستخدم",
          role: me?.role || "admin"
        });
      }
      toast("تم إلغاء التفويض وإعادة ضبط حالة استحقاق الزكاة");
      render();
    }
    return;
  }
  if (name === "zakat-open-charity-modal") {
    showCharityModal = true;
    editCharityId = null;
    render(); return;
  }
  if (name === "zakat-edit-charity") {
    showCharityModal = true;
    editCharityId = id;
    render(); return;
  }
  if (name === "zakat-close-charity-modal") {
    showCharityModal = false;
    editCharityId = null;
    render(); return;
  }
  if (name === "zakat-save-charity") {
    const chName = $("#ch-name")?.value?.trim();
    if (!chName) return toast("اسم الجمعية مطلوب");
    const licenseNo = $("#ch-license")?.value?.trim() || "1042 / 2018";
    const contactPerson = $("#ch-person")?.value?.trim() || "";
    const phone = $("#ch-phone")?.value?.trim() || "";
    const email = $("#ch-email")?.value?.trim() || "";
    const bankName = $("#ch-bank")?.value?.trim() || "مصرف معتمد";
    const iban = $("#ch-iban")?.value?.trim() || "";
    const receive = $("#ch-receive")?.value || "both";
    const cats = ($("#ch-cats")?.value || "").split("،").map(s => s.trim()).filter(Boolean);
    const notes = $("#ch-notes")?.value?.trim() || "";

    if (editCharityId) {
      const ch = st.charities.find(c => c.id === editCharityId);
      if (ch) {
        ch.name = chName;
        ch.licenseNo = licenseNo;
        ch.contactPerson = contactPerson;
        ch.phone = phone;
        ch.email = email;
        ch.bankName = bankName;
        ch.iban = iban;
        ch.receive = receive;
        if (cats.length) ch.categories = cats;
        ch.notes = notes;
      }
      toast("تم تحديث بيانات الجمعية");
    } else {
      const newCh = {
        id: Store.uid("c"),
        name: chName,
        licenseNo,
        contactPerson: contactPerson || "مسؤول التبرعات",
        phone: phone || "—",
        email: email || "—",
        bankName,
        iban,
        receive,
        categories: cats.length ? cats : ["أسر متعففة", "أيتام"],
        verified: true,
        hidden: false,
        notes: notes || "جهة معتمدة رسمياً"
      };
      st.charities.push(newCh);
      toast("تمت إضافة الجمعية المعتمدة بنجاح");
    }

    showCharityModal = false;
    editCharityId = null;
    Store.set({ charities: st.charities });
    render(); return;
  }
  if (name === "zakat-toggle-charity") {
    const ch = st.charities.find(c => c.id === id);
    if (ch) {
      ch.hidden = !ch.hidden;
      Store.set({ charities: st.charities });
      toast(ch.hidden ? "تم تعطيل الجهة مؤقتاً" : "تم تفعيل الجهة واعتمادها");
      render();
    }
    return;
  }
  if (name === "zakat-save-policy") {
    const title = $("#zpol-title")?.value?.trim();
    const version = $("#zpol-version")?.value?.trim();
    const terms = $("#zpol-terms")?.value?.trim();

    st.settings.zakatPolicy = {
      title: title || st.settings.zakatPolicy?.title || "سياسة وتعهد تفويض زكاة الزروع",
      version: version || st.settings.zakatPolicy?.version || "2.1",
      updatedAt: new Date().toISOString().slice(0, 10),
      terms: terms || st.settings.zakatPolicy?.terms || ""
    };
    Store.set({ settings: st.settings });
    toast("تم حفظ سياسة وتعهد الزكاة بنجاح");
    render(); return;
  }
  if (name === "zakat-print-empty-pledge") {
    showPrintPledgeModal = true;
    printPledgeInvestorId = id || (session()?.role === "investor" ? session()?.id : null);
    render(); return;
  }
  if (name === "zakat-close-print-pledge") {
    showPrintPledgeModal = false;
    render(); return;
  }
  if (name === "inv-set-charity") {
    const invId = session()?.id;
    const curSeason = zakatSeason || "2026";
    const chId = el?.value || id || $("#inv-charity-pref")?.value;
    let z = st.zakat.find(x => x.investorId === invId && String(x.season || "2026") === String(curSeason));
    if (!z) {
      z = {
        id: Store.uid("z"),
        investorId: invId,
        season: curSeason,
        amount: 24750,
        dueKg: 250,
        cropId: "palm",
        choice: "in_kind",
        charityId: chId
      };
      st.zakat.push(z);
    } else {
      z.charityId = chId;
    }
    Store.set({ zakat: st.zakat });
    toast("تم حفظ اختيار الجمعية المفضلة بنجاح");
    render(); return;
  }
  if (name === "zakat-investor-sign-pledge") {
    const invId = session()?.id;
    const curSeason = zakatSeason || "2026";
    const selCh = $("#inv-charity-pref")?.value;
    let z = st.zakat.find(x => x.investorId === invId && String(x.season || "2026") === String(curSeason));
    if (!z) {
      z = {
        id: Store.uid("z"),
        investorId: invId,
        season: curSeason,
        amount: 24750,
        dueKg: 250,
        cropId: "palm",
        choice: "in_kind",
        charityId: selCh || st.charities[0]?.id
      };
      st.zakat.push(z);
    } else if (selCh) {
      z.charityId = selCh;
    }
    z.pledgeStatus = "signed";
    z.pledgeSignedAt = new Date().toISOString();
    z.pledgeDocType = "digital";
    z.status = "confirmed";
    if (z.journeyStage === "calculation" || !z.journeyStage) z.journeyStage = "authorization";

    // Notify Customer Care and Admin
    const invName = session()?.name || "المستثمر";
    const careAndAdmins = st.users.filter(u => u.role === "customer_care" || u.role === "admin");
    st.notifications = st.notifications || [];
    careAndAdmins.forEach(mgr => {
      st.notifications.push({
        id: Store.uid("n"),
        userId: mgr.id,
        text: `✍️ قام المستثمر [${invName}] بتوقيع وتفويض إخراج زكاة موسم ${curSeason}م إلكترونياً.`,
        type: "zakat",
        targetView: "zakat-admin",
        targetSeason: curSeason,
        at: new Date().toISOString()
      });
    });

    Store.set({ zakat: st.zakat, notifications: st.notifications });
    toast("تم توقيع وتفويض نموذج التعهد إلكترونياً بنجاح");
    render(); return;
  }
  if (name === "zakat-upload-signed-pledge") {
    const invId = session()?.id;
    const curSeason = zakatSeason || "2026";
    let z = st.zakat.find(x => x.investorId === invId && String(x.season || "2026") === String(curSeason));
    if (!z) {
      z = {
        id: Store.uid("z"),
        investorId: invId,
        season: curSeason,
        amount: 24750,
        dueKg: 250,
        cropId: "palm",
        choice: "in_kind",
        charityId: st.charities[0]?.id
      };
      st.zakat.push(z);
    }
    z.pledgeStatus = "signed";
    z.pledgeSignedAt = new Date().toISOString();
    z.pledgeDocType = "upload";
    z.status = "confirmed";
    if (z.journeyStage === "calculation" || !z.journeyStage) z.journeyStage = "authorization";

    // Notify Customer Care and Admin
    const invName = session()?.name || "المستثمر";
    const careAndAdmins = st.users.filter(u => u.role === "customer_care" || u.role === "admin");
    st.notifications = st.notifications || [];
    careAndAdmins.forEach(mgr => {
      st.notifications.push({
        id: Store.uid("n"),
        userId: mgr.id,
        text: `📤 قام المستثمر [${invName}] برفع وثيقة تفويض زكاة موسم ${curSeason}م الموقعة يدوياً.`,
        type: "zakat",
        targetView: "zakat-admin",
        targetSeason: curSeason,
        at: new Date().toISOString()
      });
    });

    Store.set({ zakat: st.zakat, notifications: st.notifications });
    toast("تم استلام النموذج الموقع وحفظ التفويض بنجاح");
    render(); return;
  }
  if (name === "zakat-preview-signed") {
    showSignedDocModal = true;
    signedDocModalData = id || session()?.id;
    render(); return;
  }
  if (name === "zakat-close-signed") {
    showSignedDocModal = false;
    signedDocModalData = null;
    render(); return;
  }
  if (name === "zakat-view-cert") {
    const targetInvId = id || session()?.id;
    const curSeason = zakatSeason || "2026";
    const zak = st.zakat.find(z => z.investorId === targetInvId && String(z.season || "2026") === String(curSeason));
    const pSt = zak?.pledgeStatus || "pending";
    const batch = st.zakatBatches?.find(b => String(b.season || "2026") === String(curSeason) && (b.id === zak?.batchId || (b.investors && b.investors.some(i => i.investorId === targetInvId))));

    if (pSt !== "signed") {
      toast("لا يمكن إصدار أو استعراض الشهادة: لم يقم المستثمر بتوقيع تفويض إخراج الزكاة بعد", "warn");
      return;
    }
    if (!batch) {
      toast("لا يمكن إصدار الشهادة: تم التوقيع وبانتظار قيام الشركة بإخراج الزكاة وتسليمها رسمياً للجمعية", "warn");
      return;
    }

    showCertModal = true;
    certInvestorId = targetInvId;
    render(); return;
  }
  if (name === "zakat-close-cert") {
    showCertModal = false;
    certInvestorId = null;
    render(); return;
  }
  if (name === "zakat-print-pledge" || name === "zakat-print-cert-btn" || name === "zakat-print-receipt") {
    window.print();
    return;
  }
  if (name === "zakat-tab") {
    zakatCropTab = id || "all";
    render(); return;
  }
  if (name === "zakat-crop-change") {
    zakatFormCrop = id || $("#zcrop")?.value || "palm";
    render(); return;
  }
  if (name === "send-zakat") {
    const charityId = $("#torg").value, amount = +($("#tamt")?.value||0), date = $("#tdate").value, sender = $("#tsender").value;
    const kind = $("#tkind")?.value || "cash";
    const kg = +($("#tkg")?.value||0);
    const cropId = $("#zcrop")?.value || zakatFormCrop || "palm";
    if (kind!=="cash" && !kg && !amount) return toast("أدخل الوزن أو المبلغ");
    st.zakatTransfers.push({ id: Store.uid("t"), cropId, charityId, amount, kg, kind, variety: $("#tvar")?.value, date, sender });
    st.zakat.forEach(z => { if (z.charityId === charityId && z.status !== "received") z.status = "sent"; });
    Store.set({ zakatTransfers: st.zakatTransfers, zakat: st.zakat });
    toast("سُجّل التسليم وتحدّث الرصيد"); render(); return;
  }
  if (name === "confirm-zakat") {
    let z = st.zakat.find(x => x.investorId === session().id);
    if (!z) { z = { id: Store.uid("z"), investorId: session().id, season: "2025", amount: 24750 }; st.zakat.push(z); }
    z.choice = $("#zch").value; z.charityId = $("#zorg").value; z.status = "confirmed"; z.cancelRequested = false;
    Store.set({ zakat: st.zakat }); toast("تم التفويض"); render(); return;
  }
  if (name === "cancel-zakat") {
    const curSeason = zakatSeason || "2026";
    const z = st.zakat.find(x => x.investorId === session().id && String(x.season || "2026") === String(curSeason));
    if (!z || z.status === "sent" || z.status === "received") return toast("لا يمكن الإلغاء بعد الإرسال");
    if (z.cancelRequested) return toast("الطلب قيد المراجعة");
    if (!confirm("تأكيد إرسال طلب إلغاء التفويض للإدارة؟")) return;
    const reason = prompt("سبب الإلغاء (اختياري)") || "";
    z.cancelRequested = true; z.cancelReason = reason; z.cancelAt = new Date().toISOString();
    const careAndAdmins = st.users.filter(u => u.role === "customer_care" || u.role === "admin");
    careAndAdmins.forEach(mgr => {
      st.notifications.push({
        id: Store.uid("n"),
        userId: mgr.id,
        text: `طلب إلغاء تفويض زكاة من ${session().name} لموسم ${z.season||curSeason}م`,
        type: "zakat",
        targetView: "zakat-admin",
        targetSeason: z.season || curSeason,
        at: z.cancelAt
      });
    });
    Store.set({ zakat: st.zakat, notifications: st.notifications }); toast("أُرسل طلب الإلغاء للإدارة"); render(); return;
  }
  if (name === "accept-cancel") {
    const z = st.zakat.find(x => x.id === id);
    if (!z) return;
    z.status = "cancelled"; z.cancelRequested = false; z.rejectReason = "";
    const inv = userBy(z.investorId);
    st.notifications.push({ id: Store.uid("n"), userId: z.investorId, text: "قبلت الإدارة إلغاء تفويض الزكاة — يمكنك اختيار جهة جديدة", at: new Date().toISOString() });
    Store.set({ zakat: st.zakat, notifications: st.notifications }); toast("اعتُمد إلغاء التفويض"); render(); return;
  }
  if (name === "reject-cancel") {
    const z = st.zakat.find(x => x.id === id);
    if (!z) return;
    const reason = prompt("سبب الرفض (اختياري)") || "رُفض طلب الإلغاء";
    z.cancelRequested = false; z.rejectReason = reason;
    st.notifications.push({ id: Store.uid("n"), userId: z.investorId, text: "رُفض طلب إلغاء الزكاة: " + reason, at: new Date().toISOString() });
    Store.set({ zakat: st.zakat, notifications: st.notifications }); toast("رُفض طلب الإلغاء"); render(); return;
  }
  if (name === "inv-filter") {
    invPalmQ = $("#invq")?.value || ""; invVarF = $("#invvar")?.value || ""; invSecF = $("#invsec")?.value || "";
    render(); return;
  }
  if (name === "apply-rep") {
    const rawKind = $("#rkind")?.value || reportKind;
    const me = session();
    if (!isReportPermitted(me, rawKind)) {
      toast("عفواً، ليس لديك صلاحية لعرض هذا التقرير 🔒");
      reportKind = getDefaultReportForUser(me);
    } else {
      reportKind = rawKind;
    }
    reportCrop = $("#rcrop")?.value || "all";
    reportFrom = $("#rfrom")?.value || "";
    reportTo = $("#rto")?.value || "";
    reportSec = $("#rsec")?.value || "";
    reportPlot = $("#rplot")?.value || "";
    reportInvestor = $("#rinv")?.value || "";
    reportSt = $("#rst")?.value || "";
    reportUser = $("#rf_user")?.value || "";
    reportFert = $("#rf_fert")?.value || "";
    reportAction = $("#rf_action")?.value || "";
    reportFertKind = $("#rf_fert_kind")?.value || "";
    reportStockStatus = $("#rf_stock_st")?.value || "";
    reportOpType = $("#rf_op_type")?.value || "";
    reportNsStage = $("#rf_ns_stage")?.value || "all";
    reportNsSource = $("#rf_ns_source")?.value || "all";
    reportYieldQuality = $("#rf_yield_quality")?.value || "all";
    reportVariety = $("#rf_variety")?.value || "";
    reportTreeSt = $("#rf_tree_st")?.value || "all";
    reportPage = 1;
    render();
    return;
  }
  if (name === "trigger-export-selected-plot") {
    const selPlot = $("#export_plot_select")?.value || $("#roundtrip-plot-select")?.value;
    if (!selPlot) return toast("يرجى اختيار القطعة المراد تصدير نخيلها", "warn");
    exportPlotPalmsRoundTrip(selPlot);
    return;
  }
  if (name === "export-plot-roundtrip") {
    const targetPlot = id || el?.getAttribute("data-id") || el?.dataset?.id;
    exportPlotPalmsRoundTrip(targetPlot);
    return;
  }
  if (name === "clear-plot-gps") {
    const targetPlot = id || el?.getAttribute("data-id") || el?.dataset?.id;
    clearPlotGps(targetPlot);
    return;
  }
  if (name === "dl-tpl") {
    if (!hasPerm("palms_import")) return toast("ليس لديك صلاحية تحميل نموذج استيراد الأشجار");
    const csv = "\uFEFFالكود,المحصول,المصدر,الصنف,القطعة,التسلسل,تاريخ_الزراعة,مصدر_التفصيلي,المورد,ملاحظات,الموقع,الحالة,كود_الفسيلة_الأصلية,تاريخ_القلع,عمر_المشتل\n03-12A-F047-0325,نخيل,F,خلاص,03-12A,047,2025-03-01,internal,مشتل المزرعة,زراعة بينية - نخيل خلاص,,سليمة,03-12A-F045-0325-OS01-0824,2024-08-01,7\n03-12A-C001-0325,زيتون,C,بيكوال,03-12A,001,2025-03-01,purchased,مشتل وادي النطرون,زراعة بينية لنخيل وزيتون في نفس القطعة,,سليمة,,,6\n";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "نموذج_استيراد_الأشجار_والمحاصيل.csv"; a.click(); return;
  }
  if (name === "do-import") {
    if (!hasPerm("palms_import")) return toast("ليس لديك صلاحية استيراد بيانات الأشجار");
    const f = $("#csv")?.files?.[0]; if (!f) return toast("اختر ملفاً");
    const importMode = document.querySelector('input[name="import_mode"]:checked')?.value || "upsert";
    const reader = new FileReader();
    reader.onload = () => {
      const lines = reader.result.split(/\r?\n/).filter(Boolean);
      const mapHead = {
        "الكود": "code", "المحصول": "cropId", "crop": "cropId", "المصدر": "source",
        "الصنف": "variety", "القطعة": "plot", "التسلسل": "seq",
        "تاريخ_الزراعة": "plantDate", "مصدر_التفصيلي": "originType",
        "المورد": "supplier", "ملاحظات": "notes", "الموقع": "gps",
        "الحالة": "status", "كود_الفسيلة_الأصلية": "parentCode",
        "تاريخ_القلع": "offshootDate", "عمر_المشتل": "nurseryAgeMonths"
      };
      const headers = lines[0].replace(/^\uFEFF/, "").split(",").map(h => mapHead[h.trim()] || h.trim());
      const hasGpsHeader = headers.includes("gps");

      // Smart CSV row parser that respects quoted fields (handles commas inside GPS coordinates)
      function parseCSVRow(line) {
        const result = [];
        let cur = '', inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') { inQuotes = !inQuotes; }
          else if (ch === ',' && !inQuotes) { result.push(cur.trim()); cur = ''; }
          else { cur += ch; }
        }
        result.push(cur.trim());
        return result;
      }

      // Pre-validation pass: Parse rows and check for spatial boundary errors
      const parsedRows = [];
      const spatialErrors = [];

      for (let lineIdx = 1; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx];
        const cols = parseCSVRow(line);
        const rec = {};
        headers.forEach((h, i) => rec[h] = (cols[i] || "").trim());
        if (!rec.plot && !rec.code) continue;

        let cId = (rec.cropId || "").trim();
        if (cId.includes("زيتون") || cId.toLowerCase() === "olive") cId = "olive";
        else if (cId.includes("نخيل") || cId.toLowerCase() === "palm") cId = "palm";
        else if (!cId) {
          const isOliveVar = (st.cropVarieties || []).some(cv => cv.cropId === "olive" && cv.name === rec.variety);
          const isOliveSrc = ["C", "S", "T"].includes((rec.source || "").toUpperCase());
          cId = (isOliveVar || isOliveSrc) ? "olive" : "palm";
        }

        const rawPlot = rec.plot || (rec.code ? rec.code.split("-").slice(0, 2).join("-") : "BSH01-01A");
        const plotId = normalizePlotCode(rawPlot);
        let existingPlot = st.plots.find(p => normalizePlotCode(p.id) === plotId || p.id === plotId);

        // Parse GPS coordinates
        let gps_lat = null, gps_lng = null;
        const gpsRaw = (rec.gps || '').trim();
        if (gpsRaw && gpsRaw !== '-' && gpsRaw.toLowerCase() !== 'null') {
          const gpsParts = gpsRaw.split(',').map(s => s.trim());
          if (gpsParts.length >= 2 && !isNaN(Number(gpsParts[0])) && !isNaN(Number(gpsParts[1]))) {
            gps_lat = Number(gpsParts[0]);
            gps_lng = Number(gpsParts[1]);
          }
        }

        const normCode = normalizePalmCode(rec.code) || (buildCode ? buildCode({ ...rec, plot: plotId }) : rec.code);

        // Spatial Boundary Validation: If coordinates are provided and target plot has polygon boundaries
        if (gps_lat !== null && gps_lng !== null) {
          const point = [gps_lat, gps_lng];
          if (existingPlot && existingPlot.boundaryCoordinates && Array.isArray(existingPlot.boundaryCoordinates) && existingPlot.boundaryCoordinates.length >= 3) {
            const isInside = isPointInPolygon(point, existingPlot.boundaryCoordinates);
            if (!isInside) {
              // Find which plot actually contains these coordinates
              let containingPlot = null;
              for (const otherPlot of st.plots) {
                if (otherPlot.id !== existingPlot.id && otherPlot.boundaryCoordinates && Array.isArray(otherPlot.boundaryCoordinates) && otherPlot.boundaryCoordinates.length >= 3) {
                  if (isPointInPolygon(point, otherPlot.boundaryCoordinates)) {
                    containingPlot = otherPlot;
                    break;
                  }
                }
              }
              const errRowNo = lineIdx + 1;
              if (containingPlot) {
                spatialErrors.push(`السطر ${errRowNo}: النخلة (${normCode}) إحداثياتها تقع جغرافياً داخل حدود القطعة (${containingPlot.name || containingPlot.id}) وليست القطعة المحددة (${existingPlot.name || existingPlot.id})`);
              } else {
                spatialErrors.push(`السطر ${errRowNo}: النخلة (${normCode}) إحداثياتها تقع جغرافياً خارج حدود القطعة المحددة (${existingPlot.name || existingPlot.id})`);
              }
            }
          }
        }

        parsedRows.push({ rec, cId, plotId, rawPlot, existingPlot, gps_lat, gps_lng, gpsRaw, normCode, lineIdx: lineIdx + 1 });
      }

      // If spatial boundary errors detected, block import and display detailed warning to prevent data corruption
      if (spatialErrors.length > 0) {
        const errorListHtml = spatialErrors.slice(0, 10).map(e => `<li>${e}</li>`).join("");
        const moreCount = spatialErrors.length > 10 ? `<div style="margin-top:6px;font-weight:bold">... و ${spatialErrors.length - 10} أخطاء أخرى مماثلة.</div>` : "";
        if ($("#impPrev")) {
          $("#impPrev").innerHTML = `
            <div style="background:#FEF2F2;border:1.5px solid #EF4444;border-radius:10px;padding:14px;color:#991B1B">
              <div style="font-size:14.5px;font-weight:800;margin-bottom:8px">❌ تعذر الاستيراد: تم اكتشاف تعارض في الحدود الجغرافية للإحداثيات (${spatialErrors.length} نخلة)!</div>
              <p style="font-size:12.5px;margin-bottom:8px">حفاظاً على دقة الخريطة ومنع تداخل طبقات النخيل، يرفض النظام رفع إحداثيات تقع خارج مضلع القطعة أو داخل قطعة أخرى:</p>
              <ul style="font-size:12px;margin:0 0 0 16px;padding:0;line-height:1.7">${errorListHtml}</ul>
              ${moreCount}
              <div style="margin-top:10px;font-size:12px;color:#7F1D1D;font-weight:700">💡 الحل: يرجى تصحيح إحداثيات القطعة في ملف الإكسل أو تصدير قالب القطعة النظيف والتعديل عليه ثم إعادة المحاولة.</div>
            </div>
          `;
        }
        toast(`❌ رُفض الاستيراد: ${spatialErrors.length} نخلة تقع خارج حدود قطعها`, "warn");
        return;
      }

      // If Wipe & Replace mode is selected: clear existing palms of the targeted plots first
      if (importMode === "wipe") {
        const targetPlots = new Set(parsedRows.map(r => r.plotId));
        st.palms = st.palms.filter(p => !targetPlots.has(normalizePlotCode(p.plot)) && !targetPlots.has(p.plot));
      }

      let ok = 0, fail = 0;
      const cropStats = {};

      parsedRows.forEach(({ rec, cId, plotId, rawPlot, gps_lat, gps_lng, gpsRaw, normCode }) => {
        let existingPlot = st.plots.find(p => normalizePlotCode(p.id) === plotId || p.id === plotId);
        if (!existingPlot) {
          const parts = plotId.split("-");
          const sec = normalizeSectorCode(parts[0] || "BSH01");
          const match = (parts[1] || "01A").match(/^(\d+)([A-Za-z]?)$/);
          const pno = match ? match[1].padStart(2, "0") : "01";
          const part = match ? (match[2] || "A").toUpperCase() : "A";
          if (!st.sectors.find(s => normalizeSectorCode(s.id) === sec)) {
            st.sectors.push({ id: sec, name: `قطاع ${sec}` });
          }
          existingPlot = { id: plotId, sector: sec, plotNo: pno, part, name: `قطعة ${pno}${part}` };
          st.plots.push(existingPlot);
        }

        const item = {
          id: Store.uid("p"), cropId: cId, code: normCode,
          source: rec.source || (cId === "olive" ? "C" : "F"),
          variety: rec.variety || "غير محدد", plot: plotId,
          seq: (rec.seq || "001").padStart(3, "0"),
          plantDate: rec.plantDate || new Date().toISOString().slice(0, 10),
          originType: rec.originType || "internal",
          supplier: rec.supplier || "", notes: rec.notes || "",
          gps: gpsRaw, gps_lat, gps_lng,
          status: rec.status || "سليمة",
          parentId: null, parentCode: rec.parentCode || "",
          offshootDate: rec.offshootDate || "",
          nurseryAgeMonths: rec.nurseryAgeMonths ? +rec.nurseryAgeMonths : null,
          tempCode: rec.parentCode || null, offshootCount: 0, locked: false
        };

        if (item.parentCode) {
          const mom = st.palms.find(x => normalizePalmCode(x.code) === normalizePalmCode(item.parentCode) || x.code === item.parentCode) || st.offshoots.find(o => o.tempCode === item.parentCode);
          if (mom) item.parentId = mom.motherId || mom.id;
        }

        const i = st.palms.findIndex(p => normalizePalmCode(p.code) === normCode || p.code === normCode);
        if (i >= 0) {
          // Explicit NULL handling: if gps column is present in file and value is empty, update DB to null!
          const isGpsCleared = hasGpsHeader && (!gpsRaw || gpsRaw === '-' || gpsRaw.toLowerCase() === 'null');
          st.palms[i] = {
            ...st.palms[i],
            ...item,
            id: st.palms[i].id,
            code: normCode,
            plot: plotId,
            gps_lat: isGpsCleared ? null : (gps_lat !== null ? gps_lat : (hasGpsHeader ? null : st.palms[i].gps_lat)),
            gps_lng: isGpsCleared ? null : (gps_lng !== null ? gps_lng : (hasGpsHeader ? null : st.palms[i].gps_lng)),
            gps: isGpsCleared ? "" : (gpsRaw || (hasGpsHeader ? "" : st.palms[i].gps))
          };
        } else {
          st.palms.push(item);
        }
        cropStats[cId] = (cropStats[cId] || 0) + 1;
        ok++;
      });

      Store.set({ sectors: st.sectors, plots: st.plots, palms: st.palms });
      const statsStr = Object.entries(cropStats).map(([cid, count]) => `${cropName(cid)}: ${count}`).join(" • ");
      if ($("#impPrev")) {
        const modeBadge = importMode === "wipe" ? '<span style="background:#FEE2E2;color:#991B1B;padding:2px 8px;border-radius:6px;font-size:11.5px;margin-right:8px">استبدال كامل (Wipe & Replace)</span>' : '<span style="background:#E0F2FE;color:#0369A1;padding:2px 8px;border-radius:6px;font-size:11.5px;margin-right:8px">تحديث تراكمي ذكي (Smart Upsert)</span>';
        $("#impPrev").innerHTML = `<div style="color:var(--green);font-weight:bold">✓ نجح استيراد ${ok} سجل (${statsStr}) ${modeBadge}</div>${fail ? `<div style="color:#C62828">فشل: ${fail}</div>` : ""}`;
      }
      toast(`تم استيراد ${ok} سجل بنجاح (${importMode === "wipe" ? "استبدال كامل" : "تحديث ذكي"})`);
      if (typeof Api !== "undefined") {
        Api.syncAllToDatabase();
      }
    };
    reader.readAsText(f);
    return;
  }
  return ACT_NEXT;
}
