// PalmTrace HTTP server: CORS, static files, authentication gate, then route modules (backend/routes).
const http = require('node:http');
const config = require('./config');
const auth = require('./auth');
const access = require('./access');
const { runStartupTasks } = require('./startup');
const { sendJson, serveStatic } = require('./lib/http');
const db = require('./db');

runStartupTasks();

const PORT = config.PORT;
const NEXT = Symbol.for('palmtrace.next-route');

// Order matters: modules are tried in sequence, as in the original single-file router.
const ROUTES = [
  require('./routes/public'),
  require('./routes/auth'),
  require('./routes/bootstrap'),
  require('./routes/organization'),
  require('./routes/crops'),
  require('./routes/sectors'),
  require('./routes/investors'),
  require('./routes/plots'),
  require('./routes/palms'),
  require('./routes/operations'),
  require('./routes/sync'),
  require('./routes/harvest'),
  require('./routes/inventory'),
  require('./routes/users'),
  require('./routes/ai'),
  require('./routes/agro'),
];

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id, x-project-id, x-company-id, x-user-role, *'
    });
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;

  // Serve static frontend assets for any non-API request
  if (method === 'GET' && !pathname.startsWith('/api')) {
    return serveStatic(req, res, pathname);
  }

  try {
    // 0. Authentication gate: every API route except the explicit public list needs a valid session.
    if (!auth.isPublicRoute(method, pathname)) {
      const authUser = auth.authenticate(req);
      if (!authUser) {
        return sendJson(res, 401, { error: 'انتهت الجلسة أو لم يتم تسجيل الدخول، يرجى تسجيل الدخول مرة أخرى', code: 'AUTH_REQUIRED' });
      }
      if (authUser.must_change_password === 1 && !auth.isPasswordChangeRoute(pathname)) {
        return sendJson(res, 403, { error: 'يلزم تعيين كلمة مرور جديدة قبل المتابعة', code: 'PASSWORD_CHANGE_REQUIRED' });
      }
      const denied = auth.checkRoleAccess(authUser, method, pathname) || access.checkScopedRoute(authUser, method, pathname);
      if (denied) {
        return sendJson(res, 403, { error: denied, code: 'FORBIDDEN' });
      }
      req.authUser = authUser;
      // Legacy handlers read identity from these headers: replace client claims with the verified identity.
      req.headers['x-user-id'] = authUser.id;
      req.headers['x-user-role'] = authUser.role;
    }

    // Route modules
    for (const handle of ROUTES) {
      const result = await handle(req, res, { method, pathname, url });
      if (result !== NEXT) {
        // Some handlers write with raw prepared statements; make sure cached /api/bootstrap data is refreshed.
        if (method !== 'GET' && !pathname.startsWith('/api/auth/')) db.notifyChange();
        return;
      }
    }

    // 404 Route
    return sendJson(res, 404, { error: 'المسار غير موجود' });

  } catch (err) {
    if (err && err.statusCode === 413) return sendJson(res, 413, { error: err.message });
    if (err instanceof SyntaxError) return sendJson(res, 400, { error: 'بيانات الطلب غير صالحة' });
    console.error('Server error:', err);
    return sendJson(res, 500, { error: 'حدث خطأ في الخادم', details: err.message });
  }
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error('\n================================================================');
    console.error(`  المنفذ ${PORT} مستخدم بالفعل: فيه نسخة تانية من النظام شغالة (غالباً نسخة قديمة).`);
    console.error('  اقفل نافذتها السوداء، أو أوقفها من VS Code بـ Ctrl+C، ثم شغّل النظام من جديد.');
    console.error('  وإلا هيفضل المتصفح يعرض النسخة القديمة.');
    console.error('================================================================\n');
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  console.log(`PalmTrace REST API Server is running on port ${PORT} (IPv4 + IPv6 localhost)`);
  console.log(`Folder: ${require('./config').ROOT_DIR}`);
});

// Dual-port listening (Port 80) only for local desktop testing
if (!process.env.PORT && !process.env.RENDER && PORT !== 80) {
  try {
    const server80 = http.createServer((req, res) => {
      server.emit('request', req, res);
    });
    server80.on('error', err => {
      console.log(`Port 80 binding note: ${err.message}`);
    });
    server80.listen(80, () => {
      console.log(`PalmTrace is also running directly on http://localhost (port 80)`);
    });
  } catch (err) {
    // Port 80 not available or restricted
  }
}


