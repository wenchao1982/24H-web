# 功能接口清单（INTERFACES）

> 三层接口：**BFF（自有）** → **Hermes L1（WS JSON-RPC）** + **Hermes L2（REST）**。
> 前端只调 BFF；BFF 再调 Hermes。
> **契约以官方源码为准**：`hermes-agent/tui_gateway/contracts/*.py`（L1 方法/服务端请求/事件）、
> `hermes-agent/hermes_cli/web_routers/*.py`（L2 REST）、`hermes_cli/commands.py`（slash）、
> `hermes_cli/config_defaults.py`（config）。本清单为**核对快照（2026-10，Hermes 2026.9.24 build）**。
>
> **规模**：L1 方法 **237** · 服务端请求 **13** · 事件 **74**；L2 `/api/*` **280**（+插件端点；含 7 WS）；
> CLI ~70 顶层命令；slash **102**；config 顶层键 **98**。

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
| GET/POST/PATCH/DELETE | `/api/admin/connections` | 连接管理（多个 Hermes 实例） |

### 系统 / 通知 / 集成
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/system/version` | 核心 + web 版本 |
| POST | `/api/system/update` | 检查/执行升级 |
| GET/PATCH | `/api/notifications` | 通知中心：未读/挂起聚合 + 偏好 |
| GET/POST | `/api/integrations/github` | GitHub：`gh` 登录/状态、仓库、PR |

### 外部 agent 运行时管理（BFF 自有，M22）
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/agents` | 所有外部 agent 状态（installed/version/latest/status/autoUpdate） |
| GET | `/api/agents/catalog` | 可安装清单（vendor/安装方式/依赖） |
| POST | `/api/agents/:id/install` | 原生安装（`npm -g --prefix` 受管目录；`super_admin`） |
| POST | `/api/agents/:id/check-update` | 检查更新 |
| DELETE | `/api/agents/:id` | 卸载（`super_admin`） |
| GET/PUT | `/api/agents/update-policy` `/:id/update-policy` | 自动更新策略（`super_admin`） |

> 外部 agent（Claude Code / Codex / OpenCode / Pi / Grok / DSH）由 BFF 在主安装管理；会话导入走 Hermes `session.foreign.*`，注册走 `import-agent`。能力（技能/MCP/工具）只属 Hermes agent（profile）。

### 代理到 Hermes
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| * | `/api/hermes/*` | 转发到 Hermes `/api/*`（注入内部凭证 + profile 守卫）；含 `/api/hermes/plugins/<name>/*` |
| WS | `/api/hermes/ws` | 认证后代理到 Hermes L1 `/api/ws`（JSON-RPC） |
| WS | `/api/hermes/stream` | 代理 Hermes 事件/音频 WS（`/api/events` · `/api/plugins/kanban/events` · `/api/audio/speak-stream`） |

## 2. Hermes L1（WS JSON-RPC）

### 2.1 方法（237，按契约 topic 分组）

**sessions.py（32）** — 会话生命周期/分支/用量/事件/子代理树
```
session.create session.branch_stored session.resume session.activate session.list session.most_recent
session.active_list session.delete session.title session.set_hidden session.workspace.move session.cwd.set
session.close session.branch session.branch_whole session.undo session.save session.status session.history
session.usage session.context_breakdown session.compress session.interrupt session.steer session.redirect
spawn_tree.save spawn_tree.list spawn_tree.load terminal.resize session.events.since session.events.stats llm.oneshot
```

**tools_commands.py（18）** — 进程/命令/回滚/cron/browser
```
system.battery process.stop agents.list process.list process.kill shell.exec cli.exec
commands.catalog command.resolve command.dispatch slash.exec insights.get config.show
rollback.list rollback.restore rollback.diff cron.manage browser.manage
```

**tools_mcp_plugins.py（25）** — 工具/技能/MCP/插件
```
tools.list toolsets.list tools.show tools.configure reload.env reload.mcp
skills.manage skills.reload learning.frames learning.detail learning.delete learning.edit
mcp.catalog mcp.servers.list mcp.servers.status mcp.servers.add mcp.servers.set_api_key mcp.servers.test
mcp.servers.remove mcp.servers.oauth.start mcp.servers.oauth.poll mcp.servers.oauth.cancel
mcp.servers.oauth.callback plugins.list plugins.manage
```

