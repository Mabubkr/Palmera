const http = require('http');
const assert = require('assert');
const db = require('../../db');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(typeof data === 'string' ? data : JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  console.log('=== Starting Fertilizer Setup Persistence Tests ===');

  const testFertId = 'fert_test_' + Date.now();
  const testFertName = 'سماد تجريبي مركب سائل ' + Date.now();

  // Test 1: POST /api/fertilizers
  console.log('1. Testing POST /api/fertilizers to add new fertilizer...');
  const addRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/fertilizers',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    id: testFertId,
    name: testFertName,
    kind: 'مخصب',
    unit: 'لتر',
    cropId: 'palm',
    stock: 250,
    allocated: 0,
    consumed: 0,
    minAlert: 30,
    unitCost: 85,
    active: true
  });

  assert.strictEqual(addRes.status, 201, 'Expected 201 Created');
  console.log('✓ POST /api/fertilizers succeeded:', addRes.data.message);

  // Test 2: Verify in SQLite database directly
  console.log('2. Verifying row in SQLite fertilizers table...');
  const row = db.get('SELECT * FROM fertilizers WHERE id = ?', testFertId);
  assert.ok(row, 'Fertilizer row should exist in SQLite');
  assert.strictEqual(row.name, testFertName);
  assert.strictEqual(row.kind, 'مخصب');
  assert.strictEqual(row.unit, 'لتر');
  assert.strictEqual(row.crop_id, 'palm');
  assert.strictEqual(row.active, 1);
  assert.strictEqual(row.stock, 250);
  console.log('✓ Fertilizer exists in SQLite with correct crop_id and active status.');

  // Test 3: Verify GET /api/fertilizers and GET /api/bootstrap
  console.log('3. Verifying GET /api/fertilizers...');
  const getFertsRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/fertilizers',
    method: 'GET'
  });
  assert.strictEqual(getFertsRes.status, 200);
  const foundInList = getFertsRes.data.find(f => f.id === testFertId);
  assert.ok(foundInList, 'Fertilizer should be in GET /api/fertilizers');
  assert.strictEqual(foundInList.cropId, 'palm');
  assert.strictEqual(foundInList.active, true);
  console.log('✓ GET /api/fertilizers returned the fertilizer with correct camelCase properties.');

  console.log('4. Verifying GET /api/bootstrap...');
  const bootRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bootstrap',
    method: 'GET'
  });
  assert.strictEqual(bootRes.status, 200);
  const foundInBoot = bootRes.data.fertilizers.find(f => f.id === testFertId);
  assert.ok(foundInBoot, 'Fertilizer should be returned in /api/bootstrap');
  assert.strictEqual(foundInBoot.name, testFertName);
  console.log('✓ /api/bootstrap returns newly added fertilizer.');

  // Test 4: PUT /api/fertilizers/:id (edit name and unit)
  console.log('5. Testing PUT /api/fertilizers/:id to edit fertilizer...');
  const updatedName = testFertName + ' (معدّل)';
  const updateRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/fertilizers/${encodeURIComponent(testFertId)}`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' }
  }, {
    id: testFertId,
    name: updatedName,
    kind: 'مخصب',
    unit: 'كجم',
    cropId: 'all'
  });
  assert.strictEqual(updateRes.status, 200);

  const updatedRow = db.get('SELECT * FROM fertilizers WHERE id = ?', testFertId);
  assert.strictEqual(updatedRow.name, updatedName);
  assert.strictEqual(updatedRow.unit, 'كجم');
  assert.strictEqual(updatedRow.crop_id, 'all');
  console.log('✓ Fertilizer updated successfully in SQLite.');

  // Test 5: POST /api/fertilizers/:id/toggle (toggle active to false)
  console.log('6. Testing toggle active to false...');
  const toggleRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/fertilizers/${encodeURIComponent(testFertId)}/toggle`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { active: false });
  assert.strictEqual(toggleRes.status, 200);
  assert.strictEqual(toggleRes.data.active, false);

  const disabledRow = db.get('SELECT * FROM fertilizers WHERE id = ?', testFertId);
  assert.strictEqual(disabledRow.active, 0);

  // Test 6: Verify disabled fertilizer is STILL returned in bootstrap and /api/fertilizers for settings UI
  console.log('7. Verifying disabled fertilizer is loaded in bootstrap for settings visibility...');
  const bootAfterToggle = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bootstrap',
    method: 'GET'
  });
  const foundDisabled = bootAfterToggle.data.fertilizers.find(f => f.id === testFertId);
  assert.ok(foundDisabled, 'Disabled fertilizer must still be returned in bootstrap for settings management');
  assert.strictEqual(foundDisabled.active, false);
  console.log('✓ Inactive fertilizer correctly retained in bootstrap with active=false.');

  // Clean up test row
  db.run('DELETE FROM fertilizers WHERE id = ?', testFertId);
  console.log('✓ Cleaned up test fertilizer row.');

  console.log('\n=============================================');
  console.log('ALL FERTILIZER TESTS PASSED SUCCESSFULLY! ✓');
  console.log('=============================================');
}

runTests().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});

