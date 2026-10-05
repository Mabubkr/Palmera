// Shared domain helpers used by several route modules.
const db = require('../db');

// Settings keys that hold secrets: never sent to browsers.
const SECRET_SETTING_KEYS = new Set(['gemini_api_key', 'geminiApiKey', 'smtpPass', 'openWeatherKey', 'agroMonitoringKey', 'openMeteoKey', 'sentinelClientId', 'sentinelSecret']);
// Older versions also kept the satellite / weather keys inside the agriSettings object
const AGRI_NESTED_SECRETS = ['openWeatherKey', 'agroMonitoringKey', 'openMeteoKey', 'sentinelClientId', 'sentinelSecret'];
function publicSettings(rows) {
  const out = {};
  rows.forEach(r => {
    if (SECRET_SETTING_KEYS.has(r.key)) { out[r.key + '_configured'] = Boolean(r.value && r.value !== '""'); return; }
    try { out[r.key] = JSON.parse(r.value); } catch { out[r.key] = r.value; }
    if (r.key === 'agriSettings' && out.agriSettings && typeof out.agriSettings === 'object') {
      const a = Object.assign({}, out.agriSettings);
      AGRI_NESTED_SECRETS.forEach(k => { delete a[k]; });
      out.agriSettings = a;
    }
  });
  return out;
}
// Splits an incoming agriSettings object: secrets go to their own (hidden) keys, the rest is stored as is
function splitAgriSecrets(obj) {
  const clean = Object.assign({}, obj || {});
  const secrets = {};
  AGRI_NESTED_SECRETS.forEach(k => {
    if (k in clean) { const v = String(clean[k] || '').trim(); if (v) secrets[k] = v; delete clean[k]; }
  });
  return { clean, secrets };
}

// Operation types store crop_id as a number ("1", "1.0") or a code ("palm"). Resolve any of them
// through the crops table, so crops added later from the settings screen work like the built-in ones.
function cropCodeResolver() {
  const map = new Map();
  try {
    db.all('SELECT id, code FROM crops').forEach(c => {
      const n = Number(c.id);
      [String(c.id), n + '', n.toFixed(1), String(c.code)].forEach(k => map.set(k, c.code));
    });
  } catch {}
  return v => { const k = String(v == null ? '' : v).trim(); return map.get(k) || 'all'; };
}

function zakatStatusId(code) {
  if (code === undefined || code === null || code === '') return null;
  if (/^\d+$/.test(String(code))) return Number(code);
  const row = db.get('SELECT id FROM operation_approval_statuses WHERE code = ?', String(code));
  return row ? row.id : null;
}
function zakatCropId(code) {
  if (/^\d+$/.test(String(code || ''))) return Number(code);
  const row = db.get('SELECT id FROM crops WHERE code = ?', String(code || 'palm'));
  return row ? row.id : 1;
}

function generateTempPassword() {
  const chars = 'abcdefghijkmnpqrstuvwxyz';
  const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const nums = '23456789';
  const specials = '!@#$%&*';
  let res = 'Palm#';
  for (let i = 0; i < 4; i++) res += nums[Math.floor(Math.random() * nums.length)];
  res += specials[Math.floor(Math.random() * specials.length)];
  res += uppers[Math.floor(Math.random() * uppers.length)];
  res += chars[Math.floor(Math.random() * chars.length)];
  return res;
}


function computeConvexHull(points) {
  if (!points || points.length < 3) return points || [];
  const pts = points.slice().sort((a, b) => a[1] === b[1] ? a[0] - b[0] : a[1] - b[1]);
  function cross(o, a, b) {
    return (a[1] - o[1]) * (b[0] - o[0]) - (a[0] - o[0]) * (b[1] - o[1]);
  }
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  const hull = lower.concat(upper);
  if (hull.length > 0 && (hull[0][0] !== hull[hull.length - 1][0] || hull[0][1] !== hull[hull.length - 1][1])) {
    hull.push(hull[0]);
  }
  return hull;
}

