// Incremental sync for trees (palms): every insert/update/delete bumps a global counter and
// stamps the row, so the app can download only what changed since its last sync.
module.exports = {
  description: 'palms.row_version + sync_clock + palms_tombstones + triggers',
  phase: 'late', // after legacy startup migrations (some of them rebuild tables)
  up(db) {
    const has = (table, col) => db.prepare('SELECT name FROM pragma_table_info(?)').all(table).some(r => r.name === col);
    if (!has('palms', 'row_version')) db.exec('ALTER TABLE palms ADD COLUMN row_version INTEGER NOT NULL DEFAULT 0;');
    db.exec(`
      CREATE TABLE IF NOT EXISTS sync_clock (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        version INTEGER NOT NULL
      );
      INSERT OR IGNORE INTO sync_clock (id, version) VALUES (1, 1);

      CREATE TABLE IF NOT EXISTS palms_tombstones (
        id INTEGER PRIMARY KEY,
        row_version INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_palms_row_version ON palms(row_version);
      CREATE INDEX IF NOT EXISTS idx_palms_tombstones_version ON palms_tombstones(row_version);

      DROP TRIGGER IF EXISTS palms_rv_insert;
      CREATE TRIGGER palms_rv_insert AFTER INSERT ON palms
      BEGIN
        UPDATE sync_clock SET version = version + 1 WHERE id = 1;
        UPDATE palms SET row_version = (SELECT version FROM sync_clock WHERE id = 1) WHERE id = NEW.id;
        DELETE FROM palms_tombstones WHERE id = NEW.id;
      END;

      DROP TRIGGER IF EXISTS palms_rv_update;
      CREATE TRIGGER palms_rv_update AFTER UPDATE ON palms
      WHEN NEW.row_version IS OLD.row_version
      BEGIN
        UPDATE sync_clock SET version = version + 1 WHERE id = 1;
        UPDATE palms SET row_version = (SELECT version FROM sync_clock WHERE id = 1) WHERE id = NEW.id;
      END;

      -- children display their parent's code: re-stamp them when it changes
      DROP TRIGGER IF EXISTS palms_code_touches_children;
      CREATE TRIGGER palms_code_touches_children AFTER UPDATE OF code ON palms
      WHEN NEW.code IS NOT OLD.code
      BEGIN
        UPDATE sync_clock SET version = version + 1 WHERE id = 1;
        UPDATE palms SET row_version = (SELECT version FROM sync_clock WHERE id = 1) WHERE parent_palm_id = NEW.id;
      END;

      DROP TRIGGER IF EXISTS palms_rv_delete;
      CREATE TRIGGER palms_rv_delete AFTER DELETE ON palms
      BEGIN
        UPDATE sync_clock SET version = version + 1 WHERE id = 1;
        INSERT OR REPLACE INTO palms_tombstones (id, row_version) VALUES (OLD.id, (SELECT version FROM sync_clock WHERE id = 1));
      END;
    `);
  }
};
