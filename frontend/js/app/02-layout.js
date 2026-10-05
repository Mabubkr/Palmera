// PalmTrace app — Render loop, page layout, view router, security modals, login
// (split from the former single app.js; files are classic scripts loaded in order by index.html)

function render(extra) {
  invalidatePalmIndex();
  const s = session();
  if (!s && current !== "login") current = "login";
  if (s && current === "login") current = homeFor(s.role);
  if (s) checkRoutineReminders();
  document.body.classList.toggle("outdoor", isOutdoor());
  document.body.classList.remove("nav-open");
  applyUserBg();
  updateAppFavicon();

  // Save scroll positions before DOM replacement
  const winScrollX = window.scrollX || document.documentElement.scrollLeft || 0;
  const winScrollY = window.scrollY || document.documentElement.scrollTop || 0;
  const scrollables = [];
  document.querySelectorAll(".grid-wrap, .table-wrap, .main, .app").forEach((elem, idx) => {
    if (elem.scrollTop > 0 || elem.scrollLeft > 0) {
      scrollables.push({ idx, top: elem.scrollTop, left: elem.scrollLeft });
    }
  });

  try {
    $("#app").innerHTML = layout(view(extra ?? lastExtra));
    bind();
  } catch (err) {
    console.error("Render crash:", err);
    try {
      $("#app").innerHTML = `<div class="card" style="margin:20px;padding:24px;border:1.5px solid #DC2626;background:#FEF2F2;color:#991B1B">
        <h3 style="margin-top:0">⚠️ تعذر عرض هذه الصفحة</h3>
        <p>${escapeHtml(err.message)}</p>
        <button class="btn btn-primary" onclick="location.reload()">إعادة تحميل التطبيق 🔄</button>
      </div>`;
    } catch (e) {}
  }

  // Restore scroll positions after DOM replacement
  if (scrollables.length > 0) {
    document.querySelectorAll(".grid-wrap, .table-wrap, .main, .app").forEach((elem, idx) => {
      const match = scrollables.find(item => item.idx === idx);
      if (match) {
        elem.scrollTop = match.top;
        elem.scrollLeft = match.left;
      }
    });
  }
  if (winScrollX > 0 || winScrollY > 0) {
    window.scrollTo(winScrollX, winScrollY);
  }
}

function pendingVouchersCount() {
  const me = session() || {};
  const vouchers = Store.get().fertilizerVouchers || [];
  if (me.role === "admin" || me.role === "warehouse_mgr") return vouchers.filter(v => v.status === "pending").length;
  return vouchers.filter(v => v.status === "pending" && (v.toUser === me.id || (me.plots || []).some(pl => pl.startsWith(v.sectorId)))).length;
}

let isTopUserMenuOpen = false;

