const XLSX = require('xlsx');
const db = require('./db');
const { uuidv7 } = require('./uuidv7');
const bcrypt = require('bcryptjs');

function getVal(row, keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
      return String(row[k]).trim();
    }
  }
  return null;
}

const ROUND_TRIP_HEADERS = [
  'كود المستثمر',
  'اسم المستثمر',
  'رقم الجوال',
  'كود العقد',
  'تاريخ العقد',
  'نموذج التعاقد',
  'رسم الفدان (ج.م)',
  'تفويض الزكاة',
  'كود القطعة',
  'عدد النخيل'
];

function generateInvestorsContractsTemplateBuffer() {
  const sampleRows = [
    [
      'INV-001',
      'أحمد البدري',
      '01000000003',
      'CON-2026-01',
      '2026-01-15',
      'نسبة مشاركة 25%',
      0,
      'نعم',
      'BSH01-02A',
      40
    ],
    [
      'INV-001',
      'أحمد البدري',
      '01000000003',
      'CON-2026-01',
      '2026-01-15',
      'نسبة مشاركة 25%',
      0,
      'نعم',
      'BSH01-02B',
      35
    ],
    [
      'INV-002',
      'سارة المنصوري',
      '01123456789',
      'CON-2026-02',
      '2026-02-01',
      'رسم خدمة سنوي',
      3000,
      'نعم',
      'BSH02-01A',
      ''
    ]
  ];

  const data = [ROUND_TRIP_HEADERS, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(data);

  ws['!cols'] = [
    { wch: 16 }, { wch: 26 }, { wch: 18 }, { wch: 18 },
    { wch: 16 }, { wch: 28 }, { wch: 18 }, { wch: 16 },
    { wch: 18 }, { wch: 16 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'عقود المستثمرين ومطابقة القطع');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function generateInvestorsExportBuffer() {
  const rows = [ROUND_TRIP_HEADERS];

  const contracts = db.all(`
    SELECT c.*, 
           i.id as inv_code, i.full_name as inv_name, i.phone as inv_phone
    FROM investment_contracts c
    LEFT JOIN investors i ON i.id = c.investor_id OR i.user_id = c.investor_id
    ORDER BY c.contract_number ASC
  `);

  for (const c of contracts) {
    const invCode = c.inv_code || c.investor_id || 'INV-001';
    const invName = c.inv_name || c.investor_name || 'مستثمر';
    const invPhone = c.inv_phone || '';
    const contractNum = c.contract_number || c.id;
    const contractDate = c.contract_date || c.start_date || '2026-01-01';
    const modelType = c.model_type === 'SERVICE_FEE_SHARE' ? 'رسم خدمة سنوي' : `نسبة مشاركة ${c.crop_share_percentage || 25}%`;
    const serviceFee = c.service_fee_per_acre || 0;
    const zakatDelegated = (c.zakat_delegation === 1 || c.zakat_delegated === 1) ? 'نعم' : 'لا';

    const plots = db.all(`
      SELECT cp.*, p.name as plot_name,
             (SELECT COUNT(*) FROM palms WHERE plot_id = cp.plot_id AND COALESCE(is_archived, 0) = 0 AND COALESCE(is_deleted, 0) = 0) as real_tree_count
      FROM contract_plots cp
      LEFT JOIN plots p ON p.id = cp.plot_id
      WHERE cp.contract_id = ?
    `, c.id);

    if (plots.length > 0) {
      for (const pl of plots) {
        rows.push([
          invCode,
          invName,
          invPhone,
          contractNum,
          contractDate,
          modelType,
          serviceFee,
          zakatDelegated,
          pl.plot_id,
          pl.allocated_palms_count || pl.real_tree_count || ''
        ]);
      }
    } else {
      rows.push([
        invCode,
        invName,
        invPhone,
        contractNum,
        contractDate,
        modelType,
        serviceFee,
        zakatDelegated,
        '',
        c.total_trees || ''
      ]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 16 }, { wch: 26 }, { wch: 18 }, { wch: 18 },
    { wch: 16 }, { wch: 28 }, { wch: 18 }, { wch: 16 },
    { wch: 18 }, { wch: 16 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'عقود المستثمرين ومطابقة القطع');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function processInvestorsContractsRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { success: false, error: 'الملف المرفوع فارغ أو لا يحتوي على صفوف صالحة' };
  }

  const processedInvestors = new Set();
  const processedContracts = new Map();
  const warnings = [];

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const rowNum = idx + 2;

    const investorName = getVal(row, ['اسم المستثمر', 'اسم المستثمر (إلزامي)', 'investor_name', 'name', 'full_name']);
    const phone = getVal(row, ['رقم الجوال', 'رقم الهاتف', 'رقم الهاتف / اسم الدخول (إلزامي)', 'investor_phone', 'phone', 'username']);
    const contractNum = getVal(row, ['كود العقد', 'رقم العقد الاستثماري', 'رقم العقد الاستثماري (إلزامي)', 'رقم العقد', 'contract_id', 'contract_number']);

    if (!contractNum && !investorName) {
      continue; // Skip empty rows
    }

    if (!contractNum) {
      warnings.push(`صف ${rowNum}: تم تجاهله لعدم وجود كود العقد.`);
      continue;
    }

    const cleanContractNum = contractNum.trim().toUpperCase();
    const cleanPhone = phone ? phone.replace(/[\s\-]/g, '') : '';
    const investorCode = getVal(row, ['كود المستثمر', 'investor_id', 'id']) || (cleanPhone ? `INV-${cleanPhone}` : `INV-${Date.now()}`);

    const contractDate = getVal(row, ['تاريخ العقد', 'تاريخ بداية العقد', 'contract_date', 'start_date']) || new Date().toISOString().split('T')[0];
    const modelRaw = getVal(row, ['نموذج التعاقد', 'نموذج الاستثمار', 'model_type']) || 'مشاركة محصول 25%';
    const serviceFee = parseFloat(getVal(row, ['رسم الفدان (ج.م)', 'رسم الفدان', 'service_fee_per_acre', 'service_fee']) || '0') || 0;
    
    // Model determination
    let modelType = 'CROP_SHARE';
    let cropSharePct = 25.0;
    if (modelRaw.includes('خدمة') || modelRaw.includes('SERVICE') || serviceFee > 0) {
      modelType = 'SERVICE_FEE_SHARE';
      cropSharePct = 15.0;
    } else {
      const matchPct = modelRaw.match(/(\d+(?:\.\d+)?)/);
      if (matchPct) cropSharePct = parseFloat(matchPct[1]);
    }

    const zakatRaw = getVal(row, ['تفويض الزكاة', 'تفويض زكاة', 'zakat_delegation', 'zakat']) || 'نعم';
    const zakatDelegated = (zakatRaw === 'نعم' || zakatRaw === '1' || zakatRaw === 1 || String(zakatRaw).toLowerCase() === 'yes') ? 1 : 0;
    const plotCode = getVal(row, ['كود القطعة', 'القطعة', 'plot_id', 'plot_code']);
    const countRaw = getVal(row, ['عدد النخيل', 'النخيل', 'palms_count', 'allocated_palms_count']);
    const palmsCount = countRaw ? parseInt(countRaw, 10) : 0;

    // 1. Resolve or Create User & Investor record
    let userId = null;
    if (cleanPhone) {
      let user = db.get('SELECT * FROM users WHERE phone = ? OR username = ?', cleanPhone, cleanPhone);
      if (!user) {
        userId = `u_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const defaultHash = bcrypt.hashSync('Palm#1234', 10);
        db.run(
          `INSERT INTO users (id, username, password_hash, full_name, role, phone, active)
           VALUES (?, ?, ?, ?, 'investor', ?, 1)`,
          userId, cleanPhone, defaultHash, investorName || cleanPhone, cleanPhone
        );
      } else {
        userId = user.id;
      }
    }

    // Upsert Investor table
    try {
      db.run(`
        INSERT INTO investors (id, user_id, full_name, phone)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          user_id = COALESCE(excluded.user_id, investors.user_id),
          full_name = CASE WHEN excluded.full_name IS NOT NULL AND excluded.full_name != '' THEN excluded.full_name ELSE investors.full_name END,
          phone = CASE WHEN excluded.phone IS NOT NULL AND excluded.phone != '' THEN excluded.phone ELSE investors.phone END
      `, investorCode, userId, investorName || investorCode, cleanPhone || '—');
    } catch (e) {
      // Fallback
      db.run('INSERT OR IGNORE INTO investors (id, full_name, phone) VALUES (?, ?, ?)', investorCode, investorName || investorCode, cleanPhone || '—');
    }

    processedInvestors.add(investorCode);

    // 2. Resolve or Create Investment Contract
    let contract = db.get('SELECT * FROM investment_contracts WHERE id = ? OR contract_number = ?', cleanContractNum, cleanContractNum);
    let contractId = contract ? contract.id : cleanContractNum;

    if (!contract) {
      db.run(`
        INSERT INTO investment_contracts (
          id, contract_number, investor_id, contract_date, start_date, model_type,
          crop_share_percentage, service_fee_per_acre, zakat_delegation, zakat_delegated, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `, contractId, cleanContractNum, investorCode, contractDate, contractDate, modelType, cropSharePct, serviceFee, zakatDelegated, zakatDelegated);
    } else {
      db.run(`
        UPDATE investment_contracts SET
          investor_id = ?,
          contract_date = ?,
          model_type = ?,
          crop_share_percentage = ?,
          service_fee_per_acre = ?,
          zakat_delegation = ?,
          zakat_delegated = ?
        WHERE id = ?
      `, investorCode, contractDate, modelType, cropSharePct, serviceFee, zakatDelegated, zakatDelegated, contractId);
    }

    // 3. Link Plot and calculate actual palms
    if (plotCode) {
      const cleanPlotCode = plotCode.trim();
      const plot = db.get(
        `SELECT id, area_value FROM plots 
         WHERE id = ? OR id LIKE ? OR plot_no = ? OR name = ? OR name LIKE ? LIMIT 1`,
        cleanPlotCode, `%-` + cleanPlotCode, cleanPlotCode, cleanPlotCode, `%` + cleanPlotCode + `%`
      );

      if (plot) {
        // Auto-extract palms count if left empty
        let finalPalmsCount = palmsCount;
        if (!finalPalmsCount || finalPalmsCount <= 0) {
          const actualTreeCount = db.get('SELECT COUNT(*) as c FROM palms WHERE plot_id = ? AND COALESCE(is_archived, 0) = 0 AND COALESCE(is_deleted, 0) = 0', plot.id)?.c || 0;
          finalPalmsCount = actualTreeCount;
        }

        // Link to contract_plots with upsert
        try {
          db.run(
            `INSERT INTO contract_plots (contract_id, plot_id, allocated_palms_count)
             VALUES (?, ?, ?)
             ON CONFLICT(plot_id) DO UPDATE SET
               contract_id = excluded.contract_id,
               allocated_palms_count = excluded.allocated_palms_count`,
            contractId, plot.id, finalPalmsCount
          );
        } catch (err) {
          db.run(
            `INSERT OR REPLACE INTO contract_plots (contract_id, plot_id, allocated_palms_count)
             VALUES (?, ?, ?)`,
            contractId, plot.id, finalPalmsCount
          );
        }

        if (userId) {
          db.run(
            'INSERT OR IGNORE INTO user_plots (id, user_id, plot_id, permission_type) VALUES (?, ?, ?, ?)',
            uuidv7(), userId, plot.id, 'view'
          );
        }
      } else {
        warnings.push(`صف ${rowNum}: كود القطعة (${cleanPlotCode}) غير مسجل في النظام بعد.`);
      }
    }

    if (!processedContracts.has(cleanContractNum)) {
      processedContracts.set(cleanContractNum, {
        contractNumber: cleanContractNum,
        investorName,
        plotsCount: 0
      });
    }
    if (plotCode) {
      processedContracts.get(cleanContractNum).plotsCount += 1;
    }
  }

  // Final rollup: update contract totals (trees count & area)
  try {
    const contracts = db.all('SELECT id FROM investment_contracts');
    for (const c of contracts) {
      const stats = db.get(`
        SELECT COALESCE(SUM(cp.allocated_palms_count), 0) as total_trees,
               COALESCE(SUM(p.area_value), 0) as total_area
        FROM contract_plots cp
        LEFT JOIN plots p ON p.id = cp.plot_id
        WHERE cp.contract_id = ?
      `, c.id);

      if (stats) {
        db.run('UPDATE investment_contracts SET total_trees = ?, total_area = ? WHERE id = ?',
          stats.total_trees, stats.total_area, c.id);
      }
    }
  } catch (e) {}

  return {
    success: true,
    message: 'تم استيراد وتحديث عقود المستثمرين ومطابقة القطع بنجاح',
    importedInvestorsCount: processedInvestors.size,
    importedContractsCount: processedContracts.size,
    contracts: Array.from(processedContracts.values()),
    warnings: warnings.length ? warnings : undefined
  };
}

module.exports = {
  generateInvestorsContractsTemplateBuffer,
  generateInvestorsExportBuffer,
  processInvestorsContractsRows
};
