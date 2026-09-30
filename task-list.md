# 任务看板（24H Web）

> 详细任务见 [`docs/TASKS.md`](./docs/TASKS.md)；本文件为**工作看板**，动态更新。
> 状态取值：`待开始` / `进行中` / `已验收`。M0–M16 全部任务均已实现并验收。

## M0 工程基线

| 编号 | 模块 | 描述 | 前置依赖 | 验收标准 | 状态 |
| --- | --- | --- | --- | --- | --- |
| T0.1 | M0 | 根脚本完善（dev 并行 / check 全 workspace） | — | `npm run check` 通过 | 已验收 |
| T0.2 | M0 | 错误结构约定 `{ error, message }` | — | 文档 + 类型 | 已验收 |
| T0.3 | M0 | 结构化日志（含 request-id） | T0.2 | 日志含 id | 已验收 |
| T0.4 | M0 | Lint / 格式化（可选，后置） | — | `npm run lint` | 已验收 |

## M1 BFF 基础 + 认证

| 编号 | 模块 | 描述 | 前置依赖 | 验收标准 | 状态 |
| --- | --- | --- | --- | --- | --- |
| T1.1 | M1 | sqlite 接入（better-sqlite3 + 连接模块） | — | 能建表 | 已验收 |
| T1.2 | M1 | 迁移机制（版本号 + 顺序 SQL） | T1.1 | 幂等升级 | 已验收 |
| T1.3 | M1 | cookie 支持（@fastify/cookie） | — | 能读写 cookie | 已验收 |
| T2.1 | M1 | 建表 users/user_profiles/sessions/login_attempts/audit | T1.2 | 表存在 | 已验收 |
| T2.2 | M1 | 口令哈希 argon2id（hash/verify） | T1.1 | 单测通过 | 已验收 |
| T2.3 | M1 | 首启引导：创建 super_admin + 须改密 | T2.1,T2.2 | 首次可登录 | 已验收 |
| T2.4 | M1 | 登录 `POST /api/auth/login` + 会话 cookie | T2.3 | 登录成功/失败 | 已验收 |
| T2.5 | M1 | 当前用户 `GET /api/auth/me` | T2.4 | 返回正确 | 已验收 |
| T2.6 | M1 | 登出 `POST /api/auth/logout` | T2.4 | cookie 清除 | 已验收 |
| T2.7 | M1 | 会话中间件 cookie→req.user | T2.4 | 受保护路由 401 | 已验收 |
| T2.8 | M1 | 角色守卫 `requireSuperAdmin` | T2.7 | admin 访问管理路由 403 | 已验收 |
| T2.9 | M1 | 改密 `POST /api/auth/change-password`（首登强制） | T2.7 | 改密后可继续 | 已验收 |
| T2.10 | M1 | 登录限流（`login_attempts` + 锁定） | T2.4 | 多次失败锁定 | 已验收 |
| T2.11 | M1 | CSRF 防护（同源 + token） | T1.3,T2.7 | 跨站写被拒 | 已验收 |
| T2.12 | M1 | 自助改用户名 `PATCH /api/auth/profile` | T2.7 | 可改 | 已验收 |
| T2.13 | M1 | 自助头像 `PUT /api/auth/avatar` | T2.7 | 可传 | 已验收 |

## M2 用户与角色管理（super_admin）

| 编号 | 模块 | 描述 | 前置依赖 | 验收标准 | 状态 |
| --- | --- | --- | --- | --- | --- |
| T3.1 | M2 | 用户列表 `GET /api/admin/users`（含 profiles） | T2.8 | 列表正确 | 已验收 |
| T3.2 | M2 | 建用户 `POST /api/admin/users` | T3.1 | 新用户可登录 | 已验收 |
| T3.3 | M2 | 改角色/状态 `PATCH /api/admin/users/:id` | T3.1 | 禁用后无法登录 | 已验收 |
| T3.4 | M2 | 删用户 `DELETE /api/admin/users/:id`（保护最后超管） | T3.1 | 拒绝删最后超管 | 已验收 |
| T3.5 | M2 | 分配 profile `PUT /api/admin/users/:id/profiles` | T3.1 | 边界生效 | 已验收 |
| T3.6 | M2 | 重置密码 `POST /api/admin/users/:id/password` | T3.1 | 重置须改密 | 已验收 |
| T3.7 | M2 | 审计 + `GET /api/admin/audit` | T2.8 | 记录可查 | 已验收 |

## M3 Hermes 代理

