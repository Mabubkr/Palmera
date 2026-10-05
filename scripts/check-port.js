// Run by تشغيل_النظام.bat before starting the server.
// If another copy of PalmTrace (often an older folder) already holds the port, the new server
// cannot start and the browser keeps showing the old copy. Detect that and offer to stop it.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const readline = require('node:readline');

const root = path.resolve(__dirname, '..');
try { process.loadEnvFile(path.join(root, '.env')); } catch {}
const PORT = Number(process.env.PORT) || 3000;
const myBuild = ((fs.readFileSync(path.join(root, 'frontend', 'sw.js'), 'utf8').match(/palmtrace-v(\d+)/)) || [])[1];

function health() {
  return new Promise(resolve => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: '/api/health', timeout: 2000 }, res => {
      let body = '';
      res.on('data', d => { body += d; });
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({}); } });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function listeningPid() {
  if (process.platform !== 'win32') return null;
  try {
    const out = execSync('netstat -ano -p TCP', { encoding: 'utf8' });
    const line = out.split(/\r?\n/).find(l => /LISTENING/i.test(l) && new RegExp(`[:.]${PORT}\\s`).test(l));
    return line ? Number(line.trim().split(/\s+/).pop()) : null;
  } catch { return null; }
}

function commandLine(pid) {
  try {
    return execSync(`powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine"`, { encoding: 'utf8' }).trim();
  } catch { return ''; }
}

(async () => {
  const h = await health();
  if (!h) return; // port free
  const pid = listeningPid();
  const same = h.build && String(h.build) === String(myBuild);
  console.log('');
  console.log('================================================================');
  console.log(same
    ? `  النظام شغال بالفعل على المنفذ ${PORT} (نفس النسخة ${myBuild}).`
    : `  فيه نسخة تانية من النظام شغالة على المنفذ ${PORT} (نسخة ${h.build || 'قديمة'})، والنسخة اللي في الفولدر ده ${myBuild}.`);
  if (pid) console.log(`  رقم العملية: ${pid}  ${commandLine(pid)}`);
  console.log('================================================================');
  if (!pid) { console.log('  اقفل نافذة الخادم القديمة (أو أوقفه من VS Code بـ Ctrl+C) وشغّل من جديد.'); process.exit(2); }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(same ? '  تعيد تشغيله؟ (Y = نعم / N = لا): ' : '  أوقف النسخة القديمة وأشغّل الجديدة؟ (Y = نعم / N = لا): ', ans => {
    rl.close();
    if (!/^y|^ن/i.test(String(ans).trim())) { console.log('  تمام، مفيش تغيير.'); process.exit(2); }
    try { process.kill(pid); } catch (e) {
      try { execSync(`taskkill /PID ${pid} /F`); } catch { console.log('  تعذر الإيقاف: ' + e.message); process.exit(2); }
    }
    console.log('  اتوقفت. جاري تشغيل النسخة الجديدة...');
    setTimeout(() => process.exit(0), 1500);
  });
})();
