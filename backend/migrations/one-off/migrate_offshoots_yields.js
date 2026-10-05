const db = require('../../db');

try {
  console.log('--- Migrating offshoots and yields ---');

  // 1. Create yield_quality_grades lookup table
  db.exec(`
    CREATE TABLE IF NOT EXISTS yield_quality_grades (
      code TEXT PRIMARY KEY,
      label_ar TEXT NOT NULL,
      label_en TEXT NOT NULL,
      badge_color TEXT NOT NULL,
      badge_bg TEXT NOT NULL
    );
  `);
  const insQ = db.db.prepare(`INSERT OR REPLACE INTO yield_quality_grades (code, label_ar, label_en, badge_color, badge_bg) VALUES (?, ?, ?, ?, ?)`);
  insQ.run('grade_a', 'ممتاز / نخب أول', 'Grade A / Premium', '#16A34A', '#DCFCE7');
  insQ.run('grade_b', 'جيد / نخب ثانٍ', 'Grade B', '#2563EB', '#DBEAFE');
  insQ.run('grade_c', 'تالف / فرز', 'Cull / Low Grade', '#D97706', '#FEF3C7');
  console.log('✓ yield_quality_grades ready.');

  // 2. Offshoots migration
  const offCols = db.all("PRAGMA table_info(offshoots)").map(c => c.name);
  if (!offCols.includes('variety_id')) {
    db.exec(`ALTER TABLE offshoots ADD COLUMN variety_id TEXT REFERENCES crop_varieties(id);`);
  }
  if (!offCols.includes('status_code')) {
    db.exec(`ALTER TABLE offshoots ADD COLUMN status_code TEXT DEFAULT 'healthy';`);
  }

  // Populate variety_id and status_code
  if (offCols.includes('variety_name')) {
    db.exec(`
      UPDATE offshoots 
      SET variety_id = (SELECT id FROM crop_varieties WHERE crop_varieties.name = offshoots.variety_name LIMIT 1)
      WHERE variety_id IS NULL OR variety_id = '';
    `);
    db.exec(`UPDATE offshoots SET variety_id = 'cv1' WHERE variety_id IS NULL;`);
    db.exec(`ALTER TABLE offshoots DROP COLUMN variety_name;`);
    console.log('✓ Dropped variety_name from offshoots.');
  }
  if (offCols.includes('health_status')) {
    db.exec(`
      UPDATE offshoots 
      SET status_code = CASE 
        WHEN health_status LIKE '%مصاب%' THEN 'infected'
        WHEN health_status LIKE '%مراقبة%' THEN 'observation'
        WHEN health_status LIKE '%ميت%' THEN 'dead'
        ELSE 'healthy'
      END;
    `);
    db.exec(`ALTER TABLE offshoots DROP COLUMN health_status;`);
    console.log('✓ Dropped health_status from offshoots.');
  }

  // 3. Yields migration
  const yieldCols = db.all("PRAGMA table_info(yields)").map(c => c.name);
  if (!yieldCols.includes('variety_id')) {
    db.exec(`ALTER TABLE yields ADD COLUMN variety_id TEXT REFERENCES crop_varieties(id);`);
  }
  if (!yieldCols.includes('quality_code')) {
    db.exec(`ALTER TABLE yields ADD COLUMN quality_code TEXT DEFAULT 'grade_a';`);
  }

  if (yieldCols.includes('variety_name')) {
    db.exec(`
      UPDATE yields 
      SET variety_id = (SELECT id FROM crop_varieties WHERE crop_varieties.name = yields.variety_name LIMIT 1)
      WHERE variety_id IS NULL OR variety_id = '';
    `);
    db.exec(`UPDATE yields SET variety_id = 'cv1' WHERE variety_id IS NULL;`);
    db.exec(`ALTER TABLE yields DROP COLUMN variety_name;`);
    console.log('✓ Dropped variety_name from yields.');
  }
  if (yieldCols.includes('quality_grade')) {
    db.exec(`
      UPDATE yields 
      SET quality_code = CASE 
        WHEN quality_grade LIKE '%جيد%' THEN 'grade_b'
        WHEN quality_grade LIKE '%تالف%' OR quality_grade LIKE '%فرز%' THEN 'grade_c'
        ELSE 'grade_a'
      END;
    `);
    db.exec(`ALTER TABLE yields DROP COLUMN quality_grade;`);
    console.log('✓ Dropped quality_grade from yields.');
  }

  // 4. Create Views: v_offshoots and v_yields
  db.exec(`
    CREATE VIEW IF NOT EXISTS v_offshoots AS
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
        o.status_code,
        hs.label_ar AS health_status,
        hs.badge_color AS health_badge_color,
        o.origin_type,
        ot.label_ar AS origin_label,
        o.supplier,
        o.nursery_stage,
        o.planted_palm_id,
        pp.code AS planted_palm_code,
        o.approval_status,
        o.approved_by,
        o.notes,
        o.created_at
    FROM offshoots o
    LEFT JOIN palms mp ON o.mother_id = mp.id
    LEFT JOIN crop_varieties v ON o.variety_id = v.id
    LEFT JOIN tree_health_statuses hs ON o.status_code = hs.code
    LEFT JOIN tree_origin_types ot ON o.origin_type = ot.code
    LEFT JOIN palms pp ON o.planted_palm_id = pp.id;
  `);
  console.log('✓ v_offshoots view created.');

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
        c.name AS crop_name,
        y.variety_id,
        COALESCE(v.name, 'عام') AS variety_name,
        y.kg_total,
        y.kg_excellent,
        y.kg_good,
        y.kg_low,
        y.boxes_count,
        y.quality_code,
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
    LEFT JOIN yield_quality_grades qg ON y.quality_code = qg.code
    LEFT JOIN users u ON y.recorded_by = u.id;
  `);
  console.log('✓ v_yields view created.');

  console.log('Offshoots cols now:', db.all('PRAGMA table_info(offshoots)').map(c => c.name));
  console.log('Yields cols now:', db.all('PRAGMA table_info(yields)').map(c => c.name));
  console.log('Sample v_offshoots:', db.all('SELECT * FROM v_offshoots LIMIT 1'));
  console.log('Sample v_yields:', db.all('SELECT * FROM v_yields LIMIT 1'));
} catch (e) {
  console.error(e);
}

