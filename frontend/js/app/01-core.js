// PalmTrace app — Shared UI state, formatting helpers, permissions, crops, navigation
// (split from the former single app.js; files are classic scripts loaded in order by index.html)

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const t = (k, def) => (typeof I18n !== "undefined" && I18n.t ? I18n.t(k, def) : (def || k));
let dashYear = String(new Date().getFullYear());
let dashSector = null, dashPlot = null, dashOpType = null, dashCrop = "all";
let usersPage = "groups";
let usersGroup = "worker";
let usersTab = "list", userSegmentTab = (function(){ try { return localStorage.getItem("palm_users_segment_tab") || "all"; } catch(_) { return "all"; } })(), userQ = "", userRoleF = "", userSecF = "", userActF = "", userPage = 1, editRoleId = "";
const selectedPalmIds = new Set();
let reportFrom = "", reportTo = "";
let reportKind = "ops";
let reportSec = "", reportPlot = "", reportSt = "", reportCrop = "all", reportInvestor = "", reportPage = 1;
let reportUser = "", reportFert = "", reportAction = "", reportFertKind = "", reportStockStatus = "", reportOpType = "";
let reportNsStage = "all", reportNsSource = "all", reportYieldQuality = "all", reportTreeSt = "all";
let zakatCropTab = "all", zakatFormCrop = "palm";
let zakatAdminTab = "kpi";
let zakatSeason = "2026";
let showBroadcastZakatModal = false;
let showNewSeasonModal = false;
let zakatInvSearch = "", zakatInvPlot = "all", zakatInvStatus = "all", zakatInvCharity = "all", zakatInvPage = 1, zakatInvSize = 5;
const zakatSelectedInvIds = new Set();
let showCharityModal = false, editCharityId = null;
let showBatchModal = false;
let showSignedDocModal = false, signedDocModalData = null;
let showCertModal = false, certInvestorId = null, certBatchId = null;
let showPrintPledgeModal = false, printPledgeInvestorId = null;
let earlyWarningCrop = "all";
let earlyWarningRiskFilter = "all";
let showEarlyWarningRuleModal = false, editingEarlyWarningRuleId = null;
let showEarlyWarningSopModal = false, sopTargetRuleId = null;
let showStockCheckModal = false, stockCheckTargetRuleId = null;
let showOrderFromEarlyWarningModal = false, orderTargetRuleId = null;
let showNotifyInvestorsEarlyWarningModal = false, notifyTargetRuleId = null;
let feedCategoryFilter = "all";
let feedSectorFilter = "all";
let feedSearchQuery = "";
let activeDrawerEventId = null;
let feedNewItemsCount = 0;
let feedLastCheckTimestamp = Date.now();
let lastFeedKnownOpCount = 0;
let feedPageLimit = 25;
let showDashKpiModal = false;
let showSeasonModal = false, rolloverSeasonYear = null;
let showAuditRevertModal = false, revertTargetRecordId = null;
let lastPulseChimePlayedAt = 0;

function playPulseChime() {
  try {
    if (typeof localStorage !== "undefined" && localStorage.getItem("palmtrace_pulse_muted") === "true") return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;
    
    // Tone 1: Gentle Pure Sine 659.25 Hz (E5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.exponentialRampToValueAtTime(0.05, now + 0.03);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.48);

    // Tone 2: Gentle Pure Sine 987.77 Hz (B5) delayed by 120ms
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(987.77, now + 0.12);
    gain2.gain.setValueAtTime(0.0001, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.06, now + 0.16);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.75);

    setTimeout(() => {
      try { ctx.close(); } catch(e) {}
    }, 1200);
  } catch (e) {
    // Ignore audio errors gracefully (e.g., autoplay restrictions)
  }
}
window.playPulseChime = playPulseChime;

function triggerPulseNotification(count) {
  if (!count || count <= 0) return;
  const now = Date.now();
  if (now - lastPulseChimePlayedAt < 4000) return; // Debounce batch events within 4s window
  lastPulseChimePlayedAt = now;
  playPulseChime();
}
window.triggerPulseNotification = triggerPulseNotification;

function getZakatSeasons(st) {
  const s = st || Store.get();
  const fromZakat = (s.zakat || []).map(z => String(z.season)).filter(Boolean);
  const fromBatches = (s.zakatBatches || []).map(b => String(b.season)).filter(Boolean);
  const fromYields = (s.yields || []).map(y => String(y.season)).filter(Boolean);
  const curYear = String(new Date().getFullYear());
  const nextYear = String(new Date().getFullYear() + 1);
  const all = [...new Set([...fromZakat, ...fromBatches, ...fromYields, curYear, nextYear, "2025", "2026", "2027", "2028"])].filter(Boolean);
  all.sort((a, b) => b.localeCompare(a));
  return all;
}

function getYieldsSeasons(st) {
  const s = st || Store.get();
  const fromYields = (s.yields || []).map(y => String(y.season)).filter(Boolean);
  const fromZakat = (s.zakat || []).map(z => String(z.season)).filter(Boolean);
  const curYear = String(new Date().getFullYear());
  const nextYear = String(new Date().getFullYear() + 1);
  const all = [...new Set([...fromYields, ...fromZakat, curYear, nextYear, "2025", "2026", "2027", "2028"])].filter(Boolean);
  all.sort((a, b) => b.localeCompare(a));
  return all;
}

function maskName(name) {
  if (!name) return "مستثمر مشارك";
  const parts = String(name).trim().split(/\s+/);
  return parts.map(p => {
    if (p.length <= 2) return p.slice(0, 1) + "*";
    if (p.length <= 4) return p.slice(0, 2) + "**";
    return p.slice(0, 3) + "***";
  }).join(" ");
}

function maskPhone(phone) {
  if (!phone) return "—";
  const str = String(phone).trim();
  if (str.length < 7) return "****";
  return str.slice(0, 3) + "****" + str.slice(-2);
}
let palmPage = 1, PAGE = (typeof localStorage !== "undefined" && parseInt(localStorage.getItem("palmPageSize"), 10)) || 20;
let showPrintScopeModal = false, printScopeSec = "all", printScopePlot = "all", printScopeCrop = "all";
let editingSectorId = null, deletingSectorId = null;
let editingInvestorId = null, editingInvestorData = null, showInvestorContractModal = false;
let editingContractSubForm = null, contractDraftPlots = [];
let showContractTplModal = false, editingContractTplId = null;
let editingPlotId = null, editingPlotData = null, showPlotEditModal = false, plotEditActiveTab = "general", plotEditCorners = [];
let lastGenCount = 0;
let browseSec = null, browsePlotGroup = null, browsePlot = null, palmQ = "";
let nurseryTab = "rooting", nSec = null, nPlot = null, nBatch = null, showBuyForm = false, buyCropSel = "palm", nurseryIntakeMode = "opening";
let selectedOffshootIds = new Set(), activeNurseryRowMenuId = null, showCullModal = false, cullTargetIds = [], showCullReportModal = false, showBarcodeModal = false, barcodePrintIds = [], nurserySearchQ = "";
let editingFertId = null;
let voucherRecipientId = null;
let fertVoucherSortCol = "date", fertVoucherSortDir = "desc";
let nurserySortCol = "date", nurserySortDir = "desc";
let fastOpPalmId = null, fastOpSelectedType = null;
let nHideEmpty = true, nPlotQ = "";
let nStage = "all", nQ = "", showDispenseModal = false, dispenseOsIds = [], dispQ = "", dispStatusF = "all", dispUserF = "all", dispCropF = "all";
let opsPage = 1, opsSize = 50, opsQ = "", opsSec = "", opsPlot = "", opsType = "", opsSt = "", opsRange = "all", opsCrop = "", opsCritOnly = false, opsContextInitializedForUser = null;
let opsOpen = null, opsSortCol = "at", opsSortDir = "desc", showOpsAdvancedFilters = false, opsSelectedIds = new Set();
let palmSortCol = "code", palmSortDir = "asc";
let opsAdminTab = "ops", showScheduleForm = false, editScheduleId = null, activeScheduleId = null, showOpsPlotPickModal = false;
let schFilterCrop = "all", schFilterSec = "all", schFilterStatus = "all", schPlotScope = "all", schPlotSec = "", schPlotSearch = "", schSelectedPlots = new Set(), schDraft = null;
let palmTab = "over", palmEdit = false, palmMore = false;
let bulkCrop = "all", bulkPlotSec = "", bulkPlotSearch = "", palmNewCrop = "palm", palmNewSuckerCode = "", genSelectedCrop = "palm", genLastSector = "", nurseryCropFilter = "all", yieldCropFilter = "all", yieldRegCrop = "palm", yieldPlotSearch = "", yieldTableSearch = "", yieldTableSec = "all", yieldTableQuality = "all", yieldsSeason = "2026", yieldSelectedPlots = new Set(), reportVariety = "", showYieldNewSeasonModal = false, showYieldModal = false, activeYieldDetailsId = null;
let i18nEditLang = "en", i18nCat = "all", i18nQuery = "", i18nShowImportModal = false;
let _projectSwitcherOpen = false, saasConsoleTab = "companies", showNewProjectModal = false, showNewCompanyModal = false, showSuperAdminGatewayModal = false;
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function parsePhotos(photos) {
  if (!photos) return [];
  if (Array.isArray(photos)) return photos;
  if (typeof photos === "string") {
    const trimmed = photos.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return trimmed ? [trimmed] : [];
  }
  return [];
}

function copyFallback(text, successMsg) {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (ok && successMsg) toast(successMsg);
  } catch (e) {
    console.warn("copyFallback error:", e);
    if (successMsg) toast(successMsg);
  }
}

