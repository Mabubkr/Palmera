// Zakat records keep the full app-side record so they can be synced to the server.
module.exports = {
  description: 'zakat_records.payload + updated_at',
  up(db) {
    const cols = db.prepare("SELECT name FROM pragma_table_info('zakat_records')").all().map(r => r.name);
    if (!cols.includes('payload')) db.exec('ALTER TABLE zakat_records ADD COLUMN payload TEXT;');
    if (!cols.includes('updated_at')) db.exec('ALTER TABLE zakat_records ADD COLUMN updated_at DATETIME;');
  }
};