function layout(inner) {
  const s = session();
  if (!s) return inner + renderSecurityModals();
  const onField = ["palms","palm-new","generate","import","palm","op","offshoot","ops-admin","op-detail","fertilizers","nursery"].includes(current);
  const onProd = ["yields","zakat-admin","reports"].includes(current);
  const onAdmin = ["users","user-new","user-edit","roles","settings","farmers","farmer","farmer-new"].includes(current);
  const isAdmin = Boolean(s.role === "admin" || s.role === "super_admin" || s.user === "admin");
  const isAnyAdmin = isAdmin;

  const canSeePalms = isAnyAdmin || hasPerm("palms");
  const canSeeGis = isAnyAdmin || hasPerm("gis") || hasPerm("gis_view") || hasPerm("palms") || s.role === "worker";
  const canSeeOps = isAnyAdmin || hasPerm("ops");
  const canSeeFertilizers = isAnyAdmin || s.role === "engineer" || s.role === "warehouse_mgr" || hasPerm("fertilizers") || hasPerm("ops");
  const canSeeNursery = isAnyAdmin || hasPerm("nursery") || s.role === "nursery_mgr";
  const canSeeYields = isAnyAdmin || hasPerm("yields");
  const canSeeZakat = isAnyAdmin || s.role === "customer_care" || hasPerm("zakat");
  const canSeeReports = isAnyAdmin || s.role === "warehouse_mgr" || s.role === "customer_care" || hasPerm("reports");
  const canSeeFarmers = hasPerm("farmers") || hasPerm("farmers_view");
  const canSeeUsers = isAnyAdmin || hasPerm("users") || hasPerm("users_view");
  const canSeeSettings = isAnyAdmin || hasPerm("settings");
  const canSeeAudit = isAnyAdmin || hasPerm("audit_view") || hasPerm("settings");
  const canSeeInvestors = isAnyAdmin || s.role === "customer_care" || s.role === "manager" || hasPerm("investors") || hasPerm("contracts");
  const adminNav = `
    <nav class="sidebar-nav">
      <!-- المجموعة 1: المتابعة ونظرة عامة -->
      <div class="nav-group">
        <span class="nav-group-title">📊 المتابعة ونظرة عامة</span>
        <a data-go="dash" class="nav-item ${current === "dash" ? "active" : ""}">
          <span class="nav-icon">📊</span>
          <span class="nav-label">المؤشرات العامة</span>
        </a>
        ${canSeeGis ? `
          <a data-go="gis" class="nav-item ${current === "gis" ? "active" : ""}">
            <span class="nav-icon">🗺️</span>
            <span class="nav-label">الخريطة التفاعلية</span>
          </a>
        ` : ""}
      </div>

      <!-- المجموعة 2: العمليات والحقل -->
      <div class="nav-group">
        <span class="nav-group-title">🌾 العمليات والميدان</span>
        ${canSeePalms ? `
          <a data-go="palms" class="nav-item ${["palms","palm-new","generate","import","palm","sector","plot"].includes(current) ? "active" : ""}">
            <span class="nav-icon">🌴</span>
            <span class="nav-label">الأشجار والقطع</span>
          </a>
        ` : ""}
        ${canSeeOps ? `
          <a data-go="ops-admin" class="nav-item ${["ops-admin","op-detail","bulk-op","early-warning"].includes(current) ? "active" : ""}">
            <span class="nav-icon">🚜</span>
            <span class="nav-label">العمليات الزراعية</span>
          </a>
        ` : ""}
        ${canSeeFertilizers ? `
          <a data-go="fertilizers" class="nav-item ${current === "fertilizers" ? "active" : ""}">
            <span class="nav-icon">📦</span>
            <span class="nav-label">الأسمدة والمخزون</span>
            ${pendingVouchersCount() ? `<span class="nav-badge alert">${pendingVouchersCount()}</span>` : ""}
          </a>
        ` : ""}
        ${canSeeNursery ? `
          <a data-go="nursery" class="nav-item ${current === "nursery" ? "active" : ""}">
            <span class="nav-icon">🌱</span>
            <span class="nav-label">المشتل والفسائل</span>
          </a>
        ` : ""}
      </div>

      <!-- المجموعة 3: الحصاد والتتبع الذكي -->
      ${canSeeYields ? `
        <div class="nav-group">
          <span class="nav-group-title">📦 الحصاد والتتبع الذكي</span>
          <a data-go="yields" class="nav-item ${current === "yields" ? "active" : ""}">
            <span class="nav-icon">🧺</span>
            <span class="nav-label">شحنات المحصول والفرز</span>
          </a>
        </div>
      ` : ""}

      <!-- المجموعة 4: الزراعة الذكية -->
      ${hasPerm("ai_view") ? `
        <div class="nav-group">
          <span class="nav-group-title">✨ الزراعة الذكية (Agri-AI)</span>
          <a data-go="ai-hub" class="nav-item ${current === "ai-hub" ? "active" : ""}">
            <span class="nav-icon">✨</span>
            <span class="nav-label">المركز الذكي (Agri-AI Hub)</span>
          </a>
        </div>
      ` : ""}

      <!-- المجموعة 5: الاستثمار والمالية -->
      ${canSeeInvestors || canSeeZakat || canSeeReports ? `
        <div class="nav-group">
          <span class="nav-group-title">💼 الاستثمار والمالية</span>
          ${canSeeInvestors ? `
            <a data-go="investors-hub" class="nav-item ${current === "investors-hub" ? "active" : ""}">
              <span class="nav-icon">💼</span>
              <span class="nav-label">المستثمرون والعقود</span>
            </a>
          ` : ""}
          ${canSeeZakat ? `
            <a data-go="zakat-admin" class="nav-item ${current === "zakat-admin" ? "active" : ""}">
              <span class="nav-icon">⚖️</span>
              <span class="nav-label">حساب وتوزيع الزكاة</span>
            </a>
          ` : ""}
          ${canSeeReports ? `
            <a data-go="reports" class="nav-item ${current === "reports" ? "active" : ""}">
              <span class="nav-icon">📈</span>
              <span class="nav-label">التقارير الشاملة</span>
            </a>
          ` : ""}
        </div>
      ` : ""}

      <!-- المجموعة 6: إدارة النظام والرقابة -->
      ${canSeeUsers || canSeeAudit || canSeeSettings ? `
        <div class="nav-group">
          <span class="nav-group-title">⚙️ إدارة النظام والرقابة</span>
          ${canSeeUsers ? `
            <a data-go="users" class="nav-item ${["users","user-new","user-edit","roles"].includes(current) ? "active" : ""}">
              <span class="nav-icon">👥</span>
              <span class="nav-label">المستخدمون والصلاحيات</span>
            </a>
          ` : ""}
          ${canSeeAudit ? `
            <a data-go="audit" class="nav-item ${current === "audit" ? "active" : ""}">
              <span class="nav-icon">🛡️</span>
              <span class="nav-label">سجل التدقيق والرقابة</span>
            </a>
          ` : ""}
          ${canSeeSettings ? `
            <a data-go="settings" class="nav-item ${current === "settings" ? "active" : ""}">
              <span class="nav-icon">⚙️</span>
              <span class="nav-label">الإعدادات العامة</span>
            </a>
          ` : ""}
        </div>
      ` : ""}
    </nav>
  `;
  const isField = s.role === "worker";
  const isInv = s.role === "investor";
  const isNur = s.role === "nursery_mgr";
  const isWh = s.role === "warehouse_mgr";
  const isCare = s.role === "customer_care";
  const canShowLang = !!(Store.get()?.settings?.showLangToggle);
  const isRoot = current === homeFor(s.role) && stack.length === 0;
  const canGoBack = !isRoot && current !== "login";
  return `
    ${s.role==="worker"||s.role==="engineer"||s.role==="nursery_mgr"||s.role==="warehouse_mgr"?netBanner():""}
    <div class="topbar">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        ${brandHtml()}
        <div class="who">${s.name} — <span class="badge" style="background:#1B5E20;color:#fff;font-size:12px;padding:2px 8px;border-radius:6px">${roleLabel(s.role)}</span></div>
        ${renderRoleSwitcher(s)}
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button class="btn btn-ghost icon-btn menu-btn" data-act="toggle-nav">${t("menu_label", "القائمة")}</button>
        ${canGoBack ? `<button class="btn-topbar-icon btn-topbar-back" data-act="back" title="${t("btn_back", "رجوع للصفحة السابقة")}">↩</button>` : ''}
        <button class="btn-topbar-icon ${isOutdoor() ? 'active outdoor-on' : ''}" data-act="toggle-outdoor" title="${isOutdoor() ? t("outdoor_standard", "إيقاف وضع الميدان (تباين قياسي)") : t("outdoor_mode", "وضع الميدان (تباين عالي تحت أشعة الشمس)")}">${isOutdoor() ? '☀️' : '🚜'}</button>
        <button class="btn-topbar-icon ${current==='notifications'?'active':''}" data-go="notifications" title="${t("nav_notifications", "الإشعارات والتنبيهات")}">
          🔔 ${unreadNotificationsCount() ? `<span class="topbar-badge">${unreadNotificationsCount()}</span>` : ''}
        </button>
        ${canShowLang ? `<button class="btn-topbar-icon" data-act="toggle-lang" title="${I18n.getLang()==='ar'?'Switch to English':'التبديل إلى العربية'}">🌐</button>` : ''}
        <div class="topbar-user-menu-wrap">
          <button class="topbar-profile-btn ${isTopUserMenuOpen ? 'open' : ''} ${current==='profile' ? 'active' : ''}" data-act="toggle-top-user-menu" title="${t("nav_profile", "حسابي وإعدادات المستخدم")}">
            ${s.avatar ? `<img src="${s.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover" alt="Profile" />` : `<span class="avatar-icon">👨‍🌾</span>`}
            <span class="avatar-gear-badge" title="خيارات الحساب">⚙️</span>
          </button>
          ${isTopUserMenuOpen ? `
            <div class="topbar-user-dropdown card">
              <div class="topbar-user-dropdown-header">
                <div class="topbar-user-dropdown-name">${escapeHtml(s.name || s.user)}</div>
                <div class="topbar-user-dropdown-meta">
                  <span class="badge" style="background:var(--green);color:#fff;font-size:11px;padding:2px 7px;border-radius:6px">${roleLabel(s.role)}</span>
                  <span class="muted" style="font-size:11px">@${escapeHtml(s.user || '')}</span>
                </div>
              </div>
              <button type="button" class="topbar-user-dropdown-item" data-act="top-menu-go" data-id="profile">
                <span class="item-icon">👤</span>
                <div class="item-text">
                  <div class="item-title">الملف الشخصي</div>
                  <div class="item-sub">عرض وتعديل بيانات الحساب</div>
                </div>
              </button>
              <button type="button" class="topbar-user-dropdown-item item-danger" data-act="top-menu-logout">
                <span class="item-icon">🚪</span>
                <div class="item-text">
                  <div class="item-title">تسجيل الخروج</div>
                  <div class="item-sub">إنهاء الجلسة الحالية</div>
                </div>
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
    <div class="nav-mask" data-act="toggle-nav"></div>
    <div class="layout">
      <aside class="sidebar">
        <!-- رأس القائمة -->
        ${(() => {
          const co = (typeof getActiveCompany === "function") ? getActiveCompany() : null;
          const sBrandName = co?.tradeName || co?.trade_name || co?.name || Store.get()?.settings?.companyName || "منظومة النخيل";
          const sBrandLogo = co?.logo || Store.get()?.settings?.logo || "";
          return `
          <div class="sidebar-brand">
            <div class="brand-logo-wrap" style="overflow:hidden;display:flex;align-items:center;justify-content:center">
              ${sBrandLogo ? `<img src="${sBrandLogo}" style="width:100%;height:100%;object-fit:contain;border-radius:6px" alt="logo" />` : '🌿'}
            </div>
            <div class="brand-info">
              <span class="brand-title" title="${escapeHtml(sBrandName)}">${escapeHtml(sBrandName)}</span>
              <span class="brand-sub">إدارة النخيل والزراعة الذكية</span>
            </div>
          </div>`;
        })()}
        ${isCare ? `
        <nav class="sidebar-nav">
          <div class="nav-group">
            <span class="nav-group-title">رعاية العملاء والمجتمع</span>
            <a data-go="dash" class="nav-item ${current==="dash"?"active":""}">
              <span class="nav-icon">📊</span>
              <span class="nav-label">${t("nav_dash", "المؤشرات العامة")}</span>
            </a>
            <a data-go="zakat-admin" class="nav-item ${current==="zakat-admin"?"active":""}">
              <span class="nav-icon">⚖️</span>
              <span class="nav-label">${t("nav_zakat", "إدارة الزكاة والشركاء")}</span>
            </a>
            <a data-go="reports" class="nav-item ${current==="reports"?"active":""}">
              <span class="nav-icon">📈</span>
              <span class="nav-label">${t("nav_reports", "التقارير المجتمعية")}</span>
            </a>
            <a data-go="notifications" class="nav-item ${current==="notifications"?"active":""}">
              <span class="nav-icon">🔔</span>
              <span class="nav-label">${t("nav_notifications", "الإشعارات")}</span>
              ${unreadNotificationsCount() ? `<span class="nav-badge alert">${unreadNotificationsCount()}</span>` : ''}
            </a>
          </div>
        </nav>
      ` : isNur ? `
        <nav class="sidebar-nav">
          <div class="nav-group">
            <span class="nav-group-title">إدارة المشتل</span>
            <a data-go="nursery" class="nav-item ${current==="nursery"?"active":""}">
              <span class="nav-icon">🌱</span>
              <span class="nav-label">المشتل والتكاثر</span>
            </a>
            <a data-go="dash" class="nav-item ${current==="dash"?"active":""}">
              <span class="nav-icon">📊</span>
              <span class="nav-label">المؤشرات العامة</span>
            </a>
            <a data-go="notifications" class="nav-item ${current==="notifications"?"active":""}">
              <span class="nav-icon">🔔</span>
              <span class="nav-label">الإشعارات</span>
              ${unreadNotificationsCount() ? `<span class="nav-badge alert">${unreadNotificationsCount()}</span>` : ''}
            </a>
          </div>
        </nav>
      ` : isWh ? `
        <nav class="sidebar-nav">
          <div class="nav-group">
            <span class="nav-group-title">المستودع والمخازن</span>
            <a data-go="fertilizers" class="nav-item ${current==="fertilizers"?"active":""}">
              <span class="nav-icon">📦</span>
              <span class="nav-label">الأسمدة والمخزون</span>
              ${pendingVouchersCount() ? `<span class="nav-badge alert">${pendingVouchersCount()}</span>` : ''}
            </a>
            <a data-go="dash" class="nav-item ${current==="dash"?"active":""}">
              <span class="nav-icon">📊</span>
              <span class="nav-label">المؤشرات العامة</span>
            </a>
            <a data-go="reports" class="nav-item ${current==="reports"?"active":""}">
              <span class="nav-icon">📈</span>
              <span class="nav-label">تقارير المخزون</span>
            </a>
            <a data-go="notifications" class="nav-item ${current==="notifications"?"active":""}">
              <span class="nav-icon">🔔</span>
              <span class="nav-label">الإشعارات</span>
              ${unreadNotificationsCount() ? `<span class="nav-badge alert">${unreadNotificationsCount()}</span>` : ''}
            </a>
          </div>
        </nav>
      ` : isInv ? `
        <nav class="sidebar-nav">
          <div class="nav-group">
            <span class="nav-group-title">بوابة المستثمر</span>
            <a data-go="inv-home" class="nav-item ${current==="inv-home"?"active":""}">
              <span class="nav-icon">🏠</span>
              <span class="nav-label">الرئيسية</span>
            </a>
            <a data-go="inv-palms" class="nav-item ${current==="inv-palms"?"active":""}">
              <span class="nav-icon">🌴</span>
              <span class="nav-label">نخيلي وأصولي</span>
            </a>
            <a data-go="inv-zakat" class="nav-item ${current==="inv-zakat"?"active":""}">
              <span class="nav-icon">⚖️</span>
              <span class="nav-label">الزكاة والأرباح</span>
            </a>
            <a data-go="inv-photos" class="nav-item ${current==="inv-photos"?"active":""}">
              <span class="nav-icon">📷</span>
              <span class="nav-label">سجل الصور والتطور</span>
            </a>
            <a data-go="notifications" class="nav-item ${current==="notifications"?"active":""}">
              <span class="nav-icon">🔔</span>
              <span class="nav-label">الإشعارات</span>
              ${unreadNotificationsCount() ? `<span class="nav-badge alert">${unreadNotificationsCount()}</span>` : ''}
            </a>
          </div>

          ${(hasPerm("ai_ndvi") || hasPerm("ai_irrigation") || hasPerm("ai_chat_advisor")) ? `
          <div class="nav-group">
            <span class="nav-group-title">الزراعة الذكية والمتابعة</span>
            ${hasPerm("ai_ndvi") ? `
            <a data-go="ai-hub" data-id="plot-ndvi" class="nav-item ${current==="ai-hub" && (typeof AgriAIHub !== "undefined" && typeof AgriAIHub.getActiveTab === "function" ? AgriAIHub.getActiveTab()==="plot-ndvi" : true) ? "active":""}">
              <span class="nav-icon">🛰️</span>
              <span class="nav-label">صحة نخيلي (NDVI)</span>
            </a>` : ''}
            ${hasPerm("ai_irrigation") ? `
            <a data-go="ai-hub" data-id="smart-irrigation" class="nav-item ${current==="ai-hub" && (typeof AgriAIHub !== "undefined" && typeof AgriAIHub.getActiveTab === "function" ? AgriAIHub.getActiveTab()==="smart-irrigation" : false) ? "active":""}">
              <span class="nav-icon">💧</span>
              <span class="nav-label">الري المقنن لأشجاري</span>
            </a>` : ''}
            ${hasPerm("ai_chat_advisor") ? `
            <a data-go="ai-hub" data-id="agri-chat" class="nav-item ${current==="ai-hub" && (typeof AgriAIHub !== "undefined" && typeof AgriAIHub.getActiveTab === "function" ? AgriAIHub.getActiveTab()==="agri-chat" : false) ? "active":""}">
              <span class="nav-icon">💬</span>
              <span class="nav-label">المستشار الزراعي الذكي</span>
            </a>` : ''}
          </div>` : ''}
        </nav>
      ` : isField ? `
        <nav class="sidebar-nav">
          <div class="nav-group">
            <span class="nav-group-title">العمليات والميدان</span>
            <a data-go="home" class="nav-item ${current==="home"?"active":""}">
              <span class="nav-icon">🏠</span>
              <span class="nav-label">الرئيسية</span>
            </a>
            <a data-go="worker-rework" class="nav-item ${current==="worker-rework"?"active":""}" style="${workerReworkCount() ? 'background:rgba(234,88,12,0.15);color:#FDBA74' : ''}">
              <span class="nav-icon">⚠️</span>
              <span class="nav-label">مهام تحتاج مراجعة</span>
              ${workerReworkCount() ? `<span class="nav-badge alert">${workerReworkCount()}</span>` : ''}
            </a>
            <a data-go="scan" class="nav-item ${current==="scan"?"active":""}">
              <span class="nav-icon">🌴</span>
              <span class="nav-label">الأشجار والحقل</span>
            </a>
            <a data-go="ai-hub" data-id="voice-copilot" class="nav-item ${current==="ai-hub"?"active":""}">
              <span class="nav-icon">🎙️</span>
              <span class="nav-label">المساعد الصوتي الميداني</span>
            </a>
            ${canSeeGis ? `
            <a data-go="gis" class="nav-item ${current==="gis"?"active":""}">
              <span class="nav-icon">🗺️</span>
              <span class="nav-label">الخريطة الميدانية</span>
            </a>` : ""}
            <a data-go="bulk-op" class="nav-item ${current==="bulk-op"?"active":""}">
              <span class="nav-icon">👥</span>
              <span class="nav-label">عملية جماعية</span>
            </a>
            <a data-go="fertilizers" class="nav-item ${current==="fertilizers"?"active":""}">
              <span class="nav-icon">📦</span>
              <span class="nav-label">عهدة الأسمدة</span>
              ${pendingVouchersCount() ? `<span class="nav-badge alert">${pendingVouchersCount()}</span>` : ''}
            </a>
            <a data-go="queue" class="nav-item ${current==="queue"?"active":""}">
              <span class="nav-icon">🔄</span>
              <span class="nav-label">قائمة الانتظار</span>
            </a>
            <a data-go="notifications" class="nav-item ${current==="notifications"?"active":""}">
              <span class="nav-icon">🔔</span>
              <span class="nav-label">الإشعارات</span>
              ${unreadNotificationsCount() ? `<span class="nav-badge alert">${unreadNotificationsCount()}</span>` : ''}
            </a>
          </div>
        </nav>
      ` : adminNav}
      </aside>
      <main class="content">${pageTrail()}${inner}</main>
    </div>
    <nav class="bottom ${isField?"field-nav":""}">${isCare ? `
      <div class="tab ${current==="dash"?"active":""}" data-go="dash">${t("nav_dash", "المؤشرات")}</div>
      <div class="tab ${current==="zakat-admin"?"active":""}" data-go="zakat-admin">⚖️ الزكاة</div>
      <div class="tab ${current==="reports"?"active":""}" data-go="reports">${t("nav_reports", "التقارير")}</div>
      <div class="tab" data-act="back">${t("btn_back", "رجوع")}</div>
    ` : isNur ? `
      <div class="tab ${current==="nursery"?"active":""}" data-go="nursery">${t("nav_nursery", "المشتل")}</div>
      <div class="tab" data-act="back">${t("btn_back", "رجوع")}</div>
    ` : isWh ? `
      <div class="tab ${current==="fertilizers"?"active":""}" data-go="fertilizers">${t("nav_fertilizers", "المخزون")} ${pendingVouchersCount() ? `<span class="badge">${pendingVouchersCount()}</span>` : ''}</div>
      <div class="tab ${current==="dash"?"active":""}" data-go="dash">${t("nav_dash", "المؤشرات")}</div>
      <div class="tab ${current==="reports"?"active":""}" data-go="reports">${t("nav_reports", "التقارير")}</div>
      <div class="tab" data-act="back">${t("btn_back", "رجوع")}</div>
    ` : isInv ? `
      <div class="tab ${current==="inv-home"?"active":""}" data-go="inv-home">${t("nav_home", "الرئيسية")}</div>
      <div class="tab ${current==="inv-palms"?"active":""}" data-go="inv-palms">${t("nav_my_palms", "نخيلي")}</div>
      <div class="tab ${current==="inv-zakat"?"active":""}" data-go="inv-zakat">${t("nav_zakat", "الزكاة")}</div>
      <div class="tab ${current==="inv-photos"?"active":""}" data-go="inv-photos">${t("nav_photos", "الصور")}</div>
    ` : isField ? `
      <div class="tab ${current==="home"?"active":""}" data-go="home">${t("nav_home", "الرئيسية")}</div>
      <div class="tab ${current==="scan"&&scanTab==="browse"?"active":""}" data-go="scan" data-id="browse">${t("nav_sectors", "القطاعات")}</div>
      <button class="fab-scan" data-go="scan" data-id="scan">${t("nav_scan", "مسح")}</button>
      <div class="tab ${current==="queue"?"active":""}" data-go="queue">${t("nav_sync", "مزامنة")} ${pendingCount()?`<span class="badge">${pendingCount()}</span>`:""}</div>
      <div class="tab ${current==="fertilizers"?"active":""}" data-go="fertilizers">${t("nav_custody", "العهدة")} ${pendingVouchersCount() ? `<span class="badge">${pendingVouchersCount()}</span>` : ''}</div>
    ` : `
      <div class="tab ${current==="dash"?"active":""}" data-go="dash">${t("nav_dash", "المؤشرات")}</div>
      <div class="tab ${["palms","palm"].includes(current)?"active":""}" data-go="palms">${t("nav_field", "الحقل")}</div>
      <div class="tab ${current==="fertilizers"?"active":""}" data-go="fertilizers">${t("nav_fertilizers", "المخزون")} ${pendingVouchersCount() ? `<span class="badge">${pendingVouchersCount()}</span>` : ''}</div>
      <div class="tab ${current==="ops-admin"?"active":""}" data-go="ops-admin">${t("nav_ops", "عمليات")}</div>
      ${s.role==="engineer"?`<div class="tab" data-act="back">${t("btn_back", "رجوع")}</div>`:`<div class="tab ${current==="settings"?"active":""}" data-go="settings">${t("nav_settings", "إعدادات")}</div>`}
    `}</nav>
    ${osPrepModalHtml()}
    ${renderSecurityModals()}
    ${renderPlotsImportModal()}
    ${renderInvestorsImportModal()}
    ${renderSeedlingsImportModal()}
    ${renderInvestorContractEditModal()}
    ${renderPlotEditModal()}
    ${renderContractTemplateModal()}
  `;
}
function roleLabel(r) {
  if (r === "super_admin" || r === "superadmin") return "مدير عام النظام";
  if (r === "tenant_user") return "إداري مزرعة";
  if (r === "care" || r === "customer_care") return "رعاية العملاء والزكاة";
  if (r === "nursery" || r === "nursery_mgr") return "مدير المشتل";
  if (r === "storage" || r === "warehouse_mgr") return "أمين المستودع والمخازن";
  return Store.get().roles.find(x => x.id === r)?.name || r;
}

function view(extra) {
  const map = {
    login: loginView, home: homeView, "worker-rework": workerReworkView, scan: () => scanView(extra || lastExtra), palm: () => palmView(extra || lastExtra),
    op: () => opView(extra || lastExtra), offshoot: () => offshootView(extra || lastExtra),
    queue: queueView, qitem: () => qitemView(extra), profile: profileView, notifications: notificationsView,
    dash: dashView, palms: palmsAdminView, "palm-new": palmNewView, generate: generateView,
    users: usersView, "user-new": userNewView, "user-edit": () => userEditView(extra), roles: rolesView, import: importView, "ops-admin": () => opsAdminView(extra || lastExtra), "early-warning": () => opsAdminView("early_warning"), "op-detail": () => opDetailView(extra), "bulk-op": bulkOpView,
    yields: yieldsView, "zakat-admin": zakatAdminView, "investors-hub": () => investorsHubView(extra || lastExtra),
    investors: () => investorsHubView(extra || lastExtra), reports: reportsView, settings: settingsView, nursery: nurseryView, fertilizers: fertilizersView, audit: auditView,
    sector: () => sectorView(extra), plot: () => plotView(extra), "os-card": () => osCardView(extra),
    "inv-home": invHomeView, "inv-palms": () => invPalmsView(extra), "inv-palm": () => invPalmView(extra),
    "inv-zakat": invZakatView, "inv-photos": invPhotosView, gis: gisView,
    farmers: farmersView, "farmer-new": farmerFormView, "farmer-edit": () => farmerFormView(extra), farmer: () => farmerView(extra),
    "saas-console": saasConsoleView,
    "ai-hub": () => typeof aiHubView === "function" ? aiHubView(extra || lastExtra) : "<div>جاري تحميل المركز الذكي...</div>"
  };
  const fn = map[current];
  return fn ? fn() : `<div class="card">شاشة غير موجودة</div>`;
}

let showForgotPasswordModal = false;
let activeResetToken = null;
let forceChangePasswordUser = null;
let sharedCredentialsData = null;
let idCardData = null;

// Real-time listener for connection health changes
if (typeof window !== "undefined") {
  window.addEventListener("palmtrace:health-change", (e) => {
    const isOnline = e.detail && e.detail.isOnline;
    document.querySelectorAll(".live-indicator").forEach(el => {
      el.classList.toggle("offline", !isOnline);
      el.innerHTML = `<span class="live-dot"></span>${isOnline ? 'متصل ولحظي (Live)' : 'غير متصل بالخادم — محلي (Offline)'}`;
    });
    document.querySelectorAll(".field-banner").forEach(el => {
      el.classList.toggle("online", !!isOnline);
      el.classList.toggle("offline", !isOnline);
      const span = el.querySelector("span");
      if (span) {
        const n = (typeof pendingCount === "function") ? pendingCount() : 0;
        span.textContent = isOnline ? (n ? `أونلاين — ${n} سجل بانتظار المزامنة` : "أونلاين — تمت المزامنة") : `أوفلاين — ${n} عمليات تنتظر المزامنة`;
      }
    });
  });

  try {
    const params = new URLSearchParams(window.location.search);
    const tok = params.get("resetToken") || params.get("token");
    if (tok) activeResetToken = tok;
  } catch (e) {}
}

function renderForgotPasswordModalHtml() {
  if (!showForgotPasswordModal) return "";
  return `
    <div class="custom-modal-backdrop" data-act="close-forgot-modal">
      <div class="custom-modal-box">
        <div class="custom-modal-head">
          <h3>🔑 استعادة كلمة المرور</h3>
          <button class="custom-modal-close" data-act="close-forgot-modal">✕</button>
        </div>
        <div class="custom-modal-body">
          <p class="muted" style="margin-bottom:14px;line-height:1.6">
            أدخل اسم المستخدم أو البريد الإلكتروني المسجل في النظام وسيقوم النظام بتوليد رابط استعادة صالح لمدة 15 دقيقة.
          </p>
          <label>اسم المستخدم أو البريد الإلكتروني</label>
          <input id="forgot_identifier" placeholder="مثال: engineer أو user@farm.com" autofocus />
          
          <div class="field-worker-hint">
            <span style="font-size:20px">👨‍🌾</span>
            <div>
              <b>ملاحظة للعمال الميدانيين:</b>
              <div>يمكنك طلب إعادة تعيين كلمة المرور فورياً من مشرف القطاع أو الإدارة واستلامها مباشرة عبر واتساب.</div>
            </div>
          </div>
        </div>
        <div class="custom-modal-foot">
          <button class="btn btn-ghost" data-act="close-forgot-modal" style="width:auto">إلغاء</button>
          <button class="btn btn-primary" data-act="submit-forgot-pass" style="width:auto">إرسال رابط الاستعادة 📤</button>
        </div>
      </div>
    </div>
  `;
}

function renderResetPasswordModalHtml() {
  if (!activeResetToken) return "";
  return `
    <div class="custom-modal-backdrop">
      <div class="custom-modal-box">
        <div class="custom-modal-head">
          <h3>🔒 تعيين كلمة مرور جديدة</h3>
          <button class="custom-modal-close" data-act="close-reset-modal">✕</button>
        </div>
        <div class="custom-modal-body">
          <p class="muted" style="margin-bottom:14px">تم التحقق من رابط الاستعادة. أدخل كلمة المرور الجديدة لحسابك:</p>
          <label>كلمة المرور الجديدة</label>
          <div class="pass-wrap">
            <input id="reset_new_pass" type="password" placeholder="6 خانات على الأقل" />
            <button type="button" class="pass-eye-btn" data-act="toggle-pass-vis" data-target="reset_new_pass">👁️</button>
          </div>
          <label>تأكيد كلمة المرور الجديدة</label>
          <div class="pass-wrap">
            <input id="reset_confirm_pass" type="password" placeholder="أعد كتابة كلمة المرور" />
            <button type="button" class="pass-eye-btn" data-act="toggle-pass-vis" data-target="reset_confirm_pass">👁️</button>
          </div>
        </div>
        <div class="custom-modal-foot">
          <button class="btn btn-ghost" data-act="close-reset-modal" style="width:auto">إلغاء</button>
          <button class="btn btn-primary" data-act="submit-reset-pass" style="width:auto">حفظ وتفعيل الحساب ✅</button>
        </div>
      </div>
    </div>
  `;
}

function renderForceChangePasswordModalHtml() {
  if (!forceChangePasswordUser) return "";
  const u = forceChangePasswordUser;
  return `
    <div class="custom-modal-backdrop" style="z-index:99999">
      <div class="custom-modal-box" style="max-width:440px">
        <div class="custom-modal-head" style="background:#FEF3C7;border-bottom:1px solid #FDE68A">
          <h3 style="color:#92400E">⚠️ تعيين كلمة المرور الشخصية (إجباري)</h3>
        </div>
        <div class="custom-modal-body">
          <div style="background:#FFFBEB;padding:12px;border-radius:10px;margin-bottom:14px;font-size:13px;color:#92400E;line-height:1.5">
            أهلاً بك يا <b>${escapeHtml(u.name || u.user)}</b>! حسابك يعمل بكلمة مرور مؤقتة، ويلزم تعيين كلمة مرور شخصية جديدة لتأمين حسابك ومتابعة الدخول للمنظومة.
          </div>
          <label>كلمة المرور الشخصية الجديدة</label>
          <div class="pass-wrap">
            <input id="force_new_pass" type="password" placeholder="6 خانات على الأقل" autofocus />
            <button type="button" class="pass-eye-btn" data-act="toggle-pass-vis" data-target="force_new_pass">👁️</button>
          </div>
          <label>تأكيد كلمة المرور الشخصية</label>
          <div class="pass-wrap">
            <input id="force_confirm_pass" type="password" placeholder="أعد كتابة كلمة المرور" />
            <button type="button" class="pass-eye-btn" data-act="toggle-pass-vis" data-target="force_confirm_pass">👁️</button>
          </div>
        </div>
        <div class="custom-modal-foot">
          <button class="btn btn-primary" data-act="submit-force-change-pass" style="width:100%">حفظ كلمة المرور ومتابعة الدخول للمنظومة ←</button>
        </div>
      </div>
    </div>
  `;
}

function renderShareCredentialsModalHtml() {
  if (!sharedCredentialsData) return "";
  const data = sharedCredentialsData;
  const isReset = !!data.isReset;
  const appUrl = (typeof window !== "undefined") ? window.location.origin : "http://localhost:3000";
  const cleanPhone = (data.phone || "").replace(/[^\d+]/g, "");
  const waPhone = cleanPhone.startsWith("0") ? ("2" + cleanPhone) : cleanPhone;
  const waMsg = isReset
    ? `تم إعادة تعيين كلمة المرور لحسابك يا ${data.name || data.user} في منظومة PalmTrace 🌴\n\nرابط التطبيق: ${appUrl}\nاسم المستخدم: ${data.user || data.username}\nكلمة المرور المؤقتة الجديدة: ${data.tempPassword}\n\n(يُرجى تسجيل الدخول وتغيير كلمة المرور فوراً)`
    : `أهلاً بك يا ${data.name || data.user} في منظومة PalmTrace لإدارة النخيل 🌴\n\nرابط التطبيق: ${appUrl}\nاسم المستخدم: ${data.user || data.username}\nكلمة المرور: ${data.tempPassword}\n\n(يُرجى تسجيل الدخول وتغيير كلمة المرور عند أول استخدام)`;
  const waLink = `https://wa.me/${waPhone}?text=${encodeURIComponent(waMsg)}`;

  return `
    <div class="custom-modal-backdrop" data-act="close-creds-modal">
      <div class="custom-modal-box" style="max-width:480px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden">
        <div class="custom-modal-head">
          <h3>${isReset ? '🔄 تأكيد إعادة تعيين كلمة المرور' : '🔑 بيانات الدخول ومشاركتها'}</h3>
          <button class="custom-modal-close" data-act="close-creds-modal">✕</button>
        </div>
        <div class="custom-modal-body" style="overflow-y:auto;flex:1;max-height:calc(90vh - 120px)">
          ${isReset ? `
            <div style="background:#FEF2F2;border:1.5px solid #FCA5A5;border-radius:10px;padding:10px 14px;color:#991B1B;font-size:12.5px;font-weight:700;display:flex;align-items:center;gap:8px;margin-bottom:14px">
              <span style="font-size:18px">⚠️</span>
              <div>تم إلغاء كلمة المرور السابقة بنجاح وتوليد كلمة مرور مؤقتة جديدة أدناه. يرجى تزويد المستخدم بها لتسجيل الدخول.</div>
            </div>
          ` : `
            <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:10px 14px;color:#166534;font-size:12.5px;font-weight:600;display:flex;align-items:center;gap:8px;margin-bottom:14px">
              <span style="font-size:18px">🔑</span>
              <div>بيانات الدخول الحالية المعتمدة. يمكنك مشاركتها مع المستخدم عبر واتساب أو نسخها.</div>
            </div>
          `}

          <div class="creds-summary-card">
            <div class="creds-row">
              <span class="muted">الاسم الكامل:</span>
              <b>${escapeHtml(data.name || data.full_name || "")}</b>
            </div>
            <div class="creds-row">
              <span class="muted">الدور الوظيفي:</span>
              <span class="status badge-ok">${roleLabel(data.role)}</span>
            </div>
            <div class="creds-row">
              <span class="muted">اسم المستخدم:</span>
              <code class="code-chip">${escapeHtml(data.user || data.username || "")}</code>
            </div>
            <div class="creds-row">
              <span class="muted">${isReset ? 'كلمة المرور الجديدة:' : 'كلمة المرور الحالية:'}</span>
              <div style="display:flex;align-items:center;gap:6px">
                <code class="code-chip" style="background:${isReset ? '#FEE2E2' : '#FEF3C7'};color:${isReset ? '#991B1B' : '#92400E'};font-size:15px;font-weight:800">${escapeHtml(data.tempPassword || "")}</code>
                <button type="button" class="btn btn-ghost icon-btn" data-act="copy-creds-pass" data-val="${escapeHtml(data.tempPassword || "")}" style="padding:2px 8px;font-size:11px" title="نسخ كلمة المرور">📋 نسخ</button>
              </div>
            </div>
            ${data.email ? `
            <div class="creds-row">
              <span class="muted">البريد الإلكتروني:</span>
              <span>${escapeHtml(data.email)}</span>
            </div>` : ''}
            ${data.phone ? `
            <div class="creds-row">
              <span class="muted">رقم الجوال:</span>
              <span>${escapeHtml(data.phone)}</span>
            </div>` : ''}
          </div>

          <div style="font-size:12px;color:var(--muted);margin-bottom:10px;line-height:1.5">
            💡 <b>ملاحظة أمنية:</b> الحساب مضبوط تلقائياً على إلزام المستخدم بوضع كلمة مرور شخصية عند أول تسجيل دخول.
          </div>

          ${!isReset ? `
          <div style="display:flex;justify-content:flex-end;margin-bottom:14px">
            <button type="button" class="btn btn-ghost icon-btn" data-act="reset-pass" data-id="${data.id}" style="font-size:12.5px;color:var(--green);border:1px dashed var(--green);padding:6px 12px;border-radius:8px" title="توليد كلمة مرور جديدة لهذا المستخدم">
              🔄 توليد وإصدار كلمة مرور مؤقتة جديدة فوراً
            </button>
          </div>
          ` : ''}

          <div class="creds-actions-grid">
            <a href="${waLink}" target="_blank" rel="noopener" class="btn btn-whatsapp">
              <span>💬 مشاركة عبر واتساب</span>
            </a>
            <button class="btn btn-ghost icon-btn" data-act="copy-full-creds" data-msg="${escapeHtml(waMsg)}">
              📋 نسخ بيانات الدخول بالكامل
            </button>
            <button class="btn btn-ghost icon-btn" data-act="print-creds-slip">
              🖨️ طباعة إشعار الحساب السري
            </button>
            <button class="btn btn-ghost icon-btn" data-act="open-id-card">
              🪪 بطاقة العمل الميدانية
            </button>
          </div>
        </div>
        <div class="custom-modal-foot">
          <button class="btn btn-primary" data-act="close-creds-modal" style="width:100%">تم وتأكيد الإغلاق</button>
        </div>
      </div>
    </div>
  `;
}

