const db = require('../db');
const bcrypt = require('bcryptjs');

console.log('--- Checking admin user ---');
let admin = db.get("SELECT id, username, password_hash, full_name, role FROM users WHERE username = 'admin'");
const defaultHash = bcrypt.hashSync('1234', 10);

if (!admin) {
  console.log('Admin user missing. Creating admin / 1234...');
  db.run("INSERT INTO users (id, username, password_hash, full_name, role, phone) VALUES (?, ?, ?, ?, ?, ?)",
    'u1', 'admin', defaultHash, 'إدارة الشركة', 'admin', '01000000001');
  admin = db.get("SELECT id, username, password_hash, full_name, role FROM users WHERE username = 'admin'");
} else {
  const matches = bcrypt.compareSync('1234', admin.password_hash);
  console.log('Admin user exists. Password 1234 valid:', matches);
  if (!matches) {
    console.log('Resetting admin password to 1234...');
    db.run("UPDATE users SET password_hash = ? WHERE username = 'admin'", defaultHash);
  }
}

console.log('--- Starting operational inventory purge ---');
// Disable foreign keys temporarily during table cleanup
db.exec('PRAGMA foreign_keys = OFF;');

const tablesToPurge = [
  'palms',
  'offshoots',
  'plots',
  'sectors',
  'yields',
  'operations',
  'operation_materials',
  'tree_notes',
  'contract_plots',
  'contract_service_invoices',
  'zakat_records',
  'fertilizer_season_balances',
  'plot_summaries',
  'user_plots'
];

tablesToPurge.forEach(tbl => {
  try {
    const beforeCount = db.get(`SELECT COUNT(*) as c FROM ${tbl}`)?.c || 0;
    db.exec(`DELETE FROM ${tbl};`);
    try { db.exec(`DELETE FROM sqlite_sequence WHERE name = '${tbl}';`); } catch {}
    console.log(`✓ Purged table [${tbl}]: ${beforeCount} rows removed.`);
  } catch (err) {
    console.warn(`! Notice on table [${tbl}]:`, err.message);
  }
});

// Reset contract totals
try {
  db.exec('UPDATE investment_contracts SET total_trees = 0, total_area = 0;');
  console.log('✓ Reset investment_contracts totals to 0.');
} catch (err) {
  console.warn('Notice on contracts reset:', err.message);
}

db.exec('PRAGMA foreign_keys = ON;');
db.exec('VACUUM;');

console.log('--- Verification after purge ---');
const postCounts = {
  users: db.get('SELECT COUNT(*) as c FROM users').c,
  roles: db.get('SELECT COUNT(*) as c FROM roles').c,
  contract_templates: db.get('SELECT COUNT(*) as c FROM contract_templates').c,
  crops: db.get('SELECT COUNT(*) as c FROM crops').c,
  crop_varieties: db.get('SELECT COUNT(*) as c FROM crop_varieties').c,
  fertilizers: db.get('SELECT COUNT(*) as c FROM fertilizers').c,
  sectors: db.get('SELECT COUNT(*) as c FROM sectors').c,
  plots: db.get('SELECT COUNT(*) as c FROM plots').c,
  palms: db.get('SELECT COUNT(*) as c FROM palms').c,
  offshoots: db.get('SELECT COUNT(*) as c FROM offshoots').c,
  yields: db.get('SELECT COUNT(*) as c FROM yields').c,
  operations: db.get('SELECT COUNT(*) as c FROM operations').c
};
console.log('Post-purge row counts:', postCounts);
console.log('Database successfully cleaned for a fresh start!');

