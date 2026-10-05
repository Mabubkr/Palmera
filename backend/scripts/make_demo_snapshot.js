// Builds backend/seeds/demo-farm.db.gz: a copy of a real farm database with every person's
// name, phone, e-mail, national id, IBAN, all API keys, sessions and audit history removed.
// The online demo (SEED_DEMO_DATA=true) starts from this file when its database is empty.
//
//   node backend/scripts/make_demo_snapshot.js <path to palmtrace.db>
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const os = require('node:os');
const { DatabaseSync } = require('node:sqlite');

const src = process.argv[2];
if (!src || !fs.existsSync(src)) { console.error('Usage: node backend/scripts/make_demo_snapshot.js <palmtrace.db>'); process.exit(1); }

const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pt-snap-')), 'demo.db');
{
  // copy through SQLite so the WAL (unsaved pages) is included
  const s = new DatabaseSync(src, { readOnly: true });
  s.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
  s.close();
}
const db = new DatabaseSync(tmp);
const has = t => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(t);
const cols = t => has(t) ? db.prepare(`PRAGMA table_info(${t})`).all().map(r => r.name) : [];
const run = (sql, ...p) => db.prepare(sql).run(...p);
// empty value for a column: '' where the column forbids NULL
const notNull = t => new Set(has(t) ? db.prepare(`PRAGMA table_info(${t})`).all().filter(r => r.notnull).map(r => r.name) : []);
const blank = (t, list) => { const nn = notNull(t); return list.filter(c => cols(t).includes(c)).map(c => `${c} = ${nn.has(c) ? "''" : 'NULL'}`).join(', '); };

db.exec('BEGIN');

// 1. People: generic names and usernames per role, no contact details
const ROLE = {
  admin: ['admin', 'مدير النظام'], super_admin: ['superadmin', 'مدير عام'], tenant_user: ['manager', 'مدير مزرعة'],
  engineer: ['engineer', 'مهندس زراعي'], worker: ['worker', 'عامل ميداني'], investor: ['investor', 'مستثمر'],
  nursery_mgr: ['nursery', 'مدير المشتل'], warehouse_mgr: ['storage', 'أمين المخزن'], customer_care: ['care', 'خدمة العملاء']
};
const seen = {};
const newName = new Map();
run("UPDATE users SET username = '__tmp_' || id"); // avoid clashes while renaming
db.prepare('SELECT id, role FROM users ORDER BY created_at, id').all().forEach(u => {
  const [base, label] = ROLE[u.role] || ['user', 'مستخدم'];
  seen[base] = (seen[base] || 0) + 1;
  const n = seen[base];
  const username = n === 1 ? base : `${base}${n}`;
  const name = n === 1 ? label : `${label} ${n}`;
  newName.set(String(u.id), name);
  const set = ['username = ?', 'full_name = ?', 'must_change_password = 0'];
  const vals = [username, name];
  const b = blank('users', ['phone', 'email', 'avatar', 'blood_type', 'reset_token_hash', 'reset_token_expires_at']);
  if (b) set.push(b);
  run(`UPDATE users SET ${set.join(', ')} WHERE id = ?`, ...vals, u.id);
});

if (has('investors')) {
  db.prepare('SELECT id, user_id FROM investors ORDER BY id').all().forEach((r, i) => {
    run(`UPDATE investors SET full_name = ?, ${blank('investors', ['national_id', 'phone', 'email', 'bank_name', 'iban'])} WHERE id = ?`,
      newName.get(String(r.user_id)) || `مستثمر ${i + 1}`, r.id);
  });
}
if (has('charities')) run(`UPDATE charities SET ${blank('charities', ['contact_person', 'phone', 'email', 'iban', 'bank_name', 'stamp', 'address'])}`);
if (has('tree_notes')) {
  db.prepare('SELECT id, author_id, assigned_to_user_id FROM tree_notes').all().forEach(n => {
    run('UPDATE tree_notes SET author_name = ?, assigned_to_user_name = ? WHERE id = ?',
      newName.get(String(n.author_id)) || 'مستخدم', n.assigned_to_user_id ? (newName.get(String(n.assigned_to_user_id)) || 'مستخدم') : null, n.id);
  });
}
if (has('companies')) run(`UPDATE companies SET ${blank('companies', ['commercial_registry', 'tax_number', 'email', 'phone'])}`);
if (has('investment_contracts')) run(`UPDATE investment_contracts SET ${blank('investment_contracts', ['zakat_doc_url', 'notes'])}`);

// 2. Secrets, contact settings, sessions, history
const SECRET = ['gemini_api_key', 'geminiApiKey', 'smtpPass', 'openWeatherKey', 'agroMonitoringKey', 'openMeteoKey', 'sentinelClientId', 'sentinelSecret',
  'officialEmail', 'officialPhone', 'taxId', 'commercialRegister', 'traceWhatsapp', 'ndvi_last_sync'];
SECRET.forEach(k => run('DELETE FROM system_settings WHERE key = ?', k));
const agri = db.prepare("SELECT value FROM system_settings WHERE key = 'agriSettings'").get();
if (agri) {
  try {
    const a = JSON.parse(agri.value);
    ['openWeatherKey', 'agroMonitoringKey', 'openMeteoKey', 'sentinelClientId', 'sentinelSecret', 'apiKey'].forEach(k => delete a[k]);
    run("UPDATE system_settings SET value = ? WHERE key = 'agriSettings'", JSON.stringify(a));
  } catch {}
}
['auth_sessions', 'audit_logs', 'agro_polygons', 'ndvi_observations'].forEach(t => { if (has(t)) run(`DELETE FROM ${t}`); });

db.exec('COMMIT');
db.exec('VACUUM');

// 3. Self-check: nothing personal left
const leftovers = [];
const phoneLike = /(?:\+?\d[\d\s-]{8,}\d)/;
db.prepare('SELECT full_name, phone, email FROM users').all().forEach(u => { if (u.phone || u.email) leftovers.push('user contact'); });
if (has('investors')) db.prepare('SELECT national_id, iban, phone FROM investors').all().forEach(r => { if (r.national_id || r.iban || r.phone) leftovers.push('investor contact'); });
const keysLeft = db.prepare("SELECT key FROM system_settings WHERE key LIKE '%key%' OR key LIKE '%secret%' OR key LIKE '%pass%'").all().map(r => r.key);
const counts = {
  palms: db.prepare('SELECT COUNT(*) n FROM palms').get().n,
  plots: db.prepare('SELECT COUNT(*) n FROM plots').get().n,
  operations: db.prepare('SELECT COUNT(*) n FROM operations').get().n,
  users: db.prepare('SELECT COUNT(*) n FROM users').get().n
};
db.close();
if (leftovers.length || keysLeft.length) { console.error('Refusing: personal data or keys still present:', leftovers, keysLeft); process.exit(2); }

const out = path.join(__dirname, '..', 'seeds', 'demo-farm.db.gz');
fs.writeFileSync(out, zlib.gzipSync(fs.readFileSync(tmp), { level: 9 }));
console.log('Demo snapshot written:', out, (fs.statSync(out).size / 1048576).toFixed(1) + ' MB', counts);
void phoneLike;
