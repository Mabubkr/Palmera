// Voice command understanding (frontend/js/voice-intent.js) — pure functions, no server needed.
const test = require('node:test');
const assert = require('node:assert');
const VI = require('../../frontend/js/voice-intent.js');

// A small farm shaped like the real one: sectors BSH01..BSH04, main plots NN with sub-plots NNA/NNB
const sectors = [1, 2, 3, 4].map(n => ({ id: `BSH0${n}`, name: `قطاع بشاير ${n}` }));
const plots = [];
const palms = [];
let pid = 1;
sectors.forEach(s => {
  for (let n = 1; n <= 8; n++) {
    const no = String(n).padStart(2, '0');
    plots.push({ id: `${s.id}-${no}`, name: `قطعة ${no}`, sector: s.id, plotNo: no, part: '' });
    ['A', 'B'].forEach(part => {
      const id = `${s.id}-${no}${part}`;
      plots.push({ id, name: `قطعة فرعية ${n}${part}`, sector: s.id, plotNo: no, part, parentPlotId: `${s.id}-${no}` });
      // only sub-plot A has trees, except plot 01 where both halves are numbered from 1
      const count = (part === 'A' || n === 1) ? 30 : 0;
      for (let k = 1; k <= count; k++) palms.push({ id: pid++, code: `${id}-F${String(k).padStart(3, '0')}-1026`, plot: id, seq: String(k).padStart(3, '0'), cropId: 'palm' });
    });
  }
});
const operationTypes = [
  { id: 'op10', name: 'ري إضافي', scopeType: 'bulk' },
  { id: 'op_irr_wash', name: 'ري إضافي / غسيل أحواض التربة', scopeType: 'both' },
  { id: 'op_fertigation', name: 'تسميد شبكة الري (Fertigation - نترات وحامض)', requiresMaterial: true, allowedKinds: ['كيميائي'] },
  { id: 'op6', name: 'تسميد عضوي', requiresMaterial: true, allowedKinds: ['عضوي'] },
  { id: 'op7', name: 'تسميد كيميائي', requiresMaterial: true, allowedKinds: ['كيميائي'] },
  { id: 'op8', name: 'إصابة سوسة', scopeType: 'individual', isCritical: true },
  { id: 'op_offshoot_sep', name: 'فصل ونقل الفسائل والسرطانات' },
  { id: 'op_offshoot', name: 'تنظيف وتجوير', scopeType: 'individual' },
  { id: 'op_archive', name: 'أرشفة نخلة', scopeType: 'individual' },
  { id: 'op_prune', name: 'تقليم وتشذيب السعف' },
  { id: 'op_harvest', name: 'جني وحصاد التمور / الثمار' },
  { id: 'op12', name: 'مكافحة ذبابة الزيتون', cropId: 'olive' },
  { id: 'op_pest', name: 'مكافحة وقائية وعلاجية' }
];
const fertilizers = [
  { id: 'ft1', name: 'سماد عضوي معالج', kind: 'عضوي', unit: 'كجم' },
  { id: 'ft3', name: 'سلفات نشادر 20.6%', kind: 'كيميائي', unit: 'كجم' }
];
const ctx = VI.prepCtx({ sectors, plots, palms, operationTypes, fertilizers });
const u = text => VI.understand(text, ctx);

test('spoken numbers become digits (Egyptian and MSA)', () => {
  const n = s => VI.wordsToNumbers(VI.tokenize(s)).join(' ');
  assert.strictEqual(n('حداشر'), '11');
  assert.strictEqual(n('خمسة وعشرين'), '25');
  assert.strictEqual(n('مية وخمسة وعشرين'), '125');
  assert.strictEqual(n('ثلاثة عشر'), '13');
  assert.strictEqual(n('القطعة التالتة'), 'القطعه 3');
  assert.strictEqual(n('قطعة ٧'), 'قطعه 7');
  assert.strictEqual(n('قطعة تلاتة قطاع اربعة'), 'قطعه 3 قطاع 4'); // two numbers stay separate
});

