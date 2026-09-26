# 任务拆解（最小可实现）

> 目标：一个任务 = 一次最小提交。依赖列 = 前置 ID。接口列 = BFF / L1(网关 WS) / L2(REST)。
> 契约以官方为准（`gateway-contract.generated.ts` / `web_routers/*.py`）。
> **全部功能均建任务**（无范围外项）。里程碑：M0 基线 · M1 BFF+认证 · M2 用户管理 · M3 代理 · M4 前端骨架 · M5 对话 · M6 技能/工具/设置 · M7 任务/用量/面板 · M8 Agent/Profile · M9 体验 · M10 协作与集成 · M11 运维与高级 · M12 未来增强。

## M0 工程基线

| ID | 任务 | 说明 | 依赖 | 接口 | 验收 |
| --- | --- | --- | --- | --- | --- |
| T0.1 | 根脚本完善 | `dev` 并行 web+server；`check` 跑全 workspace | — | — | `npm run check` 通过 |
| T0.2 | 错误结构约定 | BFF 统一 `{ error, message }` | — | — | 文档 + 类型 |
| T0.3 | 结构化日志 | BFF 请求日志（含 request-id） | T0.2 | — | 日志含 id |
| T0.4 | Lint/格式化 | ESLint + Prettier（可选，后置） | — | — | `npm run lint` |

## M1 BFF 基础 + 认证

| ID | 任务 | 说明 | 依赖 | 接口 | 验收 |
| --- | --- | --- | --- | --- | --- |
| T1.1 | sqlite 接入 | better-sqlite3 + 连接模块 | — | — | 能建表 |
| T1.2 | 迁移机制 | 版本号 + 顺序 SQL | T1.1 | — | 幂等升级 |
| T1.3 | cookie 支持 | @fastify/cookie | — | — | 能读写 cookie |
| T2.1 | 建表 | users / user_profiles / sessions / login_attempts / audit | T1.2 | — | 表存在 |
| T2.2 | 口令哈希 | argon2id 封装（hash/verify） | T1.1 | — | 单测通过 |
| T2.3 | 首启引导 | 无用户时创建 super_admin（一次性 token/CLI），标记须改密 | T2.1,T2.2 | BFF | 首次可登录 |
| T2.4 | 登录 | `POST /api/auth/login` 校验 + 建会话 cookie | T2.3 | BFF | 登录成功/失败 |
| T2.5 | 当前用户 | `GET /api/auth/me`（id/username/role/profiles） | T2.4 | BFF | 返回正确 |
| T2.6 | 登出 | `POST /api/auth/logout` | T2.4 | BFF | cookie 清除 |
| T2.7 | 会话中间件 | cookie→req.user；无会话 401 | T2.4 | BFF | 受保护路由 401 |
| T2.8 | 角色守卫 | `requireSuperAdmin` | T2.7 | BFF | admin 访问管理路由 403 |
| T2.9 | 改密 | `POST /api/auth/change-password`（首登强制） | T2.7 | BFF | 改密后可继续 |
| T2.10 | 登录限流 | `login_attempts` 计数 + 锁定 | T2.4 | BFF | 多次失败锁定 |
| T2.11 | CSRF 防护 | 同源 + CSRF token（cookie 会话必需） | T1.3,T2.7 | BFF | 跨站写被拒 |
| T2.12 | 自助改用户名 | `PATCH /api/auth/profile`（改 username/显示名） | T2.7 | BFF | 可改 |
| T2.13 | 自助头像 | `PUT /api/auth/avatar` | T2.7 | BFF | 可传 |

## M2 用户与角色管理（super_admin）

| ID | 任务 | 说明 | 依赖 | 接口 | 验收 |
| --- | --- | --- | --- | --- | --- |
| T3.1 | 用户列表 | `GET /api/admin/users`（含 profiles） | T2.8 | BFF | 列表正确 |
| T3.2 | 建用户 | `POST /api/admin/users` | T3.1 | BFF | 新用户可登录 |
| T3.3 | 改角色/状态 | `PATCH /api/admin/users/:id` | T3.1 | BFF | 禁用后无法登录 |
| T3.4 | 删用户 | `DELETE /api/admin/users/:id`（保护最后一个超管） | T3.1 | BFF | 拒绝删最后超管 |
| T3.5 | 分配 profile | `PUT /api/admin/users/:id/profiles` | T3.1 | BFF | 边界生效 |
| T3.6 | 重置密码 | `POST /api/admin/users/:id/password` | T3.1 | BFF | 重置须改密 |
| T3.7 | 审计 | 写 audit + `GET /api/admin/audit` | T2.8 | BFF | 记录可查 |

