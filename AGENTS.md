# AGENTS.md — 24H Web

> 企业多用户的 Hermes web 工作台：**自有前端 SPA + 自有 BFF + 官方 Hermes 后端**。
> 与用户交流用中文；代码注释中英混合可。

## 1. 定位

- 面向**企业多用户**的 Hermes web 端：管理员在界面里管理用户/权限；普通用户只看到被授权的 agent 与会话。
- **不自研 agent 能力**：对话/会话/工具/技能/配置复用官方 Hermes。
- 认证 / 用户 / 角色 / 租户 / 代理由 **BFF** 承担。

## 2. 架构 / 分层（与 `docs/ARCHITECTURE.md` 对齐）

```
浏览器 SPA (apps/web)  →  BFF (apps/server)  →  hermes serve  →  ~/.hermes
```

| 组件 | 职责 |
| --- | --- |
| `apps/web` | React SPA：UI/交互/状态；只调同源 BFF；**不持 Hermes token** |
| `apps/server` | BFF：认证、用户/角色、profile 租户映射、代理(REST+WS)、审计、限流 |
| `packages/shared` | 前后端共享类型（`Role` / `UserStatus` 等） |
| `hermes serve` | 官方后端（loopback，L1 `/api/ws` JSON-RPC + L2 REST `/api/*`） |
| `~/.hermes` | Hermes 主目录（profile / skills / config） |

## 3. monorepo

- `packages/shared` — 前后端共享类型。
- `apps/web` — React SPA（React 19 + Vite + react-router）。
- `apps/server` — BFF（Fastify），子域：认证、用户/角色、profile 租户、Hermes 代理、审计。

## 4. 认证与运行时

- **认证策略化**：`AuthProvider` 接口（`password` 现在 / `oidc` 以后）；业务只依赖 `req.user`。
- **会话**：HttpOnly cookie `24h_session`；CSRF cookie `24h_csrf` → 请求头 `x-csrf-token`。
- **Hermes token 只在 BFF**；浏览器只持 BFF 会话 cookie + CSRF。
- **两级角色**：`super_admin`（全权 + 管理用户）/ `admin`（仅被分配 profile）。
- **租户边界 = Hermes profile**：`user_profiles` 分配；统一守卫
  `user.role === 'super_admin' || userCanAccessProfile(user.id, profile)`。
- 口令 **argon2id**；**首登强制改密**；登录限流/锁定；**保护最后一个 active super_admin**。
- **审计**所有管理操作。

## 5. 接口

- 前端 → BFF：`/api/auth/*`、`/api/admin/*`、`/api/hermes/*`（代理）。
- BFF → Hermes：官方 **L1 `/api/ws`** + **L2 `/api/*`**；契约以官方生成文件为准
  （`gateway-contract.generated.ts` / OpenRPC），**不要猜 Hermes 内部 schema**。
- 服务端 → 客户端请求（`approval`/`clarify`/`sudo`/`secret`）必须回包（同一 `id`）。
- 完整清单见 `docs/INTERFACES.md`。

## 6. 验证

```bash
npm run check     # typecheck（web + server + shared）+ vitest（server + web）
```

- **验证命令固定为 `npm run check`**；提交前必须通过。
- **e2e 单独跑**：`npm run test:e2e`（Playwright，隔离临时 DB + 首启 admin），**不进 `check`**。

## 7. 构建 / 运行

- dev：`hermes serve`(loopback) + `npm run dev:server` + `npm run dev:web`。
- 生产：`npm run build`（SPA 构建 + BFF bundle）→ `npm run start`。
- BFF 为 **esbuild 单文件 ESM bundle** `apps/server/dist/server.mjs`（`packages: external`）；
  原生依赖 `better-sqlite3` / `@node-rs/argon2` 保持 external。
- **应用根用 `apps/server/src/paths.ts#findRepoRoot` / `defaultSkillRoots`**（`OS_SKILL_ROOTS`
  覆盖在 `skillui/discover.ts`）：无论从 `src/` 还是 `dist/` bundle 运行都解析到同一根，
  **勿再用相对 `import.meta.url` 层级硬算**。

## 8. 硬性约定

- TypeScript **strict**。
- **不引 UI 库**：手写 CSS + `--ds-*` design token（`apps/web/src/styles.css`）。
- **密钥/口令绝不落前端、不落日志**（env 只回键名，静态托管不回显）。
- SQL **参数化**（better-sqlite3 prepared statements）。
- 子进程 **`shell:false`** + 参数数组，禁止 shell 注入。
- 错误结构统一 `{ error, message }`。
- 不提交 `node_modules/`、`dist/`、`.env`；BFF sqlite 数据目录已 gitignore。
- 新增能力优先落在现有层（BFF 路由 / SPA 页面），不新造框架。