**prompt_voice.py（25）** — 提示/附件/审批/语音/唤醒
```
prompt.submit clipboard.paste image.attach image.attach_bytes pdf.attach file.attach image.detach
input.detect_drop prompt.background prompt.btw preview.restart clarify.lock request.answer
approval.pending approval.received approval.respond voice.toggle voice.record voice.tts
wake.start wake.stop wake.pause wake.resume wake.status wake.feed
```

**profiles_vault_complete_foreign_subagents.py（27）** — 补全/档案/保险库/外来会话/子代理
```
complete.path complete.slash paste.collapse model.save_key model.disconnect
profiles.list profiles.create profiles.describe profiles.configure profiles.set_asset profiles.get_asset
profiles.remember_onboarding onboarding.ensure_setup_profile onboarding.reset_setup_profile
vault.list vault.sources vault.source.set vault.unlock vault.lock vault.add vault.remove
session.foreign.list session.foreign.preview session.foreign.import subagent.list subagent.interrupt subagent.tail
```

**projects_pets.py（26）** — 项目 + 宠物
```
projects.list projects.get projects.create projects.update projects.add_folder projects.remove_folder
projects.set_primary projects.archive projects.delete projects.set_active projects.for_cwd
projects.discover_repos projects.record_repos projects.tree projects.project_sessions
pet.info pet.info.meta pet.cells pet.gallery pet.select pet.remove pet.rename pet.export pet.thumb pet.disable pet.scale
```

**groups_bot_relay.py（26）** — 群聊/回传/浏览器控制器
```
groups.capabilities groups.list groups.create groups.state groups.send groups.rename groups.log
groups.disband groups.stop groups.approve groups.retry groups.replicate groups.replica_state
groups.promote groups.demote groups.peer.invite groups.peer.revoke groups.peer.register
bot_relay.roster.sync bot_relay.outbox.drain bot_relay.deliver bot_relay.reply
browser.controller.register browser.controller.result browser.controller.heartbeat browser.controller.detach
```

**billing_delegation_pets.py（23）** — 计费/订阅/委托/交接/宠物
```
usage.bars billing.state subscription.state subscription.preview subscription.change subscription.resume
subscription.upgrade billing.charge billing.charge_status billing.auto_reload billing.step_up
delegation.status delegation.pause subagent.steer handoff.request handoff.state handoff.fail
message.react pet.cancel pet.generate.status pet.generate pet.hatch project.facts
```

**config_free_tier_control.py（13）** — 配置/免费层/会话控制
```
config.get config.set setup.status setup.runtime_check diagnostics.share_nous
free_tier.status free_tier.provision free_tier.ack_notice model.options image.generate
session.control.read session.control verification.status
```

**connectors.py（8）+ connectors_operation.py（3）** — 连接器
```
connectors.list connectors.connect connectors.tools connectors.catalog connectors.accounts
connectors.accounts.remove connectors.policy.get connectors.policy.set
connectors.operation.status connectors.operation.wake connection.respond
```

**display.py（8）** — Bot Screen / 屏幕
```
display.status display.thumbnail display.start display.stop display.observe display.install
display.lease.acquire display.lease.release
```

**liveness.py（3）**
```
ping gateway.capabilities client.capabilities
```

### 2.2 服务端请求（13；客户端必须逐类同 `id` 回包）

```
approval clarify sudo secret vault.unlock_prompt vault.save_login vault.code
terminal.read preview.read window.read preview.act tour display.install.sudo
```

> **订正**：旧文档的 `mcp.setup` **不在此列**（MCP 安装走 `connectors.*` / `connection.request` / L2 `/api/mcp/*`）。

### 2.3 事件（74）

