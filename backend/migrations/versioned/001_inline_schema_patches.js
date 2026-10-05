// Baseline: the column/table patches that used to run inline in db.js on every start.
// Each statement tolerates already-applied changes, so it is safe on any existing database.
module.exports = {
  description: 'Inline schema patches (roles, users, operations, plots, tree notes, contracts, worker plots)',
  up(db) {
    try { db.exec('ALTER TABLE roles ADD COLUMN matrix TEXT;'); } catch {}
    try { db.exec('ALTER TABLE roles ADD COLUMN perms TEXT;'); } catch {}
    try { db.exec('ALTER TABLE users ADD COLUMN avatar TEXT;'); } catch {}
    try { db.exec('ALTER TABLE users ADD COLUMN blood_type TEXT;'); } catch {}
    try { db.exec('ALTER TABLE operations ADD COLUMN batch_id TEXT;'); } catch {}
    try { db.exec("ALTER TABLE operations ADD COLUMN target_level TEXT DEFAULT 'tree';"); } catch {}
    try { db.exec('ALTER TABLE operations ADD COLUMN sector_id TEXT;'); } catch {}
    try { db.exec('ALTER TABLE operations ADD COLUMN plot_id TEXT;'); } catch {}
    try { db.exec('ALTER TABLE operations ADD COLUMN tree_count INTEGER DEFAULT 1;'); } catch {}
    try { db.exec("ALTER TABLE operation_types ADD COLUMN scope_type TEXT DEFAULT 'both';"); } catch {}
    try { db.exec('ALTER TABLE operation_types ADD COLUMN is_critical INTEGER DEFAULT 0;'); } catch {}
    try { db.exec('ALTER TABLE operation_types ADD COLUMN requires_approval INTEGER DEFAULT 1;'); } catch {}
    try { db.exec('ALTER TABLE plots ADD COLUMN parent_plot_id TEXT REFERENCES plots(id);'); } catch {}
    try { db.exec('ALTER TABLE plots ADD COLUMN area_value REAL DEFAULT 0;'); } catch {}
    try { db.exec("ALTER TABLE plots ADD COLUMN area_unit TEXT DEFAULT 'فدان';"); } catch {}
    try { db.exec('ALTER TABLE plots ADD COLUMN boundary_coordinates TEXT;'); } catch {}
    try { db.exec('ALTER TABLE plots ADD COLUMN center_lat REAL;'); } catch {}
    try { db.exec('ALTER TABLE plots ADD COLUMN center_lng REAL;'); } catch {}
    try { db.exec('ALTER TABLE plots ADD COLUMN main_crop TEXT;'); } catch {}
    try { db.exec('ALTER TABLE plots ADD COLUMN target_capacity INTEGER DEFAULT 0;'); } catch {}
    try { db.exec('ALTER TABLE plots ADD COLUMN irrigation_source TEXT;'); } catch {}
    try { db.exec('ALTER TABLE plots ADD COLUMN contract_ref TEXT;'); } catch {}
    try { db.exec('ALTER TABLE sectors ADD COLUMN boundary_coordinates TEXT;'); } catch {}
    try { db.exec('ALTER TABLE sectors ADD COLUMN total_area REAL DEFAULT 0;'); } catch {}
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS tree_notes (
          id TEXT PRIMARY KEY,
          palm_id INTEGER REFERENCES palms(id),
          palm_code TEXT,
          author_id TEXT NOT NULL REFERENCES users(id),
          author_name TEXT,
          note_type TEXT NOT NULL DEFAULT 'general',
          priority TEXT NOT NULL DEFAULT 'normal',
          content TEXT NOT NULL,
          attachments TEXT,
          visibility_scope TEXT NOT NULL DEFAULT 'all_team',
          assigned_to_user_id TEXT REFERENCES users(id),
          assigned_to_user_name TEXT,
          status TEXT NOT NULL DEFAULT 'new',
          execution_notes TEXT,
          execution_proof_photo TEXT,
          executed_at DATETIME,
          executed_by_id TEXT REFERENCES users(id),
          closed_at DATETIME,
          closed_by_id TEXT REFERENCES users(id),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_tree_notes_palm ON tree_notes(palm_id);
        CREATE INDEX IF NOT EXISTS idx_tree_notes_assigned ON tree_notes(assigned_to_user_id);
      `);
    } catch {}

    // Auto-migrate investment contracts and financial templates
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS contract_templates (
          id TEXT PRIMARY KEY,
          name_ar TEXT NOT NULL,
          code TEXT UNIQUE NOT NULL,
          description TEXT,
          default_company_share_pct REAL DEFAULT 25.0,
          default_annual_fee_per_acre REAL DEFAULT 0.0,
          requires_area_billing INTEGER DEFAULT 0,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch {}

    try {
      const count = db.prepare("SELECT COUNT(*) as c FROM contract_templates").get();
      if (!count || count.c === 0) {
        db.prepare(`
          INSERT INTO contract_templates (id, name_ar, code, description, default_company_share_pct, default_annual_fee_per_acre, requires_area_billing, is_active)
          VALUES 
          ('tpl_crop_share', 'مشاركة محضة في المحصول', 'MODEL_A', 'تتحمل الشركة كافة المصروفات التشغيلية مقابل نسبة محددة من المحصول بدون مطالبات فدانية دورية', 25.0, 0.0, 0, 1),
          ('tpl_service_plus_share', 'عقد رعاية وتشغيل فداني', 'MODEL_B', 'رسم تشغيل سنوي مقطوع لكل فدان يسدد كأقساط دورية + نسبة إشراف وتسويق من الإنتاج عند الإثمار', 10.0, 25000.0, 1, 1)
        `).run();
      }
    } catch (e) { console.warn("contract_templates seed notice:", e); }

    try { db.exec('ALTER TABLE investment_contracts ADD COLUMN template_id TEXT REFERENCES contract_templates(id);'); } catch {}
    try { db.exec('ALTER TABLE investment_contracts ADD COLUMN company_crop_share_pct REAL DEFAULT 25.0;'); } catch {}
    try { db.exec('ALTER TABLE investment_contracts ADD COLUMN annual_fee_per_acre REAL DEFAULT 0.0;'); } catch {}
    try { db.exec("ALTER TABLE investment_contracts ADD COLUMN payment_schedule TEXT DEFAULT 'annual';"); } catch {}
    try { db.exec('ALTER TABLE investment_contracts ADD COLUMN zakat_delegated INTEGER DEFAULT 0;'); } catch {}
    try { db.exec('ALTER TABLE investment_contracts ADD COLUMN zakat_rate_pct REAL DEFAULT 5.0;'); } catch {}
    try { db.exec('ALTER TABLE investment_contracts ADD COLUMN zakat_delegation_date DATETIME;'); } catch {}
    try { db.exec('ALTER TABLE investment_contracts ADD COLUMN zakat_doc_url TEXT;'); } catch {}

    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS contract_service_invoices (
          id TEXT PRIMARY KEY,
          contract_id TEXT NOT NULL REFERENCES investment_contracts(id) ON DELETE CASCADE,
          season_year INTEGER NOT NULL,
          total_area_acres REAL NOT NULL,
          fee_per_acre REAL NOT NULL,
          total_due_amount REAL NOT NULL,
          paid_amount REAL DEFAULT 0.0,
          payment_status TEXT DEFAULT 'unpaid',
          due_date DATE,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_invoices_contract ON contract_service_invoices(contract_id);
        CREATE INDEX IF NOT EXISTS idx_invoices_season ON contract_service_invoices(season_year);
      `);
    } catch {}

    // Dedicated Decoupled Table for Worker Field Operational Scope
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS worker_assigned_plots (
          worker_id TEXT NOT NULL,
          plot_id TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (worker_id, plot_id)
        );
        CREATE INDEX IF NOT EXISTS idx_worker_assigned_plots_worker ON worker_assigned_plots(worker_id);
        CREATE INDEX IF NOT EXISTS idx_worker_assigned_plots_plot ON worker_assigned_plots(plot_id);
      `);

      const wpCount = db.prepare("SELECT COUNT(*) as c FROM worker_assigned_plots").get();
      if (!wpCount || wpCount.c === 0) {
        db.prepare(`
          INSERT OR IGNORE INTO worker_assigned_plots (worker_id, plot_id)
          SELECT up.user_id, up.plot_id 
          FROM user_plots up
          JOIN users u ON u.id = up.user_id
          WHERE u.role IN ('worker', 'engineer', 'supervisor', 'admin')
             OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role_id IN ('worker', 'engineer', 'supervisor', 'admin'))
        `).run();
      }
    } catch (e) {
      console.warn("worker_assigned_plots init error:", e.message);
    }
  }
};
