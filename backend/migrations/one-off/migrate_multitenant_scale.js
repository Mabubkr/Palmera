/**
 * PalmTrace Enterprise Multi-Tenant Scaling & Schema Migration
 * يطبق النقلة المعمارية:
 * 1. إنشاء جداول الشركات والمشروعات وتعيين الصلاحيات (Companies, Projects, UserProjectAccess)
 * 2. ربط الجداول التشغيلية بحقل project_id والفهارس المخصصة
 * 3. غرس مشروعين تجريبيين (الفرافرة + توشكى) لاختبار التبديل السلس
 * 4. تحديث الـ Views لعزل البيانات وتقديم الاستعلامات اللحظية
 */
const db = require('../../db');

console.log('--- Starting Multi-Tenant Scale Migration ---');

db.exec('PRAGMA foreign_keys = OFF;');
db.exec('BEGIN TRANSACTION;');

try {
  // 1. إنشاء جداول التعدد المؤسسي
  console.log('1. Creating Multi-Tenancy Core tables...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        trade_name TEXT,
        tax_number TEXT,
        commercial_registry TEXT,
        subscription_plan TEXT DEFAULT 'enterprise',
        max_trees_limit INTEGER DEFAULT 5000000,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        code_prefix TEXT NOT NULL UNIQUE,
        location_name TEXT,
        area_feddan REAL DEFAULT 0,
        timezone TEXT DEFAULT 'Africa/Cairo',
        currency_code TEXT DEFAULT 'EGP',
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_projects_company ON projects(company_id);

    CREATE TABLE IF NOT EXISTS user_project_access (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
        role_name TEXT NOT NULL,
        is_default INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, company_id, project_id)
    );

    CREATE INDEX IF NOT EXISTS idx_user_access_lookup ON user_project_access(user_id, project_id);
    CREATE INDEX IF NOT EXISTS idx_user_access_comp ON user_project_access(company_id);
  `);

  // 2. غرس الشركة والمشروعات الافتراضية
  console.log('2. Seeding default Company and Projects...');
  db.exec(`
    INSERT OR IGNORE INTO companies (id, name, trade_name, subscription_plan, max_trees_limit)
    VALUES ('comp_bashayer', 'شركة بشاير الشوربجي للاستثمار الزراعي', 'بشاير الشوربجي', 'enterprise', 5000000);

    INSERT OR IGNORE INTO projects (id, company_id, name, code_prefix, location_name, area_feddan)
    VALUES ('proj_farafra_01', 'comp_bashayer', 'مزرعة الفرافرة - قطاع 1', 'BSH1', 'الوادي الجديد - الفرافرة', 500);

    INSERT OR IGNORE INTO projects (id, company_id, name, code_prefix, location_name, area_feddan)
    VALUES ('proj_toshka_02', 'comp_bashayer', 'مشروع توشكى للتمور - المرحلة الأولى', 'TSH2', 'أسوان - توشكى', 1200);
  `);

  // 3. إضافة حقل project_id للجداول التشغيلية بأمان (Helper function)
  console.log('3. Upgrading operational tables with project_id...');
  
  function addColumnIfNotExists(table, column, def) {
    const cols = db.all(`PRAGMA table_info(${table})`);
    const exists = cols.some(c => c.name === column);
    if (!exists) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def};`);
      console.log(`  Added column ${column} to table ${table}`);
    }
  }

  addColumnIfNotExists('sectors', 'project_id', "TEXT DEFAULT 'proj_farafra_01' REFERENCES projects(id)");
  addColumnIfNotExists('plots', 'project_id', "TEXT DEFAULT 'proj_farafra_01' REFERENCES projects(id)");
  addColumnIfNotExists('palms', 'project_id', "TEXT DEFAULT 'proj_farafra_01' REFERENCES projects(id)");
  addColumnIfNotExists('operations', 'project_id', "TEXT DEFAULT 'proj_farafra_01' REFERENCES projects(id)");
  addColumnIfNotExists('fertilizers', 'project_id', "TEXT DEFAULT 'proj_farafra_01' REFERENCES projects(id)");
  addColumnIfNotExists('fertilizer_vouchers', 'project_id', "TEXT DEFAULT 'proj_farafra_01' REFERENCES projects(id)");
  addColumnIfNotExists('offshoots', 'project_id', "TEXT DEFAULT 'proj_farafra_01' REFERENCES projects(id)");
  addColumnIfNotExists('yields', 'project_id', "TEXT DEFAULT 'proj_farafra_01' REFERENCES projects(id)");
  addColumnIfNotExists('zakat_records', 'project_id', "TEXT DEFAULT 'proj_farafra_01' REFERENCES projects(id)");

  // تحديث القيم السابقة لتنتسب للمشروع الافتراضي
  db.exec(`
    UPDATE sectors SET project_id = 'proj_farafra_01' WHERE project_id IS NULL OR project_id = '';
    UPDATE plots SET project_id = 'proj_farafra_01' WHERE project_id IS NULL OR project_id = '';
    UPDATE palms SET project_id = 'proj_farafra_01' WHERE project_id IS NULL OR project_id = '';
    UPDATE operations SET project_id = 'proj_farafra_01' WHERE project_id IS NULL OR project_id = '';
    UPDATE fertilizers SET project_id = 'proj_farafra_01' WHERE project_id IS NULL OR project_id = '';
    UPDATE fertilizer_vouchers SET project_id = 'proj_farafra_01' WHERE project_id IS NULL OR project_id = '';
    UPDATE offshoots SET project_id = 'proj_farafra_01' WHERE project_id IS NULL OR project_id = '';
    UPDATE yields SET project_id = 'proj_farafra_01' WHERE project_id IS NULL OR project_id = '';
    UPDATE zakat_records SET project_id = 'proj_farafra_01' WHERE project_id IS NULL OR project_id = '';
  `);

  // 4. إنشاء الفهارس المعزولة للمشروعات
  console.log('4. Creating project indexes...');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sectors_project ON sectors(project_id);
    CREATE INDEX IF NOT EXISTS idx_plots_project ON plots(project_id);
    CREATE INDEX IF NOT EXISTS idx_palms_project_plot ON palms(project_id, plot_id);
    CREATE INDEX IF NOT EXISTS idx_palms_project_code ON palms(project_id, code);
    CREATE INDEX IF NOT EXISTS idx_ops_project_time ON operations(project_id, performed_at);
    CREATE INDEX IF NOT EXISTS idx_fertilizers_project ON fertilizers(project_id);
    CREATE INDEX IF NOT EXISTS idx_vouchers_project ON fertilizer_vouchers(project_id);
    CREATE INDEX IF NOT EXISTS idx_offshoots_project ON offshoots(project_id);
    CREATE INDEX IF NOT EXISTS idx_yields_project_season ON yields(project_id, season);
    CREATE INDEX IF NOT EXISTS idx_zakat_project ON zakat_records(project_id);
  `);

  // 5. ربط المستخدمين الحاليين بالمشروعات الافتراضية
  console.log('5. Granting project access permissions to users...');
  const users = db.all('SELECT id, role FROM users');
  const insAccess = db.db.prepare(`
    INSERT OR IGNORE INTO user_project_access (id, user_id, company_id, project_id, role_name, is_default)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const u of users) {
    if (u.role === 'admin') {
      // السوبر أدمن له صلاحية على مستوى كامل الشركة، وكافة المشروعات
      insAccess.run(`acc_${u.id}_all`, u.id, 'comp_bashayer', null, 'superadmin', 1);
      insAccess.run(`acc_${u.id}_farafra`, u.id, 'comp_bashayer', 'proj_farafra_01', 'admin', 1);
      insAccess.run(`acc_${u.id}_toshka`, u.id, 'comp_bashayer', 'proj_toshka_02', 'admin', 0);
    } else {
      // باقي المستخدمين (مهندسون، عمال، أمناء مخازن) يرتبطون بالفرافرة كافتراضي، وتوشكى كمشروع متاح
      insAccess.run(`acc_${u.id}_farafra`, u.id, 'comp_bashayer', 'proj_farafra_01', u.role, 1);
      if (u.role === 'engineer' || u.role === 'warehouse_mgr') {
        insAccess.run(`acc_${u.id}_toshka`, u.id, 'comp_bashayer', 'proj_toshka_02', u.role, 0);
      }
    }
  }

  // 6. غرس بيانات نموذجية أولية لمشروع توشكى للتحقق المباشر من استقلالية التبديل
  console.log('6. Seeding distinct sample data for Toshka Project...');
  db.exec(`
    INSERT OR IGNORE INTO sectors (id, project_id, name, notes)
    VALUES ('sec_tsh_01', 'proj_toshka_02', 'قطاع توشكى أ (الرئيسي)', 'مرحلة الزراعة الأولى 2026');

    INSERT OR IGNORE INTO plots (id, project_id, sector_id, plot_no, part_letter, name)
    VALUES ('TSH-01A', 'proj_toshka_02', 'sec_tsh_01', '01', 'A', 'قطعة توشكى 01-A');

    INSERT OR IGNORE INTO plots (id, project_id, sector_id, plot_no, part_letter, name)
    VALUES ('TSH-01B', 'proj_toshka_02', 'sec_tsh_01', '01', 'B', 'قطعة توشكى 01-B');

    INSERT OR IGNORE INTO fertilizers (id, project_id, name, kind, unit, stock, allocated, consumed, min_alert, unit_cost, crop_id, active)
    VALUES ('fert_tsh_npk', 'proj_toshka_02', 'سماد توشكى المتوازن NPK 20-20-20', 'مركب', 'كجم', 5000, 0, 0, 500, 45, 1, 1);
  `);

  // 7. تحديث وتطوير الـ Views لتشمل project_id والتوافق الكامل
  console.log('7. Recreating Views with project_id support...');
  db.exec('DROP VIEW IF EXISTS v_palms;');
  db.exec('DROP VIEW IF EXISTS v_operations;');
  db.exec('DROP VIEW IF EXISTS v_offshoots;');
  db.exec('DROP VIEW IF EXISTS v_yields;');

  db.exec(`
    CREATE VIEW v_palms AS
    SELECT 
        p.id,
        p.project_id,
        p.project_id AS projectId,
        p.code,
        p.crop_id,
        c.code AS crop_code,
        c.code AS cropId,
        c.name AS crop_name,
        c.single_label AS crop_single,
        c.plural_label AS crop_plural,
        c.offspring_label AS crop_offspring,
        p.source_type,
        p.source_type AS source,
        pst.name AS source_name,
        pst.notes AS source_notes,
        p.variety_id,
        p.variety_id AS varietyId,
        cv.name AS variety_name,
        cv.name AS variety,
        p.sector_id,
        s.name AS sector_name,
        p.plot_id,
        p.plot_id AS plot,
        pl.name AS plot_name,
        p.seq_no,
        p.seq_no AS seq,
        p.plant_date,
        p.plant_date AS plantDate,
        p.origin_id,
        p.origin_id AS originId,
        tot.code AS origin_type,
        tot.code AS originType,
        tot.label_ar AS origin_label,
        tot.label_ar AS originLabel,
        tot.label_en AS origin_label_en,
        p.supplier,
        p.notes,
        p.parent_palm_id,
        p.parent_palm_id AS parentId,
        p.temp_code,
        p.temp_code AS tempCode,
        p.status_id,
        p.status_id AS statusId,
        ths.code AS status_code,
        ths.code AS statusCode,
        ths.label_ar AS status,
        ths.label_en AS status_en,
        ths.label_en AS statusEn,
        ths.badge_color,
        ths.badge_color AS badgeColor,
        ths.badge_bg,
        ths.badge_bg AS badgeBg,
        p.offshoot_count,
        p.offshoot_count AS offshootCount,
        p.lineage_path,
        p.lineage_path AS lineagePath,
        p.gps_lat,
        p.gps_lng,
        p.nursery_age_months,
        p.nursery_age_months AS nurseryAgeMonths,
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
    LEFT JOIN tree_origin_types tot ON p.origin_id = tot.id
    LEFT JOIN tree_health_statuses ths ON p.status_id = ths.id;

    CREATE VIEW v_operations AS
    SELECT 
        o.id,
        o.project_id,
        o.project_id AS projectId,
        o.palm_id,
        o.palm_id AS palmId,
        p.code AS palm_code,
        p.code AS palmCode,
        p.plot_id,
        p.sector_id,
        o.type_id,
        o.type_id AS typeId,
        ot.name AS type_name,
        ot.name AS typeName,
        ot.category_id,
        o.worker_id,
        o.worker_id AS workerId,
        u.full_name AS worker_name,
        u.full_name AS workerName,
        o.performed_at,
        o.performed_at AS at,
        o.status_id,
        o.status_id AS statusId,
        ss.code AS status,
        ss.label_ar AS status_label,
        ss.label_ar AS statusLabel,
        ss.badge_color AS status_badge_color,
        o.approval_id,
        o.approval_id AS approvalId,
        aps.code AS approval,
        aps.code AS approval_status,
        aps.label_ar AS approval_label,
        aps.label_ar AS approvalLabel,
        aps.badge_color AS approval_badge_color,
        aps.badge_color AS approvalBadgeColor,
        aps.badge_bg AS approval_badge_bg,
        aps.badge_bg AS approvalBadgeBg,
        o.approved_by,
        o.supervisor_notes,
        o.supervisor_notes AS supervisorNote,
        o.worker_notes,
        o.worker_notes AS notes,
        o.device_info,
        o.gps_lat,
        o.gps_lng,
        o.photos,
        o.created_at
    FROM operations o
    JOIN palms p ON o.palm_id = p.id
    LEFT JOIN operation_types ot ON o.type_id = ot.id
    LEFT JOIN users u ON o.worker_id = u.id
    LEFT JOIN operation_sync_statuses ss ON o.status_id = ss.id
    LEFT JOIN operation_approval_statuses aps ON o.approval_id = aps.id;

    CREATE VIEW v_offshoots AS
    SELECT 
        o.id,
        o.project_id,
        o.project_id AS projectId,
        o.mother_id,
        o.mother_id AS motherId,
        m.code AS mother_code,
        m.code AS motherCode,
        o.temp_code,
        o.temp_code AS tempCode,
        o.seq_no,
        o.seq_no AS seq,
        o.separation_date,
        o.separation_date AS date,
        o.weight_kg,
        o.weight_kg AS weight,
        o.diameter_cm,
        o.diameter_cm AS diameter,
        o.status_id,
        o.status_id AS statusId,
        ths.code AS status_code,
        ths.code AS statusCode,
        ths.label_ar AS health_status,
        ths.label_ar AS health,
        ths.badge_color AS health_badge_color,
        ths.badge_color AS healthBadgeColor,
        o.variety_id,
        o.variety_id AS varietyId,
        cv.name AS variety_name,
        cv.name AS variety,
        o.origin_id,
        o.origin_id AS originId,
        tot.code AS origin_type,
        tot.code AS originType,
        tot.label_ar AS origin_label,
        tot.label_ar AS originLabel,
        o.approval_id,
        o.approval_id AS approvalId,
        aps.code AS approval_status,
        aps.code AS approvalStatus,
        aps.label_ar AS approval_label,
        aps.label_ar AS approvalLabel,
        aps.badge_color AS approval_badge_color,
        o.supplier,
        o.nursery_stage,
        o.nursery_stage AS nsStatus,
        o.planted_palm_id,
        o.planted_palm_id AS newPalmId,
        plp.code AS planted_palm_code,
        plp.code AS newPalmCode,
        o.notes,
        o.created_at,
        o.created_at AS createdAt
    FROM offshoots o
    LEFT JOIN palms m ON o.mother_id = m.id
    LEFT JOIN palms plp ON o.planted_palm_id = plp.id
    LEFT JOIN crop_varieties cv ON o.variety_id = cv.id
    LEFT JOIN tree_health_statuses ths ON o.status_id = ths.id
    LEFT JOIN tree_origin_types tot ON o.origin_id = tot.id
    LEFT JOIN operation_approval_statuses aps ON o.approval_id = aps.id;

    CREATE VIEW v_yields AS
    SELECT 
        y.id,
        y.project_id,
        y.project_id AS projectId,
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
        c.code AS cropId,
        c.name AS crop_name,
        y.variety_id,
        cv.name AS variety_name,
        cv.name AS variety,
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
  `);

  db.exec('COMMIT;');
  db.exec('PRAGMA foreign_keys = ON;');
  console.log('✅ Multi-Tenant Scale Migration completed successfully!');
} catch (err) {
  db.exec('ROLLBACK;');
  db.exec('PRAGMA foreign_keys = ON;');
  console.error('❌ Migration failed:', err);
  process.exit(1);
}

