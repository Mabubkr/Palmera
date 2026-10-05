const db = require('../db');

function runInvestorsModuleMigration() {
  console.log('--- Starting Dedicated Investors & Contracts Module Migration ---');

  // 1. Create investors table
  db.exec(`
    CREATE TABLE IF NOT EXISTS investors (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
      full_name TEXT NOT NULL,
      national_id TEXT,
      phone TEXT NOT NULL,
      email TEXT,
      bank_name TEXT,
      iban TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_investors_phone ON investors(phone);
    CREATE INDEX IF NOT EXISTS idx_investors_user ON investors(user_id);
  `);

  // 2. Add columns to investment_contracts
  try { db.exec("ALTER TABLE investment_contracts ADD COLUMN model_type TEXT DEFAULT 'CROP_SHARE';"); } catch {}
  try { db.exec("ALTER TABLE investment_contracts ADD COLUMN crop_share_percentage REAL DEFAULT 25.0;"); } catch {}
  try { db.exec("ALTER TABLE investment_contracts ADD COLUMN service_fee_per_acre REAL DEFAULT 0.0;"); } catch {}
  try { db.exec("ALTER TABLE investment_contracts ADD COLUMN production_share_percentage REAL DEFAULT 0.0;"); } catch {}
  try { db.exec("ALTER TABLE investment_contracts ADD COLUMN zakat_delegation INTEGER DEFAULT 1;"); } catch {}
  try { db.exec("ALTER TABLE investment_contracts ADD COLUMN contract_date DATE;"); } catch {}
  try { db.exec("ALTER TABLE investment_contracts ADD COLUMN notes TEXT;"); } catch {}

  // Synchronize existing contract values if needed
  try {
    db.exec(`
      UPDATE investment_contracts SET
        crop_share_percentage = COALESCE(company_crop_share_pct, crop_share_percentage, 25.0),
        service_fee_per_acre = COALESCE(annual_fee_per_acre, service_fee_per_acre, 0.0),
        zakat_delegation = COALESCE(zakat_delegated, zakat_delegation, 1),
        contract_date = COALESCE(contract_date, start_date, DATE('now'))
      WHERE contract_date IS NULL;
    `);
  } catch (e) {
    console.warn("Notice updating investment_contracts fields:", e.message);
  }

  // 3. Add columns to contract_plots
  try { db.exec("ALTER TABLE contract_plots ADD COLUMN allocated_palms_count INTEGER DEFAULT 0;"); } catch {}
  try { db.exec("ALTER TABLE contract_plots ADD COLUMN notes TEXT;"); } catch {}
  try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_plots_unique_plot ON contract_plots(plot_id);"); } catch {}

  // 4. Seed / migrate existing investor users into investors table
  try {
    const existingUsers = db.all(`
      SELECT u.id, u.full_name, u.phone, u.email, u.role
      FROM users u
      WHERE u.role = 'investor'
         OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role_id = 'investor')
         OR EXISTS (SELECT 1 FROM investment_contracts c WHERE c.investor_id = u.id)
    `);

    for (const u of existingUsers) {
      db.run(`
        INSERT INTO investors (id, user_id, full_name, phone, email)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          full_name = excluded.full_name,
          phone = excluded.phone
      `, u.id, u.id, u.full_name || 'مستثمر', u.phone || '', u.email || '');
    }
  } catch (e) {
    console.warn("Investor seeding notice:", e.message);
  }

  // 5. Populate allocated_palms_count from palms table if 0
  try {
    const plotsWithCount = db.all(`
      SELECT cp.contract_id, cp.plot_id, cp.allocated_palms_count,
             (SELECT COUNT(*) FROM palms p WHERE p.plot_id = cp.plot_id) as actual_palms
      FROM contract_plots cp
      WHERE cp.allocated_palms_count IS NULL OR cp.allocated_palms_count = 0
    `);

    for (const row of plotsWithCount) {
      if (row.actual_palms > 0) {
        db.run('UPDATE contract_plots SET allocated_palms_count = ? WHERE contract_id = ? AND plot_id = ?',
          row.actual_palms, row.contract_id, row.plot_id);
      }
    }
  } catch (e) {
    console.warn("Contract plots palm count sync notice:", e.message);
  }

  console.log('--- Dedicated Investors & Contracts Module Migration Completed Successfully ---');
}

if (require.main === module) {
  runInvestorsModuleMigration();
}

module.exports = { runInvestorsModuleMigration };
