// API tests: authentication, role permissions, per-role data scoping, zakat sync, profile.
// Run with: npm test   (starts the server on a temporary demo database)
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers/server');

let srv;
test.before(async () => { srv = await startServer({ demo: true }); });
test.after(async () => { if (srv) await srv.stop(); });

test('public endpoints work without a session', async () => {
  assert.equal((await srv.call('GET', '/api/health')).status, 200);
  const tpl = await fetch(srv.base + '/api/plots/template');
  assert.equal(tpl.status, 200);
});

test('every other API route requires a session', async () => {
  for (const url of ['/api/bootstrap', '/api/users', '/api/palms', '/api/settings', '/api/investors']) {
    const r = await srv.call('GET', url);
    assert.equal(r.status, 401, url);
    assert.equal(r.json.code, 'AUTH_REQUIRED');
  }
});

test('a forged x-user-id header is ignored', async () => {
  const res = await fetch(srv.base + '/api/users', { headers: { 'x-user-id': 'u1', 'x-user-role': 'admin' } });
  assert.equal(res.status, 401);
});

test('login: wrong password is rejected, right password returns a token', async () => {
  assert.equal((await srv.call('POST', '/api/auth/login', { body: { username: 'admin', password: 'nope' } })).status, 401);
  const token = await srv.login('admin');
  assert.match(token, /^[0-9a-f]{64}$/);
  const me = await srv.call('GET', '/api/auth/me', { token });
  assert.equal(me.json.user.username, 'admin');
});

test('logout revokes the session', async () => {
  const token = await srv.login('worker');
  assert.equal((await srv.call('POST', '/api/auth/logout', { token })).status, 200);
  assert.equal((await srv.call('GET', '/api/auth/me', { token })).status, 401);
});

test('forgot-password never returns the reset token', async () => {
  const r = await srv.call('POST', '/api/auth/forgot-password', { body: { identifier: 'admin' } });
  assert.equal(r.status, 200);
  assert.equal(r.json.token, undefined);
  assert.ok(!/resetToken=/.test(r.text));
});

test('change-password: own password needs the current one; others need admin', async () => {
  const worker = await srv.login('worker');
  let r = await srv.call('POST', '/api/auth/change-password', { token: worker, body: { newPassword: 'hacked123' } });
  assert.equal(r.status, 400);
  r = await srv.call('POST', '/api/auth/change-password', { token: worker, body: { userId: 'u1', newPassword: 'hacked123' } });
  assert.equal(r.status, 403);
  r = await srv.call('POST', '/api/auth/change-password', { token: worker, body: { oldPassword: '1234', newPassword: 'Worker#2026' } });
  assert.equal(r.status, 200);
  // other sessions of that user are signed out, the current one stays
  assert.equal((await srv.call('GET', '/api/auth/me', { token: worker })).status, 200);
  const again = await srv.call('POST', '/api/auth/login', { body: { username: 'worker', password: 'Worker#2026' } });
  assert.equal(again.status, 200);
});

test('admin-only endpoints are refused to other roles', async () => {
  const eng = await srv.login('engineer');
  assert.equal((await srv.call('POST', '/api/settings', { token: eng, body: { x: 1 } })).status, 403);
  assert.equal((await srv.call('DELETE', '/api/users/u4', { token: eng })).status, 403);
  assert.equal((await srv.call('POST', '/api/roles', { token: eng, body: {} })).status, 403);
  assert.equal((await srv.call('POST', '/api/ai/test-key', { token: eng, body: {} })).status, 403);
});

