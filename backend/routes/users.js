// Routes: Users, audit logs, multi-tenant compatibility stubs
const bcrypt = require('bcryptjs');
const db = require('../db');
const auth = require('../auth');
const access = require('../access');
const { sendJson, parseBody } = require('../lib/http');
const { generateTempPassword, formatAuditLogTitleAndSummary } = require('../lib/helpers');

const NEXT = Symbol.for('palmtrace.next-route');

// Returns NEXT when no route in this module matched the request.
module.exports = async function usersRoutes(req, res, { method, pathname, url }) {
  // 12. Users API
  if (pathname === '/api/users') {
    if (method === 'GET') {
      const users = db.all("SELECT id, username, full_name, role, phone, email, active, avatar, blood_type as bloodType, COALESCE(must_change_password, 0) as must_change_password, created_at FROM users ORDER BY created_at DESC");
      const allUserRoles = db.all('SELECT user_id, role_id FROM user_roles');
      const userContracts = db.all('SELECT investor_id, id FROM investment_contracts');
      const allUserPlots = db.all('SELECT user_id, plot_id FROM user_plots');
      const allWorkerPlots = db.all('SELECT worker_id, plot_id FROM worker_assigned_plots');
      users.forEach(u => {
        const uRoles = allUserRoles.filter(ur => ur.user_id === u.id).map(ur => ur.role_id);
        u.roles = uRoles.length > 0 ? uRoles : [u.role];
        u.contractIds = userContracts.filter(c => c.investor_id === u.id).map(c => c.id);
        const wPlots = allWorkerPlots.filter(wp => wp.worker_id === u.id).map(wp => wp.plot_id);
        const uWorkPlots = allUserPlots.filter(up => up.user_id === u.id && (up.permission_type === 'work' || up.permission_type === 'engineer' || up.permission_type === 'worker')).map(up => up.plot_id);
        const effectiveWPlots = wPlots.length > 0 ? wPlots : uWorkPlots;
        const invPlots = allUserPlots.filter(up => up.user_id === u.id && (up.permission_type === 'view' || up.permission_type === 'investor_view')).map(up => up.plot_id);
        u.workerPlots = effectiveWPlots;
        u.investorPlots = invPlots;
        if (u.role === 'engineer' || u.role === 'worker') {
          u.plots = effectiveWPlots;
        } else if (u.role === 'investor') {
          u.plots = invPlots;
        } else {
          u.plots = effectiveWPlots.length > 0 ? effectiveWPlots : allUserPlots.filter(up => up.user_id === u.id).map(up => up.plot_id);
        }
      });
      if (access.accessLevel(req.authUser) !== 'full') {
        return sendJson(res, 200, access.usersVisibleToStaff(users, req.authUser.id));
      }
      return sendJson(res, 200, users);
    }
    if (method === 'POST') {
      const u = await parseBody(req);
      const username = u.username || u.user;
      if (!username) return sendJson(res, 400, { error: 'اسم المستخدم مطلوب' });
      const fullName = u.fullName || u.full_name || u.name || username;
      const tempPassword = u.pass || u.password || u.tempPassword || generateTempPassword();
      const hash = bcrypt.hashSync(tempPassword, 10);
      const uid = u.id || `u_${Date.now()}`;
      const existingUser = db.get('SELECT id, must_change_password FROM users WHERE username = ?', username);
      // New users must change their temporary password; existing users keep their current flag unless it is sent explicitly.
      const mustChange = (u.mustChangePassword !== undefined) ? (u.mustChangePassword ? 1 : 0) : (existingUser ? (existingUser.must_change_password || 0) : 1);
      const avatar = (u.avatar !== undefined) ? (u.avatar || null) : null;
      const bloodType = (u.bloodType !== undefined || u.blood_type !== undefined) ? (u.bloodType || u.blood_type || null) : null;

      db.run(
        `INSERT INTO users (id, username, password_hash, full_name, role, phone, email, active, must_change_password, avatar, blood_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(username) DO UPDATE SET
           full_name = excluded.full_name,
           role = excluded.role,
           phone = excluded.phone,
           email = excluded.email,
           active = excluded.active,
           must_change_password = excluded.must_change_password,
           avatar = COALESCE(excluded.avatar, users.avatar),
           blood_type = COALESCE(excluded.blood_type, users.blood_type)`,
        uid, username, hash, fullName, u.role || 'worker', u.phone || '', u.email || null, u.active !== false ? 1 : 0, mustChange, avatar, bloodType
      );

      // Multi-role update in user_roles
      // Only rewrite the role list when it is sent (or for a brand-new user); a plain profile save keeps extra roles.
      if ((Array.isArray(u.roles) && u.roles.length > 0) || !existingUser) {
        const rolesToAssign = (Array.isArray(u.roles) && u.roles.length > 0) ? u.roles : [u.role || 'worker'];
        db.run('DELETE FROM user_roles WHERE user_id = ?', uid);
        const roleStmt = db.db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)');
        rolesToAssign.forEach(rId => roleStmt.run(uid, rId));
      }

      // If plots assigned, update worker_assigned_plots and user_plots
      if (Array.isArray(u.plots)) {
        db.run('DELETE FROM worker_assigned_plots WHERE worker_id = ?', uid);
        const wapStmt = db.db.prepare('INSERT OR IGNORE INTO worker_assigned_plots (worker_id, plot_id) VALUES (?, ?)');
        u.plots.forEach(pid => wapStmt.run(uid, pid));

        db.run('DELETE FROM user_plots WHERE user_id = ?', uid);
        const plotStmt = db.db.prepare('INSERT OR IGNORE INTO user_plots (user_id, plot_id) VALUES (?, ?)');
        u.plots.forEach(pid => plotStmt.run(uid, pid));
      }

      return sendJson(res, 201, {
        success: true,
        id: uid,
        tempPassword,
        user: {
          id: uid,
          username,
          name: fullName,
          role: u.role || 'worker',
          roles: rolesToAssign,
          phone: u.phone || '',
          email: u.email || '',
          avatar: avatar || '',
          bloodType: bloodType || '',
          mustChangePassword: mustChange === 1
        },
        message: 'تم حفظ المستخدم بنجاح'
      });
    }
  }

  // 12.1 User Specific Actions (Admin Password Reset & Delete)
  if (pathname.startsWith('/api/users/')) {
    const resetMatch = pathname.match(/^\/api\/users\/([^/]+)\/reset-password$/);
    if (resetMatch && method === 'POST') {
      const userId = decodeURIComponent(resetMatch[1]);
      const targetUser = db.get('SELECT * FROM users WHERE id = ?', userId);
      if (!targetUser) return sendJson(res, 404, { error: 'المستخدم غير موجود' });

      const tempPassword = generateTempPassword();
      const hash = bcrypt.hashSync(tempPassword, 10);
      db.run(
        'UPDATE users SET password_hash = ?, must_change_password = 1, reset_token_hash = NULL, reset_token_expires_at = NULL WHERE id = ?',
        hash, targetUser.id
      );
      auth.revokeAllForUser(targetUser.id);

      return sendJson(res, 200, {
        success: true,
        tempPassword,
        user: {
          id: targetUser.id,
          username: targetUser.username,
          name: targetUser.full_name,
          role: targetUser.role,
          phone: targetUser.phone || '',
          email: targetUser.email || ''
        },
        message: 'تمت إعادة تعيين كلمة المرور بنجاح'
      });
    }

    if (method === 'DELETE') {
      const userId = decodeURIComponent(pathname.replace('/api/users/', ''));
      db.run('DELETE FROM worker_assigned_plots WHERE worker_id = ?', userId);
      db.run('DELETE FROM user_plots WHERE user_id = ?', userId);
      db.run('DELETE FROM user_roles WHERE user_id = ?', userId);
      db.run('DELETE FROM users WHERE id = ?', userId);
      return sendJson(res, 200, { success: true, message: 'تم حذف المستخدم بنجاح' });
    }
  }

  // 13. Audit Logs API
  if (pathname === '/api/audit-logs') {
    if (method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '100', 10);
      const logs = db.all('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?', limit).map(a => {
        let det = {};
        try { det = typeof a.details === 'string' ? JSON.parse(a.details) : (a.details || {}); } catch(e){}
        const localized = formatAuditLogTitleAndSummary(a.action, a.entity_name, a.entity_id, det);
        return {
          id: a.id,
          user_id: a.user_id,
          action: a.action,
          entity_name: a.entity_name,
          entity_id: a.entity_id,
          details: det,
          title: localized.title || det.title || '',
          summary: localized.summary || det.summary || '',
          ip_address: a.ip_address,
          created_at: a.created_at
        };
      });
      return sendJson(res, 200, logs);
    }
    if (method === 'POST') {
      const body = await parseBody(req);
      const logId = body.id || `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      db.run(
        `INSERT INTO audit_logs (id, user_id, action, entity_name, entity_id, details, ip_address, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        logId, body.userId || body.user || null, body.action || 'action', body.module || body.entityName || null,
        body.targetId || null, typeof body.details === 'string' ? body.details : JSON.stringify(body.details || {}),
        req.socket.remoteAddress || '127.0.0.1', body.at || new Date().toISOString()
      );
      return sendJson(res, 201, { success: true, id: logId });
    }
  }

  // 14. Compatibility Stubs for Multi-Tenant Endpoints (Graceful fallback)
  if (pathname === '/api/companies' || pathname.startsWith('/api/companies/')) {
    if (method === 'GET') return sendJson(res, 200, []);
    return sendJson(res, 200, { success: true, message: 'Single-farm mode active' });
  }
  if (pathname === '/api/projects' || pathname.startsWith('/api/projects/')) {
    if (method === 'GET') return sendJson(res, 200, []);
    return sendJson(res, 200, { success: true, message: 'Single-farm mode active' });
  }

  return NEXT;
};
