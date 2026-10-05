// Nursery workflow details the app records per offshoot/seedling (care activities, who received it,
// cull reason, dispatch recipient …). Kept in its own table so a rebuild of `offshoots` never drops it.
module.exports = {
  description: 'offshoot_nursery_meta table',
  phase: 'late',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS offshoot_nursery_meta (
        offshoot_id TEXT PRIMARY KEY,
        meta TEXT NOT NULL DEFAULT '{}',
        updated_by TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }
};
