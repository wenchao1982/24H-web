# 架构（24H Web）

> 精简架构基线；详见 [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) + [`docs/INTERFACES.md`](./docs/INTERFACES.md)。

## 1. 分层

```
浏览器 SPA (apps/web)  →  BFF (apps/server)  →  hermes serve  →  ~/.hermes
```

| 组件 | 职责 |
| --- | --- |
| `apps/web` | React SPA：UI/交互/状态；只调同源 BFF；**不持 Hermes token** |
| `apps/server` | BFF（Fastify）：认证、用户/角色、profile 租户映射、代理（REST + WS）、审计、限流 |
| `packages/shared` | 前后端共享类型（`Role` / `UserStatus` 等） |
| `hermes serve` | 官方后端（loopback；L1 `/api/ws` JSON-RPC + L2 REST `/api/*`） |
| `~/.hermes` | Hermes 主目录（profile / skills / config） |

## 2. monorepo 目录树

```
24h-web/
├── package.json            # private，workspaces ["apps/*","packages/*"]
├── tsconfig.base.json
├── opencode.json           # Spec 工作流配置
├── AGENTS.md  requirement.md  ui-spec.md  architecture.md
├── task-list.md  test-report.md  deploy.md  CONTRIBUTING.md
├── apps/
│   ├── web/                # React 19 + Vite SPA（src/{shell,chat,agents,...}）
│   └── server/             # BFF（Fastify）
│       └── src/{config,index,paths,http,db,auth,users,session,hermes,audit,integrations,routes,skillui,bin}
├── packages/
│   └── shared/             # 共享类型
├── docs/                   # ARCHITECTURE / INTERFACES / TASKS / UI / DEPLOY
├── e2e/                    # Playwright（隔离临时 DB + 首启 admin）
└── scripts/                # build-server.mjs / smoke-hermes.mjs
```

## 3. API 统一返回格式

- **成功**：直接返回**数据本身**（对象/数组），不额外包 `{data}`。
- **错误**：统一 `{ error, message }`（`error` 为错误码字符串，`message` 为可读信息）。
  - 错误码由 `apps/server/src/http/errors.ts#ApiError` 定义并经全局错误处理器输出。

### 路由归属

| 前缀 | 归属 | 说明 |
| --- | --- | --- |
| `/api/auth` | **BFF 自有** | 登录 / 会话 / 改密 / 自助资料 / OIDC |
| `/api/admin` | **BFF 自有** | 用户 / 角色 / profile 分配 / 审计 / 连接 |
| `/api/system` | **BFF 自有** | 版本 / 升级 |
| `/api/notifications` | **BFF 自有** | 通知中心 |
| `/api/integrations` | **BFF 自有** | GitHub 等第三方集成 |
| `/api/skill-host` | **BFF 自有** | Skill UI 宿主 broker |
| `/api/hermes/*` | **代理** | 转发到 Hermes L2 REST（注入内部 token + profile 守卫） |
| `/api/hermes/ws` | **代理** | 认证后代理到 Hermes L1 `/api/ws`（WS JSON-RPC） |

## 4. 数据表（SQLite）

| 表 | 说明 |
| --- | --- |
| `users` | 账号：`id/username/display_name/password_hash/role/status/must_change_password/avatar` + **OIDC 列** `external_id/auth_provider` |
| `user_profiles` | 用户 ↔ Hermes profile 分配（**租户边界**）+ `is_default` |
| `sessions` | BFF 会话（HttpOnly cookie `24h_session`） |
| `login_attempts` | 登录失败计数 / 锁定 |
| `audit` | 敏感操作留痕 |
| `connections` | 多个 Hermes 实例注册（增删/选择/探活） |

## 5. 硬约束

- TypeScript **strict**（ESM）。
- **不引 UI 库**：手写 CSS + `--ds-*` design token。
- **密钥/口令绝不落前端、不落日志**（env 只回键名，静态托管不回显）。
- **SQL 参数化**（better-sqlite3 prepared statements）。
- 子进程 **`shell:false`** + 参数数组，禁止 shell 注入。
- 应用根用 `apps/server/src/paths.ts#findRepoRoot`（src 与 bundle 语义一致）。

## 6. 会话身份（stored id / runtime id）与 session.resume

Hermes 会话有**两个身份**，必须成对使用，客户端不得混用：

```ts
interface SessionIdentity { storedId: string; runtimeId: string }
```