| 编号 | 模块 | 描述 | 前置依赖 | 验收标准 | 状态 |
| --- | --- | --- | --- | --- | --- |
| T4.1 | M3 | 内部凭证（BFF 获取访问 Hermes token） | — | 能调 `/api/status` | 已验收 |
| T4.2 | M3 | REST 代理 `/api/hermes/*` → Hermes `/api/*` | T4.1,T2.7 | 转发成功 | 已验收 |
| T4.3 | M3 | profile 守卫（目标 profile 校验权限） | T4.2,T3.5 | 越权 403 | 已验收 |
| T4.4 | M3 | WS 代理 `/api/hermes/ws`（先认证再代理；含 `method` 帧 default-deny profile 守卫 + 租户注入 + 响应过滤） | T4.1,T2.7 | 收发事件 | 已验收 |
| T4.5 | M3 | 代理错误归一 | T4.2 | 错误一致 | 已验收 |
| T4.6 | M3 | 上游健康探测 + 降级提示 | T4.1 | 断开可提示 | 已验收 |
| T4.7 | M3 | 连接管理（多 Hermes 实例 registry） | T4.1 | 可切换实例 | 已验收 |

## M4 前端骨架

| 编号 | 模块 | 描述 | 前置依赖 | 验收标准 | 状态 |
| --- | --- | --- | --- | --- | --- |
| T5.1 | M4 | 三栏 AppShell（侧栏/主区/详情，无顶栏） | — | 可切换 | 已验收 |
| T5.2 | M4 | API client（cookie + CSRF + `/api/hermes/ws`） | T0.2 | 请求成功 | 已验收 |
| T5.3 | M4 | 路由 + 登录守卫（按 role 隐藏管理） | T5.1,T2.5 | 守卫生效 | 已验收 |
| T5.4 | M4 | 登录页（用户名/密码） | T2.4,T5.2 | 可登录 | 已验收 |
| T5.5 | M4 | 全局 401/错误处理（跳登录 + toast） | T5.2 | 401 被处理 | 已验收 |
| T5.6 | M4 | 用户管理页（仅 super_admin 可见） | T3.1,T5.3 | admin 可见、普通不可见 | 已验收 |

## M5 对话（核心）

| 编号 | 模块 | 描述 | 前置依赖 | 验收标准 | 状态 |
| --- | --- | --- | --- | --- | --- |
| T6.1 | M5 | 会话列表（经 BFF 代理） | T4.2,T5.2 | 列表渲染 | 已验收 |
| T6.2 | M5 | 新建会话 `session.create` | T4.4 | 拿到 session_id | 已验收 |
| T6.3 | M5 | 流式消息（`prompt.submit` → delta/complete） | T6.2 | 流式显示 | 已验收 |
| T6.4 | M5 | 工具卡（`tool.start/generating/complete`） | T6.3 | 工具可见 | 已验收 |
| T6.5 | M5 | 审批/澄清（`approval`/`clarify` 回包） | T6.3 | 可点 | 已验收 |
| T6.6 | M5 | 其它服务端请求（`sudo`/`secret`/`mcp.setup`） | T6.5 | 不卡 turn | 已验收 |
| T6.7 | M5 | 中断 `session.interrupt` | T6.3 | 可停止 | 已验收 |
| T6.8 | M5 | 状态条（上下文/用量/速率） | T6.3 | 显示统计 | 已验收 |
| T6.9 | M5 | 会话管理（重命名/删除/恢复） | T6.1 | 操作生效 | 已验收 |
| T6.10 | M5 | 断线重放 `session.events.since` | T6.3 | 刷新可续 | 已验收 |
| T6.11 | M5 | 附件（图片/文件/PDF 上传） | T6.3 | 可发送 | 已验收 |
| T6.12 | M5 | 会话搜索（标题+内容，防抖） | T6.1 | 可搜索 | 已验收 |
| T6.13 | M5 | 会话导入/导出/分享 | T6.1 | 可导入导出 | 已验收 |
| T6.14 | M5 | 会话清理（prune / 批量删除） | T6.1 | 可清理 | 已验收 |
| T6.15 | M5 | 工作区/目录选择（`session.workspace.move`） | T6.2 | 可切换 cwd | 已验收 |

## M6 技能 / 工具 / 设置