## M3 Hermes 代理

| ID | 任务 | 说明 | 依赖 | 接口 | 验收 |
| --- | --- | --- | --- | --- | --- |
| T4.1 | 内部凭证 | BFF 获取/配置访问 Hermes 的 token（loopback） | — | — | 能调 `/api/status` |
| T4.2 | REST 代理 | `/api/hermes/*` → Hermes `/api/*`（注入 token） | T4.1,T2.7 | BFF→L2 | 转发成功 |
| T4.3 | profile 守卫 | 解析请求的目标 profile 并校验权限 | T4.2,T3.5 | BFF | 越权 403 |
| T4.4 | WS 代理 | `/api/ws`：先认证再代理到 Hermes | T4.1,T2.7 | BFF→L1 | 收发事件 |
| T4.5 | 代理错误归一 | 上游错误 → 统一结构 | T4.2 | BFF | 错误一致 |
| T4.6 | 上游健康探测 | BFF→Hermes `/api/status` 探活 + 降级提示 | T4.1 | BFF→L2 | 断开可提示 |
| T4.7 | 连接管理 | 多个 Hermes 实例的增删/选择/探活（registry） | T4.1 | BFF | 可切换实例 |

## M4 前端骨架

| ID | 任务 | 说明 | 依赖 | 接口 | 验收 |
| --- | --- | --- | --- | --- | --- |
| T5.1 | 三栏 AppShell | 侧栏(对话/智能体/群聊/任务/用量 + 底部 设置/管理) + 主区 + 详情面板；无顶栏 | — | — | 可切换 |
| T5.2 | API client | `src/api` 指向 BFF，带 cookie + CSRF；`/api/hermes/ws` | T0.2 | BFF | 请求成功 |
| T5.3 | 路由 + 登录守卫 | 未登录跳登录页；按 role 隐藏管理入口 | T5.1,T2.5 | BFF | 守卫生效 |
| T5.4 | 登录页 | 自己的登录页（用户名/密码） | T2.4,T5.2 | BFF | 可登录 |
| T5.5 | 全局 401/错误处理 | 401→登录页；错误 toast | T5.2 | BFF | 401 被处理 |
| T5.6 | 用户管理页 | 列表/建/改/禁用/分配 profile（仅 super_admin 可见） | T3.1,T5.3 | BFF | admin 可见、普通不可见 |

## M5 对话（核心）

| ID | 任务 | 说明 | 依赖 | 接口 | 验收 |
| --- | --- | --- | --- | --- | --- |
| T6.1 | 会话列表 | 拉取会话（经 BFF 代理） | T4.2,T5.2 | L2 | 列表渲染 |
| T6.2 | 新建会话 | `session.create` | T4.4 | L1 | 拿到 session_id |
| T6.3 | 流式消息 | `prompt.submit` → `message.delta/complete` → transcript | T6.2 | L1 | 流式显示 |
| T6.4 | 工具卡 | `tool.start/generating/complete` 渲染 | T6.3 | L1 | 工具可见 |
| T6.5 | 审批/澄清 | server request `approval`/`clarify` 回包 | T6.3 | L1 | 可点 |
| T6.6 | 其它服务端请求 | `sudo`/`secret`/`mcp.setup` 回包 | T6.5 | L1 | 不卡 turn |
| T6.7 | 中断 | `session.interrupt` | T6.3 | L1 | 可停止 |
| T6.8 | 状态条 | 上下文/用量/速率（`thinking`/`done`/`error`） | T6.3 | L1 | 显示统计 |
| T6.9 | 会话管理 | 重命名/删除/恢复（`session.title/delete/resume`） | T6.1 | L1 | 操作生效 |
| T6.10 | 断线重放 | `session.events.since` 重建挂起状态 | T6.3 | L1 | 刷新可续 |
| T6.11 | 附件 | 图片/文件/PDF 上传（`image/pdf/file.attach`） | T6.3 | L1 | 可发送 |
| T6.12 | 会话搜索 | 全文搜索（标题+内容，防抖） | T6.1 | L2 | 可搜索 |
| T6.13 | 会话导入/导出/分享 | import / export（+分享链接） | T6.1 | L2 | 可导入导出 |
| T6.14 | 会话清理 | prune / 批量删除 | T6.1 | L2 | 可清理 |
| T6.15 | 工作区/目录选择 | `session.workspace.move` / `/api/chat/workspaces` | T6.2 | L1/L2 | 可切换 cwd |

