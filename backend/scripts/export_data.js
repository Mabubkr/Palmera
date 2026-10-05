const fs = require('fs');
const path = require('path');
const db = require('../db');

const EXPORT_DIR = path.join(require('../config').ROOT_DIR, 'exports');
if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

// دالة مساعدة لتحويل مصفوفة كائنات إلى CSV مع UTF-8 BOM لفتح سليم في Excel
function toCSV(rows) {
  if (!rows || !rows.length) return '\uFEFF';
  const headers = Object.keys(rows[0]);
  const csvLines = [
    headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',')
  ];

  for (const row of rows) {
    const line = headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '""';
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(',');
    csvLines.push(line);
  }

  return '\uFEFF' + csvLines.join('\r\n');
}

console.log('--- Starting Export for Palms & Operations ---');

// 1. تصدير جدول النخيل الخام المطبع (Raw Normalized Palms Table)
const palmsRaw = db.all('SELECT * FROM palms ORDER BY id ASC');
fs.writeFileSync(path.join(EXPORT_DIR, 'palms_normalized.csv'), toCSV(palmsRaw), 'utf8');
fs.writeFileSync(path.join(EXPORT_DIR, 'palms_normalized.json'), JSON.stringify(palmsRaw, null, 2), 'utf8');
console.log(`✓ Exported ${palmsRaw.length} rows to palms_normalized.csv & palms_normalized.json`);

// 2. تصدير النخيل التفصيلي العلائقي (Detailed Palms with Resolved Names from v_palms)
const palmsDetailed = db.all(`
  SELECT 
    p.code AS "كود_الشجرة",
    c.name AS "المحصول",
    p.variety_id AS "معرف_الصنف",
    v.name AS "اسم_الصنف",
    s.name AS "القطاع",
    pl.name AS "القطعة",
    p.seq_no AS "الرقم_التسلسلي",
    p.plant_date AS "تاريخ_الزراعة",
    ot.label_ar AS "نوع_المنشأ",
    p.status_code AS "كود_الحالة",
    hs.label_ar AS "الحالة_الصحية",
    p.offshoot_count AS "عدد_الفسائل",
    p.lineage_path AS "مسار_النسب",
    p.gps_lat AS "خط_العرض",
    p.gps_lng AS "خط_الطول",
    p.notes AS "الملاحظات",
    p.created_at AS "تاريخ_التسجيل"
  FROM palms p
  LEFT JOIN crops c ON p.crop_id = c.id
  LEFT JOIN crop_varieties v ON p.variety_id = v.id
  LEFT JOIN sectors s ON p.sector_id = s.id
  LEFT JOIN plots pl ON p.plot_id = pl.id
  LEFT JOIN tree_health_statuses hs ON p.status_code = hs.code
  LEFT JOIN tree_origin_types ot ON p.origin_type = ot.code
  ORDER BY p.code ASC
`);
fs.writeFileSync(path.join(EXPORT_DIR, 'palms_detailed_arabic.csv'), toCSV(palmsDetailed), 'utf8');
console.log(`✓ Exported ${palmsDetailed.length} rows to palms_detailed_arabic.csv`);

// 3. تصدير جدول العمليات الخام (Raw Operations Table)
const opsRaw = db.all('SELECT * FROM operations ORDER BY performed_at DESC');
fs.writeFileSync(path.join(EXPORT_DIR, 'operations.csv'), toCSV(opsRaw), 'utf8');
fs.writeFileSync(path.join(EXPORT_DIR, 'operations.json'), JSON.stringify(opsRaw, null, 2), 'utf8');
console.log(`✓ Exported ${opsRaw.length} rows to operations.csv & operations.json`);

// 4. تصدير العمليات التفصيلي العلائقي (Detailed Operations with Resolved Names)
const opsDetailed = db.all(`
  SELECT 
    o.id AS "معرف_العملية",
    p.code AS "كود_الشجرة",
    p.plot_id AS "القطعة",
    v.name AS "صنف_الشجرة",
    t.name AS "اسم_العملية",
    cat.name AS "تصنيف_العملية",
    u.full_name AS "اسم_المنفذ",
    u.role AS "الدور",
    o.performed_at AS "تاريخ_التنفيذ",
    CASE 
      WHEN o.approval_status = 'approved' THEN 'معتمدة'
      WHEN o.approval_status = 'rejected' THEN 'مرفوضة'
      ELSE 'قيد الانتظار'
    END AS "حالة_الاعتماد",
    o.status AS "حالة_المزامنة",
    o.worker_notes AS "ملاحظات_المنفذ",
    o.supervisor_notes AS "ملاحظات_المشرف",
    o.created_at AS "تاريخ_التسجيل"
  FROM operations o
  LEFT JOIN palms p ON o.palm_id = p.id
  LEFT JOIN crop_varieties v ON p.variety_id = v.id
  LEFT JOIN operation_types t ON o.type_id = t.id
  LEFT JOIN operation_categories cat ON t.category_id = cat.id
  LEFT JOIN users u ON o.worker_id = u.id
  ORDER BY o.performed_at DESC
`);
fs.writeFileSync(path.join(EXPORT_DIR, 'operations_detailed_arabic.csv'), toCSV(opsDetailed), 'utf8');
console.log(`✓ Exported ${opsDetailed.length} rows to operations_detailed_arabic.csv`);

console.log('--- All Files Exported Successfully to:', EXPORT_DIR);