test('secrets are never sent to the browser', async () => {
  const admin = await srv.login('admin');
  await srv.call('POST', '/api/settings', { token: admin, body: { gemini_api_key: 'SECRET-KEY-123', smtpPass: 'mail-secret' } });
  const s = await srv.call('GET', '/api/settings', { token: admin });
  assert.ok(!s.text.includes('SECRET-KEY-123'));
  assert.ok(!s.text.includes('mail-secret'));
  assert.equal(s.json.gemini_api_key_configured, true);
  const b = await srv.call('GET', '/api/bootstrap', { token: admin });
  assert.ok(!b.text.includes('SECRET-KEY-123'));
  // an empty value from the UI does not wipe the stored key
  await srv.call('POST', '/api/settings', { token: admin, body: { gemini_api_key: '' } });
  assert.equal((await srv.call('GET', '/api/settings', { token: admin })).json.gemini_api_key_configured, true);
  // weather / satellite keys, including the old habit of nesting them inside agriSettings
  await srv.call('POST', '/api/settings', { token: admin, body: { agriSettings: { agroMonitoringKey: 'AGRO-SECRET-9', openWeatherKey: 'OW-SECRET-7', ndviThresholds: { good: 0.3 } } } });
  const inv = await srv.login('investor');
  for (const tok of [admin, inv]) {
    const all = (await srv.call('GET', '/api/settings', { token: tok })).text + (await srv.call('GET', '/api/bootstrap', { token: tok })).text;
    assert.ok(!all.includes('AGRO-SECRET-9') && !all.includes('OW-SECRET-7'));
  }
  const after = (await srv.call('GET', '/api/settings', { token: admin })).json;
  assert.equal(after.agroMonitoringKey_configured, true);
  assert.equal(after.agriSettings.ndviThresholds.good, 0.3);
});

test('satellite / weather endpoints: roles and honest empty state', async () => {
  const admin = await srv.login('admin');
  const inv = await srv.login('investor');
  const st = await srv.call('GET', '/api/agro/status', { token: inv });
  assert.equal(st.status, 200);
  const nd = await srv.call('GET', '/api/agro/ndvi', { token: inv });
  assert.equal(nd.status, 200);
  assert.ok(nd.json.plots.every(p => p.latest === null)); // nothing invented before a real sync
  assert.equal((await srv.call('POST', '/api/agro/ndvi/sync', { token: inv })).status, 403);
  assert.equal((await srv.call('POST', '/api/agro/test', { token: await srv.login('engineer') })).status, 403);
  const adminNd = await srv.call('GET', '/api/agro/ndvi', { token: admin });
  assert.ok(adminNd.json.plots.length >= nd.json.plots.length);
});

test('bootstrap: admin sees everything, investor sees only their own plots', async () => {
  const admin = await srv.login('admin');
  const investor = await srv.login('investor');
  const all = (await srv.call('GET', '/api/bootstrap', { token: admin })).json;
  const mine = (await srv.call('GET', '/api/bootstrap', { token: investor })).json;

  assert.ok(all.users.length > 1);
  assert.deepEqual(mine.users.map(u => u.id), ['u4']);
  const myPlots = new Set(mine.plots.map(p => p.id));
  assert.ok(myPlots.size > 0 && myPlots.size < all.plots.length);
  assert.ok(mine.palms.every(p => myPlots.has(p.plot)));
  assert.ok(mine.palms.length < all.palms.length);
  assert.equal(mine.fertilizers.length, 0);
  assert.ok(mine.zakat.every(z => z.investorId === 'u4'));
  assert.ok(mine.investors.every(i => i.user_id === 'u4' || i.id === 'u4'));
});

test('bootstrap: staff get farm data but not other investors\' finances or contacts', async () => {
  const eng = await srv.login('engineer');
  const b = (await srv.call('GET', '/api/bootstrap', { token: eng })).json;
  assert.ok(b.palms.length > 0);
  assert.ok(b.users.every(u => (u.roles || [u.role]).some(r => r !== 'investor') || u.id === 'u2'));
  assert.ok(b.zakat.every(z => z.investorId === 'u2'));
});

test('investor route restrictions', async () => {
  const inv = await srv.login('investor');
  assert.equal((await srv.call('GET', '/api/palms', { token: inv })).status, 403);
  assert.equal((await srv.call('GET', '/api/users', { token: inv })).status, 403);
  assert.equal((await srv.call('GET', '/api/investors', { token: inv })).status, 403);
  assert.equal((await srv.call('POST', '/api/operations', { token: inv, body: {} })).status, 403);
  assert.equal((await srv.call('GET', '/api/bootstrap', { token: inv })).status, 200);
});

