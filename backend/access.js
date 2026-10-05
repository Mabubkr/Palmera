// Data-access scoping by role.
//
// Three access levels:
//   full     – admin, super_admin, tenant_user (company admins), customer_care: everything.
//   staff    – engineer, worker, warehouse_mgr, nursery_mgr: all operational farm data,
//              but only their OWN investor/contract/financial records.
//   investor – users whose only role is investor: only the plots, trees, operations,
//              harvests, contracts and zakat records that belong to them.
const db = require('./db');

const FULL_ROLES = new Set(['admin', 'super_admin', 'tenant_user', 'customer_care']);
const STAFF_ROLES = new Set(['engineer', 'worker', 'warehouse_mgr', 'nursery_mgr']);

function accessLevel(user) {
  const roles = user.roles instanceof Set ? [...user.roles] : (user.roles || [user.role]);
  if (roles.some(r => FULL_ROLES.has(r))) return 'full';
  if (roles.some(r => STAFF_ROLES.has(r))) return 'staff';
  return 'investor';
}

const same = (a, b) => a !== null && a !== undefined && String(a) === String(b);
const splitIds = v => String(v || '').split(/[,،\s]+/).map(s => s.trim()).filter(Boolean);

// Plots an investor may see: plots in their contracts, plots granted with a view permission,
// and the sub-plots of any of those.
function investorPlotIds(userId, payload) {
  const ids = new Set();
  const myContracts = (payload.contracts || []).filter(c => same(c.investorUserId, userId));
  const myContractIds = new Set(myContracts.map(c => String(c.id)));
  myContracts.forEach(c => (c.plots || []).forEach(p => p && ids.add(String(p))));
  (payload.contractPlots || []).forEach(cp => { if (myContractIds.has(String(cp.contractId))) ids.add(String(cp.plotId)); });
  (payload.userPlots || []).forEach(up => {
    if (same(up.user_id, userId) && ['view', 'investor_view'].includes(up.permission_type)) ids.add(String(up.plot_id));
  });
  // Investors without contracts but with direct plot grants of any type (legacy data)
  if (ids.size === 0) {
    (payload.userPlots || []).forEach(up => { if (same(up.user_id, userId)) ids.add(String(up.plot_id)); });
  }
  // Include child plots (e.g. contract on BSH01-01 covers BSH01-01A, BSH01-01B …)
  let grew = true;
  while (grew) {
    grew = false;
    (payload.plots || []).forEach(p => {
      if (p.parentPlotId && ids.has(String(p.parentPlotId)) && !ids.has(String(p.id))) { ids.add(String(p.id)); grew = true; }
    });
  }
  return ids;
}

function ownFinancials(payload, userId) {
  const contracts = (payload.contracts || []).filter(c => same(c.investorUserId, userId));
  const contractIds = new Set(contracts.map(c => String(c.id)));
  return {
    contracts,
    contractPlots: (payload.contractPlots || []).filter(cp => contractIds.has(String(cp.contractId))),
    contractInvoices: (payload.contractInvoices || []).filter(i => contractIds.has(String(i.contract_id))),
    investors: (payload.investors || []).filter(i => same(i.user_id, userId) || same(i.id, userId)),
    zakat: (payload.zakat || []).filter(z => same(z.investorId || z.investor_id, userId))
  };
}

// Staff see colleagues, but not the contact details of investor-only accounts.
function usersVisibleToStaff(users, viewerId) {
  return (users || []).filter(u => {
    if (same(u.id, viewerId)) return true;
    const roles = Array.isArray(u.roles) && u.roles.length ? u.roles : [u.role];
    return roles.some(r => r !== 'investor');
  });
}

function scopeForStaff(payload, user) {
  return { ...payload, ...ownFinancials(payload, user.id), users: usersVisibleToStaff(payload.users, user.id) };
}

