/**
 * المساعد الصوتي الميداني — زر ميكروفون ثابت في كل الشاشات
 *
 * Flow: speak (or type) → VoiceIntent understands it locally against the farm's data →
 * confirmation card with every field editable → save as a normal operation (same shape as the
 * single-tree form and the bulk screen, so approvals, reports and sync treat it identically).
 *
 * Opens from: the floating 🎙️ button, Alt+V, the app-icon shortcut (index.html#voice), or the
 * "المساعد الصوتي" tab in the AI hub. Lives outside #app so re-renders never wipe a recording.
 */
(function (window) {
  "use strict";
  const doc = window.document;
  const VI = () => window.VoiceIntent;

  const state = {
    open: false,
    recording: false,
    mode: null,        // "speech" (browser speech recognition) | "audio" (record → server transcribes)
    rec: null,
    media: null,
    chunks: [],
    silenceTimer: null,
    text: "",
    draft: null,
    busy: false,       // waiting for the server / Gemini
    source: "local",
    saved: null        // last saved op summary
  };

  // ---------------------------------------------------------------- helpers
  const esc = s => (typeof escapeHtml === "function" ? escapeHtml(s) : String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const say = msg => { if (typeof toast === "function") toast(msg); };
  const st = () => (typeof Store !== "undefined" ? Store.get() : {});
  const me = () => (typeof session === "function" ? session() : null);

  function allowed() {
    const u = me();
    if (!u) return false;
    if (u.role === "investor") return false;
    if (typeof hasPerm !== "function") return true;
    return hasPerm("ops_record") && hasPerm("ai_voice_copilot");
  }

  let ctxCache = { key: null, ctx: null };
  function farmCtx() {
    const s = st();
    const key = s.palms; // the array is replaced on every sync, so its identity is a good cache key
    if (ctxCache.ctx && ctxCache.key === key && ctxCache.plots === s.plots && ctxCache.types === s.operationTypes) return ctxCache.ctx;
    const ctx = VI().prepCtx({
      sectors: s.sectors || [], plots: s.plots || [], palms: s.palms || [],
      operationTypes: (s.operationTypes || []).filter(t => !t.inactive),
      fertilizers: (s.fertilizers || []).filter(f => f.active !== false)
    });
    ctxCache = { key, plots: s.plots, types: s.operationTypes, ctx };
    return ctx;
  }

  const speechSupported = () => !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const audioSupported = () => !!(window.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  // ---------------------------------------------------------------- styles + shell
  function injectStyles() {
    if (doc.getElementById("va-styles")) return;
    const css = `
      .va-fab{position:fixed;left:16px;bottom:92px;z-index:900;width:58px;height:58px;border-radius:50%;border:3px solid #fff;
        background:linear-gradient(135deg,#16A34A,#15803D);color:#fff;font-size:26px;cursor:pointer;box-shadow:0 8px 20px rgba(21,128,61,.4);
        display:flex;align-items:center;justify-content:center;padding:0}
      .va-fab:active{transform:scale(.94)}
      @media (min-width:900px){.va-fab{bottom:24px;left:24px}}
      .va-back{position:fixed;inset:0;z-index:1000;background:rgba(15,23,42,.55);display:flex;align-items:flex-end;justify-content:center}
      @media (min-width:700px){.va-back{align-items:center}}
      .va-sheet{background:#fff;width:100%;max-width:640px;max-height:94vh;overflow:auto;border-radius:20px 20px 0 0;padding:16px 16px 22px;direction:rtl;font-family:inherit}
      @media (min-width:700px){.va-sheet{border-radius:20px}}
      .va-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
      .va-head h3{margin:0;font-size:17px;font-weight:800;color:#0F172A}
      .va-x{background:#F1F5F9;border:none;border-radius:50%;width:34px;height:34px;font-size:16px;cursor:pointer;width:34px !important}
      .va-mic{width:92px;height:92px;border-radius:50%;border:none;margin:6px auto 8px;display:flex;align-items:center;justify-content:center;font-size:40px;cursor:pointer;color:#fff;
        background:linear-gradient(135deg,#16A34A,#15803D);box-shadow:0 6px 18px rgba(21,128,61,.35)}
      .va-mic.on{background:#DC2626;box-shadow:0 0 0 10px rgba(220,38,38,.15);animation:vaPulse 1.4s infinite}
      @keyframes vaPulse{0%,100%{box-shadow:0 0 0 6px rgba(220,38,38,.18)}50%{box-shadow:0 0 0 16px rgba(220,38,38,.06)}}
      .va-hint{text-align:center;font-size:12.5px;color:#64748B;margin-bottom:10px;line-height:1.6}
      .va-row{display:flex;gap:8px;align-items:stretch}
      .va-text{flex:1;min-width:0;font-size:15px;padding:10px 12px;border:1.5px solid #CBD5E1;border-radius:12px;resize:vertical;min-height:52px;font-family:inherit}
      .va-btn{border:none;border-radius:12px;padding:10px 16px;font-weight:800;font-size:14px;cursor:pointer;width:auto !important;white-space:nowrap}
      .va-primary{background:#15803D;color:#fff}
      .va-ghost{background:#F1F5F9;color:#334155;border:1.5px solid #CBD5E1}
      .va-danger{background:#DC2626;color:#fff}
      .va-btn[disabled]{opacity:.5;cursor:not-allowed}
      .va-chips{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 4px}
      .va-chip{font-size:12px;padding:5px 10px;border-radius:14px;background:#F8FAFC;border:1px solid #CBD5E1;cursor:pointer;width:auto !important}
      .va-card{margin-top:14px;border:1.5px solid #BBF7D0;background:#F0FDF4;border-radius:14px;padding:12px}
      .va-card.bad{border-color:#FCA5A5;background:#FEF2F2}
      .va-card.crit{border-color:#EF4444}
      .va-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      @media (max-width:480px){.va-grid{grid-template-columns:1fr}}
      .va-f{background:#fff;border:1px solid #E2E8F0;border-radius:10px;padding:7px 9px}
      .va-f.full{grid-column:1/-1}
      .va-f label{display:block;font-size:11px;font-weight:800;color:#64748B;margin-bottom:3px}
      .va-f select,.va-f input{width:100%;font-size:14px;font-weight:700;padding:6px 8px;border:1px solid #CBD5E1;border-radius:8px;background:#F8FAFC;box-sizing:border-box}
      .va-f.err{border-color:#EF4444;box-shadow:0 0 0 2px rgba(239,68,68,.12)}
      .va-resolved{font-size:11.5px;color:#15803D;font-weight:700;margin-top:3px}
      .va-issues{margin:10px 0 0;padding:0;list-style:none;font-size:12.5px;line-height:1.6}
      .va-issues li.error{color:#B91C1C;font-weight:700}
      .va-issues li.warn{color:#92400E}
      .va-meta{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;font-size:11.5px;color:#64748B;margin-bottom:8px}
      .va-badge{font-size:11px;font-weight:800;padding:2px 8px;border-radius:8px;background:#E0E7FF;color:#3730A3}
      .va-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap}
      .va-ok{text-align:center;padding:18px 8px}
      .va-ok b{display:block;font-size:16px;color:#15803D;margin-bottom:4px}
      body.outdoor .va-sheet{background:#102216;color:#F4FFE8}
    `;
    const el = doc.createElement("style");
    el.id = "va-styles";
    el.textContent = css;
    doc.head.appendChild(el);
  }

  function ensureFab() {
    injectStyles();
    let fab = doc.getElementById("va-fab");
    const show = allowed() && !state.open;
    if (!fab && show) {
      fab = doc.createElement("button");
      fab.id = "va-fab";
      fab.className = "va-fab";
      fab.type = "button";
      fab.title = "تسجيل عملية بالصوت (Alt+V)";
      fab.setAttribute("aria-label", "تسجيل عملية بالصوت");
      fab.textContent = "🎙️";
      fab.addEventListener("click", () => open({ autoStart: true }));
      doc.body.appendChild(fab);
    }
    if (fab) fab.style.display = show ? "flex" : "none";
  }

  // ---------------------------------------------------------------- open / close
  function open(opts = {}) {
    if (!allowed()) { say("تسجيل العمليات بالصوت غير متاح لحسابك"); return; }
    if (!VI()) { say("محرك فهم الأوامر لم يتحمل بعد — حدّث الصفحة"); return; }
    injectStyles();
    state.open = true;
    state.saved = null;
    if (opts.text) { state.text = opts.text; state.draft = null; }
    let back = doc.getElementById("va-back");
    if (!back) {
      back = doc.createElement("div");
      back.id = "va-back";
      back.className = "va-back";
      back.addEventListener("click", e => { if (e.target === back) close(); });
      back.addEventListener("click", onClick);
      back.addEventListener("change", onChange);
      back.addEventListener("input", onInput);
      doc.body.appendChild(back);
    }
    paint();
    ensureFab();
    if (opts.text) understand(opts.text);
    else if (opts.autoStart && !state.draft) startRecording();
  }

  function close() {
    stopRecording(true);
    state.open = false;
    const back = doc.getElementById("va-back");
    if (back) back.remove();
    ensureFab();
  }

  function reset() {
    stopRecording(true);
    state.text = "";
    state.draft = null;
    state.saved = null;
    state.source = "local";
    paint();
  }

  // ---------------------------------------------------------------- rendering
  function paint() {
    const back = doc.getElementById("va-back");
    if (!back) return;
    back.innerHTML = `<div class="va-sheet" role="dialog" aria-label="المساعد الصوتي">
      <div class="va-head"><h3>🎙️ تسجيل عملية بالصوت</h3><button type="button" class="va-x" data-vact="close" aria-label="إغلاق">✕</button></div>
      ${state.saved ? savedHtml() : inputHtml() + (state.draft ? cardHtml(state.draft) : "")}
    </div>`;
  }

  function inputHtml() {
    const canListen = speechSupported() || audioSupported();
    const hint = state.recording
      ? (state.mode === "audio" ? "🔴 بسجّل… اضغط تاني لما تخلص" : "🔴 سامعك… اتكلم براحتك، وهيقف لوحده لما تسكت")
      : state.busy ? "⏳ بحاول أفهم الجملة…"
      : canListen ? "اضغط الميكروفون وقول العملية والمكان. مثال: «قلع فسيلة لنخلة 11 قطعة 7 قطاع 3»"
      : "الجهاز ده مش بيدعم التسجيل الصوتي — اكتب الأمر بنفس الطريقة";
    return `
      ${canListen ? `<button type="button" class="va-mic ${state.recording ? "on" : ""}" data-vact="mic" aria-label="${state.recording ? "إيقاف" : "تسجيل"}">${state.recording ? "⏹" : "🎙️"}</button>` : ""}
      <div class="va-hint">${hint}</div>
      <div class="va-row">
        <textarea class="va-text" rows="2" placeholder="الكلام هيظهر هنا، وتقدر تكتب أو تصحح">${esc(state.text)}</textarea>
        <button type="button" class="va-btn va-primary" data-vact="parse" ${state.busy ? "disabled" : ""}>افهم ⚡</button>
      </div>
      ${!state.draft && !state.text ? `<div class="va-chips">
        <button type="button" class="va-chip" data-vact="sample" data-text="تسجيل عملية قلع فسيلة لنخلة رقم 11 قطعة رقم 7 قطاع 3">قلع فسيلة لنخلة 11 قطعة 7 قطاع 3</button>
        <button type="button" class="va-chip" data-vact="sample" data-text="تسجيل عملية ري اضافي لقطعة 2 قطاع 4">ري إضافي لقطعة 2 قطاع 4</button>
        <button type="button" class="va-chip" data-vact="sample" data-text="نخلة 25 قطعة 7 قطاع 3 فيها سوسة">نخلة 25 قطعة 7 قطاع 3 فيها سوسة</button>
      </div>` : ""}`;
  }

  function opOptionsHtml(selectedId) {
    const s = st();
    const types = (s.operationTypes || []).filter(t => !t.inactive);
    const cats = s.operationCats || s.operationCategories || [];
    const catLabel = id => (cats.find(c => c.id === id)?.name) || (typeof catName === "function" ? catName(id) : id) || "أخرى";
    const groups = new Map();
    types.forEach(t => { const k = t.catId || "other"; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t); });
    return `<option value="">— اختار نوع العملية —</option>` + [...groups.entries()].map(([cid, list]) =>
      `<optgroup label="${esc(catLabel(cid))}">${list.map(t => `<option value="${esc(t.id)}" ${String(t.id) === String(selectedId) ? "selected" : ""}>${esc(t.name)}${t.isCritical ? " 🚨" : ""}</option>`).join("")}</optgroup>`
    ).join("");
  }

  const UNITS = ["لتر", "كجم", "جم", "مل", "طن", "م³", "ساعة", "دقيقة", "صندوق", "شيكارة", "جركن", "برميل", "عذق", "فسيلة"];

  function cardHtml(d) {
    const s = st();
    const errs = new Set(d.issues.filter(i => i.level === "error").map(i => i.field));
    const crit = !!(d.opType && d.opType.isCritical);
    const sectorId = d.sector ? d.sector.id : "";
    const plotsInSector = (s.plots || []).filter(p => !sectorId || p.sector === sectorId);
    const plotSel = d.plot ? d.plot.id : "";
    const opT = d.opType ? (s.operationTypes || []).find(t => String(t.id) === String(d.opType.id)) : null;
    const needMat = opT ? (typeof opMaterialRule === "function" ? opMaterialRule(opT.id).show : !!opT.requiresMaterial) : false;
    const ferts = (s.fertilizers || []).filter(f => f.active !== false);
    const levelLabel = { tree: "نخلة واحدة", plot: "قطعة كاملة", sector: "قطاع كامل" }[d.level] || "—";
    const treeCount = countTrees(d);
    const altChips = (d.opAlternatives || []).filter(a => !d.opType || String(a.id) !== String(d.opType.id)).slice(0, 3);
    return `
      <div class="va-card ${d.ready ? "" : "bad"} ${crit ? "crit" : ""}">
        <div class="va-meta">
          <span>${d.ready ? "✅ جاهزة للحفظ — راجع البيانات" : "⚠️ محتاج تكمّل البيانات اللي باللون الأحمر"}</span>
          <span>${state.source === "gemini" ? `<span class="va-badge">🤖 بمساعدة Gemini</span> ` : ""}<span class="va-badge" style="background:#F1F5F9;color:#475569">الدقة ${d.confidence}%</span></span>
        </div>
        <div class="va-grid">
          <div class="va-f full ${errs.has("op") ? "err" : ""}">
            <label>نوع العملية</label>
            <select data-vfield="op">${opOptionsHtml(d.opType ? d.opType.id : "")}</select>
            ${altChips.length ? `<div class="va-chips" style="margin:6px 0 0">${altChips.map(a => `<button type="button" class="va-chip" data-vact="alt-op" data-id="${esc(a.id)}">${esc(a.name)}</button>`).join("")}</div>` : ""}
          </div>
          <div class="va-f ${errs.has("sector") ? "err" : ""}">
            <label>القطاع</label>
            <select data-vfield="sector"><option value="">— القطاع —</option>${(s.sectors || []).map(x => `<option value="${esc(x.id)}" ${x.id === sectorId ? "selected" : ""}>${esc(x.name || x.id)}</option>`).join("")}</select>
          </div>
          <div class="va-f ${errs.has("plot") ? "err" : ""}">
            <label>القطعة</label>
            <select data-vfield="plot"><option value="">${sectorId ? "القطاع كله" : "— القطعة —"}</option>${typeof plotOptionsHtml === "function" ? plotOptionsHtml(plotsInSector, { selected: plotSel }) : plotsInSector.map(p => `<option value="${esc(p.id)}" ${p.id === plotSel ? "selected" : ""}>${esc(p.name || p.id)}</option>`).join("")}</select>
          </div>
          <div class="va-f ${errs.has("palm") ? "err" : ""}">
            <label>رقم النخلة (لو العملية على نخلة واحدة)</label>
            ${d.palmCandidates && d.palmCandidates.length ? `
              <select data-vfield="palmPick"><option value="">— فيه أكتر من نخلة بالرقم ده —</option>${d.palmCandidates.map(p => `<option value="${esc(p.id)}">${esc(p.code)}</option>`).join("")}</select>`
              : `<input data-vfield="palm" inputmode="numeric" value="${esc(d.palm ? (d.palm.seq || "") : (d.slots.palm || ""))}" placeholder="فاضي = القطعة كلها" />`}
            ${d.palm ? `<div class="va-resolved">🌴 ${esc(d.palm.code)}</div>` : ""}
          </div>
          <div class="va-f">
            <label>النطاق</label>
            <div style="font-weight:800;font-size:14px;padding:6px 2px">${levelLabel}${d.level && d.level !== "tree" ? ` • ${treeCount} شجرة` : ""}</div>
          </div>
          ${needMat || d.material ? `
          <div class="va-f ${needMat && !d.material ? "err" : ""}">
            <label>المادة (سماد / مبيد)</label>
            <input data-vfield="material" list="va-mats" value="${esc(d.material ? d.material.name : "")}" placeholder="اختار أو اكتب" />
            <datalist id="va-mats">${ferts.map(f => `<option value="${esc(f.name)}">`).join("")}</datalist>
          </div>` : ""}
          <div class="va-f">
            <label>الكمية</label>
            <div style="display:flex;gap:6px">
              <input data-vfield="qty" type="number" step="any" min="0" value="${d.quantity != null ? esc(d.quantity) : ""}" style="flex:1" />
              <select data-vfield="unit" style="width:92px"><option value=""></option>${UNITS.map(u => `<option ${u === d.unit ? "selected" : ""}>${u}</option>`).join("")}</select>
            </div>
            ${d.level && d.level !== "tree" ? `<label style="display:flex;gap:6px;align-items:center;margin-top:5px;font-size:12px;color:#334155"><input type="checkbox" data-vfield="perTree" ${d.perTree ? "checked" : ""} style="width:auto"> الكمية لكل نخلة</label>` : ""}
          </div>
          <div class="va-f full">
            <label>ملاحظات (اختياري)</label>
            <input data-vfield="notes" value="${esc(d.notes || "")}" placeholder="أي تفاصيل إضافية" />
          </div>
        </div>
        ${d.issues.length ? `<ul class="va-issues">${d.issues.map(i => `<li class="${i.level}">${i.level === "error" ? "⛔" : "⚠️"} ${esc(i.msg)}</li>`).join("")}</ul>` : ""}
        <div class="va-actions">
          <button type="button" class="va-btn va-ghost" data-vact="reset">✕ إلغاء</button>
          <button type="button" class="va-btn ${crit ? "va-danger" : "va-primary"}" data-vact="save" ${d.ready ? "" : "disabled"}>${crit ? "🚨 حفظ البلاغ" : "✓ حفظ العملية"}</button>
        </div>
      </div>`;
  }

  function savedHtml() {
    const s = state.saved;
    return `<div class="va-ok">
      <b>✓ اتسجلت: ${esc(s.type)}</b>
      <div style="color:#475569;font-size:13px">${esc(s.where)}${s.offline ? " — هتتبعت للخادم أول ما النت يرجع" : ""}</div>
      <div class="va-actions" style="justify-content:center;margin-top:16px">
        <button type="button" class="va-btn va-ghost" data-vact="close">إغلاق</button>
        <button type="button" class="va-btn va-primary" data-vact="again">🎙️ سجّل عملية تانية</button>
      </div>
    </div>`;
  }

  function countTrees(d) {
    if (d.level === "tree") return 1;
    const ids = d.plot ? (typeof plotFamilyIds === "function" ? plotFamilyIds(d.plot.id) : [d.plot.id])
      : d.sector ? (st().plots || []).filter(p => p.sector === d.sector.id).map(p => p.id) : [];
    return ids.reduce((n, id) => n + (typeof activePalmsInPlot === "function" ? activePalmsInPlot(id).length : 0), 0);
  }

  function palmIdsOf(d) {
    if (d.level !== "plot" || !d.plot || typeof activePalmsInPlotFamily !== "function") return [];
    return activePalmsInPlotFamily(d.plot.id).map(p => p.id);
  }

  // ---------------------------------------------------------------- understanding
  async function understand(text) {
    text = String(text || "").trim();
    if (!text) { say("قول أو اكتب العملية الأول"); return; }
    state.text = text;
    state.saved = null;
    state.source = "local";
    const ctx = farmCtx();
    state.draft = VI().understand(text, ctx);
    paint();
    // Unsure and online → ask the server (Gemini) for a second reading; the result is re-checked locally
    const d = state.draft;
    const unsure = !d.opType || d.confidence < 80 || d.issues.some(i => i.level === "error" && i.field !== "palm");
    if (unsure && navigator.onLine && typeof Api !== "undefined" && typeof Api.parseVoiceAction === "function") {
      state.busy = true; paint();
      try {
        const res = await Api.parseVoiceAction(text);
        const sd = res && res.success && res.draft;
        if (sd && res.source === "gemini" && state.draft && state.draft.raw === d.raw) {
          const again = VI().understand(res.corrected || text, ctx, { opTypeId: sd.opTypeId, slots: sd.slots });
          if (again.confidence > state.draft.confidence) { state.draft = again; state.source = "gemini"; }
        }
      } catch (e) { /* offline or no key: the local reading stands */ }
      state.busy = false;
      paint();
    }
  }

  function applyEdit(field, value) {
    const d = state.draft;
    if (!d) return;
    const ctx = farmCtx();
    let edits = {};
    if (field === "op") edits = { opTypeId: value || null };
    else if (field === "sector") edits = { sectorId: value || null, plotId: null, slots: { palm: null } };
    else if (field === "plot") edits = { sectorId: d.sector ? d.sector.id : null, plotId: value || null, slots: { palm: d.palm ? String(d.palm.seq) : d.slots.palm } };
    else if (field === "palm") edits = { sectorId: d.sector ? d.sector.id : null, plotId: d.plot ? d.plot.id : null, slots: { palm: value || null } };
    else if (field === "palmPick") edits = value ? { palmId: value } : {};
    else if (field === "material") {
      const f = (st().fertilizers || []).find(x => x.name === value);
      d.material = value ? (f ? { id: f.id, name: f.name, kind: f.kind, unit: f.unit, fromList: true } : { id: null, name: value, fromList: false }) : null;
      edits = { material: d.material };
    }
    else if (field === "qty") { d.quantity = value === "" ? null : parseFloat(value); return; }
    else if (field === "unit") { d.unit = value || null; return; }
    else if (field === "perTree") { d.perTree = !!value; return; }
    else if (field === "notes") { d.notes = value; return; }
    // keep the user's palm / plot choices when only the operation changes
    if (field === "op" && (d.palm || d.plot || d.sector)) {
      edits = Object.assign(edits, d.palm ? { palmId: d.palm.id } : { sectorId: d.sector ? d.sector.id : null, plotId: d.plot ? d.plot.id : null });
    }
    const keep = { notes: d.notes, quantity: d.quantity, unit: d.unit, perTree: d.perTree, material: d.material };
    state.draft = Object.assign(VI().revalidate(d, edits, ctx), keep, field === "material" ? { material: d.material } : {});
    paint();
  }

  // ---------------------------------------------------------------- saving
  function save() {
    const d = state.draft;
    if (!d || !d.ready || !d.opType) return;
    if (typeof hasPerm === "function" && !hasPerm("ops_record")) { say("ليس لديك صلاحية تسجيل عمليات"); return; }
    const s = st();
    const u = me() || {};
    const type = (s.operationTypes || []).find(t => String(t.id) === String(d.opType.id)) || d.opType;
    const now = new Date().toISOString();
    const treeCount = countTrees(d);
    const mat = d.material ? d.material.name : "";
    const qtyStr = d.quantity ? `${d.quantity} ${d.unit || ""}`.trim() + (d.perTree && d.level !== "tree" ? "/شجرة" : "") : "";
    const matBit = mat || qtyStr ? `[${[mat, qtyStr].filter(Boolean).join(" • ")}] ` : "";
    const notes = `🎙️ ${matBit}${d.notes ? d.notes + " — " : ""}«${d.raw}»`;
    const batch = d.level === "tree" ? null : Store.uid("bk");
    const op = {
      id: Store.uid("op"),
      typeId: type.id,
      at: now,
      photos: [],
      notes,
      workerId: u.id,
      status: "pending",
      approval: "pending",
      device: "voice",
      supervisorNote: "",
      targetLevel: d.level,
      sectorId: d.sector ? d.sector.id : null,
      plotId: d.plot ? d.plot.id : null,
      treeCount
    };
    if (d.level === "tree") {
      op.palmId = d.palm.id;
      op.palmCode = d.palm.code;
    } else {
      op.palmId = null;
      op.bulkId = batch;
      op.batchId = batch;
      if (d.level === "plot") op.palmIds = palmIdsOf(d);
    }
    if (mat) { op.material = mat; if (d.quantity) { op.materialQty = d.quantity; op.materialUnit = d.unit; } }

    // infection report on one tree → mark the tree, like the manual form does
    const palm = d.level === "tree" ? (s.palms || []).find(p => String(p.id) === String(d.palm.id)) : null;
    if (palm && type.isCritical) {
      Object.assign(palm, { status: "مصابة", statusId: 3, statusCode: "infected", badgeColor: "#DC2626", badgeBg: "#FEE2E2", modifiedBy: u.name || u.user, modifiedAt: now });
      if (typeof Api !== "undefined" && typeof Api.updatePalm === "function") Api.updatePalm(palm);
    }

    // inventory: deduct the total used when the material is one of the farm's items
    const fert = d.material && d.material.fromList ? (s.fertilizers || []).find(f => f.id === d.material.id || f.name === d.material.name) : null;
    if (fert && d.quantity > 0) {
      let total = d.perTree && d.level !== "tree" ? d.quantity * treeCount : d.quantity;
      if (fert.unit === "كجم" && d.unit === "جم") total /= 1000;
      else if (fert.unit === "جم" && d.unit === "كجم") total *= 1000;
      if ((fert.allocated || 0) >= total) fert.allocated -= total;
      else { const rem = total - (fert.allocated || 0); fert.allocated = 0; fert.stock = Math.max(0, (fert.stock || 0) - rem); }
      fert.consumed = (fert.consumed || 0) + total;
    }

    s.operations = s.operations || [];
    s.operations.push(op);
    Store.set({ operations: s.operations, palms: s.palms, fertilizers: s.fertilizers });
    const where = d.level === "tree" ? d.palm.code
      : d.level === "plot" ? `${d.plot.name || d.plot.id}${d.sector ? " — " + d.sector.name : ""} (${treeCount} شجرة)`
      : `${d.sector.name} (${treeCount} شجرة)`;
    if (typeof enqueue === "function") enqueue("عملية صوتية: " + type.name, where);
    if (typeof Api !== "undefined" && typeof Api.createOperation === "function") Api.createOperation(op);
    if (typeof AuditLog !== "undefined" && typeof AuditLog.log === "function") {
      AuditLog.log({
        action: type.isCritical ? "pest_alert_voice" : "voice_operation",
        module: "operations",
        severity: type.isCritical ? "critical" : "info",
        title: `تسجيل صوتي: ${type.name}`,
        summary: `${type.name} — ${where}`,
        details: { opId: op.id, typeId: type.id, level: d.level, sectorId: op.sectorId, plotId: op.plotId, palmCode: op.palmCode || null, material: mat || null, quantity: d.quantity, unit: d.unit, spoken: d.raw, confidence: d.confidence, source: state.source },
        targetType: "operation",
        targetId: op.id,
        targetCount: treeCount,
        user: u.name || u.user,
        role: u.role
      });
    }
    if (typeof window.playPulseChime === "function") window.playPulseChime();
    state.saved = { type: type.name, where, offline: !navigator.onLine };
    state.draft = null;
    state.text = "";
    paint();
    if (typeof render === "function" && !doc.querySelector("#app input:focus, #app textarea:focus")) render();
  }

  // ---------------------------------------------------------------- recording
  function startRecording() {
    if (state.recording) return;
    if (speechSupported()) return startSpeech();
    if (audioSupported()) return startAudio();
    say("الجهاز ده مش بيدعم التسجيل الصوتي — اكتب الأمر");
  }

  function stopRecording(silent) {
    clearTimeout(state.silenceTimer);
    if (state.rec) { try { state.rec.onend = null; state.rec.stop(); } catch (e) {} state.rec = null; }
    if (state.media && state.media.state !== "inactive") {
      if (silent) state.media.onstop = null;
      try { state.media.stop(); } catch (e) {}
    }
    if (silent && state.media) { try { state.media.stream.getTracks().forEach(t => t.stop()); } catch (e) {} state.media = null; }
    const was = state.recording;
    state.recording = false;
    return was;
  }

  function startSpeech() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "ar-EG";
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;
    let finalText = "";
    const armSilence = () => { clearTimeout(state.silenceTimer); state.silenceTimer = setTimeout(() => { try { rec.stop(); } catch (e) {} }, 3500); };
    rec.onstart = () => { state.recording = true; state.mode = "speech"; state.draft = null; state.saved = null; paint(); armSilence(); };
    rec.onresult = ev => {
      armSilence();
      let interim = "";
      finalText = "";
      for (let i = 0; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) finalText += r[0].transcript + " "; else interim += r[0].transcript + " ";
      }
      state.text = (finalText + interim).trim();
      const ta = doc.querySelector("#va-back .va-text");
      if (ta) ta.value = state.text;
    };
    rec.onerror = ev => {
      clearTimeout(state.silenceTimer);
      state.recording = false; state.rec = null;
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") say("اسمح للتطبيق باستخدام الميكروفون من إعدادات المتصفح");
      else if (ev.error === "network") say("التعرف على الكلام محتاج نت — اكتب الأمر أو جرّب تاني");
      else if (ev.error !== "no-speech" && ev.error !== "aborted") say("مشكلة في التسجيل: " + ev.error);
      paint();
    };
    rec.onend = () => {
      clearTimeout(state.silenceTimer);
      state.recording = false; state.rec = null;
      paint();
      if (state.text && state.text.length > 2) understand(state.text);
    };
    state.rec = rec;
    try { rec.start(); } catch (e) { state.rec = null; say("تعذر تشغيل الميكروفون"); }
  }

  async function startAudio() {
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) { say("اسمح للتطبيق باستخدام الميكروفون من إعدادات المتصفح"); return; }
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find(m => window.MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || "";
    const media = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    state.chunks = [];
    media.ondataavailable = e => { if (e.data && e.data.size) state.chunks.push(e.data); };
    media.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      state.recording = false; state.media = null;
      const blob = new Blob(state.chunks, { type: media.mimeType || "audio/webm" });
      if (blob.size < 1500) { paint(); return; }
      if (!navigator.onLine) { say("تحويل الصوت لنص على الجهاز ده محتاج نت — اكتب الأمر"); paint(); return; }
      state.busy = true; paint();
      const b64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result)); fr.readAsDataURL(blob); });
      const res = typeof Api !== "undefined" && Api.transcribeVoice ? await Api.transcribeVoice(b64, blob.type) : null;
      state.busy = false;
      if (res && res.success && res.text) { state.text = res.text; understand(res.text); }
      else { say((res && res.error) || "تعذر تحويل التسجيل لنص"); paint(); }
    };
    state.media = media;
    state.mode = "audio";
    state.recording = true; state.draft = null; state.saved = null;
    media.start();
    clearTimeout(state.silenceTimer);
    state.silenceTimer = setTimeout(() => { if (state.media === media && media.state !== "inactive") media.stop(); }, 30000); // hard cap 30 s
    paint();
  }

  // ---------------------------------------------------------------- events
  function onClick(e) {
    const b = e.target.closest("[data-vact]");
    if (!b) return;
    const a = b.dataset.vact;
    if (a === "close") close();
    else if (a === "mic") { if (state.recording) { const wasAudio = state.mode === "audio"; stopRecording(false); if (!wasAudio) paint(); } else startRecording(); }
    else if (a === "parse") { const ta = doc.querySelector("#va-back .va-text"); stopRecording(true); understand(ta ? ta.value : state.text); }
    else if (a === "sample") { state.text = b.dataset.text; understand(b.dataset.text); }
    else if (a === "alt-op") applyEdit("op", b.dataset.id);
    else if (a === "reset") reset();
    else if (a === "save") save();
    else if (a === "again") { reset(); startRecording(); }
  }
  function onChange(e) {
    const f = e.target.closest("[data-vfield]");
    if (!f) return;
    const v = f.type === "checkbox" ? f.checked : f.value;
    applyEdit(f.dataset.vfield, v);
  }
  function onInput(e) {
    if (e.target.classList && e.target.classList.contains("va-text")) { state.text = e.target.value; return; }
    const f = e.target.closest("[data-vfield]");
    if (f && (f.dataset.vfield === "notes" || f.dataset.vfield === "qty") && state.draft) {
      if (f.dataset.vfield === "notes") state.draft.notes = f.value;
      else state.draft.quantity = f.value === "" ? null : parseFloat(f.value);
    }
  }

  doc.addEventListener("keydown", e => {
    if (e.altKey && (e.key === "v" || e.key === "V" || e.code === "KeyV")) { e.preventDefault(); state.open ? close() : open({ autoStart: true }); }
    else if (e.key === "Escape" && state.open) close();
  });

  // Show/hide the button after every app render (login, logout, role change)
  function hookRender() {
    if (typeof window.render !== "function" || window.render._vaHooked) return;
    const orig = window.render;
    const wrapped = function () { const r = orig.apply(this, arguments); try { ensureFab(); } catch (e) {} return r; };
    wrapped._vaHooked = true;
    window.render = wrapped;
  }

  function boot() {
    hookRender();
    ensureFab();
    // app-icon shortcut: index.html#voice
    if (location.hash === "#voice") {
      const tryOpen = (n) => { if (allowed()) { history.replaceState(null, "", location.pathname + location.search); open({}); } else if (n > 0) setTimeout(() => tryOpen(n - 1), 700); };
      tryOpen(15);
    }
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else setTimeout(boot, 0);

  window.VoiceAssistant = { open, close, refresh: ensureFab };
})(window);
