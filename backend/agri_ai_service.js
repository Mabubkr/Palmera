/**
 * Agri-AI Hub Service - محرك الذكاء الاصطناعي الزراعي للمنظومة
 * يدعم نماذج Google Gemini الرسمية مع محرك قواعد زراعية محلي فائق الاستقرار (Hybrid Offline-First)
 */

let GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
// قائمة النماذج المعتمدة مع التبديل التلقائي (gemini-3.6-flash نشط ومستقر)
const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.7-flash', 'gemini-flash-latest', 'gemini-3.5-flash-lite'];

function setApiKey(key) {
  if (key && typeof key === 'string') {
    GEMINI_API_KEY = key.trim();
  }
}

function getApiKey() {
  return GEMINI_API_KEY;
}

/**
 * دالة استدعاء مرنة لـ Google Gemini تدعم التبديل التلقائي بين النماذج (Failover)
 */
async function callGeminiAPI(bodyObj, timeoutMs = 25000) {
  if (!GEMINI_API_KEY) return null;
  for (const model of GEMINI_MODELS) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY }, // key in a header, not in the URL (URLs end up in logs)
        body: JSON.stringify(bodyObj),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (resp.ok) {
        const data = await resp.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return { text, model, raw: data };
        }
      } else {
        const errTxt = await resp.text();
        console.warn(`Gemini model ${model} HTTP ${resp.status}:`, errTxt.substring(0, 150));
      }
    } catch (err) {
      console.warn(`Gemini model ${model} call error:`, err.message);
    }
  }
  return null;
}

/**
 * 1. فحص الآفات وسوسة النخيل بالرؤية والوصف (Computer Vision Diagnostics)
 */