```
gateway.ready skin.changed setup.ready error notice message.start message.delta reasoning.delta
reasoning.available thinking.delta message.interim message.complete status.update session.usage
session.title reaction review.summary tool.start tool.complete tool.generating tool.output_risk
todo.updated notification.show notification.clear tip.show session.info session.resume_progress
session.reclaimed session.control.update billing.step_up.verification background.complete btw.complete
preview.restart.complete preview.restart.progress moa.reference moa.aggregating moa.progress moa.phase
preview.open preview.close layout.apply pane.reveal message.reaction agent.terminal.output terminal.close
browser.progress browser.controller.command browser.controller.cancel voice.interrupted voice.status
voice.transcript wake.detected pet.changed pet.generate.progress pet.hatch.progress cron.changed
sessions.changed projects.changed platforms.changed pairing.changed bot_relay.outbox.pending
display.status display.lease display.install.log display.install.done connection.request connection.update
request.cancel subagent.spawn_requested subagent.start subagent.progress subagent.thinking subagent.tool subagent.complete
```

> **订正**：旧文档事件 `done` / `thinking` **不存在** —— 完成 = `message.complete`；思考 = `thinking.delta` + `reasoning.delta` / `reasoning.available`。

## 3. Hermes L2（REST `/api/*`，280）

> 挂载于 `hermes_cli/web_server.py` / `web_server_dashboard.py`；无全局前缀，路径字面量。
> 另有插件路由 `/api/plugins/<name>/*`。

### gateway / 更新（actions.py）
```
POST /api/gateway/restart  GET /api/gateway/migrate/plan  POST /api/gateway/migrate  POST /api/gateway/drain
POST /api/hermes/update    GET /api/hermes/update/check  GET /api/actions/{name}/status  GET /api/hermes/update/receipt
```

### 配置 / env / 自定义 provider（config_env.py）
```
GET /api/config  GET /api/config/defaults  GET /api/config/schema  GET /api/egress/status  PUT /api/config
GET /api/env  PUT /api/env  DELETE /api/env  POST /api/env/reveal
GET /api/providers/custom-endpoints  POST /api/providers/custom-endpoints
POST /api/providers/custom-endpoints/{id}/activate  DELETE /api/providers/custom-endpoints/{id}
POST /api/providers/custom-endpoints/validate  POST /api/providers/validate
GET/PUT /api/config/raw（analytics.py）
GET /api/analytics/usage  GET /api/analytics/models（analytics.py）
```

### 模型 / OAuth（models.py + oauth.py）
```
GET /api/model/info  GET /api/model/options  GET /api/model/recommended-default  GET /api/model/auxiliary
GET/PUT /api/model/moa  POST /api/model/set
GET /api/providers/oauth  POST /api/providers/oauth/{id}/start  POST /api/providers/oauth/{id}/submit
GET /api/providers/oauth/{id}/poll/{session}  DELETE /api/providers/oauth/{id}  DELETE /api/providers/oauth/sessions/{session}
```

### 音频 / 语音（audio.py）
```
POST /api/audio/transcribe  POST /api/audio/speak  POST /api/audio/tts-lease  GET /api/audio/voice-config
GET /api/audio/voice-live/status  POST /api/audio/voice-live/session  GET /api/audio/elevenlabs/voices
WS  /api/audio/speak-stream
```

### 会话 / 搜索 / 管理（sessions.py）
```
GET /api/sessions  GET /api/sessions/search  GET /api/sessions/stats  GET /api/sessions/empty/count
DELETE /api/sessions/empty  POST /api/sessions/bulk-delete  POST /api/sessions/import  POST /api/sessions/prune
POST /api/sessions/owner-backfill
GET /api/sessions/{id}  PATCH /api/sessions/{id}  DELETE /api/sessions/{id}  GET /api/sessions/{id}/export
GET /api/sessions/{id}/messages  GET /api/sessions/{id}/timeline  GET /api/sessions/{id}/messages/around
GET /api/sessions/{id}/latest-descendant
GET /api/chat/workspaces（chat_workspaces.py）
```

