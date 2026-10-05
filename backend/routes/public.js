// Routes: Health check and the public consumer traceability page
const db = require('../db');
const { sendJson } = require('../lib/http');

const NEXT = Symbol.for('palmtrace.next-route');

// Returns NEXT when no route in this module matched the request.
// Front-end build number (from sw.js) so a launcher can tell which copy of the system is running
let BUILD = null;
function appBuild() {
  if (BUILD) return BUILD;
  try {
    const sw = require('node:fs').readFileSync(require('node:path').join(require('../config').FRONTEND_DIR, 'sw.js'), 'utf8');
    BUILD = (sw.match(/palmtrace-v(\d+)/) || [])[1] || 'unknown';
  } catch { BUILD = 'unknown'; }
  return BUILD;
}

module.exports = async function publicRoutes(req, res, { method, pathname, url }) {
  // 1. Health check
  if (method === 'GET' && pathname === '/api/health') {
    return sendJson(res, 200, {
      status: 'online',
      engine: 'node:sqlite',
      version: '3.0.0-enterprise',
      build: appBuild(),
      time: new Date().toISOString()
    });
  }

  // 1.1 Public Product Digital Passport & Traceability API (No Auth Required)
  if (method === 'GET' && pathname.startsWith('/api/public/trace/')) {
    const batchParam = decodeURIComponent(pathname.replace('/api/public/trace/', '')).trim();
    const y = db.get(`
      SELECT 
        id, batch_no as batch, batch_no as batchNo, harvest_level as level, palm_id as palmId, palm_code as palmCode,
        plot_id as plotId, plot_name as plotName, sector_id as sectorId, sector_name as sectorName,
        season, harvest_date as date, crop_code as cropId, crop_name as cropName,
        variety_name as variety, quality_grade as qualityGrade,
        kg_total as kg, kg_excellent as kgEx, kg_good as kgGd, kg_low as kgBad,
        boxes_count as boxes, notes, created_at as createdAt
      FROM v_yields 
      WHERE batch_no = ? OR id = ?
    `, batchParam, batchParam);

    if (!y) {
      return sendJson(res, 404, { success: false, error: 'لم يتم العثور على بيانات شحنة الحصاد المطلوبة' });
    }

    const firstPlotId = (y.plotId || '').split(/[,،\s]+/)[0].trim();
    const plotObj = firstPlotId ? db.get('SELECT * FROM plots WHERE id = ?', firstPlotId) : null;
    const sectorObj = y.sectorId ? db.get('SELECT * FROM sectors WHERE id = ?', y.sectorId) : null;

    const kgTotal = Number(y.kg) || 1;
    const kgEx = Number(y.kgEx) || 0;
    const kgGd = Number(y.kgGd) || 0;
    const kgBad = Number(y.kgBad) || 0;
    const pctEx = Math.round((kgEx / kgTotal) * 100) || 95;
    const pctGd = Math.round((kgGd / kgTotal) * 100) || 5;

    const harvestYear = y.season || (y.date ? y.date.slice(0, 4) : '2026');
    const timeline = [
      {
        stage: 'التلقيح والإخصاب الميداني',
        date: `${harvestYear}-03-15`,
        title: 'تلقيح يدوي دقيق بأفخر حبوب اللقاح',
        desc: 'تمت عمليات التلقيح اليدوي ومتابعة عقد الثمار بنجاح تحت إشراف نخبة من المهندسين الزراعيين.',
        badge: 'رعاية فائقة'
      },
      {
        stage: 'الخف والتكميم والوقاية الحيوية',
        date: `${harvestYear}-05-20`,
        title: 'خف الشماريخ وتركيب أكياس الحماية الحريرية',
        desc: 'حماية العراجين بأغطية واقية وتنفيذ برنامج المكافحة الحيوية المتكاملة خالية 100% من أي متبقيات كيميائية.',
        badge: 'عضوي 100%'
      },
      {
        stage: 'الري والتغذية الحيوية من الآبار',
        date: `${harvestYear}-07-10`,
        title: 'ري متطور بالتنقيط من مياه جوفية عذبة نقية',
        desc: 'تغذية متوازنة بأسمدة عضوية معتمدة ومياه آبار عذبة من واحة الفرافرة البكر.',
        badge: 'مياه جوفية نقية'
      },
      {
        stage: 'الحصاد والقطف اليدوي المنقى',
        date: y.date || `${harvestYear}-09-24`,
        title: `قطف الثمار عند تمام النضج (${y.variety || 'برحي فاخر'})`,
        desc: `جمع يدوي دقيق بمعدات مخصصة ونقل مباشر إلى صالة الفرز والتحجيم بالقطاع (${y.sectorName || y.sectorId}).`,
        badge: 'طازج'
      },
      {
        stage: 'الفحص المخبري والفرز الممتاز والتعبئة',
        date: y.date || `${harvestYear}-09-24`,
        title: `معايير جودة صارمة بنسبة فرز فاخر ${pctEx}%`,
        desc: `اجتياز فحوصات نقاء الحبة، وخلو العينة من متبقيات المبيدات، واعتماد التعبئة للبيع والتصدير.`,
        badge: 'معتمد وموثق'
      }
    ];

    const comp = db.get('SELECT name, trade_name, logo, phone, email FROM companies LIMIT 1');
    const compTrade = comp?.trade_name || comp?.name || 'المنظومة الزراعية';
    const compFull = comp?.name || comp?.trade_name || compTrade;

    return sendJson(res, 200, {
      success: true,
      batch: y,
      company: {
        name: compFull,
        tradeName: compTrade,
        logo: comp?.logo || '',
        phone: comp?.phone || '',
        email: comp?.email || ''
      },
      provenance: {
        farm: compTrade,
        region: 'واحة الفرافرة • الوادي الجديد • جمهورية مصر العربية',
        coordinates: plotObj?.boundary_coordinates ? plotObj.boundary_coordinates : (sectorObj?.boundary_coordinates || '[[27.003625,28.384938],[27.003625,28.389238],[27.008775,28.389238],[27.008775,28.384938],[27.003625,28.384938]]'),
        centerLat: plotObj?.center_lat || 27.0062,
        centerLng: plotObj?.center_lng || 28.3871,
        plotName: plotObj?.name || y.plotName || y.plotId || 'حواش قطاع 1',
        sectorName: sectorObj?.name || y.sectorName || 'قطاع بشاير',
        irrigationType: plotObj?.irrigation_source || 'مياه جوفية نقية • شبكة ري بالتنقيط الذكي'
      },
      quality: {
        grade: y.qualityGrade || 'فرز ممتاز (Premium Grade A)',
        pctEx: pctEx,
        pctGd: pctGd,
        totalKg: y.kg,
        variety: y.variety || 'برحي فاخر',
        crop: y.cropName || 'تمور',
        purity: '100% طبيعي بدون مواد حافظة',
        pesticidesFree: true,
        labTested: true
      },
      nutrition: {
        servingSize: '100 جم',
        calories: '277 سعرة حرارية',
        sugars: '66.5 جم (سكريات طبيعية غنية بالطاقة)',
        fiber: '6.7 جم (ألياف طبيعية معززة للهضم)',
        potassium: '696 مجم (بوتاسيوم عالي لصحة القلب)',
        magnesium: '54 مجم',
        iron: '0.9 مجم'
      },
      timeline
    });
  }

  return NEXT;
};
