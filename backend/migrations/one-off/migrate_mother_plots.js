const db = require('../../db');

// 1. Find all plots with part_letter or letters in their code or name
const allPlots = db.all("SELECT * FROM plots");
console.log("Total plots currently in DB:", allPlots.length);

let motherPlotsCreated = 0;
let subplotsLinked = 0;

for (const p of allPlots) {
  let secId = p.sector_id;
  let plotNo = p.plot_no;
  let partLetter = (p.part_letter || '').trim();

  // Try parsing from id if plot_no or part_letter is missing/unparsed
  // e.g. BSH05-10B -> sector BSH05, plot_no 10, part_letter B
  if (p.id && p.id.includes('-')) {
    const parts = p.id.split('-');
    if (!secId) secId = parts[0];
    const match = parts[1].match(/^(\d+)([A-Za-z\u0600-\u06FF]*)$/);
    if (match) {
      if (!plotNo) plotNo = match[1];
      if (!partLetter && match[2]) partLetter = match[2].toUpperCase();
    }
  }

  // If this plot has a part letter (e.g. A, B, C...)
  if (partLetter) {
    const parentId = `${secId}-${plotNo}`;
    
    // Check if mother plot exists
    let mother = db.get("SELECT id FROM plots WHERE id = ?", parentId);
    if (!mother) {
      // Create mother plot!
      db.run(
        "INSERT INTO plots (id, sector_id, plot_no, part_letter, name, area_unit, main_crop) VALUES (?, ?, ?, '', ?, 'فدان', ?)",
        parentId, secId, plotNo, `قطعة ${plotNo}`, p.main_crop || 'نخيل مجدول'
      );
      motherPlotsCreated++;
    }

    // Check if subplot has parent_plot_id set
    if (!p.parent_plot_id || p.parent_plot_id !== parentId) {
      db.run("UPDATE plots SET parent_plot_id = ?, part_letter = ?, plot_no = ? WHERE id = ?", parentId, partLetter, plotNo, p.id);
      subplotsLinked++;
    }
  }
}

console.log(`Migration result: Created ${motherPlotsCreated} mother plots, linked ${subplotsLinked} subplots.`);

const remainingOrphans = db.all("SELECT id, sector_id, plot_no, part_letter, parent_plot_id FROM plots WHERE length(part_letter) > 0 AND (parent_plot_id IS NULL OR parent_plot_id = '')");
console.log("Remaining orphan subplots:", remainingOrphans.length);

const totalAfter = db.all("SELECT count(*) as cnt FROM plots")[0].cnt;
console.log("Total plots after migration:", totalAfter);
