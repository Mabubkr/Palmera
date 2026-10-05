// Routes: real weather + satellite data for the AI hub (lib/agro.js). Keys stay on the server.
const Agro = require('../lib/agro');
const access = require('../access');
const { getCachedBootstrapData, buildBootstrapPayload } = require('../lib/bootstrap');
const { sendJson, parseBody } = require('../lib/http');

const NEXT = Symbol.for('palmtrace.next-route');
const FIELD_ROLES = new Set(['admin', 'super_admin', 'engineer', 'tenant_user']);

module.exports = async function agroRoutes(req, res, { method, pathname, url }) {
  if (!pathname.startsWith('/api/agro/')) return NEXT;
  const user = req.authUser;

  if (pathname === '/api/agro/status' && method === 'GET') {
    return sendJson(res, 200, Agro.status());
  }

  if (pathname === '/api/agro/weather' && method === 'GET') {
    const data = await Agro.getWeather({ force: url.searchParams.get('refresh') === '1' && user && access.accessLevel(user) !== 'investor' });
    return sendJson(res, data.success ? 200 : 503, data);
  }

  if (pathname === '/api/agro/ndvi' && method === 'GET') {
    let filter = null;
    if (user && access.accessLevel(user) === 'investor') filter = access.investorPlotIds(user.id, getCachedBootstrapData() || buildBootstrapPayload());
    return sendJson(res, 200, Agro.ndviSummary(filter));
  }

  if (pathname === '/api/agro/ndvi/sync' && method === 'POST') {
    if (!user || ![...user.roles].some(r => FIELD_ROLES.has(r))) return sendJson(res, 403, { error: 'تحديث بيانات القمر الصناعي متاح للمدير والمهندس' });
    const body = await parseBody(req).catch(() => ({}));
    const result = await Agro.syncNdvi({ maxPlots: Math.min(Number(body.maxPlots) || 40, 100) });
    return sendJson(res, result.success ? 200 : 400, result);
  }

  if (pathname === '/api/agro/test' && method === 'POST') {
    if (!user || !user.isAdmin) return sendJson(res, 403, { error: 'فحص الربط متاح لمدير النظام فقط' });
    const body = await parseBody(req).catch(() => ({}));
    return sendJson(res, 200, await Agro.testConnections({ agroMonitoringKey: String(body.agroMonitoringKey || '').trim(), openMeteoKey: String(body.openMeteoKey || '').trim() }));
  }

  return NEXT;
};