| 编号 | 模块 | 描述 | 前置依赖 | 验收标准 | 状态 |
| --- | --- | --- | --- | --- | --- |
| T7.1 | M6 | 技能列表（按类别分组，落点：智能体页） | T4.2 | 分组渲染 | 已验收 |
| T7.2 | M6 | 技能启停 toggle | T7.1 | 状态持久 | 已验收 |
| T7.3 | M6 | 工具 / Toolsets（查看/启停/config） | T4.2 | 可管理 | 已验收 |
| T7.4 | M6 | MCP 管理（列表/增删/启停/目录） | T4.2 | 可管理 | 已验收 |
| T7.5 | M6 | 插件（`plugins.manage` 列表/启停） | T4.2 | 可管理 | 已验收 |
| T8.1 | M6 | Keys 管理（`/api/env`，不回显明文） | T4.2 | 可保存 | 已验收 |
| T8.2 | M6 | 模型设置（`/api/model/*`；设置=全局默认，对话页=本会话覆盖） | T4.2 | 可切换 | 已验收 |
| T8.3 | M6 | 外观（主题/语言） | — | 生效 | 已验收 |
| T8.4 | M6 | 配置中心（`/api/config`） | T4.2 | 可改 | 已验收 |
| T7.6 | M6 | 技能安装（hub 搜索/安装/更新） | T7.1 | 可安装 | 已验收 |
| T7.7 | M6 | 技能内容编辑（`/api/skills/content`） | T7.1 | 可编辑 | 已验收 |
| T8.5 | M6 | 审批策略 `approvals.mode` | T8.4 | 可切换 | 已验收 |
| T8.6 | M6 | 模型服务商 OAuth | T8.1 | 可登录 | 已验收 |
| T7.8 | M6 | 经验→Skill `/learn` | T7.1 | 可生成 skill | 已验收 |
| T8.7 | M6 | GitHub 集成（gh 登录/仓库/PR） | T4.1 | 可配置 | 已验收 |

## M7 任务 / 用量 / 面板

| 编号 | 模块 | 描述 | 前置依赖 | 验收标准 | 状态 |
| --- | --- | --- | --- | --- | --- |
| T9.1 | M7 | 任务列表（Cron jobs） | T4.2 | 列表 | 已验收 |
| T9.2 | M7 | 任务操作（新增/暂停/恢复/删除/立即运行） | T9.1 | 操作生效 | 已验收 |
| T10.1 | M7 | 用量概览（会话/消息统计） | T4.2 | 数字正确 | 已验收 |
| T10.2 | M7 | 模型分析（按模型 token/费用） | T10.1 | 图表/表格 | 已验收 |
| T11.1 | M7 | 文件面板（浏览/读取） | T4.2 | 可浏览 | 已验收 |
| T11.2 | M7 | 日志面板（读取/过滤） | T4.2 | 可筛选 | 已验收 |
| T11.3 | M7 | 预览面板（文件/HTML） | T11.1 | 可预览 | 已验收 |
| T11.4 | M7 | Git 面板（状态/差异） | T4.2 | 可查看 | 已验收 |
| T10.3 | M7 | 监控 `GET /api/system/stats` | T4.2 | 可查看 | 已验收 |

## M8 Agent / Profile 管理

| 编号 | 模块 | 描述 | 前置依赖 | 验收标准 | 状态 |
| --- | --- | --- | --- | --- | --- |
| T16.1 | M8 | Agent 列表/详情（`profiles.list` / `/api/profiles`） | T4.2 | 展示正确 | 已验收 |
| T16.2 | M8 | 创建/克隆 `profiles.create` | T16.1 | 可创建 | 已验收 |
| T16.3 | M8 | 编辑 SOUL/模型/skills（`profiles.configure`） | T16.1 | 可编辑 | 已验收 |
| T16.4 | M8 | 删除/导出导入 | T16.1 | 可操作 | 已验收 |
| T16.5 | M8 | 头像（`profiles.set_asset/get_asset`） | T16.1 | 可设头像 | 已验收 |

## M9 体验

| 编号 | 模块 | 描述 | 前置依赖 | 验收标准 | 状态 |
| --- | --- | --- | --- | --- | --- |
| T13.1 | M9 | 中文化（文案/i18n 收口） | — | 全中文 | 已验收 |
| T13.2 | M9 | 移动端响应式布局 | T5.1 | 小屏可用 | 已验收 |

## M10 协作与集成

| 编号 | 模块 | 描述 | 前置依赖 | 验收标准 | 状态 |
| --- | --- | --- | --- | --- | --- |
| T17.1 | M10 | 群聊 / Bot（`groups.*`、`bot_relay.*`） | T6.3 | 可群聊 | 已验收 |
| T17.2 | M10 | 消息平台 Channels（`/api/messaging/*`） | T4.2 | 可配置 | 已验收 |
| T17.3 | M10 | 记忆（`/api/memory*`） | T4.2 | 可切换 | 已验收 |
| T17.4 | M10 | Webhooks（`/api/webhooks*`） | T4.2 | 可管理 | 已验收 |
| T17.5 | M10 | 子代理观测（`subagent.*`、`delegation.*`） | T6.3 | 可见/可控 | 已验收 |

## M11 运维与高级

