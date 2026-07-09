<p align="center">
  <img src="assets/logo.svg" width="72" height="72" alt="Trump Truth Monitor" />
</p>

<h1 align="center">Trump Truth Monitor</h1>

<p align="center">
  <strong>特朗普 Truth Social 实时信息流</strong><br/>
  原文 · 中文翻译 · 图片 / 视频 · 面向阅读与商业对接
</p>

<p align="center">
  <a href="https://trump-x.chuankangkk.top/"><img alt="Live" src="https://img.shields.io/badge/Live-trump--x.chuankangkk.top-1d9bf0?style=flat-square" /></a>
  <a href="https://github.com/1837620622/trump-tweet-monitor"><img alt="GitHub" src="https://img.shields.io/badge/GitHub-1837620622-181717?style=flat-square&logo=github" /></a>
  <img alt="Status" src="https://img.shields.io/badge/Source-Commercial-6e7681?style=flat-square" />
</p>

---

## 在线站点

| | |
| --- | --- |
| 地址 | **[https://trump-x.chuankangkk.top/](https://trump-x.chuankangkk.top/)** |
| 说明 | 打开即可浏览，无需注册、无需安装 |

界面采用与 X 相近的深色时间线布局，聚焦内容本身，无多余宣传文案。

---

## 产品能力（摘要）

| 模块 | 内容 |
| --- | --- |
| 信息流 | Donald J. Trump（@realDonaldTrump）公开帖文 |
| 文本 | 原文展示 |
| 翻译 | 简体中文（多级引擎回退） |
| 媒体 | 图片 / 视频识别与展示 |
| 商业 | 微信推送、源码授权、WSS / API、定制开发 |

本仓库**不公开完整源码**。公开内容仅含产品说明、在线入口与商务联系方式。

---

## 商务合作

### 服务档位

| 档位 | 交付物 | 适用场景 |
| --- | --- | --- |
| 微信自动推送 | 新帖触达微信（个人 / 群 / 公众号链路可配） | 只要提醒，不自建系统 |
| 完整源码授权 | Workers 端 + 自托管 WebSocket 服务端工程与文档 | 二次开发、内网 / 私有部署 |
| WSS / API 接入 | 长连接 JSON 推流、Key 鉴权、用量与撤销 | Agent、机器人、量化、大屏 |
| 定制开发 | 多账号、多语言、多通道同步、对接现有系统 | 企业 / 机构需求 |
| 商务 / 渠道 | 分销、白标、批量授权 | 合作伙伴 |

**报价按档位、授权范围与是否代运维确定，以微信沟通为准。** 不同产品价格不同，请勿默认统一标价。

### Agent / 程序对接（商业开通后）

| 能力 | 说明 |
| --- | --- |
| 协议 | `ws://` / `wss://`，帧体为 **UTF-8 JSON** |
| 解析 | 客户端 `JSON.parse` 后按 `type` 分发即可 |
| 字段 | `text` 原文、`translated` 译文、`media[]` 媒体 URL |
| 可选 | `media[].base64` / `data_uri`（订阅参数开启） |
| Schema | 服务提供 `/api/agent/schema` 与示例 JSON 文件 |

开通后提供端点、API Key 与对接文档，不在本公开仓展开实现细节。

---

## 联系方式

| 渠道 | 信息 |
| --- | --- |
| 微信 | **1837620622**（传康Kk） |
| 邮箱 | 2040168455@qq.com |
| 咸鱼 / B 站 | 万能程序员 |
| GitHub | [1837620622/trump-tweet-monitor](https://github.com/1837620622/trump-tweet-monitor) |

<p align="center">
  <img src="assets/wechat-qrcode.png" width="200" alt="WeChat QR" />
</p>

<p align="center"><sub>扫码添加微信 · 请务必备注来意</sub></p>

### 添加微信时请备注来意

直接填写下列之一（或等价中文），便于优先处理：

| 备注示例 | 对应需求 |
| --- | --- |
| `推送订阅` | 微信自动推送 |
| `买源码` | 完整源码授权 |
| `API对接` / `WSS` | 程序 / Agent 接入 |
| `商务合作` | 渠道、白标、批量 |
| `定制开发` | 需求评估与排期 |

补充说明使用场景（阅读 / 交易辅助 / 媒体 / 内部系统等）与是否需要发票 / 对公，可加快报价。

---

## 仓库说明

```
trump-tweet-monitor/
├── README.md                 # 本说明（公开）
├── assets/
│   ├── logo.svg              # 品牌标识
│   ├── icon-wechat.svg
│   └── wechat-qrcode.png     # 微信二维码
└── .gitignore
```

完整工程与密钥配置仅在商业交付包中提供，不进入本 GitHub 仓库。

---

## 声明

1. 本项目为第三方信息聚合与展示工具，与 Truth Social、X 等平台无官方隶属或授权关系。  
2. 数据来自公开可访问渠道；使用方须自行遵守当地法律法规与平台服务条款。  
3. 源码与接口服务受商业授权约束：禁止未授权转售、二次开源或公开泄露。  
4. 在线站点用于产品体验；稳定性与 SLA 以商业合同或开通协议为准。

---

## 作者

**万能程序员 · 传康Kk**

- 微信：1837620622  
- 邮箱：2040168455@qq.com  
- 站点：[https://trump-x.chuankangkk.top/](https://trump-x.chuankangkk.top/)  

需要推送、源码、WSS/API 或商务合作：请添加微信 **1837620622**，**备注来意**。
