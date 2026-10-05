const db = require('../../db');

console.log('--- Starting Propagation Sources & Crops Normalization Migration ---');

db.exec('BEGIN;');
try {
  // 1. Create propagation_source_types lookup table
  db.exec(`
    CREATE TABLE IF NOT EXISTS propagation_source_types (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      notes TEXT,
      default_crop_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (default_crop_id) REFERENCES crops(id)
    );
  `);

  // 2. Seed standard propagation source types
  const defaultSources = [
    { id: 'pst_f', code: 'F', name: 'فسيلة', notes: 'خلفة أرضية مأخوذة من النخلة الأم', default_crop_id: 'palm' },
    { id: 'pst_n', code: 'N', name: 'زراعة أنسجة (نخيل)', notes: 'نخيل نسيجي منتج مخبرياً', default_crop_id: 'palm' },
    { id: 'pst_c', code: 'C', name: 'عقلة خضرية', notes: 'عقل ساقية غضة أو نصف خشبية مجذرة', default_crop_id: 'olive' },
    { id: 'pst_s', code: 'S', name: 'شتلة مطعومة', notes: 'شتلة مركبة على أصل بري مقاوم', default_crop_id: 'olive' },
    { id: 'pst_t', code: 'T', name: 'زراعة أنسجة (أشجار)', notes: 'شتلات نسيجية مخبرية للأشجار', default_crop_id: 'olive' },
    { id: 'pst_b', code: 'B', name: 'شتلة بذرية', notes: 'شتلة منتجة من إنبات البذور مباشرة', default_crop_id: null },
    { id: 'pst_l', code: 'L', name: 'ترقيد هوائي', notes: 'إكثار خضري بتجذير الأغصان الهوائية', default_crop_id: null }
  ];

  for (const s of defaultSources) {
    db.run(
      `INSERT OR REPLACE INTO propagation_source_types (id, code, name, notes, default_crop_id)
       VALUES (?, ?, ?, ?, ?)`,
      s.id, s.code, s.name, s.notes, s.default_crop_id
    );
  }
  console.log('✓ propagation_source_types lookup table created and seeded.');

  // 3. Ensure crops table has extended attributes for UI dynamic config
  const cropCols = db.all('PRAGMA table_info(crops)').map(c => c.name);
  if (!cropCols.includes('primary_source_code')) {
    db.exec(`ALTER TABLE crops ADD COLUMN primary_source_code TEXT DEFAULT 'F';`);
  }
  if (!cropCols.includes('usage_type')) {
    db.exec(`ALTER TABLE crops ADD COLUMN usage_type TEXT DEFAULT 'main';`);
  }
  if (!cropCols.includes('yield_name')) {
    db.exec(`ALTER TABLE crops ADD COLUMN yield_name TEXT DEFAULT 'تمر';`);
  }
  if (!cropCols.includes('unit')) {
    db.exec(`ALTER TABLE crops ADD COLUMN unit TEXT DEFAULT 'كجم';`);
  }
  if (!cropCols.includes('icon')) {
    db.exec(`ALTER TABLE crops ADD COLUMN icon TEXT DEFAULT 'palm';`);
  }
  if (!cropCols.includes('notes')) {
    db.exec(`ALTER TABLE crops ADD COLUMN notes TEXT;`);
  }
  if (!cropCols.includes('sources_json')) {
    db.exec(`ALTER TABLE crops ADD COLUMN sources_json TEXT;`);
  }

  // Update existing crops
  db.run(`
    UPDATE crops SET 
      primary_source_code = 'F',
      usage_type = 'main',
      yield_name = 'تمر',
      unit = 'كجم',
      icon = 'palm',
      notes = 'محصول رئيسي',
      sources_json = ?
    WHERE id = 'palm'
  `, JSON.stringify([{ code: 'F', name: 'فسيلة' }, { code: 'N', name: 'زراعة أنسجة (نخيل)' }]));

  db.run(`
    UPDATE crops SET 
      primary_source_code = 'C',
      usage_type = 'intercrop',
      yield_name = 'زيتون',
      unit = 'كجم',
      icon = 'olive',
      notes = 'محصول بيني',
      sources_json = ?
    WHERE id = 'olive'
  `, JSON.stringify([{ code: 'C', name: 'عقلة خضرية' }, { code: 'S', name: 'شتلة مطعومة' }, { code: 'T', name: 'زراعة أنسجة (أشجار)' }]));

  console.log('✓ crops table extended with dynamic configuration columns.');

  // 4. Create index on palms.source_type
  db.exec(`CREATE INDEX IF NOT EXISTS idx_palms_source_type ON palms(source_type);`);
  console.log('✓ idx_palms_source_type index created.');

  // 5. Recreate v_palms view with propagation source and crop details
  db.exec(`DROP VIEW IF EXISTS v_palms;`);
  db.exec(`
    CREATE VIEW v_palms AS
    SELECT 
      p.id,
      p.code,
      p.crop_id,
      c.name AS crop_name,
      c.single_label AS crop_single,
      c.plural_label AS crop_plural,
      c.offspring_label AS crop_offspring,
      p.source_type,
      p.source_type AS source,
      pst.name AS source_name,
      pst.notes AS source_notes,
      p.variety_id,
      cv.name AS variety_name,
      cv.name AS variety,
      p.sector_id,
      p.plot_id,
      p.plot_id AS plot,
      p.seq_no,
      p.seq_no AS seq,
      p.plant_date,
      p.plant_date AS plantDate,
      p.origin_id,
      tot.code AS origin_type,
      tot.label_ar AS origin_label,
      tot.label_en AS origin_label_en,
      p.supplier,
      p.notes,
      p.parent_palm_id,
      p.parent_palm_id AS parentId,
      p.temp_code,
      p.temp_code AS tempCode,
      p.status_id,
      ths.code AS status_code,
      ths.code AS statusCode,
      ths.label_ar AS status,
      ths.label_en AS status_en,
      ths.label_en AS statusEn,
      ths.badge_color AS badge_color,
      ths.badge_color AS badgeColor,
      ths.badge_bg AS badge_bg,
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
    LEFT JOIN tree_origin_types tot ON p.origin_id = tot.id
    LEFT JOIN tree_health_statuses ths ON p.status_id = ths.id;
  `);
  db.exec('COMMIT;');
  console.log('✓ Migration committed successfully.');
} catch (err) {
  db.exec('ROLLBACK;');
  console.error('Migration failed, rolled back:', err);
  process.exit(1);
}

console.log('--- Migration Completed Successfully ---');
