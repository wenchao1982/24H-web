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
- `apps/demo` — **独立高保真前端 Demo**（Vite + Tailwind v4 + Radix；mock 数据，不碰后端）。
  **先 Demo 定稿 → 再回填写手写 CSS 的生产页**（§11.1）；Demo 独立 `check:demo`，**不进** 根 `npm run check`。

## 4. 认证与运行时

- **认证策略化**：`AuthProvider` 接口（`password` 现在 / `oidc` 以后）；业务只依赖 `req.user`。
- **会话**：HttpOnly cookie `24h_session`；CSRF cookie `24h_csrf` → 请求头 `x-csrf-token`。
- **Hermes token 只在 BFF**；浏览器只持 BFF 会话 cookie + CSRF。
- **两级角色**：`super_admin`（全权 + 管理用户）/ `admin`（仅被分配 profile）。
- **租户边界 = Hermes profile**：`user_profiles` 分配；统一守卫
  `user.role === 'super_admin' || userCanAccessProfile(user.id, profile)`。
- **智能体 = Hermes profile**：对话页智能体选项**只取 `/api/auth/me` 的 `me.profiles[]`**（不回退
  `profiles.list` 全量）；会话内切换智能体**强开新会话**（已建会话的 pill 只读）。
- 口令 **argon2id**；**首登强制改密**；登录限流/锁定；**保护最后一个 active super_admin**。
- **审计**所有管理操作。

## 5. 接口

- 前端 → BFF：`/api/auth/*`、`/api/admin/*`、`/api/hermes/*`（代理）。
- BFF → Hermes：官方 **L1 `/api/ws`** + **L2 `/api/*`**；契约以官方生成文件为准
  （`gateway-contract.generated.ts` / OpenRPC），**不要猜 Hermes 内部 schema**。
- 服务端 → 客户端请求（**13 类**：`approval` / `clarify` / `sudo` / `secret` / `vault.unlock_prompt` / `vault.save_login` / `vault.code` / `terminal.read` / `preview.read` / `window.read` / `preview.act` / `tour` / `display.install.sudo`）必须回包（同一 `id`）；旧文档的 `mcp.setup` **不存在**（MCP 走 `connectors.*`/`connection.request`/L2 `/api/mcp/*`）。
- **WS 租户守卫**：BFF 代理对含 `method` 的帧 **default-deny**（数组批帧逐元素；二进制/解析失败一律拒绝），
  越权以同 `id` 回 403 `PROFILE_FORBIDDEN` 且不转发；响应侧对 `profiles.list` 按白名单过滤，
  **仅「成功但结构不符」fail-closed，上游错误帧（`{id,error}`）原样透传**；
  非 `super_admin` 的 request 帧缺失 `params.profile` 时：**豁免判据唯一 = 参数类 schema 未声明 `profile` 字段**
  （从官方契约派生；**不得**以「是否直继 `Params`」判断 —— `Params` 设 `extra="forbid"`，注入无该字段的类会 4000）；
  命中豁免 → 不注入；**其余一切方法（含清单外的未知方法）一律注入 `default_profile`**；无可用 profile → 403 不转发；
  **禁止「包含式前缀白名单」**（`session.*`/`profiles.*`/`mcp.*`/`skills.*`，遗漏即 fail-open）；
  队列上限**条数 / 字节各自独立**（条数 `WS_MAX_PENDING_COUNT = 256`（防大量小帧）；字节 `maxPayload = 16 MiB`、`K = 4` → `pendingBytes ≤ 64 MiB`（防少量大帧），双 socket 生效）；`outbound`（上游→客户端）**对称**设 `WS_MAX_OUTBOUND_COUNT = 256` / `WS_MAX_OUTBOUND_BYTES = 64 MiB`，超限写 `audit(ws.outbound.overflow)` 并**仅**终止该连接；
  **守卫拒绝与响应过滤 fail-closed 必写 `audit`**（actor/profile/method/ip/结果/时间戳，不含 token/密钥/字节）；
  **REST 同语义（REQ-022）**：`/api/hermes/*` 非 `super_admin` 缺 `profile` 时（豁免路径 `/api/hermes/health` 除外）
  注入 `default_profile` 或 403，**禁止**提前 `return` 跳过 `assertProfileAccess`；注入须落入**被转发的 query**。
  豁免清单（WS 26 条 / REST 1 条）与判据见 `architecture.md §7.2` + `.psd/specs/003-composer-redesign/*/contracts-evidence.md`。
- **上传内容类型校验（REQ-023，R10 闭合）**：BFF WS 代理对非 `super_admin` 的
  `image.attach_bytes` / `pdf.attach` 的 base64 载荷做**前缀 magic bytes** 校验（仅解码前 **48 个 base64 字符**
  ≈36 字节，**禁止整帧解码**；可判定格式 PNG/JPEG/GIF/BMP/WebP/TIFF/ICO/CUR + SVG 文本前缀；PDF `%PDF-`），
  不匹配以同 `id` 回 `400 INVALID_ATTACHMENT_TYPE` + 写 `audit`（`ws.upload.invalid_type`）+ **不转发**；
  `file.attach` 不限类型；客户端 `File.type` 仅 UX 预筛，**不是**安全边界。见 `architecture.md §7.2/§7.3`。
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
| `apps/web/src/{kanban,orchestration,voice}/` | **M19–M21 已落地**：看板 / 编排画布 / 语音 |
| `apps/web/src/chat/composer/` | 对话页输入区控件（hero/docked 双态、pill、上传、菜单；**M17 已落地**） |
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

- **M0–M22 已完成并验收**（M17 = 对话页重构，Spec 见 `.psd/specs/003-composer-redesign/`）；功能拆解见 `docs/TASKS.md`，验收状态见 `task-list.md`。
- **M18 = 前端 Demo**（已完成）：`apps/demo` 独立高保真 Demo（18 屏，mock 数据），**先定稿视觉语言再回填 `apps/web`**；已反向补登 C03/C06/M19–M21 生产能力；见 `task-list.md` M18。
- **M19–M22 已落地**：M19 语音/唤醒/TTS/STT · M20 看板（Kanban，**8 列**对齐 `BOARD_COLUMNS`）· M21 可视化编排画布（自建执行层，`{{node.output}}`）· M22 外部 agent 原生安装（BFF `coding-agents` + 方案 C）。
- 规格来源：`docs/{ARCHITECTURE,INTERFACES,TASKS,UI}.md`（改接口先看这些，契约为准）。
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