## M6 技能 / 工具 / 设置

| ID | 任务 | 说明 | 依赖 | 接口 | 验收 |
| --- | --- | --- | --- | --- | --- |
| T7.1 | 技能列表 | 按类别分组（落点：智能体页） | T4.2 | L2 | 分组渲染 |
| T7.2 | 技能启停 | toggle（落点：智能体页） | T7.1 | L2 | 状态持久 |
| T7.3 | 工具 / Toolsets | `/api/tools/toolsets`（查看/启停/config）（落点：智能体页） | T4.2 | L2 | 可管理 |
| T7.4 | MCP 管理 | `/api/mcp/*`（列表/增删/启停/目录）（落点：智能体页） | T4.2 | L2 | 可管理 |
| T7.5 | 插件 | `plugins.manage`（列表/启停）（落点：设置） | T4.2 | L1/L2 | 可管理 |
| T8.1 | Keys 管理 | `/api/env` 读写（不回显明文）（落点：设置） | T4.2 | L2 | 可保存 |
| T8.2 | 模型设置 | `/api/model/*`（info/options/set/moa）（落点：设置） | T4.2 | L2 | 可切换 |
| T8.3 | 外观 | 主题/语言（落点：设置） | — | — | 生效 |
| T8.4 | 配置中心 | `/api/config`（config.yaml 常用项）（落点：设置） | T4.2 | L2 | 可改 |
| T7.6 | 技能安装（hub） | `POST /api/skills` + hub 搜索/安装/更新（落点：智能体页） | T7.1 | L2 | 可安装 |
| T7.7 | 技能内容编辑 | `GET/PUT /api/skills/content`（落点：智能体页） | T7.1 | L2 | 可编辑 |
| T8.5 | 审批策略 | `approvals.mode`（smart/manual/off）（落点：设置） | T8.4 | L2 | 可切换 |
| T8.6 | 模型服务商 OAuth | `/api/providers/oauth/*` 登录/登出（落点：设置） | T8.1 | L2 | 可登录 |

## M7 任务 / 用量 / 面板

| ID | 任务 | 说明 | 依赖 | 接口 | 验收 |
| --- | --- | --- | --- | --- | --- |
| T9.1 | 任务列表 | Cron jobs | T4.2 | L2 | 列表 |
| T9.2 | 任务操作 | 新增/暂停/恢复/删除/立即运行 | T9.1 | L2 | 操作生效 |
| T10.1 | 用量概览 | 会话/消息统计 | T4.2 | L2 | 数字正确 |
| T10.2 | 模型分析 | 按模型 token/费用 | T10.1 | L2 | 图表/表格 |
| T11.1 | 文件面板 | 浏览/读取 | T4.2 | L2 | 可浏览 |
| T11.2 | 日志面板 | 读取/过滤 | T4.2 | L2 | 可筛选 |
| T11.3 | 预览面板 | 文件/HTML 预览 | T11.1 | — | 可预览 |
| T11.4 | Git 面板 | `/api/git/*`（状态/差异） | T4.2 | L2 | 可查看 |
| T10.3 | 监控 | `GET /api/system/stats`（CPU/内存/磁盘/进程）（落点：设置→监控） | T4.2 | L2 | 可查看 |

## M8 Agent / Profile 管理

| ID | 任务 | 说明 | 依赖 | 接口 | 验收 |
| --- | --- | --- | --- | --- | --- |
| T16.1 | Agent 列表/详情 | `profiles.list` / `/api/profiles` | T4.2 | L1/L2 | 展示正确 |
| T16.2 | 创建/克隆 | `profiles.create` | T16.1 | L1 | 可创建 |
| T16.3 | 编辑 | SOUL/模型/skills（`profiles.configure`） | T16.1 | L1 | 可编辑 |
| T16.4 | 删除/导出导入 | `PATCH|DELETE /api/profiles/:name`、import/export | T16.1 | L2 | 可操作 |
| T16.5 | 头像 | `profiles.set_asset/get_asset` | T16.1 | L1 | 可设头像 |

## M9 体验

