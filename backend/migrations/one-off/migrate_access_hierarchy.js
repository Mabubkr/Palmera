/**
 * PalmTrace Multi-Tenant Access Hierarchy & Plot Scoping Migration
 * 
 * Corrections implemented:
 * 1. user_project_access: company_id is now NULLABLE.
 *    - company_id IS NULL AND project_id IS NULL AND role_name = 'super_admin' => Platform Super Admin
 *    - company_id IS NOT NULL AND project_id IS NULL AND role_name = 'company_admin' => Company Admin across company projects
 *    - company_id AND project_id are NOT NULL => Specific Project role (engineer, worker, etc.)
 * 
 * 2. users.role vs user_project_access.role_name:
 *    - users.role represents global platform account tier: 'super_admin' vs 'tenant_user'.
 *    - user_project_access.role_name is the authoritative contextual operational role per project/company.
 * 
 * 3. user_plots:
 *    - Added project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE.
 *    - Added UNIQUE(user_id, project_id, plot_id) constraint and indices to guarantee zero plot bleeding across farms.
 */
const db = require('../../db');

console.log('--- Starting Access Hierarchy & Plot Scoping Migration ---');

db.exec('PRAGMA foreign_keys = OFF;');
db.exec('BEGIN TRANSACTION;');

try {
  // 1. Recreate user_project_access with NULLABLE company_id and project_id
  console.log('1. Recreating user_project_access with nullable company_id & project_id...');
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_project_access_new (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
        project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
        role_name TEXT NOT NULL,
        is_default INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, company_id, project_id)
    );
  `);

  // Migrate existing user_project_access data
  const oldAccess = db.all('SELECT * FROM user_project_access');
  const insAccess = db.db.prepare(`
    INSERT OR REPLACE INTO user_project_access_new (id, user_id, company_id, project_id, role_name, is_default, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const row of oldAccess) {
    if (row.user_id === 'u1' && (row.project_id === null || row.id === 'acc_u1_all')) {
      // Platform Super Admin: both company_id and project_id are NULL
      insAccess.run('acc_u1_global', 'u1', null, null, 'super_admin', 1, row.created_at || new Date().toISOString());
    } else {
      insAccess.run(row.id, row.user_id, row.company_id, row.project_id, row.role_name, row.is_default, row.created_at);
    }
  }

  // Ensure acc_u1_global exists
  insAccess.run('acc_u1_global', 'u1', null, null, 'super_admin', 1, new Date().toISOString());

  db.exec(`
    DROP TABLE user_project_access;
    ALTER TABLE user_project_access_new RENAME TO user_project_access;
    CREATE INDEX IF NOT EXISTS idx_user_access_lookup ON user_project_access(user_id, project_id);
    CREATE INDEX IF NOT EXISTS idx_user_access_comp ON user_project_access(company_id);
    CREATE INDEX IF NOT EXISTS idx_user_access_role ON user_project_access(role_name);
  `);
  console.log('✓ user_project_access successfully updated.');

  // 2. Recreate user_plots with project_id
  console.log('2. Recreating user_plots with project_id...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_plots_new (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        project_id TEXT NOT NULL DEFAULT 'proj_farafra_01' REFERENCES projects(id) ON DELETE CASCADE,
        plot_id TEXT NOT NULL REFERENCES plots(id) ON DELETE CASCADE,
        permission_type TEXT DEFAULT 'work',
        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, project_id, plot_id)
    );
  `);

  // Copy data over from old user_plots and assign project_id from plots table
  const oldUserPlots = db.all('SELECT * FROM user_plots');
  const insPlotAccess = db.db.prepare(`
    INSERT OR REPLACE INTO user_plots_new (id, user_id, project_id, plot_id, permission_type, assigned_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const up of oldUserPlots) {
    const plotRow = db.get('SELECT project_id FROM plots WHERE id = ?', up.plot_id);
    const projId = (plotRow && plotRow.project_id) ? plotRow.project_id : 'proj_farafra_01';
    insPlotAccess.run(up.id, up.user_id, projId, up.plot_id, up.permission_type || 'work', new Date().toISOString());
  }

  db.exec(`
    DROP TABLE user_plots;
    ALTER TABLE user_plots_new RENAME TO user_plots;
    CREATE INDEX IF NOT EXISTS idx_user_plots_user ON user_plots(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_plots_proj ON user_plots(project_id);
    CREATE INDEX IF NOT EXISTS idx_user_plots_plot ON user_plots(plot_id);
  `);
  console.log('✓ user_plots successfully updated with project_id.');

  // 3. Update users.role to reflect global platform tier
  console.log('3. Updating users.role to distinguish super_admin from tenant_user...');
  db.run("UPDATE users SET role = 'super_admin' WHERE id = 'u1' OR username = 'admin'");
  db.run("UPDATE users SET role = 'tenant_user' WHERE id != 'u1' AND username != 'admin'");
  console.log('✓ users.role updated.');

  db.exec('COMMIT;');
  db.exec('PRAGMA foreign_keys = ON;');
  console.log('--- Access Hierarchy & Plot Scoping Migration Completed Successfully ---');
} catch (err) {
  db.exec('ROLLBACK;');
  db.exec('PRAGMA foreign_keys = ON;');
  console.error('Migration failed:', err);
  process.exit(1);
}

