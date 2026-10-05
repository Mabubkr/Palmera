const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const { DB_PATH, SCHEMA_PATH } = require('./config');

// Online demo: a new, empty server with SEED_DEMO_DATA=true starts from the anonymised copy of the
// farm (seeds/demo-farm.db.gz, built by scripts/make_demo_snapshot.js). Every account gets DEMO_PASSWORD.
const DEMO_SNAPSHOT = path.join(__dirname, 'seeds', 'demo-farm.db.gz');
if (!fs.existsSync(DB_PATH) && process.env.SEED_DEMO_DATA === 'true' && process.env.DEMO_SNAPSHOT !== 'false' && fs.existsSync(DEMO_SNAPSHOT)) {
  try {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, require('node:zlib').gunzipSync(fs.readFileSync(DEMO_SNAPSHOT)));
    const pw = String(process.env.DEMO_PASSWORD || '').trim() || '1234';
    const snap = new DatabaseSync(DB_PATH);
    snap.prepare('UPDATE users SET password_hash = ?, must_change_password = 0').run(require('bcryptjs').hashSync(pw, 10));
    snap.close();
    console.log('[demo] Started from the demo farm snapshot (all accounts use DEMO_PASSWORD).');
  } catch (err) {
    console.error('[demo] Could not restore the demo snapshot:', err.message);
    try { fs.unlinkSync(DB_PATH); } catch {}
  }
}

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


