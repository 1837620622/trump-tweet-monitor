'use strict';

// 简易 HTTP 路由 + 静态资源。不引 express。
//
// 路由：
//   GET  /                      -> public/index.html  (Landing)
//   GET  /admin                 -> public/admin.html
//   GET  /demo                  -> public/demo.html
//   GET  /docs                  -> public/docs.html
//   GET  /health                -> 健康检查 JSON
//   GET  /api/tweets            -> 历史数据（公开，只读最近 50 条，不会泄密）
//   POST /admin/api/*           -> Admin API（鉴权）
//   *    /<file>                -> public/<file>
//   WS 升级在 /ws 由 broadcaster 接管

const fs = require('fs');
const path = require('path');
const { logger } = require('./utils');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

function serveStatic(res, filepath) {
  fs.stat(filepath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('not found');
    }
    const ext = path.extname(filepath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=300',
    });
    fs.createReadStream(filepath).pipe(res);
  });
}

function createHandler({ store, broadcaster, admin, publicDir }) {
  return async function handler(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || 'x'}`);
    const p = url.pathname;

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE',
        'Access-Control-Allow-Headers': 'content-type, authorization',
      });
      return res.end();
    }

    // 1) Admin API 优先
    if (p.startsWith('/admin/api/')) {
      try { await admin.handle(req, res, p); }
      catch (e) { logger.err('admin error', e.message); sendJson(res, 500, { error: e.message }); }
      return;
    }

    // 2) 普通 API
    if (p === '/health') {
      return sendJson(res, 200, {
        ok: true,
        ts: Date.now(),
        ws: { path: '/ws', clients: broadcaster.count() },
        history: store.count(),
      });
    }

    if (p === '/api/tweets') {
      const lim = parseInt(url.searchParams.get('limit'), 10) || 50;
      return sendJson(res, 200, store.getHistory(lim));
    }

    // 3) 静态页路由别名
    const aliases = {
      '/admin': 'admin.html',
      '/admin/': 'admin.html',
      '/demo':  'demo.html',
      '/demo/': 'demo.html',
      '/docs':  'docs.html',
      '/docs/': 'docs.html',
      '/':      'index.html',
    };

    if (aliases[p]) {
      return serveStatic(res, path.join(publicDir, aliases[p]));
    }

    // 4) 静态资源兜底
    const safe = path.normalize(p).replace(/^[/\\]+/, '');
    const f = path.join(publicDir, safe);
    if (f.startsWith(publicDir) && fs.existsSync(f) && fs.statSync(f).isFile()) {
      return serveStatic(res, f);
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  };
}

module.exports = { createHandler };