- `storedId`：持久化会话 id（`session.list` 行的 `id` / `session.create` 回包的 `stored_session_id`），用于删除等持久操作。
- `runtimeId`：运行时内存 id（`session.resume` 回包的 `session_id` / `session.create` 回包的 `session_id`），用于会话域 RPC 与事件匹配。
- `runtimeId` **仅来自 resume/create 回包**；列表 id 永不充当 runtime id。点选/深链历史会话必须先 `session.resume` 建立身份对。

### 契约矩阵（官方源码为准）

| RPC / 事件 | 身份键 | 说明 |
| --- | --- | --- |
| `session.resume` | 入参 = **stored id**；回包 `session_id` = **runtime id** | `contracts/sessions.py:174-191` |
| `session.create` | 回包含 `session_id`(runtime) 与 `stored_session_id`(stored) | `contracts/sessions.py:138-143` |
| `session.list` | 行 `id` = **stored id** | `methods_session.py:118-124` |
| `prompt.submit` / `session.interrupt` / `session.title` | **runtime id** | `methods_prompt.py:585`、`methods_session.py:2146-2149 / 1096-1097` |
| `file.attach` / `image.attach` / `image.attach_bytes` / `pdf.attach` / `clipboard.paste` | **runtime id** | `methods_prompt.py:845-849 / 728-730 / 756 / 787-794 / 704-706` |
| `subagent.list` / `delegation.status` | **runtime id** | `methods_subagents.py:53-58` |
| `session.events.since` | **runtime id**（回放 ring 键） | `server.py:665-668` |
| `session.delete` | **stored id**（DB 键） | `methods_session.py:1055-1064` |
| `session.workspace.move` | **stored id，字段名 `session_key`（非 `session_id`）** | `methods_session.py:987-992` |

**规则**：任何 runtime-id RPC 发出前，必须存在已提交的身份对且 `identity.storedId === activeId`；否则不得发送（4001 `session not found` 的根因即误用 stored id 作 runtime id）。归一化失败即报错，禁止回退 stored id。

**打断契约**：`session.interrupt` 入参 `session_id` 用 **runtime id**，回包 `{status:"interrupted"|"not_interrupted"}`；打断后网关仍发 `message.complete`，`status ∈ {complete,error,interrupted}`（`contracts/events.py` TurnStatus），`status="error"` 时另有 `error`/`recoverable`/`error_surface`/`partial`。用户停止会清除 durable turn marker，**不会**触发 auto-continue（仅进程崩溃遗留 marker 才会）。

## 7. 对话控件：两级模型语义 + WS 租户守卫 + 10MB 偏差

### 7.1 模型两级语义（hero vs 会话内）

- **hero 态（`activeId === null`）**：模型选择**只写入待创建参数**，发送时随 `session.create{model}` 下发；**不发 `config.set`**，前端**不预判「昂贵」**（`session.create` 无 `confirm_expensive_model` 字段）。
- **会话内**：发 `config.set{key:"model", value, session_id: runtimeId}`。回合**运行中**网关把切换 stash 到下一回合并回 `deferred:true`，前端提示「将于下一回合生效」，**不得热切**。
- **回合结束后回正（REQ-010a）**：收到该会话 **`message.complete`** 事件后，调 **`model.options{profile: <当前 selection.profile 或 default_profile>, session_id: runtimeId}`**（参数**须同时含非空 `profile` 与 `session_id`**）并以回包 **`model`** 字段回正选中态；若 `model` ≠ 用户选择（stash 被 turn start 丢弃）则回滚并提示「切换未生效」。
- **对齐来源**：契约**不存在 `session.info`**；`session.status` 回包仅 `{output: str}`，**不可**用于对齐。唯一结构化来源是 `model.options{session_id}` 回包的 `model` / `provider`。
- 昂贵模型以网关 `config.set` 回包的 `confirm_required` 为**唯一判据**：确认后以 `confirm_expensive_model:true` 重发，取消则回滚选中态。
- `model.options` / 工作区列表请求**必须携带非空 `profile`**（租户上下文明确，REQ-019 / REQ-012）；**无可用 `profile`（未选且 `default_profile` 为空）时不得发起该请求**并展示可读错误。

### 7.2 WS 租户守卫（BFF 代理，default-deny）

