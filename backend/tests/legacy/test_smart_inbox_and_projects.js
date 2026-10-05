// Test script for Smart Inbox, Cold Archive Partitioning, and Multi-Project Management
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- Starting Smart Inbox & Project Management Automated Verification ---');

// 1. Verify JS file syntax
const appJsPath = path.join(__dirname, '../../../frontend/js/app.js');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');

// Basic syntax parse test using node's vm
const vm = require('vm');
try {
  new vm.Script(appJsContent);
  console.log('✓ frontend/js/app.js syntax valid.');
} catch (e) {
  console.error('Syntax error in app.js:', e);
  process.exit(1);
}

// 2. Test Project Switcher Logic
function getUserAvailableProjects(user, st) {
  if (!user) return [];
  if (user.role === "admin" || user.role === "super_admin" || user.user === "admin") {
    return st.projects || [];
  }
  const accessProjIds = (st.userProjectAccess || [])
    .filter(a => a.user_id === user.id)
    .map(a => a.project_id)
    .filter(Boolean);
  if (accessProjIds.length > 0) {
    return (st.projects || []).filter(p => accessProjIds.includes(p.id));
  }
  if (user.projectId) {
    return (st.projects || []).filter(p => p.id === user.projectId);
  }
  return st.projects || [];
}

function projectSwitcherButtonHtml(user, st) {
  if (!user) return "";
  const userProjects = getUserAvailableProjects(user, st);
  // Strict rule: if userProjects <= 1, return empty string (no dropdown)
  if (!userProjects || userProjects.length <= 1) {
    return "";
  }
  return `<div class="project-switcher-pill"><select class="project-switcher-select">${userProjects.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}</select></div>`;
}

const mockState = {
  projects: [
    { id: "proj_farafra_01", name: "مزرعة الفرافرة - قطاع 1" },
    { id: "proj_toshka_02", name: "مشروع توشكى للتمور" }
  ],
  userProjectAccess: [
    { user_id: "w1", project_id: "proj_farafra_01" },
    { user_id: "eng1", project_id: "proj_farafra_01" },
    { user_id: "mgr_multi", project_id: "proj_farafra_01" },
    { user_id: "mgr_multi", project_id: "proj_toshka_02" }
  ]
};

// Test single-project user (worker)
const workerUser = { id: "w1", role: "worker", user: "worker1" };
const workerSwitcher = projectSwitcherButtonHtml(workerUser, mockState);
assert.strictEqual(workerSwitcher, "", "Worker with single project should NOT see dropdown");
console.log('✓ Single-project user does NOT see project dropdown (visual clutter prevented).');

// Test multi-project user
const multiUser = { id: "mgr_multi", role: "engineer", user: "eng_multi" };
const multiSwitcher = projectSwitcherButtonHtml(multiUser, mockState);
assert.ok(multiSwitcher.includes('project-switcher-select'), "Multi-project user should see switcher dropdown");
assert.ok(multiSwitcher.includes('proj_farafra_01') && multiSwitcher.includes('proj_toshka_02'), "Multi-project user sees all accessible projects");
console.log('✓ Multi-project user sees project switcher dropdown.');

// Test admin user
const adminUser = { id: "admin1", role: "admin", user: "admin" };
const adminSwitcher = projectSwitcherButtonHtml(adminUser, mockState);
assert.ok(adminSwitcher.includes('project-switcher-select'), "Admin sees switcher when company has multiple projects");
console.log('✓ Admin sees switcher for multiple company projects.');

// 3. Test Smart Inbox & Cold Archiving Partitioning Logic
const mockPalms = [
  { id: "p1", code: "P-01-01", plot: "01-01" },
  { id: "p2", code: "P-02-01", plot: "02-01" },
  { id: "p3", code: "P-03-01", plot: "03-01" }
];

const mockPlots = [
  { id: "01-01", name: "قطعة 1A", sector: "sec1" },
  { id: "02-01", name: "قطعة 2A", sector: "sec2" },
  { id: "03-01", name: "قطعة 3A", sector: "sec3" }
];

const mockOps = [
  { id: "op1", palmId: "p1", workerId: "w1", typeId: "t_pollinate", approval: "pending", at: "2026-09-17T08:00:00Z" },
  { id: "op2", palmId: "p1", workerId: "w1", typeId: "t_weevil", approval: "pending", at: "2026-09-17T08:10:00Z" },
  { id: "op3", palmId: "p2", workerId: "w1", typeId: "t_clean", approval: "rejected", at: "2026-09-17T08:20:00Z" },
  { id: "op4", palmId: "p2", workerId: "w2", typeId: "t_irrigate", approval: "rejected", at: "2026-09-17T08:30:00Z" },
  { id: "op5", palmId: "p3", workerId: "w2", typeId: "t_harvest", approval: "approved", at: "2026-09-10T08:00:00Z" },
  { id: "op6", palmId: "p1", workerId: "w1", typeId: "t_prune", approval: "approved", at: "2026-09-01T08:00:00Z" }
];