let scanStream = null, scanTimer = null;
async function startQrScan() {
  const modal = $("#scanModal"), video = $("#scanVid");
  if (!modal || !video) return toast("افتح شاشة المسح أولاً");
  modal.classList.remove("hidden");
  const modalInp = $("#modalScanInput");
  if (modalInp) {
    modalInp.value = "";
    modalInp.focus();
    modalInp.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const v = modalInp.value.trim();
        if (v) applyScannedCode(v);
      }
    };
  }
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    video.srcObject = scanStream;
    await video.play();
    if ("BarcodeDetector" in window) {
      const det = new BarcodeDetector({ formats: ["qr_code", "code_128", "code_39", "ean_13"] });
      const tick = async () => {
        if (!scanStream) return;
        try {
          const codes = await det.detect(video);
          if (codes[0]?.rawValue) { applyScannedCode(codes[0].rawValue); return; }
        } catch {}
        scanTimer = setTimeout(tick, 280);
      };
      tick();
    } else {
      toast("المتصفح لا يدعم كاشف الكاميرا التلقائي — يمكنك كتابة الكود أدناه");
    }
  } catch {
    toast("تعذر تشغيل الكاميرا — يمكنك كتابة الكود يدوياً");
  }
}
function stopQrScan() {
  if (scanTimer) clearTimeout(scanTimer);
  scanTimer = null;
  if (scanStream) scanStream.getTracks().forEach(t => t.stop());
  scanStream = null;
  $("#scanModal")?.classList.add("hidden");
}
function applyScannedCode(raw) {
  stopQrScan();
  const rawClean = String(raw || "").trim();
  if (!rawClean) return;
  if (current === "palm-new") {
    if ($("#nsuckerq")) $("#nsuckerq").value = rawClean;
    fillSuckerHint();
    return;
  }
  if (current === "bulk-op") {
    const p = Store.get().palms.find(x => codesEqual(x.code, rawClean) || normCode(x.code).includes(normCode(rawClean)));
    if (!p) return toast("الكود غير معروف: " + rawClean);
    selectedPalmIds.add(p.id); bulkMode = "picks"; toast("أُضيفت " + p.code); render(); return;
  }
  const st = Store.get();
  const p = st.palms.find(x => codesEqual(x.code, rawClean) || normCode(x.code).includes(normCode(rawClean)) || String(x.id) === rawClean);
  if (!p) return toast("الكود غير معروف: " + rawClean);
  if (session().role === "worker" && !workerAllowed(p.plot, p.id)) return toast("خارج صلاحيتك — هذه الشجرة خارج قطعك المسندة");
  toast("✓ تم فتح بطاقة الشجرة: " + p.code);
  go("palm", p.id);
}
function fillSuckerHint() {
  const code = ($("#nsuckerq")?.value || "").trim();
  const box = $("#suckerHint");
  if (!box) return;
  if (!code) { box.textContent = ""; return; }
  const s = suckerByCode(code);
  if (!s) { box.textContent = "لا فسيلة جاهزة بهذا الكود"; return; }
  const plant = $("#ndate")?.value;
  const nurseryAge = s.offshootDate ? monthsSince(s.offshootDate, plant) : 0;
  if ($("#nvar")) { $("#nvar").value = s.variety || $("#nvar").value; $("#nvar").disabled = true; }
  box.innerHTML = `تم الجلب: الصنف <b>${s.variety||"—"}</b> • الأم <b>${s.motherCode||"—"}</b> • القلع <b>${s.offshootDate||"—"}</b> • عمر المشتل <b>${nurseryAge}</b> شهر`;
}
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.style.display = "block";
  setTimeout(() => t.style.display = "none", 2400);
}
function monthsSince(dateStr, until) {
  if (!dateStr) return 0;
  const start = new Date(dateStr);
  if (isNaN(start.getTime())) return 0;
  const now = until ? new Date(until) : new Date();
  if (isNaN(now.getTime())) return 0;
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}
function palmAges(p) {
  const field = monthsSince(p.plantDate);
  const nursery = p.nurseryAgeMonths != null && p.nurseryAgeMonths !== ""
    ? +p.nurseryAgeMonths
    : (p.offshootDate ? monthsSince(p.offshootDate, p.plantDate) : 0);
  return { nursery, field, total: nursery + field };
}
function fmtDate(d) {
  if (!d) return "—";
  const x = new Date(d);
  return isNaN(x) ? d : x.toLocaleDateString("ar-EG");
}
function fmtTime(d) {
  if (!d) return "—";
  const x = new Date(d);
  return isNaN(x) ? "" : x.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function fmtDateTime(d) {
  if (!d) return "—";
  const x = new Date(d);
  if (isNaN(x.getTime())) return d;
  return x.toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" }) + " " + x.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function money(n) {
  const s = Store.get().settings;
  return `${(+n || 0).toLocaleString("ar-EG")} ${s.currencyName || s.currency}`;
}
function typeName(id) { return Store.get().operationTypes.find(t => t.id === id)?.name || id; }
function opMaterialRule(typeId) {
  const t = Store.get().operationTypes.find(x => x.id === typeId);
  if (!t) return { show: false, kinds: [], label: "المركب" };
  if (t.requiresMaterial === false) return { show: false, kinds: [], label: "المركب" };
  if (t.requiresMaterial === true) {
    const kinds = t.allowedKinds?.length ? t.allowedKinds : ["عضوي","كيميائي","عناصر صغرى","أحماض أمينية","مخصب","مبيد"];
    const pest = kinds.includes("مبيد") && !kinds.some(k => k.includes("عضوي") || k.includes("كيميائي") || k.includes("عناصر") || k.includes("أحماض") || k.includes("مخصب"));
    return { show: true, kinds, label: pest ? "المبيد / المركب المستخدم" : "المركب / السماد" };
  }
  const n = (t.name || "") + " " + catName(t.catId);
  if (/تقليم|تكريب|تلقيح|تكييس|كسر|ري إضافي|خدمة شتوية/.test(n)) return { show: false, kinds: [], label: "المركب" };
  if (/سوسة|رش|مكافحة|إصابة|ذبابة/.test(n)) return { show: true, kinds: ["مبيد"], label: "المبيد / المركب المستخدم" };
  if (/عناصر صغرى|عناصر/.test(n)) return { show: true, kinds: ["عناصر صغرى"], label: "المركب / السماد" };
  if (/أحماض أمينية|احماض|محفز/.test(n)) return { show: true, kinds: ["أحماض أمينية"], label: "المركب / السماد" };
  if (/مخصب|معالجة تربة|هيوميك/.test(n)) return { show: true, kinds: ["مخصب"], label: "المركب / السماد" };
  if (/تسميد عضوي/.test(n)) return { show: true, kinds: ["عضوي"], label: "المركب / السماد" };
  if (/تسميد كيميائي|تسميد كيماوي/.test(n)) return { show: true, kinds: ["كيميائي"], label: "المركب / السماد" };
  if (/تسميد/.test(n)) return { show: true, kinds: ["عضوي","كيميائي","عناصر صغرى","أحماض أمينية","مخصب"], label: "المركب / السماد" };
  return { show: false, kinds: [], label: "المركب" };
}
function materialOptionsHtml(kinds) {
  const allFerts = (Store.get().fertilizers || []).filter(f => f.active !== false);
  const matching = (!kinds?.length) ? allFerts : allFerts.filter(f => kinds.includes(f.kind));
  const other = (!kinds?.length) ? [] : allFerts.filter(f => !kinds.includes(f.kind));

  if (!allFerts.length) return `<option value="">لا توجد أسمدة أو مركبات مسجلة</option>`;

  let html = "";
  if (matching.length) {
    const groupLabel = kinds?.length ? `المركبات المطابقة (${kinds.join(" • ")})` : "كافة المواد المتاحة";
    html += `<optgroup label="${groupLabel}">` + matching.map(f => `<option value="${f.name}">${f.name} (${f.kind} — ${f.unit})</option>`).join("") + `</optgroup>`;
  }
  if (other.length) {
    html += `<optgroup label="أصناف ومركبات أخرى بالمخزن">` + other.map(f => `<option value="${f.name}">${f.name} (${f.kind} — ${f.unit})</option>`).join("") + `</optgroup>`;
  }
  return html || `<option value="">لا مواد مطابقة</option>`;
}
function paintMaterialFields(typeId, wrapId) {
  const rule = opMaterialRule(typeId);
  const wrap = $(wrapId || "#bmatwrap");
  if (!wrap) return;
  wrap.style.display = rule.show ? "" : "none";
  const lab = wrap.querySelector("[data-mlabel]");
  if (lab) lab.textContent = rule.label;
  const sel = wrap.querySelector("select");
  if (sel && rule.show) sel.innerHTML = materialOptionsHtml(rule.kinds);
}
function plotBaseId(p) {
  if (!p) return "";
  if (typeof p === "object" && p.sector && p.plotNo) return `${p.sector}-${p.plotNo}`;
  const raw = typeof p === "string" ? p : (p.plot || p.plot_id || p.plotId || p.id || "");
  const id = String(raw).trim();
  return id.replace(/[A-Za-z]+$/, "");
}
function plotBaseNumber(p) {
  if (!p) return "";
  if (typeof p === "object" && p.plotNo) return String(p.plotNo).padStart(2, "0");
  const raw = typeof p === "string" ? p : (p.plot || p.plot_id || p.plotId || p.id || "");
  const s = String(raw).trim();
  const m = s.match(/^(?:.*-)?(\d+)[A-Za-z]?$/);
  if (m) return m[1].padStart(2, "0");
  const m2 = s.match(/^(.*?)_?[A-Za-z]$/);
  return m2 ? m2[1] : s;
}
function plotName(id) {
  if (!id) return "—";
  if (id.startsWith("base:")) {
    const bId = id.slice(5);
    const st = Store.get();
    const subs = st.plots.filter(p => p.id.startsWith(bId) || plotBaseId(p) === bId);
    const subParts = subs.map(p => p.part || p.id.replace(bId, "")).filter(Boolean).join(", ");
    return `القطعة ${plotBaseNumber(bId)} (كافة الأجزاء${subParts ? ': ' + subParts : ''})`;
  }
  return Store.get().plots.find(p => p.id === id)?.name || id;
}
function sectorName(id) { return Store.get().sectors.find(s => s.id === id)?.name || ("قطاع " + id); }

function normalizeSectorCode(code) {
  if (!code) return '';
  let cleaned = String(code).trim().toUpperCase().replace(/\s+/g, '');
  cleaned = cleaned.replace(/([A-Z\u0600-\u06FF]+)(\d+)$/, (match, prefix, num) => `${prefix}${num.padStart(2, '0')}`);
  if (/^\d+$/.test(cleaned)) cleaned = cleaned.padStart(2, '0');
  return cleaned;
}

function normalizePlotCode(code) {
  if (!code) return '';
  let cleaned = String(code).trim().toUpperCase().replace(/\s+/g, '');
  if (cleaned.includes('-')) {
    const parts = cleaned.split('-');
    const secPart = normalizeSectorCode(parts[0]);
    const rest = parts.slice(1).map(p => normalizePlotCode(p)).join('-');
    return `${secPart}-${rest}`;
  }
  const m = cleaned.match(/^(\d+)([A-Z\u0600-\u06FF]*)$/);
  if (m) return `${m[1].padStart(2, '0')}${m[2] || ''}`;
  return cleaned;
}

function normalizePalmCode(code) {
  if (!code) return '';
  let cleaned = String(code).trim().toUpperCase().replace(/\s+/g, '');
  const parts = cleaned.split('-');
  if (parts.length >= 4) {
    const sec = normalizeSectorCode(parts[0]);
    const plot = normalizePlotCode(parts[1]);
    const rest = parts.slice(2).join('-');
    return `${sec}-${plot}-${rest}`;
  } else if (parts.length === 3) {
    const sec = normalizeSectorCode(parts[0]);
    const plot = normalizePlotCode(parts[1]);
    return `${sec}-${plot}-${parts[2]}`;
  }
  return cleaned;
}
function userBy(id) { return Store.get().users.find(u => u.id === id); }
function company() { return Store.get().settings || {}; }
function brandHtml() {
  const c = company();
  const logo = c.logo ? `<img class="co-logo" src="${c.logo}" alt="">` : `<div class="logo mini">🌴</div>`;
  return `<div class="brand-inline">${logo}<div><b>${c.companyName || "نظام النخيل"}</b></div></div>`;
}

function updateAppFavicon(logoUrl) {
  try {
    const stLogo = (typeof Store !== "undefined" && Store.get) ? (Store.get().settings?.logo || "") : "";
    const effectiveLogo = (logoUrl !== undefined && logoUrl !== null && String(logoUrl).trim().length > 0) 
      ? String(logoUrl).trim() 
      : (stLogo && stLogo.trim().length > 0 ? stLogo.trim() : "./icons/icon.svg");

    let link = document.getElementById("appFavicon") || document.querySelector("link[rel*='icon']");
    if (!link) {
      link = document.createElement("link");
      link.id = "appFavicon";
      link.rel = "icon";
      document.head.appendChild(link);
    }
    if (link.getAttribute("href") !== effectiveLogo) {
      link.href = effectiveLogo;
      link.type = (effectiveLogo.startsWith("data:image/svg") || effectiveLogo.endsWith(".svg")) ? "image/svg+xml" : "image/png";
    }

    let appleLink = document.getElementById("appAppleIcon") || document.querySelector("link[rel='apple-touch-icon']");
    if (!appleLink) {
      appleLink = document.createElement("link");
      appleLink.id = "appAppleIcon";
      appleLink.rel = "apple-touch-icon";
      document.head.appendChild(appleLink);
    }
    if (appleLink.getAttribute("href") !== effectiveLogo) {
      appleLink.href = effectiveLogo;
    }
  } catch (e) { console.warn("updateAppFavicon error:", e); }
}

function isYieldZakatDelegated(y, st, season) {
  if (!y) return false;
  if (y.zakatDelegated !== undefined) return Boolean(y.zakatDelegated);
  if (y.zakat_delegated !== undefined) return Boolean(y.zakat_delegated);

  const curSeason = String(season || y.season || "2026");
  const plotIds = new Set();
  if (y.plotId) plotIds.add(String(y.plotId));
  if (Array.isArray(y.plotIds)) y.plotIds.forEach(p => plotIds.add(String(p)));
  if (y.palmId) {
    const palm = palmByIdStr(y.palmId);
    if (palm && palm.plot) plotIds.add(String(palm.plot));
    if (palm && palm.plotId) plotIds.add(String(palm.plotId));
  }

  const contracts = st.contracts || [];
  for (const pId of plotIds) {
    const contract = contracts.find(c => 
      (Array.isArray(c.plots) && c.plots.some(cp => String(cp) === pId)) ||
      String(c.plotId) === pId ||
      String(c.plot_id) === pId
    );
    if (contract) {
      if (Number(contract.zakat_delegated) === 1 || contract.zakatDelegated === true) {
        return true;
      }
      const invId = contract.investor_id || contract.investorId;
      if (invId) {
        const z = (st.zakat || []).find(x => String(x.investorId) === String(invId) && String(x.season) === curSeason);
        if (z && (z.pledgeStatus === "signed" || z.status === "confirmed" || z.journeyStage === "delegated" || z.journeyStage === "delivered")) {
          return true;
        }
      }
    }

    const investorUser = (st.users || []).find(u => 
      Array.isArray(u.plots) && u.plots.some(up => String(up) === pId) && 
      (u.role === "investor" || (u.roles || []).includes("investor"))
    );
    if (investorUser) {
      const z = (st.zakat || []).find(x => String(x.investorId) === String(investorUser.id) && String(x.season) === curSeason);
      if (z && (z.pledgeStatus === "signed" || z.status === "confirmed" || z.journeyStage === "delegated" || z.journeyStage === "delivered")) {
        return true;
      }
    }
  }

  if (y.palmId) {
    const palm = palmByIdStr(y.palmId);
    if (palm && palm.investorId) {
      const z = (st.zakat || []).find(x => String(x.investorId) === String(palm.investorId) && String(x.season) === curSeason);
      if (z && (z.pledgeStatus === "signed" || z.status === "confirmed" || z.journeyStage === "delegated" || z.journeyStage === "delivered")) {
        return true;
      }
    }
  }

  if (y.contractId) {
    const c = contracts.find(c => String(c.id) === String(y.contractId));
    if (c && (Number(c.zakat_delegated) === 1 || c.zakatDelegated === true)) return true;
  }

  return false;
}

function getActiveProject() {
  const st = Store.get();
  return (st.projects || []).find(p => p.id === st.activeProjectId) || (st.projects && st.projects[0]) || { id: "proj_farafra_01", name: "مزرعة الفرافرة - قطاع 1", codePrefix: "BSH1" };
}

function getActiveCompany() {
  const st = Store.get();
  const curProj = getActiveProject();
  const compId = curProj.companyId || curProj.company_id || st.activeCompanyId;
  return (st.companies || []).find(c => c.id === compId) || (st.companies && st.companies[0]) || { id: "comp_bashayer", name: "شركة بشاير الشوربجي للاستثمار الزراعي", tradeName: "بشاير الشوربجي" };
}

function getUserAvailableProjects(user, st) {
  if (!user) return [];
  if (user.role === "admin" || user.role === "super_admin" || user.user === "admin") {
    return st.projects || [];
  }
  const accessProjIds = (st.userProjectAccess || [])
    .filter(a => a.user_id === user.id)
    .map(a => a.project_id)
    .filter(Boolean);
  if (accessProjIds.length > 0) {
    return (st.projects || []).filter(p => accessProjIds.includes(p.id));
  }
  if (user.projectId) {
    return (st.projects || []).filter(p => p.id === user.projectId);
  }
  return st.projects || [];
}

function projectSwitcherButtonHtml() {
  return "";
}

function renderNewProjectModal(st) {
  const co = getActiveCompany();
  const defPrefix = `BSH${(st.projects?.length || 0) + 1}`;
  return `
    <div class="modal" id="newProjectModal" style="display:flex;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.65);z-index:99999;align-items:center;justify-content:center;padding:16px">
      <div class="modal-box card" style="max-width:540px;width:100%;max-height:85vh;overflow-y:auto;border:2px solid var(--green)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid var(--line);padding-bottom:10px">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:22px">🌴</span>
            <h3 style="margin:0;color:var(--green-d)">إضافة مزرعة أو مشروع زراعي جديد</h3>
          </div>
          <button class="btn btn-ghost icon-btn" data-act="close-new-project-modal" style="padding:4px 8px">✕</button>
        </div>
        
        <p class="muted" style="font-size:12.5px;margin-bottom:16px">
          سجل بيانات المزرعة التابعة لشركة <b>${escapeHtml(co.name)}</b> لتخصيص سجلات النخيل والعمليات الحقلية والعهدة الخاصة بها.
        </p>

        <div style="display:flex;flex-direction:column;gap:12px">
          <div>
            <label style="font-size:12.5px;font-weight:700;display:block;margin-bottom:4px">اسم المزرعة / المشروع الميداني *</label>
            <input id="np_name" placeholder="مثال: مشروع توشكى للتمور - المرحلة الأولى" style="width:100%" />
          </div>

          <div class="grid grid-2" style="gap:10px">
            <div>
              <label style="font-size:12.5px;font-weight:700;display:block;margin-bottom:4px">كود بادئة الأصول (Prefix) *</label>
              <input id="np_prefix" value="${defPrefix}" maxlength="6" style="text-transform:uppercase;font-family:monospace;width:100%" placeholder="مثال: TSH2" />
            </div>
            <div>
              <label style="font-size:12.5px;font-weight:700;display:block;margin-bottom:4px">المساحة الإجمالية (بالفدان)</label>
              <input id="np_area" type="number" placeholder="مثال: 1200" style="width:100%" />
            </div>
          </div>

          <div>
            <label style="font-size:12.5px;font-weight:700;display:block;margin-bottom:4px">الموقع الجغرافي والمنطقة</label>
            <input id="np_loc" placeholder="مثال: محافظة أسوان - منطقة توشكى الزراعية" style="width:100%" />
          </div>

          <div>
            <label style="font-size:12.5px;font-weight:700;display:block;margin-bottom:4px">المنطقة الزمنية (Timezone)</label>
            <select id="np_tz" style="width:100%">
              <option value="Africa/Cairo" selected>القاهرة (Africa/Cairo)</option>
              <option value="Asia/Riyadh">الرياض (Asia/Riyadh)</option>
              <option value="Asia/Dubai">دبي (Asia/Dubai)</option>
              <option value="UTC">التوقيت العالمي الموحد (UTC)</option>
            </select>
          </div>

          <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:10px 12px;margin-top:4px">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;font-weight:700;color:var(--text)">
              <input type="checkbox" id="np_switch_now" checked />
              <span>تعيين وتفعيل كمزرعة نشطة فوراً بعد الإنشاء</span>
            </label>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12.5px;font-weight:600;color:#15803D;margin-top:8px">
              <input type="checkbox" id="np_clone_starter" checked />
              <span>استيراد قالب الإطلاق الافتراضي (القطاعات والأحواض النموذجية) تلقائياً</span>
            </label>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:18px;border-top:1px solid var(--line);padding-top:12px">
          <button class="btn btn-ghost" data-act="close-new-project-modal">إلغاء</button>
          <button class="btn btn-primary" data-act="save-new-project" style="padding:8px 24px;font-weight:800">
            💾 حفظ وبدء التشغيل
          </button>
        </div>
      </div>
    </div>
  `;
}

function projectSwitchModalHtml() { return ""; }
function renderSuperAdminGatewayModal() { return ""; }
function renderUserAccessModal() { return ""; }
function renderSaasNewProjectModal() { return ""; }
function renderSaasNewCompanyModal() { return ""; }
function saasConsoleView() { return `<div class="card">شاشة غير موجودة</div>`; }

function printPalmsBarcode(list, title = "ملصقات أكواد الأشجار والمحاصيل") {
  if (!list || !list.length) return toast("لا توجد أشجار أو أكواد للطباعة");
  const co = company();
  const w = window.open("", "_blank");
  w.document.write(`<!DOCTYPE html><html dir="rtl"><head><title>${title}</title><style>
    body{font-family:Arial,sans-serif;padding:16px;background:#fff;color:#000}
    h2{text-align:center;margin:0 0 6px 0;font-size:20px;color:#1B5E20}
    .head-bar{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #1B5E20;padding-bottom:10px;margin-bottom:16px}
    .g{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
    .c{border:1.5px dashed #2E7D32;border-radius:8px;padding:10px 8px;text-align:center;page-break-inside:avoid;background:#fafafa}
    .c img{width:120px;height:120px;display:block;margin:0 auto 6px}
    .code{font-family:monospace;font-weight:bold;font-size:13px;direction:ltr;letter-spacing:0.5px;color:#000;margin-bottom:4px}
    .meta{font-size:11.5px;color:#333;font-weight:600}
    @media print {
      body{padding:0}
      .head-bar{border-bottom:1px solid #000}
      .c{border:1px dashed #444;background:#fff}
    }
  </style></head><body>
    <div class="head-bar">
      <div>
        <h2>${co.companyName || "نظام إدارة النخيل والمحاصيل"}</h2>
        <div style="font-size:13px;color:#555">${title} (${list.length} ملصق QR)</div>
      </div>
      ${co.logo ? `<img src="${co.logo}" style="height:50px;max-width:120px;object-fit:contain">` : ""}
    </div>
    <div class="g">${list.map(p => `
      <div class="c">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(p.code)}">
        <div class="code">${p.code}</div>
        <div class="meta">${cropName(p.cropId)} - ${p.variety || '—'} • ${plotName(p.plot)}</div>
      </div>
    `).join("")}</div>
  </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 700);
}

const PERMISSIONS_CATALOG = [
  {
    module: "palms",
    moduleName: "النخيل والأشجار الميدانية",
    icon: "🌴",
    items: [
      { id: "palms_view", key: "r", name: "استعراض سجلات الأشجار والقطع", desc: "مشاهدة بطاقات الأشجار وأرقامها وحالتها الصحية" },
      { id: "palms_add", key: "c", name: "إضافة وتكويد شجرة جديدة", desc: "تكويد نخلة أو شجرة زيتون جديدة وإصدار كود فريد" },
      { id: "palms_edit", key: "e", name: "تعديل بيانات وإحداثيات النخلة", desc: "تعديل الصنف، تاريخ الغرس، أو إحداثيات GPS" },
      { id: "plots_manage", key: "e", name: "إدارة وتعديل القطع والقطاعات", desc: "تعديل مسميات القطع والقطاعات، وتحديث بياناتها وبيانات المساحة" },
      { id: "palms_delete", key: "d", name: "حذف وأرشفة شجرة", desc: "إزالة شجرة أو استبعادها من السجل الميداني" },
      { id: "plots_gps_clear", key: "d", name: "تصفير وحذف إحداثيات GPS للقطع", desc: "مسح إحداثيات الأشجار الميدانية للقطعة لإعادة الرفع المساحي" },
      { id: "palms_import", key: "a", name: "استيراد وتصدير بيانات الحقل", desc: "تحميل وتصدير ملفات CSV وتوليد الباركود المجمع" },
      { id: "plots_export", key: "a", name: "تصدير واستيراد إكسل للقطع (Round-Trip)", desc: "تصدير بيانات قطع النخيل لإكسل وتحديثها بالاستيراد" }
    ]
  },
  {
    module: "gis",
    moduleName: "الخريطة ونظام المعلومات الجغرافي (GIS)",
    icon: "🗺️",
    items: [
      { id: "gis_view", key: "r", name: "استعراض الخريطة وتوزيع الأشجار والقطع", desc: "مشاهدة الخريطة الجغرافية ومواقع النخيل وحالتها الصحية" },
      { id: "gis_draw", key: "c", name: "رسم وتحديد حدود القطع والقطاعات", desc: "إضافة ورسم مضلعات الحدود الجغرافية للقطع على الخريطة" },
      { id: "gis_edit", key: "e", name: "تعديل إحداثيات ومواقع الأشجار والقطع", desc: "تحديث مواقع الأشجار ونقاط الـ GPS وضبط المضلعات" },
      { id: "gis_delete", key: "d", name: "تصفير وحذف الحدود الجغرافية للقطع", desc: "مسح حدود القطع المحددة أو إزالة الإحداثيات الجغرافية" },
      { id: "gis_export", key: "a", name: "تصدير وطباعة الخرائط الجغرافية والـ KML", desc: "تصدير طبقات الخريطة وبيانات الـ GIS وطباعتها" }
    ]
  },
  {
    module: "ops",
    moduleName: "العمليات والخدمات الزراعية",
    icon: "⚙️",
    items: [
      { id: "ops_view", key: "r", name: "استعراض سجل العمليات والخدمات", desc: "مشاهدة العمليات المنفذة وتاريخها وحالتها" },
      { id: "ops_record", key: "c", name: "تسجيل خدمة ميدانية سريعة", desc: "تسجيل خدمة فردية على شجرة مع الصور والملاحظات" },
      { id: "ops_bulk", key: "e", name: "تنفيذ عمليات زراعية جماعية", desc: "تطبيق التسميد أو المكافحة أو التقليم على قطاع/قطعة كاملة" },
      { id: "ops_delete", key: "d", name: "حذف أو تعديل عملية مسجلة", desc: "إلغاء عملية غير معتمدة أو تصحيح بياناتها" },
      { id: "ops_approve", key: "a", name: "اعتماد وتدقيق العمليات الزراعية", desc: "الموافقة الرسمية للمهندس المشرف على العمليات المنجزة" },
      { id: "ops_schedule_manage", key: "m", name: "إعداد وتعديل خطط الرعاية والتذكيرات", desc: "تحديد دورات الري والتسميد والتقليم وتعيين المسؤولين" },
      { id: "ops_schedule_view", key: "v", name: "استعراض خطة التذكيرات الدورية", desc: "مشاهدة مهام الرعاية المجدولة والمستحقة بالمزرعة" }
    ]
  },
  {
    module: "nursery",
    moduleName: "المشتل والإكثار النباتي",
    icon: "🌱",
    items: [
      { id: "nursery_view", key: "r", name: "استعراض أصول وشتلات المشتل", desc: "متابعة سجل الفسائل والعقل والشتلات بالمشتل" },
      { id: "nursery_offshoot_add", key: "c", name: "تسجيل قلع وتوريد فسائل", desc: "تسجيل قلع فسيلة جديدة من نخلة أم أو توريد خارجي" },
      { id: "nursery_prep_record", key: "e", name: "تسجيل نشاط ومعاملة تجهيزية", desc: "إثبات الفطام، التطهير، غرف الضباب، والتطعيم" },
      { id: "nursery_delete", key: "d", name: "استبعاد وإتلاف أصول تالفة", desc: "حذف أو استبعاد فسيلة غير صالحة من سجل المشتل" },
      { id: "nursery_ready_issue", key: "a", name: "اعتماد جاهزية وصرف للغرس", desc: "تحديد جاهزية الفسيلة وصرفها للزراعة المستديمة بالحقل" },
      { id: "seedlings_import", key: "a", name: "استيراد وتصدير شتلات وفسائل المشتل (Excel)", desc: "رفع ملفات إكسل لبيانات المشتل والتصدير الجماعي" }
    ]
  },
  {
    module: "fertilizers",
    moduleName: "الأسمدة والمخزون والمستودعات",
    icon: "📦",
    items: [
      { id: "fert_view", key: "r", name: "استعراض أرصدة المخزون والعهد", desc: "مشاهدة رصيد المستودع والمنصرف وسجل استهلاك الحقل" },
      { id: "fert_voucher_issue", key: "c", name: "إصدار وتجهيز إذن صرف للميدان", desc: "إنشاء إذن صرف أسمدة أو مبيدات وحجزها كعهدة للموقع" },
      { id: "fert_supply_add", key: "c", name: "تسجيل توريد شحنة للمستودع", desc: "إدخال شحنات أسمدة ومبيدات جديدة إلى رصيد المخزن الرئيسي" },
      { id: "fert_item_manage", key: "e", name: "إضافة وتعديل أصناف الأسمدة", desc: "تعديل أسعار الوحدات، حد التنبيه، وتوصيف المركبات" },
      { id: "fert_item_delete", key: "d", name: "حذف أو تعطيل صنف سماد", desc: "إلغاء أو أرشفة صنف من قائمة المواد والمغذيات" },
      { id: "fert_voucher_accept", key: "a", name: "تأكيد واستلام العهدة الميدانية", desc: "اعتماد واستلام إذن الصرف الموجه للمسؤول بالموقع" }
    ]
  },
  {
    module: "yields",
    moduleName: "المحصول والحصاد والإنتاج",
    icon: "🍇",
    items: [
      { id: "yields_view", key: "r", name: "استعراض سجلات الحصاد والأوزان", desc: "مشاهدة إنتاجية المواسم لكل قطعة أو شجرة" },
      { id: "yields_record", key: "c", name: "تسجيل كميات وأوزان الحصاد", desc: "إدخال أوزان التمور والزيتون وتحديد درجة الجودة" },
      { id: "seasons_manage", key: "c", name: "إنشاء وإدارة المواسم الزراعية", desc: "فتح موسم حصاد جديد وتعيين فتراته الزمنية وحالته" },
      { id: "yields_edit", key: "e", name: "تعديل بيانات الحصاد والمواسم", desc: "تصحيح كميات الإنتاج أو درجات الجودة المسجلة" },
      { id: "yields_delete", key: "d", name: "حذف سجل حصاد", desc: "إزالة إدخال إنتاجي غير صحيح" },
      { id: "yields_export", key: "a", name: "اعتماد وتصدير بيانات المحصول", desc: "الإقفال النهائي لإنتاجية الموسم والتصدير للتقارير" }
    ]
  },
  {
    module: "zakat",
    moduleName: "حسابات ومصارف الزكاة",
    icon: "⚖️",
    items: [
      { id: "zakat_view", key: "r", name: "استعراض أنصبة وحسابات الزكاة", desc: "مشاهدة مستحقات زكاة الزروع للمستثمرين والمزارع" },
      { id: "zakat_calculate", key: "c", name: "احتساب وتخصيص الزكاة للموسم", desc: "توليد كشوف الزكاة عيناً أو نقداً وفق الأحكام الشرعية" },
      { id: "zakat_charities", key: "e", name: "إدارة جهات وصناديق الصرف", desc: "إضافة وتعديل بيانات الجمعيات والمؤسسات المستحقة" },
      { id: "zakat_delete", key: "d", name: "إلغاء أو تعديل استحقاق زكاة", desc: "إلغاء ربط زكوي أو تصحيح مسار الصرف" },
      { id: "zakat_approve", key: "a", name: "اعتماد تسليم وتحويل مبالغ الزكاة", desc: "التأكيد المالي النهائي لصرف الزكاة للمستحقين" }
    ]
  },
  {
    module: "reports",
    moduleName: "التقارير والمؤشرات والتحليلات",
    icon: "📊",
    items: [
      { id: "reports_view", key: "r", name: "استعراض لوحة المؤشرات والتقارير", desc: "مشاهدة التحليلات البيانية ومعدلات الإنجاز" },
      { id: "reports_export", key: "a", name: "تصدير وطباعة تقارير PDF و Excel", desc: "توليد التقارير الرسمية للإدارة والمستثمرين والجهات الرقابية" }
    ]
  },
  {
    module: "farmers",
    moduleName: "المزارعون والرعاة والعقود",
    icon: "👨‍🌾",
    items: [
      { id: "farmers_view", key: "r", name: "استعراض سجل المزارعين والعمال", desc: "مشاهدة كشوفات المزارعين وأرقام هواتفهم" },
      { id: "farmers_manage", key: "c", name: "إضافة وتعديل عقود المزارعين", desc: "تسجيل مزارع جديد، تحديد نسبة المحصول، وتخصيص القطع" },
      { id: "farmers_delete", key: "d", name: "إنهاء أو أرشفة ملف مزارع", desc: "إلغاء تفعيل عقد رعاية أو استبعاد مزارع" }
    ]
  },
  {
    module: "users",
    moduleName: "المستخدمون وإدارة الفرق",
    icon: "👥",
    items: [
      { id: "users_view", key: "r", name: "استعراض قائمة المستخدمين والفرق", desc: "مشاهدة حسابات المشرفين والعمال وتاريخ آخر ظهور" },
      { id: "users_manage", key: "c", name: "إضافة وتعديل حسابات المستخدمين", desc: "إنشاء حساب، تعيين كلمات المرور، وتعديل البيانات" },
      { id: "roles_manage", key: "e", name: "تخصيص الأدوار ومصفوفة الصلاحيات", desc: "إنشاء أدوار وظيفية وتعديل مصفوفات الصلاحيات العامة" },
      { id: "users_delete", key: "d", name: "تعطيل أو حذف حساب مستخدم", desc: "إيقاف صلاحية الدخول لمستخدم أو حذف حسابه" },
      { id: "scope_assign", key: "a", name: "توزيع وإسناد النطاقات الجغرافية", desc: "تحديد القطاعات والقطع المسموح للمهندس أو العامل الوصول لها" },
      { id: "investors_import", key: "a", name: "استيراد بيانات المستثمرين والعقود (Excel)", desc: "رفع ملفات إكسل للمستثمرين والعقود وتوزيع الحصص" }
    ]
  },
  {
    module: "settings",
    moduleName: "الإعدادات العامة وهوية المنظومة",
    icon: "⚙️",
    items: [
      { id: "settings_view", key: "r", name: "استعراض الإعدادات وقوائم النظام", desc: "مشاهدة إعدادات الشركة، الأصناف، والعمليات" },
      { id: "settings_company", key: "e", name: "إعدادات هوية الشركة والشعار والعملة", desc: "تحديث اسم المنشأة، العملة الرسمية، والشعار الرسمي" },
      { id: "settings_crops", key: "e", name: "إدارة المحاصيل ومصادر التكاثر", desc: "إضافة محاصيل بينية جديدة وتعديل طرق الإكثار" },
      { id: "settings_ops_types", key: "e", name: "إدارة وتصنيف أنواع العمليات الزراعية", desc: "إضافة وتعديل العمليات وتحديد متطلبات المواد والمركبات" }
    ]
  },
  {
    module: "audit",
    moduleName: "سجل التدقيق والرقابة",
    icon: "📜",
    items: [
      { id: "audit_view", key: "r", name: "استعراض سجل حركات وأنشطة النظام", desc: "مشاهدة الأنشطة الميدانية والإدارية وتفاصيل العمليات والمستخدمين" },
      { id: "audit_export", key: "a", name: "تصدير سجل التدقيق للأرشيف (CSV/Excel)", desc: "تنزيل تقارير تفصيلية بالحركات والعمليات المنفذة بصيغة ملفات إكسل" },
      { id: "audit_clean", key: "d", name: "أرشفة وتنظيف السجلات القديمة", desc: "إزالة السجلات الأقدم من فترة محددة لتفريغ مساحة التخزين بأمان" }
    ]
  },
  {
    module: "ai",
    moduleName: "المركز الذكي والذكاء الاصطناعي (Agri-AI)",
    icon: "✨",
    items: [
      { id: "ai_view", key: "r", name: "استعراض ودخول المركز الذكي (Agri-AI)", desc: "الوصول لشاشات المركز الذكي والتقارير الاستشارية المتقدمة" },
      { id: "ai_ndvi", key: "r", name: "صحة القطع الفضائية بالأقمار الصناعية (NDVI)", desc: "استعراض خرائط الأقمار الصناعية ومؤشر الإجهاد الخضري للقطع" },
      { id: "ai_irrigation", key: "r", name: "الري الذكي والمقننات المائية الموصى بها", desc: "استعراض المقننات المائية اليومية وجداول الري المناخية" },
      { id: "ai_pest_risks", key: "r", name: "التنبؤ المبكر بمخاطر سوسة النخيل والآفات", desc: "نظام الإنذار المبكر ومخاطر الطقس وسوسة النخيل الحمراء" },
      { id: "ai_carbon", key: "r", name: "بصمة الكربون وشهادات الاستدامة (ESG)", desc: "استعراض معدلات احتجاز الكربون ومؤشرات التنمية المستدامة" },
      { id: "ai_pest_vision", key: "c", name: "فحص وتشخيص الآفات والسوسة بالرؤية الحاسوبية", desc: "التقاط ورفع الصور للتحليل السحابي وتشخيص الإصابة وتقدير الخطورة" },
      { id: "ai_soil_analysis", key: "e", name: "محطة تحاليل التربة والمياه والتسميد الذكي", desc: "إدخال نتائج المعمل وتوليد برامج التسميد ومعالجة الملوحة والقلوية آلياً" },
      { id: "ai_voice_copilot", key: "c", name: "المساعد الصوتي الميداني واستخراج العمليات", desc: "تسجيل الأوامر الصوتية باللغة العربية وتوثيق العمليات في الحقل" },
      { id: "ai_chat_advisor", key: "r", name: "المستشار الزراعي التفاعلي (Agri-Copilot 24/7)", desc: "طرح الاستشارات الزراعية والحصول على إرشادات حقلية معتمدة" },
      { id: "ai_settings_manage", key: "a", name: "إدارة إعدادات ومفاتيح الذكاء الاصطناعي", desc: "ربط واختبار مفاتيح Google Gemini API والتحكم في إعدادات المنظومة الذكية" }
    ]
  }
];

function hasPerm(actionOrScreen, screen) {
  const u = session();
  if (!u) return false;

  const st = Store.get();
  const role = (st.roles || []).find(r => r.id === u.role);

  let action = "r";
  let target = actionOrScreen;
  if (screen !== undefined) {
    action = actionOrScreen;
    target = screen;
  }

  // If explicit revocation exists in role or user matrix for this module, honor it
  if (u.matrix && typeof u.matrix === "object" && u.matrix[target] !== undefined && !u.matrix[target].includes(action)) {
    return false;
  }
  if (role && role.matrix && typeof role.matrix === "object" && role.matrix[target] !== undefined && !role.matrix[target].includes(action)) {
    return false;
  }

  // Wildcard Bypass for Super Admin / Admin if not explicitly revoked
  if (u.isSuperAdmin || u.role === "super_admin" || u.role === "admin" || u.user === "superadmin" || u.user === "admin") {
    return true;
  }
  if (screen !== undefined) {
    action = actionOrScreen;
    target = screen;
  }

  // 1. Direct custom permission check on user
  if (u.customPerms && Array.isArray(u.customPerms)) {
    if (u.customPerms.includes(target)) return true;
    for (const m of PERMISSIONS_CATALOG) {
      if (m.items.some(x => x.id === target)) return false;
    }
  }

  // 2. Check if target is a fine-grained ID from PERMISSIONS_CATALOG
  let catItem = null, catMod = null;
  for (const m of PERMISSIONS_CATALOG) {
    const it = m.items.find(x => x.id === target);
    if (it) { catItem = it; catMod = m.module; break; }
  }

  const mod = catItem ? catMod : target;
  const key = catItem ? catItem.key : action;

  // 3. Check user-level matrix override if present
  if (u.matrix && typeof u.matrix === "object" && Object.keys(u.matrix).length > 0) {
    if (u.matrix[mod] !== undefined) {
      return u.matrix[mod].includes(key);
    }
    // If module is a standard catalog module and omitted from custom matrix, it is explicitly revoked
    const isKnownMod = PERMISSIONS_CATALOG.some(m => m.module === mod);
    if (isKnownMod) {
      return false;
    }
  }

  // 4. Check role-level matrix if explicitly configured
  if (role && role.matrix && typeof role.matrix === "object" && Object.keys(role.matrix).length > 0) {
    if (role.matrix[mod] !== undefined) {
      if (role.matrix[mod].includes(key)) return true;
      if (key === "v" && mod === "ops" && (["engineer", "worker"].includes(u.role) || (role.perms || []).includes("ops") || (role.perms || []).includes("field"))) return true;
      if (key === "m" && mod === "ops" && (u.role === "engineer" || (role.perms || []).includes("ops"))) return true;
      return false;
    } else {
      if (mod === "ai") {
        if (["engineer", "supervisor", "worker"].includes(u.role) && ["r", "c", "e"].includes(key)) return true;
        if (u.role === "investor") {
          if (["ai_view", "ai_ndvi", "ai_irrigation"].includes(target) && key === "r") return true;
          return false;
        }
      }
      // If module is a standard catalog module and omitted from custom matrix, it is explicitly revoked
      const isKnownMod = PERMISSIONS_CATALOG.some(m => m.module === mod);
      if (isKnownMod) {
        return false;
      }
    }
  }

  // 5. Check role.perms if specified and not 'all'
  if (role && role.perms && Array.isArray(role.perms)) {
    if (role.perms.includes("all")) {
      return true;
    }
    const hasModPerm = role.perms.includes(mod) || role.perms.includes(target);
    if (key === "r" && hasModPerm) return true;
    if (key === "a" && mod === "ops" && role.perms.includes("approve")) return true;
    if (key === "m" && mod === "ops" && (u.role === "engineer" || role.perms.includes("ops"))) return true;
    if (key === "v" && mod === "ops" && (["engineer", "worker"].includes(u.role) || role.perms.includes("ops") || role.perms.includes("field"))) return true;
    if (key === "c" && mod === "ops" && (["engineer", "worker"].includes(u.role) || role.perms.includes("ops") || role.perms.includes("field"))) return true;
    if (key === "e" && mod === "ops" && (["engineer", "worker"].includes(u.role) || role.perms.includes("ops") || role.perms.includes("field"))) return true;

    if (mod === "ai") {
      if (["engineer", "supervisor", "worker"].includes(u.role) && ["r", "c", "e"].includes(key)) return true;
      if (u.role === "investor" && key === "r") return true;
    }

    // If role has explicit non-empty perms list and the module is known but omitted
    if (PERMISSIONS_CATALOG.some(m => m.module === mod) && role.perms.length > 0) {
      if (!hasModPerm) return false;
    }
  }

  // 6. Default superadmin fallback (only if not restricted by matrix or perms)
  if (u.role === "admin") return true;

  // 7. Backward compatible fallback
  const map = { palms:"palms", ops:"ops", nursery:"nursery", fertilizers:"fertilizers", yields:"yields", reports:"reports", zakat:"zakat", farmers:"farmers", users:"users", settings:"settings", dash:"dash", ai:"ai" };
  if (action === "r") {
    if (u.role === "investor" && target === "ai_chat_advisor") return false;
    return (role?.perms || []).includes(map[target] || target) || target === "ai";
  }
  if (action === "a" && target === "ops") return (role?.perms || []).includes("approve");
  if (u.role === "engineer" && ["palms","ops","yields","reports","ai"].includes(target) && (action === "c" || action === "e")) return true;
  if (u.role === "worker" && (target === "ops" || target === "ai") && (action === "c" || action === "e")) return true;
  if (mod === "ai" || target === "ai") return true;
  return false;
}
function canMutate(rec) {
  if (rec && rec.approval === "approved") return false;
  const u = session();
  if (!u) return false;
  if (u.role === "admin") return true;
  if (u.role === "engineer" && hasPerm("approve")) return true;
  if (u.role === "worker" && rec && (rec.workerId === u.id || rec.motherId)) return rec.approval !== "approved";
  return false;
}
function btns(rec, items) {
  if (!canMutate(rec)) return rec && rec.approval === "approved" ? `<span class="status st-ok">معتمدة</span>` : "";
  return items.map(([act, label, id]) => `<button class="btn btn-ghost icon-btn" data-act="${act}" data-id="${id}">${label}</button>`).join("");
}
function pageTrail() {
  const st = Store.get();
  const home = homeFor(session()?.role);
  const homeT = session()?.role === "investor" ? t("nav_portfolio", "محفظتي") : session()?.role === "worker" ? t("nav_home", "الرئيسية") : t("nav_dash", "المؤشرات");
  const trail = [{ t: `🏠 ${homeT}`, go: home }];
  const add = (tStr, go, id, act) => trail.push({ t: tStr, go, id, act });
  if (current === "palms") {
    if (browseSec || browsePlotGroup || browsePlot) {
      add(t("nav_palms", "الأشجار والحقل"), null, null, "browse-home");
    } else {
      add(t("nav_palms", "الأشجار والحقل"), "palms");
    }
    if (browseSec) {
      if (browsePlotGroup || browsePlot) {
        add(sectorName(browseSec), null, browseSec, "open-bsec");
      } else {
        add(sectorName(browseSec));
      }
    }
    if (browsePlotGroup) {
      if (browsePlot) {
        add(`القطعة ${browsePlotGroup}`, null, null, "select-sub-plot");
      } else {
        add(`القطعة ${browsePlotGroup}`);
      }
    }
    if (browsePlot) {
      add(`القطعة الفرعية ${plotName(browsePlot)}`);
    }
  } else if (["palm-new","generate","import"].includes(current)) {
    add(t("nav_palms", "الأشجار والحقل"), "palms");
  }
  if (current === "worker-rework") add("⚠️ مهام تحتاج مراجعة", "worker-rework");
  if (current === "generate") add(t("btn_generate_codes", "إنشاء أكواد"), "generate");
  if (current === "import") add(t("btn_import", "الاستيراد"), "import");
  if (current === "palm-new") add(t("btn_add_palm", "إضافة أصل جديد"), "palm-new");
  if (current === "palm" || current === "op" || current === "offshoot") {
    add(t("nav_palms", "الأشجار والحقل"), "palms");
    const p = (st.palms || []).find(x => String(x.id) === String(lastExtra) || (x.code && x.code === lastExtra));
    const sec = st.plots.find(x => x.id === p?.plot)?.sector;
    if (sec) add(sectorName(sec), "sector", sec);
    if (p?.plot) add(plotName(p.plot), "plot", p.plot);
    if (p) add(p.code, "palm", p.id);
    if (current === "op") add(t("btn_new_op", "عملية جديدة"), "op", lastExtra);
    if (current === "offshoot") add(t("btn_cut_offshoot", "قلع فسيلة"), "offshoot", lastExtra);
  }
  if (current === "sector") add(t("nav_palms", "الأشجار والحقل"), "palms"), add(sectorName(lastExtra), "sector", lastExtra);
  if (current === "plot") {
    const pl = st.plots.find(x => x.id === lastExtra);
    add(t("nav_palms", "الأشجار والحقل"), "palms");
    if (pl) add(sectorName(pl.sector), "sector", pl.sector);
    add(plotName(lastExtra), "plot", lastExtra);
  }
  if (current === "ops-admin" || current === "op-detail") add(t("nav_ops", "العمليات"), "ops-admin");
  if (current === "early-warning") add("الإنذار المبكر والوقاية الذكية", "early-warning");
  if (current === "bulk-op") add(t("nav_bulk_op", "عملية جماعية"), "bulk-op");
  if (current === "fertilizers") add(t("nav_warehouse", "الأسمدة والمخزون"), "fertilizers");
  if (current === "nursery") add(t("nav_nursery", "المشتل"), "nursery");
  if (current === "yields") add(t("nav_yields", "المحصول"), "yields");
  if (current === "zakat-admin") add(t("nav_zakat", "الزكاة"), "zakat-admin");
  if (current === "investors-hub") add("💼 المستثمرون والعقود", "investors-hub");
  if (current === "reports") add(t("nav_reports", "التقارير"), "reports");
  if (["users","user-new","user-edit","roles"].includes(current)) add(t("nav_users", "المستخدمون والصلاحيات"), "users");
  if (current === "settings") add(t("nav_settings", "الإعدادات"), "settings");
  if (current === "gis") add(t("nav_gis", "الخريطة التفاعلية"), "gis");
  if (["farmers","farmer","farmer-new"].includes(current)) add(t("nav_farmers", "المزارعون"), "farmers");
  if (current === "profile") add(t("nav_profile", "الحساب الشخصي"), "profile");
  if (current === "scan") add(t("nav_scan", "الأشجار والحقل"), "scan");
  if (current === "queue") add(t("nav_queue", "قائمة الانتظار"), "queue");
  if (current === "notifications") add(t("nav_notifications", "الإشعارات والتنبيهات"), "notifications");
  if (current === "audit") add(t("nav_audit", "سجل التدقيق والرقابة"), "audit");
  if (current === "ai-hub") add("✨ المركز الذكي (Agri-AI)", "ai-hub");
  if (trail.length < 2) return "";
  return crumbs(trail);
}
function crumbs(items) {
  const showBack = stack.length > 0 || current !== homeFor(session()?.role);
  const backHtml = showBack ? `<button class="crumb-back-btn" data-act="back" title="${t("btn_back", "رجوع للصفحة السابقة")}">↩</button>` : "";
  return `<nav class="crumbs" aria-label="مسار التنقل">${backHtml}${items.map((it, i) => {
    const isLast = i === items.length - 1;
    if (isLast) {
      const isCode = /^[A-Z0-9]{3,}-[A-Z0-9]+/.test(it.t) || (it.id && current === "palm");
      if (isCode) {
        return `<span class="crumb-code" title="كود الأصل الحالي">${it.t}</span>`;
      }
      return `<b class="crumb-cur">${it.t}</b>`;
    }
    if (it.act) {
      return `<span class="crumb" data-act="${it.act}" ${it.id ? `data-id="${it.id}"` : ""}>${it.t}</span>`;
    }
    if (it.go) {
      return `<span class="crumb" data-go="${it.go}" ${it.id ? `data-id="${it.id}"` : ""} ${it.act ? `data-act="${it.act}"` : ""}>${it.t}</span>`;
    }
    return `<span class="crumb">${it.t}</span>`;
  }).join("<span class='crumb-sep'>›</span>")}</nav>`;
}
function findCrop(cropOrId) {
  if (!cropOrId) return null;
  const crops = Store.get().crops || [];
  if (typeof cropOrId === "object") {
    const id = cropOrId.id || cropOrId.code || cropOrId.numericId;
    return crops.find(c => c.id === id || c.code === id || c.numericId === Number(id)) || cropOrId;
  }
  const idStr = String(cropOrId).trim().toLowerCase();
  const num = Number(cropOrId);
  return crops.find(c => 
    c.id === idStr || 
    c.code === idStr || 
    (!isNaN(num) && c.numericId === num) ||
    (idStr === "1" && (c.id === "palm" || c.code === "palm")) ||
    (idStr === "2" && (c.id === "olive" || c.code === "olive"))
  ) || null;
}
function matchesCropFilter(itemCropId, filterVal) {
  if (!filterVal || filterVal === "all") return true;
  if (filterVal === "shared") return !itemCropId || itemCropId === "all" || itemCropId === "shared";
  if (!itemCropId || itemCropId === "all" || itemCropId === "shared") return false;
  const fStr = String(filterVal).trim().toLowerCase();
  const iStr = String(itemCropId).trim().toLowerCase();
  if (iStr === fStr) return true;
  if ((fStr === "palm" || fStr === "1") && (iStr === "palm" || iStr === "1" || iStr === "1.0")) return true;
  if ((fStr === "olive" || fStr === "2") && (iStr === "olive" || iStr === "2" || iStr === "2.0")) return true;
  if ((fStr === "mango" || fStr === "3") && (iStr === "mango" || iStr === "3" || iStr === "3.0")) return true;
  return false;
}
function cropOf(p) {
  const cid = p?.cropId ?? "palm";
  const c = findCrop(cid);
  return c || { id: "palm", name: "نخيل التمر", single: "نخلة", plural: "نخيل", offspring: "فسيلة", icon: "palm" };
}
function cropName(cropId) {
  const c = findCrop(cropId);
  return c ? c.name : ((cropId === "olive" || cropId === 2 || cropId === "2") ? "أشجار الزيتون" : "نخيل التمر");
}
function cropSingle(cropId) {
  const c = findCrop(cropId);
  return c?.single || "شجرة";
}
function cropPlural(cropId) {
  const c = findCrop(cropId);
  return c?.plural || "أشجار";
}
function cropIcon(cropOrId, size = 20) {
  if (!cropOrId) return "🌳";
  const c = findCrop(cropOrId);
  const id = c ? c.id : (typeof cropOrId === "string" ? cropOrId : (cropOrId.id || ""));
  const iconStr = c ? (c.icon || "") : (typeof cropOrId === "object" ? (cropOrId.icon || "") : "");
  if (id === "all" || cropOrId === "all") {
    return `<span style="font-size:${size}px;line-height:1;vertical-align:middle;display:inline-block">🌐</span>`;
  }
  if (id === "olive" || id === 2 || id === "2" || iconStr === "olive" || iconStr === "🫒" || (typeof cropOrId === "string" && (cropOrId.includes("زيتون") || cropOrId === "🫒"))) {
    return `<svg class="crop-svg" style="width:${size}px;height:${size}px;vertical-align:middle;display:inline-block;" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 26C11 23 17 17 25 7" stroke="#4B5320" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M16 18C13 14 11 11 7 11C6.5 13 8 16 12 18.5" fill="#6B8E23" stroke="#4B5320" stroke-width="0.8"/>
      <path d="M22 10C21 6 18 4 14 4C14 6 16 9 19.5 10.5" fill="#7A9A35" stroke="#4B5320" stroke-width="0.8"/>
      <path d="M24 8C27 11 29 14 29 18C27 18 24 16 22 12" fill="#6B8E23" stroke="#4B5320" stroke-width="0.8"/>
      <ellipse cx="14" cy="22" rx="5.5" ry="7.5" transform="rotate(-25 14 22)" fill="#556B2F" stroke="#2E3B18" stroke-width="1.2"/>
      <ellipse cx="12.5" cy="20" rx="1.8" ry="3.5" transform="rotate(-25 12.5 20)" fill="#8FBC8F" opacity="0.6"/>
      <ellipse cx="22" cy="18" rx="4.5" ry="6.5" transform="rotate(30 22 18)" fill="#4A5D23" stroke="#253012" stroke-width="1.2"/>
      <ellipse cx="21" cy="16.5" rx="1.5" ry="3" transform="rotate(30 21 16.5)" fill="#9ACD32" opacity="0.6"/>
    </svg>`;
  }
  if (id === "palm" || id === 1 || id === "1" || iconStr === "palm" || iconStr === "🌴" || (typeof cropOrId === "string" && (cropOrId.includes("نخيل") || cropOrId === "🌴"))) {
    return `<span style="font-size:${size}px;line-height:1;vertical-align:middle;display:inline-block">🌴</span>`;
  }
  const isDigitOnly = typeof cropOrId === "string" && /^\d+$/.test(cropOrId.trim());
  const isAsciiWord = typeof cropOrId === "string" && /^[a-zA-Z]+$/.test(cropOrId.trim());
  let glyph = (iconStr && !/^\d+$/.test(iconStr)) ? iconStr : ((typeof cropOrId === "string" && !isDigitOnly && !isAsciiWord && cropOrId.length <= 4) ? cropOrId : "🌳");
  if (isAsciiWord && cropOrId.toLowerCase() === "all") glyph = "🌐";
  return `<span style="font-size:${size}px;line-height:1;vertical-align:middle;display:inline-block">${glyph}</span>`;
}
function cropEmoji(cropOrId) {
  if (!cropOrId) return "🌱";
  const str = String(typeof cropOrId === "object" ? (cropOrId.id || cropOrId.code || "") : cropOrId).toLowerCase().trim();
  if (str === "all") return "🌐";
  if (str === "palm" || str === "1" || str.includes("نخيل")) return "🌴";
  if (str === "olive" || str === "2" || str.includes("زيتون")) return "🫒";
  const c = findCrop(cropOrId);
  return c?.icon || "🌱";
}
function cropTextLabel(cropOrId) {
  if (!cropOrId) return "محصول";
  const c = typeof cropOrId === "string" ? (Store.get().crops || []).find(x => x.id === cropOrId) || { name: cropOrId, id: cropOrId } : cropOrId;
  const icon = (c.id === "palm" || c.name?.includes("نخيل")) ? "🌴" : (c.id === "olive" || c.name?.includes("زيتون")) ? "🌿" : (c.icon || "🌳");
  return `${icon} ${c.name || ""}`;
}
const CROP_EMOJI_PALETTE = [
  "🌴", "🫒", "🥭", "🍊", "🍋", "🍇", "🍎", "🍐", 
  "🍑", "🍒", "🍓", "🥑", "🫐", "🍌", "🌾", "🌽", 
  "🥔", "🍅", "🥕", "🌳", "🌿", "🪴", "🌵"
];
function renderCropIconPicker(inputId, previewId, currentVal = "🌳") {
  const cur = currentVal || "🌳";
  return `
    <div style="margin-top:4px">
      <div style="display:flex;gap:8px;align-items:center">
        <div id="${previewId}" style="width:42px;height:42px;display:flex;align-items:center;justify-content:center;font-size:24px;background:#fff;border:1.5px solid #CBD5E1;border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,0.05)">${cropIcon(cur, 24)}</div>
        <input id="${inputId}" value="${escapeHtml(cur)}" placeholder="اختر من اللوحة أو اكتب رمزاً" style="flex:1;max-width:210px;font-size:14px" oninput="const pv=document.getElementById('${previewId}'); if(pv) pv.innerHTML = cropIcon(this.value || '🌳', 24);" />
      </div>
      <div style="margin-top:6px;font-size:11px;color:#64748B;font-weight:600">لوحة الرموز الزراعية المعتمدة (اضغط لاختيار فوري):</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:4px;padding:6px;background:#fff;border-radius:8px;border:1px solid #E2E8F0;max-width:400px">
        ${CROP_EMOJI_PALETTE.map(emoji => `
          <button type="button" class="btn btn-ghost" data-act="pick-crop-icon" data-target="${inputId}" data-preview="${previewId}" data-icon="${emoji}" style="width:34px;height:34px;padding:0;font-size:18px;display:inline-flex;align-items:center;justify-content:center;border-radius:6px;border:1px solid #E2E8F0;background:#F8FAFC;cursor:pointer" title="${emoji}">${emoji}</button>
        `).join("")}
      </div>
    </div>
  `;
}
function sourceLabel(p) {
  const c = cropOf(p);
  const src = (c.sources || []).find(s => s.code === p.source);
  if (src) return `${src.name} (${src.code})`;
  if (p.source === "F") return "فسيلة (F)";
  if (p.source === "N") return "نسيج (N)";
  if (p.source === "C") return "عقلة خضرية (C)";
  if (p.source === "S") return "شتلة (S)";
  if (p.source === "T") return "زراعة أنسجة (T)";
  return p.source || "—";
}
function getCropPlantingSourcesForSelect(cropId) {
  const st = Store.get();
  if (!cropId || cropId === "all") {
    const list = (st.cropPlantingSources && st.cropPlantingSources.length) ? st.cropPlantingSources : (st.propagationSourceTypes || []);
    const seen = new Set();
    const res = [];
    list.forEach(s => {
      const code = s.codeLetter || s.code;
      if (code && !seen.has(code)) {
        seen.add(code);
        res.push({ code, name: s.name });
      }
    });
    return res;
  }
  const cropObj = findCrop(cropId);
  const dedicated = (st.cropPlantingSources || []).filter(s => s.cropId === cropId || (cropObj && (s.cropId === cropObj.code || s.cropId === String(cropObj.numericId))));
  if (dedicated.length > 0) {
    return dedicated.map(s => ({ code: s.codeLetter || s.code, name: s.name }));
  }
  if (cropObj && cropObj.sources && cropObj.sources.length > 0) {
    return cropObj.sources.map(s => ({ code: s.code, name: s.name }));
  }
  return (st.propagationSourceTypes || []).map(s => ({ code: s.code, name: s.name }));
}
if (typeof window !== "undefined") {
  window.getCropPlantingSourcesForSelect = getCropPlantingSourcesForSelect;
  window._onPrepCropChange = function(sel, targetSrcSelectId) {
    const cropId = sel.value;
    const srcSelect = document.getElementById(targetSrcSelectId);
    if (!srcSelect) return;
    const sources = getCropPlantingSourcesForSelect(cropId);
    const cropLabel = cropId === "all" ? "شامل كل المحاصيل" : (findCrop(cropId)?.name || cropId);
    srcSelect.innerHTML = `<option value="all">🌐 كل المصادر (${cropLabel})</option>` +
      sources.map(s => `<option value="${s.code}">${s.name} (${s.code})</option>`).join("");
  };

  window._onToggleNurseryItem = function(id, checked) {
    if (checked) {
      selectedOffshootIds.add(id);
    } else {
      selectedOffshootIds.delete(id);
    }
    render();
  };

  window._onToggleNurseryAll = function(checked) {
    const boxes = document.querySelectorAll("#nursery-grid input.n-grid-chk");
    boxes.forEach(cb => {
      const id = cb.getAttribute("data-id");
      if (id) {
        if (checked) selectedOffshootIds.add(id);
        else selectedOffshootIds.delete(id);
      }
    });
    render();
  };

  window._onVoucherRecipientChange = function(userId) {
    const secSelect = document.getElementById("f_vch_sec");
    if (!secSelect) return;
    const st = Store.get();
    const targetUser = (st.users || []).find(u => u.id === userId);
    let allowedSectors = st.sectors || [];
    let isConstrained = false;

    if (targetUser && (targetUser.role === "engineer" || targetUser.role === "worker")) {
      const uPlots = (st.userPlots || []).filter(up => up.userId === targetUser.id).map(up => up.plotId);
      const userDirectPlots = targetUser.plots || [];
      const allUserPlotIds = new Set([...uPlots, ...userDirectPlots]);
      
      if (allUserPlotIds.size > 0) {
        const supSecIds = new Set();
        (st.plots || []).forEach(pl => {
          if (allUserPlotIds.has(pl.id) && pl.sector) {
            supSecIds.add(pl.sector);
          }
        });
        if (supSecIds.size > 0) {
          allowedSectors = (st.sectors || []).filter(s => supSecIds.has(s.id));
          isConstrained = true;
        }
      }
    }

    let opts = "";
    if (!isConstrained) {
      opts += '<option value="">-- عام لكل المزرعة --</option>';
    }
    opts += allowedSectors.map(s => `<option value="${s.id}">${s.name} (${s.id})</option>`).join("");
    secSelect.innerHTML = opts;
  };
}
function varietyOptions(sel, cropId = null) {
  const st = Store.get();
  let vars = [];
  if (st.cropVarieties && st.cropVarieties.length) {
    vars = cropId ? st.cropVarieties.filter(v => v.cropId === cropId).map(v => v.name) : st.cropVarieties.map(v => v.name);
  }
  if (!vars.length) vars = st.varieties || [];
  vars = [...new Set(vars)];
  return vars.map(v => `<option value="${v}" ${v===sel?"selected":""}>${v}</option>`).join("");
}
function session() { return Store.get().session; }

// Server timestamps written by SQLite look like "2026-10-04 19:05:12" and are UTC; JavaScript would read
// them as local time (3 hours off in Riyadh). Normalise to ISO-UTC before comparing or displaying.
function normTs(v) {
  if (!v || typeof v !== "string") return v;
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(v) ? v.replace(" ", "T") + "Z" : v;
}

// ---------------------------------------------------------------------------
// Fast lookups over the tree list (tens of thousands of rows). Rebuilt at most once per
// render (render() clears it) or when the list itself is replaced.
// ---------------------------------------------------------------------------
let _palmIdx = null;
function invalidatePalmIndex() { _palmIdx = null; _plotSecCache = null; }
let _plotSecCache = null;
// Same result as st.plots.find(x => x.id === plotId)?.sector, without scanning the plots list each time
function plotSectorOf(plotId) {
  const plots = Store.get().plots || [];
  if (!_plotSecCache || _plotSecCache.ref !== plots || _plotSecCache.len !== plots.length) {
    _plotSecCache = { ref: plots, len: plots.length, map: new Map(plots.map(x => [x.id, x.sector])) };
  }
  return _plotSecCache.map.get(plotId);
}
function palmIndex() {
  const st = Store.get();
  const list = st.palms || [];
  if (_palmIdx && _palmIdx.ref === list && _palmIdx.len === list.length) return _palmIdx;
  const byId = new Map(), byIdStr = new Map(), byCode = new Map(), byPlot = new Map(), bySector = new Map();
  const plotSector = new Map((st.plots || []).map(pl => [pl.id, pl.sector]));
  for (const p of list) {
    if (!p) continue;
    if (!byId.has(p.id)) byId.set(p.id, p);
    if (!byIdStr.has(String(p.id))) byIdStr.set(String(p.id), p);
    if (p.code && !byCode.has(p.code)) byCode.set(p.code, p);
    if (p.archived) continue;
    let a = byPlot.get(p.plot); if (!a) byPlot.set(p.plot, a = []); a.push(p);
    const sec = plotSector.get(p.plot);
    if (sec !== undefined) { let b = bySector.get(sec); if (!b) bySector.set(sec, b = []); b.push(p); }
  }
  _palmIdx = { ref: list, len: list.length, byId, byIdStr, byCode, byPlot, bySector };
  return _palmIdx;
}
// Same result as palmById(id)
function palmById(id) { return palmIndex().byId.get(id); }
// Same result as palmByIdStr(id)
function palmByIdStr(id) { return palmIndex().byIdStr.get(String(id)); }
// Same result as activePalmsInPlot(plotId)  (do not mutate the returned array)
function activePalmsInPlot(plotId) { return palmIndex().byPlot.get(plotId) || []; }
// Active trees whose plot belongs to the sector
function activePalmsInSector(sectorId) { return palmIndex().bySector.get(sectorId) || []; }

// ---------------------------------------------------------------------------
// Plot hierarchy: a main plot (e.g. BSH01-01) has sub-plots (BSH01-01A, 01B …) that hold the trees.
// ---------------------------------------------------------------------------
function plotChildrenMap() {
  const st = Store.get();
  const map = new Map();
  (st.plots || []).forEach(pl => {
    const parent = pl.parentPlotId || pl.parent_plot_id;
    if (!parent) return;
    if (!map.has(parent)) map.set(parent, []);
    map.get(parent).push(pl);
  });
  return map;
}
// The plot itself plus all its sub-plots (recursively)
function plotFamilyIds(plotId, childrenMap) {
  const kids = childrenMap || plotChildrenMap();
  const out = [plotId];
  for (let i = 0; i < out.length; i++) (kids.get(out[i]) || []).forEach(c => { if (!out.includes(c.id)) out.push(c.id); });
  return out;
}
// Active trees in a plot including its sub-plots
function activePalmsInPlotFamily(plotId, childrenMap) {
  const ids = plotFamilyIds(plotId, childrenMap);
  return ids.length === 1 ? activePalmsInPlot(plotId) : ids.flatMap(id => activePalmsInPlot(id));
}

// <option>s for a plot <select>: grouped by sector, each main plot followed by its sub-plots.
// opts: { selected, counts (true → "(N شجرة)" incl. sub-plots), label(pl) }
function plotOptionsHtml(plots, opts = {}) {
  const st = Store.get();
  const selected = opts.selected || "";
  const list = plots || [];
  const ids = new Set(list.map(p => p.id));
  const kids = plotChildrenMap();
  const esc = (typeof escapeHtml === "function") ? escapeHtml : (x => String(x));
  const byNum = (a, b) => String(a.id).localeCompare(String(b.id), "en", { numeric: true });
  const optHtml = (pl, isSub) => {
    const cnt = opts.counts ? ` (${activePalmsInPlotFamily(pl.id, kids).length} شجرة)` : "";
    const text = opts.label ? opts.label(pl) : `${pl.name || pl.id} — ${pl.id}`;
    return `<option value="${esc(pl.id)}" ${selected === pl.id ? "selected" : ""}>${isSub ? "    ↳ " : ""}${esc(text)}${cnt}</option>`;
  };
  const secOrder = (st.sectors || []).map(s => s.id);
  const secIds = [...new Set([...secOrder, ...list.map(p => p.sector)])].filter(sid => list.some(p => p.sector === sid));
  return secIds.map(sid => {
    const inSec = list.filter(p => p.sector === sid);
    const mains = inSec.filter(p => !(p.parentPlotId || p.parent_plot_id) || !ids.has(p.parentPlotId || p.parent_plot_id)).sort(byNum);
    const rows = [];
    const seen = new Set();
    mains.forEach(m => {
      rows.push(optHtml(m, false)); seen.add(m.id);
      (kids.get(m.id) || []).filter(c => ids.has(c.id)).sort(byNum).forEach(c => { rows.push(optHtml(c, true)); seen.add(c.id); });
    });
    inSec.filter(p => !seen.has(p.id)).sort(byNum).forEach(p => rows.push(optHtml(p, true)));
    const secName = (typeof sectorName === "function") ? sectorName(sid) : sid;
    return `<optgroup label="${esc(secName)}">${rows.join("")}</optgroup>`;
  }).join("");
}

function getActiveRoleWorkPlots(userObj, st) {
  const u = userObj || session();
  if (!u) return [];
  st = st || Store.get();
  const dbUser = (st.users || []).find(x => x.id === u.id || x.user === u.user || x.username === u.username);
  const activeRole = u.role;

  if (activeRole === "engineer" || activeRole === "worker" || activeRole === "supervisor") {
    if (Array.isArray(u.workerPlots) && u.workerPlots.length > 0) return u.workerPlots;
    if (Array.isArray(dbUser?.workerPlots) && dbUser.workerPlots.length > 0) return dbUser.workerPlots;
    const rawPlots = Array.isArray(u.plots) && u.plots.length > 0 ? u.plots : (dbUser?.plots || []);
    const invPlots = new Set([...(u.investorPlots || []), ...(dbUser?.investorPlots || [])]);
    return rawPlots.filter(pid => !invPlots.has(pid));
  }

  if (activeRole === "investor") {
    if (Array.isArray(u.investorPlots) && u.investorPlots.length > 0) return u.investorPlots;
    if (Array.isArray(dbUser?.investorPlots) && dbUser.investorPlots.length > 0) return dbUser.investorPlots;
    return [];
  }

  return Array.isArray(u.plots) && u.plots.length > 0 ? u.plots : (dbUser?.plots || []);
}
const BG_PRESETS = [
  { id: "oasis", name: "واحة", css: "linear-gradient(165deg,#1B5E20 0%,#7A8B5C 45%,#D9B88C 100%)" },
  { id: "grove", name: "بستان", css: "linear-gradient(180deg,#15301F 0%,#2E7D32 40%,#F7F3EA 100%)" },
  { id: "dunes", name: "كثبان", css: "linear-gradient(160deg,#C85A2E 0%,#D9B88C 50%,#F2ECDD 100%)" },
  { id: "dusk", name: "مغيب", css: "linear-gradient(165deg,#1A1A2E 0%,#C85A2E 55%,#F0A57E 100%)" },
  { id: "classic_beige", name: "بيج واحات (السابق)", css: "linear-gradient(180deg,#F4F1EA 0%,#EAE5DA 100%)" }
];
function applyUserBg() {
  const u = session();
  const bg = u?.bg;
  const body = document.body;
  body.classList.remove("has-bg", "bg-dark");
  body.style.removeProperty("--user-bg");
  body.style.removeProperty("--user-ov");
  if (!bg || bg.type === "default") return;
  body.classList.add("has-bg");
  if (bg.type === "preset") {
    const p = BG_PRESETS.find(x => x.id === bg.preset);
    body.style.setProperty("--user-bg", p ? p.css : BG_PRESETS[0].css);
    if (bg.preset === "night" || bg.preset === "dusk") body.classList.add("bg-dark");
  } else if (bg.type === "custom" && bg.image) {
    body.style.setProperty("--user-bg", `url("${bg.image}")`);
    body.classList.add("bg-photo");
  }
  body.style.setProperty("--user-ov", String((bg.overlay ?? 48) / 100));
}

function pendingCount() {
  try {
    const st = Store.get();
    return (st.queue || []).filter(q => q && q.status !== "synced").length;
  } catch (e) {
    return 0;
  }
}

function renderAsgCount() {
  updateSectorCheckboxStates();
}

function updateSectorCheckboxStates() {
  const cards = document.querySelectorAll(".sec-card");
  cards.forEach(card => {
    const secBox = card.querySelector(".asgsec");
    const plots = Array.from(card.querySelectorAll(".asgplot"));
    if (!secBox || !plots.length) return;
    const total = plots.length;
    const checkedCount = plots.filter(p => p.checked).length;

    secBox.checked = (checkedCount === total && total > 0);
    secBox.indeterminate = (checkedCount > 0 && checkedCount < total);

    card.classList.toggle("full-selection", checkedCount === total && total > 0);
    card.classList.toggle("has-selection", checkedCount > 0 && checkedCount < total);

    const badge = card.querySelector(".sec-badge");
    if (badge) {
      if (checkedCount === total && total > 0) {
        badge.className = "sec-badge all";
        badge.textContent = `✓ محدد بالكامل (${checkedCount}/${total})`;
      } else if (checkedCount > 0) {
        badge.className = "sec-badge part";
        badge.textContent = `— محدد جزئياً (${checkedCount}/${total})`;
      } else {
        badge.className = "sec-badge none";
        badge.textContent = `غير محدد (0/${total})`;
      }
    }

    card.querySelectorAll(".plot-group").forEach(grp => {
      const grpBox = grp.querySelector(".asggrp");
      const gPlots = Array.from(grp.querySelectorAll(".asgplot"));
      if (grpBox && gPlots.length) {
        const gChecked = gPlots.filter(p => p.checked).length;
        grpBox.checked = (gChecked === gPlots.length && gPlots.length > 0);
        grpBox.indeterminate = (gChecked > 0 && gChecked < gPlots.length);
      }
    });

    plots.forEach(p => {
      p.closest(".part-chip")?.classList.toggle("checked", p.checked);
    });
  });

  const totalChecked = Array.from(document.querySelectorAll(".asgplot")).filter(c => c.checked).length;
  const el = document.querySelector("#asgcount");
  if (el) el.textContent = totalChecked;
}
function isOutdoor() { return localStorage.getItem("palm_outdoor") === "1"; }
function netBanner() {
  const on = (typeof Api !== "undefined" && typeof Api.isOnline === "function") ? Api.isOnline() : false;
  const n = pendingCount();
  return `<div class="field-banner ${on?"online":"offline"}">
    <span>${on ? (n ? `أونلاين — ${n} سجل بانتظار المزامنة` : "أونلاين — تمت المزامنة") : `أوفلاين — ${n} عمليات تنتظر المزامنة`}</span>
    <button data-act="sync-all">إجراء المزامنة الآن</button>
  </div>`;
}
function palmBadge(p) {
  if (!p) return `<span class="status badge-danger">—</span>`;
  if (p.archived || p.status === "ميتة" || p.statusId === 5 || p.statusCode === "dead") return `<span class="status badge-danger" style="background:#F1F5F9;color:#475569;border:1px solid #CBD5E1">مؤرشفة / ميتة</span>`;
  if (p.statusId === 3 || p.statusCode === "infected" || (p.status||"").includes("مصاب") || (p.status||"").includes("سوسة")) {
    return `<span class="status badge-danger" style="background:#FEE2E2;color:#DC2626;border:1px solid #FCA5A5;font-weight:700">🚨 مصابة</span>`;
  }
  if (p.statusId === 2 || p.statusCode === "observation" || p.status === "تحت المراقبة" || (p.status||"").includes("مراقبة")) {
    return `<span class="status badge-warn" style="background:#FEF3C7;color:#D97706;border:1px solid #FCD34D;font-weight:700">⚠️ تحت المراقبة</span>`;
  }
  const due = Store.get().operations.filter(o => o.palmId === p.id && o.approval !== "approved").length;
  if (due) return `<span class="status badge-warn">تستحق خدمة (${due})</span>`;
  return `<span class="status badge-ok" style="background:#DCFCE7;color:#15803D;border:1px solid #86EFAC;font-weight:600">✓ سليمة / إنتاج</span>`;
}
function palmStatusHtml(p) {
  return palmBadge(p);
}
function codeHtml(c, id) {
  if (typeof c === "object" && c !== null) {
    id = id || c.id;
    c = c.code;
  }
  const codeStr = String(c || "");
  if (!id && codeStr && codeStr !== "—" && codeStr !== "null") {
    try {
      const st = (typeof Store !== "undefined" && Store.get) ? Store.get() : null;
      if (st && st.palms) {
        const found = st.palms.find(p => p.code === codeStr || p.id === codeStr);
        if (found) id = found.id;
      }
    } catch (_) {}
  }
  if (id) {
    return `<span class="code-chip clickable-palm-code" data-act="open-palm" data-id="${id}" style="cursor:pointer;display:inline-flex;align-items:center;gap:4px;user-select:none;transition:transform 0.1s" title="اضغط لفتح بطاقة وتفاصيل الشجرة">${codeStr} <span style="font-size:10px;opacity:0.65">🔍</span></span>`;
  }
  return `<span class="code-chip">${codeStr}</span>`;
}
function palmA(id, text) { return `<a href="#" class="lnk" data-act="open-palm" data-id="${id}">${text||"نخلة"}</a>`; }
function osA(id, text) { return `<a href="#" class="lnk" data-go="os-card" data-id="${id}">${text||"فسيلة"}</a>`; }
function secA(id, text) { return `<a href="#" class="lnk" data-go="sector" data-id="${id}">${text||sectorName(id)}</a>`; }
function plotA(id, text) { return `<a href="#" class="lnk" data-go="plot" data-id="${id}">${text||plotName(id)}</a>`; }
function hashN(s) { let n=0; String(s||"").split("").forEach(c => n = (n*31 + c.charCodeAt(0))>>>0); return n; }
function palmLatLng(p) {
  if (p.gps_lat !== null && p.gps_lat !== undefined && p.gps_lng !== null && p.gps_lng !== undefined && !isNaN(Number(p.gps_lat)) && !isNaN(Number(p.gps_lng))) {
    return [Number(p.gps_lat), Number(p.gps_lng)];
  }
  if (p.gps && typeof p.gps === "string" && p.gps.includes(",")) {
    const [a,b] = p.gps.split(",").map(Number);
    if (!isNaN(a) && !isNaN(b)) return [a,b];
  }
  const base = [27.048, 31.165];
  const h = hashN(p.plot+"-"+p.seq);
  return [base[0] + (h%180)/9000, base[1] + ((h>>8)%180)/9000];
}
function palmColor(p) {
  if (p.statusId === 3 || p.statusCode === "infected" || (p.status||"").includes("سوسة") || (p.status||"").includes("مصاب")) return "#DC2626";
  if (p.statusId === 2 || p.statusCode === "observation" || p.status === "تحت المراقبة" || (p.status||"").includes("مراقبة")) return "#D97706";
  if (p.archived || p.status==="ميتة" || p.statusId === 5 || p.statusCode === "dead") return "#6D4C41";
  if (p.cropId === "olive") {
    if ((p.variety||"").includes("بيكوال")) return "#556B2F";
    if ((p.variety||"").includes("مانزانيلا")) return "#689F38";
    return "#33691E";
  }
  if ((p.variety||"").includes("مجدول")) return "#6A1B9A";
  if ((p.variety||"").includes("سكري")) return "#1565C0";
  return "#2E7D32";
}
function mapsLink(gps) {
  if (!gps) return "<span class='muted'>لا إحداثيات</span>";
  const q = encodeURIComponent(gps);
  return `<div>الإحداثيات: <b dir="ltr">${gps}</b><br><a class="lnk" href="https://www.google.com/maps?q=${q}" target="_blank" rel="noopener">فتح الموقع في خرائط جوجل</a></div>`;
}

function workerAllowed(plot, palmId) {
  const u = session();
  if (!u) return false;
  if (u.role === "admin" || u.role === "engineer") return true;
  if (u.palmIds && u.palmIds.length && u.palmIds.includes(palmId)) return true;
  if ((u.plots || []).includes(plot)) return true;
  const st = Store.get();
  const hasUserPlot = (st.userPlots || []).some(up => String(up.userId) === String(u.id) && String(up.plotId) === String(plot));
  if (hasUserPlot) return true;
  if (palmId && (st.treeNotes || []).some(n => (String(n.palmId) === String(palmId) || n.palmCode === palmId) && (String(n.assignedToUserId) === String(u.id) || String(n.assignedTo) === String(u.id)) && n.status !== "closed" && n.status !== "completed")) {
    return true;
  }
  return false;
}
function getInvestorOwnedPlotIds(u, st) {
  if (!u) return [];
  st = st || Store.get();
  const contractPlotIds = [];
  const myContracts = (st.contracts || []).filter(c => 
    String(c.investorUserId) === String(u.id) || 
    String(c.investor_user_id) === String(u.id) ||
    String(c.investorId) === String(u.id) || 
    String(c.investor_id) === String(u.id) ||
    (u.contractIds || []).includes(c.id) ||
    (u.contractIds || []).includes(c.contractNumber) ||
    (u.contractIds || []).includes(c.contract_num)
  );

  myContracts.forEach(c => {
    if (Array.isArray(c.plots)) {
      c.plots.forEach(pid => { if (pid && !contractPlotIds.includes(pid)) contractPlotIds.push(pid); });
    }
  });

  if (myContracts.length > 0) {
    const myContractIds = new Set(myContracts.map(c => String(c.id)));
    (st.contractPlots || []).forEach(cp => {
      const cId = String(cp.contractId || cp.contract_id);
      if (myContractIds.has(cId)) {
        const pid = cp.plotId || cp.plot_id;
        if (pid && !contractPlotIds.includes(pid)) contractPlotIds.push(pid);
      }
    });
  }

  if (Array.isArray(u.investorPlots)) {
    u.investorPlots.forEach(pid => { if (pid && !contractPlotIds.includes(pid)) contractPlotIds.push(pid); });
  }

  const roles = Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : [u.role];
  const hasFieldRole = roles.some(r => ["worker", "engineer", "care", "storage", "nursery"].includes(r));
  
  // If user has a field operational role (e.g. worker), u.plots is work assignment, NEVER investor assets.
  // Fallback to u.plots ONLY if user is exclusively an investor and has no contracts or investorPlots defined
  if (!hasFieldRole && contractPlotIds.length === 0 && Array.isArray(u.plots)) {
    return [...u.plots];
  }
  // A contract on a main plot covers its sub-plots too (e.g. BSH01-01 → BSH01-01A, BSH01-01B …)
  const allPlots = st.plots || [];
  let grew = true;
  while (grew) {
    grew = false;
    allPlots.forEach(p => {
      if (p.parentPlotId && contractPlotIds.includes(p.parentPlotId) && !contractPlotIds.includes(p.id)) {
        contractPlotIds.push(p.id);
        grew = true;
      }
    });
  }
  return contractPlotIds;
}

function investorPalms(targetUser) {
  const u = targetUser || session();
  const st = Store.get();
  const all = st.palms || [];
  if (!u) return all;

  const roles = Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : [u.role];
  if (!roles.includes("investor")) return all;

  const ownedPlots = new Set(getInvestorOwnedPlotIds(u, st));
  const ownedPalmIds = new Set((u.palmIds || []).map(String));

  return all.filter(p => {
    if (ownedPalmIds.has(String(p.id))) return true;
    if (String(p.investorId) === String(u.id)) return true;
    if (ownedPlots.has(p.plot)) return true;
    return false;
  });
}
function toCleanDigits(str) {
  if (str === null || str === undefined) return "";
  return String(str).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).trim();
}
function mmYY(dateStr) {
  if (!dateStr) dateStr = new Date();
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    const today = new Date();
    return String(today.getMonth() + 1).padStart(2, "0") + String(today.getFullYear()).slice(-2);
  }
  return String(d.getMonth() + 1).padStart(2, "0") + String(d.getFullYear()).slice(-2);
}
function buildCode({ source, plot, seq, plantDate }, plotsList = null) {
  const plots = (plotsList && Array.isArray(plotsList)) ? plotsList : ((typeof Store !== "undefined" && Store.get && Store.get().plots) || []);
  const pl = plots.find(p => p.id === plot);
  const sec = pl ? pl.sector : (plot ? plot.split("-")[0] : "01");
  const pc = pl ? (pl.plotNo + (pl.part || "")) : (plot ? (plot.split("-")[1] || "01A") : "01A");
  const s = source || "F";
  const sq = String(seq || 1).padStart(3, "0");
  return `${sec}-${pc}-${s}${sq}-${mmYY(plantDate)}`;
}
function nurseryCode({ batch, source, seq, entryDate }) {
  return `${batch}-${source}${String(seq).padStart(3,"0")}-${mmYY(entryDate)}`;
}
function catName(id) {
  return Store.get().operationCats.find(c => c.id === id)?.name || id;
}
function typesByCat(catId, scope = null, crop = null) {
  return (Store.get().operationTypes || []).filter(t => {
    if (t.inactive) return false;
    if (t.catId !== catId && t.categoryId !== catId) return false;
    if (scope === "individual" && t.scopeType === "bulk") return false;
    if (scope === "bulk" && t.scopeType === "individual") return false;
    if (crop && t.cropId && normCropId(t.cropId) !== "all" && normCropId(t.cropId) !== normCropId(crop)) return false;
    return true;
  });
}
function nextOffshootSeq(motherId) {
  return String(Store.get().offshoots.filter(o => o.motherId === motherId).length + 1).padStart(2, "0");
}
function offshootBaseMotherCode(motherCode) {
  if (!motherCode) return "";
  // In palm biological coding standards:
  // An offshoot (فسيلة) severed from a palm is of origin 'F' (فسيلة),
  // so if the mother tree originated from seed 'N' (نواة) or tissue 'T', the offshoot inherits 'F' instead of 'N'/'T'.
  // Example: 05-07B-N018-1124 becomes 05-07B-F018-1124 in the offshoot tempCode.
  return motherCode.replace(/-([NnTt])(\d+)-/, (match, prefix, num) => `-F${num}-`);
}
function migrateOffshootCodes() {
  try {
    const st = Store.get();
    let changed = false;
    (st.offshoots || []).forEach(o => {
      if (o.tempCode && /-([NnTt])(\d+)-.*-OS/.test(o.tempCode)) {
        const oldCode = o.tempCode;
        const newCode = o.tempCode.replace(/-([NnTt])(\d+)-/, (match, prefix, num) => `-F${num}-`);
        if (oldCode !== newCode) {
          o.tempCode = newCode;
          changed = true;
          (st.palms || []).forEach(p => {
            if (p.parentCode === oldCode) p.parentCode = newCode;
            if (p.tempCode === oldCode) p.tempCode = newCode;
          });
          (st.operations || []).forEach(op => {
            if (op.targetCode === oldCode) op.targetCode = newCode;
          });
          (st.queue || []).forEach(q => {
            if (q.item === oldCode) q.item = newCode;
          });
        }
      }
    });
    (st.nurseryItems || []).forEach(n => {
      if (n.code && /-([NnTt])(\d+)-.*-OS/.test(n.code)) {
        const oldCode = n.code;
        const newCode = n.code.replace(/-([NnTt])(\d+)-/, (match, prefix, num) => `-F${num}-`);
        if (oldCode !== newCode) {
          n.code = newCode;
          changed = true;
        }
      }
    });
    if (changed) {
      Store.set({ offshoots: st.offshoots, palms: st.palms, operations: st.operations, queue: st.queue, nurseryItems: st.nurseryItems });
    }
  } catch (e) {}
}
function canEdit(rec) {
  return !rec || rec.approval !== "approved";
}
function yearOf(d) { return String(new Date(d).getFullYear()); }
function paginate(arr, page) {
  const start = (page - 1) * PAGE;
  return arr.slice(start, start + PAGE);
}
function pager(total, page, act) {
  const pages = Math.max(1, Math.ceil(total / PAGE));
  if (pages <= 1) return "";
  return `<div class="pager">
    <button class="btn btn-ghost" style="width:auto" data-act="${act}" data-id="${Math.max(1,page-1)}">السابق</button>
    <span class="muted">صفحة ${page} من ${pages} (${total})</span>
    <button class="btn btn-ghost" style="width:auto" data-act="${act}" data-id="${Math.min(pages,page+1)}">التالي</button>
  </div>`;
}

let current = "login";
let lastExtra = null;
const stack = [];
function go(name, extra, opt = {}) {
  if (name === "palm-new" && current !== "palm-new" && typeof palmNewDraft !== "undefined") palmNewDraft = {};
  // go("settings", "ai") opens that settings tab (used by the AI hub's settings buttons)
  if (name === "settings" && typeof extra === "string" && extra && typeof setTab !== "undefined") { setTab = extra; if (typeof setForm !== "undefined") setForm = ""; }
  if (!opt.back && current !== "login" && (current !== name || lastExtra !== extra)) {
    stack.push({ name: current, extra: lastExtra });
    if (stack.length > 40) stack.shift();
  }
  if (name === "reports") {
    const me = session();
    if (!isReportPermitted(me, reportKind)) {
      reportKind = getDefaultReportForUser(me);
    }
  }
  if (name === "users" && extra === "farmers") {
    usersTab = "farmers";
  }
  current = name;
  lastExtra = extra;
  render(extra);
}
function goBack() {
  const prev = stack.pop();
  if (prev) go(prev.name, prev.extra, { back: true });
  else if (session()) go(homeFor(session().role), null, { back: true });
}
function homeFor(role) {
  if (role === "investor") return "inv-home";
  if (role === "nursery_mgr") return "nursery";
  if (role === "warehouse_mgr") return "fertilizers";
  if (role === "customer_care") return "zakat-admin";
  if (role === "admin" || role === "engineer") return "dash";
  return "home";
}

function roleContextLabel(r) {
  if (r === "investor") return "💼 محفظة الاستثمار والعقود";
  if (r === "worker") return "🚜 وضع العمل والتشغيل الميداني";
  if (r === "engineer") return "📐 الإشراف الهندسي الميداني";
  if (r === "admin") return "👑 وضع الإدارة العليا";
  if (r === "warehouse_mgr") return "📦 إدارة المستودع والمخزون";
  if (r === "nursery_mgr") return "🌱 إدارة المشتل والفسائل";
  if (r === "customer_care") return "🤝 رعاية الشركاء والمجتمع";
  return roleLabel(r);
}

function renderRoleSwitcher(s) {
  if (!s || !s.roles || s.roles.length <= 1) return "";
  const roleIcons = {
    investor: "💼",
    worker: "🚜",
    engineer: "📐",
    admin: "👑",
    super_admin: "🏛️",
    warehouse_mgr: "📦",
    nursery_mgr: "🌱",
    customer_care: "🤝",
    tenant_user: "🏢"
  };

  if (s.roles.length === 2) {
    const otherRole = s.roles.find(r => r !== s.role) || s.roles[0];
    return `
      <button type="button" class="btn btn-sm" onclick="switchActiveRole('${otherRole}')" title="التبديل الفوري بين وضع العمل والاستثمار" style="background:#E8F5E9;border:1.5px solid #2E7D32;color:#1B5E20;font-weight:bold;display:inline-flex;align-items:center;gap:6px;padding:4px 14px;border-radius:20px;cursor:pointer;font-size:12px;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
        <span>🔄 التبديل إلى:</span>
        <span>${roleContextLabel(otherRole)}</span>
      </button>
    `;
  }

  return `
    <div style="display:inline-flex;align-items:center;gap:6px;background:#E8F5E9;padding:3px 12px;border-radius:20px;border:1.5px solid #2E7D32">
      <span style="font-size:12px;color:#1B5E20;font-weight:bold">🔄 الوضع الحالي:</span>
      <select onchange="switchActiveRole(this.value)" style="border:none;background:transparent;font-weight:bold;color:#1B5E20;font-size:12px;cursor:pointer;outline:none;padding:2px">
        ${s.roles.map(r => `<option value="${r}" ${r === s.role ? "selected" : ""}>${roleContextLabel(r)}</option>`).join("")}
      </select>
    </div>
  `;
}

function switchActiveRole(targetRole) {
  const s = session();
  if (!s || !s.roles || !s.roles.includes(targetRole)) return;
  s.role = targetRole;
  Store.set({ session: s });
  browseSec = null;
  browsePlot = null;
  browsePlotGroup = null;
  scanSec = null;
  scanPlot = null;
  scanPlotGroup = null;
  toast(`🔄 تم التبديل إلى دور: ${roleLabel(targetRole)}`);
  current = homeFor(targetRole);
  render();
}
function addDaysToDate(dateStr, days) {
  try {
    const base = dateStr ? new Date(dateStr) : new Date();
    base.setDate(base.getDate() + (parseInt(days, 10) || 0));
    return base.toISOString().slice(0, 10);
  } catch (e) {
    return new Date().toISOString().slice(0, 10);
  }
}

function dueSchedulesFor(user) {
  const st = Store.get();
  const u = user || session() || {};
  if (!u || !u.id) return [];
  const currentProjId = st.activeProjectId || "proj_farafra_01";
  const today = new Date().toISOString().slice(0, 10);
  const schedules = (st.operationSchedules || []).filter(s => {
    if (s.active === false) return false;
    if (s.projectId) return s.projectId === currentProjId;
    return currentProjId === "proj_farafra_01";
  });

  return schedules.filter(s => {
    const isDue = !s.nextDueDate || s.nextDueDate <= today;
    if (!isDue) return false;

    if (u.role === "admin") return true;

    if (s.assignedUserId && s.assignedUserId !== "all") {
      return s.assignedUserId === u.id;
    }

    if (s.assignedRole && s.assignedRole !== "all") {
      if (s.assignedRole !== u.role) return false;
    } else if (u.role !== "worker" && u.role !== "engineer") {
      return false;
    }

    if (u.role === "worker") {
      if (Array.isArray(s.plotIds) && s.plotIds.length && Array.isArray(u.plots) && u.plots.length) {
        const hasOverlap = s.plotIds.some(pid => u.plots.includes(pid));
        if (!hasOverlap) return false;
      } else if (s.plotId && s.plotId !== "all" && Array.isArray(u.plots) && u.plots.length) {
        if (s.plotId.startsWith("base:")) {
          const bId = s.plotId.slice(5);
          const hasOverlap = u.plots.some(pid => pid.startsWith(bId) || plotBaseId(pid) === bId);
          if (!hasOverlap) return false;
        } else if (!u.plots.includes(s.plotId)) {
          return false;
        }
      }
      if (s.sectorId && s.sectorId !== "all" && Array.isArray(u.plots) && u.plots.length) {
        const userSecs = st.plots.filter(p => u.plots.includes(p.id)).map(p => p.sector);
        if (!userSecs.includes(s.sectorId)) return false;
      }
    }

    return true;
  });
}

function checkRoutineReminders() {
  const st = Store.get();
  if (!st || !st.operationSchedules || !st.operationSchedules.length) return;
  const currentProjId = st.activeProjectId || "proj_farafra_01";
  const today = new Date().toISOString().slice(0, 10);
  const activeSchedules = st.operationSchedules.filter(s => {
    if (s.active === false) return false;
    if (s.projectId && s.projectId !== currentProjId) return false;
    if (!s.projectId && currentProjId !== "proj_farafra_01") return false;
    return (!s.nextDueDate || s.nextDueDate <= today);
  });
  if (!activeSchedules.length) return;

  let notifsChanged = false;
  const notifs = st.notifications || [];

  activeSchedules.forEach(sch => {
    let targetUsers = [];
    if (sch.assignedUserId && sch.assignedUserId !== "all") {
      targetUsers = (st.users || []).filter(u => u.id === sch.assignedUserId);
    } else if (sch.assignedRole && sch.assignedRole !== "all") {
      targetUsers = (st.users || []).filter(u => u.role === sch.assignedRole);
    } else {
      targetUsers = (st.users || []).filter(u => u.role === "worker" || u.role === "engineer");
    }

    targetUsers.forEach(u => {
      const notifKey = `sch_${sch.id}_${today}`;
      const exists = notifs.some(n => n.userId === u.id && (n.refKey === notifKey || (n.text && n.text.includes(`[${sch.title}]`) && n.at && n.at.startsWith(today))));
      if (!exists) {
        const prioTag = sch.priority === "urgent" ? "🚨 عاجل: " : sch.priority === "high" ? "⚠️ هام: " : "⏰ دوري: ";
        const locStr = (sch.plotIds && sch.plotIds.length > 1) ? ` • قطع (${sch.plotIds.length}): ${sch.plotIds.map(p => plotName(p)).join(", ")}` :
                       (sch.plotId && sch.plotId !== "all") ? ` • قطعة: ${plotName(sch.plotId)}` :
                       (sch.sectorId && sch.sectorId !== "all") ? ` • قطاع: ${sectorName(sch.sectorId)}` : "";
        notifs.push({
          id: Store.uid("notif"),
          projectId: currentProjId,
          companyId: st.activeCompanyId,
          userId: u.id,
          text: `${prioTag}حان موعد تنفيذ [${sch.title}] (${typeName(sch.opTypeId) || sch.opName || 'عملية ميدانية'})${locStr}`,
          at: new Date().toISOString(),
          refKey: notifKey,
          scheduleId: sch.id,
          type: "routine",
          targetView: "bulk-op",
          read: false
        });
        notifsChanged = true;
      }
    });
  });

  if (notifsChanged) {
    Store.set({ notifications: notifs });
  }
}

function unreadNotificationsCount() {
  const me = session();
  if (!me) return 0;
  const st = Store.get();
  const currentProjId = st.activeProjectId || "proj_farafra_01";
  const currentCompId = st.activeCompanyId || "comp_bashayer";
  const notifs = st.notifications || [];
  return notifs.filter(n => {
    if (n.userId !== me.id || n.read) return false;
    if (n.projectId && n.projectId !== currentProjId) return false;
    if (n.companyId && n.companyId !== currentCompId) return false;
    if (!n.projectId && currentProjId !== "proj_farafra_01") return false;
    if (!n.companyId && currentCompId !== "comp_bashayer") return false;
    return true;
  }).length;
}

function workerReworkCount() {
  const me = session();
  if (!me) return 0;
  const st = Store.get();
  return (st.operations || []).filter(o => o.workerId === me.id && (o.approval === "needs_rework" || o.approval === "rework")).length;
}

function isUserEditingOrFormActive() {
  if (typeof document === "undefined") return false;
  // 1. Is user actively typing / focused on an input element?
  const activeEl = document.activeElement;
  if (activeEl && ["INPUT", "TEXTAREA", "SELECT"].includes(activeEl.tagName)) {
    return true;
  }
  // 2. Is there an active modal, dialog, or popup open?
  if (document.querySelector(".custom-modal-backdrop, .modal, .modal-backdrop, .modal-overlay, .swal2-container, [role='dialog']")) {
    return true;
  }
  // 3. Is the user currently on an active form/edit route?
  const cur = typeof current !== "undefined" ? current : "";
  const editingViews = [
    "user-new", "user-edit", "palm-new", "palm-edit", "tree-new", "tree-edit",
    "plot-edit", "plot-new", "nursery-new", "op-new", "operation-new",
    "farmer-new", "farmer-edit", "investor-new", "investor-edit"
  ];
  if (editingViews.includes(cur)) {
    return true;
  }
  // 4. Are there any inputs or textareas that have non-empty user-entered values?
  const inputs = document.querySelectorAll("input:not([readonly]):not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea");
  for (let i = 0; i < inputs.length; i++) {
    const el = inputs[i];
    if (el.value && el.value.trim() !== "" && el.value !== el.defaultValue) {
      return true;
    }
  }
  // 5. Is user on GIS map or editing map? Don't interrupt map view with background re-render!
  if (cur === "gis" || cur === "palm" || document.getElementById("farmmap") || document.getElementById("editmap")) {
    return true;
  }
  return false;
}
window.isUserEditingOrFormActive = isUserEditingOrFormActive;

function translateAuditText(str) {
  if (!str || typeof str !== "string") return str || "";
  if (typeof AuditLog !== "undefined" && typeof AuditLog.translateAuditText === "function") {
    return AuditLog.translateAuditText(str);
  }
  let text = str;

  // Specific replacements for operations:
  text = text.replace(/تم تنفيذ حركة \((?:approve_operation|approve)\) على (?:العمليات الميدانية|ops)(?: \[([^\]]+)\])?/gi, "اعتماد عملية ميدانية$1");
  text = text.replace(/تم تنفيذ حركة \((?:batch_approve_operation)\) على (?:العمليات الميدانية|ops)(?: \[([^\]]+)\])?/gi, "اعتماد مجمع للعمليات الميدانية$1");
  text = text.replace(/تم تنفيذ حركة \((?:create_operation|add_operation)\) على (?:العمليات الميدانية|ops)(?: \[([^\]]+)\])?/gi, "تسجيل عملية ميدانية جديدة$1");
  text = text.replace(/تم تسجيل وإضافة العمليات الميدانية جديد(?: \[([^\]]+)\])?/gi, "تسجيل عملية ميدانية جديدة$1");
  text = text.replace(/تم تحديث وتعديل العمليات الميدانية(?: \[([^\]]+)\])?/gi, "تعديل العملية الميدانية$1");
  text = text.replace(/تم حذف العمليات الميدانية(?: \[([^\]]+)\])?/gi, "حذف العملية الميدانية$1");

  text = text.replace(/^update\s+sector\s+([A-Za-z0-9_-]+)/i, "تحديث بيانات القطاع ($1)");
  text = text.replace(/^create\s+sector\s+([A-Za-z0-9_-]+)/i, "إضافة قطاع جديد ($1)");
  text = text.replace(/^delete\s+sector\s+([A-Za-z0-9_-]+)/i, "حذف القطاع ($1)");
  text = text.replace(/^update\s+palms?\s+([A-Za-z0-9_.-]+)/i, "تحديث بيانات النخيل ($1)");
  text = text.replace(/^create\s+palms?\s+([A-Za-z0-9_.-]+)/i, "إضافة نخلة جديدة ($1)");
  text = text.replace(/^delete\s+palms?\s+([A-Za-z0-9_.-]+)/i, "حذف النخلة ($1)");
  text = text.replace(/^update\s+plots?\s+([A-Za-z0-9_-]+)/i, "تحديث بيانات القطعة ($1)");
  text = text.replace(/^create\s+plots?\s+([A-Za-z0-9_-]+)/i, "إضافة قطعة جديدة ($1)");
  text = text.replace(/^delete\s+plots?\s+([A-Za-z0-9_-]+)/i, "حذف القطعة ($1)");
  text = text.replace(/^create\s+nursery\s+([A-Za-z0-9_-]+)/i, "إضافة شتلات جديدة بالمشتل ($1)");
  text = text.replace(/^update\s+nursery\s+([A-Za-z0-9_-]+)/i, "تحديث بيانات المشتل ($1)");
  text = text.replace(/^create\s+operations?\s+([A-Za-z0-9_-]+)/i, "تسجيل عملية ميدانية جديدة ($1)");
  text = text.replace(/^update\s+operations?\s+([A-Za-z0-9_-]+)/i, "تحديث العملية الميدانية ($1)");
  text = text.replace(/^update\s+contract\s+([A-Za-z0-9_-]+)/i, "تحديث العقد الاستثماري ($1)");
  text = text.replace(/^create\s+contract\s+([A-Za-z0-9_-]+)/i, "إنشاء عقد استثماري جديد ($1)");
  text = text.replace(/^delete\s+contract\s+([A-Za-z0-9_-]+)/i, "حذف العقد الاستثماري ($1)");
  text = text.replace(/^update\s+investor\s+([A-Za-z0-9_-]+)/i, "تحديث بيانات المستثمر ($1)");
  text = text.replace(/^create\s+investor\s+([A-Za-z0-9_-]+)/i, "إضافة مستثمر جديد ($1)");
  text = text.replace(/^update\s+fertilizers?\s+([A-Za-z0-9_-]+)/i, "تحديث بيانات الأسمدة ($1)");
  text = text.replace(/^create\s+fertilizers?\s+([A-Za-z0-9_-]+)/i, "إضافة صنف سماد ($1)");
  return text;
}
window.translateAuditText = translateAuditText;


// Save nursery stage/details of offshoots to the server (kept as _nsDirty and retried if offline).
// Accepts records or ids.
function persistNursery(recsOrIds) {
  const st = Store.get();
  const arr = Array.isArray(recsOrIds) ? recsOrIds : [recsOrIds];
  const find = id => (st.offshoots || []).find(o => o.id === id) || (st.nurseryItems || []).find(o => o.id === id);
  const list = arr.map(x => (x && typeof x === "object") ? x : find(x)).filter(Boolean);
  if (!list.length) return;
  list.forEach(r => { r._nsDirty = true; });
  Store.set({ offshoots: st.offshoots, nurseryItems: st.nurseryItems || [] });
  if (typeof Api !== "undefined" && typeof Api.saveNurseryState === "function") Api.saveNurseryState(list);
}
