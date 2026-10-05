// Sets one KEY=value line in the project .env (creates .env from .env.example if needed).
// Usage: node scripts/set-env.js KEY "value"
const fs = require('node:fs');
const path = require('node:path');

const [key, ...rest] = process.argv.slice(2);
const value = rest.join(' ').trim();
if (!key || !value) {
  console.error('Usage: node scripts/set-env.js KEY "value"');
  process.exit(1);
}
const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');
if (!fs.existsSync(envPath)) fs.copyFileSync(path.join(root, '.env.example'), envPath);

const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
const re = new RegExp(`^\\s*#?\\s*${key}\\s*=`);
const idx = lines.findIndex(l => re.test(l));
if (idx >= 0) lines[idx] = `${key}=${value}`;
else lines.push(`${key}=${value}`);
fs.writeFileSync(envPath, lines.join('\n'));
console.log(`✓ ${key} saved in .env`);
