# 功能接口清单（INTERFACES）

> 三层接口：**BFF（自有）** → **Hermes L1（WS JSON-RPC）** + **Hermes L2（REST）**。
> 前端只调 BFF；BFF 再调 Hermes。
> **字段/参数以官方契约为准**：`tui_gateway/contracts/*` 生成的 `gateway-contract.generated.ts` / `gateway-contract.openrpc.json`，以及 `hermes_cli/web_routers/*.py`。本清单是快照，改名以官方为准。

## 1. BFF 自有接口

### 认证
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/auth/login` | 用户名/密码登录，种 HttpOnly 会话 cookie |
| GET | `/api/auth/me` | 当前用户：`id/username/role/profiles/default_profile` |
| POST | `/api/auth/logout` | 登出，清 cookie |
| POST | `/api/auth/change-password` | 改密（首登强制） |
| PATCH | `/api/auth/profile` | 自助改用户名/显示名 |
| PUT | `/api/auth/avatar` | 自助头像 |

### 用户/角色管理（super_admin）
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/admin/users` | 用户列表（含 profiles） |
| POST | `/api/admin/users` | 新建用户 |
| PATCH | `/api/admin/users/:id` | 改 role / status |
| DELETE | `/api/admin/users/:id` | 删用户（保护最后一个 active super_admin） |
| PUT | `/api/admin/users/:id/profiles` | 分配 profile（租户边界） |
| POST | `/api/admin/users/:id/password` | 重置密码 |
| GET | `/api/admin/audit` | 审计查询 |

### 代理到 Hermes
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| * | `/api/hermes/*` | 转发到 Hermes `/api/*`（注入内部凭证 + profile 守卫） |
| WS | `/api/hermes/ws` | 认证后代理到 Hermes `/api/ws`（L1） |

