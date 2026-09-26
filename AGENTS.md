# AGENTS.md — 24H Web

> 企业多用户的 Hermes web 工作台。**自有前端 SPA + 自有 BFF + 官方 Hermes 后端**。
> 与用户交流用中文；代码注释中英混合可。

## 1. 定位

- 面向**企业多用户**的 Hermes web 端：管理员在界面里管理用户/权限；普通用户只看到被授权的 agent 与会话。
- **不自研 agent 能力**：对话/会话/工具/技能/配置复用官方 Hermes。
- 认证 / 用户 / 角色 / 租户 / 代理由 **BFF** 承担。

## 2. 架构

```
浏览器 SPA (apps/web)  →  BFF (apps/server)  →  hermes serve  →  ~/.hermes
```

| 组件 | 职责 |
| --- | --- |
| `apps/web` | React SPA：UI/交互/状态；只调 BFF；**不持 Hermes token** |
| `apps/server` | BFF：认证、用户/角色、profile 租户映射、代理(REST+WS)、审计、限流 |
| `packages/shared` | 前后端共享类型 |
| `hermes serve` | 官方后端（loopback，内部 token 访问） |

## 3. 认证与租户

- **认证策略化**：`AuthProvider` 接口（`password` 现在 / `oidc` 以后）；业务只依赖 `req.user`。
- **会话**：HttpOnly + SameSite cookie。
- **两级角色**：`super_admin`（全权 + 管理用户）/ `admin`（仅被分配 profile）。
- **租户边界 = Hermes profile**：`user_profiles` 分配；统一守卫
  `user.role === 'super_admin' || userCanAccessProfile(user.id, profile)`。
- 口令 **argon2id**；**首登强制改密**；登录限流/锁定；**保护最后一个 active super_admin**。
- **审计**所有管理操作。

## 4. 接口

- 前端 → BFF：`/api/auth/*`、`/api/admin/*`、`/api/hermes/*`（代理）。
- BFF → Hermes：官方 **L1 `/api/ws`** + **L2 `/api/*`**；契约以官方生成文件为准（`gateway-contract.generated.ts` / OpenRPC），**不要猜 Hermes 内部 schema**。
- **Hermes token 只在 BFF 内使用，永不进浏览器。**
- 服务端 → 客户端请求（`approval`/`clarify`/`sudo`/`secret`）必须回包（同一 `id`）。

## 5. 运行时 / 部署

- Hermes 绑 **loopback（127.0.0.1）**，不触发其 auth gate。
- BFF + SPA **同源**；TLS 与登录由 BFF 承担。
- 远程部署 = **A2**：`hermes serve`(loopback) + BFF + 反代(Caddy/nginx)。
- **不用 Hermes 的 `/login`**；登录页由前端 SPA 提供。

## 6. 硬性约定

- TypeScript strict；不引 UI 库（手写 CSS）；错误结构统一。
- **密钥/口令绝不落前端、不落日志。**
- 验证命令：`npm run check`（跑全部 workspace 的 typecheck）。
- 不提交 `node_modules/`、`dist/`、`.env`；BFF 的 sqlite 数据目录已 gitignore。
- 新增能力优先落在现有层（BFF 路由 / SPA 页面），不新造框架。

## 7. 目录

| 路径 | 说明 |
| --- | --- |
| `apps/web/src/api/` | 调 BFF 的唯一入口（fetch + WS） |
| `apps/web/src/pages/` | 页面：对话 / 技能 / 任务 / 用量 / 设置 / 登录 / 用户管理 |
| `apps/server/src/auth/` | 认证策略 + 会话 + 中间件 |
| `apps/server/src/users/` | 用户/角色/profile 分配 |
| `apps/server/src/hermes/` | 代理 REST + WS 到 `hermes serve` |
| `apps/server/src/db/` | sqlite + 迁移 |
| `apps/server/src/audit/` | 审计 |
| `packages/shared/` | 共享类型 |

## 8. 任务与架构

- 功能拆解：`docs/TASKS.md`（每个任务可最小实现）。
- 架构说明：`docs/ARCHITECTURE.md`。

## 9. 待办

- **TODO(future)**: IdP 接入（新增 `AuthProvider` 的 oidc 实现）。
- **TODO(future)**: Skill UI 宿主协议（iframe + postMessage / `ui/panel.yaml`），规格见 `24OS/docs/SKILL_UI_PROTOCOL.md`。
