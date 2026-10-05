// A brand-new installation (empty database, no demo data) must start and be usable.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers/server');

test('fresh install: only an admin with a temporary password, forced to change it', async () => {
  const srv = await startServer({ demo: false });
  try {
    const m = /temporary password: (\S+)/.exec(srv.output());
    assert.ok(m, 'temporary admin password is printed on first start');
    // demo password must not work
    assert.equal((await srv.call('POST', '/api/auth/login', { body: { username: 'admin', password: '1234' } })).status, 401);
    const token = await srv.login('admin', m[1]);
    const blocked = await srv.call('GET', '/api/bootstrap', { token });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.json.code, 'PASSWORD_CHANGE_REQUIRED');
    assert.equal((await srv.call('POST', '/api/auth/change-password', { token, body: { newPassword: 'Admin#2026' } })).status, 200);
    const b = await srv.call('GET', '/api/bootstrap', { token });
    assert.equal(b.status, 200);
    assert.equal(b.json.users.length, 1);
    assert.equal(b.json.palms.length, 0);
    assert.ok(b.json.crops.length > 0, 'reference data is seeded');
  } finally {
    await srv.stop();
  }
});

test('fresh install with SEED_DEMO_DATA=true boots with the demo farm', async () => {
  const srv = await startServer({ demo: true });
  try {
    const token = await srv.login('admin', '1234');
    const b = await srv.call('GET', '/api/bootstrap', { token });
    assert.equal(b.status, 200);
    assert.ok(b.json.palms.length > 0);
    assert.ok(b.json.users.length >= 10);
  } finally {
    await srv.stop();
  }
});