function renderIdCardModalHtml() {
  if (!idCardData) return "";
  const d = idCardData;
  const empCode = d.id || ("EMP-" + (d.user || "001"));
  const verifyPayload = JSON.stringify({
    type: "palmtrace_emp_badge",
    empId: d.id || "",
    empCode: empCode,
    name: d.name || d.full_name || d.user || "",
    role: d.role || "worker",
    verified: true
  });
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(verifyPayload)}&size=160x160`;

  return `
    <div class="custom-modal-backdrop" data-act="close-id-card">
      <div class="custom-modal-box id-card-modal-box">
        <div class="custom-modal-head no-print">
          <h3>🪪 بطاقة العمل الميدانية (Pocket ID Card)</h3>
          <button class="custom-modal-close" data-act="close-id-card">✕</button>
        </div>
        <div class="custom-modal-body" style="display:flex;justify-content:center;padding:20px 0">
          
          <div class="pocket-id-card" id="printable-id-card">
            <div class="id-card-topbar">
              ${company().logo ? `
                <div class="id-card-logo" style="background:#fff;padding:2px;overflow:hidden;border:1.5px solid rgba(255,255,255,0.6)">
                  <img src="${company().logo}" style="width:100%;height:100%;object-fit:contain;border-radius:6px" alt="Company Logo" />
                </div>
              ` : `
                <div class="id-card-logo">🌴</div>
              `}
              <div>
                <div class="id-card-org">${escapeHtml(company().name || company().companyName || "منظومة إدارة النخيل")}</div>
                <div class="id-card-sub">PalmTrace Enterprise Field Card</div>
              </div>
            </div>

            <div class="id-card-content">
              ${d.avatar ? `
                <div class="id-card-avatar" style="overflow:hidden;padding:0;background:#fff;border:2.5px solid #16A34A">
                  <img src="${d.avatar}" style="width:100%;height:100%;object-fit:cover" alt="${escapeHtml(d.name || d.full_name || d.user)}" />
                </div>
              ` : `
                <div class="id-card-avatar">👤</div>
              `}
              <div class="id-card-name">${escapeHtml(d.name || d.full_name || d.user)}</div>
              <div class="id-card-role-chip">${roleLabel(d.role)}</div>

              <div class="id-card-qr-box">
                <img src="${qrUrl}" alt="QR Verify" class="id-card-qr" onerror="this.src='./icons/icon-192.png'" />
                <div class="id-card-qr-hint">رمز التحقق الميداني وصرف العهد</div>
              </div>

              <div class="id-card-meta" style="text-align:right;font-size:12px;display:flex;flex-direction:column;gap:4px;padding:0 8px">
                <div style="display:flex;justify-content:space-between"><b>كود الموظف:</b> <span class="chip" style="font-size:11px;padding:1px 6px">${escapeHtml(empCode)}</span></div>
                ${d.phone ? `<div style="display:flex;justify-content:space-between"><b>الجوال:</b> <span>${escapeHtml(d.phone)}</span></div>` : ''}
                <div style="display:flex;justify-content:space-between"><b>فصيلة الدم:</b> <span style="font-weight:800;color:#DC2626">${escapeHtml(d.bloodType || "غير محددة")}</span></div>
                <div style="display:flex;justify-content:space-between"><b>طوارئ المزرعة:</b> <span>${escapeHtml(company().phone || "+20 10 0000 0000")}</span></div>
              </div>
            </div>

            <div class="id-card-footer" style="font-size:11px;padding:8px;background:#F8FAFC;border-top:1px solid #E2E8F0;color:#64748B">
              بطاقة هوية معتمدة للتحقق الميداني واستلام العهد • PalmTrace
            </div>
          </div>

        </div>
        <div class="custom-modal-foot no-print">
          <button class="btn btn-ghost" data-act="close-id-card" style="width:auto">إغلاق</button>
          <button class="btn btn-primary" data-act="print-id-card" style="width:auto">🖨️ طباعة البطاقة الآن</button>
        </div>
      </div>
    </div>
  `;
}

let activePreviewPhoto = null;

window.viewImagePreview = function(src, title) {
  if (!src) return;
  activePreviewPhoto = { src, title: title || 'معاينة الصورة الميدانية' };
  render();
};

window.openImageInNewTab = function(src, title) {
  if (!src) return;
  const safeTitle = (title || 'معاينة الصورة الميدانية').replace(/["'<>]/g, '');
  const w = window.open('');
  if (w) {
    w.document.write(`
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="utf-8">
        <title>${safeTitle}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { margin:0; padding:16px; background:#0F172A; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; font-family:system-ui,-apple-system,sans-serif; color:#fff; box-sizing:border-box; }
          .header { margin-bottom:12px; font-size:14px; font-weight:700; color:#94A3B8; }
          img { max-width:96vw; max-height:90vh; object-fit:contain; border-radius:10px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.5); border:1px solid #334155; }
        </style>
      </head>
      <body>
        <div class="header">${safeTitle}</div>
        <img src="${src}" alt="${safeTitle}" />
      </body>
      </html>
    `);
    w.document.close();
    return;
  }
  window.open(src, '_blank');
};

window.closePhotoPreviewModal = function(e) {
  if (e) {
    if (typeof e.preventDefault === "function") e.preventDefault();
    if (typeof e.stopPropagation === "function") e.stopPropagation();
  }
  activePreviewPhoto = null;
  render();
};

function renderPhotoPreviewModalHtml() {
  if (!activePreviewPhoto) return "";
  const { src, title } = activePreviewPhoto;
  return `
    <div class="custom-modal-backdrop" onclick="window.closePhotoPreviewModal(event)" data-act="close-photo-preview" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(15,23,42,0.88);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(6px)">
      <div class="custom-modal-box" style="max-width:94vw;max-height:94vh;width:auto;background:#1E293B;border:1px solid #334155;border-radius:16px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.6);display:flex;flex-direction:column;overflow:hidden;padding:0" onclick="event.stopPropagation()">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 18px;border-bottom:1px solid #334155;background:#0F172A;color:#fff">
          <div style="font-weight:700;font-size:14px;display:flex;align-items:center;gap:8px">
            <span>📷</span>
            <span>${escapeHtml(title || 'معاينة الصورة الميدانية')}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <button type="button" class="btn btn-ghost icon-btn" onclick="window.openImageInNewTab('${src}', '${escapeHtml(title || '')}')" style="color:#38BDF8;font-size:12px;padding:5px 12px;border:1px solid #0369A1;border-radius:8px;background:rgba(2,132,199,0.15);cursor:pointer" title="فتح الصورة في نافذة أو تبويب مستقل">
              ↗️ فتح في تبويب جديد
            </button>
            <a href="${src}" download="palmtrace-photo.jpg" class="btn btn-ghost icon-btn" style="color:#4ADE80;font-size:12px;padding:5px 12px;border:1px solid #15803D;border-radius:8px;text-decoration:none;background:rgba(22,163,74,0.15);cursor:pointer" title="تنزيل الصورة">
              💾 تنزيل
            </a>
            <button type="button" class="custom-modal-close" onclick="window.closePhotoPreviewModal(event)" data-act="close-photo-preview" style="color:#94A3B8;font-size:22px;background:none;border:none;cursor:pointer;padding:0 6px;line-height:1" title="إغلاق المعاينة">✕</button>
          </div>
        </div>
        <div style="padding:16px;display:flex;align-items:center;justify-content:center;background:#090D16;min-width:320px;max-height:calc(92vh - 65px);overflow:auto">
          <img src="${src}" style="max-width:88vw;max-height:80vh;object-fit:contain;border-radius:8px;box-shadow:0 10px 15px -3px rgba(0,0,0,0.4)" alt="صورة العملية" />
        </div>
      </div>
    </div>
  `;
}

function renderSecurityModals() {
  return [
    renderForgotPasswordModalHtml(),
    renderResetPasswordModalHtml(),
    renderForceChangePasswordModalHtml(),
    renderShareCredentialsModalHtml(),
    renderIdCardModalHtml(),
    renderPhotoPreviewModalHtml()
  ].join("");
}

function loginView() {
  const isAr = I18n.getLang() === "ar";
  const canShowLang = !!(Store.get()?.settings?.showLangToggle);
  const isDev = (typeof window !== "undefined") && (location.search.includes("dev=true") || location.hash.includes("dev"));
  const savedUser = (typeof localStorage !== "undefined") ? (localStorage.getItem("palmtrace_remembered_user") || "admin") : "admin";
  const hasSaved = !!(typeof localStorage !== "undefined" && localStorage.getItem("palmtrace_remembered_user"));

  return `<div class="login">
    <div class="login-card glass-panel">
      ${canShowLang ? `
      <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
        <button class="btn btn-ghost" data-act="toggle-lang" style="font-size:12px;padding:4px 8px;border:1px solid var(--line);border-radius:6px;cursor:pointer">🌐 ${isAr ? 'English' : 'العربية'}</button>
      </div>` : ''}

      <div class="brand">
        ${company().logo ? `<img class="co-logo big" src="${company().logo}" alt="لوقو المزرعة">` : `<div class="logo">🌴</div>`}
        <h1>${company().companyName || t("app_name", "نظام إدارة النخيل")}</h1>
        <p>${t("app_sub", "منظومة الرعاية الزراعية وتتبع الحقل والإنتاج")}</p>
      </div>

      <div class="login-form">
        <label for="user">${t("lbl_username", "اسم المستخدم أو المعرّف")}</label>
        <div class="input-icon-wrap">
          <input id="user" value="${escapeHtml(savedUser)}" placeholder="أدخل اسم المستخدم" autocomplete="username" />
        </div>

        <label for="pass">${t("lbl_password", "كلمة المرور")}</label>
        <div class="pass-wrap">
          <input id="pass" type="password" value="" placeholder="••••••••" autocomplete="current-password" />
          <button type="button" class="pass-eye-btn" data-act="toggle-pass-vis" data-target="pass" title="إظهار/إخفاء كلمة المرور">👁️</button>
        </div>

        <div class="login-options-row">
          <label class="remember-me-lbl">
            <input type="checkbox" id="remember_me" ${hasSaved ? "checked" : ""} />
            <span>تذكر بياناتي على هذا الجهاز</span>
          </label>
          <a href="#" class="forgot-link" data-act="open-forgot-modal">نسيت كلمة المرور؟</a>
        </div>

        <button class="btn btn-primary login-btn-main" data-act="login">
          <span>تسجيل الدخول للمنظومة</span>
        </button>

        ${isDev ? `
          <div class="dev-login-panel">
            <div class="dev-panel-title">🛠️ بيئة التطوير والاختبار السريع (Dev Mode)</div>
            <div class="demo-acc">
              <span class="chip" data-fill="admin">admin</span>
              <span class="chip" data-fill="engineer">engineer</span>
              <span class="chip" data-fill="care">care</span>
              <span class="chip" data-fill="storage">storage</span>
              <span class="chip" data-fill="worker">worker</span>
              <span class="chip" data-fill="investor">investor</span>
              <span class="chip" data-fill="nursery">nursery</span>
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  </div>`;
}

