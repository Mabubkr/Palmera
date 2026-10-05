// HTTP helpers: JSON responses, body parsing, static file serving.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const config = require('../config');

function sendJson(res, statusCode, data) {
  const req = res.req;
  const jsonBuf = Buffer.from(JSON.stringify(data), 'utf8');
  const acceptEncoding = (req && req.headers && req.headers['accept-encoding']) || '';

  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id, x-project-id, x-company-id, x-user-role, *'
  };

  if (jsonBuf.length > 1024 && /\bgzip\b/i.test(acceptEncoding)) {
    zlib.gzip(jsonBuf, { level: 6 }, (err, compressed) => {
      if (err || !compressed) {
        headers['Content-Length'] = jsonBuf.length;
        res.writeHead(statusCode, headers);
        return res.end(jsonBuf);
      }
      headers['Content-Encoding'] = 'gzip';
      headers['Content-Length'] = compressed.length;
      res.writeHead(statusCode, headers);
      res.end(compressed);
    });
  } else {
    headers['Content-Length'] = jsonBuf.length;
    res.writeHead(statusCode, headers);
    res.end(jsonBuf);
  }
}

// maxBytes guards against a client streaming an endless body into memory.
// Photos of pests / operations are sent inline as base64, hence the generous default.
function parseBody(req, maxBytes = 25 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    req.setEncoding('utf8');
    let body = '';
    let tooBig = false;
    req.on('data', chunk => {
      if (tooBig) return;
      body += chunk;
      if (body.length > maxBytes) { tooBig = true; body = ''; reject(Object.assign(new Error('الطلب أكبر من الحد المسموح'), { statusCode: 413 })); req.resume(); }
    });
    req.on('end', () => {
      if (tooBig) return;
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function parseRawBuffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}


const STATIC_DIR = config.FRONTEND_DIR;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8'
};

function serveStatic(req, res, pathname) {
  let relPath = pathname === '/' ? '/index.html' : pathname;
  if (pathname.startsWith('/trace') || pathname.startsWith('/p/')) {
    relPath = '/trace.html';
  }
  try {
    relPath = decodeURIComponent(relPath);
  } catch {}
  const safePath = path.normalize(relPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(STATIC_DIR, safePath);

  if (!filePath.startsWith(STATIC_DIR)) {
    return sendJson(res, 403, { error: 'Access denied' });
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      if (!path.extname(filePath)) {
        const indexPath = path.join(STATIC_DIR, 'index.html');
        return fs.readFile(indexPath, (idxErr, content) => {
          if (idxErr) return sendJson(res, 404, { error: 'المسار غير موجود' });
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(content);
        });
      }
      return sendJson(res, 404, { error: 'المسار غير موجود' });
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const acceptEncoding = (req && req.headers && req.headers['accept-encoding']) || '';
    const compressible = ['.html', '.js', '.css', '.json', '.svg'].includes(ext);

    if (compressible && stats.size > 1024 && /\bgzip\b/i.test(acceptEncoding)) {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Encoding': 'gzip',
        'Access-Control-Allow-Origin': '*'
      });
      fs.createReadStream(filePath).pipe(zlib.createGzip({ level: 6 })).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stats.size,
        'Access-Control-Allow-Origin': '*'
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });
}

// Helpers for safe foreign-key resolution

module.exports = { sendJson, parseBody, parseRawBuffer, serveStatic };
