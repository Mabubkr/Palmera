// Real field data for the AI hub: weather / reference evapotranspiration (Open-Meteo, FAO-56 ET₀)
// and satellite vegetation index per plot (AgroMonitoring: Sentinel-2 + Landsat-8 NDVI statistics).
//
// All outside calls happen here, on the server, so API keys never reach a browser.
// Results are cached (weather in memory, NDVI in the database) so screens stay fast and work
// for a while without internet.
const crypto = require('node:crypto');
const db = require('../db');

let fetchImpl = (...a) => fetch(...a);
const setFetch = f => { fetchImpl = f; }; // tests

const AGRO_BASE = 'https://api.agromonitoring.com/agro/1.0';

// ---------------------------------------------------------------- settings
function settingRaw(key) {
  const r = db.get('SELECT value FROM system_settings WHERE key = ?', key);
  if (!r || r.value == null) return null;
  try { return JSON.parse(r.value); } catch { return r.value; }
}
const settingStr = key => { const v = settingRaw(key); return v == null ? '' : String(v).trim(); };
function agriSettings() {
  const v = settingRaw('agriSettings');
  return v && typeof v === 'object' ? v : {};
}
const agroKey = () => settingStr('agroMonitoringKey') || String(process.env.AGROMONITORING_API_KEY || '').trim();
const openMeteoKey = () => settingStr('openMeteoKey') || String(process.env.OPEN_METEO_API_KEY || '').trim();

// ---------------------------------------------------------------- geometry
function parseRing(v) {
  let a = v;
  if (typeof a === 'string') { try { a = JSON.parse(a); } catch { return null; } }
  if (!Array.isArray(a)) return null;
  const pts = a.filter(p => Array.isArray(p) && p.length >= 2 && isFinite(p[0]) && isFinite(p[1])).map(p => [Number(p[0]), Number(p[1])]); // [lat, lng]
  return pts.length >= 3 ? pts : null;
}

// Convex hull (Andrew's monotone chain) of [lat, lng] points
function hull(points) {
  const p = [...new Map(points.map(x => [x[0].toFixed(7) + ',' + x[1].toFixed(7), x])).values()].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[1] - o[1]) * (b[0] - o[0]) - (a[0] - o[0]) * (b[1] - o[1]);
  const lower = [], upper = [];
  for (const x of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], x) <= 0) lower.pop(); lower.push(x); }
  for (let i = p.length - 1; i >= 0; i--) { const x = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], x) <= 0) upper.pop(); upper.push(x); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

// Area in hectares of a small [lat, lng] ring (local equirectangular projection)
function areaHa(ring) {
  if (!ring || ring.length < 3) return 0;
  const lat0 = ring.reduce((s, p) => s + p[0], 0) / ring.length * Math.PI / 180;
  const R = 6371008.8;
  const xy = ring.map(p => [p[1] * Math.PI / 180 * R * Math.cos(lat0), p[0] * Math.PI / 180 * R]);
  let a = 0;
  for (let i = 0; i < xy.length; i++) { const [x1, y1] = xy[i]; const [x2, y2] = xy[(i + 1) % xy.length]; a += x1 * y2 - x2 * y1; }
  return Math.abs(a) / 2 / 10000;
}

