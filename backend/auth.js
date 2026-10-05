// Server-side authentication & coarse authorization for the REST API.
//
// - Login issues a random session token; only its SHA-256 hash is stored in the DB.
// - Every /api request (except the public list below) must send
//   `Authorization: Bearer <token>`.
// - The authenticated identity overwrites any client-supplied `x-user-id` /
//   `x-user-role` headers, so legacy route code that reads those headers now
//   receives the verified user instead of whatever the browser claimed.
const crypto = require('node:crypto');
const db = require('./db');
const config = require('./config');

// Session bookkeeping writes go straight to SQLite (not through db.run), so they do not
// invalidate the cached /api/bootstrap payload on every request.
const write = (sql, ...params) => db.db.prepare(sql).run(...params);

const ADMIN_ROLES = new Set(['admin', 'super_admin']);
const USER_MANAGER_ROLES = new Set(['admin', 'super_admin', 'customer_care']);

// auth_sessions table: created by migrations/versioned/003_auth_sessions.js

function hashToken(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

function createSession(userId, userAgent) {
  const raw = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + config.SESSION_TTL_DAYS * 864e5).toISOString();
  write(
    'INSERT INTO auth_sessions (token_hash, user_id, expires_at, user_agent) VALUES (?, ?, ?, ?)',
    hashToken(raw), userId, expiresAt, String(userAgent || '').slice(0, 250)
  );
  // Opportunistic cleanup of expired sessions
  try { write("DELETE FROM auth_sessions WHERE expires_at < ?", new Date().toISOString()); } catch {}
  return { token: raw, expiresAt };
}

function revokeSession(raw) {
  if (raw) write('DELETE FROM auth_sessions WHERE token_hash = ?', hashToken(raw));
}

function revokeAllForUser(userId, exceptRaw) {
  if (exceptRaw) {
    write('DELETE FROM auth_sessions WHERE user_id = ? AND token_hash != ?', userId, hashToken(exceptRaw));
  } else {
    write('DELETE FROM auth_sessions WHERE user_id = ?', userId);
  }
}

function extractToken(req) {
  const h = req.headers['authorization'] || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (m) return m[1].trim();
  return null;
}

function userRoles(user) {
  const roles = new Set([user.role]);
  try {
    db.all('SELECT role_id FROM user_roles WHERE user_id = ?', user.id).forEach(r => roles.add(r.role_id));
  } catch {}
  return roles;
}

function authenticate(req) {
  const raw = extractToken(req);
  if (!raw) return null;
  const s = db.get('SELECT * FROM auth_sessions WHERE token_hash = ?', hashToken(raw));
  if (!s) return null;
  if (new Date(s.expires_at).getTime() < Date.now()) {
    revokeSession(raw);
    return null;
  }
  const user = db.get('SELECT id, username, full_name, role, active, must_change_password FROM users WHERE id = ?', s.user_id);
  if (!user || user.active === 0) return null;
  // last_seen_at is informational: refresh it at most every 5 minutes
  if (!s.last_seen_at || Date.now() - new Date(String(s.last_seen_at).replace(' ', 'T') + 'Z').getTime() > 5 * 60 * 1000) {
    try { write('UPDATE auth_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE token_hash = ?', s.token_hash); } catch {}
  }
  user.roles = userRoles(user);
  user.isAdmin = [...user.roles].some(r => ADMIN_ROLES.has(r));
  user.token = raw;
  return user;
}

// Routes reachable without a session
function isPublicRoute(method, pathname) {
  if (method === 'GET' && pathname === '/api/health') return true;
  if (method === 'GET' && pathname.startsWith('/api/public/')) return true;
  if (method === 'POST' && ['/api/auth/login', '/api/auth/forgot-password', '/api/auth/reset-password'].includes(pathname)) return true;
  // Blank Excel import templates contain no data
  if (method === 'GET' && (pathname === '/api/plots/template' || pathname === '/api/investors/template')) return true;
  return false;
}

// Routes a user with a pending forced password change may still call
function isPasswordChangeRoute(pathname) {
  return pathname === '/api/auth/change-password' || pathname === '/api/auth/logout' || pathname === '/api/auth/me';
}

// Coarse role checks for sensitive endpoints. Returns an error message or null.
function checkRoleAccess(user, method, pathname) {
  const isAdmin = user.isAdmin;
  const canManageUsers = isAdmin || [...user.roles].some(r => USER_MANAGER_ROLES.has(r));
  const write = method !== 'GET';

  if (pathname.startsWith('/api/admin/') && !isAdmin) return 'هذه العملية متاحة لمدير النظام فقط';
  if (pathname === '/api/ai/test-key' && !isAdmin) return 'إدارة مفاتيح الذكاء الاصطناعي متاحة لمدير النظام فقط';
  if (write && (pathname === '/api/settings' || pathname === '/api/roles' || pathname.startsWith('/api/roles/')) && !isAdmin) {
    return 'تعديل إعدادات وصلاحيات المنظومة متاح لمدير النظام فقط';
  }
  if (write && (pathname === '/api/companies' || pathname.startsWith('/api/companies/')) && !isAdmin) {
    return 'تعديل بيانات الشركات متاح لمدير النظام فقط';
  }
  if (pathname === '/api/users' && write && !canManageUsers) return 'إدارة المستخدمين غير متاحة لدورك';
  if (pathname.startsWith('/api/users/') && write) {
    const targetId = decodeURIComponent(pathname.split('/')[3] || '');
    if (method === 'DELETE' && !isAdmin) return 'حذف المستخدمين متاح لمدير النظام فقط';
    if (targetId !== user.id && !canManageUsers) return 'لا يمكنك تعديل بيانات مستخدم آخر';
  }
  return null;
}

module.exports = {
  ADMIN_ROLES,
  hashToken,
  createSession,
  revokeSession,
  revokeAllForUser,
  extractToken,
  authenticate,
  isPublicRoute,
  isPasswordChangeRoute,
  checkRoleAccess
};
