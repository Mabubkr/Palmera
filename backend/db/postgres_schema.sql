-- =========================================================================
-- PalmTrace Enterprise PostgreSQL Production Cloud Schema
-- Target: 5,000,000+ Assets & 100,000,000 - 250,000,000+ Operations
-- Multi-Tenant SaaS Architecture with Declarative Range Partitioning & RLS
-- =========================================================================

-- Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- Trigram GIN indexes for fuzzy text search
CREATE EXTENSION IF NOT EXISTS "postgis";       -- Spatial GIS coordinates and polygons
CREATE EXTENSION IF NOT EXISTS "btree_gist";    -- Multi-column exclusion constraints

-- =========================================================================
-- 1. جداول التعدد المؤسسي والتراخيص (Multi-Tenancy Core: Companies & Projects)
-- =========================================================================

CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    tax_number VARCHAR(50),
    commercial_registry VARCHAR(50),
    subscription_plan VARCHAR(50) DEFAULT 'enterprise',  -- starter, silver, gold, enterprise
    max_trees_limit BIGINT DEFAULT 5000000,
    max_projects_limit INT DEFAULT 50,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code_prefix VARCHAR(20) NOT NULL,
    location_name VARCHAR(255),
    area_feddan NUMERIC(12, 2) DEFAULT 0,
    timezone VARCHAR(50) DEFAULT 'Africa/Cairo',
    currency_code VARCHAR(10) DEFAULT 'EGP',
    boundary_geom GEOMETRY(Polygon, 4326),               -- الحدود الجغرافية للمشروع (PostGIS)
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_project_code_company UNIQUE (company_id, code_prefix)
);

CREATE INDEX idx_projects_company ON projects(company_id);

-- =========================================================================
-- 2. إدارة المستخدمين وتعيين الصلاحيات متعددة المشروعات
-- =========================================================================

CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,                 -- bcrypt cryptographic hash ($2b$10$...)
    full_name VARCHAR(255) NOT NULL,
    primary_phone VARCHAR(50),
    email VARCHAR(255),
    is_superadmin BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ربط المستخدم بالمشروع والشركة مع دور محدد لكل مشروع
CREATE TABLE user_project_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE, -- NULL = Platform Super Admin لكامل المنصة
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,  -- NULL = Company Admin لكافة مشروعات الشركة
    role_name VARCHAR(50) NOT NULL,                            -- super_admin, company_admin, engineer, warehouse_mgr, worker, investor
    permissions_matrix JSONB DEFAULT '{}'::jsonb,              -- مصفوفة صلاحيات تفصيلية مرنة
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_comp_proj UNIQUE (user_id, company_id, project_id)
);

CREATE INDEX idx_user_access_lookup ON user_project_access(user_id, project_id);
CREATE INDEX idx_user_access_company ON user_project_access(company_id);

-- =========================================================================
-- 3. جداول البحث المرجعية الرقمية (Lookup Reference Tables)
-- =========================================================================

CREATE TABLE crops (
    id SMALLINT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    single_label VARCHAR(50) NOT NULL,
    plural_label VARCHAR(50) NOT NULL,
    offspring_label VARCHAR(50) NOT NULL,
    code_prefix VARCHAR(10) NOT NULL,
    primary_source_code VARCHAR(10) DEFAULT 'F',
    usage_type VARCHAR(50) DEFAULT 'main',
    yield_name VARCHAR(50) DEFAULT 'تمر',
    unit VARCHAR(20) DEFAULT 'كجم',
    icon VARCHAR(50) DEFAULT 'palm',
    notes TEXT,
    sources_json JSONB,
    active BOOLEAN DEFAULT TRUE
);

CREATE TABLE crop_varieties (
    id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    crop_id SMALLINT NOT NULL REFERENCES crops(id),
    code VARCHAR(50),
    name VARCHAR(100) NOT NULL,
    usage_desc TEXT,
    CONSTRAINT uq_crop_variety_name UNIQUE(crop_id, name)
);

CREATE INDEX idx_crop_varieties_crop ON crop_varieties(crop_id);

