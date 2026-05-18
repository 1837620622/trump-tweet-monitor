'use strict';

// SQLite 集中初始化。三张表：
//   api_keys    —— API Key 元数据
//   pushed_ids  —— 已推送过的 tweet guid（用于去重）
//   history     —— 最近的推文，供 /api/tweets 与 WS 历史回放

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { logger } = require('./utils');

function open(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  logger.info(`db: opened ${file}`);
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL DEFAULT '',
      secret_hash   TEXT NOT NULL UNIQUE,
      prefix        TEXT NOT NULL,
      created_at    INTEGER NOT NULL,
      expires_at    INTEGER,                 -- NULL = never expires
      last_used_at  INTEGER,
      request_count INTEGER NOT NULL DEFAULT 0,
      revoked       INTEGER NOT NULL DEFAULT 0,
      note          TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_api_keys_secret ON api_keys(secret_hash);
    CREATE INDEX IF NOT EXISTS idx_api_keys_created ON api_keys(created_at DESC);

    CREATE TABLE IF NOT EXISTS pushed_ids (
      guid       TEXT PRIMARY KEY,
      pushed_at  INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_pushed_at ON pushed_ids(pushed_at DESC);

    CREATE TABLE IF NOT EXISTS history (
      guid       TEXT PRIMARY KEY,
      source     TEXT NOT NULL,
      pub_date   TEXT NOT NULL,
      received_at INTEGER NOT NULL,
      payload    TEXT NOT NULL    -- 规范化后的 Tweet JSON
    );

    CREATE INDEX IF NOT EXISTS idx_history_received ON history(received_at DESC);
  `);
}

module.exports = { open };
