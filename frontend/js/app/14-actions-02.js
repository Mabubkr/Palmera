// PalmTrace app — UI action handlers, part 2 of 9 (starts at: name === "print-creds-slip")
// (split from the former single app.js; files are classic scripts loaded in order by index.html)

async function actionsPart02(name, id, el, st) {
  if (name === "print-creds-slip") {
    window.print();
    return;
  }
  if (name === "print-id-card") {
    window.print();
    return;
  }
  if (name === "gen-temp-pass") {
    const temp = "Palm#" + Math.floor(1000 + Math.random() * 9000) + "!" + String.fromCharCode(65 + Math.floor(Math.random()*26)) + String.fromCharCode(97 + Math.floor(Math.random()*26));
    const inp = $("#upass");
    if (inp) inp.value = temp;
    toast("تم توليد كلمة مرور مؤقتة: " + temp);
    return;
  }
  if (name === "login") {
    const inputUser = ($("#user")?.value || "").trim().toLowerCase();
    const inputPass = ($("#pass")?.value || "").trim();

    let authenticatedUser = null;

    // 1. Online authentication against the server (the only way to get a session token)
    let loginRes = null;
    if (typeof Api !== "undefined" && typeof Api.login === "function") {
      try {
        loginRes = await Api.login(inputUser, inputPass);
        if (loginRes && loginRes.success && loginRes.user) {
          authenticatedUser = loginRes.user;
          authenticatedUser.user = authenticatedUser.username || inputUser;
          authenticatedUser.active = true;
          authenticatedUser.mustChangePassword = Boolean(loginRes.user.mustChangePassword);
        }
      } catch (e) {
        console.warn("API login attempt failed:", e);
      }
    }

    // 2. Server unreachable: allow offline re-entry only for the last user who signed in online on this device
    if (!authenticatedUser && (!loginRes || loginRes.error === "offline") && typeof Auth !== "undefined") {
      const offlineUser = await Auth.verifyOfflineLogin(inputUser, inputPass);
      if (offlineUser) {
        authenticatedUser = offlineUser;
        authenticatedUser.user = authenticatedUser.username || inputUser;
        authenticatedUser.active = true;
        authenticatedUser.mustChangePassword = false;
        toast("📴 وضع عدم الاتصال: سيتم مزامنة عملك عند عودة الاتصال (قد يُطلب تسجيل الدخول مجدداً)");
      } else if (!loginRes || loginRes.error === "offline") {
        return toast("تعذر الاتصال بالخادم. الدخول دون اتصال متاح فقط لآخر مستخدم سجّل الدخول على هذا الجهاز");
      }
    }

    if (!authenticatedUser) {
      return toast("بيانات الدخول غير صحيحة");
    }

    let u = authenticatedUser;
    if (u.active === false) {
      return toast("الحساب معطّل");
    }

    // Handle Remember Me
    const remChecked = $("#remember_me")?.checked;
    if (remChecked) {
      localStorage.setItem("palmtrace_remembered_user", u.user);
    } else {
      localStorage.removeItem("palmtrace_remembered_user");
    }

    u.lastSeen = new Date().toISOString();
    if (u.user === "admin" || u.id === "u1" || u.role === "super_admin") {
      u.role = "admin";
    } else {
      u.role = u.role || "worker";
    }

    // Check mandatory password change on first login
    if (u.mustChangePassword || u.must_change_password === 1) {
      forceChangePasswordUser = u;
      render();
      toast("⚠️ يلزم تعيين كلمة مرور شخصية جديدة لحسابك قبل المتابعة");
      return;
    }

    Store.set({ 
      session: u, 
      activeProjectId: "proj_farafra_01",
      activeCompanyId: "comp_bashayer"
    });

    // Pull latest farm data
    if (typeof Api !== "undefined" && typeof Api.pullLatest === "function" && Api.isOnline()) {
      await Api.pullLatest();
    }

    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "login",
        module: "auth",
        severity: "info",
        title: "تسجيل دخول ناجح",
        summary: `قام المستخدم [${u.name}] بتسجيل الدخول بنجاح`,
        user: u.name,
        role: u.role
      });
    }

    go(homeFor(u.role));
    return;
  }
  if (name === "logout") {
    showSuperAdminGatewayModal = false;
    const cur = session();
    if (typeof AuditLog !== "undefined" && cur) {
      AuditLog.log({
        action: "logout",
        module: "auth",
        severity: "info",
        title: "تسجيل خروج",
        summary: `قام المستخدم [${cur.name}] بتسجيل الخروج من المنظومة`,
        user: cur.name,
        role: cur.role
      });
    }
    if (typeof Auth !== "undefined" && Auth.getToken()) {
      fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
      setTimeout(() => Auth.clearToken(), 300);
    }
    const baseUsers = (typeof Store !== "undefined" && Store.def) ? (Store.def().users || []) : [];
    Store.set({ 
      session: null, 
      activeProjectId: "proj_farafra_01", 
      activeCompanyId: "comp_bashayer",
      users: baseUsers.length ? baseUsers : st.users 
    }); 
    document.body.classList.remove("nav-open"); 
    go("login"); 
    return;
  }
  if (name === "reset") {
    if (session()?.role !== "admin") return toast("إعادة الضبط للإدارة فقط");
    if (!confirm("مسح كل البيانات المحلية وإعادة التجريبية؟")) return;
    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "reset_system",
        module: "settings",
        severity: "danger",
        title: "إعادة ضبط المصنع للمنظومة",
        summary: `قام الإداري [${session()?.name}] بإعادة ضبط كافة بيانات المنظومة محلياً`,
        user: session()?.name || "إدارة",
        role: session()?.role || "admin"
      });
    }
    Store.reset(); toast("تمت إعادة الضبط"); go("login"); return;
  }
  if (name === "toggle-nav") { document.body.classList.toggle("nav-open"); return; }
  if (name === "save-profile") {
    const me = session();
    const u = (st.users || []).find(x => x.id === me?.id);
    if (!u) return;
    u.name = ($("#pname")?.value || "").trim() || u.name;
    u.phone = ($("#pphone")?.value || "").trim();
    u.email = ($("#pmail")?.value || "").trim();
    if ($("#plang")) u.lang = $("#plang").value;
    if ($("#pavatar_val")) u.avatar = $("#pavatar_val").value;
    if ($("#pblood")) u.bloodType = $("#pblood").value;

    Store.set({ users: st.users, session: { ...me, name: u.name, phone: u.phone, email: u.email, avatar: u.avatar, bloodType: u.bloodType, lang: u.lang } });
    // Own-profile endpoint: never changes role, password or account status
    fetch("/api/auth/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: u.name, phone: u.phone, email: u.email, avatar: u.avatar || "", bloodType: u.bloodType || "" })
    }).catch(e => console.warn("API profile update error:", e));
    toast("✅ تم حفظ وتحديث بيانات الحساب بنجاح");
    render();
    return;
  }
  if (name === "change-pass") {
    const me = session();
    const u = (st.users || []).find(x => x.id === me?.id);
    if (!u) return;
    const oldPass = $("#pold")?.value || "";
    const newPass = $("#pnew")?.value || "";
    const confirmPass = $("#pnew2")?.value || "";

    if (!oldPass) return toast("⚠️ يرجى إدخال كلمة المرور الحالية");
    if (!newPass || newPass.length < 6) return toast("⚠️ كلمة المرور الجديدة يجب ألا تقل عن 6 خانات");
    if (newPass !== confirmPass) return toast("⚠️ تأكيد كلمة المرور غير مطابق");

    if (typeof Api !== "undefined" && typeof Api.changePassword === "function") {
      try {
        const res = await Api.changePassword(u.id, oldPass, newPass, u.user);
        if (res && res.success) {
          if (typeof Auth !== "undefined") Auth.rememberOfflineLogin(u, newPass);
          Store.set({ users: st.users, session: { ...u } });
          toast("✅ تم تغيير كلمة المرور وتحديث الحساب بنجاح في قاعدة البيانات");
          if ($("#pold")) $("#pold").value = "";
          if ($("#pnew")) $("#pnew").value = "";
          if ($("#pnew2")) $("#pnew2").value = "";
          render();
          return;
        } else if (res && res.error && res.error !== "offline") {
          return toast("❌ " + res.error);
        }
      } catch (err) {
        console.warn("Change password api error:", err);
      }
    }

    toast("تغيير كلمة المرور يتطلب الاتصال بالخادم، يرجى المحاولة عند توفر الاتصال");
    return;
  }
  if (name === "bg-default") {
    const u = st.users.find(x => x.id === session().id); if (!u) return;
    u.bg = { type: "default", overlay: 48 };
    Store.set({ users: st.users, session: { ...session(), bg: u.bg } }); toast("عادت الخلفية الافتراضية"); render(); return;
  }
  if (name === "bg-preset") {
    const u = st.users.find(x => x.id === session().id); if (!u) return;
    u.bg = { type: "preset", preset: id, overlay: +($("#bgov")?.value || 48) };
    Store.set({ users: st.users, session: { ...session(), bg: u.bg } }); render(); return;
  }
  if (name === "bg-upload") {
    const f = $("#bgfile")?.files?.[0]; if (!f) return toast("اختر صورة أولاً");
    const u = st.users.find(x => x.id === session().id); if (!u) return;
    compressImage(f).then(src => {
      u.bg = { type: "custom", image: src, overlay: +($("#bgov")?.value || 52) };
      Store.set({ users: st.users, session: { ...session(), bg: u.bg } });
      toast("اعتُمدت صورة الخلفية"); render();
    });
    return;
  }
  if (name === "kick-session") {
    const u = st.users.find(x => x.id === session().id); if (!u) return;
    u.sessions = (u.sessions||[]).filter(s => s.id !== id);
    Store.set({ users: st.users, session: { ...session(), sessions: u.sessions } }); render(); return;
  }
  if (name === "scan-tab") { scanTab = id; scanPage = 1; render(); return; }
  if (name === "scan-recent-filter") { scanRecentFilter = id || "all"; render(); return; }
  if (name === "scan-crop") { scanCrop = id; scanPage = 1; render(); return; }
  if (name === "scan-sec") { scanSec = id; scanPlotGroup = null; scanPlot = null; scanPage = 1; render(); return; }
  if (name === "scan-group") { scanPlotGroup = id; scanPlot = null; scanPage = 1; render(); return; }
  if (name === "scan-plot") { scanPlot = id; scanPage = 1; render(); return; }
  if (name === "scan-pick-quick-plot") {
    const pl = st.plots.find(p => p.id === id);
    if (!pl) return;
    scanTab = "browse";
    scanSec = pl.sector;
    scanPlotGroup = plotBaseNumber(pl);
    scanPlot = pl.id;
    scanPage = 1;
    render();
    return;
  }
  if (name === "scan-page") { scanPage = +id || 1; render(); return; }
  if (name === "scan-browse-home") { scanSec = null; scanPlotGroup = null; scanPlot = null; scanPage = 1; render(); return; }
  if (name === "scan-browse-sec") { scanPlotGroup = null; scanPlot = null; scanPage = 1; render(); return; }
  if (name === "scan-clear-q") { scanQ = ""; scanPage = 1; render(); return; }
  if (name === "scan-do-search") {
    scanQ = ($("#scan_quick_q")?.value || $("#scan_plot_q")?.value || "").trim();
    scanPage = 1; render(); return;
  }
  if (name === "start-scan") { startQrScan(); return; }
  if (name === "stop-scan") { stopQrScan(); return; }
  if (name === "modal-apply-code") {
    const val = ($("#modalScanInput")?.value || "").trim();
    if (!val) return toast("يرجى كتابة الكود أولاً");
    applyScannedCode(val);
    return;
  }
  if (name === "find-palm") {
    const q = ($("#codeq")?.value || $("#scan_quick_q")?.value || "").trim();
    scanQ = q;
    scanPage = 1;
    render();
    return;
  }
  if (name === "open-sel-palm") {
    const id = $("#spalm")?.value;
    if (!id) return toast("اختر الشجرة من القائمة أولاً");
    go("palm", id); return;
  }
  if (name === "open-palm") {
    if (!id) return toast("تعذر تحديد النخلة");
    const p = findPalm(id);
    go("palm", p ? p.id : id); return;
  }
  if (name === "go-op") {
    if (!hasPerm("ops_record")) return toast("ليس لديك صلاحية تسجيل عمليات ميدانية على الأشجار");
    const p = findPalm(id);
    go("op", p ? p.id : id); return;
  }
  if (name === "go-fast-op") {
    if (!hasPerm("ops_record")) return toast("ليس لديك صلاحية تسجيل عمليات ميدانية على الأشجار");
    const p = findPalm(id);
    fastOpPalmId = p ? p.id : id;
    fastOpSelectedType = null;
    render(); return;
  }
  if (name === "toggle-quick-op-setting") {
    st.settings = st.settings || {};
    st.settings.hideQuickOp = !$("#toggle_quick_op")?.checked;
    Store.set({ settings: st.settings });
    toast(st.settings.hideQuickOp ? "تم إخفاء وتعطيل مفتاح العملية السريعة" : "تم تفعيل وإظهار مفتاح العملية السريعة");
    render(); return;
  }
  if (name === "close-fast-op") {
    fastOpPalmId = null;
    const m = $("#fast_op_modal_container");
    if (m) m.remove();
    else render();
    return;
  }
  if (name === "pick-fast-op-type") {
    fastOpSelectedType = id;
    $$("[data-act='pick-fast-op-type']").forEach(el => {
      const isSel = (el.dataset.id === id);
      el.style.border = isSel ? '2px solid #16A34A' : '2px solid #E2E8F0';
      el.style.background = isSel ? '#DCFCE7' : '#FFFFFF';
      el.style.color = isSel ? '#166534' : '#1E293B';
      el.style.boxShadow = isSel ? '0 2px 8px rgba(22,163,74,0.25)' : 'none';
    });
    return;
  }
  if (name === "save-fast-op") {
    if (!hasPerm("ops_record")) return toast("ليس لديك صلاحية تسجيل عمليات ميدانية على الأشجار");
    const palm = findPalm(id);
    if (!palm) return toast("تعذر العثور على النخلة");
    const resolvedPalmId = palm.id;
    const palmCode = palm.code || "";
    const typeId = fastOpSelectedType || (st.operationTypes?.[0]?.id || "op_irrigation");
    const dateVal = $("#fast_op_date")?.value || new Date().toISOString().slice(0, 10);
    const newHealth = $("#fast_op_health")?.value || palm.status;
    const notesVal = ($("#fast_op_notes")?.value || "").trim();

    const opTimeIso = (!dateVal || dateVal === new Date().toISOString().slice(0, 10))
      ? new Date().toISOString()
      : new Date(dateVal + 'T' + new Date().toISOString().slice(11)).toISOString();

    const op = {
      id: Store.uid("op"),
      palmId: resolvedPalmId,
      palmCode: palmCode,
      typeId: typeId,
      notes: notesVal ? `[عملية سريعة] ${notesVal}` : "[عملية سريعة]",
      photos: [],
      workerId: session()?.id || "u1",
      at: opTimeIso,
      status: "pending",
      approval: "pending",
      device: navigator.userAgent.slice(0, 48),
      supervisorNote: "",
      health: newHealth
    };
    st.operations = st.operations || [];
    st.operations.push(op);

    // Update palm health status if updated
    if (newHealth && newHealth !== palm.status) {
      palm.status = newHealth;
      if (newHealth === "تحت المراقبة") {
        palm.statusId = 2; palm.statusCode = "observation"; palm.badgeColor = "#D97706"; palm.badgeBg = "#FEF3C7";
      } else if (newHealth === "مصابة") {
        palm.statusId = 3; palm.statusCode = "infected"; palm.badgeColor = "#DC2626"; palm.badgeBg = "#FEE2E2";
      } else if (newHealth === "ميتة") {
        palm.statusId = 5; palm.statusCode = "dead"; palm.badgeColor = "#0F172A"; palm.badgeBg = "#E2E8F0";
      } else {
        palm.statusId = 1; palm.statusCode = "healthy"; palm.badgeColor = "#16A34A"; palm.badgeBg = "#DCFCE7";
      }
      palm.modifiedBy = session()?.name || session()?.user || "worker";
      palm.modifiedAt = new Date().toISOString();
      op.health = newHealth;
      op.treeHealth = newHealth;
      const pIdx = st.palms.findIndex(x => String(x.id) === String(palm.id) || codesEqual(x.code, palm.code));
      if (pIdx !== -1) st.palms[pIdx] = palm;
      if (typeof Api !== "undefined" && typeof Api.updatePalm === "function") {
        Api.updatePalm(palm);
      }
    }

    Store.set({ operations: st.operations, palms: st.palms });
    enqueue("عملية " + typeName(op.typeId), palm.code || "");
    if (typeof Api !== "undefined" && typeof Api.createOperation === "function") {
      Api.createOperation(op);
    }
    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "create",
        module: "operations",
        severity: "info",
        title: `عملية سريعة: ${typeName(op.typeId)}`,
        summary: `تسجيل عملية سريعة [${typeName(op.typeId)}] على الشجرة ${palm.code || id}`,
        details: { opId: op.id, palmCode: palm.code, typeId: op.typeId, notes: op.notes },
        targetType: "operation",
        targetId: op.id,
        targetCode: palm.code,
        user: session()?.name || "مستخدم",
        role: session()?.role || "worker"
      });
    }
    fastOpPalmId = null;
    const m = $("#fast_op_modal_container");
    if (m) {
      m.style.opacity = "0";
      m.style.transition = "opacity 0.15s ease";
      setTimeout(() => { if (m) m.remove(); }, 150);
    }
    toast(`تم تسجيل وتأكيد عملية «${typeName(op.typeId)}» بنجاح ⚡`);
    render(); return;
  }
  if (name === "go-os") {
    if (!hasPerm("nursery_offshoot_add")) return toast("ليس لديك صلاحية تسجيل قلع فسائل");
    const p = findPalm(id);
    go("offshoot", p ? p.id : id); return;
  }
  if (name === "save-op") {
    if (!hasPerm("ops_record")) return toast("ليس لديك صلاحية تسجيل عمليات ميدانية على الأشجار");
    const palm = findPalm(id);
    const resolvedPalmId = palm ? palm.id : id;
    const palmCode = palm?.code || "";
    const photos = [...$("#prev").querySelectorAll("img")].map(i => i.src);
    const quick = $("#qres")?.value ? `[${$("#qres").value}] ` : "";
    const needMat = opMaterialRule($("#otype").value).show;
    const matName = needMat ? ($("#omat")?.value || "") : "";
    const doseQty = parseFloat($("#odose_qty")?.value || "0");
    const doseUnit = $("#odose_unit")?.value || "كجم";
    const doseLegacy = ($("#odose")?.value || "").trim();
    const doseStr = doseQty > 0 ? `${doseQty} ${doseUnit}` : doseLegacy;
    const matBit = needMat && matName ? (`[${matName}${doseStr ? " • " + doseStr : ""}] `) : "";
    const op = { id: Store.uid("op"), palmId: resolvedPalmId, palmCode: palmCode, typeId: $("#otype").value, notes: quick + matBit + ($("#notes").value||""), photos, workerId: session().id, at: new Date().toISOString(), status: "pending", approval: "pending", device: navigator.userAgent.slice(0,48), supervisorNote: "" };
    st.operations.push(op);

    // Auto-update palm health status if operation indicates infection, observation, or recovery
    if (palm) {
      const opNotesStr = op.notes || "";
      const isNegatedHealthy = opNotesStr.includes("غير سليم") || opNotesStr.includes("ليست سليم") || opNotesStr.includes("غير معاف") || opNotesStr.includes("مشتبه");
      let newHealthState = null;
      if (opNotesStr.includes("إصابة مؤكدة") || opNotesStr.includes("إصابة سوسة") || op.typeId === "op8") {
        newHealthState = { status: "مصابة", statusId: 3, statusCode: "infected", badgeColor: "#DC2626", badgeBg: "#FEE2E2" };
      } else if (opNotesStr.includes("اشتباه / فحص") || opNotesStr.includes("تحت المراقبة")) {
        newHealthState = { status: "تحت المراقبة", statusId: 2, statusCode: "observation", badgeColor: "#D97706", badgeBg: "#FEF3C7" };
      } else if (!isNegatedHealthy && (opNotesStr.includes("تم الشفاء") || opNotesStr.includes("تمت المعالجة والتعافي") || opNotesStr.includes("خلو تام من الإصابة"))) {
        newHealthState = { status: "سليمة", statusId: 1, statusCode: "healthy", badgeColor: "#16A34A", badgeBg: "#DCFCE7" };
      }
      if (newHealthState) {
        newHealthState.modifiedBy = session()?.name || session()?.user || "worker";
        newHealthState.modifiedAt = new Date().toISOString();
        Object.assign(palm, newHealthState);
        const pIdx = st.palms.findIndex(x => String(x.id) === String(palm.id) || codesEqual(x.code, palm.code));
        if (pIdx !== -1) st.palms[pIdx] = palm;
        if (typeof Api !== "undefined" && typeof Api.updatePalm === "function") {
          Api.updatePalm(palm);
        }
      }
    }

    // Auto-deduct from fertilizer inventory if material & quantity provided
    if (needMat && matName && doseQty > 0) {
      op.material = matName;
      op.materialQty = doseQty;
      op.materialUnit = doseUnit;
      const fert = (st.fertilizers || []).find(f => f.name === matName || f.id === matName);
      if (fert) {
        let deductQty = doseQty;
        if (fert.unit === "كجم" && doseUnit === "جم") deductQty = doseQty / 1000;
        else if (fert.unit === "جم" && doseUnit === "كجم") deductQty = doseQty * 1000;

        if ((fert.allocated || 0) >= deductQty) {
          fert.allocated -= deductQty;
        } else {
          const rem = deductQty - (fert.allocated || 0);
          fert.allocated = 0;
          fert.stock = Math.max(0, (fert.stock || 0) - rem);
        }
        fert.consumed = (fert.consumed || 0) + deductQty;
        Store.set({ fertilizers: st.fertilizers });
      }
    }

    if (activeReworkOpId) {
      const prevOp = st.operations.find(x => x.id === activeReworkOpId);
      if (prevOp) {
        prevOp.approval = "pending";
        prevOp.resubmitted = true;
        prevOp.resubmittedAt = new Date().toISOString();
        prevOp.resubmittedBy = session()?.id;
        prevOp.resubmitOpId = op.id;
        prevOp.notes = (prevOp.notes || "") + ` [🔄 أُعيد التنفيذ بسجل #${op.id.slice(-4)}]`;
      }
      op.reworkOf = activeReworkOpId;
      op.isRework = true;
      op.resubmitted = true;
      op.notes = `[🔄 إعادة تنفيذ للعملية #${activeReworkOpId.slice(-4)}] ` + op.notes;

      // Notify supervisors & engineers
      st.notifications = st.notifications || [];
      const engs = (st.users || []).filter(u => u.role === "engineer" || u.role === "admin");
      engs.forEach(eng => {
        st.notifications.push({
          id: Store.uid("n"),
          userId: eng.id,
          text: `🔄 قام العامل ${session()?.name || 'الميداني'} بإعادة تنفيذ وتصحيح العملية [${typeName(op.typeId)}] للشجرة ${palmCode || resolvedPalmId}`,
          at: new Date().toISOString(),
          type: "approval",
          targetView: "ops-records",
          targetId: op.id,
          read: false
        });
      });
      activeReworkOpId = null;
    }

    if (activeScheduleId) {
      const sch = (st.operationSchedules || []).find(s => s.id === activeScheduleId);
      if (sch) {
        const today = new Date().toISOString().slice(0, 10);
        sch.lastExecutedAt = today;
        sch.nextDueDate = addDaysToDate(today, sch.intervalDays || 7);
        Store.set({ operationSchedules: st.operationSchedules });
      }
      activeScheduleId = null;
    }

    Store.set({ operations: st.operations, notifications: st.notifications });
    enqueue("عملية " + typeName(op.typeId), palm?.code || "");
    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "create",
        module: "operations",
        severity: "info",
        title: `تسجيل عملية: ${typeName(op.typeId)}`,
        summary: `تسجيل عملية [${typeName(op.typeId)}] على الشجرة ${palm?.code || id}`,
        details: { opId: op.id, palmCode: palm?.code, typeId: op.typeId, notes: op.notes },
        targetType: "operation",
        targetId: op.id,
        targetCode: palm?.code,
        user: session()?.name || "مستخدم",
        role: session()?.role || "worker"
      });
    }
    if (typeof Api !== "undefined") {
      Api.createOperation(op);
    }
    toast("سُجلت العملية واحتُسب استهلاك السماد"); go("queue"); return;
  }
  if (name === "save-os") {
    if (!hasPerm("nursery_offshoot_add")) return toast("ليس لديك صلاحية تسجيل قلع فسائل");
    const mother = findPalm(id);
    const seq = $("#oseq").value.padStart(2,"0");
    const date = $("#odate").value;
    const baseCode = offshootBaseMotherCode(mother?.code || id);
    const os = { 
      id: Store.uid("os"), 
      motherId: mother ? mother.id : id, 
      motherCode: mother?.code || "",
      tempCode: `${baseCode}-OS${seq}-${mmYY(date)}`, 
      seq, 
      date, 
      weight: $("#ow").value, 
      diameter: $("#od").value, 
      health: $("#oh").value, 
      originType: "internal", 
      supplier: "", 
      variety: mother?.variety || "", 
      cropId: mother?.cropId || "palm",
      newPalmId: null, 
      notes: $("#onotes").value, 
      approval: "pending",
      nsStatus: "inbound",
      stage: "inbound",
      statusDesc: "بانتظار استلام المشتل"
    };
    st.offshoots.push(os); if (mother) mother.offshootCount = (mother.offshootCount||0)+1;
    Store.set({ offshoots: st.offshoots, palms: st.palms });
    enqueue("قلع فسيلة", os.tempCode);
    if (typeof Api !== "undefined") {
      Api.createOffshoot(os);
    }
    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "create",
        module: "nursery",
        severity: "info",
        title: `قلع فسيلة: ${os.tempCode}`,
        summary: `تسجيل قلع فسيلة برقم ${os.tempCode} من النخلة الأم ${mother?.code || id}`,
        details: { id: os.id, tempCode: os.tempCode, motherCode: mother?.code, date, weight: os.weight },
        targetType: "offshoot",
        targetId: os.id,
        targetCode: os.tempCode,
        user: session()?.name || "مستخدم",
        role: session()?.role || "worker"
      });
    }
    toast("تم تسجيل الفسيلة"); go("palm", id); return;
  }
  if (name === "edit-op") {
    const o = st.operations.find(x => x.id === id);
    if (!o) return toast("العملية غير موجودة");
    const isAdminOrOpsDel = hasPerm("ops_delete") || session()?.role === "admin";
    if (!canEdit(o) && !isAdminOrOpsDel) return toast("لا يمكن التعديل بعد الاعتماد إلا بصلاحية تعديل العمليات");
    o.notes = $("#enotes").value;
    Store.set({ operations: st.operations });
    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "update",
        module: "operations",
        severity: "info",
        title: `تعديل ملاحظات عملية: ${typeName(o.typeId)}`,
        summary: `تعديل ملاحظات العملية [${typeName(o.typeId)}] (${o.id})`,
        details: { id: o.id, notes: o.notes },
        targetType: "operation",
        targetId: o.id,
        user: session()?.name || "مستخدم",
        role: session()?.role || "worker"
      });
    }
    toast("تم التعديل"); render(); return;
  }
  if (name === "open-edit-op-modal") {
    const curU = session();
    const canEdit = hasPerm("ops_delete") || hasPerm("ops_edit") || curU?.role === "admin";
    if (!canEdit) return toast("ليس لديك صلاحية تعديل العمليات");
    showEditOpModal = true;
    editingOpId = id;
    render();
    return;
  }
  if (name === "close-edit-op-modal") {
    showEditOpModal = false;
    editingOpId = null;
    render();
    return;
  }
  if (name === "save-edit-op") {
    const curU = session();
    const canEdit = hasPerm("ops_delete") || hasPerm("ops_edit") || curU?.role === "admin";
    if (!canEdit) return toast("ليس لديك صلاحية تعديل العمليات");
    const o = (st.operations || []).find(x => x.id === id);
    if (!o) return toast("العملية غير موجودة");

    const newType = $("#edit_op_type")?.value || o.typeId;
    const newAt = $("#edit_op_at")?.value ? new Date($("#edit_op_at").value).toISOString() : o.at;
    const newWorker = $("#edit_op_worker")?.value || o.workerId;
    const newApproval = $("#edit_op_approval")?.value || o.approval;
    const newNotes = $("#edit_op_notes")?.value !== undefined ? $("#edit_op_notes").value : o.notes;
    const newSnote = $("#edit_op_snote")?.value !== undefined ? $("#edit_op_snote").value : (o.supervisorNote || "");

    o.typeId = newType;
    o.at = newAt;
    o.workerId = newWorker;
    o.approval = newApproval;
    o.notes = newNotes;
    o.supervisorNote = newSnote;

    Store.set({ operations: st.operations });
    if (typeof Api !== "undefined" && typeof Api.createOperation === "function") {
      Api.createOperation(o);
    }
    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "update",
        module: "operations",
        severity: "info",
        title: `تعديل عملية: ${typeName(o.typeId)}`,
        summary: `تعديل بيانات وسجل العملية [${typeName(o.typeId)}] (${o.id}) بواسطة ${curU?.name || 'مدير النظام'}`,
        details: o,
        targetType: "operation",
        targetId: o.id,
        user: curU?.name || "مستخدم",
        role: curU?.role || "admin"
      });
    }
    showEditOpModal = false;
    editingOpId = null;
    toast("✅ تم حفظ تعديلات العملية بنجاح");
    render();
    return;
  }
  if (name === "del-batch-op") {
    const curU = session();
    const canDel = hasPerm("ops_delete") || curU?.role === "admin";
    if (!canDel) return toast("ليس لديك صلاحية حذف العمليات");
    const batchId = id;
    const matching = (st.operations || []).filter(o => o.batchId === batchId || o.bulkId === batchId || (o.device && o.device.includes(batchId)));
    const count = matching.length;
    if (!count) return toast("لم يتم العثور على عمليات في هذه الحزمة");
    if (!confirm(`⚠️ تحذير: هل أنت متأكد من حذف الحزمة بالكامل (${count} شجرة/عملية) نهائياً؟\nلا يمكن التراجع عن هذا الإجراء.`)) return;
    const matchIds = new Set(matching.map(o => o.id));
    st.operations = st.operations.filter(o => !matchIds.has(o.id));
    Store.set({ operations: st.operations });
    inspectedBatchId = null;
    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "delete",
        module: "operations",
        severity: "danger",
        title: `حذف حزمة عمليات: ${batchId}`,
        summary: `حذف حزمة عمليات جماعية بالكامل تشمل ${count} شجرة`,
        targetType: "operation_batch",
        targetId: batchId,
        user: curU?.name || "مستخدم",
        role: curU?.role || "admin"
      });
    }
    toast(`تم حذف الحزمة (${count} عملية) بنجاح`);
    render();
    return;
  }
  if (name === "bulk-delete-ops") {
    const curU = session();
    const canDel = hasPerm("ops_delete") || curU?.role === "admin";
    if (!canDel) return toast("ليس لديك صلاحية حذف العمليات");
    if (!opsSelectedIds.size) return toast("يرجى تحديد عملية واحدة على الأقل من الجدول أولاً");
    const count = opsSelectedIds.size;
    if (!confirm(`⚠️ تحذير: هل أنت متأكد من حذف (${count}) عملية محددة نهائياً؟`)) return;
    st.operations = st.operations.filter(o => !opsSelectedIds.has(o.id) && !opsSelectedIds.has(o.batchId));
    Store.set({ operations: st.operations });
    opsSelectedIds.clear();
    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "delete",
        module: "operations",
        severity: "danger",
        title: `حذف جماعي للعمليات (${count})`,
        summary: `تم حذف ${count} عملية ميدانية دفعة واحدة من قِبل ${curU?.name || 'مدير النظام'}`,
        targetType: "operations_bulk",
        user: curU?.name || "مستخدم",
        role: curU?.role || "admin"
      });
    }
    toast(`✅ تم حذف ${count} عملية محددة بنجاح`);
    render();
    return;
  }
  if (name === "del-op") {
    const curU = session();
    const isAdminOrOpsDel = hasPerm("ops_delete") || curU?.role === "admin";
    if (!isAdminOrOpsDel && !hasPerm("d", "operations")) return toast("ليس لديك صلاحية حذف العمليات");
    const o = st.operations.find(x => x.id === id);
    if (!o) return toast("العملية غير موجودة");
    if (!canEdit(o) && !isAdminOrOpsDel) return toast("لا يمكن الحذف بعد الاعتماد إلا بصلاحية حذف العمليات");
    if (!confirm(`هل أنت متأكد من حذف العملية المسجلة [${typeName(o.typeId)}] نهائياً؟`)) return;
    Store.set({ operations: st.operations.filter(x => x.id !== id) });
    showEditOpModal = false;
    editingOpId = null;
    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "delete",
        module: "operations",
        severity: "danger",
        title: `حذف عملية: ${typeName(o?.typeId)}`,
        summary: `حذف سجل العملية ${o?.id} (${typeName(o?.typeId)})`,
        details: o,
        targetType: "operation",
        targetId: id,
        user: curU?.name || "مستخدم",
        role: curU?.role || "admin"
      });
    }
    toast("تم الحذف"); render(); return;
  }
  if (name === "del-os") {
    const o = st.offshoots.find(x => x.id === id);
    if (!canEdit(o)) return toast("لا يمكن الحذف بعد الاعتماد");
    Store.set({ offshoots: st.offshoots.filter(x => x.id !== id) });
    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "delete",
        module: "nursery",
        severity: "danger",
        title: `حذف فسيلة: ${o?.tempCode || id}`,
        summary: `حذف سجل الفسيلة ${o?.tempCode || id}`,
        details: o,
        targetType: "offshoot",
        targetId: id,
        user: session()?.name || "مستخدم",
        role: session()?.role || "worker"
      });
    }
    toast("تم الحذف"); render(); return;
  }
  if (name === "palm-tab") { palmTab = id; render(); return; }
  if (name === "tog-edit") {
    if (!hasPerm("palms_edit")) return toast("ليس لديك صلاحية تعديل بيانات الشجرة");
    palmEdit = !palmEdit;
    render();
    return;
  }
  if (name === "tog-more") {
    if (!hasPerm("palms_delete")) return toast("ليس لديك صلاحية إجراءات الحذف أو الأرشفة");
    palmMore = !palmMore;
    render();
    return;
  }
  if (name === "print-one") {
    const p = st.palms.find(x => String(x.id) === String(id) || x.code === id);
    if (!p) return toast("تعذر العثور على بيانات الشجرة للطباعة", "warn");
    printPalmsBarcode([p], p.code);
    return;
  }
  if (name === "sort-ops") {
    const col = actEl.dataset.col || "at";
    if (opsSortCol === col) {
      opsSortDir = (opsSortDir === "asc" ? "desc" : "asc");
    } else {
      opsSortCol = col;
      opsSortDir = (col === "at" ? "desc" : "asc");
    }
    render();
    return;
  }
  if (name === "sort-palms") {
    const col = actEl.dataset.col || "code";
    if (palmSortCol === col) {
      palmSortDir = (palmSortDir === "asc" ? "desc" : "asc");
    } else {
      palmSortCol = col;
      palmSortDir = "asc";
    }
    render();
    return;
  }
  if (name === "sort-vch") {
    const col = id || actEl?.dataset?.id || "date";
    if (fertVoucherSortCol === col) {
      fertVoucherSortDir = (fertVoucherSortDir === "asc" ? "desc" : "asc");
    } else {
      fertVoucherSortCol = col;
      fertVoucherSortDir = (col === "date" ? "desc" : "asc");
    }
    render();
    return;
  }
  if (name === "sort-nursery") {
    const col = id || actEl?.dataset?.id || "date";
    if (nurserySortCol === col) {
      nurserySortDir = (nurserySortDir === "asc" ? "desc" : "asc");
    } else {
      nurserySortCol = col;
      nurserySortDir = (col === "date" ? "desc" : "asc");
    }
    render();
    return;
  }
  if (name === "dash-today") { opsCritOnly = false; opsRange = "today"; opsType = ""; opsSt = ""; go("ops-admin"); return; }
  if (name === "dash-pending") { opsCritOnly = false; opsSt = "pending"; opsRange = "all"; go("ops-admin"); return; }
  if (name === "dash-weevil") {
    opsCritOnly = true; opsType = ""; opsSt = ""; opsRange = "all"; go("ops-admin"); return;
  }
  if (name === "dash-investors") {
    usersTab = "list"; userRoleF = "investor"; userQ = ""; userSecF = ""; userActF = ""; go("users"); return;
  }
  if (name === "dash-yields-last") {
    go("yields"); return;
  }
  if (name === "dash-nursery-purchased") {
    nurseryTab = "purchased"; go("nursery"); return;
  }
  if (name === "open-dash-kpi-modal") {
    showDashKpiModal = true;
    render(); return;
  }
  if (name === "close-dash-kpi-modal") {
    showDashKpiModal = false;
    render(); return;
  }
  if (name === "open-season-modal") {
    showSeasonModal = true;
    render(); return;
  }
  if (name === "close-season-modal") {
    showSeasonModal = false;
    rolloverSeasonYear = null;
    render(); return;
  }
  if (name === "prompt-rollover") {
    rolloverSeasonYear = id;
    render(); return;
  }
  if (name === "cancel-rollover") {
    rolloverSeasonYear = null;
    render(); return;
  }
  if (name === "confirm-season-rollover") {
    const yr = id || rolloverSeasonYear;
    if (!yr) return;
    try {
      const nextYr = String(+yr + 1);
      const res = await Api.closeAndRolloverSeason(yr, { nextYear: nextYr });
      if (res && res.success) {
        toast(`✅ تم إقفال موسم ${yr}م بنجاح وترحيل أرصدة المخزون وتفعيل موسم ${nextYr}م!`);
        if (st.seasons) {
          const sOld = st.seasons.find(s => String(s.season_year) === String(yr));
          if (sOld) { sOld.status = 'closed'; sOld.is_current = 0; }
          const sNew = st.seasons.find(s => String(s.season_year) === String(nextYr));
          if (sNew) { sNew.is_current = 1; sNew.status = 'open'; }
          else { st.seasons.push({ season_year: +nextYr, status: 'open', is_current: 1 }); }
        }
        dashYear = nextYr;
        yieldsSeason = nextYr;
      } else {
        toast(res?.error || "حدث خطأ أثناء ترحيل الموسم");
      }
    } catch (err) {
      toast("تعذر الاتصال بالخادم لإتمام الترحيل: " + err.message);
    }
    rolloverSeasonYear = null;
    showSeasonModal = false;
    render(); return;
  }
  if (name === "save-new-season") {
    const yr = ($("#new_season_year")?.value || "").trim();
    const sDate = ($("#new_season_start")?.value || "").trim();
    const eDate = ($("#new_season_end")?.value || "").trim();
    const notes = ($("#new_season_notes")?.value || "").trim();
    if (!yr || !/^\d{4}$/.test(yr)) return toast("يرجى إدخال سنة صحيحة (مثال: 2027)");
    try {
      const payload = { season_year: +yr, start_date: sDate, end_date: eDate, notes, is_current: 1 };
      const res = await Api.saveSeason(payload);
      if (res && (res.success || res.season)) {
        toast(`✅ تم فتح دورة موسم ${yr}م بنجاح وتعيينه كموسم نشط!`);
        if (!st.seasons) st.seasons = [];
        st.seasons.forEach(s => s.is_current = 0);
        const existing = st.seasons.find(s => String(s.season_year) === String(yr));
        if (existing) {
          Object.assign(existing, payload);
        } else {
          st.seasons.push({ ...payload, status: 'open' });
        }
        dashYear = yr;
        yieldsSeason = yr;
      } else {
        toast(res?.error || "حدث خطأ أثناء حفظ الموسم");
      }
    } catch (err) {
      toast("تعذر حفظ الموسم الزراعي الجديد: " + err.message);
    }
    showSeasonModal = false;
    render(); return;
  }
  if (name === "save-season-only") {
    const yr = ($("#new_season_year")?.value || "").trim();
    const sDate = ($("#new_season_start")?.value || "").trim();
    const eDate = ($("#new_season_end")?.value || "").trim();
    const notes = ($("#new_season_notes")?.value || "").trim();
    if (!yr || !/^\d{4}$/.test(yr)) return toast("يرجى إدخال سنة صحيحة (مثال: 2027)");
    try {
      const payload = { season_year: +yr, start_date: sDate, end_date: eDate, notes, is_current: 0 };
      const res = await Api.saveSeason(payload);
      if (res && (res.success || res.season)) {
        toast(`✅ تم إضافة موسم ${yr}م بنجاح كموسم مستقبلي/مخطط (غير نشط حالياً)!`);
        if (!st.seasons) st.seasons = [];
        const existing = st.seasons.find(s => String(s.season_year) === String(yr));
        if (existing) {
          Object.assign(existing, payload);
        } else {
          st.seasons.push({ ...payload, status: 'open' });
        }
        Store.set({ seasons: st.seasons });
      } else {
        toast(res?.error || "حدث خطأ أثناء حفظ الموسم");
      }
    } catch (err) {
      toast("تعذر حفظ الموسم الزراعي الجديد: " + err.message);
    }
    render(); return;
  }
  if (name === "set-current-season") {
    const targetYr = id;
    if (!targetYr) return;
    try {
      const targetSeason = (st.seasons || []).find(s => String(s.season_year) === String(targetYr));
      const payload = { 
        season_year: +targetYr, 
        start_date: targetSeason?.start_date || `${targetYr}-01-01`, 
        end_date: targetSeason?.end_date || `${targetYr}-12-31`, 
        notes: targetSeason?.notes || "", 
        is_current: 1 
      };
      const res = await Api.saveSeason(payload);
      if (res && (res.success || res.season)) {
        (st.seasons || []).forEach(s => s.is_current = (String(s.season_year) === String(targetYr) ? 1 : 0));
        dashYear = targetYr;
        yieldsSeason = targetYr;
        zakatSeason = targetYr;
        Store.set({ seasons: st.seasons });
        toast(`⭐ تم تفعيل موسم ${targetYr}م وتعيينه كموسم زراعي حالي نشط للعمليات والحصاد!`);
      } else {
        toast(res?.error || "تعذر تفعيل الموسم");
      }
    } catch (err) {
      toast("خطأ أثناء تفعيل الموسم: " + err.message);
    }
    render(); return;
  }
  if (name === "feed-load-more") {
    feedPageLimit = (feedPageLimit || 25) + 25;
    render(); return;
  }
  if (name === "dash-crop-filter") {
    dashCrop = id || "all";
    render(); return;
  }
  return ACT_NEXT;
}
