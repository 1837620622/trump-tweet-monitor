# 部署指南（HK 服务器 43.240.13.39）

> 本服务设计为自托管 / 私有，不开源、不分发。Cloudflare 那套（仓库根目录的 `cloudflare-worker.js` 与 `index.html`）继续在 `trump-x.chuankangkk.top` 跑，两边互不影响。

## 0. 前置

- Debian 11+ / Ubuntu 20+，root 可登。
- **强烈建议**先把 SSH 改 key-only：
  ```bash
  passwd                                        # 改一个新强密码
  sed -ri 's/^#?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
  systemctl restart sshd
  ```

## 1. 上传代码

```bash
# 在本机
scp -r 特朗普实时推文-WS服务 root@43.240.13.39:/opt/trump-truth-ws-src
```

或先 `git clone`（repo 必须是 private）再 `cp -r` 子目录过去。

## 2. 跑一键脚本

```bash
ssh root@43.240.13.39
bash /opt/trump-truth-ws-src/deploy/install.sh
```

脚本会：
1. 装 Node.js 20
2. 建用户 `trumpws`
3. 把代码同步到 `/opt/trump-truth-ws`
4. `npm install --omit=dev`
5. 拷一份 `.env`（admin 口令默认 `chuankangkk`）
6. 注册并启动 `systemd` 服务 `trump-monitor`

跑完看一眼日志：

```bash
journalctl -u trump-monitor -f
```

应该看到：
```
INFO db: opened /opt/trump-truth-ws/data/state.db
WARN admin: 正在使用内置默认口令 (chuankangkk)。生产环境建议在 .env 里 ADMIN_PASSWORD=<随机长串> 覆盖。
OK   listening on http://0.0.0.0:8787
```

## 3. 配 `.env`（按需）

```bash
nano /opt/trump-truth-ws/.env
```

最低改动：
- `GROQ_API_KEY=`  → 去 https://console.groq.com/keys 领免费 key，复制粘贴
- `PUSHPLUS_TOKEN=` → 如果要继续微信推送，从 pushplus.plus 拿（之前那个泄露过的请去后台重置）
- `SOURCE_TRUTH_ENABLED=true` → 香港机房可能能直连 truthsocial.com，开了就是双源最快路径

改完：

```bash
systemctl restart trump-monitor
```

## 4. 验证

```bash
curl http://127.0.0.1:8787/health
# {"ok":true,"ts":...,"ws":{"path":"/ws","clients":0},"history":...}

# 浏览器打开（先把防火墙放 8787，或在本机用 ssh -L 转发）
http://43.240.13.39:8787/
http://43.240.13.39:8787/admin    # 登录密码：chuankangkk
http://43.240.13.39:8787/demo
http://43.240.13.39:8787/docs
```

## 5. https 反代（推荐 Caddy）

```bash
apt install -y caddy
cat > /etc/caddy/Caddyfile <<'EOF'
trump-ws.chuankangkk.top {
    reverse_proxy 127.0.0.1:8787
}
EOF
systemctl reload caddy
```

DNS 把 `trump-ws.chuankangkk.top` 解析到 `43.240.13.39`，Caddy 自动签 Let's Encrypt 证书。
之后访问改成 `https://trump-ws.chuankangkk.top` / `wss://trump-ws.chuankangkk.top/ws`。

## 6. 防火墙

```bash
ufw default deny incoming
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
# 不要再放 8787 给外网，全走 Caddy
ufw enable
```

## 7. 升级 / 重启

```bash
cd /opt/trump-truth-ws
git pull            # 如果你的 repo clone 在这里
npm install --omit=dev
systemctl restart trump-monitor
```

或者用 `install.sh` 重跑（它自动 rsync 覆盖代码，不会动 `.env` 与 `data/`）。

## 8. 卸载 / 重置数据

```bash
systemctl stop trump-monitor && systemctl disable trump-monitor
rm /etc/systemd/system/trump-monitor.service
systemctl daemon-reload
rm -rf /opt/trump-truth-ws
userdel trumpws
```

或只清数据库（保留服务）：

```bash
systemctl stop trump-monitor
rm /opt/trump-truth-ws/data/state.db*
systemctl start trump-monitor
```

## 9. 故障排查

| 现象 | 排查 |
|------|------|
| `journalctl -u trump-monitor -e` 报 better-sqlite3 编译失败 | 装 `apt install -y build-essential python3` 后重跑 `npm install` |
| `/admin` 一直 401 | `.env` 里 `ADMIN_PASSWORD` 留空时默认 `chuankangkk`；不为空时按你写的 |
| WS 连得上但 25s 后断开 4003 | key 被撤销/过期；后台重新生成 |
| 一直没新推 | 看 `journalctl` 是否有 `rss: 429 / 304 / HTTP xxx`；429 表示被限流，等几分钟自愈 |
| Truth 一直 403 | 即使在 HK，可能仍被 Cloudflare 挡；保留 `SOURCE_TRUTH_ENABLED=false` 走 RSS 也够用 |
