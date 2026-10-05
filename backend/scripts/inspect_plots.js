const db = require('../db');

try {
  const plots = db.all("SELECT id, sector_id, plot_no, part_letter, name, parent_plot_id FROM plots LIMIT 20");
  console.log("Plots sample:", plots);

  const subplots = db.all("SELECT id, sector_id, plot_no, part_letter, name, parent_plot_id FROM plots WHERE id LIKE '%A' OR id LIKE '%B' OR id LIKE '%C' OR id LIKE '%D' OR id LIKE '%E' OR id LIKE '%F' OR length(part_letter) > 0");
  console.log("Subplots total:", subplots.length);
  console.log("Subplots sample:", subplots.slice(0, 10));

  // Check which subplots have missing parent_plot_id or parent doesn't exist
  const missingParents = [];
  for (const sp of subplots) {
    // Expected parent
    let baseNo = sp.plot_no;
    if (!baseNo) {
      const match = sp.id.match(/-(\d+)[A-Za-z]?$/);
      if (match) baseNo = match[1];
    }
    const expectedParentId = `${sp.sector_id}-${baseNo}`;
    const parent = db.get("SELECT id FROM plots WHERE id = ?", expectedParentId);
    missingParents.push({
      subplot: sp.id,
      sector: sp.sector_id,
      plot_no: sp.plot_no,
      part_letter: sp.part_letter,
      current_parent: sp.parent_plot_id,
      expectedParentId,
      parentExists: !!parent
    });
  }
  console.log("Subplots missing or unlinked parents:", missingParents.filter(p => !p.parentExists || !p.current_parent));
} catch (e) {
  console.error(e);
}
