<p align="center">
  <img src="assets/logo.svg" width="88" height="88" alt="Trump Truth Monitor" />
</p>

<h1 align="center">Trump Truth Monitor</h1>

<p align="center">
  <b>特朗普 · 实时帖文 · 中文翻译 · 股票披露交易</b><br/>
  <sub>X 风格时间线 · 全球双语 · 商业级推送 / 源码 / WSS API</sub>
</p>

<p align="center">
  <a href="https://trump-x.chuankangkk.top/"><img src="https://img.shields.io/badge/Live_Demo-Open_Now-1d9bf0?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Live Demo" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Truth_Social-Posts-0f1419?style=flat-square" alt="Truth" />
  <img src="https://img.shields.io/badge/OGE-Stock_Trades-00ba7c?style=flat-square" alt="Trades" />
  <img src="https://img.shields.io/badge/i18n-EN_%2F_中文-71767b?style=flat-square" alt="i18n" />
  <img src="https://img.shields.io/badge/Cloudflare-Workers-f38020?style=flat-square&logo=cloudflare&logoColor=white" alt="CF" />
  <img src="https://img.shields.io/badge/Source-Commercial-6e7681?style=flat-square" alt="Commercial" />
</p>

---

## 30 秒体验

| | |
|:--|:--|
| **在线地址** | **[https://trump-x.chuankangkk.top/](https://trump-x.chuankangkk.top/)** |
| **怎么用** | 浏览器打开即可，无需注册、无需安装 |
| **界面** | 深色时间线，接近 X / Twitter 的浏览手感 |
| **语言** | 右上角 **EN / 中文**；按时区自动默认语言 |

> 打开 Demo → 刷帖文 → 切到「股票交易」→ 再看「追踪账号」。  
> 需要推送 / 源码 / API？页面内 **商务合作** 或加微信。

---

## 为什么做这个

特朗普一条 Truth、一次公开披露，都可能牵动情绪与市场注意力。

**Trump Truth Monitor** 把两件最有价值的事放在同一条产品线里：

1. **帖文**：原文 + 中文 + 图片 / 视频  
2. **交易**：OGE 披露的买入 / 卖出（代码、金额区间、成交日、申报日）

给阅读者、媒体编辑、量化与 Agent 开发者一个**干净、可对接**的入口——而不是散落在各个网站里翻。

---

## 你能看到什么

| 模块 | 内容 | 适合谁 |
|:--|:--|:--|
| **帖文 Posts** | `@realDonaldTrump` 公开帖、中英对照、媒体帖识别 | 日常跟进、内容团队 |
| **股票交易 Trades** | 披露交易列表：Ticker / Buy·Sell / 金额区间 / 日期 | 研究、交易辅助（非荐股） |
| **追踪账号 Accounts** | Truth · 交易源 · GitHub · 第三方 Tracker 外链 | 看清数据从哪来 |
| **商务 Business** | 推送 · 源码 · WSS/API · 定制（弹窗 / 侧栏） | 要落地集成的人 |

本仓库 **不公开完整源码**。公开内容 = 产品说明 + 在线体验 + 商务入口。

---

## 产品亮点

```text
┌─────────────────────────────────────────────────────────┐
│  Timeline (X-style)                                     │
│  · Posts  · Trades  · Tracked sources                   │
│  · EN / 中文  · Mobile modal for business               │
└─────────────────────────────────────────────────────────┘
          │
          ├─ 阅读：打开即用，双语切换，响应式
          ├─ 交易：披露数据卡片化（买绿 / 卖红）
          └─ 商业：微信推送 / 源码授权 / Agent JSON 流
```

- **像刷 X，而不是像填表**：三栏布局 · 帖卡 · 交易卡 · 追踪源  
- **双语全球站**：EN / 中文；默认语言跟时区走  
- **帖 + 交易一体**：社媒动态与披露交易同一产品入口  
- **手机也完整**：底栏商务 → **弹窗**（不是乱跳外链）  
- **商业可扩展**：推送、自托管源码、WSS JSON 给 Agent  

---

## 商务合作（加微信）

| 档位 | 你得到什么 | 典型场景 |
|:--|:--|:--|
| **微信自动推送** | 新帖 / 关键动态触达微信 | 不想部署，只要提醒 |
| **完整源码授权** | Workers + WS 服务端工程与文档 | 二次开发、私有部署 |
| **WSS / API** | 长连接 JSON、Key 鉴权 | 机器人、量化、Agent |
| **定制开发** | 多账号、多语言、多通道 | 企业 / 机构 |
| **渠道 / 白标** | 分销与批量授权 | 合作伙伴 |

价格按档位与范围报价，**以微信沟通为准**（各档价格不同）。

### Agent 对接（开通后交付）

| | |
|:--|:--|
| 协议 | `ws://` / `wss://` · UTF-8 **JSON** 帧 |
| 解析 | `JSON.parse` → 按 `type` 分发 |
| 字段 | 原文 · 译文 · 媒体 URL ·（可选）base64 |
| 交易 | 可扩展 `type: trade` 结构化字段 |

---

## 联系我们

<p align="center">
  <img src="assets/wechat-qrcode.png" width="220" alt="WeChat QR Code" />
</p>

<p align="center">
  <b>微信：1837620622</b>（传康Kk）<br/>
  邮箱：2040168455@qq.com · 咸鱼 / B 站：万能程序员
</p>

### 添加微信时请备注来意

| 备注 | 含义 |
|:--|:--|
| `推送订阅` | 只要微信提醒 |
| `买源码` | 要完整工程 |
| `API对接` / `WSS` | 程序 / Agent |
| `商务合作` | 渠道 / 白标 |
| `定制开发` | 需求评估 |

写清场景（阅读 / 研究 / 交易辅助 / 媒体 / 内部系统）+ 是否要发票 / 对公，处理更快。

---

## 在线一览

| 链接 | 说明 |
|:--|:--|
| [trump-x.chuankangkk.top](https://trump-x.chuankangkk.top/) | 正式演示站 |
| [GitHub 仓库](https://github.com/1837620622/trump-tweet-monitor) | 本页 |
| [Truth Social 原账号](https://truthsocial.com/@realDonaldTrump) | 一手帖文源 |

---

## 声明

1. 第三方信息聚合与展示工具，**与 Truth Social / X 等无官方隶属关系**。  
2. 数据来自公开可访问渠道（含归档与伦理披露整理）。  
3. **股票披露数据仅供信息展示，不构成投资建议**。  
4. 源码与接口受商业授权约束；禁止未授权转售、二次开源或泄露。  
5. 演示站体验用；SLA 与稳定性以商业协议为准。

---

## 作者

**万能程序员 · 传康Kk**

微信 **1837620622** · 邮箱 2040168455@qq.com  

**[打开在线站 →](https://trump-x.chuankangkk.top/)** · 需要交付请加微信并 **备注来意**。

---

<p align="center">
  <sub>If this feed saves you time — Star the repo. If you need it in production — WeChat 1837620622.</sub>
</p>
