#!/usr/bin/env bash
# 特朗普实时推文 WS 服务 一键部署脚本（Debian/Ubuntu）
# 假设：以 root 身份在目标机器上跑。
#
# 用法：
#   curl -fsSL https://<your-host>/path/install.sh | bash
#   或先 scp 代码上去再:  cd /opt/trump-truth-ws && bash deploy/install.sh
#
# 它会：
#   1) 安装 Node.js 20（如未装）
#   2) 创建系统用户 trumpws
#   3) 把代码放到 /opt/trump-truth-ws
#   4) npm install
#   5) 引导你写 .env（最少 ADMIN_PASSWORD）
#   6) 注册 systemd 服务并启动
set -euo pipefail

INSTALL_DIR=/opt/trump-truth-ws
SERVICE_USER=trumpws
SERVICE_NAME=trump-monitor

c_green() { printf '\033[1;32m%s\033[0m\n' "$*"; }
c_yel()   { printf '\033[1;33m%s\033[0m\n' "$*"; }
c_red()   { printf '\033[1;31m%s\033[0m\n' "$*"; }

if [[ $EUID -ne 0 ]]; then c_red "需要 root：sudo bash $0"; exit 1; fi

# ---------- 1. Node.js ----------
if ! command -v node >/dev/null 2>&1; then
  c_yel "[1/6] 安装 Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs build-essential
else
  c_green "[1/6] Node.js 已装：$(node -v)"
fi

# ---------- 2. 系统用户 ----------
if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  c_yel "[2/6] 创建用户 $SERVICE_USER"
  useradd --system --home "$INSTALL_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
else
  c_green "[2/6] 用户 $SERVICE_USER 已存在"
fi

# ---------- 3. 代码 ----------
mkdir -p "$INSTALL_DIR"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$(dirname "$SCRIPT_DIR")"
if [[ "$SRC_DIR" != "$INSTALL_DIR" ]]; then
  c_yel "[3/6] 复制代码 $SRC_DIR -> $INSTALL_DIR"
  rsync -a --delete --exclude='node_modules' --exclude='data' --exclude='.env' "$SRC_DIR/" "$INSTALL_DIR/"
else
  c_green "[3/6] 代码已就位"
fi
mkdir -p "$INSTALL_DIR/data"
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"

# ---------- 4. 依赖 ----------
c_yel "[4/6] npm install (生产模式)"
cd "$INSTALL_DIR"
sudo -u "$SERVICE_USER" npm install --omit=dev

# ---------- 5. .env ----------
if [[ ! -f "$INSTALL_DIR/.env" ]]; then
  c_yel "[5/6] 创建 .env"
  cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env" 2>/dev/null || true
  # 自动生成一个随机 admin 口令并写入 .env（如果用户没改）
  RAND_PW=$(openssl rand -hex 24)
  if grep -q '^ADMIN_PASSWORD=' "$INSTALL_DIR/.env" 2>/dev/null; then
    sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=$RAND_PW|" "$INSTALL_DIR/.env"
  else
    echo "ADMIN_PASSWORD=$RAND_PW" >> "$INSTALL_DIR/.env"
  fi
  chown "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/.env"
  chmod 600 "$INSTALL_DIR/.env"
  c_green "    .env 已就位。已随机生成 ADMIN_PASSWORD，请记录："
  c_green "      ADMIN_PASSWORD=$RAND_PW"
  c_yel "    其他可选项请编辑 $INSTALL_DIR/.env："
  c_yel "      GROQ_API_KEY    -> 在 console.groq.com/keys 拿"
  c_yel "      PUSHPLUS_TOKEN  -> 在 pushplus.plus 拿（如需微信推送）"
else
  c_green "[5/6] .env 已存在，跳过"
fi

# ---------- 6. systemd ----------
c_yel "[6/6] 安装 systemd unit"
cp "$INSTALL_DIR/deploy/$SERVICE_NAME.service" "/etc/systemd/system/$SERVICE_NAME.service"
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"
sleep 2

c_green ""
c_green "========================================================================"
c_green "    部署完成。"
c_green "    服务状态：systemctl status $SERVICE_NAME"
c_green "    实时日志：journalctl -u $SERVICE_NAME -f"
c_green "    重启:    systemctl restart $SERVICE_NAME"
c_green ""
c_green "    访问入口（默认 8787 端口，可改 .env 里 PORT）："
c_green "      首页:   http://<this-server-ip>:8787/"
c_green "      管理:   http://<this-server-ip>:8787/admin"
c_green "      Demo:   http://<this-server-ip>:8787/demo"
c_green "      文档:   http://<this-server-ip>:8787/docs"
c_green ""
c_green "    建议下一步："
c_green "      1) 上 Caddy 或 Nginx 做 https 反代"
c_green "      2) 防火墙只放 80/443 + ssh"
c_green "      3) ssh 改 key-only：禁用 PermitRootLogin"
c_green "========================================================================"