CREATE TABLE propagation_source_types (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    notes TEXT,
    default_crop_id SMALLINT REFERENCES crops(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tree_health_statuses (
    id SMALLINT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    label_ar VARCHAR(100) NOT NULL,
    label_en VARCHAR(100) NOT NULL,
    badge_color VARCHAR(30) NOT NULL,
    badge_bg VARCHAR(30) NOT NULL,
    requires_alert BOOLEAN DEFAULT FALSE
);

CREATE TABLE tree_origin_types (
    id SMALLINT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    label_ar VARCHAR(100) NOT NULL,
    label_en VARCHAR(100) NOT NULL
);

CREATE TABLE yield_quality_grades (
    id SMALLINT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    label_ar VARCHAR(100) NOT NULL,
    label_en VARCHAR(100) NOT NULL,
    badge_color VARCHAR(30) NOT NULL,
    badge_bg VARCHAR(30) NOT NULL
);

CREATE TABLE operation_approval_statuses (
    id SMALLINT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    label_ar VARCHAR(100) NOT NULL,
    label_en VARCHAR(100) NOT NULL,
    badge_color VARCHAR(30) NOT NULL,
    badge_bg VARCHAR(30) NOT NULL
);

CREATE TABLE operation_sync_statuses (
    id SMALLINT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    label_ar VARCHAR(100) NOT NULL,
    label_en VARCHAR(100) NOT NULL,
    badge_color VARCHAR(30) NOT NULL,
    badge_bg VARCHAR(30) NOT NULL
);

-- =========================================================================
-- 4. الهيكل المكاني: القطاعات والقطع (Sectors & Plots Scoped by Project)
-- =========================================================================

CREATE TABLE sectors (
    id TEXT NOT NULL,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    notes TEXT,
    boundary_geom GEOMETRY(Polygon, 4326),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, project_id)
);

CREATE INDEX idx_sectors_project ON sectors(project_id);

CREATE TABLE plots (
    id TEXT NOT NULL,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    sector_id TEXT NOT NULL,
    plot_no VARCHAR(50) NOT NULL,
    part_letter VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    boundary_geom GEOMETRY(Polygon, 4326),
    PRIMARY KEY (id, project_id),
    CONSTRAINT fk_plots_sector FOREIGN KEY (sector_id, project_id) REFERENCES sectors(id, project_id) ON DELETE CASCADE,
    CONSTRAINT uq_plots_sector_plot_part UNIQUE (project_id, sector_id, plot_no, part_letter)
);

CREATE INDEX idx_plots_sector_proj ON plots(project_id, sector_id);

-- صلاحيات ومسؤوليات المهندسين والعمال على القطع الميدانية (User Plots)
CREATE TABLE user_plots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    plot_id TEXT NOT NULL,
    permission_type VARCHAR(50) DEFAULT 'work',                 -- engineer, work, supervisor, investor_view
    assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_proj_plot UNIQUE (user_id, project_id, plot_id),
    CONSTRAINT fk_user_plot_target FOREIGN KEY (plot_id, project_id) REFERENCES plots(id, project_id) ON DELETE CASCADE
);

CREATE INDEX idx_user_plots_user ON user_plots(user_id);
CREATE INDEX idx_user_plots_proj ON user_plots(project_id);

-- =========================================================================
-- 5. جدول الأشجار والأصول المليوني (Palms & Trees: BIGINT Primary Key)
-- =========================================================================

CREATE TABLE palms (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    code VARCHAR(100) NOT NULL,
    crop_id SMALLINT NOT NULL DEFAULT 1 REFERENCES crops(id),
    source_type VARCHAR(10) NOT NULL REFERENCES propagation_source_types(code),
    variety_id INTEGER NOT NULL REFERENCES crop_varieties(id),
    sector_id TEXT NOT NULL,
    plot_id TEXT NOT NULL,
    seq_no VARCHAR(50) NOT NULL,
    plant_date DATE NOT NULL,
    origin_id SMALLINT DEFAULT 1 REFERENCES tree_origin_types(id),
    supplier VARCHAR(255),
    parent_palm_id BIGINT REFERENCES palms(id),
    temp_code VARCHAR(100),
    status_id SMALLINT DEFAULT 1 REFERENCES tree_health_statuses(id),
    offshoot_count INT DEFAULT 0,
    lineage_path TEXT,
    gps_lat DOUBLE PRECISION,
    gps_lng DOUBLE PRECISION,
    location_point GEOMETRY(Point, 4326),              -- نقطة الإحداثيات الميدانية PostGIS
    nursery_age_months INT DEFAULT 0,
    is_locked BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_palms_plot FOREIGN KEY (plot_id, project_id) REFERENCES plots(id, project_id),
    CONSTRAINT uq_palms_code_project UNIQUE (project_id, code)
);

-- فهارس شجرة الأصول (B-Tree & Trigram GIN Index)
CREATE INDEX idx_palms_project_plot ON palms(project_id, plot_id);
CREATE INDEX idx_palms_crop ON palms(crop_id);
CREATE INDEX idx_palms_variety ON palms(variety_id);
CREATE INDEX idx_palms_status ON palms(status_id);
CREATE INDEX idx_palms_parent ON palms(parent_palm_id);

