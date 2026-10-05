const db = require('../db');

console.log('=== INDEXES referencing project/company ===');
const indexes = db.all("SELECT name, tbl_name, sql FROM sqlite_master WHERE type = 'index' AND (sql LIKE '%project%' OR sql LIKE '%company%')");
indexes.forEach(i => console.log(`${i.tbl_name} -> ${i.name}: ${i.sql}`));

console.log('\n=== TABLES with company or project in their name or columns ===');
const tables = db.all("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'");
for (const t of tables) {
  const cols = db.all(`PRAGMA table_info(${t.name})`);
  const cpCols = cols.filter(c => c.name.includes('company') || c.name.includes('project')).map(c => c.name);
  if (cpCols.length > 0 || t.name === 'companies' || t.name === 'projects' || t.name === 'user_project_access') {
    console.log(`\nTable ${t.name}: cols = [${cpCols.join(', ')}]`);
    console.log(`CREATE SQL:\n${t.sql}`);
  }
}

