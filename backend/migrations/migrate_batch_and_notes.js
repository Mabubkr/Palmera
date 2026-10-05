const db = require('../db');

function runBatchAndNotesMigration() {
  console.log('--- Starting Migration for Batch Operations, Scope Types, and Tree Notes ---');

  // 1. Ensure operations table allows nullable palm_id for batch / sector operations
  const palmIdCol = db.all('PRAGMA table_info(operations)').find(c => c.name === 'palm_id');
  if (palmIdCol && palmIdCol.notnull === 1) {
    console.log('Rebuilding operations table to remove NOT NULL constraint on palm_id...');
    try {
      db.exec('PRAGMA foreign_keys = OFF;');
      db.exec('BEGIN TRANSACTION;');
      db.exec(`
        CREATE TABLE operations_new (
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
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          batch_id TEXT,
          target_level TEXT DEFAULT 'tree',
          sector_id TEXT,
          plot_id TEXT,
          tree_count INTEGER DEFAULT 1
        );
      `);
      db.exec(`
        INSERT INTO operations_new (
          id, palm_id, type_id, worker_id, performed_at, status_id, approval_id,
          approved_by, supervisor_notes, worker_notes, device_info, gps_lat, gps_lng, photos, created_at,
          batch_id, target_level, sector_id, plot_id, tree_count
        )
        SELECT 
          id, palm_id, type_id, worker_id, performed_at, status_id, approval_id,
          approved_by, supervisor_notes, worker_notes, device_info, gps_lat, gps_lng, photos, created_at,
          batch_id, target_level, sector_id, plot_id, tree_count
        FROM operations;
      `);
      db.exec('DROP VIEW IF EXISTS v_operations;');
      db.exec('DROP TABLE operations;');
      db.exec('ALTER TABLE operations_new RENAME TO operations;');
      db.exec('CREATE INDEX IF NOT EXISTS idx_ops_approval ON operations(approval_id);');
      db.exec('CREATE INDEX IF NOT EXISTS idx_ops_palm_id ON operations(palm_id);');
      db.exec('CREATE INDEX IF NOT EXISTS idx_ops_palm_time ON operations(palm_id, performed_at);');
      db.exec('CREATE INDEX IF NOT EXISTS idx_ops_palm_type_date ON operations(palm_id, type_id, performed_at DESC);');
      db.exec('CREATE INDEX IF NOT EXISTS idx_ops_status ON operations(status_id);');
      db.exec('CREATE INDEX IF NOT EXISTS idx_ops_status_appr ON operations(status_id, approval_id);');
      db.exec('CREATE INDEX IF NOT EXISTS idx_ops_worker ON operations(worker_id);');
      db.exec('CREATE INDEX IF NOT EXISTS idx_ops_worker_time ON operations(worker_id, performed_at);');
      db.exec('CREATE INDEX IF NOT EXISTS idx_ops_batch_id ON operations(batch_id);');
      db.exec(`
        CREATE VIEW v_operations AS
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
      `);
      db.exec('COMMIT;');
      db.exec('PRAGMA foreign_keys = ON;');
      console.log('Operations table successfully migrated to allow nullable palm_id!');
    } catch (migErr) {
      try { db.exec('ROLLBACK;'); } catch (_) {}
      try { db.exec('PRAGMA foreign_keys = ON;'); } catch (_) {}
      console.error('Failed to rebuild operations table:', migErr);
    }
  }

  // 1. Add batch and scope columns to operations table (fallback if not already present)
  try { db.exec("ALTER TABLE operations ADD COLUMN batch_id TEXT;"); } catch (e) {}
  try { db.exec("ALTER TABLE operations ADD COLUMN target_level TEXT DEFAULT 'tree';"); } catch (e) {}
  try { db.exec("ALTER TABLE operations ADD COLUMN sector_id TEXT;"); } catch (e) {}
  try { db.exec("ALTER TABLE operations ADD COLUMN plot_id TEXT;"); } catch (e) {}
  try { db.exec("ALTER TABLE operations ADD COLUMN tree_count INTEGER DEFAULT 1;"); } catch (e) {}

// 2. Add scope and classification columns to operation_types table
try { db.exec("ALTER TABLE operation_types ADD COLUMN scope_type TEXT DEFAULT 'both';"); console.log('Added scope_type to operation_types'); } catch (e) {}
try { db.exec("ALTER TABLE operation_types ADD COLUMN is_critical INTEGER DEFAULT 0;"); console.log('Added is_critical to operation_types'); } catch (e) {}
try { db.exec("ALTER TABLE operation_types ADD COLUMN requires_approval INTEGER DEFAULT 1;"); console.log('Added requires_approval to operation_types'); } catch (e) {}
try { db.exec("ALTER TABLE operation_types ADD COLUMN active INTEGER DEFAULT 1;"); console.log('Added active to operation_types'); } catch (e) {}

// 3. Populate default operation types according to practical specifications
const defaultCatalog = [
  { id: 'op1', scope_type: 'both', is_critical: 0, requires_material: 0, allowed_kinds: null }, // تقليم
  { id: 'op2', scope_type: 'both', is_critical: 0, requires_material: 0, allowed_kinds: null }, // تكريب
  { id: 'op9', scope_type: 'both', is_critical: 0, requires_material: 0, allowed_kinds: null }, // كسر سعف
  { id: 'op3', scope_type: 'both', is_critical: 0, requires_material: 0, allowed_kinds: null }, // تلقيح
  { id: 'op4', scope_type: 'both', is_critical: 0, requires_material: 0, allowed_kinds: null }, // تكييس
  { id: 'op_thin', name: 'خف عذوق', category_id: 'c_d', scope_type: 'both', is_critical: 0, requires_material: 0, allowed_kinds: null },
  { id: 'op5', scope_type: 'bulk', is_critical: 0, requires_material: 0, allowed_kinds: null }, // خدمة شتوية
  { id: 'op6', scope_type: 'bulk', is_critical: 0, requires_material: 1, allowed_kinds: '["عضوي"]' }, // تسميد عضوي
  { id: 'op7', scope_type: 'bulk', is_critical: 0, requires_material: 1, allowed_kinds: '["كيميائي"]' }, // تسميد كيميائي
  { id: 'op10', scope_type: 'bulk', is_critical: 0, requires_material: 0, allowed_kinds: null }, // ري إضافي
  { id: 'op_pest', name: 'رش وقائي', category_id: 'c_i', scope_type: 'bulk', is_critical: 0, requires_material: 1, allowed_kinds: '["مبيد"]' },
  { id: 'op_curative', name: 'رش علاجي / سوسة', category_id: 'c_i', scope_type: 'both', is_critical: 1, requires_material: 1, allowed_kinds: '["مبيد"]' },
  { id: 'op8', scope_type: 'individual', is_critical: 1, requires_material: 1, allowed_kinds: '["مبيد"]' }, // إصابة سوسة (بلاغ)
  { id: 'op_offshoot', name: 'قلع فسيلة', category_id: 'c_d', scope_type: 'individual', is_critical: 0, requires_material: 0, allowed_kinds: null },
  { id: 'op_harvest', name: 'جني / تسجيل محصول', category_id: 'c_d', scope_type: 'both', is_critical: 0, requires_material: 0, allowed_kinds: null },
  { id: 'op_archive', name: 'أرشفة نخلة', category_id: 'c_o', scope_type: 'individual', is_critical: 1, requires_material: 0, allowed_kinds: null }
];

defaultCatalog.forEach(item => {
  const existing = db.get('SELECT id FROM operation_types WHERE id = ? OR name = ?', item.id, item.name || '');
  if (existing) {
    db.run(
      'UPDATE operation_types SET scope_type = ?, is_critical = ?, requires_material = COALESCE(?, requires_material) WHERE id = ?',
      item.scope_type, item.is_critical, item.requires_material, existing.id
    );
  } else if (item.name) {
    db.run(
      'INSERT INTO operation_types (id, category_id, name, requires_material, allowed_kinds, scope_type, is_critical, requires_approval) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      item.id, item.category_id || 'c_d', item.name, item.requires_material || 0, item.allowed_kinds || null, item.scope_type, item.is_critical, 1
    );
  }
});

// 4. Create tree_notes table
db.exec(`
CREATE TABLE IF NOT EXISTS tree_notes (
    id TEXT PRIMARY KEY,
    palm_id INTEGER REFERENCES palms(id),
    palm_code TEXT,
    author_id TEXT NOT NULL REFERENCES users(id),
    author_name TEXT,
    note_type TEXT NOT NULL DEFAULT 'general',
    priority TEXT NOT NULL DEFAULT 'normal',
    content TEXT NOT NULL,
    attachments TEXT,
    visibility_scope TEXT NOT NULL DEFAULT 'all_team',
    assigned_to_user_id TEXT REFERENCES users(id),
    assigned_to_user_name TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    execution_notes TEXT,
    execution_proof_photo TEXT,
    executed_at DATETIME,
    executed_by_id TEXT REFERENCES users(id),
    closed_at DATETIME,
    closed_by_id TEXT REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tree_notes_palm ON tree_notes(palm_id);
CREATE INDEX IF NOT EXISTS idx_tree_notes_assigned ON tree_notes(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_tree_notes_status ON tree_notes(status);
`);

// 5. Recreate v_operations view
db.exec('DROP VIEW IF EXISTS v_operations;');
db.exec(`
CREATE VIEW v_operations AS
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

  // 6. Rebuild yields table to remove restrictive foreign keys on plot_id and sector_id
  const yieldsSql = db.get("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'yields'");
  if (yieldsSql && yieldsSql.sql && (yieldsSql.sql.includes('FOREIGN KEY (plot_id)') || yieldsSql.sql.includes('plot_id TEXT NOT NULL'))) {
    console.log('Rebuilding yields table to support multi-plot and sector-wide harvests...');
    try {
      db.exec('PRAGMA foreign_keys = OFF;');
      db.exec('BEGIN TRANSACTION;');
      db.exec(`
        CREATE TABLE yields_new (
          id TEXT PRIMARY KEY,
          batch_no TEXT NOT NULL,
          harvest_level TEXT DEFAULT 'plot',
          palm_id INTEGER REFERENCES palms(id),
          plot_id TEXT,
          sector_id TEXT,
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
          recorded_by TEXT REFERENCES users(id),
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      db.exec(`
        INSERT INTO yields_new (
          id, batch_no, harvest_level, palm_id, plot_id, sector_id, season, harvest_date,
          crop_id, variety_id, quality_id, kg_total, kg_excellent, kg_good, kg_low,
          boxes_count, recorded_by, notes, created_at
        )
        SELECT 
          id, batch_no, harvest_level, palm_id, plot_id, sector_id, season, harvest_date,
          crop_id, variety_id, quality_id, kg_total, kg_excellent, kg_good, kg_low,
          boxes_count, recorded_by, notes, created_at
        FROM yields;
      `);
      db.exec('DROP VIEW IF EXISTS v_yields;');
      db.exec('DROP TABLE yields;');
      db.exec('ALTER TABLE yields_new RENAME TO yields;');
      db.exec('CREATE INDEX IF NOT EXISTS idx_yields_crop ON yields(crop_id);');
      db.exec('CREATE INDEX IF NOT EXISTS idx_yields_season ON yields(season);');
      db.exec('CREATE INDEX IF NOT EXISTS idx_yields_date ON yields(harvest_date);');
      db.exec('CREATE INDEX IF NOT EXISTS idx_yields_quality ON yields(quality_id);');
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
      db.exec('COMMIT;');
      db.exec('PRAGMA foreign_keys = ON;');
      console.log('Yields table successfully migrated!');
    } catch (yErr) {
      try { db.exec('ROLLBACK;'); } catch (_) {}
      try { db.exec('PRAGMA foreign_keys = ON;'); } catch (_) {}
      console.error('Failed to rebuild yields table:', yErr);
    }
  }

  try {
    db.run(
      'INSERT OR IGNORE INTO operation_approval_statuses (id, code, label_ar, label_en, badge_color, badge_bg) VALUES (?, ?, ?, ?, ?, ?)',
      4, 'needs_rework', 'مطلوب إعادة التنفيذ', 'Needs Rework', '#C2410C', '#FFEDD5'
    );
    db.run(
      'INSERT OR IGNORE INTO operation_approval_statuses (id, code, label_ar, label_en, badge_color, badge_bg) VALUES (?, ?, ?, ?, ?, ?)',
      5, 'voided', 'ملغاة ومغلقة', 'Voided & Closed', '#64748B', '#F1F5F9'
    );
  } catch (e) {
    console.error('Failed to insert missing approval statuses:', e);
  }

  console.log('--- Migration Finished Successfully! ---');
}

if (require.main === module) {
  runBatchAndNotesMigration();
}

module.exports = { runBatchAndNotesMigration };