function updateSectorGis(sectorId) {
  if (!sectorId) return;
  try {
    const standalone = db.get(`
      SELECT COALESCE(SUM(area_value), 0) as s 
      FROM plots 
      WHERE sector_id = ? 
        AND (parent_plot_id IS NULL OR parent_plot_id = '') 
        AND id NOT IN (SELECT DISTINCT parent_plot_id FROM plots WHERE parent_plot_id IS NOT NULL AND parent_plot_id != '')
    `, sectorId)?.s || 0;

    const children = db.get(`
      SELECT COALESCE(SUM(area_value), 0) as c 
      FROM plots 
      WHERE sector_id = ? 
        AND parent_plot_id IS NOT NULL 
        AND parent_plot_id != ''
    `, sectorId)?.c || 0;

    const totalArea = Number((standalone + children).toFixed(2));

    const plotsWithCoords = db.all(`
      SELECT boundary_coordinates 
      FROM plots 
      WHERE sector_id = ? AND boundary_coordinates IS NOT NULL AND boundary_coordinates != ''
    `, sectorId);

    const allPoints = [];
    for (const pl of plotsWithCoords) {
      try {
        const coords = JSON.parse(pl.boundary_coordinates);
        if (Array.isArray(coords)) {
          coords.forEach(pt => {
            if (Array.isArray(pt) && pt.length >= 2 && !isNaN(pt[0]) && !isNaN(pt[1])) {
              allPoints.push([Number(pt[0]), Number(pt[1])]);
            }
          });
        }
      } catch {}
    }

    let boundaryJson = null;
    if (allPoints.length >= 3) {
      const hull = computeConvexHull(allPoints);
      if (hull.length >= 3) {
        boundaryJson = JSON.stringify(hull);
      }
    }

    if (boundaryJson) {
      db.run('UPDATE sectors SET total_area = ?, boundary_coordinates = ? WHERE id = ?', totalArea, boundaryJson, sectorId);
    } else {
      db.run('UPDATE sectors SET total_area = ? WHERE id = ?', totalArea, sectorId);
    }
  } catch (err) {
    console.error('Error in updateSectorGis:', err.message);
  }
}

let _opTypesMap = null;
function getOpTypeName(typeId) {
  if (!typeId) return '';
  if (!_opTypesMap) {
    try {
      const rows = db.all('SELECT id, name FROM operation_types');
      _opTypesMap = {};
      if (Array.isArray(rows)) {
        rows.forEach(r => { _opTypesMap[r.id] = r.name; });
      }
    } catch(e) { _opTypesMap = {}; }
  }
  return _opTypesMap[typeId] || '';
}