### 系统
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/system/version` | 核心 + web 版本 |
| POST | `/api/system/update` | 检查/执行升级 |
| GET/POST/PATCH/DELETE | `/api/admin/connections` | 连接管理（多个 Hermes 实例） |
| GET/POST | `/api/integrations/github` | GitHub 集成：`gh` 登录/状态、仓库、PR |
| GET/PATCH | `/api/notifications` | 通知中心：未读/挂起聚合 + 偏好 |

## 2. Hermes L1（WS JSON-RPC）方法

| 功能域 | 方法 | 备注 |
| --- | --- | --- |
| 会话 | `session.create` `session.list` `session.most_recent` `session.resume` `session.active_list` `session.delete` `session.title` `session.set_hidden` `session.compress` `session.close` `session.interrupt` `session.workspace.move` `session.control` `session.control.read` | 生命周期/浏览/中断 |
| 会话事件 | `session.events.since` `session.events.stats` | 断线重放/统计 |
| 提示与流 | `prompt.submit` `prompt.background` `prompt.btw` | `prompt.submit` 是 fire-and-forget，完成看事件 |
| 事件（server→client） | `message.delta` `message.complete` `thinking` `tool.start` `tool.generating` `tool.complete` `done` `error` | 归一化后 SSE/WS 透出 |
| 服务端请求（需回包） | `approval` `clarify` `sudo` `secret` `mcp.setup` | 同一 `id` 回包 |
| 附件 | `clipboard.paste` `image.attach` `image.attach_bytes` `pdf.attach` `file.attach` | |
| 模型 | `model.options` `model.save_key` `model.disconnect` | |
| 配置 | `config.get` `config.set` `reload.env` `setup.status` `setup.runtime_check` `diagnostics.share_nous` | |
| 上下文/引用 | `complete.path`（@ 引用文件/目录） | 输入框 @ 注入 |
| 档案 profile | `profiles.list` `profiles.describe` `profiles.configure` `profiles.create` `profiles.set_asset` `profiles.get_asset` | M9 对齐用 |
| 工具 | `tools.list` `toolsets.list` `tools.show` `command.dispatch` `slash.exec` `complete.slash` `complete.path` `commands.catalog` | skills 也经 commands.catalog 暴露；slash.exec 也承载 /learn（经验→skill） |
| 会话命令 | `slash.exec` 承载 /goal /subgoal /loop /heartbeat /plan /review /branch /undo /retry /rollback /snapshot /bg /btw /queue /steer /busy /compress /skills /memory /bundles /suggestions /blueprint /reload* /init /fast /reasoning /egress /worktree | 统一经 `commands.catalog`+`complete.slash`；含 /personality、/codex-runtime |
| MCP | `mcp.servers.*` `mcp.catalog` | |
| 技能 | `skills.manage` `skill_manage` | ；/learn 经 slash.exec 生成 SKILL.md |
| 插件 | `plugins.manage` `plugins.compat_report` | |
| 定时 | `cron.manage`（list/add/remove/pause/resume）；事件 `cron.changed` | |
| 群聊 / Bot | `groups.*` `bot_relay.*` | future |
| 子代理 | `subagent.list` `subagent.tail` `subagent.interrupt` `subagent.steer` `delegation.status` `delegation.pause` `spawn_tree.save|list|load` | ；/review 派独立评审 |
| 其它 | `vault.*` `connectors.*` `free_tier.*` `billing.state` `subscription.*` `voice.*` `wake.*` `image.generate` `llm.oneshot` `gateway.capabilities` `ping` `cli.exec` `shell.exec` `browser.manage` `handoff.*` `project.facts` `verification.status` `session.foreign.*` | 按需 |

## 3. Hermes L2（REST `/api/*`）端点

| 功能域 | 端点 | 备注 |
| --- | --- | --- |
| 状态/系统 | `GET /api/status` `GET /api/health` `GET /api/system/stats` | |
| 用量分析 | `GET /api/analytics/usage` `GET /api/analytics/models` `GET /api/curator` `GET /api/learning/*` | |
| 技能 | `GET /api/skills` `PUT /api/skills/toggle` `GET/PUT /api/skills/content` `POST /api/skills` + hub 路由 | |
| 工具 | `GET /api/tools/toolsets` `.../:name/config|models|env|post-setup` `GET/PUT /api/tools/terminal/backend(s)` `GET /api/tools/computer-use/status` | |
| 模型 | `GET /api/model/info|options|recommended-default|auxiliary` `GET/PUT /api/model/moa` `POST /api/model/set` `GET/DELETE/POST /api/providers/oauth/*` | |
| 配置/环境 | `GET /api/config` `GET /api/config/defaults|schema` `GET/PUT /api/config/raw` `GET/POST/DELETE /api/env` `POST /api/env/reveal` | （含 approvals.mode 审批策略） |
| 路由/回退/池 | `GET/PUT /api/config`（provider_routing / fallback / credential_pools） | config.yaml 驱动 |
| 工具网关/开关 | `GET/PUT /api/config`（api_server / tool_search / lsp / hooks / deliverable / subscription）；`/api/tools/toolsets/*`（web search / x search / document extraction / computer-use） | 多为配置驱动 |
| 档案 profile | `GET/POST /api/profiles` `GET/POST /api/profiles/active` `PATCH/DELETE /api/profiles/:name` `GET/PUT /api/profiles/:name/soul|description|model` `POST /api/profiles/import|export` | |
| 会话 | `GET /api/sessions` `GET /api/sessions/:id/messages` `POST /api/sessions/import|prune|bulk-delete` `GET /api/chat/workspaces` `POST /api/chat/image-upload` `GET /api/sessions?q=`（全文搜索） | |
| 项目 | `GET/POST /api/projects*`、项目树 | 具名多文件夹工作区 |
| 定时 | `GET/POST /api/cron/jobs` `GET /api/cron/delivery-targets` `POST /api/cron/jobs/:id/pause|resume|trigger` | |
| MCP | `/api/mcp/*` `POST /api/mcp/catalog/install` | |
| 消息平台 | `GET/PUT /api/messaging/platforms` `POST /api/messaging/{telegram,whatsapp}/onboarding/*` | |
| 记忆 | `GET /api/memory` `PUT /api/memory/provider` `POST /api/memory/reset` | |
| 文件 | `GET /api/files` `GET /api/files/read` `POST /api/files/upload-stream|mkdir` `DELETE /api/files` | |
| Git | `/api/git/*` | |
| 日志 | `GET /api/logs` | |
| 配对/安全 | `GET /api/pairing` `POST /api/pairing/*` `GET /api/ssh/ownership` | |
| Webhooks | `GET/POST /api/webhooks` `PUT/DELETE /api/webhooks/:name` | |
| 本地模型 | `/api/local-models/*` | |
| 网关 | `POST /api/gateway/start|stop` | |
| 运维 | `/api/ops/*`（doctor/backup/import…） | |
| 门户 | `GET /api/portal` | |

## 4. 功能 → 接口映射（UI）

| UI | 主接口 | 走 |
| --- | --- | --- |
| 登录 / 用户管理 | `/api/auth/*` `/api/admin/*` | BFF |
| 对话 | `/api/hermes/ws` → L1 `session.*` + `prompt.submit` + 事件 | BFF→L1 |
| 会话列表 | L1 `session.list`（或 L2 `/api/sessions`） | BFF→L1/L2 |
| 技能 | L2 `/api/skills*` | BFF→L2 |
| 任务 | L2 `/api/cron/*`（或 L1 `cron.manage`） | BFF→L2/L1 |
| 用量 | L2 `/api/analytics/*` `/api/system/stats` | BFF→L2 |
| 设置（Keys/模型） | L2 `/api/env` `/api/model/*` `/api/config` | BFF→L2 |
| 面板（文件/日志/预览） | L2 `/api/files` `/api/logs` | BFF→L2 |
| 经验→Skill（/learn） | L1 `slash.exec`（/learn） | BFF→L1 |
| GitHub 集成 | BFF `/api/integrations/github` | BFF |
| 系统升级 | BFF `/api/system/update` | BFF |
| 连接管理 | BFF `/api/admin/connections` | BFF |
| 账户（自助资料） | BFF `/api/auth/profile` `/api/auth/avatar` | BFF |
| 上下文文件/引用 | L1 `/context` · `complete.path` | BFF→L1 |
| 路由/回退/凭证池 | L2 `/api/config` | BFF→L2 |
| 集成扩展（API Server/Hooks/工具网关/工具搜索/LSP/Computer Use/Deliverable/订阅代理/Codex） | L2 `/api/config` · `/api/tools/*` | BFF→L2 |
| Plugin Catalog | L1 `plugins.manage` / L2 | BFF→L1/L2 |

## 5. 约定

- **契约以官方为准**，不猜字段；本清单随官方版本更新。
- **Hermes token 只在 BFF**；浏览器只持 BFF 会话 cookie。
- 任何触碰某个 profile 的请求，BFF 先做 `super_admin || userCanAccessProfile` 守卫。
- 服务端→客户端请求（`approval`/`clarify`/`sudo`/`secret`）必须回包，否则 turn 卡住。
