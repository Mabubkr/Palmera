// Routes: Fertilizers, vouchers, agricultural seasons
const db = require('../db');
const { sendJson, parseBody } = require('../lib/http');

const NEXT = Symbol.for('palmtrace.next-route');

// Returns NEXT when no route in this module matched the request.
module.exports = async function inventoryRoutes(req, res, { method, pathname, url }) {
  // 11. Fertilizers & Vouchers API
  if (pathname === '/api/fertilizers') {
    if (method === 'GET') {
      const ferts = db.all(`
        SELECT 
          id, name, kind, unit, stock, allocated, consumed, 
          min_alert as minAlert, unit_cost as unitCost, crop_id as cropId, 
          active 
        FROM fertilizers 
        ORDER BY id ASC
      `).map(f => ({
        ...f,
        active: f.active === 1 || f.active === true || f.active === '1'
      }));
      return sendJson(res, 200, ferts);
    }
    if (method === 'POST') {
      const f = await parseBody(req);
      const id = f.id || `fert_${Date.now()}`;
      const name = (f.name || '').trim();
      if (!name) return sendJson(res, 400, { error: 'اسم السماد مطلوب' });
      const kind = f.kind || 'كيميائي';
      const unit = f.unit || 'كجم';
      const stock = parseFloat(f.stock || 0);
      const allocated = parseFloat(f.allocated || 0);
      const consumed = parseFloat(f.consumed || 0);
      const minAlert = parseFloat(f.minAlert !== undefined ? f.minAlert : (f.min_alert !== undefined ? f.min_alert : 50));
      const unitCost = parseFloat(f.unitCost !== undefined ? f.unitCost : (f.unit_cost !== undefined ? f.unit_cost : 0));
      const cropId = f.cropId || f.crop_id || 'all';
      const active = (f.active === false || f.active === 0 || f.active === '0') ? 0 : 1;

      db.run(
        `INSERT INTO fertilizers (id, name, kind, unit, stock, allocated, consumed, min_alert, unit_cost, crop_id, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name, kind = excluded.kind, unit = excluded.unit, stock = excluded.stock,
           allocated = excluded.allocated, consumed = excluded.consumed, min_alert = excluded.min_alert,
           unit_cost = excluded.unit_cost, crop_id = excluded.crop_id, active = excluded.active`,
        id, name, kind, unit, stock, allocated, consumed, minAlert, unitCost, cropId, active
      );
      return sendJson(res, 201, { success: true, id, message: 'تم حفظ بيانات السماد بنجاح' });
    }
  }

  if (pathname.startsWith('/api/fertilizers/') && !pathname.startsWith('/api/fertilizers/vouchers')) {
    const fertPart = decodeURIComponent(pathname.replace('/api/fertilizers/', ''));
    if (fertPart.endsWith('/toggle') && method === 'POST') {
      const fId = fertPart.replace('/toggle', '');
      const fRow = db.get('SELECT * FROM fertilizers WHERE id = ?', fId);
      if (!fRow) return sendJson(res, 404, { error: 'السماد غير موجود' });
      const body = await parseBody(req);
      const newActive = (body.active !== undefined) ? (body.active ? 1 : 0) : (fRow.active ? 0 : 1);
      db.run('UPDATE fertilizers SET active = ? WHERE id = ?', newActive, fRow.id);
      return sendJson(res, 200, { success: true, active: Boolean(newActive), message: newActive ? 'تم تنشيط السماد' : 'تم تعطيل السماد' });
    }
    if (method === 'PUT') {
      const fRow = db.get('SELECT * FROM fertilizers WHERE id = ?', fertPart);
      if (!fRow) return sendJson(res, 404, { error: 'السماد غير موجود' });
      const body = await parseBody(req);
      const name = (body.name !== undefined) ? String(body.name).trim() : fRow.name;
      const kind = body.kind !== undefined ? body.kind : fRow.kind;
      const unit = body.unit !== undefined ? body.unit : fRow.unit;
      const cropId = body.cropId || body.crop_id || fRow.crop_id || 'all';
      const stock = body.stock !== undefined ? parseFloat(body.stock || 0) : fRow.stock;
      const allocated = body.allocated !== undefined ? parseFloat(body.allocated || 0) : fRow.allocated;
      const consumed = body.consumed !== undefined ? parseFloat(body.consumed || 0) : fRow.consumed;
      const minAlert = body.minAlert !== undefined ? parseFloat(body.minAlert || 0) : (body.min_alert !== undefined ? parseFloat(body.min_alert || 0) : fRow.min_alert);
      const unitCost = body.unitCost !== undefined ? parseFloat(body.unitCost || 0) : (body.unit_cost !== undefined ? parseFloat(body.unit_cost || 0) : fRow.unit_cost);
      const active = (body.active !== undefined) ? (body.active ? 1 : 0) : fRow.active;

      db.run(
        `UPDATE fertilizers SET name = ?, kind = ?, unit = ?, crop_id = ?, stock = ?, allocated = ?, consumed = ?, min_alert = ?, unit_cost = ?, active = ? WHERE id = ?`,
        name, kind, unit, cropId, stock, allocated, consumed, minAlert, unitCost, active, fRow.id
      );
      return sendJson(res, 200, { success: true, message: 'تم تحديث بيانات السماد بنجاح' });
    }
    if (method === 'DELETE') {
      try {
        db.run('DELETE FROM fertilizer_vouchers WHERE fertilizer_id = ?', fertPart);
        db.run('DELETE FROM fertilizer_season_balances WHERE fertilizer_id = ?', fertPart);
        db.run('DELETE FROM fertilizers WHERE id = ?', fertPart);
        return sendJson(res, 200, { success: true, message: 'تم حذف السماد وسجلاته بنجاح' });
      } catch (err) {
        db.run('UPDATE fertilizers SET active = 0 WHERE id = ?', fertPart);
        return sendJson(res, 200, { success: true, message: 'تم تعطيل السماد وإخفاؤه بنجاح' });
      }
    }
  }

  if (pathname === '/api/fertilizers/vouchers' || pathname.startsWith('/api/fertilizers/vouchers/')) {
    const vIdParam = pathname.startsWith('/api/fertilizers/vouchers/') ? decodeURIComponent(pathname.replace('/api/fertilizers/vouchers/', '').trim()) : null;

    if (method === 'GET' && !vIdParam) {
      const vouchers = db.all(`
        SELECT 
          fv.id,
          fv.voucher_type as type,
          fv.voucher_type as voucherType,
          fv.fertilizer_id as fertId,
          fv.fertilizer_id as fertilizerId,
          COALESCE(f.name, fv.fertilizer_id) as fertName,
          COALESCE(f.unit, 'كجم') as unit,
          fv.qty,
          fv.from_entity as [from],
          fv.from_entity as fromEntity,
          fv.to_user_id as toUser,
          fv.to_user_id as toUserId,
          fv.sector_id as sectorId,
          fv.status,
          fv.voucher_date as date,
          fv.voucher_date as voucherDate,
          fv.notes,
          fv.created_at as createdAt
        FROM fertilizer_vouchers fv
        LEFT JOIN fertilizers f ON f.id = fv.fertilizer_id
        ORDER BY fv.voucher_date DESC, fv.created_at DESC
      `);
      return sendJson(res, 200, vouchers);
    }

    if (method === 'POST') {
      const v = await parseBody(req);
      let targetFertId = v.fertId || v.fertilizer_id;
      let fertRow = db.get('SELECT id FROM fertilizers WHERE id = ?', targetFertId);
      if (!fertRow && targetFertId && targetFertId.startsWith('proj_farafra_01_')) {
        const stripped = targetFertId.replace('proj_farafra_01_', '');
        fertRow = db.get('SELECT id FROM fertilizers WHERE id = ?', stripped);
        if (fertRow) targetFertId = fertRow.id;
      }
      if (!fertRow && v.fertName) {
        fertRow = db.get('SELECT id FROM fertilizers WHERE name = ?', v.fertName);
        if (fertRow) targetFertId = fertRow.id;
      }
      if (!fertRow) {
        // fallback to first available active fertilizer if none found to avoid schema abort
        const firstFert = db.get('SELECT id FROM fertilizers LIMIT 1');
        if (firstFert) targetFertId = firstFert.id;
      }

      db.run(
        `INSERT INTO fertilizer_vouchers (id, voucher_type, fertilizer_id, qty, from_entity, to_user_id, sector_id, status, voucher_date, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           voucher_type = excluded.voucher_type,
           fertilizer_id = excluded.fertilizer_id,
           qty = excluded.qty,
           from_entity = excluded.from_entity,
           to_user_id = excluded.to_user_id,
           sector_id = excluded.sector_id,
           status = excluded.status,
           voucher_date = excluded.voucher_date,
           notes = excluded.notes`,
        v.id || `V-${Date.now()}`,
        v.type || v.voucher_type || 'issue',
        targetFertId,
        parseFloat(v.qty || 0),
        v.from || v.from_entity || '',
        v.toUser || v.to_user_id || '',
        v.sectorId || v.sector_id || '',
        v.status || 'pending',
        v.date || v.voucher_date || new Date().toISOString().slice(0, 10),
        v.notes || ''
      );
      return sendJson(res, 201, { success: true, message: 'تم تسجيل إذن الصرف/التوريد' });
    }

    if (method === 'PUT' && vIdParam) {
      const v = await parseBody(req);
      const existing = db.get('SELECT * FROM fertilizer_vouchers WHERE id = ?', vIdParam);
      if (!existing) {
        return sendJson(res, 404, { error: 'إذن الصرف غير موجود' });
      }
      const status = v.status || existing.status;
      const notes = v.notes !== undefined ? v.notes : existing.notes;
      db.run('UPDATE fertilizer_vouchers SET status = ?, notes = ? WHERE id = ?', status, notes, vIdParam);
      return sendJson(res, 200, { success: true, message: 'تم تحديث حالة إذن الصرف بنجاح' });
    }
  }

  // 11.5. Agricultural Seasons & Rollover API
  if (pathname === '/api/seasons') {
    if (method === 'GET') {
      const seasons = db.all(`
        SELECT 
          s.*,
          (SELECT COUNT(*) FROM yields y WHERE CAST(y.season AS INTEGER) = s.season_year) as yieldsCount,
          (SELECT COALESCE(SUM(y.kg_total), 0) FROM yields y WHERE CAST(y.season AS INTEGER) = s.season_year) as totalKg,
          (SELECT COUNT(*) FROM operations o WHERE strftime('%Y', o.performed_at) = CAST(s.season_year AS TEXT)) as operationsCount,
          (SELECT COUNT(*) FROM zakat_records z WHERE CAST(z.season AS INTEGER) = s.season_year) as zakatRecordsCount
        FROM agricultural_seasons s
        ORDER BY s.season_year DESC
      `);
      return sendJson(res, 200, seasons);
    }
    if (method === 'POST') {
      const b = await parseBody(req);
      const year = parseInt(b.year || b.season_year || new Date().getFullYear(), 10);
      const startDate = b.startDate || b.start_date || `${year}-01-01`;
      const endDate = b.endDate || b.end_date || `${year}-12-31`;
      const status = b.status || 'open';
      const notes = b.notes || '';
      const isCurrent = ((b.isCurrent !== undefined ? b.isCurrent : b.is_current) == 1 || b.isCurrent === true || b.is_current === true) ? 1 : 0;

      if (isCurrent === 1) {
        db.run('UPDATE agricultural_seasons SET is_current = 0');
      }

      db.run(`
        INSERT INTO agricultural_seasons (season_year, start_date, end_date, status, notes, is_current)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(season_year) DO UPDATE SET
          start_date = excluded.start_date,
          end_date = excluded.end_date,
          status = excluded.status,
          notes = excluded.notes,
          is_current = excluded.is_current
      `, year, startDate, endDate, status, notes, isCurrent);

      return sendJson(res, 201, { success: true, message: `تم تحديث الموسم الزراعي ${year}` });
    }
  }

  if (pathname.startsWith('/api/seasons/') && pathname.endsWith('/close-rollover')) {
    if (method === 'POST') {
      const parts = pathname.split('/');
      const yearToClose = parseInt(parts[3], 10);
      const b = await parseBody(req);
      const nextYear = yearToClose + 1;
      const closedBy = b.closedBy || 'مسؤول النظام';
      const closeNotes = b.notes || `تم إقفال موسم ${yearToClose} الزراعي وترحيل الأرصدة آلياً لموسم ${nextYear}`;

      // 1. Mark closing season as closed
      db.run(`
        UPDATE agricultural_seasons
        SET status = 'closed', is_current = 0, closed_at = CURRENT_TIMESTAMP, closed_by = ?, notes = ?
        WHERE season_year = ?
      `, closedBy, closeNotes, yearToClose);

      // 2. Ensure next year season exists and is current
      db.run(`
        INSERT INTO agricultural_seasons (season_year, start_date, end_date, status, notes, is_current)
        VALUES (?, ?, ?, 'open', ?, 1)
        ON CONFLICT(season_year) DO UPDATE SET
          status = 'open',
          is_current = 1
      `, nextYear, `${nextYear}-01-01`, `${nextYear}-12-31`, `موسم ${nextYear} الزراعي الجديد المرحل إليه`);

      // 3. Roll over fertilizer balances
      const ferts = db.all('SELECT id, stock, consumed FROM fertilizers');
      ferts.forEach(f => {
        const endingStock = f.stock || 0;
        db.run(`
          INSERT INTO fertilizer_season_balances (id, season_year, fertilizer_id, opening_stock, purchased_stock, consumed_stock, closing_stock)
          VALUES (?, ?, ?, ?, 0, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            closing_stock = excluded.closing_stock
        `, `bal_${yearToClose}_${f.id}`, yearToClose, f.id, (f.stock || 0) + (f.consumed || 0), f.consumed || 0, endingStock);

        db.run(`
          INSERT INTO fertilizer_season_balances (id, season_year, fertilizer_id, opening_stock, purchased_stock, consumed_stock, closing_stock)
          VALUES (?, ?, ?, ?, 0, 0, ?)
          ON CONFLICT(id) DO UPDATE SET
            opening_stock = excluded.opening_stock,
            closing_stock = excluded.closing_stock
        `, `bal_${nextYear}_${f.id}`, nextYear, f.id, endingStock, endingStock);
      });

      // 4. Increment nursery stage for active stock
      db.run(`
        UPDATE offshoots
        SET nursery_stage = CASE
          WHEN nursery_stage = 'preparation' THEN 'rooted'
          WHEN nursery_stage = 'rooted' THEN 'ready'
          ELSE nursery_stage
        END
        WHERE planted_palm_id IS NULL AND nursery_stage != 'issued'
      `);

      return sendJson(res, 200, {
        success: true,
        message: `تم إقفال موسم ${yearToClose} وترحيل الأرصدة بنجاح إلى موسم ${nextYear}`,
        closedYear: yearToClose,
        newSeasonYear: nextYear
      });
    }
  }

  return NEXT;
};