function formatAuditLogTitleAndSummary(action, module, targetId, det = {}) {
  const act = (action || '').toLowerCase().trim();
  const mod = (module || '').toLowerCase().trim();
  const tid = targetId ? String(targetId).trim() : '';

  // If title and summary already exist and are clean (not containing raw variable names), return them
  if (det && det.title && det.summary && !det.summary.includes('(') && !det.summary.includes('_operation') && !det.summary.includes('العمليات الميدانية جديد')) {
    return { title: det.title, summary: det.summary };
  }

  const isOp = (mod === 'operations' || mod === 'operation');
  if (isOp) {
    const opTypeName = det.typeName || getOpTypeName(det.typeId) || (det.type ? String(det.type) : '');
    const palmCode = det.palmCode ? `للنخلة [${det.palmCode}]` : (tid ? `[${tid}]` : '');
    const typeLabel = opTypeName ? ` (${opTypeName})` : '';

    if (act.includes('batch_approve')) {
      const cnt = det.count ? ` (${det.count} أصل)` : '';
      return {
        title: `اعتماد عمليات مجمعة${typeLabel}`,
        summary: `تم اعتماد دفعة عمليات ميدانية${typeLabel}${cnt} بنجاح`
      };
    }
    if (act.includes('approve')) {
      return {
        title: `اعتماد عملية ميدانية${typeLabel}`,
        summary: `تم اعتماد العملية الميدانية${typeLabel} ${palmCode} بنجاح`
      };
    }
    if (act.includes('create') || act.includes('add')) {
      return {
        title: `تسجيل عملية ميدانية${typeLabel}`,
        summary: `تم تسجيل وإضافة عملية ميدانية جديدة${typeLabel} ${palmCode} بنجاح`
      };
    }
    if (act.includes('update') || act.includes('edit')) {
      return {
        title: `تحديث عملية ميدانية${typeLabel}`,
        summary: `تم تحديث بيانات العملية الميدانية${typeLabel} ${palmCode} بنجاح`
      };
    }
    if (act.includes('delete')) {
      return {
        title: `حذف عملية ميدانية${typeLabel}`,
        summary: `تم حذف العملية الميدانية${typeLabel} [${tid}]`
      };
    }
    if (act.includes('reject')) {
      return {
        title: `رفض عملية ميدانية${typeLabel}`,
        summary: `تم رفض العملية الميدانية${typeLabel} ${palmCode}`
      };
    }
  }

  if (act === 'update_user_scope' || act === 'update_scope') {
    return {
      title: `تحديث نطاق صلاحيات مستخدم${tid ? ' [' + tid + ']' : ''}`,
      summary: `تم تحديث نطاق وصلاحيات المستخدم${tid ? ' [' + tid + ']' : ''} بنجاح`
    };
  }

  if (act === 'commit_staged_sector') {
    return {
      title: `تأكيد وإضافة قطاع${tid ? ' [' + tid + ']' : ''}`,
      summary: `تم تأكيد وحفظ بيانات القطاع${tid ? ' [' + tid + ']' : ''} بنجاح`
    };
  }

  if (act === 'broadcast_zakat') {
    return {
      title: 'إرسال إشعار الزكاة للمستثمرين',
      summary: 'تم إرسال إشعار وخدمة الزكاة للمستثمرين بنجاح'
    };
  }

  if (act === 'approve_zakat_batch') {
    return {
      title: `اعتماد دفعة زكاة${tid ? ' [' + tid + ']' : ''}`,
      summary: `تم اعتماد وتسليم دفعة الزكاة${tid ? ' [' + tid + ']' : ''} بنجاح`
    };
  }

  if (act === 'unapprove_zakat_batch') {
    return {
      title: `إلغاء اعتماد دفعة زكاة${tid ? ' [' + tid + ']' : ''}`,
      summary: `تم إلغاء اعتماد دفعة الزكاة${tid ? ' [' + tid + ']' : ''} وإعادتها لمسودة`
    };
  }

  const actLabels = {
    create: 'إضافة',
    add: 'تسجيل',
    update: 'تحديث',
    edit: 'تعديل',
    delete: 'حذف',
    approve: 'اعتماد',
    reject: 'رفض',
    approve_operation: 'اعتماد عملية ميدانية',
    batch_approve_operation: 'اعتماد عمليات مجمعة',
    create_operation: 'تسجيل عملية ميدانية',
    add_operation: 'تسجيل عملية ميدانية',
    update_operation: 'تحديث عملية ميدانية',
    delete_operation: 'حذف عملية ميدانية',
    update_user_scope: 'تحديث نطاق صلاحيات',
    update_scope: 'تحديث نطاق صلاحيات',
    update_user: 'تحديث بيانات',
    create_user: 'إضافة مستخدم',
    commit_staged_sector: 'تأكيد وإضافة قطاع',
    broadcast_zakat: 'إرسال إشعار الزكاة',
    approve_zakat_batch: 'اعتماد دفعة زكاة',
    unapprove_zakat_batch: 'إلغاء اعتماد دفعة زكاة',
    login: 'تسجيل دخول',
    logout: 'تسجيل خروج',
    login_failed: 'محاولة دخول غير ناجحة',
    sync: 'مزامنة بيانات',
    sync_all: 'مزامنة شاملة',
    import_plots: 'استيراد قطع جغرافية',
    import_contracts: 'استيراد عقود استثمارية',
    stock_in: 'إذن وارد مخزني',
    stock_out: 'إذن صرف أسمدة',
    receive_voucher: 'استلام إذن صرف',
    zakat_dist: 'توزيع زكاة',
    role_update: 'تعديل صلاحيات',
    user_toggle: 'تغيير حالة حساب',
    system_reset: 'إعادة ضبط النظام'
  };

  const modSingular = {
    sector: 'قطاع',
    sectors: 'قطاع',
    plot: 'قطعة',
    plots: 'قطعة',
    palm: 'نخلة',
    palms: 'نخلة',
    nursery: 'المشتل',
    operations: 'عملية ميدانية',
    operation: 'عملية ميدانية',
    yields: 'شحنة حصاد',
    yield: 'شحنة حصاد',
    fertilizers: 'صنف سماد',
    fertilizer: 'صنف سماد',
    fertilizer_vouchers: 'إذن صرف',
    contracts: 'عقد استثماري',
    contract: 'عقد استثماري',
    investors: 'مستثمر',
    investor: 'مستثمر',
    users: 'مستخدم',
    user: 'مستخدم',
    settings: 'إعدادات النظام',
    zakat: 'سجل الزكاة'
  };

  const modName = modSingular[mod] || mod || 'عنصر';
  const actName = actLabels[act] || (act.replace(/_/g, ' '));
  const tidLabel = tid ? ` [${tid}]` : '';

  let title = `${actName} ${modName}${tidLabel}`.trim();
  let summary = `تم ${actName} ${modName}${tidLabel} بنجاح`;

  if (act === 'delete') {
    summary = `تم حذف ${modName}${tidLabel}`;
  } else if (act === 'reject') {
    summary = `تم رفض ${modName}${tidLabel}`;
  }

  return { title, summary };
}