| 编号 | 模块 | 描述 | 前置依赖 | 验收标准 | 状态 |
| --- | --- | --- | --- | --- | --- |
| T18.1 | M11 | 本地模型（`/api/local-models/*`） | T4.2 | 可管理 | 已验收 |
| T18.2 | M11 | 配对与设备（`/api/pairing*`） | T4.2 | 可管理 | 已验收 |
| T18.3 | M11 | 门户信息 `GET /api/portal` | T4.2 | 可展示 | 已验收 |
| T18.4 | M11 | 运维 `/api/ops/*`（doctor/backup/import） | T2.8 | 可执行 | 已验收 |
| T18.5 | M11 | 浏览器控制 `browser.manage` | T4.4 | 可控 | 已验收 |
| T18.6 | M11 | 图片生成 `image.generate` | T4.4 | 可生成 | 已验收 |
| T18.7 | M11 | 语音 `voice.*` / `wake.*` | T4.4 | 可用 | 已验收 |
| T18.8 | M11 | 命令执行 `cli.exec` / `shell.exec` | T4.4 | 可执行 | 已验收 |
| T18.9 | M11 | 单次补全 `llm.oneshot` | T4.4 | 可用 | 已验收 |
| T18.10 | M11 | 项目事实/校验 `project.facts` | T4.4 | 可展示 | 已验收 |
| T18.11 | M11 | 交接 `handoff.state/fail` | T4.4 | 可用 | 已验收 |
| T18.12 | M11 | 外部会话导入 `session.foreign.*` | T4.4 | 可导入 | 已验收 |
| T18.13 | M11 | 密钥库/连接器 `vault.*` / `connectors.*` | T4.4 | 可管理 | 已验收 |
| T18.14 | M11 | 计费/套餐 `billing.state` / `subscription.*` | T4.4 | 可展示 | 已验收 |
| T18.15 | M11 | 学习/策展/学习旅程 | T4.2 | 可查看 | 已验收 |
| T18.16 | M11 | 系统升级（核心 + web） | T2.8 | 可升级 | 已验收 |

## M12 未来增强

| 编号 | 模块 | 描述 | 前置依赖 | 验收标准 | 状态 |
| --- | --- | --- | --- | --- | --- |
| T14.1 | M12 | AuthProvider 抽象 | T2.4 | 行为不变 | 已验收 |
| T14.2 | M12 | OIDC 接入（JIT 映射本地 user/角色） | T14.1 | 可 OIDC 登录 | 已验收 |
| T15.1 | M12 | Skill UI 宿主（iframe + postMessage RPC） | T6.3 | 能挂 UI | 已验收 |

## M13 项目（Projects）

| 编号 | 模块 | 描述 | 前置依赖 | 验收标准 | 状态 |
| --- | --- | --- | --- | --- | --- |
| T21.1 | M13 | 项目列表/切换（当前项目高亮） | T4.2 | 可切换 | 已验收 |
| T21.2 | M13 | 项目管理（新建/编辑/删除多文件夹） | T21.1 | 可管理 | 已验收 |

## M14 通知中心

| 编号 | 模块 | 描述 | 前置依赖 | 验收标准 | 状态 |
| --- | --- | --- | --- | --- | --- |
| T22.1 | M14 | 未读/挂起聚合（审批/完成/失败，点开直达） | T5.1 | 可查看 | 已验收 |
| T22.2 | M14 | 通知偏好（开关/免打扰/声音） | T22.1 | 可设置 | 已验收 |

## M15 会话命令（Slash）

| 编号 | 模块 | 描述 | 前置依赖 | 验收标准 | 状态 |
| --- | --- | --- | --- | --- | --- |
| T20.1 | M15 | Slash 命令菜单（`commands.catalog`+`complete.slash`） | T6.3 | 可选可执行 | 已验收 |
| T20.2 | M15 | 持久目标 `/goal` + `/subgoal` | T6.3 | 可设置 | 已验收 |
| T20.3 | M15 | 循环/心跳 `/loop` · `/heartbeat` | T6.3 | 可运行 | 已验收 |
| T20.4 | M15 | 计划 `/plan` + 计划视图 | T6.3 | 可查看 | 已验收 |
| T20.5 | M15 | 评审 `/review` | T17.5 | 可评审 | 已验收 |
| T20.6 | M15 | 会话分支 `/branch` `/fork` | T6.1 | 可分支 | 已验收 |
| T20.7 | M15 | 撤销/重试 `/undo` `/retry` | T6.3 | 可撤销 | 已验收 |
| T20.8 | M15 | 文件回滚 `/rollback` | T11.4 | 可回滚 | 已验收 |
| T20.9 | M15 | 状态快照 `/snapshot` | T2.8 | 可快照 | 已验收 |
| T20.10 | M15 | 后台/旁问 `/bg` · `/btw` | T6.3 | 可用 | 已验收 |
| T20.11 | M15 | 繁忙行为 `/queue` `/steer` `/busy` | T6.3 | 可配置 | 已验收 |
| T20.12 | M15 | 手动压缩 `/compress` | T6.3 | 可压缩 | 已验收 |
| T20.13 | M15 | 写入审批 `/skills` · `/memory` | T7.1,T17.3 | 可审批 | 已验收 |
| T20.14 | M15 | 技能包 `/bundles` | T7.1 | 可管理 | 已验收 |
| T20.15 | M15 | 自动化建议/蓝图 `/suggestions` · `/blueprint` | T9.1 | 可创建 | 已验收 |
| T20.16 | M15 | 重载 `/reload*` | T7.4 | 可重载 | 已验收 |
| T20.17 | M15 | 生成 AGENTS.md `/init` | T11.1 | 可生成 | 已验收 |
| T20.18 | M15 | 运行档 `/fast` · `/reasoning` | T8.2 | 可切换 | 已验收 |
| T20.19 | M15 | Egress 状态 `/egress` | T4.2 | 可查看 | 已验收 |
| T20.20 | M15 | Git worktree `/worktree` | T11.4 | 可管理 | 已验收 |