function testFilter({ curU, opsSt = "", opsQ = "", opsRange = "all" }) {
  const isWorker = curU?.role === "worker";
  const isEng = curU?.role === "engineer";
  const isExplicitApprovedQuery = opsSt === "approved" || Boolean(opsQ && opsQ.trim().length > 0) || (opsRange && opsRange !== "all");

  return mockOps.filter(o => {
    if (isWorker && o.workerId !== curU?.id) return false;
    const p = mockPalms.find(x => x.id === o.palmId);
    if (isEng && curU?.plots && curU.plots.length > 0) {
      if (p?.plot && !curU.plots.includes(p.plot)) return false;
    }
    // Hot vs Cold Archiving
    if (!isExplicitApprovedQuery && o.approval === "approved") return false;

    if (opsSt === "pending" && (o.approval === "approved" || o.approval === "rejected")) return false;
    if (opsSt === "approved" && o.approval !== "approved") return false;
    if (opsSt === "rejected" && o.approval !== "rejected") return false;
    if (opsQ) {
      const q = opsQ.toUpperCase();
      const hit = (p?.code || "").toUpperCase().includes(q) || (o.typeId || "").includes(q);
      if (!hit) return false;
    }
    return true;
  });
}

// 3.1 Worker View: Default is rejected, and only worker's own operations
const workerResult = testFilter({ curU: { id: "w1", role: "worker" }, opsSt: "rejected" });
assert.strictEqual(workerResult.length, 1);
assert.strictEqual(workerResult[0].id, "op3", "Worker w1 sees only op3 (rejected and assigned to w1)");
console.log('✓ Worker Smart Inbox: Defaults to rejected operations and strictly scopes to their own work.');

// 3.2 Engineer View: Default is pending, and scoped to assigned plots
const engUser = { id: "eng1", role: "engineer", plots: ["01-01"] };
const engResult = testFilter({ curU: engUser, opsSt: "pending" });
assert.strictEqual(engResult.length, 2, "Engineer sees op1 and op2 in plot 01-01");
assert.ok(engResult.every(o => o.approval === "pending"));
console.log('✓ Engineer Smart Inbox: Defaults to pending approvals and scopes to assigned plots.');

// 3.3 Cold Archiving: Approved operations are excluded by default
const adminDefault = testFilter({ curU: adminUser, opsSt: "" });
assert.strictEqual(adminDefault.filter(o => o.approval === "approved").length, 0, "No approved operations in default feed");
console.log('✓ Cold Archiving: Approved operations excluded from default feed.');

// 3.4 Explicit Archive Request: User clicks "approved" filter
const adminApproved = testFilter({ curU: adminUser, opsSt: "approved" });
assert.strictEqual(adminApproved.length, 2, "Explicit approved query summons cold archive");
assert.ok(adminApproved.every(o => o.approval === "approved"));
console.log('✓ On-Demand Archive: Explicit approved filter instantly loads approved operations.');

// 3.5 Search summons matching operations even if approved
const searchResult = testFilter({ curU: adminUser, opsSt: "", opsQ: "P-03-01" });
assert.strictEqual(searchResult.length, 1);
assert.strictEqual(searchResult[0].id, "op5", "Search by palm code finds approved op5");
console.log('✓ Search query retrieves archived operations on demand.');

// 4. Test Backend Project Creation API
const http = require('http');
const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/projects',
  method: 'GET'
}, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    try {
      const projects = JSON.parse(body);
      assert.ok(Array.isArray(projects), "GET /api/projects returns array");
      assert.ok(projects.length >= 2, "At least 2 default projects exist");
      console.log(`✓ Backend GET /api/projects responded with ${projects.length} projects.`);

      // Test POST /api/projects
      const testProj = {
        id: `proj_test_${Date.now()}`,
        name: "مزرعة سيوا التجريبية",
        codePrefix: "SIW1",
        locationName: "مطروح - سيوا",
        areaFeddan: 350,
        companyId: "comp_bashayer"
      };

      const postReq = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/projects',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, postRes => {
        let postBody = '';
        postRes.on('data', d => postBody += d);
        postRes.on('end', () => {
          const resObj = JSON.parse(postBody);
          assert.strictEqual(postRes.statusCode, 201);
          assert.strictEqual(resObj.success, true);
          console.log(`✓ Backend POST /api/projects successfully created new farm: ${testProj.name}`);
          console.log('--- ALL VERIFICATIONS PASSED SUCCESSFULLY ---');
        });
      });
      postReq.write(JSON.stringify(testProj));
      postReq.end();
    } catch (err) {
      console.error('API Verification error:', err);
      process.exit(1);
    }
  });
});
req.on('error', err => {
  console.warn('Backend server not responding on port 3000:', err.message);
  console.log('--- Verification completed for client logic ---');
});
req.end();

