// /api/bootstrap payload: build, cache, and per-user scoping.
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const db = require('../db');
const access = require('../access');
const { publicSettings, formatAuditLogTitleAndSummary, cropCodeResolver } = require('./helpers');

let _cachedBootstrapGzip = null;
let _cachedBootstrapRaw = null;
let _cachedBootstrapEtag = null;
let _bootstrapBuildingPromise = null;

let _cachedBootstrapData = null;
let _palmsListCache = null; // { stamp, lookups, list }
const _scopedBootstrapCache = new Map(); // userId -> { baseEtag, gzip, raw, etag }

function invalidateBootstrapCache() {
  _cachedBootstrapGzip = null;
  _cachedBootstrapRaw = null;
  _cachedBootstrapEtag = null;
  _cachedBootstrapData = null;
  _scopedBootstrapCache.clear();
}

// Bootstrap payload filtered to what this user is allowed to see (see access.js)
async function getBootstrapForUser(user) {
  const full = await getOrBuildBootstrap();
  if (access.accessLevel(user) === 'full') return full;
  const cached = _scopedBootstrapCache.get(user.id);
  if (cached && cached.baseEtag === full.etag) return cached;
  const { _syncMeta, ...data } = access.scopeBootstrap(getBootstrapData(), user);
  const raw = Buffer.from(JSON.stringify(data), 'utf8');
  const gzip = await new Promise((resolve, reject) => zlib.gzip(raw, { level: 6 }, (err, r) => err ? reject(err) : resolve(r)));
  const entry = { baseEtag: full.etag, gzip, raw, etag: full.etag.replace(/"$/, '_' + crypto.createHash('sha1').update(String(user.id)).digest('hex').slice(0, 8) + '"') };
  _scopedBootstrapCache.set(user.id, entry);
  return entry;
}

if (typeof db.onChange === 'function') {
  db.onChange(() => {
    invalidateBootstrapCache();
  });
}

function buildBootstrapPayload() {
  const users = db.all("SELECT id, username as user, '' as pass, full_name as name, role, phone, email, avatar, blood_type as bloodType, COALESCE(must_change_password, 0) as mustChangePassword FROM users WHERE active = 1");
  const sectors = db.all("SELECT id, name, notes, created_at, boundary_coordinates as boundaryCoordinates, total_area as totalArea FROM sectors WHERE (is_deleted = 0 OR is_deleted IS NULL) AND id NOT LIKE 'ST%' ORDER BY id ASC");
  const plots = db.all(`
    SELECT 
      id, sector_id as sector, plot_no as plotNo, part_letter as part, name, polygon_gps as polygon,
      parent_plot_id as parentPlotId, area_value as areaValue, area_unit as areaUnit, 
      boundary_coordinates as boundaryCoordinates, center_lat as centerLat, center_lng as centerLng, 
      main_crop as mainCrop, target_capacity as targetCapacity, irrigation_source as irrigationSource, 
      contract_ref as contractRef
    FROM plots 
    WHERE sector_id NOT LIKE 'ST%'
      AND sector_id IN (SELECT id FROM sectors WHERE is_deleted = 0 OR is_deleted IS NULL)
  `);
  plots.forEach(p => {
    if (p.boundaryCoordinates && typeof p.boundaryCoordinates === 'string') {
      try { p.boundaryCoordinates = JSON.parse(p.boundaryCoordinates); } catch {}
    }
  });
  sectors.forEach(s => {
    if (s.boundaryCoordinates && typeof s.boundaryCoordinates === 'string') {
      try { s.boundaryCoordinates = JSON.parse(s.boundaryCoordinates); } catch {}
    }
  });
  const userPlots = db.all('SELECT * FROM user_plots');
  const workerAssignedPlots = db.all('SELECT worker_id as workerId, plot_id as plotId FROM worker_assigned_plots');
  const allUserRoles = db.all('SELECT user_id, role_id FROM user_roles');
  const availableRoles = db.all('SELECT id, name_ar as nameAr, description, matrix, perms FROM roles ORDER BY id ASC').map(r => {
    let m = r.matrix, p = r.perms;
    try { if (m && typeof m === 'string') m = JSON.parse(m); } catch {}
    try { if (p && typeof p === 'string') p = JSON.parse(p); } catch {}
    return { ...r, matrix: m, perms: p };
  });
  const contractTemplates = db.all('SELECT * FROM contract_templates ORDER BY created_at ASC');
  const contractInvoices = db.all('SELECT * FROM contract_service_invoices ORDER BY season_year DESC, created_at DESC');
  const investors = db.all(`
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
  const investmentContracts = db.all(`
    SELECT 
      ic.id, ic.contract_number as contractNumber, ic.investor_id as investorUserId, 
      u.full_name as investorName, u.phone as investorPhone,
      ic.title as contractTitle, ic.start_date as startDate, ic.end_date as endDate, 
      ic.contract_date as contractDate,
      ic.model_type as modelType,
      COALESCE(ic.crop_share_percentage, ic.company_crop_share_pct, 25.0) as cropSharePercentage,
      COALESCE(ic.service_fee_per_acre, ic.annual_fee_per_acre, 0.0) as serviceFeePerAcre,
      COALESCE(ic.production_share_percentage, 0.0) as productionSharePercentage,
      COALESCE(ic.zakat_delegation, ic.zakat_delegated, 1) as zakatDelegation,
      ic.notes,
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
  const contractPlots = db.all('SELECT contract_id as contractId, plot_id as plotId, COALESCE(allocated_palms_count, 0) as allocatedPalmsCount, notes FROM contract_plots');

  investmentContracts.forEach(c => {
    c.plots = contractPlots.filter(cp => cp.contractId === c.id || cp.contract_id === c.id).map(cp => cp.plotId || cp.plot_id);
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

  users.forEach(u => {
    const wPlots = workerAssignedPlots.filter(wp => wp.workerId === u.id || wp.worker_id === u.id).map(wp => wp.plotId || wp.plot_id);
    const uWorkPlots = userPlots.filter(up => up.user_id === u.id && (up.permission_type === 'work' || up.permission_type === 'engineer' || up.permission_type === 'worker')).map(up => up.plot_id);
    const effectiveWPlots = wPlots.length > 0 ? wPlots : uWorkPlots;
    const invPlots = userPlots.filter(up => up.user_id === u.id && (up.permission_type === 'view' || up.permission_type === 'investor_view')).map(up => up.plot_id);
    
    u.workerPlots = effectiveWPlots;
    u.investorPlots = invPlots;
    if (u.role === 'engineer' || u.role === 'worker') {
      u.plots = effectiveWPlots;
    } else if (u.role === 'investor') {
      u.plots = invPlots;
    } else {
      u.plots = effectiveWPlots.length > 0 ? effectiveWPlots : userPlots.filter(up => up.user_id === u.id).map(up => up.plot_id);
    }
    const uRoles = allUserRoles.filter(ur => ur.user_id === u.id).map(ur => ur.role_id);
    u.roles = uRoles.length > 0 ? uRoles : [u.role];
    u.contractIds = investmentContracts.filter(c => c.investorUserId === u.id || c.investor_id === u.id).map(c => c.id);
  });

  const syncVersion = currentSyncVersion(); // read before the queries: later changes show up in the next delta
  // The tree list is the expensive part: reuse it while no tree and no lookup table changed.
  const palmLookups = SYNC.palms.lookupsHash();
  let palms;
  const palmStamp = palmsStamp();
  if (palmStamp && _palmsListCache && _palmsListCache.stamp === palmStamp && _palmsListCache.lookups === palmLookups) {
    palms = _palmsListCache.list;
  } else {
    palms = queryPalms();
    _palmsListCache = { stamp: palmStamp, lookups: palmLookups, list: palms };
  }
  const syncMeta = { version: syncVersion, lookups: { palms: palmLookups, operations: SYNC.operations.lookupsHash() } };

  const crops = db.all('SELECT code as id, id as numericId, code, name, single_label as single, plural_label as plural, offspring_label as offspring, code_prefix as codePrefix, primary_source_code as primarySourceCode, yield_name, yield_name as yieldName, unit, icon, notes, active FROM crops ORDER BY id ASC');
  const cropPlantingSources = db.all('SELECT id, crop_id as cropId, name, code_letter as codeLetter, code_letter as code, is_default as isDefault FROM crop_planting_sources ORDER BY is_default DESC, id ASC');
  crops.forEach(c => {
    c.active = Boolean(c.active);
    const cSources = cropPlantingSources.filter(s => s.cropId === c.code || s.cropId === String(c.numericId));
    c.sources = cSources.map(s => ({ code: s.codeLetter, name: s.name, isDefault: Boolean(s.isDefault) }));
  });
  const nurseryPrepTypes = db.all('SELECT id, name, crop_id as cropId, source_code as sourceCode, active, sort_order as sortOrder FROM nursery_prep_types ORDER BY sort_order ASC, id ASC').map(np => ({ ...np, active: Boolean(np.active) }));
  const propagationSourceTypes = db.all('SELECT * FROM propagation_source_types ORDER BY id ASC');
  const cropVarieties = db.all(`
    SELECT cv.id, c.code as cropId, cv.crop_id as cropNumericId, cv.name, cv.usage_desc as usage 
    FROM crop_varieties cv 
    JOIN crops c ON c.id = cv.crop_id
  `);

  const treeHealthStatuses = db.all('SELECT id, code, label_ar as labelAr, label_en as labelEn, badge_color as badgeColor, badge_bg as badgeBg, requires_alert as requiresAlert FROM tree_health_statuses ORDER BY id ASC');
  const treeOriginTypes = db.all('SELECT id, code, label_ar as labelAr, label_en as labelEn FROM tree_origin_types ORDER BY id ASC');
  const yieldQualityGrades = db.all('SELECT id, code, label_ar as labelAr, label_en as labelEn, badge_color as badgeColor, badge_bg as badgeBg FROM yield_quality_grades ORDER BY id ASC');
  const approvalStatuses = db.all('SELECT id, code, label_ar as labelAr, label_en as labelEn, badge_color as badgeColor, badge_bg as badgeBg FROM operation_approval_statuses ORDER BY id ASC');
  const syncStatuses = db.all('SELECT id, code, label_ar as labelAr, label_en as labelEn, badge_color as badgeColor, badge_bg as badgeBg FROM operation_sync_statuses ORDER BY id ASC');

  const offshoots = db.all(`
    SELECT 
      id, mother_id as motherId, mother_code as motherCode, temp_code as tempCode, seq_no as seq, 
      separation_date as date, weight_kg as weight, diameter_cm as diameter, 
      status_id as statusId, status_code as statusCode, health_status as health, health_badge_color as healthBadgeColor,
      variety_id as varietyId, variety_name as variety, origin_id as originId, origin_type as originType, origin_label as originLabel,
      supplier, nursery_stage as nsStatus, planted_palm_id as newPalmId, planted_palm_code as newPalmCode,
      approval_status as approvalStatus, is_opening_stock as isOpeningStock, notes, created_at as createdAt
    FROM v_offshoots
  `);
  // nursery workflow details saved by the app (see POST /api/offshoots/nursery-state)
  try {
    const metaById = new Map(db.all('SELECT offshoot_id AS id, meta FROM offshoot_nursery_meta').map(r => [String(r.id), r.meta]));
    if (metaById.size) offshoots.forEach(o => {
      const m = metaById.get(String(o.id));
      if (!m) return;
      try { Object.assign(o, JSON.parse(m)); } catch {}
    });
  } catch {}

  const operations = queryOperations();

  const fertilizers = db.all(`
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
  const fertilizerVouchers = db.all(`
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
  const yields = db.all(`
    SELECT 
      id, batch_no as batchNo, harvest_level as harvestLevel, palm_id as palmId, palm_code as palmCode,
      plot_id as plotId, plot_name as plotName, sector_id as sectorId, sector_name as sectorName,
      season, harvest_date as harvestDate, harvest_date as date, crop_code as cropId, crop_id as cropNumericId, crop_name as cropName,
      variety_id as varietyId, variety_name as variety, quality_id as qualityId, quality_code as qualityCode,
      quality_grade as qualityGrade, quality_badge_color as qualityBadgeColor,
      kg_total as kg, kg_total as kgTotal, kg_excellent as kgEx, kg_good as kgGd, kg_low as kgBad,
      boxes_count as boxes, boxes_count as boxesCount, recorded_by as recordedBy, recorded_by as by, recorded_by_name as recordedByName, recorded_by_name as byName,
      notes, created_at as createdAt
    FROM v_yields ORDER BY harvest_date DESC
  `);
  const zakatStatusCodes = Object.fromEntries(db.all('SELECT id, code FROM operation_approval_statuses').map(r => [r.id, r.code]));
  const zakat = db.all('SELECT * FROM zakat_records ORDER BY created_at DESC').map(r => {
    let extra = {};
    try { extra = r.payload ? JSON.parse(r.payload) : {}; } catch {}
    return {
      ...extra,
      id: r.id,
      investorId: r.investor_id,
      season: r.season,
      amount: r.due_amount,
      dueKg: r.due_kg,
      choice: r.choice_type,
      charityId: r.charity_id || extra.charityId || null,
      status: extra.status || zakatStatusCodes[r.status_id] || 'pending',
      pledgeStatus: r.pledge_status,
      pledgeSignedAt: r.pledge_signed_at,
      journeyStage: r.journey_stage,
      batchId: r.batch_id,
      receiptNo: r.receipt_no || extra.receiptNo || null
    };
  });
  const operationCategories = db.all('SELECT * FROM operation_categories ORDER BY id ASC');
  const operationTypes = db.all('SELECT id, category_id as categoryId, name, crop_id as cropId, requires_material as requiresMaterial, allowed_kinds as allowedKinds, scope_type as scopeType, is_critical as isCritical, requires_approval as requiresApproval, active FROM operation_types ORDER BY id ASC');
  const toCropCode = cropCodeResolver();
  operationTypes.forEach(ot => {
    ot.cropId = toCropCode(ot.cropId);
  });
  const treeNotes = db.all(`
    SELECT 
      tn.id, tn.palm_id as palmId, tn.palm_code as palmCode,
      tn.author_id as authorId, tn.author_id as createdBy, tn.author_name as authorName,
      u.role as authorRole,
      tn.note_type as noteType, tn.note_type as title, tn.priority,
      tn.content, tn.content as notes, tn.attachments,
      tn.visibility_scope as visibilityScope,
      CASE WHEN tn.visibility_scope = 'individual' THEN 'INDIVIDUAL' ELSE 'ALL_TEAM' END as targetType,
      tn.assigned_to_user_id as assignedToUserId, tn.assigned_to_user_id as assignedTo,
      tn.assigned_to_user_name as assignedToUserName,
      tn.status, tn.execution_notes as executionNotes, tn.execution_proof_photo as executionProofPhoto,
      tn.execution_proof_photo as completionPhoto,
      tn.executed_at as executedAt, tn.executed_at as completedAt,
      tn.executed_by_id as completedBy,
      tn.closed_at as closedAt, tn.closed_by_id as closedBy,
      tn.created_at as createdAt, tn.updated_at as updatedAt
    FROM tree_notes tn
    LEFT JOIN users u ON tn.author_id = u.id
    ORDER BY tn.created_at DESC
  `);
  const charities = db.all('SELECT * FROM charities ORDER BY name ASC');
  const seasons = db.all('SELECT * FROM agricultural_seasons ORDER BY season_year DESC');
  const fertilizerSeasonBalances = db.all('SELECT * FROM fertilizer_season_balances ORDER BY season_year DESC');

  const companies = db.all('SELECT id, name, trade_name as tradeName, commercial_registry as commercialRegistry, tax_number as taxNumber, email, phone, currency_code as currencyCode, logo, tier FROM companies');
  const projects = db.all('SELECT id, company_id as companyId, name, code_prefix as codePrefix, location_name as locationName, area_feddan as areaFeddan, timezone FROM projects');
  const settingsRows = db.all('SELECT key, value FROM system_settings');
  const systemSettings = publicSettings(settingsRows);

  const auditLogs = db.all(`
    SELECT id, user_id as user, action, entity_name as module, entity_id as targetId, details, ip_address, created_at as at
    FROM audit_logs 
    ORDER BY created_at DESC 
    LIMIT 60
  `).map(a => {
    let det = {};
    try { det = typeof a.details === 'string' ? JSON.parse(a.details) : (a.details || {}); } catch(e){}
    const localized = formatAuditLogTitleAndSummary(a.action, a.module, a.targetId, det);
    return {
      id: a.id,
      at: a.at,
      user: a.user,
      action: a.action,
      module: a.module,
      targetId: a.targetId,
      details: det,
      summary: localized.summary || det.summary,
      title: localized.title || det.title,
      severity: det.severity || 'info',
      device: a.ip_address || 'Server'
    };
  });

  const payload = {
    companies,
    projects,
    settings: systemSettings,
    users,
    sectors,
    plots,
    userPlots,
    palms,
    operations,
    treeNotes,
    fertilizers,
    fertilizerVouchers,
    offshoots,
    yields,
    auditLogs,
    zakat,
    crops,
    cropPlantingSources,
    nurseryPrepTypes,
    propagationSourceTypes,
    cropVarieties,
    operationCategories,
    operationTypes,
    charities,
    treeHealthStatuses,
    treeOriginTypes,
    yieldQualityGrades,
    approvalStatuses,
    syncStatuses,
    seasons,
    fertilizerSeasonBalances,
    investors,
    contracts: investmentContracts,
    contractPlots,
    workerAssignedPlots,
    contractTemplates,
    contractInvoices,
    availableRoles,
    _syncMeta: syncMeta
  };
  normalizeTimestamps(payload);
  return payload;
}

// SQLite CURRENT_TIMESTAMP values ("2026-10-04 19:05:12") are UTC but browsers read them as local time.
// Rewrite them as ISO-UTC ("2026-10-04T19:05:12Z") for every *At / *_at / at field in the payload lists.
const SQLITE_TS = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;
function normalizeTimestamps(payload) {
  for (const key of Object.keys(payload)) {
    const list = payload[key];
    if (!Array.isArray(list) || !list.length || typeof list[0] !== 'object') continue;
    const tsKeys = Object.keys(list[0]).filter(k => k === 'at' || k.endsWith('At') || k.endsWith('_at'));
    if (!tsKeys.length) continue;
    for (const row of list) {
      for (const k of tsKeys) {
        const v = row[k];
        if (typeof v === 'string' && SQLITE_TS.test(v)) row[k] = v.replace(' ', 'T') + 'Z';
      }
    }
  }
}

// The data object (shared by the classic and v2 formats). The classic JSON/gzip is only
// produced when an older app asks for it.
function getBootstrapData() {
  // Trees/operations changed by a raw write (or a script) since the cache was built → rebuild
  if (_cachedBootstrapData && _cachedBootstrapData._syncMeta && _cachedBootstrapData._syncMeta.version !== currentSyncVersion()) {
    invalidateBootstrapCache();
  }
  if (!_cachedBootstrapData) _cachedBootstrapData = buildBootstrapPayload();
  return _cachedBootstrapData;
}

async function getOrBuildBootstrap() {
  if (_cachedBootstrapGzip && _cachedBootstrapRaw && _cachedBootstrapEtag) {
    return { gzip: _cachedBootstrapGzip, raw: _cachedBootstrapRaw, etag: _cachedBootstrapEtag };
  }
  if (_bootstrapBuildingPromise) {
    return _bootstrapBuildingPromise;
  }
  _bootstrapBuildingPromise = (async () => {
    try {
      const data = getBootstrapData();
      const { _syncMeta, ...publicData } = data;
      const raw = Buffer.from(JSON.stringify(publicData), 'utf8');
      const gzip = await new Promise((resolve, reject) => {
        zlib.gzip(raw, { level: 6 }, (err, res) => {
          if (err) reject(err);
          else resolve(res);
        });
      });
      const etag = '"bs_' + Date.now().toString(36) + '_' + raw.length + '"';
      _cachedBootstrapRaw = raw;
      _cachedBootstrapGzip = gzip;
      _cachedBootstrapEtag = etag;
      return { gzip, raw, etag };
    } finally {
      _bootstrapBuildingPromise = null;
    }
  })();
  return _bootstrapBuildingPromise;
}

// ---------------------------------------------------------------------------
// Compact + incremental sync for the two big lists: trees (palms) and field operations.
// Used by bootstrap "v2" (the current app). Older cached apps keep the classic format.
// ---------------------------------------------------------------------------
const PALM_SELECT = `
    SELECT 
      id, code, crop_code as cropId, crop_id as cropNumericId, source_type as source, 
      variety_id as varietyId, variety_name as variety,
      sector_id as sectorId, sector_name as sectorName,
      plot_id as plot, plot_name as plotName,
      seq_no as seq, plant_date as plantDate, 
      origin_id as originId, origin_type as originType, origin_label as originLabel,
      supplier, notes, parent_palm_id as parentId, parent_palm_code as parentCode,
      temp_code as tempCode, status_id as statusId, status_code as statusCode, 
      status, status_en as statusEn, badge_color as badgeColor, badge_bg as badgeBg,
      offshoot_count as offshootCount, lineage_path as lineagePath,
      gps_lat, gps_lng, nursery_age_months as nurseryAgeMonths,
      is_archived as archived,
      created_by as createdBy, created_at as createdAt,
      modified_by as modifiedBy, modified_at as modifiedAt
    FROM v_palms`;
const PALM_VISIBLE = `(is_deleted = 0 OR is_deleted IS NULL) AND (supplier IS NULL OR supplier != 'STRESS_TEST_SUITE')
      AND sector_id IN (SELECT id FROM sectors WHERE is_deleted = 0 OR is_deleted IS NULL)`;

const OP_SELECT = `
    SELECT 
      id, palm_id as palmId, palm_code as palmCode, type_id as typeId, type_name as typeName,
      worker_id as workerId, worker_name as workerName, performed_at as at, 
      status_id as statusId, status_code as status, status_label as statusLabel,
      approval_id as approvalId, approval_status as approval, approval_label as approvalLabel,
      approval_badge_color as approvalBadgeColor,
      batch_id as batchId, target_level as targetLevel, sector_id as sectorId, plot_id as plotId,
      tree_count as treeCount, scope_type as scopeType, is_critical as isCritical,
      supervisor_notes as supervisorNote, worker_notes as notes, photos,
      created_at as createdAt,
      modified_by as modifiedBy, modified_at as modifiedAt
    FROM v_operations`;
const OP_VISIBLE = `(palm_id IS NULL OR palm_id NOT IN (SELECT id FROM palms WHERE supplier = 'STRESS_TEST_SUITE'))`;

function queryPalms(extraWhere = '', ...params) {
  const rows = db.all(`${PALM_SELECT}\n    WHERE ${PALM_VISIBLE}${extraWhere ? ' AND ' + extraWhere : ''}\n    ORDER BY id ASC`, ...params);
  rows.forEach(p => {
    p.gps = (p.gps_lat && p.gps_lng) ? `${p.gps_lat}, ${p.gps_lng}` : (p.gps || '');
  });
  return rows;
}

function queryOperations(extraWhere = '', ...params) {
  return db.all(`${OP_SELECT}\n    WHERE ${OP_VISIBLE}${extraWhere ? ' AND ' + extraWhere : ''}\n    ORDER BY performed_at DESC`, ...params);
}

// Changes only when a tree row is inserted, updated or deleted (operations share the clock but not this stamp)
function palmsStamp() {
  try {
    const a = db.get('SELECT MAX(row_version) AS v, COUNT(*) AS n FROM palms');
    const t = db.get('SELECT MAX(row_version) AS v FROM palms_tombstones');
    return `${a.v || 0}:${a.n}:${t.v || 0}`;
  } catch { return null; }
}

function currentSyncVersion() {
  try { return db.get('SELECT version FROM sync_clock WHERE id = 1')?.version || 0; } catch { return 0; }
}

const hashRows = parts => crypto.createHash('sha1').update(JSON.stringify(parts)).digest('hex').slice(0, 16);

// FNV-1a over each id, XOR-combined: order-independent checksum the app can recompute.
function idHash(ids) {
  let acc = 0;
  for (const id of ids) {
    const str = String(id);
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    acc = (acc ^ h) >>> 0;
  }
  return acc;
}

// For each list: how to query it, which ids are visible, and which lookup tables feed the
// names/labels it displays (if any of those change, a delta is not enough → full reload).
const SYNC = {
  palms: {
    table: 'palms',
    query: queryPalms,
    visibleIds: () => db.all(`SELECT id FROM v_palms WHERE ${PALM_VISIBLE}`).map(r => r.id),
    lookupsHash: () => hashRows([
      db.all('SELECT id, code, name FROM crops ORDER BY id'),
      db.all('SELECT id, name FROM crop_varieties ORDER BY id'),
      db.all('SELECT * FROM tree_health_statuses ORDER BY id'),
      db.all('SELECT * FROM tree_origin_types ORDER BY id'),
      db.all('SELECT id, name, is_deleted FROM sectors ORDER BY id'),
      db.all('SELECT id, name, sector_id FROM plots ORDER BY id')
    ])
  },
  operations: {
    table: 'operations',
    query: queryOperations,
    visibleIds: () => db.all(`SELECT id FROM v_operations WHERE ${OP_VISIBLE}`).map(r => r.id),
    lookupsHash: () => hashRows([
      db.all('SELECT id, name, scope_type, is_critical FROM operation_types ORDER BY id'),
      db.all('SELECT id, full_name FROM users ORDER BY id'),
      db.all('SELECT * FROM operation_sync_statuses ORDER BY id'),
      db.all('SELECT * FROM operation_approval_statuses ORDER BY id'),
      db.all('SELECT id, name FROM sectors ORDER BY id'),
      db.all('SELECT id, name FROM plots ORDER BY id')
    ])
  }
};

function toColumnar(list) {
  const cols = list.length ? Object.keys(list[0]) : [];
  return { cols, rows: list.map(o => cols.map(c => o[c])) };
}

function buildEntitySync(name, level, list, meta, since, clientLookups) {
  const cfg = SYNC[name];
  const sinceNum = Number(since) || 0;
  const liveLookups = cfg.lookupsHash();
  const liveVersion = currentSyncVersion();
  const canDelta = level !== 'investor' && sinceNum > 0 && clientLookups === liveLookups && sinceNum <= liveVersion;

  if (!canDelta) {
    return { mode: 'full', ...toColumnar(list), deleted: [], version: meta.version, lookupsHash: meta.lookups[name], total: list.length, idHash: idHash(list.map(r => r.id)) };
  }
  const changedIds = db.all(`SELECT id FROM ${cfg.table} WHERE row_version > ?`, sinceNum).map(r => r.id);
  const changed = changedIds.length ? cfg.query(`id IN (SELECT id FROM ${cfg.table} WHERE row_version > ?)`, sinceNum) : [];
  normalizeTimestamps({ changed });
  const visible = new Set(changed.map(r => r.id));
  const deleted = [
    ...changedIds.filter(id => !visible.has(id)),
    ...db.all(`SELECT id FROM ${cfg.table}_tombstones WHERE row_version > ?`, sinceNum).map(r => r.id)
  ];
  const ids = cfg.visibleIds();
  return { mode: 'delta', ...toColumnar(changed), deleted, version: liveVersion, lookupsHash: liveLookups, total: ids.length, idHash: idHash(ids) };
}

// opts: { palmsSince, palmsLookups, opsSince, opsLookups }
// The app checks total/idHash after merging a delta and asks for a full list if anything is off.
async function getBootstrapV2ForUser(user, opts = {}) {
  const data = getBootstrapData();
  const meta = data._syncMeta;
  const level = access.accessLevel(user);
  const scoped = level === 'full' ? data : access.scopeBootstrap(data, user);
  const { palms, operations, _syncMeta, ...rest } = scoped;

  const palmsSync = buildEntitySync('palms', level, palms, meta, opts.palmsSince, opts.palmsLookups);
  const operationsSync = buildEntitySync('operations', level, operations, meta, opts.opsSince, opts.opsLookups);

  const raw = Buffer.from(JSON.stringify({ ...rest, palmsSync, operationsSync }), 'utf8');
  const gzip = await new Promise((resolve, reject) => zlib.gzip(raw, { level: 6 }, (err, r) => err ? reject(err) : resolve(r)));
  return { raw, gzip };
}

function getCachedBootstrapData() {
  return _cachedBootstrapData;
}

module.exports = {
  invalidateBootstrapCache,
  getBootstrapV2ForUser,
  getBootstrapForUser,
  buildBootstrapPayload,
  getOrBuildBootstrap,
  getCachedBootstrapData
};
