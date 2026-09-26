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
- **代理**：对 Hermes L1/L2 的请求转发与事件透传。
- **审计**：记录敏感操作（登录、配置变更、能力调用）。
- **限流**：登录/接口限流与失败锁定。

## 关键流

- **HTTP 与 WS 都经 BFF**：浏览器只访问 BFF；对话 WS 由 BFF 代理到 `hermes serve` 的 `/api/ws`。
- **Hermes token 不进浏览器**：官方 session token / ws-ticket 只存在于 BFF；浏览器拿不到、也不需要。
- 前端 `src/api/rest.ts`（HTTP）与 `src/api/gateway.ts`（WS JSON-RPC）为唯一通信入口。

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
├── AGENTS.md  README.md  LICENSE  .gitignore
├── docs/ARCHITECTURE.md
├── .github/workflows/ci.yml
├── apps/web/               # 浏览器 SPA
│   ├── index.html  vite.config.ts  tsconfig.json  package.json
│   └── src/{main.tsx,App.tsx,styles.css,api/{env.ts,rest.ts,gateway.ts},pages/{ChatPage,SettingsPage,SkillsPage}.tsx}
├── apps/server/            # BFF 骨架
│   ├── package.json  tsconfig.json
│   └── src/
│       ├── index.ts        # Fastify app, GET /health -> {ok:true}
│       ├── config.ts       # env (PORT, HERMES_BASE_URL, DB_PATH)
│       └── db/  auth/  users/  hermes/  audit/  routes/
└── packages/shared/
    ├── package.json  tsconfig.json
    └── src/index.ts        # Role / UserStatus
```
