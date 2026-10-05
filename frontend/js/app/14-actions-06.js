// PalmTrace app — UI action handlers, part 6 of 9 (starts at: name === "aud-exec-revert")
// (split from the former single app.js; files are classic scripts loaded in order by index.html)

async function actionsPart06(name, id, el, st) {
  if (name === "aud-exec-revert") {
    const s = session();
    if (!s || s.role !== "admin") return toast("هذا الإجراء مخصص لمدير النظام فقط");
    const reason = $("#aud_revert_reason")?.value?.trim();
    if (!reason) return toast("يرجى كتابة سبب التراجع (إلزامي للرقابة والتدقيق)");

    if (typeof AuditLog !== "undefined" && typeof AuditLog.revert === "function") {
      const res = AuditLog.revert(id, reason, s);
      if (res && res.success) {
        showAuditRevertModal = false;
        revertTargetRecordId = null;
        if (activeAuditDetailId === id) activeAuditDetailId = null;
        toast("تم تسجيل القيد العكسي والتراجع بنجاح ✓");
        render();
        return;
      } else {
        return toast(res?.error || "فشل تنفيذ القيد العكسي");
      }
    } else {
      return toast("محرك التدقيق والرقابة غير متوفر");
    }
  }
  if (name === "bulk-print") {
    $$(".pchk").forEach(c => c.checked ? selectedPalmIds.add(c.value) : selectedPalmIds.delete(c.value));
    const ids = [...selectedPalmIds];
    if (!ids.length) return toast("حدد نخيلاً أولاً");
    const rows = ids.map(id => st.palms.find(p=>p.id===id)).filter(Boolean);
    printPalmsBarcode(rows, `طباعة باركود (${rows.length} أصل محدد)`);
    return;
  }
  if (name === "print-current-scope") {
    let currentGroupPlots = [];
    if (browsePlotGroup && browseSec) {
      currentGroupPlots = st.plots.filter(p => p.sector === browseSec && plotBaseNumber(p) === browsePlotGroup);
    } else if (browsePlot) {
      const pl = st.plots.find(x => x.id === browsePlot);
      if (pl) {
        currentGroupPlots = st.plots.filter(p => p.sector === pl.sector && plotBaseNumber(p) === plotBaseNumber(pl));
      }
    }
    const targetTrees = st.palms.filter(p => {
      if (browsePlot) {
        if (p.plot !== browsePlot) return false;
      } else if (browsePlotGroup && currentGroupPlots.length) {
        if (!currentGroupPlots.some(pl => pl.id === p.plot)) return false;
      } else if (browseSec) {
        if (plotSectorOf(p.plot) !== browseSec) return false;
      }
      if (browseCrop && (p.cropId || "palm") !== browseCrop) return false;
      if (palmQ) {
        const q = palmQ.toUpperCase();
        const hit = p.code.toUpperCase().includes(q) || (p.variety||"").includes(palmQ) || (p.status||"").includes(palmQ) || cropName(p.cropId).includes(palmQ);
        if (!hit) return false;
      }
      return true;
    });
    if (!targetTrees.length) return toast("لا توجد أصول في النطاق المعروض حالياً");
    const scopeDesc = browsePlot ? `القطعة ${browsePlot}` : (browsePlotGroup ? `القطعة ${browsePlotGroup}` : (browseSec ? sectorName(browseSec) : "كافة القطاعات"));
    printPalmsBarcode(targetTrees, `باركود ${scopeDesc} (${targetTrees.length} أصل)`);
    return;
  }
  if (name === "print-sec-palms") {
    const sec = id || browseSec;
    let targetTrees = st.palms.filter(p => !p.archived && plotSectorOf(p.plot) === sec);
    if (browseCrop) targetTrees = targetTrees.filter(p => (p.cropId || "palm") === browseCrop);
    if (!targetTrees.length) return toast("لا توجد أصول في هذا القطاع");
    printPalmsBarcode(targetTrees, `باركود قطاع ${sectorName(sec)} - ${targetTrees.length} أصل`);
    return;
  }
  if (name === "print-group-palms") {
    const sec = el?.dataset?.sec || browseSec;
    const baseNo = id || el?.dataset?.id;
    const subPlots = st.plots.filter(p => p.sector === sec && plotBaseNumber(p) === baseNo);
    let targetTrees = st.palms.filter(p => !p.archived && subPlots.some(pl => pl.id === p.plot));
    if (browseCrop) targetTrees = targetTrees.filter(p => (p.cropId || "palm") === browseCrop);
    if (!targetTrees.length) return toast("لا توجد أصول في هذه القطعة");
    printPalmsBarcode(targetTrees, `باركود القطعة ${baseNo} (${sectorName(sec)}) - ${targetTrees.length} أصل`);
    return;
  }
  if (name === "open-print-scope-modal") {
    showPrintScopeModal = true;
    if (browseSec) printScopeSec = browseSec;
    if (browsePlot) printScopePlot = browsePlot;
    else if (browsePlotGroup) printScopePlot = `base:${browsePlotGroup}`;
    if (browseCrop) printScopeCrop = browseCrop;
    render();
    return;
  }
  if (name === "close-print-scope-modal") {
    showPrintScopeModal = false;
    render();
    return;
  }
  if (name === "open-edit-sector") {
    editingSectorId = id;
    deletingSectorId = null;
    render();
    return;
  }
  if (name === "prompt-delete-sector") {
    deletingSectorId = id;
    editingSectorId = null;
    render();
    return;
  }
  if (name === "close-sector-modal") {
    editingSectorId = null;
    deletingSectorId = null;
    render();
    return;
  }
  if (name === "save-edit-sector") {
    const secId = id || editingSectorId;
    const newName = ($("#edit_sec_name")?.value || "").trim();
    const newNotes = ($("#edit_sec_notes")?.value || "").trim();
    const newTotalArea = parseFloat($("#edit_sec_total_area")?.value) || null;
    if (!newName) return toast("⚠️ يرجى إدخال اسم القطاع");

    const sec = (st.sectors || []).find(s => s.id === secId);
    if (sec) {
      sec.name = newName;
      sec.notes = newNotes;
      sec.total_area = newTotalArea;
      sec.totalArea = newTotalArea;
      Store.set({ sectors: st.sectors });
      if (typeof Api !== "undefined") {
        Api.updateSector(secId, { name: newName, notes: newNotes, total_area: newTotalArea });
      }
      toast("✓ تم تعديل بيانات القطاع بنجاح");
    }
    editingSectorId = null;
    render();
    return;
  }
  if (name === "confirm-delete-sector") {
    const secId = id || deletingSectorId;
    const normSecId = normalizeSectorCode(secId);
    const secPlots = (st.plots || []).filter(p => p.sector === secId || normalizeSectorCode(p.sector) === normSecId);
    const plotIdSet = new Set(secPlots.map(p => p.id));
    const secPalms = (st.palms || []).filter(p => !p.archived && (plotIdSet.has(p.plot) || p.sector === secId || normalizeSectorCode(p.sector) === normSecId));

    // Check if any operations or yields exist
    const palmIdSet = new Set(secPalms.map(p => p.id));
    const operationsCount = (st.operations || []).filter(o => palmIdSet.has(o.palmId)).length;
    const yieldsCount = (st.yields || []).filter(y => y.sector_id === secId || y.sector === secId || palmIdSet.has(y.palm_id || y.palmId)).length;

    if (operationsCount > 0 || yieldsCount > 0) {
      toast(`⚠️ لا يمكن حذف القطاع لوجود ${operationsCount} عملية زراعية مسجلة. يمكنك أرشفته بدلاً من ذلك.`);
      deletingSectorId = null;
      render();
      return;
    }

    // Safe Cascade Deletion: remove palms, plots, sector
    st.palms = (st.palms || []).filter(p => !plotIdSet.has(p.plot) && p.sector !== secId && normalizeSectorCode(p.sector) !== normSecId);
    st.plots = (st.plots || []).filter(p => p.sector !== secId && normalizeSectorCode(p.sector) !== normSecId);
    st.sectors = (st.sectors || []).filter(s => s.id !== secId && normalizeSectorCode(s.id) !== normSecId);
    Store.set({ sectors: st.sectors, plots: st.plots, palms: st.palms });

    if (typeof Api !== "undefined") {
      Api.deleteSector(secId);
    }
    deletingSectorId = null;
    toast(`✓ تم حذف القطاع (${secId}) وكافة أصوله (${secPalms.length}) وقطعه (${secPlots.length}) بنجاح`);
    render();
    return;
  }
  if (name === "confirm-archive-sector") {
    const secId = id || deletingSectorId;
    const sec = (st.sectors || []).find(s => s.id === secId);
    if (sec) {
      sec.is_deleted = 1;
      sec.isDeleted = true;
      sec.archived = true;
    }
    const secPlots = (st.plots || []).filter(p => p.sector === secId);
    const plotIdSet = new Set(secPlots.map(p => p.id));
    (st.palms || []).forEach(p => {
      if (plotIdSet.has(p.plot)) p.archived = true;
    });
    Store.set({ sectors: st.sectors, palms: st.palms });
    if (typeof Api !== "undefined") {
      Api.archiveSector(secId);
    }
    deletingSectorId = null;
    toast(`✓ تمت أرشفة القطاع (${sec?.name || secId}) وإخفاؤه من العمليات اليومية بنجاح`);
    render();
    return;
  }
  if (name === "exec-scope-print") {
    let targetTrees = (st.palms || []).filter(p => !p.archived);
    if (printScopeSec && printScopeSec !== "all") {
      targetTrees = (_ps => targetTrees.filter(p => _ps.get(p.plot) === printScopeSec))(new Map(st.plots.map(x => [x.id, x.sector])));
    }
    if (printScopePlot && printScopePlot !== "all") {
      if (printScopePlot.startsWith("base:")) {
        const baseNum = printScopePlot.replace("base:", "");
        targetTrees = targetTrees.filter(p => {
          const pl = st.plots.find(x => x.id === p.plot);
          return pl && plotBaseId(pl) === baseNum;
        });
      } else {
        targetTrees = targetTrees.filter(p => p.plot === printScopePlot);
      }
    }
    if (printScopeCrop && printScopeCrop !== "all") {
      targetTrees = targetTrees.filter(p => (p.cropId || "palm") === printScopeCrop);
    }
    if (!targetTrees.length) return toast("لا توجد أصول مطابقة للنطاق المختار");
    showPrintScopeModal = false;
    render();
    printPalmsBarcode(targetTrees, `طباعة باركود (${targetTrees.length} أصل)`);
    return;
  }
  if (name === "exec-scope-csv") {
    let targetTrees = (st.palms || []).filter(p => !p.archived);
    if (printScopeSec && printScopeSec !== "all") {
      targetTrees = (_ps => targetTrees.filter(p => _ps.get(p.plot) === printScopeSec))(new Map(st.plots.map(x => [x.id, x.sector])));
    }
    if (printScopePlot && printScopePlot !== "all") {
      if (printScopePlot.startsWith("base:")) {
        const baseNum = printScopePlot.replace("base:", "");
        targetTrees = targetTrees.filter(p => {
          const pl = st.plots.find(x => x.id === p.plot);
          return pl && plotBaseId(pl) === baseNum;
        });
      } else {
        targetTrees = targetTrees.filter(p => p.plot === printScopePlot);
      }
    }
    if (printScopeCrop && printScopeCrop !== "all") {
      targetTrees = targetTrees.filter(p => (p.cropId || "palm") === printScopeCrop);
    }
    if (!targetTrees.length) return toast("لا توجد أصول مطابقة للنطاق المختار");
    const headers = ["الكود", "المحصول", "المصدر", "الصنف", "القطعة", "التسلسل", "تاريخ_الزراعة", "الحالة"];
    const lines = [headers.join(",")];
    targetTrees.forEach(p => {
      const cropObj = (st.crops || []).find(c => c.id === (p.cropId || "palm"));
      const clean = (val) => String(val || "").replace(/[\r\n,]/g, " ").trim();
      lines.push([
        clean(p.code),
        clean(cropObj ? cropObj.name : (p.cropId === "olive" ? "زيتون" : "نخيل")),
        clean(p.source || "F"),
        clean(p.variety),
        clean(p.plot),
        clean(p.seq || ""),
        clean(p.plantDate || ""),
        clean(p.status || "")
      ].join(","));
    });
    const bom = "\uFEFF";
    const blob = new Blob([bom + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `palms_scope_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast(`تم تصدير ${targetTrees.length} أصل بنجاح`);
    return;
  }
  if (name === "export-plot-palms") {
    let targetTrees = st.palms.filter(p => !p.archived && (!browseSec || plotSectorOf(p.plot) === browseSec));
    if (browsePlotGroup) {
      targetTrees = targetTrees.filter(p => {
        const pl = st.plots.find(x => x.id === p.plot);
        return pl && plotBaseNumber(pl) === browsePlotGroup;
      });
    }
    if (browsePlot) {
      targetTrees = targetTrees.filter(p => p.plot === browsePlot);
    }
    if (browseCrop) {
      targetTrees = targetTrees.filter(p => (p.cropId || "palm") === browseCrop);
    }
    if (palmQ) {
      targetTrees = targetTrees.filter(p => codesEqual(p.code, palmQ) || p.code.toUpperCase().includes(palmQ.toUpperCase()) || (p.variety||"").includes(palmQ) || (p.status||"").includes(palmQ));
    }
    if (!targetTrees.length) return toast("لا توجد أشجار في النطاق المحدد للتصدير");

    const headers = [
      "الكود", "المحصول", "المصدر", "الصنف", "القطعة", "التسلسل",
      "تاريخ_الزراعة", "مصدر_التفصيلي", "المورد", "ملاحظات", "الموقع",
      "الحالة", "كود_الفسيلة_الأصلية", "تاريخ_القلع", "عمر_المشتل"
    ];

    const lines = [headers.join(",")];
    targetTrees.forEach(p => {
      const cropObj = (st.crops || []).find(c => c.id === (p.cropId || "palm"));
      const cropNameStr = cropObj ? cropObj.name : (p.cropId === "olive" ? "زيتون" : "نخيل");
      const clean = (val) => String(val || "").replace(/[\r\n,]/g, " ").trim();

      const row = [
        clean(p.code),
        clean(cropNameStr),
        clean(p.source || "F"),
        clean(p.variety),
        clean(p.plot),
        clean(p.seq || ""),
        clean(p.plantDate || ""),
        clean(p.originType || "internal"),
        clean(p.supplier || ""),
        clean(p.notes || ""),
        clean(p.gps || ""),
        clean(p.status || "سليمة"),
        clean(p.parentCode || p.tempCode || ""),
        clean(p.offshootDate || ""),
        clean(p.nurseryAgeMonths || "")
      ];
      lines.push(row.join(","));
    });

    const csvContent = "\uFEFF" + lines.join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csvContent], { type: "text/csv;charset=utf-8" }));
    const plotLabel = browsePlot ? `_قطعة_${browsePlot}` : (browsePlotGroup ? `_مجموعة_${browsePlotGroup}` : (browseSec ? `_قطاع_${browseSec}` : ""));
    a.download = `بيانات_أشجار_الحقل${plotLabel}.csv`;
    a.click();
    toast(`تم تصدير ${targetTrees.length} شجرة بنجاح بنموذج الاستيراد`);
    return;
  }
  if (name === "bulk-op") {
    if (!hasPerm("ops_bulk")) return toast("ليس لديك صلاحية تنفيذ عمليات جماعية");
    $$(".pchk").forEach(c => c.checked ? selectedPalmIds.add(c.value) : selectedPalmIds.delete(c.value));
    if (!selectedPalmIds.size) return toast("حدد نخيلاً أولاً أو افتح شاشة العملية الجماعية");
    bulkMode = "picks";
    go("bulk-op"); return;
  }
  if (name === "bmode") { bulkMode = id; render(); return; }
  if (name === "bsec-change") {
    bulkSec = id !== undefined ? id : ($("#bsec")?.value || "");
    render(); return;
  }
  if (name === "bplot-sec-change") {
    bulkPlotSec = id !== undefined ? id : ($("#bplot_sec")?.value || "");
    render(); return;
  }
  if (name === "bplot-search-clear") {
    bulkPlotSearch = "";
    render(); return;
  }
  if (name === "bphoto-change") {
    const f = $("#bphoto")?.files?.[0];
    if (f) {
      compressImage(f).then(src => {
        bulkPhotoData = src;
        render();
      });
    }
    return;
  }
  if (name === "bphoto-remove") {
    bulkPhotoData = null;
    const fInp = $("#bphoto");
    if (fInp) fInp.value = "";
    render(); return;
  }
  if (name === "bplot-add") {
    const v = $("#bplotadd")?.value;
    if (v) { bulkPlots.add(v); toast("تمت إضافة القطعة"); }
    else toast("اختر قطعة أولاً");
    render(); return;
  }
  if (name === "bplot-add-all") {
    const plots = scopedFieldPlots();
    const matchingPlots = plots.filter(p => {
      if (bulkPlotSec && p.sector !== bulkPlotSec) return false;
      if (bulkPlotSearch) {
        const q = bulkPlotSearch.trim().toLowerCase();
        const full = ((p.name||"") + " " + (p.id||"")).toLowerCase();
        if (!full.includes(q)) return false;
      }
      return true;
    });
    if (!matchingPlots.length) return toast("لا توجد قطع مطابقة لإضافتها");
    matchingPlots.forEach(p => bulkPlots.add(p.id));
    toast(`تمت إضافة كافة القطع المطابقة (${matchingPlots.length} قطعة)`);
    render(); return;
  }
  if (name === "bplot-drop") { bulkPlots.delete(id); render(); return; }
  if (name === "bplot-clear") { bulkPlots.clear(); toast("تم مسح القطع المختارة"); render(); return; }
  if (name === "start-bulk-on-plot") {
    const targetPlotId = id || browsePlot;
    if (!targetPlotId) return toast("لم يتم تحديد قطعة");
    bulkMode = "plot";
    bulkPlots.clear();
    if (typeof currentGroupPlots !== "undefined" && currentGroupPlots && currentGroupPlots.length > 0 && !browsePlot) {
      currentGroupPlots.forEach(p => bulkPlots.add(p.id));
    } else {
      bulkPlots.add(targetPlotId);
    }
    go("bulk-op");
    toast(`تم فتح العملية الجماعية للقطعة ${plotName(targetPlotId)}`);
    return;
  }
  if (name === "select-all-plot-palms") {
    const curPalms = st.palms.filter(p => {
      if (browsePlot) return p.plot === browsePlot;
      if (browsePlotGroup) return (p.plot || "").includes(browsePlotGroup);
      return false;
    });
    if (!curPalms.length) return toast("لا توجد أشجار في هذه القطعة");
    curPalms.forEach(p => selectedPalmIds.add(p.id));
    toast(`تم تحديد كافة أشجار القطعة (${curPalms.length} شجرة)`);
    render(); return;
  }
  if (name === "bplot-toggle") {
    if (bulkPlots.has(id)) bulkPlots.delete(id);
    else bulkPlots.add(id);
    render(); return;
  }
  if (name === "bplot-add-sec-all") {
    const plots = scopedFieldPlots();
    const curSec = bulkPlotSec || (plots[0] ? plots[0].sector : "");
    const secPlots = plots.filter(p => p.sector === curSec);
    secPlots.forEach(p => bulkPlots.add(p.id));
    toast(`تمت إضافة كافة قطع القطاع (${secPlots.length} قطعة)`);
    render(); return;
  }
  if (name === "bulk-pick-sec-change") {
    bulkPickSec = $("#bpick_sec")?.value || "";
    bulkPickPlot = "";
    render(); return;
  }
  if (name === "bulk-pick-plot-change") {
    bulkPickPlot = $("#bpick_plot")?.value || "";
    render(); return;
  }
  if (name === "bulk-pick-all-in-plot") {
    if (!bulkPickPlot) return toast("اختر قطعة أولاً");
    const pPalms = activePalmsInPlotFamily(bulkPickPlot);
    pPalms.forEach(p => selectedPalmIds.add(String(p.id)));
    toast(`تم تحديد كافة أشجار القطعة (${pPalms.length} أصل)`);
    render(); return;
  }
  if (name === "bulk-unpick-all-in-plot") {
    if (!bulkPickPlot) return;
    const pPalms = activePalmsInPlotFamily(bulkPickPlot);
    const dropIds = new Set(pPalms.map(p => String(p.id)));
    for (const cur of [...selectedPalmIds]) {
      if (dropIds.has(String(cur))) selectedPalmIds.delete(cur);
    }
    toast("تم إلغاء تحديد أشجار هذه القطعة");
    render(); return;
  }
  if (name === "bulk-pick-range") {
    const fromNum = parseInt($("#b_rng_from")?.value, 10);
    const toNum = parseInt($("#b_rng_to")?.value, 10);
    if (isNaN(fromNum) || isNaN(toNum) || fromNum > toNum) {
      return toast("يرجى إدخال نطاق صحيح (من رقم إلى رقم)");
    }
    const pPalms = activePalmsInPlotFamily(bulkPickPlot);
    let added = 0;
    pPalms.forEach(p => {
      // tree number inside the plot (seq), e.g. F045 in BSH01-01A-F045-0926 — not the trailing month/year
      const seqMatch = String(p.seq || "").match(/(\d+)/) || (p.code || "").match(/-[A-Z]+(\d+)-\d{4}$/);
      if (seqMatch) {
        const num = parseInt(seqMatch[1], 10);
        if (num >= fromNum && num <= toNum) {
          selectedPalmIds.add(String(p.id));
          added++;
        }
      }
    });
    toast(`تم تحديد ${added} شجرة ضمن النطاق المطلوب`);
    render(); return;
  }
  if (name === "bulk-toggle-palm") {
    const idStr = String(id);
    let found = false;
    for (const cur of [...selectedPalmIds]) {
      if (String(cur) === idStr) {
        selectedPalmIds.delete(cur);
        found = true;
      }
    }
    if (!found) selectedPalmIds.add(idStr);
    render(); return;
  }
  if (name === "bulk-clear-picks") { selectedPalmIds.clear(); render(); return; }
  if (name === "bulk-drop") {
    const idStr = String(id);
    for (const cur of [...selectedPalmIds]) {
      if (String(cur) === idStr) selectedPalmIds.delete(cur);
    }
    selectedPalmIds.delete(id);
    render(); return;
  }
  if (name === "bulk-add-code") {
    const q = ($("#baddcode")?.value || "").trim();
    if (!q) return toast("أدخل كود الشجرة أو عدة أكواد");
    const parts = q.split(/[\s,،;\n\r]+/).filter(Boolean);
    let added = 0;
    for (const item of parts) {
      const p = st.palms.find(x => codesEqual(x.code, item) || normCode(x.code).includes(normCode(item)));
      if (p) {
        selectedPalmIds.add(String(p.id));
        added++;
      }
    }
    if (added === 0) return toast("لم يتم العثور على أشجار مطابقة للأكواد المدخلة");
    bulkMode = "picks";
    toast(`تمت إضافة ${added} شجرة بنجاح`);
    render(); return;
  }
  if (name === "bulk-crop-change") {
    bulkCrop = id || "all";
    render(); return;
  }
  if (name === "bulk-preview") {
    const targets = bulkTargetPalms();
    const n = targets.length;
    const pCnt = targets.filter(p => (p.cropId||"palm") === "palm").length;
    const oCnt = targets.filter(p => p.cropId === "olive").length;
    const breakdown = (pCnt && oCnt) ? ` (${pCnt} نخيل • ${oCnt} زيتون)` : '';
    if ($("#bsum")) $("#bsum").innerHTML = `سيُطبَّق <b>${typeName($("#btype")?.value)}</b> على <b>${n}</b> شجرة / أصل${breakdown}`;
    toast(n ? `${n} شجرة / أصل ضمن النطاق المستهدف` : "لا أشجار مطابقة في هذا النطاق"); return;
  }
  if (name === "bulk-apply") {
    if (!hasPerm("ops_bulk")) return toast("ليس لديك صلاحية تنفيذ عمليات جماعية");
    const targets = bulkTargetPalms();
    if (!targets.length) return toast("لا أشجار في النطاق المختار");
    const typeId = $("#btype")?.value;
    const label = typeName(typeId);
    const where = bulkMode === "sector" ? sectorName($("#bsec")?.value) : bulkMode === "plot" ? [...bulkPlots].map(plotName).join(" + ") : "تحديد يدوي";
    const pCnt = targets.filter(p => (p.cropId||"palm") === "palm").length;
    const oCnt = targets.filter(p => p.cropId === "olive").length;
    const desc = (pCnt && oCnt) ? `${targets.length} شجرة (${pCnt} نخيل • ${oCnt} زيتون)` : `${targets.length} شجرة / أصل`;
    if (!confirm(`تطبيق «${label}» على ${desc} في ${where}؟`)) return;
    const needMat = opMaterialRule(typeId).show;
    const mat = needMat ? ($("#bmat")?.value || "") : "";
    const doseQty = parseFloat($("#bdose_qty")?.value || "0");
    const doseUnit = $("#bdose_unit")?.value || "كجم";
    const doseLegacy = ($("#bdose")?.value || "").trim();
    const dose = doseQty > 0 ? `${doseQty} ${doseUnit}` : doseLegacy;
    const note = ($("#bnotes")?.value || "").trim();
    const at = ($("#bdate")?.value ? new Date($("#bdate").value).toISOString() : new Date().toISOString());
    const finish = (photos) => {
      const batch = Store.uid("bk");
      const baseNote = `[جماعي ${where}] ${mat}${dose?" • "+dose+"/شجرة":""}${note?" • "+note:""}`.trim();

      if (bulkMode === "sector") {
        const secId = $("#bsec")?.value || bulkSec || (targets[0] ? st.plots.find(pl => pl.id === targets[0].plot)?.sector : null);
        st.operations.push({
          id: Store.uid("op"),
          palmId: null,
          typeId,
          at,
          photos,
          notes: baseNote,
          workerId: session().id,
          status: "pending",
          approval: "pending",
          device: "bulk:" + batch,
          supervisorNote: "",
          bulkId: batch,
          batchId: batch,
          targetLevel: "sector",
          sectorId: secId,
          plotId: null,
          treeCount: targets.length
        });
      } else if (bulkMode === "plot") {
        const plotsArr = bulkPlots.size ? [...bulkPlots] : (targets[0] ? [targets[0].plot] : []);
        plotsArr.forEach(pId => {
          const pl = st.plots.find(p => p.id === pId);
          const fam = new Set(plotFamilyIds(pId).map(String)); // main plot = itself + its sub-plots
          const pTargets = targets.filter(p => fam.has(String(p.plot)));
          const pWhere = plotsArr.length === 1 ? where : `قطعة ${plotName(pId)}`;
          const pNote = `[جماعي ${pWhere}] ${mat}${dose?" • "+dose+"/شجرة":""}${note?" • "+note:""}`.trim();
          st.operations.push({
            id: Store.uid("op"),
            palmId: null,
            typeId,
            at,
            photos,
            notes: pNote,
            workerId: session().id,
            status: "pending",
            approval: "pending",
            device: "bulk:" + batch,
            supervisorNote: "",
            bulkId: batch,
            batchId: batch,
            targetLevel: "plot",
            sectorId: pl?.sector || null,
            plotId: pId,
            treeCount: pTargets.length || targets.length,
            palmIds: pTargets.map(p => p.id)
          });
        });
      } else {
        // Individual trees selection (bulkMode === "picks")
        targets.forEach(p => {
          const pl = st.plots.find(x => x.id === p.plot);
          st.operations.push({
            id: Store.uid("op"),
            palmId: p.id,
            typeId,
            at,
            photos,
            notes: baseNote,
            workerId: session().id,
            status: "pending",
            approval: "pending",
            device: "bulk:" + batch,
            supervisorNote: "",
            bulkId: batch,
            batchId: batch,
            targetLevel: "tree",
            sectorId: pl?.sector || null,
            plotId: p.plot || null,
            treeCount: 1
          });
        });
      }

      // Deduct total bulk dose from fertilizer inventory:
      if (needMat && mat && doseQty > 0 && targets.length > 0) {
        const fert = (st.fertilizers || []).find(f => f.name === mat || f.id === mat);
        if (fert) {
          let totalQty = doseQty * targets.length;
          if (fert.unit === "كجم" && doseUnit === "جم") totalQty = totalQty / 1000;
          else if (fert.unit === "جم" && doseUnit === "كجم") totalQty = totalQty * 1000;

          if ((fert.allocated || 0) >= totalQty) {
            fert.allocated -= totalQty;
          } else {
            const rem = totalQty - (fert.allocated || 0);
            fert.allocated = 0;
            fert.stock = Math.max(0, (fert.stock || 0) - rem);
          }
          fert.consumed = (fert.consumed || 0) + totalQty;
          Store.set({ fertilizers: st.fertilizers });
        }
      }

      if (activeScheduleId) {
        const sch = (st.operationSchedules || []).find(s => s.id === activeScheduleId);
        if (sch) {
          sch.lastExecutedAt = at.slice(0, 10);
          sch.nextDueDate = addDaysToDate(at.slice(0, 10), sch.intervalDays || 7);
          Store.set({ operationSchedules: st.operationSchedules });
          toast(`تم إنجاز خطة [${sch.title}] بنجاح وترحيل الموعد القادم إلى ${sch.nextDueDate} ✅`);
        }
        activeScheduleId = null;
      }

      enqueue("عملية جماعية " + label, desc + " — " + where);
      Store.set({ operations: st.operations, queue: st.queue });

      if (typeof AuditLog !== "undefined") {
        AuditLog.log({
          action: "bulk_operation",
          module: "operations",
          severity: "info",
          title: `تنفيذ عملية جماعية: ${label}`,
          summary: `تم تطبيق «${label}» على ${targets.length} شجرة في ${where}`,
          details: {
            typeId,
            label,
            where,
            bulkMode,
            mat: mat || null,
            dose: dose || null,
            targetCount: targets.length,
            batchId: batch,
            breakdown: (pCnt && oCnt) ? { palm: pCnt, olive: oCnt } : null,
            sampleTargetCodes: targets.slice(0, 10).map(t => t.code)
          },
          targetCount: targets.length,
          targetType: "palm_group",
          targetId: batch,
          user: session()?.name || "مستخدم",
          role: session()?.role || "worker"
        });
      }

      toast(`سُجّلت على ${targets.length} شجرة واحتُسب استهلاك السماد`);
      bulkPhotoData = null;
      go("ops-admin");
    };
    if (bulkPhotoData) {
      finish([bulkPhotoData]);
    } else {
      const f = $("#bphoto")?.files?.[0];
      if (f) compressImage(f).then(src => finish([src]));
      else finish([]);
    }
    return;
  }
  if (name === "browse-home") { browseSec = null; browsePlotGroup = null; browsePlot = null; palmPage = 1; go("palms"); return; }
  if (name === "open-bsec") {
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
    browseSec = id; browsePlotGroup = null; browsePlot = null; palmPage = 1; go("palms"); return;
  }
  if (name === "open-bgroup") { browsePlotGroup = id; browsePlot = null; palmPage = 1; go("palms"); return; }
  if (name === "select-sub-plot") { browsePlot = id || null; palmPage = 1; go("palms"); return; }
  if (name === "open-bplot") {
    browsePlot = id;
    const pl = st.plots.find(x => x.id === id);
    if (pl) {
      browseSec = pl.sector;
      browsePlotGroup = plotBaseNumber(pl);
    }
    palmPage = 1; go("palms"); return;
  }
  if (name === "browse-all-plots") { browsePlot = null; browsePlotGroup = null; palmPage = 1; go("palms"); return; }
  if (name === "new-batch") { Store.set({ lastPrintBatch: [] }); go("generate"); return; }
  if (name === "palm-page") { palmPage = +id || 1; render(); return; }
  if (name === "open-type") { dashOpType = id; if (current==="dash") render(); else { current="ops-admin"; render(); } return; }
  if (name === "rkind") {
    const targetKind = id || $("#rkind")?.value;
    const me = session();
    if (!isReportPermitted(me, targetKind)) {
      toast("عفواً، لا تملك صلاحية لعرض هذا التقرير 🔒");
      reportKind = getDefaultReportForUser(me);
    } else {
      reportKind = targetKind;
    }
    reportPage = 1;
    render();
    return;
  }
  if (name === "rep-page") { reportPage = +id || 1; render(); return; }
  if (name === "export-fert-balances-csv") {
    const me = session();
    if (getEffectiveInventoryScope(me) === "personal") {
      return toast("عفواً، تصدير جرد المستودع العام غير مصرح به للعامل الميداني");
    }
    const fertilizers = st.fertilizers || [];
    const q = (fertQ || "").toLowerCase().trim();
    const list = fertilizers.filter(f => !q || (f.name && f.name.toLowerCase().includes(q)) || (f.kind && f.kind.toLowerCase().includes(q)));
    if (!list.length) return toast("لا توجد أصناف في المخزن للتصدير");

    const headers = [
      "كود_الصنف", "اسم_المركب", "المحصول", "التصنيف", "الوحدة",
      "رصيد_المستودع", "المنصرف_عهدة", "المستهلك_بالحقل", "الإجمالي_الكلي",
      "حد_الأمان", "تكلفة_الوحدة", "القيمة_الإجمالية", "حالة_الرصيد"
    ];
    const lines = ["\uFEFF" + headers.join(",")];
    let totStock = 0, totAlloc = 0, totCons = 0, totGrand = 0, totVal = 0;
    list.forEach(f => {
      const stock = Number(f.stock) || 0;
      const allocated = Number(f.allocated) || 0;
      const consumed = Number(f.consumed) || 0;
      const minAlert = Number(f.minAlert) || 0;
      const grandTotal = stock + allocated;
      const unitCost = Number(f.unitCost || f.cost) || 0;
      const itemVal = Math.round(stock * unitCost);
      const isLow = stock <= minAlert;
      const isEmpty = stock <= 0;
      const cropLabel = f.cropId === "olive" ? "زيتون" : (f.cropId === "palm" ? "نخيل" : "مشترك");
      const stText = isEmpty ? "نافد" : isLow ? "بحد الأمان" : "كافٍ وآمن";

      totStock += stock; totAlloc += allocated; totCons += consumed; totGrand += grandTotal; totVal += itemVal;
      lines.push([
        f.id,
        `"${(f.name||'').replace(/"/g, '""')}"`,
        cropLabel,
        f.kind || "سماد",
        f.unit || "كجم",
        stock,
        allocated,
        consumed,
        grandTotal,
        minAlert,
        unitCost,
        itemVal,
        stText
      ].join(","));
    });
    lines.push(`الإجمالي العام,,,,,${totStock},${totAlloc},${totCons},${totGrand},,,${totVal},`);

    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    a.download = `أرصدة_وجرد_المخزون_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast(`تم تصدير أرصدة ${list.length} صنف بنجاح بنموذج Excel/CSV`);
    return;
  }
  if (name === "print-fert-balances-pdf") {
    const me = session();
    if (getEffectiveInventoryScope(me) === "personal") {
      return toast("عفواً، طباعة جرد المستودع العام غير مصرح بها للعامل الميداني");
    }
    const co = company();
    const fertilizers = st.fertilizers || [];
    const q = (fertQ || "").toLowerCase().trim();
    const list = fertilizers.filter(f => !q || (f.name && f.name.toLowerCase().includes(q)) || (f.kind && f.kind.toLowerCase().includes(q)));
    if (!list.length) return toast("لا توجد أصناف في المخزن للطباعة");

    const totStock = list.reduce((a,f) => a + (Number(f.stock)||0), 0);
    const totAlloc = list.reduce((a,f) => a + (Number(f.allocated)||0), 0);
    const totCons = list.reduce((a,f) => a + (Number(f.consumed)||0), 0);
    const totGrand = totStock + totAlloc;
    const totVal = list.reduce((a,f) => a + (Number(f.stock)||0)*(Number(f.unitCost||f.cost)||0), 0);
    const lowCount = list.filter(f => (Number(f.stock)||0) <= (Number(f.minAlert)||0)).length;
    const curr = st.settings?.currency || "ج.م";

    const rowsHtml = list.map((f, i) => {
      const stock = Number(f.stock) || 0;
      const allocated = Number(f.allocated) || 0;
      const consumed = Number(f.consumed) || 0;
      const grandTotal = stock + allocated;
      const minAlert = Number(f.minAlert) || 0;
      const unitCost = Number(f.unitCost || f.cost) || 0;
      const val = Math.round(stock * unitCost);
      const isLow = stock <= minAlert;
      const cropBadge = f.cropId === "olive" ? "زيتون" : (f.cropId === "palm" ? "نخيل" : "مشترك");
      const stText = stock <= 0 ? "نافد" : isLow ? "بحد الأمان" : "كافٍ وآمن";
      const stColor = stock <= 0 ? "#DC2626" : isLow ? "#D97706" : "#16A34A";

      return `<tr>
        <td style="text-align:center">${i+1}</td>
        <td style="font-family:monospace;font-weight:bold">${f.id}</td>
        <td><b>${f.name}</b></td>
        <td>${cropBadge}</td>
        <td>${f.kind}</td>
        <td>${f.unit}</td>
        <td style="font-weight:bold;color:${isLow?'#DC2626':'#16A34A'}">${stock.toLocaleString()}</td>
        <td style="color:#D97706">${allocated.toLocaleString()}</td>
        <td style="color:#2563EB">${consumed.toLocaleString()}</td>
        <td style="font-weight:bold">${grandTotal.toLocaleString()}</td>
        <td style="color:#666">${minAlert.toLocaleString()}</td>
        <td>${unitCost ? unitCost.toLocaleString() + ' ' + curr : '—'}</td>
        <td>${val ? val.toLocaleString() + ' ' + curr : '—'}</td>
        <td style="font-weight:bold;color:${stColor}">${stText}</td>
      </tr>`;
    }).join("");

    const printHtml = `<!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <title>تقرير جرد وأرصدة المستودع - ${co.companyName || "منظومة النخيل"}</title>
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; margin: 0; padding: 12px; color: #1e293b; direction: rtl; font-size: 13px; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2d6a4f; padding-bottom: 12px; margin-bottom: 14px; }
        .brand { display: flex; align-items: center; gap: 14px; }
        .brand img { max-height: 55px; }
        .brand h2 { margin: 0; color: #1b4332; font-size: 20px; }
        .brand p { margin: 2px 0 0; color: #52796f; font-size: 12px; }
        .doc-meta { text-align: left; font-size: 11px; color: #64748b; }
        .kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 14px; }
        .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; text-align: center; }
        .kpi-val { font-size: 18px; font-weight: 800; }
        .kpi-lbl { font-size: 11px; color: #64748b; margin-top: 3px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
        th { background: #2d6a4f; color: #fff; padding: 7px 5px; text-align: right; font-weight: 600; border: 1px solid #2d6a4f; }
        td { border: 1px solid #cbd5e1; padding: 5px; text-align: right; }
        tr:nth-child(even) { background: #f8fafc; }
        tfoot tr { background: #e2e8f0; font-weight: bold; }
        .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 30px; text-align: center; page-break-inside: avoid; }
        .sig-box { border-top: 1px dashed #94a3b8; padding-top: 8px; font-size: 12px; }
        @media print { button { display: none; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="brand">
          ${co.logo ? `<img src="${co.logo}">` : `<div style="font-size:32px">🌴</div>`}
          <div>
            <h2>${co.companyName || "منظومة إدارة النخيل والمزارع"}</h2>
            <p>تقرير الجرد الفعلي وأرصدة مستودع الأسمدة والمبيدات والمغذيات</p>
          </div>
        </div>
        <div class="doc-meta">
          <div><b>تاريخ الجرد:</b> ${new Date().toLocaleDateString('ar-EG', { year:'numeric', month:'long', day:'numeric' })}</div>
          <div><b>المستخرج:</b> ${session()?.name || "إدارة المستودعات"} (${roleLabel(session()?.role)})</div>
          <div><b>الحالة:</b> جرد رسمي معتمد</div>
        </div>
      </div>

      <div class="kpis">
        <div class="kpi-card"><div class="kpi-val">${list.length}</div><div class="kpi-lbl">إجمالي الأصناف</div></div>
        <div class="kpi-card"><div class="kpi-val" style="color:#16A34A">${totStock.toLocaleString()}</div><div class="kpi-lbl">رصيد المستودع</div></div>
        <div class="kpi-card"><div class="kpi-val" style="color:#D97706">${totAlloc.toLocaleString()}</div><div class="kpi-lbl">المنصرف عهدة للموقع</div></div>
        <div class="kpi-card"><div class="kpi-val" style="color:#2563EB">${totCons.toLocaleString()}</div><div class="kpi-lbl">المستهلك بالحقل</div></div>
        <div class="kpi-card"><div class="kpi-val" style="color:#7C3AED">${Math.round(totVal).toLocaleString()} ${curr}</div><div class="kpi-lbl">القيمة التقديرية للمخزون</div></div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width:25px;text-align:center">#</th>
            <th>كود الصنف</th>
            <th>اسم المركب / السماد</th>
            <th>المحصول</th>
            <th>التصنيف</th>
            <th>الوحدة</th>
            <th>رصيد المستودع</th>
            <th>عهدة الموقع</th>
            <th>المستهلك بالحقل</th>
            <th>الإجمالي الكلي</th>
            <th>حد الأمان</th>
            <th>تكلفة الوحدة</th>
            <th>القيمة الإجمالية</th>
            <th>حالة الرصيد</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot>
          <tr>
            <td colspan="6" style="text-align:center">الإجمالي العام (${list.length} صنف)</td>
            <td style="color:#16A34A">${totStock.toLocaleString()}</td>
            <td style="color:#D97706">${totAlloc.toLocaleString()}</td>
            <td style="color:#2563EB">${totCons.toLocaleString()}</td>
            <td>${totGrand.toLocaleString()}</td>
            <td>—</td>
            <td>—</td>
            <td style="color:#7C3AED">${Math.round(totVal).toLocaleString()} ${curr}</td>
            <td>${lowCount > 0 ? `⚠️ ${lowCount} بحد الأمان` : '✅ متوفر'}</td>
          </tr>
        </tfoot>
      </table>

      <div class="signatures">
        <div class="sig-box">
          <b>أمين المستودع</b><br><br>
          التوقيع: ............................
        </div>
        <div class="sig-box">
          <b>المهندس الزراعي المسؤول</b><br><br>
          التوقيع: ............................
        </div>
        <div class="sig-box">
          <b>اعتماد الإدارة الزراعية والمالية</b><br><br>
          الختم والاعتماد: ............................
        </div>
      </div>
    </body>
    </html>`;

    const w = window.open("", "_blank");
    w.document.write(printHtml);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 250);
    return;
  }
  if (name === "export-rep") {
    const me = session();
    if (!isReportPermitted(me, reportKind)) {
      return toast("عفواً، لا تملك صلاحية لتصدير هذا التقرير 🔒");
    }
    const rows = reportRows();
    if (reportKind === "fert_balances") {
      const headers = ["#", "كود_الصنف", "اسم_المركب", "المحصول", "التصنيف", "الوحدة", "رصيد_المستودع", "عهدة_الموقع", "المستهلك_بالحقل", "الإجمالي_الكلي", "حد_الأمان", "تكلفة_الوحدة", "القيمة_الإجمالية", "حالة_الرصيد"];
      const lines = ["\uFEFF" + headers.join(",")];
      let totStock = 0, totAlloc = 0, totCons = 0, totGrand = 0, totVal = 0;
      rows.forEach((r, i) => {
        totStock += (r.stock || 0);
        totAlloc += (r.allocated || 0);
        totCons += (r.consumed || 0);
        totGrand += (r.grandTotal || 0);
        totVal += (r.value || 0);
        lines.push([
          i + 1,
          r.code,
          `"${(r.name||'').replace(/"/g, '""')}"`,
          r.crop,
          r.kind,
          r.unit,
          r.stock,
          r.allocated,
          r.consumed,
          r.grandTotal,
          r.minAlert,
          r.cost,
          r.value,
          r.st
        ].join(","));
      });
      lines.push(`الإجمالي العام,,,,,${totStock},${totAlloc},${totCons},${totGrand},,,${totVal},`);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
      a.download = "تقرير_أرصدة_وجرد_المخزون.csv";
      a.click();
      toast(`تم تصدير تقرير أرصدة وجرد المخزون (${rows.length} صنف)`);
      return;
    }
    if (reportKind === "fertilizers") {
      const headers = ["#", "رقم_الحركة", "التاريخ", "نوع_الحركة", "المركب_السماد", "الكمية", "الوحدة", "الموقع", "المستلم_المسؤول", "الحالة"];
      const lines = ["\uFEFF" + headers.join(",")];
      let totQty = 0;
      rows.forEach((r, i) => {
        totQty += (r.qty || 0);
        lines.push([
          i + 1,
          r.code,
          r.date,
          r.actionType || r.type,
          `"${(r.material||r.type||'').replace(/"/g, '""')}"`,
          r.qty || 0,
          r.unit || "",
          `"${(r.loc||'').replace(/"/g, '""')}"`,
          `"${(r.who||'').replace(/"/g, '""')}"`,
          `"${(r.st||'').replace(/"/g, '""')}"`
        ].join(","));
      });
      lines.push(`الإجمالي العام,,,,${totQty},,,,,`);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
      const userSuffix = reportUser ? `_${(userBy(reportUser)?.name||reportUser).replace(/\s+/g, '_')}` : "";
      a.download = `تقرير_حركة_الأسمدة_والمخزون${userSuffix}.csv`;
      a.click();
      toast(`تم تصدير تقرير حركة الأسمدة (${rows.length} حركة)`);
      return;
    }
    if (reportKind === "offshoot_rev") {
      const csv = ["\uFEFF#,كود_الفسيلة,الأصل_الأم,الموقع_القطعة,المستثمر,الصنف,الوزن,تاريخ_القلع,الحالة,السعر_التقديري,العملة"];
      rows.forEach((r, i) => csv.push(`${i+1},${r.code},${r.motherCode||""},${r.loc},${r.who},${r.type},${r.weight||""},${r.date},${r.st},${r.price||0},${r.currency||"ج.م"}`));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv.join("\n")], { type: "text/csv;charset=utf-8" }));
      a.download = "تقرير_إيرادات_الفسائل_المقلوعة.csv"; a.click(); return;
    }
    if (reportKind === "offshoots") {
      const csv = ["\uFEFF#,كود_الفسيلة,الأصل_الأم,الموقع,الصنف,المصدر,الوزن,تاريخ_التسجيل,مرحلة_المشتل,الحالة_الصحية"];
      rows.forEach((r, i) => csv.push(`${i+1},${r.code},${r.motherCode||""},"${(r.loc||'').replace(/"/g, '""')}","${(r.type||'').replace(/"/g, '""')}","${r.source||''}",${r.weight||""},${r.date},"${r.stage||''}","${r.st||''}"`));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv.join("\n")], { type: "text/csv;charset=utf-8" }));
      a.download = "سجل_الفسائل_والمشتل.csv"; a.click(); toast(`تم تصدير سجل الفسائل والمشتل (${rows.length} فسيلة)`); return;
    }
    if (reportKind === "yields") {
      const csv = ["\uFEFF#,رقم_اللوط,التاريخ,المحصول,الصنف,الموقع,الكمية_كجم,الصناديق,درجة_الجودة,المسؤول,ملاحظات"];
      rows.forEach((r, i) => csv.push(`${i+1},${r.code},${r.date},"${r.crop}","${r.variety}","${(r.loc||'').replace(/"/g, '""')}",${r.kg||0},${r.boxes||""},"${r.quality}","${(r.who||'').replace(/"/g, '""')}","${(r.notes||'').replace(/"/g, '""')}"`));
      
      // Append Variety Summary
      const vMap = {};
      rows.forEach(r => {
        const vName = r.variety || "عام / غير محدد";
        if (!vMap[vName]) vMap[vName] = { crop: r.crop, kg: 0, count: 0 };
        vMap[vName].kg += (r.kg || 0);
        vMap[vName].count += 1;
      });
      csv.push("");
      csv.push("ملخص إنتاجية الأصناف الزراعية:");
      csv.push("الصنف,المحصول,إجمالي_الكمية_كجم,بالطن,عدد_الدفعات");
      Object.entries(vMap).forEach(([vName, data]) => {
        csv.push(`"${vName}","${data.crop}",${data.kg},${(data.kg/1000).toFixed(2)},${data.count}`);
      });
      csv.push("");

      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv.join("\n")], { type: "text/csv;charset=utf-8" }));
      a.download = "تقرير_المحصول_والإنتاج_بالأصناف.csv"; a.click(); toast(`تم تصدير تقرير الإنتاج بالأصناف (${rows.length} دفعة)`); return;
    }
    if (reportKind === "status") {
      const csv = ["\uFEFF#,كود_الشجرة,المحصول,الصنف,القطاع,القطعة,تاريخ_الزراعة,الحالة,ملاحظات"];
      rows.forEach((r, i) => csv.push(`${i+1},${r.code},"${r.crop}","${r.variety}","${r.sector}","${r.plotName}",${r.date},"${r.st}","${(r.notes||'').replace(/"/g, '""')}"`));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv.join("\n")], { type: "text/csv;charset=utf-8" }));
      a.download = "تقرير_حالات_وسلامة_الأشجار.csv"; a.click(); toast(`تم تصدير تقرير سلامة الأشجار (${rows.length} أصل)`); return;
    }
    if (reportKind === "sectors") {
      const csv = ["\uFEFF#,كود_القطعة,اسم_القطعة,القطاع,المساحة_فدان,عدد_النخيل,عدد_الزيتون_الأشجار,إجمالي_الأصول,شبكة_الري"];
      rows.forEach((r, i) => csv.push(`${i+1},${r.code},"${r.name}","${r.sector}",${r.area||""},${r.palmCount||0},${r.oliveCount||0},${r.totalAssets||0},"${r.irrigation||''}"`));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv.join("\n")], { type: "text/csv;charset=utf-8" }));
      a.download = "تقرير_القطاعات_والقطع.csv"; a.click(); toast(`تم تصدير تقرير القطاعات (${rows.length} قطعة)`); return;
    }
    if (reportKind === "incidents") {
      const csv = ["\uFEFF#,كود_الأصل,الموقع,نوع_البلاغ,تاريخ_الرصد,القائم_بالرصد,حالة_المعالجة,توجيه_المشرف"];
      rows.forEach((r, i) => csv.push(`${i+1},${r.code},"${(r.loc||'').replace(/"/g, '""')}","${(r.type||'').replace(/"/g, '""')}",${r.date},"${(r.who||'').replace(/"/g, '""')}","${r.st}","${(r.supervisorNote||'').replace(/"/g, '""')}"`));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv.join("\n")], { type: "text/csv;charset=utf-8" }));
      a.download = "تقرير_البلاغات_والحالات_العارضة.csv"; a.click(); toast(`تم تصدير تقرير البلاغات (${rows.length} بلاغ)`); return;
    }
    if (reportKind === "ops") {
      const csv = ["\uFEFF#,كود_النخلة,نوع_العملية,الموقع,المنفذ,تاريخ_التنفيذ,حالة_الاعتماد,توجيه_المشرف"];
      rows.forEach((r, i) => csv.push(`${i+1},${r.code},"${(r.type||'').replace(/"/g, '""')}","${(r.loc||'').replace(/"/g, '""')}","${(r.who||'').replace(/"/g, '""')}",${r.date},"${r.st}","${(r.supervisorNote||'').replace(/"/g, '""')}"`));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv.join("\n")], { type: "text/csv;charset=utf-8" }));
      a.download = "تقرير_العمليات_الحقلية.csv"; a.click(); toast(`تم تصدير تقرير العمليات (${rows.length} عملية)`); return;
    }
    const lines = ["\uFEFF#,الكود,النوع,الموقع,المسؤول,التاريخ,الحالة"];
    rows.forEach((r,i) => lines.push(`${i+1},${r.code},${r.type},${r.loc},${r.who},${r.date},${r.st}`));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\n")], {type:"text/csv;charset=utf-8"}));
    a.download = "تقرير_"+reportKind+".csv"; a.click(); return;
  }
  return ACT_NEXT;
}
