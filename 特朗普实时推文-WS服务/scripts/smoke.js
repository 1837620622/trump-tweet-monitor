'use strict';

// 端到端冒烟：在临时 DB 上启动一个完整服务（不连 RSS / Truth / PushPlus / 翻译），
// 然后：
//   1) 走 /admin/api 用 ADMIN_PASSWORD 登录、生成一个 1 小时 key
//   2) 用这个 key 连 /ws；发 subscribe + ping；服务端 broadcast 一条假 tweet
//   3) 校验客户端拿到 tweet
//   4) 撤销 key；下一次心跳 (25s) 不等，手动调 broadcaster.kickByKeyId；校验 socket 关闭
//   5) 校验 /admin/api/keys 列表显示 revoked
//   6) 退出码 0 表示全过

const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const WebSocket = require('ws');

// 模拟环境（不带任何真实 token / 真实数据源）
process.env.ADMIN_PASSWORD = 'smoke-pass-' + Math.random().toString(36).slice(2, 10);
process.env.SOURCE_RSS_ENABLED = 'false';
process.env.SOURCE_TRUTH_ENABLED = 'false';
process.env.PUSH_ENABLED = 'false';
process.env.TRANSLATE_ENABLED = 'false';
process.env.GROQ_API_KEY = '';
process.env.PORT = '0';
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tts-smoke-'));
process.env.DB_FILE = path.join(tmpDir, 'state.db');

const dbMod = require('../server/db');
const { KeyStore } = require('../server/keystore');
const Store = require('../server/store');
const { Broadcaster } = require('../server/broadcaster');
const { Admin } = require('../server/admin');
const { createHandler } = require('../server/http');

function assert(cond, msg) {
  if (!cond) {
    console.error('  ✗', msg);
    process.exitCode = 1;
    throw new Error(msg);
  } else {
    console.log('  ✓', msg);
  }
}

function postJson(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const req = http.request({
      method: 'POST',
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers },
    }, (res) => {
      let buf = '';
      res.on('data', (c) => buf += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: buf }));
    });
    req.on('error', reject);
    req.end(data);
  });
}
function getJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({
      method: 'GET', hostname: u.hostname, port: u.port, path: u.pathname + u.search, headers,
    }, (res) => {
      let buf = '';
      res.on('data', (c) => buf += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: buf }));
    });
    req.on('error', reject);
    req.end();
  });
}
function wsUpgradeStatus(port, pathQ) {
  // 直接发原始 WS 升级请求，捕获服务端返回的 HTTP 状态码
  return new Promise((resolve, reject) => {
    const req = http.request({
      method: 'GET',
      hostname: '127.0.0.1',
      port,
      path: pathQ,
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
        'Sec-WebSocket-Version': '13',
      },
    });
    req.on('response', (res) => {
      // 服务端不接受 upgrade -> 走普通 HTTP 响应（401 等）
      res.resume();
      resolve(res.statusCode);
    });
    req.on('upgrade', (res, socket) => {
      socket.destroy();
      resolve(101);
    });
    req.on('error', reject);
    req.end();
  });
}

function deleteJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({
      method: 'DELETE', hostname: u.hostname, port: u.port, path: u.pathname + u.search, headers,
    }, (res) => {
      let buf = '';
      res.on('data', (c) => buf += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: buf }));
    });
    req.on('error', reject);
    req.end();
  });
}

