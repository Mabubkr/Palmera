/**
 * Agri-AI Hub - المركز الذكي للمزرعة
 * نظام متكامل للذكاء الاصطناعي الزراعي والمساعد الميداني الصوتي والتشخيص بالرؤية الحاسوبية
 * يعمل وفق معمارية Edge-First / Offline-Capable
 */

(function (window) {
  "use strict";

  // حالة المركز الذكي
  let aiActiveTab = "plot-ndvi"; // plot-ndvi | smart-irrigation | pest-risk | carbon-esg | pest-vision | soil-analyzer | voice-copilot | agri-chat | ai-settings
  let ndviSelectedPlotId = "";
  let irrigationSelectedSector = "";
  let pestRiskSelectedSector = "";

  // 1. حالة فحص الآفات والسوسة
  let pestSelectedPalmId = "";
  let pestSelectedPalmCode = "";
  let pestImages = []; // [{ preview, base64 }]
  let pestDiagnosisResult = null;
  let pestIsAnalyzing = false;
  let pestCustomNotes = "";

  // 2. حالة محلل تقارير التربة والمياه
  let soilEc = "2.8";
  let soilPh = "8.1";
  let soilSar = "4.5";
  let soilN = "16";
  let soilP = "11";
  let soilK = "140";
  let soilCa = "85";
  let soilMg = "30";
  let soilSectorId = "";
  let soilAnalysisResult = null;
  let soilIsAnalyzing = false;

  // 3. المساعد الصوتي: انظر voice-assistant.js

  // 4. حالة المستشار الزراعي
  let chatIsRecording = false;
  let chatRecognitionInstance = null;
  let chatSilenceTimeout = null;
  let agriChatHistory = [
    {
      sender: "bot",
      text: "مرحباً بك في **المستشار الزراعي الذكي** لمزرعة النخيل والزيتون! كيف يمكنني مساعدتك اليوم في أعمال الحقل، التسميد، أو مكافحة الآفات؟",
      time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })
    }
  ];
  let agriChatUserRole = "engineer";
  let agriChatIsLoading = false;

  // =========================================================================
  // دالة بناء الفهرس السريع للأشجار والقطع والقطاعات (High-Performance O(N) Index)
  // =========================================================================
  function buildAgriPalmsIndex(st) {
    const plotMap = new Map();
    const sectorMap = new Map();
    const palms = st.palms || [];
    const plots = st.plots || [];
    const plotToSector = new Map();
    for (let i = 0; i < plots.length; i++) {
      plotToSector.set(String(plots[i].id), String(plots[i].sector || plots[i].sector_id || ""));
    }

    const directPlotPalms = new Map();
    const directPlotSick = new Map();
    for (let i = 0; i < palms.length; i++) {
      const p = palms[i];
      if (p.archived || p.is_archived || p.is_deleted) continue;
      const pPlot = String(p.plot || p.plot_id || p.plotId || "");
      if (!pPlot) continue;
      directPlotPalms.set(pPlot, (directPlotPalms.get(pPlot) || 0) + 1);
      const isSick = p.statusId === 3 || (p.status && (p.status.includes("سوسة") || p.status.includes("مصاب")));
      if (isSick) {
        directPlotSick.set(pPlot, (directPlotSick.get(pPlot) || 0) + 1);
      }
    }

    // Aggregate into plots (including subplots)
    for (let i = 0; i < plots.length; i++) {
      const pl = plots[i];
      const plId = String(pl.id || "");
      let total = directPlotPalms.get(plId) || 0;
      let sick = directPlotSick.get(plId) || 0;
      for (let j = 0; j < plots.length; j++) {
        const c = plots[j];
        if (c.parentPlotId === plId || c.parent_plot_id === plId || (c.id && String(c.id).startsWith(plId + "-"))) {
          const cId = String(c.id);
          total += directPlotPalms.get(cId) || 0;
          sick += directPlotSick.get(cId) || 0;
        }
      }
      plotMap.set(plId, { total, sick });
      const sec = plotToSector.get(plId) || "";
      if (sec) {
        const sData = sectorMap.get(sec) || { total: 0, sick: 0 };
        sData.total += directPlotPalms.get(plId) || 0;
        sData.sick += directPlotSick.get(plId) || 0;
        sectorMap.set(sec, sData);
      }
    }

    return { plotMap, sectorMap };
  }

  // =========================================================================
  // دالة الشاشة الرئيسية للمركز الذكي (aiHubView)
  // =========================================================================
  function aiHubView(extra) {
    if (typeof hasPerm === "function" && !hasPerm("ai_view")) {
      return `
        <div class="card" style="padding:40px;text-align:center;max-width:520px;margin:40px auto;border-radius:16px;box-shadow:0 4px 16px rgba(0,0,0,0.06)">
          <div style="font-size:48px;margin-bottom:12px">🔒</div>
          <h3 style="margin-bottom:8px">عذراً، لا تملك صلاحية الوصول</h3>
          <p class="muted" style="line-height:1.6">ليس لديك صلاحية استعراض ودخول المركز الذكي (Agri-AI). يرجى مراجعة إدارة النظام لتفعيل الصلاحية المطلوبة.</p>
        </div>
      `;
    }

    const canNdvi = typeof hasPerm !== "function" || hasPerm("ai_ndvi") || hasPerm("ai_health");
    const canIrrigation = typeof hasPerm !== "function" || hasPerm("ai_irrigation");
    const canPestRisk = typeof hasPerm !== "function" || hasPerm("ai_pest_risks");
    const canCarbon = typeof hasPerm !== "function" || hasPerm("ai_carbon");
    const canPest = typeof hasPerm !== "function" || hasPerm("ai_pest_vision");
    const canSoil = typeof hasPerm !== "function" || hasPerm("ai_soil_analysis");
    const canVoice = typeof hasPerm !== "function" || hasPerm("ai_voice_copilot");
    const canChat = typeof hasPerm !== "function" || hasPerm("ai_chat_advisor");

    const allTabs = [
      { id: "plot-ndvi", name: "صحة القطع (NDVI)", icon: "🛰️", perm: canNdvi },
      { id: "smart-irrigation", name: "الري الذكي", icon: "💧", perm: canIrrigation },
      { id: "pest-risk", name: "مخاطر الآفات", icon: "🌡️", perm: canPestRisk },
      { id: "carbon-esg", name: "كربون و ESG", icon: "🌿", perm: canCarbon },
      { id: "pest-vision", name: "فحص بالصور", icon: "🐛", perm: canPest },
      { id: "soil-analyzer", name: "تحليل التربة", icon: "🧪", perm: canSoil },
      { id: "voice-copilot", name: "المساعد الصوتي", icon: "🎙️", perm: canVoice },
      { id: "agri-chat", name: "المستشار الزراعي", icon: "💬", perm: canChat }
    ];

    const permittedTabs = allTabs.filter(t => t.perm);

    if (permittedTabs.length === 0) {
      return `
        <div class="card" style="padding:40px;text-align:center;max-width:520px;margin:40px auto;border-radius:16px;box-shadow:0 4px 16px rgba(0,0,0,0.06)">
          <div style="font-size:48px;margin-bottom:12px">🔒</div>
          <h3 style="margin-bottom:8px">عذراً، لا تملك صلاحية لأي قسم بالمركز الذكي</h3>
          <p class="muted" style="line-height:1.6">يرجى مراجعة إدارة النظام لتفعيل الأقسام المناسبة لحسابك (مثل متابعة صحة القطع أو الري الذكي).</p>
        </div>
      `;
    }

    if (extra === "ai-settings") {
      if (typeof go === "function") {
        setTimeout(() => go("settings", "ai"), 10);
        return "";
      }
    }

    if (extra && permittedTabs.some(t => t.id === extra)) {
      aiActiveTab = extra;
    } else if (!permittedTabs.some(t => t.id === aiActiveTab)) {
      aiActiveTab = permittedTabs[0].id;
    }

    const st = typeof Store !== "undefined" ? Store.get() : {};
    const curUser = typeof session === "function" ? session() : { role: "engineer", name: "مستخدم" };
    agriChatUserRole = curUser?.role || "engineer";

    return `
      <div class="ai-hub-container" style="max-width:1200px;margin:0 auto;padding-bottom:30px">
        <!-- Main Hub Header Banner -->
        <div class="ai-hub-header" style="background:linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #064E3B 100%);border-radius:18px;padding:22px 24px;color:#fff;margin-bottom:18px;box-shadow:0 10px 25px -5px rgba(6,78,59,0.25);position:relative;overflow:hidden">
          <div style="position:absolute;top:-20px;left:-20px;width:140px;height:140px;background:rgba(255,255,255,0.06);border-radius:50%;pointer-events:none"></div>
          <div style="position:absolute;bottom:-30px;right:20%;width:180px;height:180px;background:rgba(16,185,129,0.15);border-radius:50%;filter:blur(30px);pointer-events:none"></div>
          
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;position:relative;z-index:1">
            <div>
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
                <span style="font-size:26px">🛰️</span>
                <h2 style="margin:0;font-size:22px;font-weight:800;letter-spacing:-0.5px">مركز الزراعة الذكية (Agri-AI Hub)</h2>
                
              </div>
              <div style="font-size:13px;color:#CBD5E1;max-width:760px;line-height:1.6">
                منظومة القرار الزراعي الذكي: مراقبة صحة القطع بالأقمار الصناعية (NDVI)، التنبؤ بنوافذ الري المثالية، الإنذار المبكر لنشاط سوسة النخيل والآفات، وتتبع البصمة الكربونية ومطابقة معايير الاستدامة ESG.
              </div>
            </div>
            
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              ${typeof hasPerm === "function" && hasPerm("ai_settings_manage") ? `
              <button type="button" class="btn btn-ghost" data-go="settings" data-id="ai" style="color:#CBD5E1;border:1px solid rgba(255,255,255,0.25);padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;background:rgba(255,255,255,0.06)">
                ⚙️ إعدادات Agri-AI في النظام
              </button>` : ''}
              ${(() => {
                const set = st.settings || {};
                const pill = (on, label) => `<span style="background:${on ? "rgba(16,185,129,0.2)" : "rgba(148,163,184,0.18)"};color:${on ? "#34D399" : "#CBD5E1"};border:1px solid ${on ? "rgba(52,211,153,0.3)" : "rgba(203,213,225,0.25)"};padding:4px 10px;border-radius:20px;font-size:11.5px;font-weight:700">${on ? "●" : "○"} ${label}</span>`;
                return pill(true, "الطقس") + pill(!!set.agroMonitoringKey_configured, "القمر الصناعي") + pill(!!(set.gemini_api_key_configured || set.geminiApiKey_configured), "Gemini");
              })()}
            </div>
          </div>
        </div>

        <!-- Navigation Tabs: Render ONLY permitted tabs, completely omitting any unpermitted tab -->
        <div class="ai-tabs-container" style="display:flex;flex-direction:column;gap:8px;margin-bottom:18px">
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:8px">
            ${permittedTabs.map(t => `
              <button type="button" class="btn ${aiActiveTab === t.id ? 'btn-primary' : 'btn-ghost'}" data-act="switch-ai-tab" data-tab="${t.id}" style="height:42px;font-size:12.5px;font-weight:700;border-radius:10px;display:flex;align-items:center;justify-content:center;gap:6px">
                <span>${t.icon}</span> ${t.name}
              </button>
            `).join("")}
          </div>
        </div>

        <!-- Tab Content Body: strictly guarded by permissions -->
        <div class="ai-tab-body">
          ${aiActiveTab === 'plot-ndvi' && canNdvi ? renderPlotNdviTab(st) : ''}
          ${aiActiveTab === 'smart-irrigation' && canIrrigation ? renderSmartIrrigationTab(st) : ''}
          ${aiActiveTab === 'pest-risk' && canPestRisk ? renderPestRiskTab(st) : ''}
          ${aiActiveTab === 'carbon-esg' && canCarbon ? renderCarbonEsgTab(st) : ''}
          ${aiActiveTab === 'pest-vision' && canPest ? renderPestVisionTab(st) : ''}
          ${aiActiveTab === 'soil-analyzer' && canSoil ? renderSoilAnalyzerTab(st) : ''}
          ${aiActiveTab === 'voice-copilot' && canVoice ? renderVoiceCopilotTab(st) : ''}
          ${aiActiveTab === 'agri-chat' && canChat ? renderAgriChatTab(st, curUser) : ''}
        </div>
      </div>
    `;
  }

  // =========================================================================
  // التبويب 0-أ: مراقبة صحة القطع بالأقمار الصناعية (Satellite NDVI - Orbit)
  // =========================================================================
  // =========================================================================
  // بيانات حقيقية من الخادم: الطقس (Open-Meteo) والقمر الصناعي (AgroMonitoring)
  // المفاتيح عند الخادم فقط. آخر نتيجة تتحفظ على الجهاز للعمل بدون نت.
  // =========================================================================
  const agro = { ndvi: null, weather: null, status: null, loading: {}, error: {}, at: {}, syncing: false, testing: false, testResult: null };
  const AGRO_URL = { ndvi: "/api/agro/ndvi", weather: "/api/agro/weather", status: "/api/agro/status" };

  function agroLoad(kind, force) {
    if (agro.loading[kind]) return;
    if (!force && agro[kind] && Date.now() - (agro.at[kind] || 0) < 10 * 60 * 1000) return;
    if (!agro[kind]) { try { const c = JSON.parse(localStorage.getItem("pt-agro-" + kind) || "null"); if (c) { agro[kind] = c; agro[kind]._cached = true; } } catch (e) {} }
    agro.loading[kind] = true;
    fetch(AGRO_URL[kind] + (force && kind === "weather" ? "?refresh=1" : ""))
      .then(r => r.json().then(j => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (ok || !agro[kind]) agro[kind] = j;
        agro.error[kind] = ok ? null : ((j && j.error) || "تعذر جلب البيانات");
        agro.at[kind] = Date.now();
        if (ok) { try { localStorage.setItem("pt-agro-" + kind, JSON.stringify(j)); } catch (e) {} }
      })
      .catch(() => { agro.error[kind] = "لا يوجد اتصال بالخادم — المعروض آخر بيانات محفوظة"; agro.at[kind] = Date.now(); })
      .finally(() => { agro.loading[kind] = false; if (typeof render === "function" && document.querySelector(".ai-hub-container")) render(); });
  }

  const fmt = (v, d = 2) => (v == null || !isFinite(v)) ? "—" : Number(v).toFixed(d);
  const dayName = iso => { try { return new Date(iso + "T12:00:00").toLocaleDateString("ar-EG", { weekday: "short", day: "numeric", month: "numeric" }); } catch (e) { return iso; } };
  const sinceTxt = iso => {
    if (!iso) return "—";
    const t = new Date(String(iso).replace(" ", "T") + (/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? "" : "Z")).getTime();
    const m = Math.round((Date.now() - t) / 60000);
    if (!isFinite(m)) return "—";
    if (m < 60) return `منذ ${m} دقيقة`;
    if (m < 1440) return `منذ ${Math.round(m / 60)} ساعة`;
    return `منذ ${Math.round(m / 1440)} يوم`;
  };

  function sourceBanner(kind, text) {
    const err = agro.error[kind];
    const cached = agro[kind] && agro[kind]._cached;
    if (!err && !cached && !agro.loading[kind]) return "";
    const msg = agro.loading[kind] ? "⏳ جاري جلب أحدث البيانات…" : (err || "المعروض آخر بيانات محفوظة على الجهاز");
    return `<div style="background:#FFFBEB;border:1px solid #FCD34D;color:#92400E;border-radius:10px;padding:8px 12px;font-size:12px;margin-bottom:12px">${escapeHtml(msg)}${text ? " " + text : ""}</div>`;
  }

  // Main plots visible to this user, with their family (plot + sub-plots)
  function visibleMainPlots(st) {
    const me = typeof session === "function" ? session() : null;
    let all = st.plots || [];
    if (me?.role === "investor" && typeof getInvestorOwnedPlotIds === "function") {
      const own = new Set(getInvestorOwnedPlotIds(me, st).map(String));
      all = all.filter(pl => own.has(String(pl.id)) || own.has(String(pl.parentPlotId || "")));
    }
    const ids = new Set(all.map(p => p.id));
    return all.filter(p => !(p.parentPlotId || p.parent_plot_id) || !ids.has(p.parentPlotId || p.parent_plot_id));
  }
  const familyOf = id => (typeof plotFamilyIds === "function" ? plotFamilyIds(id) : [id]).map(String);

  function plotAreaM2(st, pl) {
    const toM2 = (v, u) => {
      v = parseFloat(v); if (!isFinite(v) || v <= 0) return 0;
      u = String(u || "فدان");
      if (/هكت|hect|ha/i.test(u)) return v * 10000;
      if (/م2|م²|متر|m2|sqm/i.test(u)) return v;
      if (/قيراط/.test(u)) return v * 175;
      return v * 4200.83; // فدان
    };
    let m2 = toM2(pl.areaValue ?? pl.area_value, pl.areaUnit ?? pl.area_unit);
    if (!m2) {
      const fam = familyOf(pl.id).filter(id => id !== String(pl.id));
      m2 = fam.reduce((s, id) => { const c = (st.plots || []).find(x => String(x.id) === id); return s + (c ? toM2(c.areaValue ?? c.area_value, c.areaUnit ?? c.area_unit) : 0); }, 0);
    }
    return m2;
  }

  function sparkSvg(values, w = 120, h = 30, color = "#16A34A") {
    const v = values.filter(x => x != null && isFinite(x));
    if (v.length < 2) return `<span class="muted" style="font-size:11px">—</span>`;
    const lo = Math.min(...v), hi = Math.max(...v), span = (hi - lo) || 0.01;
    const pts = v.map((x, i) => `${(i / (v.length - 1) * (w - 4) + 2).toFixed(1)},${(h - 3 - (x - lo) / span * (h - 6)).toFixed(1)}`).join(" ");
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="direction:ltr"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/></svg>`;
  }

  function canSyncSatellite() {
    const me = typeof session === "function" ? session() : null;
    return !!me && ["admin", "super_admin", "engineer", "tenant_user"].includes(me.role);
  }

  // =========================================================================
  // التبويب: صحة القطع بالقمر الصناعي (NDVI حقيقي من Sentinel-2 / Landsat-8)
  // =========================================================================
  function renderPlotNdviTab(st) {
    agroLoad("ndvi");
    const data = agro.ndvi;
    const me = typeof session === "function" ? session() : null;
    const isInv = me?.role === "investor";
    const th = Object.assign({ dropAlert14Days: 0.08, belowFarmMargin: 0.05 }, (st.settings?.agriSettings || st.agriSettings || {}).ndviThresholds || {});
    const drop = Math.abs(parseFloat(th.dropAlert14Days) || 0.08);
    const margin = Math.abs(parseFloat(th.belowFarmMargin) || 0.05);

    if (!data) return sourceBanner("ndvi") + `<div class="card" style="padding:30px;text-align:center">⏳ جاري تحميل بيانات القمر الصناعي…</div>`;

    const { plotMap } = buildAgriPalmsIndex(st);
    const visible = new Set(visibleMainPlots(st).map(p => String(p.id)));
    const rows = (data.plots || []).filter(p => !isInv || visible.has(String(p.plotId))).map(p => {
      const sick = (plotMap.get(String(p.plotId)) || {}).sick || 0;
      const total = (plotMap.get(String(p.plotId)) || {}).total || 0;
      let status = { key: "none", label: "لا توجد قراءة", color: "#64748B", bg: "#F1F5F9" };
      if (p.latest) {
        if (p.change != null && p.change <= -drop) status = { key: "drop", label: "هبوط ملحوظ", color: "#B91C1C", bg: "#FEE2E2" };
        else if (data.farmMedian != null && p.latest.mean < data.farmMedian - margin) status = { key: "low", label: "أقل من باقي المزرعة", color: "#B45309", bg: "#FEF3C7" };
        else status = { key: "ok", label: "مستقر", color: "#15803D", bg: "#DCFCE7" };
      }
      return Object.assign({}, p, { sick, total, status });
    });
    const order = { drop: 0, low: 1, ok: 2, none: 3 };
    rows.sort((a, b) => order[a.status.key] - order[b.status.key] || String(a.plotId).localeCompare(String(b.plotId), "en", { numeric: true }));
    const withData = rows.filter(r => r.latest);
    const sel = rows.find(r => r.plotId === ndviSelectedPlotId) || withData[0] || rows[0];
    const lastPass = withData.map(r => r.latest.date).sort().pop();
    const noShape = rows.filter(r => !r.hasShape).length;
    const tooSmall = rows.filter(r => r.tooSmall).length;

    const header = !data.configured ? `
      <div class="card" style="background:#FFF7ED;border:1.5px solid #FDBA74;border-radius:14px;padding:16px;margin-bottom:14px">
        <b style="color:#9A3412">🛰️ الربط بالقمر الصناعي غير مفعّل</b>
        <div style="font-size:12.5px;color:#7C2D12;margin-top:4px;line-height:1.7">
          الشاشة دي بتعرض قراءات حقيقية من القمرين Sentinel-2 و Landsat-8 لكل قطعة مرسومة حدودها على الخريطة. محتاج مفتاح AgroMonitoring من إعدادات الذكاء الاصطناعي (فيه باقة مجانية حتى 1000 هكتار تقريباً).
          ${typeof hasPerm === "function" && hasPerm("ai_settings_manage") ? `<br><button type="button" class="btn btn-primary btn-sm" data-go="settings" data-id="ai" style="width:auto !important;margin-top:8px">⚙️ فتح الإعدادات</button>` : ""}
        </div>
      </div>` : `
      <div class="card" style="margin-bottom:14px;background:linear-gradient(135deg,#F0FDF4 0%,#E0F2FE 100%);border:1px solid #BAE6FD;border-radius:14px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div style="font-size:12.5px;color:#334155;line-height:1.6">
          <b style="color:#0369A1">🛰️ مصدر البيانات: Sentinel-2 و Landsat-8 عبر AgroMonitoring</b><br>
          آخر تحديث: <b>${escapeHtml(sinceTxt(data.lastSync))}</b> • آخر صورة صالحة: <b>${escapeHtml(lastPass || "—")}</b> • القراءات اللي فيها سحب أكتر من 30% بتتستبعد تلقائياً${(() => {
            const r = data.lastResult;
            if (!r) return "";
            if (r.error) return `<br><span style="color:#B91C1C">آخر محاولة: ${escapeHtml(r.error)}</span>`;
            const errs = (r.errors || []).length ? ` • <span style="color:#B91C1C">${r.errors.length} أخطاء: ${escapeHtml(r.errors[0].error || "")}</span>` : "";
            const waiting = !withData.length && r.processed && !r.observationsAdded
              ? `<br><span style="color:#92400E">⏳ القطع اتسجلت عند خدمة القمر الصناعي، ومنتظرين أول صور. في الباقة المجانية بتوصل خلال أيام قليلة من التسجيل، والنظام بيجيبها لوحده.</span>` : "";
            return `<br>آخر تحديث: ${r.processed} قطعة • ${r.observationsAdded} صورة جديدة${r.polygonsCreated ? ` • ${r.polygonsCreated} قطعة اتسجلت لأول مرة` : ""}${errs}${waiting}`;
          })()}
        </div>
        ${canSyncSatellite() ? `<button type="button" class="btn btn-primary" data-act="ai-refresh-ndvi" ${agro.syncing ? "disabled" : ""} style="width:auto !important;padding:7px 16px;font-size:12.5px;font-weight:700;border-radius:8px">${agro.syncing ? "⏳ جاري التحديث… (دقيقة تقريباً)" : "🔄 تحديث من القمر الصناعي"}</button>` : ""}
      </div>`;

    const hints = [];
    if (noShape) hints.push(`${noShape} قطعة مالهاش حدود مرسومة على الخريطة، فمش بتتراقب. ارسم حدودها أو استوردها من شاشة الخريطة.`);
    if (tooSmall) hints.push(`${tooSmall} قطعة مساحتها أقل من هكتار، وده أقل من الحد الأدنى للخدمة. اتراقبت ضمن قطعتها الرئيسية لو موجودة.`);

    const kpi = (title, val, sub, color) => `<div class="card" style="background:#fff;border:1px solid #E2E8F0;border-radius:14px;padding:14px"><div style="font-size:12px;color:#64748B;font-weight:700">${title}</div><div style="font-size:24px;font-weight:900;color:${color};margin-top:4px">${val}</div><div style="font-size:11px;color:#64748B">${sub}</div></div>`;

    return `
      ${sourceBanner("ndvi")}
      ${header}
      <div class="grid grid-4" style="margin-bottom:14px">
        ${kpi("📍 قطع عليها قراءات", `${withData.length} / ${rows.length}`, "من القطع الرئيسية", "#0369A1")}
        ${kpi("🌿 الوسيط في المزرعة", fmt(data.farmMedian), "متوسط NDVI لآخر صورة لكل قطعة", "#15803D")}
        ${kpi("🚨 هبوط ملحوظ", rows.filter(r => r.status.key === "drop").length, `انخفاض ${drop} أو أكتر عن الصورة السابقة`, "#B91C1C")}
        ${kpi("⚠️ أقل من باقي المزرعة", rows.filter(r => r.status.key === "low").length, `أقل من الوسيط بـ ${margin}+`, "#B45309")}
      </div>
      ${hints.length ? `<div class="card" style="padding:10px 14px;margin-bottom:14px;font-size:12px;color:#475569;line-height:1.7;border-radius:12px">${hints.map(h => "• " + escapeHtml(h)).join("<br>")}</div>` : ""}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;margin-bottom:16px">
        <div class="card" style="padding:14px;border-radius:14px">
          <h4 style="margin:0 0 10px;font-size:15px">📍 القطع حسب الحالة</h4>
          <div style="display:flex;flex-direction:column;gap:7px;max-height:520px;overflow-y:auto">
            ${rows.length ? rows.map(r => `
              <div data-act="ai-select-ndvi-plot" data-id="${escapeHtml(r.plotId)}" style="border:1.5px solid ${sel && sel.plotId === r.plotId ? "#0284C7" : "#E2E8F0"};background:${sel && sel.plotId === r.plotId ? "#F0F9FF" : "#fff"};border-radius:10px;padding:9px 11px;cursor:pointer">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
                  <div style="font-weight:800;font-size:13px">${escapeHtml(r.name || r.plotId)} <small class="muted" style="font-weight:600">${escapeHtml(typeof sectorName === "function" ? sectorName(r.sector) : r.sector)}</small></div>
                  <span style="background:${r.status.bg};color:${r.status.color};font-weight:800;font-size:11px;padding:2px 8px;border-radius:8px;white-space:nowrap">${r.status.label}</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:11.5px;color:#64748B;margin-top:4px;gap:6px">
                  ${r.latest ? `<span>NDVI <b style="color:#0F172A">${fmt(r.latest.mean)}</b>${r.change != null ? ` <b style="color:${r.change < 0 ? "#B91C1C" : "#15803D"}">(${r.change > 0 ? "+" : ""}${fmt(r.change)})</b>` : ""}</span><span>${escapeHtml(r.latest.date)}</span>${sparkSvg(r.monthly.map(m => m.mean), 80, 22, r.status.color)}`
                    : `<span>${!r.hasShape ? "مفيش حدود مرسومة" : r.tooSmall ? "أصغر من هكتار" : !data.configured ? "الربط غير مفعّل" : "لسه مفيش صور — اعمل تحديث"}</span>`}
                </div>
                ${r.sick ? `<div style="font-size:11px;color:#B91C1C;margin-top:3px">🌴 ${r.sick} نخلة مسجلة مصابة في القطعة</div>` : ""}
              </div>`).join("") : `<div class="muted" style="padding:16px;text-align:center">لا توجد قطع</div>`}
          </div>
        </div>
        ${sel ? ndviDetail(sel, data, drop) : ""}
      </div>
      <div class="card" style="padding:12px 16px;border-radius:12px;font-size:12px;color:#475569;line-height:1.8">
        <b style="color:#0F172A">إزاي تقرأ الأرقام؟</b><br>
        • NDVI بيقيس كثافة واخضرار النبات من −1 لـ 1. في مزارع النخيل الصحراوية جزء كبير من القطعة تربة مكشوفة بين الأشجار، فالقيمة الطبيعية بتكون منخفضة (حوالي 0.15–0.40) حسب عمر النخيل والكثافة والحشائش.<br>
        • عشان كده النظام بيحكم بالتغيّر: هبوط مفاجئ عن الصورة السابقة، أو قطعة أقل بوضوح من باقي المزرعة. الحالتين معناهم «روح افحص على الأرض»، مش تشخيص.<br>
        • القمر Sentinel-2 بيعدي كل 5 أيام تقريباً بدقة 10 متر. الصور اللي فيها سحب أو غبار كتير بتتستبعد.
      </div>`;
  }

  function ndviDetail(r, data, drop) {
    const months = r.monthly || [];
    const W = 520, H = 150, pad = 26;
    const vals = months.map(m => m.mean);
    let chart = `<div class="muted" style="padding:30px;text-align:center;font-size:12px">لا يوجد تاريخ كافٍ للرسم بعد</div>`;
    if (vals.length >= 2) {
      const lo = Math.max(-0.1, Math.min(...vals) - 0.05), hi = Math.min(1, Math.max(...vals) + 0.05), span = (hi - lo) || 0.1;
      const x = i => pad + i * (W - 2 * pad) / (vals.length - 1);
      const y = v => H - pad - (v - lo) / span * (H - 2 * pad);
      const median = data.farmMedian;
      chart = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;direction:ltr">
        ${median != null && median >= lo && median <= hi ? `<line x1="${pad}" x2="${W - pad}" y1="${y(median)}" y2="${y(median)}" stroke="#94A3B8" stroke-dasharray="4 4"/><text x="${W - pad}" y="${y(median) - 4}" font-size="10" text-anchor="end" fill="#64748B">وسيط المزرعة ${fmt(median)}</text>` : ""}
        <polyline points="${vals.map((v, i) => `${x(i)},${y(v)}`).join(" ")}" fill="none" stroke="#0284C7" stroke-width="2.5"/>
        ${vals.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3.5" fill="#0284C7"><title>${months[i].month}: ${fmt(v)}</title></circle><text x="${x(i)}" y="${H - 8}" font-size="9.5" text-anchor="middle" fill="#64748B">${months[i].month.slice(5)}/${months[i].month.slice(2, 4)}</text>`).join("")}
      </svg>`;
    }
    const L = r.latest;
    return `
      <div class="card" style="padding:16px;border-radius:14px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;border-bottom:1px solid #F1F5F9;padding-bottom:10px;margin-bottom:12px">
          <div>
            <h4 style="margin:0;font-size:16px">🛰️ ${escapeHtml(r.name || r.plotId)}</h4>
            <div class="muted" style="font-size:12px;margin-top:2px">${escapeHtml(typeof sectorName === "function" ? sectorName(r.sector) : r.sector)} • ${r.areaHa != null ? `${fmt(r.areaHa, 1)} هكتار (${fmt(r.areaHa / 0.42, 1)} فدان)` : "بدون حدود"} • ${r.total} شجرة</div>
          </div>
          <span style="background:${r.status.bg};color:${r.status.color};font-weight:800;font-size:12px;padding:4px 10px;border-radius:9px">${r.status.label}</span>
        </div>
        ${L ? `
        <div class="grid grid-4" style="gap:8px;margin-bottom:12px;font-size:12px">
          <div><div class="muted">المتوسط</div><b style="font-size:18px">${fmt(L.mean)}</b></div>
          <div><div class="muted">أقل / أعلى</div><b>${fmt(L.min)} / ${fmt(L.max)}</b></div>
          <div><div class="muted">التباين داخل القطعة</div><b>${fmt(L.std)}</b></div>
          <div><div class="muted">التغير</div><b style="color:${r.change != null && r.change < 0 ? "#B91C1C" : "#15803D"}">${r.change != null ? (r.change > 0 ? "+" : "") + fmt(r.change) : "—"}</b>${r.previous ? `<div class="muted" style="font-size:10.5px">عن ${escapeHtml(r.previous.date)}</div>` : ""}</div>
        </div>
        <div class="muted" style="font-size:11.5px;margin-bottom:8px">الصورة: ${escapeHtml(L.date)} • ${L.source === "s2" ? "Sentinel-2" : L.source === "l8" ? "Landsat-8" : escapeHtml(L.source || "")} • سحب ${fmt(L.cloud, 0)}% • تغطية ${fmt(L.coverage, 0)}%</div>` : ""}
        <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:8px 10px;margin-bottom:12px">
          <div style="font-weight:800;font-size:12.5px;margin-bottom:4px">📈 متوسط NDVI الشهري (آخر 12 شهر)</div>
          ${chart}
        </div>
        ${r.status.key === "drop" || r.status.key === "low" ? `<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;padding:8px 12px;font-size:12px;color:#991B1B;margin-bottom:10px;line-height:1.7">
          ✋ مقترح: معاينة ميدانية للقطعة. أسباب شائعة: نقص ري أو عطل في الشبكة، إجهاد ملحي، إصابة حشرية (سوسة / حلم)، أو تقليم وإزالة حشائش حديث. ${r.sick ? `فيه ${r.sick} نخلة مسجلة مصابة بالفعل.` : ""}
        </div>` : ""}
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button type="button" class="btn btn-ghost" data-go="gis" style="width:auto !important;padding:6px 12px;font-size:12px;font-weight:700;border-radius:8px">🗺️ فتح الخريطة</button>
          ${canSyncSatellite() ? `<button type="button" class="btn btn-primary" data-go="bulk-op" style="width:auto !important;padding:6px 12px;font-size:12px;font-weight:700;border-radius:8px">⚡ تسجيل عملية للقطعة</button>` : ""}
        </div>
      </div>`;
  }

  // =========================================================================
  // التبويب: الري الذكي — ET₀ حقيقي (FAO-56 Penman-Monteith) من Open-Meteo
  // =========================================================================
  const DEFAULT_KC = { winter: 0.90, spring: 0.93, summer: 0.95, autumn: 0.93 }; // FAO-56 Table 12: date palms 0.90 / 0.95 / 0.95
  const seasonOf = iso => { const m = parseInt(String(iso).slice(5, 7), 10); return m === 12 || m <= 2 ? "winter" : m <= 5 ? "spring" : m <= 8 ? "summer" : "autumn"; };
  const SEASON_AR = { winter: "الشتاء", spring: "الربيع", summer: "الصيف", autumn: "الخريف" };

  function irrigationTypes(st) {
    return (st.operationTypes || []).filter(t => !t.inactive && /(^|\s)ري|الري|ريّ/.test(t.name || "") && !/تسريب|إصلاح/.test(t.name || ""));
  }

  function sectorFilterHtml(st, plots, current, act) {
    const secs = [...new Set(plots.map(p => String(p.sector)))];
    if (secs.length < 2) return "";
    const order = (st.sectors || []).map(x => String(x.id));
    secs.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    return `<select data-act="${act}" style="width:auto;padding:5px 10px;font-size:12.5px;font-weight:700;border:1px solid #CBD5E1;border-radius:8px">
      <option value="all" ${current === "all" ? "selected" : ""}>كل القطاعات (${plots.length} قطعة)</option>
      ${secs.map(id => `<option value="${escapeHtml(id)}" ${current === id ? "selected" : ""}>${escapeHtml(typeof sectorName === "function" ? sectorName(id) : id)} (${plots.filter(p => String(p.sector) === id).length})</option>`).join("")}
    </select>`;
  }
  function pickSector(cur, plots) {
    const secs = [...new Set(plots.map(p => String(p.sector)))];
    if (cur && (cur === "all" || secs.includes(cur))) return cur;
    return secs.length > 1 ? secs[0] : "all";
  }

  function renderSmartIrrigationTab(st) {
    agroLoad("weather");
    const w = agro.weather;
    const me = typeof session === "function" ? session() : null;
    const isInv = me?.role === "investor";
    if (!w) return sourceBanner("weather") + `<div class="card" style="padding:30px;text-align:center">⏳ جاري تحميل بيانات الطقس…</div>`;
    if (!w.success && !w.daily) return `<div class="card" style="padding:24px;border-radius:14px;background:#FFF7ED;border:1.5px solid #FDBA74"><b style="color:#9A3412">💧 تعذر حساب الاحتياج المائي</b><div style="font-size:12.5px;color:#7C2D12;margin-top:6px">${escapeHtml(w.error || "")}</div></div>`;

    const s = st.settings?.agriSettings || st.agriSettings || {};
    const kc = Object.assign({}, DEFAULT_KC, s.kcBySeason && !s.kcBySeason.mature ? s.kcBySeason : {});
    const eff = Math.min(1, Math.max(0.5, (parseFloat(s.irrigationEfficiency) || 90) / 100));
    const d = w.daily, ti = w.todayIndex || 0;
    const etc = d.time.map((t, i) => (d.et0[i] || 0) * (kc[seasonOf(t)] || 0.93));
    const effRain = i => { const r = d.rain[i] || 0; return r >= 2 ? r * 0.8 : 0; };
    const et0Today = d.et0[ti], etcToday = etc[ti];
    const next7 = d.time.map((t, i) => i).filter(i => i >= ti && i < ti + 7);
    const plots = visibleMainPlots(st);
    const { plotMap } = buildAgriPalmsIndex(st);
    const irrTypeIds = new Set(irrigationTypes(st).map(t => String(t.id)));
    const ops = (st.operations || []).filter(o => irrTypeIds.has(String(o.typeId)) && o.approval !== "rejected");
    const palmPlot = new Map((st.palms || []).map(p => [String(p.id), String(p.plot)]));
    const todayMs = new Date(d.time[ti] + "T12:00:00").getTime();

    let farmToday = 0, farmWeek = 0;
    const rows = plots.map(pl => {
      const fam = new Set(familyOf(pl.id));
      const m2 = plotAreaM2(st, pl);
      const palms = (plotMap.get(String(pl.id)) || {}).total || 0;
      const todayM3 = m2 ? etcToday * m2 / 1000 / eff : 0;
      const weekM3 = m2 ? next7.reduce((sum, i) => sum + Math.max(0, etc[i] - effRain(i)), 0) * m2 / 1000 / eff : 0;
      farmToday += todayM3; farmWeek += weekM3;
      const last = ops.filter(o => fam.has(String(o.plotId)) || (o.palmId && fam.has(palmPlot.get(String(o.palmId)))) || (o.targetLevel === "sector" && String(o.sectorId) === String(pl.sector)))
        .map(o => new Date(normTsSafe(o.at)).getTime()).filter(isFinite).sort((a, b) => b - a)[0];
      let days = null, deficitMm = null;
      if (last) {
        days = Math.max(0, Math.floor((todayMs - last) / 86400000));
        const startIdx = Math.max(0, ti - days + 1);
        deficitMm = 0;
        for (let i = startIdx; i <= ti; i++) deficitMm += Math.max(0, etc[i] - effRain(i));
      }
      let status;
      if (!m2) status = { label: "المساحة غير مسجلة", color: "#64748B", bg: "#F1F5F9" };
      else if (last == null) status = { label: "لا يوجد ري مسجل", color: "#64748B", bg: "#F1F5F9" };
      else if (days === 0) status = { label: "اترويت النهارده", color: "#15803D", bg: "#DCFCE7" };
      else if (deficitMm <= etcToday * 1.5) status = { label: "في الحدود", color: "#15803D", bg: "#DCFCE7" };
      else if (deficitMm <= etcToday * 3) status = { label: "قرّب ميعاد الري", color: "#B45309", bg: "#FEF3C7" };
      else status = { label: "متأخرة عن الري", color: "#B91C1C", bg: "#FEE2E2" };
      return { pl, m2, palms, todayM3, weekM3, perPalmL: palms ? todayM3 * 1000 / palms : null, days, deficitMm, deficitM3: deficitMm != null && m2 ? deficitMm * m2 / 1000 / eff : null, status };
    });
    irrigationSelectedSector = pickSector(irrigationSelectedSector, plots);
    const shown = rows.filter(r => irrigationSelectedSector === "all" || String(r.pl.sector) === irrigationSelectedSector);
    const sevOrder = r => r.status.label === "متأخرة عن الري" ? 0 : r.status.label === "قرّب ميعاد الري" ? 1 : 2;
    shown.sort((a, b) => sevOrder(a) - sevOrder(b) || String(a.pl.id).localeCompare(String(b.pl.id), "en", { numeric: true }));

    const loc = w.location || {};
    const tdy = i => `${fmt(d.tmax[i], 0)}°/${fmt(d.tmin[i], 0)}°`;
    return `
      ${sourceBanner("weather")}
      ${w.stale ? `<div style="background:#FFFBEB;border:1px solid #FCD34D;color:#92400E;border-radius:10px;padding:8px 12px;font-size:12px;margin-bottom:12px">خدمة الطقس مش متاحة دلوقتي — المعروض آخر قراءة متاحة</div>` : ""}
      <div class="grid grid-4" style="margin-bottom:14px">
        <div class="card" style="border:1px solid #E2E8F0;border-radius:14px;padding:14px"><div style="font-size:12px;color:#64748B;font-weight:700">☀️ البخر-نتح المرجعي ET₀ النهارده</div><div style="font-size:24px;font-weight:900;color:#0284C7;margin-top:4px">${fmt(et0Today, 1)} <span style="font-size:13px">مم</span></div><div style="font-size:11px;color:#64748B">FAO-56 من بيانات الطقس الفعلية</div></div>
        <div class="card" style="border:1px solid #E2E8F0;border-radius:14px;padding:14px"><div style="font-size:12px;color:#64748B;font-weight:700">🌴 استهلاك النخيل ETc = Kc × ET₀</div><div style="font-size:24px;font-weight:900;color:#15803D;margin-top:4px">${fmt(etcToday, 1)} <span style="font-size:13px">مم</span></div><div style="font-size:11px;color:#64748B">Kc ${kc[seasonOf(d.time[ti])]} (${SEASON_AR[seasonOf(d.time[ti])]}) • كفاءة الري ${Math.round(eff * 100)}%</div></div>
        <div class="card" style="border:1px solid #E2E8F0;border-radius:14px;padding:14px"><div style="font-size:12px;color:#64748B;font-weight:700">🚜 احتياج ${isInv ? "قطعك" : "المزرعة"} النهارده</div><div style="font-size:24px;font-weight:900;color:#0F172A;margin-top:4px">${Math.round(farmToday).toLocaleString("en")} <span style="font-size:13px">م³</span></div><div style="font-size:11px;color:#64748B">${rows.length} قطعة رئيسية</div></div>
        <div class="card" style="border:1px solid #E2E8F0;border-radius:14px;padding:14px"><div style="font-size:12px;color:#64748B;font-weight:700">📅 الاحتياج المتوقع لـ 7 أيام</div><div style="font-size:24px;font-weight:900;color:#7C3AED;margin-top:4px">${Math.round(farmWeek).toLocaleString("en")} <span style="font-size:13px">م³</span></div><div style="font-size:11px;color:#64748B">من توقعات الطقس، بعد خصم المطر الفعّال</div></div>
      </div>
      <div class="card" style="padding:12px 14px;border-radius:14px;margin-bottom:14px">
        <div style="font-weight:800;font-size:13px;margin-bottom:8px">🌤️ توقعات الأيام الجاية — ${escapeHtml(w.provider)} • الموقع (${loc.lat}, ${loc.lng})</div>
        <div style="display:grid;grid-template-columns:repeat(7,minmax(70px,1fr));gap:6px;overflow-x:auto">
          ${next7.map(i => `<div style="background:${i === ti ? "#E0F2FE" : "#F8FAFC"};border:1px solid #E2E8F0;border-radius:10px;padding:7px;text-align:center;font-size:11.5px">
            <div style="font-weight:800">${i === ti ? "النهارده" : escapeHtml(dayName(d.time[i]))}</div>
            <div style="color:#0284C7;font-weight:900;font-size:14px;margin:3px 0">${fmt(d.et0[i], 1)}<small> مم</small></div>
            <div class="muted">${tdy(i)}</div>
            ${(d.rain[i] || 0) >= 0.5 ? `<div style="color:#1D4ED8">🌧 ${fmt(d.rain[i], 1)}</div>` : ""}
          </div>`).join("")}
        </div>
      </div>
      <div class="card" style="padding:14px;border-radius:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
          <h4 style="margin:0;font-size:15px">💧 الاحتياج المائي لكل قطعة</h4>
          <span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${sectorFilterHtml(st, plots, irrigationSelectedSector, "ai-irr-sector")}<span class="muted" style="font-size:11.5px">«آخر ري» من عمليات الري المسجلة</span></span>
        </div>
        <div style="overflow-x:auto">
          <table class="table" style="width:100%;font-size:12.5px;border-collapse:collapse">
            <thead><tr style="background:#F8FAFC;border-bottom:2px solid #E2E8F0;text-align:right">
              <th style="padding:8px">القطعة</th><th style="padding:8px">المساحة / الأشجار</th><th style="padding:8px">احتياج النهارده</th><th style="padding:8px">لكل نخلة</th><th style="padding:8px">7 أيام</th><th style="padding:8px">آخر ري</th><th style="padding:8px">الحالة</th>${!isInv ? `<th style="padding:8px"></th>` : ""}
            </tr></thead>
            <tbody>
              ${shown.map(r => `<tr style="border-bottom:1px solid #F1F5F9">
                <td style="padding:8px;font-weight:800">${escapeHtml(r.pl.name || r.pl.id)}<div class="muted" style="font-weight:500;font-size:11px">${escapeHtml(typeof sectorName === "function" ? sectorName(r.pl.sector) : r.pl.sector)}</div></td>
                <td style="padding:8px">${r.m2 ? fmt(r.m2 / 4200.83, 1) + " فدان" : "—"} • ${r.palms} شجرة</td>
                <td style="padding:8px;font-weight:800;color:#0284C7">${r.m2 ? Math.round(r.todayM3).toLocaleString("en") + " م³" : "—"}</td>
                <td style="padding:8px">${r.perPalmL != null && r.m2 ? Math.round(r.perPalmL) + " لتر" : "—"}</td>
                <td style="padding:8px">${r.m2 ? Math.round(r.weekM3).toLocaleString("en") + " م³" : "—"}</td>
                <td style="padding:8px">${r.days == null ? "—" : r.days === 0 ? "النهارده" : `منذ ${r.days} يوم`}${r.deficitM3 ? `<div class="muted" style="font-size:10.5px">عجز ≈ ${Math.round(r.deficitM3).toLocaleString("en")} م³</div>` : ""}</td>
                <td style="padding:8px"><span style="background:${r.status.bg};color:${r.status.color};font-weight:800;font-size:11px;padding:3px 8px;border-radius:6px;white-space:nowrap">${r.status.label}</span></td>
                ${!isInv ? `<td style="padding:8px">${r.m2 ? `<button type="button" class="btn btn-ghost btn-sm" data-act="ai-irrigate-plot" data-id="${escapeHtml(r.pl.id)}" data-water="${Math.round(r.todayM3)}" style="width:auto !important;font-size:11.5px;padding:4px 10px">💧 تسجيل ري</button>` : ""}</td>` : ""}
              </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>
      <div class="card" style="padding:12px 16px;border-radius:12px;font-size:12px;color:#475569;line-height:1.8;margin-top:14px">
        <b style="color:#0F172A">طريقة الحساب</b><br>
        • ET₀ يومي بمعادلة FAO-56 Penman-Monteith (حرارة، رطوبة، رياح، إشعاع) لموقع المزرعة، من ${escapeHtml(w.provider)}.<br>
        • احتياج القطعة (م³) = ET₀ × Kc × المساحة (م²) ÷ 1000 ÷ كفاءة الري. Kc الافتراضي لنخيل التمر من جدول FAO-56 (0.90–0.95)، وتقدر تعدّله هو وكفاءة الري من الإعدادات.<br>
        • العجز = مجموع الاستهلاك من آخر ري مسجل لحد النهارده بعد خصم المطر الفعّال. لو الري بالتنقيط يومي ومش بيتسجل كعملية، اعتمد على عمود «احتياج النهارده».
      </div>`;
  }
  function normTsSafe(v) { return typeof normTs === "function" ? normTs(v) : v; }

  // =========================================================================
  // التبويب: مخاطر الآفات — مؤشر قواعد شفاف (طقس حقيقي + سجل الإصابات والمعالجات)
  // =========================================================================
  function renderPestRiskTab(st) {
    agroLoad("weather");
    const w = agro.weather;
    const d = w && w.daily;
    const ti = (w && w.todayIndex) || 0;
    const fIdx = d ? d.time.map((t, i) => i).filter(i => i >= ti && i < ti + 7) : [];
    const month = new Date().getMonth() + 1;

    const ops = st.operations || [];
    const types = new Map((st.operationTypes || []).map(t => [String(t.id), t]));
    const tname = o => (types.get(String(o.typeId)) || {}).name || "";
    const palmPlot = new Map((st.palms || []).map(p => [String(p.id), String(p.plot)]));
    const isSick = p => !p.archived && (p.statusId === 3 || p.statusCode === "infected" || /مصاب|سوس/.test(p.status || ""));
    const sickByPlot = new Map();
    (st.palms || []).forEach(p => { if (isSick(p)) sickByPlot.set(String(p.plot), (sickByPlot.get(String(p.plot)) || 0) + 1); });
    const plotSector = new Map((st.plots || []).map(p => [String(p.id), String(p.sector)]));
    const sickBySector = new Map();
    sickByPlot.forEach((n, pid) => { const s = plotSector.get(pid); if (s) sickBySector.set(s, (sickBySector.get(s) || 0) + n); });
    const now = Date.now();
    const daysAgo = o => (now - new Date(normTsSafe(o.at)).getTime()) / 86400000;
    const opTouches = (o, fam, sector) => fam.has(String(o.plotId)) || (o.palmId && fam.has(palmPlot.get(String(o.palmId)))) || (o.targetLevel === "sector" && String(o.sectorId) === String(sector));
    const lastOp = (re, fam, sector) => { const xs = ops.filter(o => re.test(tname(o)) && o.approval !== "rejected" && opTouches(o, fam, sector)).map(daysAgo).filter(isFinite); return xs.length ? Math.min(...xs) : null; };
    const recentReports = ops.filter(o => { const t = types.get(String(o.typeId)); return t && t.isCritical && daysAgo(o) <= 90; }).length;

    // climate parts (farm-wide)
    const rpwDays = fIdx.filter(i => d.tmean[i] >= 18 && d.tmean[i] <= 38).length;
    const miteDays = fIdx.filter(i => d.tmax[i] >= 35 && (d.rh[i] == null || d.rh[i] <= 40)).length;
    const rpwClimate = fIdx.length ? Math.round(rpwDays / fIdx.length * 35) : null;
    const miteClimate = fIdx.length ? Math.round(miteDays / fIdx.length * 60) : null;
    const miteSeason = month >= 5 && month <= 8 ? 25 : (month === 4 || month === 9) ? 12 : 0;

    const RE_RPW = /سوس|حقن|مكافح|رش علاجي|وقائ/;
    const RE_MITE = /غبير|غبار|عنكبوت|أكاروس|اكاروس|كبريت/;
    const plots = visibleMainPlots(st);
    const rows = plots.map(pl => {
      const fam = new Set(familyOf(pl.id));
      const sickHere = [...fam].reduce((s, id) => s + (sickByPlot.get(id) || 0), 0);
      const sickSector = sickBySector.get(String(pl.sector)) || 0;
      const why = [], whyM = [];
      let pressure = 0;
      if (sickHere) { pressure = 45; why.push(`${sickHere} نخلة مصابة مسجلة في القطعة`); }
      else if (sickSector) { pressure = 25; why.push(`${sickSector} نخلة مصابة في نفس القطاع`); }
      else if (recentReports) { pressure = 10; why.push(`${recentReports} بلاغ إصابة في المزرعة آخر 90 يوم`); }
      const gapR = lastOp(RE_RPW, fam, pl.sector);
      const gapScoreR = gapR == null ? 10 : gapR > 90 ? 20 : gapR > 45 ? 12 : 0; // no record at all = unknown, not proven neglect
      why.push(gapR == null ? "مفيش مكافحة/وقاية مسجلة للسوسة" : `آخر مكافحة للسوسة منذ ${Math.round(gapR)} يوم`);
      if (rpwClimate != null) why.push(`${rpwDays} من 7 أيام جاية حرارتها مناسبة لنشاط السوسة`);
      const rpw = Math.min(100, (rpwClimate || 0) + pressure + gapScoreR);
      const gapM = lastOp(RE_MITE, fam, pl.sector);
      const gapScoreM = gapM == null ? 8 : gapM > 60 ? 15 : 0;
      if (miteClimate != null) whyM.push(`${miteDays} من 7 أيام جاية حارة وجافة (عظمى ≥ 35° ورطوبة ≤ 40%)`);
      whyM.push(miteSeason ? "موسم نمو الثمار (الحلم بينشط فيه)" : "خارج موسم نشاط الحلم الرئيسي");
      whyM.push(gapM == null ? "مفيش مكافحة حلم مسجلة" : `آخر مكافحة حلم منذ ${Math.round(gapM)} يوم`);
      const mite = Math.min(100, (miteClimate || 0) + miteSeason + gapScoreM);
      return { pl, rpw, mite, why, whyM, sickHere };
    }).sort((a, b) => b.rpw - a.rpw || b.mite - a.mite);
    pestRiskSelectedSector = pickSector(pestRiskSelectedSector, plots);
    const shownP = rows.filter(r => pestRiskSelectedSector === "all" || String(r.pl.sector) === pestRiskSelectedSector);

    const lvl = v => v >= 70 ? { t: "مرتفع", c: "#B91C1C", b: "#FEE2E2" } : v >= 40 ? { t: "متوسط", c: "#B45309", b: "#FEF3C7" } : { t: "منخفض", c: "#15803D", b: "#DCFCE7" };
    const avg = k => rows.length ? Math.round(rows.reduce((s, r) => s + r[k], 0) / rows.length) : 0;
    const card = (title, v, sub) => { const L = lvl(v); return `<div class="card" style="border:1px solid #E2E8F0;border-radius:14px;padding:14px"><div style="font-size:12.5px;font-weight:800;color:#334155">${title}</div><div style="display:flex;align-items:baseline;gap:8px;margin-top:6px"><span style="font-size:26px;font-weight:900;color:${L.c}">${v}</span><span style="background:${L.b};color:${L.c};font-weight:800;font-size:11.5px;padding:2px 8px;border-radius:8px">${L.t}</span></div><div style="font-size:11.5px;color:#64748B;margin-top:4px;line-height:1.6">${sub}</div></div>`; };
    return `
      ${!d ? sourceBanner("weather", "— المؤشر محسوب من سجلات المزرعة بس لحد ما بيانات الطقس توصل.") : sourceBanner("weather")}
      <div class="grid grid-2" style="margin-bottom:14px">
        ${card("🪲 سوسة النخيل الحمراء — متوسط المزرعة", avg("rpw"), `${rows.filter(r => r.rpw >= 70).length} قطعة خطرها مرتفع • ${[...sickByPlot.values()].reduce((a, b) => a + b, 0)} نخلة مصابة مسجلة`)}
        ${card("🕸️ حلم الغبار (الغبير) — متوسط المزرعة", avg("mite"), d ? `${miteDays} يوم حار وجاف متوقع الأسبوع ده` : "محتاج بيانات الطقس")}
      </div>
      <div class="card" style="padding:14px;border-radius:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px"><h4 style="margin:0;font-size:15px">📍 ترتيب القطع حسب الخطر</h4>${sectorFilterHtml(st, plots, pestRiskSelectedSector, "ai-pest-sector")}</div>
        <div style="overflow-x:auto"><table class="table" style="width:100%;font-size:12.5px;border-collapse:collapse">
          <thead><tr style="background:#F8FAFC;border-bottom:2px solid #E2E8F0;text-align:right"><th style="padding:8px">القطعة</th><th style="padding:8px">السوسة</th><th style="padding:8px">ليه؟</th><th style="padding:8px">الحلم</th><th style="padding:8px">ليه؟</th></tr></thead>
          <tbody>${shownP.slice(0, 80).map(r => { const a = lvl(r.rpw), b = lvl(r.mite); return `<tr style="border-bottom:1px solid #F1F5F9;vertical-align:top">
            <td style="padding:8px;font-weight:800">${escapeHtml(r.pl.name || r.pl.id)}<div class="muted" style="font-weight:500;font-size:11px">${escapeHtml(typeof sectorName === "function" ? sectorName(r.pl.sector) : r.pl.sector)}</div></td>
            <td style="padding:8px"><span style="background:${a.b};color:${a.c};font-weight:800;padding:2px 8px;border-radius:7px">${r.rpw} ${a.t}</span></td>
            <td style="padding:8px;font-size:11.5px;color:#475569;line-height:1.6">${r.why.map(escapeHtml).join("<br>")}</td>
            <td style="padding:8px"><span style="background:${b.b};color:${b.c};font-weight:800;padding:2px 8px;border-radius:7px">${r.mite} ${b.t}</span></td>
            <td style="padding:8px;font-size:11.5px;color:#475569;line-height:1.6">${r.whyM.map(escapeHtml).join("<br>")}</td>
          </tr>`; }).join("")}</tbody>
        </table></div>
        ${shownP.length > 80 ? `<div class="muted" style="font-size:11.5px;margin-top:6px">معروض أعلى 80 قطعة خطراً من ${shownP.length}</div>` : ""}
      </div>
      <div class="card" style="padding:12px 16px;border-radius:12px;font-size:12px;color:#475569;line-height:1.8;margin-top:14px">
        <b style="color:#0F172A">إزاي المؤشر بيتحسب؟</b> (قواعد ثابتة وواضحة، مش تنبؤ مضمون)<br>
        • السوسة (من 100): الطقس لحد 35 (أيام متوسط حرارتها 18–38°م) + ضغط الإصابة لحد 45 (إصابات في القطعة، أو في القطاع، أو بلاغات حديثة) + فجوة الحماية لحد 20 (من آخر رش أو حقن؛ لو مفيش أي تسجيل بتتحسب 10 لأنها مجهولة).<br>
        • الحلم (من 100): الطقس لحد 60 (أيام عظمى ≥ 35° ورطوبة ≤ 40%) + الموسم لحد 25 (مايو–أغسطس) + فجوة المكافحة لحد 15.<br>
        • مرتفع ≥ 70، متوسط 40–69. أدق بيانات للمؤشر: تسجيل الفحوصات والإصابات وقراءات المصائد الفرمونية أول بأول.
      </div>`;
  }

  // =========================================================================
  // إعدادات الربط بالأقمار الصناعية والطقس — المفاتيح تُحفظ في الخادم ولا تُعرض
  // =========================================================================
  function renderAgriSettingsTab(st) {
    agroLoad("status");
    const set = st.settings || {};
    const s = set.agriSettings || st.agriSettings || {};
    const th = Object.assign({ dropAlert14Days: 0.08, belowFarmMargin: 0.05 }, s.ndviThresholds || {});
    const kc = Object.assign({}, DEFAULT_KC, s.kcBySeason && !s.kcBySeason.mature ? s.kcBySeason : {});
    const status = agro.status || {};
    const loc = status.weather && status.weather.location;
    const okBadge = on => on ? `<span style="background:#DCFCE7;color:#15803D;font-weight:800;font-size:11px;padding:2px 8px;border-radius:8px">محفوظ ✓</span>` : `<span style="background:#F1F5F9;color:#64748B;font-weight:800;font-size:11px;padding:2px 8px;border-radius:8px">غير مُعد</span>`;
    const inp = (id, val, ph, extra = "") => `<input id="${id}" value="${escapeHtml(val == null ? "" : val)}" placeholder="${escapeHtml(ph)}" class="fctrl" style="font-size:12.5px;direction:ltr" ${extra}/>`;
    const tr = agro.testResult;
    const resLine = (label, r) => r ? `<div style="display:flex;gap:6px;align-items:flex-start;font-size:12.5px;margin-top:4px"><span>${r.ok ? "✅" : "❌"}</span><div><b>${label}:</b> ${escapeHtml(r.message || "")}</div></div>` : "";
    return `
      <div class="card" style="padding:20px;border-radius:14px;border-top:4px solid #0284C7;width:100%">
        <h4 style="margin:0 0 4px;font-size:16px;font-weight:800">🛰️ الربط بالقمر الصناعي والطقس</h4>
        <div class="muted" style="font-size:12px;margin-bottom:16px">المفاتيح بتتحفظ عند الخادم بس، ومش بتوصل لأي جهاز. سيب الخانة فاضية عشان تحتفظ بالمفتاح المحفوظ.</div>

        <div style="background:#F8FAFC;border:1.5px solid #E2E8F0;border-radius:12px;padding:14px;margin-bottom:14px">
          <div class="grid grid-2" style="gap:12px">
            <div>
              <label style="font-size:12px;font-weight:800;display:flex;justify-content:space-between;margin-bottom:4px">AgroMonitoring (صور الأقمار الصناعية — NDVI) ${okBadge(set.agroMonitoringKey_configured)}</label>
              ${inp("agri_agro_key", "", set.agroMonitoringKey_configured ? "•••••• محفوظ — اكتب مفتاح جديد للتغيير" : "الصق المفتاح من agromonitoring.com", 'autocomplete="off"')}
              <div class="muted" style="font-size:11px;margin-top:3px">الباقة المجانية تكفي حوالي 1000 هكتار من القطع.</div>
            </div>
            <div>
              <label style="font-size:12px;font-weight:800;display:flex;justify-content:space-between;margin-bottom:4px">Open-Meteo (الطقس و ET₀) ${set.openMeteoKey_configured ? okBadge(true) : `<span style="background:#E0F2FE;color:#0369A1;font-weight:800;font-size:11px;padding:2px 8px;border-radius:8px">يعمل بدون مفتاح</span>`}</label>
              ${inp("agri_om_key", "", "مفتاح الاستخدام التجاري (اختياري)", 'autocomplete="off"')}
              <div class="muted" style="font-size:11px;margin-top:3px">النسخة المجانية لغير الأغراض التجارية. للتشغيل التجاري اشترك في Open-Meteo API Standard وحط المفتاح هنا.</div>
            </div>
          </div>
        </div>

        <div style="background:#F8FAFC;border:1.5px solid #E2E8F0;border-radius:12px;padding:14px;margin-bottom:14px">
          <h4 style="font-size:13px;font-weight:800;margin:0 0 10px">📍 موقع المزرعة (للطقس)</h4>
          <div class="grid grid-3" style="gap:10px;align-items:end">
            <div><label style="font-size:11.5px;font-weight:700">خط العرض</label>${inp("agri_lat", s.farmLat || "", loc ? String(loc.lat) : "27.00")}</div>
            <div><label style="font-size:11.5px;font-weight:700">خط الطول</label>${inp("agri_lng", s.farmLng || "", loc ? String(loc.lng) : "28.40")}</div>
            <div class="muted" style="font-size:11.5px;line-height:1.6">${loc ? `المستخدم حالياً: (${loc.lat}, ${loc.lng}) — ${loc.source === "settings" ? "من هنا" : loc.source === "plots" ? "متوسط مراكز القطع" : "من حدود القطاعات"}` : "مش معروف — ارسم القطع على الخريطة أو اكتب الإحداثيات"}</div>
          </div>
        </div>

        <div class="grid grid-2" style="gap:14px;margin-bottom:14px">
          <div style="background:#F8FAFC;border:1.5px solid #E2E8F0;border-radius:12px;padding:14px">
            <h4 style="font-size:13px;font-weight:800;margin:0 0 10px">💧 الري</h4>
            <label style="font-size:11.5px;font-weight:700">كفاءة شبكة الري %</label>
            ${inp("agri_eff", s.irrigationEfficiency || 90, "90", 'type="number" min="50" max="100"')}
            <div class="grid grid-4" style="gap:6px;margin-top:8px">
              ${["winter", "spring", "summer", "autumn"].map(k => `<div><label style="font-size:11px;font-weight:700">Kc ${SEASON_AR[k]}</label>${inp("agri_kc_" + k, kc[k], String(DEFAULT_KC[k]), 'type="number" step="0.01"')}</div>`).join("")}
            </div>
          </div>
          <div style="background:#F8FAFC;border:1.5px solid #E2E8F0;border-radius:12px;padding:14px">
            <h4 style="font-size:13px;font-weight:800;margin:0 0 10px">🛰️ تنبيهات صحة القطع</h4>
            <label style="font-size:11.5px;font-weight:700">هبوط NDVI عن الصورة السابقة يعتبر تنبيه لو ≥</label>
            ${inp("th_drop", th.dropAlert14Days, "0.08", 'type="number" step="0.01"')}
            <label style="font-size:11.5px;font-weight:700;margin-top:8px;display:block">قطعة «أقل من باقي المزرعة» لو أقل من الوسيط بـ</label>
            ${inp("th_margin", th.belowFarmMargin, "0.05", 'type="number" step="0.01"')}
          </div>
        </div>

        <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap">
          <button type="button" class="btn btn-secondary" onclick="window.testSatelliteConnection()" ${agro.testing ? "disabled" : ""} style="width:auto !important;padding:9px 18px;font-weight:700;border-radius:9px">${agro.testing ? "⏳ جاري الفحص…" : "🧪 فحص الربط فعلياً"}</button>
          <button type="button" class="btn btn-primary" onclick="window.handleAiSaveSettings()" style="width:auto !important;padding:9px 22px;font-weight:800;border-radius:9px">💾 حفظ</button>
        </div>
        <div id="satellite_test_result" style="margin-top:12px;${tr ? "" : "display:none"}">
          ${tr ? `<div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:10px 14px">
            ${tr.error ? `<div style="color:#B91C1C;font-size:12.5px">❌ ${escapeHtml(tr.error)}</div>` : ""}
            ${resLine("الطقس", tr.weather)}${resLine("القمر الصناعي", tr.satellite)}
            ${tr.plots ? `<div style="font-size:12px;color:#475569;margin-top:6px">📐 القطع: ${tr.plots.total} رئيسية، ${tr.plots.withShape} منها حدودها مرسومة، ${tr.plots.eligible} مساحتها مناسبة للمراقبة (إجمالي ${tr.plots.totalHa} هكتار)</div>` : ""}
          </div>` : ""}
        </div>
      </div>`;
  }

  window.testSatelliteConnection = async function () {
    agro.testing = true; agro.testResult = null;
    if (typeof render === "function") render();
    try {
      const r = await fetch("/api/agro/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agroMonitoringKey: ($("#agri_agro_key")?.value || "").trim(), openMeteoKey: ($("#agri_om_key")?.value || "").trim() }) });
      const j = await r.json();
      agro.testResult = r.ok ? j : { error: j.error || "فشل الفحص" };
    } catch (e) { agro.testResult = { error: "لا يوجد اتصال بالخادم" }; }
    agro.testing = false;
    if (typeof render === "function") render();
  };

  window.handleAiSaveSettings = async function () {
    const st = Store.get();
    const prev = st.settings?.agriSettings || st.agriSettings || {};
    const num = (id, def) => { const v = parseFloat($("#" + id)?.value); return isFinite(v) ? v : def; };
    const agriSettings = Object.assign({}, prev, {
      farmLat: ($("#agri_lat")?.value || "").trim(),
      farmLng: ($("#agri_lng")?.value || "").trim(),
      irrigationEfficiency: Math.min(100, Math.max(50, num("agri_eff", 90))),
      kcBySeason: { winter: num("agri_kc_winter", DEFAULT_KC.winter), spring: num("agri_kc_spring", DEFAULT_KC.spring), summer: num("agri_kc_summer", DEFAULT_KC.summer), autumn: num("agri_kc_autumn", DEFAULT_KC.autumn) },
      ndviThresholds: Object.assign({}, prev.ndviThresholds || {}, { dropAlert14Days: Math.abs(num("th_drop", 0.08)), belowFarmMargin: Math.abs(num("th_margin", 0.05)) })
    });
    ["openWeatherKey", "agroMonitoringKey", "openMeteoKey", "sentinelClientId", "sentinelSecret"].forEach(k => delete agriSettings[k]);
    const body = { agriSettings };
    const agroK = ($("#agri_agro_key")?.value || "").trim();
    const omK = ($("#agri_om_key")?.value || "").trim();
    if (agroK) body.agroMonitoringKey = agroK;
    if (omK) body.openMeteoKey = omK;
    try {
      const r = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "HTTP " + r.status);
      const settings = Object.assign({}, st.settings || {}, { agriSettings });
      if (agroK) settings.agroMonitoringKey_configured = true;
      if (omK) settings.openMeteoKey_configured = true;
      Store.set({ agriSettings, settings });
      agro.at = {}; agro.status = null; agro.weather = null; // reload with the new settings
      if (typeof toast === "function") toast("تم حفظ إعدادات الربط ✅");
    } catch (e) {
      if (typeof toast === "function") toast("تعذر الحفظ: " + e.message);
    }
    if (typeof render === "function") render();
  };

  // =========================================================================
  // التبويب 0-ب: محرك التنبؤ بنافذة الري المثالية (Smart Irrigation - I-Rri)
  // =========================================================================
  

  // =========================================================================
  // التبويب 0-ج: التنبؤ بمواسم نشاط الآفات (Pest Risk Forecasting)
  // =========================================================================
  

  // =========================================================================
  // التبويب 0-د: تتبع البصمة الكربونية ومطابقة المعايير (ESG & Carbon Footprint)
  // =========================================================================
  function renderCarbonEsgTab(st) {
    const palms = (st.palms || []).filter(p => !p.archived);
    const totalPalms = palms.length;

    // Carbon stock based on palm age brackets:
    // Young (< 4 years): ~16 kg C
    // Medium (4 - 10 years): ~100 kg C
    // Mature (> 10 years): ~225 kg C
    let youngCount = 0;
    let mediumCount = 0;
    let matureCount = 0;

    const now = new Date();
    palms.forEach(p => {
      let ageYears = 7; // default average
      if (p.plantDate) {
        const pd = new Date(p.plantDate);
        if (!isNaN(pd)) ageYears = (now - pd) / (1000 * 60 * 60 * 24 * 365.25);
      }
      if (ageYears < 4) youngCount++;
      else if (ageYears <= 10) mediumCount++;
      else matureCount++;
    });

    const carbonKg = (youngCount * 16) + (mediumCount * 100) + (matureCount * 225);
    const carbonMetricTons = (carbonKg / 1000).toFixed(1);
    
    // CO2 equivalent = Carbon * 3.67
    const co2eMetricTons = (carbonMetricTons * 3.67).toFixed(1);
    const annualSequestrationTons = ((totalPalms * 22) / 1000).toFixed(1); // ~22 kg CO2 / tree / year

    return `
      <div id="printable-carbon-report">
        <!-- Print-only Official Header -->
        <div style="border-bottom:2px solid #0F172A;padding-bottom:12px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:flex-end">
          <div>
            <div style="font-size:20px;font-weight:900;color:#0F172A">تقرير البصمة الكربونية والاستدامة البيئية (ESG Report)</div>
            <div style="font-size:12px;color:#475569;margin-top:4px">
              <b>المشروع:</b> ${escapeHtml(st.settings?.companyName || "مزارع بشاير الشوربجي")} • 
              <b>الرقم المرجعي:</b> ESG-${new Date().toISOString().slice(0, 10).replace(/-/g, "")} • 
              <b>تاريخ التقييم:</b> ${new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
          <div style="text-align:left">
            <span style="display:inline-block;border:1.5px solid #059669;color:#059669;font-weight:800;font-size:11.5px;padding:4px 10px;border-radius:6px;background:#ECFDF5">
              🌿 تقدير داخلي — غير معتمد
            </span>
          </div>
        </div>

        <!-- ESG Carbon KPI Strip -->
        <div class="grid grid-4" style="margin-bottom:16px">
          <div class="card" style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:14px;padding:14px">
            <div style="font-size:12px;color:#166534;font-weight:700">🌴 إجمالي نخيل المزرعة المسجل</div>
            <div style="font-size:26px;font-weight:900;color:#15803D;margin-top:4px">${totalPalms.toLocaleString()} <span style="font-size:13px;font-weight:600">شجرة</span></div>
            <div style="font-size:11px;color:#16A34A">أصول زراعية حية ومفهرسة</div>
          </div>
          <div class="card" style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:14px;padding:14px">
            <div style="font-size:12px;color:#166534;font-weight:700">🌿 مخزون الكربون العضوي المحتجز</div>
            <div style="font-size:26px;font-weight:900;color:#059669;margin-top:4px">${parseFloat(carbonMetricTons).toLocaleString()} <span style="font-size:13px;font-weight:600">طن كربون</span></div>
            <div style="font-size:11px;color:#059669">في الجذع والمجموع الجذري والخضري</div>
          </div>
          <div class="card" style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:14px;padding:14px">
            <div style="font-size:12px;color:#065F46;font-weight:700">🌍 مكافئ ثاني أكسيد الكربون ($CO_2e$)</div>
            <div style="font-size:26px;font-weight:900;color:#047857;margin-top:4px">${parseFloat(co2eMetricTons).toLocaleString()} <span style="font-size:13px;font-weight:600">طن CO₂e</span></div>
            <div style="font-size:11px;color:#047857">معامل التحويل القياسي (3.67)</div>
          </div>
          <div class="card" style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:14px;padding:14px">
            <div style="font-size:12px;color:#065F46;font-weight:700">♻️ الامتصاص السنوي المتوقع</div>
            <div style="font-size:26px;font-weight:900;color:#065F46;margin-top:4px">${parseFloat(annualSequestrationTons).toLocaleString()} <span style="font-size:13px;font-weight:600">طن CO₂/سنة</span></div>
            <div style="font-size:11px;color:#065F46">معدل تنقية الهواء والمناخ</div>
          </div>
        </div>

        <!-- Legal & ESG Disclaimer Box -->
        <div class="card" style="background:#FFFBEB;border:1.5px solid #FCD34D;border-radius:12px;padding:14px;margin-bottom:16px">
          <div style="font-weight:800;font-size:13.5px;color:#92400E;display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <span>⚠️</span> إشعار وإخلاء مسؤولية بيئي وقانوني (Non-Certified ESG Estimate):
          </div>
          <div style="font-size:12px;color:#78350F;line-height:1.6">
            الحسابات الواردة بهذا التقرير هي تقديرات داخلية استرشادية تعتمد على دراسات نخيل التمر وأعمار الأشجار المسجلة بالمنظومة، ولا تُعد شهادة كربونية رسمية أو سنداً معتمداً لتداول أرصدة الكربون (Carbon Credits) دون مراجعة وتدقيق معتمد من جهة فحص وتوثيق دولية مرخصة.
          </div>
        </div>

        <!-- Palm Age Bracket Table -->
        <div class="card" style="padding:16px;border-radius:14px;margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
            <h4 style="margin:0;font-size:15px;color:#0F172A">توزيع المخزون الكربوني بحسب الفئات العمرية للنخيل</h4>
            <button type="button" class="btn btn-primary no-print" onclick="window.print()" style="padding:6px 14px;font-size:12px;font-weight:700;border-radius:8px">
              🖨️ طباعة تقرير الاستدامة (ESG Report)
            </button>
          </div>
          <div style="overflow-x:auto">
            <table class="table" style="width:100%;font-size:12.5px;border-collapse:collapse">
              <thead>
                <tr style="background:#F8FAFC;border-bottom:2px solid #E2E8F0;text-align:right">
                  <th style="padding:10px">الفئة العمرية</th>
                  <th style="padding:10px">عدد الأشجار</th>
                  <th style="padding:10px">معامل الكربون للشجرة</th>
                  <th style="padding:10px">إجمالي الكربون المحتجز</th>
                  <th style="padding:10px">مكافئ $CO_2e$</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom:1px solid #F1F5F9">
                  <td style="padding:10px;font-weight:700">🌱 فسائل وأشجار صغيرة (&lt; 4 سنوات)</td>
                  <td style="padding:10px">${youngCount.toLocaleString()} شجرة</td>
                  <td style="padding:10px">16 كجم C / شجرة</td>
                  <td style="padding:10px"><b>${((youngCount * 16) / 1000).toFixed(1)} طن</b></td>
                  <td style="padding:10px;color:#059669"><b>${(((youngCount * 16) / 1000) * 3.67).toFixed(1)} طن</b></td>
                </tr>
                <tr style="border-bottom:1px solid #F1F5F9">
                  <td style="padding:10px;font-weight:700">🌿 نخيل متوسط العمر (4 إلى 10 سنوات)</td>
                  <td style="padding:10px">${mediumCount.toLocaleString()} شجرة</td>
                  <td style="padding:10px">100 كجم C / شجرة</td>
                  <td style="padding:10px"><b>${((mediumCount * 100) / 1000).toFixed(1)} طن</b></td>
                  <td style="padding:10px;color:#059669"><b>${(((mediumCount * 100) / 1000) * 3.67).toFixed(1)} طن</b></td>
                </tr>
                <tr style="border-bottom:1px solid #F1F5F9">
                  <td style="padding:10px;font-weight:700">🌴 نخيل بالغ منتج (&gt; 10 سنوات)</td>
                  <td style="padding:10px">${matureCount.toLocaleString()} شجرة</td>
                  <td style="padding:10px">225 كجم C / شجرة</td>
                  <td style="padding:10px"><b>${((matureCount * 225) / 1000).toFixed(1)} طن</b></td>
                  <td style="padding:10px;color:#059669"><b>${(((matureCount * 225) / 1000) * 3.67).toFixed(1)} طن</b></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Print-only Signature Block -->
        <div style="margin-top:24px;border-top:1px dashed #CBD5E1;padding-top:14px;display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:12px;font-weight:700;color:#334155">مدير المزرعة والمشرف العام:</div>
            <div style="font-size:11px;color:#64748B;margin-top:24px">الاسم والتوقيع: .....................................</div>
          </div>
          <div style="text-align:left">
            <div style="font-size:12px;font-weight:700;color:#334155">مسؤول التدقيق البيئي والاستدامة:</div>
            <div style="font-size:11px;color:#64748B;margin-top:24px">الاسم والاعتماد: .....................................</div>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // التبويب 0-هـ: إعدادات ومفاتيح Agri-AI (Agri-AI Settings)
  // =========================================================================
  

  

  
  function renderPestVisionTab(st) {
    const palms = st.palms || [];
    const selectedPalm = palms.find(p => String(p.id) === String(pestSelectedPalmId) || p.code === pestSelectedPalmCode);

    return `
      <div class="card" style="padding:20px;border-radius:16px;box-shadow:0 4px 12px rgba(0,0,0,0.03);margin-bottom:18px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px;border-bottom:1px solid #F1F5F9;padding-bottom:12px">
          <div>
            <h3 style="margin:0;font-size:17px;font-weight:800;color:#0F172A">🐛 الرؤية الحاسوبية: كشف سوسة النخيل والآفات بالصور</h3>
            <div class="muted" style="font-size:12px;margin-top:2px">التقط صورة للجذع أو القمة النامية لتحديد الآفة ودرجة الخطورة وبروتوكول العلاج الفوري</div>
          </div>
          
          <!-- Sample Presets for Quick Testing -->
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <span style="font-size:11px;font-weight:700;color:#64748B">نماذج فحص سريعة:</span>
            <button type="button" class="btn btn-ghost btn-sm" data-act="ai-preset-pest" data-preset="weevil_critical" style="font-size:11px;padding:3px 8px;border-radius:6px;background:#FEF2F2;color:#991B1B;border:1px solid #FECACA">🚨 سوسة حرجة (صمغ ونشارة)</button>
            <button type="button" class="btn btn-ghost btn-sm" data-act="ai-preset-pest" data-preset="weevil_early" style="font-size:11px;padding:3px 8px;border-radius:6px;background:#FFFBEB;color:#92400E;border:1px solid #FDE68A">⚠️ سوسة مبكرة (ثقب خفيف)</button>
            <button type="button" class="btn btn-ghost btn-sm" data-act="ai-preset-pest" data-preset="dust_mite" style="font-size:11px;padding:3px 8px;border-radius:6px;background:#F8FAFC;color:#334155;border:1px solid #E2E8F0">🕸️ حلم الغبار (الغبير)</button>
            <button type="button" class="btn btn-ghost btn-sm" data-act="ai-preset-pest" data-preset="healthy" style="font-size:11px;padding:3px 8px;border-radius:6px;background:#F0FDF4;color:#166534;border:1px solid #BBF7D0">✓ نخلة سليمة</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));gap:18px;margin-bottom:18px">
          <!-- Left: Palm Selection & Notes -->
          <div>
            <label style="display:block;font-weight:700;font-size:13px;margin-bottom:6px;color:#334155">1. كود النخلة المفحوصة (اختياري للربط الفوري):</label>
            <div style="display:flex;gap:6px;align-items:center;margin-bottom:12px">
              <input id="ai_pest_palm_code" list="ai_palm_datalist" value="${escapeHtml(pestSelectedPalmCode)}" placeholder="🔍 اكتب أو اختر كود النخلة (مثل: BSH01-01A-F11-0926)..." style="flex:1;padding:8px 12px;font-size:12.5px;border:1px solid #CBD5E1;border-radius:8px" />
              <datalist id="ai_palm_datalist">
                ${palms.slice(0, 150).map(p => `<option value="${p.code}">${p.code} (${p.status || ''})</option>`).join("")}
              </datalist>
            </div>

            <label style="display:block;font-weight:700;font-size:13px;margin-bottom:6px;color:#334155">2. الملاحظات والأعراض الميدانية المرئية:</label>
            <textarea id="ai_pest_notes" rows="4" placeholder="مثال: لوحظ سيلان إفراز صمغي بني محمر مع وجود نشارة خشبية رطبة على ارتفاع 60 سم من قاعدة الجذع..." style="width:100%;box-sizing:border-box;padding:10px 12px;font-size:12.5px;border:1px solid #CBD5E1;border-radius:8px;line-height:1.5">${escapeHtml(pestCustomNotes)}</textarea>
          </div>

          <!-- Right: Camera & Image Upload Box -->
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <label style="font-weight:700;font-size:13px;color:#334155;margin:0">3. صورة أو صور الفحص (حتى 3 صور):</label>
              <span class="muted" style="font-size:11px">${pestImages.length} من 3 صور</span>
            </div>
            
            <div style="display:flex;flex-direction:column;gap:8px">
              ${pestImages.length ? `
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                  ${pestImages.map((img, idx) => `
                    <div style="position:relative;display:inline-block;width:95px;height:95px;border-radius:10px;border:1.5px solid #CBD5E1;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.06);background:#fff">
                      <img src="${img.preview}" style="width:100%;height:100%;object-fit:cover" alt="معاينة فحص ${idx+1}" />
                      <button type="button" data-act="ai-remove-image" data-id="${idx}" style="position:absolute;top:2px;right:2px;background:#EF4444;color:#fff;border:none;border-radius:50%;width:22px;height:22px;font-size:11px;cursor:pointer;font-weight:bold;display:flex;align-items:center;justify-content:center">✕</button>
                    </div>
                  `).join("")}

                  ${pestImages.length < 3 ? `
                    <label for="ai_pest_add_more" style="position:relative;width:95px;height:95px;border:2px dashed #94A3B8;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;background:#F8FAFC;transition:all 0.15s">
                      <span style="font-size:22px;color:#64748B;pointer-events:none">+</span>
                      <span style="font-size:10px;font-weight:700;color:#64748B;pointer-events:none">إضافة صورة</span>
                      <input type="file" id="ai_pest_add_more" accept="image/*" style="position:absolute;top:0;left:0;right:0;bottom:0;opacity:0;cursor:pointer;width:100%;height:100%" />
                    </label>
                  ` : ''}
                </div>
              ` : `
                <label for="ai_pest_image_file" id="ai_image_dropzone" style="border:2px dashed #CBD5E1;border-radius:12px;padding:16px;text-align:center;background:#F8FAFC;min-height:120px;display:flex;flex-direction:column;justify-content:center;align-items:center;position:relative;cursor:pointer;transition:all 0.2s">
                  <div style="font-size:30px;margin-bottom:4px;pointer-events:none">📷</div>
                  <div style="font-size:13px;font-weight:700;color:#1E293B;pointer-events:none">التقط صورة بالكاميرا أو ارفع من الجهاز</div>
                  <div class="muted" style="font-size:11px;margin-top:2px;pointer-events:none">يمكنك التقاط صورة مقربة لموضع الإصابة أو رفع حتى 3 صور (جذع، تاج، ثمار)</div>
                  <input type="file" id="ai_pest_image_file" accept="image/*" multiple style="position:absolute;top:0;left:0;right:0;bottom:0;opacity:0;cursor:pointer;width:100%;height:100%" />
                </label>
              `}
            </div>
          </div>
        </div>

        <!-- Action Button -->
        <div style="display:flex;gap:10px;align-items:center;justify-content:flex-end">
          <button type="button" class="btn btn-primary" data-act="ai-run-pest-analysis" ${pestIsAnalyzing ? 'disabled' : ''} style="padding:10px 24px;font-size:14px;font-weight:800;border-radius:10px;display:inline-flex;align-items:center;gap:8px;box-shadow:0 4px 10px rgba(27,94,32,0.25)">
            <span>${pestIsAnalyzing ? '⏳' : '🔍'}</span>
            <span>${pestIsAnalyzing ? 'جاري الفحص بالذكاء الاصطناعي...' : 'بدء الفحص والتشخيص الذكي'}</span>
          </button>
        </div>

        <!-- Diagnosis Result Card -->
        ${pestDiagnosisResult ? renderPestResultCard(pestDiagnosisResult, selectedPalm) : ''}
      </div>
    `;
  }

  function renderPestResultCard(res, palm) {
    const isDetected = res.pest_detected;
    const isCritical = res.severity === 'critical';
    const isSuspected = res.severity === 'suspected' || res.severity === 'early';
    const isHealthy = res.severity === 'healthy';

    const cardBorder = isCritical ? '#DC2626' : (isSuspected ? '#D97706' : '#16A34A');
    const badgeBg = isCritical ? '#FEF2F2' : (isSuspected ? '#FFFBEB' : '#F0FDF4');
    const badgeColor = isCritical ? '#991B1B' : (isSuspected ? '#92400E' : '#166534');
    if (res.source === 'not_analyzed') {
      return `<div style="margin-top:20px;background:#FFFBEB;border:1.5px solid #FCD34D;border-radius:14px;padding:16px;color:#92400E;font-size:13px;line-height:1.7"><b>⚠️ ${escapeHtml(res.pest_name)}</b><br>${escapeHtml(res.diagnosis_summary)}</div>`;
    }

    return `
      ${res.image_analyzed === false ? `<div style="margin-top:20px;background:#FFFBEB;border:1px solid #FCD34D;border-radius:10px;padding:8px 12px;color:#92400E;font-size:12.5px">⚠️ الصورة لم تُحلل (لا يوجد اتصال بـ Gemini) — النتيجة دي مبدئية من الوصف المكتوب، ولازم تأكيد ميداني.</div>` : ""}
      <div style="margin-top:20px;background:#ffffff;border:1.5px solid ${cardBorder};border-radius:14px;padding:18px;box-shadow:0 6px 16px -2px rgba(0,0,0,0.06)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:12px;border-bottom:1px solid #F1F5F9;padding-bottom:10px">
          <div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span style="font-size:22px">${isCritical ? '🚨' : (isHealthy ? '✅' : '⚠️')}</span>
              <h4 style="margin:0;font-size:17px;font-weight:800;color:#0F172A">${res.pest_name}</h4>
              <span style="font-style:italic;color:#64748B;font-size:12px">(${res.pest_latin})</span>
            </div>
            <div style="font-size:12px;color:#475569;margin-top:3px">${res.diagnosis_summary}</div>
          </div>
          
          <div style="display:flex;align-items:center;gap:8px">
            <span class="badge" style="background:${badgeBg};color:${badgeColor};border:1px solid ${cardBorder};font-size:12px;font-weight:800;padding:4px 10px;border-radius:8px">
              ${res.severity_label}
            </span>
            <span class="badge" style="background:#F1F5F9;color:#334155;font-size:11px;font-weight:700;padding:4px 8px;border-radius:8px">
              دقة التشخيص: ${res.confidence}%
            </span>
          </div>
        </div>

        <!-- Symptoms List -->
        ${res.symptoms_identified && res.symptoms_identified.length ? `
          <div style="margin-bottom:12px">
            <div style="font-size:12.5px;font-weight:700;color:#334155;margin-bottom:4px">🔍 الأعراض الحيوية المرصودة بالصورة:</div>
            <ul style="margin:0;padding-right:20px;font-size:12px;color:#475569;line-height:1.6">
              ${res.symptoms_identified.map(s => `<li>${s}</li>`).join("")}
            </ul>
          </div>
        ` : ''}

        <!-- Chemical Treatment Protocol -->
        ${res.treatment_protocol ? `
          <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-right:5px solid ${cardBorder};border-radius:10px;padding:12px;margin-bottom:14px">
            <div style="font-weight:800;font-size:13px;color:#1E293B;margin-bottom:6px">🧪 بروتوكول العلاج والمكافحة الفوري المعتمد:</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:8px;font-size:12px;margin-bottom:8px">
              <div><b>المبيد الموصى به:</b> <span style="color:#0369A1;font-weight:700">${res.treatment_protocol.chemical_name}</span></div>
              <div><b>الجرعة والتخفيف:</b> <span style="color:#B45309;font-weight:700">${res.treatment_protocol.dosage}</span></div>
              <div><b>طريقة التطبيق:</b> <span>${res.treatment_protocol.application_method}</span></div>
            </div>
            ${res.treatment_protocol.steps ? `
              <div style="font-size:11.5px;color:#475569;line-height:1.5">
                <b>خطوات التنفيذ الميداني:</b>
                <ol style="margin:4px 0 0;padding-right:18px">
                  ${res.treatment_protocol.steps.map(st => `<li>${st}</li>`).join("")}
                </ol>
              </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- Direct Instant Action Buttons -->
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;background:#F1F5F9;padding:10px 14px;border-radius:10px">
          <div style="font-size:12px;color:#334155">
            <b>التوجيه الميداني:</b> ${res.recommended_action || 'اتخاذ التدابير المعتمدة وتوثيق العملية في المنظومة.'}
          </div>

          <div style="display:flex;gap:8px;align-items:center">
            ${isDetected ? `
              <button type="button" class="btn btn-danger" data-act="ai-commit-pest-incident" style="font-size:13px;font-weight:800;padding:8px 16px;border-radius:8px;display:inline-flex;align-items:center;gap:6px;box-shadow:0 4px 10px rgba(220,38,38,0.25)">
                <span>🚨</span> تحويل لبلاغ سوسة وتحديث حالة النخلة
              </button>
            ` : res.image_analyzed === false ? "" : `
              <button type="button" class="btn btn-primary" data-act="ai-confirm-healthy-palm" style="font-size:13px;font-weight:800;padding:8px 16px;border-radius:8px;display:inline-flex;align-items:center;gap:6px">
                <span>✓</span> تأكيد سلامة النخلة في السجل
              </button>
            `}
          </div>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // التبويب 2: محلل تقارير التربة والمياه (Soil & Water Lab Analyzer)
  // =========================================================================
  function renderSoilAnalyzerTab(st) {
    const sectors = st.sectors || [];

    return `
      <div class="card" style="padding:20px;border-radius:16px;box-shadow:0 4px 12px rgba(0,0,0,0.03);margin-bottom:18px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px;border-bottom:1px solid #F1F5F9;padding-bottom:12px">
          <div>
            <h3 style="margin:0;font-size:17px;font-weight:800;color:#0F172A">🧪 محلل تقارير التربة والمياه وتوليد برامج التسميد الذكية</h3>
            <div class="muted" style="font-size:12px;margin-top:2px">تفريغ نتائج المعمل وتوليد جداول التسميد الموسمية ومقننات أحماض معالجة القلوية والملوحة</div>
          </div>
          
          <!-- Sample Lab Presets -->
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <span style="font-size:11px;font-weight:700;color:#64748B">عينات معملية جاهزة:</span>
            <button type="button" class="btn btn-ghost btn-sm" data-act="ai-preset-soil" data-preset="farafra_alkaline" style="font-size:11px;padding:3px 8px;border-radius:6px;background:#FFFBEB;color:#92400E;border:1px solid #FDE68A">🏜️ تربة الفرافرة (قلوية pH 8.1)</button>
            <button type="button" class="btn btn-ghost btn-sm" data-act="ai-preset-soil" data-preset="saline_water" style="font-size:11px;padding:3px 8px;border-radius:6px;background:#FEF2F2;color:#991B1B;border:1px solid #FECACA">🌊 ماء بئر مالح (EC 5.8)</button>
            <button type="button" class="btn btn-ghost btn-sm" data-act="ai-preset-soil" data-preset="balanced_loam" style="font-size:11px;padding:3px 8px;border-radius:6px;background:#F0FDF4;color:#166534;border:1px solid #BBF7D0">🌱 تربة متوازنة (pH 7.3)</button>
            <button type="button" class="btn btn-ghost btn-sm" data-act="ai-preset-soil" data-preset="depleted_zero" style="font-size:11px;padding:3px 8px;border-radius:6px;background:#FEF2F2;color:#991B1B;border:1px solid #FECACA">🚫 عناصر منعدمة (فحص الصفر 0)</button>
          </div>
        </div>

        <!-- Input Parameters Grid -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:12px;margin-bottom:16px;background:#F8FAFC;padding:14px;border-radius:12px;border:1px solid #E2E8F0">
          <div>
            <label style="font-weight:700;font-size:12px;color:#334155;display:block;margin-bottom:4px">القطاع المستهدف:</label>
            <select id="ai_soil_sec" style="width:100%;padding:6px 8px;font-size:12px;border:1px solid #CBD5E1;border-radius:6px">
              <option value="">كافة القطاعات</option>
              ${sectors.map(s => `<option value="${s.id}" ${soilSectorId===s.id?'selected':''}>${s.name}</option>`).join("")}
            </select>
          </div>
          <div>
            <label style="font-weight:700;font-size:12px;color:#334155;display:block;margin-bottom:4px">الملوحة (EC dS/m):</label>
            <input id="ai_soil_ec" type="number" step="0.1" value="${soilEc}" style="width:100%;padding:6px 8px;font-size:12px;border:1px solid #CBD5E1;border-radius:6px" />
          </div>
          <div>
            <label style="font-weight:700;font-size:12px;color:#334155;display:block;margin-bottom:4px">الحموضة (pH):</label>
            <input id="ai_soil_ph" type="number" step="0.1" value="${soilPh}" style="width:100%;padding:6px 8px;font-size:12px;border:1px solid #CBD5E1;border-radius:6px" />
          </div>
          <div>
            <label style="font-weight:700;font-size:12px;color:#334155;display:block;margin-bottom:4px">الصوديوم (SAR):</label>
            <input id="ai_soil_sar" type="number" step="0.1" value="${soilSar}" style="width:100%;padding:6px 8px;font-size:12px;border:1px solid #CBD5E1;border-radius:6px" />
          </div>
          <div>
            <label style="font-weight:700;font-size:12px;color:#334155;display:block;margin-bottom:4px">نيتروجين N (mg/kg):</label>
            <input id="ai_soil_n" type="number" value="${soilN}" style="width:100%;padding:6px 8px;font-size:12px;border:1px solid #CBD5E1;border-radius:6px" />
          </div>
          <div>
            <label style="font-weight:700;font-size:12px;color:#334155;display:block;margin-bottom:4px">فوسفور P (mg/kg):</label>
            <input id="ai_soil_p" type="number" value="${soilP}" style="width:100%;padding:6px 8px;font-size:12px;border:1px solid #CBD5E1;border-radius:6px" />
          </div>
          <div>
            <label style="font-weight:700;font-size:12px;color:#334155;display:block;margin-bottom:4px">بوتاسيوم K (mg/kg):</label>
            <input id="ai_soil_k" type="number" value="${soilK}" style="width:100%;padding:6px 8px;font-size:12px;border:1px solid #CBD5E1;border-radius:6px" />
          </div>
          <div>
            <label style="font-weight:700;font-size:12px;color:#334155;display:block;margin-bottom:4px">كالسيوم Ca (mg/L):</label>
            <input id="ai_soil_ca" type="number" value="${soilCa}" style="width:100%;padding:6px 8px;font-size:12px;border:1px solid #CBD5E1;border-radius:6px" />
          </div>
          <div>
            <label style="font-weight:700;font-size:12px;color:#334155;display:block;margin-bottom:4px">مغنيسيوم Mg (mg/L):</label>
            <input id="ai_soil_mg" type="number" value="${soilMg}" style="width:100%;padding:6px 8px;font-size:12px;border:1px solid #CBD5E1;border-radius:6px" />
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;margin-bottom:18px">
          <button type="button" class="btn btn-primary" data-act="ai-run-soil-analysis" ${soilIsAnalyzing ? 'disabled' : ''} style="padding:10px 24px;font-size:14px;font-weight:800;border-radius:10px;display:inline-flex;align-items:center;gap:8px">
            <span>${soilIsAnalyzing ? '⏳' : '🧪'}</span>
            <span>${soilIsAnalyzing ? 'جاري التحليل والمطابقة...' : 'تحليل المؤشرات وتوليد خطة التسميد'}</span>
          </button>
        </div>

        <!-- Soil Analysis Result Body -->
        ${soilAnalysisResult ? renderSoilResultCard(soilAnalysisResult) : ''}
      </div>
    `;
  }

  function renderSoilResultCard(res) {
    const metrics = res.metrics || {};

    return `
      <div style="background:#ffffff;border:1.5px solid #10B981;border-radius:14px;padding:18px;box-shadow:0 6px 16px -2px rgba(0,0,0,0.06)">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:14px;border-bottom:1px solid #F1F5F9;padding-bottom:10px">
          <div>
            <h4 style="margin:0;font-size:16px;font-weight:800;color:#065F46">📊 التقرير التحليلي وتقدير خصوبة التربة</h4>
            <div style="font-size:12px;color:#475569;margin-top:2px">${res.summary}</div>
          </div>
          <span class="badge" style="background:#ECFDF5;color:#059669;border:1px solid #A7F3D0;font-size:12px;font-weight:700;padding:4px 10px;border-radius:8px">
            برنامج نخيل معتمد (Farafra Oasis Standard)
          </span>
        </div>

        <!-- Metric Badges Grid -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:8px;margin-bottom:16px">
          ${Object.entries(metrics).map(([key, val]) => {
            const bg = val.badge === 'danger' ? '#FEF2F2' : (val.badge === 'warn' ? '#FFFBEB' : '#F0FDF4');
            const clr = val.badge === 'danger' ? '#991B1B' : (val.badge === 'warn' ? '#92400E' : '#166534');
            const bdr = val.badge === 'danger' ? '#FECACA' : (val.badge === 'warn' ? '#FDE68A' : '#BBF7D0');
            return `
              <div style="background:${bg};border:1px solid ${bdr};padding:8px 10px;border-radius:8px;text-align:center">
                <div style="font-size:11px;color:#64748B;font-weight:700">${key.toUpperCase()}</div>
                <div style="font-size:15px;font-weight:800;color:${clr}">${val.value} <span style="font-size:10px">${val.unit}</span></div>
                <div style="font-size:10px;font-weight:600;color:${clr};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${val.status}</div>
              </div>
            `;
          }).join("")}
        </div>

        <!-- Acid & Water Strategy Alert -->
        ${res.acid_correction ? `
          <div style="background:#FFF7ED;border:1px solid #FED7AA;border-right:5px solid #EA580C;border-radius:10px;padding:12px;margin-bottom:14px;font-size:12.5px;color:#9A3412">
            <div style="font-weight:800;margin-bottom:4px">⚠️ توصية معادلة القلوية والملوحة:</div>
            <div>${res.acid_correction.strategy}</div>
            <div style="margin-top:4px;font-weight:700;color:#C2410C">الجرعة المقترحة: ${res.acid_correction.dosage}</div>
          </div>
        ` : ''}

        <!-- Seasonal Schedule Table -->
        <div style="margin-bottom:16px">
          <div style="font-size:13px;font-weight:800;color:#1E293B;margin-bottom:8px">📅 خطة التسميد الموسمي المقترحة (الاحتياجات لكل فدان):</div>
          <div style="overflow-x:auto">
            <table class="table" style="font-size:12px;margin:0;width:100%">
              <thead>
                <tr style="background:#F8FAFC">
                  <th style="padding:8px 10px">المرحلة والموسم</th>
                  <th style="padding:8px 10px">الهدف التغذوي</th>
                  <th style="padding:8px 10px;text-align:center">N (كجم)</th>
                  <th style="padding:8px 10px;text-align:center">P (كجم)</th>
                  <th style="padding:8px 10px;text-align:center">K (كجم)</th>
                  <th style="padding:8px 10px">الأسمدة الموصى بها</th>
                </tr>
              </thead>
              <tbody>
                ${(res.seasonal_plan || []).map(p => `
                  <tr>
                    <td style="font-weight:700;color:#0F172A">${p.stage}</td>
                    <td style="color:#475569">${p.focus}</td>
                    <td style="text-align:center;font-weight:700;color:#1D4ED8">${p.nitrogen_kg_feddan}</td>
                    <td style="text-align:center;font-weight:700;color:#B45309">${p.phosphorus_kg_feddan}</td>
                    <td style="text-align:center;font-weight:700;color:#15803D">${p.potassium_kg_feddan}</td>
                    <td style="font-size:11px;color:#334155">
                      ${(p.recommended_fertilizers || []).join(' • ')}
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;background:#F1F5F9;padding:10px 14px;border-radius:10px">
          <div style="font-size:12px;color:#475569">
            💧 ${res.water_management_note || 'إدارة الري متوازنة.'}
          </div>
          <button type="button" class="btn btn-primary" data-act="ai-commit-fertilizer-plan" style="font-size:13px;font-weight:800;padding:8px 16px;border-radius:8px;display:inline-flex;align-items:center;gap:6px">
            <span>📋</span> اعتماد وإدراج الخطة كمهام في جدول العمليات
          </button>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // التبويب 3: المساعد الصوتي الميداني (Voice-to-Action Copilot)
  // =========================================================================
  function renderVoiceCopilotTab(st) {
    // The voice assistant itself lives in voice-assistant.js (floating 🎙️ button on every screen).
    const ex = [
      "تسجيل عملية قلع فسيلة لنخلة رقم 11 قطعة رقم 7 قطاع 3",
      "تسجيل عملية ري اضافي لقطعة 2 قطاع 4",
      "سمدنا القطعة 3 قطاع 2 بسلفات نشادر 2 كيلو للنخلة",
      "نخلة 25 قطعة 7 قطاع 3 فيها سوسة"
    ];
    return `
      <div class="card" style="padding:24px;border-radius:16px;margin-bottom:18px;text-align:center">
        <h3 style="margin:0;font-size:18px;font-weight:800;color:#0F172A">🎙️ المساعد الصوتي الميداني</h3>
        <div class="muted" style="font-size:13px;margin:6px auto 16px;max-width:620px;line-height:1.7">
          العامل أو المهندس يقول العملية والمكان بالعامية، والنظام يفهمها ويطابقها مع بيانات المزرعة الحقيقية (القطاعات والقطع والنخيل وأنواع العمليات المسجلة)، ويعرضها للمراجعة قبل الحفظ.
          متاح من زر 🎙️ الثابت في كل الشاشات، أو Alt+V على الكمبيوتر، أو بالضغط المطوّل على أيقونة التطبيق في الموبايل.
        </div>
        <button type="button" class="btn btn-primary" onclick="window.VoiceAssistant && VoiceAssistant.open({ autoStart: true })" style="width:auto !important;padding:12px 28px;font-size:15px;font-weight:800;border-radius:12px">🎙️ ابدأ التسجيل</button>
        <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-top:16px">
          <span style="font-size:12px;font-weight:700;color:#64748B;line-height:2">جرّب:</span>
          ${ex.map(t => `<button type="button" class="btn btn-ghost btn-sm" onclick="window.VoiceAssistant && VoiceAssistant.open({ text: this.dataset.text })" data-text="${escapeHtml(t)}" style="width:auto !important;font-size:12px;padding:4px 10px;border-radius:15px;background:#F8FAFC;border:1px solid #CBD5E1">«${escapeHtml(t)}»</button>`).join("")}
        </div>
      </div>
      <div class="card" style="padding:16px 18px;border-radius:14px;font-size:12.5px;line-height:1.8;color:#334155">
        <b style="font-size:13.5px;color:#0F172A">إزاي بيشتغل؟</b>
        <ul style="margin:6px 18px 0;padding:0">
          <li>الفهم بيتم على الجهاز نفسه، فبيشتغل من غير نت لو الأمر مكتوب. تحويل الكلام لنص في المتصفح غالباً محتاج نت.</li>
          <li>الأرقام المنطوقة بتتفهم: «حداشر»، «خمسة وعشرين»، «القطعة التالتة»، وكمان «قطعة 7 ب» للقطع الفرعية.</li>
          <li>لو فيه لبس (القطعة موجودة في أكتر من قطاع، أو فيه نخلتين بنفس الرقم في القطع الفرعية) النظام بيسأل، ومش بيخمّن.</li>
          <li>لو الجملة مش واضحة والنت موجود، بيستعين بـ Gemini، وبعدها النظام بيراجع إجابته على بيانات المزرعة قبل ما يعرضها.</li>
          <li>العملية بتتسجل زي أي عملية يدوية، وبتروح لاعتماد المشرف.</li>
        </ul>
      </div>
    `;
  }


  // =========================================================================
  // التبويب 4: المستشار الزراعي الذكي لمشاكل الحقل (Agri-Chatbot)
  // =========================================================================
  function renderAgriChatTab(st, curUser) {
    return `
      <div class="card" style="padding:20px;border-radius:16px;box-shadow:0 4px 12px rgba(0,0,0,0.03);margin-bottom:18px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;border-bottom:1px solid #F1F5F9;padding-bottom:10px">
          <div>
            <h3 style="margin:0;font-size:17px;font-weight:800;color:#0F172A">💬 المستشار الزراعي الذكي (Agri-Copilot 24/7)</h3>
            <div class="muted" style="font-size:12px;margin-top:2px">استشارات فورية مدعومة بدليل الممارسات الزراعية المعتمدة لمزارع النخيل والواحات</div>
          </div>

          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:12px;font-weight:700;color:#475569">وضع الاستشارة:</span>
            <select id="ai_chat_role" data-act="ai-change-chat-role" style="padding:4px 10px;font-size:12px;border:1px solid #CBD5E1;border-radius:8px;background:#F8FAFC;font-weight:700">
              <option value="engineer" ${agriChatUserRole==='engineer'?'selected':''}>👨‍🔬 مهندس زراعي (جرعات وتركيزات كيميائية)</option>
              <option value="worker" ${agriChatUserRole==='worker'?'selected':''}>👨‍🌾 فني ميداني (تعليمات تطبيقية مباشرة)</option>
              <option value="investor" ${agriChatUserRole==='investor'?'selected':''}>💼 مستثمر (إحاطة اقتصادية ومحصولية)</option>
            </select>
          </div>
        </div>

        <!-- Quick Question Chips -->
        <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;margin-bottom:12px">
          <button type="button" class="btn btn-ghost btn-sm" data-act="ai-quick-question" data-q="ما هو بروتوكول علاج سوسة النخيل المعتمد بالحقن؟" style="font-size:11.5px;padding:4px 10px;border-radius:15px;background:#F8FAFC;border:1px solid #CBD5E1;white-space:nowrap">🐛 علاج سوسة النخيل بالحقن</button>
          <button type="button" class="btn btn-ghost btn-sm" data-act="ai-quick-question" data-q="كيف أعالج نقص البوتاسيوم واصفرار السعف؟" style="font-size:11.5px;padding:4px 10px;border-radius:15px;background:#F8FAFC;border:1px solid #CBD5E1;white-space:nowrap">🍂 أعراض نقص البوتاسيوم</button>
          <button type="button" class="btn btn-ghost btn-sm" data-act="ai-quick-question" data-q="متى يبدأ موعد خف وتدلية عراجين المجدول؟" style="font-size:11.5px;padding:4px 10px;border-radius:15px;background:#F8FAFC;border:1px solid #CBD5E1;white-space:nowrap">🌾 خف وتدلية عراجين المجدول</button>
          <button type="button" class="btn btn-ghost btn-sm" data-act="ai-quick-question" data-q="ما المقنن المائي اليومي للنخلة في حرارة الصيف؟" style="font-size:11.5px;padding:4px 10px;border-radius:15px;background:#F8FAFC;border:1px solid #CBD5E1;white-space:nowrap">💧 المقنن المائي الصيفي</button>
        </div>

        <!-- Messages Chat Box -->
        <div id="ai_chat_box" style="height:360px;overflow-y:auto;border:1px solid #E2E8F0;border-radius:12px;padding:16px;background:#F8FAFC;margin-bottom:12px;display:flex;flex-direction:column;gap:12px">
          ${agriChatHistory.map(m => `
            <div style="display:flex;align-items:flex-start;gap:10px;${m.sender === 'user' ? 'flex-direction:row-reverse' : ''}">
              <div style="width:34px;height:34px;border-radius:50%;background:${m.sender === 'user' ? '#1B5E20' : '#312E81'};color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">
                ${m.sender === 'user' ? '👤' : '🌴'}
              </div>
              <div style="max-width:75%;background:${m.sender === 'user' ? '#DCFCE7' : '#FFFFFF'};color:#0F172A;border:1px solid ${m.sender === 'user' ? '#BBF7D0' : '#E2E8F0'};border-radius:14px;padding:12px 14px;font-size:13px;line-height:1.6;box-shadow:0 1px 3px rgba(0,0,0,0.03);position:relative">
                <div style="white-space:pre-wrap">${m.text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')}</div>
                <div style="font-size:10px;color:#94A3B8;margin-top:4px;text-align:${m.sender === 'user' ? 'left' : 'right'}">${m.time}</div>
              </div>
            </div>
          `).join("")}
          ${agriChatIsLoading ? `
            <div style="display:flex;align-items:center;gap:10px">
              <div style="width:34px;height:34px;border-radius:50%;background:#312E81;color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px">🌴</div>
              <div style="background:#fff;padding:8px 14px;border-radius:14px;border:1px solid #E2E8F0;font-size:12px;color:#64748B">
                جاري مراجعة المراجع والتوصيات الزراعية... ⏳
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Chat Input Form -->
        <div style="display:flex;gap:8px;align-items:center;width:100%">
          ${(st?.settings?.ai_chat_voice_enabled !== false) ? `
            <button type="button" class="btn ${chatIsRecording ? 'btn-danger' : 'btn-secondary'}" data-act="ai-chat-toggle-mic" title="${chatIsRecording ? 'إيقاف التسجيل الصوتي' : 'تسجيل السؤال صوتياً عبر المايك'}" style="width:46px;height:46px;padding:0;font-size:18px;border-radius:12px;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;background:${chatIsRecording ? '#EF4444' : '#F8FAFC'};color:${chatIsRecording ? '#FFFFFF' : '#334155'};border:1.5px solid ${chatIsRecording ? '#DC2626' : '#CBD5E1'}">
              <span>${chatIsRecording ? '🛑' : '🎙️'}</span>
            </button>
          ` : ''}
          <input id="ai_chat_input" placeholder="اكتب سؤالك واستشارتك الزراعية هنا... (مثال: جدول تسميد شهر سبتمبر)" style="flex:1;min-width:0;width:100%;height:46px;box-sizing:border-box;padding:10px 16px;font-size:13.5px;border:1.5px solid #CBD5E1;border-radius:12px" onkeydown="if(event.key==='Enter') document.querySelector('[data-act=ai-send-chat]').click()" />
          <button type="button" class="btn btn-primary" data-act="ai-send-chat" ${agriChatIsLoading ? 'disabled' : ''} style="width:auto !important;min-width:110px;height:46px;padding:0 22px;font-size:13.5px;font-weight:800;border-radius:12px;white-space:nowrap;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;gap:6px">
            <span>${agriChatIsLoading ? '⏳ جاري...' : 'إرسال ↵'}</span>
          </button>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // معالج أحداث ونقرات المركز الذكي (Event Dispatcher)
  // =========================================================================
  async function handleAiHubAction(name, id, target, e) {
    // 1. تبديل التبويبات
    if (name === "switch-ai-tab") {
      const tab = target?.getAttribute("data-tab");
      if (tab) {
        aiActiveTab = tab;
        if (typeof render === "function") render();
      }
      return true;
    }

    if (name === "ai-select-ndvi-plot") {
      ndviSelectedPlotId = id || "";
      if (typeof render === "function") render();
      return true;
    }

    if (name === "ai-refresh-ndvi") {
      if (agro.syncing) return true;
      agro.syncing = true;
      if (typeof render === "function") render();
      try {
        const r = await fetch("/api/agro/ndvi/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        const j = await r.json();
        if (!r.ok || !j.success) toast("🛰️ " + (j.error || "تعذر التحديث"));
        else toast(`🛰️ تم: ${j.processed} قطعة اتحدثت، ${j.observationsAdded} صورة جديدة${j.polygonsCreated ? `، ${j.polygonsCreated} قطعة اتسجلت لأول مرة` : ""}${j.remaining ? ` — فاضل ${j.remaining} قطعة، اضغط تحديث تاني` : ""}${j.errors && j.errors.length ? ` (${j.errors.length} أخطاء)` : ""}`);
      } catch (e) { toast("🛰️ لا يوجد اتصال بالخادم"); }
      agro.syncing = false;
      agroLoad("ndvi", true);
      return true;
    }

    if (name === "ai-irr-sector" || name === "ai-pest-sector") {
      const v = target?.value || "all";
      if (name === "ai-irr-sector") irrigationSelectedSector = v; else pestRiskSelectedSector = v;
      if (typeof render === "function") render();
      return true;
    }

    if (name === "ai-irrigate-plot") {
      const st = Store.get();
      const pl = (st.plots || []).find(p => String(p.id) === String(id));
      const water = parseFloat(target?.getAttribute("data-water")) || 0;
      const types = irrigationTypes(st);
      const type = types.find(t => /^ري/.test(t.name) && (t.scopeType || "both") !== "individual") || types[0];
      if (!pl || !type) { toast("مفيش نوع عملية ري معرّف في الإعدادات"); return true; }
      if (!confirm(`تسجيل «${type.name}» للقطعة ${pl.name || pl.id}\nالكمية المحسوبة لاحتياج النهارده: ${water} م³`)) return true;
      const fam = typeof activePalmsInPlotFamily === "function" ? activePalmsInPlotFamily(pl.id) : [];
      const batch = Store.uid("bk");
      const op = {
        id: Store.uid("op"), palmId: null, typeId: type.id, at: new Date().toISOString(), photos: [],
        notes: `[ري حسب الاحتياج المحسوب] ${water} م³ (ET₀ × Kc × المساحة)`,
        workerId: session()?.id, status: "pending", approval: "pending", device: "ai-irrigation", supervisorNote: "",
        bulkId: batch, batchId: batch, targetLevel: "plot", sectorId: pl.sector || null, plotId: pl.id,
        treeCount: fam.length, palmIds: fam.map(p => p.id), materialQty: water, materialUnit: "م³"
      };
      st.operations.push(op);
      Store.set({ operations: st.operations });
      if (typeof enqueue === "function") enqueue("ري: " + type.name, pl.name || pl.id);
      if (typeof Api !== "undefined" && typeof Api.createOperation === "function") Api.createOperation(op);
      toast(`💧 اتسجل ري القطعة ${pl.name || pl.id} وفي انتظار الاعتماد`);
      if (typeof render === "function") render();
      return true;
    }

    if (name === "ai-inspect-palm") {
      aiActiveTab = "pest-vision";
      pestSelectedPalmCode = id || "";
      pestDiagnosisResult = null;
      pestImages = [];
      if (typeof go === "function") go("ai-hub", "pest-vision");
      return true;
    }

    // 2. نماذج فحص الآفات السريعة
    if (name === "ai-preset-pest") {
      const preset = target?.getAttribute("data-preset");
      if (preset === "weevil_critical") {
        pestSelectedPalmCode = "BSH01-01A-F11-0926";
        pestCustomNotes = "إفرازات صمغية لزجة بنية محمرة تسيل من الجذع مع وجود نشارة رطبة وتآكل في الأنسجة على ارتفاع 60 سم.";
      } else if (preset === "weevil_early") {
        pestSelectedPalmCode = "BSH01-01A-F43-0926";
        pestCustomNotes = "اشتباه إصابة مبكرة: ثقب صغير في قاعدة الجذع مع نقطة صمغ طرية ونشارة خفيفة.";
      } else if (preset === "dust_mite") {
        pestSelectedPalmCode = "BSH01-02B-F05-0926";
        pestCustomNotes = "وجود غبار ونسيج عنكبوتي يغطي العراجين والشماريخ الزهرية مع تصلب جلدة الثمار.";
      } else {
        pestSelectedPalmCode = "BSH01-01A-F02-0926";
        pestCustomNotes = "فحص بصري دوري للجذع والتاج — الأنسجة سليمة تماماً ولا توجد أي إفرازات أو نشارة.";
      }
      pestDiagnosisResult = null;
      if (typeof render === "function") render();
      return true;
    }

    // 3. مسح الصور أو إزالة صورة محددة
    if (name === "ai-clear-image") {
      pestImages = [];
      pestDiagnosisResult = null;
      if (typeof render === "function") render();
      return true;
    }

    if (name === "ai-remove-image") {
      const idx = parseInt(id, 10);
      if (!isNaN(idx) && idx >= 0 && idx < pestImages.length) {
        pestImages.splice(idx, 1);
        pestDiagnosisResult = null;
        if (typeof render === "function") render();
      }
      return true;
    }

    // 4. تشغيل فحص الآفات
    if (name === "ai-run-pest-analysis") {
      const palmCodeInput = document.getElementById("ai_pest_palm_code")?.value?.trim() || pestSelectedPalmCode;
      const notesInput = document.getElementById("ai_pest_notes")?.value?.trim() || pestCustomNotes;
      pestSelectedPalmCode = palmCodeInput;
      pestCustomNotes = notesInput;

      pestIsAnalyzing = true;
      if (typeof render === "function") render();

      try {
        let result = null;
        if (typeof Api !== "undefined" && typeof Api.diagnosePest === "function") {
          result = await Api.diagnosePest({
            palmCode: palmCodeInput,
            description: notesInput,
            imagesBase64: pestImages.map(img => img.base64),
            imageBase64: pestImages[0]?.base64 || null
          });
        }

        // إذا لم يكن متصلاً، نشغل محرك الفحص المحلي المدمج
        if (!result) {
          // offline: the photo cannot be analysed on the phone — only a guess from the written description
          if ((notesInput || "").replace(/\s+/g, "").length < 4) {
            result = { source: "not_analyzed", image_analyzed: false, pest_detected: null, pest_name: "لم يتم تحليل الصورة", confidence: 0, severity: "unknown", severity_label: "غير محدد", symptoms_identified: [], diagnosis_summary: "تحليل الصور يحتاج إنترنت. اكتب وصف الأعراض للحصول على تشخيص مبدئي، أو أعد المحاولة لما النت يرجع.", treatment_protocol: { chemical_name: "—", dosage: "—", application_method: "—", steps: [], quarantine_needed: false }, recommended_action: "معاينة ميدانية قبل اعتبار النخلة سليمة أو مصابة." };
          } else {
            result = runLocalPestDiagnostics(notesInput, palmCodeInput);
            result.image_analyzed = false;
            result.confidence = Math.min(result.confidence || 0, 55);
            result.diagnosis_summary = "⚠️ تشخيص مبدئي من الوصف المكتوب فقط (الصورة لم تُحلل). " + (result.diagnosis_summary || "");
          }
        }

        pestDiagnosisResult = result;
        pestIsAnalyzing = false;
        if (typeof window.playPulseChime === "function") window.playPulseChime();
        if (typeof toast === "function") toast(result.image_analyzed === false ? "⚠️ الصورة لم تُحلل — النتيجة مبدئية من الوصف فقط" : "🔍 تم الانتهاء من الفحص والتشخيص");
      } catch (err) {
        pestIsAnalyzing = false;
        if (typeof toast === "function") toast("حدث خطأ أثناء الفحص: " + err.message);
      }
      if (typeof render === "function") render();
      return true;
    }

    // 5. تحويل الفحص لبلاغ سوسة حرج
    if (name === "ai-commit-pest-incident") {
      if (!pestDiagnosisResult) return true;
      const st = Store.get();
      const code = pestSelectedPalmCode || (pestDiagnosisResult.palm_code || "");
      let palm = (st.palms || []).find(p => p.code === code || codesEqual(p.code, code));
      if (!palm && st.palms && st.palms.length > 0) palm = st.palms[0];

      if (palm) {
        palm.status = "مصابة";
        palm.statusId = 3;
        palm.statusCode = "infected";
        palm.badgeColor = "#DC2626";
        palm.badgeBg = "#FEE2E2";
        palm.modifiedBy = session()?.name || "فاحص الذكاء الاصطناعي";
        palm.modifiedAt = new Date().toISOString();

        // إضافة عملية مكافحة حرجة
        const op = {
          id: Store.uid("op"),
          palmId: palm.id,
          palmCode: palm.code,
          typeId: "op_curative",
          notes: `[بلاغ سوسة آلي بالرؤية الحاسوبية] ${pestDiagnosisResult.pest_name} - ${pestDiagnosisResult.diagnosis_summary}`,
          workerId: session()?.id || "u1",
          at: new Date().toISOString(),
          status: "pending",
          approval: "pending",
          health: "مصابة"
        };
        st.operations = st.operations || [];
        st.operations.unshift(op);

        const inc = {
          id: Store.uid("inc"),
          palmId: palm.id,
          plotId: palm.plot,
          type: "سوسة النخيل",
          title: `رصد سوسة النخيل بالرؤية الذكية (${pestDiagnosisResult.severity_label || 'إصابة حرجة'})`,
          desc: `${pestDiagnosisResult.pest_name}: ${pestDiagnosisResult.diagnosis_summary}`,
          by: session()?.id || "u1",
          at: new Date().toISOString(),
          severity: pestDiagnosisResult.severity === "critical" ? "critical" : "high",
          status: "open"
        };
        st.incidents = st.incidents || [];
        st.incidents.unshift(inc);

        Store.set({ palms: st.palms, operations: st.operations, incidents: st.incidents });
        if (typeof enqueue === "function") enqueue("بلاغ سوسة ذكي", palm.code);
        if (typeof Api !== "undefined") {
          if (typeof Api.updatePalm === "function") Api.updatePalm(palm);
          if (typeof Api.createOperation === "function") Api.createOperation(op);
        }
        if (typeof AuditLog !== "undefined" && typeof AuditLog.log === "function") {
          AuditLog.log({
            action: "pest_incident",
            module: "ai",
            severity: "warning",
            title: `رصد سوسة النخيل (${palm.code})`,
            summary: `تم تحويل حالة النخلة إلى مصابة وتسجيل بلاغ مكافحة فوري بالرؤية الذكية`,
            details: { palmCode: palm.code, severity: pestDiagnosisResult.severity, pest: pestDiagnosisResult.pest_name },
            targetType: "palm",
            targetId: palm.id,
            user: session()?.user || "admin"
          });
        }
        if (typeof window.playPulseChime === "function") window.playPulseChime();
        if (typeof toast === "function") toast(`🚨 تم تحويل النخلة ${palm.code} إلى مصابة وتسجيل بلاغ مكافحة فوري!`);
        if (typeof render === "function") render();
      }
      return true;
    }

    // 6. تأكيد سلامة النخلة
    if (name === "ai-confirm-healthy-palm") {
      if (typeof toast === "function") toast("✓ تم توثيق النخلة كسليمة في السجل الدوري");
      return true;
    }

    // 7. نماذج تحاليل التربة
    if (name === "ai-preset-soil") {
      const preset = target?.getAttribute("data-preset");
      if (preset === "farafra_alkaline") {
        soilEc = "2.8"; soilPh = "8.1"; soilSar = "4.5"; soilN = "16"; soilP = "11"; soilK = "140"; soilCa = "85"; soilMg = "30";
      } else if (preset === "saline_water") {
        soilEc = "5.8"; soilPh = "7.9"; soilSar = "8.8"; soilN = "12"; soilP = "9"; soilK = "120"; soilCa = "120"; soilMg = "45";
      } else if (preset === "depleted_zero") {
        soilEc = "0"; soilPh = "0"; soilSar = "0"; soilN = "0"; soilP = "0"; soilK = "0"; soilCa = "0"; soilMg = "0";
      } else {
        soilEc = "1.8"; soilPh = "7.3"; soilSar = "2.8"; soilN = "24"; soilP = "18"; soilK = "190"; soilCa = "70"; soilMg = "25";
      }
      soilAnalysisResult = null;
      if (typeof render === "function") render();
      return true;
    }

    // 8. تشغيل تحليل التربة
    if (name === "ai-run-soil-analysis") {
      const getVal = (id, cur) => {
        const el = document.getElementById(id);
        if (!el) return cur;
        const v = el.value.trim();
        return v !== "" ? v : "0";
      };

      soilEc = getVal("ai_soil_ec", soilEc);
      soilPh = getVal("ai_soil_ph", soilPh);
      soilSar = getVal("ai_soil_sar", soilSar);
      soilN = getVal("ai_soil_n", soilN);
      soilP = getVal("ai_soil_p", soilP);
      soilK = getVal("ai_soil_k", soilK);
      soilCa = getVal("ai_soil_ca", soilCa);
      soilMg = getVal("ai_soil_mg", soilMg);
      soilSectorId = document.getElementById("ai_soil_sec")?.value || "";

      soilIsAnalyzing = true;
      if (typeof render === "function") render();

      try {
        let result = null;
        if (typeof Api !== "undefined" && typeof Api.analyzeLabReport === "function") {
          result = await Api.analyzeLabReport({
            ec: soilEc, ph: soilPh, sar: soilSar, n: soilN, p: soilP, k: soilK, ca: soilCa, mg: soilMg, sectorId: soilSectorId
          });
        }
        if (!result) {
          result = runLocalSoilAnalysis({
            ec: soilEc, ph: soilPh, sar: soilSar, n: soilN, p: soilP, k: soilK, ca: soilCa, mg: soilMg, sectorId: soilSectorId
          });
        }
        soilAnalysisResult = result;
        soilIsAnalyzing = false;
        if (typeof window.playPulseChime === "function") window.playPulseChime();
        if (typeof toast === "function") toast("🧪 تم إعداد التقرير التسميدي وتوزيع الجداول بنجاح");
      } catch (err) {
        soilIsAnalyzing = false;
        if (typeof toast === "function") toast("خطأ في التحليل: " + err.message);
      }
      if (typeof render === "function") render();
      return true;
    }

    // 9. اعتماد وإدراج خطة التسميد في العمليات
    if (name === "ai-commit-fertilizer-plan") {
      if (!soilAnalysisResult) return true;
      const st = Store.get();
      const secId = soilSectorId || (st.sectors?.[0]?.id || "S1");
      const secName = (st.sectors || []).find(s => s.id === secId)?.name || secId;

      const op = {
        id: Store.uid("op"),
        targetLevel: "sector",
        sectorId: secId,
        typeId: "op2",
        treeCount: 50,
        notes: `[برنامج تسميد آلي معتمد] ${soilAnalysisResult.acid_correction?.dosage || ''} • معادلة القلوية والـ NPK`,
        workerId: session()?.id || "u1",
        at: new Date().toISOString(),
        status: "pending",
        approval: "pending"
      };
      st.operations = st.operations || [];
      st.operations.unshift(op);
      Store.set({ operations: st.operations });
      if (typeof enqueue === "function") enqueue("تسميد معتمد", secName);
      if (typeof Api !== "undefined" && typeof Api.createOperation === "function") Api.createOperation(op);
      if (typeof AuditLog !== "undefined" && typeof AuditLog.log === "function") {
        AuditLog.log({
          action: "fertilizer_plan",
          module: "ai",
          severity: "info",
          title: `اعتماد خطة تسميد معملية لقطاع ${secName}`,
          summary: `تم إدراج جدول التسميد الدوري بناء على تحليل المعمل للتربة والمياه`,
          details: { sectorId: secId, ec: soilEc, ph: soilPh },
          targetType: "sector",
          targetId: secId,
          user: session()?.user || "admin"
        });
      }
      if (typeof window.playPulseChime === "function") window.playPulseChime();
      if (typeof toast === "function") toast(`📋 تم إدراج جدول التسميد كمهام لقطاع ${secName}!`);
      if (typeof render === "function") render();
      return true;
    }

    // 10. تبديل تسجيل الصوت (On/Off)

    // 10.1 إعادة تعيين ومسح المساعد الصوتي

    // 11. اختيار جملة صوتية جاهزة

    // 12. استخراج بيانات الصوت

    // 13. تأكيد وحفظ العملية الصوتية

    // 14. تسجيل صوتي للمستشار الزراعي
    if (name === "ai-chat-toggle-mic") {
      if (chatIsRecording) {
        stopLocalChatVoiceRecording();
      } else {
        startLocalChatVoiceRecording();
      }
      return true;
    }

    // 15. إرسال سؤال للمستشار الزراعي
    if (name === "ai-send-chat") {
      if (chatIsRecording) stopLocalChatVoiceRecording();
      const inputEl = document.getElementById("ai_chat_input");
      const query = inputEl?.value?.trim();
      if (!query) return true;
      inputEl.value = "";
      handleSendAgriChat(query);
      return true;
    }

    // 16. سؤال سريع جاهز للمستشار
    if (name === "ai-quick-question") {
      const q = target?.getAttribute("data-q");
      if (q) handleSendAgriChat(q);
      return true;
    }

    // 17. تغيير دور المستشار
    if (name === "ai-change-chat-role") {
      agriChatUserRole = target?.value || "engineer";
      return true;
    }

    // 18. ري قطعة محددة فقط بمقننها المائي الموصى به
    

    return false;
  }

  // =========================================================================
  // الوظائف المساعدة للمركز الذكي (Local Fallbacks & Speech Recog)
  // =========================================================================



  function startLocalChatVoiceRecording() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (typeof toast === "function") toast("⚠️ متصفحك الحالي لا يدعم التعرف الصوتي المباشر");
      return;
    }

    try {
      if (chatRecognitionInstance) {
        try { chatRecognitionInstance.stop(); } catch(e) {}
      }
      clearTimeout(chatSilenceTimeout);
      const recog = new SpeechRecognition();
      recog.lang = "ar-EG";
      recog.interimResults = true;
      recog.continuous = true;

      const resetChatSilence = () => {
        clearTimeout(chatSilenceTimeout);
        chatSilenceTimeout = setTimeout(() => {
          if (chatIsRecording) {
            stopLocalChatVoiceRecording();
          }
        }, 5500);
      };

      recog.onstart = () => {
        chatIsRecording = true;
        resetChatSilence();
        if (typeof render === "function") render();
      };

      recog.onresult = (ev) => {
        resetChatSilence();
        let transcript = "";
        for (let i = 0; i < ev.results.length; ++i) {
          transcript += ev.results[i][0].transcript + " ";
        }
        const el = document.getElementById("ai_chat_input");
        if (el) el.value = transcript.trim();
      };

      recog.onerror = (ev) => {
        clearTimeout(chatSilenceTimeout);
        chatIsRecording = false;
        if (typeof render === "function") render();
        if (ev.error !== "no-speech" && typeof toast === "function") {
          toast("ملاحظة صوتية: " + ev.error);
        }
      };

      recog.onend = () => {
        clearTimeout(chatSilenceTimeout);
        chatIsRecording = false;
        if (typeof render === "function") render();
      };

      chatRecognitionInstance = recog;
      recog.start();
    } catch (err) {
      clearTimeout(chatSilenceTimeout);
      chatIsRecording = false;
      if (typeof render === "function") render();
      if (typeof toast === "function") toast("تعذر تشغيل الميكروفون: " + err.message);
    }
  }

  function stopLocalChatVoiceRecording() {
    clearTimeout(chatSilenceTimeout);
    if (chatRecognitionInstance) {
      try { chatRecognitionInstance.stop(); } catch(e) {}
      chatRecognitionInstance = null;
    }
    chatIsRecording = false;
    if (typeof render === "function") render();
  }


  async function handleSendAgriChat(query) {
    const timeNow = new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
    agriChatHistory.push({ sender: "user", text: query, time: timeNow });
    agriChatIsLoading = true;
    if (typeof render === "function") render();
    scrollChatBottom();

    let botReply = null;
    try {
      if (typeof Api !== "undefined" && typeof Api.chatAgriAdvisor === "function") {
        const resp = await Api.chatAgriAdvisor({ message: query, role: agriChatUserRole });
        botReply = resp?.reply;
      }
      if (!botReply) {
        botReply = runLocalAgriChatAdvisor(query, agriChatUserRole);
      }
    } catch (err) {
      botReply = runLocalAgriChatAdvisor(query, agriChatUserRole);
    }

    agriChatIsLoading = false;
    agriChatHistory.push({
      sender: "bot",
      text: botReply,
      time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })
    });
    if (typeof window.playPulseChime === "function") window.playPulseChime();
    if (typeof render === "function") render();
    scrollChatBottom();
  }

  function scrollChatBottom() {
    setTimeout(() => {
      const box = document.getElementById("ai_chat_box");
      if (box) box.scrollTop = box.scrollHeight;
    }, 50);
  }

  // =========================================================================
  // المحركات المحلية للعمل أوفلاين (Local Rule-based Agronomic Engines)
  // =========================================================================
  function runLocalPestDiagnostics(desc = "", palmCode = "") {
    const text = (desc || "").toLowerCase();

    // 1. فحص خياس الطلع واللفحة السوداء واحتراق النورات الزهرية (Inflorescence Rot & Black Scorch)
    if (text.includes("طلع") || text.includes("خياس") || text.includes("احتراق") || text.includes("تفحم") || text.includes("إغريض") || text.includes("اغريض") || text.includes("كافور") || text.includes("شماريخ") || text.includes("نورة") || text.includes("نورات") || text.includes("scorch") || (text.includes("اسوداد") && (text.includes("طلع") || text.includes("نخل")))) {
      return {
        pest_detected: true,
        pest_name: "خياس الطلع واللفحة السوداء للنورات الزهرية",
        pest_latin: "Mauginiella scaettae / Thielaviopsis paradoxa",
        confidence: 96,
        severity: "critical",
        severity_label: "إصابة حرجة متقدمة",
        symptoms_identified: [
          "تفحم واحتراق الغلاف الزهري (الإغريض/الكافور) باللون البني المسود الجاف",
          "جفاف واحتراق الشماريخ الزهرية وموت الأزهار وحبوب اللقاح قبل الإخصاب",
          "امتداد الاسوداد الفطري لقواعد الكرب وأنسجة قلب النخلة المحيطة مع خطر تعفن الجمارة"
        ],
        diagnosis_summary: `تم رصد أعراض قطعية لمرض خياس الطلع الفطري واللفحة السوداء للنورات في النخلة ${palmCode || ''}. الإصابة خطيرة وتستوجب استئصال الطلع المصاب بالحرق والرش الفطري النحاسي العاجل خلال 24 ساعة لحماية القمة النامية (الجمارة) من الموت.`,
        treatment_protocol: {
          chemical_name: "هيدروكسيد النحاس 77% WP (كوسايد 2000) أو ثيوفانات الميثيل 70% (توبسين إم) أو دايفينوكونازول (سكور)",
          dosage: "250 جم نحاس كوسايد / 100 لتر ماء أو 100 جم توبسين إم / 100 لتر ماء",
          application_method: "استئصال ميكانيكي بالحرق + رش تاجي غامر بضغط عالي + تعفير بالكبريت الزراعي",
          steps: [
            "استئصال الأغاريض والطلع المحترق والمتفحم فوراً بآلة حادة معقمة ووضعه في أكياس محكمة وحرقه خارج المزرعة",
            "تطهير مكان القطع فوراً بمحلول هيبوكلوريت الصوديوم المخفف أو كحول طبي 70%",
            "رش تاجي غامر لقلب النخلة وتاج السعف بالكامل بالمبيد الفطري النحاسي بضغط 2.5 بار",
            "تعفير قلب النخلة بالكبريت الزراعي الناعم لامتصاص الرطوبة ومنع إنبات الأبواغ الفطرية مجدداً",
            "تنظيم وتخفيف الري وتجنب الرش المباشر على قمم الأشجار لتقليل الرطوبة في القلب"
          ]
        },
        recommended_action: "عزل النخلة فوراً في غرفة العمليات، استئصال الطلع المحترق وحرقه خارج الحقل، وتكليف فريق الوقاية بالرش الفطري خلال 24 ساعة."
      };
    }

    // 2. فحص سوسة النخيل الحمراء
    if (text.includes("سوسة") || text.includes("صمغ") || text.includes("نشارة") || text.includes("ثقب") || text.includes("إفراز") || text.includes("تآكل")) {
      const isCrit = text.includes("حرج") || text.includes("سقوط") || text.includes("شديد");
      return {
        pest_detected: true,
        pest_name: "سوسة النخيل الحمراء",
        pest_latin: "Rhynchophorus ferrugineus",
        confidence: isCrit ? 97 : 91,
        severity: isCrit ? "critical" : "early",
        severity_label: isCrit ? "إصابة حرجة متقدمة" : "إصابة مبكرة قابلة للعلاج",
        symptoms_identified: [
          "إفرازات صمغية لزجة بنية محمرة تسيل على الجذع",
          "نشارة خشبية رطبة برائحة التخمر ناتجة عن تغذية اليرقات",
          "ثقوب نخرية في الأنسجة الوعائية للجذع"
        ],
        diagnosis_summary: `رصد علامات مؤكدة لنشاط يرقات سوسة النخيل في النخلة ${palmCode}، تتطلب التدخل بالحقن الفوري خلال 24 ساعة.`,
        treatment_protocol: {
          chemical_name: "إيميداكلوبريد 20% SL أو كلوربيريفوس 48% EC",
          dosage: "3 سم³ لكل لتر ماء (محلول علاجي مركز)",
          application_method: "حقن الجذع المائل بمضخة الضغط العالي وسد الفتحات",
          steps: [
            "تنظيف مكان الإصابة وإزالة النشارة حتى ظهور النسيج الحي",
            "عمل ثقوب مائلة لأسفل بزاوية 45° وبعمق 15-20 سم فوق الإصابة",
            "حقن 2 إلى 3 لتر من المحلول المبيدي بضغط 2 بار حتى التشبع",
            "سد الثقوب فوراً بإسمنت أبيض مضاف إليه مبيد حشري أو طين زراعي معقم",
            "رش تاج النخلة وجذعها بالكامل بمحلول وقائي"
          ]
        },
        recommended_action: "عزل النخلة فوراً في غرفة العمليات، وتكليف فني المكافحة بالحقن خلال 24 ساعة."
      };
    }

    // 3. فحص حلم الغبار / الغبير
    if (text.includes("غبار") || text.includes("غبير") || text.includes("عنكبوت") || text.includes("نسيج") || text.includes("ثمار")) {
      return {
        pest_detected: true,
        pest_name: "حلم غبار النخيل (الغبير)",
        pest_latin: "Oligonychus afrasiaticus",
        confidence: 93,
        severity: "moderate",
        severity_label: "إصابة متوسطة",
        symptoms_identified: [
          "نسيج حريري يغطي الشماريخ والثمار",
          "تجمع ذرات الغبار على العراجين وتحول الثمار للرمادي",
          "تصلب قشرة البلح وتوقف امتلائها"
        ],
        diagnosis_summary: "إصابة أكاروسية بحلم الغبار ناتجة عن الحرارة المرتفعة والجفاف.",
        treatment_protocol: {
          chemical_name: "كبريت ميكروني 80% WP أو أبامكتين 1.8% EC",
          dosage: "250 جم كبريت / 100 لتر ماء",
          application_method: "غسيل العراجين ورش غامر من أعلى لأسفل",
          steps: [
            "غسيل العراجين بضغط ماء عالي لإزالة النسيج والأتربة",
            "الرش في الصباح الباكر أو بعد الغروب لتفادي حروق الشمس",
            "تكرار الرشة بعد 14 يوماً للفقس الجديد"
          ]
        },
        recommended_action: "تنفيذ رشة وقائية عاجلة للعراجين وتفقد الأشجار المجاورة."
      };
    }

    // 4. فحص حشرة دوباس النخيل والحشرات القشرية
    if (text.includes("دوباس") || text.includes("ندوة") || text.includes("عسلية") || text.includes("دبس") || text.includes("قشرية") || text.includes("عفن أسود")) {
      return {
        pest_detected: true,
        pest_name: "حشرة دوباس النخيل والحشرات القشرية",
        pest_latin: "Ommatissus lybicus / Parlatoria blanchardi",
        confidence: 94,
        severity: "moderate",
        severity_label: "إصابة متوسطة إلى شديدة",
        symptoms_identified: [
          "إفراز ندوة عسلية دبسية غزيرة على السعف والشماريخ",
          "تكون فطر العفن الأسود الدخاني على السطح العلوي للجريد",
          "اصفرار السعف وتدني كفاءة البناء الضوئي وتشوه الثمار"
        ],
        diagnosis_summary: `إصابة حشرية نشطة بحشرة الدوباس والحشرات القشرية في النخلة ${palmCode || ''}. يلزم الرش التاجي الفوري لمنع الإجهاد وسقوط المحصول.`,
        treatment_protocol: {
          chemical_name: "ثياميثوكسام 25% WG (أكتارا) أو أسيتامبريد 20% SP مع مادة ناشرة",
          dosage: "60 جم ثياميثوكسام / 100 لتر ماء",
          application_method: "رش تاجي عالي الضغط يغطي قلب النخلة والسعف بالكامل",
          steps: [
            "الرش في الصباح الباكر أو عند الغروب لتفادي درجات الحرارة العالية",
            "غسيل النخيل بضغط ماء عالي بعد أسبوع من الرش لإزالة الندوة العسلية والعفن الأسود",
            "تكرار الرش بعد 15 يوماً في حال رصد أطوار حورية جديدة"
          ]
        },
        recommended_action: "إصدار أمر رش تاجي لقطاع الإصابة بالكامل وتطهير السعف المحيط."
      };
    }

    // 5. فحص لفحة السعف وتعفن القمة النامية (البلعوم)
    if (text.includes("بلعوم") || text.includes("جمارة") || text.includes("موت القمة") || text.includes("تعفن القمة") || text.includes("لفحة") || text.includes("فطر") || text.includes("عفن")) {
      return {
        pest_detected: true,
        pest_name: "تعفن القمة النامية (البلعوم) ولفحة السعف",
        pest_latin: "Thielaviopsis paradoxa / Fusarium oxysporum",
        confidence: 90,
        severity: "critical",
        severity_label: "إصابة فطرية حرجة",
        symptoms_identified: [
          "بقع بنية إلى سوداء غائرة على قواعد السعف والشماريخ الزهرية",
          "موت أطراف السعف القلبي الحديث وانحناؤه بشكل غير طبيعي",
          "جفاف الأزهار والطلع قبل تفتحه"
        ],
        diagnosis_summary: "إصابة فطرية تنتقل عبر جروح التقليم والتكريب غير المعقمة في الأجواء الرطبة.",
        treatment_protocol: {
          chemical_name: "أوكسي كلورور النحاس 50% WP أو ثيوفانات الميثيل 70%",
          dosage: "300 جم / 100 لتر ماء",
          application_method: "رش موضعي وصب مباشر لمنطقة القمة وقواعد السعف المصابة",
          steps: [
            "استئصال الأجزاء المصابة بشفرات معقمة بالكحول",
            "طلاء أماكن الجروح بعجينة بوردو (كبريتات نحاس + جير حي + ماء)",
            "رش وسكب المبيد النحاسي على قلب النخلة بالكامل"
          ],
          quarantine_needed: true
        },
        recommended_action: "تقليم الأجزاء المتعفنة، تطهير أدوات التقليم، وتطبيق محلول نحاسي غامر."
      };
    }

    // 6. فحص عام لأي أعراض مرضية أو تلف (Safety Catch لمنع أي تصنيف خاطئ كسليم)
    if (text.includes("مرض") || text.includes("إصابة") || text.includes("تلف") || text.includes("موت") || text.includes("اسوداد") || text.includes("اصفرار") || text.includes("جفاف") || text.includes("ذبول") || text.includes("سواد") || text.includes("كسر") || text.includes("تشوه")) {
      return {
        pest_detected: true,
        pest_name: "اشتباه إصابة مرضية أو فسيولوجية غير محددة",
        pest_latin: "Suspected Pathological / Physiological Disorder",
        confidence: 85,
        severity: "suspected",
        severity_label: "اشتباه إصابة (تستوجب المعاينة)",
        symptoms_identified: [
          "أعراض غير اعتيادية تم رصدها بالوصف أو الصورة تستوجب التدقيق",
          "تغير في لون الأنسجة أو جفاف موضعي لا يتطابق مع النخيل السليم"
        ],
        diagnosis_summary: `النخلة ${palmCode || ''} تظهر عليها مؤشرات إجهاد أو اشتباه إصابة فطرية/حشرية بناء على البلاغ المدخل (${desc}). يوصى بعدم تثبيتها كسليمة وإرسال فني الوقاية لمعاينتها ميدانياً.`,
        treatment_protocol: {
          chemical_name: "محلول وقائي فطري نحاسي عام (أوكسي كلورور النحاس 50%)",
          dosage: "250 جم / 100 لتر ماء",
          application_method: "رش موضعي وقائي للأنسجة المتأثرة",
          steps: [
            "معاينة النخلة عن قرب وفحص قواعد السعف والقلب والعرجون",
            "أخذ عينة نباتية إن لزم الأمر للفحص المعملي",
            "تطبيق رشة وقائية عامة لحين صدور التقرير النهائي"
          ]
        },
        recommended_action: "تكليف المهندس الزراعي بالمعاينة الميدانية خلال 48 ساعة وعدم تأكيد سلامة النخلة حتى التأكد."
      };
    }

    // الحالة السليمة الافتراضية (فقط عند خلو الوصف من أي أعراض مرضية)
    return {
      pest_detected: false,
      pest_name: "أنسجة سليمة وطبيعية",
      pest_latin: "Phoenix dactylifera - Healthy",
      confidence: 95,
      severity: "healthy",
      severity_label: "سليمة ومعافاة",
      symptoms_identified: [
        "جذع متماسك وخالٍ من الإفرازات الصمغية أو النشارة",
        "ليف طبيعي وقواعد سعف خضراء نشطة"
      ],
      diagnosis_summary: `النخلة ${palmCode} في حالة صحية ممتازة وخالية من الإصابات الحشرية الثاقبة.`,
      treatment_protocol: {
        chemical_name: "غير مطلوب (استمرار البرنامج الوقائي)",
        dosage: "تعفير بالكبريت الزراعي عند التكريب",
        application_method: "متابعة دورية كل 15 يوماً"
      },
      recommended_action: "تثبيت حالة النخلة كسليمة في المنظومة."
    };
  }

  function parseLabNumLocal(val, def = 0) {
    if (val === undefined || val === null) return def;
    const s = String(val).trim();
    if (s === '') return def;
    const n = parseFloat(s);
    return isNaN(n) ? def : n;
  }

  function runLocalSoilAnalysis(params) {
    const ec = parseLabNumLocal(params.ec, 2.5);
    const ph = parseLabNumLocal(params.ph, 7.8);
    const sar = parseLabNumLocal(params.sar, 4.2);
    const n = parseLabNumLocal(params.n, 18);
    const p = parseLabNumLocal(params.p, 12);
    const k = parseLabNumLocal(params.k, 140);
    const ca = parseLabNumLocal(params.ca, 85);
    const mg = parseLabNumLocal(params.mg, 35);

    // 1. الملوحة EC
    let ecStatus = "طبيعية ومثالية";
    let ecBadge = "ok";
    if (ec === 0) { ecStatus = "منعدمة (ماء مقطر/تربة مغسولة)"; ecBadge = "ok"; }
    else if (ec > 8.0) { ecStatus = "مرتفعة جداً وحرجة (تراكم أملاح خطير)"; ecBadge = "danger"; }
    else if (ec > 4.0) { ecStatus = "مرتفعة (تتطلب غسيل 18%)"; ecBadge = "warn"; }
    else if (ec > 2.5) { ecStatus = "متوسطة ومتحملة للنخيل"; ecBadge = "ok"; }
    else { ecStatus = "منخفضة ومثالية جداً"; ecBadge = "ok"; }

    // 2. القلوية pH
    let phStatus = "متعادلة ومثالية";
    let phBadge = "ok";
    if (ph === 0) { phStatus = "قيمة صفرية (غير مقاسة)"; phBadge = "warn"; }
    else if (ph > 8.2) { phStatus = "قلوية شديدة (تثبت الفسفور والحديد)"; phBadge = "danger"; }
    else if (ph >= 7.6) { phStatus = "قلوية خفيفة إلى متوسطة (شائعة بالواحات)"; phBadge = "warn"; }
    else if (ph >= 6.5) { phStatus = "متعادلة ومثالية للنخيل"; phBadge = "ok"; }
    else if (ph >= 5.5) { phStatus = "حمضية خفيفة (تيسير جيد للعناصر)"; phBadge = "ok"; }
    else { phStatus = "حمضية شديدة غير معتادة"; phBadge = "danger"; }

    // 3. الصوديوم SAR
    let sarStatus = "آمن ومثالي";
    let sarBadge = "ok";
    if (sar === 0) { sarStatus = "منعدم (0) - خالية تماماً من صوديوم التربة"; sarBadge = "ok"; }
    else if (sar > 9.0) { sarStatus = "مرتفع وخطر (تربة صودية متدهورة)"; sarBadge = "danger"; }
    else if (sar >= 6.0) { sarStatus = "متوسط الخطورة (يحتاج جبس زراعي)"; sarBadge = "warn"; }
    else { sarStatus = "آمن ومثالي (لا خطر من الصودية)"; sarBadge = "ok"; }

    // 4. النيتروجين N
    let nStatus = "متوسط ومتوازن";
    let nBadge = "ok";
    if (n === 0) { nStatus = "منعدم (0) - فقر حرج بالنيتروجين"; nBadge = "danger"; }
    else if (n < 15) { nStatus = "منخفض جداً (عجز واضح)"; nBadge = "danger"; }
    else if (n < 25) { nStatus = "منخفض ويحتاج دعم"; nBadge = "warn"; }
    else if (n <= 45) { nStatus = "كافٍ ومتوازن"; nBadge = "ok"; }
    else { nStatus = "مرتفع وفائض (يجب تخفيف التسميد)"; nBadge = "ok"; }

    // 5. الفوسفور P
    let pStatus = "كافٍ وميسر";
    let pBadge = "ok";
    if (p === 0) { pStatus = "منعدم (0) - فقر حاد بالفسفور"; pBadge = "danger"; }
    else if (p < 10) { pStatus = "منخفض جداً ومثبت بالقلوية"; pBadge = "danger"; }
    else if (p < 20) { pStatus = "منخفض (يحتاج تنشيط)"; pBadge = "warn"; }
    else if (p <= 35) { pStatus = "كافٍ وميسر"; pBadge = "ok"; }
    else { pStatus = "مرتفع وغني"; pBadge = "ok"; }

    // 6. البوتاسيوم K
    let kStatus = "جيد ومتوازن";
    let kBadge = "ok";
    if (k === 0) { kStatus = "منعدم (0) - عجز حرج بالبوتاسيوم"; kBadge = "danger"; }
    else if (k < 100) { kStatus = "منخفض جداً (خطر على تحجيم التمر)"; kBadge = "danger"; }
    else if (k < 180) { kStatus = "متوسط ويحتاج دعم"; kBadge = "warn"; }
    else if (k <= 280) { kStatus = "جيد ومتوازن"; kBadge = "ok"; }
    else { kStatus = "مرتفع وغني"; kBadge = "ok"; }

    // 7. الكالسيوم Ca
    let caStatus = "جيد";
    let caBadge = "ok";
    if (ca === 0) { caStatus = "منعدم (0) - عجز كالسيوم حرج"; caBadge = "danger"; }
    else if (ca < 50) { caStatus = "منخفض (يحتاج نترات كالسيوم)"; caBadge = "warn"; }
    else if (ca <= 150) { caStatus = "جيد ومثالي لجدران الخلايا"; caBadge = "ok"; }
    else { caStatus = "مرتفع (ماء كلسي عسر)"; caBadge = "warn"; }

    // 8. المغنيسيوم Mg
    let mgStatus = "جيد";
    let mgBadge = "ok";
    if (mg === 0) { mgStatus = "منعدم (0) - عجز مغنيسيوم حرج"; mgBadge = "danger"; }
    else if (mg < 20) { mgStatus = "منخفض (ضعف في تمثيل الكلوروفيل)"; mgBadge = "warn"; }
    else if (mg <= 60) { mgStatus = "جيد ومتوازن للسعف"; mgBadge = "ok"; }
    else { mgStatus = "مرتفع"; mgBadge = "warn"; }

    // حساب المعاملات الديناميكية
    const nFactor = n === 0 ? 1.85 : (n < 15 ? 1.5 : (n < 25 ? 1.2 : (n > 45 ? 0.65 : 1.0)));
    const phFixation = (ph >= 7.8) ? 1.25 : 1.0;
    const pFactor = (p === 0 ? 1.9 : (p < 10 ? 1.55 : (p < 20 ? 1.25 : (p > 35 ? 0.75 : 1.0)))) * phFixation;
    const kFactor = k === 0 ? 1.85 : (k < 100 ? 1.5 : (k < 180 ? 1.2 : (k > 280 ? 0.75 : 1.0)));
    const caBonus = ca === 0 ? 1.9 : ((ec > 4 || sar > 6 || ca < 50) ? 1.4 : 1.0);
    const mgFactor = mg === 0 ? 1.8 : (mg < 20 ? 1.35 : 1.0);

    let acidPlan = "";
    let acidDosage = "";
    if (ph > 8.2) {
      acidPlan = "⚠️ قلوية شديدة وجيرية: حقن حامض كبريتيك 98% تجاري بالتبادل مع حامض فسفوريك 85% لخفض الـ pH وتحرير الفسفور والمغذيات الصغرى المثبتة.";
      acidDosage = "3.5 لتر حامض كبريتيك + 3.0 لتر حامض فسفوريك لكل فدان أسبوعياً عبر شبكة التنقيط.";
    } else if (ph >= 7.6) {
      acidPlan = "حقن حامض فسفوريك 85% وحامض كبريتيك أسبوعياً لمعادلة القلوية وتيسير امتصاص الفسفور في منطقة الجذور.";
      acidDosage = "2.5 لتر حامض فسفوريك + 2.5 لتر حامض كبريتيك تجاري لكل فدان أسبوعياً عبر شبكة التنقيط.";
    } else if (ph > 0 && ph < 6.0) {
      acidPlan = "التربة حامضية بطبيعتها: الامتناع عن حقن أحماض إضافية، وينصح بالري بماء متعادل لتفادي هبوط الـ pH أكثر.";
      acidDosage = "إيقاف الأحماض واستخدام نترات الكالسيوم لمعادلة الحموضة.";
    } else if (ph === 0) {
      acidPlan = "لم يتم تحديد قراءة الـ pH بدقة: استخدام المعدلات الوقائية لتسليك النقاطات فقط.";
      acidDosage = "1.0 لتر حامض فسفوريك لكل فدان كل 15 يوماً للتسليك الوقائي.";
    } else {
      acidPlan = "حموضة التربة مثالية ومتعادلة: استخدام الأحماض بالمعدلات الوقائية الاعتيادية لتسليك النقاطات.";
      acidDosage = "1.0 لتر حامض فسفوريك لكل فدان كل 15 يوماً.";
    }

    let phDesc = ph === 0 ? "قراءة pH صفرية/غير محددة" : (ph > 7.8 ? `قلوية (${ph})` : (ph < 6.8 ? `حمضية (${ph})` : `تفاعل متعادل (${ph})`));
    let ecDesc = ec === 0 ? "ملوحة منعدمة (0 dS/m)" : `ملوحة (${ec} dS/m)`;
    let summaryText = `تحليل عينة القطاع ${params.sectorId || 'الميداني'}: ${phDesc} و${ecDesc}.`;
    if (n === 0 || p === 0 || k === 0) {
      summaryText += ` ⚠️ تم رصد انعدام لبعض العناصر الكبرى (0 mg/kg) وتم رفع المقننات الاستدراكية بالجدول للحد الأقصى لإنقاذ الأشجار.`;
    } else {
      summaryText += ` تم بناء خطة التسميد ديناميكياً لخفض تأثير القلوية وتعظيم امتصاص العناصر الكبرى.`;
    }

    let waterNote = "";
    if (ec > 8.0) {
      waterNote = "🚨 تحذير: ملوحة حرجة جداً! يلزم زيادة مياه الري بمقدار 25-30% كمعامل غسيل (Leaching Fraction) مع استخدام مضادات ملوحة وحقن جبس زراعي سائل لطرد الصوديوم.";
    } else if (ec > 4.0) {
      waterNote = "ينصح بزيادة مقنن ماء الري بمقدار 18% كمعامل غسيل (Leaching Fraction) لتفادي تراكم الأملاح في حزام الجذور الفعال.";
    } else if (ec === 0) {
      waterNote = "قراءة الملوحة صفرية: المياه خالية تماماً من الأملاح ولا تتطلب معاملات غسيل إضافية.";
    } else {
      waterNote = "نظام الري الحالي متوازن مع الاحتياجات المائية للنخيل وجودة التربة.";
    }

    return {
      source: "local_agri_lab_engine",
      summary: summaryText,
      metrics: {
        ec: { value: ec, unit: "dS/m", status: ecStatus, badge: ecBadge },
        ph: { value: ph, unit: "pH", status: phStatus, badge: phBadge },
        sar: { value: sar, unit: "SAR", status: sarStatus, badge: sarBadge },
        nitrogen: { value: n, unit: "mg/kg", status: nStatus, badge: nBadge },
        phosphorus: { value: p, unit: "mg/kg", status: pStatus, badge: pBadge },
        potassium: { value: k, unit: "mg/kg", status: kStatus, badge: kBadge },
        calcium: { value: ca, unit: "mg/L", status: caStatus, badge: caBadge },
        magnesium: { value: mg, unit: "mg/L", status: mgStatus, badge: mgBadge }
      },
      acid_correction: {
        strategy: acidPlan,
        dosage: acidDosage
      },
      seasonal_plan: [
        {
          stage: "مرحلة النشاط الربيعي والتزهير (فبراير - أبريل)",
          focus: "بناء المجموع الخضري وتنشيط الجذور وخروج الطلع",
          nitrogen_kg_feddan: Math.round(22 * nFactor),
          phosphorus_kg_feddan: Math.round(14 * pFactor),
          potassium_kg_feddan: Math.round(15 * kFactor),
          calcium_kg_feddan: Math.round(10 * caBonus),
          magnesium_kg_feddan: Math.round(5 * mgFactor),
          recommended_fertilizers: [
            ph > 7.8 ? "سلفات نشادر 20.6% ن (تفضيلية لخفض قلوية التربة)" : "نترات نشادر 33.5% ن",
            p === 0 ? "⚠️ حقن عاجل لحامض الفسفوريك 85% لتعويض فقر الفسفور الحاد" : "حامض فسفوريك 85% فوسفور ميسر سريع الامتصاص",
            ca === 0 ? "⚠️ حقن نترات كالسيوم لتأسيس الجذور وتفادي انهيار الأنسجة" : "نترات كالسيوم لتنشيط الجذور البيضاء الجديدة"
          ]
        },
        {
          stage: "مرحلة عقد وتضخم الثمار (مايو - يوليو)",
          focus: "زيادة حجم ووزن الثمار ومنع التشقق والتساقط",
          nitrogen_kg_feddan: Math.round(16 * nFactor),
          phosphorus_kg_feddan: Math.round(8 * pFactor),
          potassium_kg_feddan: Math.round(45 * kFactor),
          calcium_kg_feddan: Math.round(16 * caBonus),
          magnesium_kg_feddan: Math.round(8 * mgFactor),
          recommended_fertilizers: [
            k === 0 ? "⚠️ تكثيف حقن سلفات البوتاسيوم 50% لمنع ضمور وفشل تحجيم الثمار" : (ec > 4 ? "سلفات بوتاسيوم ذوابة نقية 50% (خالية من الكلور)" : "سلفات بوتاسيوم 50% K2O (حقن أسبوعي)"),
            "نترات كالسيوم وبورون لرش العراجين وتدعيم جدران الخلايا",
            mg === 0 ? "⚠️ حقن سلفات مغنيسيوم لمعالجة الشلل اليخضوري" : "سلفات مغنيسيوم لتحفيز كفاءة التمثيل الضوئي في السعف"
          ]
        },
        {
          stage: "مرحلة النضج وبداية الرطب (أغسطس - سبتمبر)",
          focus: "رفع نسبة السكريات وتحسين الملمس ولون التمر",
          nitrogen_kg_feddan: Math.round(6 * (n > 30 ? 0.6 : (n === 0 ? 1.5 : 1.0))),
          phosphorus_kg_feddan: Math.round(4 * pFactor),
          potassium_kg_feddan: Math.round(30 * kFactor),
          calcium_kg_feddan: Math.round(5 * caBonus),
          magnesium_kg_feddan: Math.round(4 * mgFactor),
          recommended_fertilizers: [
            "سلفات بوتاسيوم نقية قابلة للذوبان",
            n > 30 ? "تخفيف النيتروجين تدريجياً لتفادي الرطوبة العالية وتلف التمر" : "تسميد بوتاسي متوازن لإنضاج التمور"
          ]
        },
        {
          stage: "الخدمة الشتوية وراحة الأشجار (أكتوبر - يناير)",
          focus: "تدفئة الجذور وتغذية التربة للموسم القادم",
          nitrogen_kg_feddan: Math.round(12 * nFactor),
          phosphorus_kg_feddan: Math.round(25 * pFactor),
          potassium_kg_feddan: Math.round(10 * kFactor),
          calcium_kg_feddan: Math.round(20 * caBonus),
          magnesium_kg_feddan: Math.round(10 * mgFactor),
          recommended_fertilizers: [
            "سماد عضوي نباتي/حيواني متحلل بالكامل (كومبوست خالي من النيماتودا)",
            p === 0 ? "⚠️ مضاعفة دفعة سوبر فوسفات الكالسيوم الثلاثي 46% في خنادق الخدمة" : "سوبر فوسفات الكالسيوم الثلاثي 46% (دفن في خنادق الخدمة)",
            ph > 7.8 ? "كبريت زراعي ناعم 95% (35 كجم/فدان) لخفض قلوية التربة" : "كبريت زراعي وقائي"
          ]
        }
      ],
      water_management_note: waterNote
    };
  }


  function runLocalAgriChatAdvisor(query = "", role = "engineer") {
    const text = query.toLowerCase();

    // 1. شهر أكتوبر والخدمة الشتوية للنخيل والزيتون
    if (text.includes("اكتوبر") || text.includes("أكتوبر") || text.includes("شهر 10") || text.includes("تشرين الاول") || text.includes("تشرين الأول") || text.includes("خدمة شتوية") || (text.includes("حقل") && (text.includes("اكتوبر") || text.includes("أكتوبر") || text.includes("شتاء")))) {
      return `📅 **خطة وإجراءات الحقل المعتمدة لشهر أكتوبر (تشرين الأول) لمزارع النخيل والزيتون:**
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
   - رش وقائي فوري بعد الجلسة بهيدروكسيد النحاس لوقاية الجروح من بكتيريا التدرن وفطر عين الطاووس (*Spilocaea oleaginea*).`;
    }

    // 2. العمليات الحقلية العامة (بدون تحديد شهر محدد)
    if (text.includes("اجراءات الحقل") || text.includes("إجراءات الحقل") || text.includes("عمليات الحقل") || text.includes("أعمال الحقل") || text.includes("شغل الحقل") || text.includes("جدول العمليات")) {
      return `📋 **العمليات الحقلية العاجلة الموصى بها في الحقل حالياً (موسم الخريف / بداية الشتاء):**
بناءً على التوقيت الحالي لمزارع الواحات (نهاية سبتمبر وبداية أكتوبر)، تتلخص أولويات الحقل فيما يلي:

1. **الانتهاء التام من حصاد وفرز التمور:** تطهير أحواض النخيل وجمع التمور المتساقطة وإخراجها خارج المزرعة لقطع دورة حياة دودة البلح وخنافس الثمار.
2. **بدء فتح خنادق الخدمة الشتوية:** تجهيز الكومبوست المعقم (50-70 كجم/شجرة) والسوبر فوسفات والكبريت الزراعي للردم خلال أكتوبر ونوفمبر.
3. **الفحص الوقائي الدقيق لسوسة النخيل:** فحص قواعد الجذوع بعد إزالة الحشائش لرصد أي إفراز صمغي مبكر قبل اشتداد برودة الشتاء.
4. **تعديل برنامج الري بالتنقيط:** تقليل ساعات التشغيل ومعدلات الضخ تدريجياً لتناسب انكسار درجات الحرارة.
5. **تقليم وتطهير الجروح:** إزالة السعف اليابس وتكريب النخيل والرش الوقائي الفوري بالنحاس.

💡 *يمكنك سؤالي بالتفصيل عن أي شهر تريده، مثل: «إجراءات شهر أكتوبر»، «تسميد شهر سبتمبر»، أو «تلقيح شهر مارس».*`;
    }

    // 3. استفسار التسميد لشهر سبتمبر / الخريف
    if (text.includes("سبتمبر") || text.includes("أيلول") || text.includes("شهر 9")) {
      return `🌿 **برنامج وتوصيات التسميد لشهر سبتمبر (أيلول):**
يعتبر شهر سبتمبر مرحلة استكمال جني التمور وبداية استعداد الأشجار للراحة:
1. **إيقاف التسميد النيتروجيني تماماً:** يُمنع إضافة أي أسمدة آزوتية لتفادي خروج نموات خضراء غضة تتلف بصقيع الشتاء.
2. **التركيز على سلفات البوتاسيوم (K₂SO₄):** حقن 500-750 جم/نخلة لصلابة الأنسجة وتخزين السكريات.
3. **حقن حامض الفوسفوريك 85%:** بمعدل 1.5-2 لتر/فدان أسبوعياً لتنشيط الشعيرات الجذرية الماصة وخفض قلوية التربة.
4. **الرش الورقي بالعناصر الصغرى:** رش عناصر مخلبية (حديد، زنك، منجنيز، بورون) لتعزيز كفاءة البناء الضوئي ومناعة الأشجار.
5. **تنظيم وتخفيف الري:** تقليل كميات الري تدريجياً بنسبة 15-20% مع اعتدال الحرارة.`;
    }

    // 4. أشهر الشتاء (نوفمبر، ديسمبر، يناير)
    if (text.includes("نوفمبر") || text.includes("ديسمبر") || text.includes("يناير") || text.includes("شهر 11") || text.includes("شهر 12") || text.includes("شهر 1") || text.includes("الصقيع")) {
      return `❄️ **إجراءات الحقل في أشهر الشتاء وسكون الأشجار (نوفمبر - يناير):**
1. **استكمال ردم خنادق الخدمة الشتوية:** إنهاء التسميد العضوي والكبريت والفوسفات قبل منتصف يناير.
2. **تقليم بساتين الزيتون:** التقليم التكويني والإثماري لفتح قلب الشجرة للشمس والتهوية وإزالة الأفرع المتشابكة والمصابة.
3. **الرش الوقائي الشتوي العام:** رش النخيل والزيتون بخليط (زيت معدني شتوي 1.5% + هيدروكسيد النحاس 250 جم/100 لتر) للقضاء على الحشرات القشرية الساكنة وجراثيم الفطريات.
4. **حماية الفسائل الحديثة من الصقيع:** تغطية وتكييس قلوب الفسائل الصغيرة بالخيش أو سعف النخيل لحمايتها من لسعات البرد الشديد.
5. **المباعدة بين فترات الري:** الري على فترات متباعدة ويفضل أن يكون في الصباح لتفادي تجمد المياه حول الجذور.`;
    }

    // 5. أشهر الربيع والطلع والتلقيح (فبراير ومارس)
    if (text.includes("فبراير") || text.includes("مارس") || text.includes("شهر 2") || text.includes("شهر 3") || text.includes("تلقيح") || text.includes("تأبير") || text.includes("طلع") || text.includes("حبوب لقاح")) {
      return `🌾 **دليل عمليات التلقيح وخروج الطلع (فبراير ومارس):**
1. **متابعة انفتاح الأغاريض الزهرية (الطلع):** الفحص اليومي للقمم النامية لجمع أكمام الطلع المذكر بمجرد تشققها.
2. **تجفيف وإعداد حبوب اللقاح:** تجفيف الشماريخ المذكرة في غرف مظللة مهواة على ورق نظيف، وتجنب تعريضها للشمس المباشرة أو الرطوبة.
3. **التوقيت الذهبي للتلقيح المؤنث:** التلقيح خلال **24 إلى 72 ساعة** من انفتاح الإغريض المؤنث (بين الساعة 10 صباحاً و 3 عصراً في يوم مشمس غير ممطر ولا عاصف).
4. **طريقة التلقيح:** وضع 5-7 شماريخ مذكرة مقلوبة في قلب العرجون المؤنث وربطه بخوصة خفيفة سهلة التحلل.
5. **الوقاية من خياس الطلع:** تعفير قلب النخلة بالكبريت الميكروني ورش مبيد فطري نحاسي خفيف عند وجود رطوبة أو ضباب لتفادي موت الأزهار.`;
    }

    // 6. أشهر الصيف والخف والتحجيم (أبريل إلى يوليو)
    if (text.includes("ابريل") || text.includes("أبريل") || text.includes("مايو") || text.includes("يونيو") || text.includes("يوليو") || text.includes("شهر 4") || text.includes("شهر 5") || text.includes("شهر 6") || text.includes("شهر 7") || text.includes("تكييس") || text.includes("تحجيم")) {
      return `☀️ **إجراءات موسم الصيف والتحجيم والتكييس (أبريل - يوليو):**
1. **خف وتدلية عراجين المجدول (مايو):** إبقاء 8-10 عراجين للنخلة، إزالة 25-30% من الشماريخ الداخلية، وتقصير الأطراف 10-15% للوصول لحجم ثمار جامبو.
2. **تكثيف التسميد البوتاسي والكالسيوم (مايو - يونيو):** حقن سلفات البوتاسيوم 50% ونترات الكالسيوم وبورون لتعظيم حجم الخلايا ومنع تشقق الثمار.
3. **تكييس العراجين (يونيو - يوليو):** تغطية العراجين بأكياس شبكية زرقاء أو بيضاء مهواة (Agryl) لحمايتها من الطيور، حلم الغبار، ولسعات الشمس.
4. **مكافحة حلم الغبار (الغبير):** رش كبريت ميكروني 80% أو مبيد أورتس وقائياً بمجرد رؤية أي نسيج عنكبوتي.
5. **المقنن المائي:** رفع كميات الري إلى 180-220 لتر/نخلة يومياً مع التبكير بالتشغيل (صباحاً ومساءً).`;
    }

    // 7. خياس الطلع واللفحة السوداء
    if (text.includes("خياس") || text.includes("احتراق الطلع") || text.includes("تفحم") || text.includes("لفحة سوداء") || text.includes("عفن النورات") || text.includes("اسوداد الطلع") || text.includes("موت الطلع")) {
      return `🚨 **بروتوكول التعامل العاجل مع خياس الطلع واللفحة السوداء للنورات (*Mauginiella scaettae* / *Thielaviopsis paradoxa*):**
1. **الاستئصال الميكانيكي الفوري بالحرق:** قطع كافة الأغاريض والشماريخ المتفحمة والمحترقة بآلة حادة معقمة، ووضعها داخل أكياس محكمة وحرقها خارج المزرعة تماماً لمنع تطاير الجراثيم الفطرية.
2. **تطهير الجروح:** مسح مكان القطع فوراً بكحول طبي 70% أو هيبوكلوريت مخفف.
3. **الرش الفطري التاجي الغامر بضغط عالي (2.5 بار):**
   - رش قلب النخلة بمبيد **هيدروكسيد النحاس 77% WP (كوسايد 2000)** بمعدل 250 جم/100 لتر ماء.
   - أو **ثيوفانات الميثيل 70% (توبسين إم)** بمعدل 100 جم/100 لتر ماء.
4. **التعفير بالكبريت:** تعفير قلب النخلة وقواعد الكرب بالكبريت الزراعي الناعم لامتصاص الرطوبة وتثبيط إنبات الأبواغ.
5. **الري:** منع الرش العلوي للماء وتخفيف الري لخفض الرطوبة النسبية في قلب النخلة.`;
    }

    // 8. سوسة النخيل الحمراء
    if (text.includes("سوسة") || text.includes("حقن") || text.includes("نشارة") || text.includes("صمغ")) {
      if (role === "worker") {
        return `🚨 **طريقة التعامل السريعة مع سوسة النخيل في الحقل:**
1. **لا تهز النخلة** أو تجرحها بعنف.
2. نظف مكان النشارة والصمغ بملعقة التقليم حتى تصل للخشب النظيف.
3. اعمل فتحتين بمثقاب (شنيور) مائل لتحت بزاوية 45 درجة فوق مكان الصمغ بـ 10 سم.
4. احقن مبيد الإيميداكلوبريد أو الكلوربيريفوس المخفف حتى يخرج المحلول من الفتحة.
5. اقفل الفتحات فوراً بجبس أو أسمنت مخلوط بمبيد لمنع خروج الحشرة أو تعفن الجرح.
6. بلغ المهندس وسجل العملية فوراً في التطبيق.`;
      }
      if (role === "investor") {
        return `🌴 **إحاطة استثمارية بشأن سوسة النخيل:**
سوسة النخيل الحمراء خطر رئيسي ولكن لدينا **بروتوكول دفاع استباقي** في المزرعة:
- فحص دوري بالكاميرات والرصد الذكي كل 14 يوماً لاكتشاف الإصابة في الطور المبكر قبل أي ضرر هيكلي.
- نسبة الشفاء عند التدخل المبكر تتجاوز **98%** دون أي تأثير على إنتاجية النخلة الموسمية.
- نطبق مصائد فيرمونية واستقصاء رقمي للقطاعات لحماية أصولك بالكامل.`;
      }
      return `🧪 **البروتوكول الفني المعتمد لعلاج سوسة النخيل الحمراء (*Rhynchophorus ferrugineus*):**
1. **المبيدات الموصى بها:**
   - *إيميداكلوبريد 20% SL*: بتركيز 3 إلى 5 سم³ لكل لتر ماء (جهازي عالي الكفاءة).
   - *كلوربيريفوس 48% EC*: بتركيز 5 سم³ لكل لتر ماء (ملامسة وتبخير للقضاء الفوري على اليرقات).
2. **آلية الحقن الموضعي:**
   - ثقب بميل 45° باتجاه الأسفل، قطر 12-16 مم، عمق 15-20 سم.
   - حقن 2-3 لتر من المحلول المبيدي بضغط 2 بار باستخدام حواقن مانعة للارتجاع.
   - إحكام سد الثغرات بمعجون وقائي يحتوي على أوكسي كلورور النحاس وجبس.
3. **التوثيق:** تحويل حالة النخلة إلى "مصابة" مع إعادة الفحص التأكيدي بعد 21 يوماً للتحقق من جفاف الإفرازات الصمغية.`;
    }

    // 9. حلم الغبار (الغبير) والعناكب
    if (text.includes("غبار") || text.includes("غبير") || text.includes("حلم") || text.includes("عنكبوت")) {
      return `🕸️ **بروتوكول مكافحة حلم الغبار (الغبير - *Oligonychus afrasiaticus*):**
1. **التشخيص:** نسيج حريري عنكبوتي دقيق يغطي الثمار والشماريخ تتراكم عليه الأتربة، مما يؤدي لتصلب قشرة البلح وتلونها باللون البني الصدئي وفقدان المحصول.
2. **المكافحة الوقائية:** تعفير العراجين بالكبريت الزراعي الناعم في مرحلة "الجمري" قبل اشتداد الحرارة.
3. **المكافحة العلاجية الفورية:**
   - رش تاجي بمبيد أ كاروسي متخصص: **فينبيروكسيميت 5% EC (أورتس)** بمعدل 50 سم³/100 لتر ماء، أو **أبامكتين 1.8% EC** بمعدل 40 سم³/100 لتر مع مادة لاصقة وناشرة.
   - يراعى توجيه البشبوري لغسيل الثمار والشماريخ من الداخل بضغط عالي.`;
    }

    // 10. أشجار الزيتون (جفاف، فيرتيسيليوم، تقليم، أصناف)
    if (text.includes("زيتون") || text.includes("فيرتيسيليوم") || text.includes("عين الطاووس") || text.includes("ذبابة الزيتون")) {
      return `🫒 **الدليل الشامل لإدارة وحماية أشجار الزيتون في الأراضي الصحراوية:**
1. **مرض ذبول الفيرتيسيليوم (*Verticillium dahliae*):**
   - العرض: جفاف مفاجئ لفرع كامل وتظل الأوراق جافة ملتصقة بالأفرع مع اسمرار الحزم الوعائية.
   - العلاج: قص الأفرع الجافة حتى النسيج السليم وتعقيم المقصات، ومعاملة التربة بمبيد فطري جهازي (ثيوفانات الميثيل 70% بمعدل 2-3 جم/شجرة) ورش نحاسي للمجموع الخضري.
2. **جفاف واحتراق قمم الأوراق:** ينتج غالباً عن ملوحة التربة (EC > 3.5) أو تذبذب الري؛ العلاج: حقن طاردات أملاح معتمدة على الكالسيوم وحامض النيتريك وتنظيم فترات الري.
3. **ذبابة ثمار الزيتون (*Bactrocera oleae*):** نشر مصائد فيرمونية وجاذبات غذائية (داي أمونيوم فوسفات) والرش الجزئي بمبيد سبينوساد عند اصطياد 3-5 حشرات/مصيدة/أسبوع.
4. **التسميد الشتوي للزيتون:** إضافة 20-30 كجم كومبوست + 500 جم سوبر فوسفات + 500 جم كبريت زراعي للشجرة في خنادق الخدمة خلال شهري أكتوبر ونوفمبر.`;
    }

    // 11. أعراض نقص العناصر والتسميد NPK
    if (text.includes("نقص") || text.includes("بوتاسيوم") || text.includes("تسميد") || text.includes("سماد") || text.includes("npk") || text.includes("حديد") || text.includes("اصفرار")) {
      return `🍂 **تشخيص وعلاج نقص العناصر الغذائية في النخيل:**
1. **نقص البوتاسيوم ($K$):** بقع برتقالية أو صفراء على السعف المسن تليها حروق نخرية في القمم. العلاج: حقن سلفات بوتاسيوم 50% بمعدل 500-750 جم/شجرة أسبوعياً، ورش نترات بوتاسيوم 2% ورقي.
2. **نقص النيتروجين ($N$):** اصفرار وشحوب عام يبدأ بالسعف القديم مع توقف السعف الجديد. العلاج: سلفات نشادر 20.6% ن في الأراضي القلوية.
3. **نقص الفسفور ($P$):** تحول السعف القديم إلى الأخضر القاتم أو الأرجواني مع ضعف الجذور. العلاج: حقن حامض فسفوريك 85%.
4. **نقص الحديد والزنك (بسبب قلوية الواحات $pH > 7.8$):** اصفرار ناصع بين عروق السعف القلبي الحديث. العلاج: حقن شيلات حديد Fe-EDDHA (50-70 جم/نخلة) مع مياه الري.`;
    }

    // 12. الفسائل والغرس والزراعة
    if (text.includes("فسائل") || text.includes("فسيلة") || text.includes("غرس") || text.includes("زراعة نخل") || text.includes("مسافات")) {
      return `🌱 **المعايير المعتمدة لغرس وفصل فسائل النخيل (المجدول والسيوي):**
1. **مواصفات الفسيلة المثالية:** وزن 15 إلى 25 كجم، عمر 3-5 سنوات، تمتلك مجموعاً جذرياً نامياً، وخالية تماماً من أعراض سوسة النخيل.
2. **الفصل والمعاملة الوقائية:** الفصل بعتلة حادة بواسطة فني خبير، تسوية موضع الفصل وقصه برفق، ثم غمس قواعد الفسائل في محلول هرمون تجذير (IBA) ومبيد فطري نحاسي وحشري قبل الزراعة بنصف ساعة.
3. **أبعاد الجور والغرس:** حفر الجور بأبعاد (1×1×1 متر)، ردم النصف السفلي بخلطة كومبوست معقم ورمل وطمي، وغرس الفسيلة بحيث يكون أكبر قطر لها بمستوى سطح التربة مع حماية القلب من دخول الماء.
4. **مسافات الغرس:** 8×8 متر (65 نخلة/فدان) أو 10×10 متر في صنف المجدول لمنع تزاحم التاج.
5. **الري:** ري يومي خفيف ومستمر خلال أول 40-50 يوماً حتى خروج أول سعفة جديدة.`;
    }

    // 13. التقليم والتكريب
    if (text.includes("تقليم") || text.includes("تكريب") || text.includes("قص سعف") || text.includes("تجريد")) {
      return `✂️ **القواعد الفنية لتقليم وتكريب النخيل:**
1. **الموعد الأمثل:** من أكتوبر حتى نهاية ديسمبر (عقب انتهاء الجني وقبل خروج الطلع الجديد).
2. **المعايير البستانية:**
   - الحفاظ على نسبة توازن خضري مثالي (لا يقل عن 8 إلى 10 سعفات خضراء نشطة لكل عرجون مرتقب، أي حوالي 80-100 سعفة على النخلة البالغة).
   - إزالة السعف الجاف والمصاب فقط، وتجنب الجور في التقليم لأن السعف الأخضر هو مصنع الكربوهيدرات والسكريات.
3. **التكريب:** تسوية الكرب بزاوية مائلة قليلاً للخارج لتفادي تجمع مياه الأمطار أو الرطوبة.
4. **الوقاية الإلزامية:** تعقيم أدوات التقليم بين نخلة وأخرى، ورش الجذع فوراً بمبيد نحاسي وحشري وقائي لمنع انجذاب سوسة النخيل للجروح الرطبة الحديثة.`;
    }

    // 14. الري والمقننات المائية
    if (text.includes("ري") || text.includes("ماء") || text.includes("مياه") || text.includes("عطش") || text.includes("تنقيط") || text.includes("نقاطات")) {
      return `💧 **دليل الري وإدارة المقننات المائية لنخيل التمر بالواحات:**
1. **المقنن المائي الفصلي للنخلة البالغة:**
   - في الصيف الحار (يونيو - أغسطس): **180 إلى 220 لتر/نخلة/يوم**.
   - في الخريف والربيع (أبريل - مايو، سبتمبر - أكتوبر): **100 إلى 140 لتر/نخلة/يوم**.
   - في الشتاء (نوفمبر - فبراير): **40 إلى 60 لتر/نخلة/يوم**.
2. **تصميم شبكة الري بالتنقيط:**
   - حلقة ري دائرية بقطر 1.5 - 2 متر حول الجذع مزودة بـ **4 إلى 6 نقاطات** تصريف 8 أو 16 لتر/ساعة ذاتية التنظيم والضغط (PC).
   - إبعاد النقاطات عن ملامسة الجذع بمسافة لا تقل عن 50 سم لتفادي ركود الماء وظهور أعفان الساق وسوسة النخيل.
3. **معامل غسيل الأملاح (Leaching Fraction):** زيادة كميات مياه الري بنسبة 15-20% أسبوعياً في حال تجاوز ملوحة التربة أو مياه البئر 3.5 dS/m.`;
    }

    // 15. الرد الاستشاري المتخصص الذكي (بدلاً من تكرار الترحيب)
    return `🌴 **استشارة زراعية ميدانية متخصصة:**
بشأن استفسارك عن: «**${query}**»؛

توصيات الإدارة الفنية المعتمدة للمزرعة في هذا الشأن:
1. **التوافق الموسمي:** التأكد من ملاءمة المعاملة للتوقيت المناسب لمرحلة نمو الأشجار الحالية (موسم الخريف وبداية الخدمة الشتوية).
2. **المعايير الوقائية:** اتباع الإجراءات الوقائية المعتمدة لمكافحة الآفات وفحص قواعد الأشجار باستمرار.
3. **توازن التغذية:** تنظيم الري وتخفيف الأسمدة الآزوتية في هذه الفترة والاعتماد على الكومبوست المعقم والبوتاسيوم والفسفور.

💡 *يمكنك سؤالي بدقة أكبر عن أي موضوع، مثل: «إجراءات شهر أكتوبر»، «بروتوكول سوسة النخيل»، «علاج خياس الطلع»، «جدول التسميد»، أو «جفاف أوراق الزيتون».*`;
  }

  // تصدير للنافذة العامة
  window.aiHubView = aiHubView;
  window.handleAiHubAction = handleAiHubAction;
  window.renderAgriSettingsTab = renderAgriSettingsTab;
  window.AgriAIHub = {
    getActiveTab: () => aiActiveTab,
    setActiveTab: (t) => { aiActiveTab = t; }
  };

  // ضغط الصور تلقائياً لمنع إجهاد الذاكرة في المتصفحات
  function compressImage(file, maxDimension = 900, quality = 0.72) {
    return new Promise((resolve) => {
      if (!file || !file.type || !file.type.startsWith("image/") || file.type.includes("svg")) {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
        return;
      }

      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      };
      img.src = url;
    });
  }

  async function processPestImageFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    const remainingSlots = Math.max(0, 3 - pestImages.length);
    const filesToProcess = files.slice(0, remainingSlots);

    if (!filesToProcess.length) {
      if (typeof toast === "function") toast("الحد الأقصى المسموح به هو 3 صور لكل فحص.");
      return;
    }

    for (const file of filesToProcess) {
      try {
        const compressedBase64 = await compressImage(file);
        if (compressedBase64) {
          pestImages.push({
            preview: compressedBase64,
            base64: compressedBase64
          });
        }
      } catch (err) {
        console.warn("Error compressing image:", err);
      }
    }
    pestDiagnosisResult = null;
    if (typeof render === "function") render();
  }

  // مستمع لاختيار ملفات الصور بالكاميرا أو المعرض (يدعم حتى 3 صور مع الضغط الذكي)
  document.addEventListener("change", async function (e) {
    if (e.target && (e.target.id === "ai_pest_image_file" || e.target.id === "ai_pest_add_more")) {
      const files = e.target.files;
      await processPestImageFiles(files);
      // إعادة ضبط قيمة الإدخال ليسمح برفع نفس الصورة مجدداً إن أراد المستخدم
      e.target.value = "";
    }
  });

  // دعم السحب والإفلات للصور
  document.addEventListener("dragover", function (e) {
    const dropzone = e.target.closest("#ai_image_dropzone");
    if (dropzone) {
      e.preventDefault();
      dropzone.style.borderColor = "#10B981";
      dropzone.style.background = "#ECFDF5";
    }
  });

  document.addEventListener("dragleave", function (e) {
    const dropzone = e.target.closest("#ai_image_dropzone");
    if (dropzone) {
      dropzone.style.borderColor = "#CBD5E1";
      dropzone.style.background = "#F8FAFC";
    }
  });

  document.addEventListener("drop", async function (e) {
    const dropzone = e.target.closest("#ai_image_dropzone");
    if (dropzone && e.dataTransfer && e.dataTransfer.files) {
      e.preventDefault();
      dropzone.style.borderColor = "#CBD5E1";
      dropzone.style.background = "#F8FAFC";
      await processPestImageFiles(e.dataTransfer.files);
    }
  });

})(window);
