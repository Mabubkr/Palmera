const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Starting User Avatar, Blood Type & Action Menu UX Verification Test...');

async function runTests() {
  const testUsername = `test_emp_${Date.now()}`;
  const testAvatar = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...sample_avatar_string...';
  const testBloodType = 'A+';

  // 1. Test POST /api/users with avatar and bloodType
  console.log('1️⃣ Creating user with avatar and bloodType via POST /api/users...');
  const createRes = await fetch('http://localhost:3000/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: testUsername,
      fullName: 'مهندس حقل تجريبي',
      role: 'engineer',
      phone: '01012345678',
      email: `${testUsername}@farm.com`,
      pass: '1234',
      avatar: testAvatar,
      bloodType: testBloodType
    })
  });
  assert.strictEqual(createRes.status, 201, 'POST /api/users should return 201');
  const createData = await createRes.json();
  assert.strictEqual(createData.user.avatar, testAvatar, 'Created user avatar should match');
  assert.strictEqual(createData.user.bloodType, testBloodType, 'Created user bloodType should match');
  console.log('   ✅ User created successfully with avatar and bloodType!');

  // 2. Test GET /api/users
  console.log('2️⃣ Verifying user in GET /api/users list...');
  const listRes = await fetch('http://localhost:3000/api/users');
  assert.strictEqual(listRes.status, 200, 'GET /api/users should return 200');
  const usersList = await listRes.json();
  const fetchedUser = usersList.find(u => u.username === testUsername);
  assert(fetchedUser, 'Created user must be found in users list');
  assert.strictEqual(fetchedUser.avatar, testAvatar, 'Avatar should match in list');
  assert.strictEqual(fetchedUser.bloodType, testBloodType, 'BloodType should match in list');
  console.log('   ✅ User avatar and bloodType verified in user list API!');

  // 3. Test GET /api/bootstrap
  console.log('3️⃣ Verifying user in GET /api/bootstrap...');
  const bootRes = await fetch('http://localhost:3000/api/bootstrap');
  assert.strictEqual(bootRes.status, 200, 'GET /api/bootstrap should return 200');
  const bootData = await bootRes.json();
  const bootUser = bootData.users.find(u => u.user === testUsername);
  assert(bootUser, 'User must be found in bootstrap users');
  assert.strictEqual(bootUser.avatar, testAvatar, 'Avatar should match in bootstrap');
  assert.strictEqual(bootUser.bloodType, testBloodType, 'BloodType should match in bootstrap');
  console.log('   ✅ Bootstrap hydration includes avatar and bloodType!');

  // 4. Test POST /api/auth/login
  console.log('4️⃣ Verifying user session response in POST /api/auth/login...');
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: testUsername,
      password: '1234'
    })
  });
  assert.strictEqual(loginRes.status, 200, 'POST /api/auth/login should return 200');
  const loginData = await loginRes.json();
  assert.strictEqual(loginData.user.avatar, testAvatar, 'Login response must include avatar');
  assert.strictEqual(loginData.user.bloodType, testBloodType, 'Login response must include bloodType');
  console.log('   ✅ Login session includes user avatar and bloodType!');

  // 5. Inspect frontend app.js and app.css files for UI components
  console.log('5️⃣ Verifying frontend templates and responsive dropdown menu logic...');
  const appJs = fs.readFileSync(path.join(__dirname, '../../../frontend/js/app.js'), 'utf8');
  const appCss = fs.readFileSync(path.join(__dirname, '../../../frontend/css/app.css'), 'utf8');

  // Verify CSS
  assert(appCss.includes('.sticky-act'), 'app.css must have .sticky-act class');
  assert(appCss.includes('.action-menu-wrap'), 'app.css must have .action-menu-wrap class');
  assert(appCss.includes('.action-dropdown-menu'), 'app.css must have .action-dropdown-menu class');
  assert(appCss.includes('.avatar-upload-box'), 'app.css must have .avatar-upload-box class');
  console.log('   ✅ CSS styles for sticky column, action dropdown, and avatar boxes verified!');

  // Verify app.js
  assert(appJs.includes('activeUserMenuId'), 'app.js must manage activeUserMenuId');
  assert(appJs.includes('toggle-user-menu'), 'app.js must handle toggle-user-menu action');
  assert(appJs.includes('trigger-avatar-upload'), 'app.js must handle trigger-avatar-upload');
  assert(appJs.includes('id-card-avatar'), 'app.js must render id-card-avatar with real image');
  assert(appJs.includes('pblood'), 'profileView must have pblood select');
  assert(appJs.includes('ublood'), 'user views must have ublood select');
  console.log('   ✅ app.js template and event handler integrations verified!');

  // Clean up test user
  const db = require('../../db.js');
  db.run('DELETE FROM users WHERE username = ?', testUsername);
  console.log('   🧹 Test user cleaned up from database.');

  console.log('\n🎉 ALL USER AVATAR, BLOOD TYPE & ACTION MENU TESTS PASSED 100%!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

