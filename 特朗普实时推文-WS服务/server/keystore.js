'use strict';

// API Key 管理：生成 / 验证 / 列举 / 撤销。
//
// 安全策略（Stripe 风格）:
//   - secret = 'ttws_live_' (10) + 37 hex 字符，总长 47
//   - DB 只存 SHA-256 哈希；secret 明文只在创建时返回一次
//   - 显示用 prefix = secret 的前 12 字符（"ttws_live_xxxx"），方便用户识别
//   - 过期时间存 unix ms；NULL = 永久
//   - 校验时实时检查 revoked + expires_at + 更新 last_used_at + request_count

const crypto = require('crypto');

function randomSecret() {
  const raw = crypto.randomBytes(32).toString('hex'); // 64 hex chars
  return 'ttws_live_' + raw.slice(0, 37); // 总长 47
}

function hash(secret) {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

function genId() {
  return 'key_' + crypto.randomBytes(8).toString('hex');
}

// 解析人类友好的有效期表达：'1h' '24h' '7d' '30d' '1y' 'never' 或 ISO 字符串 或 数字（毫秒）
function parseExpiresAt(input) {
  if (!input || input === 'never' || input === 'forever' || input === 'null') return null;
  const m = /^(\d+)(s|m|h|d|y)$/i.exec(String(input));
  if (m) {
    const n = parseInt(m[1], 10);
    const unit = m[2].toLowerCase();
    const mult = { s: 1e3, m: 60e3, h: 3600e3, d: 86400e3, y: 31536000e3 }[unit];
    return Date.now() + n * mult;
  }
  const num = parseInt(input, 10);
  if (Number.isFinite(num) && String(num) === String(input)) return num;
  const d = new Date(input);
  if (!isNaN(d.getTime())) return d.getTime();
  return null;
}

class KeyStore {
  constructor(db) {
    this.db = db;
    this._stmts = {
      insert: db.prepare(
        `INSERT INTO api_keys (id, name, secret_hash, prefix, created_at, expires_at, note)
         VALUES (@id, @name, @secret_hash, @prefix, @created_at, @expires_at, @note)`
      ),
      list: db.prepare(
        `SELECT id, name, prefix, created_at, expires_at, last_used_at, request_count, revoked, note
         FROM api_keys ORDER BY created_at DESC`
      ),
      getBySecret: db.prepare(`SELECT * FROM api_keys WHERE secret_hash = ?`),
      revoke: db.prepare(`UPDATE api_keys SET revoked = 1 WHERE id = ?`),
      del: db.prepare(`DELETE FROM api_keys WHERE id = ?`),
      bumpUsage: db.prepare(
        `UPDATE api_keys
         SET last_used_at = ?, request_count = request_count + 1
         WHERE id = ?`
      ),
      stats: db.prepare(`SELECT COUNT(*) AS total,
                                SUM(CASE WHEN revoked=0 AND (expires_at IS NULL OR expires_at > ?) THEN 1 ELSE 0 END) AS active
                         FROM api_keys`),
      getById: db.prepare(`SELECT id, revoked, expires_at FROM api_keys WHERE id = ?`),
    };
  }

  create({ name = '', expires = 'never', note = '' }) {
    const id = genId();
    const secret = randomSecret();
    const prefix = secret.slice(0, 12); // ttws_live_xxxx
    const created_at = Date.now();
    const expires_at = parseExpiresAt(expires);
    this._stmts.insert.run({
      id,
      name,
      secret_hash: hash(secret),
      prefix,
      created_at,
      expires_at,
      note,
    });
    return {
      id,
      name,
      prefix,
      created_at,
      expires_at,
      note,
      secret, // 只在此处返回一次！
    };
  }

  list() {
    const now = Date.now();
    return this._stmts.list.all().map((row) => ({
      ...row,
      revoked: !!row.revoked,
      active: !row.revoked && (row.expires_at == null || row.expires_at > now),
      expires_in_ms: row.expires_at ? row.expires_at - now : null,
    }));
  }

  // 主要校验入口：返回 {ok, reason, row?}
  verify(secret) {
    if (!secret || typeof secret !== 'string') return { ok: false, reason: 'missing' };
    if (!secret.startsWith('ttws_live_')) return { ok: false, reason: 'bad_format' };
    const row = this._stmts.getBySecret.get(hash(secret));
    if (!row) return { ok: false, reason: 'not_found' };
    if (row.revoked) return { ok: false, reason: 'revoked', row };
    if (row.expires_at != null && row.expires_at <= Date.now()) {
      return { ok: false, reason: 'expired', row };
    }
    return { ok: true, row };
  }

  // 验证通过后调用：更新使用计数（不抛错）
  bumpUsage(id) {
    try {
      this._stmts.bumpUsage.run(Date.now(), id);
    } catch {}
  }

  revoke(id) {
    return this._stmts.revoke.run(id).changes > 0;
  }

  delete(id) {
    return this._stmts.del.run(id).changes > 0;
  }

  stats() {
    return this._stmts.stats.get(Date.now());
  }

  // 轻量定时检查：key 是否仍可用。返回 {ok, reason}。
  recheckById(id) {
    const row = this._stmts.getById.get(id);
    if (!row) return { ok: false, reason: 'not_found' };
    if (row.revoked) return { ok: false, reason: 'revoked' };
    if (row.expires_at != null && row.expires_at <= Date.now()) return { ok: false, reason: 'expired' };
    return { ok: true };
  }
}

module.exports = { KeyStore, parseExpiresAt };
