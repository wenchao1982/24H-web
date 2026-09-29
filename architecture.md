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

## 6. 详见

- 完整分层与关键流：[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- 接口清单（BFF / L1 / L2）：[`docs/INTERFACES.md`](./docs/INTERFACES.md)
