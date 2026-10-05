// Routes: Offline sync endpoints
const db = require('../db');
const { normalizeSectorCode, normalizePlotCode, normalizePalmCode } = require('../code_normalizer');
const { uuidv7 } = require('../uuidv7');
const { TreeHealthStatus, ApprovalStatus, SyncStatus } = require('../enums');
const { sendJson, parseBody } = require('../lib/http');
const { resolvePalmId, resolveTypeId, resolveWorkerId } = require('../lib/helpers');

const NEXT = Symbol.for('palmtrace.next-route');

// Returns NEXT when no route in this module matched the request.
module.exports = async function syncRoutes(req, res, { method, pathname, url }) {
  // 7. Batch Offline Sync
  if (method === 'POST' && pathname === '/api/sync') {
    const body = await parseBody(req);
    const items = body.operations || body.queue || [];
    if (!Array.isArray(items) || items.length === 0) {
      return sendJson(res, 200, { success: true, processed: 0, message: 'لا توجد حركات للمزامنة' });
    }

    let processedCount = 0;
    const stmt = db.db.prepare(
      `INSERT INTO operations (id, palm_id, type_id, worker_id, performed_at, status_id, approval_id, worker_notes, supervisor_notes, photos, batch_id, target_level, sector_id, plot_id, tree_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         status_id = excluded.status_id,
         approval_id = excluded.approval_id,
         worker_notes = excluded.worker_notes,
         supervisor_notes = excluded.supervisor_notes,
         batch_id = excluded.batch_id,
         target_level = excluded.target_level,
         sector_id = excluded.sector_id,
         plot_id = excluded.plot_id,
         tree_count = excluded.tree_count`
    );

    items.forEach(item => {
      const opId = item.id || uuidv7();
      const approvalId = item.approvalId || item.approval_id || ApprovalStatus.fromCode(item.approval || item.approval_status || 'pending');
      const statusId = SyncStatus.SYNCED;

      const palmId = (item.targetLevel === 'sector' || item.targetLevel === 'plot' || (!item.palmId && !item.palmCode)) ? null : resolvePalmId(item);
      const typeId = resolveTypeId(item);
      const workerId = resolveWorkerId(item);
      const batchId = item.batchId || item.batch_id || item.bulkId || null;
      const targetLevel = item.targetLevel || item.target_level || 'tree';
      const sectorId = item.sectorId || item.sector_id || null;
      const plotId = item.plotId || item.plot_id || null;
      const treeCount = Number(item.treeCount || item.tree_count || 1);

      try {
        stmt.run(
          opId,
          palmId,
          typeId,
          workerId,
          item.at || new Date().toISOString(),
          statusId,
          approvalId,
          item.notes || item.worker_notes || '',
          item.supervisorNote || item.supervisor_notes || '',
          JSON.stringify(item.photos || []),
          batchId,
          targetLevel,
          sectorId,
          plotId,
          treeCount
        );
        processedCount++;
      } catch (opErr) {
        console.warn('Failed to sync operation:', opId, opErr.message);
      }
    });

    return sendJson(res, 200, {
      success: true,
      processed: processedCount,
      message: `تمت مزامنة ${processedCount} حركة بنجاح في قاعدة البيانات`
    });
  }

  // 7.1 Comprehensive Enterprise Sync (sync/all)
  if (method === 'POST' && pathname === '/api/sync/all') {
    const body = await parseBody(req);
    db.exec('BEGIN');
    try {
      // Persist Sectors
      if (Array.isArray(body.sectors) && body.sectors.length > 0) {
        const secStmt = db.db.prepare(
          `INSERT INTO sectors (id, name, notes, total_area) VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             total_area = COALESCE(excluded.total_area, sectors.total_area)`
        );
        body.sectors.forEach(s => {
          if (s && s.id) {
            const secId = normalizeSectorCode(s.id);
            const tArea = (s.totalArea !== undefined && s.totalArea !== null) ? Number(s.totalArea) : ((s.total_area !== undefined && s.total_area !== null) ? Number(s.total_area) : null);
            try { secStmt.run(secId, s.name || `قطاع ${secId}`, s.notes || '', tArea); } catch (e) {}
          }
        });
      }

      // Persist Plots
      if (Array.isArray(body.plots) && body.plots.length > 0) {
        const plotStmt = db.db.prepare(
          `INSERT INTO plots (id, sector_id, plot_no, part_letter, name, area_value, area_unit, parent_plot_id, main_crop)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             sector_id = excluded.sector_id,
             area_value = COALESCE(excluded.area_value, plots.area_value),
             area_unit = COALESCE(excluded.area_unit, plots.area_unit),
             parent_plot_id = COALESCE(excluded.parent_plot_id, plots.parent_plot_id),
             main_crop = COALESCE(excluded.main_crop, plots.main_crop)`
        );
        body.plots.forEach(p => {
          if (p && p.id) {
            const normPlotId = normalizePlotCode(p.id);
            const sec = normalizeSectorCode(p.sector || p.sector_id || normPlotId.split('-')[0] || 'BSH01');
            const pno = p.plotNo || p.plot_no || (normPlotId.split('-')[1] ? normPlotId.split('-')[1].replace(/[^\d]/g, '') : '01');
            const part = p.part || p.part_letter || (normPlotId.split('-')[1] ? normPlotId.split('-')[1].replace(/[\d]/g, '') : '');
            const areaVal = (p.areaValue !== undefined && p.areaValue !== null) ? Number(p.areaValue) : ((p.area_value !== undefined && p.area_value !== null) ? Number(p.area_value) : null);
            const areaUnt = p.areaUnit || p.area_unit || 'فدان';
            const parentId = p.parentPlotId || p.parent_plot_id || null;
            const mainCrp = p.mainCrop || p.main_crop || null;
            try { plotStmt.run(normPlotId, sec, pno, part, p.name || `قطعة ${pno}${part}`, areaVal, areaUnt, parentId, mainCrp); } catch (e) {}
          }
        });
      }

    // Persist Palms / Trees
    if (Array.isArray(body.palms) && body.palms.length > 0) {
      const palmStmt = db.db.prepare(
        `INSERT INTO palms (code, crop_id, source_type, variety_id, sector_id, plot_id, seq_no, plant_date, origin_id, notes, status_id, gps_lat, gps_lng, nursery_age_months)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(code) DO UPDATE SET
           variety_id = excluded.variety_id,
           plot_id = excluded.plot_id,
           plant_date = excluded.plant_date,
           notes = excluded.notes,
           status_id = excluded.status_id,
           gps_lat = excluded.gps_lat,
           gps_lng = excluded.gps_lng,
           nursery_age_months = COALESCE(excluded.nursery_age_months, palms.nursery_age_months)`
      );
      const cropsList = db.all('SELECT id, code FROM crops');
      const cropCodeToId = {};
      cropsList.forEach(c => { cropCodeToId[c.code] = c.id; });

      const varList = db.all('SELECT id, name FROM crop_varieties');
      const varNameToId = {};
      varList.forEach(v => { varNameToId[v.name] = v.id; });

      body.palms.forEach(p => {
        if (p && p.code) {
          const normPalmCode = normalizePalmCode(p.code);
          const cropId = cropCodeToId[p.cropId || p.crop_id] || 1;
          const varietyId = p.varietyId || varNameToId[p.variety] || 'cv1';
          const normPlotId = normalizePlotCode(p.plot || p.plot_id || 'BSH01-01A');
          const normSecId = normalizeSectorCode(p.sectorId || p.sector_id || normPlotId.split('-')[0] || 'BSH01');
          const seqNo = String(p.seq || p.seq_no || '001');
          const plantDate = p.plantDate || p.plant_date || new Date().toISOString().slice(0, 10);
          const originId = p.originId || (p.originType === 'purchased' ? 2 : 1);
          let statusId = 1;
          if (p.statusId !== undefined && p.statusId !== null && !isNaN(Number(p.statusId))) {
            statusId = Number(p.statusId);
          } else if (p.status_id !== undefined && p.status_id !== null && !isNaN(Number(p.status_id))) {
            statusId = Number(p.status_id);
          } else if (p.status || p.statusCode) {
            statusId = TreeHealthStatus.fromCode(p.status || p.statusCode) || 1;
          }
          const srcType = p.source || p.source_type || 'F';
          let gpsLat = (p.gps_lat !== undefined && p.gps_lat !== null && p.gps_lat !== '') ? Number(p.gps_lat) : null;
          let gpsLng = (p.gps_lng !== undefined && p.gps_lng !== null && p.gps_lng !== '') ? Number(p.gps_lng) : null;
          if ((gpsLat === null || gpsLng === null) && p.gps && typeof p.gps === 'string' && p.gps.includes(',')) {
            const [la, lo] = p.gps.split(',').map(s => s.trim());
            if (!isNaN(Number(la)) && !isNaN(Number(lo))) {
              gpsLat = Number(la);
              gpsLng = Number(lo);
            }
          }
          const nAge = p.nurseryAgeMonths !== undefined ? Number(p.nurseryAgeMonths) : 0;
          try {
            palmStmt.run(normPalmCode, cropId, srcType, varietyId, normSecId, normPlotId, seqNo, plantDate, originId, p.notes || '', statusId, gpsLat, gpsLng, nAge);
          } catch (err) {
            console.warn('Failed to insert palm in sync/all:', normPalmCode, err.message);
          }
        }
      });
    }

    const ops = body.operations || body.queue || [];
    let processedOps = 0;

    if (Array.isArray(ops) && ops.length > 0) {
      const stmt = db.db.prepare(
        `INSERT INTO operations (id, palm_id, type_id, worker_id, performed_at, status_id, approval_id, worker_notes, supervisor_notes, photos, batch_id, target_level, sector_id, plot_id, tree_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           status_id = excluded.status_id,
           approval_id = excluded.approval_id,
           worker_notes = excluded.worker_notes,
           supervisor_notes = excluded.supervisor_notes,
           batch_id = excluded.batch_id,
           target_level = excluded.target_level,
           sector_id = excluded.sector_id,
           plot_id = excluded.plot_id,
           tree_count = excluded.tree_count`
      );
      ops.forEach(item => {
        const opId = item.id || uuidv7();
        const approvalId = item.approvalId || item.approval_id || ApprovalStatus.fromCode(item.approval || item.approval_status || 'pending');
        const statusId = SyncStatus.SYNCED;
        const palmId = (item.targetLevel === 'sector' || item.targetLevel === 'plot' || (!item.palmId && !item.palmCode)) ? null : resolvePalmId(item);
        const typeId = resolveTypeId(item);
        const workerId = resolveWorkerId(item);
        const batchId = item.batchId || item.batch_id || item.bulkId || null;
        const targetLevel = item.targetLevel || item.target_level || 'tree';
        const sectorId = item.sectorId || item.sector_id || null;
        const plotId = item.plotId || item.plot_id || null;
        const treeCount = Number(item.treeCount || item.tree_count || 1);

        try {
          stmt.run(
            opId, palmId, typeId, workerId, item.at || new Date().toISOString(),
            statusId, approvalId, item.notes || item.worker_notes || '',
            item.supervisorNote || item.supervisor_notes || '', JSON.stringify(item.photos || []),
            batchId, targetLevel, sectorId, plotId, treeCount
          );
          processedOps++;
        } catch (opErr) {
          console.warn('Failed to sync operation in sync/all:', opId, opErr.message);
        }
      });
    }

    // Persist Tree Notes / Observations
    const notesList = body.treeNotes || body.tree_notes || [];
    let processedNotes = 0;
    if (Array.isArray(notesList) && notesList.length > 0) {
      const tnStmt = db.db.prepare(
        `INSERT INTO tree_notes (id, palm_id, palm_code, author_id, author_name, note_type, priority, content, attachments, visibility_scope, assigned_to_user_id, assigned_to_user_name, status, execution_notes, execution_proof_photo, executed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           status = excluded.status,
           execution_notes = excluded.execution_notes,
           execution_proof_photo = excluded.execution_proof_photo,
           executed_at = excluded.executed_at,
           updated_at = CURRENT_TIMESTAMP`
      );
      notesList.forEach(n => {
        if (n && n.id) {
          try {
            tnStmt.run(
              n.id, n.palmId || n.palm_id || null, n.palmCode || n.palm_code || '',
              n.authorId || n.author_id || 'u2', n.authorName || n.author_name || 'المهندس',
              n.noteType || n.note_type || 'general', n.priority || 'normal',
              n.content || '', JSON.stringify(n.attachments || n.photos || []),
              n.visibilityScope || n.visibility_scope || 'individual',
              n.assignedToUserId || n.assigned_to_user_id || null,
              n.assignedToUserName || n.assigned_to_user_name || null,
              n.status || 'new', n.executionNotes || n.execution_notes || null,
              n.executionProofPhoto || n.execution_proof_photo || null,
              n.executedAt || n.executed_at || null
            );
            processedNotes++;
          } catch (e) {}
        }
      });
    }

      db.exec('COMMIT');

      return sendJson(res, 200, {
        success: true,
        message: 'تمت المزامنة الشاملة بنجاح في قاعدة بيانات SQLite',
        counts: {
          sectors: Array.isArray(body.sectors) ? body.sectors.length : 0,
          plots: Array.isArray(body.plots) ? body.plots.length : 0,
          palms: Array.isArray(body.palms) ? body.palms.length : 0,
          offshoots: Array.isArray(body.offshoots) ? body.offshoots.length : 0,
          operations: processedOps
        }
      });
    } catch (txErr) {
      try { db.exec('ROLLBACK'); } catch {}
      console.error('Transaction rollback in /api/sync/all:', txErr.message);
      return sendJson(res, 500, { error: 'فشل تنفيذ المزامنة الشاملة', details: txErr.message });
    }
  }

  return NEXT;
};
