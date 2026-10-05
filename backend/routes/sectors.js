// Routes: Sectors, plot coordinates, plots Excel template/import
const XLSX = require('xlsx');
const db = require('../db');
const { generatePlotsTemplateBuffer, processPlotRows } = require('../plots_gis_handler');
const { normalizeSectorCode, normalizePlotCode } = require('../code_normalizer');
const { sendJson, parseBody, parseRawBuffer } = require('../lib/http');
const { logAudit } = require('../lib/helpers');

const NEXT = Symbol.for('palmtrace.next-route');

// Returns NEXT when no route in this module matched the request.
module.exports = async function sectorsRoutes(req, res, { method, pathname, url }) {
  // 3.5 Sectors & Plots API
  if (pathname === '/api/sectors') {
    if (method === 'GET') {
      const sectors = db.all('SELECT id, name, notes, boundary_coordinates as boundaryCoordinates, total_area as totalArea, created_at FROM sectors WHERE (is_deleted = 0 OR is_deleted IS NULL) ORDER BY id ASC');
      sectors.forEach(s => {
        if (s.boundaryCoordinates && typeof s.boundaryCoordinates === 'string') {
          try { s.boundaryCoordinates = JSON.parse(s.boundaryCoordinates); } catch {}
        }
      });
      return sendJson(res, 200, sectors);
    }
    if (method === 'POST') {
      const sec = await parseBody(req);
      if (!sec.id || !sec.name) {
        return sendJson(res, 400, { error: 'بيانات القطاع غير مكتملة' });
      }
      db.run(
        `INSERT INTO sectors (id, name, notes, is_deleted) VALUES (?, ?, ?, 0)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, notes = excluded.notes, is_deleted = 0`,
        sec.id, sec.name, sec.notes || ''
      );
      return sendJson(res, 201, { success: true, message: 'تم حفظ القطاع بنجاح' });
    }
  }

  if (pathname.startsWith('/api/sectors/')) {
    const secImpactMatch = pathname.match(/^\/api\/sectors\/([^/]+)\/impact$/);
    if (secImpactMatch && method === 'GET') {
      const secId = decodeURIComponent(secImpactMatch[1]);
      const plotsCount = db.get('SELECT COUNT(*) as cnt FROM plots WHERE sector_id = ?', secId)?.cnt || 0;
      const palmsCount = db.get('SELECT COUNT(*) as cnt FROM palms WHERE sector_id = ?', secId)?.cnt || 0;
      return sendJson(res, 200, {
        success: true,
        sectorId: secId,
        plotsCount,
        palmsCount,
        canDelete: (plotsCount === 0 && palmsCount === 0)
      });
    }

    const secArchiveMatch = pathname.match(/^\/api\/sectors\/([^/]+)\/archive$/);
    if (secArchiveMatch && method === 'POST') {
      const secId = decodeURIComponent(secArchiveMatch[1]);
      db.run('UPDATE sectors SET is_deleted = 1 WHERE id = ?', secId);
      return sendJson(res, 200, { success: true, message: 'تمت أرشفة القطاع بنجاح' });
    }

    const secId = decodeURIComponent(pathname.replace('/api/sectors/', ''));
    if (method === 'PUT') {
      const body = await parseBody(req);
      let boundaryJson = body.boundaryCoordinates || body.boundary_coordinates;
      if (Array.isArray(boundaryJson)) boundaryJson = JSON.stringify(boundaryJson);
      const totalArea = (body.totalArea !== undefined || body.total_area !== undefined) ? Number(body.totalArea || body.total_area || 0) : null;

      if (totalArea !== null && boundaryJson !== undefined) {
        db.run('UPDATE sectors SET name = ?, notes = ?, total_area = ?, boundary_coordinates = ? WHERE id = ?', body.name, body.notes || '', totalArea, boundaryJson, secId);
      } else if (totalArea !== null) {
        db.run('UPDATE sectors SET name = ?, notes = ?, total_area = ? WHERE id = ?', body.name, body.notes || '', totalArea, secId);
      } else {
        db.run('UPDATE sectors SET name = ?, notes = ? WHERE id = ?', body.name, body.notes || '', secId);
      }

      logAudit(body.operatorId || 'admin', 'update', 'sector', secId, {
        name: body.name, totalArea, notes: body.notes
      });

      return sendJson(res, 200, { success: true, message: 'تم تحديث بيانات القطاع بنجاح' });
    }
    if (method === 'DELETE') {
      const normSecId = normalizeSectorCode(secId);
      db.run('DELETE FROM palms WHERE sector_id = ? OR sector_id = ?', secId, normSecId);
      db.run('DELETE FROM plots WHERE sector_id = ? OR sector_id = ?', secId, normSecId);
      db.run('DELETE FROM sectors WHERE id = ? OR id = ?', secId, normSecId);
      return sendJson(res, 200, { success: true, message: 'تم حذف القطاع وكافة قطعه وأصوله بنجاح' });
    }
  }

  // Clear Plot Coordinates Endpoint
  if (pathname.startsWith('/api/plots/') && pathname.endsWith('/clear-coordinates') && method === 'POST') {
    const plotId = decodeURIComponent(pathname.replace('/api/plots/', '').replace('/clear-coordinates', ''));
    const normPlotId = normalizePlotCode(plotId);
    db.run("UPDATE palms SET gps_lat = NULL, gps_lng = NULL WHERE plot_id = ? OR plot_id = ?", plotId, normPlotId);
    return sendJson(res, 200, { success: true, message: `تم تفريغ كافة إحداثيات الخريطة لنخيل القطعة (${normPlotId}) بنجاح` });
  }

  // Plots Template Download
  if (pathname === '/api/plots/template' && method === 'GET') {
    const buffer = generatePlotsTemplateBuffer();
    res.writeHead(200, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="PalmTrace_Plots_Template.xlsx"',
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(buffer);
  }

  // Plots Bulk Import (Excel / CSV / JSON)
  if (pathname === '/api/plots/import' && method === 'POST') {
    const contentType = req.headers['content-type'] || '';
    let rows = null;

    try {
      if (contentType.includes('application/json')) {
        const body = await parseBody(req);
        if (Array.isArray(body.rows)) {
          rows = body.rows;
        } else if (body.base64) {
          const cleanB64 = body.base64.replace(/^data:.*?;base64,/, '');
          const buf = Buffer.from(cleanB64, 'base64');
          const wb = XLSX.read(buf, { type: 'buffer' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        } else if (body.csv) {
          const wb = XLSX.read(body.csv, { type: 'string' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        }
      } else {
        const rawBuf = await parseRawBuffer(req);
        const wb = XLSX.read(rawBuf, { type: 'buffer' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      }
    } catch (err) {
      return sendJson(res, 400, { success: false, error: 'فشل في قراءة ملف الإكسل: ' + err.message });
    }

    if (!rows || rows.length === 0) {
      return sendJson(res, 400, { success: false, error: 'لم يتم العثور على بيانات صالحة للاستيراد في الملف' });
    }

    const result = processPlotRows(rows);
    return sendJson(res, result.success ? 200 : 400, result);
  }

  return NEXT;
};
