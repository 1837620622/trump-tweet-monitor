'use strict';

// 单源轮询器：定时调用 fetchFn，发现新条目就交给 onNew 回调。
// 自带 jitter + 指数退避：连续失败/被限流时拉长间隔，恢复后回到基础间隔。

const { jitter, sleep, logger, tweetKey } = require('./utils');

class Poller {
  constructor({ name, fetchFn, baseIntervalMs, jitterPct = 20, onNew, isKnown, store }) {
    this.name = name;
    this.fetchFn = fetchFn;
    this.baseIntervalMs = baseIntervalMs;
    this.jitterPct = jitterPct;
    this.onNew = onNew;
    this.isKnown = isKnown; // (id) => boolean
    this.store = store;
    this._stopped = false;
    this._failStreak = 0;
    this._firstRun = true;
  }

  async start() {
    while (!this._stopped) {
      const t0 = Date.now();
      let result;
      try {
        result = await this.fetchFn();
      } catch (e) {
        logger.err(`poller[${this.name}]: throw`, e.message);
        result = { items: [], error: true };
      }
      const elapsed = Date.now() - t0;

      if (result.notModified) {
        this._failStreak = 0;
        logger.info(`poller[${this.name}]: 304 not modified (${elapsed}ms)`);
      } else if (result.rateLimited) {
        this._failStreak = Math.min(this._failStreak + 1, 6);
        logger.warn(`poller[${this.name}]: rate-limited, backoff x${this._failStreak}`);
      } else if (result.error) {
        this._failStreak = Math.min(this._failStreak + 1, 6);
      } else {
        this._failStreak = 0;
        const items = result.items || [];
        if (this._firstRun) {
          // 首次抓取：把所有 ID 都标记为已知，避免一次性补推 20 条历史
          const ids = items.map(tweetKey).filter(Boolean);
          if (this.store) this.store.seedKnownIds(ids);
          for (const it of items) {
            if (this.store) this.store.addHistory(it);
          }
          logger.ok(`poller[${this.name}]: bootstrap seeded ${ids.length} known ids (${elapsed}ms)`);
          this._firstRun = false;
        } else {
          // 倒序处理：旧的先广播，新的最后广播
          const fresh = items.filter((it) => !this.isKnown(tweetKey(it))).reverse();
          for (const it of fresh) {
            try {
              await this.onNew(it);
            } catch (e) {
              logger.err(`poller[${this.name}]: onNew error`, e.message);
            }
          }
          if (fresh.length) {
            logger.ok(`poller[${this.name}]: ${fresh.length} new (total ${items.length}, ${elapsed}ms)`);
          }
        }
      }

      const backoffFactor = 1 + this._failStreak; // 1, 2, 3, ... 6
      const next = jitter(this.baseIntervalMs * backoffFactor, this.jitterPct);
      await sleep(next);
    }
  }

  stop() {
    this._stopped = true;
  }
}

module.exports = Poller;
