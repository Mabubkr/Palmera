const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const { DB_PATH, SCHEMA_PATH } = require('./config');

const db = new DatabaseSync(DB_PATH);

// Enable WAL mode, foreign keys, and busy timeout
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');

// Initialize schema
if (fs.existsSync(SCHEMA_PATH)) {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(schema);
}

// Versioned schema migrations (see migrations/runner.js)
require('./migrations/runner').runVersionedMigrations(db);

const _changeListeners = [];
function notifyChange() {
  for (let i = 0; i < _changeListeners.length; i++) {
    try { _changeListeners[i](); } catch (e) { console.error('db onChange error:', e); }
  }
}

module.exports = {
  db,
  all(sql, ...params) {
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  },
  get(sql, ...params) {
    const stmt = db.prepare(sql);
    return stmt.get(...params);
  },
  run(sql, ...params) {
    const stmt = db.prepare(sql);
    const result = stmt.run(...params);
    notifyChange();
    return result;
  },
  exec(sql) {
    const result = db.exec(sql);
    notifyChange();
    return result;
  },
  onChange(fn) {
    if (typeof fn === 'function') {
      _changeListeners.push(fn);
    }
  },
  notifyChange
};