async function diagnosePest({ imageBase64, imagesBase64, mimeType, description, palmCode, notes }) {
  const combinedDesc = [description, notes].filter(Boolean).join(' ');

  // 1.1 محاولة استخدام نموذج Gemini السحابي إن وُجد مفتاح الـ API
  if (GEMINI_API_KEY) {
    try {
      const contents = [];
      const parts = [];

      const allImages = Array.isArray(imagesBase64) && imagesBase64.length ? imagesBase64 : (imageBase64 ? [imageBase64] : []);
      for (const img of allImages) {
        if (!img) continue;
        let mime = mimeType || 'image/jpeg';
        const mimeMatch = img.match(/^data:([^;]+);base64,/);
        if (mimeMatch) mime = mimeMatch[1];
        const cleanBase64 = img.replace(/^data:[^;]+;base64,/, '');
        parts.push({
          inlineData: {
            mimeType: mime,
            data: cleanBase64
          }
        });
      }

      const promptText = `
أنت كبير خبراء واستشاري وقاية النباتات والرؤية الحاسوبية المتخصص في نخيل التمر وأشجار الزيتون.
حلل الصورة المرفقة والبيانات الميدانية التالية:
كود النخلة: "${palmCode || 'غير محدد'}"
الملاحظات والأعراض الميدانية: "${combinedDesc || 'فحص بصري'}"

خطوات الفحص الصارمة:
1. تحقق أولاً: هل الصورة المرفقة تمثل نخلة أو أجزاء نباتية زراعية (جذع، سعف، خوص، عراجين، طلع، ثمار، آفات وحشرات زراعية)؟
2. إذا كانت الصورة تمثل عنصراً غير زراعي إطلاقاً (مثل: صورة إنسان، وجه، سيارة، غرفة، أثاث، مستند غير زراعي):
   أرجع فوراً:
   - pest_detected: false
   - pest_name: "صورة غير صالحة للفحص (عنصر غير زراعي)"
   - pest_latin: "Non-Agricultural Image"
   - confidence: 0
   - severity: "invalid"
   - severity_label: "صورة غير صالحة (ليست نخلة)"
   - diagnosis_summary: "الصورة المرفقة تمثل شخصاً أو عنصراً غير زراعي ولا تحتوي على أنسجة نخلة. يرجى التقاط صورة مقربة وواضحة للجذع أو السعف المصاب."
   - recommended_action: "إعادة التقاط صورة مقربة لنخلة أو جزء نباتي مصاب."
   - treatment_protocol: null

3. إذا كانت الصورة تمثل نخلة أو آفات زراعية:
   افحص بدقة:
   - هل توجد أعراض لمرض "خياس الطلع الفطري" (Mauginiella scaettae) أو "اللفحة السوداء واحتراق النورات الزهرية" (Thielaviopsis paradoxa / Black Scorch): مثل احتراق أو تفحم أو اسوداد أو جفاف أكياس الطلع (الإغريض/الكافور) أو تعفن وتصلب الشماريخ وموت الأزهار وحبوب اللقاح؟ إذا ظهر ذلك، يجب فوراً تشخيصه: "خياس الطلع واللفحة السوداء للنورات الزهرية (Inflorescence Rot & Black Scorch)" بدرجة خطورة "critical" (إصابة حرجة متقدمة)، وتحديد بروتوكول الاستئصال الميكانيكي بالحرق والرش الفطري بمركبات هيدروكسيد النحاس أو ثيوفانات الميثيل مع تعفير الكبريت الزراعي.
   - هل توجد مؤشرات لسوسة النخيل الحمراء (إفرازات صمغية لزجة، نشارة خشبية رطبة، تآكل أنسجة)؟
   - هل توجد حشرات قشرية أو حشرة الدوباس (Ommatissus lybicus) أو ندوة عسلية أو حلم الغبار (الغبير)؟
   - هل توجد دودة البلح الصغرى أو الكبرى؟
   - تنبيه صارم: إذا ذكر المستخدم في الملاحظات أو ظهر في الصورة أي عَرَض لاحتراق أو اسوداد أو تعفن أو جفاف غير طبيعي في الطلع أو السعف أو القلب، يُمنع منعاً باتاً تصنيف الحالة كسليمة!
   - هل الأنسجة طبيعية وخضراء وسليمة تماماً؟

المطلوب: إرجاع كائن JSON صالح فقط دون أي كود Markdown خارجي، بالحقول التالية:
{
  "pest_detected": true/false,
  "pest_name": "اسم الآفة الشائع بالعربية (أو أنسجة سليمة)",
  "pest_latin": "الاسم العلمي باللاتينية",
  "confidence": نسبة مئوية كرقم بين 0 و 100,
  "severity": "healthy" أو "suspected" أو "early" أو "moderate" أو "critical" أو "invalid",
  "severity_label": "سليمة" أو "اشتباه مبكر" أو "إصابة مبكرة" أو "إصابة متوسطة" أو "إصابة حرجة متقدمة" أو "صورة غير زراعية",
  "symptoms_identified": ["عرض 1", "عرض 2"],
  "diagnosis_summary": "شرح علمي دقيق للحالة المرصودة في الصورة باللغة العربية",
  "treatment_protocol": {
    "chemical_name": "المادة الفعالة أو الاسم التجاري للمبيد",
    "dosage": "الجرعة وطريقة التخفيف",
    "application_method": "طريقة التطبيق (حقن جذع، رش تاغ، غمر)",
    "steps": ["خطوة 1", "خطوة 2", "خطوة 3"],
    "quarantine_needed": true/false
  },
  "recommended_action": "ما يجب على الفني أو المهندس اتخاذه فوراً في الحقل"
}
`;
      parts.push({ text: promptText });
      contents.push({ role: 'user', parts });

      const geminiRes = await callGeminiAPI({ contents }, 25000);
      if (geminiRes && geminiRes.text) {
        const jsonMatch = geminiRes.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          parsed.source = 'gemini_cloud_ai';
          parsed.model = geminiRes.model;
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Gemini Vision API fallback triggered:', err.message);
    }
  }

  // 1.2 المحرك الزراعي الميداني المحلي (Local Agronomic Rule Engine)
  // Without Gemini the photo itself is NOT analysed. Say so, never claim a visual verdict.
  const hasText = combinedDesc.replace(/\s+/g, '').length >= 4;
  if (!hasText) {
    return {
      source: 'not_analyzed',
      image_analyzed: false,
      pest_detected: null,
      pest_name: 'لم يتم تحليل الصورة',
      confidence: 0,
      severity: 'unknown',
      severity_label: 'غير محدد',
      symptoms_identified: [],
      diagnosis_summary: 'تحليل الصور يحتاج اتصال بخدمة Gemini (المفتاح غير مُعد أو لا يوجد إنترنت). اكتب وصف الأعراض اللي شايفها وأنا أقترح تشخيص مبدئي، أو أعد المحاولة لما الاتصال يرجع.',
      treatment_protocol: { chemical_name: '—', dosage: '—', application_method: '—', steps: [], quarantine_needed: false },
      recommended_action: 'معاينة ميدانية بواسطة المهندس قبل اعتبار النخلة سليمة أو مصابة.'
    };
  }
  const guess = fallbackPestDiagnosis({ description: combinedDesc, palmCode });
  return Object.assign(guess, {
    image_analyzed: false,
    confidence: Math.min(guess.confidence || 0, 55),
    diagnosis_summary: '⚠️ تشخيص مبدئي من الوصف المكتوب فقط (الصورة لم تُحلل). ' + (guess.diagnosis_summary || ''),
    recommended_action: (guess.recommended_action || '') + ' يلزم تأكيد المهندس ميدانياً.'
  });
}

function fallbackPestDiagnosis({ description = '', palmCode = '' }) {
  const text = (description || '').toLowerCase();

  // 1. فحص خياس الطلع واللفحة السوداء واحتراق النورات الزهرية (Inflorescence Rot & Black Scorch)
  if (text.includes('طلع') || text.includes('خياس') || text.includes('احتراق') || text.includes('تفحم') || text.includes('إغريض') || text.includes('اغريض') || text.includes('كافور') || text.includes('شماريخ') || text.includes('نورة') || text.includes('نورات') || text.includes('scorch') || (text.includes('اسوداد') && (text.includes('طلع') || text.includes('نخل')))) {
    return {
      source: 'local_expert_engine',
      pest_detected: true,
      pest_name: 'خياس الطلع واللفحة السوداء للنورات الزهرية',
      pest_latin: 'Mauginiella scaettae / Thielaviopsis paradoxa',
      confidence: 96,
      severity: 'critical',
      severity_label: 'إصابة حرجة متقدمة',
      symptoms_identified: [
        'تفحم واحتراق الغلاف الزهري (الإغريض/الكافور) باللون البني المسود الجاف',
        'جفاف واحتراق الشماريخ الزهرية وموت الأزهار وحبوب اللقاح قبل الإخصاب',
        'امتداد الاسوداد الفطري لقواعد الكرب وأنسجة قلب النخلة المحيطة مع خطر الوصول للجمارة'
      ],
      diagnosis_summary: `تم رصد أعراض قطعية لمرض خياس الطلع الفطري واللفحة السوداء للنورات في النخلة ${palmCode || ''}. الإصابة خطيرة وتستوجب استئصال الطلع المصاب بالحرق والرش الفطري النحاسي العاجل خلال 24 ساعة لحماية القمة النامية (الجمارة) من الموت.`,
      treatment_protocol: {
        chemical_name: 'هيدروكسيد النحاس 77% WP (كوسايد 2000) أو ثيوفانات الميثيل 70% (توبسين إم) أو دايفينوكونازول (سكور)',
        dosage: '250 جم نحاس كوسايد / 100 لتر ماء أو 100 جم توبسين إم / 100 لتر ماء',
        application_method: 'استئصال ميكانيكي بالحرق + رش تاجي غامر بضغط عالي + تعفير بالكبريت الزراعي',
        steps: [
          'استئصال الأغاريض والطلع المحترق والمتفحم فوراً بآلة حادة معقمة ووضعه في أكياس محكمة وحرقه خارج المزرعة',
          'تطهير مكان القطع فوراً بمحلول هيبوكلوريت الصوديوم المخفف أو كحول طبي 70%',
          'رش تاجي غامر لقلب النخلة وتاج السعف بالكامل بالمبيد الفطري النحاسي بضغط 2.5 بار',
          'تعفير قلب النخلة بالكبريت الزراعي الناعم لامتصاص الرطوبة ومنع إنبات الأبواغ الفطرية مجدداً',
          'تنظيم وتخفيف الري وتجنب الرش المباشر على قمم الأشجار لتقليل الرطوبة في القلب'
        ],
        quarantine_needed: true
      },
      recommended_action: 'عزل النخلة فوراً في غرفة العمليات، استئصال الطلع المحترق وحرقه خارج الحقل، وتكليف فريق الوقاية بالرش الفطري خلال 24 ساعة.'
    };
  }

  // 2. فحص سوسة النخيل الحمراء
  if (text.includes('سوسة') || text.includes('صمغ') || text.includes('نشارة') || text.includes('إفراز') || text.includes('ثقب') || text.includes('تآكل') || text.includes('جذع') || text.includes('weevil')) {
    const isCritical = text.includes('شديد') || text.includes('حرج') || text.includes('متقدم') || text.includes('سقوط') || text.includes('رائحة');
    return {
      source: 'local_expert_engine',
      pest_detected: true,
      pest_name: 'سوسة النخيل الحمراء',
      pest_latin: 'Rhynchophorus ferrugineus',
      confidence: isCritical ? 96 : 89,
      severity: isCritical ? 'critical' : 'early',
      severity_label: isCritical ? 'إصابة حرجة متقدمة' : 'إصابة مبكرة قابلة للشفاء',
      symptoms_identified: [
        'إفرازات صمغية لزجة بنية محمرة تسيل من الجذع',
        'وجود نشارة خشبية رطبة برائحة التخمر ناتجة عن تغذية اليرقات',
        'ثقوب نخرية في الأنسجة الوعائية لجذع النخلة'
      ],
      diagnosis_summary: `تم رصد مؤشرات حيوية دقيقة لنشاط يرقات سوسة النخيل الحمراء في النخلة ${palmCode || ''}. الإصابة تستوجب التدخل الميكانيكي والكيميائي خلال 24 ساعة لإنقاذ الأنسجة التاجية.`,
      treatment_protocol: {
        chemical_name: 'إيميداكلوبريد 20% SL أو كلوربيريفوس 48% EC',
        dosage: '3 سم مكعب لكل لتر ماء (محلول علاجي مركز)',
        application_method: 'حقن الجذع المائل بمضخة الضغط العالي وسد الفتحات',
        steps: [
          'تنظيف مكان الثقب وإزالة النشارة والأنسجة الميتة حتى الوصول للنسيج الحي',
          'عمل 2 إلى 3 ثقوب مائلة لأسفل بزاوية 45 درجة وبعمق 15-20 سم فوق منطقة الإصابة بـ 10 سم',
          'حقن المحلول المبيدي (2 إلى 3 لتر لكل نخلة) بضغط 2 بار حتى التشبع التام',
          'سد الثقوب فوراً بإسمنت أبيض مضاف إليه مبيد حشري أو طين زراعي لمنع وضع البيض مجدداً',
          'رش تاج النخلة وجذعها بالكامل بمحلول وقائي لمنع خروج أو دخول الحشرات البالغة'
        ],
        quarantine_needed: true
      },
      recommended_action: 'عزل النخلة فوراً في غرفة العمليات، وتسجيل بلاغ آفة، وتكليف فني المكافحة بالحقن خلال 24 ساعة.'
    };
  }

  // 3. فحص حلم الغبار / الغبير
  if (text.includes('غبار') || text.includes('غبير') || text.includes('عنكبوت') || text.includes('نسيج') || text.includes('ثمار')) {
    return {
      source: 'local_expert_engine',
      pest_detected: true,
      pest_name: 'حلم غبار النخيل (الغبير)',
      pest_latin: 'Oligonychus afrasiaticus',
      confidence: 92,
      severity: 'moderate',
      severity_label: 'إصابة متوسطة',
      symptoms_identified: [
        'نسيج حريري دقيق يغطي الشماريخ والثمار',
        'تجمع ذرات الغبار على العراجين وتحول لون البلح للرمادي المغبر',
        'تصلب وتشقق قشرة الثمار وتوقف نموها'
      ],
      diagnosis_summary: 'إصابة أكاروسية نموذجية بحلم الغبار ناتجة عن ارتفاع درجات الحرارة وانخفاض الرطوبة. تتطلب غسيل العراجين ومكافحة موضعية.',
      treatment_protocol: {
        chemical_name: 'كبريت ميكروني 80% WP أو أبامكتين 1.8% EC',
        dosage: '250 جم كبريت ميكروني / 100 لتر ماء أو 40 سم أبامكتين / 100 لتر ماء',
        application_method: 'رش مباشر غامر للثمار والشماريخ من أعلى لأسفل',
        steps: [
          'غسيل العراجين بضغط ماء عالي لإزالة خيوط العنكبوت والأتربة',
          'الرش في الصباح الباكر أو بعد الغروب لتفادي حروق الشمس الكبريتية',
          'تكرار الرش بعد 14 يوماً للقضاء على الأطوار الفاقسة'
        ],
        quarantine_needed: false
      },
      recommended_action: 'تنفيذ رشة وقائية عاجلة للعراجين وتفقد الأشجار المجاورة في نفس القطعة.'
    };
  }

  // 4. فحص حشرة دوباس النخيل والحشرات القشرية
  if (text.includes('دوباس') || text.includes('ندوة') || text.includes('عسلية') || text.includes('دبس') || text.includes('قشرية') || text.includes('عفن أسود')) {
    return {
      source: 'local_expert_engine',
      pest_detected: true,
      pest_name: 'حشرة دوباس النخيل والحشرات القشرية',
      pest_latin: 'Ommatissus lybicus / Parlatoria blanchardi',
      confidence: 94,
      severity: 'moderate',
      severity_label: 'إصابة متوسطة إلى شديدة',
      symptoms_identified: [
        'إفراز ندوة عسلية دبسية غزيرة على السعف والشماريخ',
        'تكون فطر العفن الأسود الدخاني على السطح العلوي للجريد',
        'اصفرار السعف وتدني كفاءة البناء الضوئي وتشوه الثمار'
      ],
      diagnosis_summary: `إصابة حشرية نشطة بحشرة الدوباس والحشرات القشرية في النخلة ${palmCode || ''}. يلزم الرش التاجي الفوري لمنع الإجهاد وسقوط المحصول.`,
      treatment_protocol: {
        chemical_name: 'ثياميثوكسام 25% WG (أكتارا) أو أسيتامبريد 20% SP مع مادة ناشرة',
        dosage: '60 جم ثياميثوكسام / 100 لتر ماء',
        application_method: 'رش تاجي عالي الضغط يغطي قلب النخلة والسعف بالكامل',
        steps: [
          'الرش في الصباح الباكر أو عند الغروب لتفادي درجات الحرارة العالية',
          'غسيل النخيل بضغط ماء عالي بعد أسبوع من الرش لإزالة الندوة العسلية والعفن الأسود',
          'تكرار الرش بعد 15 يوماً في حال رصد أطوار حورية جديدة'
        ],
        quarantine_needed: false
      },
      recommended_action: 'إصدار أمر رش تاجي لقطاع الإصابة بالكامل وتطهير السعف المحيط.'
    };
  }

  // 5. فحص لفحة السعف وتعفن القمة النامية (البلعوم)
  if (text.includes('بلعوم') || text.includes('جمارة') || text.includes('موت القمة') || text.includes('تعفن القمة') || text.includes('لفحة') || text.includes('فطر') || text.includes('عفن')) {
    return {
      source: 'local_expert_engine',
      pest_detected: true,
      pest_name: 'تعفن القمة النامية (البلعوم) ولفحة السعف',
      pest_latin: 'Thielaviopsis paradoxa / Fusarium oxysporum',
      confidence: 90,
      severity: 'critical',
      severity_label: 'إصابة فطرية حرجة',
      symptoms_identified: [
        'بقع بنية إلى سوداء غائرة على قواعد السعف والشماريخ الزهرية',
        'موت أطراف السعف القلبي الحديث وانحناؤه بشكل غير طبيعي',
        'جفاف الأزهار والطلع قبل تفتحه'
      ],
      diagnosis_summary: 'إصابة فطرية تنتقل عبر جروح التقليم والتكريب غير المعقمة في الأجواء الرطبة.',
      treatment_protocol: {
        chemical_name: 'أوكسي كلورور النحاس 50% WP أو ثيوفانات الميثيل 70%',
        dosage: '300 جم / 100 لتر ماء',
        application_method: 'رش موضعي وصب مباشر لمنطقة القمة وقواعد السعف المصابة',
        steps: [
          'استئصال الأجزاء المصابة بشفرات معقمة بالكحول',
          'طلاء أماكن الجروح بعجينة بوردو (كبريتات نحاس + جير حي + ماء)',
          'رش وسكب المبيد النحاسي على قلب النخلة بالكامل'
        ],
        quarantine_needed: true
      },
      recommended_action: 'تقليم الأجزاء المتعفنة، تطهير أدوات التقليم، وتطبيق محلول نحاسي غامر.'
    };
  }

  // 6. فحص عام لأي أعراض مرضية أو تلف (Safety Catch)
  if (text.includes('مرض') || text.includes('إصابة') || text.includes('تلف') || text.includes('موت') || text.includes('اسوداد') || text.includes('اصفرار') || text.includes('جفاف') || text.includes('ذبول') || text.includes('سواد') || text.includes('كسر') || text.includes('تشوه')) {
    return {
      source: 'local_expert_engine',
      pest_detected: true,
      pest_name: 'اشتباه إصابة مرضية أو فسيولوجية غير محددة',
      pest_latin: 'Suspected Pathological / Physiological Disorder',
      confidence: 85,
      severity: 'suspected',
      severity_label: 'اشتباه إصابة (تستوجب المعاينة)',
      symptoms_identified: [
        'أعراض غير اعتيادية تم رصدها بالوصف أو الصورة تستوجب التدقيق',
        'تغير في لون الأنسجة أو جفاف موضعي لا يتطابق مع النخيل السليم'
      ],
      diagnosis_summary: `النخلة ${palmCode || ''} تظهر عليها مؤشرات إجهاد أو اشتباه إصابة فطرية/حشرية بناء على البلاغ المدخل (${description}). يوصى بعدم تثبيتها كسليمة وإرسال فني الوقاية لمعاينتها ميدانياً.`,
      treatment_protocol: {
        chemical_name: 'محلول وقائي فطري نحاسي عام (أوكسي كلورور النحاس 50%)',
        dosage: '250 جم / 100 لتر ماء',
        application_method: 'رش موضعي وقائي للأنسجة المتأثرة',
        steps: [
          'معاينة النخلة عن قرب وفحص قواعد السعف والقلب والعرجون',
          'أخذ عينة نباتية إن لزم الأمر للفحص المعملي',
          'تطبيق رشة وقائية عامة لحين صدور التقرير النهائي'
        ],
        quarantine_needed: false
      },
      recommended_action: 'تكليف المهندس الزراعي بالمعاينة الميدانية خلال 48 ساعة وعدم تأكيد سلامة النخلة حتى التأكد.'
    };
  }

  // الحالة السليمة الافتراضية (فقط عند خلو الوصف من أي أعراض مرضية)
  return {
    source: 'local_expert_engine',
    pest_detected: false,
    pest_name: 'أنسجة سليمة وطبيعية',
    pest_latin: 'Phoenix dactylifera - Healthy',
    confidence: 94,
    severity: 'healthy',
    severity_label: 'سليمة ومعافاة',
    symptoms_identified: [
      'جذع متماسك وخالٍ من الإفرازات الصمغية أو النشارة',
      'ليف طبيعي غير متهتك وقواعد سعف سليمة',
      'نمو خضري نشط للقمة النامية'
    ],
    diagnosis_summary: `الفحص البصري للنخلة ${palmCode || ''} يؤكد سلامة النسيج الجذعي وعدم وجود أي علامات نشاط لحشرات ثاقبة أو إصابات فطرية متقدمة.`,
    treatment_protocol: {
      chemical_name: 'غير مطلوب — برنامج وقائي دوري فقط',
      dosage: 'تعفير بالكبريت الزراعي للوقاية الدورية',
      application_method: 'مراقبة دورية كل 15 يوماً',
      steps: [
        'استمرار أعمال الري والتسميد المعتادة بحسب الخطة الشهرية',
        'الحفاظ على نظافة محيط الجذع وإزالة الحشائش وقواعد السعف الجاف'
      ],
      quarantine_needed: false
    },
    recommended_action: 'تثبيت حالة النخلة كسليمة والمحافظة على جدول الفحص الميداني الروتيني.'
  };
}

function parseLabNum(val, def = 0) {
  if (val === undefined || val === null) return def;
  const s = String(val).trim();
  if (s === '') return def;
  const n = parseFloat(s);
  return isNaN(n) ? def : n;
}

/**
 * 2. محلل تقارير التربة والمياه وتوليد برامج التسميد (Lab Report & Fertilizer Optimizer)
 */
async function analyzeLabReport({ ec, ph, sar, n, p, k, ca, mg, sectorId, cropType = 'palm' }) {
  const ecVal = parseLabNum(ec, 2.5); // dS/m
  const phVal = parseLabNum(ph, 7.8);
  const sarVal = parseLabNum(sar, 4.2);
  const nVal = parseLabNum(n, 18);   // mg/kg
  const pVal = parseLabNum(p, 12);   // mg/kg
  const kVal = parseLabNum(k, 140);  // mg/kg
  const caVal = parseLabNum(ca, 85); // mg/L
  const mgVal = parseLabNum(mg, 35); // mg/L

  // 1. تصنيف الملوحة EC
  let ecStatus = 'طبيعية ومثالية';
  let ecBadge = 'ok';
  if (ecVal === 0) {
    ecStatus = 'منعدمة (ماء مقطر/تربة مغسولة)';
    ecBadge = 'ok';
  } else if (ecVal > 8.0) {
    ecStatus = 'مرتفعة جداً وحرجة (تراكم أملاح خطير)';
    ecBadge = 'danger';
  } else if (ecVal > 4.0) {
    ecStatus = 'مرتفعة (تتطلب غسيل 18%)';
    ecBadge = 'warn';
  } else if (ecVal > 2.5) {
    ecStatus = 'متوسطة ومتحملة للنخيل';
    ecBadge = 'ok';
  } else {
    ecStatus = 'منخفضة ومثالية جداً';
    ecBadge = 'ok';
  }

  // 2. تصنيف القلوية pH
  let phStatus = 'متعادلة ومثالية';
  let phBadge = 'ok';
  if (phVal === 0) {
    phStatus = 'قيمة صفرية (غير مقاسة)';
    phBadge = 'warn';
  } else if (phVal > 8.2) {
    phStatus = 'قلوية شديدة (تثبت الفسفور والحديد)';
    phBadge = 'danger';
  } else if (phVal >= 7.6) {
    phStatus = 'قلوية خفيفة إلى متوسطة (شائعة بالواحات)';
    phBadge = 'warn';
  } else if (phVal >= 6.5) {
    phStatus = 'متعادلة ومثالية للنخيل';
    phBadge = 'ok';
  } else if (phVal >= 5.5) {
    phStatus = 'حمضية خفيفة (تيسير جيد للعناصر)';
    phBadge = 'ok';
  } else {
    phStatus = 'حمضية شديدة غير معتادة';
    phBadge = 'danger';
  }

  // 3. تصنيف الصوديوم SAR
  let sarStatus = 'آمن ومثالي';
  let sarBadge = 'ok';
  if (sarVal === 0) {
    sarStatus = 'منعدم (0) - خالية تماماً من صوديوم التربة';
    sarBadge = 'ok';
  } else if (sarVal > 9.0) {
    sarStatus = 'مرتفع وخطر (تربة صودية متدهورة)';
    sarBadge = 'danger';
  } else if (sarVal >= 6.0) {
    sarStatus = 'متوسط الخطورة (يحتاج جبس زراعي)';
    sarBadge = 'warn';
  } else {
    sarStatus = 'آمن ومثالي (لا خطر من الصودية)';
    sarBadge = 'ok';
  }

  // 4. تصنيف النيتروجين N
  let nStatus = 'متوسط ومتوازن';
  let nBadge = 'ok';
  if (nVal === 0) {
    nStatus = 'منعدم (0) - فقر حرج بالنيتروجين';
    nBadge = 'danger';
  } else if (nVal < 15) {
    nStatus = 'منخفض جداً (عجز واضح)';
    nBadge = 'danger';
  } else if (nVal < 25) {
    nStatus = 'منخفض ويحتاج دعم';
    nBadge = 'warn';
  } else if (nVal <= 45) {
    nStatus = 'كافٍ ومتوازن';
    nBadge = 'ok';
  } else {
    nStatus = 'مرتفع وفائض (يجب تخفيف التسميد)';
    nBadge = 'ok';
  }

  // 5. تصنيف الفوسفور P
  let pStatus = 'كافٍ وميسر';
  let pBadge = 'ok';
  if (pVal === 0) {
    pStatus = 'منعدم (0) - فقر حاد بالفسفور';
    pBadge = 'danger';
  } else if (pVal < 10) {
    pStatus = 'منخفض جداً ومثبت بالقلوية';
    pBadge = 'danger';
  } else if (pVal < 20) {
    pStatus = 'منخفض (يحتاج تنشيط)';
    pBadge = 'warn';
  } else if (pVal <= 35) {
    pStatus = 'كافٍ وميسر';
    pBadge = 'ok';
  } else {
    pStatus = 'مرتفع وغني';
    pBadge = 'ok';
  }

  // 6. تصنيف البوتاسيوم K
  let kStatus = 'جيد ومتوازن';
  let kBadge = 'ok';
  if (kVal === 0) {
    kStatus = 'منعدم (0) - عجز حرج بالبوتاسيوم';
    kBadge = 'danger';
  } else if (kVal < 100) {
    kStatus = 'منخفض جداً (خطر على تحجيم التمر)';
    kBadge = 'danger';
  } else if (kVal < 180) {
    kStatus = 'متوسط ويحتاج دعم';
    kBadge = 'warn';
  } else if (kVal <= 280) {
    kStatus = 'جيد ومتوازن';
    kBadge = 'ok';
  } else {
    kStatus = 'مرتفع وغني';
    kBadge = 'ok';
  }

  // 7. تصنيف الكالسيوم Ca
  let caStatus = 'جيد';
  let caBadge = 'ok';
  if (caVal === 0) {
    caStatus = 'منعدم (0) - عجز كالسيوم حرج';
    caBadge = 'danger';
  } else if (caVal < 50) {
    caStatus = 'منخفض (يحتاج نترات كالسيوم)';
    caBadge = 'warn';
  } else if (caVal <= 150) {
    caStatus = 'جيد ومثالي لجدران الخلايا';
    caBadge = 'ok';
  } else {
    caStatus = 'مرتفع (ماء كلسي عسر)';
    caBadge = 'warn';
  }

  // 8. تصنيف المغنيسيوم Mg
  let mgStatus = 'جيد';
  let mgBadge = 'ok';
  if (mgVal === 0) {
    mgStatus = 'منعدم (0) - عجز مغنيسيوم حرج';
    mgBadge = 'danger';
  } else if (mgVal < 20) {
    mgStatus = 'منخفض (ضعف في تمثيل الكلوروفيل)';
    mgBadge = 'warn';
  } else if (mgVal <= 60) {
    mgStatus = 'جيد ومتوازن للسعف';
    mgBadge = 'ok';
  } else {
    mgStatus = 'مرتفع';
    mgBadge = 'warn';
  }

  // توصيات أحماض معادلة القلوية والملوحة
  let acidPlan = '';
  let acidDosage = '';
  if (phVal > 8.2) {
    acidPlan = '⚠️ قلوية شديدة وجيرية: حقن حامض كبريتيك 98% تجاري بالتبادل مع حامض فسفوريك 85% لخفض الـ pH وتحرير الفسفور والمغذيات الصغرى المثبتة.';
    acidDosage = '3.5 لتر حامض كبريتيك + 3.0 لتر حامض فسفوريك لكل فدان أسبوعياً عبر شبكة التنقيط.';
  } else if (phVal >= 7.6) {
    acidPlan = 'حقن حامض فسفوريك 85% وحامض كبريتيك أسبوعياً لمعادلة القلوية وتيسير امتصاص الفسفور في منطقة الجذور.';
    acidDosage = '2.5 لتر حامض فسفوريك + 2.5 لتر حامض كبريتيك تجاري لكل فدان أسبوعياً عبر شبكة التنقيط.';
  } else if (phVal > 0 && phVal < 6.0) {
    acidPlan = 'التربة حامضية بطبيعتها: الامتناع عن حقن أحماض إضافية، وينصح بالري بماء متعادل لتفادي هبوط الـ pH أكثر.';
    acidDosage = 'إيقاف الأحماض واستخدام نترات الكالسيوم لمعادلة الحموضة.';
  } else if (phVal === 0) {
    acidPlan = 'لم يتم تحديد قراءة الـ pH بدقة: استخدام المعدلات الوقائية لتسليك النقاطات فقط.';
    acidDosage = '1.0 لتر حامض فسفوريك لكل فدان كل 15 يوماً للتسليك الوقائي.';
  } else {
    acidPlan = 'حموضة التربة مثالية ومتعادلة: استخدام الأحماض بالمعدلات الوقائية الاعتيادية لتسليك النقاطات.';
    acidDosage = '1.0 لتر حامض فسفوريك لكل فدان كل 15 يوماً.';
  }

  // حساب المعاملات الديناميكية الدقيقة للتسميد بناءً على الأرقام المدخلة
  const nFactor = nVal === 0 ? 1.85 : (nVal < 15 ? 1.5 : (nVal < 25 ? 1.2 : (nVal > 45 ? 0.65 : 1.0)));
  const phFixation = (phVal >= 7.8) ? 1.25 : 1.0;
  const pFactor = (pVal === 0 ? 1.9 : (pVal < 10 ? 1.55 : (pVal < 20 ? 1.25 : (pVal > 35 ? 0.75 : 1.0)))) * phFixation;
  const kFactor = kVal === 0 ? 1.85 : (kVal < 100 ? 1.5 : (kVal < 180 ? 1.2 : (kVal > 280 ? 0.75 : 1.0)));
  const caBonus = caVal === 0 ? 1.9 : ((ecVal > 4 || sarVal > 6 || caVal < 50) ? 1.4 : 1.0);
  const mgFactor = mgVal === 0 ? 1.8 : (mgVal < 20 ? 1.35 : 1.0);

  // توزيع خطة التسميد الموسمي الموصى بها ديناميكياً
  const seasonalSchedule = [
    {
      stage: 'مرحلة النشاط الربيعي والتزهير (فبراير - أبريل)',
      focus: 'بناء المجموع الخضري وتنشيط الجذور وخروج الطلع',
      nitrogen_kg_feddan: Math.round(22 * nFactor),
      phosphorus_kg_feddan: Math.round(14 * pFactor),
      potassium_kg_feddan: Math.round(15 * kFactor),
      calcium_kg_feddan: Math.round(10 * caBonus),
      magnesium_kg_feddan: Math.round(5 * mgFactor),
      recommended_fertilizers: [
        phVal > 7.8 ? 'سلفات نشادر 20.6% ن (تفضيلية لخفض قلوية التربة)' : 'نترات نشادر 33.5% ن',
        pVal === 0 ? '⚠️ حقن عاجل لحامض الفسفوريك 85% لتعويض فقر الفسفور الحاد' : 'حامض فسفوريك 85% فوسفور ميسر سريع الامتصاص',
        caVal === 0 ? '⚠️ حقن نترات كالسيوم لتأسيس الجذور وتفادي انهيار الأنسجة' : 'نترات كالسيوم لتنشيط الجذور البيضاء الجديدة'
      ]
    },
    {
      stage: 'مرحلة عقد وتضخم الثمار (مايو - يوليو)',
      focus: 'زيادة حجم ووزن الثمار ومنع التشقق والتساقط',
      nitrogen_kg_feddan: Math.round(16 * nFactor),
      phosphorus_kg_feddan: Math.round(8 * pFactor),
      potassium_kg_feddan: Math.round(45 * kFactor),
      calcium_kg_feddan: Math.round(16 * caBonus),
      magnesium_kg_feddan: Math.round(8 * mgFactor),
      recommended_fertilizers: [
        kVal === 0 ? '⚠️ تكثيف حقن سلفات البوتاسيوم 50% لمنع ضمور وفشل تحجيم الثمار' : (ecVal > 4 ? 'سلفات بوتاسيوم ذوابة نقية 50% (خالية من الكلور)' : 'سلفات بوتاسيوم 50% K2O (حقن أسبوعي)'),
        'نترات كالسيوم وبورون لرش العراجين وتدعيم جدران الخلايا',
        mgVal === 0 ? '⚠️ حقن سلفات مغنيسيوم لمعالجة الشلل اليخضوري' : 'سلفات مغنيسيوم لتحفيز كفاءة التمثيل الضوئي في السعف'
      ]
    },
    {
      stage: 'مرحلة النضج وبداية الرطب (أغسطس - سبتمبر)',
      focus: 'رفع نسبة السكريات وتحسين الملمس ولون التمر',
      nitrogen_kg_feddan: Math.round(6 * (nVal > 30 ? 0.6 : (nVal === 0 ? 1.5 : 1.0))),
      phosphorus_kg_feddan: Math.round(4 * pFactor),
      potassium_kg_feddan: Math.round(30 * kFactor),
      calcium_kg_feddan: Math.round(5 * caBonus),
      magnesium_kg_feddan: Math.round(4 * mgFactor),
      recommended_fertilizers: [
        'سلفات بوتاسيوم نقية قابلة للذوبان',
        nVal > 30 ? 'تخفيف النيتروجين تدريجياً لتفادي الرطوبة العالية وتلف التمر' : 'تسميد بوتاسي متوازن لإنضاج التمور'
      ]
    },
    {
      stage: 'الخدمة الشتوية وراحة الأشجار (أكتوبر - يناير)',
      focus: 'تدفئة الجذور وتغذية التربة للموسم القادم',
      nitrogen_kg_feddan: Math.round(12 * nFactor),
      phosphorus_kg_feddan: Math.round(25 * pFactor),
      potassium_kg_feddan: Math.round(10 * kFactor),
      calcium_kg_feddan: Math.round(20 * caBonus),
      magnesium_kg_feddan: Math.round(10 * mgFactor),
      recommended_fertilizers: [
        'سماد عضوي نباتي/حيواني متحلل بالكامل (كومبوست خالي من النيماتودا)',
        pVal === 0 ? '⚠️ مضاعفة دفعة سوبر فوسفات الكالسيوم الثلاثي 46% في خنادق الخدمة' : 'سوبر فوسفات الكالسيوم الثلاثي 46% (دفن في خنادق الخدمة)',
        phVal > 7.8 ? 'كبريت زراعي ناعم 95% (35 كجم/فدان) لخفض قلوية التربة' : 'كبريت زراعي وقائي'
      ]
    }
  ];

  let phDesc = phVal === 0 ? 'قراءة pH صفرية/غير محددة' : (phVal > 7.8 ? `قلوية (${phVal})` : (phVal < 6.8 ? `حمضية (${phVal})` : `تفاعل متعادل (${phVal})`));
  let ecDesc = ecVal === 0 ? 'ملوحة منعدمة (0 dS/m)' : `ملوحة (${ecVal} dS/m)`;
  let summaryText = `تحليل عينة القطاع ${sectorId || 'الميداني'}: ${phDesc} و${ecDesc}.`;
  if (nVal === 0 || pVal === 0 || kVal === 0) {
    summaryText += ` ⚠️ تم رصد انعدام لبعض العناصر الكبرى (0 mg/kg) وتم رفع المقننات الاستدراكية بالجدول للحد الأقصى لإنقاذ الأشجار.`;
  } else {
    summaryText += ` تم بناء خطة التسميد ديناميكياً لخفض تأثير القلوية وتعظيم امتصاص العناصر الكبرى.`;
  }

  let waterNote = '';
  if (ecVal > 8.0) {
    waterNote = '🚨 تحذير: ملوحة حرجة جداً! يلزم زيادة مياه الري بمقدار 25-30% كمعامل غسيل (Leaching Fraction) مع استخدام مضادات ملوحة وحقن جبس زراعي سائل لطرد الصوديوم.';
  } else if (ecVal > 4.0) {
    waterNote = 'ينصح بزيادة مقنن ماء الري بمقدار 18% كمعامل غسيل (Leaching Fraction) لتفادي تراكم الأملاح في حزام الجذور الفعال.';
  } else if (ecVal === 0) {
    waterNote = 'قراءة الملوحة صفرية: المياه خالية تماماً من الأملاح ولا تتطلب معاملات غسيل إضافية.';
  } else {
    waterNote = 'نظام الري الحالي متوازن مع الاحتياجات المائية للنخيل وجودة التربة.';
  }

  return {
    source: 'agri_lab_engine',
    summary: summaryText,
    metrics: {
      ec: { value: ecVal, unit: 'dS/m', status: ecStatus, badge: ecBadge },
      ph: { value: phVal, unit: 'pH', status: phStatus, badge: phBadge },
      sar: { value: sarVal, unit: 'SAR', status: sarStatus, badge: sarBadge },
      nitrogen: { value: nVal, unit: 'mg/kg', status: nStatus, badge: nBadge },
      phosphorus: { value: pVal, unit: 'mg/kg', status: pStatus, badge: pBadge },
      potassium: { value: kVal, unit: 'mg/kg', status: kStatus, badge: kBadge },
      calcium: { value: caVal, unit: 'mg/L', status: caStatus, badge: caBadge },
      magnesium: { value: mgVal, unit: 'mg/L', status: mgStatus, badge: mgBadge }
    },
    acid_correction: {
      strategy: acidPlan,
      dosage: acidDosage
    },
    seasonal_plan: seasonalSchedule,
    water_management_note: waterNote
  };
}

/**
 * 3. المساعد الصوتي الميداني (Voice-to-Action)
 *
 * The app understands commands locally (frontend/js/voice-intent.js, works offline). The server
 * is asked only when the app is unsure: Gemini then picks the operation type from this farm's
 * own list (enum of ids, so it cannot invent one) and re-reads the numbers. The app re-checks
 * whatever comes back against its data before showing it, so a wrong answer cannot be saved silently.
 */
const VoiceIntent = require('../frontend/js/voice-intent.js');

let voiceCtxCache = { stamp: null, ctx: null };
function voiceContext() {
  const db = require('./db.js');
  let stamp = null;
  try { stamp = db.get('SELECT version FROM sync_clock WHERE id = 1')?.version; } catch {}
  if (voiceCtxCache.ctx && stamp != null && voiceCtxCache.stamp === stamp) return voiceCtxCache.ctx;
  const ctx = VoiceIntent.prepCtx({
    sectors: db.all('SELECT id, name FROM sectors WHERE is_deleted = 0 OR is_deleted IS NULL'),
    plots: db.all('SELECT id, name, sector_id AS sector, plot_no AS plotNo, part_letter AS part, parent_plot_id AS parentPlotId FROM plots'),
    palms: db.all('SELECT id, code, plot_id AS plot, seq_no AS seq, crop_code AS cropId, is_archived AS archived FROM v_palms WHERE is_deleted = 0 OR is_deleted IS NULL'),
    operationTypes: db.all('SELECT id, name, scope_type AS scopeType, is_critical AS isCritical, requires_material AS requiresMaterial, allowed_kinds AS allowedKinds, crop_id AS cropId, active FROM operation_types'),
    fertilizers: db.all('SELECT id, name, kind, unit, active FROM fertilizers')
  });
  voiceCtxCache = { stamp, ctx };
  return ctx;
}

// Compact, id-only form of a draft (what the app needs to re-resolve)
function draftSummary(d) {
  return {
    opTypeId: d.opType ? d.opType.id : null,
    opTypeName: d.opType ? d.opType.name : null,
    alternatives: d.opAlternatives,
    slots: d.slots,
    sectorId: d.sector ? d.sector.id : null,
    plotId: d.plot ? d.plot.id : null,
    palmId: d.palm ? d.palm.id : null,
    palmCode: d.palm ? d.palm.code : null,
    level: d.level,
    material: d.material,
    quantity: d.quantity,
    unit: d.unit,
    perTree: d.perTree,
    issues: d.issues,
    confidence: d.confidence,
    ready: d.ready
  };
}

async function askGeminiForVoice(text, ctx) {
  const types = ctx.operationTypes.filter(t => t.active !== 0 && t.active !== false);
  const schema = {
    type: 'OBJECT',
    properties: {
      op_type_id: { type: 'STRING', enum: types.map(t => String(t.id)).concat(['unknown']) },
      sector_number: { type: 'STRING', nullable: true },
      plot_number: { type: 'STRING', nullable: true },
      sub_plot_letter: { type: 'STRING', nullable: true },
      palm_number: { type: 'STRING', nullable: true },
      material: { type: 'STRING', nullable: true },
      quantity: { type: 'NUMBER', nullable: true },
      unit: { type: 'STRING', nullable: true },
      corrected_text: { type: 'STRING' }
    },
    required: ['op_type_id', 'corrected_text']
  };
  const prompt = `أنت تفهم أوامر ميدانية منطوقة بالعامية المصرية أو الخليجية لمزرعة نخيل، والنص جاي من محوّل كلام لنص وممكن يكون فيه أخطاء سمع (مثلاً "قطع" بدل "قطاع"، "نقله" بدل "نخلة").
استخرج:
- op_type_id: كود العملية من القائمة دي فقط (لو مش واضح اكتب unknown):
${types.map(t => `  ${t.id} = ${t.name}`).join('\n')}
- sector_number / plot_number / palm_number: الأرقام كما قيلت (أرقام بس، مثلاً "7")، وsub_plot_letter لو قال حرف بعد رقم القطعة (A/B/C).
- material و quantity و unit لو اتقالوا.
- corrected_text: نفس الجملة بعد تصحيح أخطاء السمع.
ممنوع تخمين رقم مش موجود في الكلام.

الجملة: "${String(text).replace(/"/g, "'")}"`;
  const res = await callGeminiAPI({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0 }
  }, 12000);
  if (!res || !res.text) return null;
  try {
    const j = JSON.parse(res.text.replace(/^```(?:json)?\s*|```$/g, '').trim());
    return { json: j, model: res.model };
  } catch { return null; }
}

