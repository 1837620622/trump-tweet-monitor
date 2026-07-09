<p align="center">
  <img src="assets/logo.svg" width="88" height="88" alt="Trump Tracker" />
</p>

<h1 align="center">Trump Tracker</h1>

<p align="center">
  <b>Truth Social posts · Chinese translation · OGE stock trades</b><br/>
  <sub>X-style demo · full showcase features · commercial source / WSS</sub>
</p>

<p align="center">
  <i>One feed. Posts + trades + tracked accounts. Built like X — sold as a product.</i>
</p>

<p align="center">
  <a href="https://trump-x.chuankangkk.top/">
    <img src="https://img.shields.io/badge/Live_Demo-Open_Trump_Tracker-1d9bf0?style=for-the-badge" alt="Live Demo" />
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Posts-Truth_Social-0f1419?style=flat-square" alt="Posts" />
  <img src="https://img.shields.io/badge/Media-Image_|_Video-1d9bf0?style=flat-square" alt="Media" />
  <img src="https://img.shields.io/badge/Trades-OGE_Disclosure-00ba7c?style=flat-square" alt="Trades" />
  <img src="https://img.shields.io/badge/i18n-EN_|_中文-71767b?style=flat-square" alt="i18n" />
  <img src="https://img.shields.io/badge/Security-Session_+_Rate_Limit-b91c1c?style=flat-square" alt="Security" />
  <img src="https://img.shields.io/badge/Source-Commercial-6e7681?style=flat-square" alt="Commercial" />
</p>

---

## Live demo

### [https://trump-x.chuankangkk.top/](https://trump-x.chuankangkk.top/)

| | |
|:--|:--|
| **Brand** | **Trump Tracker** (English title) |
| **UI** | X-style three-column layout · mobile ready |
| **Language** | Language switcher (default English) |
| **Tabs** | Posts · Trades · Accounts |

> Browse the feed → open trades → explore tracked sources → contact for commercial delivery.

---

## What you get

| Module | Public demo | Commercial license |
|:--|:--|:--|
| **Posts** | Truth text + Chinese + **image/video** (demo cap) | Full history · lower latency · WeChat push |
| **Media** | Adaptive enrich from RSS / archive HTML / previews | Same pipeline · private deploy |
| **Trades** | OGE buy/sell cards (demo cap) | Full sync · Webhook / WSS |
| **Accounts** | Social · family · White House · finance · records · media · archive | Multi-account expansion |
| **Agent protocol** | Not public | WSS JSON + API Key + schema |
| **Source code** | Not public | Cloudflare Worker + Node WSS stack |

**Demo = full product surface for humans.**  
**Not free scrapable API / not free protocol / not free source.**

---

## Tracked account categories

| Category | Examples |
|:--|:--|
| **Primary** | Truth Social @realDonaldTrump · X · Truth platform |
| **Family & allies** | Melania · DT Jr. · Eric · Lara |
| **White House** | whitehouse.gov · @WhiteHouse · JD Vance · press · RNC |
| **Finance** | OGE trades · Quiver · portfolio trackers · OpenSecrets · FEC |
| **Official records** | OGE · GovInfo · Federal Register |
| **Media & research** | C-SPAN · Ballotpedia · Wikipedia |
| **Archive** | trumpstruth.org |
| **Project** | This GitHub marketing repo |

Tags: **In demo** = used by this site · **External** = open link · **Unstable** = third-party may change.

---

## Demo security (anti-crawl)

The live site is **display-only**. Browsers can use it; bulk scrapers should not.

| Control | Purpose |
|:--|:--|
| Session cookie | HttpOnly + Secure · open the page first |
| Bot / automation UA | curl / python / empty UA → 403 |
| Sec-Fetch soft gate | Scripts reusing cookies get tighter limits |
| Session quota | Limited demo API calls per session / hour |
| IP rate limit | Burst protection (Cache API first, saves free KV writes) |
| Strike → ban | Repeated bot abuse → temporary IP ban |
| CORS allowlist | Blocks third-party websites from calling the API |
| Demo item cap + short cache | Not a full-history export |
| Raw RSS proxy | Disabled on public demo |
| Admin endpoints | Header secret only (no `?secret=` in URL) |

**Commercial WSS / full API / protocol docs / source = paid delivery only.**  
Unauthorized crawling, mirroring, or resale is prohibited. Abuse may result in IP ban.

---

## Free Cloudflare plan notes

This demo is tuned for **Workers Free**:

| Resource | Free-ish limit | Our approach |
|:--|:--|:--|
| Requests | ~100k / day | Cron every **2 minutes** (~720/day) |
| KV writes | ~1000 / day | No KV write when no new posts · rate limit prefers Cache API |
| CPU | short per invoke | Media enrich concurrent · translate capped · timeouts |
| Realtime | RSS archive lag dominates | Cron + 30s frontend poll · warm cache on new posts |

Faster than “every few minutes” usually needs a **self-hosted poller / paid plan / Truth API**, not denser free cron alone.

---

## Commercial packages

| Package | Deliverable | WeChat note example |
|:--|:--|:--|
| WeChat push | Instant alerts on new posts | `推送订阅` |
| Full source | CF Worker + WS codebase | `买源码` |
| WSS / API | Key · JSON stream · schema | `API对接` |
| Custom build | Multi-account · private deploy | `定制开发` |
| White-label | Reseller / channel | `商务合作` |

Pricing by scope — **WeChat is the source of truth**.

---

## Contact

<p align="center">
  <img src="assets/wechat-qrcode.png" width="220" alt="WeChat" />
</p>

<p align="center">
  <b>WeChat 1837620622</b> (传康Kk)<br/>
  Email 2040168455@qq.com · Xianyu / Bilibili: 万能程序员<br/>
  Add WeChat with a note: <code>推送订阅</code> / <code>买源码</code> / <code>API对接</code> / <code>商务合作</code>
</p>

---

## Repository notice

This public repository is **marketing only** (README + assets).

- Full Worker / WSS source lives in a private tree and is **not** published here.
- Do not expect runnable server code in this repo.

---

<p align="center">
  <sub>© Trump Tracker · commercial product · not affiliated with Truth Social, X, or the U.S. government</sub>
</p>
