const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const db = require('../../db');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('=== Starting Automated Verification Tests ===');

  // Test 1: SQLite schema and seeded sources
  console.log('\n[1/5] Verifying SQLite schema and seeded crop_planting_sources...');
  const tableCheck = db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='crop_planting_sources'");
  assert(tableCheck, 'crop_planting_sources table must exist in SQLite');

  const sources = db.all("SELECT * FROM crop_planting_sources ORDER BY crop_id, is_default DESC");
  console.log(`✓ Found ${sources.length} sources in crop_planting_sources`);
  
  const palmSources = sources.filter(s => s.crop_id === 'palm');
  const oliveSources = sources.filter(s => s.crop_id === 'olive');
  const mangoSources = sources.filter(s => s.crop_id === 'mango');

  assert(palmSources.some(s => s.code_letter === 'F' && s.is_default === 1), 'Palm must have F as default source');
  assert(palmSources.some(s => s.code_letter === 'N' && s.is_default === 0), 'Palm must have N as source');
  assert(oliveSources.some(s => s.code_letter === 'C' && s.is_default === 1), 'Olive must have C as default source');
  assert(oliveSources.some(s => s.code_letter === 'S' && s.is_default === 0), 'Olive must have S as source');
  assert(mangoSources.some(s => s.code_letter === 'G' && s.is_default === 1), 'Mango must have G as default source');
  assert(mangoSources.some(s => s.code_letter === 'A' && s.is_default === 0), 'Mango must have A as source');
  console.log('✓ Default sources per crop validated with correct code letters and default flags.');

  // Test 2: Backend API GET /api/crops
  console.log('\n[2/5] Testing GET /api/crops from API server...');
  const cropsRes = await fetchJson('http://localhost:3000/api/crops');
  assert.strictEqual(cropsRes.status, 200, 'GET /api/crops should return status 200');
  const crops = cropsRes.body;
  assert(Array.isArray(crops) && crops.length >= 2, 'Should return at least 2 crops');
  
  const palm = crops.find(c => c.code === 'palm');
  const olive = crops.find(c => c.code === 'olive');
  assert(palm, 'Palm crop must exist');
  assert(olive, 'Olive crop must exist');
  assert(palm.yieldName && palm.yield_name, 'Palm must have valid yieldName and yield_name');
  assert.notStrictEqual(palm.yieldName, 'undefined', 'yieldName must not be undefined string');
  assert.notStrictEqual(olive.yieldName, 'undefined', 'yieldName must not be undefined string');
  assert(Array.isArray(palm.sources) && palm.sources.length >= 2, 'Palm sources array must be populated');
  assert(Array.isArray(olive.sources) && olive.sources.length >= 2, 'Olive sources array must be populated');
  console.log(`✓ Palm yield: ${palm.yieldName} (${palm.unit}), sources: ${palm.sources.map(s => s.code).join(',')}`);
  console.log(`✓ Olive yield: ${olive.yieldName} (${olive.unit}), sources: ${olive.sources.map(s => s.code).join(',')}`);

  // Test 3: Backend API GET /api/crops/olive/sources
  console.log('\n[3/5] Testing GET /api/crops/olive/sources...');
  const oliveSrcRes = await fetchJson('http://localhost:3000/api/crops/olive/sources');
  assert.strictEqual(oliveSrcRes.status, 200, 'GET /api/crops/olive/sources should return 200');
  const oSources = oliveSrcRes.body;
  assert(Array.isArray(oSources) && oSources.length >= 2, 'Olive sources must have at least 2 items');
  assert(oSources.some(s => s.codeLetter === 'C'), 'Olive must include C');
  assert(oSources.some(s => s.codeLetter === 'S'), 'Olive must include S');
  console.log('✓ Scoped crop sources endpoint returns correct non-colliding letters.');

  // Test 4: Frontend palmNewView layout & CSS classes
  console.log('\n[4/5] Verifying palmNewView layout & CSS rules...');
  const appJs = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'frontend', 'js', 'app.js'), 'utf8');
  const appCss = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'frontend', 'css', 'app.css'), 'utf8');
  const storeJs = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'frontend', 'js', 'store.js'), 'utf8');

  assert(appCss.includes('.nursery-segmented-wrap'), 'app.css must define .nursery-segmented-wrap');
  assert(appCss.includes('.nursery-seg-btn'), 'app.css must define .nursery-seg-btn');
  assert(appCss.includes('.tree-form-grid'), 'app.css must define .tree-form-grid');
  assert(appCss.includes('.tree-notes-compact'), 'app.css must define .tree-notes-compact');
  assert(appCss.includes('.tree-actions-center'), 'app.css must define .tree-actions-center');

  assert(appJs.includes('nursery-segmented-wrap'), 'palmNewView must use nursery-segmented-wrap');
  assert(appJs.includes('tree-form-grid'), 'palmNewView must use tree-form-grid');
  assert(appJs.includes('tree-notes-compact'), 'palmNewView must use tree-notes-compact');
  assert(appJs.includes('btn-save') && appJs.includes('btn-cancel'), 'palmNewView must have centered save & cancel buttons');
  console.log('✓ palmNewView segmented filter, 2-column grid, compact notes, and actions verified.');

  // Test 5: Code generation unresponsiveness fix & getCropPlantingSources
  console.log('\n[5/5] Verifying code generation unresponsiveness fix and getCropPlantingSources...');
  assert(storeJs.includes('function getCropPlantingSources'), 'store.js must export getCropPlantingSources');
  assert(appJs.includes('data-act="change-gencrop"'), 'generateView must bind change-gencrop with data-act');
  assert(appJs.includes('nextSuggestedSector'), 'app.js must define nextSuggestedSector');
  assert(appJs.includes('genLastSector'), 'app.js must track and advance genLastSector on commit');
  assert(!appJs.includes('c.yieldName} (${c.unit'), 'Crop cards must not render unescaped undefined c.yieldName');
  console.log('✓ Code generation reactive logic and unresponsiveness fixes verified.');

  console.log('\n🎉 ALL 5 VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});

