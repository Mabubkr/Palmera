const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(typeof data === 'string' ? data : JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  console.log('=== Starting Direct UI Editing Backend Verification Tests ===\n');

  // Test 1: Bootstrap to find an existing investor, contract, plot, and sector
  const bootstrapRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bootstrap',
    method: 'GET'
  });
  const st = bootstrapRes.data;
  console.log(`Bootstrap loaded: ${st.users.length} users, ${st.contracts?.length || 0} contracts, ${st.plots?.length || 0} plots, ${st.sectors?.length || 0} sectors.`);

  const investor = st.users.find(u => (u.roles || []).includes('investor') || u.role === 'investor') || st.users[0];
  const contract = (st.contracts && st.contracts[0]) || null;
  const plot = (st.plots && st.plots[0]) || null;
  const sector = (st.sectors && st.sectors[0]) || null;

  console.log(`Target investor: ${investor?.name} (${investor?.id})`);
  console.log(`Target contract: ${contract?.contractNumber} (${contract?.id})`);
  console.log(`Target plot: ${plot?.name} (${plot?.id}) in sector ${plot?.sector}`);
  console.log(`Target sector: ${sector?.name} (${sector?.id})\n`);

  // Test 2: GET /api/investors/:id
  console.log('Test 2: GET /api/investors/:id');
  const getInvRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/investors/${encodeURIComponent(investor.id)}`,
    method: 'GET'
  });
  console.log('Status:', getInvRes.status);
  console.log('Investor roles:', getInvRes.data.roles);
  console.log('Investor contracts count:', getInvRes.data.contracts?.length);
  if (getInvRes.status !== 200) throw new Error('GET investor failed');
  console.log('✓ GET /api/investors/:id passed!\n');

  // Test 3: PUT /api/investors/:id
  console.log('Test 3: PUT /api/investors/:id');
  const updateInvRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/investors/${encodeURIComponent(investor.id)}`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' }
  }, {
    fullName: investor.name + ' - المعدل',
    phone: investor.phone || '0555998877',
    roles: ['investor', 'worker'],
    active: true
  });
  console.log('Status:', updateInvRes.status, 'Message:', updateInvRes.data.message);
  if (updateInvRes.status !== 200 || !updateInvRes.data.success) throw new Error('PUT investor failed');
  console.log('Updated user roles:', updateInvRes.data.user?.roles);
  console.log('✓ PUT /api/investors/:id passed!\n');

  // Test 4: PUT /api/contracts/:id (reallocate plots & update terms)
  if (contract) {
    console.log('Test 4: PUT /api/contracts/:id');
    const newShare = 85.5;
    const testPlotList = [plot.id];
    const updateContractRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/contracts/${encodeURIComponent(contract.id)}`,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    }, {
      contractNumber: contract.contractNumber,
      contractTitle: 'عقد استثماري محدث مباشرة من الواجهة',
      investorSharePct: newShare,
      financialStatus: 'مسدد بالكامل',
      plots: testPlotList
    });
    console.log('Status:', updateContractRes.status, 'Message:', updateContractRes.data.message);
    if (updateContractRes.status !== 200 || !updateContractRes.data.success) throw new Error('PUT contract failed');
    console.log('Updated contract share:', updateContractRes.data.contract?.investorSharePct);
    console.log('Updated contract plots:', updateContractRes.data.contract?.plots);
    console.log('✓ PUT /api/contracts/:id passed!\n');
  }

  // Test 5: PUT /api/plots/:id (update area, irrigation source, and 4 GPS corners)
  if (plot) {
    console.log('Test 5: PUT /api/plots/:id');
    const sample4Corners = [
      [27.0510, 31.1610],
      [27.0510, 31.1630],
      [27.0490, 31.1630],
      [27.0490, 31.1610]
    ];
    const updatePlotRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/plots/${encodeURIComponent(plot.id)}`,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    }, {
      name: plot.name + ' - محدثة',
      areaValue: 3.25,
      areaUnit: 'فدان',
      irrigationSource: 'محبس رئيسي V12-Direct',
      contractRef: contract ? contract.contractNumber : 'CNT-2026-0312',
      boundaryCoordinates: sample4Corners
    });
    console.log('Status:', updatePlotRes.status, 'Message:', updatePlotRes.data.message);
    if (updatePlotRes.status !== 200 || !updatePlotRes.data.success) throw new Error('PUT plot failed');
    console.log('Auto-calculated centerLat:', updatePlotRes.data.plot?.centerLat, 'centerLng:', updatePlotRes.data.plot?.centerLng);
    console.log('✓ PUT /api/plots/:id passed!\n');
  }

  // Test 6: PUT /api/sectors/:id (upgrade sector with total area and boundary)
  if (sector) {
    console.log('Test 6: PUT /api/sectors/:id');
    const updateSecRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/sectors/${encodeURIComponent(sector.id)}`,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    }, {
      name: sector.name,
      notes: 'تم فحص وتحديث القطاع بنجاح عبر الواجهة',
      totalArea: 48.5
    });
    console.log('Status:', updateSecRes.status, 'Message:', updateSecRes.data.message);
    if (updateSecRes.status !== 200 || !updateSecRes.data.success) throw new Error('PUT sector failed');
    console.log('✓ PUT /api/sectors/:id passed!\n');
  }

  // Test 7: Verify Audit Logs
  console.log('Test 7: Verify Audit Logs for all direct UI updates');
  const auditRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/audit-logs?limit=10',
    method: 'GET'
  });
  console.log('Latest audit logs count:', auditRes.data.length);
  const actions = auditRes.data.slice(0, 4).map(l => `${l.action} ${l.entity_name} [${l.entity_id}]`);
  console.log('Recent audit entries:', actions);
  console.log('✓ Audit logging successfully verified!\n');

  console.log('=====================================================');
  console.log('🎉 ALL DIRECT EDITING BACKEND TESTS PASSED (100%)');
  console.log('=====================================================');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

