// Routes: Companies, roles, projects, system settings
const db = require('../db');
const AgriAI = require('../agri_ai_service');
const { sendJson, parseBody } = require('../lib/http');
const { SECRET_SETTING_KEYS, publicSettings, splitAgriSecrets } = require('../lib/helpers');

const NEXT = Symbol.for('palmtrace.next-route');

// Returns NEXT when no route in this module matched the request.
module.exports = async function organizationRoutes(req, res, { method, pathname, url }) {
  // 3.1 Companies API
  if (pathname === '/api/companies') {
    if (method === 'GET') {
      const companies = db.all('SELECT id, name, trade_name as tradeName, commercial_registry as commercialRegistry, tax_number as taxNumber, email, phone, currency_code as currencyCode, logo, tier FROM companies');
      return sendJson(res, 200, companies);
    }
    if (method === 'POST') {
      const body = await parseBody(req);
      const compId = body.id || `comp_${Date.now()}`;
      db.run(
        `INSERT INTO companies (id, name, trade_name, commercial_registry, tax_number, email, phone, currency_code, logo, tier)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, trade_name=excluded.trade_name, commercial_registry=excluded.commercial_registry, tax_number=excluded.tax_number, email=excluded.email, phone=excluded.phone, currency_code=excluded.currency_code, logo=excluded.logo, tier=excluded.tier`,
        compId, body.name, body.tradeName || body.trade_name || body.name, body.commercialRegistry || body.commercial_registry || '', body.taxNumber || body.tax_number || '', body.email || '', body.phone || '', body.currencyCode || body.currency_code || 'EGP', body.logo || null, body.tier || 'enterprise'
      );
      return sendJson(res, 201, { success: true, id: compId, message: 'تم حفظ بيانات الشركة بنجاح' });
    }
  }

  if (pathname.startsWith('/api/companies/')) {
    const compId = decodeURIComponent(pathname.replace('/api/companies/', ''));
    if (method === 'GET') {
      const c = db.get('SELECT id, name, trade_name as tradeName, commercial_registry as commercialRegistry, tax_number as taxNumber, email, phone, currency_code as currencyCode, logo, tier FROM companies WHERE id = ?', compId);
      if (!c) return sendJson(res, 404, { error: 'الشركة غير موجودة' });
      return sendJson(res, 200, c);
    }
    if (method === 'PUT') {
      const body = await parseBody(req);
      db.run(
        `INSERT INTO companies (id, name, trade_name, commercial_registry, tax_number, email, phone, currency_code, logo, tier)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, trade_name=excluded.trade_name, commercial_registry=excluded.commercial_registry, tax_number=excluded.tax_number, email=excluded.email, phone=excluded.phone, currency_code=excluded.currency_code, logo=COALESCE(excluded.logo, companies.logo)`,
        compId, body.name, body.tradeName || body.trade_name || body.name, body.commercialRegistry || body.commercial_registry || '', body.taxNumber || body.tax_number || '', body.email || '', body.phone || '', body.currencyCode || body.currency_code || 'EGP', body.logo || null, body.tier || 'enterprise'
      );
      return sendJson(res, 200, { success: true, message: 'تم تحديث بيانات الشركة بنجاح' });
    }
  }

  // 3.1.1 Roles API
  if (pathname === '/api/roles') {
    if (method === 'GET') {
      const roles = db.all('SELECT id, name_ar as nameAr, description, matrix, perms FROM roles ORDER BY id ASC').map(r => {
        let m = r.matrix, p = r.perms;
        try { if (m && typeof m === 'string') m = JSON.parse(m); } catch {}
        try { if (p && typeof p === 'string') p = JSON.parse(p); } catch {}
        return { ...r, matrix: m, perms: p };
      });
      return sendJson(res, 200, roles);
    }
    if (method === 'POST') {
      const body = await parseBody(req);
      const roleId = String(body.id || '').trim();
      const roleName = String(body.name || body.nameAr || body.name_ar || '').trim();
      const desc = String(body.description || body.desc || '').trim();
      const matrix = typeof body.matrix === 'object' ? JSON.stringify(body.matrix) : (body.matrix || null);
      const perms = Array.isArray(body.perms) ? JSON.stringify(body.perms) : (body.perms || null);

      if (!roleId || !roleName) {
        return sendJson(res, 400, { error: 'معرف واسم الدور مطلوبان' });
      }

      db.run(
        `INSERT INTO roles (id, name_ar, description, matrix, perms)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name_ar=excluded.name_ar, description=excluded.description, matrix=excluded.matrix, perms=excluded.perms`,
        roleId, roleName, desc, matrix, perms
      );

      return sendJson(res, 201, { success: true, id: roleId, message: 'تم حفظ الدور في قاعدة البيانات بنجاح' });
    }
  }

  if (pathname.startsWith('/api/roles/')) {
    const roleId = decodeURIComponent(pathname.replace('/api/roles/', '')).trim();
    if (method === 'DELETE') {
      const protectedRoles = ['admin', 'super_admin', 'engineer', 'worker'];
      if (protectedRoles.includes(roleId)) {
        return sendJson(res, 400, { error: 'لا يمكن حذف الأدوار القياسية الأساسية للنظام' });
      }
      db.run('DELETE FROM roles WHERE id = ?', roleId);
      db.run('DELETE FROM user_roles WHERE role_id = ?', roleId);
      return sendJson(res, 200, { success: true, message: 'تم حذف الدور بنجاح' });
    }
  }

  // 3.2 Projects API
  if (pathname === '/api/projects') {
    if (method === 'GET') {
      const projects = db.all('SELECT id, company_id as companyId, name, code_prefix as codePrefix, location_name as locationName, area_feddan as areaFeddan, timezone FROM projects');
      return sendJson(res, 200, projects);
    }
    if (method === 'POST') {
      const body = await parseBody(req);
      const projId = body.id || `proj_${Date.now()}`;
      db.run(
        `INSERT INTO projects (id, company_id, name, code_prefix, location_name, area_feddan, timezone)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, code_prefix=excluded.code_prefix, location_name=excluded.location_name, area_feddan=excluded.area_feddan, timezone=excluded.timezone`,
        projId, body.companyId || body.company_id || 'comp_bashayer', body.name, (body.codePrefix || body.code_prefix || 'BSH1').toUpperCase(), body.locationName || body.location_name || '', body.areaFeddan || body.area_feddan || 0, body.timezone || 'Africa/Cairo'
      );
      return sendJson(res, 201, { success: true, id: projId, message: 'تم حفظ المشروع بنجاح' });
    }
  }

  if (pathname.startsWith('/api/projects/')) {
    const cloneMatch = pathname.match(/^\/api\/projects\/([^/]+)\/clone-starter-pack$/);
    if (cloneMatch && method === 'POST') {
      const projId = decodeURIComponent(cloneMatch[1]);
      db.run("INSERT OR IGNORE INTO sectors (id, name, notes, is_deleted) VALUES ('s1', 'قطاع أ (نخيل خلاص وسكري)', 'قطاع نموذجي استثماري', 0)");
      db.run("INSERT OR IGNORE INTO sectors (id, name, notes, is_deleted) VALUES ('s2', 'قطاع ب (نخيل برحي ومجدول)', 'قطاع مخصص للتصدير والرطب', 0)");
      db.run("INSERT OR IGNORE INTO plots (id, sector_id, plot_no, part_letter, name) VALUES ('P01', 's1', '1', 'A', 'حوض 1 شمالي')");
      db.run("INSERT OR IGNORE INTO plots (id, sector_id, plot_no, part_letter, name) VALUES ('P02', 's1', '2', 'A', 'حوض 2 شمالي')");
      db.run("INSERT OR IGNORE INTO plots (id, sector_id, plot_no, part_letter, name) VALUES ('P03', 's2', '3', 'B', 'حوض 3 جنوبي')");
      return sendJson(res, 200, { success: true, message: 'تم استيراد القالب الافتراضي للمزرعة بنجاح' });
    }

    const projId = decodeURIComponent(pathname.replace('/api/projects/', ''));
    if (method === 'GET') {
      const p = db.get('SELECT id, company_id as companyId, name, code_prefix as codePrefix, location_name as locationName, area_feddan as areaFeddan, timezone FROM projects WHERE id = ?', projId);
      if (!p) return sendJson(res, 404, { error: 'المشروع غير موجود' });
      return sendJson(res, 200, p);
    }
    if (method === 'PUT') {
      const body = await parseBody(req);
      db.run(
        `INSERT INTO projects (id, company_id, name, code_prefix, location_name, area_feddan, timezone)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, code_prefix=excluded.code_prefix, location_name=excluded.location_name, area_feddan=excluded.area_feddan, timezone=excluded.timezone`,
        projId, body.companyId || body.company_id || 'comp_bashayer', body.name, (body.codePrefix || body.code_prefix || 'BSH1').toUpperCase(), body.locationName || body.location_name || '', body.areaFeddan || body.area_feddan || 0, body.timezone || 'Africa/Cairo'
      );
      return sendJson(res, 200, { success: true, message: 'تم تحديث بيانات المشروع بنجاح' });
    }
  }

  // 3.3 System Settings API
  if (pathname === '/api/settings') {
    if (method === 'GET') {
      const rows = db.all('SELECT key, value FROM system_settings');
      return sendJson(res, 200, publicSettings(rows));
    }
    if (method === 'POST' || method === 'PUT') {
      const body = await parseBody(req);
      if (body.agriSettings && typeof body.agriSettings === 'object') {
        const { clean, secrets } = splitAgriSecrets(body.agriSettings);
        body.agriSettings = clean;
        Object.entries(secrets).forEach(([k, v]) => { if (!(k in body) || !String(body[k] || '').trim()) body[k] = v; });
      }
      for (const [key, val] of Object.entries(body)) {
        // Secrets are only written when a real new value is supplied (the UI never receives the stored one).
        if (SECRET_SETTING_KEYS.has(key) && (!val || String(val).trim() === '')) continue;
        if (key.endsWith('_configured')) continue;
        if (key === 'gemini_api_key' || key === 'geminiApiKey') AgriAI.setApiKey(String(val).trim());
        const sVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
        db.run(
          `INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`,
          key, sVal
        );
      }
      return sendJson(res, 200, { success: true, message: 'تم حفظ إعدادات المنظومة بنجاح' });
    }
  }

  return NEXT;
};
