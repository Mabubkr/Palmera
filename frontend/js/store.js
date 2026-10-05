const Store = (() => {
  const KEY = "palmtrace_v5";
  const defaultState = () => ({
    companies: [
      { id: "comp_bashayer", name: "شركة بشاير الشوربجي للاستثمار الزراعي", tradeName: "بشاير الشوربجي", tier: "enterprise" }
    ],
    projects: [
      { id: "proj_farafra_01", companyId: "comp_bashayer", name: "مزرعة الفرافرة - قطاع 1", codePrefix: "BSH1", locationName: "الوادي الجديد - الفرافرة", areaFeddan: 500 },
      { id: "proj_toshka_02", companyId: "comp_bashayer", name: "مشروع توشكى للتمور - المرحلة الأولى", codePrefix: "TSH2", locationName: "أسوان - توشكى", areaFeddan: 1200 }
    ],
    activeProjectId: "proj_farafra_01",
    userProjectAccess: [
      { id: "acc_super_01", user_id: "usr_super_01", company_id: null, project_id: null, role_name: "super_admin", is_default: 1 },
      { id: "acc_comp_bashayer_01", user_id: "usr_comp_admin_01", company_id: "comp_bashayer", project_id: null, role_name: "company_admin", is_default: 1 },
      { id: "acc_proj_farafra_mgr", user_id: "usr_proj_mgr_01", company_id: "comp_bashayer", project_id: "proj_farafra_01", role_name: "engineer", is_default: 1 },
      { id: "acc_proj_asyut_mgr", user_id: "u_asyut_01", company_id: "comp_1789366851360", project_id: "proj_1789376864329", role_name: "admin", is_default: 1 }
    ],
    settings: {
      companyName: "شركة رعاية النخيل لإنتاج التمور",
      logo: "",
      currency: "EGP",
      currencyName: "جنيه مصري",
      showLangToggle: false,
      zakatRate: 5,
      zakatPolicy: {
        title: "وثيقة سياسة تفويض الشركة وإخراج الزكاة عن المستثمرين",
        version: "2026.1",
        updatedAt: "2026-09-01",
        terms: "أفوض أنا المستثمر الموقع أدناه شركة رعاية النخيل لإدارة وتشغيل المزارع في استقطاع وإخراج المقدار الشرعي الواجب لزكاة ثمار نخيلي وأشجاري لموسم الحصاد الحالي، وتسليمها عيناً أو نقداً نيابة عني إلى الجمعيات الخيرية والمؤسسات المعتمدة والمرخصة رسمياً، مع تزويدي بإيصال استلام رسمي صادر من الجهة المستلمة وشهادة إبراء ذمة زكاة معتمدة.",
        pledgeDoc: null
      }
    },
    propagationSourceTypes: [
      { id: "pst_f", name: "فسيلة", code: "F", notes: "خلفة أرضية مأخوذة من النخلة الأم", defaultCropId: "palm" },
      { id: "pst_n", name: "زراعة أنسجة (نخيل)", code: "N", notes: "نخيل نسيجي منتج مخبرياً", defaultCropId: "palm" },
      { id: "pst_c", name: "عقلة خضرية", code: "C", notes: "عقل ساقية غضة أو نصف خشبية مجذرة", defaultCropId: "olive" },
      { id: "pst_s", name: "شتلة مطعومة", code: "S", notes: "شتلة مركبة على أصل بري مقاوم", defaultCropId: "olive" },
      { id: "pst_t", name: "زراعة أنسجة (أشجار)", code: "T", notes: "شتلات نسيجية مخبرية للأشجار", defaultCropId: "olive" },
      { id: "pst_b", name: "شتلة بذرية", code: "B", notes: "شتلة منتجة من إنبات البذور مباشرة", defaultCropId: "all" },
      { id: "pst_l", name: "ترقيد هوائي", code: "L", notes: "إكثار خضري بتجذير الأغصان الهوائية", defaultCropId: "all" }
    ],
    cropUsageTypes: [
      { id: "main", name: "محصول رئيسي", desc: "النشاط الإنتاجي الأساسي في المزرعة" },
      { id: "intercrop", name: "محصول بيني", desc: "زراعة بينية مستدامة بين صفوف المحصول الرئيسي" },
      { id: "windbreak", name: "مصدات رياح وحماية", desc: "أشجار لحماية الحقول والحدود" },
      { id: "experimental", name: "محصول تجريبي وبحثي", desc: "أصناف تحت الاختبار الزراعي والتقييم" },
      { id: "nursery", name: "محصول مشتل وإكثار", desc: "مخصص لإنتاج وتوزيع الأصول والشتلات" }
    ],
    crops: [
      {
        id: "palm", name: "نخيل التمر", single: "نخلة", plural: "نخيل", offspring: "فسيلة", primarySourceCode: "F", usageType: "main", yieldName: "التمور", yield_name: "التمور", unit: "كجم", codePrefix: "F", active: true, icon: "palm", notes: "محصول رئيسي",
        sources: [
          { code: "F", name: "فسيلة", isDefault: true },
          { code: "N", name: "زراعة أنسجة (نخيل)", isDefault: false }
        ]
      },
      {
        id: "olive", name: "أشجار الزيتون", single: "شجرة زيتون", plural: "أشجار زيتون", offspring: "عقلة خضرية", primarySourceCode: "C", usageType: "intercrop", yieldName: "الزيتون", yield_name: "الزيتون", unit: "كجم", codePrefix: "O", active: true, icon: "olive", notes: "محصول بيني",
        sources: [
          { code: "C", name: "عقلة خضرية", isDefault: true },
          { code: "S", name: "شتلة بذرية", isDefault: false }
        ]
      },
      {
        id: "mango", name: "أشجار المانجو", single: "شجرة مانجو", plural: "أشجار مانجو", offspring: "شتلة مطعومة", primarySourceCode: "G", usageType: "main", yieldName: "ثمار المانجو", yield_name: "ثمار المانجو", unit: "كجم", codePrefix: "M", active: true, icon: "mango", notes: "محصول فاكهة رئيسي",
        sources: [
          { code: "G", name: "شتلة مطعومة", isDefault: true },
          { code: "A", name: "ترقيد هوائي", isDefault: false }
        ]
      }
    ],
    cropPlantingSources: [
      { id: "cps_palm_f", cropId: "palm", name: "فسيلة", codeLetter: "F", code: "F", isDefault: 1 },
      { id: "cps_palm_n", cropId: "palm", name: "زراعة أنسجة", codeLetter: "N", code: "N", isDefault: 0 },
      { id: "cps_olive_c", cropId: "olive", name: "عقلة خضرية", codeLetter: "C", code: "C", isDefault: 1 },
      { id: "cps_olive_s", cropId: "olive", name: "شتلة بذرية", codeLetter: "S", code: "S", isDefault: 0 },
      { id: "cps_mango_g", cropId: "mango", name: "شتلة مطعومة", codeLetter: "G", code: "G", isDefault: 1 },
      { id: "cps_mango_a", cropId: "mango", name: "ترقيد هوائي", codeLetter: "A", code: "A", isDefault: 0 }
    ],
    varieties: ["خلاص", "سكري", "برحي", "عجوة", "مجدول", "سيوي"],
    cropVarieties: [
      { id: "cv1", cropId: "palm", name: "خلاص", usage: "تمور فاخرة" },
      { id: "cv2", cropId: "palm", name: "سكري", usage: "تمور" },
      { id: "cv3", cropId: "palm", name: "برحي", usage: "رطب وتمور" },
      { id: "cv4", cropId: "palm", name: "عجوة", usage: "تمور المدينة" },
      { id: "cv5", cropId: "palm", name: "مجدول", usage: "تصدير فاخر" },
      { id: "cv6", cropId: "palm", name: "سيوي (صعيدي)", usage: "تمور الواحات وتصنيع" },
      { id: "cv7", cropId: "olive", name: "بيكوال", usage: "ثنائي الغرض (زيت ومائدة)" },
      { id: "cv8", cropId: "olive", name: "مانزانيلا", usage: "تخليل مائدة ممتاز" },
      { id: "cv9", cropId: "olive", name: "كوراتينا", usage: "إنتاج زيت عالي الجودة" },
      { id: "cv10", cropId: "olive", name: "شملالي", usage: "إنتاج زيت غزير" },
      { id: "cv11", cropId: "olive", name: "كالاماتا", usage: "تخليل مائدة يوناني فاخر" }
    ],
    roles: [
      {
        id: "admin", name: "إدارة", perms: ["all"], inventoryScope: "all",
        matrix: { palms: "rceda", ops: "rcedamv", fertilizers: "rceda", nursery: "rceda", yields: "rceda", reports: "rceda", zakat: "rceda", farmers: "rceda", users: "rceda", settings: "rceda", ai: "rceda" }
      },
      {
        id: "engineer", name: "مهندس مشرف", perms: ["dash","palms","ops","approve","fertilizers","yields","reports","farmers","users"], inventoryScope: "sector",
        matrix: { palms: "rce", ops: "rceamv", fertilizers: "r", nursery: "r", yields: "rce", reports: "rce", zakat: "r", farmers: "rce", users: "rce", settings: "r", ai: "rce" }
      },
      {
        id: "worker", name: "عامل ميداني", perms: ["field"], inventoryScope: "personal",
        matrix: { palms: "r", ops: "rcev", fertilizers: "r", nursery: "", yields: "", reports: "", zakat: "", farmers: "", users: "", settings: "", ai: "r" }
      },
      {
        id: "investor", name: "مستثمر", perms: ["investor"], inventoryScope: "personal",
        matrix: { palms: "r", ops: "r", fertilizers: "", nursery: "", yields: "r", reports: "r", zakat: "r", farmers: "r", users: "", settings: "", ai: "r" }
      },
      {
        id: "nursery_mgr", name: "مدير المشتل", perms: ["nursery","field"], inventoryScope: "sector",
        matrix: { palms: "r", ops: "rce", fertilizers: "r", nursery: "rceda", yields: "r", reports: "r", zakat: "", farmers: "r", users: "", settings: "" }
      },
      {
        id: "warehouse_mgr", name: "أمين المستودع والمخازن", perms: ["dash","fertilizers","reports"], inventoryScope: "all",
        matrix: { palms: "r", ops: "r", fertilizers: "rceda", nursery: "r", yields: "r", reports: "rce", zakat: "", farmers: "", users: "", settings: "" }
      },
      {
        id: "customer_care", name: "رعاية العملاء والزكاة", perms: ["dash","palms","yields","zakat","farmers","reports"], inventoryScope: "all",
        matrix: { palms: "r", ops: "", fertilizers: "", nursery: "", yields: "r", reports: "r", zakat: "rceda", farmers: "rce", users: "", settings: "" }
      }
    ],
    permCatalog: [
      { id: "all", name: "كل الصلاحيات" },
      { id: "dash", name: "المؤشرات" },
      { id: "palms", name: "إدارة النخيل" },
      { id: "ops", name: "العمليات" },
      { id: "fertilizers", name: "الأسمدة والمخزون" },
      { id: "approve", name: "اعتماد العمليات" },
      { id: "users", name: "المستخدمون" },
      { id: "import", name: "الاستيراد" },
      { id: "yields", name: "المحصول" },
      { id: "zakat", name: "الزكاة" },
      { id: "farmers", name: "المزارعون والعقود" },
      { id: "reports", name: "التقارير" },
      { id: "settings", name: "الإعدادات" },
      { id: "field", name: "العمل الميداني" },
      { id: "investor", name: "بوابة المستثمر" },
      { id: "nursery", name: "إدارة المشتل" }
    ],
    fertilizers: [
      { id: "ft1", name: "سماد عضوي معالج", kind: "عضوي", unit: "كجم", active: true, cropId: "all", stock: 15000, allocated: 3000, consumed: 8500, minAlert: 2000, unitCost: 1.8 },
      { id: "ft2", name: "NPK 20-20-20", kind: "كيميائي", unit: "كجم", active: true, cropId: "all", stock: 2400, allocated: 500, consumed: 1200, minAlert: 400, unitCost: 14.5 },
      { id: "ft3", name: "سلفات نشادر 20.6%", kind: "كيميائي", unit: "كجم", active: true, cropId: "all", stock: 3500, allocated: 600, consumed: 2100, minAlert: 500, unitCost: 9.0 },
      { id: "ft6", name: "مبيد سوسة النخيل المتخصص", kind: "مبيد", unit: "لتر", active: true, cropId: "palm", stock: 120, allocated: 25, consumed: 64, minAlert: 30, unitCost: 180.0 },
      { id: "fert_tsh_npk", name: "سماد توشكى المتوازن NPK 20-20-20", kind: "كيميائي", unit: "كجم", active: true, cropId: "all", stock: 5000, allocated: 0, consumed: 0, minAlert: 500, unitCost: 15.0 },
      { id: "ft3nvw11", name: "سماد متركب", kind: "كيميائي", unit: "لتر", active: true, cropId: "all", stock: 0, allocated: 0, consumed: 0, minAlert: 10, unitCost: 20.0 }
    ],
    fertilizerVouchers: [
      {
        id: "V-2026-001",
        date: "2026-02-10",
        type: "supply",
        fertId: "ft1",
        fertName: "سماد عضوي معالج",
        qty: 10000,
        unit: "كجم",
        from: "شركة الأسمدة العضوية الوطنية",
        toUser: "u1",
        sectorId: null,
        status: "received",
        notes: "توريد شحنة سماد عضوي معالج مطابقة للمواصفات",
        createdAt: "2026-02-10T09:00:00Z"
      },
      {
        id: "V-2026-002",
        date: "2026-02-15",
        type: "issue",
        fertId: "ft1",
        fertName: "سماد عضوي معالج",
        qty: 3000,
        unit: "كجم",
        from: "المخزن الرئيسي",
        toUser: "u2",
        sectorId: "03",
        status: "received",
        notes: "صرف لخدمة التسميد الشتوي لقطاع 03",
        createdAt: "2026-02-15T11:00:00Z",
        receivedAt: "2026-02-15T14:30:00Z"
      },
      {
        id: "V-2026-003",
        date: "2026-03-01",
        type: "issue",
        fertId: "ft2",
        fertName: "NPK 20-20-20",
        qty: 500,
        unit: "كجم",
        from: "المخزن الرئيسي",
        toUser: "u2",
        sectorId: "03",
        status: "pending",
        notes: "إذن صرف لتسميد شهر مارس الدفعة الأولى",
        createdAt: "2026-03-01T08:30:00Z"
      },
      {
        id: "V-2026-004",
        date: "2026-03-05",
        type: "issue",
        fertId: "ft1",
        fertName: "سماد عضوي معالج",
        qty: 600,
        unit: "كجم",
        from: "مستودع قطاع 03",
        toUser: "u3",
        sectorId: "03",
        status: "received",
        notes: "عهدة التسميد العضوي الميداني للعربة الميدانية - قطاع 03",
        createdAt: "2026-03-05T08:00:00Z",
        receivedAt: "2026-03-05T08:30:00Z"
      },
      {
        id: "V-2026-005",
        date: "2026-03-06",
        type: "issue",
        fertId: "ft2",
        fertName: "NPK 20-20-20",
        qty: 120,
        unit: "كجم",
        from: "مستودع قطاع 03",
        toUser: "u3",
        sectorId: "03",
        status: "received",
        notes: "عهدة تسميد ورقي وذواب للحقل",
        createdAt: "2026-03-06T09:00:00Z",
        receivedAt: "2026-03-06T09:20:00Z"
      },
      {
        id: "V-2026-006",
        date: "2026-03-07",
        type: "issue",
        fertId: "ft8",
        fertName: "مبيد سوسة النخيل والآفات الحشرية",
        qty: 15,
        unit: "لتر",
        from: "مستودع قطاع 03",
        toUser: "u3",
        sectorId: "03",
        status: "received",
        notes: "عهدة الرش الموضعي لمكافحة الآفات",
        createdAt: "2026-03-07T07:30:00Z",
        receivedAt: "2026-03-07T08:00:00Z"
      }
    ],
    nurseryPrepTypes: [
      { id: "np1", name: "فطام وتقليم الفسيلة", cropId: "palm", sourceCode: "F" },
      { id: "np2", name: "معاملة فطرية وتطهير الجروح", cropId: "all", sourceCode: "all" },
      { id: "np3", name: "تكييس وترطيب بالخيش", cropId: "palm", sourceCode: "F" },
      { id: "np4", name: "معاملة بهرمون التجذير (IBA)", cropId: "olive", sourceCode: "C" },
      { id: "np5", name: "الوضع في غرف الضباب والرطوبة", cropId: "olive", sourceCode: "C" },
      { id: "np6", name: "أقلمة العقل المجذرة", cropId: "olive", sourceCode: "C" },
      { id: "np7", name: "تطعيم بالقلم / بالعين", cropId: "all", sourceCode: "S" },
      { id: "np8", name: "فك شريط التطعيم وتربية الساق", cropId: "all", sourceCode: "S" },
      { id: "np9", name: "أقلمة نسيجية في الصوب", cropId: "all", sourceCode: "N" },
      { id: "np10", name: "تجهيز ونقل للزراعة المستديمة", cropId: "all", sourceCode: "all" }
    ],
    lastPrintBatch: [],
    stagedBatch: null,
    users: [
      { id: "u1", name: "إدارة الشركة", user: "admin", pass: "1234", role: "admin", phone: "01000000001" },
      { id: "u2", name: "م. خالد المشرف", user: "engineer", pass: "1234", role: "engineer", phone: "01000000002", plots: ["BSH01-01", "BSH01-02", "BSH01-03", "BSH01-04", "BSH01-05", "BSH01-06"] },
      { id: "u3", name: "أحمد الميداني", user: "worker", pass: "1234", role: "worker", phone: "01000000003", plots: [], palmIds: [] },
      { id: "u4", name: "أحمد بن محمد العتيبي", user: "investor", pass: "1234", role: "investor", phone: "01000000004", plots: [], palmIds: [] },
      { id: "u5", name: "سالم مدير المشتل", user: "nursery", pass: "1234", role: "nursery_mgr", phone: "01000000005", plots: [] },
      { id: "u6", name: "م. طارق أمين المخزن", user: "storage", pass: "1234", role: "warehouse_mgr", phone: "01000000006", plots: [] },
      { id: "u7", name: "سارة مديرة رعاية العملاء والزكاة", user: "care", pass: "1234", role: "customer_care", phone: "01000000007", plots: [] },
      { id: "u8", name: "عبد الله سعد القحطاني", user: "inv2", pass: "1234", role: "investor", phone: "0501234567", plots: [], palmIds: [] },
      { id: "u9", name: "محمد عبد الرحمن الشهري", user: "inv3", pass: "1234", role: "investor", phone: "0559876543", plots: [], palmIds: [] },
      { id: "u10", name: "فيصل خالد الدوسري", user: "inv4", pass: "1234", role: "investor", phone: "0561122334", plots: [], palmIds: [] }
    ],
    sectors: [],
    plots: [],
    operationCats: [
      { id: "c_d", name: "دورية" },
      { id: "c_w", name: "شتوية" },
      { id: "c_f", name: "تسميد" },
      { id: "c_i", name: "عارضة" },
      { id: "c_o", name: "أخرى" }
    ],
    operationTypes: [
      // 1. دورية (c_d)
      { id: "op_prune", catId: "c_d", name: "تقليم وتشذيب السعف", requiresMaterial: false, cropId: "all", scopeType: "both" },
      { id: "op_takreep", catId: "c_d", name: "تكريب وإزالة الكرب والأشواك", requiresMaterial: false, cropId: "palm", scopeType: "both" },
      { id: "op_pollinate", catId: "c_d", name: "تلقيح وتأبير يدوي / آلي", requiresMaterial: false, cropId: "palm", scopeType: "both" },
      { id: "op_thinning", catId: "c_d", name: "خف وتعديل وتدلية العذوق (التقويس)", requiresMaterial: false, cropId: "palm", scopeType: "both" },
      { id: "op_bagging", catId: "c_d", name: "تكييس وحماية العذوق", requiresMaterial: false, cropId: "palm", scopeType: "both" },
      { id: "op_harvest", catId: "c_d", name: "جني وحصاد التمور / الثمار", requiresMaterial: false, cropId: "all", scopeType: "both" },
      { id: "op_offshoot_sep", catId: "c_d", name: "فصل ونقل الفسائل والسرطانات", requiresMaterial: false, cropId: "all", scopeType: "both" },
      { id: "op_routine_check", catId: "c_d", name: "فحص دوري ومعاينة نمو", requiresMaterial: false, cropId: "all", scopeType: "both" },

      // 2. شتوية (c_w)
      { id: "op_winter_serv", catId: "c_w", name: "خدمة شتوية وخنادق كمبوست", requiresMaterial: true, allowedKinds: ["عضوي", "مخصب"], cropId: "all", scopeType: "both" },
      { id: "op_winter_spray", catId: "c_w", name: "رش شتوي وقائي (زيوت معدنية ونحاس)", requiresMaterial: true, allowedKinds: ["مبيد", "وقائي"], cropId: "all", scopeType: "both" },
      { id: "op_winter_basin", catId: "c_w", name: "تطهير وتوسيع جور النخيل وتكريب شتوي", requiresMaterial: false, cropId: "all", scopeType: "both" },
      { id: "op_winter_protect", catId: "c_w", name: "تدفئة وتغطية الفسائل الصغيرة ضد الصقيع", requiresMaterial: false, cropId: "all", scopeType: "both" },
      { id: "op_winter_till", catId: "c_w", name: "عزيق وتقليب وتهوية تربة الأحواض", requiresMaterial: false, cropId: "all", scopeType: "both" },
      { id: "op_winter_irr", catId: "c_w", name: "تنظيم ري السكون الشتوي", requiresMaterial: false, cropId: "all", scopeType: "both" },

      // 3. تسميد (c_f)
      { id: "op_fert_organic", catId: "c_f", name: "تسميد عضوي متحلل (كمبوست / سبلة معقمة)", requiresMaterial: true, allowedKinds: ["عضوي"], cropId: "all", scopeType: "both" },
      { id: "op_fert_chemical", catId: "c_f", name: "تسميد كيميائي NPK محبب (أرضي)", requiresMaterial: true, allowedKinds: ["كيميائي"], cropId: "all", scopeType: "both" },
      { id: "op_fert_fertigation", catId: "c_f", name: "تسميد شبكة الري (Fertigation - نترات وحامض)", requiresMaterial: true, allowedKinds: ["كيميائي"], cropId: "all", scopeType: "both" },
      { id: "op_fert_foliar", catId: "c_f", name: "رش ورقي عناصر صغرى (حديد / زنك / منجنيز / بورون)", requiresMaterial: true, allowedKinds: ["عناصر صغرى"], cropId: "all", scopeType: "both" },
      { id: "op_fert_amino", catId: "c_f", name: "رش أحماض أمينية وهيوميك ومحفزات نمو", requiresMaterial: true, allowedKinds: ["أحماض أمينية"], cropId: "all", scopeType: "both" },
      { id: "op_fert_soil_cond", catId: "c_f", name: "كبريت زراعي ومصلحات تربة وجبس زراعي", requiresMaterial: true, allowedKinds: ["مخصب"], cropId: "all", scopeType: "both" },
      { id: "op_fert_salinity", catId: "c_f", name: "معالجة ملوحة التربة وطارد أملاح", requiresMaterial: true, allowedKinds: ["مخصب"], cropId: "all", scopeType: "both" },

      // 4. عارضة / طوارئ (c_i)
      { id: "op_inc_weevil", catId: "c_i", name: "مكافحة وحقن سوسة النخيل الحمراء", requiresMaterial: true, allowedKinds: ["مبيد"], cropId: "palm", scopeType: "both" },
      { id: "op_inc_frond_break", catId: "c_i", name: "علاج كسر وتدلي سعف أو عذق", requiresMaterial: false, cropId: "palm", scopeType: "both" },
      { id: "op_inc_borer", catId: "c_i", name: "رش علاجي لحفار الساق والحشرات القشرية", requiresMaterial: true, allowedKinds: ["مبيد"], cropId: "all", scopeType: "both" },
      { id: "op_inc_rot", catId: "c_i", name: "معالجة تعفن القمة النامية (الجمارة) أو خياس الطلع", requiresMaterial: true, allowedKinds: ["مبيد", "وقائي"], cropId: "palm", scopeType: "both" },
      { id: "op_inc_dust_mite", catId: "c_i", name: "مكافحة عنكبوت الغبار (الغبير)", requiresMaterial: true, allowedKinds: ["مبيد"], cropId: "palm", scopeType: "both" },
      { id: "op_inc_irr_leak", catId: "c_i", name: "إصلاح تسريب مياه أو تلف شبكة الري", requiresMaterial: false, cropId: "all", scopeType: "both" },

      // 5. أخرى (c_o)
      { id: "op_oth_extra_irr", catId: "c_o", name: "ري إضافي / غسيل أحواض التربة", requiresMaterial: false, cropId: "all", scopeType: "both" },
      { id: "op_oth_weed_clean", catId: "c_o", name: "عزيق وإزالة حشائش وتنظيف محيط الجورة", requiresMaterial: false, cropId: "all", scopeType: "both" },
      { id: "op_oth_qr_tag", catId: "c_o", name: "تثبيت وترقيم كود الأصل والباركود (QR)", requiresMaterial: false, cropId: "all", scopeType: "both" },
      { id: "op_oth_growth_metric", catId: "c_o", name: "قياس وتوثيق ارتفاع النخلة ومحيط الساق", requiresMaterial: false, cropId: "all", scopeType: "both" },
      { id: "op_oth_archive_tree", catId: "c_o", name: "أرشفة واستبعاد أصل ميت / غير منتج", requiresMaterial: false, cropId: "all", scopeType: "both" }
    ],
    investors: [],
    nurseryItems: [],
    palms: [],
    offshoots: [],
    operations: [],
    yields: [],
    charities: [
      {
        id: "c1",
        name: "جمعية البر والخدمات الخيرية",
        licenseNo: "LIC-1442-882",
        city: "الرياض",
        address: "حي الروضة، طريق خريص، مبنى البر التنموي",
        contactPerson: "الشيخ عبد العزيز التميمي",
        phone: "0112345678",
        email: "zakat@albir-charity.org",
        receive: "both",
        bankName: "مصرف الراجحي",
        iban: "SA4480000123608010123456",
        categories: ["كفالة أسر متعففة", "إطعام وتوزيع تمور", "رعاية الأيتام"],
        stamp: "🏛️ معتمدة بوزارة الموارد البشرية والتنمية الاجتماعية",
        hidden: false
      },
      {
        id: "c2",
        name: "مؤسسة إكرام لحفظ النعمة والتمور",
        licenseNo: "LIC-1443-305",
        city: "القصيم",
        address: "بريدة، مجمع الجمعيات الخيرية",
        contactPerson: "د. سليمان الرشيد",
        phone: "0163800000",
        email: "contact@ikram-dates.org",
        receive: "kind",
        bankName: "بنك البلاد",
        iban: "SA9215000987654321000001",
        categories: ["توزيع تمور المزارع", "وجبات إفطار صائم", "سقيا وإطعام"],
        stamp: "🏛️ مرخصة رسمياً برقم 305",
        hidden: false
      },
      {
        id: "c3",
        name: "منصة إحسان وصندوق الزكاة الوطني",
        licenseNo: "LIC-GOV-001",
        city: "المملكة",
        address: "المنصة الوطنية الموحدة للعمل الخيري",
        contactPerson: "خدمة عملاء قطاع الزكاة",
        phone: "199099",
        email: "support@ehsan.sa",
        receive: "cash",
        bankName: "البنك الأهلي السعودي",
        iban: "SA0310000000012345678901",
        categories: ["سداد فواتير", "تفريج كربة", "صندوق الزكاة الرسمي"],
        stamp: "🇸🇦 المنصة الوطنية للعمل الخيري",
        hidden: false
      }
    ],
    // Zakat records come from the server (see Api.mergeZakat); no demo records on the device.
    zakat: [],
    zakatBatches: [
      {
        id: "zb1",
        projectId: "proj_farafra_01",
        companyId: "comp_bashayer",
        batchNo: "BATCH-ZKT-2026-01",
        season: "2026",
        type: "in_kind",
        cropId: "palm",
        variety: "خلاص فاخر",
        charityId: "c1",
        totalKg: 600,
        totalAmount: 59400,
        date: "2026-09-02",
        receiptNo: "REC-ALBIR-9842",
        receiptDoc: null,
        status: "delivered",
        notes: "تم نقل الشحنة وتسليمها لمستودعات الجمعية المركزية وتوزيعها على 120 أسرة متعففة",
        investors: [
          { investorId: "u4", name: "أحمد بن محمد العتيبي", phone: "01000000004", kg: 250, amount: 24750 },
          { investorId: "u8", name: "عبد الله سعد القحطاني", phone: "0501234567", kg: 200, amount: 19800 },
          { investorId: "u9", name: "محمد عبد الرحمن الشهري", phone: "0559876543", kg: 150, amount: 14850 }
        ]
      }
    ],
    farmers: [],
    zakatTransfers: [],
    operationSchedules: [
      {
        id: "sch_fert_01",
        title: "برنامج التسميد العضوي والنيتروجيني الدوري",
        cropId: "palm",
        opTypeId: "op_fert",
        opName: "تسميد وتغذية",
        sectorId: "all",
        plotId: "all",
        plotIds: [],
        intervalDays: 14,
        nextDueDate: new Date().toISOString().slice(0, 10),
        lastExecutedAt: null,
        assignedRole: "worker",
        assignedUserId: "all",
        priority: "normal",
        materialName: "سلفات نشادر 20.6% + هيوميك",
        recommendedDose: "0.5 كجم / شجرة",
        instructions: "توزيع السماد على داير محيط ظل الجريد مع تشغيل شبكة التنقيط مباشرة",
        active: true,
        projectId: "proj_farafra_01",
        createdAt: new Date().toISOString()
      },
      {
        id: "sch_pest_01",
        title: "المكافحة والرش الوقائي لسوسة النخيل",
        cropId: "palm",
        opTypeId: "op_pest",
        opName: "مكافحة وقائية",
        sectorId: "all",
        plotId: "all",
        plotIds: [],
        intervalDays: 21,
        nextDueDate: new Date().toISOString().slice(0, 10),
        lastExecutedAt: null,
        assignedRole: "worker",
        assignedUserId: "all",
        priority: "urgent",
        materialName: "كلوربيريفوس 48% أو إميداكلوبريد",
        recommendedDose: "2 سم³ / لتر ماء",
        instructions: "رش وقائي لقواعد الكرب ومحيط الجذع وفحص المصائد الفيرمونية",
        active: true,
        projectId: "proj_farafra_01",
        createdAt: new Date().toISOString()
      },
      {
        id: "sch_irr_01",
        title: "دورة الري الصيفية المنتظمة للنخيل",
        cropId: "palm",
        opTypeId: "op_irr",
        opName: "ري وتغذية",
        sectorId: "all",
        plotId: "all",
        plotIds: [],
        intervalDays: 4,
        nextDueDate: new Date().toISOString().slice(0, 10),
        lastExecutedAt: null,
        assignedRole: "worker",
        assignedUserId: "all",
        priority: "high",
        materialName: "مياه آبار عذبة",
        recommendedDose: "120 لتر / شجرة",
        instructions: "الري في ساعات الصباح الباكر أو المساء لتفادي الفقد بالتبخر",
        active: true,
        projectId: "proj_farafra_01",
        createdAt: new Date().toISOString()
      }
    ],
    earlyWarningRules: [
      {
        id: "ew_rpw",
        name: "سوسة النخيل الحمراء",
        scientificName: "Rhynchophorus ferrugineus",
        cropId: "palm",
        type: "حشري",
        criticalStage: "مرحلة التكريب وفصل الفسائل ونشاط الربيع والخريف",
        activityStartMonth: 9,
        activityEndMonth: 11,
        leadDays: 15,
        riskLevel: "critical",
        weatherTriggers: "اعتدال درجات الحرارة (22-35°م) مع وجود جروح تقليم رطبة",
        targetSectors: "all",
        preventiveActions: {
          mechanical: "نظافة الحقل، كشط وإزالة السعف الجاف، غسيل قواعد الكرب، ونصب وتجديد المصائد الفيرمونية لمراقبة الكثافة.",
          spray: "رش وقائي بمركبات الكبريت الزراعي أو مبيد حشري معتمد لتغطية جروح التقليم وقواعد الجذع.",
          materialName: "مبيد سوسة النخيل المتخصص",
          defaultDose: "2 سم³ / لتر ماء",
          phi: 21
        },
        curativeProtocol: {
          title: "بروتوكول الحقن الموضعي وعزل البؤرة فورياً",
          steps: [
            "تحديد بؤرة الإصابة بدقة وفحص الإفرازات الصمغية أو نشارة الخشب.",
            "تنظيف التجويف وحقن المبيد المتخصص تحت ضغط باستخدام أنبوبة حقن مخصصة.",
            "سد ثقوب المعاملة بالمعجون الزراعي أو الطين المعقم لمنع هروب اليرقات أو الحشرات الكاملة.",
            "وضع علامة تحذيرية حمراء على النخلة المصابة وتوثيقها بجدول الفحص والمتابعة الأسبوعية."
          ]
        },
        guideSOP: "دليل الفحص الدوري الأسبوعي لجذوع النخيل القريبة من الأرض وفحص قواعد الفسائل والتأكد من فاعلية المصائد الفيرمونية.",
        active: true
      },
      {
        id: "ew_lesser_moth",
        name: "الحميرة (دودة البلح الصغرى)",
        scientificName: "Batrachedra amydraula",
        cropId: "palm",
        type: "حشري",
        criticalStage: "مرحلة عقد الثمار (الحبابوك والجمري)",
        activityStartMonth: 4,
        activityEndMonth: 7,
        leadDays: 10,
        riskLevel: "high",
        weatherTriggers: "ارتفاع درجات الحرارة مع انخفاض الرطوبة عند بداية عقد الثمار",
        targetSectors: "all",
        preventiveActions: {
          mechanical: "جمع العراجين الجافة وبقايا الموسم السابق، والتخلص من الثمار المتساقطة ونظافة رأس النخلة.",
          spray: "الرش الوقائي بمركب حيوي (مثل باسيلس ثورينجينسيس) أو مبيد مانع انسلاخ عند تمام العقد وقبل اختراق اليرقات.",
          materialName: "طعم بروتيني جاذب ومبيد وقائي (الحميرة وذبابة الفاكهة)",
          defaultDose: "1.5 سم³ / لتر ماء",
          phi: 14
        },
        curativeProtocol: {
          title: "بروتوكول التدخل السريع لمكافحة الحميرة",
          steps: [
            "فحص دوري لعراجين الثمار في طور الحبابوك للكشف عن خيوط حريرية أو ثمار مثقوبة.",
            "رش مباشر وموجه للعراجين المصابة بمبيد جهازي سريع التأثير مع مراعاة فترة الأمان PHI.",
            "تكرار الرش بعد 12-14 يوماً إذا استمرت الإصابة أو لوحظ تجدد فقس البيوض."
          ]
        },
        guideSOP: "بروتوكول الفحص الدوري للشماريخ الزهرية والعقد المبكر وتطبيق المكافحة المتكاملة IPM لتقليل متبقيات المبيدات.",
        active: true
      },
      {
        id: "ew_olive_fly",
        name: "ذبابة ثمار الزيتون",
        scientificName: "Bactrocera oleae",
        cropId: "olive",
        type: "حشري",
        criticalStage: "بدء تصلب النواة وتكوّن لحم الثمرة (من منتصف الصيف إلى الخريف)",
        activityStartMonth: 7,
        activityEndMonth: 11,
        leadDays: 20,
        riskLevel: "critical",
        weatherTriggers: "درجات حرارة بين 20-30°م، حيث يقل نشاطها عند تجاوز 35°م وتنشط بقوة في الخريف",
        targetSectors: "all",
        preventiveActions: {
          mechanical: "نصب المصائد الصفراء اللاصقة والمصائد الغذائية الجاذبة بمعدل مصيدة لكل 5-10 شجرات لحساب كثافة الطيران.",
          spray: "الرش الجزئي للطعم السام (Bait Spray) على جهة واحدة من الأشجار لجذب الذباب وقتله قبل وضع البيض.",
          materialName: "مبيد ذبابة ثمار الزيتون",
          defaultDose: "2.5 لتر طعم + 150 سم³ مبيد لكل 100 لتر ماء",
          phi: 28
        },
        curativeProtocol: {
          title: "بروتوكول المعاملة الكلية عند تجاوز العتبة الاقتصادية",
          steps: [
            "حساب نسبة وخز الثمار؛ إذا تجاوزت 2-3% لزيتون المائدة أو 8% لزيتون الزيت يبدأ التدخل الشامل.",
            "الرش الشامل للأشجار بمبيد حشري اختراقي أو جهازي للقضاء على اليرقات داخل الثمار.",
            "إيقاف المعاملات الكيميائية قبل موعد الحصاد بمدة لا تقل عن فترة الأمان المحددة للمبيد."
          ]
        },
        guideSOP: "دليل شبكة المصائد الفرمونية والغذائية وطريقة حساب العتبة الاقتصادية لاتخاذ قرار المكافحة.",
        active: true
      },
      {
        id: "ew_peacock_spot",
        name: "مرض عين الطاووس الفطري",
        scientificName: "Spilocaea oleagina",
        cropId: "olive",
        type: "فطري",
        criticalStage: "فترات الرطوبة العالية مع اعتدال درجات الحرارة (الخريف ونهاية الشتاء)",
        activityStartMonth: 9,
        activityEndMonth: 12,
        leadDays: 14,
        riskLevel: "high",
        weatherTriggers: "رطوبة نسبية تزيد عن 75% مع درجات حرارة بين 15-22°م وتساقط الأمطار أو الندى الكثيف",
        targetSectors: "all",
        preventiveActions: {
          mechanical: "إجراء التقليم الفني لتفتيح قلب الشجرة وزيادة التهوية وتغلغل أشعة الشمس، والتخلص من الأوراق المتساقطة المصابة.",
          spray: "الرش الوقائي بمركبات النحاس (أكسيد النحاس أو كبريتات النحاس الميكرونية) لتثبيط إنبات الأبواغ الفطرية.",
          materialName: "مركب نحاسي ميكروني وقائي (عين الطاووس)",
          defaultDose: "2.5 كجم / 1000 لتر ماء",
          phi: 15
        },
        curativeProtocol: {
          title: "بروتوكول المعاملة الفطرية عند ظهور البقع الدائرية",
          steps: [
            "فحص أوراق الثلث السفلي من الشجرة للكشف عن البقع الدائرية الرمادية الداكنة المحاطة بهالة صفراء.",
            "تنفيذ رشة علاجية بمبيد فطري جهازي متخصص (من مجموعة التريازول أو الاستروبيلورين).",
            "إعادة المعاملة بعد هطول الأمطار الغزيرة لحماية النموات الحديثة."
          ]
        },
        guideSOP: "دليل الفحص المجهري الميداني للأوراق المشتبهة وبروتوكول تطبيق مركبات النحاس الصديقة للبيئة.",
        active: true
      }
    ],
    notifications: [],
    queue: [],
    session: null,
    contracts: [],
    contractPlots: [],
    agriSettings: {
      provider: "openweather",
      status: "connected",
      apiKey: "",
      openWeatherKey: "",
      agroMonitoringKey: "",
      sentinelClientId: "",
      sentinelSecret: "",
      ndviThresholds: {
        excellent: 0.55,
        good: 0.40,
        stress: 0.25,
        critical: 0.15,
        dropAlert14Days: 0.08
      },
      kcBySeason: {
        young: { winter: 0.50, spring: 0.60, summer: 0.65, autumn: 0.55 },
        medium: { winter: 0.65, spring: 0.75, summer: 0.85, autumn: 0.70 },
        mature: { winter: 0.70, spring: 0.85, summer: 0.95, autumn: 0.80 },
        olive: { winter: 0.55, spring: 0.65, summer: 0.70, autumn: 0.60 }
      },
      desertEt0Monthly: [3.2, 4.1, 5.5, 7.0, 8.5, 9.8, 10.2, 9.6, 7.8, 5.9, 4.2, 3.1],
      carbonKgByAgeClass: {
        young: 16,
        medium: 100,
        mature: 225
      },
      co2eFactor: 3.67,
      pestRules: [
        { pestId: "rpw", name: "سوسة النخيل الحمراء", tempMin: 20, tempMax: 36, humidityMin: 45, weightIncident: 25 },
        { pestId: "dust_mite", name: "حلم الغبار", tempMin: 32, tempMax: 48, humidityMin: 15, weightIncident: 20 }
      ]
    }
  });

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const def = defaultState();
      if (!raw) return def;
      const parsed = JSON.parse(raw);
      if (parsed.palms || parsed.operations || parsed.audit || parsed.sectors || parsed.plots) {
        setTimeout(() => {
          try {
            const clean = _pruneStateForStorage(def);
            localStorage.setItem(KEY, JSON.stringify(clean));
          } catch (e) {}
        }, 50);
      }
      const propTypes = (parsed.propagationSourceTypes && parsed.propagationSourceTypes.length) ? parsed.propagationSourceTypes : def.propagationSourceTypes;
      const usageTypes = (parsed.cropUsageTypes && parsed.cropUsageTypes.length) ? parsed.cropUsageTypes : def.cropUsageTypes;
      const cropPlantingSources = (parsed.cropPlantingSources && parsed.cropPlantingSources.length) ? parsed.cropPlantingSources : def.cropPlantingSources;
      const crops = (parsed.crops && parsed.crops.length ? parsed.crops : def.crops).map(c => {
        if (!c.usageType) c.usageType = c.id === "palm" ? "main" : (c.id === "olive" ? "intercrop" : "main");
        if (!c.primarySourceCode) c.primarySourceCode = c.id === "palm" ? "F" : (c.id === "olive" ? "C" : (c.id === "mango" ? "G" : (c.codePrefix || "S")));
        if (!c.yieldName) c.yieldName = c.yield_name || (c.id === "palm" ? "التمور" : (c.id === "olive" ? "الزيتون" : (c.id === "mango" ? "ثمار المانجو" : "المحصول")));
        if (!c.yield_name) c.yield_name = c.yieldName;
        if (!c.unit) c.unit = "كجم";
        if (!c.sources || !c.sources.length) {
          if (c.id === "palm") c.sources = [{ code: "F", name: "فسيلة", isDefault: true }, { code: "N", name: "زراعة أنسجة (نخيل)", isDefault: false }];
          else if (c.id === "olive") c.sources = [{ code: "C", name: "عقلة خضرية", isDefault: true }, { code: "S", name: "شتلة بذرية", isDefault: false }];
          else if (c.id === "mango") c.sources = [{ code: "G", name: "شتلة مطعومة", isDefault: true }, { code: "A", name: "ترقيد هوائي", isDefault: false }];
          else c.sources = [{ code: c.primarySourceCode || "S", name: c.offspring || "شتلة", isDefault: true }];
        }
        return c;
      });
      let ferts = (parsed.fertilizers && parsed.fertilizers.length ? parsed.fertilizers : def.fertilizers).map(f => {
        const defF = def.fertilizers.find(x => x.id === f.id || x.name === f.name);
        return {
          ...f,
          cropId: f.cropId || "all",
          active: f.active !== false,
          stock: (f.stock !== undefined) ? (Number(f.stock) || 0) : (defF?.stock ?? 0),
          allocated: (f.allocated !== undefined) ? (Number(f.allocated) || 0) : (defF?.allocated ?? 0),
          consumed: (f.consumed !== undefined) ? (Number(f.consumed) || 0) : (defF?.consumed ?? 0),
          minAlert: (f.minAlert !== undefined) ? (Number(f.minAlert) || 50) : (defF?.minAlert ?? 50),
          unitCost: (f.unitCost !== undefined) ? (Number(f.unitCost) || 0) : (defF?.unitCost ?? 0)
        };
      });
      if (!ferts.some(f => f.kind === "عناصر صغرى")) {
        const ft8 = def.fertilizers.find(f => f.id === "ft8");
        if (ft8) ferts.push(ft8);
      }
      if (!ferts.some(f => f.kind === "أحماض أمينية")) {
        const ft9 = def.fertilizers.find(f => f.id === "ft9");
        if (ft9) ferts.push(ft9);
      }
      let vouchers = (parsed.fertilizerVouchers && parsed.fertilizerVouchers.length) ? parsed.fertilizerVouchers : def.fertilizerVouchers;
      if (!vouchers.some(v => v.toUser === "u3")) {
        const workerVouchers = def.fertilizerVouchers.filter(v => v.toUser === "u3");
        vouchers = [...vouchers, ...workerVouchers];
      }
      const preps = (parsed.nurseryPrepTypes || def.nurseryPrepTypes).map(p => ({
        ...p,
        active: p.active !== false,
        cropId: p.cropId || ((p.name.includes("فسيل") || p.name.includes("فسائل") || p.name.includes("نخيل")) ? "palm" : (p.name.includes("عقل") || p.name.includes("زيتون") ? "olive" : "all")),
        sourceCode: p.sourceCode || ((p.name.includes("فسيل") || p.name.includes("فسائل")) ? "F" : ((p.name.includes("عقل") || p.name.includes("تجذير") || p.name.includes("ضباب") || p.name.includes("IBA") || (p.cropId === "olive" && !p.name.includes("تطعيم"))) ? "C" : (p.name.includes("تطعيم") ? "S" : (p.name.includes("نسيج") ? "N" : "all"))))
      }));
      const opTypes = (parsed.operationTypes || def.operationTypes).map(t => ({
        ...t,
        cropId: t.cropId || "all"
      }));
      (def.operationTypes || []).forEach(defOp => {
        const existing = opTypes.find(t => t.id === defOp.id);
        if (!existing) {
          opTypes.push(defOp);
        } else {
          existing.catId = defOp.catId;
          existing.scopeType = defOp.scopeType || "both";
          existing.requiresMaterial = defOp.requiresMaterial;
        }
      });
      const isMockPalm = (p) => {
        if (!p) return true;
        const id = String(p.id || "");
        const code = String(p.code || "");
        return ["p1", "p2", "p3", "p4", "p5", "p6"].includes(id) || code.includes("03-12A-F045") || code.includes("03-12A-C001") || code.includes("03-12A-S002");
      };
      let palms = (Array.isArray(parsed.palms) ? parsed.palms : (def.palms || []))
        .filter(p => !isMockPalm(p))
        .map(p => ({
          ...p,
          cropId: p.cropId || (p.variety && ["بيكوال", "مانزانيلا", "كوراتينا", "شملالي", "كالاماتا"].includes(p.variety) ? "olive" : "palm")
        }));

      // Deduplicate palms by normalized code to ensure only 1 record per physical tree
      const normCodeStr = (c) => String(c || "").trim().toUpperCase().replace(/[\s\-_]/g, "");
      const dedupedPalmsMap = new Map();
      palms.forEach(p => {
        const k = normCodeStr(p.code) || String(p.id);
        if (!dedupedPalmsMap.has(k)) {
          dedupedPalmsMap.set(k, p);
        } else {
          // If duplicate exists, prefer the canonical record with numeric ID (from SQLite)
          const existing = dedupedPalmsMap.get(k);
          if (typeof p.id === "number" && typeof existing.id !== "number") {
            dedupedPalmsMap.set(k, { ...existing, ...p });
          } else {
            dedupedPalmsMap.set(k, { ...p, ...existing });
          }
        }
      });
      palms = Array.from(dedupedPalmsMap.values());

      let roles = (parsed.roles || def.roles).map(r => {
        const defR = def.roles.find(d => d.id === r.id);
        const m = r.matrix || defR?.matrix || { palms: "r", ops: "r", fertilizers: "r", nursery: "r", yields: "r", reports: "r", zakat: "r", farmers: "r", users: "", settings: "" };
        if (m.fertilizers === undefined || (r.id === "engineer" && m.fertilizers === "rcea")) {
          m.fertilizers = defR?.matrix?.fertilizers || "r";
        }
        if (m.farmers === undefined) {
          m.farmers = defR?.matrix?.farmers || "r";
        }
        if (m.ai === undefined) {
          m.ai = defR?.matrix?.ai || (r.id === "admin" ? "rceda" : (r.id === "engineer" ? "rce" : "r"));
        }
        if (r.id === "admin") {
          m.ops = defR?.matrix?.ops || "rcedamv";
          m.farmers = "rceda";
          m.ai = "rceda";
        } else if (defR?.matrix?.ops) {
          if (defR.matrix.ops.includes("v") && !m.ops.includes("v")) m.ops += "v";
          if (defR.matrix.ops.includes("m") && !m.ops.includes("m")) m.ops += "m";
        }
        if (r.id === "customer_care") {
          m.fertilizers = "";
          m.nursery = "";
          m.ops = "";
          m.users = "";
          m.settings = "";
          m.farmers = "rce";
          m.zakat = "rceda";
          m.palms = "r";
          m.yields = "r";
          m.reports = "r";
          r.perms = ["dash", "palms", "yields", "zakat", "farmers", "reports"];
        }
        if (r.id === "worker") {
          m.nursery = "";
          m.yields = "";
          m.reports = "";
          m.zakat = "";
          m.farmers = "";
          m.users = "";
          m.settings = "";
        }
        if (r.id === "warehouse_mgr") {
          m.zakat = "";
          m.farmers = "";
          m.users = "";
          m.settings = "";
        }
        return {
          ...r,
          inventoryScope: r.inventoryScope || defR?.inventoryScope || (r.id === "worker" ? "personal" : r.id === "engineer" ? "sector" : "all"),
          matrix: m
        };
      });
      if (!roles.some(r => r.id === "warehouse_mgr")) {
        const whR = def.roles.find(r => r.id === "warehouse_mgr");
        if (whR) roles.push(whR);
      }
      if (!roles.some(r => r.id === "customer_care")) {
        const ccR = def.roles.find(r => r.id === "customer_care");
        if (ccR) roles.push(ccR);
      }

      let users = parsed.users || def.users;
      def.users.forEach(du => {
        const idx = users.findIndex(u => u.id === du.id || u.user === du.user);
        if (idx === -1) {
          users.push({ ...du });
        } else {
          if (!users[idx].user) users[idx].user = du.user;
          if (!users[idx].pass) users[idx].pass = du.pass;
          if (!users[idx].role) users[idx].role = du.role;
          if (du.user === "care") {
            users[idx].user = "care";
            users[idx].role = "customer_care";
            users[idx].pass = users[idx].pass || "1234";
          }
        }
      });
      users = users.map(u => {
        const defU = def.users.find(d => d.id === u.id || d.user === u.user);
        const known = u.pass || defU?.pass;
        const fallback = ["admin", "engineer", "worker", "investor", "nursery", "storage", "care", "inv2", "inv3", "inv4"].includes(u.user) ? "1234" : "";
        return {
          ...u,
          pass: known || fallback,
          inventoryScope: u.inventoryScope || defU?.inventoryScope || (u.role === "worker" ? "personal" : u.role === "engineer" ? "sector" : "all")
        };
      });

      const charities = (parsed.charities && parsed.charities.some(c => c.licenseNo)) ? parsed.charities : def.charities;
      const zakatBatches = (parsed.zakatBatches && parsed.zakatBatches.length) ? parsed.zakatBatches : def.zakatBatches;
      const zakat = Array.isArray(parsed.zakat) ? parsed.zakat : [];
      const settings = { ...def.settings, ...(parsed.settings || {}) };
      if (typeof settings.showLangToggle !== "boolean") settings.showLangToggle = false;
      if (!settings.zakatPolicy) settings.zakatPolicy = def.settings.zakatPolicy;

      const cleanFerts = (ferts || []).map(f => ({
        ...f,
        stock: typeof f.stock === "number" ? f.stock : (Number(f.stock) || 0),
        allocated: typeof f.allocated === "number" ? f.allocated : (Number(f.allocated) || 0),
        consumed: typeof f.consumed === "number" ? f.consumed : (Number(f.consumed) || 0),
        minAlert: typeof f.minAlert === "number" ? f.minAlert : (Number(f.minAlert) || 100),
        unitCost: typeof f.unitCost === "number" ? f.unitCost : (Number(f.unitCost) || 0),
        active: f.active !== false
      }));

      const fertIds = new Set((cleanFerts || []).map(f => f.id));
      def.fertilizers.forEach(df => {
        if (!fertIds.has(df.id)) cleanFerts.push({ ...df });
      });

      const schedules = (parsed.operationSchedules && parsed.operationSchedules.length) ? parsed.operationSchedules : def.operationSchedules;
      const earlyWarningRules = (parsed.earlyWarningRules && parsed.earlyWarningRules.length) ? parsed.earlyWarningRules : def.earlyWarningRules;

      const isMockOp = (o) => !o || ["opx1", "opx2", "opx3"].includes(String(o.id));
      const isMockOff = (os) => !os || ["os1", "os2"].includes(String(os.id)) || String(os.tempCode || "").includes("03-12A-F045");
      const isMockSec = (s) => !s || ["03", "05"].includes(String(s.id));
      const isMockPlot = (pl) => !pl || ["03-12A", "03-12B", "05-07B"].includes(String(pl.id));
      const isMockYield = (y) => !y || ["y1", "y2", "y3", "y4", "y5"].includes(String(y.id)) || String(y.batch || "").startsWith("BATCH-2025-00") || String(y.batch || "").startsWith("BATCH-2026-00");
      const isMockFarmer = (f) => !f || ["fm1", "fm2"].includes(String(f.id));

      // Merge pending operations saved offline so they survive hard-refresh (Ctrl+F5)
      let operations = (parsed.operations && Array.isArray(parsed.operations) && parsed.operations.length > 0)
        ? parsed.operations
        : (def.operations || []);
      operations = operations.filter(o => !isMockOp(o));
      if (Array.isArray(parsed.pendingOperations) && parsed.pendingOperations.length > 0) {
        const existingOpIds = new Set(operations.map(o => String(o.id)));
        const unmergedPendingOps = parsed.pendingOperations.filter(po => !isMockOp(po) && !existingOpIds.has(String(po.id)));
        operations = [...unmergedPendingOps, ...operations];
      }

      // Merge pending offshoots saved offline
      let offshoots = (parsed.offshoots && Array.isArray(parsed.offshoots) && parsed.offshoots.length > 0)
        ? parsed.offshoots
        : (def.offshoots || []);
      offshoots = offshoots.filter(os => !isMockOff(os));
      if (Array.isArray(parsed.pendingOffshoots) && parsed.pendingOffshoots.length > 0) {
        const existingOffIds = new Set(offshoots.map(o => String(o.id)));
        const unmergedPendingOff = parsed.pendingOffshoots.filter(po => !isMockOff(po) && !existingOffIds.has(String(po.id)));
        offshoots = [...unmergedPendingOff, ...offshoots];
      }

      // Merge pending palms saved offline
      if (Array.isArray(parsed.pendingPalms) && parsed.pendingPalms.length > 0) {
        const existingPalmIds = new Set(palms.map(p => String(p.id)));
        const unmergedPendingPalms = parsed.pendingPalms.filter(pp => !isMockPalm(pp) && !existingPalmIds.has(String(pp.id)));
        palms = [...unmergedPendingPalms, ...palms];
      }

      return {
        ...def,
        ...parsed,
        sectors: (Array.isArray(parsed.sectors) ? parsed.sectors : (def.sectors || [])).filter(s => !isMockSec(s)),
        plots: (Array.isArray(parsed.plots) ? parsed.plots : (def.plots || [])).filter(pl => !isMockPlot(pl)),
        nurseryItems: (Array.isArray(parsed.nurseryItems) ? parsed.nurseryItems : (def.nurseryItems || [])).filter(n => n && n.id !== "n1"),
        farmers: (Array.isArray(parsed.farmers) ? parsed.farmers : (def.farmers || [])).filter(f => !isMockFarmer(f)),
        yields: (Array.isArray(parsed.yields) ? parsed.yields : (def.yields || [])).filter(y => !isMockYield(y)),
        companies: (parsed.companies && parsed.companies.length) ? parsed.companies : def.companies,
        projects: (parsed.projects && parsed.projects.length) ? parsed.projects : def.projects,
        activeProjectId: "proj_farafra_01",
        activeCompanyId: parsed.activeCompanyId || def.activeCompanyId || "comp_bashayer",
        userProjectAccess: parsed.userProjectAccess || def.userProjectAccess || [],
        settings,
        charities,
        zakat,
        zakatBatches,
        propagationSourceTypes: propTypes,
        cropUsageTypes: usageTypes,
        crops,
        cropPlantingSources,
        cropVarieties: parsed.cropVarieties && parsed.cropVarieties.length ? parsed.cropVarieties : def.cropVarieties,
        fertilizers: cleanFerts,
        fertilizerVouchers: vouchers,
        nurseryPrepTypes: preps,
        operationTypes: opTypes,
        operationSchedules: schedules,
        earlyWarningRules,
        palms,
        offshoots,
        operations,
        roles,
        users,
        investors: (parsed.investors && parsed.investors.length) ? parsed.investors : (def.investors || []),
        contracts: (parsed.contracts && parsed.contracts.length) ? parsed.contracts : (def.contracts || []),
        contractPlots: (parsed.contractPlots && parsed.contractPlots.length) ? parsed.contractPlots : (def.contractPlots || []),
        agriSettings: (parsed.agriSettings && typeof parsed.agriSettings === "object") ? { ...def.agriSettings, ...parsed.agriSettings } : def.agriSettings
      };
    } catch { return defaultState(); }
  }
  function _pruneStateForStorage(st) {
    // Keep ONLY lightweight items in localStorage:
    // Session, settings, pending offline queue, and sync timestamp.
    // Heavy datasets (palms, operations, yields, fertilizers, etc.) remain in-memory (_cachedState)
    // and load freshly from SQLite via Api.pullLatest(), permanently preventing QuotaExceededError.
    // CRITICAL: Unsynced offline work (operations, offshoots, palms) MUST be preserved in pending arrays
    // so hard-refresh (Ctrl+F5) or browser restart will NEVER lose un-synced field worker data!
    const pendingOps = Array.isArray(st.operations)
      ? st.operations.filter(o => o && o.status !== "synced")
      : [];
    const pendingOffshoots = Array.isArray(st.offshoots)
      ? st.offshoots.filter(os => os && (os.status === "pending" || os.isOffline))
      : [];
    const pendingPalms = Array.isArray(st.palms)
      ? st.palms.filter(p => p && (p.status === "pending" || p.isOffline))
      : [];

    return {
      session: st.session || null,
      settings: st.settings || {},
      crops: st.crops || [],
      fertilizers: st.fertilizers || [],
      nurseryPrepTypes: st.nurseryPrepTypes || [],
      operationSchedules: Array.isArray(st.operationSchedules) ? st.operationSchedules : [],
      earlyWarningRules: Array.isArray(st.earlyWarningRules) ? st.earlyWarningRules : [],
      agriSettings: st.agriSettings || {},
      queue: Array.isArray(st.queue) ? st.queue.filter(q => q && q.status !== "synced") : [],
      pendingOperations: pendingOps,
      pendingOffshoots: pendingOffshoots,
      pendingPalms: pendingPalms,
      // Zakat is small; kept so unsent edits survive a reload (synced by Api.syncZakat)
      zakat: Array.isArray(st.zakat) ? st.zakat : [],
      activeProjectId: st.activeProjectId || "proj_farafra_01",
      activeCompanyId: st.activeCompanyId || "comp_bashayer",
      lastSync: st.lastSync || null
    };
  }

  function _executeSave(state) {
    try {
      const pruned = _pruneStateForStorage(state);
      localStorage.setItem(KEY, JSON.stringify(pruned));
      if (typeof Api !== "undefined" && typeof Api.queueZakatSync === "function") Api.queueZakatSync();
    } catch (err) {
      console.warn("Storage save failed, attempting minimal pending save:", err);
      try {
        const pruned = _pruneStateForStorage(state);
        // Strip heavy image thumbnails if quota is hit, ensuring vital operation logs are saved
        if (pruned.pendingOperations && pruned.pendingOperations.length) {
          pruned.pendingOperations = pruned.pendingOperations.map(o => ({ ...o, photos: [] }));
        }
        localStorage.setItem(KEY, JSON.stringify(pruned));
      } catch (e) {
        console.error("Critical storage failure:", e);
      }
    }
  }

  let _saveTimer = null;

  function save(state) {
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
      _executeSave(state);
    }, 200);
  }

  let state = load();
  return {
    get: () => state,
    set(patch) { state = { ...state, ...patch }; save(state); },
    // Persist a full state object (used by several screens after mutating Store.get() in place)
    save(newState) { if (newState) state = newState; save(state); },
    saveNow() { if (_saveTimer) clearTimeout(_saveTimer); _executeSave(state); },
    reset() { state = defaultState(); save(state); },
    uid(p = "id") {
      if (typeof UuidV7 !== "undefined" && typeof UuidV7.generate === "function") {
        return UuidV7.generate();
      }
      return p + Math.random().toString(36).slice(2, 8);
    }
  };
})();