## M16 上下文 / 路由 / 集成扩展

| 编号 | 模块 | 描述 | 前置依赖 | 验收标准 | 状态 |
| --- | --- | --- | --- | --- | --- |
| T23.1 | M16 | 上下文文件（.hermes.md/AGENTS.md/SOUL.md…） | T5.1 | 可查看 | 已验收 |
| T23.2 | M16 | 上下文引用 `@`（文件/目录/git diff/URL） | T6.3 | 可注入 | 已验收 |
| T23.3 | M16 | Provider 路由 `provider_routing` | T8.2 | 可配置 | 已验收 |
| T23.4 | M16 | 回退 Provider `fallback` | T8.2 | 可配置 | 已验收 |
| T23.5 | M16 | 凭证池 `credential_pools` | T8.1 | 可配置 | 已验收 |
| T23.6 | M16 | API Server `api_server` | T8.4 | 可开关 | 已验收 |
| T23.7 | M16 | Event Hooks 管理 | T8.4 | 可管理 | 已验收 |
| T23.8 | M16 | 搜索/抽取配置（Web/X Search + Doc Extraction） | T7.3 | 可配置 | 已验收 |
| T23.9 | M16 | Tool Gateway（Nous Portal） | T8.4 | 可配置 | 已验收 |
| T23.10 | M16 | Tool Search `tool_search` | T7.3 | 可开关 | 已验收 |
| T23.11 | M16 | LSP 语言服务器配置 | T8.4 | 可配置 | 已验收 |
| T23.12 | M16 | Computer Use（状态 + 权限授予） | T7.3 | 可管理 | 已验收 |
| T23.13 | M16 | Deliverable Mode | T17.2 | 可开关 | 已验收 |
| T23.14 | M16 | Personality 预设 `/personality` | T16.3 | 可切换 | 已验收 |
| T23.15 | M16 | Plugin Catalog（发现/安装） | T7.5 | 可浏览安装 | 已验收 |
| T23.16 | M16 | Codex Runtime `/codex-runtime` | T8.2 | 可切换 | 已验收 |
| T23.17 | M16 | Subscription Proxy | T18.14 | 可配置 | 已验收 |
| T23.18 | M16 | Bot Screen（边缘，可后置） | T17.1 | 可查看 | 已验收 |

## M17 对话页重构（Spec 003-composer-redesign）

> Spec：[`.psd/specs/003-composer-redesign/v1.0.0-20260929-173000/`](.psd/specs/003-composer-redesign/v1.0.0-20260929-173000/)（requirements / design / tasks / constitution / manifest；对抗性评审 5 轮后 **DEFEND**）。
> **唯一「下一步」入口**：按 Wave 顺序执行，前置未验收不得开启后继；安全项（REQ-008 / 015 / 017 / 018 / 021 / 022）同波次（Wave 1）；并含 REQ-020（多 profile 自访问）。共 **36 个任务**（TASK-001..028 + 029..036，含 006A/006B/006C）。验证命令固定 `npm run check`，e2e 单独 `npm run test:e2e`。

