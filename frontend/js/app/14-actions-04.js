// PalmTrace app — UI action handlers, part 4 of 9 (starts at: name === "exec-schedule")
// (split from the former single app.js; files are classic scripts loaded in order by index.html)

async function actionsPart04(name, id, el, st) {
  if (name === "exec-schedule") {
    const sch = (st.operationSchedules || []).find(s => s.id === id);
    if (!sch) return toast("الجدول الدوري غير موجود");
    activeScheduleId = sch.id;
    if (sch.plotIds && sch.plotIds.length) {
      bulkMode = "plot";
      bulkPlots.clear();
      sch.plotIds.forEach(p => bulkPlots.add(p));
    } else if (sch.plotId && sch.plotId !== "all") {
      bulkMode = "plot";
      bulkPlots.clear();
      if (sch.plotId.startsWith("base:")) {
        const bId = sch.plotId.slice(5);
        st.plots.filter(p => p.id.startsWith(bId) || plotBaseId(p) === bId).forEach(p => bulkPlots.add(p.id));
      } else {
        bulkPlots.add(sch.plotId);
      }
    } else if (sch.sectorId && sch.sectorId !== "all") {
      bulkMode = "sector";
    }
    if (sch.cropId && sch.cropId !== "all") {
      bulkCrop = sch.cropId;
    }
    go("bulk-op");
    setTimeout(() => {
      if ($("#btype") && sch.opTypeId) $("#btype").value = sch.opTypeId;
      if ($("#bsec") && sch.sectorId && sch.sectorId !== "all") $("#bsec").value = sch.sectorId;
      if ($("#bmat") && sch.materialName) {
        const opt = [...($("#bmat").options || [])].find(o => o.value === sch.materialName || o.textContent.includes(sch.materialName));
        if (opt) $("#bmat").value = opt.value;
      }
      if ($("#bnotes")) {
        const pfx = `[تنفيذ لجدول: ${sch.title}]`;
        $("#bnotes").value = sch.instructions ? `${pfx} ${sch.instructions}` : pfx;
      }
      toast(`تم فتح تنفيذ العملية لجدول [${sch.title}] ⚡`);
    }, 60);
    return;
  }
  if (name === "mark-sch-done") {
    const sch = (st.operationSchedules || []).find(s => s.id === id);
    if (!sch) return toast("الجدول الدوري غير موجود");
    const today = new Date().toISOString().slice(0, 10);
    sch.lastExecutedAt = today;
    sch.nextDueDate = addDaysToDate(today, sch.intervalDays || 7);
    Store.set({ operationSchedules: st.operationSchedules });
    toast(`تم تحديد [${sch.title}] كمنجز وترحيل الموعد القادم إلى ${sch.nextDueDate} ✅`);
    render();
    return;
  }
  if (name === "reset-sch-filters") {
    schFilterCrop = "all";
    schFilterSec = "all";
    schFilterStatus = "all";
    render();
    return;
  }
  if (name === "sync-all" || name === "sync-one") {
    // التحقق الفعلي من حالة الاتصال بالسيرفر والشبكة
    const isUp = (typeof navigator !== "undefined" && !navigator.onLine) ? false : (typeof Api !== "undefined" ? await Api.checkHealth() : false);
    if (!isUp) {
      toast("⚠️ تعذر الاتصال بالخادم المركزي — العمليات محفوظة محلياً بأمان وستتم مزامنتها تلقائياً فور عودة الإنترنت");
      render();
      return;
    }

    if (name === "sync-one") {
      const o = st.operations.find(x => x.id === id);
      if (o) {
        toast("⏳ جاري مزامنة العملية مع قاعدة البيانات...");
        try {
          const syncUrl = (typeof Api !== "undefined" && Api.API_URL) ? `${Api.API_URL}/operations` : `${window.location.origin}/api/operations`;
          const res = await fetch(syncUrl, {
            method: "POST",
            headers: (typeof Api !== "undefined" && Api.getHeaders) ? Api.getHeaders() : { "Content-Type": "application/json" },
            body: JSON.stringify(o)
          });
          if (res.ok) {
            o.status = "synced";
            const qItem = (st.queue || []).find(q => q.detail === o.palmCode || q.id === o.id || (q.title && q.title.includes(typeName(o.typeId))));
            if (qItem) {
              qItem.status = "synced";
              qItem.syncedAt = new Date().toISOString();
            }
            Store.set({ operations: st.operations, queue: st.queue });
            toast("✅ تمت مزامنة هذه العملية مع قاعدة بيانات SQLite بنجاح");
            render();
            return;
          } else {
            toast("⚠️ تعذر تسجيل الحركة في السيرفر");
            return;
          }
        } catch (err) {
          toast("⚠️ فشل إرسال العملية للخادم — تحقق من الاتصال");
          return;
        }
      }
    }

    // sync-all
    toast("⏳ جاري مزامنة وسحب كافة بيانات المزرعة وقاعدة البيانات SQLite...");
    Promise.all([Api.pullLatest(), Api.syncQueue(), Api.syncAllToDatabase()]).then(() => {
      toast("✅ تمت المزامنة الشاملة بنجاح مع قاعدة البيانات المركزية");
      render();
    }).catch(() => {
      toast("⚠️ حدث خطأ أثناء المزامنة الشاملة");
    });
    return;
  }
  if (name === "filter-sucker-mode") {
    palmNewSuckerFilter = id || "all";
    render();
    return;
  }
  if (name === "change-pnew-crop") {
    const cid = id || $("#ncrop")?.value || "palm";
    palmNewCrop = cid;
    palmNewSuckerCode = "";
    render(); return;
  }
  if (name === "sel-sucker") {
    palmNewSuckerCode = id !== undefined ? id : ($("#nsucker_sel")?.value || "");
    const sucker = suckerByCode(palmNewSuckerCode, palmNewCrop);
    if (sucker && sucker.variety) {
      const nvarEl = $("#nvar");
      if (nvarEl) nvarEl.value = sucker.variety;
    }
    render(); return;
  }
  if (name === "change-gencrop") {
    const cid = id || $("#gcrop")?.value || "palm";
    genSelectedCrop = cid;
    const c = (st.crops || []).find(x => x.id === cid) || { id: cid, name: cropName(cid), plural: cropPlural(cid) };
    if ($("#gcount_lbl")) $("#gcount_lbl").textContent = `عدد ${c.plural || "الأشجار"} لكل جزء *`;
    const srcs = (typeof getCropPlantingSources === "function") ? getCropPlantingSources(cid) : (c.sources || [{ code: "F", name: "فسيلة" }]);
    if ($("#gsrc")) $("#gsrc").innerHTML = srcs.map(s => `<option value="${s.code}">${s.code} - ${s.name}</option>`).join("");
    if ($("#gvar")) $("#gvar").innerHTML = varietyOptions(null, cid);
    updateGenCodesPreview();
    return;
  }
  if (name === "filter-field-crop") {
    browseCrop = id === "all" ? "" : (id || $("#fcrop")?.value || "");
    palmPage = 1; render(); return;
  }
  if (name === "browse-all-plots") {
    browsePlot = null; palmPage = 1; render(); return;
  }
  if (name === "save-palm") {
    if (!hasPerm("palms_add")) return toast("ليس لديك صلاحية إضافة وتكويد أشجار جديدة");
    if (!$("#nseq")?.value || !$("#ndate")?.value) return toast("أدخل الرقم وتاريخ الزراعة");
    const origin = $("#nori").value;
    const cropId = $("#ncrop")?.value || palmNewCrop || "palm";
    let sucker = null;
    if (origin === "internal") {
      const sc = ($("#nsuckerq")?.value || $("#nsucker_sel")?.value || palmNewSuckerCode || "").trim();
      if (!sc) return toast("اختر كود الفسيلة أو الشتلة الجاهزة من المشتل");
      sucker = suckerByCode(sc, cropId);
      if (!sucker) return toast("الفسيلة أو الشتلة غير جاهزة أو تابعة لمحصول آخر أو زُرعت بالفعل");
    }
    const rec = {
      id: Store.uid("p"), cropId, source: $("#nsource").value, plot: $("#nplot").value,
      seq: toCleanDigits($("#nseq").value).padStart(3,"0"), plantDate: $("#ndate").value,
      variety: sucker?.variety || $("#nvar").value, originType: origin,
      supplier: origin === "purchased" ? ($("#nsup")?.value || "") : "",
      notes: $("#nnotes").value, parentId: sucker?.motherId || null,
      parentCode: sucker?.code || $("#nbatch")?.value || "",
      tempCode: sucker?.code || null, offshootDate: sucker?.offshootDate || "",
      nurseryAgeMonths: sucker?.offshootDate ? monthsSince(sucker.offshootDate, $("#ndate").value) : 0,
      status: "سليمة", offshootCount: 0, gps: "", locked: false,
      _new: true // kept locally until the server copy arrives (matched by code)
    };
    rec.code = buildCode(rec);
    if (st.palms.find(p => p.code === rec.code)) return toast("الكود مكرر");
    st.palms.push(rec);
    if (sucker?.kind === "internal") {
      st.offshoots = st.offshoots.map(o => o.id === sucker.id ? {
        ...o,
        nsStatus: "planted",
        isPlanted: true,
        newPalmId: rec.id,
        plantedPalmCode: rec.code,
        plantedPlot: rec.plot,
        plantedAt: rec.plantDate || new Date().toISOString()
      } : o);
      setTimeout(() => persistNursery(sucker.id), 0);
    }
    if (sucker?.kind === "buy") {
      st.nurseryItems = (st.nurseryItems || []).map(n => n.id === sucker.id ? {
        ...n,
        nsStatus: "planted",
        isPlanted: true,
        newPalmId: rec.id,
        plantedPalmCode: rec.code,
        plantedPlot: rec.plot,
        plantedAt: rec.plantDate || new Date().toISOString()
      } : n);
    }
    palmNewSuckerCode = "";
    palmNewDraft = {};
    Store.set({ palms: st.palms, offshoots: st.offshoots, nurseryItems: st.nurseryItems });
    if (typeof AuditLog !== "undefined") {
      if (sucker && (sucker.nsStatus === "ready" || sucker.statusDesc?.includes("جاهزة"))) {
        AuditLog.log({
          action: "checkout",
          module: "nursery",
          severity: "info",
          title: `صرف مباشر وغرس بالحقل: ${sucker.code}`,
          summary: `تم صرف الأصل ${sucker.code} مباشرة من المشتل إلى الحقل وزراعته كشجرة [${rec.code}] بالقطعة ${rec.plot}`,
          details: { suckerCode: sucker.code, palmCode: rec.code, plot: rec.plot, variety: rec.variety },
          user: session()?.name || "مهندس الحقل"
        });
      }
      AuditLog.log({
        action: "create",
        module: "palms",
        severity: "info",
        title: `إضافة شجرة/أصل: ${rec.code}`,
        summary: `تمت زراعة وتكويد [${rec.code}] (${cropName(rec.cropId)} - ${rec.variety}) بالقطعة ${rec.plot}`,
        details: { code: rec.code, cropId: rec.cropId, variety: rec.variety, plot: rec.plot, originType: rec.originType, plantDate: rec.plantDate },
        targetType: "palm",
        targetId: rec.id,
        targetCode: rec.code,
        user: session()?.name || "مستخدم",
        role: session()?.role || "worker"
      });
    }
    if (typeof Api !== "undefined") {
      Api.createPalm(rec);
      Api.syncAllToDatabase({ newPalms: [rec] });
    }
    toast("تمت زراعة " + rec.code); go("palm", rec.id); return;
  }
  if (name === "gen-codes") {
    if (!hasPerm("palms_add")) return toast("⚠️ ليس لديك صلاحية توليد وتكويد الأشجار");
    const btn = el || document.querySelector('[data-act="gen-codes"]');
    if (btn) { btn.disabled = true; btn.textContent = "⏳ جاري التوليد وحفظ السجلات..."; }

    try {
      const cropId = $("#gcrop")?.value || "palm";
      const rawSec = toCleanDigits($("#gsec")?.value);
      if (!rawSec) {
        if (btn) { btn.disabled = false; btn.textContent = "🚀 إنشاء وتوليد الأكواد"; }
        return toast("⚠️ يرجى إدخال رقم أو كود القطاع (مثال: 04 أو 4 أو BSH04)");
      }
      const sec = normalizeSectorCode(rawSec);
      const secn = ($("#gsecn")?.value || "").trim() || ("القطاع " + sec);

      const nplots = parseInt(toCleanDigits($("#gplots")?.value), 10);
      if (isNaN(nplots) || nplots <= 0) {
        if (btn) { btn.disabled = false; btn.textContent = "🚀 إنشاء وتوليد الأكواد"; }
        return toast("⚠️ يرجى إدخال عدد صحيح موجب للقطع في القطاع");
      }

      const start = parseInt(toCleanDigits($("#gstart")?.value), 10) || 1;

      const rawParts = ($("#gparts")?.value || "").trim();
      const parts = rawParts.split(/[,،;\s]+/).map(x => x.trim().toUpperCase()).filter(Boolean);
      if (!parts.length) {
        if (btn) { btn.disabled = false; btn.textContent = "🚀 إنشاء وتوليد الأكواد"; }
        return toast("⚠️ يرجى إدخال أجزاء كل قطعة (مثل: A, B, C, D)");
      }

      const count = parseInt(toCleanDigits($("#gcount")?.value), 10);
      if (isNaN(count) || count <= 0) {
        if (btn) { btn.disabled = false; btn.textContent = "🚀 إنشاء وتوليد الأكواد"; }
        return toast("⚠️ يرجى إدخال عدد صحيح للأشجار في كل جزء");
      }

      const date = ($("#gdate")?.value || "").trim() || new Date().toISOString().slice(0, 10);
      const src = ($("#gsrc")?.value || (cropId === "olive" ? "C" : "F")).trim();
      const vari = ($("#gvar")?.value || "خلاص").trim();

      // حساب مساحة القطعة الإجمالية ومساحة الأجزاء الفرعية
      const rawPlotArea = parseFloat(toCleanDigits($("#gplot_area")?.value)) || 0;
      const plotAreaUnit = $("#gplot_area_unit")?.value || "فدان";
      const subPlotArea = (rawPlotArea > 0 && parts.length > 0) ? Number((rawPlotArea / parts.length).toFixed(3)) : 0;
      const secTotalArea = rawPlotArea > 0 ? Number((rawPlotArea * nplots).toFixed(2)) : 0;

      // Prepare staged batch instead of direct auto-commit
      const stagedPlots = [];
      const stagedPalms = [];
      const allMatchingSectorCodes = [];
      let skipped = 0;

      for (let i = 0; i < nplots; i++) {
        const pno = String(start + i).padStart(2, "0");
        parts.forEach(part => {
          const pid = normalizePlotCode(`${sec}-${pno}${part}`);
          if (!st.plots.find(p => p.id === pid)) {
            stagedPlots.push({
              id: pid,
              sector: sec,
              plotNo: pno,
              part,
              name: `قطعة ${pno}${part}`,
              areaValue: subPlotArea,
              area_value: subPlotArea,
              areaUnit: plotAreaUnit,
              area_unit: plotAreaUnit,
              parentPlotId: `${sec}-${pno}`,
              parent_plot_id: `${sec}-${pno}`,
              mainCrop: cropId,
              main_crop: cropId
            });
          }
          for (let n = 1; n <= count; n++) {
            const seq = String(n).padStart(3, "0");
            const rec = {
              id: Store.uid("p"),
              cropId,
              source: src,
              plot: pid,
              seq,
              plantDate: date,
              variety: vari,
              originType: "internal",
              supplier: "",
              notes: "توليد مسودة",
              parentId: null,
              tempCode: null,
              status: "سليمة",
              offshootCount: 0,
              gps: "",
              locked: false,
              _dirty: true,
              _new: true
            };
            const tempPlots = [...st.plots, ...stagedPlots];
            rec.code = buildCode(rec, tempPlots);
            allMatchingSectorCodes.push(rec.code);

            if (!st.palms.find(p => p.code === rec.code)) {
              stagedPalms.push(rec);
            } else {
              skipped++;
            }
          }
        });
      }

      if (!stagedPalms.length) {
        if (btn) { btn.disabled = false; btn.textContent = "🚀 إنشاء وتوليد الأكواد"; }
        return toast(`ℹ️ كافة الأكواد (${allMatchingSectorCodes.length} كود) مسجلة مسبقاً في القطاع ${sec}`);
      }

      st.stagedBatch = {
        secId: sec,
        secName: secn,
        cropId,
        cropName: cropName(cropId),
        variety: vari,
        source: src,
        plantDate: date,
        plotArea: rawPlotArea,
        subPlotArea: subPlotArea,
        areaUnit: plotAreaUnit,
        totalSecArea: secTotalArea,
        totalTrees: stagedPalms.length,
        totalPlots: (nplots * parts.length),
        newPlots: stagedPlots,
        newPalms: stagedPalms,
        sampleCodes: stagedPalms.slice(0, 5).map(p => p.code),
        allCodes: stagedPalms.map(p => p.code),
        skipped
      };
      Store.set({ stagedBatch: st.stagedBatch });
      toast(`📋 تم توليد مسودة القطاع بنجاح (${stagedPalms.length} أصل بانتظار الاعتماد).`);
      go("generate");
      return;
    } catch (err) {
      console.error("gen-codes failed:", err);
      toast("⚠️ حدث خطأ أثناء التوليد: " + err.message);
      if ($("#genOut")) {
        $("#genOut").innerHTML = `<div class="badge badge-danger" style="margin-top:8px;padding:8px">❌ حدث خطأ: ${err.message}</div>`;
      }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "🚀 إنشاء وتوليد الأكواد"; }
    }
  }
  if (name === "commit-staged-batch") {
    const b = st.stagedBatch;
    if (!b) return;

    const commitBtn = el || (e && e.target ? e.target.closest("[data-act='commit-staged-batch']") : null);
    if (commitBtn) {
      commitBtn.disabled = true;
      commitBtn.innerHTML = `⏳ جاري حفظ وتثبيت ${b.totalTrees || (b.newPalms ? b.newPalms.length : '')} أصل في قاعدة البيانات...`;
    }

    let secObj = st.sectors.find(s => s.id === b.secId);
    if (!secObj) {
      secObj = { id: b.secId, name: b.secName, totalArea: b.totalSecArea || 0, total_area: b.totalSecArea || 0 };
      st.sectors.push(secObj);
    } else if (b.totalSecArea) {
      secObj.totalArea = b.totalSecArea;
      secObj.total_area = b.totalSecArea;
    }

    if (b.newPlots && b.newPlots.length) {
      b.newPlots.forEach(pl => {
        const existing = st.plots.find(p => p.id === pl.id);
        if (!existing) {
          st.plots.push(pl);
        } else {
          if (pl.areaValue || pl.area_value) {
            existing.areaValue = pl.areaValue;
            existing.area_value = pl.area_value;
            existing.areaUnit = pl.areaUnit;
            existing.area_unit = pl.area_unit;
          }
          if (pl.parentPlotId || pl.parent_plot_id) {
            existing.parentPlotId = pl.parentPlotId;
            existing.parent_plot_id = pl.parent_plot_id;
          }
        }
      });
    }

    if (b.newPalms && b.newPalms.length) {
      b.newPalms.forEach(p => {
        p._dirty = true;
        p._new = true;
        if (!p.sector && b.secId) p.sector = b.secId;
        if (!p.sectorId && b.secId) p.sectorId = b.secId;
      });
      st.palms.push(...b.newPalms);
    }

    st.lastPrintBatch = b.allCodes || [];
    st.stagedBatch = null;

    // Advance to next sector automatically
    const rawSec = parseInt(toCleanDigits(b.secId), 10);
    if (!isNaN(rawSec)) {
      genLastSector = String(rawSec + 1).padStart(2, "0");
    } else {
      genLastSector = "";
    }

    Store.set({ sectors: st.sectors, plots: st.plots, palms: st.palms, lastPrintBatch: st.lastPrintBatch, stagedBatch: null });

    if (typeof Api !== "undefined" && typeof Api.syncAllToDatabase === "function") {
      try {
        await Api.syncAllToDatabase({ newPalms: b.newPalms });
        await Api.pullLatest();
      } catch (err) {
        console.error("Sync to database error:", err);
      }
    }

    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "commit_staged_sector",
        module: "palms",
        severity: "info",
        title: `اعتماد وتفعيل قطاع وأصول (${b.totalTrees} شجرة)`,
        summary: `تم اعتماد وتثبيت القطاع ${b.secName} (${b.secId}) وإضافة ${b.totalTrees} أصل حي للنظام`,
        details: { secId: b.secId, totalTrees: b.totalTrees, cropId: b.cropId, variety: b.variety },
        targetCount: b.totalTrees,
        targetType: "sector",
        targetId: b.secId,
        user: session()?.name || "مستخدم",
        role: session()?.role || "worker"
      });
    }

    toast(`✅ تم اعتماد وتفعيل القطاع ${b.secName} وتثبيت ${b.totalTrees} أصل بنجاح!`);
    render();
    return;
  }
  if (name === "cancel-staged-batch") {
    st.stagedBatch = null;
    Store.set({ stagedBatch: null });
    toast("❌ تم إلغاء المسودة وحذف الأكواد المتولدة بالكامل دون حفظها");
    render();
    return;
  }
  if (name === "export-codes") {
    const list = (st.lastPrintBatch && st.lastPrintBatch.length) ? st.palms.filter(p => st.lastPrintBatch.includes(p.code)) : st.palms;
    const rows = ["\uFEFFالكود,المحصول,الصنف,القطعة,التاريخ"];
    list.forEach(p => rows.push(`${p.code},${cropName(p.cropId)},${p.variety},${p.plot},${p.plantDate}`));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" }));
    a.download = "أكواد_الأشجار_والمحاصيل.csv"; a.click();
    printPalmsBarcode(list, "ملصقات أكواد الأشجار والمحاصيل");
    return;
  }
  if (name === "n-filter") { nQ = $("#nq")?.value || ""; nStage = $("#nstage")?.value || "all"; render(); return; }
  if (name === "bulk-nready" || name === "bulk-nissue" || name === "bulk-nprep") {
    const ids = $$(".nchk").filter(c=>c.checked).map(c=>c.value);
    if (!ids.length) return toast("حدد فسائل أولاً");
    if (name === "bulk-nissue") {
      dispenseOsIds = ids;
      showDispenseModal = true;
      render(); return;
    }
    const prepName = (st.nurseryPrepTypes||[]).find(t=>t.id===($("#nprep")?.value))?.name || "نشاط";
    st.offshoots.forEach(o => {
      if (!ids.includes(o.id)) return;
      if (name==="bulk-nready") o.nsStatus = "ready";
      if (name==="bulk-nprep") { o.preps = o.preps||[]; o.preps.push({ type: prepName, at: new Date().toISOString() }); }
    });
    Store.set({ offshoots: st.offshoots });
    persistNursery(ids);
    toast(`تحديث ${ids.length} فسيلة`); render(); return;
  }
  if (name === "filter-nursery-crop") { nurseryCropFilter = id || "all"; render(); return; }
  if (name === "buy-crop-change") { buyCropSel = id || "palm"; render(); return; }
  if (name === "ntab") { nurseryTab = id; nSec = null; nPlot = null; nBatch = null; showBuyForm = false; render(); return; }
  if (name === "show-buy") { nurseryTab = "buy"; buyCropSel = "palm"; showBuyForm = true; render(); return; }
  if (name === "set-intake-mode") { nurseryIntakeMode = id || "opening"; render(); return; }
  if (name === "hide-buy") { showBuyForm = false; render(); return; }
  if (name === "open-nbatch") { nBatch = id; render(); return; }
  if (name === "n-buy-home") { nBatch = null; render(); return; }
  if (name === "n-int-home") { nSec = null; nPlot = null; render(); return; }
  if (name === "open-nsec") { nSec = id; nPlot = null; render(); return; }
  if (name === "open-nplot") { nPlot = id; render(); return; }
  if (name === "open-seedlings-import") {
    if (!hasPerm("seedlings_import")) return toast("ليس لديك صلاحية استيراد شتلات وفسائل المشتل");
    showSeedlingImportModal = true;
    parsedSeedlingsData = [];
    selectedSeedlingsFileName = "";
    render();
    return;
  }
  if (name === "close-seedlings-import") {
    showSeedlingImportModal = false;
    parsedSeedlingsData = [];
    selectedSeedlingsFileName = "";
    render();
    return;
  }
  if (name === "edit-palm") {
    const p = findPalm(id);
    if (!p) return toast("تعذر العثور على الشجرة");
    if (!hasPerm("palms_edit")) return toast("ليس لديك صلاحية تعديل بيانات الشجرة");
    p.variety = $("#evar")?.value || p.variety;
    const newStatus = $("#estat")?.value || p.status;
    p.status = newStatus;
    if (newStatus === "تحت المراقبة") {
      p.statusId = 2; p.statusCode = "observation"; p.badgeColor = "#D97706"; p.badgeBg = "#FEF3C7";
    } else if (newStatus === "مصابة") {
      p.statusId = 3; p.statusCode = "infected"; p.badgeColor = "#DC2626"; p.badgeBg = "#FEE2E2";
    } else if (newStatus === "ميتة") {
      p.statusId = 5; p.statusCode = "dead"; p.badgeColor = "#0F172A"; p.badgeBg = "#E2E8F0";
    } else {
      p.statusId = 1; p.statusCode = "healthy"; p.badgeColor = "#16A34A"; p.badgeBg = "#DCFCE7";
    }
    p.modifiedBy = session()?.name || session()?.user || "worker";
    p.modifiedAt = new Date().toISOString();
    p.nurseryAgeMonths = +($("#enage")?.value || 0);
    p.notes = $("#enotes")?.value || "";
    p.parentCode = $("#eparent")?.value || p.parentCode;
    p.offshootDate = $("#eoffd")?.value || p.offshootDate;
    if (p.parentCode) {
      const mom = findPalm(p.parentCode) || (st.offshoots || []).find(o => o.tempCode === p.parentCode);
      if (mom?.id) p.parentId = mom.motherId || mom.id;
    }
    if ($("#eplot")?.value) p.plot = $("#eplot").value;
    const lat = $("#elat")?.value?.trim();
    const lng = $("#elng")?.value?.trim();
    if (lat && lng && !isNaN(Number(lat)) && !isNaN(Number(lng))) {
      p.gps = lat + "," + lng;
      p.gps_lat = Number(lat);
      p.gps_lng = Number(lng);
    } else {
      p.gps = "";
      p.gps_lat = null;
      p.gps_lng = null;
    }
    const idx = st.palms.findIndex(x => String(x.id) === String(p.id) || codesEqual(x.code, p.code));
    if (idx !== -1) st.palms[idx] = p;
    palmEdit = false;
    Store.set({ palms: st.palms });
    if (typeof Api !== "undefined" && typeof Api.updatePalm === "function") {
      try {
        await Api.updatePalm(p);
      } catch (err) {
        console.warn("Api.updatePalm failed:", err);
      }
    }
    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "update",
        module: "palms",
        severity: "info",
        title: `تعديل شجرة: ${p.code}`,
        summary: `تعديل بيانات وإحداثيات الشجرة ${p.code} (${p.variety} - ${p.status}) بالقطعة ${p.plot}`,
        details: { code: p.code, variety: p.variety, status: p.status, plot: p.plot, gps: p.gps, notes: p.notes },
        targetType: "palm",
        targetId: p.id,
        targetCode: p.code,
        user: session()?.name || "مستخدم",
        role: session()?.role || "worker"
      });
    }
    toast("تم حفظ وتحديث بيانات وإحداثيات النخلة بنجاح ✅");
    render(); return;
  }
  if (name === "geo-me") {
    if (!navigator.geolocation) return toast("الموقع غير مدعوم بالجهاز");
    navigator.geolocation.getCurrentPosition(pos => {
      const la = pos.coords.latitude.toFixed(6);
      const lo = pos.coords.longitude.toFixed(6);
      if ($("#elat")) $("#elat").value = la;
      if ($("#elng")) $("#elng").value = lo;
      if (window._currentEditMarker && window._currentEditMap) {
        window._currentEditMarker.setLatLng([la, lo]);
        window._currentEditMap.setView([la, lo], 18);
      }
      toast("تم التقاط إحداثيات موقعك الحالي بنجاح 🛰️");
    }, () => toast("تعذر قراءة GPS - تأكد من تفعيل صلاحية الموقع"));
    return;
  }
  if (name === "gis-change-crop") {
    mapCrop = id || ""; mapVar = ""; render(); return;
  }
  if (name === "gis-go") {
    mapQ = $("#gisq")?.value || "";
    mapCrop = $("#giscrop")?.value || "";
    mapSec = $("#gissec")?.value || "";
    mapPlot = $("#gisplot")?.value || "";
    mapVar = $("#gisvar")?.value || "";
    mapSt = $("#gisst")?.value || "";
    render(); return;
  }
  if (name === "open-plots-import") {
    showPlotImportModal = true;
    render(); return;
  }
  if (name === "close-plots-import") {
    showPlotImportModal = false;
    render(); return;
  }
  if (name === "open-investors-import") {
    if (!hasPerm("investors_import")) return toast("ليس لديك صلاحية استيراد المستثمرين والعقود");
    showInvestorImportModal = true;
    render(); return;
  }
  if (name === "close-investors-import") {
    showInvestorImportModal = false;
    selectedInvestorsFile = null;
    render(); return;
  }
  if (name === "open-investor-contract-modal") {
    openInvestorContractModal(id);
    return;
  }
  if (name === "close-investor-contract-modal") {
    showInvestorContractModal = false;
    editingInvestorId = null;
    editingInvestorData = null;
    editingContractSubForm = null;
    contractDraftPlots = [];
    render();
    return;
  }
  if (name === "save-investor-profile") {
    if (!editingInvestorId) return;
    const nameVal = ($("#inv_edit_name")?.value || "").trim();
    const phoneVal = ($("#inv_edit_phone")?.value || "").trim();
    const emailVal = ($("#inv_edit_email")?.value || "").trim();
    const statusVal = $("#inv_edit_status")?.value === "1";
    const selectedRoles = $$(".inv-role-chk").filter(c => c.checked).map(c => c.value);

    if (!nameVal) return toast("⚠️ يرجى إدخال اسم المستثمر");
    if (!phoneVal) return toast("⚠️ يرجى إدخال رقم الهاتف / اسم الدخول");

    const payload = {
      name: nameVal,
      fullName: nameVal,
      phone: phoneVal,
      username: phoneVal,
      email: emailVal || null,
      active: statusVal,
      roles: selectedRoles.length > 0 ? selectedRoles : ["investor"],
      role: selectedRoles[0] || "investor"
    };

    const duplicate = (st.users || []).find(u => u.id !== editingInvestorId && (u.phone === phoneVal || u.user === phoneVal || u.username === phoneVal));
    if (duplicate) {
      return toast("⚠️ رقم الهاتف / اسم الدخول مستخدم بالفعل لحساب آخر");
    }

    if (typeof Api !== "undefined" && typeof Api.updateInvestor === "function") {
      const res = await Api.updateInvestor(editingInvestorId, payload);
      if (res && res.success) {
        toast("✓ تم تحديث بيانات وصلاحيات المستثمر بنجاح");
        if (res.investor) {
          editingInvestorData = { ...(editingInvestorData || {}), investor: res.investor };
        }
      } else {
        toast(res?.error || "⚠️ فشل تحديث بيانات المستثمر", "warn");
      }
    } else {
      const users = (st.users || []).map(u => u.id === editingInvestorId ? { ...u, ...payload } : u);
      Store.set({ users });
      toast("✓ تم تحديث المستثمر محلياً");
    }
    render();
    return;
  }
  if (name === "new-contract-form") {
    const allTemplates = st.contractTemplates || [];
    const activeTemplates = allTemplates.filter(t => t.is_active !== 0 && t.is_active !== false && t.active !== 0 && t.active !== false);
    const templates = activeTemplates.length > 0 ? activeTemplates : allTemplates;
    const defaultTpl = templates[0] || {};
    const defaultCompShare = defaultTpl.default_company_share_pct ?? 25;
    const defaultFeeAcre = defaultTpl.default_annual_fee_per_acre ?? 0;
    
    editingContractSubForm = {
      id: "",
      template_id: defaultTpl.id || "tpl_crop_share",
      contract_num: `CNT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      title: "",
      start_date: new Date().toISOString().split("T")[0],
      end_date: "",
      total_palms: 0,
      company_crop_share_pct: defaultCompShare,
      annual_fee_per_acre: defaultFeeAcre,
      payment_schedule: "annual",
      zakat_delegated: 0,
      zakat_rate_pct: 5.0,
      zakat_delegation_date: new Date().toISOString().split("T")[0],
      zakat_doc_url: "",
      investor_share_pct: 100 - defaultCompShare,
      financial_status: "مسدد بالكامل",
      plots: []
    };
    contractDraftPlots = [];
    render();
    return;
  }
  if (name === "edit-contract-item") {
    const contracts = editingInvestorData?.contracts || st.contracts || [];
    const target = contracts.find(c => c.id === id);
    if (target) {
      editingContractSubForm = { ...target };
      contractDraftPlots = Array.isArray(target.plots) ? [...target.plots] : [];
      render();
    }
    return;
  }
  if (name === "cancel-contract-subform") {
    editingContractSubForm = null;
    contractDraftPlots = [];
    render();
    return;
  }
  if (name === "add-draft-plot") {
    syncDraftContractFromDom();
    const sel = $("#cnt_picker_plot_select");
    const pid = sel ? sel.value : "";
    if (!pid) return toast("⚠️ يرجى اختيار قطعة لإضافتها");
    
    // Check if plot is already assigned to another investor's active contract
    const otherActiveContracts = (st.contracts || []).filter(c => c.status === "active" && c.id !== editingContractSubForm?.id && String(c.investor_id || c.investorId || c.investorUserId) !== String(editingInvestorId));
    const conflict = otherActiveContracts.find(c => (c.plots || []).includes(pid));
    if (conflict) {
      const invUser = (st.users || []).find(u => u.id === conflict.investor_id || u.id === conflict.investorId || u.id === conflict.investorUserId);
      return toast(`⚠️ القطعة (${pid}) مخصصة بالفعل للمستثمر (${invUser?.name || 'مستثمر آخر'}) بموجب العقد (${conflict.contract_number || conflict.contractNum || conflict.id}). لا يمكن تكرار تخصيص نفس القطعة!`, "warn");
    }

    if (!contractDraftPlots.includes(pid)) {
      contractDraftPlots.push(pid);
      render();
    }
    return;
  }
  if (name === "remove-draft-plot") {
    syncDraftContractFromDom();
    contractDraftPlots = contractDraftPlots.filter(p => p !== id);
    render();
    return;
  }
  if (name === "save-contract-subform") {
    if (!editingInvestorId) return;
    const numVal = ($("#cnt_edit_num")?.value || "").trim();
    const titleVal = ($("#cnt_edit_title")?.value || "").trim();
    const startVal = $("#cnt_edit_start")?.value || null;
    const endVal = $("#cnt_edit_end")?.value || null;
    const palmsVal = parseInt($("#cnt_edit_palms")?.value, 10) || 0;
    const financialVal = $("#cnt_edit_financial")?.value || "مسدد بالكامل";

    const tplVal = $("#cnt_edit_template")?.value || null;
    const compShareVal = parseFloat($("#cnt_edit_company_share")?.value) || 0;
    const feeAcreVal = parseFloat($("#cnt_edit_fee_per_acre")?.value) || 0;
    const schedVal = $("#cnt_edit_schedule")?.value || "annual";
    const zakatDelegatedVal = $("#cnt_edit_zakat_delegated")?.checked ? 1 : 0;
    const zakatRateVal = parseFloat($("#cnt_edit_zakat_rate")?.value) || 5.0;
    const zakatDateVal = $("#cnt_edit_zakat_date")?.value || null;
    const zakatDocVal = ($("#cnt_edit_zakat_doc")?.value || "").trim();

    const invNetShare = Math.max(0, 100 - compShareVal - (zakatDelegatedVal ? zakatRateVal : 0));

    if (!numVal) return toast("⚠️ يرجى إدخال رقم العقد الاستثماري");

    const contractId = editingContractSubForm?.id || `cnt_${Date.now()}`;
    const payload = {
      id: contractId,
      template_id: tplVal,
      templateId: tplVal,
      contract_num: numVal,
      contractNum: numVal,
      title: titleVal || `عقد ${numVal}`,
      investor_id: editingInvestorId,
      investorId: editingInvestorId,
      start_date: startVal,
      startDate: startVal,
      end_date: endVal,
      endDate: endVal,
      total_palms: palmsVal,
      totalPalms: palmsVal,
      company_crop_share_pct: compShareVal,
      annual_fee_per_acre: feeAcreVal,
      payment_schedule: schedVal,
      zakat_delegated: zakatDelegatedVal,
      zakat_rate_pct: zakatRateVal,
      zakat_delegation_date: zakatDateVal,
      zakat_doc_url: zakatDocVal,
      investor_crop_share_pct: invNetShare,
      investor_share_pct: invNetShare,
      investorSharePct: invNetShare,
      financial_status: financialVal,
      financialStatus: financialVal,
      plots: contractDraftPlots
    };

    if (typeof Api !== "undefined") {
      let res;
      if (editingContractSubForm?.id) {
        res = await Api.updateContract(editingContractSubForm.id, payload);
      } else {
        res = await Api.createContract(payload);
      }
      if (res && res.success) {
        toast("✓ تم حفظ العقد وتحديث الفوترة وتخصيص القطع بنجاح");
        const fresh = await Api.getInvestor(editingInvestorId);
        if (fresh && (fresh.contracts || fresh.investor)) {
          editingInvestorData = {
            success: true,
            investor: fresh.investor || fresh,
            contracts: fresh.contracts || []
          };
        } else if (editingInvestorData) {
          editingInvestorData.contracts = editingInvestorData.contracts || [];
          const cIdx = editingInvestorData.contracts.findIndex(c => c.id === contractId);
          if (cIdx >= 0) editingInvestorData.contracts[cIdx] = payload;
          else editingInvestorData.contracts.unshift(payload);
        }
        
        // Immediately sync with local Store
        st.contracts = st.contracts || [];
        const stIdx = st.contracts.findIndex(c => c.id === contractId);
        if (stIdx >= 0) st.contracts[stIdx] = payload;
        else st.contracts.unshift(payload);
        Store.set({ contracts: st.contracts });

        if (typeof Api.getContractInvoices === "function") {
          const invRes = await Api.getContractInvoices();
          if (invRes && invRes.success) {
            Store.set({ contractInvoices: invRes.invoices });
          }
        }
      } else {
        toast(res?.error || "⚠️ تعذر حفظ العقد", "warn");
      }
    } else {
      toast("✓ تم حفظ العقد محلياً");
      st.contracts = st.contracts || [];
      const stIdx = st.contracts.findIndex(c => c.id === contractId);
      if (stIdx >= 0) st.contracts[stIdx] = payload;
      else st.contracts.unshift(payload);
      Store.set({ contracts: st.contracts });
    }

    editingContractSubForm = null;
    contractDraftPlots = [];
    render();
    return;
  }
  if (name === "open-contract-tpl-modal") {
    showContractTplModal = true;
    editingContractTplId = null;
    render();
    return;
  }
  if (name === "close-contract-tpl-modal") {
    showContractTplModal = false;
    editingContractTplId = null;
    render();
    return;
  }
  if (name === "edit-contract-tpl") {
    showContractTplModal = true;
    editingContractTplId = id;
    render();
    return;
  }
  if (name === "save-contract-tpl") {
    const codeVal = ($("#tpl_code")?.value || "").trim().toUpperCase();
    const nameVal = ($("#tpl_name_ar")?.value || "").trim();
    const descVal = ($("#tpl_desc")?.value || "").trim();
    const compVal = parseFloat($("#tpl_company_share")?.value) || 0;
    const feeVal = parseFloat($("#tpl_fee_acre")?.value) || 0;
    const billingVal = parseInt($("#tpl_requires_billing")?.value, 10) || 0;
    const activeVal = parseInt($("#tpl_is_active")?.value, 10) !== 0 ? 1 : 0;

    if (!codeVal || !nameVal) return toast("⚠️ يرجى إدخال رمز واسم النموذج التعاقدي");

    const payload = {
      code: codeVal,
      name_ar: nameVal,
      description: descVal,
      default_company_share_pct: compVal,
      default_annual_fee_per_acre: feeVal,
      requires_area_billing: billingVal,
      is_active: activeVal
    };

    if (typeof Api !== "undefined" && typeof Api.createContractTemplate === "function") {
      let res;
      if (editingContractTplId) {
        res = await Api.updateContractTemplate(editingContractTplId, payload);
      } else {
        payload.id = `tpl_${codeVal.toLowerCase()}_${Date.now()}`;
        res = await Api.createContractTemplate(payload);
      }
      if (res && res.success) {
        toast("✓ تم حفظ قالب التعاقد بنجاح");
        const listRes = await Api.getContractTemplates();
        if (listRes && listRes.success) {
          Store.set({ contractTemplates: listRes.templates });
        }
      } else {
        toast(res?.error || "⚠️ تعذر حفظ قالب التعاقد", "warn");
      }
    }
    showContractTplModal = false;
    editingContractTplId = null;
    render();
    return;
  }
  if (name === "delete-contract-item") {
    if (!confirm("هل أنت متأكد من رغبتك في حذف هذا العقد الاستثماري؟ سيتم فك ارتباط القطع المخصصة له.")) return;
    if (typeof Api !== "undefined" && typeof Api.deleteContract === "function") {
      const res = await Api.deleteContract(id);
      if (res && res.success) {
        toast("✓ تم حذف العقد بنجاح");
        if (editingInvestorId) {
          const fresh = await Api.getInvestor(editingInvestorId);
          if (fresh && fresh.success) {
            editingInvestorData = fresh;
          }
        }
      } else {
        toast(res?.error || "⚠️ تعذر حذف العقد", "warn");
      }
    }
    render();
    return;
  }
  if (name === "open-edit-plot-modal") {
    openEditPlotModal(id);
    return;
  }
  if (name === "close-plot-edit-modal") {
    showPlotEditModal = false;
    editingPlotId = null;
    editingPlotData = null;
    render();
    return;
  }
  if (name === "switch-plot-edit-tab") {
    plotEditActiveTab = id || "general";
    render();
    return;
  }
  if (name === "plot-get-geolocation") {
    if (!navigator.geolocation) return toast("⚠️ خاصية تحديد الموقع غير مدعومة في متصفحك");
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        plotEditCorners[0] = { label: "الشمال الشرقي (NE)", lat: (lat + 0.0005).toFixed(6), lng: (lng + 0.0005).toFixed(6) };
        plotEditCorners[1] = { label: "الجنوب الشرقي (SE)", lat: (lat - 0.0005).toFixed(6), lng: (lng + 0.0005).toFixed(6) };
        plotEditCorners[2] = { label: "الجنوب الغربي (SW)", lat: (lat - 0.0005).toFixed(6), lng: (lng - 0.0005).toFixed(6) };
        plotEditCorners[3] = { label: "الشمال الغربي (NW)", lat: (lat + 0.0005).toFixed(6), lng: (lng - 0.0005).toFixed(6) };
        toast(`✓ تم جلب إحداثيات موقعك الحالي: ${lat}, ${lng}`);
        render();
      },
      err => {
        toast("⚠️ تعذر جلب إحداثيات الموقع: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
    return;
  }
  if (name === "save-plot-edit") {
    if (!editingPlotId) return;
    const nameVal = ($("#plot_edit_name")?.value || "").trim();
    const parentVal = $("#plot_edit_parent")?.value || null;
    const areaVal = parseFloat($("#plot_edit_area_val")?.value) || null;
    const areaUnit = $("#plot_edit_area_unit")?.value || "فدان";
    const cropVal = $("#plot_edit_crop")?.value || "";
    const irrigationVal = ($("#plot_edit_irrigation")?.value || "").trim();
    const contractVal = $("#plot_edit_contract")?.value || null;
    const notesVal = ($("#plot_edit_notes")?.value || "").trim();

    const corners = [];
    for (let i = 0; i < 4; i++) {
      const latEl = $(`#corner_${i}_lat`);
      const lngEl = $(`#corner_${i}_lng`);
      if (latEl && lngEl) {
        const cLat = parseFloat(latEl.value);
        const cLng = parseFloat(lngEl.value);
        if (!isNaN(cLat) && !isNaN(cLng)) {
          corners.push([cLat, cLng]);
          plotEditCorners[i].lat = cLat;
          plotEditCorners[i].lng = cLng;
        }
      } else if (plotEditCorners[i] && plotEditCorners[i].lat && plotEditCorners[i].lng) {
        const cLat = parseFloat(plotEditCorners[i].lat);
        const cLng = parseFloat(plotEditCorners[i].lng);
        if (!isNaN(cLat) && !isNaN(cLng)) {
          corners.push([cLat, cLng]);
        }
      }
    }

    const payload = {
      name: nameVal || editingPlotId,
      parentPlotId: parentVal,
      parent_plot_id: parentVal,
      areaValue: areaVal,
      area_value: areaVal,
      areaUnit: areaUnit,
      area_unit: areaUnit,
      mainCrop: cropVal,
      main_crop: cropVal,
      irrigationSource: irrigationVal,
      irrigation_source: irrigationVal,
      contractRef: contractVal,
      contract_ref: contractVal,
      notes: notesVal
    };

    if (corners.length >= 3) {
      payload.boundaryCoordinates = corners;
      payload.boundary_coordinates = corners;
    }

    const currentPlot = (st.plots || []).find(p => p.id === editingPlotId);
    if (currentPlot) {
      Object.assign(currentPlot, payload);
    } else {
      st.plots = st.plots || [];
      const secId = editingPlotData?.sector || (editingPlotId.includes('-') ? editingPlotId.split('-')[0] : '01');
      st.plots.push({
        id: editingPlotId,
        sector: secId,
        ...payload
      });
    }
    Store.set({ plots: st.plots });

    if (typeof Api !== "undefined" && typeof Api.updatePlot === "function") {
      const res = await Api.updatePlot(editingPlotId, payload);
      if (res && res.success) {
        toast("✓ تم حفظ بيانات وإحداثيات القطعة بنجاح");
      } else {
        toast(res?.error || "⚠️ تم الحفظ محلياً فقط", "warn");
      }
    } else {
      toast("✓ تم حفظ بيانات القطعة محلياً");
    }

    showPlotEditModal = false;
    editingPlotId = null;
    editingPlotData = null;
    render();
    return;
  }
  return ACT_NEXT;
}