| ID | 任务 | 说明 | 依赖 | 接口 | 验收 |
| --- | --- | --- | --- | --- | --- |
| T13.1 | 中文化 | 文案/i18n 收口 | — | — | 全中文 |
| T13.2 | 移动端 | 响应式布局 | T5.1 | — | 小屏可用 |

## M10 协作与集成

| ID | 任务 | 说明 | 依赖 | 接口 | 验收 |
| --- | --- | --- | --- | --- | --- |
| T17.1 | 群聊 / Bot | `groups.*`、`bot_relay.*`（房间/成员/DM） | T6.3 | L1 | 可群聊 |
| T17.2 | 消息平台 Channels | `/api/messaging/*`（平台列表/配置/onboarding） | T4.2 | L2 | 可配置 |
| T17.3 | 记忆 | `/api/memory*`（provider/重置） | T4.2 | L2 | 可切换 |
| T17.4 | Webhooks | `/api/webhooks*` | T4.2 | L2 | 可管理 |
| T17.5 | 子代理观测 | `subagent.list/tail/interrupt/steer`、`delegation.*` | T6.3 | L1 | 可见/可控 |

## M11 运维与高级

| ID | 任务 | 说明 | 依赖 | 接口 | 验收 |
| --- | --- | --- | --- | --- | --- |
| T18.1 | 本地模型 | `/api/local-models/*`（状态/目录/下载/启动） | T4.2 | L2 | 可管理 |
| T18.2 | 配对与设备 | `/api/pairing*`、`/api/ssh/ownership` | T4.2 | L2 | 可管理 |
| T18.3 | 门户信息 | `GET /api/portal`（Plan/用量入口） | T4.2 | L2 | 可展示 |
| T18.4 | 运维 | `/api/ops/*`（doctor/backup/import/config-migrate） | T2.8 | L2 | 可执行 |
| T18.5 | 浏览器控制 | L1 `browser.manage` | T4.4 | L1 | 可控 |
| T18.6 | 图片生成 | L1 `image.generate` | T4.4 | L1 | 可生成 |
| T18.7 | 语音 | L1 `voice.*`、`wake.*`、`voice.tts` | T4.4 | L1 | 可用 |
| T18.8 | 命令执行 | L1 `cli.exec` / `shell.exec` | T4.4 | L1 | 可执行 |
| T18.9 | 单次补全 | L1 `llm.oneshot` | T4.4 | L1 | 可用 |
| T18.10 | 项目事实/校验 | L1 `project.facts`、`verification.status` | T4.4 | L1 | 可展示 |
| T18.11 | 交接 | L1 `handoff.state/fail` | T4.4 | L1 | 可用 |
| T18.12 | 外部会话导入 | L1 `session.foreign.*` | T4.4 | L1 | 可导入 |
| T18.13 | 密钥库/连接器 | L1 `vault.*`、`connectors.*` | T4.4 | L1 | 可管理 |
| T18.14 | 计费/套餐 | L1 `billing.state`、`subscription.*`；L2 `/api/portal` | T4.4 | L1/L2 | 可展示 |
| T18.15 | 学习/策展 | L2 `/api/curator`、`/api/learning/*` | T4.2 | L2 | 可查看 |
| T18.16 | 系统升级 | 核心 + web：版本 / 检查更新 / 执行升级（落点：侧栏品牌行核心灯） | T2.8 | BFF | 可升级 |

## M12 未来增强

| ID | 任务 | 说明 | 依赖 | 接口 | 验收 |
| --- | --- | --- | --- | --- | --- |
| T14.1 | AuthProvider 抽象 | 抽出接口，password 为实现之一 | T2.4 | — | 行为不变 |
| T14.2 | OIDC 接入 | provider + JIT 映射到本地 user/角色 | T14.1 | — | 可 OIDC 登录 |
| T15.1 | Skill UI 宿主 | iframe + postMessage RPC（见 24OS 协议） | T6.3 | — | 能挂 UI |

## 覆盖说明

- 本版**已覆盖 `docs/INTERFACES.md` 的全部功能**：BFF 自有接口、Hermes L1 方法、Hermes L2 端点，逐一对应到任务。
- 分批交付：M0–M5 是**最小可用闭环**（登录 → 用户管理 → 代理 → 前端骨架 → 对话）；M6–M9 补全日常功能；M10–M12 为协作/运维/增强。
- 每个任务尽量"一个任务 = 一次最小提交"，依赖列已标明前置关系。
