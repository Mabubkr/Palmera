// Versioned schema migrations.
//
// Files in migrations/versioned are named NNN_description.js and export { description, up(db) }.
// Each one runs once, inside a transaction, and is recorded in the schema_migrations table.
// To change the schema: add the next numbered file. Never edit a migration that has already shipped.
//
// phase: 'early' (default) runs when the database is opened (db.js), before the legacy startup
// migrations in startup.js; 'late' runs after them (needed when a legacy step rebuilds a table).
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, 'versioned');

function runVersionedMigrations(db, phase = 'early') {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    description TEXT,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );`);
  const applied = new Set(db.prepare('SELECT version FROM schema_migrations').all().map(r => r.version));
  const files = fs.readdirSync(DIR).filter(f => /^\d{3}_.+\.js$/.test(f)).sort();
  for (const file of files) {
    const version = file.slice(0, 3);
    if (applied.has(version)) continue;
    const mig = require(path.join(DIR, file));
    if ((mig.phase || 'early') !== phase) continue;
    db.exec('BEGIN');
    try {
      mig.up(db);
      db.prepare('INSERT INTO schema_migrations (version, description) VALUES (?, ?)').run(version, mig.description || file);
      db.exec('COMMIT');
      console.log(`[migrations] applied ${file}`);
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch {}
      console.error(`[migrations] FAILED ${file}:`, e.message);
      throw e;
    }
  }
}

module.exports = { runVersionedMigrations };
