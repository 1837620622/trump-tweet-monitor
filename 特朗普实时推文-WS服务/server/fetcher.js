'use strict';

// 数据抓取层：把不同数据源统一抽象成 fetchLatest() -> Tweet[] 的接口。
// Tweet 规范化结构:
// {
//   guid:      string  // 跨源唯一 ID（用规范化 URL）
//   source:    'rss' | 'truth'
//   title:     string  // 纯文本
//   contentHtml: string  // 富文本 / 原 description（可选）
//   link:      string  // 原文 URL
//   pubDate:   string  // ISO-8601 UTC
//   author:    string
//   mediaUrl:  string | null
//   raw:       any     // 原始字段，调试用
// }

const { pickUA, logger } = require('./utils');

// ---------------- 通用 HTTP（带 ETag/Last-Modified 与代理支持） ----------------
class Http {
  constructor({ proxy = '' } = {}) {
    this.proxy = proxy;
    this.dispatcher = null;
    if (proxy) {
      try {
        const { ProxyAgent } = require('undici');
        this.dispatcher = new ProxyAgent(proxy);
        logger.info(`http: using proxy ${proxy}`);
      } catch (e) {
        logger.warn('http: undici ProxyAgent not available, ignoring HTTPS_PROXY');
      }
    }
    this.etags = new Map();
    this.lastMod = new Map();
  }

  async get(url, extraHeaders = {}) {
    const headers = {
      'User-Agent': pickUA(),
      Accept: 'application/rss+xml, application/xml, application/json, text/xml, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      ...extraHeaders,
    };
    const etag = this.etags.get(url);
    if (etag) headers['If-None-Match'] = etag;
    const lm = this.lastMod.get(url);
    if (lm) headers['If-Modified-Since'] = lm;

    const opts = { headers };
    if (this.dispatcher) opts.dispatcher = this.dispatcher;

    const res = await fetch(url, opts);
    if (res.status === 304) {
      return { status: 304, body: null };
    }
    const newEtag = res.headers.get('etag');
    if (newEtag) this.etags.set(url, newEtag);
    const newLm = res.headers.get('last-modified');
    if (newLm) this.lastMod.set(url, newLm);
    const body = await res.text();
    return { status: res.status, body, headers: res.headers };
  }
}

// ---------------- 工具：去 HTML 标签 ----------------
function stripHtml(s) {
  return String(s || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+\n/g, '\n')
    .trim();
}

// ---------------- 数据源 1：trumpstruth.org RSS ----------------
function parseRSS(xmlText) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRegex.exec(xmlText)) !== null) {
    const x = m[1];
    const grab = (re) => {
      const r = x.match(re);
      return r ? r[1].trim() : '';
    };
    const title =
      grab(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || grab(/<title>([\s\S]*?)<\/title>/);
    const link = grab(/<link>([\s\S]*?)<\/link>/);
    const guid = grab(/<guid[^>]*>([\s\S]*?)<\/guid>/) || link;
    const pubDate = grab(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const creator =
      grab(/<dc:creator><!\[CDATA\[([\s\S]*?)\]\]><\/dc:creator>/) ||
      grab(/<author><!\[CDATA\[([\s\S]*?)\]\]><\/author>/) ||
      grab(/<author>([\s\S]*?)<\/author>/);
    const description =
      grab(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
      grab(/<description>([\s\S]*?)<\/description>/);
    const mediaUrl = (x.match(/<media:content[^>]*url="([^"]+)"/) || [])[1] || '';
    const truthUrl = grab(/<truth:originalUrl>([\s\S]*?)<\/truth:originalUrl>/);

    if (title && guid) {
      items.push({
        guid: truthUrl || guid,
        source: 'rss',
        title: stripHtml(title),
        contentHtml: description,
        link: truthUrl || link,
        pubDate: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        author: creator || '@realDonaldTrump',
        mediaUrl: mediaUrl || null,
        raw: { title, link, guid, pubDate, creator },
      });
    }
  }
  return items;
}

async function fetchRSS(http, url) {
  try {
    const { status, body } = await http.get(url);
    if (status === 304) return { items: [], notModified: true };
    if (status === 429) {
      logger.warn(`rss: 429 from ${url}`);
      return { items: [], rateLimited: true };
    }
    if (status < 200 || status >= 300) {
      logger.warn(`rss: HTTP ${status} from ${url}`);
      return { items: [], error: true };
    }
    return { items: parseRSS(body), notModified: false };
  } catch (e) {
    logger.err('rss: fetch error', e.message);
    return { items: [], error: true };
  }
}

// ---------------- 数据源 2：Truth Social Mastodon API ----------------
async function fetchTruth(http, { accountId, bearer }) {
  const url = `https://truthsocial.com/api/v1/accounts/${accountId}/statuses?limit=20&exclude_replies=false`;
  try {
    const headers = bearer ? { Authorization: `Bearer ${bearer}` } : {};
    const { status, body } = await http.get(url, headers);
    if (status === 304) return { items: [], notModified: true };
    if (status === 429) {
      logger.warn('truth: 429 rate-limited');
      return { items: [], rateLimited: true };
    }
    if (status === 401 || status === 403) {
      logger.warn(`truth: HTTP ${status} (Cloudflare/auth block — likely needs bearer or HK egress)`);
      return { items: [], error: true };
    }
    if (status < 200 || status >= 300) {
      logger.warn(`truth: HTTP ${status}`);
      return { items: [], error: true };
    }
    let arr;
    try {
      arr = JSON.parse(body);
    } catch {
      logger.warn('truth: non-JSON response');
      return { items: [], error: true };
    }
    if (!Array.isArray(arr)) return { items: [], error: true };
    const items = arr.map((s) => {
      const media = (s.media_attachments && s.media_attachments[0]) || null;
      return {
        guid: s.url || `truthsocial-${s.id}`,
        source: 'truth',
        title: stripHtml(s.content || ''),
        contentHtml: s.content || '',
        link: s.url || '',
        pubDate: s.created_at || new Date().toISOString(),
        author: (s.account && ('@' + s.account.username)) || '@realDonaldTrump',
        mediaUrl: media ? media.url || media.preview_url || null : null,
        raw: { id: s.id, reblog: s.reblog ? s.reblog.id : null },
      };
    });
    return { items };
  } catch (e) {
    logger.err('truth: fetch error', e.message);
    return { items: [], error: true };
  }
}

module.exports = { Http, fetchRSS, fetchTruth, stripHtml };
