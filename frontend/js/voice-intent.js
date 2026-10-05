/**
 * VoiceIntent — turns a spoken field command (Egyptian / Gulf / MSA Arabic) into a
 * structured operation draft resolved against the farm's real data.
 *
 *   "سجل عملية قلع فسيلة لنخلة رقم 11 قطعة رقم 7 قطاع 3"
 *     → { opType: فصل ونقل الفسائل, sector: BSH03, plot: BSH03-07A, palm: BSH03-07A-F011-…, level: tree }
 *
 * Pure functions, no DOM, no network: runs offline in the app (window.VoiceIntent) and on the
 * server (require('../frontend/js/voice-intent.js')), so both always agree.
 *
 *   parse(text)                 → raw slots (numbers, units, keywords), no farm data needed
 *   matchOperation(text, types) → ranked operation types (works with any admin-defined list)
 *   resolve(slots, ctx)         → draft with real ids + issues to show the user
 *   understand(text, ctx)       → parse + matchOperation + resolve in one call
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VoiceIntent = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // 1. Normalisation
  // ---------------------------------------------------------------------------
  const DIACRITICS = /[ً-ْٰـ]/g; // harakat + superscript alef + tatweel

  function normChars(s) {
    return String(s == null ? '' : s)
      .replace(DIACRITICS, '')
      .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x660))
      .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x6F0))
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/ة/g, 'ه')
      .toLowerCase();
  }

  // Split into tokens; "7ب" / "7a" / "07A" become ["7", "ب"] so the letter can be read as a sub-plot part
  function tokenize(s) {
    return normChars(s)
      .replace(/([0-9])([a-zء-ي])/g, '$1 $2')
      .replace(/([a-zء-ي])([0-9])/g, '$1 $2')
      .split(/[^0-9a-zء-ي.]+/)
      .map(t => t.replace(/^\.+|\.+$/g, ''))
      .filter(Boolean);
  }

  // ---------------------------------------------------------------------------
  // 2. Spoken numbers → digits ("خمسة وعشرين" → 25, "حداشر" → 11, "التالتة" → 3)
  // ---------------------------------------------------------------------------
  const NUM = {};
  const addNum = (n, ...words) => words.forEach(w => { NUM[normChars(w)] = n; });
  addNum(0, 'صفر');
  addNum(1, 'واحد', 'واحده', 'وحده', 'اول', 'الاول', 'اولي', 'الاولي', 'اولى', 'الأولى');
  addNum(2, 'اثنين', 'اتنين', 'اثنان', 'اتنان', 'تنين', 'ثاني', 'تاني', 'الثاني', 'التاني', 'ثانيه', 'تانيه', 'الثانيه', 'التانيه');
  addNum(3, 'ثلاث', 'ثلاثه', 'تلات', 'تلاته', 'ثالث', 'تالت', 'الثالث', 'التالت', 'ثالثه', 'تالته', 'الثالثه', 'التالته');
  addNum(4, 'اربع', 'اربعه', 'رابع', 'الرابع', 'رابعه', 'الرابعه');
  addNum(5, 'خمس', 'خمسه', 'خامس', 'الخامس', 'خامسه', 'الخامسه');
  addNum(6, 'سته', 'ست', 'سادس', 'السادس', 'سادسه', 'السادسه');
  addNum(7, 'سبع', 'سبعه', 'سابع', 'السابع', 'سابعه', 'السابعه');
  addNum(8, 'ثمان', 'ثماني', 'ثمانيه', 'تمن', 'تمنيه', 'تمانيه', 'تماني', 'ثامن', 'تامن', 'الثامن', 'التامن', 'ثامنه', 'تامنه', 'الثامنه', 'التامنه');
  addNum(9, 'تسع', 'تسعه', 'تاسع', 'التاسع', 'تاسعه', 'التاسعه');
  addNum(10, 'عشر', 'عشره', 'عاشر', 'العاشر', 'عاشره', 'العاشره');
  addNum(11, 'حداشر', 'احداشر', 'حدعشر', 'احدعشر', 'حداشره');
  addNum(12, 'اتناشر', 'اثناشر', 'اطناشر', 'اتنعشر', 'اثنعشر');
  addNum(13, 'تلتاشر', 'تلطاشر', 'ثلاثطعشر', 'تلتعشر', 'ثلتاشر');
  addNum(14, 'اربعتاشر', 'اربعطاشر', 'اربعتعشر');
  addNum(15, 'خمستاشر', 'خمسطاشر', 'خمستعشر');
  addNum(16, 'ستاشر', 'سطاشر', 'ستعشر');
  addNum(17, 'سبعتاشر', 'سبعطاشر', 'سبعتعشر');
  addNum(18, 'تمنتاشر', 'طمنطاشر', 'تمنطاشر', 'ثمنتاشر');
  addNum(19, 'تسعتاشر', 'تسعطاشر', 'تسعتعشر');
  addNum(20, 'عشرين', 'عشرون');
  addNum(30, 'ثلاثين', 'تلاتين', 'ثلاثون');
  addNum(40, 'اربعين', 'اربعون');
  addNum(50, 'خمسين', 'خمسون');
  addNum(60, 'ستين', 'ستون');
  addNum(70, 'سبعين', 'سبعون');
  addNum(80, 'ثمانين', 'تمانين', 'ثمانون');
  addNum(90, 'تسعين', 'تسعون');
  addNum(100, 'ميه', 'مائه', 'مايه', 'ميت');
  addNum(200, 'ميتين', 'مائتين', 'متين', 'مائتان');
  addNum(300, 'تلتميه', 'ثلاثمائه', 'ثلاثميه', 'تلاتميه');
  addNum(400, 'ربعميه', 'اربعمائه', 'اربعميه');
  addNum(500, 'خمسميه', 'خمسمائه');
  addNum(600, 'ستميه', 'ستمائه');
  addNum(700, 'سبعميه', 'سبعمائه');
  addNum(800, 'تمنميه', 'ثمانمائه', 'ثمنميه');
  addNum(900, 'تسعميه', 'تسعمائه');
  addNum(1000, 'الف', 'ألف');
  addNum(0.5, 'نص', 'نصف');

  function numberWord(tok) {
    if (tok in NUM) return { n: NUM[tok], conj: false };
    if (tok.length > 2 && tok[0] === 'و' && tok.slice(1) in NUM) return { n: NUM[tok.slice(1)], conj: true };
    return null;
  }

  // Replace runs of number words with one numeric token. Words only join when Arabic grammar joins
  // them ("خمسة وعشرين", "ثلاث مية", "ثلاثة عشر"); two bare numbers side by side stay separate.
  function wordsToNumbers(tokens) {
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
      const first = numberWord(tokens[i]);
      if (!first || first.conj || first.n === 0.5) { // "و..." alone or "نص" alone: keep as word
        if (first && first.n === 0.5 && !first.conj) out.push('0.5');
        else if (first && first.conj && first.n === 0.5 && out.length && /^\d+(\.\d+)?$/.test(out[out.length - 1])) {
          out[out.length - 1] = String(parseFloat(out[out.length - 1]) + 0.5); // "2 ونص"
        } else out.push(tokens[i]);
        continue;
      }
      let total = 0;
      let cur = first.n;
      let j = i + 1;
      while (j < tokens.length) {
        const w = numberWord(tokens[j]);
        if (!w || w.n === 0.5) break;
        if (w.n === 10 && !w.conj && cur >= 1 && cur <= 9 && (tokens[j] === 'عشر' || tokens[j] === 'عشره')) { cur += 10; j++; continue; } // ثلاثة عشر
        if (w.n === 100 && !w.conj && cur >= 1 && cur <= 9) { cur *= 100; j++; continue; }                 // ثلاث مية
        if (w.n === 1000 && !w.conj) { total += (cur || 1) * 1000; cur = 0; j++; continue; }
        if (w.conj && w.n < cur || (w.conj && cur >= 100)) { cur += w.n; j++; continue; }               // مية وخمسة / خمسة وعشرين
        if (w.conj && cur < 10 && w.n >= 20 && w.n < 100) { cur += w.n; j++; continue; }
        break;
      }
      out.push(String(total + cur));
      i = j - 1;
    }
    // trailing "ونص" after a digit token ("2 ونص")
    for (let k = 1; k < out.length; k++) {
      if ((out[k] === 'ونص' || out[k] === 'ونصف') && /^\d+(\.\d+)?$/.test(out[k - 1])) { out[k - 1] = String(parseFloat(out[k - 1]) + 0.5); out.splice(k, 1); k--; }
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // 3. Slot extraction
  // ---------------------------------------------------------------------------
  const SECTOR_KW = new Set(['قطاع', 'القطاع', 'بالقطاع', 'للقطاع', 'والقطاع', 'وقطاع', 'سكتور', 'سيكتور', 'sector']);
  const PLOT_KW = new Set(['قطعه', 'القطعه', 'بالقطعه', 'للقطعه', 'والقطعه', 'وقطعه', 'لقطعه', 'بقطعه', 'حوض', 'الحوض', 'بلوك', 'البلوك', 'plot']);
  const PALM_KW = new Set(['نخله', 'النخله', 'للنخله', 'لنخله', 'بالنخله', 'ونخله', 'نخل', 'نخلي', 'شجره', 'الشجره', 'للشجره', 'لشجره', 'شجر', 'اصل', 'الاصل', 'palm', 'tree']);
  const AMBIG_SECTOR_KW = new Set(['قطع', 'وقطع', 'بقطع']); // speech engines often write قطاع as قطع
  const FILLER = new Set(['رقم', 'نمره', 'نمرة', 'no', 'number', 'كود', 'في', 'من', 'ب', 'ال']);
  const PART_LETTERS = { a: 'A', b: 'B', c: 'C', d: 'D', e: 'E', f: 'F', 'ا': 'A', 'ب': 'B', 'ج': 'C', 'د': 'D', 'ه': 'E', 'ايه': 'A', 'اي': 'A', 'بي': 'B', 'سي': 'C' };

  const UNITS = [
    [['لتر', 'لترات', 'لترين', 'ليتر'], 'لتر'],
    [['كيلو', 'كيلوجرام', 'كيلوغرام', 'كجم', 'كيلوات', 'كيلوهات', 'كغ', 'كيلوين'], 'كجم'],
    [['جرام', 'جم', 'غرام', 'جرامات'], 'جم'],
    [['طن', 'اطنان', 'طنين'], 'طن'],
    [['مللي', 'ملي', 'مل', 'سم', 'cc'], 'مل'],
    [['متر', 'مترمكعب', 'م3', 'مكعب', 'امتار'], 'م³'],
    [['ساعه', 'ساعات', 'ساعتين'], 'ساعة'],
    [['دقيقه', 'دقايق', 'دقائق', 'دقيقتين'], 'دقيقة'],
    [['صندوق', 'صناديق', 'كرتونه', 'كراتين', 'قفص', 'اقفاص'], 'صندوق'],
    [['شيكاره', 'شكاره', 'شكاير', 'شيكارات', 'كيس', 'اكياس', 'شوال'], 'شيكارة'],
    [['جركن', 'جراكن', 'جركنه'], 'جركن'],
    [['برميل', 'براميل'], 'برميل'],
    [['عذق', 'عذوق', 'سباطه', 'سباطات', 'عرجون', 'عراجين'], 'عذق'],
    [['فسيله', 'فسايل', 'فسيلات'], 'فسيلة']
  ];
  const UNIT_OF = {};
  UNITS.forEach(([words, unit]) => words.forEach(w => { UNIT_OF[normChars(w)] = unit; }));
  const DUAL = { لترين: 2, ساعتين: 2, دقيقتين: 2, كيلوين: 2, طنين: 2 };
  const PER_TREE = new Set(['لكل', 'للنخله', 'للشجره', 'النخله', 'الشجره']);

  const isNum = t => /^\d+(\.\d+)?$/.test(t);
  // "لقطاع" / "وبالقطعة" / "فالنخلة" → the bare keyword
  function kwBase(t) {
    for (const p of ['وبال', 'وال', 'بال', 'فال', 'لل', 'ال', 'و', 'ب', 'ل', 'ف']) {
      if (t.startsWith(p) && t.length - p.length >= 3) {
        const b = t.slice(p.length);
        if (SECTOR_KW.has(b) || PLOT_KW.has(b) || PALM_KW.has(b) || AMBIG_SECTOR_KW.has(b)) return b;
      }
    }
    return t;
  }
  const stripWa = t => (t.length > 2 && t[0] === 'و') ? t.slice(1) : t;

  function readNumberAfter(tokens, i) {
    // returns { value, part, end } reading "رقم 7 ب" / "7a" / "السابعة"
    let j = i + 1;
    while (j < tokens.length && FILLER.has(tokens[j])) j++;
    if (j >= tokens.length || !isNum(tokens[j])) return null;
    const value = tokens[j];
    let part = null;
    const nxt = tokens[j + 1];
    if (nxt && PART_LETTERS[nxt] && !(nxt === 'ب' && tokens[j + 2] && !isNum(tokens[j + 2]) && !SECTOR_KW.has(tokens[j + 2]) && !AMBIG_SECTOR_KW.has(tokens[j + 2]) && !PALM_KW.has(tokens[j + 2]) && UNIT_OF[tokens[j + 2]] === undefined && tokens.length > j + 3)) {
      part = PART_LETTERS[nxt];
      return { value, part, end: j + 1 };
    }
    return { value, part, end: j };
  }

  const CODE_RE = /\b([a-z]{1,5}\d{1,3}-\d{1,3}[a-z]?-[a-z]\d{1,4}(?:-\d+)?)\b/i;

  function parse(text) {
    const raw = String(text || '').trim();
    const codeMatch = normChars(raw).match(CODE_RE);
    const tokens = wordsToNumbers(tokenize(raw));
    const slots = {
      raw,
      normalized: tokens.join(' '),
      tokens,
      sector: null, plot: null, part: null, palm: null, palmCode: codeMatch ? codeMatch[1].toUpperCase() : null,
      quantity: null, unit: null, perTree: false,
      used: new Set()
    };
    const ambiguous = [];
    const hasExplicitSector = tokens.some(t => SECTOR_KW.has(kwBase(t)));

    for (let i = 0; i < tokens.length; i++) {
      const t = kwBase(tokens[i]);
      const kind = SECTOR_KW.has(t) ? 'sector' : PLOT_KW.has(t) ? 'plot' : PALM_KW.has(t) ? 'palm' : AMBIG_SECTOR_KW.has(t) ? 'ambig' : null;
      if (!kind) continue;
      const r = readNumberAfter(tokens, i);
      if (!r) continue;
      for (let k = i; k <= r.end; k++) slots.used.add(k);
      if (kind === 'sector' && slots.sector == null) slots.sector = r.value;
      else if (kind === 'plot' && slots.plot == null) { slots.plot = r.value; if (r.part) slots.part = r.part; }
      else if (kind === 'palm' && slots.palm == null) slots.palm = r.value;
      else if (kind === 'ambig') ambiguous.push(r);
      i = r.end;
    }
    // "قطعة 3 قطع 4": قطع is the sector when قطاع was not said; otherwise it is another plot word
    ambiguous.forEach(r => {
      if (!hasExplicitSector && slots.sector == null && (slots.plot != null || ambiguous.length > 1)) slots.sector = r.value;
      else if (slots.plot == null) { slots.plot = r.value; if (r.part) slots.part = r.part; }
      else if (slots.sector == null) slots.sector = r.value;
    });

    // Quantity: a number (not already used) right before a unit word, or a dual unit word alone
    for (let i = 0; i < tokens.length; i++) {
      if (slots.used.has(i)) continue;
      const t = tokens[i];
      const unitTok = stripWa(tokens[i + 1] || '');
      if (isNum(t) && UNIT_OF[unitTok] && !(UNIT_OF[unitTok] === 'فسيلة' && slots.quantity != null)) {
        let q = parseFloat(t);
        if (tokens[i + 2] === 'ونص' || tokens[i + 2] === 'ونصف') q += 0.5;
        slots.quantity = q; slots.unit = UNIT_OF[unitTok];
        slots.used.add(i); slots.used.add(i + 1);
        const after = tokens.slice(i + 2, i + 5);
        if (after.some(a => PER_TREE.has(a))) slots.perTree = true;
        break;
      }
      if (DUAL[t] && slots.quantity == null) { slots.quantity = DUAL[t]; slots.unit = UNIT_OF[t]; slots.used.add(i); }
      else if (UNIT_OF[t] && slots.quantity == null && (tokens[i + 1] === 'ونص' || tokens[i + 1] === 'ونصف') && UNIT_OF[t] !== 'فسيلة') {
        slots.quantity = 1.5; slots.unit = UNIT_OF[t]; slots.used.add(i);
      }
    }
    // the unit "فسيلة" in "قلع فسيلة" (no number) is the operation, not a quantity
    if (slots.unit === 'فسيلة' && slots.quantity == null) slots.unit = null;
    delete slots.used;
    return slots;
  }

  // ---------------------------------------------------------------------------
  // 4. Operation type matching (against the farm's own, admin-editable list)
  // ---------------------------------------------------------------------------
  const STOP = new Set(['و', 'او', 'من', 'في', 'علي', 'على', 'ضد', 'مع', 'ال', 'او', 'عن', 'الي', 'الى', 'ب', 'ل', 'عمليه', 'سجل', 'سجلت', 'سجلنا', 'تسجيل', 'عملنا', 'عمل', 'تم', 'رقم', 'نمره', 'النهارده', 'انهارده', 'امبارح', 'دلوقتي', 'كده', 'يا', 'هندسه', 'بشمهندس', 'لو', 'سمحت', 'ده', 'دي', 'دا', 'اللي', 'كل', 'جميع', 'بتاع', 'بتاعه']);

  function stem(word) {
    let w = normChars(word);
    for (const p of ['وبال', 'وال', 'بال', 'فال', 'كال', 'لل', 'ال']) {
      if (w.startsWith(p) && w.length - p.length >= 2) { w = w.slice(p.length); break; }
    }
    if (w.length >= 4 && (w[0] === 'و' || w[0] === 'ب' || w[0] === 'ف' || w[0] === 'ل') && !(w in SYN)) {
      const rest = w.slice(1);
      if (rest in SYN || rest.length >= 3) w = rest;
    }
    for (const s of ['ات', 'ين', 'ون', 'يه', 'ه']) {
      if (w.endsWith(s) && w.length - s.length >= 3) { w = w.slice(0, -s.length); break; }
    }
    return w;
  }

  // Spoken word → words that appear in operation type names. Keys and values are normalised.
  const SYN = {};
  const syn = (words, targets) => words.forEach(w => { SYN[normChars(w)] = (SYN[normChars(w)] || []).concat(targets.map(normChars)); });
  syn(['قلع', 'قلعنا', 'خلع', 'شيل', 'شلنا', 'فصل', 'فصلنا', 'نزع', 'نقل', 'نقلنا'], ['فصل', 'نقل']);
  syn(['فسيله', 'فسايل', 'فسيلات', 'خلفه', 'خلفات', 'سرطان', 'سرطانات', 'رواكيب', 'راكوب'], ['فسايل', 'فسيله', 'سرطانات']);
  syn(['ري', 'سقي', 'سقايه', 'روينا', 'رويت', 'رينا', 'ريه'], ['ري']);
  syn(['اضافي', 'اضافيه', 'زياده', 'زيادة', 'تكميلي', 'غسيل'], ['اضافي']);
  syn(['تسميد', 'سماد', 'اسمده', 'سمدنا', 'سمد', 'سمدت', 'مغذيات', 'تغذيه'], ['تسميد']);
  syn(['حامض', 'احماض', 'اسيد', 'فوسفوريك', 'فسفوريك', 'نيتريك'], ['حامض']);
  syn(['شبكه', 'تنقيط', 'فرتجيشن', 'فيرتيجيشن', 'التنقيط'], ['شبكه', 'ري']);
  syn(['رش', 'رشينا', 'رشيت', 'رشه', 'رشة', 'بخ'], ['رش']);
  syn(['مبيد', 'مبيدات', 'مكافحه', 'كافحنا', 'كافحت'], ['مكافحه', 'مبيد']);
  syn(['سوسه', 'سوس', 'السوسه', 'سوسة'], ['سوسه']);
  syn(['حقن', 'حقنا', 'حقنت', 'حقنه'], ['حقن']);
  syn(['اصابه', 'مصابه', 'مصاب', 'اصابات', 'مضروبه', 'مريضه', 'عيانه'], ['اصابه']);
  syn(['تقليم', 'قلمنا', 'قلمت', 'قص', 'قصينا', 'شذب', 'تشذيب'], ['تقليم', 'تشذيب']);
  syn(['تكريب', 'كرب', 'كربنا', 'كرانيف', 'شوك', 'اشواك'], ['تكريب', 'كرب']);
  syn(['تلقيح', 'لقحنا', 'لقحت', 'تابير', 'تأبير', 'دكار', 'ذكار', 'لقاح', 'نبات'], ['تلقيح', 'تابير']);
  syn(['تكييس', 'كيسنا', 'غطينا', 'تغطيه'], ['تكييس']);
  syn(['خف', 'خفينا', 'خفيت'], ['خف']);
  syn(['تدليه', 'دلينا', 'تقويس', 'عراجين', 'عرجون', 'عذوق', 'عذق', 'سباطات', 'سباطه'], ['تدليه', 'عذوق', 'تقويس']);
  syn(['حصاد', 'جني', 'جنينا', 'قطف', 'قطفنا', 'صرام', 'جمعنا', 'لقط', 'لقطنا'], ['جني', 'حصاد']);
  syn(['عزيق', 'عزقنا', 'حشايش', 'حشائش', 'نجيل', 'تعشيب'], ['عزيق', 'حشايش']);
  syn(['تنظيف', 'نظفنا', 'نضفنا', 'تنضيف'], ['تنظيف']);
  syn(['فحص', 'فحصنا', 'معاينه', 'كشف', 'كشفنا', 'مرور', 'متابعه'], ['فحص', 'معاينه']);
  syn(['تسريب', 'تسريبات', 'خرم', 'مخروم', 'مكسور', 'ماسوره', 'خرطوم', 'نقاطات'], ['تسريب', 'شبكه']);
  syn(['قياس', 'قسنا', 'طول', 'ارتفاع', 'محيط'], ['قياس', 'ارتفاع']);
  syn(['ارشفه', 'ارشيف', 'ماتت', 'ميته', 'ميت', 'نشفت', 'ناشفه', 'استبعاد'], ['ارشفه', 'ميت']);
  syn(['ملوحه', 'املاح', 'مالحه'], ['ملوحه', 'املاح']);
  syn(['كبريت', 'جبس'], ['كبريت', 'جبس']);
  syn(['عضوي', 'كمبوست', 'سبله', 'سباخ', 'بلدي'], ['عضوي', 'كمبوست']);
  syn(['كيماوي', 'كيميائي', 'كيميايي', 'npk'], ['كيميايي']);
  syn(['ورقي', 'اوراق'], ['ورقي']);
  syn(['غبير', 'غبار', 'عنكبوت', 'حلم'], ['غبار', 'عنكبوت']);
  syn(['حفار', 'حفارات', 'قشريه'], ['حفار']);
  syn(['تعفن', 'عفن', 'خياس', 'جماره'], ['تعفن', 'خياس']);
  syn(['شتوي', 'شتويه', 'شتا', 'الشتا'], ['شتويه']);
  syn(['امينيه', 'امينو', 'هيوميك', 'محفز', 'محفزات'], ['امينيه', 'محفزات']);
  syn(['عناصر', 'صغري', 'حديد', 'زنك', 'منجنيز', 'بورون'], ['عناصر', 'صغري']);
  syn(['كسر', 'مكسوره', 'اتكسر', 'اتكسرت'], ['كسر']);
  syn(['qr', 'باركود', 'ترقيم', 'كود'], ['ترقيم', 'qr']);

  function textStems(tokens) {
    const set = new Set();
    tokens.forEach(t => {
      if (isNum(t) || STOP.has(t) || t.length < 2) return;
      // words that name the place or a unit say nothing about the kind of operation
      const kb = kwBase(t);
      if (SECTOR_KW.has(kb) || PLOT_KW.has(kb) || PALM_KW.has(kb) || AMBIG_SECTOR_KW.has(kb) || FILLER.has(t) || PART_LETTERS[t] || (UNIT_OF[t] && UNIT_OF[t] !== 'فسيلة' && UNIT_OF[t] !== 'عذق')) return;
      set.add(stem(t));
      const n = normChars(t);
      const variants = [n, n.replace(/^(وال|بال|لل|ال|و|ب|ل)/, '')];
      variants.forEach(v => (SYN[v] || []).forEach(s => set.add(stem(s))));
    });
    return set;
  }

  function typeStems(name) {
    return new Set(tokenize(name).filter(t => !STOP.has(t) && t.length >= 2 && !isNum(t)).map(stem));
  }

  // Rank operation types. Returns [{ type, score }] best first.
  function matchOperation(textOrSlots, operationTypes, opts = {}) {
    const tokens = Array.isArray(textOrSlots?.tokens) ? textOrSlots.tokens : wordsToNumbers(tokenize(textOrSlots));
    const T = textStems(tokens);
    const types = (operationTypes || []).filter(t => t && t.name && !t.inactive && t.active !== 0 && t.active !== false);
    if (!types.length || !T.size) return [];
    const prepared = types.map(t => ({ t, s: typeStems(t.name) }));
    const df = new Map();
    prepared.forEach(p => p.s.forEach(x => df.set(x, (df.get(x) || 0) + 1)));
    const N = prepared.length;
    const w = x => Math.log(1 + N / (df.get(x) || 1));
    const crop = opts.cropCode ? String(opts.cropCode) : null;
    const matKind = opts.materialKind ? normChars(opts.materialKind) : null;
    return prepared.map(({ t, s }) => {
      let matched = 0, total = 0;
      s.forEach(x => { const wx = w(x); total += wx; if (T.has(x)) matched += wx; });
      if (!matched) return { type: t, score: 0 };
      const coverage = total ? matched / total : 0;
      let score = matched * (0.55 + 0.45 * coverage);
      const tc = String(t.cropId || t.crop_id || 'all');
      if (crop && tc !== 'all' && tc !== 'null' && normCrop(tc) !== normCrop(crop)) score *= 0.5;
      if (matKind) { // the material's kind (عضوي / كيميائي / مبيد…) points to the matching operation
        let kinds = t.allowedKinds || t.allowed_kinds || [];
        if (typeof kinds === 'string') { try { kinds = JSON.parse(kinds); } catch { kinds = []; } }
        if ((kinds || []).some(k => normChars(k) === matKind)) score = score * 1.3 + 1;
      }
      return { type: t, score: Math.round(score * 100) / 100 };
    }).filter(r => r.score > 0).sort((a, b) => b.score - a.score || String(a.type.name).length - String(b.type.name).length);
  }

  function normCrop(c) {
    const s = String(c || '').trim();
    if (s === '1' || s === '1.0' || s === 'palm') return 'palm';
    if (s === '2' || s === '2.0' || s === 'olive') return 'olive';
    if (s === '3' || s === '3.0' || s === 'mango') return 'mango';
    return s;
  }

  // ---------------------------------------------------------------------------
  // 5. Material (fertiliser / pesticide) from the farm's inventory list
  // ---------------------------------------------------------------------------
  const MATERIAL_GENERIC = new Set(['سماد', 'مبيد', 'متخصص', 'معالج', 'متوازن', 'المتوازن', 'النخيل', 'نخيل', 'مركب', 'متركب']);
  const MATERIAL_CUES = ['حامض', 'سلفات', 'نترات', 'يوريا', 'كبريت', 'فوسفات', 'سوبر', 'بوتاسيوم', 'npk', 'كمبوست', 'هيوميك', 'امينو', 'ايميداكلوبريد', 'كلوربيريفوس', 'زيت', 'نحاس', 'جبس', 'سبله'];

  function matchMaterial(slots, materials) {
    const toks = slots.tokens.map(t => normChars(t));
    const tokSet = new Set(toks.map(stem));
    let best = null;
    (materials || []).filter(m => m && m.name && m.active !== false && m.active !== 0).forEach(m => {
      const mt = tokenize(m.name).filter(x => !isNum(x) && x.length >= 3 && !MATERIAL_GENERIC.has(x)).map(stem);
      if (!mt.length) return;
      const hit = mt.filter(x => tokSet.has(x)).length;
      const score = hit / mt.length;
      if (hit && score >= 0.5 && (!best || score > best.score)) best = { material: m, score };
    });
    if (best) return { id: best.material.id, name: best.material.name, kind: best.material.kind || null, unit: best.material.unit || null, fromList: true };
    // Free text: cue word + the next word ("حامض فسفوريك", "سلفات بوتاسيوم")
    for (let i = 0; i < toks.length; i++) {
      const base = toks[i].replace(/^(و|ب|بال|ال)/, '');
      if (MATERIAL_CUES.includes(base)) {
        const next = toks[i + 1] && !isNum(toks[i + 1]) && !SECTOR_KW.has(toks[i + 1]) && !PLOT_KW.has(toks[i + 1]) && !PALM_KW.has(toks[i + 1]) && !AMBIG_SECTOR_KW.has(toks[i + 1]) && !['في', 'علي', 'على', 'ل', 'لكل'].includes(toks[i + 1]) && UNIT_OF[toks[i + 1]] === undefined ? toks[i + 1] : '';
        return { id: null, name: (base + (next ? ' ' + next : '')).trim(), fromList: false };
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // 6. Resolve slots against the farm
  // ---------------------------------------------------------------------------
  const lastNum = s => { const m = String(s || '').match(/(\d+)(?!.*\d)/); return m ? parseInt(m[1], 10) : null; };

  function prepCtx(ctx) {
    if (ctx && ctx._prepared) return ctx;
    const sectors = (ctx.sectors || []).map(s => ({ id: String(s.id), name: s.name || String(s.id) }));
    const plots = (ctx.plots || []).map(p => ({
      id: String(p.id),
      name: p.name || String(p.id),
      sector: String(p.sector || p.sectorId || p.sector_id || ''),
      parent: p.parentPlotId || p.parent_plot_id || null,
      plotNo: p.plotNo != null ? p.plotNo : (p.plot_no != null ? p.plot_no : null),
      part: String(p.part || p.part_letter || '').toUpperCase() || null
    }));
    plots.forEach(p => {
      if (p.plotNo == null || p.plotNo === '') {
        const m = p.id.match(/-(\d+)([A-Z]?)$/i);
        p.plotNo = m ? m[1] : null;
        if (!p.part && m && m[2]) p.part = m[2].toUpperCase();
      }
      p.no = p.plotNo != null ? parseInt(p.plotNo, 10) : null;
      if (p.parent) p.parent = String(p.parent);
    });
    const kids = new Map();
    plots.forEach(p => { if (p.parent) { if (!kids.has(p.parent)) kids.set(p.parent, []); kids.get(p.parent).push(p); } });
    const palmsByPlot = new Map();
    const palmsByCode = new Map();
    (ctx.palms || []).forEach(x => {
      if (x.archived || x.is_archived || x.is_deleted) return;
      const plot = String(x.plot || x.plotId || x.plot_id || '');
      const rec = { id: x.id, code: x.code, plot, seq: parseInt(x.seq != null ? x.seq : x.seq_no, 10), crop: x.cropId || x.crop_code || null };
      if (!palmsByPlot.has(plot)) palmsByPlot.set(plot, []);
      palmsByPlot.get(plot).push(rec);
      if (rec.code) palmsByCode.set(String(rec.code).toUpperCase(), rec);
    });
    return {
      _prepared: true, sectors, plots, kids, palmsByPlot, palmsByCode,
      operationTypes: ctx.operationTypes || [], materials: ctx.materials || ctx.fertilizers || [],
      plotById: new Map(plots.map(p => [p.id, p])), sectorById: new Map(sectors.map(s => [s.id, s]))
    };
  }

  function family(c, plotId) {
    const out = [plotId];
    for (let i = 0; i < out.length; i++) (c.kids.get(out[i]) || []).forEach(k => { if (!out.includes(k.id)) out.push(k.id); });
    return out;
  }

  function findSector(c, num) {
    const n = parseInt(num, 10);
    return c.sectors.filter(s => lastNum(s.id) === n || lastNum(s.name) === n);
  }

  // main plots (no parent) with this number, optionally in one sector
  function findPlots(c, num, sectorId) {
    const n = parseInt(num, 10);
    let list = c.plots.filter(p => p.no === n && (!sectorId || p.sector === sectorId));
    const mains = list.filter(p => !p.parent || !list.some(q => q.id === p.parent));
    return mains.length ? mains : list;
  }

  /**
   * slots: { sector, plot, part, palm, palmCode } as numbers/strings (from parse() or from the edit form)
   * Returns { sector, plot, palm, palmCandidates, level, issues[] }
   */
  function resolveTarget(slots, ctx) {
    const c = prepCtx(ctx);
    const issues = [];
    let sector = null, plot = null, palm = null, palmCandidates = [];

    if (slots.palmCode) {
      palm = c.palmsByCode.get(String(slots.palmCode).toUpperCase()) || null;
      if (palm) {
        plot = c.plotById.get(palm.plot) || null;
        sector = plot ? c.sectorById.get(plot.sector) || null : null;
        return { sector, plot, palm, palmCandidates, level: 'tree', issues };
      }
      issues.push({ level: 'error', field: 'palm', msg: `مفيش نخلة بالكود ${slots.palmCode}` });
    }

    if (slots.sector != null && slots.sector !== '') {
      const found = findSector(c, slots.sector);
      if (found.length === 1) sector = found[0];
      else if (!found.length) issues.push({ level: 'error', field: 'sector', msg: `مفيش قطاع رقم ${slots.sector}` });
      else issues.push({ level: 'error', field: 'sector', msg: `فيه أكتر من قطاع رقمه ${slots.sector} — اختار من القائمة` });
    }

    if (slots.plot != null && slots.plot !== '') {
      const cands = findPlots(c, slots.plot, sector?.id);
      if (!cands.length) {
        issues.push({ level: 'error', field: 'plot', msg: sector ? `${sector.name}: مفيش فيه قطعة رقم ${slots.plot}` : `مفيش قطعة رقم ${slots.plot}` });
      } else if (cands.length > 1) {
        const secs = [...new Set(cands.map(p => p.sector))];
        issues.push({ level: 'error', field: 'sector', msg: `القطعة ${slots.plot} موجودة في ${secs.length} قطاعات — قول أو اختار القطاع` });
      } else {
        plot = cands[0];
        if (!sector) sector = c.sectorById.get(plot.sector) || null;
        if (slots.part) {
          const sub = (c.kids.get(plot.id) || []).find(k => k.part === slots.part) || (plot.part === slots.part ? plot : null);
          if (sub) plot = sub;
          else issues.push({ level: 'warn', field: 'plot', msg: `القطعة ${slots.plot} مالهاش جزء ${slots.part} — اتسجلت على القطعة كلها` });
        }
      }
    }

    if (slots.palm != null && slots.palm !== '') {
      const seq = parseInt(slots.palm, 10);
      if (!plot) {
        issues.push({ level: 'error', field: 'plot', msg: `النخلة ${slots.palm}: محتاج رقم القطعة والقطاع عشان أحددها` });
      } else {
        const fam = family(c, plot.id);
        palmCandidates = fam.flatMap(id => (c.palmsByPlot.get(id) || []).filter(p => p.seq === seq));
        if (palmCandidates.length === 1) { palm = palmCandidates[0]; palmCandidates = []; }
        else if (!palmCandidates.length) issues.push({ level: 'error', field: 'palm', msg: `مفيش نخلة رقم ${slots.palm} في ${plot.name}` });
        else issues.push({ level: 'error', field: 'palm', msg: `فيه ${palmCandidates.length} نخلات رقم ${slots.palm} في القطع الفرعية — اختار واحدة` });
      }
    }

    const level = palm ? 'tree' : (plot ? 'plot' : (sector ? 'sector' : null));
    if (!level && !issues.some(i => i.level === 'error')) issues.push({ level: 'error', field: 'plot', msg: 'مش واضح المكان: قول رقم القطاع والقطعة (والنخلة لو عملية فردية)' });
    return { sector, plot, palm, palmCandidates, level, issues };
  }

  function cropOfArea(c, target) {
    let ids = [];
    if (target.plot) ids = family(c, target.plot.id);
    else if (target.sector) ids = c.plots.filter(p => p.sector === target.sector.id).map(p => p.id);
    else return null;
    const count = {};
    ids.forEach(id => (c.palmsByPlot.get(id) || []).forEach(p => { if (p.crop) count[p.crop] = (count[p.crop] || 0) + 1; }));
    const best = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
    return best ? best[0] : null;
  }

  // Checks that depend on the chosen operation type
  function checkOperation(draft) {
    const issues = [];
    const t = draft.opType;
    if (!t) { issues.push({ level: 'error', field: 'op', msg: 'مش واضح نوع العملية — اختارها من القائمة' }); return issues; }
    const scope = t.scopeType || t.scope_type || 'both';
    if (scope === 'individual' && draft.level && draft.level !== 'tree' && !(draft.palmCandidates && draft.palmCandidates.length)) issues.push({ level: 'error', field: 'palm', msg: `«${t.name}» بتتسجل على نخلة محددة — قول رقم النخلة` });
    if (scope === 'bulk' && draft.level === 'tree') issues.push({ level: 'warn', field: 'op', msg: `«${t.name}» عادة بتتسجل على قطعة أو قطاع كامل` });
    const needMat = t.requiresMaterial === true || t.requiresMaterial === 1 || t.requires_material === 1;
    if (needMat && !draft.material) issues.push({ level: 'warn', field: 'material', msg: 'العملية دي محتاجة المادة المستخدمة (سماد / مبيد)' });
    const tc = normCrop(t.cropId || t.crop_id || 'all');
    if (draft.palm && draft.palm.crop && tc !== 'all' && tc !== 'null' && tc !== normCrop(draft.palm.crop)) issues.push({ level: 'warn', field: 'op', msg: 'نوع العملية ده لمحصول تاني غير محصول الشجرة' });
    return issues;
  }

  function score(draft, opRank) {
    let s = 100;
    if (!draft.opType) s -= 45;
    else if (opRank.length > 1 && opRank[1].score > opRank[0].score * 0.85) s -= 15;
    draft.issues.forEach(i => { s -= i.level === 'error' ? 30 : 8; });
    return Math.max(5, Math.min(100, s));
  }

  /**
   * Full pipeline. ctx = { sectors, plots, palms, operationTypes, materials|fertilizers }
   * opts.opTypeId forces an operation type (e.g. chosen by the user or by Gemini)
   */
  function understand(text, ctx, opts = {}) {
    const c = prepCtx(ctx);
    const slots = opts.slots ? Object.assign(parse(text), opts.slots) : parse(text);
    const target = resolveTarget(slots, c);
    const crop = target.palm?.crop || cropOfArea(c, target);
    const material = matchMaterial(slots, c.materials);
    const opRank = matchOperation(slots, c.operationTypes, { cropCode: crop, materialKind: material && material.kind });
    let opType = null;
    if (opts.opTypeId) opType = c.operationTypes.find(t => String(t.id) === String(opts.opTypeId)) || null;
    if (!opType && opRank.length && opRank[0].score >= 0.8) opType = opRank[0].type;
    const draft = {
      raw: slots.raw,
      normalized: slots.normalized,
      slots: { sector: slots.sector, plot: slots.plot, part: slots.part, palm: slots.palm, palmCode: slots.palmCode },
      opType,
      opAlternatives: opRank.slice(0, 4).map(r => ({ id: r.type.id, name: r.type.name, score: r.score })),
      sector: target.sector, plot: target.plot, palm: target.palm, palmCandidates: target.palmCandidates,
      level: target.level,
      material,
      quantity: slots.quantity, unit: slots.unit || (material && material.unit) || null, perTree: slots.perTree,
      issues: target.issues
    };
    draft.issues = draft.issues.concat(checkOperation(draft));
    draft.confidence = score(draft, opRank);
    draft.ready = !draft.issues.some(i => i.level === 'error');
    return draft;
  }

  // Re-validate after the user edited fields in the confirmation card
  function revalidate(draft, edits, ctx) {
    const c = prepCtx(ctx);
    const d = Object.assign({}, draft);
    const slots = Object.assign({}, draft.slots, edits.slots || {});
    d.slots = slots;
    if ('opTypeId' in edits) d.opType = c.operationTypes.find(t => String(t.id) === String(edits.opTypeId)) || null;
    if ('material' in edits) d.material = edits.material;
    if ('quantity' in edits) d.quantity = edits.quantity;
    if ('unit' in edits) d.unit = edits.unit;
    let target;
    if (edits.palmId) {
      const all = [...c.palmsByPlot.values()].flat();
      const p = all.find(x => String(x.id) === String(edits.palmId));
      const plot = p ? c.plotById.get(p.plot) : null;
      target = { sector: plot ? c.sectorById.get(plot.sector) : null, plot, palm: p || null, palmCandidates: [], level: p ? 'tree' : null, issues: [] };
    } else if (edits.plotId !== undefined || edits.sectorId !== undefined) {
      // explicit ids from dropdowns
      const sector = edits.sectorId ? c.sectorById.get(String(edits.sectorId)) || null : null;
      const plot = edits.plotId ? c.plotById.get(String(edits.plotId)) || null : null;
      const fakeSlots = { sector: null, plot: null, palm: slots.palm };
      target = { sector: sector || (plot ? c.sectorById.get(plot.sector) : null), plot, palm: null, palmCandidates: [], level: plot ? 'plot' : (sector ? 'sector' : null), issues: [] };
      if (plot && fakeSlots.palm) {
        const seq = parseInt(fakeSlots.palm, 10);
        const cands = family(c, plot.id).flatMap(id => (c.palmsByPlot.get(id) || []).filter(p => p.seq === seq));
        if (cands.length === 1) { target.palm = cands[0]; target.level = 'tree'; }
        else if (cands.length > 1) { target.palmCandidates = cands; target.issues.push({ level: 'error', field: 'palm', msg: `فيه ${cands.length} نخلات رقم ${fakeSlots.palm} — اختار واحدة` }); }
        else target.issues.push({ level: 'error', field: 'palm', msg: `مفيش نخلة رقم ${fakeSlots.palm} في ${plot.name}` });
      }
      if (!target.level) target.issues.push({ level: 'error', field: 'plot', msg: 'اختار القطاع أو القطعة' });
    } else {
      target = resolveTarget(slots, c);
    }
    Object.assign(d, { sector: target.sector, plot: target.plot, palm: target.palm, palmCandidates: target.palmCandidates, level: target.level });
    d.issues = target.issues.concat(checkOperation(d));
    d.confidence = score(d, d.opAlternatives.map(a => ({ score: a.score })));
    d.ready = !d.issues.some(i => i.level === 'error');
    return d;
  }

  return { normChars, tokenize, wordsToNumbers, parse, matchOperation, matchMaterial, resolveTarget, understand, revalidate, prepCtx, stem };
});