### 档案 profile（profiles.py）
```
GET/POST /api/profiles  GET/POST /api/profiles/active  GET/PATCH/DELETE /api/profiles/{name}
GET/PUT /api/profiles/{name}/soul  PUT /api/profiles/{name}/description  PUT /api/profiles/{name}/model
POST /api/profiles/{name}/describe-auto  POST /api/profiles/{name}/export  POST /api/profiles/import
GET /api/profiles/{name}/setup-command  POST /api/profiles/{name}/open-terminal  GET /api/profiles/{name}/desktop-overlay
GET /api/profiles/sessions  GET /api/profiles/sessions/sidebar  GET /api/profiles/projects/tree
POST /api/profiles/sessions/pull-requests
```

### 项目 / 工作区
```
（L1 projects.* 为主入口；L2：）
GET /api/profiles/projects/tree   GET /api/fs/{list,read-text,read-data-url,download,git-root,default-cwd}  POST /api/fs/write-text
```

### 文件 / 媒体（files.py）
```
GET /api/media  POST /api/chat/image-upload
GET /api/files  GET /api/files/read  GET /api/files/download  GET/HEAD /api/files/stream
POST /api/files/upload  POST /api/files/upload-stream  POST /api/files/mkdir  DELETE /api/files
GET /api/fs/list  GET /api/fs/read-text  POST /api/fs/write-text  GET /api/fs/read-data-url
GET /api/fs/download  GET /api/fs/git-root  GET /api/fs/default-cwd
```

### Git review / ship / worktree（git.py）
```
GET /api/git/status  GET /api/git/gh-auth  GET /api/git/worktrees  GET /api/git/branches  GET /api/git/base-branches
GET /api/git/review/list  GET /api/git/review/diff  GET /api/git/file-diff  GET /api/git/review/commit-context
GET /api/git/review/rev-parse  GET /api/git/review/ship-info
POST /api/git/review/pr-list  POST /api/git/review/stage  POST /api/git/review/unstage  POST /api/git/review/revert
POST /api/git/review/commit  POST /api/git/review/push  POST /api/git/review/create-pr
POST /api/git/worktree/add  POST /api/git/worktree/remove  POST /api/git/branch/switch
```

### 技能 / Skills Hub（skills.py）
```
GET /api/skills  PUT /api/skills/toggle  GET /api/skills/content  POST /api/skills  PUT /api/skills/content
POST /api/skills/hub/install  POST /api/skills/hub/uninstall  POST /api/skills/hub/update
GET /api/skills/hub/official  GET /api/skills/hub/sources  GET /api/skills/hub/search  GET /api/skills/hub/preview  GET /api/skills/hub/scan
```

### MCP（mcp.py）
```
GET/POST /api/mcp/servers  PUT /api/mcp/servers  DELETE /api/mcp/servers/{name}  PUT /api/mcp/servers/{name}/enabled
POST /api/mcp/servers/{name}/test  POST /api/mcp/servers/{name}/auth
GET /api/mcp/oauth/flows/{id}  DELETE /api/mcp/oauth/flows/{id}  GET /api/mcp/oauth/callback/{name}
GET /api/mcp/catalog  POST /api/mcp/catalog/install
```

### 工具 / 工具集（tools.py）
```
GET /api/tools/toolsets  PUT /api/tools/toolsets/{name}  GET /api/tools/toolsets/{name}/config
GET /api/tools/toolsets/{name}/models  PUT /api/tools/toolsets/{name}/model  PUT /api/tools/toolsets/{name}/provider
PUT /api/tools/toolsets/{name}/env  POST /api/tools/toolsets/{name}/post-setup
GET /api/tools/terminal/backends  PUT /api/tools/terminal/backend
GET /api/tools/computer-use/status  POST /api/tools/computer-use/permissions/grant
```

### 定时任务（cron.py）
```
GET /api/cron/jobs  GET /api/cron/jobs/{id}  GET /api/cron/jobs/{id}/runs  POST /api/cron/jobs
PUT /api/cron/jobs/{id}  DELETE /api/cron/jobs/{id}  POST /api/cron/jobs/{id}/{pause,resume,trigger}
GET /api/cron/delivery-targets  POST /api/cron/fire  GET /api/cron/blueprints  POST /api/cron/blueprints/instantiate
```

