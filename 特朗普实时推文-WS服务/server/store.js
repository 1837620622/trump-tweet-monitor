'use strict';

// SQLite-backed store for pushed_ids + history. 替代旧的 JSON 文件存储。

class Store {
  constructor(db, historyLimit) {
    this.db = db;
    this.historyLimit = historyLimit;
    this._s = {
      hasPushed: db.prepare(`SELECT 1 FROM pushed_ids WHERE guid = ?`),
      markPushed: db.prepare(
        `INSERT OR IGNORE INTO pushed_ids (guid, pushed_at) VALUES (?, ?)`
      ),
      trimPushed: db.prepare(
        `DELETE FROM pushed_ids WHERE guid IN (
           SELECT guid FROM pushed_ids ORDER BY pushed_at ASC LIMIT MAX(0, (SELECT COUNT(*) FROM pushed_ids) - 1000)
         )`
      ),
      insertHistory: db.prepare(
        `INSERT INTO history (guid, source, pub_date, received_at, payload)
         VALUES (@guid, @source, @pub_date, @received_at, @payload)
         ON CONFLICT(guid) DO UPDATE SET
           source=excluded.source, pub_date=excluded.pub_date,
           received_at=excluded.received_at, payload=excluded.payload`
      ),
      trimHistory: db.prepare(
        `DELETE FROM history WHERE guid IN (
           SELECT guid FROM history ORDER BY received_at DESC LIMIT -1 OFFSET ?
         )`
      ),
      listHistory: db.prepare(
        `SELECT payload FROM history ORDER BY received_at DESC LIMIT ?`
      ),
      countHistory: db.prepare(`SELECT COUNT(*) AS c FROM history`),
    };
  }

  hasPushed(id) {
    return !!this._s.hasPushed.get(id);
  }

  markPushed(id) {
    this._s.markPushed.run(id, Date.now());
    // 偶尔清一下，避免 pushed_ids 表无限增长
    if (Math.random() < 0.05) {
      try { this._s.trimPushed.run(); } catch {}
    }
  }

  // 首次启动时把抓到的 ID 都标记为已知，防止补推
  seedKnownIds(ids) {
    const tx = this.db.transaction((arr) => {
      const now = Date.now();
      for (const id of arr) this._s.markPushed.run(id, now);
    });
    tx(ids);
  }

  addHistory(item) {
    this._s.insertHistory.run({
      guid: item.guid,
      source: item.source,
      pub_date: item.pubDate,
      received_at: Date.now(),
      payload: JSON.stringify(item),
    });
    try { this._s.trimHistory.run(this.historyLimit); } catch {}
  }

  getHistory(limit) {
    const lim = Math.max(1, Math.min(parseInt(limit, 10) || this.historyLimit, 500));
    return this._s.listHistory.all(lim).map((r) => {
      try { return JSON.parse(r.payload); } catch { return null; }
    }).filter(Boolean);
  }

  count() {
    return this._s.countHistory.get().c;
  }
}

module.exports = Store;
