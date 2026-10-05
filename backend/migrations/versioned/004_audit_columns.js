// Brings fresh databases in line with production: audit columns that were added by
// one-off scripts (migrations/one-off) and are now required by v_yields and the bootstrap query.
module.exports = {
  description: 'yields audit columns + tree_notes.updated_at',
  phase: 'late', // the legacy yields rebuild in startup.js must run first
  up(db) {
    const has = (table, col) => db.prepare('SELECT name FROM pragma_table_info(?)').all(table).some(r => r.name === col);
    if (!has('yields', 'created_by')) db.exec('ALTER TABLE yields ADD COLUMN created_by TEXT;');
    if (!has('yields', 'modified_by')) db.exec('ALTER TABLE yields ADD COLUMN modified_by TEXT;');
    if (!has('yields', 'modified_at')) db.exec('ALTER TABLE yields ADD COLUMN modified_at DATETIME;');
    if (!has('tree_notes', 'updated_at')) db.exec('ALTER TABLE tree_notes ADD COLUMN updated_at DATETIME;');
  }
};
