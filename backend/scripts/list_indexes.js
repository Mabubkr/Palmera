const db = require('../db');
const indexes = db.all("SELECT name, tbl_name, sql FROM sqlite_master WHERE type = 'index' AND (sql LIKE '%project%' OR sql LIKE '%company%')");
for (const i of indexes) {
  console.log(`${i.tbl_name} -> ${i.name}: ${i.sql}`);
}