- **唯一判据 = 解析后是否含 `method` 字符串**（不论有无 `id`、不论是否带 `result`/`error`）。凡含 `method` 一律按 request 施加守卫；**JSON 数组批帧逐元素**分类与守卫；**二进制帧与 JSON 解析失败一律拒绝**；`null`/数字/字符串/布尔拒绝。**禁止**以「无 `id`＝通知」「带 `result`/`error`＝响应」「数组/二进制放行」为由免拦。
- **`params.profile` 守卫**：非 `super_admin` 且 `params.profile` 指向未分配 profile → 以**同 `id`** 回 `403 PROFILE_FORBIDDEN`，**不转发、不入 pending**。
- **租户上下文注入（REQ-017，default-deny）**：非 `super_admin` 的 request 帧缺失 `params.profile` 时，**除命中显式 profile-agnostic 豁免清单外，一律注入**调用者 `default_profile`（`user_profiles.is_default`，回退任一已分配）后再转发；**无任何可用 profile → 403 不转发**；`super_admin` **不注入**。**豁免清单**（须在 `design.md` 显式枚举并逐条测试）：`ping` / `gateway.capabilities` / `client.capabilities` / `commands.catalog` / `complete.path` / `complete.slash` / `llm.oneshot`。**禁止**「包含式前缀白名单」（`session.*`/`profiles.*`/`mcp.*`/`skills.*`）——遗漏即 fail-open；须以 `docs/INTERFACES.md` 全方法清单做 MethodSweep 核对。
- **会话域显式 profile（REQ-020）**：前端在 `selection.profile !== null` 时，会话域 RPC（`session.list` / `session.most_recent` / `session.resume` / `session.events.since`）shall 携带 `params.profile = selection.profile`（多 profile 用户可访问非默认 profile 的会话）；未显式选择时不上送，由 BFF 按 REQ-017 注入 `default_profile`。
- **响应侧过滤（REQ-015）**：对 `profiles.list` 响应按调用者 `user_profiles` 白名单过滤 `result.profiles[]` 后再下发；**仅对「成功但结构不符」fail-closed**——响应非 JSON、缺 `profiles` 键或非数组、过滤异常 → **不下发并回错误**，**绝不放行全量**；**上游错误帧（`{id, error}`）shall 原样透传**，**不得**替换为 BFF 自造错误（PR-008）；`super_admin` 不过滤。响应过滤复用 `proxy.ts` 导出的 `classifyFrame`，不得自行解析帧文本。
- **队列与帧上限（REQ-018 / REQ-018a）**：显式设 `maxPayload`，**同时作用于客户端接入侧与上游侧两个 socket**；`pending`/`outbound` 队列上限**同时约束条数与累计字节**（`pendingBytes ≤ K × maxPayload`，K 须量化），超限回可读错误并**仅**终止该连接。
- **审计（REQ-021）**：守卫拒绝（WS 403）与响应过滤 fail-closed shall 向 `audit` 表（见 §4）写入一条记录（actor / profile / method / ip / 结果 / 时间戳），**不得**写 token / 密钥 / 文件字节。
- 判据与 REST 侧 `assertProfileAccess` / `userCanAccessProfile` 同语义；前端 `me.profiles` 白名单仅作 UX 约束，**不是**安全边界。

### 7.3 10MB 单帧偏差与补偿控制

- **偏差登记**：本设计允许 WS 单帧承载上传内容，base64 后 10MB ≈ 13.3MB；OWASP 建议 WS 消息 ≤64KB，本设计**显著超出**（契约无分片通道）。
- **补偿控制**：① 前端**预筛**——单文件 >10MB、单批 >10 个在**读取内容之前**拒绝；② **REQ-018 / REQ-018a** 为 BFF WS 显式设 `maxPayload`（**双 socket**）与 `pending`/`outbound` 队列上限（**条数 AND 累计字节**，`pendingBytes ≤ K × maxPayload`，不依赖 `ws` 库默认值），超限回可读错误并**仅**终止该连接；③ 单文件 >2MB 显示等待态，失败重试**复用 identity**、不重复 `session.create`；④ 端到端可达性以**实测**为准；网关拒绝则原样透传 message。
- 服务端 magic bytes 校验落点（Hermes 或 BFF）**未定**，客户端 `File.type` 仅作 UX 预筛；列为独立任务。

## 8. 详见

- 完整分层与关键流：[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- 接口清单（BFF / L1 / L2）：[`docs/INTERFACES.md`](./docs/INTERFACES.md)
