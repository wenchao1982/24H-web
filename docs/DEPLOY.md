# 部署指南（A2：loopback + 反向代理）

> 本文描述 24H Web 的**生产部署 topology A2**：所有后端只监听 loopback，
> 由反向代理（Caddy / nginx）终止 TLS 并对外提供同源 SPA + `/api`。
> 组件与职责见 [`ARCHITECTURE.md`](./ARCHITECTURE.md)，接口见 [`INTERFACES.md`](./INTERFACES.md)。

## 1. 拓扑

```
        公网
         │  https://24h.example.com
         ▼
┌──────────────────────────┐
│ 反向代理（Caddy / nginx） │  TLS 终止、SPA 静态托管、/api 转发
└──────────────┬───────────┘
               │  http://127.0.0.1:8931（仅回环）
               ▼
┌──────────────────────────┐
│ BFF（apps/server bundle） │  登录 / 会话 / 用户 / 代理 / 审计
└──────────────┬───────────┘
               │  http://127.0.0.1:9119（仅回环）
               ▼
┌──────────────────────────┐
│ hermes serve             │  官方后端（L1 /api/ws + L2 /api/*）
└──────────────┬───────────┘
               ▼
           ~/.hermes
```

要点：

- **只有反向代理对外**。`hermes serve`（9119）与 BFF（8931）都只绑 `127.0.0.1`，
  防火墙 / 安全组应显式拒绝外部访问这两个端口。
- **同源**：浏览器只访问反代域名；SPA 静态产物与 `/api` 走同一源，
  因此 BFF 的会话 cookie（`SameSite=Lax`）与 CSRF 校验无需跨域配置。
- **Hermes token 不进浏览器**：官方 session token 只存在于 BFF 内。

## 2. 前置条件

- Node.js >= 20（BFF bundle 依赖外部 `node_modules`，原生模块需可编译）。
- 官方 `hermes` CLI 已安装并可在部署用户下运行。
- 反向代理（本文以 Caddy 为例，附 nginx 片段）。
- 一个系统用户（示例 `24h`）与数据目录（示例 `/var/lib/24h`）。

## 3. 部署步骤

### 3.1 拉取与构建

```bash
sudo install -d -o 24h -g 24h /opt/24h-web
sudo -u 24h git clone <repo-url> /opt/24h-web
cd /opt/24h-web
sudo -u 24h npm ci
sudo -u 24h npm run build   # 产出 apps/web/dist（SPA）+ apps/server/dist/server.mjs（BFF bundle）
```

### 3.2 启动 `hermes serve`（loopback）

Hermes 由官方 CLI 独立运行，24H 不管理其生命周期。给它一个专用 `HERMES_HOME`：

```bash
sudo install -d -o hermes -g hermes /var/lib/hermes
sudo -u hermes env HERMES_HOME=/var/lib/hermes \
  hermes serve --host 127.0.0.1 --port 9119
```

生产环境建议用 systemd 常驻（见 §4.2）。

### 3.3 一次性 bootstrap（创建首个 super_admin）

BFF 在没有任何用户时会自动创建首个 `super_admin`（默认用户名 `admin`，
可用 `OS_ADMIN_USER` 覆盖）。口令来自 `OS_ADMIN_PASSWORD`；未提供则随机生成并**仅打印一次**。
该账号被标记为**强制首登改密**。

推荐显式执行一次 bootstrap：

```bash
sudo -u 24h env \
  DB_PATH=/var/lib/24h/24h.db \
  OS_ADMIN_PASSWORD='<强口令，至少 8 位>' \
  npm -w @24h/server run bootstrap
```

- 该命令**幂等**：已存在用户则跳过（`已存在用户，跳过`）。
- `OS_ADMIN_PASSWORD` 仅首次需要；创建完成后可从环境移除。
- 也可跳过此步：首次启动 BFF 时 `index.ts` 会自动调用 `ensureFirstAdmin`，行为一致。

### 3.4 安装并启动 BFF（systemd）

见 §4.1 的 unit。BFF 启动参数完全由环境变量驱动：

| 变量 | 说明 | 示例 |
| --- | --- | --- |
| `PORT` | BFF 监听端口（host 固定 `127.0.0.1`） | `8931` |
| `DB_PATH` | SQLite 数据库路径 | `/var/lib/24h/24h.db` |
| `HERMES_BASE_URL` | 上游 `hermes serve` 地址 | `http://127.0.0.1:9119` |
| `OS_ADMIN_PASSWORD` | 首次 bootstrap 口令（之后可移除） | —— |
| `OS_ADMIN_USER` | 首个管理员用户名（可选） | `admin` |
| `OIDC_ISSUER` / `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` / `OIDC_REDIRECT_URI` | 启用 OIDC 登录（可选，见 §6） | —— |

> BFF 监听地址在代码中固定为 `127.0.0.1`（`apps/server/src/index.ts`），
> 不要也不应尝试把它绑到公网。

### 3.5 配置反向代理

见 §5（Caddyfile / nginx）。

## 4. systemd 单元

### 4.1 BFF

`/etc/systemd/system/24h-bff.service`：

```ini
[Unit]
Description=24H Web BFF (apps/server)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=24h
Group=24h
WorkingDirectory=/opt/24h-web

# 密钥只放 EnvironmentFile（chmod 600），不要写进本文件/仓库
EnvironmentFile=/etc/24h/24h.env

ExecStart=/usr/bin/node /opt/24h-web/apps/server/dist/server.mjs
Restart=on-failure
RestartSec=2

# 加固
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/24h

[Install]
WantedBy=multi-user.target
```

`/etc/24h/24h.env`（`sudo chmod 600`，属主 `root:24h`）：

