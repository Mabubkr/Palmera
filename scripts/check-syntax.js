// Syntax check for every JavaScript file in backend/ and frontend/ (npm run check).
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const SKIP = new Set(['node_modules', 'data']);
const files = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js')) files.push(p);
  }
}
['backend', 'frontend'].forEach(d => walk(path.join(__dirname, '..', d)));

let failed = 0;
for (const f of files) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  } catch (e) {
    failed++;
    console.error('✗', path.relative(process.cwd(), f), '\n', String(e.stderr));
  }
}
console.log(`${files.length - failed}/${files.length} files OK`);
process.exit(failed ? 1 : 0);