## 9. 目录与关键文件

| 路径 | 说明 |
| --- | --- |
| `apps/web/src/api/client.ts` | 调 BFF 的唯一入口（HTTP） |
| `apps/web/src/api/ws.ts` | 对话 WS JSON-RPC 客户端 |
| `apps/web/src/pages/` | 登录 / 用户管理 |
| `apps/web/src/{chat,agents,groups,tasks,usage,settings,details,notifications}/` | 各功能模块与设置面板 |
| `apps/server/src/index.ts` | BFF 入口：开库 → 迁移 → `ensureFirstAdmin` → listen |
| `apps/server/src/config.ts` | env：`PORT` / `HERMES_BASE_URL` / `DB_PATH` |
| `apps/server/src/http/app.ts` | Fastify 装配：统一错误 + CSRF + 会话中间件 + 路由 |
| `apps/server/src/http/csrf.ts` | CSRF cookie/header 常量与守卫 |
| `apps/server/src/session/` | 会话 repo + 中间件（`24h_session`） |
| `apps/server/src/auth/providers/` | `AuthProvider` 实现（password / oidc） |
| `apps/server/src/users/repo.ts` | 用户/角色/profile 分配 + `ensureFirstAdmin` |
| `apps/server/src/hermes/` | 代理 REST + WS 到 `hermes serve` + 上游客户端 |
| `apps/server/src/db/` | sqlite + 迁移 |
| `apps/server/src/audit/repo.ts` | 审计 |
| `apps/server/src/routes/` | auth / admin / hermes / system / integrations / skillUi |
| `apps/server/src/paths.ts` | `findRepoRoot` / `defaultSkillRoots`（src 与 bundle 一致） |
| `apps/server/scripts/build-server.mjs` | esbuild → `apps/server/dist/server.mjs` |
| `apps/server/src/bin/bootstrap.ts` | 手动引导：`npm -w @24h/server run bootstrap` |
| `packages/shared/src/index.ts` | 共享类型 |
| `e2e/` + `playwright.config.ts` | headless e2e（`start-bff.mjs` 起临时 DB 的 BFF） |
| `docs/` | 规格来源（见 §10） |

## 10. 状态 / 规格来源 / 未采用

- **M0–M16 已完成**；功能拆解见 `docs/TASKS.md`。
- 规格来源：`docs/{ARCHITECTURE,INTERFACES,TASKS,UI}.md`（改接口先看这些，契约为准）。
- **未采用**：Kanban 状态列看板；可视化编排画布（节点=agent）——见 `docs/UI.md`。
- **TODO(future)**：IdP 接入（新增 `AuthProvider` 的 `oidc` 实现）。

## 11. 红线规则（Spec 工作流）

1. **变更先改 4 份基线文档**（`AGENTS.md` / `requirement.md` / `ui-spec.md` / `architecture.md`）
   → **更新 `task-list.md`** → **再改代码**。
2. **正式开发用 Spec 模式、禁 Vibe**；应急用 Build，事后必须补回基线文档。
3. **任务顺序执行**：前置任务未验收，不得开启后继任务。
4. **质量门不过不进人工验收**（`npm run check` 必须全绿）。
5. **每 3–5 个任务重置会话**，避免上下文污染。

> 工作流说明见 [`CONTRIBUTING.md`](./CONTRIBUTING.md)、[`opencode.json`](./opencode.json)。

## 12. 根级 Spec 文件

| 文件 | 作用 |
| --- | --- |
| `opencode.json` | Spec 工作流配置（`opencode-vibe-spec` 插件 + `instructions` + 只读 `ask` agent） |
| `AGENTS.md` | 本文件；协作/架构/硬性约定（基线） |
| `requirement.md` | 业务需求（基线） |
| `ui-spec.md` | UI 规范（基线） |
| `architecture.md` | 架构/接口约定（基线） |
| `task-list.md` | 任务看板（动态更新，唯一"下一步"入口） |
| `test-report.md` | 测试报告模板 + 当前汇总 |
| `deploy.md` | A2 部署要点 |
| `CONTRIBUTING.md` | Spec 驱动工作流快速卡片 |

> 根文件为**精简入口**，细节一律链接 `docs/*`（避免双份维护漂移）。
