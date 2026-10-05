// Routes: Initial data load for the app (scoped per user)
const { sendJson } = require('../lib/http');
const { getBootstrapForUser, getBootstrapV2ForUser } = require('../lib/bootstrap');

const NEXT = Symbol.for('palmtrace.next-route');

// Returns NEXT when no route in this module matched the request.
module.exports = async function bootstrapRoutes(req, res, { method, pathname, url }) {
  // 3. Full Bootstrap (Single-Farm Enterprise Hydration with In-Memory Caching)
  if (method === 'GET' && pathname === '/api/bootstrap') {
    try {
      const acceptEncoding = (req.headers && req.headers['accept-encoding']) || '';
      const clientEtag = req.headers && req.headers['if-none-match'];

      // Compact / incremental format (current app). Older cached apps keep getting the classic format below.
      if (url.searchParams.get('v') === '2') {
        const q = url.searchParams;
        const { raw, gzip } = await getBootstrapV2ForUser(req.authUser, {
          palmsSince: q.get('palmsSince'), palmsLookups: q.get('palmsLookups'),
          opsSince: q.get('opsSince'), opsLookups: q.get('opsLookups')
        });
        const headers = {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*'
        };
        if (/\bgzip\b/i.test(acceptEncoding)) {
          headers['Content-Encoding'] = 'gzip';
          headers['Content-Length'] = gzip.length;
          res.writeHead(200, headers);
          return res.end(gzip);
        }
        headers['Content-Length'] = raw.length;
        res.writeHead(200, headers);
        return res.end(raw);
      }

      const { gzip, raw, etag } = await getBootstrapForUser(req.authUser);

      if (clientEtag && clientEtag === etag) {
        res.writeHead(304, {
          'ETag': etag,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id, x-project-id, x-company-id, x-user-role, *'
        });
        return res.end();
      }

      const supportsGzip = /\bgzip\b/i.test(acceptEncoding);
      const headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'ETag': etag,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id, x-project-id, x-company-id, x-user-role, *'
      };

      if (supportsGzip && gzip) {
        headers['Content-Encoding'] = 'gzip';
        headers['Content-Length'] = gzip.length;
        res.writeHead(200, headers);
        return res.end(gzip);
      } else {
        headers['Content-Length'] = raw.length;
        res.writeHead(200, headers);
        return res.end(raw);
      }
    } catch (err) {
      console.error('Bootstrap error:', err);
      return sendJson(res, 500, { error: 'Failed to build bootstrap payload: ' + err.message });
    }
  }

  return NEXT;
};
