const db = require('../db');
const bcrypt = require('bcryptjs');

console.log('--- Seeding Canonical Multi-Tenant Accounts & RBAC Matrix ---');

const defaultHash = bcrypt.hashSync('1234', 10);

// 1. Clean and insert canonical users
const usersToSeed = [
  {
    id: 'usr_super_01',
    username: 'superadmin',
    password_hash: defaultHash,
    full_name: 'مدير عام المنظومة (Super Admin)',
    role: 'super_admin',
    phone: '01000000001',
    active: 1
  },
  {
    id: 'usr_comp_admin_01',
    username: 'admin_bashayer',
    password_hash: defaultHash,
    full_name: 'مدير شركة بشاير الشوربجي',
    role: 'tenant_user',
    phone: '01000000002',
    active: 1
  },
  {
    id: 'usr_proj_mgr_01',
    username: 'mgr_farafra',
    password_hash: defaultHash,
    full_name: 'م. خالد - مدير مزرعة الفرافرة',
    role: 'tenant_user',
    phone: '01000000003',
    active: 1
  },
  {
    id: 'u_asyut_01',
    username: 'asyut_admin',
    password_hash: defaultHash,
    full_name: 'إداري مزرعة غرب أسيوط',
    role: 'tenant_user',
    phone: '01000000099',
    active: 1
  }
];

const insertUserStmt = db.db.prepare(`
  INSERT INTO users (id, username, password_hash, full_name, role, phone, active)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(username) DO UPDATE SET
    password_hash = excluded.password_hash,
    full_name = excluded.full_name,
    role = excluded.role,
    phone = excluded.phone,
    active = excluded.active
`);

usersToSeed.forEach(u => {
  insertUserStmt.run(u.id, u.username, u.password_hash, u.full_name, u.role, u.phone, u.active);
  console.log(`✓ Seeded user: ${u.username} (${u.full_name})`);
});

// Also fix any existing asyut_admin full_name
db.run(`UPDATE users SET full_name = 'إداري مزرعة غرب أسيوط' WHERE username = 'asyut_admin'`);

// 2. Clear old access rows for these users to avoid duplicates
const cleanAccessStmt = db.db.prepare(`DELETE FROM user_project_access WHERE user_id = ?`);
['usr_super_01', 'usr_comp_admin_01', 'usr_proj_mgr_01', 'u_asyut_01', 'u_1789383845702_xde8'].forEach(uid => {
  cleanAccessStmt.run(uid);
});

// 3. Seed exact RBAC assignments in user_project_access
const getUserId = (uname) => {
  const row = db.get('SELECT id FROM users WHERE username = ?', uname);
  return row ? row.id : null;
};

const accessRows = [
  // Super Admin: Global access across all companies and projects
  {
    id: 'acc_super_01',
    user_id: getUserId('superadmin'),
    company_id: null,
    project_id: null,
    role_name: 'super_admin',
    is_default: 1
  },
  // Company Admin: All projects under Bashayer company
  {
    id: 'acc_comp_bashayer_01',
    user_id: getUserId('admin_bashayer'),
    company_id: 'comp_bashayer',
    project_id: null,
    role_name: 'company_admin',
    is_default: 1
  },
  // Project Manager: Specifically assigned to Farafra farm
  {
    id: 'acc_proj_farafra_mgr',
    user_id: getUserId('mgr_farafra'),
    company_id: 'comp_bashayer',
    project_id: 'proj_farafra_01',
    role_name: 'engineer',
    is_default: 1
  },
  // Asyut Admin: Specifically assigned to West Asyut farm
  {
    id: 'acc_proj_asyut_mgr',
    user_id: getUserId('asyut_admin'),
    company_id: 'comp_1789366851360',
    project_id: 'proj_1789376864329',
    role_name: 'admin',
    is_default: 1
  }
];

const insertAccessStmt = db.db.prepare(`
  INSERT INTO user_project_access (id, user_id, company_id, project_id, role_name, is_default)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(user_id, company_id, project_id) DO UPDATE SET
    role_name = excluded.role_name,
    is_default = excluded.is_default
`);

accessRows.forEach(a => {
  if (!a.user_id) return;
  insertAccessStmt.run(a.id, a.user_id, a.company_id, a.project_id, a.role_name, a.is_default);
  console.log(`✓ Assigned access: user=${a.user_id} -> comp=${a.company_id || 'ALL'} proj=${a.project_id || 'ALL'} role=${a.role_name}`);
});

console.log('--- RBAC Seeding Completed Successfully ---');
