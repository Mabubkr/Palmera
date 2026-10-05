/**
 * PalmTrace Architecture Rollback: Purging Multi-Tenant Tables & Columns
 * يزيل تماماً جداول وحقول التعدد المؤسسي (companies, projects, user_project_access)
 * مع الحفاظ بنسبة 100% على كافة البيانات التشغيلية وسكيما الـ 3NF الرقمية
 */
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const dbPath = require('../../config').DB_PATH;
const backupPath = path.join(require('../../config').DATA_DIR, 'palmtrace.db.pre_purge_backup');

console.log('--- 1. Making fresh backup of palmtrace.db ---');
fs.copyFileSync(dbPath, backupPath);
console.log(`✓ Backup saved to ${backupPath}`);

const db = new DatabaseSync(dbPath);

try {
  console.log('--- 2. Starting Purge Transaction ---');
  db.exec('PRAGMA foreign_keys = OFF;');
  db.exec('BEGIN TRANSACTION;');

  // 1. Drop dependent views
  console.log('Dropping dependent views...');
  db.exec(`
    DROP VIEW IF EXISTS v_palms;
    DROP VIEW IF EXISTS v_operations;
    DROP VIEW IF EXISTS v_offshoots;
    DROP VIEW IF EXISTS v_yields;
  `);

  // 2. Drop multi-tenant indexes
  console.log('Dropping multi-tenant indexes...');
  const idxList = [
    'idx_projects_company',
    'idx_sectors_project',
    'idx_plots_project',
    'idx_palms_project_plot',
    'idx_palms_project_code',
    'idx_ops_project_time',
    'idx_fertilizers_project',
    'idx_vouchers_project',
    'idx_offshoots_project',
    'idx_yields_project_season',
    'idx_zakat_project',
    'idx_user_access_lookup',
    'idx_user_access_comp',
    'idx_user_access_role',
    'idx_user_plots_proj',
    'idx_audit_company',
    'idx_audit_project'
  ];
  for (const idx of idxList) {
    try {
      db.exec(`DROP INDEX IF EXISTS ${idx};`);
      console.log(`  Dropped index: ${idx}`);
    } catch (e) {
      console.log(`  Index drop notice for ${idx}: ${e.message}`);
    }
  }

  // 3. Drop columns via ALTER TABLE DROP COLUMN
  console.log('Dropping project_id and company_id columns from operational tables...');
  const colDrops = [
    { table: 'sectors', col: 'project_id' },
    { table: 'plots', col: 'project_id' },
    { table: 'palms', col: 'project_id' },
    { table: 'operations', col: 'project_id' },
    { table: 'fertilizers', col: 'project_id' },
    { table: 'fertilizer_vouchers', col: 'project_id' },
    { table: 'offshoots', col: 'project_id' },
    { table: 'yields', col: 'project_id' },
    { table: 'zakat_records', col: 'project_id' },
    { table: 'audit_logs', col: 'company_id' },
    { table: 'audit_logs', col: 'project_id' }
  ];

  for (const item of colDrops) {
    try {
      db.exec(`ALTER TABLE "${item.table}" DROP COLUMN "${item.col}";`);
      console.log(`  ✓ Dropped ${item.col} from ${item.table}`);
    } catch (e) {
      console.log(`  Notice on ${item.table}.${item.col}: ${e.message}`);
    }
  }

  // 4. Rebuild user_plots without project_id (with UNIQUE(user_id, plot_id))
  console.log('Rebuilding user_plots without project_id...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_plots_clean (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plot_id TEXT NOT NULL REFERENCES plots(id) ON DELETE CASCADE,
        permission_type TEXT DEFAULT 'work',
        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, plot_id)
    );
    INSERT OR IGNORE INTO user_plots_clean (id, user_id, plot_id, permission_type, assigned_at)
    SELECT id, user_id, plot_id, permission_type, assigned_at FROM user_plots;
    DROP TABLE IF EXISTS user_plots;
    ALTER TABLE user_plots_clean RENAME TO user_plots;
    CREATE INDEX IF NOT EXISTS idx_user_plots_user ON user_plots(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_plots_plot ON user_plots(plot_id);
  `);
  console.log('  ✓ Rebuilt user_plots table successfully.');

  // 5. Drop multi-tenant tables
  console.log('Dropping multi-tenant tables...');
  db.exec(`
    DROP TABLE IF EXISTS user_project_access;
    DROP TABLE IF EXISTS projects;
    DROP TABLE IF EXISTS companies;
  `);
  console.log('  ✓ Dropped tables: user_project_access, projects, companies');

  // 6. Recreate clean views without project_id
  console.log('Recreating clean dynamic views...');
  db.exec(`
    CREATE VIEW IF NOT EXISTS v_palms AS
    SELECT 
      p.id,
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
    LEFT JOIN tree_health_statuses ths ON p.status_id = ths.id
    LEFT JOIN tree_origin_types tot ON p.origin_id = tot.id;

    CREATE VIEW IF NOT EXISTS v_operations AS
    SELECT 
      o.id,
      o.palm_id,
      o.palm_id AS palmId,
      p.code AS palm_code,
      p.code AS palmCode,
      o.type_id,
      o.type_id AS typeId,
      ot.name AS type_name,
      ot.name AS typeName,
      o.worker_id,
      o.worker_id AS workerId,
      u.full_name AS worker_name,
      u.full_name AS workerName,
      o.performed_at,
      o.performed_at AS at,
      o.status_id,
      o.status_id AS statusId,
      ss.code AS status_code,
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

    CREATE VIEW IF NOT EXISTS v_offshoots AS
    SELECT 
      o.id,
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

  // 7. Ensure clean indexes
  console.log('Ensuring clean indexes...');
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
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
  `);

  db.exec('COMMIT;');
  db.exec('PRAGMA foreign_keys = ON;');
  console.log('--- 3. Purge Transaction Committed Successfully! ---');

  // Verify and print status
  const tables = ['sectors', 'plots', 'palms', 'operations', 'fertilizers', 'fertilizer_vouchers', 'offshoots', 'yields', 'zakat_records', 'audit_logs', 'users', 'user_plots'];
  console.log('\n--- 4. Verification: Row Counts Post Migration ---');
  for (const t of tables) {
    const row = db.prepare(`SELECT COUNT(*) as cnt FROM ${t}`).get();
    console.log(`  ${t}: ${row.cnt} rows`);
  }

  const remainingTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  console.log('\n--- 5. Verification: Checking for Any Residual Company/Project Artifacts ---');
  let residualFound = false;
  for (const t of remainingTables) {
    if (t.name.includes('company') || t.name.includes('project')) {
      console.log(`  ❌ RESIDUAL TABLE FOUND: ${t.name}`);
      residualFound = true;
    }
    const cols = db.prepare(`PRAGMA table_info(${t.name})`).all();
    const badCols = cols.filter(c => c.name.includes('company') || c.name.includes('project'));
    if (badCols.length > 0) {
      console.log(`  ❌ RESIDUAL COLUMNS FOUND in ${t.name}: ${badCols.map(c=>c.name).join(', ')}`);
      residualFound = true;
    }
  }

  if (!residualFound) {
    console.log('  ✅ SUCCESS: Database is 100% clean! Zero tables or columns contain company or project.');
  } else {
    throw new Error('Residual multi-tenant artifacts detected!');
  }

} catch (err) {
  try { db.exec('ROLLBACK;'); } catch {}
  console.error('Migration failed:', err);
  process.exit(1);
} finally {
  db.close();
}

