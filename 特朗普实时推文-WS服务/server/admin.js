'use strict';

// 管理后台 HTTP API。用 ADMIN_PASSWORD 做 HTTP Basic Auth + Cookie 会话。
// 路由前缀 /admin/api/
//
// 流程：
//   POST /admin/api/login    {password}        -> 200 + Set-Cookie admin_session
//   POST /admin/api/logout                      -> 204
//   GET  /admin/api/keys                        -> [{id, name, prefix, ...}]
//   POST /admin/api/keys     {name, expires, note}  -> {secret, ...}   // 唯一一次返回明文
//   POST /admin/api/keys/:id/revoke             -> {ok}
//   DELETE /admin/api/keys/:id                  -> {ok}
//   GET  /admin/api/stats                       -> {keys, ws_clients, history}
//
// 浏览器侧自带 cookie；脚本侧也可以用  Authorization: Bearer <ADMIN_PASSWORD>。

const crypto = require('crypto');

const SESSION_COOKIE = 'admin_session';
const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;

class Admin {
  constructor({ password, keyStore, store, broadcaster }) {
    this.password = password || '';
    this.keyStore = keyStore;
    this.store = store;
    this.broadcaster = broadcaster;
    this.sessions = new Map(); // token -> expires_at
    // 定时清理
    setInterval(() => this._gc(), 60 * 60 * 1000).unref();
  }

  _gc() {
    const now = Date.now();
    for (const [t, e] of this.sessions) if (e <= now) this.sessions.delete(t);
  }

  _newSession() {
    const t = crypto.randomBytes(24).toString('hex');
    this.sessions.set(t, Date.now() + SESSION_TTL_MS);
    return t;
  }

  _readCookie(req, name) {
    const raw = req.headers.cookie || '';
    for (const part of raw.split(/;\s*/)) {
      const idx = part.indexOf('=');
      if (idx < 0) continue;
      if (part.slice(0, idx) === name) return decodeURIComponent(part.slice(idx + 1));
    }
    return '';
  }

  _isAuthed(req) {
    if (!this.password) return false; // 没设密码 = 拒绝所有 admin 请求（避免裸奔）
    // 1) Cookie
    const tok = this._readCookie(req, SESSION_COOKIE);
    if (tok && this.sessions.has(tok) && this.sessions.get(tok) > Date.now()) return true;
    // 2) Bearer ADMIN_PASSWORD
    const auth = req.headers['authorization'] || '';
    const m = /^Bearer\s+(.+)$/i.exec(auth);
    if (m && safeEq(m[1], this.password)) return true;
    return false;
  }

  async _readBody(req) {
    return new Promise((resolve, reject) => {
      const bufs = [];
      let size = 0;
      req.on('data', (c) => {
        size += c.length;
        if (size > 100_000) {
          reject(new Error('body too large'));
          req.destroy();
        }
        bufs.push(c);
      });
      req.on('end', () => {
        const s = Buffer.concat(bufs).toString('utf8');
        if (!s) return resolve({});
        try { resolve(JSON.parse(s)); } catch (e) { reject(e); }
      });
      req.on('error', reject);
    });
  }

  // 主入口：返回 true 表示已处理，否则交给上层
  async handle(req, res, pathname) {
    if (!pathname.startsWith('/admin/api/')) return false;
    res.setHeader('Cache-Control', 'no-store');

    // 登录单独不需要鉴权
    if (pathname === '/admin/api/login' && req.method === 'POST') {
      let body;
      try { body = await this._readBody(req); }
      catch { return sendJson(res, 400, { error: 'bad_json' }); }
      if (!this.password) return sendJson(res, 500, { error: 'admin_not_configured' });
      if (!safeEq(String(body.password || ''), this.password)) {
        return sendJson(res, 401, { error: 'wrong_password' });
      }
      const tok = this._newSession();
      res.setHeader(
        'Set-Cookie',
        `${SESSION_COOKIE}=${encodeURIComponent(tok)}; Path=/; Max-Age=${SESSION_TTL_MS / 1000}; HttpOnly; SameSite=Strict`
      );
      return sendJson(res, 200, { ok: true });
    }

    if (pathname === '/admin/api/logout' && req.method === 'POST') {
      const tok = this._readCookie(req, SESSION_COOKIE);
      if (tok) this.sessions.delete(tok);
      res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; Max-Age=0`);
      res.writeHead(204).end();
      return true;
    }

    if (!this._isAuthed(req)) return sendJson(res, 401, { error: 'unauthorized' });

    if (pathname === '/admin/api/keys' && req.method === 'GET') {
      return sendJson(res, 200, { keys: this.keyStore.list() });
    }

    if (pathname === '/admin/api/keys' && req.method === 'POST') {
      let body;
      try { body = await this._readBody(req); }
      catch { return sendJson(res, 400, { error: 'bad_json' }); }
      const name = String(body.name || '').slice(0, 200);
      const expires = String(body.expires || 'never').slice(0, 60);
      const note = String(body.note || '').slice(0, 2000);
      const created = this.keyStore.create({ name, expires, note });
      return sendJson(res, 200, { key: created });
    }

    const mRev = /^\/admin\/api\/keys\/([\w]+)\/revoke$/.exec(pathname);
    if (mRev && req.method === 'POST') {
      const id = mRev[1];
      const ok = this.keyStore.revoke(id);
      if (ok && this.broadcaster) this.broadcaster.kickByKeyId(id);
      return sendJson(res, ok ? 200 : 404, { ok });
    }

    const mDel = /^\/admin\/api\/keys\/([\w]+)$/.exec(pathname);
    if (mDel && req.method === 'DELETE') {
      const id = mDel[1];
      if (this.broadcaster) this.broadcaster.kickByKeyId(id);
      const ok = this.keyStore.delete(id);
      return sendJson(res, ok ? 200 : 404, { ok });
    }

    if (pathname === '/admin/api/stats' && req.method === 'GET') {
      return sendJson(res, 200, {
        keys: this.keyStore.stats(),
        ws_clients: this.broadcaster ? this.broadcaster.count() : 0,
        history: this.store.count(),
      });
    }

    return sendJson(res, 404, { error: 'not_found' });
  }
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
  return true;
}

function safeEq(a, b) {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

module.exports = { Admin };
