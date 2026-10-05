// Routes: Login, logout, profile, password change and recovery
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');
const config = require('../config');
const auth = require('../auth');
const { sendPasswordResetEmail } = require('../mailer');
const { sendJson, parseBody } = require('../lib/http');

const NEXT = Symbol.for('palmtrace.next-route');

// Returns NEXT when no route in this module matched the request.
module.exports = async function authRoutes(req, res, { method, pathname, url }) {
  // 2. Authentication: Direct Single-Farm Login
  if (method === 'POST' && pathname === '/api/auth/login') {
    const { username, password } = await parseBody(req);
    const rawUser = String(username || '').trim().toLowerCase();
    const user = db.get(
      `SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(id) = ? OR (role = 'warehouse_mgr' AND ? IN ('storage', 'warehouse', 'warehouse_mgr', 'أمين المستودع', 'أمين المخزن', 'مخزن', 'مستودع'))`,
      rawUser, rawUser, rawUser
    );
    if (!user) {
      return sendJson(res, 401, { error: 'بيانات الدخول غير صحيحة' });
    }

    let passwordValid = false;
    if (user.password_hash && user.password_hash.startsWith('$2')) {
      passwordValid = bcrypt.compareSync(password, user.password_hash);
    } else {
      passwordValid = (user.password_hash === password);
      if (passwordValid) {
        const newHash = bcrypt.hashSync(password, 10);
        db.run('UPDATE users SET password_hash = ? WHERE id = ?', newHash, user.id);
      }
    }

    if (!passwordValid) {
      return sendJson(res, 401, { error: 'بيانات الدخول غير صحيحة' });
    }

    const userRoles = db.all('SELECT role_id FROM user_roles WHERE user_id = ?', user.id).map(r => r.role_id);
    const roles = userRoles.length > 0 ? userRoles : [user.role];
    const workerPlots = db.all('SELECT plot_id FROM worker_assigned_plots WHERE worker_id = ?', user.id).map(r => r.plot_id);
    const userWorkPlots = db.all("SELECT plot_id FROM user_plots WHERE user_id = ? AND (permission_type = 'work' OR permission_type = 'engineer' OR permission_type = 'worker')", user.id).map(r => r.plot_id);
    const effectiveWorkerPlots = workerPlots.length > 0 ? workerPlots : userWorkPlots;
    const investorPlots = db.all("SELECT plot_id FROM user_plots WHERE user_id = ? AND permission_type IN ('view', 'investor_view')", user.id).map(r => r.plot_id);
    const userContracts = db.all('SELECT id, contract_number FROM investment_contracts WHERE investor_id = ?', user.id);
    const contractIds = userContracts.map(c => c.id);

    let effectiveUserPlots = effectiveWorkerPlots;
    if (user.role === 'investor') {
      effectiveUserPlots = investorPlots;
    } else if (user.role === 'engineer' || user.role === 'worker') {
      effectiveUserPlots = effectiveWorkerPlots;
    } else {
      effectiveUserPlots = effectiveWorkerPlots.length > 0 ? effectiveWorkerPlots : db.all('SELECT plot_id FROM user_plots WHERE user_id = ?', user.id).map(r => r.plot_id);
    }

    if (user.active === 0) {
      return sendJson(res, 403, { error: 'الحساب معطّل، يرجى التواصل مع الإدارة' });
    }
    const session = auth.createSession(user.id, req.headers['user-agent']);

    return sendJson(res, 200, {
      success: true,
      token: session.token,
      expiresAt: session.expiresAt,
      user: {
        id: user.id,
        username: user.username,
        name: user.full_name,
        role: user.role,
        roles: roles,
        phone: user.phone || '',
        email: user.email || '',
        avatar: user.avatar || '',
        bloodType: user.blood_type || '',
        mustChangePassword: user.must_change_password === 1,
        plots: effectiveUserPlots,
        workerPlots: effectiveWorkerPlots,
        investorPlots: investorPlots,
        contractIds: contractIds
      }
    });
  }

  // 2.0 Session info & logout
  if (method === 'GET' && pathname === '/api/auth/me') {
    const u = req.authUser;
    return sendJson(res, 200, { success: true, user: { id: u.id, username: u.username, name: u.full_name, role: u.role, roles: [...u.roles], mustChangePassword: u.must_change_password === 1 } });
  }
  if (method === 'POST' && pathname === '/api/auth/logout') {
    auth.revokeSession(req.authUser.token);
    return sendJson(res, 200, { success: true });
  }

  // 2.0.1 Own profile (name, phone, email, avatar, blood type) – never touches role, password or status
  if (method === 'POST' && pathname === '/api/auth/profile') {
    const b = await parseBody(req);
    const me = req.authUser;
    const cur = db.get('SELECT * FROM users WHERE id = ?', me.id);
    db.run(
      'UPDATE users SET full_name = ?, phone = ?, email = ?, avatar = ?, blood_type = ? WHERE id = ?',
      String(b.fullName || b.name || cur.full_name).trim(),
      b.phone !== undefined ? String(b.phone).trim() : cur.phone,
      b.email !== undefined ? (String(b.email).trim() || null) : cur.email,
      b.avatar !== undefined ? (b.avatar || null) : cur.avatar,
      (b.bloodType !== undefined || b.blood_type !== undefined) ? (b.bloodType || b.blood_type || null) : cur.blood_type,
      me.id
    );
    return sendJson(res, 200, { success: true, message: 'تم تحديث بيانات الحساب' });
  }

  // 2.1 Change Password (own password; admins may set another user's password)
  if (method === 'POST' && pathname === '/api/auth/change-password') {
    const { userId, oldPassword, newPassword } = await parseBody(req);
    const me = req.authUser;
    const targetId = userId || me.id;
    const changingOther = targetId !== me.id;
    if (changingOther && !me.isAdmin) {
      return sendJson(res, 403, { error: 'لا يمكنك تغيير كلمة مرور مستخدم آخر' });
    }
    const targetUser = db.get('SELECT * FROM users WHERE id = ?', targetId);
    if (!targetUser) {
      return sendJson(res, 404, { error: 'المستخدم غير موجود' });
    }

    if (!newPassword || String(newPassword).length < 6) {
      return sendJson(res, 400, { error: 'كلمة المرور الجديدة يجب ألا تقل عن 6 خانات' });
    }

    // Own password: the current password is required unless a forced change is pending.
    if (!changingOther && targetUser.must_change_password !== 1) {
      if (!oldPassword) {
        return sendJson(res, 400, { error: 'يرجى إدخال كلمة المرور الحالية' });
      }
      const valid = (targetUser.password_hash || '').startsWith('$2')
        ? bcrypt.compareSync(oldPassword, targetUser.password_hash)
        : false;
      if (!valid) {
        return sendJson(res, 400, { error: 'كلمة المرور الحالية غير صحيحة' });
      }
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    db.run(
      'UPDATE users SET password_hash = ?, must_change_password = 0, reset_token_hash = NULL, reset_token_expires_at = NULL WHERE id = ?',
      newHash, targetUser.id
    );
    // Sign out the user's other devices
    auth.revokeAllForUser(targetUser.id, changingOther ? null : me.token);

    return sendJson(res, 200, {
      success: true,
      message: 'تم تغيير كلمة المرور وتفعيل الحساب بنجاح'
    });
  }

  // 2.2 Forgot Password Request (Generates 32-byte crypto token valid for 15 mins)
  if (method === 'POST' && pathname === '/api/auth/forgot-password') {
    const body = await parseBody(req);
    const identifier = body.identifier || body.email || body.username;
    if (!identifier || !String(identifier).trim()) {
      return sendJson(res, 400, { error: 'يرجى إدخال اسم المستخدم أو البريد الإلكتروني' });
    }
    const clean = String(identifier).trim();
    const targetUser = db.get('SELECT * FROM users WHERE username = ? OR email = ?', clean, clean);
    if (!targetUser) {
      // Return successful looking response for privacy or inform user
      return sendJson(res, 200, {
        success: true,
        message: 'إذا كان الحساب مسجلاً لدينا، فقد تم إصدار رابط استعادة كلمة المرور'
      });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    db.run(
      'UPDATE users SET reset_token_hash = ?, reset_token_expires_at = ? WHERE id = ?',
      tokenHash, expiresAt, targetUser.id
    );

    const mailRes = await sendPasswordResetEmail(targetUser, rawToken, config.PUBLIC_URL);
    if (mailRes.mode !== 'smtp' && config.LOG_RESET_LINKS) {
      // No SMTP configured: the link is only shown to whoever runs the server, never returned to the browser.
      console.log(`[password-reset] ${targetUser.username}: ${config.PUBLIC_URL}/?resetToken=${rawToken} (valid 15 min)`);
    }

    return sendJson(res, 200, {
      success: true,
      message: (mailRes.mode === 'smtp')
        ? 'إذا كان الحساب مسجلاً لدينا، فقد تم إرسال رابط استعادة كلمة المرور إلى البريد الإلكتروني (صالح لمدة 15 دقيقة)'
        : 'تم تسجيل طلب الاستعادة. البريد الإلكتروني غير مفعّل على الخادم، لذا يرجى التواصل مع مدير النظام للحصول على رابط الاستعادة'
    });
  }

  // 2.3 Reset Password via Token
  if (method === 'POST' && pathname === '/api/auth/reset-password') {
    const { token, newPassword } = await parseBody(req);
    if (!token || !newPassword) {
      return sendJson(res, 400, { error: 'بيانات استعادة كلمة المرور غير مكتملة' });
    }
    if (newPassword.length < 6) {
      return sendJson(res, 400, { error: 'كلمة المرور الجديدة يجب ألا تقل عن 6 خانات' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const targetUser = db.get('SELECT * FROM users WHERE reset_token_hash = ?', tokenHash);
    if (!targetUser) {
      return sendJson(res, 400, { error: 'رمز الاستعادة غير صالح أو تم استخدامه مسبقاً' });
    }

    if (new Date(targetUser.reset_token_expires_at).getTime() < Date.now()) {
      return sendJson(res, 400, { error: 'عذراً، انتهت صلاحية رابط الاستعادة (15 دقيقة)' });
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    db.run(
      'UPDATE users SET password_hash = ?, reset_token_hash = NULL, reset_token_expires_at = NULL, must_change_password = 0 WHERE id = ?',
      newHash, targetUser.id
    );
    auth.revokeAllForUser(targetUser.id);

    return sendJson(res, 200, {
      success: true,
      message: 'تم تعيين كلمة المرور الجديدة بنجاح، يمكنك الآن تسجيل الدخول'
    });
  }

  return NEXT;
};