function scopeForInvestor(payload, user) {
  const plotIds = investorPlotIds(user.id, payload);
  const plots = (payload.plots || []).filter(p => plotIds.has(String(p.id)));
  const sectorIds = new Set(plots.map(p => String(p.sector)));
  const palms = (payload.palms || []).filter(p => plotIds.has(String(p.plot)));
  const palmIds = new Set(palms.map(p => String(p.id)));

  const operations = (payload.operations || []).filter(o =>
    (o.palmId !== null && o.palmId !== undefined && palmIds.has(String(o.palmId))) ||
    splitIds(o.plotId).some(id => plotIds.has(id)) ||
    (o.targetLevel === 'sector' && sectorIds.has(String(o.sectorId)) && !o.plotId)
  );
  const yields = (payload.yields || []).filter(y =>
    (y.palmId !== null && y.palmId !== undefined && palmIds.has(String(y.palmId))) ||
    splitIds(y.plotId).some(id => plotIds.has(id))
  );
  const offshoots = (payload.offshoots || []).filter(o => palmIds.has(String(o.motherId)));
  const treeNotes = (payload.treeNotes || []).filter(n =>
    same(n.authorId, user.id) || same(n.assignedToUserId, user.id) ||
    (palmIds.has(String(n.palmId)) && n.visibilityScope !== 'individual')
  );
  const me = (payload.users || []).filter(u => same(u.id, user.id));

  return {
    ...payload,
    ...ownFinancials(payload, user.id),
    users: me,
    sectors: (payload.sectors || []).filter(s => sectorIds.has(String(s.id))),
    plots,
    userPlots: (payload.userPlots || []).filter(up => same(up.user_id, user.id)),
    workerAssignedPlots: (payload.workerAssignedPlots || []).filter(w => same(w.workerId, user.id)),
    palms,
    operations,
    yields,
    offshoots,
    treeNotes,
    fertilizers: [],
    fertilizerVouchers: [],
    fertilizerSeasonBalances: [],
    auditLogs: (payload.auditLogs || []).filter(a => same(a.user, user.id))
  };
}

function scopeBootstrap(payload, user) {
  const level = accessLevel(user);
  if (level === 'full') return payload;
  if (level === 'staff') return scopeForStaff(payload, user);
  return scopeForInvestor(payload, user);
}

// ---- Route-level restrictions for non-full users ----
const FINANCE_PREFIXES = ['/api/investors', '/api/contracts', '/api/contract-invoices', '/api/contract-templates', '/api/zakat', '/api/charities'];

const INVESTOR_GET_ALLOW = [
  '/api/bootstrap', '/api/auth/me', '/api/settings', '/api/seasons', '/api/charities',
  '/api/operation-types', '/api/ai/status', '/api/contract-templates', '/api/crops',
  '/api/agro/status', '/api/agro/weather', '/api/agro/ndvi'
];
const INVESTOR_WRITE_ALLOW = [
  ['POST', '/api/auth/logout'], ['POST', '/api/auth/change-password'], ['POST', '/api/auth/profile'],
  ['POST', '/api/audit-logs'], ['POST', '/api/ai/agri-chat'], ['POST', '/api/ai/diagnose-pest'],
  ['POST', '/api/tree-notes'], ['POST', '/api/zakat'], ['PUT', '/api/zakat/']
];

const startsWithAny = (p, list) => list.some(x => p === x || p.startsWith(x.endsWith('/') ? x : x + '/'));

function checkScopedRoute(user, method, pathname) {
  const level = accessLevel(user);
  if (level === 'full') return null;

  if (level === 'staff') {
    // Zakat and charities are readable (operational harvest screens), all other finance is admin-only.
    // Own zakat records (staff who are also investors) are allowed; ownership is checked in the handler.
    const ownZakatWrite = (method === 'POST' && pathname === '/api/zakat') || (method === 'PUT' && pathname.startsWith('/api/zakat/'));
    const financeWrite = method !== 'GET' && !ownZakatWrite && startsWithAny(pathname, FINANCE_PREFIXES);
    const financeRead = method === 'GET' && startsWithAny(pathname, ['/api/investors', '/api/contracts', '/api/contract-invoices', '/api/zakat']);
    if (financeWrite || financeRead) return 'بيانات المستثمرين والعقود متاحة للإدارة وخدمة العملاء فقط';
    return null;
  }

  // investor
  if (method === 'GET') {
    if (startsWithAny(pathname, INVESTOR_GET_ALLOW)) return null;
    return 'هذه البيانات غير متاحة لحساب المستثمر';
  }
  const ok = INVESTOR_WRITE_ALLOW.some(([m, p]) => m === method && (p.endsWith('/') ? pathname.startsWith(p) : pathname === p));
  return ok ? null : 'هذه العملية غير متاحة لحساب المستثمر';
}

// Zakat ownership check for non-admin users (called from the zakat handler)
function canTouchZakat(user, investorId, recordId) {
  if (accessLevel(user) === 'full') return true;
  if (investorId !== undefined && investorId !== null && !same(investorId, user.id)) return false;
  if (recordId) {
    const rec = db.get('SELECT investor_id FROM zakat_records WHERE id = ?', recordId);
    if (rec && !same(rec.investor_id, user.id)) return false;
  }
  return true;
}

module.exports = { usersVisibleToStaff, accessLevel, scopeBootstrap, checkScopedRoute, canTouchZakat, investorPlotIds };
