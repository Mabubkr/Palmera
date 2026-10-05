const db = require('../db');

const REALISTIC_OPERATIONS = [
  // 1. دورية (c_d)
  { id: 'op_prune', category_id: 'c_d', name: 'تقليم وتشذيب السعف', requires_material: 0, allowed_kinds: null, crop_id: 'all', scope_type: 'both' },
  { id: 'op_takreep', category_id: 'c_d', name: 'تكريب وإزالة الكرب والأشواك', requires_material: 0, allowed_kinds: null, crop_id: 'palm', scope_type: 'both' },
  { id: 'op_pollinate', category_id: 'c_d', name: 'تلقيح وتأبير يدوي / آلي', requires_material: 0, allowed_kinds: null, crop_id: 'palm', scope_type: 'both' },
  { id: 'op_thinning', category_id: 'c_d', name: 'خف وتعديل وتدلية العذوق (التقويس)', requires_material: 0, allowed_kinds: null, crop_id: 'palm', scope_type: 'both' },
  { id: 'op_bagging', category_id: 'c_d', name: 'تكييس وحماية العذوق', requires_material: 0, allowed_kinds: null, crop_id: 'palm', scope_type: 'both' },
  { id: 'op_harvest', category_id: 'c_d', name: 'جني وحصاد التمور / الثمار', requires_material: 0, allowed_kinds: null, crop_id: 'all', scope_type: 'both' },
  { id: 'op_offshoot_sep', category_id: 'c_d', name: 'فصل ونقل الفسائل والسرطانات', requires_material: 0, allowed_kinds: null, crop_id: 'all', scope_type: 'both' },
  { id: 'op_routine_check', category_id: 'c_d', name: 'فحص دوري ومعاينة نمو', requires_material: 0, allowed_kinds: null, crop_id: 'all', scope_type: 'both' },

  // 2. شتوية (c_w)
  { id: 'op_winter_serv', category_id: 'c_w', name: 'خدمة شتوية وخنادق كمبوست', requires_material: 1, allowed_kinds: JSON.stringify(['عضوي', 'مخصب']), crop_id: 'all', scope_type: 'both' },
  { id: 'op_winter_spray', category_id: 'c_w', name: 'رش شتوي وقائي (زيوت معدنية ونحاس)', requires_material: 1, allowed_kinds: JSON.stringify(['مبيد', 'وقائي']), crop_id: 'all', scope_type: 'both' },
  { id: 'op_winter_basin', category_id: 'c_w', name: 'تطهير وتوسيع جور النخيل وتكريب شتوي', requires_material: 0, allowed_kinds: null, crop_id: 'all', scope_type: 'both' },
  { id: 'op_winter_protect', category_id: 'c_w', name: 'تدفئة وتغطية الفسائل الصغيرة ضد الصقيع', requires_material: 0, allowed_kinds: null, crop_id: 'all', scope_type: 'both' },
  { id: 'op_winter_till', category_id: 'c_w', name: 'عزيق وتقليب وتهوية تربة الأحواض', requires_material: 0, allowed_kinds: null, crop_id: 'all', scope_type: 'both' },
  { id: 'op_winter_irr', category_id: 'c_w', name: 'تنظيم ري السكون الشتوي', requires_material: 0, allowed_kinds: null, crop_id: 'all', scope_type: 'both' },

  // 3. تسميد (c_f)
  { id: 'op_fert_organic', category_id: 'c_f', name: 'تسميد عضوي متحلل (كمبوست / سبلة معقمة)', requires_material: 1, allowed_kinds: JSON.stringify(['عضوي']), crop_id: 'all', scope_type: 'both' },
  { id: 'op_fert_chemical', category_id: 'c_f', name: 'تسميد كيميائي NPK محبب (أرضي)', requires_material: 1, allowed_kinds: JSON.stringify(['كيميائي']), crop_id: 'all', scope_type: 'both' },
  { id: 'op_fert_fertigation', category_id: 'c_f', name: 'تسميد شبكة الري (Fertigation - نترات وحامض)', requires_material: 1, allowed_kinds: JSON.stringify(['كيميائي']), crop_id: 'all', scope_type: 'both' },
  { id: 'op_fert_foliar', category_id: 'c_f', name: 'رش ورقي عناصر صغرى (حديد / زنك / منجنيز / بورون)', requires_material: 1, allowed_kinds: JSON.stringify(['عناصر صغرى']), crop_id: 'all', scope_type: 'both' },
  { id: 'op_fert_amino', category_id: 'c_f', name: 'رش أحماض أمينية وهيوميك ومحفزات نمو', requires_material: 1, allowed_kinds: JSON.stringify(['أحماض أمينية']), crop_id: 'all', scope_type: 'both' },
  { id: 'op_fert_soil_cond', category_id: 'c_f', name: 'كبريت زراعي ومصلحات تربة وجبس زراعي', requires_material: 1, allowed_kinds: JSON.stringify(['مخصب']), crop_id: 'all', scope_type: 'both' },
  { id: 'op_fert_salinity', category_id: 'c_f', name: 'معالجة ملوحة التربة وطارد أملاح', requires_material: 1, allowed_kinds: JSON.stringify(['مخصب']), crop_id: 'all', scope_type: 'both' },

  // 4. عارضة / طوارئ (c_i)
  { id: 'op_inc_weevil', category_id: 'c_i', name: 'مكافحة وحقن سوسة النخيل الحمراء', requires_material: 1, allowed_kinds: JSON.stringify(['مبيد']), crop_id: 'palm', scope_type: 'both' },
  { id: 'op_inc_frond_break', category_id: 'c_i', name: 'علاج كسر وتدلي سعف أو عذق', requires_material: 0, allowed_kinds: null, crop_id: 'palm', scope_type: 'both' },
  { id: 'op_inc_borer', category_id: 'c_i', name: 'رش علاجي لحفار الساق والحشرات القشرية', requires_material: 1, allowed_kinds: JSON.stringify(['مبيد']), crop_id: 'all', scope_type: 'both' },
  { id: 'op_inc_rot', category_id: 'c_i', name: 'معالجة تعفن القمة النامية (الجمارة) أو خياس الطلع', requires_material: 1, allowed_kinds: JSON.stringify(['مبيد', 'وقائي']), crop_id: 'palm', scope_type: 'both' },
  { id: 'op_inc_dust_mite', category_id: 'c_i', name: 'مكافحة عنكبوت الغبار (الغبير)', requires_material: 1, allowed_kinds: JSON.stringify(['مبيد']), crop_id: 'palm', scope_type: 'both' },
  { id: 'op_inc_irr_leak', category_id: 'c_i', name: 'إصلاح تسريب مياه أو تلف شبكة الري', requires_material: 0, allowed_kinds: null, crop_id: 'all', scope_type: 'both' },

  // 5. أخرى (c_o)
  { id: 'op_oth_extra_irr', category_id: 'c_o', name: 'ري إضافي / غسيل أحواض التربة', requires_material: 0, allowed_kinds: null, crop_id: 'all', scope_type: 'both' },
  { id: 'op_oth_weed_clean', category_id: 'c_o', name: 'عزيق وإزالة حشائش وتنظيف محيط الجورة', requires_material: 0, allowed_kinds: null, crop_id: 'all', scope_type: 'both' },
  { id: 'op_oth_qr_tag', category_id: 'c_o', name: 'تثبيت وترقيم كود الأصل والباركود (QR)', requires_material: 0, allowed_kinds: null, crop_id: 'all', scope_type: 'both' },
  { id: 'op_oth_growth_metric', category_id: 'c_o', name: 'قياس وتوثيق ارتفاع النخلة ومحيط الساق', requires_material: 0, allowed_kinds: null, crop_id: 'all', scope_type: 'both' },
  { id: 'op_oth_archive_tree', category_id: 'c_o', name: 'أرشفة واستبعاد أصل ميت / غير منتج', requires_material: 0, allowed_kinds: null, crop_id: 'all', scope_type: 'both' }
];

function seedRealisticOperations() {
  console.log('--- Seeding Realistic Agricultural Operation Types ---');
  // Update existing legacy op5 (خدمة شتوية) to both scopes so it works on individual trees too
  try {
    db.run("UPDATE operation_types SET scope_type = 'both' WHERE id = 'op5' OR category_id = 'c_w'");
  } catch(e) {}

  for (const op of REALISTIC_OPERATIONS) {
    db.run(`
      INSERT INTO operation_types (id, category_id, name, requires_material, allowed_kinds, crop_id, scope_type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        category_id = excluded.category_id,
        name = excluded.name,
        requires_material = excluded.requires_material,
        allowed_kinds = excluded.allowed_kinds,
        crop_id = excluded.crop_id,
        scope_type = excluded.scope_type
    `, op.id, op.category_id, op.name, op.requires_material, op.allowed_kinds, op.crop_id, op.scope_type);
  }
  console.log(`✓ Seeded ${REALISTIC_OPERATIONS.length} realistic agricultural operations.`);
}

if (require.main === module) {
  seedRealisticOperations();
}

module.exports = { seedRealisticOperations, REALISTIC_OPERATIONS };