/**
 * POST /api/ai/parse-voice-action  { speechText }
 * → { source, model?, draft: draftSummary }  (draft resolved against the server's data)
 */
async function parseVoiceAction({ speechText = '' } = {}) {
  const text = String(speechText || '').trim().slice(0, 500);
  if (!text) return { success: false, error: 'النص فارغ' };
  let ctx;
  try { ctx = voiceContext(); } catch (err) { return { success: false, error: 'تعذر قراءة بيانات المزرعة' }; }

  const local = VoiceIntent.understand(text, ctx);
  const needsHelp = !local.opType || local.confidence < 80 || local.issues.some(i => i.level === 'error' && i.field !== 'palm');
  if (!GEMINI_API_KEY || !needsHelp) {
    return { success: true, source: 'local', draft: draftSummary(local), normalized: local.normalized };
  }

  const g = await askGeminiForVoice(text, ctx).catch(() => null);
  if (!g) return { success: true, source: 'local', draft: draftSummary(local), normalized: local.normalized };
  const j = g.json;
  // Gemini's numbers fill only what the local reading missed; its op type is used only if valid
  const slots = {};
  if (local.slots.sector == null && j.sector_number) slots.sector = String(j.sector_number).replace(/\D/g, '') || null;
  if (local.slots.plot == null && j.plot_number) slots.plot = String(j.plot_number).replace(/\D/g, '') || null;
  if (local.slots.part == null && j.sub_plot_letter && /^[A-F]$/i.test(j.sub_plot_letter)) slots.part = j.sub_plot_letter.toUpperCase();
  if (local.slots.palm == null && j.palm_number) slots.palm = String(j.palm_number).replace(/\D/g, '') || null;
  const opTypeId = local.opType ? null : (j.op_type_id && j.op_type_id !== 'unknown' ? j.op_type_id : null);
  const merged = VoiceIntent.understand(j.corrected_text || text, ctx, { slots, opTypeId });
  if (merged.quantity == null && typeof j.quantity === 'number') { merged.quantity = j.quantity; merged.unit = merged.unit || j.unit || null; }
  if (!merged.material && j.material) merged.material = { id: null, name: String(j.material).slice(0, 80), fromList: false };
  const better = merged.confidence >= local.confidence ? merged : local;
  return { success: true, source: better === merged ? 'gemini' : 'local', model: g.model, draft: draftSummary(better), normalized: better.normalized, corrected: j.corrected_text || null };
}

