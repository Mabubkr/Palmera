// Routes: Trees (palms) and offshoots / nursery
const db = require('../db');
const { TreeHealthStatus, TreeOriginType } = require('../enums');
const { sendJson, parseBody } = require('../lib/http');

const NEXT = Symbol.for('palmtrace.next-route');

// Returns NEXT when no route in this module matched the request.
module.exports = async function palmsRoutes(req, res, { method, pathname, url }) {
  // 4. Palms API
  if (pathname === '/api/palms') {
    if (method === 'GET') {
      const palms = db.all(`
        SELECT 
          id, code, crop_code as cropId, crop_id as cropNumericId, source_type as source, 
          variety_id as varietyId, variety_name as variety,
          sector_id as sectorId, sector_name as sectorName,
          plot_id as plot, plot_name as plotName,
          seq_no as seq, plant_date as plantDate, 
          origin_id as originId, origin_type as originType, origin_label as originLabel,
          supplier, notes, parent_palm_id as parentId, parent_palm_code as parentCode,
          temp_code as tempCode, status_id as statusId, status_code as statusCode, 
          status, status_en as statusEn, badge_color as badgeColor, badge_bg as badgeBg,
          offshoot_count as offshootCount, lineage_path as lineagePath,
          gps_lat, gps_lng, nursery_age_months as nurseryAgeMonths,
          is_archived as archived,
          created_by as createdBy, created_at as createdAt,
          modified_by as modifiedBy, modified_at as modifiedAt
        FROM v_palms
        WHERE (is_deleted = 0 OR is_deleted IS NULL)
        ORDER BY id ASC
      `);
      return sendJson(res, 200, palms);
    }
    if (method === 'POST') {
      const p = await parseBody(req);
      const cropRow = db.get('SELECT id FROM crops WHERE code = ?', p.cropId || 'palm');
      const cropId = cropRow ? cropRow.id : 1;

      const allVars = db.all('SELECT id, name FROM crop_varieties');
      const varNameToId = {};
      allVars.forEach(v => { varNameToId[v.name] = v.id; });
      const vName = String(p.variety || 'خلاص');
      const varietyId = p.varietyId || varNameToId[vName] || 'cv1';

      const statusCode = p.status || p.statusCode || 'healthy';
      const statusId = p.statusId || p.status_id || TreeHealthStatus.fromCode(statusCode);
      const originId = p.originId || p.origin_id || TreeOriginType.fromCode(p.originType || p.origin_type || 'internal');

      const plotId = p.plot || p.plot_id || null;
      const secId = p.sector_id || (plotId ? plotId.split('-')[0] : null);
      const lineagePath = p.lineagePath || ('root/' + p.code);
      const cleanNotes = (p.notes && p.notes !== 'توليد جماعي') ? String(p.notes) : null;

      let palmId = null;
      if (typeof p.id === 'number' && !isNaN(p.id)) {
        palmId = p.id;
      } else if (typeof p.id === 'string' && /^\d+$/.test(p.id)) {
        palmId = parseInt(p.id, 10);
      }

      let gpsLat = (p.gps_lat !== undefined && p.gps_lat !== null && p.gps_lat !== '') ? Number(p.gps_lat) : null;
      let gpsLng = (p.gps_lng !== undefined && p.gps_lng !== null && p.gps_lng !== '') ? Number(p.gps_lng) : null;
      if ((gpsLat === null || gpsLng === null) && p.gps && typeof p.gps === 'string' && p.gps.includes(',')) {
        const [la, lo] = p.gps.split(',').map(s => s.trim());
        if (!isNaN(Number(la)) && !isNaN(Number(lo))) {
          gpsLat = Number(la);
          gpsLng = Number(lo);
        }
      }
      const nurseryAge = (p.nurseryAgeMonths !== undefined) ? Number(p.nurseryAgeMonths) : ((p.nursery_age_months !== undefined) ? Number(p.nursery_age_months) : 0);
      const sessionUser = req.headers['x-user-id'] || p.createdBy || p.created_by || p.modifiedBy || 'system';
      const nowTime = new Date().toISOString();

      db.run(
        `INSERT INTO palms (id, code, crop_id, source_type, variety_id, sector_id, plot_id, seq_no, plant_date, origin_id, supplier, notes, parent_palm_id, temp_code, status_id, lineage_path, gps_lat, gps_lng, nursery_age_months, created_by, created_at, modified_by, modified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(code) DO UPDATE SET
           crop_id = excluded.crop_id,
           source_type = excluded.source_type,
           variety_id = excluded.variety_id,
           sector_id = excluded.sector_id,
           plot_id = excluded.plot_id,
           seq_no = excluded.seq_no,
           plant_date = excluded.plant_date,
           origin_id = excluded.origin_id,
           supplier = excluded.supplier,
           notes = excluded.notes,
           status_id = excluded.status_id,
           lineage_path = excluded.lineage_path,
           gps_lat = excluded.gps_lat,
           gps_lng = excluded.gps_lng,
           nursery_age_months = excluded.nursery_age_months,
           modified_by = excluded.modified_by,
           modified_at = excluded.modified_at`,
        palmId, p.code, cropId, p.source || 'F', varietyId, secId, plotId, p.seq || '001', p.plantDate || new Date().toISOString().slice(0,10), originId, p.supplier || '', cleanNotes, p.parentId || null, p.tempCode || null, statusId, lineagePath, gpsLat, gpsLng, nurseryAge, sessionUser, nowTime, sessionUser, nowTime
      );

      return sendJson(res, 201, { success: true, message: 'تم حفظ النخلة في قاعدة البيانات' });
    }
  }

  // 4.1 Palm Archive, Update and Delete Endpoints
  if (pathname.startsWith('/api/palms/')) {
    const archiveMatch = pathname.match(/^\/api\/palms\/([^/]+)\/archive$/);
    if (archiveMatch && method === 'POST') {
      const pIdentifier = decodeURIComponent(archiveMatch[1]);
      const body = await parseBody(req);
      let palmRow = null;
      const numArchiveId = Number(pIdentifier);
      if (!isNaN(numArchiveId) && Number.isInteger(numArchiveId) && numArchiveId > 0) {
        palmRow = db.get('SELECT * FROM palms WHERE id = ?', numArchiveId);
      }
      if (!palmRow) {
        palmRow = db.get('SELECT * FROM palms WHERE code = ?', pIdentifier);
      }
      if (!palmRow) {
        return sendJson(res, 404, { error: 'الشجرة غير موجودة' });
      }
      const newArchived = body.archived !== undefined ? (body.archived ? 1 : 0) : (palmRow.is_archived ? 0 : 1);
      const statusId = newArchived ? 4 : (palmRow.status_id || 1); // 4 = ميتة/مؤرشفة
      db.run('UPDATE palms SET is_archived = ?, status_id = ? WHERE id = ?', newArchived, statusId, palmRow.id);
      return sendJson(res, 200, {
        success: true,
        archived: Boolean(newArchived),
        message: newArchived ? 'تمت أرشفة الشجرة بنجاح' : 'تمت استعادة الشجرة بنجاح'
      });
    }

    const singlePalmMatch = pathname.match(/^\/api\/palms\/([^/]+)$/);
    if (singlePalmMatch) {
      const pIdentifier = decodeURIComponent(singlePalmMatch[1]);
      let palmRow = null;
      const numSingleId = Number(pIdentifier);
      if (!isNaN(numSingleId) && Number.isInteger(numSingleId) && numSingleId > 0) {
        palmRow = db.get('SELECT * FROM palms WHERE id = ?', numSingleId);
      }
      if (!palmRow) {
        palmRow = db.get('SELECT * FROM palms WHERE code = ?', pIdentifier);
      }
      if (!palmRow) {
        return sendJson(res, 404, { error: 'الشجرة غير موجودة' });
      }

      if (method === 'DELETE') {
        db.run('UPDATE palms SET is_deleted = 1 WHERE id = ?', palmRow.id);
        return sendJson(res, 200, { success: true, message: 'تم حذف الشجرة بنجاح' });
      }

      if (method === 'PUT') {
        const body = await parseBody(req);
        
        let varietyId = palmRow.variety_id;
        if (body.varietyId) {
          varietyId = body.varietyId;
        } else if (body.variety) {
          const vRow = db.get('SELECT id FROM crop_varieties WHERE name = ?', body.variety);
          if (vRow) varietyId = vRow.id;
        }

        let statusId = palmRow.status_id;
        if (body.statusId !== undefined && body.statusId !== null && !isNaN(Number(body.statusId))) {
          statusId = Number(body.statusId);
        } else if (body.status || body.statusCode) {
          statusId = TreeHealthStatus.fromCode(body.status || body.statusCode);
        }

        const notes = body.notes !== undefined ? body.notes : palmRow.notes;
        
        let plotId = palmRow.plot_id;
        let secId = palmRow.sector_id;
        if (body.plot || body.plot_id) {
          plotId = body.plot || body.plot_id;
          secId = plotId.split('-')[0] || secId;
        }

        const nurseryAgeMonths = (body.nurseryAgeMonths !== undefined) ? Number(body.nurseryAgeMonths) : (body.nursery_age_months !== undefined ? Number(body.nursery_age_months) : palmRow.nursery_age_months);
        
        let gpsLat = palmRow.gps_lat;
        let gpsLng = palmRow.gps_lng;
        if (body.gps_lat !== undefined) {
          gpsLat = (body.gps_lat !== null && body.gps_lat !== '') ? Number(body.gps_lat) : null;
        }
        if (body.gps_lng !== undefined) {
          gpsLng = (body.gps_lng !== null && body.gps_lng !== '') ? Number(body.gps_lng) : null;
        }
        if (body.gps && typeof body.gps === 'string' && body.gps.includes(',')) {
          const [la, lo] = body.gps.split(',').map(s => s.trim());
          if (!isNaN(Number(la)) && !isNaN(Number(lo))) {
            gpsLat = Number(la);
            gpsLng = Number(lo);
          }
        }

        const parentCode = body.parentCode || body.parent_palm_code || palmRow.temp_code;
        let parentPalmId = palmRow.parent_palm_id;
        if (body.parentId) {
          const momRow = db.get('SELECT id FROM palms WHERE id = ? OR code = ?', body.parentId, body.parentId);
          if (momRow) parentPalmId = momRow.id;
        }

        const sessionUser = req.headers['x-user-id'] || body.modifiedBy || body.modified_by || 'system';
        const nowTime = new Date().toISOString();

        db.run(`
          UPDATE palms SET 
            variety_id = ?, 
            notes = ?, 
            status_id = ?, 
            plot_id = ?, 
            sector_id = ?, 
            nursery_age_months = ?, 
            gps_lat = ?, 
            gps_lng = ?,
            parent_palm_id = ?,
            temp_code = ?,
            modified_by = ?,
            modified_at = ?
          WHERE id = ?
        `, varietyId, notes, statusId, plotId, secId, nurseryAgeMonths, gpsLat, gpsLng, parentPalmId, parentCode, sessionUser, nowTime, palmRow.id);

        return sendJson(res, 200, { success: true, message: 'تم تحديث بيانات الشجرة بنجاح' });
      }
    }
  }

  // 5. Offshoots API
  if (pathname === '/api/offshoots') {
    if (method === 'GET') {
      const offshoots = db.all('SELECT * FROM v_offshoots ORDER BY created_at DESC');
      return sendJson(res, 200, offshoots);
    }
    if (method === 'POST') {
      const o = await parseBody(req);
      const allVars = db.all('SELECT id, name FROM crop_varieties');
      const varNameToId = {};
      allVars.forEach(v => { varNameToId[v.name] = v.id; });
      const vName = String(o.variety || o.variety_name || 'خلاص');
      const varietyId = o.varietyId || varNameToId[vName] || 'cv1';

      const statusId = o.statusId || o.status_id || TreeHealthStatus.fromCode(o.health || o.health_status || o.statusCode || 'healthy');
      const originId = o.originId || o.origin_id || TreeOriginType.fromCode(o.originType || o.origin_type || 'internal');

      let motherId = null;
      const rawMother = o.motherId || o.mother_id;
      if (typeof rawMother === 'number') {
        motherId = rawMother;
      } else if (typeof rawMother === 'string') {
        if (/^\d+$/.test(rawMother)) motherId = parseInt(rawMother, 10);
        else {
          const found = db.get('SELECT id FROM palms WHERE code = ?', rawMother);
          if (found) motherId = found.id;
        }
      }

      const isOpening = (o.isOpeningStock || o.is_opening_stock || !motherId) ? 1 : 0;

      db.run(
        `INSERT INTO offshoots (id, mother_id, temp_code, seq_no, separation_date, weight_kg, diameter_cm, variety_id, status_id, origin_id, supplier, nursery_stage, planted_palm_id, is_opening_stock, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           mother_id = excluded.mother_id,
           temp_code = excluded.temp_code,
           variety_id = excluded.variety_id,
           status_id = excluded.status_id,
           origin_id = excluded.origin_id,
           supplier = excluded.supplier,
           nursery_stage = excluded.nursery_stage,
           planted_palm_id = excluded.planted_palm_id,
           is_opening_stock = excluded.is_opening_stock,
           notes = excluded.notes`,
        o.id || `os_${Date.now()}`, motherId, o.tempCode, o.seq, o.date || new Date().toISOString().slice(0,10), o.weight || null, o.diameter || null, varietyId, statusId, originId, o.supplier || '', o.nsStatus || o.nurseryStage || (isOpening ? 'ready' : 'inbound'), o.newPalmId || null, isOpening, o.notes || ''
      );
      return sendJson(res, 201, { success: true, message: 'تم تسجيل الفسيلة في قاعدة البيانات' });
    }
  }

  // 5.0 Nursery stage + details (receive, care activities, ready, cull, dispatch, field receipt)
  if (pathname === '/api/offshoots/nursery-state' && method === 'POST') {
    const body = await parseBody(req);
    const items = Array.isArray(body.items) ? body.items.slice(0, 2000) : [];
    const STAGES = new Set(['inbound', 'prep', 'stock', 'rooting', 'ready', 'dispatched', 'issued', 'culled', 'planted', 'pending']);
    const META_KEYS = ['preps', 'status', 'statusDesc', 'approval', 'receivedBy', 'receivedAt', 'receivedByName', 'cullReason', 'cullDate', 'cullNotes',
      'dispatchedToUser', 'dispatchedToUserName', 'dispatchedToPlot', 'dispatchedAt', 'dispenseNotes'];
    const who = req.headers['x-user-id'] || null;
    const setStage = db.db.prepare('UPDATE offshoots SET nursery_stage = ? WHERE id = ?');
    const exists = db.db.prepare('SELECT 1 FROM offshoots WHERE id = ?');
    const setMeta = db.db.prepare(`INSERT INTO offshoot_nursery_meta (offshoot_id, meta, updated_by, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                                   ON CONFLICT(offshoot_id) DO UPDATE SET meta = excluded.meta, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP`);
    let saved = 0;
    const missing = [];
    db.db.exec('BEGIN');
    try {
      for (const it of items) {
        if (!it || !it.id) continue;
        const id = String(it.id);
        if (!exists.get(id)) { missing.push(id); continue; }
        if (it.stage && STAGES.has(String(it.stage))) setStage.run(String(it.stage), id);
        if (it.meta && typeof it.meta === 'object') {
          const meta = {};
          META_KEYS.forEach(k => { if (it.meta[k] !== undefined) meta[k] = it.meta[k]; });
          setMeta.run(id, JSON.stringify(meta).slice(0, 200000), who);
        }
        saved++;
      }
      db.db.exec('COMMIT');
    } catch (err) { db.db.exec('ROLLBACK'); throw err; }
    return sendJson(res, 200, { success: true, saved, missing });
  }

  // 5.1 Bulk Nursery Intake
  if (pathname === '/api/offshoots/bulk-intake' && method === 'POST') {
    const body = await parseBody(req);
    const items = Array.isArray(body) ? body : (body.offshoots || []);
    if (!Array.isArray(items) || items.length === 0) {
      return sendJson(res, 400, { error: 'لا توجد فسائل لتسجيلها' });
    }

    const allVars = db.all('SELECT id, name FROM crop_varieties');
    const varNameToId = {};
    allVars.forEach(v => { varNameToId[v.name] = v.id; });

    const stmt = db.db.prepare(
      `INSERT INTO offshoots (id, mother_id, temp_code, seq_no, separation_date, weight_kg, diameter_cm, variety_id, status_id, origin_id, supplier, nursery_stage, planted_palm_id, is_opening_stock, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         mother_id = excluded.mother_id,
         temp_code = excluded.temp_code,
         variety_id = excluded.variety_id,
         status_id = excluded.status_id,
         origin_id = excluded.origin_id,
         supplier = excluded.supplier,
         nursery_stage = excluded.nursery_stage,
         planted_palm_id = excluded.planted_palm_id,
         is_opening_stock = excluded.is_opening_stock,
         notes = excluded.notes`
    );

    let count = 0;
    items.forEach(o => {
      const vName = String(o.variety || o.variety_name || 'خلاص');
      const varietyId = o.varietyId || varNameToId[vName] || 'cv1';
      const statusId = o.statusId || o.status_id || TreeHealthStatus.fromCode(o.health || o.health_status || o.statusCode || 'healthy');
      const originId = o.originId || o.origin_id || TreeOriginType.fromCode(o.originType || o.origin_type || (o.isOpeningStock ? 'purchase' : 'internal'));

      let motherId = null;
      const rawMother = o.motherId || o.mother_id;
      if (rawMother) {
        if (typeof rawMother === 'number') motherId = rawMother;
        else if (typeof rawMother === 'string') {
          if (/^\d+$/.test(rawMother)) motherId = parseInt(rawMother, 10);
          else {
            const found = db.get('SELECT id FROM palms WHERE code = ?', rawMother);
            if (found) motherId = found.id;
          }
        }
      }

      const isOpening = (o.isOpeningStock || o.is_opening_stock || !motherId) ? 1 : 0;

      stmt.run(
        o.id || `os_${Date.now()}_${count}`,
        motherId,
        o.tempCode || null,
        o.seq || null,
        o.date || new Date().toISOString().slice(0, 10),
        o.weight || null,
        o.diameter || null,
        varietyId,
        statusId,
        originId,
        o.supplier || '',
        o.nsStatus || o.nurseryStage || 'ready',
        o.newPalmId || null,
        isOpening,
        o.notes || ''
      );
      count++;
    });

    return sendJson(res, 201, {
      success: true,
      count,
      message: `تم تسجيل وتكويد ${count} فسيلة بنجاح في سجل المشتل وقاعدة البيانات`
    });
  }

  // 5.2 Link Offshoot to Planted Palm
  if (pathname.startsWith('/api/offshoots/')) {
    const plantMatch = pathname.match(/^\/api\/offshoots\/([^/]+)\/plant$/);
    if (plantMatch && method === 'POST') {
      const offshootId = decodeURIComponent(plantMatch[1]);
      const body = await parseBody(req);
      let palmId = body.palmId || body.plantedPalmId || body.palm_id || null;
      if (typeof palmId === 'string' && !/^\d+$/.test(palmId)) {
        const pRow = db.get('SELECT id FROM palms WHERE code = ?', palmId);
        if (pRow) palmId = pRow.id;
      }
      db.run(
        "UPDATE offshoots SET planted_palm_id = ?, nursery_stage = 'planted' WHERE id = ?",
        palmId, offshootId
      );
      return sendJson(res, 200, { success: true, message: 'تم ربط الفسيلة بالشجرة المزروعة بنجاح' });
    }

    const receiveMatch = pathname.match(/^\/api\/offshoots\/([^/]+)\/receive$/);
    if (receiveMatch && method === 'POST') {
      const offshootId = decodeURIComponent(receiveMatch[1]);
      try {
        db.run(
          "UPDATE offshoots SET nursery_stage = 'rooting' WHERE id = ?",
          offshootId
        );
      } catch (e) {}
      return sendJson(res, 200, { success: true, message: 'تم اعتماد استلام الفسيلة بالمشتل بنجاح' });
    }
  }

  return NEXT;
};
