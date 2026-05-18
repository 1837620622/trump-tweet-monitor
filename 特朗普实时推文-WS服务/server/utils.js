'use strict';

// 真实浏览器 UA 池，定时轮换降低被指纹封禁概率
const UA_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
];

function pickUA() {
  return UA_POOL[Math.floor(Math.random() * UA_POOL.length)];
}

// 加入抖动避免规律请求
function jitter(ms, pct) {
  if (!pct) return ms;
  const span = ms * (pct / 100);
  return Math.max(500, Math.round(ms + (Math.random() * 2 - 1) * span));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// 简易 logger，带时间戳和级别色彩（终端可读）
function log(level, ...args) {
  const ts = new Date().toISOString();
  const tag = { info: '\x1b[36mINFO\x1b[0m', warn: '\x1b[33mWARN\x1b[0m', err: '\x1b[31mERR \x1b[0m', ok: '\x1b[32m OK \x1b[0m' }[level] || level;
  console.log(`[${ts}] ${tag}`, ...args);
}

const logger = {
  info: (...a) => log('info', ...a),
  warn: (...a) => log('warn', ...a),
  err: (...a) => log('err', ...a),
  ok: (...a) => log('ok', ...a),
};

// 比较两条推文，时间更新或 ID 不同视为不同
function tweetKey(t) {
  return t.guid || t.id || t.link;
}

module.exports = { pickUA, jitter, sleep, logger, tweetKey };