// Main plots (no parent) with the outline of the plot + all its sub-plots
function mainPlotGeometries() {
  const plots = db.all(`SELECT id, name, sector_id AS sector, parent_plot_id AS parent, boundary_coordinates AS boundary, center_lat AS lat, center_lng AS lng, area_value AS area, area_unit AS unit
                        FROM plots WHERE sector_id IN (SELECT id FROM sectors WHERE is_deleted = 0 OR is_deleted IS NULL)`);
  const byParent = new Map();
  plots.forEach(p => { if (p.parent) { if (!byParent.has(p.parent)) byParent.set(p.parent, []); byParent.get(p.parent).push(p); } });
  const family = id => { const out = [id]; for (let i = 0; i < out.length; i++) (byParent.get(out[i]) || []).forEach(k => out.push(k.id)); return out; };
  const byId = new Map(plots.map(p => [p.id, p]));
  return plots.filter(p => !p.parent || !byId.has(p.parent)).map(p => {
    const ids = family(p.id);
    const pts = ids.flatMap(id => parseRing(byId.get(id)?.boundary) || []);
    const ring = pts.length >= 3 ? hull(pts) : null;
    return {
      plotId: p.id, name: p.name, sector: p.sector, familyIds: ids,
      ring, areaHa: ring ? areaHa(ring) : null,
      hash: ring ? crypto.createHash('sha1').update(JSON.stringify(ring.map(x => [x[0].toFixed(6), x[1].toFixed(6)]))).digest('hex').slice(0, 16) : null
    };
  });
}

// ---------------------------------------------------------------- farm location
function farmLocation() {
  const s = agriSettings();
  const lat = parseFloat(s.farmLat), lng = parseFloat(s.farmLng);
  if (isFinite(lat) && isFinite(lng) && lat && lng) return { lat, lng, source: 'settings' };
  const c = db.get('SELECT AVG(center_lat) AS lat, AVG(center_lng) AS lng, COUNT(*) AS n FROM plots WHERE center_lat IS NOT NULL AND center_lng IS NOT NULL');
  if (c && c.n && isFinite(c.lat) && isFinite(c.lng)) return { lat: Number(c.lat.toFixed(4)), lng: Number(c.lng.toFixed(4)), source: 'plots' };
  const rows = db.all("SELECT boundary_coordinates AS b FROM sectors WHERE boundary_coordinates IS NOT NULL AND boundary_coordinates != ''");
  const pts = rows.flatMap(r => parseRing(r.b) || []);
  if (pts.length) return { lat: Number((pts.reduce((a, p) => a + p[0], 0) / pts.length).toFixed(4)), lng: Number((pts.reduce((a, p) => a + p[1], 0) / pts.length).toFixed(4)), source: 'sectors' };
  return null;
}

// ---------------------------------------------------------------- weather (Open-Meteo)
let weatherCache = { key: null, at: 0, data: null };
const WEATHER_TTL = 3 * 3600 * 1000;

async function getWeather({ force = false } = {}) {
  const loc = farmLocation();
  if (!loc) return { success: false, error: 'موقع المزرعة غير معروف — ارسم حدود القطع على الخريطة أو أدخل الإحداثيات في إعدادات الذكاء الاصطناعي' };
  const key = `${loc.lat},${loc.lng}`;
  if (!force && weatherCache.data && weatherCache.key === key && Date.now() - weatherCache.at < WEATHER_TTL) return weatherCache.data;
  const apiKey = openMeteoKey();
  const host = apiKey ? 'https://customer-api.open-meteo.com' : 'https://api.open-meteo.com';
  const vars = 'et0_fao_evapotranspiration,temperature_2m_max,temperature_2m_min,temperature_2m_mean,relative_humidity_2m_mean,precipitation_sum,wind_speed_10m_max';
  const url = `${host}/v1/forecast?latitude=${loc.lat}&longitude=${loc.lng}&daily=${vars}&past_days=21&forecast_days=7&timezone=auto${apiKey ? '&apikey=' + encodeURIComponent(apiKey) : ''}`;
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    const d = j.daily || {};
    if (!Array.isArray(d.time) || !d.time.length) throw new Error('رد غير متوقع من خدمة الطقس');
    const today = new Date().toLocaleDateString('en-CA', { timeZone: j.timezone || 'UTC' });
    const data = {
      success: true,
      provider: 'Open-Meteo',
      commercial: Boolean(apiKey),
      location: loc,
      timezone: j.timezone || null,
      fetchedAt: new Date().toISOString(),
      todayIndex: Math.max(0, d.time.indexOf(today)),
      daily: {
        time: d.time,
        et0: d.et0_fao_evapotranspiration || [],
        tmax: d.temperature_2m_max || [],
        tmin: d.temperature_2m_min || [],
        tmean: d.temperature_2m_mean || [],
        rh: d.relative_humidity_2m_mean || [],
        rain: d.precipitation_sum || [],
        wind: d.wind_speed_10m_max || []
      }
    };
    weatherCache = { key, at: Date.now(), data };
    return data;
  } catch (err) {
    if (weatherCache.data && weatherCache.key === key) return Object.assign({}, weatherCache.data, { stale: true, staleReason: err.message });
    return { success: false, error: 'تعذر الوصول لخدمة الطقس: ' + err.message, location: loc };
  }
}

