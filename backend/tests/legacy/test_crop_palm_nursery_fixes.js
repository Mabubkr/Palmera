const assert = require('assert');
const db = require('../../db');

async function testAll() {
  console.log('--- Starting Verification of 5 Issues ---');

  // 0. Syntax check of client scripts
  console.log('Checking client script syntax...');
  require('child_process').execSync('node --check frontend/js/store.js');
  require('child_process').execSync('node --check frontend/js/api.js');
  require('child_process').execSync('node --check frontend/js/app.js');
  console.log('✓ All client scripts have valid syntax.');

  // 1. Issue 1: Palm GPS Coordinates
  console.log('\nTesting Issue 1: Palm GPS Coordinates Save...');
  const palmUpdateRes = await fetch('http://localhost:3000/api/palms/1', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gps_lat: 28.358212,
      gps_lng: 28.868735,
      notes: 'تم تحديث الإحداثيات'
    })
  });
  assert.strictEqual(palmUpdateRes.status, 200);
  const palmData = await palmUpdateRes.json();
  assert.strictEqual(palmData.success, true);

  const palmRow = db.get('SELECT id, code, gps_lat, gps_lng, notes FROM palms WHERE id = 1');
  assert.strictEqual(palmRow.gps_lat, 28.358212, 'gps_lat must be saved in database');
  assert.strictEqual(palmRow.gps_lng, 28.868735, 'gps_lng must be saved in database');
  console.log('✓ Palm GPS coordinates saved in SQLite database:', palmRow.gps_lat, palmRow.gps_lng);

  // 2. Issue 2: Crop Toggle & Emoji Edit Persistence
  console.log('\nTesting Issue 2: Crop Toggle & Emoji/Attribute Edit...');
  // 2a. Toggle crop to inactive
  const togRes = await fetch('http://localhost:3000/api/crops/mango/toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active: false })
  });
  const togData = await togRes.json();
  assert.strictEqual(togData.active, false);
  const mangoRow1 = db.get("SELECT active FROM crops WHERE code = 'mango'");
  assert.strictEqual(mangoRow1.active, 0, 'mango active must be 0 in SQLite');
  console.log('✓ Crop toggle to disabled persisted in SQLite (active = 0).');

  // 2b. Edit crop with emoji and active = true
  const editRes = await fetch('http://localhost:3000/api/crops/mango', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'أشجار المانجو الفاخرة',
      icon: '🥭',
      single: 'شجرة مانجو',
      plural: 'أشجار مانجو',
      yieldName: 'ثمار المانجو',
      active: 1
    })
  });
  assert.strictEqual(editRes.status, 200);
  const mangoRow2 = db.get("SELECT name, icon, active FROM crops WHERE code = 'mango'");
  assert.strictEqual(mangoRow2.icon, '🥭', 'Icon must be saved');
  assert.strictEqual(mangoRow2.name, 'أشجار المانجو الفاخرة');
  assert.strictEqual(mangoRow2.active, 1);
  console.log('✓ Crop emoji & name updated and persisted in SQLite:', mangoRow2);

  // 3. Issue 3, 4, 5: Nursery Prep Types (Create, Scoped Sources, Toggle, Persistence)
  console.log('\nTesting Issues 3, 4, 5: Nursery Prep Types Management...');
  // 3a. Create new activity for Mango
  const addPrepRes = await fetch('http://localhost:3000/api/nursery-preps', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'np_test_mango',
      name: 'تطعيم مانجو كيت بالقلم',
      cropId: 'mango',
      sourceCode: 'G'
    })
  });
  assert.strictEqual(addPrepRes.status, 201);
  const prepRow = db.get("SELECT * FROM nursery_prep_types WHERE id = 'np_test_mango'");
  assert.strictEqual(prepRow.crop_id, 'mango');
  assert.strictEqual(prepRow.source_code, 'G');
  assert.strictEqual(prepRow.active, 1);
  console.log('✓ Mango nursery activity created with crop_id=mango and source_code=G.');

  // 3b. Toggle prep activity (must NOT delete)
  const togPrepRes = await fetch('http://localhost:3000/api/nursery-preps/np_test_mango/toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active: false })
  });
  const togPrepData = await togPrepRes.json();
  assert.strictEqual(togPrepData.active, false);
  const prepRowDisabled = db.get("SELECT active FROM nursery_prep_types WHERE id = 'np_test_mango'");
  assert.strictEqual(prepRowDisabled.active, 0, 'Prep activity must be marked inactive (0), not deleted!');
  console.log('✓ Prep activity toggle disabled marked active=0 without deleting.');

  // 3c. Update prep activity
  const updatePrepRes = await fetch('http://localhost:3000/api/nursery-preps/np_test_mango', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'تطعيم مانجو كيت بالعين والتطويش',
      cropId: 'mango',
      sourceCode: 'G',
      active: 1
    })
  });
  assert.strictEqual(updatePrepRes.status, 200);
  const prepRowUpdated = db.get("SELECT name, active FROM nursery_prep_types WHERE id = 'np_test_mango'");
  assert.strictEqual(prepRowUpdated.name, 'تطعيم مانجو كيت بالعين والتطويش');
  assert.strictEqual(prepRowUpdated.active, 1);
  console.log('✓ Prep activity updated successfully in SQLite:', prepRowUpdated.name);

  // 4. Test Bootstrap (Simulates Browser Page Refresh F5)
  console.log('\nTesting Page Refresh (GET /api/bootstrap)...');
  const bootRes = await fetch('http://localhost:3000/api/bootstrap');
  const bootData = await bootRes.json();
  
  const bPalm = bootData.palms.find(p => p.id === 1);
  assert.strictEqual(bPalm.gps_lat, 28.358212, 'Bootstrap palm must contain updated gps_lat');
  assert.strictEqual(bPalm.gps_lng, 28.868735, 'Bootstrap palm must contain updated gps_lng');

  const bMango = bootData.crops.find(c => c.id === 'mango' || c.code === 'mango');
  assert.strictEqual(bMango.icon, '🥭', 'Bootstrap crops must contain updated emoji');
  assert.strictEqual(bMango.active, true, 'Bootstrap crops must include active status');

  const bPrep = bootData.nurseryPrepTypes.find(p => p.id === 'np_test_mango');
  assert.ok(bPrep, 'Bootstrap must return created nurseryPrepTypes after refresh');
  assert.strictEqual(bPrep.cropId, 'mango');
  assert.strictEqual(bPrep.sourceCode, 'G');
  console.log('✓ Bootstrap returned all updated data (Palm GPS, Crop Emoji, Nursery Preps) successfully!');

  // Cleanup test prep
  await fetch('http://localhost:3000/api/nursery-preps/np_test_mango', { method: 'DELETE' });
  console.log('✓ Cleaned up test nursery prep record.');

  console.log('\n🎉 ALL 5 ISSUES VERIFIED SUCCESSFULLY WITH 100% PASS RATE!');
}

testAll().catch(e => { console.error('TEST FAILED:', e); process.exit(1); });