### 消息平台 / 渠道（messaging.py）
```
GET /api/messaging/platforms  PUT /api/messaging/platforms/{id}  POST /api/messaging/platforms/{id}/test
POST /api/messaging/{telegram,whatsapp}/onboarding/start  GET /api/messaging/{telegram,whatsapp}/onboarding/{pairing}
POST /api/messaging/{telegram,whatsapp}/onboarding/{pairing}/apply  DELETE /api/messaging/{telegram,whatsapp}/onboarding/{pairing}
```

### 记忆（ops.py + memory_providers.py + memory_oauth.py）
```
GET /api/memory  PUT /api/memory/provider  POST /api/memory/reset
GET /api/memory/providers/{name}/config  PUT /api/memory/providers/{name}/config  POST /api/memory/providers/{name}/setup
POST /api/memory/providers/{provider}/oauth/start  GET /api/memory/providers/{provider}/oauth/status
```

### 本地模型（local_models.py）
```
GET /api/local-models/{status,hardware,catalog,jobs,search,search/files}   GET /api/local-models/jobs/{id}
POST /api/local-models/{runtime/install,download,download/pause,download/resume,quickstart,server,eject,activate,download-browsed,sideload}
DELETE /api/local-models/models/{id}
```

### 状态 / 健康 / 策展 / 学习 / 门户（status.py）
```
GET /api/ssh/ownership  GET /api/health  GET /api/health/idle  POST /api/health/retirement  GET /api/host/identity
GET /api/status  GET /api/system/stats  GET /api/curator  PUT /api/curator/paused  POST /api/curator/run
GET /api/learning/graph  GET/PUT/DELETE /api/learning/node  GET /api/portal  GET /api/logs
POST /api/ops/{prompt-size,dump,config-migrate,debug-share}
```

### 运维 / 配对 / Webhooks / 凭证 / 网关（ops.py）
```
GET /api/pairing  POST /api/pairing/approve  POST /api/pairing/revoke  POST /api/pairing/clear-pending
GET /api/webhooks  POST /api/webhooks  POST /api/webhooks/enable  DELETE /api/webhooks/{name}  PUT /api/webhooks/{name}/enabled
GET/POST /api/gateway/{start,stop}
GET /api/credentials/pool  POST /api/credentials/pool  DELETE /api/credentials/pool/{provider}/{index}
GET/POST/DELETE /api/ops/hooks  GET /api/ops/checkpoints  POST /api/ops/checkpoints/prune
POST /api/ops/{doctor,security-audit,backup,import,import-upload}  GET /api/ops/backup/download
```

### Dashboard UI（dashboard_ui.py）
```
GET /api/dashboard/themes  PUT /api/dashboard/theme  GET/PUT /api/dashboard/font
GET /api/dashboard/plugins  GET /api/dashboard/plugins/rescan  GET /api/dashboard/plugins/hub  GET /api/dashboard/plugins/catalog
POST /api/dashboard/agent-plugins/install  POST /api/dashboard/agent-plugins/{name}/enable|disable|update
DELETE /api/dashboard/agent-plugins/{name}  POST /api/dashboard/agent-plugins/activate
PUT /api/dashboard/plugin-providers  POST /api/dashboard/plugins/{name}/visibility
```

### 认证（dashboard_auth/routes.py）
```
GET /api/auth/providers  GET /api/auth/me  POST /api/auth/ws-ticket
（非 /api：/login /auth/login /auth/callback /auth/password-login /auth/logout /auth/native/*）
```

### WebSocket（非 REST）
```
WS /api/ws  WS /api/pub  WS /api/events  WS /api/console  WS /api/pty  WS /api/display/ws
```

### 插件（动态 `plugins/<name>/dashboard/plugin_api.py`）
```
kanban              47 端点：/api/plugins/kanban/{board,tasks,attachments,comments,links,bulk,runs,dispatch,orchestration,stats,boards,profiles,model-options,home-subscribe}… WS /api/plugins/kanban/events
hermes-achievements 6 端点：/api/plugins/hermes-achievements/{achievements,scan-status,recent-unlocks,sessions/{id}/badges,rescan,reset-state}
```