test('staff cannot read investor/contract endpoints', async () => {
  const eng = await srv.login('engineer');
  for (const url of ['/api/investors', '/api/contracts', '/api/contract-invoices', '/api/zakat']) {
    assert.equal((await srv.call('GET', url, { token: eng })).status, 403, url);
  }
});

test('zakat records are saved on the server, investors only for themselves', async () => {
  const inv = await srv.login('investor');
  const r = await srv.call('POST', '/api/zakat', { token: inv, body: { records: [
    { id: 'zt_own', investorId: 'u4', season: '2026', amount: 1000, status: 'pending', pledgeStatus: 'signed', receiptNo: 'R-1', cancelRequested: false },
    { id: 'zt_other', investorId: 'u8', season: '2026', amount: 5 }
  ] } });
  assert.equal(r.status, 201);
  assert.deepEqual(r.json.savedIds, ['zt_own']);
  assert.deepEqual(r.json.skipped, ['zt_other']);
  const mine = (await srv.call('GET', '/api/bootstrap', { token: inv })).json.zakat;
  const rec = mine.find(z => z.id === 'zt_own');
  assert.equal(rec.amount, 1000);
  assert.equal(rec.pledgeStatus, 'signed');
  assert.equal(rec.receiptNo, 'R-1');
  // cannot overwrite someone else's record by id
  const admin = await srv.login('admin');
  await srv.call('POST', '/api/zakat', { token: admin, body: { id: 'zt_u8', investorId: 'u8', amount: 7 } });
  const hijack = await srv.call('POST', '/api/zakat', { token: inv, body: { id: 'zt_u8', investorId: 'u4', amount: 1 } });
  assert.deepEqual(hijack.json.savedIds, []);
});

test('saving your profile keeps your roles and password state', async () => {
  const admin = await srv.login('admin');
  await srv.call('POST', '/api/users', { token: admin, body: { id: 'u_multi', username: 'multi', name: 'Multi', role: 'engineer', roles: ['engineer', 'investor'], pass: 'Multi#2026', mustChangePassword: false } });
  const t = await srv.login('multi', 'Multi#2026');
  const r = await srv.call('POST', '/api/auth/profile', { token: t, body: { fullName: 'Multi Role', phone: '0100', avatar: 'a.png' } });
  assert.equal(r.status, 200);
  const me = (await srv.call('GET', '/api/auth/me', { token: t })).json.user;
  assert.deepEqual(me.roles.sort(), ['engineer', 'investor']);
  assert.equal(me.mustChangePassword, false);
  assert.equal(me.name, 'Multi Role');
});

