// Routes: Yields, charities, zakat
const db = require('../db');
const access = require('../access');
const { YieldQualityGrade } = require('../enums');
const { sendJson, parseBody } = require('../lib/http');
const { zakatStatusId, zakatCropId } = require('../lib/helpers');
const { buildBootstrapPayload, getCachedBootstrapData } = require('../lib/bootstrap');

const NEXT = Symbol.for('palmtrace.next-route');

// Returns NEXT when no route in this module matched the request.
module.exports = async function harvestRoutes(req, res, { method, pathname, url }) {
  // 8. Yields API
  if (pathname === '/api/yields') {
    if (method === 'GET') {
      const yields = db.all(`
        SELECT 
          id, batch_no as batchNo, harvest_level as harvestLevel, palm_id as palmId, palm_code as palmCode,
          plot_id as plotId, plot_name as plotName, sector_id as sectorId, sector_name as sectorName,
          season, harvest_date as harvestDate, harvest_date as date, crop_code as cropId, crop_id as cropNumericId, crop_name as cropName,
          variety_id as varietyId, variety_name as variety, quality_id as qualityId, quality_code as qualityCode,
          quality_grade as qualityGrade, quality_badge_color as qualityBadgeColor,
          kg_total as kg, kg_total as kgTotal, kg_excellent as kgEx, kg_good as kgGd, kg_low as kgBad,
          boxes_count as boxes, boxes_count as boxesCount, recorded_by as recordedBy, recorded_by as by, recorded_by_name as recordedByName, recorded_by_name as byName,
          notes, created_at as createdAt
        FROM v_yields ORDER BY harvest_date DESC
      `);
      return sendJson(res, 200, yields);
    }
    if (method === 'POST') {
      const y = await parseBody(req);
      const cropsList = db.all('SELECT id, code FROM crops');
      const cropCodeToId = {};
      cropsList.forEach(c => { cropCodeToId[c.code] = c.id; });
      const numericCropId = cropCodeToId[y.cropId || y.crop_id] || (typeof y.cropId === 'number' ? y.cropId : 1);

      const allVars = db.all('SELECT id, name FROM crop_varieties');
      const varNameToId = {};
      allVars.forEach(v => { varNameToId[v.name] = v.id; });
      const vName = String(y.variety || y.variety_name || '');
      let varietyId = y.varietyId || varNameToId[vName] || (allVars[0] ? allVars[0].id : 'cv1');

      const qualityId = y.qualityId || y.quality_id || YieldQualityGrade.fromCode(y.quality || y.quality_grade || y.qualityCode || 'grade_a');

      let plotId = Array.isArray(y.plotIds) ? y.plotIds.join(', ') : String(y.plotId || '');
      let sectorId = String(y.sectorId || y.sector_id || '');
      if (!sectorId && plotId) {
        const firstPlot = plotId.split(/[,،\s]+/)[0].trim();
        const pl = db.get('SELECT sector_id FROM plots WHERE id = ?', firstPlot);
        if (pl) sectorId = pl.sector_id;
      }

      let recordedBy = y.by || y.recorded_by || 'u1';
      const userExists = db.get('SELECT id FROM users WHERE id = ?', recordedBy);
      if (!userExists) recordedBy = 'u1';

      let palmId = y.palmId || y.palm_id || null;
      if (palmId) {
        const p = db.get('SELECT id FROM palms WHERE id = ? OR code = ?', palmId, palmId);
        palmId = p ? p.id : null;
      }

      try {
        db.run(
          `INSERT INTO yields (id, batch_no, harvest_level, palm_id, plot_id, sector_id, season, harvest_date, crop_id, variety_id, kg_total, kg_excellent, kg_good, kg_low, boxes_count, quality_id, recorded_by, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             batch_no = excluded.batch_no,
             harvest_level = excluded.harvest_level,
             palm_id = excluded.palm_id,
             plot_id = excluded.plot_id,
             sector_id = excluded.sector_id,
             season = excluded.season,
             harvest_date = excluded.harvest_date,
             crop_id = excluded.crop_id,
             variety_id = excluded.variety_id,
             kg_total = excluded.kg_total,
             kg_excellent = excluded.kg_excellent,
             kg_good = excluded.kg_good,
             kg_low = excluded.kg_low,
             boxes_count = excluded.boxes_count,
             quality_id = excluded.quality_id,
             recorded_by = excluded.recorded_by,
             notes = excluded.notes`,
          y.id || `y_${Date.now()}`,
          y.batch || y.batch_no || `BATCH-${Date.now()}`,
          y.level || y.harvest_level || 'plot',
          palmId,
          plotId,
          sectorId,
          String(y.season || new Date().getFullYear()),
          y.date || y.harvest_date || new Date().toISOString().slice(0, 10),
          numericCropId,
          varietyId,
          parseFloat(y.kg || y.kg_total || 0),
          parseFloat(y.kgEx || y.kg_excellent || 0),
          parseFloat(y.kgGd || y.kg_good || 0),
          parseFloat(y.kgBad || y.kg_low || 0),
          parseInt(y.boxes || y.boxes_count || 0, 10),
          qualityId,
          recordedBy,
          y.notes || ''
        );
        return sendJson(res, 201, { success: true, message: 'تم حفظ شحنة الحصاد في قاعدة البيانات بنجاح' });
      } catch (dbErr) {
        console.error('Error inserting yield:', dbErr);
        return sendJson(res, 500, { error: 'تعذر حفظ شحنة الحصاد في قاعدة البيانات: ' + dbErr.message });
      }
    }
  }

  if (pathname.startsWith('/api/yields/')) {
    const yieldId = decodeURIComponent(pathname.replace('/api/yields/', ''));
    if (method === 'DELETE') {
      db.run('DELETE FROM yields WHERE id = ?', yieldId);
      return sendJson(res, 200, { success: true, message: 'تم حذف شحنة الحصاد بنجاح' });
    }
    if (method === 'PUT' || method === 'PATCH') {
      const body = await parseBody(req);
      db.run(
        `UPDATE yields SET 
          kg_total = COALESCE(?, kg_total),
          kg_excellent = COALESCE(?, kg_excellent),
          kg_good = COALESCE(?, kg_good),
          kg_low = COALESCE(?, kg_low),
          season = COALESCE(?, season),
          harvest_date = COALESCE(?, harvest_date)
         WHERE id = ?`,
        body.kg !== undefined ? parseFloat(body.kg) : null,
        body.kgEx !== undefined ? parseFloat(body.kgEx) : null,
        body.kgGd !== undefined ? parseFloat(body.kgGd) : null,
        body.kgBad !== undefined ? parseFloat(body.kgBad) : null,
        body.season ? String(body.season) : null,
        body.date || body.harvestDate || null,
        yieldId
      );
      return sendJson(res, 200, { success: true, message: 'تم تعديل شحنة الحصاد بنجاح' });
    }
  }

  // 9. Charities API
  if (pathname === '/api/charities') {
    if (method === 'GET') {
      const charities = db.all('SELECT * FROM charities ORDER BY name ASC');
      return sendJson(res, 200, charities);
    }
    if (method === 'POST') {
      const c = await parseBody(req);
      db.run(
        `INSERT INTO charities (id, name, license_no, city, address, contact_person, phone, email, receive_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        c.id || `c_${Date.now()}`,
        c.name,
        c.licenseNo || c.license_no || '',
        c.city || '',
        c.address || '',
        c.contactPerson || c.contact_person || '',
        c.phone || '',
        c.email || '',
        c.receive || c.receive_type || 'both'
      );
      return sendJson(res, 201, { success: true, message: 'تمت إضافة الجمعية الخيرية' });
    }
  }

  // 10. Zakat Records API
  if (pathname === '/api/zakat' || pathname.startsWith('/api/zakat/')) {
    if (method === 'GET') {
      return sendJson(res, 200, (getCachedBootstrapData() || buildBootstrapPayload()).zakat);
    }
    if (method === 'POST') {
      // Accepts one record or { records: [...] }. The full app-side record is kept in `payload`
      // (it has more fields than the table), key fields are mirrored into columns for reporting.
      const body = await parseBody(req);
      const list = Array.isArray(body.records) ? body.records : [body];
      const savedIds = [];
      const skipped = [];
      for (const z of list) {
        const investorId = z.investorId || z.investor_id;
        if (!z || !investorId) { skipped.push(z && z.id); continue; }
        if (!access.canTouchZakat(req.authUser, investorId, z.id)) { skipped.push(z.id); continue; }
        const id = z.id || `z_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        db.run(
          `INSERT INTO zakat_records (id, investor_id, season, crop_id, due_kg, due_amount, choice_type, charity_id, status_id, pledge_status, pledge_signed_at, pledge_doc_type, journey_stage, batch_id, receipt_no, payload, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(id) DO UPDATE SET
             season = excluded.season, crop_id = excluded.crop_id,
             due_kg = excluded.due_kg, due_amount = excluded.due_amount,
             choice_type = excluded.choice_type, charity_id = excluded.charity_id,
             status_id = excluded.status_id, pledge_status = excluded.pledge_status,
             pledge_signed_at = excluded.pledge_signed_at, pledge_doc_type = excluded.pledge_doc_type,
             journey_stage = excluded.journey_stage, batch_id = excluded.batch_id,
             receipt_no = excluded.receipt_no, payload = excluded.payload, updated_at = CURRENT_TIMESTAMP`,
          id,
          investorId,
          String(z.season || new Date().getFullYear()),
          zakatCropId(z.cropId || z.crop_id),
          parseFloat(z.dueKg || z.due_kg || 0) || 0,
          parseFloat(z.amount || z.due_amount || 0) || 0,
          z.choice || z.choice_type || 'in_kind',
          (z.charityId || z.charity_id) && db.get('SELECT id FROM charities WHERE id = ?', z.charityId || z.charity_id) ? (z.charityId || z.charity_id) : null,
          zakatStatusId(z.status) || 1,
          z.pledgeStatus || z.pledge_status || 'pending',
          z.pledgeSignedAt || z.pledge_signed_at || null,
          z.pledgeDocType || null,
          z.journeyStage || z.journey_stage || 'calculated',
          z.batchId || z.batch_id || null,
          z.receiptNo || null,
          JSON.stringify({ ...z, id })
        );
        savedIds.push(id);
      }
      return sendJson(res, 201, { success: true, savedIds, skipped, message: 'تم حفظ سجل الزكاة في قاعدة البيانات' });
    }
    if (method === 'PUT') {
      const idFromUrl = pathname.replace('/api/zakat/', '');
      const z = await parseBody(req);
      const targetId = z.id || idFromUrl;
      if (!access.canTouchZakat(req.authUser, undefined, targetId)) {
        return sendJson(res, 403, { error: 'لا يمكنك تعديل سجل زكاة مستثمر آخر' });
      }
      if (targetId) {
        db.run(
          `UPDATE zakat_records SET status_id = COALESCE(?, status_id), pledge_status = COALESCE(?, pledge_status), journey_stage = COALESCE(?, journey_stage) WHERE id = ?`,
          zakatStatusId(z.status), z.pledgeStatus || null, z.journeyStage || null, targetId
        );
        return sendJson(res, 200, { success: true, message: 'تم تحديث سجل الزكاة' });
      }
    }
  }

  return NEXT;
};