-- فهرس ثلاثي الأحرف فائق السرعة للبحث بجزء من الكود في 5 مليون صف
CREATE INDEX idx_palms_code_trgm ON palms USING gin (code gin_trgm_ops);

-- فهرس مكاني للأصول (Spatial GIS Index)
CREATE INDEX idx_palms_location_gist ON palms USING gist (location_point);

-- =========================================================================
-- 6. جدول العمليات المليوني المقسم زمنياً (Partitioned Operations Table)
-- يدعم 100 إلى 250 مليون عملية حقلية مع استبعاد الأقسام الفوري (Partition Pruning)
-- =========================================================================

CREATE TABLE operation_categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE operation_types (
    id VARCHAR(50) PRIMARY KEY,
    category_id VARCHAR(50) NOT NULL REFERENCES operation_categories(id),
    name VARCHAR(100) NOT NULL,
    requires_material BOOLEAN DEFAULT FALSE,
    allowed_kinds TEXT,
    crop_id SMALLINT REFERENCES crops(id)
);

-- جدول العمليات الرئيسي المقسم بحسب تاريخ التنفيذ
CREATE TABLE operations (
    id TEXT NOT NULL,                                  -- RFC 9562 UUIDv7
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    palm_id BIGINT NOT NULL,
    type_id VARCHAR(50) NOT NULL REFERENCES operation_types(id),
    worker_id TEXT NOT NULL REFERENCES users(id),
    performed_at TIMESTAMPTZ NOT NULL,
    status_id SMALLINT DEFAULT 3 REFERENCES operation_sync_statuses(id),
    approval_id SMALLINT DEFAULT 1 REFERENCES operation_approval_statuses(id),
    approved_by TEXT REFERENCES users(id),
    supervisor_notes TEXT,
    worker_notes TEXT,
    device_info TEXT,
    gps_lat DOUBLE PRECISION,
    gps_lng DOUBLE PRECISION,
    photos JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, performed_at)
) PARTITION BY RANGE (performed_at);

-- إنشاء أقسام جدول العمليات زمنياً (يمكن أتمتتها بالكامل عبر pg_partman)
CREATE TABLE operations_y2025 PARTITION OF operations
    FOR VALUES FROM ('2025-01-01 00:00:00+00') TO ('2026-01-01 00:00:00+00');

CREATE TABLE operations_y2026 PARTITION OF operations
    FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');

CREATE TABLE operations_y2027 PARTITION OF operations
    FOR VALUES FROM ('2027-01-01 00:00:00+00') TO ('2028-01-01 00:00:00+00');

CREATE TABLE operations_default PARTITION OF operations DEFAULT;

-- فهارس أقسام العمليات
CREATE INDEX idx_ops_proj_time ON operations(project_id, performed_at DESC);
CREATE INDEX idx_ops_worker_time ON operations(worker_id, performed_at DESC);
CREATE INDEX idx_ops_palm_time ON operations(palm_id, performed_at DESC);
CREATE INDEX idx_ops_status_appr ON operations(status_id, approval_id);

-- مواد ومستهلكات العمليات
CREATE TABLE operation_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_id TEXT NOT NULL,
    performed_at TIMESTAMPTZ NOT NULL,
    fertilizer_id TEXT NOT NULL,
    quantity NUMERIC(12, 3) NOT NULL,
    unit VARCHAR(20) NOT NULL
);

-- =========================================================================
-- 7. الفسائل والمشتل (Offshoots Scoped by Project)
-- =========================================================================

