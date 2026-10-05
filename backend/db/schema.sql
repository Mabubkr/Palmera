-- =========================================================================
-- PalmTrace Enterprise SQLite Schema (100% Normalized & Numeric 3NF)
-- Single-Farm Enterprise Architecture (Clean Single-Tenant Standard)
-- مصممة لاستيعاب ملايين الأشجار وعشرات الملايين من العمليات بأعلى سرعة RAM
-- =========================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- =========================================================================
-- 1. الجداول الأساسية والتشغيلية (Core Operational Tables)
-- =========================================================================

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL,
    phone TEXT,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    email TEXT,
    reset_token_hash TEXT,
    reset_token_expires_at DATETIME,
    must_change_password INTEGER DEFAULT 0,
    avatar TEXT,
    blood_type TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name_ar TEXT NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);

CREATE TABLE IF NOT EXISTS investment_contracts (
    id TEXT PRIMARY KEY,
    contract_number TEXT UNIQUE NOT NULL,
    investor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    total_trees INTEGER DEFAULT 0,
    total_area REAL DEFAULT 0,
    investor_share_pct REAL DEFAULT 100,
    financial_status TEXT DEFAULT 'مسدد بالكامل',
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contracts_investor ON investment_contracts(investor_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_num ON investment_contracts(contract_number);

CREATE TABLE IF NOT EXISTS contract_plots (
    contract_id TEXT NOT NULL REFERENCES investment_contracts(id) ON DELETE CASCADE,
    plot_id TEXT NOT NULL REFERENCES plots(id) ON DELETE CASCADE,
    PRIMARY KEY (contract_id, plot_id)
);

CREATE INDEX IF NOT EXISTS idx_contract_plots_plot ON contract_plots(plot_id);

CREATE TABLE IF NOT EXISTS sectors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    notes TEXT,
    boundary_coordinates TEXT,
    total_area REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_deleted INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plots (
    id TEXT PRIMARY KEY,
    sector_id TEXT NOT NULL,
    plot_no TEXT NOT NULL,
    part_letter TEXT NOT NULL,
    name TEXT NOT NULL,
    polygon_gps TEXT,
    parent_plot_id TEXT,
    area_value REAL DEFAULT 0,
    area_unit TEXT DEFAULT 'فدان',
    boundary_coordinates TEXT,
    center_lat REAL,
    center_lng REAL,
    main_crop TEXT,
    target_capacity INTEGER DEFAULT 0,
    irrigation_source TEXT,
    contract_ref TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sector_id) REFERENCES sectors(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_plot_id) REFERENCES plots(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "user_plots" (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plot_id TEXT NOT NULL REFERENCES plots(id) ON DELETE CASCADE,
        permission_type TEXT DEFAULT 'work',
        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, plot_id)
    );

CREATE TABLE IF NOT EXISTS "crops" (
      id INTEGER PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      single_label TEXT NOT NULL,
      plural_label TEXT NOT NULL,
      offspring_label TEXT NOT NULL,
      code_prefix TEXT NOT NULL,
      primary_source_code TEXT DEFAULT 'F',
      usage_type TEXT DEFAULT 'main',
      yield_name TEXT DEFAULT 'تمر',
      unit TEXT DEFAULT 'كجم',
      icon TEXT DEFAULT 'palm',
      notes TEXT,
      sources_json TEXT,
      active INTEGER DEFAULT 1
    );

CREATE TABLE IF NOT EXISTS propagation_source_types (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      notes TEXT,
      default_crop_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (default_crop_id) REFERENCES crops(id)
    );

CREATE TABLE IF NOT EXISTS "crop_varieties" (
      id TEXT PRIMARY KEY,
      crop_id INTEGER NOT NULL REFERENCES crops(id),
      name TEXT NOT NULL,
      usage_desc TEXT,
      UNIQUE(crop_id, name)
    );

CREATE TABLE IF NOT EXISTS crop_planting_sources (
      id TEXT PRIMARY KEY,
      crop_id TEXT NOT NULL,
      name TEXT NOT NULL,
      code_letter TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(crop_id, code_letter),
      UNIQUE(crop_id, name)
    );

CREATE TABLE IF NOT EXISTS "tree_health_statuses" (
      id INTEGER PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      label_ar TEXT NOT NULL,
      label_en TEXT NOT NULL,
      badge_color TEXT NOT NULL,
      badge_bg TEXT NOT NULL,
      requires_alert INTEGER DEFAULT 0
    );

CREATE TABLE IF NOT EXISTS "tree_origin_types" (
      id INTEGER PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      label_ar TEXT NOT NULL,
      label_en TEXT NOT NULL
    );

CREATE TABLE IF NOT EXISTS "yield_quality_grades" (
      id INTEGER PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      label_ar TEXT NOT NULL,
      label_en TEXT NOT NULL,
      badge_color TEXT NOT NULL,
      badge_bg TEXT NOT NULL
    );

CREATE TABLE IF NOT EXISTS operation_approval_statuses (
      id INTEGER PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      label_ar TEXT NOT NULL,
      label_en TEXT NOT NULL,
      badge_color TEXT NOT NULL,
      badge_bg TEXT NOT NULL
    );

CREATE TABLE IF NOT EXISTS operation_sync_statuses (
      id INTEGER PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      label_ar TEXT NOT NULL,
      label_en TEXT NOT NULL,
      badge_color TEXT NOT NULL,
      badge_bg TEXT NOT NULL
    );

CREATE TABLE IF NOT EXISTS "palms" (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      crop_id INTEGER NOT NULL DEFAULT 1 REFERENCES crops(id),
      source_type TEXT NOT NULL REFERENCES propagation_source_types(code),
      variety_id TEXT NOT NULL REFERENCES crop_varieties(id),
      sector_id TEXT NOT NULL,
      plot_id TEXT NOT NULL,
      seq_no TEXT NOT NULL,
      plant_date DATE NOT NULL,
      origin_id INTEGER DEFAULT 1 REFERENCES tree_origin_types(id),
      supplier TEXT,
      parent_palm_id INTEGER REFERENCES "palms"(id),
      temp_code TEXT,
      status_id INTEGER DEFAULT 1 REFERENCES tree_health_statuses(id),
      offshoot_count INTEGER DEFAULT 0,
      lineage_path TEXT,
      gps_lat REAL,
      gps_lng REAL,
      nursery_age_months INTEGER DEFAULT 0,
      is_locked INTEGER DEFAULT 0,
      is_archived INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sector_id) REFERENCES sectors(id),
      FOREIGN KEY (plot_id) REFERENCES plots(id)
    );

CREATE TABLE IF NOT EXISTS operation_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS operation_types (
    id TEXT PRIMARY KEY,
    category_id TEXT,
    name TEXT NOT NULL,
    requires_material INTEGER DEFAULT 0,
    allowed_kinds TEXT,
    crop_id TEXT DEFAULT 'all',
    FOREIGN KEY (category_id) REFERENCES operation_categories(id)
);

CREATE TABLE IF NOT EXISTS "operations" (
      id TEXT PRIMARY KEY,
      palm_id INTEGER REFERENCES palms(id),
      type_id TEXT NOT NULL REFERENCES operation_types(id),
      worker_id TEXT NOT NULL REFERENCES users(id),
      performed_at DATETIME NOT NULL,
      status_id INTEGER DEFAULT 3 REFERENCES operation_sync_statuses(id),
      approval_id INTEGER DEFAULT 1 REFERENCES operation_approval_statuses(id),
      approved_by TEXT REFERENCES users(id),
      supervisor_notes TEXT,
      worker_notes TEXT,
      device_info TEXT,
      gps_lat REAL,
      gps_lng REAL,
      photos TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS fertilizers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    unit TEXT NOT NULL,
    stock REAL DEFAULT 0,
    allocated REAL DEFAULT 0,
    consumed REAL DEFAULT 0,
    min_alert REAL DEFAULT 0,
    unit_cost REAL DEFAULT 0,
    crop_id TEXT DEFAULT 'all',
    active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS fertilizer_vouchers (
    id TEXT PRIMARY KEY,
    voucher_type TEXT NOT NULL,
    fertilizer_id TEXT NOT NULL,
    qty REAL NOT NULL,
    from_entity TEXT,
    to_user_id TEXT,
    sector_id TEXT,
    status TEXT DEFAULT 'pending',
    voucher_date DATE NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (fertilizer_id) REFERENCES fertilizers(id)
);

CREATE TABLE IF NOT EXISTS "offshoots" (
      id TEXT PRIMARY KEY,
      mother_id INTEGER REFERENCES palms(id),
      temp_code TEXT,
      seq_no TEXT,
      separation_date DATE,
      weight_kg REAL,
      diameter_cm REAL,
      variety_id TEXT REFERENCES crop_varieties(id),
      status_id INTEGER DEFAULT 1 REFERENCES tree_health_statuses(id),
      origin_id INTEGER DEFAULT 1 REFERENCES tree_origin_types(id),
      approval_id INTEGER DEFAULT 2 REFERENCES operation_approval_statuses(id),
      supplier TEXT,
      nursery_stage TEXT DEFAULT 'issued',
      planted_palm_id INTEGER REFERENCES palms(id),
      is_opening_stock INTEGER DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS charities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    license_no TEXT,
    city TEXT,
    address TEXT,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    receive_type TEXT DEFAULT 'both',
    bank_name TEXT,
    iban TEXT,
    categories TEXT,
    stamp TEXT,
    is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS "yields" (
      id TEXT PRIMARY KEY,
      batch_no TEXT NOT NULL,
      harvest_level TEXT DEFAULT 'plot',
      palm_id INTEGER REFERENCES palms(id),
      plot_id TEXT NOT NULL,
      sector_id TEXT NOT NULL,
      season TEXT NOT NULL,
      harvest_date DATE NOT NULL,
      crop_id INTEGER NOT NULL DEFAULT 1 REFERENCES crops(id),
      variety_id TEXT NOT NULL REFERENCES crop_varieties(id),
      quality_id INTEGER NOT NULL DEFAULT 1 REFERENCES yield_quality_grades(id),
      kg_total REAL NOT NULL DEFAULT 0,
      kg_excellent REAL NOT NULL DEFAULT 0,
      kg_good REAL NOT NULL DEFAULT 0,
      kg_low REAL NOT NULL DEFAULT 0,
      boxes_count INTEGER DEFAULT 0,
      recorded_by TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (plot_id) REFERENCES plots(id),
      FOREIGN KEY (sector_id) REFERENCES sectors(id),
      FOREIGN KEY (recorded_by) REFERENCES users(id)
    );

CREATE TABLE IF NOT EXISTS "zakat_records" (
      id TEXT PRIMARY KEY,
      investor_id TEXT NOT NULL REFERENCES users(id),
      season TEXT NOT NULL,
      crop_id INTEGER NOT NULL DEFAULT 1 REFERENCES crops(id),
      due_kg REAL DEFAULT 0,
      due_amount REAL DEFAULT 0,
      choice_type TEXT DEFAULT 'in_kind',
      charity_id TEXT REFERENCES charities(id),
      status_id INTEGER DEFAULT 1 REFERENCES operation_approval_statuses(id),
      pledge_status TEXT DEFAULT 'draft',
      pledge_signed_at DATETIME,
      pledge_doc_type TEXT,
      journey_stage TEXT DEFAULT 'pledged',
      batch_id TEXT,
      receipt_no TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    entity_id TEXT,
    details TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS operation_materials (
    id TEXT PRIMARY KEY,
    operation_id TEXT NOT NULL,
    fertilizer_id TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    FOREIGN KEY (operation_id) REFERENCES operations(id) ON DELETE CASCADE,
    FOREIGN KEY (fertilizer_id) REFERENCES fertilizers(id)
);

CREATE TABLE IF NOT EXISTS plot_summaries (
      plot_id TEXT PRIMARY KEY,
      sector_id TEXT NOT NULL,
      total_trees INTEGER DEFAULT 0,
      healthy_trees INTEGER DEFAULT 0,
      infected_trees INTEGER DEFAULT 0,
      under_observation_trees INTEGER DEFAULT 0,
      last_harvest_kg REAL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (plot_id) REFERENCES plots(id) ON DELETE CASCADE
    );

-- =========================================================================
-- 2. فهارس الأداء المليونية عالية السرعة (High Performance RAM Indexes)
-- =========================================================================

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_offshoots_appr ON offshoots(approval_id);
CREATE INDEX IF NOT EXISTS idx_offshoots_approval ON offshoots(approval_id);
CREATE INDEX IF NOT EXISTS idx_offshoots_mother ON offshoots(mother_id);
CREATE INDEX IF NOT EXISTS idx_offshoots_origin_id ON offshoots(origin_id);
CREATE INDEX IF NOT EXISTS idx_offshoots_planted ON offshoots(planted_palm_id);
CREATE INDEX IF NOT EXISTS idx_offshoots_status_id ON offshoots(status_id);
CREATE INDEX IF NOT EXISTS idx_offshoots_variety ON offshoots(variety_id);
CREATE INDEX IF NOT EXISTS idx_offshoots_available ON offshoots(variety_id, nursery_stage) WHERE planted_palm_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_ops_approval ON operations(approval_id);
CREATE INDEX IF NOT EXISTS idx_ops_palm_id ON operations(palm_id);
CREATE INDEX IF NOT EXISTS idx_ops_palm_time ON operations(palm_id, performed_at);
CREATE INDEX IF NOT EXISTS idx_ops_palm_type_date ON operations(palm_id, type_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_status ON operations(status_id);
CREATE INDEX IF NOT EXISTS idx_ops_status_appr ON operations(status_id, approval_id);
CREATE INDEX IF NOT EXISTS idx_ops_worker ON operations(worker_id);
CREATE INDEX IF NOT EXISTS idx_ops_worker_time ON operations(worker_id, performed_at);
CREATE INDEX IF NOT EXISTS idx_palms_code ON palms(code);
CREATE INDEX IF NOT EXISTS idx_palms_crop ON palms(crop_id);
CREATE INDEX IF NOT EXISTS idx_palms_lineage ON palms(lineage_path);
CREATE INDEX IF NOT EXISTS idx_palms_origin_id ON palms(origin_id);
CREATE INDEX IF NOT EXISTS idx_palms_parent ON palms(parent_palm_id);
CREATE INDEX IF NOT EXISTS idx_palms_plot ON palms(plot_id);
CREATE INDEX IF NOT EXISTS idx_palms_plot_status ON palms(plot_id, status_id);
CREATE INDEX IF NOT EXISTS idx_palms_sick ON palms(plot_id, status_id) 
  WHERE status_id != 1 AND (is_deleted = 0 OR is_deleted IS NULL);
CREATE INDEX IF NOT EXISTS idx_palms_source_type ON palms(source_type);
CREATE INDEX IF NOT EXISTS idx_palms_status_id ON palms(status_id);
CREATE INDEX IF NOT EXISTS idx_palms_variety ON palms(variety_id);
CREATE INDEX IF NOT EXISTS idx_plots_sector ON plots(sector_id);
CREATE INDEX IF NOT EXISTS idx_user_plots_plot ON user_plots(plot_id);
CREATE INDEX IF NOT EXISTS idx_user_plots_user ON user_plots(user_id);
CREATE INDEX IF NOT EXISTS idx_yields_batch ON yields(batch_no);
CREATE INDEX IF NOT EXISTS idx_yields_crop ON yields(crop_id);
CREATE INDEX IF NOT EXISTS idx_yields_date ON yields(harvest_date);
CREATE INDEX IF NOT EXISTS idx_yields_palm ON yields(palm_id);
CREATE INDEX IF NOT EXISTS idx_yields_plot_season ON yields(plot_id, season);
CREATE INDEX IF NOT EXISTS idx_yields_quality_id ON yields(quality_id);
CREATE INDEX IF NOT EXISTS idx_yields_variety ON yields(variety_id);
CREATE INDEX IF NOT EXISTS idx_zakat_crop ON zakat_records(crop_id);
CREATE INDEX IF NOT EXISTS idx_zakat_investor ON zakat_records(investor_id);

-- =========================================================================
-- 3. العروض التجميعية اللحظية (Zero-Cost Dynamic JOIN Views)
-- =========================================================================

-- ==============================================================================
-- 9. المواسم الزراعية وأرصدة الأسمدة والمخزون المرحل (Agricultural Seasons ERP)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS agricultural_seasons (
  season_year INTEGER PRIMARY KEY,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- 'open' أو 'closed'
  notes TEXT,
  is_current INTEGER NOT NULL DEFAULT 0,
  closed_at TEXT,
  closed_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fertilizer_season_balances (
  id TEXT PRIMARY KEY,
  season_year INTEGER NOT NULL,
  fertilizer_id TEXT NOT NULL,
  opening_stock REAL NOT NULL DEFAULT 0,
  purchased_stock REAL NOT NULL DEFAULT 0,
  consumed_stock REAL NOT NULL DEFAULT 0,
  closing_stock REAL NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (season_year) REFERENCES agricultural_seasons(season_year),
  FOREIGN KEY (fertilizer_id) REFERENCES fertilizers(id)
);

-- ==============================================================================
-- 10. الرؤى القياسية الموحدة لقاعدة البيانات (Clean Relational Views - No Duplicate Columns)
-- ==============================================================================

CREATE VIEW IF NOT EXISTS v_palms AS
  SELECT 
    p.id,
    p.code,
    p.crop_id,
    c.code AS crop_code,
    c.name AS crop_name,
    c.single_label AS crop_single,
    c.plural_label AS crop_plural,
    c.offspring_label AS crop_offspring,
    p.source_type,
    pst.name AS source_name,
    pst.notes AS source_notes,
    p.variety_id,
    cv.name AS variety_name,
    p.sector_id,
    s.name AS sector_name,
    p.plot_id,
    pl.name AS plot_name,
    p.seq_no,
    p.plant_date,
    p.origin_id,
    tot.code AS origin_type,
    tot.label_ar AS origin_label,
    tot.label_en AS origin_label_en,
    p.supplier,
    p.notes,
    p.parent_palm_id,
    pp.code AS parent_palm_code,
    p.temp_code,
    p.status_id,
    ths.code AS status_code,
    ths.label_ar AS status,
    ths.label_en AS status_en,
    ths.badge_color,
    ths.badge_bg,
    p.offshoot_count,
    p.lineage_path,
    p.gps_lat,
    p.gps_lng,
    p.nursery_age_months,
    p.is_locked,
    p.is_archived,
    p.is_deleted,
    p.created_at
  FROM palms p
  LEFT JOIN crops c ON p.crop_id = c.id
  LEFT JOIN propagation_source_types pst ON p.source_type = pst.code
  LEFT JOIN crop_varieties cv ON p.variety_id = cv.id
  LEFT JOIN sectors s ON p.sector_id = s.id
  LEFT JOIN plots pl ON p.plot_id = pl.id
  LEFT JOIN tree_health_statuses ths ON p.status_id = ths.id
  LEFT JOIN tree_origin_types tot ON p.origin_id = tot.id
  LEFT JOIN palms pp ON p.parent_palm_id = pp.id;

CREATE VIEW IF NOT EXISTS v_operations AS
  SELECT 
    o.id,
    o.palm_id,
    p.code AS palm_code,
    o.type_id,
    ot.name AS type_name,
    o.worker_id,
    u.full_name AS worker_name,
    o.performed_at,
    o.status_id,
    ss.code AS status_code,
    ss.label_ar AS status_label,
    ss.badge_color AS status_badge_color,
    o.approval_id,
    aps.code AS approval_status,
    aps.label_ar AS approval_label,
    aps.badge_color AS approval_badge_color,
    aps.badge_bg AS approval_badge_bg,
    o.approved_by,
    o.supervisor_notes,
    o.worker_notes,
    o.device_info,
    o.gps_lat,
    o.gps_lng,
    o.photos,
    o.created_at,
    o.batch_id,
    o.target_level,
    o.sector_id,
    o.plot_id,
    o.tree_count
  FROM operations o
  LEFT JOIN palms p ON o.palm_id = p.id
  LEFT JOIN operation_types ot ON o.type_id = ot.id
  LEFT JOIN users u ON o.worker_id = u.id
  LEFT JOIN operation_sync_statuses ss ON o.status_id = ss.id
  LEFT JOIN operation_approval_statuses aps ON o.approval_id = aps.id;

CREATE VIEW IF NOT EXISTS v_offshoots AS
  SELECT 
    o.id,
    o.mother_id,
    m.code AS mother_code,
    o.temp_code,
    o.seq_no,
    o.separation_date,
    o.weight_kg,
    o.diameter_cm,
    o.status_id,
    ths.code AS status_code,
    ths.label_ar AS health_status,
    ths.badge_color AS health_badge_color,
    o.variety_id,
    cv.name AS variety_name,
    o.origin_id,
    tot.code AS origin_type,
    tot.label_ar AS origin_label,
    o.approval_id,
    aps.code AS approval_status,
    aps.label_ar AS approval_label,
    aps.badge_color AS approval_badge_color,
    o.supplier,
    o.nursery_stage,
    o.planted_palm_id,
    plp.code AS planted_palm_code,
    o.is_opening_stock,
    o.notes,
    o.created_at
  FROM offshoots o
  LEFT JOIN palms m ON o.mother_id = m.id
  LEFT JOIN palms plp ON o.planted_palm_id = plp.id
  LEFT JOIN crop_varieties cv ON o.variety_id = cv.id
  LEFT JOIN tree_health_statuses ths ON o.status_id = ths.id
  LEFT JOIN tree_origin_types tot ON o.origin_id = tot.id
  LEFT JOIN operation_approval_statuses aps ON o.approval_id = aps.id;

CREATE VIEW IF NOT EXISTS v_yields AS
  SELECT 
    y.id,
    y.batch_no,
    y.harvest_level,
    y.palm_id,
    p.code AS palm_code,
    y.plot_id,
    pl.name AS plot_name,
    y.sector_id,
    s.name AS sector_name,
    y.season,
    y.harvest_date,
    y.crop_id,
    c.code AS crop_code,
    c.name AS crop_name,
    y.variety_id,
    cv.name AS variety_name,
    y.quality_id,
    qg.code AS quality_code,
    qg.label_ar AS quality_grade,
    qg.badge_color AS quality_badge_color,
    y.kg_total,
    y.kg_excellent,
    y.kg_good,
    y.kg_low,
    y.boxes_count,
    y.recorded_by,
    u.full_name AS recorded_by_name,
    y.notes,
    y.created_at
  FROM yields y
  LEFT JOIN palms p ON y.palm_id = p.id
  LEFT JOIN plots pl ON y.plot_id = pl.id
  LEFT JOIN sectors s ON y.sector_id = s.id
  LEFT JOIN crops c ON y.crop_id = c.id
  LEFT JOIN crop_varieties cv ON y.variety_id = cv.id
  LEFT JOIN yield_quality_grades qg ON y.quality_id = qg.id
  LEFT JOIN users u ON y.recorded_by = u.id;


