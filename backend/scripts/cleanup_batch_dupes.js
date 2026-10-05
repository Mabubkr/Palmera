const { db } = require('../db.js');

console.log('--- Deduplicating Batch Operations with NULL palm_id ---');

const batches = ['bkfr96in', 'bkqfofs5', 'bkxu7e50'];

batches.forEach(bId => {
  const rows = db.prepare('SELECT id FROM operations WHERE batch_id = ? ORDER BY id ASC').all(bId);
  console.log(`Batch ${bId}: found ${rows.length} rows.`);
  if (rows.length > 1) {
    const keepId = rows[0].id;
    const deleteIds = rows.slice(1).map(r => r.id);
    const placeholders = deleteIds.map(() => '?').join(',');
    const stmt = db.prepare(`DELETE FROM operations WHERE id IN (${placeholders})`);
    const info = stmt.run(...deleteIds);
    console.log(`Kept ${keepId}, deleted ${info.changes} duplicate records.`);
  }
});

// Update the representative record for bkfr96in to ensure plot_id and target_level are set
db.prepare(`
  UPDATE operations 
  SET plot_id = 'BSH1-08A', sector_id = 'BSH1', target_level = 'plot', tree_count = 30
  WHERE batch_id = 'bkfr96in'
`).run();

const remaining = db.prepare('SELECT id, batch_id, type_id, plot_id, sector_id, target_level, tree_count, worker_notes FROM operations WHERE palm_id IS NULL').all();
console.log('Remaining NULL palm_id rows in database:', remaining.length);
console.log(remaining);

