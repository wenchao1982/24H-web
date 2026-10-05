# 架构（24H Web）

## 分层

```
浏览器 SPA (React)  →  BFF (Fastify)  →  hermes serve  →  ~/.hermes
```

- **apps/web**：浏览器端 SPA，只与同源 BFF 通信，不直接接触 Hermes。
- **apps/server**：BFF（Backend For Frontend），统一持有凭据、租户与审计。
- **packages/shared**：前后端共享类型（`Role` / `UserStatus` 等）。
- **hermes serve**：官方 Hermes 后端（L1 `/api/ws` JSON-RPC + L2 REST `/api/*`）。
- **~/.hermes**：Hermes 主目录（profile / skills / config）。

## BFF 职责

- **认证**：登录、会话、密码策略（AuthProvider）。
- **用户**：账号生命周期与状态（`active` / `disabled`）。
- **角色**：两级 `super_admin` | `admin` 的授权判定。
- **profile 租户映射**：把用户映射到 Hermes profile，形成租户边界。
- **代理**：对 Hermes L1/L2 的请求转发与事件透传（WS default-deny 租户守卫 + REST `assertProfileAccess`；见根 `architecture.md §7`）。
- **外部 agent 运行时**：`/api/agents/*` 主安装/管理（`coding-agents` 模块；读=认证，写=`super_admin`）。
- **审计**：记录敏感操作（登录、配置变更、能力调用）。
- **限流**：登录/接口限流与失败锁定。

## 关键流

- **HTTP 与 WS 都经 BFF**：浏览器只访问 BFF；对话 WS 由 BFF 代理到 `hermes serve` 的 `/api/ws`。
- **Hermes token 不进浏览器**：官方 session token / ws-ticket 只存在于 BFF；浏览器拿不到、也不需要。
- 前端 `apps/web/src/api/client.ts`（HTTP）与 `apps/web/src/api/ws.ts`（WS JSON-RPC）为唯一通信入口。
- 事件/音频等额外 WS（`/api/events` · `/api/plugins/kanban/events` · `/api/audio/speak-stream`）经 BFF `/api/hermes/stream` 代理（default-deny，同 `/api/hermes/ws`）。

## 认证与租户

- **AuthProvider 策略**：当前 `password`，后续可扩展 `oidc`。
- **两级角色**：`super_admin` | `admin`。
- **租户边界 = Hermes profile**：一个租户对应一个 profile。
- **user_profiles 分配**：决定用户可访问哪些 profile。
- **super_admin 绕过**：`super_admin` 不受租户边界限制。

## 可替换缝

- **认证 IdP**：`AuthProvider` 接口，password → oidc 平滑替换。
- **存储**：SQLite（当前）→ Postgres（接口不变，仅换实现）。
- **前端宿主**：SPA 可独立部署或由 BFF 静态托管。

## 非功能

- 口令哈希用 **argon2id**。
- **首登改密**：初始口令强制修改。
- **限流锁定**：登录失败累计触发锁定。
- **审计**：敏感操作留痕。
- **密钥不落前端**：任何 token / API Key 都不进入浏览器产物。

## 目录结构

```
24h-web/
├── package.json            # root, private, workspaces ["apps/*","packages/*"]
├── tsconfig.base.json
├── AGENTS.md  requirement.md  ui-spec.md  architecture.md  task-list.md  test-report.md  deploy.md
├── docs/{ARCHITECTURE,INTERFACES,TASKS,UI}.md
├── apps/web/               # 浏览器 SPA（React 19 + Vite）
│   ├── index.html  vite.config.ts  tsconfig.json  package.json
│   └── src/{main.tsx,App.tsx,styles.css,api/{client.ts,ws.ts},shell,chat,agents,groups,
│            tasks,kanban,orchestration,voice,usage,settings,details,notifications,pages}
├── apps/server/            # BFF（Fastify）
│   ├── package.json  tsconfig.json
│   └── src/{index.ts,config.ts,paths.ts,http,db,auth,users,session,hermes,agents,audit,
│            integrations,routes,skillui,bin}
├── apps/demo/              # 独立高保真 Demo（mock 数据，不进根 check）
├── packages/shared/        # Role / UserStatus 等共享类型
├── e2e/                    # Playwright（隔离临时 DB + 首启 admin）
└── scripts/                # build-server.mjs / smoke-hermes.mjs
```

> 模块与新增代理/执行层细节见根 [`architecture.md §8`](./architecture.md)；任务与验收见 [`task-list.md`](./task-list.md)。
