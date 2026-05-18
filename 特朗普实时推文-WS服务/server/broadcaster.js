'use strict';

// WebSocket 广播服务：升级时校验 API Key（来自 keystore），按订阅过滤广播。
//
// 鉴权：
//   - ?token=ttws_live_xxx   或   Authorization: Bearer ttws_live_xxx
//   - 校验失败 -> 401 关 socket
//   - 校验成功 -> 计入 last_used_at / request_count
//
// 协议详见 public/docs.html（同步源于此）。

const { WebSocketServer } = require('ws');
const { logger } = require('./utils');

const SERVER_VERSION = '2.0.0';

class Broadcaster {
  constructor({ keyStore, getHistory }) {
    this.keyStore = keyStore;
    this.getHistory = getHistory;
    this.wss = new WebSocketServer({ noServer: true });
    this.clients = new Set();
    this._heartbeat = setInterval(() => this._tick(), 25000);
  }

  // 创建完 HTTP server 后手动挂接，避免与上层的循环依赖
  attachToServer(server) {
    server.on('upgrade', (req, socket, head) => {
      if (!req.url.startsWith('/ws')) return;
      const auth = this._authCheck(req);
      if (!auth.ok) {
        const body = JSON.stringify({ error: auth.reason });
        socket.write(
          `HTTP/1.1 401 Unauthorized\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`
        );
        socket.destroy();
        return;
      }
      this.wss.handleUpgrade(req, socket, head, (ws) => {
        this._attach(ws, req, auth.row);
      });
    });
  }

  _extractToken(req) {
    const u = new URL(req.url, 'http://x');
    const q = u.searchParams.get('token');
    if (q) return q;
    const auth = req.headers['authorization'] || '';
    const m = /^Bearer\s+(.+)$/i.exec(auth);
    return m ? m[1] : '';
  }

  _authCheck(req) {
    const token = this._extractToken(req);
    if (!token) return { ok: false, reason: 'missing_token' };
    const r = this.keyStore.verify(token);
    if (!r.ok) return r;
    this.keyStore.bumpUsage(r.row.id);
    return r;
  }

  _attach(ws, req, keyRow) {
    ws.isAlive = true;
    ws.subscription = 'all';
    ws.keyId = keyRow.id;
    ws.keyPrefix = keyRow.prefix;
    ws.ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString();
    this.clients.add(ws);
    logger.info(`ws: connect key=${keyRow.prefix}… ip=${ws.ip} total=${this.clients.size}`);

    this._send(ws, {
      type: 'hello',
      ts: Date.now(),
      server_version: SERVER_VERSION,
      key: { id: keyRow.id, prefix: keyRow.prefix, expires_at: keyRow.expires_at },
    });

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); }
      catch { return this._send(ws, { type: 'error', message: 'invalid_json' }); }
      this._handle(ws, msg);
    });
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('close', () => {
      this.clients.delete(ws);
      logger.info(`ws: disconnect key=${ws.keyPrefix}… total=${this.clients.size}`);
    });
    ws.on('error', (e) => logger.warn('ws: error', e.message));
  }

  _handle(ws, msg) {
    switch (msg.type) {
      case 'ping':
        return this._send(ws, { type: 'pong', ts: Date.now() });
      case 'subscribe': {
        const src = msg.source || 'all';
        if (!['all', 'rss', 'truth'].includes(src)) {
          return this._send(ws, { type: 'error', message: 'bad_source' });
        }
        ws.subscription = src;
        return this._send(ws, { type: 'subscribed', source: src });
      }
      case 'history': {
        const limit = Math.max(1, Math.min(parseInt(msg.limit, 10) || 20, 200));
        const data = this.getHistory ? this.getHistory(limit) : [];
        return this._send(ws, { type: 'history', data });
      }
      default:
        return this._send(ws, { type: 'error', message: `unknown_type:${msg.type}` });
    }
  }

  _send(ws, obj) {
    if (ws.readyState !== ws.OPEN) return;
    try { ws.send(JSON.stringify(obj)); }
    catch (e) { logger.warn('ws: send failed', e.message); }
  }

  _tick() {
    for (const ws of this.clients) {
      // 1) 过期 / 撤销的 key 立刻踢
      if (ws.keyId) {
        const r = this.keyStore.recheckById(ws.keyId);
        if (!r.ok) {
          try { ws.close(4003, r.reason); } catch {}
          this.clients.delete(ws);
          continue;
        }
      }
      // 2) 心跳：上一轮没回 pong 就强断
      if (ws.isAlive === false) {
        try { ws.terminate(); } catch {}
        this.clients.delete(ws);
        continue;
      }
      ws.isAlive = false;
      try { ws.ping(); } catch {}
    }
  }

  broadcastTweet(tweet) {
    const payload = JSON.stringify({ type: 'tweet', data: tweet });
    let n = 0;
    for (const ws of this.clients) {
      if (ws.readyState !== ws.OPEN) continue;
      if (ws.subscription !== 'all' && ws.subscription !== tweet.source) continue;
      try { ws.send(payload); n++; } catch {}
    }
    return n;
  }

  // 撤销/过期一个 key 时调用，把所有用此 key 连接的 socket 踢掉
  kickByKeyId(keyId) {
    let n = 0;
    for (const ws of this.clients) {
      if (ws.keyId === keyId) {
        try { ws.close(4003, 'key_revoked_or_expired'); } catch {}
        n++;
      }
    }
    return n;
  }

  count() {
    return this.clients.size;
  }

  close() {
    clearInterval(this._heartbeat);
    for (const ws of this.clients) { try { ws.close(); } catch {} }
    this.wss.close();
  }
}

module.exports = { Broadcaster, SERVER_VERSION };
