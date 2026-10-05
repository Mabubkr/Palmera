// Routes: Investors, contract templates, service invoices, investment contracts
const bcrypt = require('bcryptjs');
const XLSX = require('xlsx');
const db = require('../db');
const { generateInvestorsContractsTemplateBuffer, generateInvestorsExportBuffer, processInvestorsContractsRows } = require('../investors_contracts_handler');
const { sendJson, parseBody, parseRawBuffer } = require('../lib/http');
const { logAudit } = require('../lib/helpers');

const NEXT = Symbol.for('palmtrace.next-route');

// Returns NEXT when no route in this module matched the request.
module.exports = async function investorsRoutes(req, res, { method, pathname, url }) {
  // Investors List API (GET)
  if (pathname === '/api/investors' && method === 'GET') {
    const list = db.all(`
      SELECT 
        i.*,
        u.username,
        u.active as user_active,
        (SELECT COUNT(*) FROM investment_contracts c WHERE c.investor_id = i.id OR c.investor_id = i.user_id) as contracts_count,
        (SELECT COALESCE(SUM(cp.allocated_palms_count), 0) 
         FROM investment_contracts c 
         JOIN contract_plots cp ON cp.contract_id = c.id 
         WHERE c.investor_id = i.id OR c.investor_id = i.user_id) as total_palms,
        (SELECT COUNT(DISTINCT cp.plot_id) 
         FROM investment_contracts c 
         JOIN contract_plots cp ON cp.contract_id = c.id 
         WHERE c.investor_id = i.id OR c.investor_id = i.user_id) as plots_count
      FROM investors i
      LEFT JOIN users u ON u.id = i.user_id
      ORDER BY i.created_at DESC
    `);
    return sendJson(res, 200, list);
  }

  // Investor Create/Update API (POST)
  if (pathname === '/api/investors' && method === 'POST') {
    const body = await parseBody(req);
    const id = body.id || `inv_${Date.now()}_${Math.floor(Math.random()*1000)}`;
    const fullName = (body.fullName || body.full_name || body.name || '').trim();
    const phone = (body.phone || '').trim().replace(/[\s\-]/g, '');
    const nationalId = (body.nationalId || body.national_id || '').trim();
    const email = (body.email || '').trim();
    const bankName = (body.bankName || body.bank_name || '').trim();
    const iban = (body.iban || '').trim();

    if (!fullName || !phone) return sendJson(res, 400, { error: 'اسم المستثمر ورقم الهاتف مطلوبان' });

    let user = db.get('SELECT id FROM users WHERE phone = ? OR id = ?', phone, body.userId || id);
    let userId = user ? user.id : (body.userId || `u_${Date.now()}`);
    if (!user) {
      const defaultHash = bcrypt.hashSync('Palm#1234', 10);
      db.run(`INSERT INTO users (id, username, password_hash, full_name, role, phone, email, active)
              VALUES (?, ?, ?, ?, 'investor', ?, ?, 1)`,
              userId, phone, defaultHash, fullName, phone, email || null);
      db.run('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)', userId, 'investor');
    }

    db.run(`
      INSERT INTO investors (id, user_id, full_name, national_id, phone, email, bank_name, iban)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        full_name = excluded.full_name,
        national_id = excluded.national_id,
        phone = excluded.phone,
        email = excluded.email,
        bank_name = excluded.bank_name,
        iban = excluded.iban,
        user_id = COALESCE(investors.user_id, excluded.user_id)
    `, id, userId, fullName, nationalId, phone, email, bankName, iban);

    return sendJson(res, 200, { success: true, message: 'تم حفظ ملف المستثمر بنجاح', id, userId });
  }

  // Investors & Investment Contracts Template Download
  if (pathname === '/api/investors/template' && method === 'GET') {
    const buffer = generateInvestorsContractsTemplateBuffer();
    res.writeHead(200, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="PalmTrace_Investors_Contracts_Template.xlsx"',
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(buffer);
  }

  // Investors & Investment Contracts Export (Excel Round-Trip)
  if (pathname === '/api/investors/export' && method === 'GET') {
    const buffer = generateInvestorsExportBuffer();
    res.writeHead(200, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="PalmTrace_Investors_Contracts_RoundTrip.xlsx"',
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(buffer);
  }

  // Investors & Investment Contracts Bulk Import (Excel / CSV / JSON)
  if ((pathname === '/api/investors/import' || pathname === '/api/investors/import-excel') && method === 'POST') {
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

    const result = processInvestorsContractsRows(rows);
    return sendJson(res, result.success ? 200 : 400, result);
  }

  // Investor Profile & Contracts API (GET / PUT)
  if (pathname.startsWith('/api/investors/') && !pathname.includes('template') && !pathname.includes('import')) {
    const investorId = decodeURIComponent(pathname.replace('/api/investors/', ''));
    if (method === 'GET') {
      const user = db.get("SELECT id, username, full_name, role, phone, email, active, avatar, blood_type as bloodType, must_change_password, created_at FROM users WHERE id = ?", investorId);
      if (!user) return sendJson(res, 404, { error: 'المستثمر غير موجود' });
      const userRoles = db.all('SELECT role_id FROM user_roles WHERE user_id = ?', investorId).map(r => r.role_id);
      user.roles = userRoles.length > 0 ? userRoles : [user.role];

      const contracts = db.all(`
        SELECT 
          ic.id, ic.contract_number as contractNumber, ic.investor_id as investorUserId, 
          ic.title as contractTitle, ic.start_date as startDate, ic.end_date as endDate, 
          ic.total_trees as contractTreesCount, ic.total_area as totalArea,
          ic.investor_share_pct as investorSharePct, ic.financial_status as financialStatus, 
          ic.status, ic.created_at as createdAt
        FROM investment_contracts ic
        WHERE ic.investor_id = ?
        ORDER BY ic.created_at DESC
      `, investorId);
      const cPlots = db.all('SELECT contract_id, plot_id FROM contract_plots');
      contracts.forEach(c => {
        c.plots = cPlots.filter(cp => cp.contract_id === c.id).map(cp => cp.plot_id);
      });
      user.contracts = contracts;
      return sendJson(res, 200, { success: true, investor: user, contracts: contracts, ...user });
    }

    if (method === 'PUT') {
      const body = await parseBody(req);
      const user = db.get("SELECT * FROM users WHERE id = ?", investorId);
      if (!user) return sendJson(res, 404, { error: 'المستثمر غير موجود' });

      const fullName = body.fullName || body.name || user.full_name;
      const phone = (body.phone !== undefined) ? body.phone : user.phone;
      const email = (body.email !== undefined) ? body.email : user.email;
      const active = (body.active !== undefined) ? (body.active ? 1 : 0) : user.active;
      const primaryRole = body.role || user.role || 'investor';

      if (phone && phone !== user.phone) {
        const phoneConflict = db.get("SELECT id FROM users WHERE phone = ? AND id != ?", phone, investorId);
        if (phoneConflict) {
          return sendJson(res, 400, { error: 'رقم الهاتف مستخدم لحساب آخر بالفعل' });
        }
      }

      db.run(
        "UPDATE users SET full_name = ?, phone = ?, email = ?, active = ?, role = ? WHERE id = ?",
        fullName, phone, email, active, primaryRole, investorId
      );

      if (Array.isArray(body.roles) && body.roles.length > 0) {
        db.run('DELETE FROM user_roles WHERE user_id = ?', investorId);
        const rStmt = db.db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)');
        body.roles.forEach(rId => rStmt.run(investorId, rId));
      }

      logAudit(body.operatorId || 'admin', 'update', 'investor', investorId, {
        name: fullName, phone, email, active: active === 1, roles: body.roles
      });

      return sendJson(res, 200, {
        success: true,
        message: 'تم تحديث بيانات المستثمر بنجاح',
        user: {
          id: investorId,
          name: fullName,
          phone,
          email,
          active: active === 1,
          role: primaryRole,
          roles: body.roles || [primaryRole]
        }
      });
    }
  }

  // Helper: Calculate contract acreage and sync service invoices for Model B
  function syncContractBillingInvoice(contractId, seasonYear = new Date().getFullYear()) {
    if (!contractId) return null;
    const contract = db.get('SELECT * FROM investment_contracts WHERE id = ?', contractId);
    if (!contract) return null;

    const tpl = contract.template_id ? db.get('SELECT * FROM contract_templates WHERE id = ?', contract.template_id) : null;
    const requiresBilling = (tpl && tpl.requires_area_billing) || (Number(contract.annual_fee_per_acre) > 0);
    if (!requiresBilling) return null;

    const plots = db.all(`
      SELECT p.area_value, p.area_unit 
      FROM contract_plots cp
      JOIN plots p ON p.id = cp.plot_id
      WHERE cp.contract_id = ?
    `, contractId);

    let totalAcres = 0;
    plots.forEach(p => {
      const val = Number(p.area_value) || 0;
      if (p.area_unit === 'قيراط') totalAcres += val / 24;
      else if (p.area_unit === 'هكتار') totalAcres += val * 2.381;
      else if (p.area_unit === 'م²') totalAcres += val / 4200.83;
      else totalAcres += val;
    });
    totalAcres = Number(totalAcres.toFixed(2));
    const feePerAcre = Number(contract.annual_fee_per_acre) || (tpl ? Number(tpl.default_annual_fee_per_acre) : 0);
    const totalDue = Number((totalAcres * feePerAcre).toFixed(2));

    // Update total_area on the contract
    db.run('UPDATE investment_contracts SET total_area = ? WHERE id = ?', totalAcres, contractId);

    const existingInv = db.get('SELECT * FROM contract_service_invoices WHERE contract_id = ? AND season_year = ?', contractId, seasonYear);
    if (existingInv) {
      const newStatus = existingInv.paid_amount >= totalDue ? 'paid' : (existingInv.paid_amount > 0 ? 'partially_paid' : 'unpaid');
      db.run(`
        UPDATE contract_service_invoices SET
          total_area_acres = ?,
          fee_per_acre = ?,
          total_due_amount = ?,
          payment_status = ?
        WHERE id = ?
      `, totalAcres, feePerAcre, totalDue, newStatus, existingInv.id);
      return existingInv.id;
    } else if (totalDue > 0) {
      const invId = `INV-${seasonYear}-${contract.contract_number || contractId.slice(-6)}`;
      db.run(`
        INSERT INTO contract_service_invoices (id, contract_id, season_year, total_area_acres, fee_per_acre, total_due_amount, paid_amount, payment_status, due_date)
        VALUES (?, ?, ?, ?, ?, ?, 0, 'unpaid', ?)
      `, invId, contractId, seasonYear, totalAcres, feePerAcre, totalDue, `${seasonYear}-12-31`);
      return invId;
    }
    return null;
  }

  // Contract Templates API
  if (pathname === '/api/contract-templates') {
    if (method === 'GET') {
      const templates = db.all('SELECT * FROM contract_templates ORDER BY created_at ASC');
      return sendJson(res, 200, templates);
    }
    if (method === 'POST') {
      const body = await parseBody(req);
      const id = body.id || `tpl_${Date.now()}`;
      const nameAr = (body.nameAr || body.name_ar || '').trim();
      const code = (body.code || `MODEL_${Date.now()}`).trim().toUpperCase();
      const desc = (body.description || '').trim();
      const defaultCompanyShare = (body.defaultCompanySharePct !== undefined || body.default_company_share_pct !== undefined)
        ? parseFloat(body.defaultCompanySharePct ?? body.default_company_share_pct) : 25.0;
      const defaultFee = (body.defaultAnnualFeePerAcre !== undefined || body.default_annual_fee_per_acre !== undefined)
        ? parseFloat(body.defaultAnnualFeePerAcre ?? body.default_annual_fee_per_acre) : 0.0;
      const requiresBilling = (body.requiresAreaBilling || body.requires_area_billing) ? 1 : 0;
      const isActive = (body.isActive !== undefined || body.is_active !== undefined)
        ? (body.isActive || body.is_active ? 1 : 0) : 1;

      if (!nameAr) return sendJson(res, 400, { error: 'اسم النموذج بالعربية مطلوب' });
      db.run(`
        INSERT INTO contract_templates (id, name_ar, code, description, default_company_share_pct, default_annual_fee_per_acre, requires_area_billing, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, id, nameAr, code, desc, defaultCompanyShare, defaultFee, requiresBilling, isActive);
      return sendJson(res, 201, { success: true, id, message: 'تم إنشاء القالب التعاقدي بنجاح' });
    }
  }

  if (pathname.startsWith('/api/contract-templates/')) {
    const tplId = decodeURIComponent(pathname.replace('/api/contract-templates/', ''));
    const existing = db.get('SELECT * FROM contract_templates WHERE id = ? OR code = ?', tplId, tplId);
    if (!existing) return sendJson(res, 404, { error: 'القالب غير موجود' });
    if (method === 'GET') return sendJson(res, 200, existing);
    if (method === 'PUT') {
      const body = await parseBody(req);
      const nameAr = (body.nameAr || body.name_ar || existing.name_ar).trim();
      const desc = (body.description !== undefined) ? body.description.trim() : existing.description;
      const defaultCompanyShare = (body.defaultCompanySharePct !== undefined || body.default_company_share_pct !== undefined)
        ? parseFloat(body.defaultCompanySharePct ?? body.default_company_share_pct) : existing.default_company_share_pct;
      const defaultFee = (body.defaultAnnualFeePerAcre !== undefined || body.default_annual_fee_per_acre !== undefined)
        ? parseFloat(body.defaultAnnualFeePerAcre ?? body.default_annual_fee_per_acre) : existing.default_annual_fee_per_acre;
      const requiresBilling = (body.requiresAreaBilling !== undefined || body.requires_area_billing !== undefined)
        ? (body.requiresAreaBilling || body.requires_area_billing ? 1 : 0) : existing.requires_area_billing;
      const isActive = (body.isActive !== undefined || body.is_active !== undefined)
        ? (body.isActive || body.is_active ? 1 : 0) : existing.is_active;

      db.run(`
        UPDATE contract_templates SET
          name_ar = ?,
          description = ?,
          default_company_share_pct = ?,
          default_annual_fee_per_acre = ?,
          requires_area_billing = ?,
          is_active = ?
        WHERE id = ?
      `, nameAr, desc, defaultCompanyShare, defaultFee, requiresBilling, isActive, existing.id);
      return sendJson(res, 200, { success: true, message: 'تم تحديث القالب التعاقدي بنجاح' });
    }
  }

  // Contract Service Invoices API
  if (pathname === '/api/contract-invoices') {
    if (method === 'GET') {
      const urlObj = new URL(req.url, 'http://localhost');
      const contractId = urlObj.searchParams.get('contract_id');
      const seasonYear = urlObj.searchParams.get('season_year');
      let sql = `
        SELECT 
          csi.*,
          ic.contract_number as contractNumber,
          ic.title as contractTitle,
          u.id as investorUserId,
          u.full_name as investorName
        FROM contract_service_invoices csi
        JOIN investment_contracts ic ON ic.id = csi.contract_id
        LEFT JOIN users u ON u.id = ic.investor_id
        WHERE 1=1
      `;
      const params = [];
      if (contractId) { sql += ' AND csi.contract_id = ?'; params.push(contractId); }
      if (seasonYear) { sql += ' AND csi.season_year = ?'; params.push(seasonYear); }
      sql += ' ORDER BY csi.season_year DESC, csi.created_at DESC';
      const invoices = db.all(sql, ...params);
      return sendJson(res, 200, invoices);
    }
  }

  if (pathname.startsWith('/api/contract-invoices/') && pathname.includes('/payment') && method === 'PUT') {
    const invoiceId = decodeURIComponent(pathname.replace('/api/contract-invoices/', '').replace('/payment', ''));
    const existing = db.get('SELECT * FROM contract_service_invoices WHERE id = ?', invoiceId);
    if (!existing) return sendJson(res, 404, { error: 'الفاتورة غير موجودة' });
    const body = await parseBody(req);
    const addPaid = parseFloat(body.paidAmount || body.amount || 0);
    const newPaid = Number((existing.paid_amount + addPaid).toFixed(2));
    const status = newPaid >= existing.total_due_amount ? 'paid' : (newPaid > 0 ? 'partially_paid' : 'unpaid');
    db.run(`
      UPDATE contract_service_invoices SET
        paid_amount = ?,
        payment_status = ?
      WHERE id = ?
    `, newPaid, status, invoiceId);
    return sendJson(res, 200, { success: true, message: 'تم تسجيل سداد الفاتورة بنجاح', paidAmount: newPaid, paymentStatus: status });
  }

  // Investment Contracts API
  if (pathname === '/api/contracts') {
    if (method === 'GET') {
      const contracts = db.all(`
        SELECT 
          ic.id, ic.contract_number as contractNumber, ic.investor_id as investorUserId, 
          u.full_name as investorName, u.phone as investorPhone,
          ic.title as contractTitle, ic.start_date as startDate, ic.end_date as endDate, 
          ic.total_trees as contractTreesCount, ic.total_area as totalArea,
          ic.investor_share_pct as investorSharePct, ic.financial_status as financialStatus, 
          ic.status, ic.created_at as createdAt,
          ic.template_id as templateId,
          ic.company_crop_share_pct as companyCropSharePct,
          ic.annual_fee_per_acre as annualFeePerAcre,
          ic.payment_schedule as paymentSchedule,
          ic.zakat_delegated as zakatDelegated,
          ic.zakat_rate_pct as zakatRatePct,
          ic.zakat_delegation_date as zakatDelegationDate,
          ic.zakat_doc_url as zakatDocUrl
        FROM investment_contracts ic
        LEFT JOIN users u ON u.id = ic.investor_id
        ORDER BY ic.created_at DESC
      `);
      const cPlots = db.all('SELECT contract_id, plot_id FROM contract_plots');
      contracts.forEach(c => {
        c.plots = cPlots.filter(cp => cp.contract_id === c.id).map(cp => cp.plot_id);
        c.investor_id = c.investorUserId;
        c.investorId = c.investorUserId;
        c.contract_num = c.contractNumber;
        c.contractNum = c.contractNumber;
        c.title = c.contractTitle;
        c.template_id = c.templateId;
        c.company_crop_share_pct = c.companyCropSharePct;
        c.annual_fee_per_acre = c.annualFeePerAcre;
        c.payment_schedule = c.paymentSchedule;
        c.zakat_delegated = c.zakatDelegated;
        c.zakat_rate_pct = c.zakatRatePct;
        c.financial_status = c.financialStatus;
        c.total_palms = c.contractTreesCount || 0;
        c.totalPalms = c.contractTreesCount || 0;
      });
      return sendJson(res, 200, contracts);
    }

    if (method === 'POST') {
      const body = await parseBody(req);
      const contractId = body.id || `CNT-${Date.now()}`;
      const contractNum = body.contractNumber || body.contract_number || body.contract_num || body.contractNum;
      const investorId = body.investorUserId || body.investor_id || body.investorId;
      const title = body.contractTitle || body.title || `عقد استثماري ${contractNum}`;
      const startDate = body.startDate || body.start_date || new Date().toISOString().split('T')[0];
      const endDate = body.endDate || body.end_date || null;
      const trees = parseInt(body.contractTreesCount || body.total_trees || 0, 10);
      const templateId = body.templateId || body.template_id || null;
      const companyShare = (body.companyCropSharePct !== undefined || body.company_crop_share_pct !== undefined)
        ? parseFloat(body.companyCropSharePct ?? body.company_crop_share_pct) : 25.0;
      const annualFee = (body.annualFeePerAcre !== undefined || body.annual_fee_per_acre !== undefined)
        ? parseFloat(body.annualFeePerAcre ?? body.annual_fee_per_acre) : 0.0;
      const schedule = body.paymentSchedule || body.payment_schedule || 'annual';
      const zakatDelegated = (body.zakatDelegated !== undefined || body.zakat_delegated !== undefined)
        ? (body.zakatDelegated || body.zakat_delegated ? 1 : 0) : 0;
      const zakatRate = (body.zakatRatePct !== undefined || body.zakat_rate_pct !== undefined)
        ? parseFloat(body.zakatRatePct ?? body.zakat_rate_pct) : 5.0;
      const zakatDate = body.zakatDelegationDate || body.zakat_delegation_date || (zakatDelegated ? new Date().toISOString() : null);
      const zakatDoc = body.zakatDocUrl || body.zakat_doc_url || null;

      // Formula: Investor Share = 100 - companyShare - (zakatDelegated ? zakatRate : 0)
      let share = (body.investorSharePct !== undefined || body.investor_share_pct !== undefined)
        ? parseFloat(body.investorSharePct ?? body.investor_share_pct)
        : Number((100 - companyShare - (zakatDelegated ? zakatRate : 0)).toFixed(2));

      const finStatus = body.financialStatus || body.financial_status || 'مسدد بالكامل';
      const status = body.status || 'active';

      if (!contractNum || !investorId) {
        return sendJson(res, 400, { error: 'رقم العقد ومعرف المستثمر مطلوبان' });
      }

      if (Array.isArray(body.plots) && body.plots.length > 0) {
        const placeholders = body.plots.map(() => '?').join(',');
        const conflict = db.get(`
          SELECT cp.plot_id, ic.contract_number, u.full_name
          FROM contract_plots cp
          JOIN investment_contracts ic ON cp.contract_id = ic.id
          LEFT JOIN users u ON ic.investor_id = u.id
          WHERE cp.plot_id IN (${placeholders}) AND ic.id != ? AND ic.contract_number != ? AND ic.status = 'active'
        `, ...body.plots, contractId, contractNum);
        if (conflict) {
          return sendJson(res, 400, {
            error: `القطعة (${conflict.plot_id}) مخصصة بالفعل للمستثمر (${conflict.full_name || 'مستثمر آخر'}) بموجب العقد النشط (${conflict.contract_number}). لا يمكن تكرار تخصيص نفس القطعة لأكثر من مستثمر.`
          });
        }
      }

      db.run(`
        INSERT INTO investment_contracts (
          id, contract_number, investor_id, title, start_date, end_date,
          total_trees, investor_share_pct, financial_status, status,
          template_id, company_crop_share_pct, annual_fee_per_acre, payment_schedule,
          zakat_delegated, zakat_rate_pct, zakat_delegation_date, zakat_doc_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(contract_number) DO UPDATE SET
          investor_id = excluded.investor_id,
          title = excluded.title,
          start_date = excluded.start_date,
          end_date = excluded.end_date,
          total_trees = excluded.total_trees,
          investor_share_pct = excluded.investor_share_pct,
          financial_status = excluded.financial_status,
          status = excluded.status,
          template_id = excluded.template_id,
          company_crop_share_pct = excluded.company_crop_share_pct,
          annual_fee_per_acre = excluded.annual_fee_per_acre,
          payment_schedule = excluded.payment_schedule,
          zakat_delegated = excluded.zakat_delegated,
          zakat_rate_pct = excluded.zakat_rate_pct,
          zakat_delegation_date = excluded.zakat_delegation_date,
          zakat_doc_url = excluded.zakat_doc_url
      `, contractId, contractNum, investorId, title, startDate, endDate, trees, share, finStatus, status,
         templateId, companyShare, annualFee, schedule, zakatDelegated, zakatRate, zakatDate, zakatDoc);

      if (Array.isArray(body.plots)) {
        db.run('DELETE FROM contract_plots WHERE contract_id = ?', contractId);
        const cpStmt = db.db.prepare('INSERT OR IGNORE INTO contract_plots (contract_id, plot_id) VALUES (?, ?)');
        body.plots.forEach(pid => {
          cpStmt.run(contractId, pid);
        });

        db.run('UPDATE plots SET contract_ref = NULL WHERE contract_ref = ?', contractNum);
        const pRefStmt = db.db.prepare('UPDATE plots SET contract_ref = ? WHERE id = ?');
        body.plots.forEach(pid => pRefStmt.run(contractNum, pid));
      }

      syncContractBillingInvoice(contractId);

      return sendJson(res, 200, { success: true, message: 'تم حفظ العقد الاستثماري بنجاح', id: contractId });
    }
  }

  // Individual Contract API (GET / PUT / DELETE)
  if (pathname.startsWith('/api/contracts/')) {
    const contractId = decodeURIComponent(pathname.replace('/api/contracts/', ''));
    const existing = db.get('SELECT * FROM investment_contracts WHERE id = ? OR contract_number = ?', contractId, contractId);
    if (!existing) return sendJson(res, 404, { error: 'العقد غير موجود' });

    if (method === 'GET') {
      const plots = db.all('SELECT plot_id FROM contract_plots WHERE contract_id = ?', existing.id).map(r => r.plot_id);
      return sendJson(res, 200, {
        id: existing.id,
        contractNumber: existing.contract_number,
        investorUserId: existing.investor_id,
        contractTitle: existing.title,
        startDate: existing.start_date,
        endDate: existing.end_date,
        contractTreesCount: existing.total_trees,
        totalArea: existing.total_area,
        investorSharePct: existing.investor_share_pct,
        financialStatus: existing.financial_status,
        status: existing.status,
        templateId: existing.template_id,
        companyCropSharePct: existing.company_crop_share_pct,
        annualFeePerAcre: existing.annual_fee_per_acre,
        paymentSchedule: existing.payment_schedule,
        zakatDelegated: existing.zakat_delegated,
        zakatRatePct: existing.zakat_rate_pct,
        zakatDelegationDate: existing.zakat_delegation_date,
        zakatDocUrl: existing.zakat_doc_url,
        plots
      });
    }

    if (method === 'PUT') {
      const body = await parseBody(req);
      const contractNum = body.contractNumber || body.contract_number || body.contract_num || body.contractNum || existing.contract_number;
      const title = body.contractTitle || body.title || existing.title;
      const startDate = body.startDate || body.start_date || existing.start_date;
      const endDate = (body.endDate !== undefined) ? (body.endDate || null) : existing.end_date;
      const trees = (body.contractTreesCount !== undefined) ? parseInt(body.contractTreesCount, 10) : existing.total_trees;
      const templateId = (body.templateId !== undefined) ? (body.templateId || null) : existing.template_id;
      const companyShare = (body.companyCropSharePct !== undefined || body.company_crop_share_pct !== undefined)
        ? parseFloat(body.companyCropSharePct ?? body.company_crop_share_pct) : existing.company_crop_share_pct;
      const annualFee = (body.annualFeePerAcre !== undefined || body.annual_fee_per_acre !== undefined)
        ? parseFloat(body.annualFeePerAcre ?? body.annual_fee_per_acre) : existing.annual_fee_per_acre;
      const schedule = body.paymentSchedule || body.payment_schedule || existing.payment_schedule || 'annual';
      const zakatDelegated = (body.zakatDelegated !== undefined || body.zakat_delegated !== undefined)
        ? (body.zakatDelegated || body.zakat_delegated ? 1 : 0) : existing.zakat_delegated;
      const zakatRate = (body.zakatRatePct !== undefined || body.zakat_rate_pct !== undefined)
        ? parseFloat(body.zakatRatePct ?? body.zakat_rate_pct) : (existing.zakat_rate_pct || 5.0);
      const zakatDate = (body.zakatDelegationDate !== undefined) ? body.zakatDelegationDate : existing.zakat_delegation_date;
      const zakatDoc = (body.zakatDocUrl !== undefined) ? body.zakatDocUrl : existing.zakat_doc_url;

      let share = (body.investorSharePct !== undefined || body.investor_share_pct !== undefined)
        ? parseFloat(body.investorSharePct ?? body.investor_share_pct)
        : Number((100 - companyShare - (zakatDelegated ? zakatRate : 0)).toFixed(2));

      const finStatus = body.financialStatus || body.financial_status || existing.financial_status;
      const status = body.status || existing.status;
      const investorId = body.investorUserId || body.investor_id || existing.investor_id;

      if (contractNum !== existing.contract_number) {
        const numConflict = db.get('SELECT id FROM investment_contracts WHERE contract_number = ? AND id != ?', contractNum, existing.id);
        if (numConflict) return sendJson(res, 400, { error: 'رقم العقد مستخدم بالفعل لعقد آخر' });
      }

      if (Array.isArray(body.plots) && body.plots.length > 0) {
        const placeholders = body.plots.map(() => '?').join(',');
        const conflict = db.get(`
          SELECT cp.plot_id, ic.contract_number, u.full_name
          FROM contract_plots cp
          JOIN investment_contracts ic ON cp.contract_id = ic.id
          LEFT JOIN users u ON ic.investor_id = u.id
          WHERE cp.plot_id IN (${placeholders}) AND ic.id != ? AND ic.status = 'active'
        `, ...body.plots, existing.id);
        if (conflict) {
          return sendJson(res, 400, {
            error: `القطعة (${conflict.plot_id}) مخصصة بالفعل للمستثمر (${conflict.full_name || 'مستثمر آخر'}) بموجب العقد النشط (${conflict.contract_number}). لا يمكن تكرار تخصيص نفس القطعة لأكثر من مستثمر.`
          });
        }
      }

      db.run(`
        UPDATE investment_contracts SET
          contract_number = ?,
          investor_id = ?,
          title = ?,
          start_date = ?,
          end_date = ?,
          total_trees = ?,
          investor_share_pct = ?,
          financial_status = ?,
          status = ?,
          template_id = ?,
          company_crop_share_pct = ?,
          annual_fee_per_acre = ?,
          payment_schedule = ?,
          zakat_delegated = ?,
          zakat_rate_pct = ?,
          zakat_delegation_date = ?,
          zakat_doc_url = ?
        WHERE id = ?
      `, contractNum, investorId, title, startDate, endDate, trees, share, finStatus, status,
         templateId, companyShare, annualFee, schedule, zakatDelegated, zakatRate, zakatDate, zakatDoc, existing.id);

      if (Array.isArray(body.plots)) {
        db.run('DELETE FROM contract_plots WHERE contract_id = ?', existing.id);
        const cpStmt = db.db.prepare('INSERT OR IGNORE INTO contract_plots (contract_id, plot_id) VALUES (?, ?)');
        body.plots.forEach(pid => {
          cpStmt.run(existing.id, pid);
        });

        db.run('UPDATE plots SET contract_ref = NULL WHERE contract_ref = ?', existing.contract_number);
        const pRefStmt = db.db.prepare('UPDATE plots SET contract_ref = ? WHERE id = ?');
        body.plots.forEach(pid => pRefStmt.run(contractNum, pid));
      }

      syncContractBillingInvoice(existing.id);

      logAudit(body.operatorId || 'admin', 'update', 'contract', existing.id, {
        oldNumber: existing.contract_number,
        newNumber: contractNum,
        title,
        investorId,
        share,
        plots: body.plots
      });

      return sendJson(res, 200, {
        success: true,
        message: 'تم تحديث العقد الاستثماري وإعادة تخصيص القطع بنجاح',
        contract: {
          id: existing.id,
          contractNumber: contractNum,
          investorUserId: investorId,
          contractTitle: title,
          startDate,
          endDate,
          contractTreesCount: trees,
          investorSharePct: share,
          financialStatus: finStatus,
          status,
          templateId,
          companyCropSharePct: companyShare,
          annualFeePerAcre: annualFee,
          paymentSchedule: schedule,
          zakatDelegated,
          zakatRatePct: zakatRate,
          zakatDelegationDate: zakatDate,
          zakatDocUrl: zakatDoc,
          plots: body.plots || []
        }
      });
    }

    if (method === 'DELETE') {
      db.run('DELETE FROM contract_service_invoices WHERE contract_id = ?', existing.id);
      db.run('DELETE FROM contract_plots WHERE contract_id = ?', existing.id);
      db.run('DELETE FROM investment_contracts WHERE id = ?', existing.id);
      logAudit('admin', 'delete', 'contract', existing.id, { contractNumber: existing.contract_number });
      return sendJson(res, 200, { success: true, message: 'تم حذف العقد الاستثماري بنجاح' });
    }
  }

  return NEXT;
};
