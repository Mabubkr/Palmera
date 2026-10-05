const db = require('../db');
const { updateSectorGis } = require('../plots_gis_handler');

function seedGisSamples() {
  console.log('Seeding GIS sample coordinates for plots 03-12, 03-12A, 03-12B...');

  // Ensure parent plot 03-12 exists
  db.run(`
    INSERT INTO plots (id, sector_id, plot_no, part_letter, name, area_value, area_unit, main_crop, irrigation_source)
    VALUES ('03-12', '03', '12', '1', 'القطعة الرئيسية 12 (أم)', 5.0, 'فدان', 'نخيل مجدول', 'محبس رئيسي V-12')
    ON CONFLICT(id) DO UPDATE SET area_value = 5.0, main_crop = 'نخيل مجدول'
  `);

  // Update 03-12A (sub-plot east)
  const b12A = [
    [27.0500, 31.1615],
    [27.0500, 31.1630],
    [27.0470, 31.1630],
    [27.0470, 31.1615],
    [27.0500, 31.1615]
  ];
  db.run(`
    UPDATE plots SET 
      parent_plot_id = '03-12',
      area_value = 2.5,
      area_unit = 'فدان',
      boundary_coordinates = ?,
      center_lat = 27.0485,
      center_lng = 31.16225,
      main_crop = 'نخيل مجدول',
      irrigation_source = 'خط تنقيط V12-A'
    WHERE id = '03-12A'
  `, JSON.stringify(b12A));

  // Update 03-12B (sub-plot west)
  const b12B = [
    [27.0500, 31.1600],
    [27.0500, 31.1615],
    [27.0470, 31.1615],
    [27.0470, 31.1600],
    [27.0500, 31.1600]
  ];
  db.run(`
    UPDATE plots SET 
      parent_plot_id = '03-12',
      area_value = 2.5,
      area_unit = 'فدان',
      boundary_coordinates = ?,
      center_lat = 27.0485,
      center_lng = 31.16075,
      main_crop = 'نخيل مجدول',
      irrigation_source = 'خط تنقيط V12-B'
    WHERE id = '03-12B'
  `, JSON.stringify(b12B));

  // Recalculate Sector 03 GIS total area and outer boundary
  updateSectorGis('03');

  const sec = db.get("SELECT id, total_area, boundary_coordinates FROM sectors WHERE id = '03'");
  console.log('✅ Updated Sector 03 GIS data:', sec);
}

if (require.main === module) {
  seedGisSamples();
}

module.exports = { seedGisSamples };