test('the two examples from the field team', () => {
  const a = u('تسجيل عملية قلع فسيلة لنخلة رقم 11 قطعة رقم 7 قطاع 3');
  assert.strictEqual(a.opType.id, 'op_offshoot_sep');
  assert.strictEqual(a.level, 'tree');
  assert.strictEqual(a.palm.code, 'BSH03-07A-F011-1026');
  assert.ok(a.ready);

  const b = u('تسجيل عملية ري اضافي لقطعة 2 قطاع 4');
  assert.strictEqual(b.opType.id, 'op10');
  assert.strictEqual(b.level, 'plot');
  assert.strictEqual(b.plot.id, 'BSH04-02');
  assert.ok(b.ready);
});

test('speech engine writing قطاع as قطع, and fertigation with acid', () => {
  const r = u('سجل عملية ري وتسميد حامض في السارق قطعة ثلاثة قطع أربعة');
  assert.strictEqual(r.sector.id, 'BSH04');
  assert.strictEqual(r.plot.id, 'BSH04-03');
  assert.strictEqual(r.opType.id, 'op_fertigation');
  assert.ok(r.material && /حامض/.test(r.material.name));
});

test('place words do not decide the operation; material kind does', () => {
  const r = u('سمدنا القطعة 3 قطاع 2 بسلفات نشادر 2 كيلو للنخلة');
  assert.strictEqual(r.opType.id, 'op7');
  assert.strictEqual(r.material.id, 'ft3');
  assert.strictEqual(r.quantity, 2);
  assert.strictEqual(r.unit, 'كجم');
  assert.strictEqual(r.perTree, true);
});

test('ambiguity is reported, never guessed', () => {
  const noSector = u('ري القطعة 7');
  assert.strictEqual(noSector.ready, false);
  assert.ok(noSector.issues.some(i => /قطاعات/.test(i.msg)));

  const twoPalms = u('إصابة سوسة نخلة 3 قطعة 1 قطاع 1'); // 01A and 01B both have a tree number 3
  assert.strictEqual(twoPalms.ready, false);
  assert.strictEqual(twoPalms.palmCandidates.length, 2);

  const individual = u('إصابة سوسة قطعة 2 قطاع 1'); // individual-only operation on a whole plot
  assert.ok(individual.issues.some(i => i.field === 'palm' && i.level === 'error'));
});

test('sub-plot letters, full tree codes, quantities', () => {
  assert.strictEqual(u('تقليم سعف قطعة 1 ب قطاع 1').plot.id, 'BSH01-01B');
  assert.strictEqual(u('تقليم قطعه 2a قطاع 3').plot.id, 'BSH03-02A');
  const code = u('الشجرة BSH02-05A-F010-1026 فيها سوسة');
  assert.strictEqual(code.palm.code, 'BSH02-05A-F010-1026');
  const h = u('جني 40 صندوق بلح من قطعة 2 قطاع 3');
  assert.strictEqual(h.opType.id, 'op_harvest');
  assert.deepStrictEqual([h.quantity, h.unit], [40, 'صندوق']);
  const half = u('رشينا مبيد 3 لتر ونص على قطاع 2 قطعة 4');
  assert.deepStrictEqual([half.quantity, half.unit], [3.5, 'لتر']);
  assert.notStrictEqual(half.opType.id, 'op12'); // olive operation is not picked on a palm plot
});

test('user corrections in the confirmation card re-validate', () => {
  const r = u('إصابة سوسة نخلة 3 قطعة 1 قطاع 1');
  const fixed = VI.revalidate(r, { palmId: r.palmCandidates[1].id }, ctx);
  assert.ok(fixed.ready);
  assert.strictEqual(fixed.level, 'tree');
  const moved = VI.revalidate(r, { plotId: 'BSH02-03A', slots: { palm: '5' } }, ctx);
  assert.strictEqual(moved.palm.code, 'BSH02-03A-F005-1026');
});
