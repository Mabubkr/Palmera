const { db, all, get } = require('../db.js');

console.log('=== VERIFYING DATABASE TABLES AND COLUMNS ===');
const tables = all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
console.log(`Total Tables: ${tables.length}`);

let badCount = 0;
for (const t of tables) {
  if (t.name.toLowerCase().includes('company') || t.name.toLowerCase().includes('project')) {
    console.error(`[FAIL] Table contains forbidden keyword: ${t.name}`);
    badCount++;
  }
  const cols = all(`PRAGMA table_info("${t.name}")`);
  for (const c of cols) {
    if (c.name.toLowerCase().includes('company') || c.name.toLowerCase().includes('project')) {
      console.error(`[FAIL] Table ${t.name} column contains forbidden keyword: ${c.name}`);
      badCount++;
    }
  }
}

const views = all("SELECT name FROM sqlite_master WHERE type='view' ORDER BY name");
console.log(`Total Views: ${views.length}`);
for (const v of views) {
  if (v.name.toLowerCase().includes('company') || v.name.toLowerCase().includes('project')) {
    console.error(`[FAIL] View contains forbidden keyword: ${v.name}`);
    badCount++;
  }
}

// Row counts check
const checks = [
  'palms',
  'operations',
  'plots',
  'sectors',
  'fertilizers',
  'offshoots',
  'yields',
  'zakat_records',
  'audit_logs',
  'users',
  'tree_health_statuses',
  'tree_origin_types',
  'yield_quality_grades',
  'operation_approval_statuses',
  'operation_sync_statuses',
  'crops',
  'crop_varieties',
  'propagation_source_types'
];

console.log('\n=== RECORD COUNTS ===');
for (const tbl of checks) {
  try {
    const row = get(`SELECT count(*) as count FROM "${tbl}"`);
    console.log(`- ${tbl}: ${row.count}`);
  } catch (err) {
    console.error(`Error counting ${tbl}:`, err.message);
  }
}

console.log('\n=== RESULT ===');
if (badCount === 0) {
  console.log('SUCCESS: ZERO tables or columns containing company or project!');
} else {
  console.error(`FAILED: Found ${badCount} forbidden entities.`);
  process.exit(1);
}