/**
 * POST /api/ai/voice-transcribe  { audioBase64, mimeType }
 * For phones whose browser has no speech recognition (iPhone PWA, Firefox): Gemini listens to
 * the short clip and returns the Arabic text, which the app then parses like typed text.
 */
async function transcribeVoice({ audioBase64 = '', mimeType = 'audio/webm' } = {}) {
  if (!GEMINI_API_KEY) return { success: false, error: 'التحويل الصوتي على الخادم يحتاج مفتاح Gemini — اكتب الأمر بدلاً من ذلك' };
  const data = String(audioBase64 || '').replace(/^data:[^,]+,/, '');
  if (!data || data.length > 4_000_000) return { success: false, error: 'التسجيل فارغ أو أطول من اللازم (الحد دقيقة تقريباً)' };
  const mt = /^audio\/[a-z0-9.+-]+$/i.test(mimeType) ? mimeType.split(';')[0] : 'audio/webm';
  const res = await callGeminiAPI({
    contents: [{ role: 'user', parts: [
      { inline_data: { mime_type: mt, data } },
      { text: 'اكتب الكلام المنطوق في التسجيل ده بالحرف كما قيل (عامية مصرية غالباً)، والأرقام بالأرقام. اكتب النص فقط بدون أي شرح.' }
    ] }],
    generationConfig: { temperature: 0 }
  }, 20000);
  const text = res && res.text ? res.text.trim().replace(/^["«]|["»]$/g, '') : '';
  if (!text) return { success: false, error: 'لم أستطع فهم التسجيل — حاول مرة أخرى أو اكتب الأمر' };
  return { success: true, text, model: res.model };
}

