/**
 * PalmTrace - Reverse Sync Tool (Render PostgreSQL ➔ Local SQLite)
 * Pulls all data from Render PostgreSQL to local SQLite database
 */

const { DatabaseSync } = require('node:sqlite');
const { Client } = require('pg');
const path = require('node:path');

const config = require('../config'); // loads .env
const PG_URL = process.env.RENDER_PG_URL;
if (!PG_URL) {
  console.error('RENDER_PG_URL is not set. Add it to the .env file (see .env.example).');
  process.exit(1);
}
const SQLITE_PATH = process.env.SQLITE_PATH || config.DB_PATH;

console.log('=================================================================');
console.log('   PalmTrace Database Pull: Render PostgreSQL ➔ Local SQLite');
console.log('=================================================================');
console.log(`Source Postgres: ${PG_URL.split('@')[1] || PG_URL}`);
console.log(`Target SQLite:   ${SQLITE_PATH}`);
console.log('-----------------------------------------------------------------\n');

async function pull() {
  const pg = new Client({
    connectionString: PG_URL,
    ssl: { rejectUnauthorized: false }
  });

  await pg.connect();
  console.log('✓ Connected to Render PostgreSQL.\n');

  const sqlite = new DatabaseSync(SQLITE_PATH);

  // Get all tables in PG public schema
  const pgTablesRes = await pg.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  const tables = pgTablesRes.rows.map(r => r.table_name);
  console.log(`Found ${tables.length} tables in PostgreSQL to sync.\n`);

  for (const tableName of tables) {
    const pgCountRes = await pg.query(`SELECT COUNT(*)::bigint as c FROM "${tableName}";`);
    const pgCount = parseInt(pgCountRes.rows[0].c, 10);

    if (pgCount === 0) {
      console.log(`Table "${tableName}": 0 rows (skipped).`);
      continue;
    }

    process.stdout.write(`Syncing table "${tableName}" (${pgCount} rows)... `);

    // Read all rows from PG
    const rowsRes = await pg.query(`SELECT * FROM "${tableName}";`);
    const rows = rowsRes.rows;

    sqlite.exec(`DELETE FROM "${tableName}";`);

    if (rows.length > 0) {
      const cols = Object.keys(rows[0]);
      const colList = cols.map(c => `"${c}"`).join(', ');
      const placeholders = cols.map(() => '?').join(', ');
      const insertStmt = sqlite.prepare(`INSERT OR REPLACE INTO "${tableName}" (${colList}) VALUES (${placeholders});`);

      sqlite.exec('BEGIN TRANSACTION;');
      for (const row of rows) {
        const vals = cols.map(c => row[c]);
        insertStmt.run(...vals);
      }
      sqlite.exec('COMMIT;');
    }

    const sqliteCount = sqlite.prepare(`SELECT COUNT(*) as c FROM "${tableName}"`).get().c;
    console.log(`✓ ${sqliteCount} rows updated.`);
  }

  await pg.end();
  console.log('\n=================================================================');
  console.log('🎉 Pull Complete: Local SQLite is now synchronized with Render!');
  console.log('=================================================================');
}

pull().catch(err => {
  console.error('\n❌ Pull Error:', err.message);
  process.exit(1);
});
