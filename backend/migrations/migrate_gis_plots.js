const db = require('../db');

function runGisPlotsMigration() {
  console.log('--- Starting GIS Plots & Boundaries Migration ---');

  // 1. Add columns to plots table
  const plotCols = [
    { col: 'parent_plot_id', type: 'TEXT' },
    { col: 'area_value', type: 'REAL DEFAULT 0' },
    { col: 'area_unit', type: "TEXT DEFAULT 'فدان'" },
    { col: 'boundary_coordinates', type: 'TEXT' },
    { col: 'center_lat', type: 'REAL' },
    { col: 'center_lng', type: 'REAL' },
    { col: 'main_crop', type: 'TEXT' },
    { col: 'target_capacity', type: 'INTEGER DEFAULT 0' },
    { col: 'irrigation_source', type: 'TEXT' },
    { col: 'contract_ref', type: 'TEXT' }
  ];

  for (const { col, type } of plotCols) {
    try {
      db.exec(`ALTER TABLE plots ADD COLUMN ${col} ${type};`);
      console.log(`[plots] Added column: ${col}`);
    } catch (e) {
      if (!e.message.includes('duplicate column name')) {
        console.warn(`[plots] Warning on column ${col}:`, e.message);
      }
    }
  }

  // 2. Add columns to sectors table
  const secCols = [
    { col: 'boundary_coordinates', type: 'TEXT' },
    { col: 'total_area', type: 'REAL DEFAULT 0' }
  ];

  for (const { col, type } of secCols) {
    try {
      db.exec(`ALTER TABLE sectors ADD COLUMN ${col} ${type};`);
      console.log(`[sectors] Added column: ${col}`);
    } catch (e) {
      if (!e.message.includes('duplicate column name')) {
        console.warn(`[sectors] Warning on column ${col}:`, e.message);
      }
    }
  }

  // 3. Create helpful indexes
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_plots_parent ON plots(parent_plot_id);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_plots_sector ON plots(sector_id);');
    console.log('Indexes on plots checked/created.');
  } catch (e) {
    console.warn('Index creation warning:', e.message);
  }

  console.log('--- GIS Plots & Boundaries Migration Completed Successfully ---');
}

if (require.main === module) {
  runGisPlotsMigration();
}

module.exports = { runGisPlotsMigration };

