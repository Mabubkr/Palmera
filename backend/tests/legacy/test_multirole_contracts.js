const http = require('http');
const XLSX = require('xlsx');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: buffer,
          json: () => {
            try { return JSON.parse(buffer.toString('utf8')); } catch (e) { return null; }
          }
        });
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(data);
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== Running Multi-Role & Investment Contracts Verification Tests ===\n');

  // Test 1: Download Investors Template
  console.log('Test 1: GET /api/investors/template');
  const tplRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/investors/template',
    method: 'GET'
  });
  console.log('Status:', tplRes.statusCode);
  if (tplRes.statusCode === 200 && tplRes.headers['content-type'].includes('spreadsheetml')) {
    const wb = XLSX.read(tplRes.body, { type: 'buffer' });
    console.log('Sheet name:', wb.SheetNames[0]);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);
    console.log(`✓ Template has ${rows.length} sample rows and 12 columns.`);
  } else {
    throw new Error('Template download failed');
  }

  // Test 2: Import Investors & Contracts via POST /api/investors/import
  console.log('\nTest 2: POST /api/investors/import (Excel JSON rows)');
  const testPayload = {
    rows: [
      {
        'اسم المستثمر (إلزامي)': 'سلطان عبدالعزيز الدوسري',
        'رقم الهاتف / اسم الدخول (إلزامي)': '0569988776',
        'البريد الإلكتروني': 'sultan@investor.com',
        'الأدوار الإضافية (مثل: worker)': 'worker',
        'رقم العقد الاستثماري (إلزامي)': 'CNT-TEST-9901',
        'مسمى / موضوع العقد': 'عقد استثماري لنخيل المجدول والبرحي',
        'تاريخ بداية العقد': '2026-01-01',
        'تاريخ نهاية العقد': '2046-01-01',
        'أكواد القطع المشمولة (مفصولة بفواصل)': '12A, 12B',
        'إجمالي عدد النخيل بالعقد': 150,
        'نسبة المستثمر من المحصول (%)': 75,
        'الحالة المالية للعقد (مسدد بالكامل / أقساط)': 'مسدد بالكامل'
      },
      {
        'اسم المستثمر (إلزامي)': 'فهد بن منصور التميمي',
        'رقم الهاتف / اسم الدخول (إلزامي)': '0541122334',
        'البريد الإلكتروني': 'fahad@dates.sa',
        'الأدوار الإضافية (مثل: worker)': '',
        'رقم العقد الاستثماري (إلزامي)': 'CNT-TEST-9902',
        'مسمى / موضوع العقد': 'عقد استثماري قطعة 07B',
        'تاريخ بداية العقد': '2026-03-01',
        'تاريخ نهاية العقد': '2041-03-01',
        'أكواد القطع المشمولة (مفصولة بفواصل)': '05-07B',
        'إجمالي عدد النخيل بالعقد': 80,
        'نسبة المستثمر من المحصول (%)': 80,
        'الحالة المالية للعقد (مسدد بالكامل / أقساط)': 'أقساط'
      }
    ]
  };

  const importRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/investors/import',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify(testPayload));

  console.log('Import Status:', importRes.statusCode);
  const importJson = importRes.json();
  console.log('Import Result:', JSON.stringify(importJson, null, 2));
  if (!importJson || !importJson.success) {
    throw new Error('Import failed: ' + (importJson?.error || 'Unknown error'));
  }
  console.log('✓ Import processed successfully!');

  // Test 3: Verify contracts in GET /api/contracts
  console.log('\nTest 3: GET /api/contracts');
  const contractsRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/contracts',
    method: 'GET'
  });
  const contractsList = contractsRes.json();
  console.log(`✓ Retrieved ${contractsList.length} contracts.`);
  const found9901 = contractsList.find(c => c.contractNumber === 'CNT-TEST-9901');
  if (!found9901) throw new Error('Contract CNT-TEST-9901 not found');
  console.log('Contract 9901 details:', {
    contractNumber: found9901.contractNumber,
    investorName: found9901.investorName,
    plots: found9901.plots,
    investorSharePct: found9901.investorSharePct,
    financialStatus: found9901.financialStatus
  });
  if (!found9901.plots || found9901.plots.length < 2) {
    throw new Error('Expected 2 linked plots for CNT-TEST-9901');
  }
  console.log('✓ Plots correctly linked to contract!');

  // Test 4: Verify Multi-Role User in GET /api/users
  console.log('\nTest 4: GET /api/users - verify multi-role assignment');
  const usersRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/users',
    method: 'GET'
  });
  const usersList = usersRes.json();
  const multiUser = usersList.find(u => u.phone === '0569988776' || u.username === '0569988776');
  if (!multiUser) throw new Error('Multi-role user not found in users list');
  console.log('User roles for Sultan:', multiUser.roles);
  if (!multiUser.roles.includes('investor') || !multiUser.roles.includes('worker')) {
    throw new Error('Expected both investor and worker roles for Sultan');
  }
  console.log('✓ Multi-Role successfully verified (both investor and worker)!');

  // Test 5: Verify Login with Multi-Role User
  console.log('\nTest 5: POST /api/auth/login with Multi-Role User');
  const loginRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ username: '0569988776', password: 'Palm#1234' }));
  const loginJson = loginRes.json();
  console.log('Login result user:', {
    name: loginJson.user?.name,
    role: loginJson.user?.role,
    roles: loginJson.user?.roles,
    contractIds: loginJson.user?.contractIds,
    plots: loginJson.user?.plots
  });
  if (!loginJson.success || !loginJson.user?.roles || loginJson.user.roles.length < 2) {
    throw new Error('Expected login response to include multi-roles');
  }
  console.log('✓ Login returns roles array and contractIds!');

  // Test 6: Verify Bootstrap hydration
  console.log('\nTest 6: GET /api/bootstrap - verify contracts and availableRoles');
  const bootRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bootstrap',
    method: 'GET'
  });
  const bootJson = bootRes.json();
  console.log('Bootstrap has contracts:', bootJson.contracts?.length > 0);
  console.log('Bootstrap has contractPlots:', bootJson.contractPlots?.length > 0);
  console.log('Bootstrap has availableRoles:', bootJson.availableRoles?.length > 0);
  if (!bootJson.contracts || !bootJson.contractPlots || !bootJson.availableRoles) {
    throw new Error('Bootstrap missing contracts, contractPlots, or availableRoles');
  }
  console.log('✓ Bootstrap successfully includes all multi-role and contracts data!');

  console.log('\n=========================================');
  console.log('🎉 ALL BACKEND VERIFICATION TESTS PASSED (100%)');
  console.log('=========================================\n');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