function getCropPlantingSources(cropId) {
  const st = (typeof Store !== "undefined" && Store.get) ? Store.get() : {};
  const crops = st.crops || [];
  const cid = String(cropId || "palm").toLowerCase();
  const c = crops.find(x => String(x.id).toLowerCase() === cid || String(x.code).toLowerCase() === cid || String(x.numericId) === cid);

  // If crop object has sources, use them
  if (c && Array.isArray(c.sources) && c.sources.length) {
    return [...c.sources].map(s => ({
      code: s.code || s.codeLetter,
      name: s.name,
      isDefault: Boolean(s.isDefault)
    })).sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
  }

  // Check st.cropPlantingSources
  const allCps = st.cropPlantingSources || [];
  const matching = allCps.filter(s => String(s.cropId || s.crop_id).toLowerCase() === cid || (c && String(s.cropId || s.crop_id) === String(c.numericId)));
  if (matching.length) {
    return matching.map(s => ({
      code: s.codeLetter || s.code_letter || s.code,
      name: s.name,
      isDefault: Boolean(s.isDefault || s.is_default)
    })).sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
  }

  // Standard defaults per crop
  if (cid === "palm" || cid === "1") {
    return [
      { code: "F", name: "فسيلة", isDefault: true },
      { code: "N", name: "زراعة أنسجة (نخيل)", isDefault: false }
    ];
  }
  if (cid === "olive" || cid === "2") {
    return [
      { code: "C", name: "عقلة خضرية", isDefault: true },
      { code: "S", name: "شتلة بذرية", isDefault: false }
    ];
  }
  if (cid === "mango" || cid === "3") {
    return [
      { code: "G", name: "شتلة مطعومة", isDefault: true },
      { code: "A", name: "ترقيد هوائي", isDefault: false }
    ];
  }

  return [
    { code: c?.primarySourceCode || "S", name: c?.offspring || "شتلة", isDefault: true }
  ];
}
if (typeof window !== "undefined") {
  window.getCropPlantingSources = getCropPlantingSources;
}