// ---------------------------------------------------------------- satellite (AgroMonitoring)
async function agroCall(path, { method = 'GET', body, key } = {}) {
  const k = key || agroKey();
  if (!k) throw Object.assign(new Error('مفتاح AgroMonitoring غير مُعد'), { code: 'NO_KEY' });
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetchImpl(`${AGRO_BASE}${path}${sep}appid=${encodeURIComponent(k)}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000)
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  if (!res.ok) {
    const msg = (json && (json.message || json.error)) || text.slice(0, 160) || ('HTTP ' + res.status);
    throw Object.assign(new Error(res.status === 401 ? 'مفتاح AgroMonitoring غير صحيح أو غير مفعّل' : msg), { status: res.status });
  }
  return json;
}

const MIN_HA = 1, MAX_HA = 3000; // provider limits per polygon
const sleep = ms => new Promise(r => setTimeout(r, ms));

let syncRunning = null;

/**
 * Creates provider polygons for main plots that have an outline, then pulls NDVI history.
 * opts: { maxPlots, monthsBack, pauseMs }
 */
async function syncNdvi(opts = {}) {
  if (syncRunning) return { success: false, error: 'التحديث شغال بالفعل — استنى دقيقة' };
  const run = (async () => {
    const maxPlots = opts.maxPlots || 40;
    const monthsBack = opts.monthsBack || 12;
    const pauseMs = opts.pauseMs != null ? opts.pauseMs : 1100; // free plan: 60 calls / minute
    if (!agroKey()) return { success: false, error: 'لازم تضيف مفتاح AgroMonitoring من إعدادات الذكاء الاصطناعي الأول', code: 'NO_KEY' };
    const geoms = mainPlotGeometries();
    const withShape = geoms.filter(g => g.ring);
    const known = new Map(db.all('SELECT * FROM agro_polygons').map(r => [r.plot_id, r]));
    // oldest-synced first, so repeated runs walk through a big farm
    withShape.sort((a, b) => String(known.get(a.plotId)?.last_sync_at || '').localeCompare(String(known.get(b.plotId)?.last_sync_at || '')));
    const summary = { success: true, plotsTotal: geoms.length, plotsWithShape: withShape.length, processed: 0, polygonsCreated: 0, polygonsReused: 0, observationsAdded: 0, emptyHistory: 0, skipped: [], errors: [] };
    // Polygons already registered with the provider (by name). A free server forgets its local table
    // on every restart; re-using the provider's polygon keeps its imagery history (a new polygon on the
    // free plan waits a few days for its first images).
    let remote = new Map();
    try {
      const list = await agroCall('/polygons');
      (Array.isArray(list) ? list : []).forEach(pg => {
        const m = /^PalmTrace (.+)$/.exec(String(pg.name || ''));
        if (!m) return;
        const prev = remote.get(m[1]);
        if (!prev || Number(pg.created_at || 0) < Number(prev.created_at || 0)) remote.set(m[1], pg); // oldest = longest history
      });
    } catch (err) {
      if (err.status === 401 || err.code === 'NO_KEY') return { success: false, error: err.message };
    }
    const nowSec = Math.floor(Date.now() / 1000);
    const insert = db.db.prepare(`INSERT OR IGNORE INTO ndvi_observations (plot_id, dt, source, cloud, coverage, mean, median, min, max, std, p25, p75, num)
                                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const g of withShape.slice(0, maxPlots)) {
      if (g.areaHa < MIN_HA) { summary.skipped.push({ plotId: g.plotId, reason: `مساحتها ${g.areaHa.toFixed(2)} هكتار — أقل من الحد الأدنى للخدمة (1 هكتار)` }); continue; }
      if (g.areaHa > MAX_HA) { summary.skipped.push({ plotId: g.plotId, reason: 'أكبر من الحد الأقصى للخدمة (3000 هكتار)' }); continue; }
      try {
        let row = known.get(g.plotId);
        const existing = remote.get(g.plotId);
        if (!row && existing && existing.id) {
          db.db.prepare(`INSERT INTO agro_polygons (plot_id, polygon_id, area_ha, geom_hash) VALUES (?, ?, ?, ?)
                         ON CONFLICT(plot_id) DO UPDATE SET polygon_id = excluded.polygon_id, area_ha = excluded.area_ha, geom_hash = excluded.geom_hash`)
            .run(g.plotId, String(existing.id), Number(existing.area) || g.areaHa, g.hash);
          row = { plot_id: g.plotId, polygon_id: String(existing.id), geom_hash: g.hash };
          summary.polygonsReused++;
        }
        if (!row || row.geom_hash !== g.hash) {
          if (row) { try { await agroCall(`/polygons/${encodeURIComponent(row.polygon_id)}`, { method: 'DELETE' }); } catch {} }
          const coords = g.ring.map(p => [p[1], p[0]]); // GeoJSON is [lng, lat]
          coords.push(coords[0]);
          const created = await agroCall('/polygons?duplicated=true', {
            method: 'POST',
            body: { name: `PalmTrace ${g.plotId}`, geo_json: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coords] } } }
          });
          if (!created || !created.id) throw new Error('لم يُرجع المزود رقم المضلع');
          db.db.prepare(`INSERT INTO agro_polygons (plot_id, polygon_id, area_ha, geom_hash) VALUES (?, ?, ?, ?)
                         ON CONFLICT(plot_id) DO UPDATE SET polygon_id = excluded.polygon_id, area_ha = excluded.area_ha, geom_hash = excluded.geom_hash, created_at = CURRENT_TIMESTAMP`)
            .run(g.plotId, String(created.id), Number(created.area) || g.areaHa, g.hash);
          db.db.prepare('DELETE FROM ndvi_observations WHERE plot_id = ?').run(g.plotId); // new outline → old numbers no longer comparable
          row = { plot_id: g.plotId, polygon_id: String(created.id) };
          summary.polygonsCreated++;
          if (pauseMs) await sleep(pauseMs);
        }
        const last = db.get('SELECT MAX(dt) AS dt FROM ndvi_observations WHERE plot_id = ?', g.plotId)?.dt;
        const start = last ? last + 1 : nowSec - monthsBack * 30 * 86400;
        const hist = await agroCall(`/ndvi/history?polyid=${encodeURIComponent(row.polygon_id)}&start=${start}&end=${nowSec}`);
        let added = 0;
        (Array.isArray(hist) ? hist : []).forEach(h => {
          const d = h && h.data;
          if (!d || !isFinite(d.mean)) return;
          const r = insert.run(g.plotId, Number(h.dt), String(h.source || ''), num(h.cl), num(h.dc), num(d.mean), num(d.median), num(d.min), num(d.max), num(d.std), num(d.p25), num(d.p75), d.num != null ? Number(d.num) : null);
          added += r.changes || 0;
        });
        db.db.prepare('UPDATE agro_polygons SET last_sync_at = CURRENT_TIMESTAMP WHERE plot_id = ?').run(g.plotId);
        if (!Array.isArray(hist) || !hist.length) { if (!last) summary.emptyHistory++; }
        summary.observationsAdded += added;
        summary.processed++;
      } catch (err) {
        summary.errors.push({ plotId: g.plotId, error: err.message });
        if (err.status === 401 || err.code === 'NO_KEY') { summary.success = false; summary.error = err.message; break; }
      }
      if (pauseMs) await sleep(pauseMs);
    }
    if (withShape.length > maxPlots) summary.remaining = withShape.length - maxPlots;
    summary.noShape = geoms.length - withShape.length;
    const put = (k, v) => { try { db.db.prepare(`INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
                         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`).run(k, JSON.stringify(v)); } catch {} };
    put('ndvi_last_sync', new Date().toISOString());
    put('ndvi_last_result', {
      at: new Date().toISOString(), success: summary.success, error: summary.error || null,
      processed: summary.processed, polygonsCreated: summary.polygonsCreated, polygonsReused: summary.polygonsReused,
      observationsAdded: summary.observationsAdded, emptyHistory: summary.emptyHistory,
      skipped: summary.skipped.length, errors: summary.errors.slice(0, 5)
    });
    return summary;
  })();
  syncRunning = run;
  try { return await run; } finally { syncRunning = null; }
}
const num = v => (v == null || v === '' || !isFinite(v)) ? null : Number(v);