/**
 * 4. المستشار الزراعي الذكي لمشاكل الحقل (Agri-Chatbot)
 */
async function chatAgriAdvisor({ message, role = 'engineer', conversationHistory = [] }) {
  const query = (message || '').trim();
  const lower = query.toLowerCase();

  // 4.1 محاولة استخدام Gemini إن وُجد
  if (GEMINI_API_KEY) {
    try {
      const systemPrompt = `
أنت "المستشار الزراعي الذكي" الخبير والمستشار الفني والزراعي المتخصص لمنظومة إدارة مزارع نخيل التمر وأشجار الزيتون في مصر (مشروع واحة الفرافرة).
المستخدم الحالي دوره: "${role}".

قواعدك الاستشارية والأسلوبية:
- تحدث بلغة عربية فصحى زراعية راقية، دقيقة، سلسة ومباشرة، مع تنظيم إجابتك في نقاط وعناوين واضحة باستخدام التنسيق الجذاب.
- أجب عن السؤال المطروح مباشرة وقدم التوصيات الحقلية العملية الفورية.
- إذا كان المستخدم مهندساً: اذكر المواد الفعالة بدقة (Active Ingredients)، النسب العلمية والمقننات، وأسباب الأعراض الفسيولوجية والمرضية.
- إذا كان فنياً أو عاملاً: قدم خطوات تنفيذية حقلية سهلة التطبيق بدون تعقيد.
- إذا كان مستثمراً: بين الجدوى الاقتصادية وأثر المعاملة على جودة المحصول وحماية الأصول.

دليلك المعرفي المعتمد للمزرعة (Agronomic Knowledge Base):
1. [نخيل التمر - أصناف المجدول، السيوي، والبرحي]:
   - تسميد شهر سبتمبر (أيلول): مرحلة استكمال النضج وبداية الراحة بعد الحصاد؛ إيقاف النيتروجين تماماً لتفادي نموات غضة تتضرر بالشتاء، دعم البوتاسيوم (سلفات بوتاسيوم 500-750 جم/نخلة) لصلابة الأنسجة وتخزين السكريات، حقن حامض الفوسفوريك لتنشيط الجذور البيضاء الجديدة، ورش ورقي بالعناصر الصغرى (حديد، زنك، منجنيز، بورون)، وتقليل الري تدريجياً.
   - الخدمة الشتوية (أكتوبر - يناير): تسميد عضوي متحلل معقم (50-70 كجم/نخلة) + سوبر فوسفات + كبريت زراعي ناعم لمعادلة قلوية التربة.
   - خف وتدلية عراجين المجدول (مايو): 8-10 عراجين للنخلة، إزالة 25-30% من الشماريخ الداخلية، تقصير الأطراف 10-15% للوصول لحجم جامبو وسوبر جامبو.
   - مكافحة سوسة النخيل الحمراء: حقن جذع مائل 45° بمبيد إيميداكلوبريد 20% أو كلوربيريفوس 48% وسد الثقوب فوراً.
   - دوباس النخيل: رش تاجي بمركبات ثياميثوكسام أو أسيتامبريد مع غسيل مائي للعرامين.

2. [أشجار الزيتون - أصناف البيكوال، المنزانيللو، والكوراتينا]:
   - أسباب جفاف واحتراق أوراق الزيتون وطرق علاجها:
     * الإجهاد المائي الشديد أو التذبذب في الري: عطش طويل يليه ري غزير يسبب صدمة وسقوط الأوراق. العلاج: تنظيم ري متوازن دون تغريق أو جفاف.
     * ذبول الفيرتيسيليوم (Verticillium dahliae): جفاف مفاجئ لفرع أو جانب من الشجرة والأوراق تظل ملتصقة جافة مع اسمرار الأوعية الخشبية. العلاج: استئصال الأفرع المصابة وتعقيم أدوات التقليم، معاملة التربة بمبيدات فطرية جهازية (ثيوفانات الميثيل) مع رش نحاسي وقائي.
     * زيادة الملوحة والقلوية (EC > 3.5 dS/m): احتراق حواف وقمم الأوراق القديمة. العلاج: غسيل التربة وحقن أحماض وطاردات أملاح كالسيوم.
     * أعفان الجذور (Phytophthora): نتيجة ركود الماء حول الساق. العلاج: كشف منطقة التاج وتهويتها والحقن بمبيد ميفينوكسام أو فوستيل ألومنيوم.
`;
      const contents = [
        { role: 'user', parts: [{ text: systemPrompt + '\n\nسؤال المستخدم: ' + query }] }
      ];

      const geminiRes = await callGeminiAPI({ contents }, 25000);
      if (geminiRes && geminiRes.text) {
        return {
          reply: geminiRes.text.trim(),
          source: 'gemini_agri_llm',
          model: geminiRes.model
        };
      }
    } catch (err) {
      console.warn('Gemini Chat fallback triggered:', err.message);
    }
  }

  // 4.2 قاعدة المعرفة الزراعية المحلية المدمجة (Local Domain RAG Fallback)
  return fallbackAgriChat({ query, role });
}