| 编号 | 模块 | 描述 | 前置依赖 | 验收标准 | 状态 |
| --- | --- | --- | --- | --- | --- |
| TASK-001 | M17 | Wave0 订正 4 份基线（AGENTS.md / requirement.md / ui-spec.md / architecture.md） | — | 关键词 grep（`hero`/`WS 租户守卫`/`两级模型`/`--ds-radius` 命中、`corner-shape` 零命中） | 已验收 |
| TASK-002 | M17 | Wave0 订正 docs/TASKS.md（T8.2/T4.4/T6.11）+ 更新 task-list.md（新增 M17） | TASK-001 | `rg "T8.2\|T4.4"` 语义一致、M17 段存在 | 已验收 |
| TASK-003 | M17 | Wave1 `proxy.ts` default-deny 帧分类（导出 `classifyFrame`）+ profile 守卫 + 注入 | TASK-001 | 单测 + 评审：4 条绕过路径拒绝 | 待开始 |
| TASK-004 | M17 | Wave1 `proxy.test.ts` **19 例**（4 绕过 + 误拦防护 + REQ-017 注入/403 + MethodSweep + REQ-018/018a 超限 + REQ-015 过滤/fail-closed/错误帧透传 + REQ-021 审计） | TASK-003 | vitest（server）全绿 | 待开始 |
| TASK-029 | M17 | Wave1 REQ-015 `profiles.list`/`describe` 响应白名单过滤 + 仅「成功但结构不符」fail-closed + **上游错误帧原样透传** | TASK-003 | vitest：过滤 + fail-closed + 上限清理 | 待开始 |
| TASK-030 | M17 | Wave1 REQ-017 **default-deny**：缺 `params.profile` 时**豁免判据唯一 = 参数类 schema 未声明 `profile` 字段**（从契约派生；**不得**用「是否直继 `Params`」）→ 不注入；**其余一切方法（含未知方法）**注入 `default_profile`。**豁免清单 26 条（MethodSweep 机械核验 2026-09-30）**：`ping`/`gateway.capabilities`/`client.capabilities`/`complete.slash`/`reload.env`/`reload.mcp`/`plugins.list`/`skills.reload`/`learning.frames`/`learning.detail`/`learning.delete`/`learning.edit`/`paste.collapse`/`model.save_key`/`model.disconnect`/`diagnostics.share_nous`/`image.generate`/`onboarding.ensure_setup_profile`/`onboarding.reset_setup_profile`/`tools.list`/`toolsets.list`/`tools.show`/`browser.controller.register`/`browser.controller.heartbeat`/`browser.controller.detach`/`browser.controller.result`；**须注入**含 `commands.catalog`/`config.show`/`cron.manage`/`complete.path`/`llm.oneshot` | TASK-003 | vitest：26 条豁免不注入 / 须注入方法被注入 / 未知方法被注入 / 无分配 403 / super_admin 不注入 / **MethodSweep 机械断言「豁免集合 == 无 `profile` 字段集合」** | 待开始 |
| TASK-031 | M17 | Wave1 REQ-018 / **REQ-018a** WS `maxPayload`（**双 socket**）+ `pending`/`outbound` 队列上限（**条数 AND 累计字节**，`pendingBytes ≤ K × maxPayload`） | TASK-003 | vitest：条数超限、字节超限、仅该连接关闭 | 待开始 |
| TASK-034 | M17 | Wave1 **REQ-021 审计接入**：守卫拒绝（WS 403 / REST 403）与响应过滤 fail-closed 写 `audit`（actor/profile/method/ip/结果/ts，不含 token/密钥/字节） | TASK-003,TASK-029 | vitest：各类事件各恰 1 条且零 token/字节泄漏 | 待开始 |
| TASK-035 | M17 | Wave1 **REQ-022 REST 守卫**：`routes/hermes.ts` 去掉「缺 `profile` 即提前 `return`」；非 `super_admin` 除豁免路径 `/api/hermes/health` 外缺 `profile` → 注入 `default_profile`（落入**被转发的 query**）或 403 | TASK-001 | vitest：注入 / 403 / health 豁免 / super_admin 不拦 + 断言上游实际收到 `profile` | 待开始 |
| TASK-036 | M17 | **R24 已闭合（session 归属校验）**：`tools.list`/`toolsets.list`/`tools.show` 无 `profile` 字段可注入，缺 `session_id` 回退**启动 profile** 配置 → 跨租户。fail-closed：非 `super_admin` 缺 `session_id` 拒绝（`SESSION_SCOPED_NO_PROFILE_METHODS`，判定早于豁免清单）；BFF WS 代理维护 per-connection `sessionOwners`（建/附会话回包累积，上限 512 / TTL 10 min），带 `session_id` 须归属命中且属调用者白名单，未知/他人 403 不转发 | TASK-030,TASK-033 | vitest：无 `session_id` 被拒、归属命中通过、未知/他人被拒 | 已验收 |
| TASK-005 | M17 | Wave1 `chat/composer/pendingAttachments.ts` 纯函数（预筛/kindOf/dedupe/readAsBase64） | — | vitest + 边界遍历 + 断言未读超限内容 | 待开始 |
| TASK-006A | M17 | Wave1 `composer/controlsReducer.ts` 纯 reducer（selection/attachments/single-flight） | — | vitest：状态转移 + 回滚无残留 | 待开始 |
| TASK-006B | M17 | Wave1 `composer/useOptions.ts` options 生命周期 + 会话键缓存迁移 | — | vitest：缓存迁移（≤1 次）+ 参数含 `profile` | 待开始 |
| TASK-006C | M17 | Wave1 `composer/useSessionControls.ts` RPC + 模型状态机 + `reconcileModel` + single-flight | TASK-006A | vitest：三态 + 回正 + single-flight + hero 不被拦截 | 待开始 |
| TASK-007 | M17 | Wave1 `composer/modelCatalog.ts` + `agentOptions.ts` 归一化（绝不回退 `profiles.list`） | — | vitest 新文件 | 待开始 |
| TASK-008 | M17 | Wave1 `test/fakeGateway.ts` 扩展 + `api/ws.ts` 读 `error.data.code` | — | 既有测试全绿 + `ws.test.ts` 新断言 | 待开始 |
| TASK-028 | M17 | Wave1 `composer/MenuButton.tsx` APG 原语 + 修 `SessionList` 两处菜单 | — | vitest a11y + `SessionList` 回归 | 待开始 |
| TASK-032 | M17 | Wave1 REQ-015 过滤行为测试 | TASK-029 | vitest（server） | 待开始 |
| TASK-033 | M17 | Wave1 归档 `contracts-evidence.md` | — | 文件存在且与官方源码逐条对应 | 待开始 |
| TASK-009 | M17 | Wave2 `composer/ComposerControls.tsx`（hero pill 行 + 底行；无 voice/git） | TASK-006A,TASK-028 | 结构断言（DOM 集合精确匹配） | 待开始 |
| TASK-010 | M17 | Wave2 `composer/ModelPicker.tsx`（本会话覆盖 + Flash 徽标 + deferred/confirm） | TASK-006C,TASK-007,TASK-028 | 组件测试（三态） | 待开始 |
| TASK-011 | M17 | Wave2 `composer/AgentPicker.tsx`（选项恒 = `me.profiles`；docked 只读） | TASK-007 | 组件测试（不含 `profiles.list` 值） | 待开始 |
| TASK-012 | M17 | Wave2 `composer/WorkspacePicker.tsx` + `PermissionPicker.tsx` | TASK-006A,TASK-006B,TASK-007 | 组件测试（回滚断言） | 待开始 |
| TASK-013 | M17 | Wave2 `composer/UploadMenu.tsx` + 拖拽/粘贴（浏览器 API；禁 `clipboard.paste`） | TASK-005,TASK-028 | 组件测试（drop/paste；0 RPC） | 待开始 |
| TASK-014 | M17 | Wave2 `chat/SessionHeaderMenu.tsx`（连接/导入/导出/分享/重命名） | TASK-028 | 组件测试（恰 5 项） | 待开始 |
| TASK-015 | M17 | Wave2 改 `Composer.tsx` 双态单实例（`variant`/`data-variant`） | TASK-005,TASK-009,TASK-013 | 组件测试 + `Composer.test.tsx` 回归 | 待开始 |
| TASK-016 | M17 | Wave3 `ChatPage.tsx` 双态渲染 + 新建 `chat/HeroIntro.tsx` | TASK-015 | 集成测试（hero/docked 互斥） | 待开始 |
| TASK-017 | M17 | Wave3 发送编排延迟绑定（create → attach* → submit）+ single-flight + **REQ-020** 会话域 RPC（list/most_recent/resume/events.since）显式携带 `selection.profile` | TASK-008,TASK-015,TASK-030 | 集成测试（调用序 + single-flight + profile 携带） | 待开始 |
| TASK-018 | M17 | Wave3 模型提交路径接线（hero/会话内/deferred/confirm/`message.complete` 回正） | TASK-006C,TASK-010,TASK-017 | 集成测试（三态 + 回正） | 待开始 |
| TASK-019 | M17 | Wave3 权限模式接线（`config.set{key:"yolo",scope:"session"}` + 回滚） | TASK-006A,TASK-012,TASK-017 | 集成测试 | 待开始 |
| TASK-020 | M17 | Wave3 会话头菜单接入 + 身份键正确性（`workspace.move`=stored） | TASK-014,TASK-017 | 集成测试（身份键断言） | 待开始 |
| TASK-021 | M17 | Wave3 `styles.css` hero/docked/pill/chip/menu（仅 `--ds-*`，圆角 `--ds-radius-*`） | TASK-015 | token grep + 视觉自查 | 待开始 |
| TASK-022 | M17 | Wave4 组件 a11y / 键盘测试（APG、`Esc` 焦点归还、`role`） | TASK-009..015,TASK-028 | vitest | 待开始 |
| TASK-023 | M17 | Wave4 ChatPage 集成（顺序/single-flight/10MB/回正/confirm） | TASK-016..021 | vitest | 待开始 |
| TASK-024 | M17 | Wave4 StrictMode 幂等 + 4001 有界重试回归 + hero 发送不禁用 | TASK-016,TASK-017 | vitest | 待开始 |
| TASK-025 | M17 | Wave4 BFF 守卫端到端（帧分类视角，4 绕过 + 放行 + REQ-017 注入 + REQ-018/018a 超限 + **REQ-021 审计**） | TASK-003,TASK-004 | vitest（server） | 待开始 |
| TASK-026 | M17 | Wave4 （可选，单独跑）e2e：hero 上传（点击 + 拖拽）→ 发送 → docked | TASK-023 | `npm run test:e2e` | 待开始 |
| TASK-027 | M17 | Wave5 `npm run check` 全绿 + 基线一致性复核（防漂移，含 REQ-010a/011a/018a/018b/020/021/022） | TASK-001..026, TASK-028..036 | `npm run check` + 人工比对清单 | 待开始 |

