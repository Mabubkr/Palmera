const http = require('node:http');

function req(options, data = null) {
  return new Promise((resolve, reject) => {
    const request = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: body ? JSON.parse(body) : null });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    request.on('error', reject);
    if (data) request.write(typeof data === 'string' ? data : JSON.stringify(data));
    request.end();
  });
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${msg}`);
}

async function run() {
  console.log('=== TEST SUITE: ACCOUNT PROVISIONING, RECOVERY, SYNC & SECURITY ===\n');

  // 1. Health check
  const health = await req({ hostname: 'localhost', port: 3000, path: '/api/health', method: 'GET' });
  assert(health.status === 200 && health.body.status === 'online', 'Health endpoint online');

  // 2. Test /api/sync/all (Fixing the 404 from console)
  const syncAllRes = await req(
    { hostname: 'localhost', port: 3000, path: '/api/sync/all', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { sectors: [{ id: '03', name: 'قطاع 03' }], operations: [] }
  );
  assert(syncAllRes.status === 200, `POST /api/sync/all returns 200 (was 404). Message: ${syncAllRes.body?.message}`);

  // 3. User provisioning with temporary password
  const testUsername = `test_worker_${Date.now()}`;
  const testEmail = `${testUsername}@palm-farm.com`;
  const createRes = await req(
    { hostname: 'localhost', port: 3000, path: '/api/users', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    {
      user: testUsername,
      name: 'عامل ميداني تجريبي',
      role: 'worker',
      phone: '01012345678',
      email: testEmail,
      mustChangePassword: true
    }
  );
  assert(createRes.status === 201 && createRes.body.success, 'Admin creates user successfully');
  assert(createRes.body.tempPassword && createRes.body.tempPassword.startsWith('Palm#'), `Auto-generated secure temp password: ${createRes.body.tempPassword}`);
  const tempPassword = createRes.body.tempPassword;
  const testUserId = createRes.body.id;

  // 4. Login with temporary password
  const loginRes = await req(
    { hostname: 'localhost', port: 3000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { username: testUsername, password: tempPassword }
  );
  assert(loginRes.status === 200 && loginRes.body.success, 'Login with temp password succeeded');
  assert(loginRes.body.user.mustChangePassword === true, 'user.mustChangePassword flag is TRUE (forces change password modal)');
  assert(loginRes.body.user.email === testEmail, `User email returned properly: ${loginRes.body.user.email}`);

  // 5. Change Password on first login
  const changeRes = await req(
    { hostname: 'localhost', port: 3000, path: '/api/auth/change-password', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { userId: testUserId, newPassword: 'NewSecurePass#2026' }
  );
  assert(changeRes.status === 200 && changeRes.body.success, 'User changed temp password to personal permanent password');

  // 6. Login again with new password
  const login2Res = await req(
    { hostname: 'localhost', port: 3000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { username: testUsername, password: 'NewSecurePass#2026' }
  );
  assert(login2Res.status === 200, 'Login with new personal password succeeded');
  assert(login2Res.body.user.mustChangePassword === false, 'user.mustChangePassword is now FALSE');

  // 7. Forgot password via username/email
  const forgotRes = await req(
    { hostname: 'localhost', port: 3000, path: '/api/auth/forgot-password', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { identifier: testEmail }
  );
  assert(forgotRes.status === 200 && forgotRes.body.token, `Forgot password generated 32-byte crypto token: ${forgotRes.body.token.slice(0, 16)}...`);
  const resetToken = forgotRes.body.token;

  // 8. Reset password via token
  const resetRes = await req(
    { hostname: 'localhost', port: 3000, path: '/api/auth/reset-password', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { token: resetToken, newPassword: 'ResetPassedPass#2026' }
  );
  assert(resetRes.status === 200 && resetRes.body.success, 'Reset password via token succeeded');

  // 9. Administrative quick reset by supervisor
  const adminResetRes = await req(
    { hostname: 'localhost', port: 3000, path: `/api/users/${testUserId}/reset-password`, method: 'POST' }
  );
  assert(adminResetRes.status === 200 && adminResetRes.body.tempPassword, `Admin reset generated new temp password: ${adminResetRes.body.tempPassword}`);

  // 10. Clean up test user
  const delRes = await req(
    { hostname: 'localhost', port: 3000, path: `/api/users/${testUserId}`, method: 'DELETE' }
  );
  assert(delRes.status === 200, 'Test user cleaned up cleanly');

  // 11. Verify PWA Icons
  const fs = require('node:fs');
  assert(fs.existsSync('frontend/icons/icon-192.png'), 'PWA icon-192.png exists (eliminates 404)');
  assert(fs.existsSync('frontend/icons/icon-512.png'), 'PWA icon-512.png exists');

  console.log('\n🎉 ALL 11 VERIFICATION TESTS PASSED SUCCESSFULLY 100%!');
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

