# 特朗普实时推文 · WebSocket 服务

> **私有项目 · 不开源 · 不分发**
> 部署在你自己的服务器（HK 43.240.13.39）。Cloudflare 那套 `cloudflare-worker.js` + `index.html` 仍然在 `trump-x.chuankangkk.top` 独立跑，不受影响。

实时抓取 Donald Trump 在 Truth Social 上的新帖，经 Groq AI 中文翻译后，通过 **WebSocket** 实时广播给已授权的客户端（AI 分析、量化策略、自定义机器人等）。带完整 API Key 管理后台 + 演示页面 + 对接文档。

## 功能

- 🔄 **多源轮询**：默认 `trumpstruth.org` RSS（10s 间隔）+ 可选 Truth Social 一手 Mastodon API（3s 间隔）
- 🌐 **WebSocket 广播**：单连接长流，毫秒级转发，过滤源 (`all` / `rss` / `truth`)
- 🔐 **API Key 体系**：Stripe 风格，前缀可见 / secret 哈希存储 / 创建时仅一次明文返回 / 支持过期 (1h/1d/7d/30d/1y/自定义/永久) / 一键撤销 / 用量统计
- 🤖 **AI 翻译**：Groq `llama-3.1-8b-instant`（免费、亚秒级）→ Google → MyMemory → 原文 四级回退
- 📱 **PushPlus 微信推送**：保留，与 WS 并行
- 🎛 **管理后台 `/admin`**：登录态 7 天 cookie + 创建/列表/撤销/删除 + 在线连接数/历史数实时统计
- 📡 **演示页 `/demo`**：粘贴 key 直接看实时推流
- 📖 **文档页 `/docs`**：Python / Node.js 客户端示例，复制即跑
- 💾 **SQLite 单文件持久化**：WAL 模式、3 张表（api_keys / pushed_ids / history）
- 🔌 **systemd 单元 + 一键安装脚本**：`bash deploy/install.sh` 几分钟就绪

## 目录结构

```
特朗普实时推文-WS服务/
├── server/
│   ├── index.js        # 入口
│   ├── config.js       # 环境变量 -> 配置对象
│   ├── db.js           # SQLite 初始化 + 迁移
│   ├── keystore.js     # API Key CRUD + 校验
│   ├── store.js        # pushed_ids + history（SQLite 后端）
│   ├── translator.js   # Groq → Google → MyMemory 回退链
│   ├── fetcher.js      # RSS + Truth Social Mastodon API 抓取
│   ├── poller.js       # 单源轮询器（带抖动+指数退避）
│   ├── broadcaster.js  # WebSocket 服务 + 鉴权 + 心跳
│   ├── admin.js        # /admin/api/* 路由 (登录/keys/stats)
│   ├── http.js         # 路由 + 静态资源
│   ├── pusher.js       # PushPlus
│   └── utils.js        # logger + UA 池 + 工具
├── public/             # 静态前端 (index/admin/demo/docs)
├── scripts/smoke.js    # 22 项 端到端冒烟测试
├── deploy/             # systemd unit + install.sh
├── docs/               # WEBSOCKET.md + DEPLOY.md
├── .env.example
└── package.json
```

## 快速开始

```bash
cp .env.example .env       # admin 默认口令 chuankangkk，可在 .env 改
npm install                # better-sqlite3 + ws，仅 2 个直接依赖
npm run smoke              # 跑 22 项端到端测试
npm start                  # 监听 :8787
```

访问入口：
- `http://localhost:8787/`          首页
- `http://localhost:8787/admin`     管理后台（默认密码 `chuankangkk`）
- `http://localhost:8787/demo`      实时 WS 演示
- `http://localhost:8787/docs`      对接文档
- `ws://localhost:8787/ws?token=…`  WebSocket 端点

## 部署到生产

见 `docs/DEPLOY.md`。一句话：

```bash
scp -r 特朗普实时推文-WS服务 root@<your-server>:/opt/trump-truth-ws-src
ssh root@<your-server> 'bash /opt/trump-truth-ws-src/deploy/install.sh'
```

## 安全提醒

- repo **必须保持 private**。`chuankangkk` 是硬编码默认密码，公开等于裸奔。
- 生产建议在 `.env` 里写一个 24+ 位随机串覆盖默认。
- HTTPS 用 Caddy / Nginx 反代，不要把 8787 直接暴露公网。
- 你之前那个 PushPlus token (`7dba765a...`) 已经在 git 历史里泄露了，**去 pushplus.plus 后台立刻重置**。
