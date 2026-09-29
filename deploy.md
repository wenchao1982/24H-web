# 部署要点（24H Web，A2）

> 拓扑 A2：所有后端只监听 **loopback**，由反向代理终止 TLS 并对外提供同源 SPA + `/api`。
> 完整部署指南见 [`docs/DEPLOY.md`](./docs/DEPLOY.md)。

## 1. 拓扑

```
浏览器 ──https──> [反代 + TLS] ──> [BFF 127.0.0.1:8931] ──> [hermes serve 127.0.0.1:9119] ──> ~/.hermes
```

- **只有反向代理对外**：`hermes serve`（9119）与 BFF（8931）都只绑 `127.0.0.1`，防火墙显式 DROP 外部访问。
- **同源**：SPA 静态产物与 `/api` 走同一源，会话 cookie（`SameSite=Lax`）与 CSRF 无需跨域配置。
- **Hermes token 不进浏览器**：官方 token 只存在于 BFF 内。

## 2. 前置条件

- Node.js >= 20；官方 `hermes` CLI 已安装；反向代理（Caddy / nginx）。
- 独立系统用户（示例 `24h`）与数据目录（示例 `/var/lib/24h`）。

## 3. 关键步骤

```bash
# 构建
sudo -u 24h git clone <repo-url> /opt/24h-web && cd /opt/24h-web
sudo -u 24h npm ci && sudo -u 24h npm run build   # apps/web/dist + apps/server/dist/server.mjs

# Hermes（loopback，独立 HERMES_HOME）
sudo -u hermes env HERMES_HOME=/var/lib/hermes hermes serve --host 127.0.0.1 --port 9119

# 一次性 bootstrap（创建首个 super_admin，幂等）
sudo -u 24h env DB_PATH=/var/lib/24h/24h.db OS_ADMIN_PASSWORD='<强口令>' \
  npm -w @24h/server run bootstrap
```

- 跳过 bootstrap 也可以：首次启动 BFF 会自动 `ensureFirstAdmin`，行为一致。
- 首个 `admin` 被标记**强制首登改密**；`OS_ADMIN_PASSWORD` 用后即从环境移除。

## 4. systemd 跑 `apps/server/dist/server.mjs`

`/etc/systemd/system/24h-bff.service`：

```ini
[Service]
Type=simple
User=24h
Group=24h
WorkingDirectory=/opt/24h-web
EnvironmentFile=/etc/24h/24h.env        # chmod 600，密钥只放这里
ExecStart=/usr/bin/node /opt/24h-web/apps/server/dist/server.mjs
Restart=on-failure
RestartSec=2
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/24h
```

`/etc/24h/24h.env` 关键变量：`NODE_ENV=production`、`PORT=8931`、`DB_PATH=/var/lib/24h/24h.db`、
`HERMES_BASE_URL=http://127.0.0.1:9119`、（可选）`OIDC_*`。

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now 24h-bff
```

## 5. 反向代理

- **Caddy**：`root * /opt/24h-web/apps/web/dist` + `try_files {path} /index.html` + `file_server`；
  `handle /api/* { reverse_proxy 127.0.0.1:8931 }`（自动 TLS，原生支持 WS）。
- **nginx**：`location /api/ { proxy_pass http://127.0.0.1:8931; proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade"; proxy_set_header X-Forwarded-Proto $scheme; }` + SPA fallback。
- 透传 `X-Forwarded-Proto=https`，BFF 才下发 `Secure` cookie。

## 6. 升级

```bash
cd /opt/24h-web && sudo -u 24h git pull && sudo -u 24h npm ci && sudo -u 24h npm run build
sudo systemctl restart 24h-bff        # 启动时自动迁移 DB
```

## 7. 安全

- **只回环**：9119 / 8931 绝不直接暴露公网。
- **密钥只进环境**：`OS_ADMIN_PASSWORD`、`OIDC_CLIENT_SECRET` 仅经 `EnvironmentFile`（`chmod 600`）注入，不写仓库/日志。
- **TLS 由反代终止**；BFF 与 `hermes serve` 各用独立非 root 用户；`~/.hermes/.env` 收紧（`chmod 600`）。
- **首登改密 + 登录限流锁定**；`OS_ADMIN_PASSWORD` 用后移除。
- **备份**：定期备份 `DB_PATH`（SQLite）与 `HERMES_HOME`。
- 上线自检：`OS_SMOKE_BASE=... OS_SMOKE_USER=... OS_SMOKE_PASS=... npm run smoke`。
