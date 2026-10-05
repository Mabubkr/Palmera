// Routes: Plots create/update and per-plot API
const db = require('../db');
const { sendJson, parseBody } = require('../lib/http');
const { updateSectorGis, logAudit } = require('../lib/helpers');

const NEXT = Symbol.for('palmtrace.next-route');

// Returns NEXT when no route in this module matched the request.
module.exports = async function plotsRoutes(req, res, { method, pathname, url }) {
  // Single Plot Creation / Update
  if (pathname === '/api/plots') {
    if (method === 'GET') {
      const plots = db.all(`
        SELECT 
          id, sector_id as sector, plot_no as plotNo, part_letter as part, name, polygon_gps as polygon,
          parent_plot_id as parentPlotId, area_value as areaValue, area_unit as areaUnit, 
          boundary_coordinates as boundaryCoordinates, center_lat as centerLat, center_lng as centerLng, 
          main_crop as mainCrop, target_capacity as targetCapacity, irrigation_source as irrigationSource, 
          contract_ref as contractRef
        FROM plots 
        WHERE (sector_id NOT LIKE 'ST%' OR sector_id IS NULL)
      `);
      plots.forEach(p => {
        if (p.boundaryCoordinates && typeof p.boundaryCoordinates === 'string') {
          try { p.boundaryCoordinates = JSON.parse(p.boundaryCoordinates); } catch {}
        }
      });
      return sendJson(res, 200, plots);
    }

    if (method === 'POST') {
      const plot = await parseBody(req);
      if (plot.id && plot.sector && plot.name) {
        let boundaryJson = plot.boundaryCoordinates || plot.boundary_coordinates || null;
        if (Array.isArray(boundaryJson)) {
          boundaryJson = JSON.stringify(boundaryJson);
        }
        let parentPlotId = plot.parentPlotId || plot.parent_plot_id || null;
        const plotNoVal = String(plot.plotNo || plot.plot_no || '1').trim();
        const partVal = String(plot.part || plot.part_letter || '').trim();
        if (!parentPlotId && partVal && plot.sector) {
          parentPlotId = `${plot.sector}-${plotNoVal}`;
          db.run(
            "INSERT INTO plots (id, sector_id, plot_no, part_letter, name, main_crop) VALUES (?, ?, ?, '', ?, ?) ON CONFLICT(id) DO NOTHING",
            parentPlotId, plot.sector, plotNoVal, `قطعة ${plotNoVal}`, plot.mainCrop || plot.main_crop || null
          );
        }

        db.run(
          `INSERT INTO plots (
             id, sector_id, plot_no, part_letter, name, polygon_gps,
             parent_plot_id, area_value, area_unit, boundary_coordinates,
             center_lat, center_lng, main_crop, target_capacity, irrigation_source, contract_ref
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET 
             sector_id = excluded.sector_id, 
             plot_no = excluded.plot_no, 
             part_letter = excluded.part_letter, 
             name = excluded.name, 
             polygon_gps = excluded.polygon_gps,
             parent_plot_id = excluded.parent_plot_id,
             area_value = excluded.area_value,
             area_unit = excluded.area_unit,
             boundary_coordinates = excluded.boundary_coordinates,
             center_lat = excluded.center_lat,
             center_lng = excluded.center_lng,
             main_crop = excluded.main_crop,
             target_capacity = excluded.target_capacity,
             irrigation_source = excluded.irrigation_source,
             contract_ref = excluded.contract_ref`,
          plot.id,
          plot.sector,
          plot.plotNo || plot.plot_no || '1',
          plot.part || plot.part_letter || 'A',
          plotNoVal,
          partVal,
          plot.name,
          plot.polygon || null,
          plot.parentPlotId || plot.parent_plot_id || null,
          parentPlotId,
          Number(plot.areaValue || plot.area_value || 0),
          plot.areaUnit || plot.area_unit || 'فدان',
          boundaryJson,
          plot.centerLat || plot.center_lat || null,
          plot.centerLng || plot.center_lng || null,
          plot.mainCrop || plot.main_crop || null,
          parseInt(plot.targetCapacity || plot.target_capacity || 0, 10),
          plot.irrigationSource || plot.irrigation_source || null,
          plot.contractRef || plot.contract_ref || null
        );

        updateSectorGis(plot.sector);

        return sendJson(res, 201, { success: true, message: 'تم حفظ القطعة وتحديث بيانات الـ GIS بنجاح' });
      }
    }
  }

  // Individual Plot API (GET / PUT)
  if (pathname.startsWith('/api/plots/') && !pathname.includes('template') && !pathname.includes('import')) {
    const plotId = decodeURIComponent(pathname.replace('/api/plots/', ''));
    let existing = db.get('SELECT * FROM plots WHERE id = ?', plotId);
    if (!existing) {
      // Check if there are subplots belonging to this base plot ID (e.g. 00-03 -> 00-03A, 00-03B)
      const subplots = db.all('SELECT * FROM plots WHERE parent_plot_id = ? OR id LIKE ?', plotId, `${plotId}%`);
      if (subplots.length > 0) {
        const totalArea = subplots.reduce((sum, sp) => sum + (sp.area_value || 0), 0);
        const sectorId = subplots[0].sector_id;
        const baseName = `القطعة ${plotId.split('-')[1] || plotId}`;
        existing = {
          id: plotId,
          sector_id: sectorId,
          name: baseName,
          parent_plot_id: null,
          area_value: Number(totalArea.toFixed(2)),
          area_unit: subplots[0].area_unit || 'فدان',
          main_crop: subplots[0].main_crop || 'نخيل مجدول',
          irrigation_source: subplots[0].irrigation_source || null,
          contract_ref: null,
          target_capacity: subplots.reduce((sum, sp) => sum + (sp.target_capacity || 0), 0),
          boundary_coordinates: null,
          center_lat: subplots[0].center_lat,
          center_lng: subplots[0].center_lng,
          is_synthesized: true
        };
      }
    }
    if (!existing && method === 'GET') return sendJson(res, 404, { error: 'القطعة غير موجودة' });

    if (method === 'GET') {
      if (existing.boundary_coordinates && typeof existing.boundary_coordinates === 'string') {
        try { existing.boundaryCoordinates = JSON.parse(existing.boundary_coordinates); } catch {}
      }
      const normalizedPlot = {
        ...existing,
        sector: existing.sector || existing.sector_id,
        sector_id: existing.sector_id || existing.sector,
        parentPlotId: existing.parentPlotId || existing.parent_plot_id || null,
        parent_plot_id: existing.parent_plot_id || existing.parentPlotId || null,
        plotNo: existing.plotNo || existing.plot_no || (existing.id ? (existing.id.split('-')[1] || '').replace(/[A-Za-z]+$/, '') : ''),
        plot_no: existing.plot_no || existing.plotNo || (existing.id ? (existing.id.split('-')[1] || '').replace(/[A-Za-z]+$/, '') : ''),
        part: existing.part || existing.part_letter || (existing.id ? (existing.id.match(/[A-Za-z]+$/) || [''])[0] : ''),
        part_letter: existing.part_letter || existing.part || (existing.id ? (existing.id.match(/[A-Za-z]+$/) || [''])[0] : ''),
        areaValue: Number(existing.areaValue ?? existing.area_value ?? 0),
        area_value: Number(existing.area_value ?? existing.areaValue ?? 0),
        areaUnit: existing.areaUnit || existing.area_unit || 'فدان',
        area_unit: existing.area_unit || existing.areaUnit || 'فدان',
        mainCrop: existing.mainCrop || existing.main_crop || 'نخيل مجدول',
        main_crop: existing.main_crop || existing.mainCrop || 'نخيل مجدول',
        irrigationSource: existing.irrigationSource || existing.irrigation_source || '',
        irrigation_source: existing.irrigation_source || existing.irrigationSource || '',
        contractRef: existing.contractRef || existing.contract_ref || null,
        contract_ref: existing.contract_ref || existing.contractRef || null,
        targetCapacity: Number(existing.targetCapacity || existing.target_capacity || 0),
        target_capacity: Number(existing.target_capacity || existing.targetCapacity || 0),
        boundaryCoordinates: existing.boundaryCoordinates || null
      };
      return sendJson(res, 200, { success: true, plot: normalizedPlot, ...normalizedPlot });
    }

    if (method === 'PUT') {
      const body = await parseBody(req);
      const name = body.name || (existing ? existing.name : `القطعة ${plotId}`);
      const parentPlotId = (body.parentPlotId !== undefined) ? (body.parentPlotId || null) : (existing ? existing.parent_plot_id : null);
      const areaValue = (body.areaValue !== undefined || body.area_value !== undefined)
        ? Number(body.areaValue || body.area_value || 0) : (existing ? existing.area_value : 0);
      const areaUnit = body.areaUnit || body.area_unit || (existing ? existing.area_unit : 'فدان') || 'فدان';
      const mainCrop = (body.mainCrop !== undefined) ? (body.mainCrop || null) : (existing ? existing.main_crop : null);
      const irrigationSource = (body.irrigationSource !== undefined) ? (body.irrigationSource || null) : (existing ? existing.irrigation_source : null);
      const contractRef = (body.contractRef !== undefined) ? (body.contractRef || null) : (existing ? existing.contract_ref : null);
      const targetCapacity = (body.targetCapacity !== undefined) ? parseInt(body.targetCapacity, 10) : (existing ? existing.target_capacity : 0);
      const sectorId = body.sector || body.sector_id || (existing ? existing.sector_id : plotId.split('-')[0]);

      let boundaryJson = body.boundaryCoordinates || body.boundary_coordinates;
      let coordsArr = null;
      if (Array.isArray(boundaryJson)) {
        coordsArr = boundaryJson;
        boundaryJson = JSON.stringify(boundaryJson);
      } else if (typeof boundaryJson === 'string' && boundaryJson.trim()) {
        try { coordsArr = JSON.parse(boundaryJson); } catch {}
      } else {
        boundaryJson = existing ? existing.boundary_coordinates : null;
        if (boundaryJson) {
          try { coordsArr = JSON.parse(boundaryJson); } catch {}
        }
      }

      let centerLat = (body.centerLat !== undefined) ? body.centerLat : (existing ? existing.center_lat : null);
      let centerLng = (body.centerLng !== undefined) ? body.centerLng : (existing ? existing.center_lng : null);
      if (Array.isArray(coordsArr) && coordsArr.length >= 3) {
        const lats = coordsArr.map(pt => pt[0]);
        const lngs = coordsArr.map(pt => pt[1]);
        centerLat = Number((lats.reduce((a, b) => a + b, 0) / lats.length).toFixed(6));
        centerLng = Number((lngs.reduce((a, b) => a + b, 0) / lngs.length).toFixed(6));
      }

      if (parentPlotId) {
        const pExists = db.get('SELECT id FROM plots WHERE id = ?', parentPlotId);
        if (!pExists) {
          const pParts = parentPlotId.split('-');
          const pSec = pParts[0] || sectorId;
          const pNo = pParts[1] || parentPlotId;
          db.run(
            "INSERT INTO plots (id, sector_id, plot_no, part_letter, name, main_crop) VALUES (?, ?, ?, '', ?, ?) ON CONFLICT(id) DO NOTHING",
            parentPlotId, pSec, pNo, `قطعة ${pNo}`, mainCrop
          );
        }
      }

      const dbExisting = db.get('SELECT id FROM plots WHERE id = ?', plotId);
      if (!dbExisting) {
        const plotNoMatch = plotId.split('-')[1] || plotId;
        const plotNo = plotNoMatch.replace(/[A-Za-z]+$/, '') || plotNoMatch;
        const partLetterMatch = plotNoMatch.match(/[A-Za-z]+$/);
        const partLetter = partLetterMatch ? partLetterMatch[0].toUpperCase() : '';
        db.run(`
          INSERT INTO plots (id, sector_id, plot_no, part_letter, name, parent_plot_id, area_value, area_unit, boundary_coordinates, center_lat, center_lng, main_crop, target_capacity, irrigation_source, contract_ref)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, plotId, sectorId, plotNo, partLetter, name, parentPlotId, areaValue, areaUnit, boundaryJson, centerLat, centerLng, mainCrop, targetCapacity, irrigationSource, contractRef);
      } else {
        db.run(`
          UPDATE plots SET
            name = ?,
            parent_plot_id = ?,
            area_value = ?,
            area_unit = ?,
            boundary_coordinates = ?,
            center_lat = ?,
            center_lng = ?,
            main_crop = ?,
            target_capacity = ?,
            irrigation_source = ?,
            contract_ref = ?
          WHERE id = ?
        `, name, parentPlotId, areaValue, areaUnit, boundaryJson, centerLat, centerLng, mainCrop, targetCapacity, irrigationSource, contractRef, plotId);
      }

      // Link subplots if they don't have parent_plot_id set yet
      db.run(`UPDATE plots SET parent_plot_id = ? WHERE (parent_plot_id IS NULL OR parent_plot_id = '') AND id LIKE ? AND id != ?`, plotId, `${plotId}%`, plotId);

      updateSectorGis(sectorId);

      // GIS Coupling: Sync service invoices for any contracts linked to this plot
      try {
        const linkedContracts = db.all('SELECT DISTINCT contract_id FROM contract_plots WHERE plot_id = ?', plotId);
        linkedContracts.forEach(lc => syncContractBillingInvoice(lc.contract_id));
      } catch {}

      logAudit(body.operatorId || 'admin', 'update', 'plot', plotId, {
        name, areaValue, areaUnit, irrigationSource, contractRef, centerLat, centerLng
      });

      return sendJson(res, 200, {
        success: true,
        message: 'تم حفظ بيانات القطعة والإحداثيات والقطاع التابع بنجاح',
        plot: {
          id: plotId,
          sector: sectorId,
          name,
          parentPlotId,
          areaValue,
          areaUnit,
          boundaryCoordinates: coordsArr || [],
          centerLat,
          centerLng,
          mainCrop,
          targetCapacity,
          irrigationSource,
          contractRef
        }
      });
    }
  }

  return NEXT;
};
