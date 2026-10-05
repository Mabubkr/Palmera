// Test helper: starts the real server on a throwaway database and gives a small HTTP client.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

async function startServer({ demo = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'palmtrace-test-'));
  const port = 4100 + Math.floor(Math.random() * 800);
  const env = {
    ...process.env,
    DB_PATH: path.join(dir, 'test.db'),
    DATA_DIR: dir,
    PORT: String(port),
    SEED_DEMO_DATA: demo ? 'true' : 'false',
    DEMO_SNAPSHOT: 'false', // tests use the small built-in sample farm
    NDVI_AUTO_SYNC: 'false',
    GEMINI_API_KEY: '',
    LOG_RESET_LINKS: 'true'
  };
  const proc = spawn(process.execPath, [path.join(ROOT, 'backend', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  proc.stdout.on('data', d => { output += d; });
  proc.stderr.on('data', d => { output += d; });

  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(base + '/api/health');
      if (r.ok) break;
    } catch {}
    await new Promise(r => setTimeout(r, 300));
  }

  async function call(method, url, { token, body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const res = await fetch(base + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, text };
  }

  async function login(username, password = '1234') {
    const r = await call('POST', '/api/auth/login', { body: { username, password } });
    if (r.status !== 200) throw new Error(`login ${username} failed: ${r.status} ${r.text}`);
    return r.json.token;
  }

  async function stop() {
    proc.kill();
    await new Promise(r => setTimeout(r, 200));
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  }

  return { base, call, login, stop, output: () => output, dbPath: env.DB_PATH };
}

module.exports = { startServer };
