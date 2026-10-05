const XLSX = require('xlsx');
const db = require('./db');
const { uuidv7 } = require('./uuidv7');
const { normalizeSectorCode, normalizePlotCode } = require('./code_normalizer');

function getVal(row, keys, excludeKeywords = []) {
  if (!row) return null;
  // 1. Direct match
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
      return String(row[k]).trim();
    }
  }
  // 2. Exact normalized match
  for (const k of keys) {
    const normK = k.replace(/[\s_\-()（）\[\]\/\\]/g, '').toLowerCase();
    for (const rowK of Object.keys(row)) {
      if (excludeKeywords.some(ex => rowK.toLowerCase().includes(ex.toLowerCase()))) continue;
      const normRowK = rowK.replace(/[\s_\-()（）\[\]\/\\]/g, '').toLowerCase();
      if (normRowK === normK) {
        if (row[rowK] !== undefined && row[rowK] !== null && String(row[rowK]).trim() !== '') {
          return String(row[rowK]).trim();
        }
      }
    }
  }
  // 3. Substring / partial match
  for (const k of keys) {
    const normK = k.replace(/[\s_\-()（）\[\]\/\\]/g, '').toLowerCase();
    if (normK.length < 3) continue;
    for (const rowK of Object.keys(row)) {
      if (excludeKeywords.some(ex => rowK.toLowerCase().includes(ex.toLowerCase()))) continue;
      const normRowK = rowK.replace(/[\s_\-()（）\[\]\/\\]/g, '').toLowerCase();
      if (normRowK.includes(normK) || normK.includes(normRowK)) {
        if (row[rowK] !== undefined && row[rowK] !== null && String(row[rowK]).trim() !== '') {
          return String(row[rowK]).trim();
        }
      }
    }
  }
  return null;
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
        const coords = typeof pl.boundary_coordinates === 'string' ? JSON.parse(pl.boundary_coordinates) : pl.boundary_coordinates;
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

