// Creates a restorable checkpoint of this PalmTrace folder next to it:
//   ..\PalmTrace_Checkpoints\PalmTrace_v<build>_<date>\
// Code + settings are copied as files; the database is copied with SQLite "VACUUM INTO",
// which gives a consistent copy even while the server is running.
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const root = path.resolve(__dirname, '..');
const build = ((fs.readFileSync(path.join(root, 'frontend', 'sw.js'), 'utf8').match(/palmtrace-v(\d+)/)) || [])[1] || 'x';
const d = new Date();
const pad = n => String(n).padStart(2, '0');
const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
const destRoot = path.resolve(root, '..', 'PalmTrace_Checkpoints');
const dest = path.join(destRoot, `PalmTrace_v${build}_${stamp}`);

const SKIP_DIRS = new Set(['node_modules', '.git']);
const isDbFile = name => /\.db(-wal|-shm)?$/i.test(name);

fs.mkdirSync(dest, { recursive: true });
let files = 0, bytes = 0;
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.isDirectory() && SKIP_DIRS.has(e.name)) continue;
    const s = path.join(src, e.name), t = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, t);
    else if (e.isFile() && !isDbFile(e.name)) { fs.copyFileSync(s, t); files++; bytes += fs.statSync(s).size; }
  }
}
copyDir(root, dest);

// Databases: consistent copy via VACUUM INTO
const dataDir = path.join(root, 'backend', 'data');
const dbs = fs.existsSync(dataDir) ? fs.readdirSync(dataDir).filter(n => /\.db$/i.test(n)) : [];
const dbReport = [];
for (const name of dbs) {
  const src = path.join(dataDir, name);
  const out = path.join(dest, 'backend', 'data', name);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const db = new DatabaseSync(src);
  db.exec(`VACUUM INTO '${out.replace(/'/g, "''")}'`);
  db.close();
  const check = new DatabaseSync(out, { readOnly: true });
  const palms = (() => { try { return check.prepare('SELECT COUNT(*) AS c FROM palms').get().c; } catch { return null; } })();
  const ops = (() => { try { return check.prepare('SELECT COUNT(*) AS c FROM operations').get().c; } catch { return null; } })();
  check.close();
  dbReport.push({ name, size: fs.statSync(out).size, palms, ops });
}

fs.writeFileSync(path.join(dest, 'CHECKPOINT.txt'),
  `PalmTrace checkpoint\nbuild: v${build}\ncreated: ${d.toISOString()}\nsource: ${root}\nfiles: ${files}\n` +
  dbReport.map(r => `db ${r.name}: ${(r.size / 1048576).toFixed(1)} MB, palms=${r.palms}, operations=${r.ops}`).join('\n') +
  `\n\nTo restore: copy this folder anywhere and run تشغيل_النظام.bat (it installs libraries the first time).\n`);

console.log('');
console.log('  تم إنشاء نقطة الرجوع:');
console.log('  ' + dest);
console.log(`  الملفات: ${files} (${(bytes / 1048576).toFixed(1)} MB)`);
for (const r of dbReport) console.log(`  قاعدة البيانات ${r.name}: ${(r.size / 1048576).toFixed(1)} MB — النخيل ${r.palms} — العمليات ${r.ops}`);
if (!dbReport.length) console.log('  تنبيه: لم أجد قاعدة بيانات في backend\\data');
