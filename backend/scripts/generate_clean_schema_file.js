const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const db = new DatabaseSync(require('../config').DB_PATH);

console.log('1. Dropping multi-tenant tables from palmtrace.db...');
db.exec('PRAGMA foreign_keys = OFF;');
db.exec(`
  DROP TABLE IF EXISTS user_project_access;
  DROP TABLE IF EXISTS projects;
  DROP TABLE IF EXISTS companies;
  DROP INDEX IF EXISTS idx_projects_company;
  DROP INDEX IF EXISTS idx_user_access_comp;
  DROP INDEX IF EXISTS idx_user_access_lookup;
  DROP INDEX IF EXISTS idx_user_access_role;
`);
db.exec('PRAGMA foreign_keys = ON;');

const header = `-- =========================================================================
-- PalmTrace Enterprise SQLite Schema (100% Normalized & Numeric 3NF)
-- Single-Farm Enterprise Architecture (Clean Single-Tenant Standard)
-- مصممة لاستيعاب ملايين الأشجار وعشرات الملايين من العمليات بأعلى سرعة RAM
-- =========================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

`;

function ensureIfNotExists(sql, type) {
  if (type === 'table') {
    return sql.replace(/^CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/i, 'CREATE TABLE IF NOT EXISTS ');
  }
  if (type === 'index') {
    return sql.replace(/^CREATE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS)/i, 'CREATE INDEX IF NOT EXISTS ')
              .replace(/^CREATE\s+UNIQUE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS)/i, 'CREATE UNIQUE INDEX IF NOT EXISTS ');
  }
  if (type === 'view') {
    return sql.replace(/^CREATE\s+VIEW\s+(?!IF\s+NOT\s+EXISTS)/i, 'CREATE VIEW IF NOT EXISTS ');
  }
  return sql;
}

// Grouped table order for clean logical layout
const order = [
  'users',
  'sectors',
  'plots',
  'user_plots',
  'crops',
  'propagation_source_types',
  'crop_varieties',
  'tree_health_statuses',
  'tree_origin_types',
  'yield_quality_grades',
  'operation_approval_statuses',
  'operation_sync_statuses',
  'palms',
  'operation_categories',
  'operation_types',
  'operations',
  'fertilizers',
  'fertilizer_vouchers',
  'offshoots',
  'charities',
  'yields',
  'zakat_records',
  'audit_logs',
  'settings'
];

let sqlContent = header;
sqlContent += '-- =========================================================================\n';
sqlContent += '-- 1. الجداول الأساسية والتشغيلية (Core Operational Tables)\n';
sqlContent += '-- =========================================================================\n\n';

for (const tblName of order) {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name = ?").get(tblName);
  if (row && row.sql) {
    sqlContent += `${ensureIfNotExists(row.sql, 'table')};\n\n`;
  }
}

const otherTables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
for (const ot of otherTables) {
  if (!order.includes(ot.name) && ot.name !== 'companies' && ot.name !== 'projects' && ot.name !== 'user_project_access' && ot.sql) {
    sqlContent += `${ensureIfNotExists(ot.sql, 'table')};\n\n`;
  }
}

sqlContent += '-- =========================================================================\n';
sqlContent += '-- 2. فهارس الأداء المليونية عالية السرعة (High Performance RAM Indexes)\n';
sqlContent += '-- =========================================================================\n\n';

const indexes = db.prepare("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY tbl_name, name").all();
for (const idx of indexes) {
  if (!idx.name.includes('project') && !idx.name.includes('company') && !idx.tbl_name.includes('project') && !idx.tbl_name.includes('company')) {
    sqlContent += `${ensureIfNotExists(idx.sql, 'index')};\n`;
  }
}

sqlContent += '\n-- =========================================================================\n';
sqlContent += '-- 3. العروض التجميعية اللحظية (Zero-Cost Dynamic JOIN Views)\n';
sqlContent += '-- =========================================================================\n\n';

const views = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='view' ORDER BY name").all();
for (const v of views) {
  sqlContent += `${ensureIfNotExists(v.sql, 'view')};\n\n`;
}

fs.writeFileSync(require('../config').SCHEMA_PATH, sqlContent, 'utf8');
console.log('✓ Dropped tables and generated clean schema.sql & schema_3.sql successfully!');

