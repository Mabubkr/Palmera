// Routes: Crops, planting sources, nursery prep types, inventory reset
const db = require('../db');
const { sendJson, parseBody } = require('../lib/http');

const NEXT = Symbol.for('palmtrace.next-route');

// Returns NEXT when no route in this module matched the request.
module.exports = async function cropsRoutes(req, res, { method, pathname, url }) {
  // 3.4 Crops & Planting Sources API
  if (pathname === '/api/crops') {
    if (method === 'GET') {
      const crops = db.all('SELECT code as id, id as numericId, code, name, single_label as single, plural_label as plural, offspring_label as offspring, code_prefix as codePrefix, primary_source_code as primarySourceCode, yield_name, yield_name as yieldName, unit, icon, notes, active FROM crops ORDER BY id ASC');
      const sources = db.all('SELECT id, crop_id as cropId, name, code_letter as codeLetter, code_letter as code, is_default as isDefault FROM crop_planting_sources ORDER BY is_default DESC, id ASC');
      crops.forEach(c => {
        c.active = Boolean(c.active);
        const cSources = sources.filter(s => s.cropId === c.code || s.cropId === String(c.numericId));
        c.sources = cSources.map(s => ({ code: s.codeLetter, name: s.name, isDefault: Boolean(s.isDefault) }));
      });
      return sendJson(res, 200, crops);
    }
  }

  if (pathname.startsWith('/api/crops/') && pathname.endsWith('/sources')) {
    const parts = pathname.split('/');
    const cropIdentifier = parts[3];
    if (method === 'GET') {
      const sources = db.all(
        `SELECT cps.id, cps.crop_id as cropId, cps.name, cps.code_letter as codeLetter, cps.code_letter as code, cps.is_default as isDefault
         FROM crop_planting_sources cps
         LEFT JOIN crops c ON (cps.crop_id = c.code OR cps.crop_id = CAST(c.id AS TEXT))
         WHERE cps.crop_id = ? OR c.code = ? OR CAST(c.id AS TEXT) = ?
         ORDER BY cps.is_default DESC, cps.id ASC`,
        cropIdentifier, cropIdentifier, cropIdentifier
      );
      return sendJson(res, 200, sources);
    }
    if (method === 'POST') {
      const body = await parseBody(req);
      const name = (body.name || '').trim();
      const codeLetter = (body.code_letter || body.codeLetter || body.code || '').trim().toUpperCase();
      const id = body.id || `cps_${cropIdentifier}_${codeLetter.toLowerCase()}`;
      const isDefault = (body.is_default || body.isDefault) ? 1 : 0;
      if (!name || !codeLetter) {
        return sendJson(res, 400, { error: 'الاسم وحرف الكود مطلوبان' });
      }
      if (isDefault) {
        db.run("UPDATE crop_planting_sources SET is_default = 0 WHERE crop_id = ?", cropIdentifier);
      }
      db.run(
        `INSERT INTO crop_planting_sources (id, crop_id, name, code_letter, is_default)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(crop_id, code_letter) DO UPDATE SET name = excluded.name, is_default = excluded.is_default`,
        id, cropIdentifier, name, codeLetter, isDefault
      );
      return sendJson(res, 200, { success: true, message: 'تم حفظ مصدر الزراعة بنجاح' });
    }
  }

  if (pathname.startsWith('/api/crops/') && !pathname.endsWith('/sources')) {
    const cropPart = decodeURIComponent(pathname.replace('/api/crops/', ''));
    if (cropPart.endsWith('/toggle') && method === 'POST') {
      const cCode = cropPart.replace('/toggle', '');
      const cRow = db.get('SELECT * FROM crops WHERE code = ? OR CAST(id AS TEXT) = ?', cCode, cCode);
      if (!cRow) return sendJson(res, 404, { error: 'المحصول غير موجود' });
      const body = await parseBody(req);
      const newActive = (body.active !== undefined) ? (body.active ? 1 : 0) : (cRow.active ? 0 : 1);
      db.run('UPDATE crops SET active = ? WHERE id = ?', newActive, cRow.id);
      return sendJson(res, 200, { success: true, active: Boolean(newActive), message: newActive ? 'تم تنشيط المحصول' : 'تم تعطيل المحصول' });
    }
    if (method === 'PUT') {
      const cRow = db.get('SELECT * FROM crops WHERE code = ? OR CAST(id AS TEXT) = ?', cropPart, cropPart);
      if (!cRow) return sendJson(res, 404, { error: 'المحصول غير موجود' });
      const body = await parseBody(req);
      const name = (body.name !== undefined) ? body.name : cRow.name;
      const single = (body.single !== undefined) ? body.single : (body.single_label !== undefined ? body.single_label : cRow.single_label);
      const plural = (body.plural !== undefined) ? body.plural : (body.plural_label !== undefined ? body.plural_label : cRow.plural_label);
      const offspring = (body.offspring !== undefined) ? body.offspring : (body.offspring_label !== undefined ? body.offspring_label : cRow.offspring_label);
      const prefix = (body.codePrefix !== undefined) ? body.codePrefix : (body.code_prefix !== undefined ? body.code_prefix : cRow.code_prefix);
      const primarySource = (body.primarySourceCode !== undefined) ? body.primarySourceCode : (body.primary_source_code !== undefined ? body.primary_source_code : cRow.primary_source_code);
      const yieldName = (body.yieldName !== undefined) ? body.yieldName : (body.yield_name !== undefined ? body.yield_name : cRow.yield_name);
      const unit = (body.unit !== undefined) ? body.unit : cRow.unit;
      const icon = (body.icon !== undefined) ? body.icon : cRow.icon;
      const notes = (body.notes !== undefined) ? body.notes : cRow.notes;
      const active = (body.active !== undefined) ? (body.active ? 1 : 0) : cRow.active;

      db.run(`
        UPDATE crops SET 
          name = ?, single_label = ?, plural_label = ?, offspring_label = ?,
          code_prefix = ?, primary_source_code = ?, yield_name = ?, unit = ?,
          icon = ?, notes = ?, active = ?
        WHERE id = ?
      `, name, single, plural, offspring, prefix, primarySource, yieldName, unit, icon, notes, active, cRow.id);

      return sendJson(res, 200, { success: true, message: 'تم حفظ تعديلات المحصول بنجاح' });
    }
  }

  // 3.4.1 Nursery Prep Types API
  if (pathname === '/api/nursery-preps') {
    if (method === 'GET') {
      const preps = db.all('SELECT id, name, crop_id as cropId, source_code as sourceCode, active, sort_order as sortOrder FROM nursery_prep_types ORDER BY sort_order ASC, id ASC');
      preps.forEach(p => { p.active = Boolean(p.active); });
      return sendJson(res, 200, preps);
    }
    if (method === 'POST') {
      const body = await parseBody(req);
      const name = (body.name || '').trim();
      if (!name) return sendJson(res, 400, { error: 'اسم النشاط مطلوب' });
      const id = body.id || `np_${Date.now()}`;
      const cropId = body.cropId || body.crop_id || 'all';
      const sourceCode = body.sourceCode || body.source_code || 'all';
      const active = (body.active !== undefined) ? (body.active ? 1 : 0) : 1;
      const maxSort = db.get('SELECT MAX(sort_order) as m FROM nursery_prep_types');
      const sortOrder = (maxSort && maxSort.m) ? maxSort.m + 1 : 1;
      db.run(
        `INSERT INTO nursery_prep_types (id, name, crop_id, source_code, active, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, crop_id=excluded.crop_id, source_code=excluded.source_code, active=excluded.active`,
        id, name, cropId, sourceCode, active, sortOrder
      );
      return sendJson(res, 201, { success: true, id, message: 'تم حفظ نشاط المشتل' });
    }
  }

  if (pathname.startsWith('/api/nursery-preps/')) {
    const prepId = decodeURIComponent(pathname.replace('/api/nursery-preps/', ''));
    if (prepId.endsWith('/toggle') && method === 'POST') {
      const pId = prepId.replace('/toggle', '');
      const pRow = db.get('SELECT * FROM nursery_prep_types WHERE id = ?', pId);
      if (!pRow) return sendJson(res, 404, { error: 'النشاط غير موجود' });
      const body = await parseBody(req);
      const newActive = (body.active !== undefined) ? (body.active ? 1 : 0) : (pRow.active ? 0 : 1);
      db.run('UPDATE nursery_prep_types SET active = ? WHERE id = ?', newActive, pRow.id);
      return sendJson(res, 200, { success: true, active: Boolean(newActive), message: newActive ? 'تم تنشيط النشاط' : 'تم تعطيل النشاط' });
    }
    if (method === 'PUT') {
      const pRow = db.get('SELECT * FROM nursery_prep_types WHERE id = ?', prepId);
      if (!pRow) return sendJson(res, 404, { error: 'النشاط غير موجود' });
      const body = await parseBody(req);
      const name = (body.name !== undefined) ? String(body.name).trim() : pRow.name;
      const cropId = body.cropId || body.crop_id || pRow.crop_id;
      const sourceCode = body.sourceCode || body.source_code || pRow.source_code;
      const active = (body.active !== undefined) ? (body.active ? 1 : 0) : pRow.active;
      db.run('UPDATE nursery_prep_types SET name = ?, crop_id = ?, source_code = ?, active = ? WHERE id = ?', name, cropId, sourceCode, active, pRow.id);
      return sendJson(res, 200, { success: true, message: 'تم تحديث نشاط المشتل' });
    }
    if (method === 'DELETE') {
      db.run('DELETE FROM nursery_prep_types WHERE id = ?', prepId);
      return sendJson(res, 200, { success: true, message: 'تم حذف نشاط المشتل' });
    }
  }

  // Admin inventory reset endpoint
  if (pathname === '/api/admin/reset-inventory' && method === 'POST') {
    try {
      db.exec('PRAGMA foreign_keys = OFF;');
      const tables = [
        'palms', 'offshoots', 'plots', 'sectors', 'yields',
        'operations', 'operation_materials', 'tree_notes',
        'contract_plots', 'contract_service_invoices', 'zakat_records',
        'fertilizer_season_balances', 'plot_summaries', 'user_plots'
      ];
      tables.forEach(tbl => {
        try {
          db.exec(`DELETE FROM ${tbl};`);
          try { db.exec(`DELETE FROM sqlite_sequence WHERE name = '${tbl}';`); } catch {}
        } catch (e) {
          console.warn(`Reset warning on ${tbl}:`, e.message);
        }
      });
      db.exec('UPDATE investment_contracts SET total_trees = 0, total_area = 0;');
      db.exec('PRAGMA foreign_keys = ON;');
      db.exec('VACUUM;');
      return sendJson(res, 200, { success: true, message: 'تم تفريغ كافة بيانات المزرعة التشغيلية بنجاح والبدء من جديد مع الحفاظ على المستخدمين' });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  return NEXT;
};
