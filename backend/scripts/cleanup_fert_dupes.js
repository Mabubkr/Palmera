const db = require('../db');

const dupes = db.all("SELECT * FROM fertilizers WHERE id LIKE 'proj_farafra_01_%'");
console.log('Duplicate rows found:', dupes.length);

for (const d of dupes) {
  const baseId = d.id.replace('proj_farafra_01_', '');
  const base = db.get('SELECT * FROM fertilizers WHERE id = ?', baseId);
  if (base) {
    console.log('Merging', d.id, 'stock', d.stock, 'into', baseId, 'current stock', base.stock);
    const newStock = (base.stock || 0) + (d.stock || 0);
    const newAlloc = (base.allocated || 0) + (d.allocated || 0);
    const newCons = (base.consumed || 0) + (d.consumed || 0);
    db.run('UPDATE fertilizers SET stock = ?, allocated = ?, consumed = ? WHERE id = ?', newStock, newAlloc, newCons, baseId);
    
    // Update vouchers
    db.run('UPDATE fertilizer_vouchers SET fertilizer_id = ? WHERE fertilizer_id = ?', baseId, d.id);
    
    // Update or delete season balances to avoid FK violations or conflicts
    try {
      db.run('UPDATE fertilizer_season_balances SET fertilizer_id = ? WHERE fertilizer_id = ?', baseId, d.id);
    } catch (e) {
      db.run('DELETE FROM fertilizer_season_balances WHERE fertilizer_id = ?', d.id);
    }
  }
  db.run('DELETE FROM fertilizers WHERE id = ?', d.id);
}

const remaining = db.all('SELECT id, name, stock, allocated, consumed FROM fertilizers');
console.log('Clean fertilizers in SQLite:', remaining);

