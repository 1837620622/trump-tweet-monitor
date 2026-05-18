# WebSocket 对接文档

服务在同一 HTTP 端口下暴露 WebSocket 端点：

```
ws://<host>:<port>/ws       # 明文（仅内网 / 直连 IP 调试）
wss://<host>/ws             # 经 Caddy / Nginx 反代后
```

## 1. 鉴权（必填）

任选其一：

- URL 参数：`?token=ttws_live_XXXXXXXXXXXXXXXXXXXXX...`
- HTTP 头 ：`Authorization: Bearer ttws_live_XXXXXXXXXXXXXXXXXXX...`

校验流程：
- 缺 token → `HTTP 401 {"error":"missing_token"}`
- 格式错（不是 `ttws_live_` 开头） → `HTTP 401 {"error":"bad_format"}`
- 数据库找不到 → `HTTP 401 {"error":"not_found"}`
- 已撤销 → `HTTP 401 {"error":"revoked"}`
- 已过期 → `HTTP 401 {"error":"expired"}`

连接建立**之后**才发现 key 失效（管理员撤销或自然到期）时，服务端在下一次心跳（≤ 25 s）会主动关闭 WS，
关闭码 `4003`、reason 为 `key_revoked_or_expired` / `revoked` / `expired`。客户端遇到 `4003` 应停止重连并报警。

## 2. 连接生命周期

```
client                        server
  | -- HTTP Upgrade ------>    |
  | <-- 101 Switching     ---  |
  | <-- hello             ---  |   服务端首帧
  | -- subscribe (可选) ---->  |
  | <-- subscribed       ---   |
  | <-- tweet (实时)      ---  |   每来一条新帖一帧
  | <-- ping (每 25 s)    ---  |   WS 协议层 ping，客户端库自动回 pong
  | -- ping (JSON, 可选)  -->  |   应用层
  | <-- pong (JSON)       ---  |
```

## 3. 客户端 → 服务端 消息

| type | 字段 | 说明 |
|------|------|------|
| `ping` | — | 应用层心跳；服务端立即回 `pong` |
| `subscribe` | `source: "all"\|"rss"\|"truth"` | 过滤源，默认 `all` |
| `history` | `limit?: 1..200`（默认 20） | 拉历史 |

## 4. 服务端 → 客户端 消息

| type | 关键字段 | 说明 |
|------|----------|------|
| `hello` | `ts`, `server_version`, `key:{id,prefix,expires_at}` | 连接建立首帧 |
| `subscribed` | `source` | 订阅成功 |
| `tweet` | `data: Tweet` | 实时新帖 |
| `history` | `data: Tweet[]` | 历史回放 |
| `pong` | `ts` | 心跳应答 |
| `error` | `message` | 错误（不会自动断） |

### Tweet 结构

```json
{
  "guid":        "https://truthsocial.com/@realDonaldTrump/posts/12345",
  "source":      "rss",
  "title":       "原文纯文本",
  "contentHtml": "<p>原 HTML</p>",
  "link":        "https://truthsocial.com/...",
  "pubDate":     "2026-05-18T14:47:44.000Z",
  "author":      "@realDonaldTrump",
  "mediaUrl":    "https://.../image.jpg",
  "translated":  "中文翻译（服务端预翻好）",
  "received_at": "2026-05-18T14:47:46.123Z",
  "raw":         { }
}
```

## 5. Python 示例（粘贴即跑）

```python
import asyncio, json, websockets

URL = "wss://YOUR-HOST/ws?token=ttws_live_XXXX..."

async def main():
    async for ws in websockets.connect(URL, ping_interval=20):
        try:
            await ws.send(json.dumps({"type": "subscribe", "source": "all"}))
            await ws.send(json.dumps({"type": "history", "limit": 20}))
            async for raw in ws:
                msg = json.loads(raw)
                if msg["type"] == "tweet":
                    t = msg["data"]
                    print(f"[{t['source']}] {t['pubDate']} | {t['title'][:80]}")
                    # -> 这里调用你的 AI
        except websockets.ConnectionClosed as e:
            if e.code == 4003:
                print("key 已被撤销/过期，停止重连")
                break
            continue

asyncio.run(main())
```

## 6. Node.js 示例

```js
const WebSocket = require('ws'); // npm i ws
const URL = 'wss://YOUR-HOST/ws?token=ttws_live_XXXX...';

function connect() {
  const ws = new WebSocket(URL);
  ws.on('open', () => {
    ws.send(JSON.stringify({ type: 'subscribe', source: 'all' }));
    ws.send(JSON.stringify({ type: 'history', limit: 20 }));
  });
  ws.on('message', raw => {
    const m = JSON.parse(raw);
    if (m.type === 'tweet') {
      console.log(`[${m.data.source}] ${m.data.title.slice(0, 80)}`);
    }
  });
  ws.on('close', (code) => {
    if (code !== 4003) setTimeout(connect, 1500);
    else console.error('key 已被撤销/过期，停止重连');
  });
}
connect();
```

## 7. HTTP 接口（备用）

| Path | 说明 |
|------|------|
| `GET /health` | `{ok, ts, ws:{path,clients}, history}` |
| `GET /api/tweets?limit=50` | 历史 Tweet JSON 数组（最新在前），公开 |

## 8. 错误处理 / 重连

- 客户端遇到 `wasClean=false` 普通断开：指数退避（1s → 2s → 4s … 上限 30s）重连
- 遇到 `close code 4003`：**停止重连**，联系管理员申请新 key
- 应用层 `error` 消息（如 `unknown_type`）不会自动断开，建议忽略后继续

## 9. 延迟预算（实测）

| 链路 | 典型耗时 |
|------|----------|
| Trump 发帖 → `trumpstruth.org` RSS | 5 ~ 60 秒 |
| 服务端 RSS 抓取（默认 10 s 一次） | 0 ~ 10 秒 |
| 服务端 → WS 客户端 | < 50 ms（同机房） |

合计 **5 ~ 70 秒**。如服务器能直连 `truthsocial.com` Mastodon API（每 3 秒），上界压到 **3 ~ 10 秒**。
