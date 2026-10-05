// PalmTrace app — UI action handlers, part 3 of 9 (starts at: name === "move-dash-w")
// (split from the former single app.js; files are classic scripts loaded in order by index.html)

async function actionsPart03(name, id, el, st) {
  if (name === "move-dash-w") {
    const dir = el?.dataset?.dir || "up";
    const order = getDashWidgetsOrder();
    const idx = order.indexOf(id);
    if (idx !== -1) {
      if (dir === "up" && idx > 0) {
        const temp = order[idx - 1];
        order[idx - 1] = order[idx];
        order[idx] = temp;
      } else if (dir === "down" && idx < order.length - 1) {
        const temp = order[idx + 1];
        order[idx + 1] = order[idx];
        order[idx] = temp;
      }
      setDashWidgetsOrder(order);
      render();
    }
    return;
  }
  if (name === "reset-dash-layout") {
    try { localStorage.removeItem("dash_widgets_order"); } catch {}
    toast("تمت استعادة الترتيب الافتراضي لمكونات الشاشة");
    render();
    return;
  }
  if (name === "dash-variety") {
    browseSec = null; browsePlot = null; palmQ = id;
    browseCrop = dashCrop === "all" ? "" : dashCrop;
    palmPage = 1; go("palms"); return;
  }
  if (name === "dash-status") {
    browseSec = null; browsePlot = null; palmQ = id;
    browseCrop = dashCrop === "all" ? "" : dashCrop;
    palmPage = 1; go("palms"); return;
  }
  if (name === "clear-palm-filter") {
    palmQ = ""; palmPage = 1; render(); return;
  }
  if (name === "ops-sec-change") {
    opsSec = id !== undefined ? id : ($("#opssec")?.value || "");
    opsPlot = "";
    opsPage = 1;
    render();
    return;
  }
  if (name === "quick-pick-plot-ops") {
    showOpsPlotPickModal = true;
    render();
    return;
  }
  if (name === "close-ops-plot-pick") {
    showOpsPlotPickModal = false;
    render();
    return;
  }
  if (name === "select-base-plot-ops") {
    const bId = id;
    let count = 0;
    st.operations.forEach(o => {
      const p = palmById(o?.palmId);
      if (p?.plot && (p.plot.startsWith(bId) || plotBaseId(p.plot) === bId)) {
        opsSelectedIds.add(o.id);
        count++;
      }
    });
    showOpsPlotPickModal = false;
    if (count > 0) {
      toast(`✓ تم تحديد ${count} عملية للقطعة ${plotBaseNumber(bId)} (كافة الأجزاء) بنجاح`);
    } else {
      toast(`لا توجد عمليات مسجلة تابعة للقطعة ${plotBaseNumber(bId)}`);
    }
    render();
    return;
  }
  if (name === "tog-ops-advanced") {
    showOpsAdvancedFilters = !showOpsAdvancedFilters;
    render();
    return;
  }
  if (name === "kpi-ops-filter") {
    const filter = id || el?.dataset?.filter;
    if (filter === "all") {
      opsCritOnly = false;
      opsSt = "";
      opsType = "";
      opsPage = 1;
    } else if (filter === "pending") {
      opsCritOnly = false;
      opsSt = "pending";
      opsType = "";
      opsPage = 1;
    } else if (filter === "crit") {
      opsCritOnly = true;
      opsSt = "";
      opsType = "";
      opsPage = 1;
    } else if (filter === "approved") {
      opsCritOnly = false;
      opsSt = "approved";
      opsType = "";
      opsPage = 1;
    }
    render();
    return;
  }
  if (name === "reset-ops-filters") {
    opsQ = ""; opsCrop = ""; opsSec = ""; opsPlot = "";
    opsType = ""; opsSt = ""; opsRange = "all"; opsSize = 50;
    opsCritOnly = false;
    opsPage = 1;
    showOpsAdvancedFilters = false;
    opsSelectedIds.clear();
    toast("تمت إعادة ضبط كافة الفلاتر");
    render();
    return;
  }
  if (name === "ops-crop-change") {
    opsCrop = id || ""; opsType = ""; opsCritOnly = false; opsPage = 1; render(); return;
  }
  if (name === "apply-ops") {
    opsQ = ($("#opsq")?.value || "").trim();
    opsCrop = $("#opscrop")?.value || "";
    opsSec = $("#opssec")?.value || "";
    opsPlot = $("#opsplot")?.value || "";
    const selType = $("#opstype")?.value || "";
    if (selType === "__crit__") {
      opsCritOnly = true;
      opsType = "";
    } else {
      opsCritOnly = false;
      opsType = selType;
    }
    opsSt = $("#opsst")?.value || "";
    opsRange = $("#opsrange")?.value || "all";
    opsSize = +($("#opssize")?.value || 50);
    opsPage = 1;
    render();
    return;
  }
  if (name === "ops-page") { opsPage = +id || 1; render(); return; }
  if (name === "tog-op") { opsOpen = opsOpen === id ? null : id; render(); return; }
  if (name === "reject-op") {
    const o = st.operations.find(x => x.id === id); if (!o) return;
    activeRejectTarget = {
      type: "single",
      id: o.id,
      op: o,
      fertInfo: getOpMaterialInfo(o, st)
    };
    activeRejectActionType = "needs_rework";
    activeRejectFertHandling = "waste";
    activeRejectSupervisorNote = "";
    render();
    return;
  }
  if (name === "bulk-approve" || name === "bulk-reject") {
    const domChecked = $$(".opchk").filter(c => c.checked).map(c => c.value);
    domChecked.forEach(cid => opsSelectedIds.add(cid));
    const ids = [...opsSelectedIds];
    if (!ids.length) return toast("⚠️ يرجى تحديد عمليات أولاً عبر مربعات الاختيار");
    const isApprove = name === "bulk-approve";
    if (isApprove) {
      st.operations.forEach(o => { if (ids.includes(o.id)) o.approval = "approved"; });
      Store.set({ operations: st.operations });
      if (typeof Api !== "undefined") {
        ids.forEach(opId => Api.approveOperation(opId));
      }
      opsSelectedIds.clear();
      if (typeof AuditLog !== "undefined") {
        AuditLog.log({
          action: "bulk_approve",
          module: "operations",
          severity: "info",
          title: `اعتماد جماعي لـ ${ids.length} عملية`,
          summary: `تم اعتماد ${ids.length} عملية ميدانية دفعة واحدة بواسطة ${session()?.name}`,
          details: { count: ids.length, operationIds: ids },
          targetCount: ids.length,
          targetType: "operations_bulk",
          user: session()?.name || "مستخدم",
          role: session()?.role || "worker"
        });
      }
      toast(`✓ تم اعتماد ${ids.length} عملية بنجاح`); render(); return;
    } else {
      const targetOps = st.operations.filter(o => ids.includes(o.id));
      activeRejectTarget = {
        type: "bulk",
        ids: ids,
        ops: targetOps
      };
      activeRejectActionType = "needs_rework";
      activeRejectFertHandling = "waste";
      activeRejectSupervisorNote = "";
      render();
      return;
    }
  }
  if (name === "export-ops") {
    const rows = ["\uFEFFالتاريخ,الكود,المحصول,الصنف,النوع,العامل,الحالة,ملاحظات"];
    opsFiltered().forEach(o => {
      const p = st.palms.find(x=>x.id===o.palmId); const w = userBy(o.workerId);
      const cLabel = p ? cropSingle(p.cropId) : "";
      rows.push(`${fmtDate(o.at)},${p?.code||""},${cLabel},${p?.variety||""},${typeName(o.typeId)},${w?.name||""},${o.approval},${(o.notes||"").replace(/,/g," ")}`);
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rows.join("\n")], {type:"text/csv;charset=utf-8"}));
    a.download = "عمليات_الحقل.csv"; a.click(); return;
  }
  if (name === "batch-approve-op") {
    const batchId = id || el?.getAttribute("data-batch") || el?.dataset?.batch || el?.dataset?.id;
    if (!batchId) return;
    const batchOps = st.operations.filter(o => 
      o.batchId === batchId || o.bulkId === batchId || (o.device && o.device === "bulk:" + batchId) || o.id === batchId
    );
    if (!batchOps.length) return toast("لم يتم العثور على سجلات الحزمة");
    batchOps.forEach(o => {
      o.approval = "approved";
      o.status = "synced";
    });
    const rep = batchOps[0];
    const tName = typeName(rep.typeId);
    const totalTrees = rep.treeCount || batchOps.length;
    st.notifications = st.notifications || [];
    if (rep.workerId) {
      st.notifications.push({
        id: Store.uid("n"),
        userId: rep.workerId,
        text: `✅ تم اعتماد الحزمة الجماعية [${tName}] (${totalTrees} شجرة) بنجاح`,
        at: new Date().toISOString(),
        type: "approval",
        targetView: "ops-records",
        read: false
      });
    }
    Store.set({ operations: st.operations, notifications: st.notifications });
    if (typeof Api !== "undefined" && Api.batchApproveOperations) {
      Api.batchApproveOperations(batchId, batchOps.map(o => o.id), "تم الاعتماد الجماعي بنجاح");
    }
    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "batch_approve_operation",
        module: "operations",
        severity: "info",
        title: `اعتماد حزمة عمليات جماعية: ${tName}`,
        summary: `تم اعتماد حزمة جماعية كاملة تضم ${totalTrees} شجرة بنقرة واحدة`,
        details: { batchId, count: totalTrees, typeId: rep.typeId, workerId: rep.workerId },
        targetType: "batch_operations",
        targetId: batchId,
        user: session()?.name || "مستخدم",
        role: session()?.role || "engineer"
      });
    }
    inspectedBatchId = null;
    toast(`✓ تم اعتماد الحزمة الجماعية (${totalTrees} شجرة) بنجاح`);
    render();
    return;
  }

  if (name === "batch-reject-op") {
    const batchId = id || el?.getAttribute("data-batch") || el?.dataset?.batch || el?.dataset?.id;
    if (!batchId) return;
    const batchOps = st.operations.filter(o => 
      o.batchId === batchId || o.bulkId === batchId || (o.device && o.device === "bulk:" + batchId) || o.id === batchId
    );
    if (!batchOps.length) return toast("لم يتم العثور على سجلات الحزمة");
    const rep = batchOps[0];
    const fertInfo = getOpMaterialInfo(rep, st);
    if (fertInfo && batchOps.length > 1 && !rep.device?.startsWith("bulk:")) {
      fertInfo.totalQty = (fertInfo.qty || 0) * batchOps.length;
    }
    inspectedBatchId = null;
    activeRejectTarget = {
      type: "batch",
      id: batchId,
      batchId: batchId,
      ops: batchOps,
      rep: rep,
      fertInfo: fertInfo
    };
    activeRejectActionType = "needs_rework";
    activeRejectFertHandling = "waste";
    activeRejectSupervisorNote = "";
    render();
    return;
  }

  if (name === "close-reject-modal") {
    activeRejectTarget = null;
    activeRejectSupervisorNote = "";
    render();
    return;
  }

  if (name === "set-reject-action") {
    const cur = $("#reject_supervisor_note")?.value;
    if (cur !== undefined) activeRejectSupervisorNote = cur;
    activeRejectActionType = id || "needs_rework";
    render();
    return;
  }

  if (name === "set-reject-fert") {
    const cur = $("#reject_supervisor_note")?.value;
    if (cur !== undefined) activeRejectSupervisorNote = cur;
    activeRejectFertHandling = id || "waste";
    render();
    return;
  }

  if (name === "pick-reject-tag") {
    const tag = id || el?.getAttribute("data-tag") || "";
    const noteEl = $("#reject_supervisor_note");
    let currentVal = noteEl ? noteEl.value.trim() : (activeRejectSupervisorNote || "").trim();
    if (currentVal) {
      if (!currentVal.includes(tag)) {
        currentVal = currentVal + " - " + tag;
      }
    } else {
      currentVal = tag;
    }
    activeRejectSupervisorNote = currentVal;
    if (noteEl) {
      noteEl.value = currentVal;
      noteEl.focus();
    }
    return;
  }

  if (name === "confirm-reject-modal") {
    if (!activeRejectTarget) return;
    const note = ($("#reject_supervisor_note")?.value || activeRejectSupervisorNote || "").trim();
    const actionType = activeRejectActionType || "needs_rework";
    const fertHandling = activeRejectFertHandling || "waste";
    const isRework = actionType === "needs_rework";

    const targetOps = activeRejectTarget.type === "single" 
      ? [activeRejectTarget.op] 
      : (activeRejectTarget.ops || []);

    if (!targetOps.length) {
      activeRejectTarget = null;
      activeRejectSupervisorNote = "";
      render();
      return;
    }

    targetOps.forEach(op => {
      op.approval = actionType;
      op.supervisorNote = note;
      op.rejectedAt = new Date().toISOString();
      op.rejectedBy = session()?.id;
      op.fertHandling = fertHandling;
    });

    // Fertilizer handling: refund to stock or record as operational loss (waste)
    if (fertHandling === "refund") {
      st.fertilizers = st.fertilizers || [];
      targetOps.forEach(op => {
        const fInfo = getOpMaterialInfo(op, st);
        if (fInfo) {
          const fert = st.fertilizers.find(f => f.name === fInfo.material || f.id === fInfo.material || f.id === fInfo.fertId);
          if (fert) {
            let refundQty = fInfo.totalQty || fInfo.qty || 0;
            if (fert.unit === "كجم" && fInfo.unit === "جم") refundQty = refundQty / 1000;
            else if (fert.unit === "جم" && fInfo.unit === "كجم") refundQty = refundQty * 1000;

            if (refundQty > 0) {
              fert.stock = (fert.stock || 0) + refundQty;
              fert.consumed = Math.max(0, (fert.consumed || 0) - refundQty);
              if (typeof AuditLog !== "undefined") {
                AuditLog.log({
                  action: "material_refund",
                  module: "inventory",
                  severity: "info",
                  title: `استرداد سماد/مبيد للمخزن: ${fert.name}`,
                  summary: `تم استرجاع ${refundQty} ${fert.unit} إلى رصيد عهدة المخزن بعد إلغاء العملية وعدم استخدام المادة ميدانياً`,
                  details: { fertId: fert.id, fertName: fert.name, refundQty, opId: op.id },
                  targetType: "fertilizer",
                  targetId: fert.id,
                  user: session()?.name || "مشرف",
                  role: session()?.role || "engineer"
                });
              }
            }
          }
        }
      });
      Store.set({ fertilizers: st.fertilizers });
    } else if (fertHandling === "waste") {
      targetOps.forEach(op => {
        const fInfo = getOpMaterialInfo(op, st);
        if (fInfo && (fInfo.qty > 0 || fInfo.totalQty > 0)) {
          const qty = fInfo.totalQty || fInfo.qty;
          if (typeof AuditLog !== "undefined") {
            AuditLog.log({
              action: "material_waste",
              module: "operations",
              severity: "warning",
              title: `تسجيل فاقد وهدر مواد: ${fInfo.material}`,
              summary: `تم تسجيل ${qty} ${fInfo.unit} من [${fInfo.material}] كفاقد وهدر تشغيلي نتيجة استهلاكها الحركي في عملية مرفوضة التنفيذ`,
              details: { opId: op.id, material: fInfo.material, qty, unit: fInfo.unit, supervisorNote: note },
              targetType: "operation",
              targetId: op.id,
              user: session()?.name || "مشرف",
              role: session()?.role || "engineer"
            });
          }
        }
      });
    }

    // Notifications to workers
    st.notifications = st.notifications || [];
    targetOps.forEach(op => {
      if (op.workerId) {
        const p = palmById(op.palmId);
        const palmLabel = p ? `لنخلة ${p.code}` : `عملية ${op.palmCode || ''}`;
        const notifText = isRework 
          ? `🔄 مطلوب إعادة تنفيذ وتصحيح عملية [${typeName(op.typeId)}] ${palmLabel}. توجيه المشرف: ${note || 'يرجى مراجعة المعايير'}`
          : `🚫 تم إلغاء العملية [${typeName(op.typeId)}] ${palmLabel} وإغلاقها نهائياً. السبب: ${note || 'لا يوجد'}`;

        st.notifications.push({
          id: Store.uid("n"),
          userId: op.workerId,
          text: notifText,
          at: new Date().toISOString(),
          type: isRework ? "rework" : "voided",
          targetView: isRework ? "worker-rework" : "ops-records",
          targetId: op.id,
          read: false
        });
      }
    });

    Store.set({ operations: st.operations, notifications: st.notifications });

    // Sync with backend API
    if (typeof Api !== "undefined") {
      if (activeRejectTarget.type === "single") {
        Api.rejectOperation(activeRejectTarget.op.id, note, actionType);
      } else if (activeRejectTarget.type === "batch") {
        Api.batchRejectOperations(activeRejectTarget.batchId, targetOps.map(o => o.id), note, actionType);
      } else if (activeRejectTarget.type === "bulk") {
        targetOps.forEach(o => Api.rejectOperation(o.id, note, actionType));
      }
    }

    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: isRework ? "operation_needs_rework" : "operation_voided",
        module: "operations",
        severity: isRework ? "warning" : "info",
        title: isRework ? `طلب إعادة تنفيذ: ${targetOps.length} عملية` : `إلغاء وإغلاق نهائي: ${targetOps.length} عملية`,
        summary: `تم اعتماد الإجراء [${isRework ? 'طلب إعادة التنفيذ' : 'إلغاء وإغلاق نهائي'}] لعدد ${targetOps.length} عملية بواسطة ${session()?.name}. معالجة المواد: ${fertHandling === 'refund' ? 'استرداد للمخزن' : 'تسجيل كفاقد'}`,
        details: { count: targetOps.length, actionType, fertHandling, note },
        targetType: "operations",
        user: session()?.name || "مشرف",
        role: session()?.role || "engineer"
      });
    }

    if (activeRejectTarget.type === "bulk") opsSelectedIds.clear();
    if (activeRejectTarget.type === "batch") inspectedBatchId = null;
    activeRejectTarget = null;
    activeRejectSupervisorNote = "";

    toast(isRework ? `✓ تم إرسال طلب إعادة التنفيذ بنجاح (${targetOps.length} عملية)` : `✓ تم إلغاء وإغلاق العمليات نهائياً (${targetOps.length} عملية)`);
    render();
    return;
  }

  if (name === "rework-op") {
    const o = st.operations.find(x => x.id === id);
    if (!o) return toast("لم يتم العثور على العملية");
    activeReworkOpId = o.id;
    go("op", o.palmId);
    return;
  }

  if (name === "cancel-rework-op") {
    activeReworkOpId = null;
    render();
    return;
  }

  if (name === "inspect-batch") {
    inspectedBatchId = id || el?.getAttribute("data-batch") || el?.dataset?.batch || el?.dataset?.id;
    render();
    return;
  }

  if (name === "close-batch-modal") {
    inspectedBatchId = null;
    render();
    return;
  }

  if (name === "go-palm-from-batch") {
    inspectedBatchId = null;
    go("palm", id);
    return;
  }

  if (name === "open-field-note-modal") {
    activeFieldNotePalmId = id;
    fieldNoteTargetType = "ALL_TEAM";
    render();
    return;
  }

  if (name === "close-field-note-modal") {
    activeFieldNotePalmId = null;
    render();
    return;
  }

  if (name === "fn-scope-tog") {
    fieldNoteTargetType = id || "ALL_TEAM";
    render();
    return;
  }

  if (name === "save-field-note") {
    const palmId = activeFieldNotePalmId;
    const p = findPalm(palmId);
    if (!p) return toast("الشجرة غير محددة");
    const title = ($("#fn_title")?.value || "").trim();
    if (!title) return toast("يرجى إدخال عنوان أو نوع الملاحظة");
    const notes = ($("#fn_notes")?.value || "").trim();
    const priority = $("#fn_prio")?.value || "normal";
    const targetType = fieldNoteTargetType || "ALL_TEAM";
    const assignedTo = targetType === "INDIVIDUAL" ? ($("#fn_assigned")?.value || null) : null;
    if (targetType === "INDIVIDUAL" && !assignedTo) {
      return toast("⚠️ يرجى اختيار فني/عامل مخصص لهذه القطعة، أو التكليف لـ (فريق العمل الميداني)");
    }
    const me = session() || {};
    const creatorName = me.name || "المشرف";
    const creatorRole = roleLabel(me.role) || me.role || "إشراف";
    const assignedUserObj = assignedTo ? (st.users || []).find(u => String(u.id) === String(assignedTo)) : null;
    const assignedUserName = assignedUserObj ? assignedUserObj.name : null;

    const noteObj = {
      id: Store.uid("tn"),
      palmId: p.id,
      palmCode: p.code,
      createdBy: me.id,
      created_by: me.id,
      authorId: me.id,
      author_id: me.id,
      authorName: creatorName,
      authorRole: me.role,
      targetType: targetType,
      target_type: targetType,
      visibilityScope: targetType === "INDIVIDUAL" ? "USER" : "ALL",
      visibility_scope: targetType === "INDIVIDUAL" ? "USER" : "ALL",
      assignedTo: assignedTo,
      assigned_to: assignedTo,
      assignedToUserId: assignedTo,
      assignedToUserName: assignedUserName,
      assigned_to_user_name: assignedUserName,
      priority: priority,
      title: title,
      noteType: title,
      note_type: title,
      notes: notes,
      content: notes,
      status: "pending",
      createdAt: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    st.treeNotes = st.treeNotes || [];
    st.treeNotes.unshift(noteObj);
    Store.set({ treeNotes: st.treeNotes });

    if (typeof Api !== "undefined" && Api.createTreeNote) {
      Api.createTreeNote(noteObj);
    }

    st.notifications = st.notifications || [];
    const notifText = `📋 تكليف ميداني جديد من: ${creatorName} (${creatorRole}) — [${title}] على نخلة ${p.code} (${priority === 'urgent' ? '🔴 عاجل' : 'مطلوب'})`;
    const { workers: plotWorkers } = getWorkersAllowedOnPalm(p, st);
    if (assignedTo) {
      st.notifications.push({
        id: Store.uid("n"),
        userId: assignedTo,
        senderId: me.id,
        senderName: creatorName,
        senderRole: creatorRole,
        text: notifText,
        at: new Date().toISOString(),
        type: "task",
        targetView: "palm",
        targetId: p.id,
        read: false
      });
    } else {
      (plotWorkers || []).forEach(w => {
        st.notifications.push({
          id: Store.uid("n"),
          userId: w.id,
          senderId: me.id,
          senderName: creatorName,
          senderRole: creatorRole,
          text: notifText,
          at: new Date().toISOString(),
          type: "task",
          targetView: "palm",
          targetId: p.id,
          read: false
        });
      });
    }
    Store.set({ notifications: st.notifications });

    activeFieldNotePalmId = null;
    toast(`✓ تم توجيه التكليف الميداني لنخلة ${p.code} بنجاح`);
    render();
    return;
  }

  if (name === "start-note") {
    const n = (st.treeNotes || []).find(x => x.id === id);
    if (!n) return;
    n.status = "in_progress";
    n.updatedAt = new Date().toISOString();
    Store.set({ treeNotes: st.treeNotes });
    if (typeof Api !== "undefined" && Api.startTreeNote) {
      Api.startTreeNote(id);
    }
    toast("🚜 بدأت المهمة، يمكنك الآن تنفيذها وتوثيقها");
    render();
    return;
  }

  if (name === "open-complete-note-modal") {
    completingFieldNoteId = id;
    render();
    return;
  }

  if (name === "close-complete-note-modal") {
    completingFieldNoteId = null;
    render();
    return;
  }

  if (name === "submit-complete-note") {
    const noteId = completingFieldNoteId;
    if (!noteId) return;
    const n = (st.treeNotes || []).find(x => x.id === noteId);
    if (!n) return;
    const executionNotes = ($("#fnc_notes")?.value || "").trim();
    const photoFile = $("#fnc_photo_file")?.files?.[0];

    const doComplete = (proofPhoto) => {
      n.status = "completed";
      n.completionNotes = executionNotes;
      n.completion_notes = executionNotes;
      n.completionPhoto = proofPhoto;
      n.completion_photo = proofPhoto;
      n.completedBy = session()?.id;
      n.completed_by = session()?.id;
      n.completedAt = new Date().toISOString();
      n.completed_at = n.completedAt;
      n.updatedAt = n.completedAt;

      Store.set({ treeNotes: st.treeNotes });
      if (typeof Api !== "undefined" && Api.completeTreeNote) {
        Api.completeTreeNote(noteId, executionNotes, proofPhoto);
      }

      const workerUser = session() || {};
      const workerRole = roleLabel(workerUser.role) || "فني ميداني";
      const workerName = workerUser.name || "العامل";
      const supervisorId = n.createdBy || n.authorId;
      st.notifications = st.notifications || [];
      if (supervisorId) {
        st.notifications.push({
          id: Store.uid("n"),
          userId: supervisorId,
          senderId: workerUser.id,
          senderName: workerName,
          senderRole: workerRole,
          text: `📸 تم إنجاز وتوثيق التكليف [${n.title}] على نخلة ${n.palmCode} بواسطة ${workerName} (${workerRole}) بانتظار اعتمادك`,
          at: new Date().toISOString(),
          type: "task",
          targetView: "palm",
          targetId: n.palmId,
          read: false
        });
        Store.set({ notifications: st.notifications });
      }

      completingFieldNoteId = null;
      toast("✓ تم توثيق إنجاز المهمة بنجاح وإرسالها لاعتماد المشرف");
      render();
    };

    if (photoFile) {
      const rd = new FileReader();
      rd.onload = (ev) => doComplete(ev.target.result);
      rd.onerror = () => doComplete("");
      rd.readAsDataURL(photoFile);
    } else {
      doComplete("");
    }
    return;
  }

  if (name === "close-note") {
    const n = (st.treeNotes || []).find(x => x.id === id);
    if (!n) return;
    n.status = "closed";
    n.closedBy = session()?.id;
    n.closed_by = session()?.id;
    n.closedAt = new Date().toISOString();
    n.closed_at = n.closedAt;
    n.updatedAt = n.closedAt;
    Store.set({ treeNotes: st.treeNotes });
    if (typeof Api !== "undefined" && Api.closeTreeNote) {
      Api.closeTreeNote(id);
    }
    st.notifications = st.notifications || [];
    const closer = session() || {};
    const closerName = closer.name || "المشرف";
    const closerRole = roleLabel(closer.role) || "إدارة المزرعة";
    if (n.completedBy || n.completed_by) {
      st.notifications.push({
        id: Store.uid("n"),
        userId: n.completedBy || n.completed_by,
        senderId: closer.id,
        senderName: closerName,
        senderRole: closerRole,
        text: `✅ تم اعتماد وإغلاق التكليف الميداني [${n.title}] على نخلة ${n.palmCode} من قِبل ${closerName} (${closerRole})`,
        at: new Date().toISOString(),
        type: "approval",
        targetView: "palm",
        targetId: n.palmId,
        read: false
      });
      Store.set({ notifications: st.notifications });
    }
    toast("✓ تم اعتماد وإغلاق التكليف الميداني بنجاح");
    render();
    return;
  }

  if (name === "go-palm-from-note") {
    go("palm", id);
    return;
  }

  if (name === "approve-op") {
    const o = st.operations.find(x => x.id === id); if (!o) return;
    o.approval = "approved"; o.status = "synced";
    const p = palmById(o.palmId);
    const pl = st.plots.find(x => x.id === p?.plot);
    const locTag = p ? ` لنخلة ${p.code}${pl ? ` (قطعة ${pl.name || pl.id})` : ''}` : "";
    st.notifications = st.notifications || [];
    if (o.workerId) {
      st.notifications.push({
        id: Store.uid("n"),
        userId: o.workerId,
        text: `✅ تم اعتماد عمليتك [${typeName(o.typeId)}]${locTag} بنجاح`,
        at: new Date().toISOString(),
        type: "approval",
        targetView: "op-detail",
        targetId: o.id,
        read: false
      });
    }
    Store.set({ operations: st.operations, notifications: st.notifications });
    if (typeof Api !== "undefined") {
      Api.approveOperation(o.id, o.supervisorNote);
    }
    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "approve_operation",
        module: "operations",
        severity: "info",
        title: `اعتماد عملية: ${typeName(o.typeId)}`,
        summary: `تم اعتماد عملية [${typeName(o.typeId)}] للشجرة ${p?.code || o.palmId} بنجاح`,
        details: { opId: o.id, palmCode: p?.code, typeId: o.typeId, workerId: o.workerId },
        targetType: "operation",
        targetId: o.id,
        targetCode: p?.code,
        user: session()?.name || "مستخدم",
        role: session()?.role || "worker"
      });
    }
    toast("تم الاعتماد — أُغلق التعديل"); render(); return;
  }
  if (name === "note-op") {
    const o = st.operations.find(x => x.id === id); if (!o) return;
    o.supervisorNote = $("#snote")?.value || "";
    const p = palmById(o.palmId);
    const pl = st.plots.find(x => x.id === p?.plot);
    const locTag = p ? ` لنخلة ${p.code}${pl ? ` (قطعة ${pl.name || pl.id})` : ''}` : "";
    st.notifications = st.notifications || [];
    st.notifications.push({
      id: Store.uid("n"),
      userId: o.workerId,
      text: `📝 ملاحظة مشرف على [${typeName(o.typeId)}]${locTag}: "${o.supervisorNote}"`,
      at: new Date().toISOString(),
      type: "note",
      targetView: "op-detail",
      targetId: o.id,
      read: false
    });
    Store.set({ operations: st.operations, notifications: st.notifications });
    toast("أُرسلت ملاحظة للعامل"); render(); return;
  }
  if (name === "notif-filter") {
    notifFilter = id || "all";
    render();
    return;
  }
  if (name === "mark-all-notifs-read") {
    const me = session();
    if (me && st.notifications) {
      st.notifications.forEach(n => { if (n.userId === me.id) n.read = true; });
      Store.set({ notifications: st.notifications });
      toast("تم تحديد كافة الإشعارات كمقروءة");
      render();
    }
    return;
  }
  if (name === "clear-my-notifs") {
    const me = session();
    if (me && st.notifications) {
      st.notifications = st.notifications.filter(n => n.userId !== me.id);
      Store.set({ notifications: st.notifications });
      toast("تم مسح كافة إشعاراتك");
      render();
    }
    return;
  }
  if (name === "open-notif") {
    const me = session();
    const notif = (st.notifications || []).find(n => n.id === id);
    if (!notif) return;
    notif.read = true;
    Store.set({ notifications: st.notifications });

    if (notif.targetSeason) {
      zakatSeason = notif.targetSeason;
    }
    if (notif.targetView) {
      go(notif.targetView, notif.targetId);
      return;
    }
    if (notif.scheduleId) {
      go("bulk-op");
      return;
    }
    if (notif.text && (notif.text.includes("صرف") || notif.text.includes("سماد") || notif.text.includes("توريد"))) {
      go("fertilizers");
      return;
    }
    if (notif.type === "zakat" || (notif.text && notif.text.includes("زكاة"))) {
      if (notif.targetSeason) zakatSeason = notif.targetSeason;
      go(me?.role === "investor" ? "inv-zakat" : "zakat-admin");
      return;
    }
    if (notif.text && (notif.text.includes("عملية") || notif.text.includes("ملاحظة"))) {
      go("ops-admin");
      return;
    }
    render();
    return;
  }
  if (name === "ops-admin-tab") {
    opsAdminTab = id;
    render();
    return;
  }
  if (name === "sch-scope-change") {
    saveScheduleDraftFromDom();
    schPlotScope = id || ($("#sch_scope_sel")?.value || "all");
    render();
    return;
  }
  if (name === "sch-sec-change") {
    saveScheduleDraftFromDom();
    schPlotSec = id !== undefined ? id : ($("#sch_sec")?.value || "");
    schPlotSearch = "";
    render();
    return;
  }
  if (name === "sch-plot-add") {
    saveScheduleDraftFromDom();
    const v = $("#sch_plot_add")?.value;
    if (v) { schSelectedPlots.add(v); schPlotScope = "custom"; toast("تمت إضافة القطعة للجدول"); }
    else toast("اختر قطعة أولاً");
    render();
    return;
  }
  if (name === "sch-plot-add-all") {
    saveScheduleDraftFromDom();
    const plots = scopedFieldPlots();
    const curSec = schPlotSec !== "" ? schPlotSec : ($("#sch_sec")?.value || "");
    const matchingPlots = plots.filter(p => {
      if (curSec && curSec !== "all" && p.sector !== curSec) return false;
      if (schPlotSearch) {
        const q = schPlotSearch.trim().toLowerCase();
        const full = ((p.name||"") + " " + (p.id||"")).toLowerCase();
        if (!full.includes(q)) return false;
      }
      return true;
    });
    if (!matchingPlots.length) return toast("لا توجد قطع مطابقة لإضافتها");
    matchingPlots.forEach(p => schSelectedPlots.add(p.id));
    schPlotScope = "custom";
    toast(`تمت إضافة كافة القطع المطابقة (${matchingPlots.length} قطعة) للجدول`);
    render();
    return;
  }
  if (name === "sch-plot-drop") {
    saveScheduleDraftFromDom();
    schSelectedPlots.delete(id);
    render();
    return;
  }
  if (name === "sch-plot-clear") {
    saveScheduleDraftFromDom();
    schSelectedPlots.clear();
    toast("تم مسح القطع المختارة");
    render();
    return;
  }
  if (name === "tog-sch-form") {
    showScheduleForm = !showScheduleForm;
    schDraft = null;
    if (!showScheduleForm) {
      editScheduleId = null;
      schSelectedPlots.clear();
      schPlotSearch = "";
    } else {
      schSelectedPlots.clear();
      schPlotSearch = "";
      schPlotScope = "all";
      schPlotSec = "";
    }
    render();
    return;
  }
  if (name === "edit-schedule") {
    schDraft = null;
    if (!hasPerm("ops_schedule_manage")) return toast("ليس لديك صلاحية تعديل جداول الرعاية");
    editScheduleId = id;
    showScheduleForm = true;
    opsAdminTab = "schedules";
    const sch = (st.operationSchedules || []).find(s => s.id === id);
    schSelectedPlots.clear();
    schPlotSearch = "";
    if (sch) {
      schPlotSec = (sch.sectorId && sch.sectorId !== "all") ? sch.sectorId : "";
      if (sch.plotIds && sch.plotIds.length) {
        sch.plotIds.forEach(pid => schSelectedPlots.add(pid));
        schPlotScope = "custom";
      } else if (sch.plotId && sch.plotId !== "all") {
        if (sch.plotId.startsWith("base:")) {
          const bId = sch.plotId.slice(5);
          st.plots.filter(p => p.id.startsWith(bId) || plotBaseId(p) === bId).forEach(p => schSelectedPlots.add(p.id));
        } else {
          schSelectedPlots.add(sch.plotId);
        }
        schPlotScope = "custom";
      } else {
        schPlotScope = "all";
      }
    }
    render();
    return;
  }
  if (name === "del-schedule") {
    if (!hasPerm("ops_schedule_manage")) return toast("ليس لديك صلاحية حذف جداول الرعاية");
    st.operationSchedules = (st.operationSchedules || []).filter(s => s.id !== id);
    Store.set({ operationSchedules: st.operationSchedules });
    toast("تم حذف جدول الرعاية بنجاح");
    render();
    return;
  }
  if (name === "tog-sch-active") {
    if (!hasPerm("ops_schedule_manage")) return toast("ليس لديك صلاحية تعديل حالة الجداول");
    const sch = (st.operationSchedules || []).find(s => s.id === id);
    if (sch) {
      sch.active = sch.active === false ? true : false;
      Store.set({ operationSchedules: st.operationSchedules });
      toast(sch.active ? "تم تفعيل جدول الرعاية وإعادة تشغيل التذكيرات" : "تم إيقاف جدول الرعاية مؤقتاً");
      render();
    }
    return;
  }
  if (name === "save-schedule") {
    if (!hasPerm("ops_schedule_manage")) return toast("ليس لديك صلاحية حفظ جداول الرعاية");
    const title = $("#sch_title")?.value?.trim();
    if (!title) return toast("يرجى إدخال عنوان خطة الرعاية");
    const cropId = $("#sch_crop")?.value || "all";
    const opTypeId = $("#sch_type")?.value || "op1";
    const sectorId = $("#sch_sec")?.value || schPlotSec || "all";
    let plotId = "all";
    let plotIds = [];
    if (schPlotScope === "custom" && schSelectedPlots.size > 0) {
      plotIds = [...schSelectedPlots];
      plotId = plotIds.length === 1 ? plotIds[0] : (plotBaseId(plotIds[0]) ? `base:${plotBaseId(plotIds[0])}` : plotIds[0]);
    } else {
      plotId = $("#sch_plot")?.value || "all";
      if (plotId !== "all") plotIds = [plotId];
    }
    const intervalDays = Math.max(1, parseInt($("#sch_interval")?.value, 10) || 7);
    const nextDueDate = $("#sch_next_due")?.value || new Date().toISOString().slice(0, 10);
    const priority = $("#sch_priority")?.value || "normal";
    const assignedRole = $("#sch_role")?.value || "worker";
    const assignedUserId = $("#sch_user")?.value || "all";
    const materialName = $("#sch_mat")?.value?.trim() || "";
    const recommendedDose = $("#sch_dose")?.value?.trim() || "";
    const instructions = $("#sch_notes")?.value?.trim() || "";
    const active = $("#sch_active") ? $("#sch_active").checked : true;

    if (!st.operationSchedules) st.operationSchedules = [];

    if (editScheduleId) {
      const sch = st.operationSchedules.find(s => s.id === editScheduleId);
      if (sch) {
        sch.projectId = sch.projectId || st.activeProjectId || "proj_farafra_01";
        sch.title = title;
        sch.cropId = cropId;
        sch.opTypeId = opTypeId;
        sch.sectorId = sectorId;
        sch.plotId = plotId;
        sch.plotIds = plotIds;
        sch.intervalDays = intervalDays;
        sch.nextDueDate = nextDueDate;
        sch.priority = priority;
        sch.assignedRole = assignedRole;
        sch.assignedUserId = assignedUserId;
        sch.materialName = materialName;
        sch.recommendedDose = recommendedDose;
        sch.instructions = instructions;
        sch.active = active;
        toast(`تم تحديث خطة [${title}] بنجاح ✅`);
      }
    } else {
      const newSch = {
        id: Store.uid("sch"),
        projectId: st.activeProjectId || "proj_farafra_01",
        title,
        cropId,
        opTypeId,
        opName: typeName(opTypeId),
        sectorId,
        plotId,
        plotIds,
        intervalDays,
        nextDueDate,
        lastExecutedAt: null,
        assignedRole,
        assignedUserId,
        priority,
        materialName,
        recommendedDose,
        instructions,
        active,
        createdAt: new Date().toISOString(),
        createdBy: session()?.id || "u2"
      };
      st.operationSchedules.push(newSch);
      toast(`تمت إضافة خطة الرعاية [${title}] بنجاح ✅`);
    }
    Store.set({ operationSchedules: st.operationSchedules });
    showScheduleForm = false;
    editScheduleId = null;
    schSelectedPlots.clear();
    schPlotSearch = "";
    schDraft = null;
    render();
    return;
  }
  return ACT_NEXT;
}
