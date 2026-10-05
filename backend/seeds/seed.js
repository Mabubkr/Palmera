const db = require('../db');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');

// On an empty database:
//   default            → reference data + one admin account with a random temporary password (printed once).
//   SEED_DEMO_DATA=true → the full demo farm (demo users with password DEMO_PASSWORD, default 1234; sectors, trees, offshoots, zakat).
const SEED_DEMO = process.env.SEED_DEMO_DATA === 'true';

function seedDatabase() {
  console.log('Seeding PalmTrace database...');

  // 1. Users
  const userCount = db.get('SELECT COUNT(*) as count FROM users');
  if (userCount.count === 0 && !SEED_DEMO) {
    const tempPassword = 'Palm-' + crypto.randomBytes(6).toString('base64url');
    db.db.prepare(`INSERT INTO users (id, username, password_hash, full_name, role, phone, must_change_password) VALUES (?, ?, ?, ?, ?, ?, 1)`)
      .run('u1', 'admin', bcrypt.hashSync(tempPassword, 10), 'مدير النظام', 'admin', '');
    console.log('==============================================================');
    console.log(' New database: administrator account created');
    console.log(`   username: admin    temporary password: ${tempPassword}`);
    console.log(' You will be asked to choose a new password at first login.');
    console.log('==============================================================');
  }
  if (userCount.count === 0 && SEED_DEMO) {
    // DEMO_PASSWORD (set it on any public server) replaces the default 1234 for every demo account
    const demoPassword = String(process.env.DEMO_PASSWORD || '').trim() || '1234';
    const defaultHash = bcrypt.hashSync(demoPassword, 10);
    const users = [
      { id: 'u1', username: 'admin', password_hash: defaultHash, full_name: 'إدارة الشركة', role: 'admin', phone: '01000000001' },
      { id: 'u2', username: 'engineer', password_hash: defaultHash, full_name: 'م. خالد المشرف', role: 'engineer', phone: '01000000002' },
      { id: 'u3', username: 'worker', password_hash: defaultHash, full_name: 'أحمد الميداني', role: 'worker', phone: '01000000003' },
      { id: 'u4', username: 'investor', password_hash: defaultHash, full_name: 'أحمد بن محمد العتيبي', role: 'investor', phone: '01000000004' },
      { id: 'u5', username: 'nursery', password_hash: defaultHash, full_name: 'سالم مدير المشتل', role: 'nursery_mgr', phone: '01000000005' },
      { id: 'u6', username: 'storage', password_hash: defaultHash, full_name: 'م. طارق أمين المخزن', role: 'warehouse_mgr', phone: '01000000006' },
      { id: 'u7', username: 'care', password_hash: defaultHash, full_name: 'سارة مديرة رعاية العملاء والزكاة', role: 'customer_care', phone: '01000000007' },
      { id: 'u8', username: 'inv2', password_hash: defaultHash, full_name: 'عبد الله سعد القحطاني', role: 'investor', phone: '0501234567' },
      { id: 'u9', username: 'inv3', password_hash: defaultHash, full_name: 'محمد عبد الرحمن الشهري', role: 'investor', phone: '0559876543' },
      { id: 'u10', username: 'inv4', password_hash: defaultHash, full_name: 'فيصل خالد الدوسري', role: 'investor', phone: '0561122334' }
    ];

    const insUser = db.db.prepare(`INSERT INTO users (id, username, password_hash, full_name, role, phone) VALUES (?, ?, ?, ?, ?, ?)`);
    users.forEach(u => insUser.run(u.id, u.username, u.password_hash, u.full_name, u.role, u.phone));
    console.log(`Inserted ${users.length} users with bcrypt password hashes.`);
  }

  const isFreshInstall = (userCount.count === 0) && SEED_DEMO;

  // 2. Sectors & Plots
  const sectorCount = db.get('SELECT COUNT(*) as count FROM sectors');
  if (isFreshInstall && sectorCount.count === 0) {
    const sectors = [
      { id: '03', name: 'القطاع 03' },
      { id: '05', name: 'القطاع 05' }
    ];
    const insSec = db.db.prepare(`INSERT INTO sectors (id, name) VALUES (?, ?)`);
    sectors.forEach(s => insSec.run(s.id, s.name));

    const plots = [
      { id: '03-12A', sector_id: '03', plot_no: '12', part_letter: 'A', name: 'قطعة 12A' },
      { id: '03-12B', sector_id: '03', plot_no: '12', part_letter: 'B', name: 'قطعة 12B' },
      { id: '05-07B', sector_id: '05', plot_no: '07', part_letter: 'B', name: 'قطعة 07B' }
    ];
    const insPlot = db.db.prepare(`INSERT INTO plots (id, sector_id, plot_no, part_letter, name) VALUES (?, ?, ?, ?, ?)`);
    plots.forEach(p => insPlot.run(p.id, p.sector_id, p.plot_no, p.part_letter, p.name));

    // User plots
    const userPlots = [
      { id: 'up1', user_id: 'u2', plot_id: '03-12A', permission_type: 'engineer' },
      { id: 'up2', user_id: 'u2', plot_id: '03-12B', permission_type: 'engineer' },
      { id: 'up3', user_id: 'u2', plot_id: '05-07B', permission_type: 'engineer' },
      { id: 'up4', user_id: 'u3', plot_id: '03-12A', permission_type: 'work' },
      { id: 'up5', user_id: 'u3', plot_id: '03-12B', permission_type: 'work' },
      { id: 'up6', user_id: 'u4', plot_id: '03-12A', permission_type: 'investor_view' },
      { id: 'up7', user_id: 'u8', plot_id: '03-12B', permission_type: 'investor_view' },
      { id: 'up8', user_id: 'u9', plot_id: '05-07B', permission_type: 'investor_view' },
      { id: 'up9', user_id: 'u10', plot_id: '03-12A', permission_type: 'investor_view' }
    ];
    const insUP = db.db.prepare(`INSERT OR IGNORE INTO user_plots (id, user_id, plot_id, permission_type) VALUES (?, ?, ?, ?)`);
    userPlots.forEach(up => insUP.run(up.id, up.user_id, up.plot_id, up.permission_type));
    console.log('Inserted sectors, plots, and user permissions.');
  }

  // 3. Crops & Varieties
  const cropCount = db.get('SELECT COUNT(*) as count FROM crops');
  if (cropCount.count === 0) {
    db.run(
      `INSERT INTO crops (id, code, name, single_label, plural_label, offspring_label, code_prefix, primary_source_code, usage_type, yield_name, unit, icon, notes, sources_json) 
       VALUES (1, 'palm', 'نخيل التمر', 'نخلة', 'نخيل', 'فسيلة', 'F', 'F', 'main', 'تمر', 'كجم', 'palm', 'محصول رئيسي', ?)`,
      JSON.stringify([{ code: 'F', name: 'فسيلة' }, { code: 'N', name: 'زراعة أنسجة (نخيل)' }])
    );
    db.run(
      `INSERT INTO crops (id, code, name, single_label, plural_label, offspring_label, code_prefix, primary_source_code, usage_type, yield_name, unit, icon, notes, sources_json) 
       VALUES (2, 'olive', 'أشجار الزيتون', 'شجرة زيتون', 'أشجار زيتون', 'عقلة خضرية', 'O', 'C', 'intercrop', 'زيتون', 'كجم', 'olive', 'محصول بيني', ?)`,
      JSON.stringify([{ code: 'C', name: 'عقلة خضرية' }, { code: 'S', name: 'شتلة مطعومة' }, { code: 'T', name: 'زراعة أنسجة (أشجار)' }])
    );

    const defaultSources = [
      { id: 'pst_f', code: 'F', name: 'فسيلة', notes: 'خلفة أرضية مأخوذة من النخلة الأم', default_crop_id: 1 },
      { id: 'pst_n', code: 'N', name: 'زراعة أنسجة (نخيل)', notes: 'نخيل نسيجي منتج مخبرياً', default_crop_id: 1 },
      { id: 'pst_c', code: 'C', name: 'عقلة خضرية', notes: 'عقل ساقية غضة أو نصف خشبية مجذرة', default_crop_id: 2 },
      { id: 'pst_s', code: 'S', name: 'شتلة مطعومة', notes: 'شتلة مركبة على أصل بري مقاوم', default_crop_id: 2 },
      { id: 'pst_t', code: 'T', name: 'زراعة أنسجة (أشجار)', notes: 'شتلات نسيجية مخبرية للأشجار', default_crop_id: 2 },
      { id: 'pst_b', code: 'B', name: 'شتلة بذرية', notes: 'شتلة منتجة من إنبات البذور مباشرة', default_crop_id: null },
      { id: 'pst_l', code: 'L', name: 'ترقيد هوائي', notes: 'إكثار خضري بتجذير الأغصان الهوائية', default_crop_id: null }
    ];
    const insPst = db.db.prepare(`INSERT OR REPLACE INTO propagation_source_types (id, code, name, notes, default_crop_id) VALUES (?, ?, ?, ?, ?)`);
    defaultSources.forEach(s => insPst.run(s.id, s.code, s.name, s.notes, s.default_crop_id));

    const vars = [
      { id: 'cv1', crop_id: 1, name: 'خلاص', usage_desc: 'تمور فاخرة' },
      { id: 'cv2', crop_id: 1, name: 'سكري', usage_desc: 'تمور' },
      { id: 'cv3', crop_id: 1, name: 'برحي', usage_desc: 'رطب وتمور' },
      { id: 'cv4', crop_id: 1, name: 'عجوة', usage_desc: 'تمور المدينة' },
      { id: 'cv5', crop_id: 1, name: 'مجدول', usage_desc: 'تصدير فاخر' },
      { id: 'cv6', crop_id: 1, name: 'سيوي (صعيدي)', usage_desc: 'تمور الواحات وتصنيع' },
      { id: 'cv7', crop_id: 2, name: 'بيكوال', usage_desc: 'ثنائي الغرض (زيت ومائدة)' },
      { id: 'cv8', crop_id: 2, name: 'مانزانيلا', usage_desc: 'تخليل مائدة ممتاز' },
      { id: 'cv9', crop_id: 1, name: 'صقعي', usage_desc: 'تمور فاخرة' }
    ];
    const insVar = db.db.prepare(`INSERT INTO crop_varieties (id, crop_id, name, usage_desc) VALUES (?, ?, ?, ?)`);
    vars.forEach(v => insVar.run(v.id, v.crop_id, v.name, v.usage_desc));
    console.log('Inserted crops, propagation sources, and varieties.');

    // Seed Lookup Tables
    const insStatus = db.db.prepare(`INSERT OR REPLACE INTO tree_health_statuses (id, code, label_ar, label_en, badge_color, badge_bg, requires_alert) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    insStatus.run(1, 'healthy', 'سليمة', 'Healthy', '#16A34A', '#DCFCE7', 0);
    insStatus.run(2, 'observation', 'تحت المراقبة', 'Under Observation', '#D97706', '#FEF3C7', 1);
    insStatus.run(3, 'infected', 'مصابة', 'Infected', '#DC2626', '#FEE2E2', 1);
    insStatus.run(4, 'uprooted', 'مقلوعة', 'Uprooted', '#64748B', '#F1F5F9', 0);
    insStatus.run(5, 'dead', 'ميتة', 'Dead', '#0F172A', '#E2E8F0', 0);

    const insOrigin = db.db.prepare(`INSERT OR REPLACE INTO tree_origin_types (id, code, label_ar, label_en) VALUES (?, ?, ?, ?)`);
    insOrigin.run(1, 'internal', 'داخلي / ترقيد بالمزرعة', 'Internal Farm');
    insOrigin.run(2, 'purchased', 'شراء خارجي', 'Purchased External');
    insOrigin.run(3, 'tissue_culture', 'زراعة أنسجة', 'Tissue Culture');
    insOrigin.run(4, 'offshoot', 'فسيلة أرضية/هوائية', 'Offshoot');

    const insQ = db.db.prepare(`INSERT OR REPLACE INTO yield_quality_grades (id, code, label_ar, label_en, badge_color, badge_bg) VALUES (?, ?, ?, ?, ?, ?)`);
    insQ.run(1, 'grade_a', 'ممتاز / نخب أول', 'Grade A / Premium', '#16A34A', '#DCFCE7');
    insQ.run(2, 'grade_b', 'جيد / نخب ثانٍ', 'Grade B', '#2563EB', '#DBEAFE');
    insQ.run(3, 'grade_c', 'تالف / فرز', 'Cull / Low Grade', '#D97706', '#FEF3C7');

    const insAppr = db.db.prepare(`INSERT OR REPLACE INTO operation_approval_statuses (id, code, label_ar, label_en, badge_color, badge_bg) VALUES (?, ?, ?, ?, ?, ?)`);
    insAppr.run(1, 'pending', 'قيد الاعتماد', 'Pending Review', '#D97706', '#FEF3C7');
    insAppr.run(2, 'approved', 'معتمد', 'Approved', '#16A34A', '#DCFCE7');
    insAppr.run(3, 'rejected', 'مرفوض', 'Rejected', '#DC2626', '#FEE2E2');

    const insSync = db.db.prepare(`INSERT OR REPLACE INTO operation_sync_statuses (id, code, label_ar, label_en, badge_color, badge_bg) VALUES (?, ?, ?, ?, ?, ?)`);
    insSync.run(1, 'draft', 'مسودة محلية', 'Draft', '#64748B', '#F1F5F9');
    insSync.run(2, 'pending_sync', 'قيد المزامنة', 'Pending Sync', '#D97706', '#FEF3C7');
    insSync.run(3, 'synced', 'تمت المزامنة', 'Synced', '#16A34A', '#DCFCE7');
  }

  // 4. Operation categories and types
  const catCount = db.get('SELECT COUNT(*) as count FROM operation_categories');
  if (catCount.count === 0) {
    const cats = [
      { id: 'c_d', name: 'دورية' },
      { id: 'c_w', name: 'شتوية' },
      { id: 'c_f', name: 'تسميد' },
      { id: 'c_i', name: 'عارضة' },
      { id: 'c_o', name: 'أخرى' }
    ];
    const insCat = db.db.prepare(`INSERT INTO operation_categories (id, name) VALUES (?, ?)`);
    cats.forEach(c => insCat.run(c.id, c.name));

    const types = [
      { id: 'op1', category_id: 'c_d', name: 'تقليم', requires_material: 0, allowed_kinds: null, crop_id: 'palm' },
      { id: 'op2', category_id: 'c_d', name: 'تكريب', requires_material: 0, allowed_kinds: null, crop_id: 'palm' },
      { id: 'op3', category_id: 'c_d', name: 'تلقيح', requires_material: 0, allowed_kinds: null, crop_id: 'palm' },
      { id: 'op4', category_id: 'c_d', name: 'تكييس', requires_material: 0, allowed_kinds: null, crop_id: 'palm' },
      { id: 'op5', category_id: 'c_w', name: 'خدمة شتوية', requires_material: 0, allowed_kinds: null, crop_id: 'all' },
      { id: 'op6', category_id: 'c_f', name: 'تسميد عضوي', requires_material: 1, allowed_kinds: JSON.stringify(['عضوي']), crop_id: 'all' },
      { id: 'op7', category_id: 'c_f', name: 'تسميد كيميائي', requires_material: 1, allowed_kinds: JSON.stringify(['كيميائي']), crop_id: 'all' },
      { id: 'op_micro', category_id: 'c_f', name: 'تسميد وعناصر صغرى', requires_material: 1, allowed_kinds: JSON.stringify(['عناصر صغرى']), crop_id: 'all' },
      { id: 'op_amino', category_id: 'c_f', name: 'أحماض أمينية ومحفزات نمو', requires_material: 1, allowed_kinds: JSON.stringify(['أحماض أمينية']), crop_id: 'all' },
      { id: 'op_soil', category_id: 'c_f', name: 'مخصبات ومعالجة تربة', requires_material: 1, allowed_kinds: JSON.stringify(['مخصب']), crop_id: 'all' },
      { id: 'op8', category_id: 'c_i', name: 'إصابة سوسة', requires_material: 1, allowed_kinds: JSON.stringify(['مبيد']), crop_id: 'palm' },
      { id: 'op9', category_id: 'c_i', name: 'كسر سعف', requires_material: 0, allowed_kinds: null, crop_id: 'palm' },
      { id: 'op10', category_id: 'c_o', name: 'ري إضافي', requires_material: 0, allowed_kinds: null, crop_id: 'all' },
      { id: 'op11', category_id: 'c_d', name: 'تقليم تربية وإثمار', requires_material: 0, allowed_kinds: null, crop_id: 'olive' },
      { id: 'op12', category_id: 'c_i', name: 'مكافحة ذبابة الزيتون', requires_material: 1, allowed_kinds: JSON.stringify(['مبيد']), crop_id: 'olive' },
      { id: 'op_pest', category_id: 'c_i', name: 'مكافحة وقائية وعلاجية', requires_material: 1, allowed_kinds: JSON.stringify(['مبيد']), crop_id: 'all' }
    ];
    const insType = db.db.prepare(`INSERT OR REPLACE INTO operation_types (id, category_id, name, requires_material, allowed_kinds, crop_id) VALUES (?, ?, ?, ?, ?, ?)`);
    types.forEach(t => insType.run(t.id, t.category_id, t.name, t.requires_material, t.allowed_kinds, t.crop_id));
    console.log('Inserted operation types.');
  }

  // 5. Fertilizers
  const fertCount = db.get('SELECT COUNT(*) as count FROM fertilizers');
  if (fertCount.count === 0) {
    const ferts = [
      { id: 'ft1', name: 'سماد عضوي معالج', kind: 'عضوي', unit: 'كجم', stock: 15000, allocated: 3000, consumed: 8500, min_alert: 2000, unit_cost: 1.8 },
      { id: 'ft2', name: 'NPK 20-20-20', kind: 'كيميائي', unit: 'كجم', stock: 2400, allocated: 500, consumed: 1200, min_alert: 400, unit_cost: 14.5 },
      { id: 'ft3', name: 'سلفات نشادر 20.6%', kind: 'كيميائي', unit: 'كجم', stock: 3500, allocated: 600, consumed: 2100, min_alert: 500, unit_cost: 9.0 },
      { id: 'ft6', name: 'مبيد سوسة النخيل المتخصص', kind: 'مبيد', unit: 'لتر', stock: 120, allocated: 25, consumed: 64, min_alert: 30, unit_cost: 180.0 }
    ];
    const insFert = db.db.prepare(`INSERT INTO fertilizers (id, name, kind, unit, stock, allocated, consumed, min_alert, unit_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    ferts.forEach(f => insFert.run(f.id, f.name, f.kind, f.unit, f.stock, f.allocated, f.consumed, f.min_alert, f.unit_cost));
    console.log('Inserted fertilizers.');
  }

  // 6. Palms
  const palmCount = db.get('SELECT COUNT(*) as count FROM palms');
  if (isFreshInstall && palmCount.count === 0) {
    const palms = [
      { id: 'p1', code: '03-12A-F045-0325', crop_id: 'palm', source_type: 'F', variety_id: 'cv1', sector_id: '03', plot_id: '03-12A', seq_no: '045', plant_date: '2025-03-01', origin_id: 1, supplier: '', notes: 'إنتاج داخلي', parent_palm_id: null, temp_code: null, status_id: 1, offshoot_count: 2, gps_lat: 24.7136, gps_lng: 46.6753, nursery_age_months: 10 },
      { id: 'p2', code: '03-12A-F046-0325', crop_id: 'palm', source_type: 'F', variety_id: 'cv2', sector_id: '03', plot_id: '03-12A', seq_no: '046', plant_date: '2025-03-01', origin_id: 2, supplier: 'مشتل القصيم', notes: '', parent_palm_id: null, temp_code: null, status_id: 1, offshoot_count: 1, gps_lat: 24.7138, gps_lng: 46.6755, nursery_age_months: 10 },
      { id: 'p3', code: '05-07B-N018-1124', crop_id: 'palm', source_type: 'N', variety_id: 'cv3', sector_id: '05', plot_id: '05-07B', seq_no: '018', plant_date: '2024-11-01', origin_id: 2, supplier: 'مختبر الأنسجة', notes: 'نسيج أنسجة', parent_palm_id: null, temp_code: null, status_id: 2, offshoot_count: 0, gps_lat: 24.7140, gps_lng: 46.6760, nursery_age_months: 10 },
      { id: 'p4', code: '03-12B-F010-0426', crop_id: 'palm', source_type: 'F', variety_id: 'cv1', sector_id: '03', plot_id: '03-12B', seq_no: '010', plant_date: '2026-04-01', origin_id: 1, supplier: '', notes: 'فسيلة من الأم', parent_palm_id: 'p1', temp_code: '03-12A-F045-0325-OS01-0825', status_id: 1, offshoot_count: 0, gps_lat: 24.7145, gps_lng: 46.6765, nursery_age_months: 0 }
    ];
    const insPalm = db.db.prepare(`INSERT INTO palms (code, crop_id, source_type, variety_id, sector_id, plot_id, seq_no, plant_date, origin_id, supplier, notes, parent_palm_id, temp_code, status_id, offshoot_count, gps_lat, gps_lng, nursery_age_months) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const palmIds = {};
    palms.forEach(p => {
      const r = insPalm.run(p.code, 1, p.source_type, p.variety_id, p.sector_id, p.plot_id, p.seq_no, p.plant_date, p.origin_id, p.supplier, p.notes, p.parent_palm_id ? palmIds[p.parent_palm_id] : null, p.temp_code, p.status_id, p.offshoot_count, p.gps_lat, p.gps_lng, p.nursery_age_months);
      palmIds[p.id] = Number(r.lastInsertRowid);
    });
    seedDatabase._palmIds = palmIds;
    console.log('Inserted palms.');
  }

  // 7. Offshoots
  const offCount = db.get('SELECT COUNT(*) as count FROM offshoots');
  if (isFreshInstall && offCount.count === 0) {
    const offshoots = [
      { id: 'os1', mother_id: 'p1', temp_code: '03-12A-F045-0325-OS01-0825', seq_no: '01', separation_date: '2025-08-12', weight_kg: 12, diameter_cm: 24, status_id: 1, variety_id: 'cv1', origin_id: 1, nursery_stage: 'planted', planted_palm_id: 'p4', notes: 'زرعت في 12B' },
      { id: 'os2', mother_id: 'p1', temp_code: '03-12A-F045-0325-OS02-0626', seq_no: '02', separation_date: '2026-06-10', weight_kg: 11, diameter_cm: 22, status_id: 1, variety_id: 'cv1', origin_id: 1, nursery_stage: 'ready', planted_palm_id: null, notes: 'جاهزة للزراعة' }
    ];
    const insOff = db.db.prepare(`INSERT INTO offshoots (id, mother_id, temp_code, seq_no, separation_date, weight_kg, diameter_cm, status_id, variety_id, origin_id, nursery_stage, planted_palm_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const pid = ref => (ref && seedDatabase._palmIds) ? (seedDatabase._palmIds[ref] || null) : null;
    offshoots.forEach(o => insOff.run(o.id, pid(o.mother_id), o.temp_code, o.seq_no, o.separation_date, o.weight_kg, o.diameter_cm, o.status_id, o.variety_id, o.origin_id, o.nursery_stage, pid(o.planted_palm_id), o.notes));
    console.log('Inserted offshoots.');
  }

  // 8. Charities and Zakat
  const charCount = db.get('SELECT COUNT(*) as count FROM charities');
  if (SEED_DEMO && charCount.count === 0) {
    const charities = [
      { id: 'c1', name: 'جمعية البر والخدمات الخيرية', license_no: 'LIC-1442-882', city: 'الرياض', address: 'حي الروضة، طريق خريص', contact_person: 'الشيخ عبد العزيز التميمي', phone: '0112345678', email: 'zakat@albir.org', receive_type: 'both' },
      { id: 'c2', name: 'مؤسسة إكرام لحفظ النعمة والتمور', license_no: 'LIC-1443-305', city: 'القصيم', address: 'بريدة', contact_person: 'د. سليمان الرشيد', phone: '0163800000', email: 'ikram@dates.org', receive_type: 'kind' }
    ];
    const insChar = db.db.prepare(`INSERT INTO charities (id, name, license_no, city, address, contact_person, phone, email, receive_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    charities.forEach(c => insChar.run(c.id, c.name, c.license_no, c.city, c.address, c.contact_person, c.phone, c.email, c.receive_type));

    const zakat = !SEED_DEMO ? [] : [
      { id: 'z1', investor_id: 'u4', season: '2026', due_kg: 250, due_amount: 24750, choice_type: 'in_kind', charity_id: 'c1', status_id: 2, pledge_status: 'signed', pledge_signed_at: '2026-08-15 10:30:00', journey_stage: 'delivered' }
    ];
    const insZak = db.db.prepare(`INSERT INTO zakat_records (id, investor_id, season, due_kg, due_amount, choice_type, charity_id, status_id, pledge_status, pledge_signed_at, journey_stage) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    zakat.forEach(z => insZak.run(z.id, z.investor_id, z.season, z.due_kg, z.due_amount, z.choice_type, z.charity_id, z.status_id, z.pledge_status, z.pledge_signed_at, z.journey_stage));
    console.log('Inserted charities and zakat.');
  }

  console.log('Database seeding complete!');
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };

