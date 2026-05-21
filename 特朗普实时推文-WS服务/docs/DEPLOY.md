# 部署指南

> 自托管 WebSocket 数据服务。仓库根目录原有的 Cloudflare Workers 站独立运行，互不影响。

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
scp -r 特朗普实时推文-WS服务 root@<your-server>:/opt/trump-truth-ws-src
```

或先 `git clone` 再 `cp -r` 子目录过去。

## 2. 跑一键脚本

```bash
ssh root@<your-server>
bash /opt/trump-truth-ws-src/deploy/install.sh
```

脚本会：
1. 装 Node.js 20
2. 建用户 `trumpws`
3. 把代码同步到 `/opt/trump-truth-ws`
4. `npm install --omit=dev`
5. 生成随机 `ADMIN_PASSWORD` 写入 `.env`（脚本会打印一次，请记录）
6. 注册并启动 `systemd` 服务 `trump-monitor`

跑完看一眼日志：

```bash
journalctl -u trump-monitor -f
```

应该看到：
```
INFO db: opened /opt/trump-truth-ws/data/state.db
OK   listening on http://0.0.0.0:8787
```

如果看到 `WARN admin: ADMIN_PASSWORD 未设置` —— 说明 `.env` 中缺 `ADMIN_PASSWORD`，admin 接口将拒绝所有请求。

## 3. 配 `.env`（按需）

```bash
nano /opt/trump-truth-ws/.env
```

最低改动：
- `ADMIN_PASSWORD=` → 长随机串（`openssl rand -hex 24`）
- `GROQ_API_KEY=`  → 去 https://console.groq.com/keys 领免费 key
- `PUSHPLUS_TOKEN=` → 如果要继续微信推送
- `SOURCE_TRUTH_ENABLED=true` → 如果机房能直连 truthsocial.com

改完：

```bash
systemctl restart trump-monitor
```

## 4. 验证

```bash
curl http://127.0.0.1:8787/health
# {"ok":true,"ts":...,"ws":{"path":"/ws","clients":0},"history":...}
```

浏览器（先放防火墙或 `ssh -L 8787:127.0.0.1:8787`）：
- `http://<your-server>:8787/`       首页
- `http://<your-server>:8787/admin`  管理后台（密码 = `.env` 里的 `ADMIN_PASSWORD`）
- `http://<your-server>:8787/demo`   实时演示
- `http://<your-server>:8787/docs`   对接文档

## 5. https 反代（推荐 Caddy）

```bash
apt install -y caddy
cat > /etc/caddy/Caddyfile <<'EOF'
<your-subdomain> {
    reverse_proxy 127.0.0.1:8787
}
EOF
systemctl reload caddy
```

DNS 把子域解析到服务器 IP，Caddy 自动签 Let's Encrypt。
之后访问改成 `https://<your-subdomain>` / `wss://<your-subdomain>/ws`。

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
git pull
npm install --omit=dev
systemctl restart trump-monitor
```

或者用 `install.sh` 重跑（自动 rsync 覆盖代码，不动 `.env` 与 `data/`）。

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
| better-sqlite3 编译失败 | 装 `apt install -y build-essential python3` 后重跑 `npm install` |
| `/admin` 一直 401 | `.env` 必须有 `ADMIN_PASSWORD=<长随机串>`；为空时所有 admin 请求都被拒 |
| WS 25s 后断开 4003 | key 被撤销/过期；后台重新生成 |
| 一直没新推 | 看 `journalctl` 是否有 `rss: 429 / 304 / HTTP xxx`；429 表示被限流，等几分钟自愈 |
| Truth 一直 403 | 多数机房会被 Cloudflare 挡；保留 `SOURCE_TRUTH_ENABLED=false` 走 RSS 即可 |
