/**
 * Data Cleanup and Normalization Migration Script
 * Merges BSh1, BSH1, and BSH01 under canonical 'BSH01' (بشاير 1)
 * Standardizes plot hierarchy (removes fake part 'A' from parent plots)
 * Deduplicates plots, updates palms, contract_plots, user_plots
 * Adds COLLATE NOCASE and unique constraints
 */

const fs = require('fs');
const path = require('path');
const db = require('../db');
const { normalizeSectorCode } = require('../code_normalizer');
const { updateSectorGis } = require('../plots_gis_handler');

function run() {
  console.log('--- Starting PalmTrace Enterprise BSH01 Cleanup & Normalization ---');

  // 1. Backup database
  const dbFile = require('../config').DB_PATH;
  const backupFile = path.join(require('../config').DATA_DIR, `palmtrace.db.backup_bsh01_${Date.now()}`);
  fs.copyFileSync(dbFile, backupFile);
  console.log(`✓ Database backed up to: ${path.basename(backupFile)}`);

  db.exec('PRAGMA foreign_keys = OFF;');
  db.exec('BEGIN TRANSACTION;');

  try {
    // 2. Ensure canonical sector BSH01 exists
    const bsh01Sec = db.get("SELECT * FROM sectors WHERE id = 'BSH01'");
    if (bsh01Sec) {
      db.run("UPDATE sectors SET name = 'بشاير 1', is_deleted = 0 WHERE id = 'BSH01'");
    } else {
      db.run("INSERT INTO sectors (id, name, is_deleted) VALUES ('BSH01', 'بشاير 1', 0)");
    }

    // Ensure BSH02 exists if BSh2 was present
    const bsh2Sec = db.get("SELECT * FROM sectors WHERE id IN ('BSh2', 'BSH2')");
    if (bsh2Sec) {
      db.run("INSERT INTO sectors (id, name, is_deleted) VALUES ('BSH02', 'قطاع BSH02', 0) ON CONFLICT(id) DO UPDATE SET is_deleted = 0");
    }

    // 3. Normalize all plots
    const allPlots = db.all("SELECT * FROM plots");
    console.log(`Found ${allPlots.length} existing plots.`);

    // Mapping old plot ID -> new normalized plot ID
    const plotIdMap = {};

    for (const pl of allPlots) {
      const oldId = pl.id;
      const oldSec = pl.sector_id;
      let newSec = normalizeSectorCode(oldSec);
      if (newSec === 'BSH1' || newSec === 'BSh1') newSec = 'BSH01';
      if (newSec === 'BSH2' || newSec === 'BSh2') newSec = 'BSH02';

      // Parse plot number and part letter
      let plotNo = pl.plot_no;
      let partLetter = pl.part_letter;

      // Extract from ID if needed (e.g. BSh1-1A, BSH01-02A, BSh1-1)
      const afterDash = oldId.split('-')[1] || oldId;
      const m = afterDash.match(/^(\d+)([A-Za-z\u0600-\u06FF]*)$/);
      if (m) {
        plotNo = m[1].padStart(2, '0');
        partLetter = m[2] ? m[2].toUpperCase() : '';
      } else {
        plotNo = plotNo ? String(plotNo).padStart(2, '0') : '01';
        partLetter = partLetter ? String(partLetter).toUpperCase() : '';
      }

      // Check if this was a parent plot mistakenly assigned partLetter = 'A' or '1'
      // If the old ID has no letter in ID (e.g. BSh1-1, BSh1-2, BSh1-3...)
      if (!/[A-Za-z\u0600-\u06FF]/.test(afterDash)) {
        partLetter = ''; // Parent plot has NO part letter!
      }

      const newId = `${newSec}-${plotNo}${partLetter}`;
      plotIdMap[oldId] = newId;
    }

    const deduplicatedPlots = new Map();

    for (const pl of allPlots) {
      const newId = plotIdMap[pl.id] || pl.id;
      const parts = newId.split('-');
      const secId = parts[0];
      const pCode = parts[1];
      const m = pCode.match(/^(\d+)([A-Za-z\u0600-\u06FF]*)$/);
      const plotNo = m ? m[1] : pCode;
      const partLetter = m ? m[2] : '';
      const isParent = !partLetter;
      const parentPlotId = isParent ? null : `${secId}-${plotNo}`;

      const existing = deduplicatedPlots.get(newId);
      if (!existing) {
        deduplicatedPlots.set(newId, {
          id: newId,
          sector_id: secId,
          plot_no: plotNo,
          part_letter: partLetter,
          name: isParent ? `القطعة الرئيسية ${plotNo}` : (pl.name || `حوشة ${plotNo}${partLetter}`),
          parent_plot_id: parentPlotId,
          area_value: Number(pl.area_value || 0),
          area_unit: pl.area_unit || 'فدان',
          boundary_coordinates: pl.boundary_coordinates || null,
          center_lat: pl.center_lat || null,
          center_lng: pl.center_lng || null,
          main_crop: pl.main_crop || 'نخيل',
          target_capacity: pl.target_capacity || 0,
          irrigation_source: pl.irrigation_source || null,
          contract_ref: pl.contract_ref || null
        });
      } else {
        // Merge with existing: prefer non-zero area and existing coordinates
        if (Number(pl.area_value || 0) > existing.area_value) {
          existing.area_value = Number(pl.area_value);
        }
        if (pl.boundary_coordinates && !existing.boundary_coordinates) {
          existing.boundary_coordinates = pl.boundary_coordinates;
          existing.center_lat = pl.center_lat;
          existing.center_lng = pl.center_lng;
        }
        if (pl.name && (!existing.name || existing.name.startsWith('قطعة '))) {
          existing.name = pl.name;
        }
      }
    }

    // Make sure every child's parent plot exists in deduplicatedPlots
    for (const pl of Array.from(deduplicatedPlots.values())) {
      if (pl.parent_plot_id && !deduplicatedPlots.has(pl.parent_plot_id)) {
        deduplicatedPlots.set(pl.parent_plot_id, {
          id: pl.parent_plot_id,
          sector_id: pl.sector_id,
          plot_no: pl.plot_no,
          part_letter: '',
          name: `القطعة الرئيسية ${pl.plot_no}`,
          parent_plot_id: null,
          area_value: 0,
          area_unit: 'فدان',
          boundary_coordinates: null,
          center_lat: null,
          center_lng: null,
          main_crop: pl.main_crop,
          target_capacity: 0,
          irrigation_source: null,
          contract_ref: null
        });
      }
    }

    console.log(`Deduplicated into ${deduplicatedPlots.size} unique canonical plots.`);

    // Wipe old plots table rows and insert canonical records
    db.run("DELETE FROM plots");
    const insertPlotStmt = db.db.prepare(`
      INSERT INTO plots (
        id, sector_id, plot_no, part_letter, name, parent_plot_id,
        area_value, area_unit, boundary_coordinates, center_lat, center_lng,
        main_crop, target_capacity, irrigation_source, contract_ref
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Insert parents first, then children
    const sortedPlots = Array.from(deduplicatedPlots.values()).sort((a, b) => {
      if (!a.parent_plot_id && b.parent_plot_id) return -1;
      if (a.parent_plot_id && !b.parent_plot_id) return 1;
      return a.id.localeCompare(b.id);
    });

    for (const p of sortedPlots) {
      insertPlotStmt.run(
        p.id, p.sector_id, p.plot_no, p.part_letter, p.name, p.parent_plot_id,
        p.area_value, p.area_unit, p.boundary_coordinates, p.center_lat, p.center_lng,
        p.main_crop, p.target_capacity, p.irrigation_source, p.contract_ref
      );
    }
    console.log('✓ Canonical plots inserted successfully.');

    // 4. Update palms table
    const palms = db.all("SELECT id, code, sector_id, plot_id, gps_lat, gps_lng FROM palms");
    console.log(`Updating ${palms.length} palms with normalized sector, plot references, and coordinates...`);

    const updatePalmStmt = db.db.prepare(`
      UPDATE palms
      SET sector_id = ?, plot_id = ?, code = ?, gps_lat = ?, gps_lng = ?
      WHERE id = ?
    `);

    // Map known coordinates from Excel/CSV for subplots if currently null
    const plotCoordDefaults = {
      'BSH01-01A': { lat: 27.003625, lng: 28.384938 },
      'BSH01-01B': { lat: 27.003625, lng: 28.386038 },
      'BSH01-01C': { lat: 27.003625, lng: 28.387138 },
      'BSH01-01D': { lat: 27.003625, lng: 28.388238 },
      'BSH01-02A': { lat: 27.004675, lng: 28.384938 },
      'BSH01-02B': { lat: 27.004675, lng: 28.386038 },
      'BSH01-02C': { lat: 27.004675, lng: 28.387138 },
      'BSH01-02D': { lat: 27.004675, lng: 28.388238 }
    };

    for (const palm of palms) {
      let normSec = normalizeSectorCode(palm.sector_id);
      if (normSec === 'BSH1' || normSec === 'BSh1') normSec = 'BSH01';
      if (normSec === 'BSH2' || normSec === 'BSh2') normSec = 'BSH02';

      const mappedPlot = plotIdMap[palm.plot_id] || palm.plot_id;
      const finalPlot = deduplicatedPlots.has(mappedPlot) ? mappedPlot : (deduplicatedPlots.has(`${normSec}-${mappedPlot}`) ? `${normSec}-${mappedPlot}` : mappedPlot);

      // Normalize palm code: BSH01-1A-F01-0926 -> BSH01-01A-F01-0926
      let normCode = palm.code;
      normCode = normCode.replace(/^(BSh1|BSH1|BSH01)-1A/, 'BSH01-01A')
                         .replace(/^(BSh1|BSH1|BSH01)-1B/, 'BSH01-01B')
                         .replace(/^(BSh1|BSH1|BSH01)-1C/, 'BSH01-01C')
                         .replace(/^(BSh1|BSH1|BSH01)-1D/, 'BSH01-01D')
                         .replace(/^(BSh1|BSH1|BSH01)-2A/, 'BSH01-02A')
                         .replace(/^(BSh1|BSH1|BSH01)-2B/, 'BSH01-02B')
                         .replace(/^(BSh1|BSH1|BSH01)-2C/, 'BSH01-02C')
                         .replace(/^(BSh1|BSH1|BSH01)-2D/, 'BSH01-02D');

      let curLat = palm.gps_lat;
      let curLng = palm.gps_lng;
      if (!curLat || !curLng) {
        const defC = plotCoordDefaults[finalPlot];
        if (defC) {
          curLat = defC.lat;
          curLng = defC.lng;
        }
      }

      updatePalmStmt.run(normSec, finalPlot, normCode, curLat, curLng, palm.id);
    }
    console.log('✓ Palms updated successfully.');

    // 5. Update user_plots and contract_plots
    const userPlots = db.all("SELECT * FROM user_plots");
    db.run("DELETE FROM user_plots");
    const insUserPlot = db.db.prepare("INSERT OR IGNORE INTO user_plots (id, user_id, plot_id, permission_type) VALUES (?, ?, ?, ?)");
    for (const up of userPlots) {
      const targetPlot = plotIdMap[up.plot_id] || up.plot_id;
      insUserPlot.run(up.id, up.user_id, targetPlot, up.permission_type || 'view');
    }

    const contractPlots = db.all("SELECT * FROM contract_plots");
    db.run("DELETE FROM contract_plots");
    const insContractPlot = db.db.prepare("INSERT OR IGNORE INTO contract_plots (contract_id, plot_id) VALUES (?, ?)");
    for (const cp of contractPlots) {
      const targetPlot = plotIdMap[cp.plot_id] || cp.plot_id;
      insContractPlot.run(cp.contract_id, targetPlot);
    }

    // 6. Remove distorted sector rows
    db.run("DELETE FROM sectors WHERE id IN ('BSh1', 'BSH1', 'BSh2')");
    console.log('✓ Distorted sector rows removed.');

    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  } finally {
    db.exec('PRAGMA foreign_keys = ON;');
  }

  // 7. Recompute GIS and area for BSH01
  try {
    updateSectorGis('BSH01');
    console.log('✓ Sector GIS boundaries and total area updated for BSH01.');
  } catch (err) {
    console.warn('GIS update warning:', err.message);
  }

  // 8. Add Unique Indexes and Collation
  try {
    db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_sectors_id_nocase ON sectors (id COLLATE NOCASE)");
    console.log('✓ Unique index idx_sectors_id_nocase created.');
  } catch (e) {
    console.warn('Index notice:', e.message);
  }

  try {
    db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_plot_per_sector ON plots (sector_id, COALESCE(parent_plot_id, ''), plot_no, part_letter)");
    console.log('✓ Unique index idx_unique_plot_per_sector created.');
  } catch (e) {
    console.warn('Index notice:', e.message);
  }

  // 9. Verify current database state
  const finalSectors = db.all("SELECT id, name, total_area FROM sectors");
  console.log('Final sectors:', finalSectors);
  const finalPlots = db.all("SELECT id, sector_id, plot_no, part_letter, name, parent_plot_id, area_value FROM plots ORDER BY id ASC");
  console.log(`Final plots count: ${finalPlots.length}`);
  console.log('Final plots sample:', finalPlots.slice(0, 15));

  const samplePalms = db.all("SELECT id, code, sector_id, plot_id, gps_lat, gps_lng FROM palms LIMIT 5");
  console.log('Sample palms after migration:', samplePalms);

  console.log('--- Cleanup & Normalization Completed Successfully! ---');
}

run();

