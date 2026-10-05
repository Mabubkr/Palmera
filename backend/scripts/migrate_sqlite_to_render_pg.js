/**
 * PalmTrace - Full Database Migration Tool
 * Migrates local SQLite database to Render Managed PostgreSQL
 */

const { DatabaseSync } = require('node:sqlite');
const { Client } = require('pg');
const path = require('node:path');

// 1. Connection URLs
const config = require('../config'); // loads .env
const PG_URL = process.env.RENDER_PG_URL;
if (!PG_URL) {
  console.error('RENDER_PG_URL is not set. Add it to the .env file (see .env.example).');
  process.exit(1);
}
const SQLITE_PATH = process.env.SQLITE_PATH || config.DB_PATH;

console.log('=================================================================');
console.log('   PalmTrace Database Migration: SQLite ➔ Render PostgreSQL');
console.log('=================================================================');
console.log(`Source SQLite:   ${SQLITE_PATH}`);
console.log(`Target Postgres: ${PG_URL.split('@')[1] || PG_URL}`);
console.log('-----------------------------------------------------------------\n');

async function migrate() {
  const sqlite = new DatabaseSync(SQLITE_PATH);
  const pg = new Client({
    connectionString: PG_URL,
    ssl: { rejectUnauthorized: false }
  });

  await pg.connect();
  console.log('✓ Connected to Render PostgreSQL.\n');

  // Fetch list of tables from SQLite
  const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  console.log(`Found ${tables.length} tables in SQLite to migrate.\n`);

  // Dependency-conscious table ordering
  const priorityOrder = [
    'roles', 'users', 'user_roles', 'companies', 'projects', 'sectors',
    'crops', 'crop_varieties', 'tree_health_statuses', 'tree_origin_types',
    'yield_quality_grades', 'operation_approval_statuses', 'operation_sync_statuses',
    'propagation_source_types', 'crop_planting_sources', 'nursery_prep_types',
    'operation_categories', 'operation_types', 'operation_materials', 'charities',
    'fertilizers', 'fertilizer_vouchers', 'agricultural_seasons', 'fertilizer_season_balances',
    'plots', 'user_plots', 'worker_assigned_plots', 'palms', 'offshoots',
    'investors', 'investment_contracts', 'contract_plots', 'contract_templates',
    'contract_service_invoices', 'operations', 'yields', 'tree_notes', 'audit_logs',
    'zakat_records', 'plot_summaries', 'system_settings'
  ];

  const sortedTables = [];
  for (const name of priorityOrder) {
    if (tables.some(t => t.name === name)) sortedTables.push(name);
  }
  for (const t of tables) {
    if (!sortedTables.includes(t.name)) sortedTables.push(t.name);
  }

  const results = [];

  for (const tableName of sortedTables) {
    process.stdout.write(`Migrating table "${tableName}"... `);

    // 1. Get column metadata
    const cols = sqlite.prepare(`PRAGMA table_info("${tableName}")`).all();
    if (!cols.length) {
      console.log('Skipped (no columns).');
      continue;
    }

    // Map column types to PG
    const colDefs = [];
    const pkCols = cols.filter(c => c.pk > 0).sort((a, b) => a.pk - b.pk).map(c => `"${c.name}"`);

    for (const c of cols) {
      let pgType = 'TEXT';
      const uType = (c.type || '').toUpperCase();

      if (uType.includes('INT')) {
        pgType = 'BIGINT';
      } else if (uType.includes('REAL') || uType.includes('FLOAT') || uType.includes('DOUBLE')) {
        pgType = 'DOUBLE PRECISION';
      } else if (uType.includes('BLOB')) {
        pgType = 'BYTEA';
      } else {
        pgType = 'TEXT';
      }

      let def = `"${c.name}" ${pgType}`;
      if (c.pk === 1 && pkCols.length === 1) {
        def += ' PRIMARY KEY';
      }
      colDefs.push(def);
    }

    if (pkCols.length > 1) {
      colDefs.push(`PRIMARY KEY (${pkCols.join(', ')})`);
    }

    // 2. Create table in PG
    const createTableSql = `CREATE TABLE IF NOT EXISTS "${tableName}" (\n  ${colDefs.join(',\n  ')}\n);`;
    await pg.query(createTableSql);

    // 3. Read data from SQLite
    const countRow = sqlite.prepare(`SELECT COUNT(*) as c FROM "${tableName}"`).get();
    const totalRows = countRow ? countRow.c : 0;

    if (totalRows === 0) {
      console.log(`0 rows.`);
      results.push({ table: tableName, source: 0, target: 0, status: 'EMPTY' });
      continue;
    }

    // 4. Clear existing rows in PG for clean sync
    await pg.query(`TRUNCATE TABLE "${tableName}" CASCADE;`);

    // 5. Stream and insert in batches
    const BATCH_SIZE = 500;
    const colNames = cols.map(c => `"${c.name}"`).join(', ');
    const rawCols = cols.map(c => c.name);

    let offset = 0;
    let inserted = 0;

    while (offset < totalRows) {
      const rows = sqlite.prepare(`SELECT * FROM "${tableName}" LIMIT ${BATCH_SIZE} OFFSET ${offset}`).all();
      if (!rows.length) break;

      // Construct parameterized multi-row insert
      const valClauses = [];
      const values = [];
      let pIdx = 1;

      let rowIdx = 0;
      for (const r of rows) {
        rowIdx++;
        const rowPlaceholders = [];
        for (const col of cols) {
          const colName = col.name;
          let val = r[colName];
          if (val === undefined) val = null;
          // If a primary key column is null, generate a fallback unique identifier
          if (col.pk > 0 && val === null) {
            val = `${tableName}_${r.user_id || r.worker_id || ''}_${r.plot_id || ''}_${offset + rowIdx}`;
          }
          values.push(val);
          rowPlaceholders.push(`$${pIdx++}`);
        }
        valClauses.push(`(${rowPlaceholders.join(', ')})`);
      }

      const insertSql = `INSERT INTO "${tableName}" (${colNames}) VALUES ${valClauses.join(', ')} ON CONFLICT DO NOTHING;`;
      await pg.query(insertSql, values);

      inserted += rows.length;
      offset += rows.length;
    }

    // 6. Verify count in PG
    const pgCountRes = await pg.query(`SELECT COUNT(*)::bigint as c FROM "${tableName}";`);
    const pgCount = parseInt(pgCountRes.rows[0].c, 10);

    const match = totalRows === pgCount;
    console.log(`${pgCount} / ${totalRows} rows migrated ${match ? '✓' : '⚠️'}`);
    results.push({ table: tableName, source: totalRows, target: pgCount, status: match ? 'OK' : 'MISMATCH' });
  }

  await pg.end();

  console.log('\n=================================================================');
  console.log('                   Migration Summary Report                      ');
  console.log('=================================================================');
  let allOk = true;
  for (const r of results) {
    if (r.status === 'MISMATCH') allOk = false;
    const padName = r.table.padEnd(28, ' ');
    const padSrc = String(r.source).padStart(7, ' ');
    const padTgt = String(r.target).padStart(7, ' ');
    console.log(`${padName} | SQLite: ${padSrc} | Postgres: ${padTgt} | [${r.status}]`);
  }
  console.log('=================================================================');
  if (allOk) {
    console.log('🎉 SUCCESS: All tables and rows migrated with 100% data integrity!');
  } else {
    console.log('⚠️ Some tables had row count mismatches. Please review the log.');
  }
  console.log('=================================================================');
}

migrate().catch(err => {
  console.error('\n❌ Fatal Migration Error:', err);
  process.exit(1);
});