## 后续任务（待开发）

| 编号 | 模块 | 描述 | 前置依赖 | 验收标准 | 状态 |
| --- | --- | --- | --- | --- | --- |
| N01 | e2e | 真实 Hermes 浏览器级 e2e（Playwright + 真机，隔离 HERMES_HOME；登录→对话→群聊一轮） | — | 在 CI 或本地可一键复现，失败可见 | 待开发 |
| N02 | 认证 | OIDC 真实 IdP 联调（Keycloak/Authentik；授权码+PKCE、JIT 映射、角色不越权） | T14.2 | 真实 IdP 登录成功且角色=admin | 待开发 |
| N03 | 技能 | Skill UI 真实 skill 联调（`/api/skill-uis` → 沙箱 iframe → broker `callModel` 全链路） | T15.1 | 真实 demo skill 走通 | 待开发 |
| N04 | 体验 | i18n 英文（`en` 字典 + 语言切换；保留中文默认） | T13.1 | 可切英文且无漏字 | 待开发 |
| N05 | 体验 | 主题自定义（强调色/密度以外观设置持久化） | T8.3 | 可改强调色并持久化 | 待开发 |
| N06 | 对话 | 会话多标签/并行（多会话同时打开） | T6.1 | 可并行并各自流式 | 待开发 |
| N07 | 体验 | 移动端 PWA（可安装 + 离线壳） | T13.2 | 可安装、断网可打开壳 | 待开发 |
| N08 | 体验 | a11y 全站审查（键盘可达、焦点环、对比度、landmark） | — | 关键路径键盘全可达 | 待开发 |
| N09 | 工程 | OpenAPI/接口文档生成（BFF 路由导出） | — | 产出一份 API 文档 | 待开发 |
| N10 | 工程 | 生产容器化（Dockerfile + compose：BFF + 反代） | — | `docker compose up` 起服务 | 待开发 |
| N11 | 运维 | 备份/恢复 UI（ops 面板增强：选择/下载/恢复） | T18.4 | 可备份并恢复 | 待开发 |
| N12 | 运维 | 监控指标端点 `/metrics` + 告警钩子 | T10.3 | 可抓取指标 | 待开发 |
| N13 | e2e | e2e 覆盖设置/管理 CRUD 路径（建用户/改角色/分配 profile/重置密码） | T5.6 | 相关用例通过 | 待开发 |
| N14 | 群聊 | 群聊房间成员编辑（等官方 add/remove member RPC；现为创建时固定 2–6 人） | T17.1 | 官方支持后可增删成员 | 待开发 |
| N15 | 对话 | 会话身份对（stored/runtime id）+ 历史会话 resume（修复 prompt.submit 4001） | T6.3 | 点选历史会话可发送并收到回复；重命名/移动工作区正常 | 已验收 |
| N16 | 对话 | 打断（停止）回合收尾：悬挂工具卡结算 + 「已中断」呈现 | N15 | 长工具打断后无悬挂 spinner、状态显示「已中断」、保留部分文本 | 进行中 |
| N17 | 安全/性能 | WS 队列上限解耦（`WS_MAX_PENDING_COUNT = 256` 独立于字节系数 `K = 4`，修「第 5 帧被拒」回归）＋ 大帧性能修复（`readBase64Prefix` 有界切片、`classifyParsed` 复用单次 `JSON.parse`、`recordClientRequest` 合并解析） | TASK-031 | `npm run check` 全绿；条数/字节上限分别实测触发；`frameGuard` JSON.parse 计数=1；见 `contracts-evidence.md §8.9` | 已验收 |

## 明确不做

- Kanban（任务看板）
- 可视化编排画布（Ekko 式）

> 以上依产品决策不做。
