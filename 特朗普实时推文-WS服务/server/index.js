'use strict';

// 总装配：load env -> open db -> keystore -> fetcher -> pollers -> http + ws
const http = require('http');
const path = require('path');

(function loadDotenv() {
  const fs = require('fs');
  const file = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i.exec(line);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
})();

const config = require('./config');
const { logger } = require('./utils');
const dbMod = require('./db');
const { KeyStore } = require('./keystore');
const Store = require('./store');
const { Http, fetchRSS, fetchTruth } = require('./fetcher');
const Poller = require('./poller');
const { Broadcaster } = require('./broadcaster');
const { createTranslator } = require('./translator');
const { pushPlus, buildHtml, buildTitle } = require('./pusher');
const { Admin } = require('./admin');
const { createHandler } = require('./http');

async function main() {
  logger.info('boot: 特朗普实时推文-WS服务 v2.0');
  logger.info(`config: rss=${config.rss.enabled} truth=${config.truth.enabled} translate=${config.translate.enabled} (groq=${!!config.translate.groqKey}) push=${config.pushplus.enabled} port=${config.port}`);
  if (config.adminPassword === 'chuankangkk') {
    logger.warn('admin: 正在使用内置默认口令 (chuankangkk)。生产环境建议在 .env 里 ADMIN_PASSWORD=<随机长串> 覆盖。');
  }

  const db = dbMod.open(config.dbFile);
  const keyStore = new KeyStore(db);
  const store = new Store(db, config.historyLimit);
  const httpClient = new Http({ proxy: config.httpsProxy });
  const translate = createTranslator(config.translate);

  const broadcaster = new Broadcaster({
    keyStore,
    getHistory: (limit) => store.getHistory(limit),
  });
  const admin = new Admin({
    password: config.adminPassword,
    keyStore,
    store,
    broadcaster,
  });

  const publicDir = path.resolve(__dirname, '..', 'public');
  const server = http.createServer(
    createHandler({ store, broadcaster, admin, publicDir })
  );
  broadcaster.attachToServer(server);

  async function handleNew(item) {
    let translated = '';
    if (config.translate.enabled) {
      try { translated = await translate(item.title); }
      catch (e) { logger.warn('translate threw', e.message); }
    }
    const enriched = { ...item, translated, received_at: new Date().toISOString() };
    store.addHistory(enriched);
    const sent = broadcaster.broadcastTweet(enriched);
    logger.ok(`new: [${item.source}] -> ws*${sent} | ${item.title.slice(0, 80)}`);

    if (config.pushplus.enabled && config.pushplus.token) {
      try {
        const title = buildTitle(translated || item.title);
        const html = buildHtml(item, translated);
        await pushPlus(config.pushplus, title, html);
      } catch (e) { logger.warn('pushplus failed:', e.message); }
    }
    store.markPushed(item.guid);
  }

  const pollers = [];
  if (config.rss.enabled) {
    pollers.push(new Poller({
      name: 'rss',
      baseIntervalMs: config.rss.intervalMs,
      jitterPct: config.rss.jitterPct,
      store,
      isKnown: (id) => store.hasPushed(id),
      onNew: handleNew,
      fetchFn: () => fetchRSS(httpClient, config.rss.url),
    }));
  }
  if (config.truth.enabled) {
    pollers.push(new Poller({
      name: 'truth',
      baseIntervalMs: config.truth.intervalMs,
      jitterPct: 30,
      store,
      isKnown: (id) => store.hasPushed(id),
      onNew: handleNew,
      fetchFn: () => fetchTruth(httpClient, { accountId: config.truth.accountId, bearer: config.truth.bearer }),
    }));
  }

  if (pollers.length === 0) logger.warn('no source enabled');
  for (const p of pollers) p.start();

  await new Promise((res) => server.listen(config.port, res));
  logger.ok(`listening on http://0.0.0.0:${config.port}`);
  logger.ok(`  -> http://0.0.0.0:${config.port}/        landing`);
  logger.ok(`  -> http://0.0.0.0:${config.port}/admin   key 管理面板`);
  logger.ok(`  -> http://0.0.0.0:${config.port}/demo    实时 WS 演示`);
  logger.ok(`  -> http://0.0.0.0:${config.port}/docs    WS 对接文档`);
  logger.ok(`  -> ws://0.0.0.0:${config.port}/ws        WebSocket 端点`);

  function shutdown(sig) {
    logger.info(`shutdown: ${sig}`);
    for (const p of pollers) p.stop();
    broadcaster.close();
    server.close(() => { try { db.close(); } catch {} process.exit(0); });
    setTimeout(() => process.exit(1), 5000).unref();
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((e) => {
  console.error('fatal:', e);
  process.exit(1);
});