test('investor export to Excel works', async () => {
  const admin = await srv.login('admin');
  const res = await fetch(srv.base + '/api/investors/export', { headers: { Authorization: 'Bearer ' + admin } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /spreadsheetml/);
});

test('trees + operations sync: compact full lists, then only changes', async () => {
  const admin = await srv.login('admin');
  const full = (await srv.call('GET', '/api/bootstrap?v=2', { token: admin })).json;
  assert.equal(full.palms, undefined);
  assert.equal(full.operations, undefined);
  const ps = full.palmsSync, os = full.operationsSync;
  assert.equal(ps.mode, 'full');
  assert.ok(ps.rows.length > 0 && ps.cols.includes('id'));
  assert.equal(ps.total, ps.rows.length);
  assert.equal(os.mode, 'full');
  const q = (p, o) => `/api/bootstrap?v=2&palmsSince=${p.version}&palmsLookups=${p.lookupsHash}&opsSince=${o.version}&opsLookups=${o.lookupsHash}`;

  // nothing changed → empty deltas
  let r = (await srv.call('GET', q(ps, os), { token: admin })).json;
  assert.equal(r.palmsSync.mode, 'delta');
  assert.equal(r.palmsSync.rows.length, 0);
  assert.equal(r.operationsSync.mode, 'delta');
  assert.equal(r.operationsSync.rows.length, 0);
  assert.equal(r.palmsSync.idHash, ps.idHash);

  // change one tree → only that tree comes back
  const idIdx = ps.cols.indexOf('id');
  const target = ps.rows[0][idIdx];
  const put = await srv.call('PUT', `/api/palms/${target}`, { token: admin, body: { notes: 'delta-test-note' } });
  assert.ok(put.status < 300, put.text);
  r = (await srv.call('GET', q(ps, os), { token: admin })).json;
  const d = r.palmsSync;
  assert.equal(d.mode, 'delta');
  assert.deepEqual(d.rows.map(row => row[d.cols.indexOf('id')]), [target]);
  assert.equal(d.rows[0][d.cols.indexOf('notes')], 'delta-test-note');
  assert.equal(d.total, ps.total);

  // a new operation → only that operation comes back
  const op = await srv.call('POST', '/api/operations', { token: admin, body: { id: 'op_delta_1', palmId: target, typeId: 'op1', workerId: 'u3', at: '2026-10-01T10:00:00Z', notes: 'x' } });
  assert.ok(op.status < 300, op.text);
  r = (await srv.call('GET', q(ps, os), { token: admin })).json;
  assert.equal(r.operationsSync.mode, 'delta');
  assert.deepEqual(r.operationsSync.rows.map(row => row[r.operationsSync.cols.indexOf('id')]), ['op_delta_1']);
  assert.equal(r.operationsSync.total, os.total + 1);

  // a lookup (sector name) change forces a full list
  const sectors = (await srv.call('GET', '/api/sectors', { token: admin })).json;
  const sec = (Array.isArray(sectors) ? sectors : sectors.sectors || [])[0];
  if (sec) {
    await srv.call('PUT', `/api/sectors/${encodeURIComponent(sec.id)}`, { token: admin, body: { ...sec, name: sec.name + ' *' } });
    r = (await srv.call('GET', q(d, r.operationsSync), { token: admin })).json;
    assert.equal(r.palmsSync.mode, 'full');
  }

  // investors always get their (small) list in full
  const inv = await srv.login('investor');
  const ir = (await srv.call('GET', q(ps, os), { token: inv })).json;
  assert.equal(ir.palmsSync.mode, 'full');

  // the classic format still works for older cached apps
  const classic = (await srv.call('GET', '/api/bootstrap', { token: admin })).json;
  assert.ok(Array.isArray(classic.palms) && classic.palms.length === ps.total);
  assert.equal(classic._syncMeta, undefined);
});

test('nursery stage and details survive a reload (saved on the server)', async () => {
  const admin = await srv.login('admin');
  const b = (await srv.call('GET', '/api/bootstrap', { token: admin })).json;
  const os = (b.offshoots || [])[0];
  assert.ok(os, 'demo data has offshoots');
  const r = await srv.call('POST', '/api/offshoots/nursery-state', { token: admin, body: { items: [
    { id: os.id, stage: 'ready', meta: { preps: [{ at: '2026-10-05', type: 'تجذير' }], receivedBy: 'مدير المشتل', junk: 'x' } },
    { id: 'does-not-exist', stage: 'ready' }
  ] } });
  assert.equal(r.status, 200);
  assert.equal(r.json.saved, 1);
  assert.deepEqual(r.json.missing, ['does-not-exist']);
  const after = (await srv.call('GET', '/api/bootstrap', { token: admin })).json.offshoots.find(o => o.id === os.id);
  assert.equal(after.nsStatus, 'ready');
  assert.equal(after.preps.length, 1);
  assert.equal(after.receivedBy, 'مدير المشتل');
  assert.equal(after.junk, undefined);
  const inv = await srv.login('investor');
  assert.equal((await srv.call('POST', '/api/offshoots/nursery-state', { token: inv, body: { items: [] } })).status, 403);
});
