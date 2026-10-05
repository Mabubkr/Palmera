const db = require('../../db');

try {
  console.log('--- Starting Enterprise Numeric Architecture Migration ---');

  // Drop dependent views first so SQLite allows altering / dropping underlying lookup tables
  db.exec(`
    DROP VIEW IF EXISTS v_palms;
    DROP VIEW IF EXISTS v_offshoots;
    DROP VIEW IF EXISTS v_yields;
    DROP VIEW IF EXISTS v_operations;
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS tree_health_statuses_new (
      id INTEGER PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      label_ar TEXT NOT NULL,
      label_en TEXT NOT NULL,
      badge_color TEXT NOT NULL,
      badge_bg TEXT NOT NULL,
      requires_alert INTEGER DEFAULT 0
    );
  `);
  const insHealth = db.db.prepare(`
    INSERT OR REPLACE INTO tree_health_statuses_new (id, code, label_ar, label_en, badge_color, badge_bg, requires_alert)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insHealth.run(1, 'healthy', 'سليمة', 'Healthy', '#16A34A', '#DCFCE7', 0);
  insHealth.run(2, 'observation', 'تحت المراقبة', 'Under Observation', '#D97706', '#FEF3C7', 1);
  insHealth.run(3, 'infected', 'مصابة', 'Infected', '#DC2626', '#FEE2E2', 1);
  insHealth.run(4, 'uprooted', 'مقلوعة', 'Uprooted', '#64748B', '#F1F5F9', 0);
  insHealth.run(5, 'dead', 'ميتة', 'Dead', '#0F172A', '#E2E8F0', 0);

  // Drop old and rename
  db.exec(`DROP TABLE IF EXISTS tree_health_statuses;`);
  db.exec(`ALTER TABLE tree_health_statuses_new RENAME TO tree_health_statuses;`);
  console.log('✓ tree_health_statuses upgraded with INTEGER PRIMARY KEY.');

  // B. tree_origin_types
  db.exec(`
    CREATE TABLE IF NOT EXISTS tree_origin_types_new (
      id INTEGER PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      label_ar TEXT NOT NULL,
      label_en TEXT NOT NULL
    );
  `);
  const insOrigin = db.db.prepare(`
    INSERT OR REPLACE INTO tree_origin_types_new (id, code, label_ar, label_en)
    VALUES (?, ?, ?, ?)
  `);
  insOrigin.run(1, 'internal', 'داخلي / ترقيد بالمزرعة', 'Internal Farm');
  insOrigin.run(2, 'purchased', 'شراء خارجي', 'Purchased External');
  insOrigin.run(3, 'tissue_culture', 'زراعة أنسجة', 'Tissue Culture');
  insOrigin.run(4, 'offshoot', 'فسيلة أرضية/هوائية', 'Offshoot');

  db.exec(`DROP TABLE IF EXISTS tree_origin_types;`);
  db.exec(`ALTER TABLE tree_origin_types_new RENAME TO tree_origin_types;`);
  console.log('✓ tree_origin_types upgraded with INTEGER PRIMARY KEY.');

  // C. yield_quality_grades
  db.exec(`
    CREATE TABLE IF NOT EXISTS yield_quality_grades_new (
      id INTEGER PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      label_ar TEXT NOT NULL,
      label_en TEXT NOT NULL,
      badge_color TEXT NOT NULL,
      badge_bg TEXT NOT NULL
    );
  `);
  const insQuality = db.db.prepare(`
    INSERT OR REPLACE INTO yield_quality_grades_new (id, code, label_ar, label_en, badge_color, badge_bg)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insQuality.run(1, 'grade_a', 'ممتاز / نخب أول', 'Grade A / Premium', '#16A34A', '#DCFCE7');
  insQuality.run(2, 'grade_b', 'جيد / نخب ثانٍ', 'Grade B', '#2563EB', '#DBEAFE');
  insQuality.run(3, 'grade_c', 'تالف / فرز', 'Cull / Low Grade', '#D97706', '#FEF3C7');

  db.exec(`DROP TABLE IF EXISTS yield_quality_grades;`);
  db.exec(`ALTER TABLE yield_quality_grades_new RENAME TO yield_quality_grades;`);
  console.log('✓ yield_quality_grades upgraded with INTEGER PRIMARY KEY.');

  // D. operation_approval_statuses
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
  const insAppr = db.db.prepare(`
    INSERT OR REPLACE INTO operation_approval_statuses (id, code, label_ar, label_en, badge_color, badge_bg)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insAppr.run(1, 'pending', 'قيد الاعتماد', 'Pending Review', '#D97706', '#FEF3C7');
  insAppr.run(2, 'approved', 'معتمد', 'Approved', '#16A34A', '#DCFCE7');
  insAppr.run(3, 'rejected', 'مرفوض', 'Rejected', '#DC2626', '#FEE2E2');
  console.log('✓ operation_approval_statuses table ready.');

  // E. operation_sync_statuses
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
  const insSync = db.db.prepare(`
    INSERT OR REPLACE INTO operation_sync_statuses (id, code, label_ar, label_en, badge_color, badge_bg)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insSync.run(1, 'draft', 'مسودة محلية', 'Draft', '#64748B', '#F1F5F9');
  insSync.run(2, 'pending_sync', 'قيد المزامنة', 'Pending Sync', '#D97706', '#FEF3C7');
  insSync.run(3, 'synced', 'تمت المزامنة', 'Synced', '#16A34A', '#DCFCE7');
  console.log('✓ operation_sync_statuses table ready.');

  // 2. Migrate operations Table
  const opCols = db.all("PRAGMA table_info(operations)").map(c => c.name);
  if (!opCols.includes('approval_id')) {
    db.exec(`ALTER TABLE operations ADD COLUMN approval_id INTEGER;`);
  }
  if (!opCols.includes('status_id')) {
    db.exec(`ALTER TABLE operations ADD COLUMN status_id INTEGER;`);
  }

  if (opCols.includes('approval_status')) {
    db.exec(`
      UPDATE operations SET approval_id = CASE
        WHEN approval_status = 'approved' THEN 2
        WHEN approval_status = 'rejected' THEN 3
        ELSE 1
      END;
    `);
    db.exec(`ALTER TABLE operations DROP COLUMN approval_status;`);
    console.log('✓ Dropped approval_status text column from operations, replaced with approval_id.');
  }
  db.exec(`UPDATE operations SET approval_id = 1 WHERE approval_id IS NULL;`);

  if (opCols.includes('status')) {
    db.exec(`
      UPDATE operations SET status_id = CASE
        WHEN status = 'draft' THEN 1
        WHEN status IN ('pending', 'pending_sync') THEN 2
        ELSE 3
      END;
    `);
    db.exec(`ALTER TABLE operations DROP COLUMN status;`);
    console.log('✓ Dropped status text column from operations, replaced with status_id.');
  }
  db.exec(`UPDATE operations SET status_id = 3 WHERE status_id IS NULL;`);

  // Create High-Performance Indexes on operations
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_ops_palm_type_date ON operations(palm_id, type_id, performed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ops_approval ON operations(approval_id);
    CREATE INDEX IF NOT EXISTS idx_ops_status ON operations(status_id);
    CREATE INDEX IF NOT EXISTS idx_ops_worker ON operations(worker_id);
  `);
  console.log('✓ Composite and numeric indexes created on operations.');

  // Create View: v_operations
  db.exec(`DROP VIEW IF EXISTS v_operations;`);
  db.exec(`
    CREATE VIEW v_operations AS
    SELECT 
        o.id,
        o.palm_id,
        p.code AS palm_code,
        p.plot_id,
        p.sector_id,
        o.type_id,
        ot.name AS type_name,
        ot.category_id,
        o.worker_id,
        u.full_name AS worker_name,
        o.performed_at,
        o.status_id,
        ss.code AS status,
        ss.label_ar AS status_label,
        ss.badge_color AS status_badge_color,
        o.approval_id,
        ast.code AS approval_status,
        ast.label_ar AS approval_label,
        ast.badge_color AS approval_badge_color,
        ast.badge_bg AS approval_badge_bg,
        o.approved_by,
        o.supervisor_notes,
        o.worker_notes,
        o.device_info,
        o.gps_lat,
        o.gps_lng,
        o.photos,
        o.created_at
    FROM operations o
    LEFT JOIN palms p ON o.palm_id = p.id
    LEFT JOIN operation_types ot ON o.type_id = ot.id
    LEFT JOIN users u ON o.worker_id = u.id
    LEFT JOIN operation_approval_statuses ast ON o.approval_id = ast.id
    LEFT JOIN operation_sync_statuses ss ON o.status_id = ss.id;
  `);
  console.log('✓ v_operations dynamic view created.');

  // 3. Migrate palms Table
  const palmCols = db.all("PRAGMA table_info(palms)").map(c => c.name);
  if (!palmCols.includes('status_id')) {
    db.exec(`ALTER TABLE palms ADD COLUMN status_id INTEGER;`);
  }
  if (!palmCols.includes('origin_id')) {
    db.exec(`ALTER TABLE palms ADD COLUMN origin_id INTEGER;`);
  }

  // Drop old indexes referencing status_code before dropping it
  db.exec(`
    DROP INDEX IF EXISTS idx_palms_status;
    DROP INDEX IF EXISTS idx_palms_sick;
  `);

  if (palmCols.includes('status_code')) {
    db.exec(`
      UPDATE palms SET status_id = CASE
        WHEN status_code = 'healthy' THEN 1
        WHEN status_code = 'observation' THEN 2
        WHEN status_code = 'infected' THEN 3
        WHEN status_code = 'uprooted' THEN 4
        WHEN status_code = 'dead' THEN 5
        ELSE 1
      END;
    `);
    db.exec(`ALTER TABLE palms DROP COLUMN status_code;`);
    console.log('✓ Dropped status_code text column from palms, replaced with status_id.');
  }
  db.exec(`UPDATE palms SET status_id = 1 WHERE status_id IS NULL;`);

  if (palmCols.includes('origin_type')) {
    db.exec(`
      UPDATE palms SET origin_id = CASE
        WHEN origin_type = 'internal' THEN 1
        WHEN origin_type = 'purchased' THEN 2
        WHEN origin_type = 'tissue_culture' THEN 3
        WHEN origin_type = 'offshoot' THEN 4
        ELSE 1
      END;
    `);
    db.exec(`ALTER TABLE palms DROP COLUMN origin_type;`);
    console.log('✓ Dropped origin_type text column from palms, replaced with origin_id.');
  }
  db.exec(`UPDATE palms SET origin_id = 1 WHERE origin_id IS NULL;`);

  // Update v_palms view
  db.exec(`DROP VIEW IF EXISTS v_palms;`);
  db.exec(`
    CREATE VIEW v_palms AS
    SELECT 
        p.id,
        p.code,
        p.crop_id,
        c.name AS crop_name,
        p.source_type,
        p.variety_id,
        v.name AS variety_name,
        p.sector_id,
        s.name AS sector_name,
        p.plot_id,
        pl.name AS plot_name,
        p.seq_no,
        p.plant_date,
        p.origin_id,
        ot.code AS origin_type,
        ot.label_ar AS origin_label,
        ot.label_en AS origin_label_en,
        p.supplier,
        p.parent_palm_id,
        p.temp_code,
        p.status_id,
        hs.code AS status_code,
        hs.label_ar AS status,
        hs.label_en AS status_en,
        hs.badge_color,
        hs.badge_bg,
        p.offshoot_count,
        p.lineage_path,
        p.gps_lat,
        p.gps_lng,
        p.nursery_age_months,
        p.is_locked,
        p.is_archived,
        p.is_deleted,
        p.notes,
        p.created_at
    FROM palms p
    LEFT JOIN crops c ON p.crop_id = c.id
    LEFT JOIN crop_varieties v ON p.variety_id = v.id
    LEFT JOIN sectors s ON p.sector_id = s.id
    LEFT JOIN plots pl ON p.plot_id = pl.id
    LEFT JOIN tree_health_statuses hs ON p.status_id = hs.id
    LEFT JOIN tree_origin_types ot ON p.origin_id = ot.id;
  `);
  console.log('✓ v_palms dynamic view updated.');

  // Update indexes on palms
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_palms_status_id ON palms(status_id);
    CREATE INDEX IF NOT EXISTS idx_palms_origin_id ON palms(origin_id);
    DROP INDEX IF EXISTS idx_palms_sick;
    CREATE INDEX IF NOT EXISTS idx_palms_sick ON palms(plot_id, status_id) 
      WHERE status_id != 1 AND (is_deleted = 0 OR is_deleted IS NULL);
  `);
  console.log('✓ Palms numeric indexes updated.');

  // Update plot_summaries counter cache
  db.exec(`
    INSERT OR REPLACE INTO plot_summaries (plot_id, sector_id, total_trees, healthy_trees, infected_trees, under_observation_trees, updated_at)
    SELECT 
      p.id AS plot_id,
      p.sector_id,
      COUNT(palms.id) AS total_trees,
      SUM(CASE WHEN palms.status_id = 1 THEN 1 ELSE 0 END) AS healthy_trees,
      SUM(CASE WHEN palms.status_id = 3 THEN 1 ELSE 0 END) AS infected_trees,
      SUM(CASE WHEN palms.status_id = 2 THEN 1 ELSE 0 END) AS under_observation_trees,
      CURRENT_TIMESTAMP
    FROM plots p
    LEFT JOIN palms ON palms.plot_id = p.id AND (palms.is_deleted = 0 OR palms.is_deleted IS NULL)
    GROUP BY p.id, p.sector_id;
  `);
  console.log('✓ plot_summaries counter cache updated with numeric status IDs.');

  // 4. Migrate offshoots Table
  const offCols = db.all("PRAGMA table_info(offshoots)").map(c => c.name);
  if (!offCols.includes('status_id')) {
    db.exec(`ALTER TABLE offshoots ADD COLUMN status_id INTEGER;`);
  }
  if (!offCols.includes('origin_id')) {
    db.exec(`ALTER TABLE offshoots ADD COLUMN origin_id INTEGER;`);
  }

  db.exec(`DROP INDEX IF EXISTS idx_offshoots_status;`);

  if (offCols.includes('status_code')) {
    db.exec(`
      UPDATE offshoots SET status_id = CASE
        WHEN status_code = 'healthy' THEN 1
        WHEN status_code = 'observation' THEN 2
        WHEN status_code = 'infected' THEN 3
        WHEN status_code = 'uprooted' THEN 4
        WHEN status_code = 'dead' THEN 5
        ELSE 1
      END;
    `);
    db.exec(`ALTER TABLE offshoots DROP COLUMN status_code;`);
    console.log('✓ Dropped status_code from offshoots, replaced with status_id.');
  }
  db.exec(`UPDATE offshoots SET status_id = 1 WHERE status_id IS NULL;`);

  if (offCols.includes('origin_type')) {
    db.exec(`
      UPDATE offshoots SET origin_id = CASE
        WHEN origin_type = 'internal' THEN 1
        WHEN origin_type = 'purchased' THEN 2
        WHEN origin_type = 'tissue_culture' THEN 3
        WHEN origin_type = 'offshoot' THEN 4
        ELSE 1
      END;
    `);
    db.exec(`ALTER TABLE offshoots DROP COLUMN origin_type;`);
    console.log('✓ Dropped origin_type from offshoots, replaced with origin_id.');
  }
  db.exec(`UPDATE offshoots SET origin_id = 1 WHERE origin_id IS NULL;`);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_offshoots_status_id ON offshoots(status_id);
    CREATE INDEX IF NOT EXISTS idx_offshoots_origin_id ON offshoots(origin_id);
  `);

  db.exec(`DROP VIEW IF EXISTS v_offshoots;`);
  db.exec(`
    CREATE VIEW v_offshoots AS
    SELECT 
        o.id,
        o.mother_id,
        mp.code AS mother_code,
        o.temp_code,
        o.seq_no,
        o.separation_date,
        o.weight_kg,
        o.diameter_cm,
        o.variety_id,
        v.name AS variety_name,
        o.status_id,
        hs.code AS status_code,
        hs.label_ar AS health_status,
        hs.badge_color AS health_badge_color,
        o.origin_id,
        ot.code AS origin_type,
        ot.label_ar AS origin_label,
        o.supplier,
        o.nursery_stage,
        o.is_opening_stock,
        o.planted_palm_id,
        pp.code AS planted_palm_code,
        o.approval_status,
        o.approved_by,
        o.notes,
        o.created_at
    FROM offshoots o
    LEFT JOIN palms mp ON o.mother_id = mp.id
    LEFT JOIN crop_varieties v ON o.variety_id = v.id
    LEFT JOIN tree_health_statuses hs ON o.status_id = hs.id
    LEFT JOIN tree_origin_types ot ON o.origin_id = ot.id
    LEFT JOIN palms pp ON o.planted_palm_id = pp.id;
  `);
  console.log('✓ v_offshoots dynamic view updated.');

  // 5. Migrate yields Table
  db.exec(`DROP INDEX IF EXISTS idx_yields_quality;`);

  const yieldCols = db.all("PRAGMA table_info(yields)").map(c => c.name);
  if (!yieldCols.includes('quality_id')) {
    db.exec(`ALTER TABLE yields ADD COLUMN quality_id INTEGER;`);
  }

  if (yieldCols.includes('quality_code')) {
    db.exec(`
      UPDATE yields SET quality_id = CASE
        WHEN quality_code = 'grade_a' THEN 1
        WHEN quality_code = 'grade_b' THEN 2
        WHEN quality_code = 'grade_c' THEN 3
        ELSE 1
      END;
    `);
    db.exec(`ALTER TABLE yields DROP COLUMN quality_code;`);
    console.log('✓ Dropped quality_code from yields, replaced with quality_id.');
  }
  db.exec(`UPDATE yields SET quality_id = 1 WHERE quality_id IS NULL;`);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_yields_quality_id ON yields(quality_id);
  `);

  db.exec(`DROP VIEW IF EXISTS v_yields;`);
  db.exec(`
    CREATE VIEW v_yields AS
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
        c.name AS crop_name,
        y.variety_id,
        COALESCE(v.name, 'عام') AS variety_name,
        y.kg_total,
        y.kg_excellent,
        y.kg_good,
        y.kg_low,
        y.boxes_count,
        y.quality_id,
        qg.code AS quality_code,
        qg.label_ar AS quality_grade,
        qg.badge_color AS quality_badge_color,
        y.recorded_by,
        u.full_name AS recorded_by_name,
        y.notes,
        y.created_at
    FROM yields y
    LEFT JOIN crops c ON y.crop_id = c.id
    LEFT JOIN palms p ON y.palm_id = p.id
    LEFT JOIN plots pl ON y.plot_id = pl.id
    LEFT JOIN sectors s ON y.sector_id = s.id
    LEFT JOIN crop_varieties v ON y.variety_id = v.id
    LEFT JOIN yield_quality_grades qg ON y.quality_id = qg.id
    LEFT JOIN users u ON y.recorded_by = u.id;
  `);
  console.log('✓ v_yields dynamic view updated.');

  console.log('--- Enterprise Migration Completed Successfully ---');
} catch (err) {
  console.error('Migration failed:', err);
  process.exit(1);
}
