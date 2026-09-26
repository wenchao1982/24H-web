# AGENTS.md — 24H Web

> 面向中文用户的 Hermes web 端。**自有 SPA + 官方后端**，不自研后端。
> 与用户交流用**中文**；代码注释中英混合可。

## 1. 定位

- **chat-first 的中文 web 端**，由官方 `hermes dashboard` 通过 `HERMES_WEB_DIST` 托管。
- **不自研后端、不 fork 官方前端**：只说官方两个接口层。
- 目标：先"好用起来"（设置 + 对话 + 技能），再逐步整合任务 / 用量 / 面板 / 命令面板。

## 2. 接口（唯一依赖）

| 层 | 协议 | 用途 |
| --- | --- | --- |
| **L1** | WebSocket JSON-RPC `/api/ws` | 对话（`session.create` → `prompt.submit` → 事件）、会话、审批 |
| **L2** | REST `/api/*` | 配置、Keys（`/api/env`）、模型（`/api/model/*`）、技能（`/api/skills`） |

- **契约以官方为准**：`tui_gateway/contracts/*` 生成的 `gateway-contract.generated.ts` / `gateway-contract.openrpc.json`。**不要猜 Hermes 内部 schema**。
- 服务端 → 客户端请求（`approval` / `clarify` / `sudo` / `secret`）**必须回包**（同一 `id`），否则 turn 卡住。
- `prompt.submit` 是 fire-and-forget：turn 完成看**事件**，不是 RPC 返回。

## 3. 运行时约束

- **必须** `hermes dashboard`（`hermes serve` 是 headless，永不挂 SPA）。
- 服务端向 `index.html` 的 `</head>` 注入 `window.__HERMES_SESSION_TOKEN__` / `__HERMES_BASE_PATH__` / `__HERMES_AUTH_REQUIRED__`。`index.html` 必须有 `</head>`。
- 构建产物放 `/assets/`；`vite.config.ts` 的 `outDir` 必须是 `dist`。
- 非回环绑定强制 auth gate；gated 模式 token 为空，WS 用 `/api/auth/ws-ticket` 换单次 ticket。

## 4. 架构约定

- `src/api/` 是**唯一**与后端通信的地方：`rest.ts`(L2) + `gateway.ts`(L1)。
- 组件只调用 `api` / `Gateway`，不直接 `fetch`。
- 不引入 UI 框架；手写 CSS（`styles.css`）。
- `@hermes/shared` **未发布到 npm**：如需官方的 `JsonRpcGatewayClient`，vendored 拷贝或继续用本仓 `gateway.ts`。

## 5. 硬性约定

- TypeScript strict；不引入 UI 库。
- 不在代码/日志/响应中出现密钥明文。
- 验证命令：`npm run check`（= `typecheck`）。
- 不提交 `node_modules/`、`dist/`、`.env`。

## 6. 目录

| 路径 | 说明 |
| --- | --- |
| `src/api/env.ts` | 读取服务端注入的运行时变量 |
| `src/api/rest.ts` | L2 REST 封装 |
| `src/api/gateway.ts` | L1 `/api/ws` JSON-RPC 客户端 |
| `src/pages/` | 页面：对话 / 技能 / 设置 |
| `docs/`（未来） | 规格引用；现引用 `24OS/docs/*` |

## 7. 待办

- **TODO(future)**: Skill UI 宿主协议（iframe + postMessage / `ui/panel.yaml`），规格见 `24OS/docs/SKILL_UI_PROTOCOL.md`。**本轮不实现。**
- 任务（官方 Cron/`cron.manage`）、用量（`/api/analytics`）、右侧面板（`/api/files`、`/api/logs`）、命令面板（⌘K）。
