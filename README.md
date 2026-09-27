# 24H Web

面向企业的**多用户 Hermes web 工作台**：自有 SPA + 自有 BFF + 官方 Hermes 后端。

- 管理员在界面里管理用户与权限；普通用户只看到被授权的 agent 与会话。
- Hermes 的 token 只在 BFF 内使用，浏览器永不持有。

## 架构

```
浏览器 SPA (apps/web)  →  BFF (apps/server)  →  hermes serve  →  ~/.hermes
```

| 组件 | 职责 |
| --- | --- |
| `apps/web` | React SPA：UI/交互/状态；只与同源 BFF 通信，**不持 Hermes token** |
| `apps/server` | BFF（Backend For Frontend）：认证、用户/角色、profile 租户映射、代理（REST + WS）、审计、限流 |
| `packages/shared` | 前后端共享类型（`Role` / `UserStatus` 等） |
| `hermes serve` | 官方 Hermes 后端（L1 `/api/ws` JSON-RPC + L2 REST `/api/*`，loopback 内部访问） |

## 目录

```
24h-web/
├── apps/web/          # React SPA (Vite)
├── apps/server/       # BFF (Fastify)：认证 / 用户 / 代理 / 审计
├── packages/shared/   # 共享类型
├── docs/              # ARCHITECTURE.md / INTERFACES.md / TASKS.md / UI.md
└── e2e/               # Playwright e2e（隔离临时 DB + 首启 admin）
```

## 快速开始（dev）

```bash
npm install

# 1) 官方后端（loopback；需已安装 Hermes）
hermes serve --host 127.0.0.1 --port 9119

# 2) BFF（默认监听 127.0.0.1:8931）
HERMES_BASE_URL=http://127.0.0.1:9119 npm run dev:server

# 3) SPA
npm run dev:web
```

首次启动时 BFF 在无用户的情况下创建 `super_admin`（用户名 `admin`）：

- 密码通过 `OS_ADMIN_PASSWORD` 提供；未提供则随机生成并**仅打印一次**。
- 该账号被标记为**强制改密**，首次登录后必须修改密码。

## 生产运行

```bash
npm run build   # 构建 SPA（apps/web/dist）+ 打包 BFF bundle（apps/server/dist/server.mjs）
npm run start   # = npm -w @24h/server run start，直接跑 apps/server/dist/server.mjs
```

BFF 用 esbuild 打成单文件 ESM bundle（`packages: external`，依赖不内联）；原生依赖
`better-sqlite3` / `@node-rs/argon2` 保持 external。ESM 输出下 `import.meta.url` 为产物
`dist/server.mjs`，应用根由 `apps/server/src/paths.ts#findRepoRoot` 解析，src 与 bundle 语义一致。

## 部署（A2）

- Hermes 只绑 **loopback（127.0.0.1）**，不触发其 auth gate。
- **BFF + SPA 同源**：由反代（Caddy/nginx）托管 SPA 静态产物，并把 `/api` 转发到 BFF；
  TLS 与登录由 BFF 承担。
- 远程部署 = `hermes serve`(loopback) + BFF + 反代；`~/.hermes/.env` 权限收紧。

```
浏览器 ──https://域名──> [反代 + TLS] ──> [BFF 127.0.0.1:8931]
                                          └──代理──> [hermes serve 127.0.0.1:9119]
```

## 校验

```bash
npm run check       # typecheck + 两套 vitest（server + web），当前 400+ 用例
npm run test:e2e    # Playwright e2e（隔离 temp DB + 首启 admin；不进 check）
```

`npm run test:e2e` 用 Playwright 自建**隔离环境**：临时 SQLite DB、首启 `admin`、构建并运行
BFF bundle 与 SPA，真实 Chromium 走一遍登录 → 强制改密 → 主壳渲染链路。

## 里程碑

M0–M16 已完成。功能拆解与最小实现顺序见 [`docs/TASKS.md`](./docs/TASKS.md)：
M0 工程基线 · M1 BFF+认证 · M2 用户管理 · M3 代理 · M4 前端骨架 · M5 对话 · M6 技能/工具/设置 ·
M7 任务/用量/面板 · M8 Agent/Profile · M9 体验 · M10 协作与集成 · M11 运维与高级 · M12 未来增强 ·
M13 项目 · M14 通知中心 · M15 会话命令 · M16 上下文/路由/集成。

## License

Licensed under the **Business Source License 1.1** (BUSL-1.1) — see [LICENSE](./LICENSE).
- 非生产用途可自由使用/修改/分发。
- 生产/商用需向 Licensor 获取商业许可；至 **Change Date (2030-09-27)** 自动转为 **Apache License 2.0**。
