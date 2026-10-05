// ============================================================================
// PalmTrace i18n & Translation Studio Engine (محرك دعم اللغات وقاموس المنظومة)
// Extensible dictionary architecture, instant switching, live editing & Excel sync
// ============================================================================

const I18n = (() => {
  const STORAGE_LANG_KEY = "palmtrace_lang";
  const STORAGE_OVERRIDES_KEY = "palmtrace_i18n_overrides";
  const DEFAULT_LANG = "ar";

  // 1. Reference Arabic Dictionary (الأصل العربي المعتمد)
  const DICT_AR = {
    // Navigation & Shell
    "nav_main_dash": "الرئيسية والمؤشرات",
    "nav_dash": "المؤشرات العامة",
    "nav_notifications": "الإشعارات",
    "nav_gis": "الخريطة التفاعلية",
    "nav_field_ops": "العمليات والميدان",
    "nav_palms": "الأشجار والحقل",
    "nav_scan": "الأشجار والحقل",
    "nav_ops": "العمليات الزراعية",
    "nav_schedules": "جداول الرعاية والتذكيرات",
    "nav_bulk_op": "عملية جماعية",
    "nav_fertilizers": "الأسمدة والمخزون",
    "nav_nursery": "المشتل والتكاثر",
    "nav_prod_compliance": "الإنتاج والالتزام",
    "nav_yields": "المحصول والإنتاج",
    "nav_zakat": "حساب الزكاة",
    "nav_reports": "التقارير الشاملة",
    "nav_admin": "إدارة النظام",
    "nav_farmers": "المزارعون",
    "nav_users": "المستخدمون والصلاحيات",
    "nav_audit": "سجل التدقيق والرقابة",
    "nav_settings": "الإعدادات العامة",
    "nav_profile": "الملف الشخصي",
    "nav_menu": "القائمة",
    "nav_back": "رجوع",
    "nav_outdoor_on": "وضع الميدان",
    "nav_outdoor_off": "تباين قياسي",
    "nav_login": "تسجيل الدخول",
    "nav_logout": "تسجيل الخروج",
    "nav_field": "الحقل",
    "nav_sectors": "القطاعات",
    "nav_sync": "مزامنة",
    "nav_custody": "العهدة",
    "nav_portfolio": "محفظتي",
    "nav_queue": "قائمة الانتظار",
    "nav_photos": "سجل الصور",
    "nav_my_palms": "نخيلي وأصولي",
    "btn_generate_codes": "إنشاء أكواد",
    "btn_add_palm": "إضافة أصل جديد",
    "btn_new_op": "عملية جديدة",
    "btn_cut_offshoot": "قلع فسيلة",

    // Common Actions & Buttons
    "btn_save": "حفظ",
    "btn_cancel": "إلغاء",
    "btn_edit": "تعديل",
    "btn_delete": "حذف",
    "btn_archive": "أرشفة",
    "btn_unarchive": "استعادة",
    "btn_close": "إغلاق",
    "btn_search": "بحث",
    "btn_filter": "تصفية",
    "btn_reset": "إعادة ضبط",
    "btn_refresh": "تحديث",
    "btn_print": "طباعة",
    "btn_print_barcode": "طباعة باركود",
    "btn_export_csv": "تصدير CSV",
    "btn_export_excel": "تصدير Excel",
    "btn_import": "استيراد",
    "btn_details": "تفاصيل",
    "btn_apply": "تطبيق",
    "btn_confirm": "تأكيد",
    "btn_add": "إضافة جديد",
    "btn_sync": "مزامنة",
    "btn_show_all": "عرض الكل",
    "btn_select_all": "تحديد الكل",
    "btn_deselect_all": "إلغاء التحديد",

    // Common Labels
    "lbl_status": "الحالة",
    "lbl_date": "التاريخ",
    "lbl_time": "الوقت",
    "lbl_user": "المستخدم",
    "lbl_role": "الدور الوظيفي",
    "lbl_sector": "القطاع",
    "lbl_plot": "القطعة",
    "lbl_crop": "المحصول",
    "lbl_variety": "الصنف",
    "lbl_quantity": "الكمية",
    "lbl_unit": "الوحدة",
    "lbl_notes": "الملاحظات",
    "lbl_code": "الكود",
    "lbl_actions": "الإجراءات",
    "lbl_total": "الإجمالي",
    "lbl_count": "العدد",
    "lbl_page_size": "عرض في الصفحة",
    "lbl_all": "الكل",

    // Crops & Tree Statuses
    "crop_palm": "نخيل التمر",
    "crop_olive": "شجر الزيتون",
    "crop_palm_single": "نخيل",
    "crop_olive_single": "زيتون",
    "status_healthy": "سليمة",
    "status_infested": "مصابة",
    "status_treated": "معالجة",
    "status_dead": "ميتة",
    "status_archived": "مؤرشفة",

    // Roles
    "role_admin": "إدارة المنظومة",
    "role_engineer": "مهندس زراعي",
    "role_supervisor": "مشرف ميداني",
    "role_worker": "عامل ميداني",
    "role_warehouse_mgr": "أمين مستودع",
    "role_nursery_mgr": "مشرف المشتل",
    "role_investor": "مستثمر",

    // Field Operations
    "ops_title": "العمليات الزراعية الميدانية",
    "ops_bulk_title": "تنفيذ عملية جماعية",
    "ops_single_title": "تسجيل عملية ميدانية",
    "ops_approval_pending": "بانتظار الاعتماد",
    "ops_approval_approved": "معتمدة",
    "ops_approval_rejected": "مرفوضة",
    "ops_mat_used": "السماد / المركب",
    "ops_dose_per_tree": "الجرعة لكل أصل",
    "ops_bulk_consolidated": "جماعي ({n} أصل)",

    // Warehouse & Fertilizer
    "fert_title": "إدارة الأسمدة والمخزون",
    "fert_stock": "رصيد المستودع",
    "fert_allocated": "محجوز / عهدة",
    "fert_consumed": "مستهلك",
    "fert_vouchers": "أذونات الصرف والتوريد",
    "fert_issue_voucher": "إذن صرف للميدان",
    "fert_supply_voucher": "إذن توريد للمستودع",
    "fert_confirm_receipt": "تأكيد الاستلام بالموقع",

    // Nursery & Offshoots
    "nursery_title": "إدارة المشتل وتكاثر الفسائل",
    "nursery_mother_palm": "النخلة الأم",
    "nursery_offshoot_code": "كود الفسيلة",
    "nursery_status_prep": "قيد التجهيز",
    "nursery_status_ready": "جاهزة للصرف والزراعة",
    "nursery_status_dispatched": "تم الصرف للموقع",
    "nursery_status_issued": "مستلمة بالموقع",
    "nursery_status_planted": "زُرعت بالحقل",
    "nursery_dispense": "صرف فسائل للميدان",

    // Yields & Harvest
    "yields_title": "سجلات الحصاد وتقدير الإنتاج",
    "yields_batch": "رقم الشحنة / الدفعة",
    "yields_weight": "الوزن المستلم",
    "yields_excellent": "فرز ممتاز",
    "yields_good": "فرز جيد",
    "yields_bad": "فرز هالك / صناعي",
    "yields_season": "الموسم الزراعي",

    // Audit Log
    "audit_title": "سجل التدقيق والرقابة",
    "audit_total_events": "إجمالي الحركات المسجلة",
    "audit_today_events": "حركات اليوم",
    "audit_sensitive_events": "حركات حساسة",
    "audit_top_user": "المستخدم الأكثر نشاطاً",
    "audit_clean_archive": "أرشفة وتنظيف",
    "audit_export_log": "تصدير السجل (CSV)",
    "audit_details_title": "تفاصيل الحركة الرقابية",
    "audit_payload_json": "البيانات الفنية التفصيلية",

    // Settings & Translation Editor
    "settings_title": "الإعدادات العامة وإدارة المنظومة",
    "settings_tab_org": "بيانات المنظومة والشركة",
    "settings_tab_crops": "إدارة المحاصيل والأصناف",
    "settings_tab_fert": "تهيئة الأسمدة والكيماويات",
    "settings_tab_ops": "تصنيفات العمليات",
    "settings_tab_backup": "النسخ الاحتياطي والاستعادة",
    "settings_tab_i18n": "إدارة اللغات والترجمة",
    "i18n_studio_title": "محرر القواميس والترجمات التفاعلي",
    "i18n_studio_desc": "تخصيص وترجمة كافة مصطلحات وشاشات المنظومة بسهولة تامة وبدون تعديل الكود المصدري",
    "i18n_active_lang": "اللغة الحالية للتعديل",
    "i18n_search_placeholder": "ابحث في المصطلحات أو الأكواد...",
    "i18n_col_key": "كود المصطلح",
    "i18n_col_original": "الأصل العربي",
    "i18n_col_translation": "الترجمة في اللغة المختارة",
    "i18n_col_status": "حالة الترجمة",
    "i18n_status_translated": "مترجم معتمد",
    "i18n_status_custom": "تعديل مخصص",
    "i18n_status_missing": "بحاجة لترجمة",
    "i18n_save_success": "تم حفظ التعديلات بنجاح وتحديث واجهة النظام",
    "i18n_export_btn": "تصدير القاموس إلى Excel (CSV)",
    "i18n_import_btn": "استيراد ملف ترجمة (CSV)",
    "i18n_reset_btn": "استعادة القاموس الافتراضي",
    "i18n_progress": "نسبة اكتمال الترجمة: {pct}% ({done} من {total} مصطلح)",
    "i18n_toggle_card_title": "ظهور مفتاح تحويل اللغات للمستخدمين في الواجهة (Language Switcher)",
    "i18n_toggle_card_desc": "التحكم في إظهار أو إخفاء زر التبديل بين اللغات (العربية / English) في الشريط العلوي وشاشة تسجيل الدخول لكافة المستخدمين",
    "i18n_toggle_status_enabled": "مفعّل — مفتاح تبديل اللغات ظاهر للمستخدمين",
    "i18n_toggle_status_disabled": "معطّل — مفتاح تبديل اللغات مخفي (واجهة عربية معتمدة فقط)",
    "i18n_toggle_btn_enable": "تفعيل وإظهار مفتاح تبديل اللغات",
    "i18n_toggle_btn_disable": "تعطيل وإخفاء مفتاح تبديل اللغات (إلزام الواجهة العربية)",
    "i18n_toggle_hint": "ملاحظة: نظراً لعدم اكتمال الترجمة في بعض الشاشات، يمكنك إخفاء المفتاح لمنع ظهور شاشات متباينة، وسيتم تحويل النظام فورياً إلى العربية المعتمدة.",
    "i18n_toggle_enabled_toast": "تم تفعيل وإظهار مفتاح تبديل اللغات للمستخدمين بنجاح",
    "i18n_toggle_disabled_toast": "تم تعطيل وإخفاء مفتاح تبديل اللغات وإعادة الواجهة إلى اللغة العربية"
  };

  // 2. Comprehensive English Dictionary (القاموس الإنجليزي الشامل)
  const DICT_EN = {
    // Navigation & Shell
    "nav_main_dash": "Main & Metrics",
    "nav_dash": "General Dashboard",
    "nav_notifications": "Notifications",
    "nav_gis": "Interactive GIS Map",
    "nav_field_ops": "Field & Operations",
    "nav_palms": "Trees & Field",
    "nav_scan": "Trees & Field",
    "nav_ops": "Agricultural Operations",
    "nav_schedules": "Care Schedules & Reminders",
    "nav_bulk_op": "Bulk Operation",
    "nav_fertilizers": "Fertilizers & Stock",
    "nav_nursery": "Nursery & Propagation",
    "nav_prod_compliance": "Yield & Compliance",
    "nav_yields": "Crop & Harvest",
    "nav_zakat": "Zakat Calculator",
    "nav_reports": "Comprehensive Reports",
    "nav_admin": "System Administration",
    "nav_farmers": "Farmers & Partners",
    "nav_users": "Users & Permissions",
    "nav_audit": "Audit & Compliance Log",
    "nav_settings": "General Settings",
    "nav_profile": "My Profile",
    "nav_menu": "Menu",
    "nav_back": "Back",
    "nav_outdoor_on": "Field Mode",
    "nav_outdoor_off": "Standard View",
    "nav_login": "Sign In",
    "nav_logout": "Sign Out",
    "nav_field": "Field",
    "nav_sectors": "Sectors",
    "nav_sync": "Sync",
    "nav_custody": "Custody",
    "nav_portfolio": "My Portfolio",
    "nav_queue": "Sync Queue",
    "nav_photos": "Photo Log",
    "nav_my_palms": "My Trees & Assets",
    "btn_generate_codes": "Generate Codes",
    "btn_add_palm": "Add New Tree",
    "btn_new_op": "New Operation",
    "btn_cut_offshoot": "Harvest Offshoot",

    // Common Actions & Buttons
    "btn_save": "Save",
    "btn_cancel": "Cancel",
    "btn_edit": "Edit",
    "btn_delete": "Delete",
    "btn_archive": "Archive",
    "btn_unarchive": "Restore",
    "btn_close": "Close",
    "btn_search": "Search",
    "btn_filter": "Filter",
    "btn_reset": "Reset",
    "btn_refresh": "Refresh",
    "btn_print": "Print",
    "btn_print_barcode": "Print Barcode",
    "btn_export_csv": "Export CSV",
    "btn_export_excel": "Export Excel",
    "btn_import": "Import",
    "btn_details": "Details",
    "btn_apply": "Apply",
    "btn_confirm": "Confirm",
    "btn_add": "Add New",
    "btn_sync": "Sync",
    "btn_show_all": "Show All",
    "btn_select_all": "Select All",
    "btn_deselect_all": "Deselect All",

    // Common Labels
    "lbl_status": "Status",
    "lbl_date": "Date",
    "lbl_time": "Time",
    "lbl_user": "User",
    "lbl_role": "Role",
    "lbl_sector": "Sector",
    "lbl_plot": "Plot",
    "lbl_crop": "Crop",
    "lbl_variety": "Variety",
    "lbl_quantity": "Quantity",
    "lbl_unit": "Unit",
    "lbl_notes": "Notes",
    "lbl_code": "Code",
    "lbl_actions": "Actions",
    "lbl_total": "Total",
    "lbl_count": "Count",
    "lbl_page_size": "Page Size",
    "lbl_all": "All",

    // Crops & Tree Statuses
    "crop_palm": "Date Palm",
    "crop_olive": "Olive Tree",
    "crop_palm_single": "Palm",
    "crop_olive_single": "Olive",
    "status_healthy": "Healthy",
    "status_infested": "Infested",
    "status_treated": "Treated",
    "status_dead": "Dead",
    "status_archived": "Archived",

    // Roles
    "role_admin": "System Administrator",
    "role_engineer": "Agricultural Engineer",
    "role_supervisor": "Field Supervisor",
    "role_worker": "Field Worker",
    "role_warehouse_mgr": "Warehouse Manager",
    "role_nursery_mgr": "Nursery Manager",
    "role_investor": "Investor",

    // Field Operations
    "ops_title": "Field Agricultural Operations",
    "ops_bulk_title": "Execute Bulk Operation",
    "ops_single_title": "Record Field Operation",
    "ops_approval_pending": "Pending Approval",
    "ops_approval_approved": "Approved",
    "ops_approval_rejected": "Rejected",
    "ops_mat_used": "Material / Fertilizer",
    "ops_dose_per_tree": "Dose per Tree",
    "ops_bulk_consolidated": "Bulk ({n} trees)",

    // Warehouse & Fertilizer
    "fert_title": "Fertilizers & Warehouse Management",
    "fert_stock": "Warehouse Stock",
    "fert_allocated": "Allocated",
    "fert_consumed": "Consumed",
    "fert_vouchers": "Dispatches & Supply Vouchers",
    "fert_issue_voucher": "Field Issue Voucher",
    "fert_supply_voucher": "Warehouse Supply Voucher",
    "fert_confirm_receipt": "Confirm Field Receipt",

    // Nursery & Offshoots
    "nursery_title": "Nursery & Offshoot Propagation",
    "nursery_mother_palm": "Mother Palm",
    "nursery_offshoot_code": "Offshoot Code",
    "nursery_status_prep": "Under Preparation",
    "nursery_status_ready": "Ready for Dispatch & Planting",
    "nursery_status_dispatched": "Dispatched to Field",
    "nursery_status_issued": "Received at Site",
    "nursery_status_planted": "Planted in Field",
    "nursery_dispense": "Dispatch Offshoots to Field",

    // Yields & Harvest
    "yields_title": "Harvest Records & Yield Estimation",
    "yields_batch": "Batch / Shipment No.",
    "yields_weight": "Received Weight",
    "yields_excellent": "Grade A (Premium)",
    "yields_good": "Grade B (Standard)",
    "yields_bad": "Industrial / Waste",
    "yields_season": "Harvest Season",

    // Audit Log
    "audit_title": "Audit & Compliance Log",
    "audit_total_events": "Total Logged Events",
    "audit_today_events": "Today's Events",
    "audit_sensitive_events": "Sensitive Actions",
    "audit_top_user": "Most Active User",
    "audit_clean_archive": "Archive & Clean",
    "audit_export_log": "Export Log (CSV)",
    "audit_details_title": "Audit Event Details",
    "audit_payload_json": "Technical Payload Data",

    // Settings & Translation Editor
    "settings_title": "System Settings & Administration",
    "settings_tab_org": "Organization Profile",
    "settings_tab_crops": "Crops & Varieties",
    "settings_tab_fert": "Fertilizers & Chemicals",
    "settings_tab_ops": "Operation Types",
    "settings_tab_backup": "Backup & Restore",
    "settings_tab_i18n": "Languages & Translation",
    "i18n_studio_title": "Interactive Translation Studio",
    "i18n_studio_desc": "Easily customize and translate all terms and screens without editing source code",
    "i18n_active_lang": "Active Language to Edit",
    "i18n_search_placeholder": "Search keys or terms...",
    "i18n_col_key": "Key Code",
    "i18n_col_original": "Arabic Reference",
    "i18n_col_translation": "Translation in Selected Language",
    "i18n_col_status": "Status",
    "i18n_status_translated": "Translated",
    "i18n_status_custom": "Custom Edit",
    "i18n_status_missing": "Needs Translation",
    "i18n_save_success": "Translations saved successfully and interface refreshed",
    "i18n_export_btn": "Export Dictionary to Excel (CSV)",
    "i18n_import_btn": "Import Translation File (CSV)",
    "i18n_reset_btn": "Restore Factory Defaults",
    "i18n_progress": "Translation Progress: {pct}% ({done} of {total} keys)",
    "i18n_toggle_card_title": "User Language Switcher Button Visibility",
    "i18n_toggle_card_desc": "Control whether the language switch button (Arabic / English) is shown in the topbar and login screen for users",
    "i18n_toggle_status_enabled": "Enabled — Switcher visible to all users",
    "i18n_toggle_status_disabled": "Disabled — Switcher hidden (Arabic interface only)",
    "i18n_toggle_btn_enable": "Enable & Show Language Switcher",
    "i18n_toggle_btn_disable": "Disable & Hide Language Switcher (Enforce Arabic)",
    "i18n_toggle_hint": "Note: Incomplete translations may cause mixed-language screens. Disabling the toggle hides the button and reverts the interface to full Arabic.",
    "i18n_toggle_enabled_toast": "Language switcher button enabled and visible to users",
    "i18n_toggle_disabled_toast": "Language switcher disabled; interface reverted to Arabic"
  };

  // 3. Supported Languages Metadata
  const LANGUAGES = [
    { code: "ar", name: "العربية", nativeName: "العربية", dir: "rtl", flag: "🇸🇦" },
    { code: "en", name: "English", nativeName: "English", dir: "ltr", flag: "🇬🇧" },
    { code: "ur", name: "Urdu", nativeName: "اردو", dir: "rtl", flag: "🇵🇰" },
    { code: "fr", name: "French", nativeName: "Français", dir: "ltr", flag: "🇫🇷" }
  ];

  // In-memory overrides cache
  let overrides = {};
  let currentLang = DEFAULT_LANG;

  // Initialize
  function init() {
    try {
      const savedLang = localStorage.getItem(STORAGE_LANG_KEY);
      if (savedLang && (savedLang === "ar" || savedLang === "en" || savedLang === "ur" || savedLang === "fr")) {
        currentLang = savedLang;
      } else {
        currentLang = DEFAULT_LANG;
      }

      const rawOverrides = localStorage.getItem(STORAGE_OVERRIDES_KEY);
      if (rawOverrides) {
        overrides = JSON.parse(rawOverrides) || {};
      }
    } catch (e) {
      console.warn("i18n init error:", e);
    }
    applyHtmlDir(currentLang);
  }

  // Update HTML tag dir & lang attributes
  function applyHtmlDir(lang) {
    if (typeof document === "undefined") return;
    const isRtl = (lang === "ar" || lang === "ur");
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
    if (document.body) {
      document.body.classList.toggle("lang-rtl", isRtl);
      document.body.classList.toggle("lang-ltr", !isRtl);
    }
  }

  // Active Language Getter & Setter
  function getLang() {
    return currentLang;
  }

  function setLang(lang) {
    if (!lang) return;
    currentLang = lang;
    try {
      localStorage.setItem(STORAGE_LANG_KEY, lang);
    } catch (e) {}

    applyHtmlDir(lang);

    // Also update session user if logged in
    try {
      if (typeof Store !== "undefined") {
        const st = Store.get();
        if (st && st.session) {
          st.session.lang = lang;
          const u = (st.users || []).find(x => x.id === st.session.id);
          if (u) u.lang = lang;
          Store.set({ session: st.session, users: st.users });
        }
      }
    } catch (e) {}

    // Trigger UI re-render if available
    if (typeof render === "function") {
      render();
    }
  }

  // Toggle between Arabic and English
  function toggleLang() {
    const next = currentLang === "ar" ? "en" : "ar";
    setLang(next);
    return next;
  }

  // Core Translation Function t(key, defaultText, params)
  function t(key, defaultText, params = {}) {
    if (!key) return defaultText || "";

    // 1. Check custom overrides first
    let text = null;
    if (overrides[currentLang] && overrides[currentLang][key]) {
      text = overrides[currentLang][key];
    }

    // 2. Check active language dictionary
    if (!text) {
      if (currentLang === "en") {
        text = DICT_EN[key];
      } else if (currentLang === "ar") {
        text = DICT_AR[key];
      }
    }

    // 3. Fallback to defaultText or Arabic dictionary or key itself
    if (!text) {
      text = defaultText || DICT_AR[key] || key;
    }

    // 4. Parameter interpolation: {n}, {name}, etc.
    if (params && typeof params === "object") {
      Object.keys(params).forEach(k => {
        text = text.replace(new RegExp(`\\{${k}\\}`, "g"), params[k]);
      });
    }

    return text;
  }

  // Get all keys list with categories
  function getCategories() {
    return [
      { id: "all", name: t("lbl_all", "الكل") },
      { id: "nav", name: t("nav_main_dash", "القوائم والتنقل") },
      { id: "btn", name: t("lbl_actions", "الأزرار والإجراءات") },
      { id: "palms", name: t("nav_palms", "الأشجار والحقل") },
      { id: "ops", name: t("nav_ops", "العمليات الزراعية") },
      { id: "fert", name: t("nav_fertilizers", "الأسمدة والمخزون") },
      { id: "nursery", name: t("nav_nursery", "المشتل والتكاثر") },
      { id: "yields", name: t("nav_yields", "المحصول والإنتاج") },
      { id: "audit", name: t("nav_audit", "سجل التدقيق والرقابة") },
      { id: "settings", name: t("nav_settings", "الإعدادات") }
    ];
  }

  function detectCategory(key) {
    if (key.startsWith("nav_")) return "nav";
    if (key.startsWith("btn_")) return "btn";
    if (key.startsWith("crop_") || key.startsWith("status_")) return "palms";
    if (key.startsWith("ops_")) return "ops";
    if (key.startsWith("fert_")) return "fert";
    if (key.startsWith("nursery_")) return "nursery";
    if (key.startsWith("yields_")) return "yields";
    if (key.startsWith("audit_")) return "audit";
    if (key.startsWith("settings_") || key.startsWith("i18n_")) return "settings";
    return "common";
  }

  // Get keys list with current translations for Studio
  function getStudioItems(targetLang = "en", catFilter = "all", query = "") {
    const q = (query || "").trim().toLowerCase();
    const allKeys = Object.keys(DICT_AR);

    return allKeys.filter(key => {
      const cat = detectCategory(key);
      if (catFilter !== "all" && cat !== catFilter) return false;

      if (q) {
        const arText = (DICT_AR[key] || "").toLowerCase();
        const curText = ((overrides[targetLang] && overrides[targetLang][key]) || (targetLang === "en" ? DICT_EN[key] : DICT_AR[key]) || "").toLowerCase();
        return key.toLowerCase().includes(q) || arText.includes(q) || curText.includes(q);
      }
      return true;
    }).map(key => {
      const ar = DICT_AR[key] || "";
      const isCustom = !!(overrides[targetLang] && overrides[targetLang][key]);
      const defaultTrans = targetLang === "en" ? (DICT_EN[key] || "") : (DICT_AR[key] || "");
      const current = isCustom ? overrides[targetLang][key] : defaultTrans;
      const isMissing = !current;

      return {
        key,
        category: detectCategory(key),
        ar,
        current,
        isCustom,
        isMissing
      };
    });
  }

  // Save single or batch overrides
  function saveOverride(lang, key, value) {
    overrides[lang] = overrides[lang] || {};
    if (value === undefined || value === null || value === "") {
      delete overrides[lang][key];
    } else {
      overrides[lang][key] = String(value).trim();
    }
    try {
      localStorage.setItem(STORAGE_OVERRIDES_KEY, JSON.stringify(overrides));
    } catch (e) {}
  }

  function saveBatch(lang, itemsMap) {
    overrides[lang] = overrides[lang] || {};
    Object.keys(itemsMap).forEach(key => {
      const val = itemsMap[key];
      if (val !== undefined && val !== null) {
        overrides[lang][key] = String(val).trim();
      }
    });
    try {
      localStorage.setItem(STORAGE_OVERRIDES_KEY, JSON.stringify(overrides));
    } catch (e) {}
  }

  // Reset to default factory dictionary
  function resetLang(lang) {
    if (overrides[lang]) {
      delete overrides[lang];
      try {
        localStorage.setItem(STORAGE_OVERRIDES_KEY, JSON.stringify(overrides));
      } catch (e) {}
    }
  }

  // Export dictionary to CSV for Excel
  function exportCSV(lang = "en") {
    const items = getStudioItems(lang, "all", "");
    const headers = ["كود المصطلح (Key)", "الأصل العربي (Arabic)", `الترجمة (${lang.toUpperCase()})`, "معدل مخصص (Custom)"];
    const rows = [headers.join(",")];

    const clean = (str) => `"${String(str || "").replace(/"/g, '""').replace(/[\r\n]+/g, " ")}"`;

    items.forEach(it => {
      rows.push([
        clean(it.key),
        clean(it.ar),
        clean(it.current),
        clean(it.isCustom ? "نعم" : "لا")
      ].join(","));
    });

    const bom = "\uFEFF";
    const csvContent = bom + rows.join("\r\n");

    if (typeof document !== "undefined") {
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ترجمة_المنظومة_${lang}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    return csvContent;
  }

  // Import CSV translations
  function importCSV(lang, csvContent) {
    if (!csvContent) return 0;
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length <= 1) return 0;

    let importedCount = 0;
    const batch = {};

    // Basic CSV parser supporting quotes
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(s => s.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
      if (parts.length >= 3) {
        const key = parts[0];
        const translation = parts[2];
        if (key && translation) {
          batch[key] = translation;
          importedCount++;
        }
      }
    }

    if (importedCount > 0) {
      saveBatch(lang, batch);
    }
    return importedCount;
  }

  // Get translation statistics
  function getStats(lang = "en") {
    const total = Object.keys(DICT_AR).length;
    const items = getStudioItems(lang, "all", "");
    const done = items.filter(x => x.current && x.current.trim().length > 0).length;
    const custom = items.filter(x => x.isCustom).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 100;
    return { total, done, custom, pct };
  }

  // Auto initialize on script load
  init();

  return {
    init,
    t,
    getLang,
    setLang,
    toggleLang,
    getLanguages: () => LANGUAGES,
    getCategories,
    getStudioItems,
    saveOverride,
    saveBatch,
    resetLang,
    exportCSV,
    importCSV,
    getStats,
    dictAr: DICT_AR,
    dictEn: DICT_EN
  };
})();

// Export globally
if (typeof window !== "undefined") {
  window.I18n = I18n;
  window.t = I18n.t;
}