function logAudit(userId, action, entityName, entityId, details) {
  try {
    const logId = `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    let detObj = typeof details === 'string' ? {} : (details || {});
    if (typeof details === 'string') {
      try { detObj = JSON.parse(details); } catch(e){ detObj = { raw: details }; }
    }
    const localized = formatAuditLogTitleAndSummary(action, entityName, entityId, detObj);
    if (!detObj.title) detObj.title = localized.title;
    if (!detObj.summary) detObj.summary = localized.summary;

    db.run(
      `INSERT INTO audit_logs (id, user_id, action, entity_name, entity_id, details, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      logId, userId || 'admin', action, entityName, entityId,
      JSON.stringify(detObj),
      '127.0.0.1', new Date().toISOString()
    );
  } catch(e) {
    console.warn('audit log error:', e);
  }
}


function resolvePalmId(item) {
  const candidates = [
    item.palmId, item.palm_id, item.palmCode, item.palm_code, item.code
  ].filter(Boolean);

  for (const ref of candidates) {
    if (typeof ref === 'number') {
      const row = db.get('SELECT id FROM palms WHERE id = ?', ref);
      if (row) return row.id;
    } else if (typeof ref === 'string') {
      const s = ref.trim();
      if (/^\d+$/.test(s)) {
        const row = db.get('SELECT id FROM palms WHERE id = ?', parseInt(s, 10));
        if (row) return row.id;
      }
      const row = db.get('SELECT id FROM palms WHERE code = ?', s);
      if (row) return row.id;
    }
  }
  const fallback = db.get('SELECT id FROM palms LIMIT 1');
  return fallback ? fallback.id : 1;
}

function resolveTypeId(item) {
  const typeId = item.typeId || item.type_id || 'op1';
  const row = db.get('SELECT id FROM operation_types WHERE id = ?', typeId);
  if (row) return row.id;
  try {
    db.run("INSERT OR IGNORE INTO operation_types (id, category_id, name) VALUES (?, 'c_f', ?)", typeId, item.typeName || item.name || typeId);
    return typeId;
  } catch (e) {
    const fallback = db.get('SELECT id FROM operation_types LIMIT 1');
    return fallback ? fallback.id : 'op1';
  }
}

function resolveWorkerId(item) {
  const workerId = item.workerId || item.worker_id || 'u3';
  const row = db.get('SELECT id FROM users WHERE id = ?', workerId);
  if (row) return row.id;
  const fallback = db.get('SELECT id FROM users LIMIT 1');
  return fallback ? fallback.id : 'u3';
}

// ----------------------------------------------------
// Cached Bootstrap Hydration System
// ----------------------------------------------------

module.exports = {
  SECRET_SETTING_KEYS,
  splitAgriSecrets,
  cropCodeResolver,
  publicSettings,
  zakatStatusId,
  zakatCropId,
  generateTempPassword,
  computeConvexHull,
  updateSectorGis,
  getOpTypeName,
  formatAuditLogTitleAndSummary,
  logAudit,
  resolvePalmId,
  resolveTypeId,
  resolveWorkerId
};