/**
 * NDVI summary per main plot. plotFilter: Set of visible plot ids (investors) or null for all.
 * Only "usable" passes (cloud ≤ 30 %, coverage ≥ 70 %) feed the latest value and the trend.
 */
function ndviSummary(plotFilter = null) {
  const geoms = mainPlotGeometries().filter(g => !plotFilter || g.familyIds.some(id => plotFilter.has(String(id))));
  const polys = new Map(db.all('SELECT plot_id, polygon_id, area_ha, last_sync_at FROM agro_polygons').map(r => [r.plot_id, r]));
  const since = Math.floor(Date.now() / 1000) - 400 * 86400;
  const obs = db.all('SELECT plot_id, dt, source, cloud, coverage, mean, min, max, median, std FROM ndvi_observations WHERE dt >= ? ORDER BY dt', since);
  const byPlot = new Map();
  obs.forEach(o => { if (!byPlot.has(o.plot_id)) byPlot.set(o.plot_id, []); byPlot.get(o.plot_id).push(o); });
  const usable = o => (o.cloud == null || o.cloud <= 30) && (o.coverage == null || o.coverage >= 70) && o.mean != null;
  const plots = geoms.map(g => {
    const all = (byPlot.get(g.plotId) || []);
    const good = all.filter(usable);
    const latest = good[good.length - 1] || null;
    // reference: the best pass 10–45 days before the latest one
    let prev = null;
    if (latest) {
      const win = good.filter(o => o.dt <= latest.dt - 10 * 86400 && o.dt >= latest.dt - 45 * 86400);
      prev = win.length ? win[win.length - 1] : null;
    }
    const monthly = {};
    good.forEach(o => { const m = new Date(o.dt * 1000).toISOString().slice(0, 7); (monthly[m] = monthly[m] || []).push(o.mean); });
    const p = polys.get(g.plotId);
    return {
      plotId: g.plotId, name: g.name, sector: g.sector,
      hasShape: Boolean(g.ring), areaHa: g.areaHa != null ? Number(g.areaHa.toFixed(2)) : null,
      tooSmall: g.areaHa != null && g.areaHa < MIN_HA,
      linked: Boolean(p), lastSyncAt: p ? p.last_sync_at : null,
      observations: all.length, usableObservations: good.length,
      latest: latest && { date: new Date(latest.dt * 1000).toISOString().slice(0, 10), mean: round(latest.mean), min: round(latest.min), max: round(latest.max), std: round(latest.std), cloud: round(latest.cloud, 1), coverage: round(latest.coverage, 1), source: latest.source },
      previous: prev && { date: new Date(prev.dt * 1000).toISOString().slice(0, 10), mean: round(prev.mean) },
      change: latest && prev ? round(latest.mean - prev.mean) : null,
      monthly: Object.keys(monthly).sort().slice(-12).map(m => ({ month: m, mean: round(monthly[m].reduce((a, b) => a + b, 0) / monthly[m].length) }))
    };
  });
  const latestMeans = plots.filter(p => p.latest).map(p => p.latest.mean).sort((a, b) => a - b);
  const median = latestMeans.length ? latestMeans[Math.floor(latestMeans.length / 2)] : null;
  return {
    success: true,
    configured: Boolean(agroKey()),
    lastSync: settingRaw('ndvi_last_sync') || null,
    lastResult: settingRaw('ndvi_last_result') || null,
    farmMedian: median,
    plots
  };
}
const round = (v, d = 3) => v == null ? null : Number(Number(v).toFixed(d));

