'use strict';

const path = require('path');

function bool(v, def = false) {
  if (v === undefined || v === null || v === '') return def;
  return /^(1|true|yes|on)$/i.test(String(v));
}
function int(v, def) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

const config = {
  port: int(process.env.PORT, 8787),

  // 默认 admin 口令；.env 里设 ADMIN_PASSWORD 即覆盖
  adminPassword: process.env.ADMIN_PASSWORD || 'chuankangkk',

  dbFile: path.resolve(process.cwd(), process.env.DB_FILE || './data/state.db'),

  rss: {
    enabled: bool(process.env.SOURCE_RSS_ENABLED, true),
    url: process.env.SOURCE_RSS_URL || 'https://www.trumpstruth.org/feed',
    intervalMs: int(process.env.SOURCE_RSS_INTERVAL_MS, 10000),
    jitterPct: int(process.env.SOURCE_RSS_JITTER_PCT, 20),
  },

  truth: {
    enabled: bool(process.env.SOURCE_TRUTH_ENABLED, false),
    accountId: process.env.SOURCE_TRUTH_ACCOUNT_ID || '107780257626128497',
    bearer: process.env.SOURCE_TRUTH_BEARER || '',
    intervalMs: int(process.env.SOURCE_TRUTH_INTERVAL_MS, 3000),
  },

  httpsProxy: process.env.HTTPS_PROXY || process.env.https_proxy || '',

  translate: {
    enabled: bool(process.env.TRANSLATE_ENABLED, true),
    groqKey: process.env.GROQ_API_KEY || '',
    groqModel: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
  },

  pushplus: {
    enabled: bool(process.env.PUSH_ENABLED, true),
    token: process.env.PUSHPLUS_TOKEN || '',
    topic: process.env.PUSHPLUS_TOPIC || 'trump',
    api: process.env.PUSHPLUS_API || 'http://www.pushplus.plus/send',
  },

  historyLimit: int(process.env.HISTORY_LIMIT, 200),
};

module.exports = config;
