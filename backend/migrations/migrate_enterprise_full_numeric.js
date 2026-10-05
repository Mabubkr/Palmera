const db = require('../db');
const { uuidv7 } = require('../uuidv7');

console.log('--- Starting Complete Enterprise Schema & ID Normalization ---');

db.exec('PRAGMA foreign_keys = OFF;');
db.exec('BEGIN TRANSACTION;');

try {
  // 1. Drop existing views first (views reference tables)
  db.exec('DROP VIEW IF EXISTS v_palms;');
  db.exec('DROP VIEW IF EXISTS v_operations;');
  db.exec('DROP VIEW IF EXISTS v_offshoots;');
  db.exec('DROP VIEW IF EXISTS v_yields;');

  // =========================================================================
  // 2. Normalize crops table to numeric primary key
  // =========================================================================
  console.log('1. Normalizing crops table...');
  db.exec(`
    CREATE TABLE crops_new (
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
  `);

  const existingCrops = db.all('SELECT * FROM crops');
  const cropCodeToId = {};
  
  // Seed / copy crops
  const defaultCrops = [
    { id: 1, code: 'palm', name: 'نخيل التمر', single: 'نخلة', plural: 'نخيل', offspring: 'فسيلة', codePrefix: 'F', primarySourceCode: 'F', usageType: 'main', yieldName: 'تمر', unit: 'كجم', icon: 'palm', notes: 'محصول رئيسي', sources: [{ code: 'F', name: 'فسيلة' }, { code: 'N', name: 'زراعة أنسجة (نخيل)' }] },
    { id: 2, code: 'olive', name: 'أشجار الزيتون', single: 'شجرة زيتون', plural: 'أشجار زيتون', offspring: 'عقلة خضرية', codePrefix: 'O', primarySourceCode: 'C', usageType: 'intercrop', yieldName: 'زيتون', unit: 'كجم', icon: 'olive', notes: 'محصول بيني', sources: [{ code: 'C', name: 'عقلة خضرية' }, { code: 'S', name: 'شتلة مطعومة' }, { code: 'T', name: 'زراعة أنسجة (أشجار)' }] }
  ];

  const insCrop = db.db.prepare(`
    INSERT INTO crops_new (id, code, name, single_label, plural_label, offspring_label, code_prefix, primary_source_code, usage_type, yield_name, unit, icon, notes, sources_json, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const dc of defaultCrops) {
    cropCodeToId[dc.code] = dc.id;
    cropCodeToId[String(dc.id)] = dc.id;
    const existing = existingCrops.find(c => c.id === dc.code || c.code === dc.code);
    insCrop.run(
      dc.id, dc.code,
      existing?.name || dc.name,
      existing?.single_label || dc.single,
      existing?.plural_label || dc.plural,
      existing?.offspring_label || dc.offspring,
      existing?.code_prefix || dc.codePrefix,
      existing?.primary_source_code || dc.primarySourceCode,
      existing?.usage_type || dc.usageType,
      existing?.yield_name || dc.yieldName,
      existing?.unit || dc.unit,
      existing?.icon || dc.icon,
      existing?.notes || dc.notes,
      existing?.sources_json || JSON.stringify(dc.sources),
      existing?.active ?? 1
    );
  }

  // Any other crops
  let nextCropId = 3;
  for (const c of existingCrops) {
    if (c.id !== 'palm' && c.id !== 'olive' && c.code !== 'palm' && c.code !== 'olive') {
      const assignedId = nextCropId++;
      cropCodeToId[c.id] = assignedId;
      insCrop.run(
        assignedId, c.id, c.name, c.single_label || c.name, c.plural_label || c.name,
        c.offspring_label || 'شتلة', c.code_prefix || 'C', c.primary_source_code || 'S',
        c.usage_type || 'main', c.yield_name || 'ثمار', c.unit || 'كجم', c.icon || 'palm',
        c.notes || '', c.sources_json || '[]', c.active ?? 1
      );
    }
  }

  db.exec('DROP TABLE crops;');
  db.exec('ALTER TABLE crops_new RENAME TO crops;');
  console.log('✓ crops table normalized with numeric IDs (1: palm, 2: olive).');

  // =========================================================================
  // 3. Normalize crop_varieties table to integer crop_id
  // =========================================================================
  console.log('2. Normalizing crop_varieties table...');
  db.exec(`
    CREATE TABLE crop_varieties_new (
      id TEXT PRIMARY KEY,
      crop_id INTEGER NOT NULL REFERENCES crops(id),
      name TEXT NOT NULL,
      usage_desc TEXT,
      UNIQUE(crop_id, name)
    );
  `);

  const existingVars = db.all('SELECT * FROM crop_varieties');
  const insVar = db.db.prepare('INSERT INTO crop_varieties_new (id, crop_id, name, usage_desc) VALUES (?, ?, ?, ?)');
  for (const v of existingVars) {
    const cid = cropCodeToId[v.crop_id] || (v.crop_id === 'olive' || v.crop_id === '2' ? 2 : 1);
    insVar.run(v.id, cid, v.name, v.usage_desc || null);
  }
  db.exec('DROP TABLE crop_varieties;');
  db.exec('ALTER TABLE crop_varieties_new RENAME TO crop_varieties;');
  console.log('✓ crop_varieties table normalized with numeric crop_id.');

  // =========================================================================
  // 4. Normalize palms table: Integer primary key & numeric crop_id
  // =========================================================================
  console.log('3. Normalizing palms table to INTEGER PRIMARY KEY...');
  const oldPalms = db.all('SELECT * FROM palms ORDER BY rowid ASC');
  const oldPalmIdToNewId = {};
  
  db.exec(`
    CREATE TABLE palms_new (
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
      parent_palm_id INTEGER REFERENCES palms_new(id),
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
  `);

  const insNewPalm = db.db.prepare(`
    INSERT INTO palms_new (id, code, crop_id, source_type, variety_id, sector_id, plot_id, seq_no, plant_date, origin_id, supplier, parent_palm_id, temp_code, status_id, offshoot_count, lineage_path, gps_lat, gps_lng, nursery_age_months, is_locked, is_archived, is_deleted, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let newPalmIdCounter = 1;
  for (const p of oldPalms) {
    const assignedId = newPalmIdCounter++;
    oldPalmIdToNewId[p.id] = assignedId;
    oldPalmIdToNewId[String(p.id)] = assignedId;
  }

  for (const p of oldPalms) {
    const assignedId = oldPalmIdToNewId[p.id];
    const cid = cropCodeToId[p.crop_id] || (p.crop_id === 'olive' || p.crop_id === '2' ? 2 : 1);
    const parentId = p.parent_palm_id ? (oldPalmIdToNewId[p.parent_palm_id] || null) : null;
    insNewPalm.run(
      assignedId,
      p.code,
      cid,
      p.source_type || 'F',
      p.variety_id || 'cv1',
      p.sector_id || '01',
      p.plot_id || '01-01A',
      p.seq_no || '001',
      p.plant_date || '2025-01-01',
      p.origin_id || 1,
      p.supplier || '',
      parentId,
      p.temp_code || null,
      p.status_id || 1,
      p.offshoot_count || 0,
      p.lineage_path || null,
      p.gps_lat || null,
      p.gps_lng || null,
      p.nursery_age_months || 0,
      p.is_locked || 0,
      p.is_archived || 0,
      p.is_deleted || 0,
      p.notes || null,
      p.created_at || new Date().toISOString().replace('T', ' ').slice(0, 19)
    );
  }

  db.exec('DROP TABLE palms;');
  db.exec('ALTER TABLE palms_new RENAME TO palms;');
  console.log(`✓ palms table migrated to INTEGER PRIMARY KEY (Total: ${oldPalms.length} trees).`);

  // =========================================================================
  // 5. Normalize operations table: UUIDv7 IDs and integer palm_id
  // =========================================================================
  console.log('4. Normalizing operations table to UUIDv7 and integer palm_id...');
  const oldOps = db.all('SELECT * FROM operations');
  
  db.exec(`
    CREATE TABLE operations_new (
      id TEXT PRIMARY KEY,
      palm_id INTEGER NOT NULL REFERENCES palms(id),
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
  `);

  const insNewOp = db.db.prepare(`
    INSERT INTO operations_new (id, palm_id, type_id, worker_id, performed_at, status_id, approval_id, approved_by, supervisor_notes, worker_notes, device_info, gps_lat, gps_lng, photos, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  let opCount = 0;
  for (const o of oldOps) {
    const newPalmId = oldPalmIdToNewId[o.palm_id];
    if (!newPalmId) continue; // skip orphans if any
    
    // Generate valid UUIDv7 embedding the performed_at timestamp if it was legacy op... string
    let opId = o.id;
    if (!uuidPattern.test(opId)) {
      opId = uuidv7(o.performed_at);
    }

    insNewOp.run(
      opId,
      newPalmId,
      o.type_id || 'op1',
      o.worker_id || 'u3',
      o.performed_at || new Date().toISOString(),
      o.status_id || 3,
      o.approval_id || 1,
      o.approved_by || null,
      o.supervisor_notes || '',
      o.worker_notes || '',
      o.device_info || null,
      o.gps_lat || null,
      o.gps_lng || null,
      o.photos || '[]',
      o.created_at || new Date().toISOString().replace('T', ' ').slice(0, 19)
    );
    opCount++;
  }

  db.exec('DROP TABLE operations;');
  db.exec('ALTER TABLE operations_new RENAME TO operations;');
  console.log(`✓ operations table migrated to UUIDv7 and integer palm_id (Total: ${opCount} ops).`);

  // =========================================================================
  // 6. Normalize offshoots table: Integer mother_id & planted_palm_id & approval_id
  // =========================================================================
  console.log('5. Normalizing offshoots table...');
  const oldOffshoots = db.all('SELECT * FROM offshoots');
  
  db.exec(`
    CREATE TABLE offshoots_new (
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
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const insNewOff = db.db.prepare(`
    INSERT INTO offshoots_new (id, mother_id, temp_code, seq_no, separation_date, weight_kg, diameter_cm, variety_id, status_id, origin_id, approval_id, supplier, nursery_stage, planted_palm_id, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const o of oldOffshoots) {
    const motherId = o.mother_id ? (oldPalmIdToNewId[o.mother_id] || null) : null;
    const plantedId = o.planted_palm_id ? (oldPalmIdToNewId[o.planted_palm_id] || null) : null;
    let approvalId = o.approval_id || 2;
    if (o.approval_status) {
      approvalId = o.approval_status === 'approved' ? 2 : (o.approval_status === 'rejected' ? 3 : 1);
    }
    insNewOff.run(
      o.id,
      motherId,
      o.temp_code || null,
      o.seq_no || '01',
      o.separation_date || '2025-01-01',
      o.weight_kg || 0,
      o.diameter_cm || 0,
      o.variety_id || 'cv1',
      o.status_id || 1,
      o.origin_id || 1,
      approvalId,
      o.supplier || '',
      o.nursery_stage || 'issued',
      plantedId,
      o.notes || null,
      o.created_at || new Date().toISOString().replace('T', ' ').slice(0, 19)
    );
  }

  db.exec('DROP TABLE offshoots;');
  db.exec('ALTER TABLE offshoots_new RENAME TO offshoots;');
  console.log('✓ offshoots table normalized with integer mother/planted IDs and approval_id.');

  // =========================================================================
  // 7. Normalize yields table: Integer palm_id & numeric crop_id
  // =========================================================================
  console.log('6. Normalizing yields table...');
  const oldYields = db.all('SELECT * FROM yields');
  
  db.exec(`
    CREATE TABLE yields_new (
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
  `);

  const insNewYield = db.db.prepare(`
    INSERT INTO yields_new (id, batch_no, harvest_level, palm_id, plot_id, sector_id, season, harvest_date, crop_id, variety_id, quality_id, kg_total, kg_excellent, kg_good, kg_low, boxes_count, recorded_by, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const y of oldYields) {
    const palmId = y.palm_id ? (oldPalmIdToNewId[y.palm_id] || null) : null;
    const cid = cropCodeToId[y.crop_id] || (y.crop_id === 'olive' || y.crop_id === '2' ? 2 : 1);
    insNewYield.run(
      y.id,
      y.batch_no || 'BATCH-DEFAULT',
      y.harvest_level || 'plot',
      palmId,
      y.plot_id || '01-01A',
      y.sector_id || '01',
      y.season || '2026',
      y.harvest_date || '2026-09-01',
      cid,
      y.variety_id || 'cv1',
      y.quality_id || 1,
      y.kg_total || 0,
      y.kg_excellent || 0,
      y.kg_good || 0,
      y.kg_low || 0,
      y.boxes_count || 0,
      y.recorded_by || null,
      y.notes || null,
      y.created_at || new Date().toISOString().replace('T', ' ').slice(0, 19)
    );
  }

  db.exec('DROP TABLE yields;');
  db.exec('ALTER TABLE yields_new RENAME TO yields;');
  console.log('✓ yields table normalized with integer IDs and numeric crop_id.');

  // =========================================================================
  // 8. Normalize zakat_records table: numeric crop_id
  // =========================================================================
  console.log('7. Normalizing zakat_records table...');
  const oldZakat = db.all('SELECT * FROM zakat_records');
  db.exec(`
    CREATE TABLE zakat_records_new (
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
  `);

  const insNewZakat = db.db.prepare(`
    INSERT INTO zakat_records_new (id, investor_id, season, crop_id, due_kg, due_amount, choice_type, charity_id, status_id, pledge_status, pledge_signed_at, pledge_doc_type, journey_stage, batch_id, receipt_no, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const z of oldZakat) {
    const cid = cropCodeToId[z.crop_id] || (z.crop_id === 'olive' || z.crop_id === '2' ? 2 : 1);
    const statusId = z.status === 'approved' ? 2 : (z.status === 'rejected' ? 3 : 1);
    insNewZakat.run(
      z.id,
      z.investor_id,
      z.season || '2026',
      cid,
      z.due_kg || 0,
      z.due_amount || 0,
      z.choice_type || 'in_kind',
      z.charity_id || null,
      statusId,
      z.pledge_status || 'draft',
      z.pledge_signed_at || null,
      z.pledge_doc_type || null,
      z.journey_stage || 'pledged',
      z.batch_id || null,
      z.receipt_no || null,
      z.created_at || new Date().toISOString().replace('T', ' ').slice(0, 19)
    );
  }
  db.exec('DROP TABLE zakat_records;');
  db.exec('ALTER TABLE zakat_records_new RENAME TO zakat_records;');
  console.log('✓ zakat_records table normalized with numeric crop_id and status_id.');

  // =========================================================================
  // 9. Recreate Counter Cache & Summary Tables
  // =========================================================================
  db.exec(`
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
  `);

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

  // =========================================================================
  // 10. Recreate Dynamic SQL Views (100% Backward Compatible for Frontend PWA)
  // =========================================================================
  console.log('8. Recreating Dynamic SQL Views...');
  
  // v_palms
  db.exec(`
    CREATE VIEW v_palms AS
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
    LEFT JOIN tree_origin_types tot ON p.origin_id = tot.id
    LEFT JOIN tree_health_statuses ths ON p.status_id = ths.id;
  `);

  // v_operations
  db.exec(`
    CREATE VIEW v_operations AS
    SELECT 
      o.id,
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
  `);

  // v_offshoots
  db.exec(`
    CREATE VIEW v_offshoots AS
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
      o.is_opening_stock,
      o.is_opening_stock AS isOpeningStock,
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
  `);

  // v_yields
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

  // =========================================================================
  // 11. High Performance Indexes (Zero Table Scans)
  // =========================================================================
  console.log('9. Rebuilding High-Performance B-Tree Indexes...');
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

  db.exec('COMMIT;');
  db.exec('PRAGMA foreign_keys = ON;');
  console.log('--- Full Enterprise Normalization Completed Successfully! ---');
} catch (err) {
  db.exec('ROLLBACK;');
  db.exec('PRAGMA foreign_keys = ON;');
  console.error('Migration failed, rolled back:', err);
  process.exit(1);
}
