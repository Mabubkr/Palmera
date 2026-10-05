// Incremental sync for field operations, same mechanism as trees (006).
// Also: when a tree's code changes, its operations are re-stamped (they display the tree code).
module.exports = {
  description: 'operations.row_version + operations_tombstones + triggers',
  phase: 'late',
  up(db) {
    const has = (table, col) => db.prepare('SELECT name FROM pragma_table_info(?)').all(table).some(r => r.name === col);
    if (!has('operations', 'row_version')) db.exec('ALTER TABLE operations ADD COLUMN row_version INTEGER NOT NULL DEFAULT 0;');
    db.exec(`
      CREATE TABLE IF NOT EXISTS sync_clock (id INTEGER PRIMARY KEY CHECK (id = 1), version INTEGER NOT NULL);
      INSERT OR IGNORE INTO sync_clock (id, version) VALUES (1, 1);

      CREATE TABLE IF NOT EXISTS operations_tombstones (
        id TEXT PRIMARY KEY,
        row_version INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_operations_row_version ON operations(row_version);
      CREATE INDEX IF NOT EXISTS idx_operations_tombstones_version ON operations_tombstones(row_version);

      DROP TRIGGER IF EXISTS operations_rv_insert;
      CREATE TRIGGER operations_rv_insert AFTER INSERT ON operations
      BEGIN
        UPDATE sync_clock SET version = version + 1 WHERE id = 1;
        UPDATE operations SET row_version = (SELECT version FROM sync_clock WHERE id = 1) WHERE id = NEW.id;
        DELETE FROM operations_tombstones WHERE id = NEW.id;
      END;

      DROP TRIGGER IF EXISTS operations_rv_update;
      CREATE TRIGGER operations_rv_update AFTER UPDATE ON operations
      WHEN NEW.row_version IS OLD.row_version
      BEGIN
        UPDATE sync_clock SET version = version + 1 WHERE id = 1;
        UPDATE operations SET row_version = (SELECT version FROM sync_clock WHERE id = 1) WHERE id = NEW.id;
      END;

      DROP TRIGGER IF EXISTS operations_rv_delete;
      CREATE TRIGGER operations_rv_delete AFTER DELETE ON operations
      BEGIN
        UPDATE sync_clock SET version = version + 1 WHERE id = 1;
        INSERT OR REPLACE INTO operations_tombstones (id, row_version) VALUES (OLD.id, (SELECT version FROM sync_clock WHERE id = 1));
      END;

      DROP TRIGGER IF EXISTS palms_code_touches_operations;
      CREATE TRIGGER palms_code_touches_operations AFTER UPDATE OF code ON palms
      WHEN NEW.code IS NOT OLD.code
      BEGIN
        UPDATE operations SET palm_id = palm_id WHERE palm_id = NEW.id;
      END;
    `);
  }
};
