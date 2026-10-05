const assert = require('node:assert');
const XLSX = require('xlsx');
const db = require('../../db');
const { generatePlotsTemplateBuffer, processPlotRows, computeConvexHull, updateSectorGis } = require('../../plots_gis_handler');

async function runTests() {
  console.log('=====================================================');
  console.log('🧪 Starting Test Suite: Smart Agri-GIS Plots & Boundaries');
  console.log('=====================================================');

  // Test 1: Template generation
  console.log('\n--- Test 1: Generate Excel Template ---');
  const buf = generatePlotsTemplateBuffer();
  assert(buf && buf.length > 1000, 'Template buffer should be generated');
  const wb = XLSX.read(buf, { type: 'buffer' });
  assert.strictEqual(wb.SheetNames[0], 'القطع والحدود');
  const sheet = wb.Sheets['القطع والحدود'];
  const jsonRows = XLSX.utils.sheet_to_json(sheet);
  assert.strictEqual(jsonRows.length, 3, 'Sample template should have 3 rows');
  console.log('✅ Test 1 Passed: Template generated with 3 sample rows.');

  // Test 2: Import 19 Columns with Parent / Child Hierarchy
  console.log('\n--- Test 2: Process 19 Columns & Boundaries ---');
  const testRows = [
    {
      'كود القطاع (إلزامي)': 'TEST_SEC_99',
      'كود القطعة الأم (اختياري)': '',
      'كود القطعة (إلزامي)': 'P99',
      'اسم / وصف القطعة': 'القطعة التجريبية الكبرى 99 (أم)',
      'المساحة': 10.0,
      'وحدة المساحة': 'فدان',
      'المحصول الأساسي': 'نخيل مجدول',
      'كود / هاتف المستثمر': '0100000000',
      'رقم العقد الاستثماري': 'TEST-CNT-99',
      'نقطة 1 - خط العرض (Lat)': 27.050000,
      'نقطة 1 - خط الطول (Lng)': 31.160000,
      'نقطة 2 - خط العرض (Lat)': 27.050000,
      'نقطة 2 - خط الطول (Lng)': 31.170000,
      'نقطة 3 - خط العرض (Lat)': 27.040000,
      'نقطة 3 - خط الطول (Lng)': 31.170000,
      'نقطة 4 - خط العرض (Lat)': 27.040000,
      'نقطة 4 - خط الطول (Lng)': 31.160000,
      'سعة النخيل المقدرة': 280,
      'مصدر / محبس الري': 'محبس رئيسي V99'
    },
    {
      'كود القطاع (إلزامي)': 'TEST_SEC_99',
      'كود القطعة الأم (اختياري)': 'P99',
      'كود القطعة (إلزامي)': 'P99A',
      'اسم / وصف القطعة': 'حوشة 99A الشرقية (فرعية)',
      'المساحة': 5.0,
      'وحدة المساحة': 'فدان',
      'المحصول الأساسي': 'نخيل مجدول',
      'كود / هاتف المستثمر': '0100000000',
      'رقم العقد الاستثماري': 'TEST-CNT-99',
      'نقطة 1 - خط العرض (Lat)': 27.050000,
      'نقطة 1 - خط الطول (Lng)': 31.165000,
      'نقطة 2 - خط العرض (Lat)': 27.050000,
      'نقطة 2 - خط الطول (Lng)': 31.170000,
      'نقطة 3 - خط العرض (Lat)': 27.040000,
      'نقطة 3 - خط الطول (Lng)': 31.170000,
      'نقطة 4 - خط العرض (Lat)': 27.040000,
      'نقطة 4 - خط الطول (Lng)': 31.165000,
      'سعة النخيل المقدرة': 140,
      'مصدر / محبس الري': 'محبس فرعي V99-A'
    },
    {
      'كود القطاع (إلزامي)': 'TEST_SEC_99',
      'كود القطعة الأم (اختياري)': 'P99',
      'كود القطعة (إلزامي)': 'P99B',
      'اسم / وصف القطعة': 'حوشة 99B الغربية (فرعية)',
      'المساحة': 5.0,
      'وحدة المساحة': 'فدان',
      'المحصول الأساسي': 'نخيل مجدول',
      'كود / هاتف المستثمر': '0100000000',
      'رقم العقد الاستثماري': 'TEST-CNT-99',
      'نقطة 1 - خط العرض (Lat)': 27.050000,
      'نقطة 1 - خط الطول (Lng)': 31.160000,
      'نقطة 2 - خط العرض (Lat)': 27.050000,
      'نقطة 2 - خط الطول (Lng)': 31.165000,
      'نقطة 3 - خط العرض (Lat)': 27.040000,
      'نقطة 3 - خط الطول (Lng)': 31.165000,
      'نقطة 4 - خط العرض (Lat)': 27.040000,
      'نقطة 4 - خط الطول (Lng)': 31.160000,
      'سعة النخيل المقدرة': 140,
      'مصدر / محبس الري': 'محبس فرعي V99-B'
    }
  ];

  const res = processPlotRows(testRows);
  assert(res.success, 'Import should succeed');
  assert.strictEqual(res.importedCount, 3, 'Should import 3 plots');
  console.log('✅ Test 2 Passed: 3 plots imported with GIS attributes.');

  // Test 3: Check Database Records, Center Calculation, & Boundary
  console.log('\n--- Test 3: Verify Database Records & Calculations ---');
  const parentPlot = db.get("SELECT * FROM plots WHERE id = 'TEST_SEC_99-P99'");
  assert(parentPlot, 'Parent plot must exist in database');
  assert.strictEqual(parentPlot.area_value, 10.0);
  assert.strictEqual(parentPlot.target_capacity, 280);
  assert.strictEqual(parentPlot.center_lat, 27.045);
  assert.strictEqual(parentPlot.center_lng, 31.165);

  const coords = JSON.parse(parentPlot.boundary_coordinates);
  assert.strictEqual(coords.length, 5, 'Boundary coordinates must form closed 5-point loop');
  assert.deepStrictEqual(coords[0], coords[4], 'Loop must start and end at same point');

  const childPlotA = db.get("SELECT * FROM plots WHERE id = 'TEST_SEC_99-P99A'");
  assert(childPlotA, 'Child plot A must exist');
  assert.strictEqual(childPlotA.parent_plot_id, 'TEST_SEC_99-P99', 'Child plot must link to parent plot');
  assert.strictEqual(childPlotA.area_value, 5.0);

  console.log('✅ Test 3 Passed: Coordinates, polygon closure, center, and hierarchy verified.');

  // Test 4: Verify No Double-Counting of Area in Sector
  console.log('\n--- Test 4: Verify No Double-Counting of Sector Total Area ---');
  const sec = db.get("SELECT * FROM sectors WHERE id = 'TEST_SEC_99'");
  assert(sec, 'Sector must exist');
  console.log('Calculated Sector Total Area:', sec.total_area);
  assert.strictEqual(sec.total_area, 10.0, 'Total sector area must be 10.0 Feddans (sum of child plots 5.0 + 5.0, NOT 10 + 5 + 5 = 20)');
  assert(sec.boundary_coordinates, 'Sector should have aggregated convex boundary coordinates');
  const secCoords = JSON.parse(sec.boundary_coordinates);
  assert(secCoords.length >= 4, 'Sector boundary should have at least 4 points');
  console.log('✅ Test 4 Passed: Zero double-counting verified. Sector area is exactly 10.0 feddans.');

  // Cleanup test data
  db.run("DELETE FROM user_plots WHERE plot_id LIKE 'TEST_SEC_99%'");
  db.run("DELETE FROM plots WHERE sector_id = 'TEST_SEC_99'");
  db.run("DELETE FROM sectors WHERE id = 'TEST_SEC_99'");
  console.log('\n🧹 Test data cleaned up successfully.');

  console.log('\n=====================================================');
  console.log('🎉 ALL 4 GIS & BOUNDARY TESTS PASSED 100%!');
  console.log('=====================================================');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