## 4. 功能模块（Hermes 侧，供 UI 映射）

- **Agent 核心**：会话循环、prompt 分层、context files/references、压缩+缓存、provider runtime、transports、MoA、auxiliary、goals/heartbeat/loops、checkpoints/rollback、LSP、review、verification。
- **会话/档案/项目**：`hermes_state_*`（SQLite+FTS5, CJK tokenizer）、profiles（租户岛屿）、projects、session export/search。
- **工具（70+）/工具集（~28）**：terminal/process、file、web、browser、computer-use、vision、image/video gen、TTS/STT、code execution、delegation、todo、memory、session_search、skills、MCP、connectors、cron、kanban、messaging-native、tool search、managed gateway、approval。
- **技能**：built-in（14 类）+ optional（22 类）+ Skills Hub + curator + bundles。
- **插件/provider**：plugin catalog（~290）、memory providers（7）、model providers（~40）、context engine、image/video/web/browser providers、platform adapters、dashboard auth、cron providers、observability。
- **渠道（25+）**：built-in + 插件平台（Telegram/Discord/Slack/WhatsApp/Signal/Matrix/…）、DM pairing、hosted rooms、bot relay、relay connector、media pipeline、wake、webhooks。
- **自动化/编排**：cron、kanban、hooks、delivery ledger。
- **前端/UX**：desktop、web dashboard、shared TS contract、pets、skins、personality/SOUL、achievements、notifications、i18n、deliverable。
- **安全/计费**：vault、secret sources、security/audit、egress、billing/usage/analytics。

## 5. 与产品现状差异（查漏补缺）

| 分类 | 项 | 结论 |
| --- | --- | --- |
| **错误** | 服务端请求 `mcp.setup` | 不存在（13 类里无）→ 移除 |
| **错误** | 事件 `done` / `thinking` | 应为 `message.complete` / `thinking.delta`+`reasoning.*` |
| **错误** | `skill_manage` 当 WS 方法 | 实为**工具**；WS 是 `skills.manage`/`skills.reload` |
| **概念** | 智能体 = SOUL 人设 | 应为**原生 agent 运行时**；profile 归「档案」 |
| **概念** | 技能界面 iframe 沙箱 | Hermes 技能 = SKILL.md；无 iframe 沙箱 |
| **概念** | 每个 agent 配 技能/MCP/工具 | 能力为 profile/session 级；外来 agent 自配 |
| **概念** | Connectors 塞进 Vault | 两者不同（托管账号 vs 密钥库） |
| **概念** | 用量 = analytics | 须含 billing/subscription/usage.bars |
| **配置** | `api_server` / `tool_search` / `deliverable` / `local_runtime` | 嵌套（gateway/tools）/feature 键/`local_runtime` |
| **已纳入** | Kanban | M20 |
| **已纳入** | 可视化编排 / spawn_tree | M21 |
| **已纳入** | 语音/唤醒/TTS/STT | M19 |
| **已纳入** | 会话全文搜索（FTS5） | C06 |
| **已纳入** | Git review/ship | C06（`/api/git/review/*`；worktree 端点保留未接 UI） |
| **已纳入** | Cron blueprints/delivery/runs | C06 |
| **明确排除** | 反向 MCP serve / ACP / batch | 非企业 web 端目标（C06） |
| **明确排除** | Pets / Skins / Achievements | 非目标（可排除） |
| **增强** | vault secret sources、memory providers OAuth、display/Bot Screen、egress/security-audit、profiles 全量、providers custom-endpoints | 部分/浅，按需增强 |
| **有意分离** | Hermes `/api/auth/*`（dashboard auth） | 我们用 BFF 自有认证，勿混用 |

## 6. 约定

- **契约以官方为准**，不猜字段；本清单随官方版本更新。
- **Hermes token 只在 BFF**；浏览器只持 BFF 会话 cookie。
- 任何触碰某个 profile 的请求，BFF 先做 `super_admin || userCanAccessProfile` 守卫。
- 服务端→客户端请求（见 §2.2 共 13 类）必须回包，否则 turn 卡住。
