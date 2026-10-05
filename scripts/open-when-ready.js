// Started by تشغيل_النظام.bat next to the server: waits until the server answers, then opens the browser.
// (Opening the browser immediately showed "localhost refused to connect" while the server was still starting.)
const http = require('node:http');
const path = require('node:path');
const { exec } = require('node:child_process');
try { process.loadEnvFile(path.join(__dirname, '..', '.env')); } catch {}
const PORT = Number(process.env.PORT) || 3000;
const url = `http://localhost:${PORT}`;
const started = Date.now();
function open() {
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open ${url}` : `xdg-open ${url}`;
  exec(cmd, () => process.exit(0));
}
(function poll() {
  const req = http.get({ host: '127.0.0.1', port: PORT, path: '/api/health', timeout: 1500 }, res => { res.resume(); open(); });
  req.on('error', retry);
  req.on('timeout', () => { req.destroy(); retry(); });
  function retry() { if (Date.now() - started > 120000) process.exit(1); setTimeout(poll, 700); }
})();
