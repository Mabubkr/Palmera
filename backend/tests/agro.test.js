// lib/agro.js against a fake satellite / weather provider (no network).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'palmtrace-agro-'));
process.env.DB_PATH = path.join(dir, 'agro.db');
process.env.DATA_DIR = dir;
const db = require('../db');
const { runVersionedMigrations } = require('../migrations/runner');

test.before(() => {
  db.db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT, updated_at DATETIME);
    CREATE TABLE IF NOT EXISTS sectors (id TEXT PRIMARY KEY, name TEXT, is_deleted INTEGER DEFAULT 0, boundary_coordinates TEXT);
    CREATE TABLE IF NOT EXISTS plots (id TEXT PRIMARY KEY, name TEXT, sector_id TEXT, parent_plot_id TEXT, boundary_coordinates TEXT, center_lat REAL, center_lng REAL, area_value REAL, area_unit TEXT);
  `);
  runVersionedMigrations(db.db, 'late');
  db.db.exec(`DELETE FROM plots; DELETE FROM sectors; INSERT INTO sectors (id, name) VALUES ('S1', 'قطاع 1');`);
  // main plot P1 = two 1.05 ha halves side by side; P2 = one tiny 0.5 ha plot
  const sq = (lat, lng, dLat, dLng) => JSON.stringify([[lat, lng], [lat, lng + dLng], [lat + dLat, lng + dLng], [lat + dLat, lng], [lat, lng]]);
  const ins = db.db.prepare('INSERT INTO plots (id, name, sector_id, plot_no, part_letter, parent_plot_id, boundary_coordinates, center_lat, center_lng) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  ins.run('P1', 'قطعة 1', 'S1', '01', '', null, null, null, null);
  ins.run('P1A', 'قطعة 1A', 'S1', '01', 'A', 'P1', sq(27.0, 28.38, 0.00095, 0.00112), 27.0005, 28.3805);
  ins.run('P1B', 'قطعة 1B', 'S1', '01', 'B', 'P1', sq(27.0, 28.38112, 0.00095, 0.00112), 27.0005, 28.3817);
  ins.run('P2', 'قطعة 2', 'S1', '02', '', null, sq(27.01, 28.39, 0.0004, 0.0005), 27.0102, 28.3902);
});
test.after(() => { try { db.db.close(); } catch {} fs.rmSync(dir, { recursive: true, force: true }); });

const Agro = require('../lib/agro');

test('outline of a main plot = hull of its sub-plots, area in hectares', () => {
  const g = Agro.mainPlotGeometries();
  const p1 = g.find(x => x.plotId === 'P1');
  assert.ok(p1.ring && p1.ring.length === 4);
  assert.ok(p1.areaHa > 2.3 && p1.areaHa < 2.4, 'about 2.35 ha (105.6 m × 222.2 m), got ' + p1.areaHa);
  assert.ok(g.find(x => x.plotId === 'P2').areaHa < 1);
});

test('no key → clear message, nothing invented', async () => {
  const r = await Agro.syncNdvi({ pauseMs: 0 });
  assert.equal(r.success, false);
  assert.equal(r.code, 'NO_KEY');
  const s = Agro.ndviSummary();
  assert.ok(s.plots.every(p => p.latest === null));
});

test('sync creates polygons ([lng,lat] GeoJSON), stores passes, skips too-small plots, summarises', async () => {
  db.db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('agroMonitoringKey', ?)").run(JSON.stringify('k-test'));
  const calls = [];
  const day = 86400, now = Math.floor(Date.now() / 1000);
  Agro.setFetch(async (url, opts = {}) => {
    calls.push({ url, method: opts.method || 'GET', body: opts.body });
    const ok = j => ({ ok: true, status: 200, text: async () => JSON.stringify(j), json: async () => j });
    if (url.includes('/polygons?')) return ok({ id: 'poly-1', area: 2.1 });
    if (url.includes('/ndvi/history')) return ok([
      { dt: now - 40 * day, source: 's2', dc: 100, cl: 0, data: { mean: 0.31, min: 0.1, max: 0.6, median: 0.3, std: 0.08, num: 900 } },
      { dt: now - 20 * day, source: 's2', dc: 100, cl: 5, data: { mean: 0.30, min: 0.1, max: 0.6, median: 0.29, std: 0.08, num: 900 } },
      { dt: now - 10 * day, source: 's2', dc: 100, cl: 80, data: { mean: 0.12, min: 0, max: 0.3, median: 0.1, std: 0.05, num: 900 } }, // cloudy: ignored
      { dt: now - 3 * day, source: 's2', dc: 98, cl: 2, data: { mean: 0.24, min: 0.05, max: 0.55, median: 0.23, std: 0.09, num: 900 } }
    ]);
    return { ok: false, status: 404, text: async () => 'not found' };
  });
  const r = await Agro.syncNdvi({ pauseMs: 0 });
  assert.equal(r.success, true);
  assert.equal(r.polygonsCreated, 1);
  assert.equal(r.observationsAdded, 4);
  assert.ok(r.skipped.some(s => s.plotId === 'P2'));
  const create = calls.find(c => c.method === 'POST');
  const coords = JSON.parse(create.body).geo_json.geometry.coordinates[0];
  assert.ok(coords[0][0] > 28 && coords[0][1] < 28, 'GeoJSON must be [lng, lat]');
  assert.deepEqual(coords[0], coords[coords.length - 1]);
  assert.ok(!create.url.includes('k-test') || create.url.startsWith('https://api.agromonitoring.com/'));

  const s = Agro.ndviSummary();
  const p1 = s.plots.find(p => p.plotId === 'P1');
  assert.equal(p1.latest.mean, 0.24);         // cloudy pass skipped
  assert.equal(p1.previous.mean, 0.30);       // 10–45 days earlier
  assert.equal(p1.change, -0.06);
  // a second sync asks only for newer passes and keeps the same polygon
  calls.length = 0;
  await Agro.syncNdvi({ pauseMs: 0 });
  assert.ok(!calls.some(c => c.method === 'POST'));
  const start = Number(new URL(calls.find(c => c.url.includes('/ndvi/history')).url).searchParams.get('start'));
  assert.equal(start, now - 3 * day + 1);
});

test('investor filter only returns plots in their family', () => {
  const s = Agro.ndviSummary(new Set(['P1A']));
  assert.deepEqual(s.plots.map(p => p.plotId), ['P1']);
});

test('after a restart (empty local table) the provider polygon is reused, not re-created', async () => {
  db.db.exec('DELETE FROM agro_polygons; DELETE FROM ndvi_observations;');
  const calls = [];
  Agro.setFetch(async (url, opts = {}) => {
    calls.push({ url, method: opts.method || 'GET' });
    const ok = j => ({ ok: true, status: 200, text: async () => JSON.stringify(j), json: async () => j });
    if (/\/polygons\?/.test(url) && (opts.method || 'GET') === 'GET') return ok([
      { id: 'old-2', name: 'PalmTrace P1', area: 2.3, created_at: 200 },
      { id: 'old-1', name: 'PalmTrace P1', area: 2.3, created_at: 100 },
      { id: 'x', name: 'Someone else', area: 9, created_at: 1 }
    ]);
    if (url.includes('/ndvi/history')) return ok([]);
    return { ok: false, status: 500, text: async () => 'unexpected' };
  });
  const r = await Agro.syncNdvi({ pauseMs: 0 });
  assert.equal(r.polygonsReused, 1);
  assert.equal(r.polygonsCreated, 0);
  assert.ok(!calls.some(c => c.method === 'POST'), 'no new polygon');
  assert.ok(calls.some(c => c.url.includes('polyid=old-1')), 'oldest polygon (longest history) is used');
  assert.equal(r.emptyHistory, 1);
  assert.equal(Agro.ndviSummary().lastResult.emptyHistory, 1);
});
