const db = require('../db');

function runMultiRoleAndContractsMigration() {
  console.log('--- Starting Multi-Role & Investment Contracts Migration ---');

  // 1. Roles table
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name_ar TEXT NOT NULL,
      description TEXT
    );
  `);

  const standardRoles = [
    ['admin', 'مدير النظام', 'صلاحيات إدارية كاملة لكافة أقسام النظام'],
    ['super_admin', 'مدير عام النظام', 'صلاحيات عليا وإشراف عام'],
    ['engineer', 'مهندس مشرف', 'إشراف ميداني، مراجعة واعتماد العمليات، ومتابعة الصحة النباتية'],
    ['worker', 'عامل ميداني', 'تنفيذ وتسجيل العمليات الميدانية، ومسح الأكواد والباركود'],
    ['investor', 'مستثمر', 'الاطلاع على نطاق العقود الاستثمارية، الحصاد، الزكاة، وتقارير المحصول'],
    ['warehouse_mgr', 'أمين المستودع', 'إدارة المخزون، صرف واستلام الأسمدة والمستلزمات'],
    ['nursery_mgr', 'مدير المشتل', 'إدارة وتكاثر الفسائل وأعمال الحضانة'],
    ['customer_care', 'خدمة العملاء', 'متابعة الاستفسارات وخدمة المستثمرين'],
    ['tenant_user', 'مستخدم مستأجر', 'صلاحيات وصول محددة للوحدات المؤجرة']
  ];

  for (const [id, name_ar, desc] of standardRoles) {
    db.run(
      'INSERT INTO roles (id, name_ar, description) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name_ar = excluded.name_ar, description = excluded.description',
      id, name_ar, desc
    );
  }

  // 2. User Roles table (Many-to-Many)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, role_id)
    );
    CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);
  `);

  // Migrate existing users' roles into user_roles
  try {
    db.exec(`
      INSERT OR IGNORE INTO user_roles (user_id, role_id)
      SELECT id, role FROM users WHERE role IS NOT NULL AND role != '';
    `);
    console.log('[user_roles] Migrated existing single-role assignments.');
  } catch (e) {
    console.warn('[user_roles] Migration notice:', e.message);
  }

  // 3. Investment Contracts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS investment_contracts (
      id TEXT PRIMARY KEY,
      contract_number TEXT UNIQUE NOT NULL,
      investor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE,
      total_trees INTEGER DEFAULT 0,
      total_area REAL DEFAULT 0,
      investor_share_pct REAL DEFAULT 100,
      financial_status TEXT DEFAULT 'مسدد بالكامل',
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_contracts_investor ON investment_contracts(investor_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_num ON investment_contracts(contract_number);
  `);

  // 4. Contract Plots table
  db.exec(`
    CREATE TABLE IF NOT EXISTS contract_plots (
      contract_id TEXT NOT NULL REFERENCES investment_contracts(id) ON DELETE CASCADE,
      plot_id TEXT NOT NULL REFERENCES plots(id) ON DELETE CASCADE,
      PRIMARY KEY (contract_id, plot_id)
    );
    CREATE INDEX IF NOT EXISTS idx_contract_plots_plot ON contract_plots(plot_id);
  `);

  console.log('--- Multi-Role & Investment Contracts Migration Completed Successfully ---');
}

if (require.main === module) {
  runMultiRoleAndContractsMigration();
}

module.exports = { runMultiRoleAndContractsMigration };