function fallbackAgriChat({ query = '', role = 'engineer' }) {
  const text = query.toLowerCase();

  // 1. شهر أكتوبر والخدمة الشتوية للنخيل والزيتون
  if (text.includes('اكتوبر') || text.includes('أكتوبر') || text.includes('شهر 10') || text.includes('تشرين الاول') || text.includes('تشرين الأول') || text.includes('خدمة شتوية') || (text.includes('حقل') && (text.includes('اكتوبر') || text.includes('أكتوبر') || text.includes('شتاء')))) {
    return {
      source: 'agri_knowledge_base',
      reply: `📅 **خطة وإجراءات الحقل المعتمدة لشهر أكتوبر (تشرين الأول) لمزارع النخيل والزيتون:**
شهر أكتوبر هو حجر الزاوية لبداية **الخدمة الشتوية وتجهيز الأشجار للموسم الإنتاجي الجديد** عقب انتهاء جني المحصول:

1. **الخدمة الشتوية والتسميد العضوي الأرضي الأساسي:**
   - **فتح خنادق التسميد:** حفر خنادق نصف دائرية أو طولية على جانبي خطوط النخيل بعمق 40-50 سم وعرض 40 سم، على مسافة 1.0 إلى 1.5 متر من الجذع (تحت مسقط السعف النشط).
   - **الجرعات السمادية لكل نخلة بالغة:**
     * **50 إلى 70 كجم** سماد عضوي متحلل بالكامل (كومبوست نباتي/حيواني معقم خالي من النيماتودا والحشائش).
     * **1.5 كجم** سوبر فوسفات الكالسيوم الثلاثي 46% P₂O₅.
     * **1.0 إلى 1.5 كجم** كبريت زراعي ناعم 95% (لتدفئة الجذور ومقاومة الفطريات ومعادلة قلوية التربة).
     * **500 جم** سلفات بوتاسيوم محببة بطيئة الذوبان.
   - خلط الأسمدة جيداً مع تربة الخندق والردم والدمك، يليه **رية غزيرة فورية** لبدء التحلل وتثبيت التربة.

2. **التقليم والتكريب الصحي الشتوي:**
   - قص وإزالة السعف الجاف، المكسور، والمصاب فقط (مع المحافظة على نسبة لا تقل عن 8-10 سعفات خضراء لكل عرجون مرتقب).
   - إزالة قواعد العراجين القديمة والليف الجاف لتنظيف الجذع وحرمان سوسة النخيل من المخابئ الرطبة.
   - **التطهير الإلزامي فوراً:** تطهير مقصات ومناشير التقليم بمحلول مطهر، ورش أماكن الجروح فوراً بمحلول هيدروكسيد النحاس أو أوكسي كلورور النحاس (3 جم/لتر) وتعفير قلب النخلة بالكبريت الميكروني.

3. **تنظيم وفطام مياه الري (Water Management):**
   - خفض معدلات الري تدريجياً بنسبة 30% إلى 40% مقارنة بأشهر الصيف لتهيئة الأشجار للسكون وتعميق المجموع الجذري، ومنع تراكم الرطوبة حول التاج.

4. **بساتين الزيتون في شهر أكتوبر:**
   - استكمال جني أصناف التخليل (البيكوال والمنزانيللو) والبدء في جني أصناف الزيت (الكوراتينا).
   - إزالة السرطانات والنموات المائية عند قواعد السيقان.
   - رش وقائي فوري بعد الجلسة بهيدروكسيد النحاس لوقاية الجروح من بكتيريا التدرن وفطر عين الطاووس (*Spilocaea oleaginea*).`
    };
  }

  // 2. العمليات الحقلية العامة (بدون تحديد شهر محدد)
  if (text.includes('اجراءات الحقل') || text.includes('إجراءات الحقل') || text.includes('عمليات الحقل') || text.includes('أعمال الحقل') || text.includes('شغل الحقل') || text.includes('جدول العمليات')) {
    return {
      source: 'agri_knowledge_base',
      reply: `📋 **العمليات الحقلية العاجلة الموصى بها في الحقل حالياً (موسم الخريف / بداية الشتاء):**
بناءً على التوقيت الحالي لمزارع الواحات (نهاية سبتمبر وبداية أكتوبر)، تتلخص أولويات الحقل فيما يلي:

1. **الانتهاء التام من حصاد وفرز التمور:** تطهير أحواض النخيل وجمع التمور المتساقطة وإخراجها خارج المزرعة لقطع دورة حياة دودة البلح وخنافس الثمار.
2. **بدء فتح خنادق الخدمة الشتوية:** تجهيز الكومبوست المعقم (50-70 كجم/شجرة) والسوبر فوسفات والكبريت الزراعي للردم خلال أكتوبر ونوفمبر.
3. **الفحص الوقائي الدقيق لسوسة النخيل:** فحص قواعد الجذوع بعد إزالة الحشائش لرصد أي إفراز صمغي مبكر قبل اشتداد برودة الشتاء.
4. **تعديل برنامج الري بالتنقيط:** تقليل ساعات التشغيل ومعدلات الضخ تدريجياً لتناسب انكسار درجات الحرارة.
5. **تقليم وتطهير الجروح:** إزالة السعف اليابس وتكريب النخيل والرش الوقائي الفوري بالنحاس.

💡 *يمكنك سؤالي بالتفصيل عن أي شهر تريده، مثل: «إجراءات شهر أكتوبر»، «تسميد شهر سبتمبر»، أو «تلقيح شهر مارس».*`
    };
  }

  // 3. استفسار التسميد لشهر سبتمبر / الخريف
  if (text.includes('سبتمبر') || text.includes('أيلول') || text.includes('شهر 9')) {
    return {
      source: 'agri_knowledge_base',
      reply: `🌿 **برنامج وتوصيات التسميد لشهر سبتمبر (أيلول):**
يعتبر شهر سبتمبر مرحلة استكمال جني التمور وبداية استعداد الأشجار للراحة:
1. **إيقاف التسميد النيتروجيني تماماً:** يُمنع إضافة أي أسمدة آزوتية لتفادي خروج نموات خضراء غضة تتلف بصقيع الشتاء.
2. **التركيز على سلفات البوتاسيوم (K₂SO₄):** حقن 500-750 جم/نخلة لصلابة الأنسجة وتخزين السكريات.
3. **حقن حامض الفوسفوريك 85%:** بمعدل 1.5-2 لتر/فدان أسبوعياً لتنشيط الشعيرات الجذرية الماصة وخفض قلوية التربة.
4. **الرش الورقي بالعناصر الصغرى:** رش عناصر مخلبية (حديد، زنك، منجنيز، بورون) لتعزيز كفاءة البناء الضوئي ومناعة الأشجار.
5. **تنظيم وتخفيف الري:** تقليل كميات الري تدريجياً بنسبة 15-20% مع اعتدال الحرارة.`
    };
  }

  // 4. أشهر الشتاء (نوفمبر، ديسمبر، يناير)
  if (text.includes('نوفمبر') || text.includes('ديسمبر') || text.includes('يناير') || text.includes('شهر 11') || text.includes('شهر 12') || text.includes('شهر 1') || text.includes('الصقيع')) {
    return {
      source: 'agri_knowledge_base',
      reply: `❄️ **إجراءات الحقل في أشهر الشتاء وسكون الأشجار (نوفمبر - يناير):**
1. **استكمال ردم خنادق الخدمة الشتوية:** إنهاء التسميد العضوي والكبريت والفوسفات قبل منتصف يناير.
2. **تقليم بساتين الزيتون:** التقليم التكويني والإثماري لفتح قلب الشجرة للشمس والتهوية وإزالة الأفرع المتشابكة والمصابة.
3. **الرش الوقائي الشتوي العام:** رش النخيل والزيتون بخليط (زيت معدني شتوي 1.5% + هيدروكسيد النحاس 250 جم/100 لتر) للقضاء على الحشرات القشرية الساكنة وجراثيم الفطريات.
4. **حماية الفسائل الحديثة من الصقيع:** تغطية وتكييس قلوب الفسائل الصغيرة بالخيش أو سعف النخيل لحمايتها من لسعات البرد الشديد.
5. **المباعدة بين فترات الري:** الري على فترات متباعدة ويفضل أن يكون في الصباح لتفادي تجمد المياه حول الجذور.`
    };
  }

  // 5. أشهر الربيع والطلع والتلقيح (فبراير ومارس)
  if (text.includes('فبراير') || text.includes('مارس') || text.includes('شهر 2') || text.includes('شهر 3') || text.includes('تلقيح') || text.includes('تأبير') || text.includes('طلع') || text.includes('حبوب لقاح')) {
    return {
      source: 'agri_knowledge_base',
      reply: `🌾 **دليل عمليات التلقيح وخروج الطلع (فبراير ومارس):**
1. **متابعة انفتاح الأغاريض الزهرية (الطلع):** الفحص اليومي للقمم النامية لجمع أكمام الطلع المذكر بمجرد تشققها.
2. **تجفيف وإعداد حبوب اللقاح:** تجفيف الشماريخ المذكرة في غرف مظللة مهواة على ورق نظيف، وتجنب تعريضها للشمس المباشرة أو الرطوبة.
3. **التوقيت الذهبي للتلقيح المؤنث:** التلقيح خلال **24 إلى 72 ساعة** من انفتاح الإغريض المؤنث (بين الساعة 10 صباحاً و 3 عصراً في يوم مشمس غير ممطر ولا عاصف).
4. **طريقة التلقيح:** وضع 5-7 شماريخ مذكرة مقلوبة في قلب العرجون المؤنث وربطه بخوصة خفيفة سهلة التحلل.
5. **الوقاية من خياس الطلع:** تعفير قلب النخلة بالكبريت الميكروني ورش مبيد فطري نحاسي خفيف عند وجود رطوبة أو ضباب لتفادي موت الأزهار.`
    };
  }

  // 6. أشهر الصيف والخف والتحجيم (أبريل إلى يوليو)
  if (text.includes('ابريل') || text.includes('أبريل') || text.includes('مايو') || text.includes('يونيو') || text.includes('يوليو') || text.includes('شهر 4') || text.includes('شهر 5') || text.includes('شهر 6') || text.includes('شهر 7') || text.includes('تكييس') || text.includes('تحجيم')) {
    return {
      source: 'agri_knowledge_base',
      reply: `☀️ **إجراءات موسم الصيف والتحجيم والتكييس (أبريل - يوليو):**
1. **خف وتدلية عراجين المجدول (مايو):** إبقاء 8-10 عراجين للنخلة، إزالة 25-30% من الشماريخ الداخلية، وتقصير الأطراف 10-15% للوصول لحجم ثمار جامبو.
2. **تكثيف التسميد البوتاسي والكالسيوم (مايو - يونيو):** حقن سلفات البوتاسيوم 50% ونترات الكالسيوم وبورون لتعظيم حجم الخلايا ومنع تشقق الثمار.
3. **تكييس العراجين (يونيو - يوليو):** تغطية العراجين بأكياس شبكية زرقاء أو بيضاء مهواة (Agryl) لحمايتها من الطيور، حلم الغبار، ولسعات الشمس.
4. **مكافحة حلم الغبار (الغبير):** رش كبريت ميكروني 80% أو مبيد أورتس وقائياً بمجرد رؤية أي نسيج عنكبوتي.
5. **المقنن المائي:** رفع كميات الري إلى 180-220 لتر/نخلة يومياً مع التبكير بالتشغيل (صباحاً ومساءً).`
    };
  }

  // 7. خياس الطلع واللفحة السوداء
  if (text.includes('خياس') || text.includes('احتراق الطلع') || text.includes('تفحم') || text.includes('لفحة سوداء') || text.includes('عفن النورات') || text.includes('اسوداد الطلع') || text.includes('موت الطلع')) {
    return {
      source: 'agri_knowledge_base',
      reply: `🚨 **بروتوكول التعامل العاجل مع خياس الطلع واللفحة السوداء للنورات (*Mauginiella scaettae* / *Thielaviopsis paradoxa*):**
1. **الاستئصال الميكانيكي الفوري بالحرق:** قطع كافة الأغاريض والشماريخ المتفحمة والمحترقة بآلة حادة معقمة، ووضعها داخل أكياس محكمة وحرقها خارج المزرعة تماماً لمنع تطاير الجراثيم الفطرية.
2. **تطهير الجروح:** مسح مكان القطع فوراً بكحول طبي 70% أو هيبوكلوريت مخفف.
3. **الرش الفطري التاجي الغامر بضغط عالي (2.5 بار):**
   - رش قلب النخلة بمبيد **هيدروكسيد النحاس 77% WP (كوسايد 2000)** بمعدل 250 جم/100 لتر ماء.
   - أو **ثيوفانات الميثيل 70% (توبسين إم)** بمعدل 100 جم/100 لتر ماء.
4. **التعفير بالكبريت:** تعفير قلب النخلة وقواعد الكرب بالكبريت الزراعي الناعم لامتصاص الرطوبة وتثبيط إنبات الأبواغ.
5. **الري:** منع الرش العلوي للماء وتخفيف الري لخفض الرطوبة النسبية في قلب النخلة.`
    };
  }

  // 8. سوسة النخيل الحمراء
  if (text.includes('سوسة') || text.includes('حقن') || text.includes('نشارة') || text.includes('صمغ')) {
    if (role === 'worker') {
      return {
        source: 'agri_knowledge_base',
        reply: `🚨 **طريقة التعامل السريعة مع سوسة النخيل في الحقل:**
1. **لا تهز النخلة** أو تجرحها بعنف.
2. نظف مكان النشارة والصمغ بملعقة التقليم حتى تصل للخشب النظيف.
3. اعمل فتحتين بمثقاب (شنيور) مائل لتحت بزاوية 45 درجة فوق مكان الصمغ بـ 10 سم.
4. احقن مبيد الإيميداكلوبريد أو الكلوربيريفوس المخفف حتى يخرج المحلول من الفتحة.
5. اقفل الفتحات فوراً بجبس أو أسمنت مخلوط بمبيد لمنع خروج الحشرة أو تعفن الجرح.
6. بلغ المهندس وسجل العملية فوراً في التطبيق.`
      };
    }
    if (role === 'investor') {
      return {
        source: 'agri_knowledge_base',
        reply: `🌴 **إحاطة استثمارية بشأن سوسة النخيل:**
سوسة النخيل الحمراء خطر رئيسي ولكن لدينا **بروتوكول دفاع استباقي** في المزرعة:
- فحص دوري بالكاميرات والرصد الذكي كل 14 يوماً لاكتشاف الإصابة في الطور المبكر قبل أي ضرر هيكلي.
- نسبة الشفاء عند التدخل المبكر تتجاوز **98%** دون أي تأثير على إنتاجية النخلة الموسمية.
- نطبق مصائد فيرمونية واستقصاء رقمي للقطاعات لحماية أصولك بالكامل.`
      };
    }
    return {
      source: 'agri_knowledge_base',
      reply: `🧪 **البروتوكول الفني المعتمد لعلاج سوسة النخيل الحمراء (*Rhynchophorus ferrugineus*):**
1. **المبيدات الموصى بها:**
   - *إيميداكلوبريد 20% SL*: بتركيز 3 إلى 5 سم³ لكل لتر ماء (جهازي عالي الكفاءة).
   - *كلوربيريفوس 48% EC*: بتركيز 5 سم³ لكل لتر ماء (ملامسة وتبخير للقضاء الفوري على اليرقات).
2. **آلية الحقن الموضعي:**
   - ثقب بميل 45° باتجاه الأسفل، قطر 12-16 مم، عمق 15-20 سم.
   - حقن 2-3 لتر من المحلول المبيدي بضغط 2 بار باستخدام حواقن مانعة للارتجاع.
   - إحكام سد الثغرات بمعجون وقائي يحتوي على أوكسي كلورور النحاس وجبس.
3. **التوثيق:** تحويل حالة النخلة إلى "مصابة" مع إعادة الفحص التأكيدي بعد 21 يوماً للتحقق من جفاف الإفرازات الصمغية.`
    };
  }

  // 9. حلم الغبار (الغبير) والعناكب
  if (text.includes('غبار') || text.includes('غبير') || text.includes('حلم') || text.includes('عنكبوت')) {
    return {
      source: 'agri_knowledge_base',
      reply: `🕸️ **بروتوكول مكافحة حلم الغبار (الغبير - *Oligonychus afrasiaticus*):**
1. **التشخيص:** نسيج حريري عنكبوتي دقيق يغطي الثمار والشماريخ تتراكم عليه الأتربة، مما يؤدي لتصلب قشرة البلح وتلونها باللون البني الصدئي وفقدان المحصول.
2. **المكافحة الوقائية:** تعفير العراجين بالكبريت الزراعي الناعم في مرحلة "الجمري" قبل اشتداد الحرارة.
3. **المكافحة العلاجية الفورية:**
   - رش تاجي بمبيد أ كاروسي متخصص: **فينبيروكسيميت 5% EC (أورتس)** بمعدل 50 سم³/100 لتر ماء، أو **أبامكتين 1.8% EC** بمعدل 40 سم³/100 لتر مع مادة لاصقة وناشرة.
   - يراعى توجيه البشبوري لغسيل الثمار والشماريخ من الداخل بضغط عالي.`
    };
  }

  // 10. أشجار الزيتون (جفاف، فيرتيسيليوم، تقليم، أصناف)
  if (text.includes('زيتون') || text.includes('فيرتيسيليوم') || text.includes('عين الطاووس') || text.includes('ذبابة الزيتون')) {
    return {
      source: 'agri_knowledge_base',
      reply: `🫒 **الدليل الشامل لإدارة وحماية أشجار الزيتون في الأراضي الصحراوية:**
1. **مرض ذبول الفيرتيسيليوم (*Verticillium dahliae*):**
   - العرض: جفاف مفاجئ لفرع كامل وتظل الأوراق جافة ملتصقة بالأفرع مع اسمرار الحزم الوعائية.
   - العلاج: قص الأفرع الجافة حتى النسيج السليم وتعقيم المقصات، ومعاملة التربة بمبيد فطري جهازي (ثيوفانات الميثيل 70% بمعدل 2-3 جم/شجرة) ورش نحاسي للمجموع الخضري.
2. **جفاف واحتراق قمم الأوراق:** ينتج غالباً عن ملوحة التربة (EC > 3.5) أو تذبذب الري؛ العلاج: حقن طاردات أملاح معتمدة على الكالسيوم وحامض النيتريك وتنظيم فترات الري.
3. **ذبابة ثمار الزيتون (*Bactrocera oleae*):** نشر مصائد فيرمونية وجاذبات غذائية (داي أمونيوم فوسفات) والرش الجزئي بمبيد سبينوساد عند اصطياد 3-5 حشرات/مصيدة/أسبوع.
4. **التسميد الشتوي للزيتون:** إضافة 20-30 كجم كومبوست + 500 جم سوبر فوسفات + 500 جم كبريت زراعي للشجرة في خنادق الخدمة خلال شهري أكتوبر ونوفمبر.`
    };
  }

  // 11. أعراض نقص العناصر والتسميد NPK
  if (text.includes('نقص') || text.includes('بوتاسيوم') || text.includes('تسميد') || text.includes('سماد') || text.includes('npk') || text.includes('حديد') || text.includes('اصفرار')) {
    return {
      source: 'agri_knowledge_base',
      reply: `🍂 **تشخيص وعلاج نقص العناصر الغذائية في النخيل:**
1. **نقص البوتاسيوم ($K$):** بقع برتقالية أو صفراء على السعف المسن تليها حروق نخرية في القمم. العلاج: حقن سلفات بوتاسيوم 50% بمعدل 500-750 جم/شجرة أسبوعياً، ورش نترات بوتاسيوم 2% ورقي.
2. **نقص النيتروجين ($N$):** اصفرار وشحوب عام يبدأ بالسعف القديم مع توقف السعف الجديد. العلاج: سلفات نشادر 20.6% ن في الأراضي القلوية.
3. **نقص الفسفور ($P$):** تحول السعف القديم إلى الأخضر القاتم أو الأرجواني مع ضعف الجذور. العلاج: حقن حامض فسفوريك 85%.
4. **نقص الحديد والزنك (بسبب قلوية الواحات $pH > 7.8$):** اصفرار ناصع بين عروق السعف القلبي الحديث. العلاج: حقن شيلات حديد Fe-EDDHA (50-70 جم/نخلة) مع مياه الري.`
    };
  }

  // 12. الفسائل والغرس والزراعة
  if (text.includes('فسائل') || text.includes('فسيلة') || text.includes('غرس') || text.includes('زراعة نخل') || text.includes('مسافات')) {
    return {
      source: 'agri_knowledge_base',
      reply: `🌱 **المعايير المعتمدة لغرس وفصل فسائل النخيل (المجدول والسيوي):**
1. **مواصفات الفسيلة المثالية:** وزن 15 إلى 25 كجم، عمر 3-5 سنوات، تمتلك مجموعاً جذرياً نامياً، وخالية تماماً من أعراض سوسة النخيل.
2. **الفصل والمعاملة الوقائية:** الفصل بعتلة حادة بواسطة فني خبير، تسوية موضع الفصل وقصه برفق، ثم غمس قواعد الفسائل في محلول هرمون تجذير (IBA) ومبيد فطري نحاسي وحشري قبل الزراعة بنصف ساعة.
3. **أبعاد الجور والغرس:** حفر الجور بأبعاد (1×1×1 متر)، ردم النصف السفلي بخلطة كومبوست معقم ورمل وطمي، وغرس الفسيلة بحيث يكون أكبر قطر لها بمستوى سطح التربة مع حماية القلب من دخول الماء.
4. **مسافات الغرس:** 8×8 متر (65 نخلة/فدان) أو 10×10 متر في صنف المجدول لمنع تزاحم التاج.
5. **الري:** ري يومي خفيف ومستمر خلال أول 40-50 يوماً حتى خروج أول سعفة جديدة.`
    };
  }

  // 13. التقليم والتكريب
  if (text.includes('تقليم') || text.includes('تكريب') || text.includes('قص سعف') || text.includes('تجريد')) {
    return {
      source: 'agri_knowledge_base',
      reply: `✂️ **القواعد الفنية لتقليم وتكريب النخيل:**
1. **الموعد الأمثل:** من أكتوبر حتى نهاية ديسمبر (عقب انتهاء الجني وقبل خروج الطلع الجديد).
2. **المعايير البستانية:**
   - الحفاظ على نسبة توازن خضري مثالي (لا يقل عن 8 إلى 10 سعفات خضراء نشطة لكل عرجون مرتقب، أي حوالي 80-100 سعفة على النخلة البالغة).
   - إزالة السعف الجاف والمصاب فقط، وتجنب الجور في التقليم لأن السعف الأخضر هو مصنع الكربوهيدرات والسكريات.
3. **التكريب:** تسوية الكرب بزاوية مائلة قليلاً للخارج لتفادي تجمع مياه الأمطار أو الرطوبة.
4. **الوقاية الإلزامية:** تعقيم أدوات التقليم بين نخلة وأخرى، ورش الجذع فوراً بمبيد نحاسي وحشري وقائي لمنع انجذاب سوسة النخيل للجروح الرطبة الحديثة.`
    };
  }

  // 14. الري والمقننات المائية
  if (text.includes('ري') || text.includes('ماء') || text.includes('مياه') || text.includes('عطش') || text.includes('تنقيط') || text.includes('نقاطات')) {
    return {
      source: 'agri_knowledge_base',
      reply: `💧 **دليل الري وإدارة المقننات المائية لنخيل التمر بالواحات:**
1. **المقنن المائي الفصلي للنخلة البالغة:**
   - في الصيف الحار (يونيو - أغسطس): **180 إلى 220 لتر/نخلة/يوم**.
   - في الخريف والربيع (أبريل - مايو، سبتمبر - أكتوبر): **100 إلى 140 لتر/نخلة/يوم**.
   - في الشتاء (نوفمبر - فبراير): **40 إلى 60 لتر/نخلة/يوم**.
2. **تصميم شبكة الري بالتنقيط:**
   - حلقة ري دائرية بقطر 1.5 - 2 متر حول الجذع مزودة بـ **4 إلى 6 نقاطات** تصريف 8 أو 16 لتر/ساعة ذاتية التنظيم والضغط (PC).
   - إبعاد النقاطات عن ملامسة الجذع بمسافة لا تقل عن 50 سم لتفادي ركود الماء وظهور أعفان الساق وسوسة النخيل.
3. **معامل غسيل الأملاح (Leaching Fraction):** زيادة كميات مياه الري بنسبة 15-20% أسبوعياً في حال تجاوز ملوحة التربة أو مياه البئر 3.5 dS/m.`
    };
  }

  // 15. الرد الاستشاري المتخصص الذكي (بدلاً من تكرار الترحيب)
  return {
    source: 'agri_knowledge_base',
    reply: `🌴 **استشارة زراعية ميدانية متخصصة:**
بشأن استفسارك عن: «**${query}**»؛

توصيات الإدارة الفنية المعتمدة للمزرعة في هذا الشأن:
1. **التوافق الموسمي:** التأكد من ملاءمة المعاملة للتوقيت المناسب لمرحلة نمو الأشجار الحالية (موسم الخريف وبداية الخدمة الشتوية).
2. **المعايير الوقائية:** اتباع الإجراءات الوقائية المعتمدة لمكافحة الآفات وفحص قواعد الأشجار باستمرار.
3. **توازن التغذية:** تنظيم الري وتخفيف الأسمدة الآزوتية في هذه الفترة والاعتماد على الكومبوست المعقم والبوتاسيوم والفسفور.

💡 *يمكنك سؤالي بدقة أكبر عن أي موضوع، مثل: «إجراءات شهر أكتوبر»، «بروتوكول سوسة النخيل»، «علاج خياس الطلع»، «جدول التسميد»، أو «جفاف أوراق الزيتون».*`
  };
}

module.exports = {
  diagnosePest,
  analyzeLabReport,
  parseVoiceAction,
  transcribeVoice,
  chatAgriAdvisor,
  callGeminiAPI,
  setApiKey,
  getApiKey
};
