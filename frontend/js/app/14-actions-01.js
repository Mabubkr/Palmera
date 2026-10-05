// PalmTrace app — UI action handlers, part 1 of 9 (starts at: handleEarlyWarningActions(name, id, el, st))
// (split from the former single app.js; files are classic scripts loaded in order by index.html)

async function actionsPart01(name, id, el, st) {
  if (handleEarlyWarningActions(name, id, el, st)) return;
  if (typeof handleInvestorsHubActions === "function" && (await handleInvestorsHubActions(name, id, el, st))) return;
  if (typeof handleAiHubAction === "function" && (name.startsWith("ai-") || name === "switch-ai-tab" || name === "toggle-voice-record")) {
    handleAiHubAction(name, id, el);
    return;
  }
  if (name === "toggle-api-key-vis") {
    const input = document.getElementById("gemini_api_key_input");
    if (input) {
      if (input.type === "password") {
        input.type = "text";
        if (el) el.textContent = "🙈 إخفاء";
      } else {
        input.type = "password";
        if (el) el.textContent = "👁️ عرض";
      }
    }
    return;
  }
  if (name === "test-gemini-key") {
    const input = document.getElementById("gemini_api_key_input");
    const keyVal = input ? input.value.trim() : "";
    if (!keyVal) {
      toast("يرجى إدخال مفتاح API أولاً ليتم فحصه");
      return;
    }
    const resBox = document.getElementById("ai_key_test_result");
    if (resBox) {
      resBox.style.display = "block";
      resBox.innerHTML = `<div style="padding:10px 14px;background:#F1F5F9;border-radius:8px;font-size:12.5px;color:#334155;font-weight:700">⏳ جاري الاتصال بخوادم Google Gemini واختبار المفتاح...</div>`;
    }
    try {
      const res = await Api.testAiKey(keyVal);
      if (resBox) {
        if (res && res.success) {
          resBox.innerHTML = `<div style="padding:12px 14px;background:#ECFDF5;border:1px solid #10B981;border-radius:8px;font-size:13px;color:#065F46;font-weight:800">
            ✅ تم التحقق بنجاح! المفتاح صالح ومفعل على النموذج: <code>${res.model || 'Gemini Flash'}</code>
          </div>`;
          toast("✅ تم التحقق من المفتاح بنجاح!");
        } else {
          resBox.innerHTML = `<div style="padding:12px 14px;background:#FEF2F2;border:1px solid #EF4444;border-radius:8px;font-size:13px;color:#991B1B;font-weight:700">
            ❌ فشل الفحص: ${res?.error || 'المفتاح غير صالح أو لم يتمكن من الاتصال'}
          </div>`;
          toast("❌ مفتاح API غير صالح أو غير مفعل");
        }
      }
    } catch(err) {
      if (resBox) {
        resBox.innerHTML = `<div style="padding:12px 14px;background:#FEF2F2;border:1px solid #EF4444;border-radius:8px;font-size:13px;color:#991B1B;font-weight:700">
          ❌ خطأ أثناء الاتصال: ${err.message}
        </div>`;
      }
    }
    return;
  }
  if (name === "save-gemini-key") {
    const input = document.getElementById("gemini_api_key_input");
    const keyVal = input ? input.value.trim() : "";
    if (!keyVal) {
      toast("يرجى إدخال مفتاح API");
      return;
    }
    try {
      const testRes = await Api.testAiKey(keyVal);
      st.settings = st.settings || {};
      st.settings.gemini_api_key_configured = true; // the key itself stays on the server
      const settingsPayload = { gemini_api_key: keyVal };

      Store.save(st);
      if (typeof Api.saveSettings === "function") {
        await Api.saveSettings(settingsPayload);
      }
      toast("💾 تم حفظ مفاتيح الذكاء الاصطناعي وبوابات الأرصاد وتفعيلها بنجاح!");
      render();
    } catch(err) {
      toast("حدث خطأ أثناء الحفظ: " + err.message);
    }
    return;
  }
  if (name === "toggle-ai-chat-voice") {
    st.settings = st.settings || {};
    const checkbox = document.getElementById("ai_voice_chat_toggle");
    const isChecked = checkbox ? checkbox.checked : !st.settings.ai_chat_voice_enabled;
    st.settings.ai_chat_voice_enabled = isChecked;
    Store.save(st);
    toast(isChecked ? "🎙️ تم تفعيل الميكروفون الصوتي في المستشار الزراعي" : "🔇 تم حجب الميكروفون الصوتي في المستشار لترشيد الاستهلاك");
    render();
    return;
  }
  if (name === "feed-filter") {
    feedCategoryFilter = id || "all";
    render(); return;
  }
  if (name === "feed-sector") {
    feedSectorFilter = id || el?.value || "all";
    render(); return;
  }
  if (name === "feed-reset-filters") {
    feedCategoryFilter = "all";
    feedSectorFilter = "all";
    feedSearchQuery = "";
    render(); return;
  }
  if (name === "feed-item-click") {
    activeDrawerEventId = id;
    render(); return;
  }
  if (name === "close-feed-drawer") {
    activeDrawerEventId = null;
    render(); return;
  }
  if (name === "toggle-pulse-sound") {
    const isMuted = (typeof localStorage !== "undefined" && localStorage.getItem("palmtrace_pulse_muted") === "true");
    localStorage.setItem("palmtrace_pulse_muted", !isMuted);
    if (isMuted) {
      playPulseChime();
      toast("🔊 تم تفعيل التنبيه الصوتي لنبض الحقل");
    } else {
      toast("🔇 تم كتم الصوت لنبض الحقل");
    }
    render();
    return;
  }
  if (name === "refresh-feed") {
    feedNewItemsCount = 0;
    feedLastCheckTimestamp = Date.now();
    render();
    toast("تم تحديث موجز الأنشطة الميدانية");
    return;
  }
  if (name === "save-farmer") {
    const me = session();
    if (!hasPerm("farmers_manage") && !hasPerm("c", "farmers") && me?.role !== "admin") {
      return toast("ليس لديك صلاحية لإضافة أو تعديل المزارعين");
    }
    const plots = $$(".fplot").filter(c=>c.checked).map(c=>c.value);
    const fname = $("#fname")?.value?.trim();
    if (!fname) return toast("أدخل اسم المزارع");
    st.farmers = st.farmers || [];

    if (id) {
      const f = st.farmers.find(x => x.id === id);
      if (!f) return toast("المزارع غير موجود");
      f.name = fname;
      f.nationalId = $("#fnid")?.value?.trim() || "";
      f.phone = $("#fphone")?.value?.trim() || "";
      f.type = $("#ftype")?.value || "contract";
      f.plots = plots;
      f.contractNo = $("#fcon")?.value?.trim() || "";
      f.start = $("#fstart")?.value || "";
      f.sharePct = +$("#fshare")?.value || 0;
      f.dailyWage = +$("#fdailywage")?.value || 0;
      f.specialty = $("#fspecialty")?.value || "أعمال عامة";
      f.notes = $("#fnotes")?.value || "";

      Store.set({ farmers: st.farmers });
      if (typeof AuditLog !== "undefined") {
        AuditLog.log({
          action: "update_farmer",
          module: "farmers",
          severity: "info",
          title: `تعديل بيانات مزارع: ${f.name}`,
          summary: `تم تعديل بيانات وعقد المزارع [${f.name}] بواسطة ${me?.name}`,
          details: { id: f.id, name: f.name, contractNo: f.contractNo },
          targetType: "farmer",
          targetId: f.id,
          user: me?.name || "مستخدم",
          role: me?.role || "admin"
        });
      }
      toast("تم حفظ التعديلات بنجاح");
      usersTab = "farmers";
      go("users", "farmers");
      return;
    }

    const rec = {
      id: Store.uid("fm"),
      name: fname,
      nationalId: $("#fnid")?.value?.trim() || "",
      phone: $("#fphone")?.value?.trim() || "",
      type: $("#ftype")?.value || "contract",
      dailyWage: +$("#fdailywage")?.value || 0,
      specialty: $("#fspecialty")?.value || "أعمال عامة",
      status: "active",
      plots,
      contractNo: $("#fcon")?.value?.trim() || "",
      start: $("#fstart")?.value || "",
      sharePct: +$("#fshare")?.value || 0,
      notes: $("#fnotes")?.value || ""
    };
    st.farmers.push(rec);
    Store.set({ farmers: st.farmers });
    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "create_farmer",
        module: "farmers",
        severity: "info",
        title: `إضافة مزارع: ${rec.name}`,
        summary: `تم تسجيل مزارع جديد [${rec.name}] بواسطة ${me?.name}`,
        details: { id: rec.id, name: rec.name, contractNo: rec.contractNo },
        targetType: "farmer",
        targetId: rec.id,
        user: me?.name || "مستخدم",
        role: me?.role || "admin"
      });
    }
    toast("تم تسجيل العامل / المزارع بنجاح"); usersTab = "farmers"; go("users", "farmers");
    return;
  }
  if (name === "tog-farmer") {
    const me = session();
    if (!hasPerm("farmers_delete") && !hasPerm("d", "farmers") && me?.role !== "admin") {
      return toast("ليس لديك صلاحية لإنهاء أو أرشفة ملف مزارع");
    }
    const f = (st.farmers||[]).find(x=>x.id===id); if (!f) return;
    f.status = f.status==="active"?"stopped":"active";
    Store.set({ farmers: st.farmers });
    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: f.status === "active" ? "activate_farmer" : "stop_farmer",
        module: "farmers",
        severity: "warning",
        title: `${f.status === "active" ? "تنشيط" : "إيقاف"} ملف مزارع: ${f.name}`,
        summary: `تم ${f.status === "active" ? "تنشيط" : "إيقاف"} ملف المزارع [${f.name}] بواسطة ${me?.name}`,
        details: { id: f.id, name: f.name, status: f.status },
        targetType: "farmer",
        targetId: f.id,
        user: me?.name || "مستخدم",
        role: me?.role || "admin"
      });
    }
    toast(f.status==="active"?"تم تنشيط المزارع":"تم إيقاف المزارع");
    render();
    return;
  }
  if (name === "del-farmer") {
    const me = session();
    if (!hasPerm("farmers_delete") && !hasPerm("d", "farmers") && me?.role !== "admin") {
      return toast("ليس لديك صلاحية لحذف ملف مزارع");
    }
    const f = (st.farmers || []).find(x => x.id === id);
    if (!f) return;
    if (!confirm(`هل أنت متأكد من رغبتك في حذف ملف المزارع [${f.name}] نهائياً؟`)) {
      return;
    }
    st.farmers = (st.farmers || []).filter(x => x.id !== id);
    Store.set({ farmers: st.farmers });
    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "delete_farmer",
        module: "farmers",
        severity: "warning",
        title: `حذف ملف مزارع: ${f.name}`,
        summary: `تم حذف ملف المزارع [${f.name}] بواسطة ${me?.name}`,
        details: { id: f.id, name: f.name, contractNo: f.contractNo },
        targetType: "farmer",
        targetId: f.id,
        user: me?.name || "مستخدم",
        role: me?.role || "admin"
      });
    }
    toast("تم حذف ملف المزارع بنجاح"); usersTab = "farmers"; go("users", "farmers");
    return;
  }
  if (name === "inv-tab") { invTab = id; render(); return; }
  if (name === "inv-open-plot") { go("inv-palms", id); return; }
  if (name === "inv-pdf") {
    const palms = investorPalms();
    const w = window.open("", "_blank");
    w.document.write(`<html dir="rtl"><body style="font-family:Arial;padding:24px"><h2>تقرير محفظة ${session().name||""}</h2><p>عدد النخيل: ${palms.length}</p><table border="1" cellpadding="6"><tr><th>الكود</th><th>الصنف</th><th>القطعة</th></tr>${palms.slice(0,200).map(p=>`<tr><td>${p.code}</td><td>${p.variety}</td><td>${p.plot}</td></tr>`).join("")}</table></body></html>`);
    w.document.close(); w.print(); return;
  }
  if (name === "apply-users") {
    userQ = $("#uq")?.value || ""; userRoleF = $("#urolef")?.value || "";
    userSecF = $("#usecf")?.value || ""; userActF = $("#uactf")?.value || ""; render(); return;
  }
  if (name === "user-segment") {
    activeUserMenuId = null;
    userSegmentTab = id;
    try { localStorage.setItem("palm_users_segment_tab", id); } catch (_) {}
    userPage = 1;
    render();
    return;
  }
  if (name === "utab") { usersTab = id; render(); return; }
  if (name === "user-page") { activeUserMenuId = null; userPage = +id || 1; render(); return; }
  if (name === "toggle-top-user-menu") {
    isTopUserMenuOpen = !isTopUserMenuOpen;
    render();
    return;
  }
  if (name === "top-menu-go") {
    isTopUserMenuOpen = false;
    go(id || "profile");
    return;
  }
  if (name === "top-menu-logout") {
    isTopUserMenuOpen = false;
    act("logout");
    return;
  }
  if (name === "toggle-user-menu") {
    const btn = el || document.querySelector(`[data-act="toggle-user-menu"][data-id="${id}"]`);
    const gridWrap = btn?.closest(".grid-wrap");
    const savedGridTop = gridWrap ? gridWrap.scrollTop : 0;
    const savedGridLeft = gridWrap ? gridWrap.scrollLeft : 0;
    const savedWinTop = window.scrollY || document.documentElement.scrollTop || 0;

    activeUserMenuId = (activeUserMenuId === id) ? null : id;
    render();

    if (gridWrap) {
      const newGridWrap = document.querySelector(".grid-wrap");
      if (newGridWrap) {
        newGridWrap.scrollTop = savedGridTop;
        newGridWrap.scrollLeft = savedGridLeft;
      }
    }
    if (savedWinTop > 0) {
      window.scrollTo(0, savedWinTop);
    }

    if (activeUserMenuId) {
      setTimeout(() => {
        const activeBtn = document.querySelector(`[data-act="toggle-user-menu"][data-id="${id}"]`);
        if (activeBtn) {
          activeBtn.scrollIntoView({ block: "nearest", inline: "nearest" });
        }
      }, 30);
    }
    return;
  }
  if (name === "trigger-avatar-upload") {
    const target = el?.dataset?.target;
    if (target && $(`#${target}`)) $(`#${target}`).click();
    return;
  }
  if (name === "clear-avatar") {
    const prevId = el?.dataset?.prev;
    const valId = el?.dataset?.val;
    if (prevId && $(`#${prevId}`)) $(`#${prevId}`).innerHTML = "👤";
    if (valId && $(`#${valId}`)) $(`#${valId}`).value = "";
    toast("تمت إزالة الصورة");
    return;
  }
  if (name === "edit-user") { activeUserMenuId = null; go("user-edit", id); return; }
  if (name === "scope-user") { activeUserMenuId = null; asgUserId = id; usersTab = "scope"; go("users"); return; }
  if (name === "save-user") {
    const u = st.users.find(x => x.id === id); if (!u) return;
    const me = session();
    const isEng = me && me.role === "engineer";
    if (isEng && u.role !== "worker") return toast("غير مسموح للمهندس بتعديل غير العمال");

    u.name = $("#uname").value; u.user = $("#uuser").value; u.phone = $("#uphone").value;
    if ($("#ublood")) u.bloodType = $("#ublood").value;
    if ($("#uavatar_val")) u.avatar = $("#uavatar_val").value;
    if (!isEng && $("#urole")) u.role = $("#urole").value;
    if (!isEng) {
      const checkedRoles = Array.from(document.querySelectorAll(".user-role-chk:checked")).map(el => el.value);
      if (u.role && !checkedRoles.includes(u.role)) checkedRoles.unshift(u.role);
      u.roles = checkedRoles.length > 0 ? checkedRoles : [u.role];
    }
    if ($("#uinventory_scope")) u.inventoryScope = $("#uinventory_scope").value || null;

    let assignedPlots = [...draftScope];
    if (isEng) {
      assignedPlots = assignedPlots.filter(pId => (me.plots || []).includes(pId));
    }
    u.plots = assignedPlots;

    const matrix = {};
    PERMISSIONS_CATALOG.forEach(m => {
      matrix[m.module] = "";
    });
    const customPerms = [];
    $$(".rmx-user").forEach(c => {
      if (!c.checked) return;
      if (!matrix[c.dataset.s]) matrix[c.dataset.s] = "";
      if (!matrix[c.dataset.s].includes(c.dataset.k)) {
        matrix[c.dataset.s] += c.dataset.k;
      }
      if (c.dataset.pid) customPerms.push(c.dataset.pid);
    });
    if (isEng) {
      delete matrix.users;
      delete matrix.settings;
      delete matrix.zakat;
      Object.keys(matrix).forEach(s => {
        matrix[s] = matrix[s].replace(/[da]/g, "");
      });
    }
    u.matrix = matrix;
    u.customPerms = customPerms;

    if (session() && session().id === u.id) {
      const cur = session();
      cur.name = u.name;
      cur.phone = u.phone;
      cur.avatar = u.avatar;
      cur.bloodType = u.bloodType;
      cur.roles = u.roles;
      cur.matrix = u.matrix;
      cur.customPerms = u.customPerms;
      session(cur);
    }

    Store.set({ users: st.users });
    if (typeof Api !== "undefined" && typeof Api.createUser === "function") {
      Api.createUser({
        id: u.id,
        username: u.user,
        fullName: u.name,
        role: u.role,
        roles: u.roles,
        phone: u.phone,
        email: u.email,
        pass: u.pass,
        active: u.active,
        avatar: u.avatar || "",
        bloodType: u.bloodType || "",
        mustChangePassword: u.mustChangePassword,
        plots: u.plots
      }).catch(err => console.warn("API update user error:", err));
    }
    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "update",
        module: "users",
        severity: "info",
        title: `تعديل مستخدم: ${u.name}`,
        summary: `تم تحديث بيانات وصلاحيات المستخدم [${u.name}] (${u.user}) بواسطة ${session()?.name}`,
        details: { name: u.name, user: u.user, role: u.role, phone: u.phone, plots: u.plots },
        targetType: "user",
        targetId: u.id,
        user: session()?.name || "مستخدم",
        role: session()?.role || "worker"
      });
    }
    toast("حُفظ المستخدم والصلاحيات بنجاح ✅"); go("users"); return;
  }
  if (name === "switch-user-edit-tab") {
    activeUserEditTab = id || "basic";
    $$(".user-edit-nav-btn").forEach(btn => {
      const isCur = btn.dataset.id === activeUserEditTab;
      btn.classList.toggle("btn-primary", isCur);
      btn.classList.toggle("btn-ghost", !isCur);
    });
    ["basic", "scope", "perms"].forEach(tabKey => {
      const pane = document.getElementById("user-tab-pane-" + tabKey);
      if (pane) pane.style.display = tabKey === activeUserEditTab ? "block" : "none";
    });
    return;
  }
  if (name === "expand-all-perm-modules") {
    $$("details.perm-module-card").forEach(d => d.open = true);
    toast("تم فتح كل أقسام الصلاحيات 📂");
    return;
  }
  if (name === "collapse-all-perm-modules") {
    $$("details.perm-module-card").forEach(d => d.open = false);
    toast("تم طي كل أقسام الصلاحيات 📁");
    return;
  }
  if (name === "apply-preset-worker") {
    const role = st.roles.find(r => r.id === "worker");
    if (role) {
      $$(".rmx-user").forEach(cb => {
        const s = cb.dataset.s;
        const k = cb.dataset.k;
        const chk = mxChecked(role, s, k);
        cb.checked = !cb.disabled && chk;
        cb.closest(".perm-item")?.classList.toggle("active-perm", cb.checked);
      });
      if (typeof updatePermActiveBadges === "function") updatePermActiveBadges();
      toast("تم تطبيق قالب صلاحيات العامل الميداني بنجاح 🚜");
    }
    return;
  }
  if (name === "apply-preset-engineer") {
    const role = st.roles.find(r => r.id === "engineer");
    if (role) {
      $$(".rmx-user").forEach(cb => {
        const s = cb.dataset.s;
        const k = cb.dataset.k;
        const chk = mxChecked(role, s, k);
        cb.checked = !cb.disabled && chk;
        cb.closest(".perm-item")?.classList.toggle("active-perm", cb.checked);
      });
      if (typeof updatePermActiveBadges === "function") updatePermActiveBadges();
      toast("تم تطبيق قالب صلاحيات المهندس المشرف بنجاح 📐");
    }
    return;
  }
  if (name === "jump-to-investor") {
    const u = st.users.find(x => String(x.id) === String(id));
    let inv = (st.investors || []).find(i => 
      String(i.id) === String(id) ||
      (i.user_id && String(i.user_id) === String(id)) ||
      (u && u.phone && i.phone && i.phone !== "—" && i.phone.replace(/[^0-9]/g, '') === u.phone.replace(/[^0-9]/g, ''))
    );
    const targetInvId = inv ? inv.id : id;
    if (typeof window.openInvestorInHub === "function") {
      window.openInvestorInHub(targetInvId);
    } else {
      go("investors-hub", targetInvId);
    }
    return;
  }
  if (name === "reset-user-mx") {
    const roleId = $("#urole")?.value || id;
    const role = st.roles.find(r => r.id === roleId);
    if (!role) return;
    const isEng = session() && session().role === "engineer";
    $$(".rmx-user").forEach(cb => {
      const s = cb.dataset.s;
      const k = cb.dataset.k;
      const chk = mxChecked(role, s, k);
      const dis = isEng && (k === "d" || k === "a" || s === "users" || s === "settings" || s === "zakat");
      cb.checked = !dis && chk;
      cb.closest(".perm-item")?.classList.toggle("active-perm", cb.checked);
    });
    if (typeof updatePermActiveBadges === "function") updatePermActiveBadges();
    toast("تم تطبيق الصلاحيات الافتراضية للدور: " + (role.name || roleId));
    return;
  }
  if (name === "user-mx-select-all") {
    const isEng = session() && session().role === "engineer";
    $$(".rmx-user").forEach(cb => {
      if (cb.disabled) return;
      const s = cb.dataset.s;
      const k = cb.dataset.k;
      if (isEng && (k === "d" || k === "a" || s === "users" || s === "settings" || s === "zakat")) return;
      cb.checked = true;
      cb.closest(".perm-item")?.classList.toggle("active-perm", true);
    });
    if (typeof updatePermActiveBadges === "function") updatePermActiveBadges();
    toast("تم تحديد كافة الصلاحيات المتاحة");
    return;
  }
  if (name === "user-mx-clear-all") {
    $$(".rmx-user").forEach(cb => {
      if (cb.disabled) return;
      cb.checked = false;
      cb.closest(".perm-item")?.classList.toggle("active-perm", false);
    });
    if (typeof updatePermActiveBadges === "function") updatePermActiveBadges();
    toast("تم مسح كافة الصلاحيات");
    return;
  }
  if (name === "toggle-module-perms") {
    const mod = id || el?.dataset?.mod;
    const cbs = $$(`.rmx-user[data-s="${mod}"]`).filter(cb => !cb.disabled);
    if (!cbs.length) return;
    const anyUnchecked = cbs.some(cb => !cb.checked);
    cbs.forEach(cb => {
      cb.checked = anyUnchecked;
      cb.closest(".perm-item")?.classList.toggle("active-perm", anyUnchecked);
    });
    if (typeof updatePermActiveBadges === "function") updatePermActiveBadges();
    toast(anyUnchecked ? "تم تحديد كامل الموديول" : "تم إلغاء تحديد الموديول");
    return;
  }
  if (name === "asg-all") {
    $$(".asgplot").forEach(c => c.checked = true);
    $$(".asgsec, .asggrp").forEach(c => c.checked = true);
    renderAsgCount();
    toast("تم تحديد كافة قطع المزرعة بالكامل");
    return;
  }
  if (name === "asg-none") {
    $$(".asgplot").forEach(c => c.checked = false);
    $$(".asgsec, .asggrp").forEach(c => c.checked = false);
    renderAsgCount();
    toast("تم إلغاء تحديد كافة القطاعات والقطع");
    return;
  }
  if (name === "asg-expand-all") {
    $$(".sec-card").forEach(c => c.classList.add("open"));
    return;
  }
  if (name === "asg-collapse-all") {
    $$(".sec-card").forEach(c => c.classList.remove("open"));
    return;
  }
  if (name === "asg-sec-select") {
    const secId = id || el?.dataset?.sec || el?.dataset?.id || el?.closest("[data-sec]")?.dataset?.sec;
    const card = document.querySelector("#seccard_" + secId) || el?.closest(".sec-card");
    if (card) {
      card.querySelectorAll(".asgplot").forEach(c => c.checked = true);
      card.querySelectorAll(".asggrp").forEach(c => c.checked = true);
      const b = card.querySelector(".asgsec");
      if (b) b.checked = true;
      renderAsgCount();
      toast(`تم تحديد كافة قطع ${sectorName(secId)}`);
    }
    return;
  }
  if (name === "asg-sec-clear") {
    const secId = id || el?.dataset?.sec || el?.dataset?.id || el?.closest("[data-sec]")?.dataset?.sec;
    const card = document.querySelector("#seccard_" + secId) || el?.closest(".sec-card");
    if (card) {
      card.querySelectorAll(".asgplot").forEach(c => c.checked = false);
      card.querySelectorAll(".asggrp").forEach(c => c.checked = false);
      const b = card.querySelector(".asgsec");
      if (b) b.checked = false;
      renderAsgCount();
      toast(`تم إلغاء تحديد قطع ${sectorName(secId)}`);
    }
    return;
  }
  if (name === "asg-sec-toggle" || name === "asg-sec-header") {
    const secId = id || el?.dataset?.sec || el?.dataset?.id || el?.closest("[data-sec]")?.dataset?.sec;
    const card = document.querySelector("#seccard_" + secId) || el?.closest(".sec-card");
    if (card) card.classList.toggle("open");
    return;
  }
  if (name === "asg-part") {
    $$(".asgplot").forEach(c => { if ((c.value||"").toUpperCase().endsWith(id)) c.checked = true; });
    renderAsgCount();
    toast(`تم تحديد كافة الأجزاء (${id})`);
    return;
  }
  if (name === "save-scope") {
    const uid = $("#asguser")?.value;
    const u = st.users.find(x => x.id === uid);
    if (!u) return;
    const selectedPlots = $$(".asgplot").filter(c => c.checked).map(c => c.value);

    // Multi-role safeguard: If user also has investor role, preserve legacy plot holdings in u.investorPlots
    const uRoles = Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : [u.role];
    if (uRoles.includes("investor") && !u.investorPlots && (st.contracts || []).every(c => String(c.investorUserId || c.investor_id) !== String(u.id))) {
      u.investorPlots = [...(u.plots || [])];
    }

    u.plots = selectedPlots;
    Store.set({ users: st.users });
    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "update_user_scope",
        module: "users",
        severity: "info",
        title: `تحديث نطاق الإشراف: ${u.name}`,
        summary: `تم إسناد ${selectedPlots.length} قطعة للمستخدم [${u.name}] بواسطة ${session()?.name}`,
        details: { targetUserId: u.id, plotCount: selectedPlots.length, plots: selectedPlots },
        targetType: "user",
        targetId: u.id,
        user: session()?.name || "مدير النظام",
        role: session()?.role || "admin"
      });
    }
    toast(`تم حفظ نطاق العمل (${selectedPlots.length} قطعة) للمستخدم ${u.name} بنجاح ✅`);
    render();
    return;
  }
  if (name === "bulk-off") {
    const ids = $$(".uchk").filter(c=>c.checked).map(c=>c.value);
    if (!ids.length) return toast("حدد حسابات");
    st.users.forEach(u => { if (ids.includes(u.id) && u.role!=="admin") u.active = false; });
    Store.set({ users: st.users });
    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "bulk_deactivate_users",
        module: "users",
        severity: "warning",
        title: `تعطيل جماعي لـ ${ids.length} حساب`,
        summary: `تم تعطيل ${ids.length} حساب مستخدم دفعة واحدة بواسطة ${session()?.name}`,
        details: { count: ids.length, userIds: ids },
        targetCount: ids.length,
        targetType: "users_bulk",
        user: session()?.name || "مستخدم",
        role: session()?.role || "worker"
      });
    }
    toast("عُطّلت الحسابات المحددة"); render(); return;
  }
  if (name === "export-users") {
    const rows = ["\uFEFFالاسم,الدخول,الدور,الجوال,النطاق,الحالة,آخر نشاط"];
    st.users.forEach(u => rows.push(`${u.name},${u.user},${roleLabel(u.role)},${u.phone||""},${(u.plots||[]).join("|")},${u.active===false?"معطل":"نشط"},${u.lastSeen||""}`));
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([rows.join("\n")],{type:"text/csv;charset=utf-8"})); a.download="المستخدمون.csv"; a.click(); return;
  }
  if (name === "tog-user") {
    activeUserMenuId = null;
    const u = st.users.find(x => x.id === id); if (!u) return;
    const me = session();
    if (me && me.role === "engineer" && u.role !== "worker") return toast("غير مسموح للمهندس بتعطيل هذا الحساب");
    if (u.role === "admin") return toast("لا يُعطَّل حساب الإدارة الافتراضي");
    u.active = u.active === false; Store.set({ users: st.users });
    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: u.active ? "activate_user" : "deactivate_user",
        module: "users",
        severity: "warning",
        title: `${u.active ? "تنشيط" : "تعطيل"} حساب: ${u.name}`,
        summary: `تم ${u.active ? "تنشيط" : "تعطيل"} حساب المستخدم [${u.name}] (${u.user}) بواسطة ${session()?.name}`,
        details: { id: u.id, name: u.name, user: u.user, active: u.active },
        targetType: "user",
        targetId: u.id,
        user: session()?.name || "مستخدم",
        role: session()?.role || "worker"
      });
    }
    toast(u.active===false?"عُطّل":"نُشّط"); render(); return;
  }
  if (name === "del-user") {
    activeUserMenuId = null;
    const me = session();
    if (!hasPerm("users_delete") && !hasPerm("d", "users") && me?.role !== "admin" && !me?.isSuperAdmin) {
      return toast("ليس لديك صلاحية لحذف حسابات المستخدمين");
    }
    const u = (st.users || []).find(x => x.id === id);
    if (!u) return;
    if (u.id === me?.id) {
      return toast("لا يمكنك حذف حسابك الشخصي الحالي");
    }
    if (u.role === "admin" || u.isSuperAdmin) {
      return toast("لا يمكن حذف حساب الإدارة الرئيسي للنظام");
    }
    if (!confirm(`هل أنت متأكد من رغبتك في حذف حساب [${u.name}] نهائياً؟\n\nسيتم إزالة الحساب وكافة الصلاحيات والإسنادات التابعة له ولا يمكن التراجع عن هذا الإجراء.`)) {
      return;
    }

    if (typeof fetch !== "undefined") {
      fetch('/api/users/' + encodeURIComponent(id), { method: 'DELETE' }).catch(err => console.warn("API user delete error:", err));
    }

    st.users = (st.users || []).filter(x => x.id !== id);
    Store.set({ users: st.users });

    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "delete_user",
        module: "users",
        severity: "critical",
        title: `حذف حساب: ${u.name}`,
        summary: `تم حذف حساب المستخدم [${u.name}] (${u.user}) نهائياً بواسطة ${me?.name}`,
        details: { id: u.id, name: u.name, user: u.user, role: u.role },
        targetType: "user",
        targetId: u.id,
        user: me?.name || "مستخدم",
        role: me?.role || "admin"
      });
    }

    toast("تم حذف الحساب بنجاح");
    render();
    return;
  }
  if (name === "reset-pass") {
    activeUserMenuId = null;
    const u = st.users.find(x => x.id === id); if (!u) return;
    const me = session();
    if (me && me.role === "engineer" && u.role !== "worker") return toast("غير مسموح للمهندس بتغيير كلمة مرور هذا الحساب");
    
    if (!confirm(`هل تريد بالتأكيد إعادة تعيين كلمة المرور للمستخدم (${u.name})؟\n\nسيتم إلغاء كلمة المرور السابقة وتوليد كلمة مرور مؤقتة جديدة فوراً.`)) {
      return;
    }

    let tempPass = "Palm#" + Math.floor(1000 + Math.random() * 9000) + "!xK";
    if (typeof Api !== "undefined" && typeof Api.adminResetPassword === "function" && Api.isOnline()) {
      try {
        const res = await Api.adminResetPassword(u.id);
        if (res && res.success && res.tempPassword) {
          tempPass = res.tempPassword;
        }
      } catch (err) {
        console.warn("API reset password fallback:", err);
      }
    }
    u.pass = tempPass;
    u.mustChangePassword = true;
    Store.set({ users: st.users });

    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "reset_password",
        module: "users",
        severity: "warning",
        title: `إعادة كلمة المرور: ${u.name}`,
        summary: `تم إعادة تعيين كلمة مرور المستخدم [${u.name}] بواسطة ${session()?.name}`,
        details: { id: u.id, name: u.name, user: u.user },
        targetType: "user",
        targetId: u.id,
        user: session()?.name || "مستخدم",
        role: session()?.role || "worker"
      });
    }

    sharedCredentialsData = {
      ...u,
      tempPassword: tempPass,
      isReset: true,
      title: `إعادة تعيين كلمة مرور: ${u.name}`
    };
    toast(`تم إعادة تعيين كلمة المرور للمستخدم ${u.name} بنجاح 🔑`);
    render();
    return;
  }
  if (name === "toggle-pass-vis") {
    const targetId = el?.dataset?.target || "pass";
    const inp = $("#" + targetId);
    if (inp) {
      const isPass = inp.type === "password";
      inp.type = isPass ? "text" : "password";
      if (el) el.textContent = isPass ? "🙈" : "👁️";
    }
    return;
  }
  if (name === "open-forgot-modal") {
    showForgotPasswordModal = true;
    render();
    return;
  }
  if (name === "close-forgot-modal") {
    showForgotPasswordModal = false;
    render();
    return;
  }
  if (name === "submit-forgot-pass") {
    const val = $("#forgot_identifier")?.value?.trim();
    if (!val) return toast("يرجى إدخال اسم المستخدم أو البريد الإلكتروني");
    if (typeof Api !== "undefined" && typeof Api.forgotPassword === "function") {
      try {
        const res = await Api.forgotPassword(val);
        if (res && res.success) {
          showForgotPasswordModal = false;
          if (res.token) {
            activeResetToken = res.token;
            toast("✅ تم إصدار رمز استعادة كلمة المرور بنجاح");
          } else {
            toast(res.message || "تم تسجيل طلب الاستعادة بنجاح");
          }
          render();
          return;
        } else if (res && res.error && res.error !== "offline") {
          return toast(res.error);
        }
      } catch (err) {
        console.warn("Forgot password error:", err);
      }
    }
    // Password recovery always needs the server
    toast("استعادة كلمة المرور تتطلب الاتصال بالخادم، يرجى المحاولة عند توفر الاتصال");
    return;
  }
  if (name === "close-reset-modal") {
    activeResetToken = null;
    render();
    return;
  }
  if (name === "submit-reset-pass") {
    const p1 = $("#reset_new_pass")?.value;
    const p2 = $("#reset_confirm_pass")?.value;
    if (!p1 || p1.length < 6) return toast("كلمة المرور يجب ألا تقل عن 6 خانات");
    if (p1 !== p2) return toast("كلمتا المرور غير متطابقتين");
    if (activeResetToken && !activeResetToken.startsWith("local_") && typeof Api !== "undefined" && typeof Api.resetPassword === "function") {
      try {
        const res = await Api.resetPassword(activeResetToken, p1);
        if (res && res.success) {
          activeResetToken = null;
          toast("✅ تم تعيين كلمة المرور الجديدة بنجاح! يمكنك الآن تسجيل الدخول");
          render();
          return;
        } else if (res && res.error && res.error !== "offline") {
          return toast(res.error);
        }
      } catch (err) {
        console.warn("Reset password error:", err);
      }
    }
    if (forceChangePasswordUser) {
      forceChangePasswordUser.pass = p1;
      forceChangePasswordUser.mustChangePassword = false;
      Store.set({ users: st.users });
      forceChangePasswordUser = null;
    }
    activeResetToken = null;
    toast("✅ تم تعيين كلمة المرور الجديدة بنجاح! يمكنك الآن تسجيل الدخول");
    render();
    return;
  }
  if (name === "submit-force-change-pass") {
    const p1 = $("#force_new_pass")?.value;
    const p2 = $("#force_confirm_pass")?.value;
    if (!p1 || p1.length < 6) return toast("كلمة المرور يجب ألا تقل عن 6 خانات");
    if (p1 !== p2) return toast("كلمتا المرور غير متطابقتين");
    const u = forceChangePasswordUser;
    if (!u) return;
    if (typeof Api !== "undefined" && typeof Api.changePassword === "function") {
      try {
        const res = await Api.changePassword(u.id, null, p1, u.user);
        if (res && res.success) {
          if (typeof Auth !== "undefined") Auth.rememberOfflineLogin(u, p1);
          u.mustChangePassword = false;
          forceChangePasswordUser = null;
          Store.set({ session: u });
          toast("✅ تم تعيين كلمة المرور الشخصية وتفعيل الحساب بنجاح!");
          go(homeFor(u.role));
          return;
        } else if (res && res.error && res.error !== "offline") {
          return toast(res.error);
        }
      } catch (err) {
        console.warn("Change pass error:", err);
      }
    }
    toast("تغيير كلمة المرور يتطلب الاتصال بالخادم، يرجى المحاولة عند توفر الاتصال");
    return;
  }
  if (name === "copy-creds-pass") {
    const val = el?.dataset?.val;
    if (val) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(val).then(() => {
          toast("📋 تم نسخ كلمة المرور للحافظة");
        }).catch(() => {
          copyFallback(val, "📋 تم نسخ كلمة المرور للحافظة");
        });
      } else {
        copyFallback(val, "📋 تم نسخ كلمة المرور للحافظة");
      }
    }
    return;
  }
  if (name === "copy-full-creds") {
    const msg = el?.dataset?.msg;
    if (msg) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(msg).then(() => {
          toast("📋 تم نسخ بيانات الدخول بالكامل للحافظة");
        }).catch(() => {
          copyFallback(msg, "📋 تم نسخ بيانات الدخول بالكامل للحافظة");
        });
      } else {
        copyFallback(msg, "📋 تم نسخ بيانات الدخول بالكامل للحافظة");
      }
    }
    return;
  }
  if (name === "close-creds-modal") {
    sharedCredentialsData = null;
    render();
    return;
  }
  if (name === "close-photo-preview") {
    activePreviewPhoto = null;
    render();
    return;
  }
  if (name === "open-id-card") {
    idCardData = sharedCredentialsData || idCardData;
    sharedCredentialsData = null;
    render();
    return;
  }
  if (name === "close-id-card") {
    idCardData = null;
    render();
    return;
  }
  if (name === "open-id-card-user") {
    activeUserMenuId = null;
    const u = (st.users || []).find(x => x.id === id);
    if (!u) return toast("المستخدم غير موجود");
    idCardData = u;
    render();
    return;
  }
  if (name === "share-creds-user") {
    activeUserMenuId = null;
    const u = (st.users || []).find(x => x.id === id);
    if (!u) return toast("المستخدم غير موجود");
    const defUsers = (typeof Store !== "undefined" && Store.def) ? (Store.def().users || []) : [];
    const defU = defUsers.find(d => d.id === u.id || d.user === u.user);
    const knownPass = u.pass || defU?.pass || (["admin","engineer","worker","investor","nursery","storage","care","inv2","inv3","inv4"].includes(u.user) ? "1234" : "");

    sharedCredentialsData = {
      ...u,
      tempPassword: knownPass || "1234",
      isReset: false,
      title: `بيانات حساب: ${u.name}`
    };
    render();
    return;
  }
  return ACT_NEXT;
}
