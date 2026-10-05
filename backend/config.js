// Central configuration: paths + environment variables.
// Values come from the process environment, optionally loaded from the
// project-root `.env` file (see `.env.example`).
const path = require('node:path');
const fs = require('node:fs');

const ROOT_DIR = path.resolve(__dirname, '..');
const BACKEND_DIR = __dirname;

const envFile = path.join(ROOT_DIR, '.env');
if (fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile(envFile); } catch (e) { console.warn('.env load warning:', e.message); }
}

const DATA_DIR = process.env.DATA_DIR || path.join(BACKEND_DIR, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

module.exports = {
  ROOT_DIR,
  BACKEND_DIR,
  DATA_DIR,
  FRONTEND_DIR: path.join(ROOT_DIR, 'frontend'),
  DB_PATH: process.env.DB_PATH || path.join(DATA_DIR, 'palmtrace.db'),
  SCHEMA_PATH: path.join(BACKEND_DIR, 'db', 'schema.sql'),
  PORT: Number(process.env.PORT) || 3000,
  PUBLIC_URL: process.env.PUBLIC_URL || `http://localhost:${Number(process.env.PORT) || 3000}`,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  SESSION_TTL_DAYS: Number(process.env.SESSION_TTL_DAYS) || 30,
  // Only for local development without SMTP: print password-reset links to the server console.
  LOG_RESET_LINKS: process.env.LOG_RESET_LINKS !== 'false'
};