function generatePlotsTemplateBuffer() {
  const headers = [
    'كود القطاع (إلزامي)',
    'اسم القطاع (اختياري)',
    'كود القطعة الأم (اختياري)',
    'كود القطعة (إلزامي)',
    'اسم / وصف القطعة',
    'المساحة',
    'وحدة المساحة',
    'المحصول الأساسي',
    'كود / هاتف المستثمر',
    'رقم العقد الاستثماري',
    'نقطة 1 - خط العرض (Lat)',
    'نقطة 1 - خط الطول (Lng)',
    'نقطة 2 - خط العرض (Lat)',
    'نقطة 2 - خط الطول (Lng)',
    'نقطة 3 - خط العرض (Lat)',
    'نقطة 3 - خط الطول (Lng)',
    'نقطة 4 - خط العرض (Lat)',
    'نقطة 4 - خط الطول (Lng)',
    'سعة النخيل المقدرة',
    'مصدر / محبس الري'
  ];

  const sampleRows = [
    [
      'BSH01', 'بشاير 1', '', '01', 'القطعة الرئيسية 01 (أم)', 10.0, 'فدان', 'نخيل مجدول', 'INV-101', 'CNT-2026-0312',
      27.050000, 31.160000, 27.050000, 31.163000, 27.047000, 31.163000, 27.047000, 31.160000,
      140, 'محبس رئيسي V-01'
    ],
    [
      'BSH01', 'بشاير 1', '01', '01A', 'حوشة 01A الشرقية (فرعية)', 2.5, 'فدان', 'نخيل مجدول', 'INV-101', 'CNT-2026-0312',
      27.050000, 31.161500, 27.050000, 31.163000, 27.047000, 31.163000, 27.047000, 31.161500,
      70, 'خط تنقيط V01-A'
    ],
    [
      'BSH01', 'بشاير 1', '01', '01B', 'حوشة 01B الغربية (فرعية)', 2.5, 'فدان', 'نخيل مجدول', 'INV-101', 'CNT-2026-0312',
      27.050000, 31.160000, 27.050000, 31.161500, 27.047000, 31.161500, 27.047000, 31.160000,
      70, 'خط تنقيط V01-B'
    ]
  ];

  const data = [headers, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(data);

  ws['!cols'] = [
    { wch: 18 }, { wch: 20 }, { wch: 22 }, { wch: 18 }, { wch: 26 },
    { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 20 },
    { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 },
    { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 },
    { wch: 22 }, { wch: 18 }, { wch: 20 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'القطع والحدود');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function processPlotRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { success: false, error: 'الملف المرفوع فارغ أو لا يحتوي على صفوف بيانات' };
  }

  const affectedSectors = new Set();
  const importedPlots = [];
  const errors = [];

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const rowNum = idx + 2;

    const rawSecCode = getVal(row, ['كود القطاع (إلزامي)', 'كود القطاع', 'القطاع', 'sector_code', 'sector', 'A']);
    const rawSecName = getVal(row, ['اسم القطاع (اختياري)', 'اسم القطاع', 'sector_name', 'sector_label', 'B']);
    const rawParentCode = getVal(row, ['كود القطعة الأم (اختياري)', 'كود القطعة الأم', 'القطعة الأم', 'parent_plot_code', 'parent_plot', 'C'], ['قطاع']);
    const rawPlotCode = getVal(row, ['كود القطعة (إلزامي)', 'كود القطعة', 'رقم القطعة', 'plot_code', 'plot_no', 'plot', 'D'], ['أم', 'ام', 'parent', 'قطاع']);

    if (!rawSecCode || !rawPlotCode) {
      if (rawSecCode || rawPlotCode) {
        errors.push(`صف ${rowNum}: كود القطاع وكود القطعة إلزاميان.`);
      }
      continue;
    }

    const secCode = normalizeSectorCode(rawSecCode);
    const parentCode = rawParentCode ? normalizePlotCode(rawParentCode) : null;
    const plotCode = normalizePlotCode(rawPlotCode);

    const plotName = getVal(row, ['اسم / وصف القطعة', 'اسم القطعة', 'وصف القطعة', 'plot_name', 'name', 'E']) || `قطعة ${plotCode}`;
    const areaVal = parseFloat(getVal(row, ['المساحة', 'مساحة القطعة', 'area_value', 'area', 'F'], ['وحدة', 'unit'])) || 0;
    const areaUnit = getVal(row, ['وحدة المساحة', 'الوحدة', 'area_unit', 'unit', 'G']) || 'فدان';
    const mainCrop = getVal(row, ['المحصول الأساسي', 'المحصول', 'main_crop', 'crop', 'H']) || 'نخيل';
    const investorId = getVal(row, ['كود / هاتف المستثمر', 'كود المستثمر', 'هاتف المستثمر', 'المستثمر', 'investor_identifier', 'investor', 'I']);
    const contractRef = getVal(row, ['رقم العقد الاستثماري', 'رقم العقد', 'عقد', 'contract_ref', 'contract', 'J']);
    const targetCapacity = parseInt(getVal(row, ['سعة النخيل المقدرة', 'سعة النخيل', 'target_capacity', 'capacity', 'S']) || '0', 10);
    const irrigationSource = getVal(row, ['مصدر / محبس الري', 'مصدر الري', 'كود المحبس', 'حالة الري', 'irrigation_source', 'irrigation', 'T']);

    const c1_lat = parseFloat(getVal(row, ['نقطة 1 - خط العرض (Lat)', 'نقطة 1 - خط العرض', 'corner1_lat', 'lat1', 'K'], ['طول', 'lng']));
    const c1_lng = parseFloat(getVal(row, ['نقطة 1 - خط الطول (Lng)', 'نقطة 1 - خط الطول', 'corner1_lng', 'lng1', 'L'], ['عرض', 'lat']));
    const c2_lat = parseFloat(getVal(row, ['نقطة 2 - خط العرض (Lat)', 'نقطة 2 - خط العرض', 'corner2_lat', 'lat2', 'M'], ['طول', 'lng']));
    const c2_lng = parseFloat(getVal(row, ['نقطة 2 - خط الطول (Lng)', 'نقطة 2 - خط الطول', 'corner2_lng', 'lng2', 'N'], ['عرض', 'lat']));
    const c3_lat = parseFloat(getVal(row, ['نقطة 3 - خط العرض (Lat)', 'نقطة 3 - خط العرض', 'corner3_lat', 'lat3', 'O'], ['طول', 'lng']));
    const c3_lng = parseFloat(getVal(row, ['نقطة 3 - خط الطول (Lng)', 'نقطة 3 - خط الطول', 'corner3_lng', 'lng3', 'P'], ['عرض', 'lat']));
    const c4_lat = parseFloat(getVal(row, ['نقطة 4 - خط العرض (Lat)', 'نقطة 4 - خط العرض', 'corner4_lat', 'lat4', 'Q'], ['طول', 'lng']));
    const c4_lng = parseFloat(getVal(row, ['نقطة 4 - خط الطول (Lng)', 'نقطة 4 - خط الطول', 'corner4_lng', 'lng4', 'R'], ['عرض', 'lat']));

    let boundaryCoords = null;
    let centerLat = null;
    let centerLng = null;

    if (!isNaN(c1_lat) && !isNaN(c1_lng) && !isNaN(c2_lat) && !isNaN(c2_lng) &&
        !isNaN(c3_lat) && !isNaN(c3_lng) && !isNaN(c4_lat) && !isNaN(c4_lng)) {
      boundaryCoords = [
        [c1_lat, c1_lng],
        [c2_lat, c2_lng],
        [c3_lat, c3_lng],
        [c4_lat, c4_lng],
        [c1_lat, c1_lng]
      ];
      centerLat = Number(((c1_lat + c2_lat + c3_lat + c4_lat) / 4).toFixed(6));
      centerLng = Number(((c1_lng + c2_lng + c3_lng + c4_lng) / 4).toFixed(6));
    }

    // Ensure Sector exists with normalized code and smart Upsert
    const finalSecName = (rawSecName && String(rawSecName).trim()) ? String(rawSecName).trim() : null;
    db.run(
      `INSERT INTO sectors (id, name, is_deleted) VALUES (?, ?, 0)
       ON CONFLICT(id) DO UPDATE SET
         name = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE sectors.name END,
         is_deleted = 0`,
      secCode, (finalSecName || `قطاع ${secCode}`), finalSecName, finalSecName, finalSecName
    );

    // Plot ID formatting: standardized canonical format
    const plotId = `${secCode}-${plotCode}`;

    let plotNo = plotCode;
    let partLetter = '';
    const m = plotCode.match(/^([0-9]+)([A-Za-z\u0600-\u06FF]*)$/);
    if (m) {
      plotNo = m[1];
      partLetter = m[2] ? m[2].toUpperCase() : '';
    }

    let parentPlotId = null;
    const effectiveParentCode = (parentCode && parentCode !== plotCode) ? parentCode : (partLetter ? plotNo : null);
    if (effectiveParentCode && effectiveParentCode !== plotCode) {
      parentPlotId = `${secCode}-${effectiveParentCode}`;
      db.run(
        "INSERT INTO plots (id, sector_id, plot_no, part_letter, name, main_crop) VALUES (?, ?, ?, '', ?, ?) ON CONFLICT(id) DO NOTHING",
        parentPlotId, secCode, effectiveParentCode, `قطعة ${effectiveParentCode}`, mainCrop
      );
    }

    db.run(`
      INSERT INTO plots (
        id, sector_id, plot_no, part_letter, name, parent_plot_id,
        area_value, area_unit, boundary_coordinates, center_lat, center_lng,
        main_crop, target_capacity, irrigation_source, contract_ref
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        sector_id = excluded.sector_id,
        plot_no = excluded.plot_no,
        part_letter = excluded.part_letter,
        name = excluded.name,
        parent_plot_id = excluded.parent_plot_id,
        area_value = excluded.area_value,
        area_unit = excluded.area_unit,
        boundary_coordinates = COALESCE(excluded.boundary_coordinates, plots.boundary_coordinates),
        center_lat = COALESCE(excluded.center_lat, plots.center_lat),
        center_lng = COALESCE(excluded.center_lng, plots.center_lng),
        main_crop = excluded.main_crop,
        target_capacity = excluded.target_capacity,
        irrigation_source = excluded.irrigation_source,
        contract_ref = excluded.contract_ref
    `,
      plotId, secCode, plotNo, partLetter, plotName, parentPlotId,
      areaVal, areaUnit, boundaryCoords ? JSON.stringify(boundaryCoords) : null,
      centerLat, centerLng, mainCrop, targetCapacity, irrigationSource, contractRef
    );

    // Link investor if provided
    if (investorId) {
      const user = db.get(
        "SELECT id FROM users WHERE (phone = ? OR username = ? OR id = ? OR full_name LIKE ?) AND role = 'investor' LIMIT 1",
        investorId, investorId, investorId, `%${investorId}%`
      );
      if (user) {
        db.run(
          "INSERT INTO user_plots (id, user_id, plot_id, permission_type) VALUES (?, ?, ?, 'view') ON CONFLICT(user_id, plot_id) DO NOTHING",
          uuidv7(), user.id, plotId
        );
      }
    }

    affectedSectors.add(secCode);
    importedPlots.push({
      id: plotId,
      name: plotName,
      sector: secCode,
      area: areaVal,
      hasBoundary: Boolean(boundaryCoords),
      center: centerLat ? [centerLat, centerLng] : null
    });
  }

  // Update Sector Boundaries & Total Area for all affected sectors
  for (const secId of affectedSectors) {
    updateSectorGis(secId);
  }

  return {
    success: true,
    importedCount: importedPlots.length,
    affectedSectorsCount: affectedSectors.size,
    sectors: Array.from(affectedSectors),
    plots: importedPlots,
    errors: errors.length ? errors : undefined
  };
}

module.exports = {
  generatePlotsTemplateBuffer,
  processPlotRows,
  computeConvexHull,
  updateSectorGis
};