(async function main() {
  console.log('--- smoke test starting (db:', process.env.DB_FILE, ') ---\n');

  const db = dbMod.open(process.env.DB_FILE);
  const keyStore = new KeyStore(db);
  const store = new Store(db, 50);
  const broadcaster = new Broadcaster({ keyStore, getHistory: (lim) => store.getHistory(lim) });
  const admin = new Admin({ password: process.env.ADMIN_PASSWORD, keyStore, store, broadcaster });

  const publicDir = path.resolve(__dirname, '..', 'public');
  const server = http.createServer(createHandler({ store, broadcaster, admin, publicDir }));
  broadcaster.attachToServer(server);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  console.log(`server listening on ${base}\n`);

  console.log('[1] admin login');
  const badLogin = await postJson(`${base}/admin/api/login`, { password: 'wrong' });
  assert(badLogin.status === 401, 'wrong password rejected with 401');
  const okLogin = await postJson(`${base}/admin/api/login`, { password: process.env.ADMIN_PASSWORD });
  assert(okLogin.status === 200, 'correct password accepted (200)');
  const setCookie = okLogin.headers['set-cookie']?.[0] || '';
  const cookie = (/admin_session=([^;]+)/.exec(setCookie) || [])[0] || '';
  assert(cookie.startsWith('admin_session='), 'session cookie set');
  console.log('');

  console.log('[2] create key (1h expiry)');
  const r = await postJson(`${base}/admin/api/keys`, { name: 'smoke-bot', expires: '1h', note: 'smoke-test' }, { cookie });
  assert(r.status === 200, 'create returns 200');
  const created = JSON.parse(r.body).key;
  assert(created.secret?.startsWith('ttws_live_'), 'secret prefixed ttws_live_');
  assert(created.secret.length === 47, 'secret length is 47');
  assert(created.expires_at > Date.now() + 3500_000 && created.expires_at < Date.now() + 3700_000, 'expires_at ~ 1h from now');
  const token = created.secret;
  console.log('  secret =', token.slice(0, 16) + '...', '\n');

  console.log('[3] list keys');
  const list = JSON.parse((await getJson(`${base}/admin/api/keys`, { cookie })).body).keys;
  assert(list.length === 1, 'list has 1 key');
  assert(list[0].active === true, 'key active=true');
  assert(!list[0].secret, 'secret NOT returned in list');
  console.log('');

  console.log('[4] WS connect with bad token -> 401');
  {
    const status = await wsUpgradeStatus(port, '/ws?token=ttws_live_doesnotexist00000000000000000000');
    assert(status === 401, `bad token rejected with HTTP 401 (got ${status})`);
  }
  {
    const status = await wsUpgradeStatus(port, '/ws');
    assert(status === 401, `missing token rejected with HTTP 401 (got ${status})`);
  }
  console.log('');

  console.log('[5] WS connect with good token -> hello + tweet broadcast');
  await new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${token}`);
    let gotHello = false, gotTweet = false, gotSubscribed = false;
    const to = setTimeout(() => { reject(new Error('ws timeout')); ws.close(); }, 5000);
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'subscribe', source: 'all' }));
      setTimeout(() => broadcaster.broadcastTweet({
        guid: 'smoke-1', source: 'rss', title: 'Hello world',
        contentHtml: '<p>Hello world</p>', link: 'https://example.com/1',
        pubDate: new Date().toISOString(), author: '@realDonaldTrump',
        mediaUrl: null, translated: '你好世界', received_at: new Date().toISOString(),
      }), 100);
    });
    ws.on('message', (raw) => {
      const m = JSON.parse(raw);
      if (m.type === 'hello') { gotHello = true; assert(m.key?.prefix === created.prefix, 'hello.key.prefix matches'); }
      if (m.type === 'subscribed') gotSubscribed = true;
      if (m.type === 'tweet') {
        gotTweet = true;
        assert(m.data.guid === 'smoke-1', 'received broadcast tweet by ws');
        clearTimeout(to);
        ws.close();
      }
    });
    ws.on('close', () => {
      assert(gotHello, 'received hello');
      assert(gotSubscribed, 'received subscribed');
      assert(gotTweet, 'received tweet');
      resolve();
    });
    ws.on('error', (e) => { reject(e); });
  });
  console.log('');

  console.log('[6] revoke key -> existing socket gets kicked');
  await new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${token}`);
    let closeCode = null;
    const to = setTimeout(() => { reject(new Error('kick timeout')); ws.terminate(); }, 5000);
    ws.on('open', async () => {
      const rev = await postJson(`${base}/admin/api/keys/${created.id}/revoke`, {}, { cookie });
      assert(rev.status === 200, 'revoke returns 200');
    });
    ws.on('close', (code, reason) => {
      closeCode = code;
      clearTimeout(to);
      assert(closeCode === 4003, `socket closed with 4003 (got ${closeCode} ${reason})`);
      resolve();
    });
    ws.on('error', () => {});
  });
  console.log('');

  console.log('[7] revoked key cannot re-connect -> 401');
  {
    const status = await wsUpgradeStatus(port, `/ws?token=${token}`);
    assert(status === 401, `revoked key blocked on reconnect (got ${status})`);
  }
  console.log('');

  console.log('[8] /health endpoint');
  const h = JSON.parse((await getJson(`${base}/health`)).body);
  assert(h.ok === true, '/health ok=true');
  assert(h.ws.path === '/ws', '/health reports ws path');
  console.log('');

  console.log('[9] DELETE key');
  const del = await deleteJson(`${base}/admin/api/keys/${created.id}`, { cookie });
  assert(del.status === 200, 'delete returns 200');
  const after = JSON.parse((await getJson(`${base}/admin/api/keys`, { cookie })).body).keys;
  assert(after.length === 0, 'list empty after delete');
  console.log('');

  console.log('[10] unauthorized api access');
  const noAuth = await getJson(`${base}/admin/api/keys`);
  assert(noAuth.status === 401, '/admin/api/keys without cookie -> 401');

  console.log('\n--- ALL SMOKE TESTS PASSED ---');
  broadcaster.close?.();
  server.close();
  try { db.close(); } catch {}
  fs.rmSync(tmpDir, { recursive: true, force: true });
  setTimeout(() => process.exit(0), 50);
})().catch((e) => {
  console.error('\nsmoke test FAILED:', e.message);
  console.error(e.stack);
  process.exit(1);
});