```ini
NODE_ENV=production
PORT=8931
DB_PATH=/var/lib/24h/24h.db
HERMES_BASE_URL=http://127.0.0.1:9119
# 仅首次 bootstrap 需要；创建管理员后删除此行
OS_ADMIN_PASSWORD=replace-with-a-strong-secret
# 可选 OIDC
# OIDC_ISSUER=https://idp.example.com/realms/main
# OIDC_CLIENT_ID=24h-web
# OIDC_CLIENT_SECRET=replace-me
# OIDC_REDIRECT_URI=https://24h.example.com/api/auth/oidc/callback
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now 24h-bff
sudo systemctl status 24h-bff
```

> `ProtectHome=true` 下 BFF 不读用户 home；`DB_PATH` 与备份目录务必在其可写路径内
> （上方用 `ReadWritePaths=/var/lib/24h`）。

### 4.2 `hermes serve`（可选）

若希望与 BFF 一样用 systemd 常驻：

`/etc/systemd/system/hermes-serve.service`：

```ini
[Unit]
Description=Hermes serve (loopback)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=hermes
Group=hermes
Environment=HERMES_HOME=/var/lib/hermes
ExecStart=/usr/local/bin/hermes serve --host 127.0.0.1 --port 9119
Restart=on-failure
RestartSec=2
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

## 5. 反向代理

### 5.1 Caddy（自动 TLS）

`/etc/caddy/Caddyfile`：

```caddyfile
24h.example.com {
    encode gzip

    # SPA 静态产物（apps/web/dist）；未知路径回退 index.html
    root * /opt/24h-web/apps/web/dist
    try_files {path} /index.html
    file_server

    # BFF：REST + WebSocket（/api/ws 需 Upgrader）
    handle /api/* {
        reverse_proxy 127.0.0.1:8931
    }
}
```

Caddy 会自动申请/续期 Let's Encrypt 证书，并默认透传 `X-Forwarded-*`
（BFF 据此判定 `secure` cookie）。`reverse_proxy` 原生支持 WebSocket，无需额外配置。

**可选：在反代层再加一道 basic auth（纵深防御）**

```caddyfile
24h.example.com {
    basicauth /* {
        # 生成：caddy hash-password --plaintext '<口令>'
        admin $2a$14$REPLACE_WITH_BCRYPT_HASH
    }
    # ...同上 root / try_files / file_server / handle /api/*
}
```

> 注意：24H 自身已有登录（首次强制改密、限流锁定）。basic auth 只是额外的
> 「谁可以到达登录页」的门禁，**不能替代**应用鉴权，且会与 OIDC SSO 冲突（见 §6）。

### 5.2 nginx（片段）

```nginx
server {
    listen 443 ssl http2;
    server_name 24h.example.com;

    ssl_certificate     /etc/letsencrypt/live/24h.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/24h.example.com/privkey.pem;

    root /opt/24h-web/apps/web/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:8931;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;      # WebSocket
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;  # BFF 判定 secure cookie
    }

    location / {
        try_files $uri /index.html;                  # SPA fallback
    }
}
```

## 6. 认证选项

- **本地口令（默认）**：BFF 内置账号，argon2id 哈希 + 首登强制改密 + 登录限流锁定。
- **OIDC SSO（可选）**：配置 §3.4 的四个 `OIDC_*` 变量后，登录页会多出 OIDC 提供方；
  回调地址须与 `OIDC_REDIRECT_URI` 完全一致（`https://<域名>/api/auth/oidc/callback`）。
  OIDC **不会自动授予 `super_admin`**（JIT 用户默认 `admin`），需由现有 super_admin 提权。
  启用 OIDC 后不建议同时启用反代 basic auth。

## 7. 升级

```bash
cd /opt/24h-web
sudo -u 24h git pull
sudo -u 24h npm ci
sudo -u 24h npm run build
sudo systemctl restart 24h-bff
```

- 启动时 BFF 自动执行数据库迁移（`migrate`），无需单独迁移步骤。
- 若 `hermes serve` 由 systemd 管理，按需 `sudo systemctl restart hermes-serve`。

## 8. 上线自检

用仓库自带的只读冒烟脚本（零依赖、不调模型）：

```bash
OS_SMOKE_BASE=https://24h.example.com \
OS_SMOKE_USER=admin \
OS_SMOKE_PASS='<口令>' \
npm run smoke
```

输出逐项 `PASS/WARN/FAIL` 与汇总，退出码 `0` 表示无硬失败（Hermes 未连接等软检查记为 `WARN`）。
脚本见 [`../scripts/smoke-hermes.mjs`](../scripts/smoke-hermes.mjs)。

## 9. 安全注意

- **只回环**：`9119`（Hermes）与 `8931`（BFF）仅监听 `127.0.0.1`；在防火墙/安全组
  显式 `DROP` 这两个端口的外部访问，**绝不**直接暴露。
- **密钥只进环境**：`OS_ADMIN_PASSWORD`、`OIDC_CLIENT_SECRET` 等仅通过
  `EnvironmentFile`（`chmod 600`）注入，不写入仓库、不打进镜像、不出现在日志。
- **TLS 由反代终止**：透传 `X-Forwarded-Proto=https`，BFF 才会下发 `Secure` cookie。
- **最小权限运行**：BFF 与 `hermes serve` 各用独立非 root 用户；
  `~/.hermes/.env`（若存在）权限收紧（`chmod 600`）。
- **首登改密**：初始管理员必须登录后立即改密；`OS_ADMIN_PASSWORD` 用后即从环境移除。
- **备份**：定期备份 `DB_PATH`（SQLite）与 `HERMES_HOME`；数据库含账号与会话，按敏感数据保护。
- **升级窗口**：`systemctl restart` 期间会短暂中断服务，建议在低峰执行。