CREATE TABLE offshoots (
    id TEXT PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    mother_id BIGINT REFERENCES palms(id),
    temp_code VARCHAR(100) NOT NULL,
    seq_no VARCHAR(50) NOT NULL,
    separation_date DATE NOT NULL,
    weight_kg NUMERIC(8, 2),
    diameter_cm NUMERIC(8, 2),
    variety_id INTEGER NOT NULL REFERENCES crop_varieties(id),
    status_id SMALLINT DEFAULT 1 REFERENCES tree_health_statuses(id),
    origin_id SMALLINT DEFAULT 1 REFERENCES tree_origin_types(id),
    approval_id SMALLINT DEFAULT 2 REFERENCES operation_approval_statuses(id),
    supplier VARCHAR(255),
    nursery_stage VARCHAR(50) DEFAULT 'issued',
    planted_palm_id BIGINT REFERENCES palms(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_offshoot_code_project UNIQUE (project_id, temp_code)
);

CREATE INDEX idx_offshoots_project ON offshoots(project_id);
CREATE INDEX idx_offshoots_mother ON offshoots(mother_id);
CREATE INDEX idx_offshoots_variety ON offshoots(variety_id);
CREATE INDEX idx_offshoots_status ON offshoots(status_id);

-- =========================================================================
-- 8. المخزون والأسمدة (Fertilizers & Vouchers)
-- =========================================================================

CREATE TABLE fertilizers (
    id TEXT NOT NULL,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    kind VARCHAR(50) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    stock NUMERIC(12, 3) DEFAULT 0,
    allocated NUMERIC(12, 3) DEFAULT 0,
    consumed NUMERIC(12, 3) DEFAULT 0,
    min_alert NUMERIC(12, 3) DEFAULT 0,
    unit_cost NUMERIC(12, 2) DEFAULT 0,
    crop_id SMALLINT DEFAULT 1 REFERENCES crops(id),
    active BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (id, project_id)
);

CREATE INDEX idx_fertilizers_project ON fertilizers(project_id);

CREATE TABLE fertilizer_vouchers (
    id TEXT PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    voucher_type VARCHAR(50) NOT NULL,
    fertilizer_id TEXT NOT NULL,
    qty NUMERIC(12, 3) NOT NULL,
    from_entity VARCHAR(255),
    to_user_id TEXT REFERENCES users(id),
    sector_id TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    voucher_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vouchers_project ON fertilizer_vouchers(project_id);

-- =========================================================================
-- 9. الحصاد والإنتاج (Yields Scoped by Project)
-- =========================================================================

CREATE TABLE yields (
    id TEXT PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    batch_no VARCHAR(100) NOT NULL,
    harvest_level VARCHAR(50) NOT NULL DEFAULT 'plot',
    palm_id BIGINT REFERENCES palms(id),
    plot_id TEXT NOT NULL,
    sector_id TEXT NOT NULL,
    season VARCHAR(20) NOT NULL,
    harvest_date DATE NOT NULL,
    crop_id SMALLINT NOT NULL DEFAULT 1 REFERENCES crops(id),
    variety_id INTEGER REFERENCES crop_varieties(id),
    quality_id SMALLINT DEFAULT 1 REFERENCES yield_quality_grades(id),
    kg_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    kg_excellent NUMERIC(12, 2) DEFAULT 0,
    kg_good NUMERIC(12, 2) DEFAULT 0,
    kg_low NUMERIC(12, 2) DEFAULT 0,
    boxes_count INT DEFAULT 0,
    recorded_by TEXT NOT NULL REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_yield_batch_project UNIQUE (project_id, batch_no)
);

CREATE INDEX idx_yields_project_season ON yields(project_id, season);
CREATE INDEX idx_yields_plot ON yields(project_id, plot_id);

-- =========================================================================
-- 10. تفعيل عزل المستأجرين بالأمان على مستوى الصفوف (Row-Level Security - RLS)
-- =========================================================================

ALTER TABLE sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE plots ENABLE ROW LEVEL SECURITY;
ALTER TABLE palms ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE offshoots ENABLE ROW LEVEL SECURITY;
ALTER TABLE fertilizers ENABLE ROW LEVEL SECURITY;
ALTER TABLE fertilizer_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE yields ENABLE ROW LEVEL SECURITY;

-- سياسة الوصول بحسب سياق المشروع النشط للمستخدم (app.current_project_id)
CREATE POLICY project_isolation_sectors ON sectors
    FOR ALL USING (project_id = NULLIF(current_setting('app.current_project_id', true), '')::uuid);

CREATE POLICY project_isolation_plots ON plots
    FOR ALL USING (project_id = NULLIF(current_setting('app.current_project_id', true), '')::uuid);

CREATE POLICY project_isolation_palms ON palms
    FOR ALL USING (project_id = NULLIF(current_setting('app.current_project_id', true), '')::uuid);

CREATE POLICY project_isolation_operations ON operations
    FOR ALL USING (project_id = NULLIF(current_setting('app.current_project_id', true), '')::uuid);

CREATE POLICY project_isolation_offshoots ON offshoots
    FOR ALL USING (project_id = NULLIF(current_setting('app.current_project_id', true), '')::uuid);

CREATE POLICY project_isolation_fertilizers ON fertilizers
    FOR ALL USING (project_id = NULLIF(current_setting('app.current_project_id', true), '')::uuid);

CREATE POLICY project_isolation_yields ON yields
    FOR ALL USING (project_id = NULLIF(current_setting('app.current_project_id', true), '')::uuid);
