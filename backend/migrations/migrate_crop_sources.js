const db = require('../db');

function runCropSourcesMigration() {
  console.log('--- Starting crop_planting_sources Migration ---');

  db.exec(`
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
  `);

  // Ensure mango crop exists in crops table
  const existingMango = db.get("SELECT id FROM crops WHERE code = 'mango'");
  if (!existingMango) {
    db.run(`
      INSERT OR IGNORE INTO crops (
        code, name, single_label, plural_label, offspring_label, code_prefix,
        primary_source_code, usage_type, yield_name, unit, icon, notes, active
      ) VALUES (
        'mango', 'أشجار المانجو', 'شجرة مانجو', 'أشجار مانجو', 'شتلة مطعومة', 'M',
        'G', 'main', 'ثمار المانجو', 'كجم', 'mango', 'محصول فاكهة رئيسي', 1
      )
    `);
    console.log('✓ Added mango crop if not already present.');
  }

  // Update existing crops to ensure proper yield_name and unit
  db.run(`UPDATE crops SET yield_name = 'التمور', unit = 'كجم' WHERE code = 'palm' AND (yield_name IS NULL OR yield_name = '' OR yield_name = 'ثمار');`);
  db.run(`UPDATE crops SET yield_name = 'الزيتون', unit = 'كجم' WHERE code = 'olive' AND (yield_name IS NULL OR yield_name = '' OR yield_name = 'زيتون');`);
  db.run(`UPDATE crops SET yield_name = 'المانجو', unit = 'كجم' WHERE code = 'mango' AND (yield_name IS NULL OR yield_name = '');`);

  // Seed default sources per crop:
  // 1. Date Palm (palm): فسيلة (F, default=1), زراعة أنسجة (N, default=0)
  // 2. Olive (olive): عقلة خضرية (C, default=1), شتلة بذرية (S, default=0)
  // 3. Mango (mango): شتلة مطعومة (G, default=1), ترقيد هوائي (A, default=0)
  const defaultSources = [
    { id: 'cps_palm_f', crop_id: 'palm', name: 'فسيلة', code_letter: 'F', is_default: 1 },
    { id: 'cps_palm_n', crop_id: 'palm', name: 'زراعة أنسجة', code_letter: 'N', is_default: 0 },
    { id: 'cps_olive_c', crop_id: 'olive', name: 'عقلة خضرية', code_letter: 'C', is_default: 1 },
    { id: 'cps_olive_s', crop_id: 'olive', name: 'شتلة بذرية', code_letter: 'S', is_default: 0 },
    { id: 'cps_mango_g', crop_id: 'mango', name: 'شتلة مطعومة', code_letter: 'G', is_default: 1 },
    { id: 'cps_mango_a', crop_id: 'mango', name: 'ترقيد هوائي', code_letter: 'A', is_default: 0 }
  ];

  const stmt = db.db.prepare(`
    INSERT INTO crop_planting_sources (id, crop_id, name, code_letter, is_default)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(crop_id, code_letter) DO UPDATE SET
      name = excluded.name,
      is_default = excluded.is_default
  `);

  for (const s of defaultSources) {
    stmt.run(s.id, s.crop_id, s.name, s.code_letter, s.is_default);
  }

  // Update sources_json in crops table for backward compatibility
  const palmSources = db.all("SELECT code_letter as code, name, is_default as isDefault FROM crop_planting_sources WHERE crop_id = 'palm' ORDER BY is_default DESC");
  const oliveSources = db.all("SELECT code_letter as code, name, is_default as isDefault FROM crop_planting_sources WHERE crop_id = 'olive' ORDER BY is_default DESC");
  const mangoSources = db.all("SELECT code_letter as code, name, is_default as isDefault FROM crop_planting_sources WHERE crop_id = 'mango' ORDER BY is_default DESC");

  db.run("UPDATE crops SET sources_json = ? WHERE code = 'palm'", JSON.stringify(palmSources));
  db.run("UPDATE crops SET sources_json = ? WHERE code = 'olive'", JSON.stringify(oliveSources));
  db.run("UPDATE crops SET sources_json = ? WHERE code = 'mango'", JSON.stringify(mangoSources));

  // Create nursery_prep_types table
  db.exec(`
    CREATE TABLE IF NOT EXISTS nursery_prep_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      crop_id TEXT DEFAULT 'all',
      source_code TEXT DEFAULT 'all',
      active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const prepCount = db.get('SELECT COUNT(*) as count FROM nursery_prep_types');
  if (prepCount.count === 0) {
    const defaultPreps = [
      { id: "np1", name: "فطام وتقليم الفسيلة", crop_id: "palm", source_code: "F", sort_order: 1 },
      { id: "np2", name: "معاملة فطرية وتطهير الجروح", crop_id: "all", source_code: "all", sort_order: 2 },
      { id: "np3", name: "تكييس وترطيب بالخيش", crop_id: "palm", source_code: "F", sort_order: 3 },
      { id: "np4", name: "معاملة بهرمون التجذير (IBA)", crop_id: "olive", source_code: "C", sort_order: 4 },
      { id: "np5", name: "الوضع في غرف الضباب والرطوبة", crop_id: "olive", source_code: "C", sort_order: 5 },
      { id: "np6", name: "أقلمة العقل المجذرة", crop_id: "olive", source_code: "C", sort_order: 6 },
      { id: "np7", name: "تطعيم بالقلم / بالعين", crop_id: "all", source_code: "S", sort_order: 7 },
      { id: "np8", name: "فك شريط التطعيم وتربية الساق", crop_id: "all", source_code: "S", sort_order: 8 },
      { id: "np9", name: "أقلمة نسيجية في الصوب", crop_id: "all", source_code: "N", sort_order: 9 },
      { id: "np10", name: "تجهيز ونقل للزراعة المستديمة", crop_id: "all", source_code: "all", sort_order: 10 }
    ];
    const insPrep = db.db.prepare(`
      INSERT INTO nursery_prep_types (id, name, crop_id, source_code, active, sort_order)
      VALUES (?, ?, ?, ?, 1, ?)
    `);
    for (const p of defaultPreps) {
      insPrep.run(p.id, p.name, p.crop_id, p.source_code, p.sort_order);
    }
    console.log('✓ nursery_prep_types table created and seeded successfully.');
  }

  console.log('✓ crop_planting_sources and nursery_prep_types setup successfully.');
}

if (require.main === module) {
  runCropSourcesMigration();
}

module.exports = { runCropSourcesMigration };