// ---------------------------------------------------------------- connection test (admin)
async function testConnections({ agroMonitoringKey, openMeteoKey: omKey } = {}) {
  const out = {};
  // weather
  const loc = farmLocation() || { lat: 27.0, lng: 28.4, source: 'default' };
  try {
    const key = omKey != null && omKey !== '' ? omKey : openMeteoKey();
    const host = key ? 'https://customer-api.open-meteo.com' : 'https://api.open-meteo.com';
    const r = await fetchImpl(`${host}/v1/forecast?latitude=${loc.lat}&longitude=${loc.lng}&daily=et0_fao_evapotranspiration&forecast_days=1&timezone=auto${key ? '&apikey=' + encodeURIComponent(key) : ''}`, { signal: AbortSignal.timeout(10000) });
    const j = await r.json().catch(() => null);
    const et0 = j && j.daily && j.daily.et0_fao_evapotranspiration && j.daily.et0_fao_evapotranspiration[0];
    out.weather = r.ok && et0 != null
      ? { ok: true, message: `يعمل — البخر-نتح المرجعي اليوم ${et0} مم عند (${loc.lat}, ${loc.lng})`, commercial: Boolean(key) }
      : { ok: false, message: (j && j.reason) || ('HTTP ' + r.status) };
  } catch (err) { out.weather = { ok: false, message: 'تعذر الوصول: ' + err.message }; }
  // satellite
  const aKey = agroMonitoringKey || agroKey();
  if (!aKey) out.satellite = { ok: false, message: 'لم يُدخل مفتاح AgroMonitoring' };
  else {
    try {
      const list = await agroCall('/polygons', { key: aKey });
      const n = Array.isArray(list) ? list.length : 0;
      const ha = Array.isArray(list) ? list.reduce((s, p) => s + (Number(p.area) || 0), 0) : 0;
      out.satellite = { ok: true, message: `المفتاح صحيح — ${n} مضلع مسجل (${ha.toFixed(1)} هكتار)` };
    } catch (err) { out.satellite = { ok: false, message: err.message }; }
  }
  const geoms = mainPlotGeometries();
  const withShape = geoms.filter(g => g.ring);
  out.plots = {
    total: geoms.length,
    withShape: withShape.length,
    eligible: withShape.filter(g => g.areaHa >= MIN_HA && g.areaHa <= MAX_HA).length,
    totalHa: Number(withShape.reduce((s, g) => s + g.areaHa, 0).toFixed(1))
  };
  out.location = farmLocation();
  return out;
}

function status() {
  return {
    weather: { provider: 'Open-Meteo', commercialKey: Boolean(openMeteoKey()), location: farmLocation() },
    satellite: { provider: 'AgroMonitoring', configured: Boolean(agroKey()), lastSync: settingRaw('ndvi_last_sync') || null, linkedPlots: db.get('SELECT COUNT(*) AS n FROM agro_polygons')?.n || 0 }
  };
}

module.exports = { getWeather, syncNdvi, ndviSummary, testConnections, status, farmLocation, mainPlotGeometries, hull, areaHa, setFetch };
