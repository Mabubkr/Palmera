const db = require('../../db');

console.log("--- Starting Database Audit Columns Migration ---");

function addColumnIfNotExists(table, columnDef) {
  const colName = columnDef.split(' ')[0];
  const cols = db.all(`PRAGMA table_info(${table})`).map(c => c.name);
  if (!cols.includes(colName)) {
    console.log(`Adding column ${colName} to ${table}...`);
    db.run(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
    console.log(`✓ Added ${colName} to ${table}`);
  } else {
    console.log(`- Column ${colName} already exists in ${table}`);
  }
}

// 1. Palms audit columns
addColumnIfNotExists('palms', 'created_by TEXT');
addColumnIfNotExists('palms', 'modified_by TEXT');
addColumnIfNotExists('palms', 'modified_at DATETIME');

// 2. Operations audit columns
addColumnIfNotExists('palms', 'created_by TEXT');
addColumnIfNotExists('operations', 'created_by TEXT');
addColumnIfNotExists('operations', 'modified_by TEXT');
addColumnIfNotExists('operations', 'modified_at DATETIME');

// 3. Yields audit columns
addColumnIfNotExists('yields', 'created_by TEXT');
addColumnIfNotExists('yields', 'modified_by TEXT');
addColumnIfNotExists('yields', 'modified_at DATETIME');

// 4. Plots audit columns
addColumnIfNotExists('plots', 'created_by TEXT');
addColumnIfNotExists('plots', 'modified_by TEXT');
addColumnIfNotExists('plots', 'modified_at DATETIME');

// 5. Recreate v_palms view to include created_by, modified_by, modified_at
console.log("Recreating v_palms view...");
db.run("DROP VIEW IF EXISTS v_palms");
db.run(`
  CREATE VIEW v_palms AS
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
    LEFT JOIN palms pp ON p.parent_palm_id = pp.id
`);
console.log("✓ v_palms view recreated with audit columns");

// 6. Recreate v_operations view to include created_by, modified_by, modified_at
console.log("Recreating v_operations view...");
db.run("DROP VIEW IF EXISTS v_operations");
db.run(`
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
    LEFT JOIN plots pl ON o.plot_id = pl.id
`);
console.log("✓ v_operations view recreated with audit columns");

console.log("--- Migration Completed Successfully ---");
