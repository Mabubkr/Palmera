const db = require('../db');
const { uuidv7 } = require('../uuidv7');

function runMigration() {
  console.log('--- Starting PalmTrace Enterprise Schema Migration ---');

  // 1. Ensure Enterprise Numeric Lookup Tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS tree_health_statuses (
      id INTEGER PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      label_ar TEXT NOT NULL,
      label_en TEXT NOT NULL,
      badge_color TEXT NOT NULL,
      badge_bg TEXT NOT NULL,
      requires_alert INTEGER DEFAULT 0
    );
  `);
  const insHealth = db.db.prepare(`INSERT OR REPLACE INTO tree_health_statuses (id, code, label_ar, label_en, badge_color, badge_bg, requires_alert) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  insHealth.run(1, 'healthy', 'سليمة', 'Healthy', '#16A34A', '#DCFCE7', 0);
  insHealth.run(2, 'observation', 'تحت المراقبة', 'Under Observation', '#D97706', '#FEF3C7', 1);
  insHealth.run(3, 'infected', 'مصابة', 'Infected', '#DC2626', '#FEE2E2', 1);
  insHealth.run(4, 'uprooted', 'مقلوعة', 'Uprooted', '#64748B', '#F1F5F9', 0);
  insHealth.run(5, 'dead', 'ميتة', 'Dead', '#0F172A', '#E2E8F0', 0);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tree_origin_types (
      id INTEGER PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      label_ar TEXT NOT NULL,
      label_en TEXT NOT NULL
    );
  `);
  const insOrigin = db.db.prepare(`INSERT OR REPLACE INTO tree_origin_types (id, code, label_ar, label_en) VALUES (?, ?, ?, ?)`);
  insOrigin.run(1, 'internal', 'داخلي / ترقيد بالمزرعة', 'Internal Farm');
  insOrigin.run(2, 'purchased', 'شراء خارجي', 'Purchased External');
  insOrigin.run(3, 'tissue_culture', 'زراعة أنسجة', 'Tissue Culture');
  insOrigin.run(4, 'offshoot', 'فسيلة أرضية/هوائية', 'Offshoot');

  db.exec(`
    CREATE TABLE IF NOT EXISTS yield_quality_grades (
      id INTEGER PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      label_ar TEXT NOT NULL,
      label_en TEXT NOT NULL,
      badge_color TEXT NOT NULL,
      badge_bg TEXT NOT NULL
    );
  `);
  const insQuality = db.db.prepare(`INSERT OR REPLACE INTO yield_quality_grades (id, code, label_ar, label_en, badge_color, badge_bg) VALUES (?, ?, ?, ?, ?, ?)`);
  insQuality.run(1, 'grade_a', 'ممتاز / نخب أول', 'Grade A / Premium', '#16A34A', '#DCFCE7');
  insQuality.run(2, 'grade_b', 'جيد / نخب ثانٍ', 'Grade B', '#2563EB', '#DBEAFE');
  insQuality.run(3, 'grade_c', 'تالف / فرز', 'Cull / Low Grade', '#D97706', '#FEF3C7');

  db.exec(`
    CREATE TABLE IF NOT EXISTS operation_approval_statuses (
      id INTEGER PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      label_ar TEXT NOT NULL,
      label_en TEXT NOT NULL,
      badge_color TEXT NOT NULL,
      badge_bg TEXT NOT NULL
    );
  `);
  const insAppr = db.db.prepare(`INSERT OR REPLACE INTO operation_approval_statuses (id, code, label_ar, label_en, badge_color, badge_bg) VALUES (?, ?, ?, ?, ?, ?)`);
  insAppr.run(1, 'pending', 'قيد الاعتماد', 'Pending Review', '#D97706', '#FEF3C7');
  insAppr.run(2, 'approved', 'معتمد', 'Approved', '#16A34A', '#DCFCE7');
  insAppr.run(3, 'rejected', 'مرفوض', 'Rejected', '#DC2626', '#FEE2E2');

  db.exec(`
    CREATE TABLE IF NOT EXISTS operation_sync_statuses (
      id INTEGER PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      label_ar TEXT NOT NULL,
      label_en TEXT NOT NULL,
      badge_color TEXT NOT NULL,
      badge_bg TEXT NOT NULL
    );
  `);
  const insSync = db.db.prepare(`INSERT OR REPLACE INTO operation_sync_statuses (id, code, label_ar, label_en, badge_color, badge_bg) VALUES (?, ?, ?, ?, ?, ?)`);
  insSync.run(1, 'draft', 'مسودة محلية', 'Draft', '#64748B', '#F1F5F9');
  insSync.run(2, 'pending_sync', 'قيد المزامنة', 'Pending Sync', '#D97706', '#FEF3C7');
  insSync.run(3, 'synced', 'تمت المزامنة', 'Synced', '#16A34A', '#DCFCE7');

  db.exec(`
    CREATE TABLE IF NOT EXISTS propagation_source_types (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      notes TEXT,
      default_crop_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (default_crop_id) REFERENCES crops(id)
    );
  `);
  const insPst = db.db.prepare(`INSERT OR REPLACE INTO propagation_source_types (id, code, name, notes, default_crop_id) VALUES (?, ?, ?, ?, ?)`);
  insPst.run('pst_f', 'F', 'فسيلة', 'خلفة أرضية مأخوذة من النخلة الأم', 1);
  insPst.run('pst_n', 'N', 'زراعة أنسجة (نخيل)', 'نخيل نسيجي منتج مخبرياً', 1);
  insPst.run('pst_c', 'C', 'عقلة خضرية', 'عقل ساقية غضة أو نصف خشبية مجذرة', 2);
  insPst.run('pst_s', 'S', 'شتلة مطعومة', 'شتلة مركبة على أصل بري مقاوم', 2);
  insPst.run('pst_t', 'T', 'زراعة أنسجة (أشجار)', 'شتلات نسيجية مخبرية للأشجار', 2);
  insPst.run('pst_b', 'B', 'شتلة بذرية', 'شتلة منتجة من إنبات البذور مباشرة', null);
  insPst.run('pst_l', 'L', 'ترقيد هوائي', 'إكثار خضري بتجذير الأغصان الهوائية', null);

  // Check if crops table is already integer
  const cropIdType = db.all("PRAGMA table_info(crops)").find(c => c.name === 'id')?.type;
  const palmIdType = db.all("PRAGMA table_info(palms)").find(c => c.name === 'id')?.type;

  if (cropIdType !== 'INTEGER' || palmIdType !== 'INTEGER') {
    console.log('Migrating legacy text primary keys to Enterprise numeric schema...');
    // Run full numeric normalization
    require('./migrate_enterprise_full_numeric');
  } else {
    console.log('✓ Tables already normalized to Enterprise numeric schema.');
  }

  // Ensure Audit Columns on Core Tables
  const addColIfMissing = (table, col, def) => {
    try {
      const cols = db.all(`PRAGMA table_info(${table})`).map(c => c.name);
      if (!cols.includes(col)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def};`);
      }
    } catch (e) {}
  };
  ['palms', 'operations', 'yields', 'plots'].forEach(tbl => {
    addColIfMissing(tbl, 'created_by', 'TEXT');
    addColIfMissing(tbl, 'modified_by', 'TEXT');
    addColIfMissing(tbl, 'modified_at', 'DATETIME');
  });

  // Refresh Views & High-Performance Indexes
  db.exec(`
    DROP VIEW IF EXISTS v_palms;
    DROP VIEW IF EXISTS v_operations;
    DROP VIEW IF EXISTS v_offshoots;
    DROP VIEW IF EXISTS v_yields;
  `);

  db.exec(`
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
      p.created_by,
      p.created_at,
      p.modified_by,
      p.modified_at
    FROM palms p
    LEFT JOIN crops c ON p.crop_id = c.id
    LEFT JOIN propagation_source_types pst ON p.source_type = pst.code
    LEFT JOIN crop_varieties cv ON p.variety_id = cv.id
    LEFT JOIN sectors s ON p.sector_id = s.id
    LEFT JOIN plots pl ON p.plot_id = pl.id
    LEFT JOIN tree_health_statuses ths ON p.status_id = ths.id
    LEFT JOIN tree_origin_types tot ON p.origin_id = tot.id
    LEFT JOIN palms pp ON p.parent_palm_id = pp.id;
  `);

  db.exec(`
    CREATE VIEW IF NOT EXISTS v_operations AS
    SELECT 
      o.id,
      o.palm_id,
      COALESCE(p.code, 'حزمة جماعية') AS palm_code,
      o.type_id,
      ot.name AS type_name,
      ot.scope_type,
      ot.is_critical,
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
      o.batch_id,
      o.target_level,
      o.sector_id,
      o.plot_id,
      o.tree_count,
      sec.name AS sector_name,
      pl.name AS plot_name,
      o.created_by,
      o.created_at,
      o.modified_by,
      o.modified_at
    FROM operations o
    LEFT JOIN palms p ON o.palm_id = p.id
    LEFT JOIN operation_types ot ON o.type_id = ot.id
    LEFT JOIN users u ON o.worker_id = u.id
    LEFT JOIN operation_sync_statuses ss ON o.status_id = ss.id
    LEFT JOIN operation_approval_statuses aps ON o.approval_id = aps.id
    LEFT JOIN sectors sec ON o.sector_id = sec.id
    LEFT JOIN plots pl ON o.plot_id = pl.id;
  `);

  db.exec(`
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
      o.is_opening_stock,
      o.planted_palm_id,
      plp.code AS planted_palm_code,
      o.notes,
      o.created_at
    FROM offshoots o
    LEFT JOIN palms m ON o.mother_id = m.id
    LEFT JOIN palms plp ON o.planted_palm_id = plp.id
    LEFT JOIN crop_varieties cv ON o.variety_id = cv.id
    LEFT JOIN tree_health_statuses ths ON o.status_id = ths.id
    LEFT JOIN tree_origin_types tot ON o.origin_id = tot.id
    LEFT JOIN operation_approval_statuses aps ON o.approval_id = aps.id;
  `);

  db.exec(`
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
      y.created_by,
      y.created_at,
      y.modified_by,
      y.modified_at
    FROM yields y
    LEFT JOIN palms p ON y.palm_id = p.id
    LEFT JOIN plots pl ON y.plot_id = pl.id
    LEFT JOIN sectors s ON y.sector_id = s.id
    LEFT JOIN crops c ON y.crop_id = c.id
    LEFT JOIN crop_varieties cv ON y.variety_id = cv.id
    LEFT JOIN yield_quality_grades qg ON y.quality_id = qg.id
    LEFT JOIN users u ON y.recorded_by = u.id;
  `);

  // High Performance Indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_palms_crop ON palms(crop_id);
    CREATE INDEX IF NOT EXISTS idx_palms_source_type ON palms(source_type);
    CREATE INDEX IF NOT EXISTS idx_palms_status_id ON palms(status_id);
    CREATE INDEX IF NOT EXISTS idx_palms_origin_id ON palms(origin_id);
    CREATE INDEX IF NOT EXISTS idx_palms_variety ON palms(variety_id);
    CREATE INDEX IF NOT EXISTS idx_palms_code ON palms(code);
    CREATE INDEX IF NOT EXISTS idx_palms_plot_status ON palms(plot_id, status_id);
    CREATE INDEX IF NOT EXISTS idx_palms_parent ON palms(parent_palm_id);

    CREATE INDEX IF NOT EXISTS idx_ops_palm_id ON operations(palm_id);
    CREATE INDEX IF NOT EXISTS idx_ops_worker_time ON operations(worker_id, performed_at);
    CREATE INDEX IF NOT EXISTS idx_ops_palm_time ON operations(palm_id, performed_at);
    CREATE INDEX IF NOT EXISTS idx_ops_status_appr ON operations(status_id, approval_id);

    CREATE INDEX IF NOT EXISTS idx_offshoots_mother ON offshoots(mother_id);
    CREATE INDEX IF NOT EXISTS idx_offshoots_planted ON offshoots(planted_palm_id);
    CREATE INDEX IF NOT EXISTS idx_offshoots_appr ON offshoots(approval_id);

    CREATE INDEX IF NOT EXISTS idx_yields_crop ON yields(crop_id);
    CREATE INDEX IF NOT EXISTS idx_yields_plot_season ON yields(plot_id, season);
    CREATE INDEX IF NOT EXISTS idx_yields_palm ON yields(palm_id);

    CREATE INDEX IF NOT EXISTS idx_zakat_crop ON zakat_records(crop_id);
    CREATE INDEX IF NOT EXISTS idx_zakat_investor ON zakat_records(investor_id);
  `);

  // Enterprise Corporate & Multi-Project Schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      trade_name TEXT,
      commercial_registry TEXT,
      tax_number TEXT,
      email TEXT,
      phone TEXT,
      currency_code TEXT DEFAULT 'EGP',
      logo TEXT,
      tier TEXT DEFAULT 'enterprise',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      company_id TEXT REFERENCES companies(id),
      name TEXT NOT NULL,
      code_prefix TEXT NOT NULL,
      location_name TEXT,
      area_feddan REAL DEFAULT 0,
      timezone TEXT DEFAULT 'Africa/Cairo',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default company and projects if not exist
  const compCount = db.get("SELECT COUNT(*) as cnt FROM companies");
  if (!compCount || compCount.cnt === 0) {
    db.run(
      `INSERT OR IGNORE INTO companies (id, name, trade_name, currency_code, tier) 
       VALUES ('comp_bashayer', 'شركة بشاير الشوربجي للاستثمار الزراعي', 'بشاير الشوربجي', 'EGP', 'enterprise')`
    );
  }

  const projCount = db.get("SELECT COUNT(*) as cnt FROM projects");
  if (!projCount || projCount.cnt === 0) {
    db.run(
      `INSERT OR IGNORE INTO projects (id, company_id, name, code_prefix, location_name, area_feddan, timezone)
       VALUES 
       ('proj_farafra_01', 'comp_bashayer', 'مزرعة الفرافرة - قطاع 1', 'BSH1', 'الوادي الجديد - الفرافرة', 500, 'Africa/Cairo'),
       ('proj_toshka_02', 'comp_bashayer', 'مشروع توشكى للتمور - المرحلة الأولى', 'TSH2', 'أسوان - توشكى', 1200, 'Africa/Cairo')`
    );
  }

  console.log('--- PalmTrace Enterprise Migration Completed Successfully ---');
}

module.exports = { runMigration };

if (require.main === module) {
  runMigration();
}
