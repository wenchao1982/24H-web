# 任务拆解（最小可实现）

> 目标：把全部功能拆成"一个任务 = 一次最小提交"。
> 依赖列里的 ID 表示前置任务。接口列标明走 BFF / L1(网关 WS) / L2(REST)。
> 里程碑：M0 工程基线 · M1 BFF+认证 · M2 用户管理 · M3 代理 · M4 对话 · M5 技能/设置 · M6 任务/用量/面板 · M7 体验 · M8 future。

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
| T2.5 | 当前用户 | `GET /api/auth/me` | T2.4 | BFF | 返回 id/username/role/profiles |
| T2.6 | 登出 | `POST /api/auth/logout` | T2.4 | BFF | cookie 清除 |
| T2.7 | 会话中间件 | cookie→req.user；无会话 401 | T2.4 | BFF | 受保护路由 401 |
| T2.8 | 角色守卫 | `requireSuperAdmin` | T2.7 | BFF | admin 访问管理路由 403 |
| T2.9 | 改密 | `POST /api/auth/change-password`（首登强制） | T2.7 | BFF | 改密后可继续 |
| T2.10 | 登录限流 | `login_attempts` 计数 + 锁定 | T2.4 | BFF | 多次失败锁定 |

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

## M4 对话（核心）

| ID | 任务 | 说明 | 依赖 | 接口 | 验收 |
| --- | --- | --- | --- | --- | --- |
| T6.1 | 会话列表 | 拉取会话（经 BFF 代理 L2） | T4.2 | L2 | 列表渲染 |
| T6.2 | 新建会话 | `session.create` | T4.4 | L1 | 拿到 session_id |
| T6.3 | 流式消息 | `prompt.submit` → `message.delta/complete` → transcript | T6.2 | L1 | 流式显示 |
| T6.4 | 工具卡 | `tool.start/complete` 渲染 | T6.3 | L1 | 工具可见 |
| T6.5 | 审批/澄清 | server→client request 回包 | T6.3 | L1 | 审批可点 |
| T6.6 | 中断 | `session.interrupt` | T6.3 | L1 | 可停止 |
| T6.7 | 状态条 | 上下文/用量/速率 | T6.3 | L1 | 显示统计 |

## M5 技能 / 设置

| ID | 任务 | 说明 | 依赖 | 接口 | 验收 |
| --- | --- | --- | --- | --- | --- |
| T7.1 | 技能列表 | 按类别分组 | T4.2 | L2 | 分组渲染 |
| T7.2 | 技能启停 | toggle | T7.1 | L2 | 状态持久 |
| T8.1 | Keys 管理 | `/api/env` 读写（不回显明文） | T4.2 | L2 | 可保存 |
| T8.2 | 模型设置 | `/api/model/*` | T4.2 | L2 | 可切换 |
| T8.3 | 外观 | 主题/语言 | — | — | 生效 |

## M6 任务 / 用量 / 面板

| ID | 任务 | 说明 | 依赖 | 接口 | 验收 |
| --- | --- | --- | --- | --- | --- |
| T9.1 | 任务列表 | Cron jobs | T4.2 | L2 | 列表 |
| T9.2 | 任务操作 | 新增/暂停/恢复/删除/立即运行 | T9.1 | L2 | 操作生效 |
| T10.1 | 用量概览 | 会话/消息统计 | T4.2 | L2 | 数字正确 |
| T10.2 | 模型分析 | 按模型 token/费用 | T10.1 | L2 | 图表/表格 |
| T11.1 | 文件面板 | 浏览/读取 | T4.2 | L2 | 可浏览 |
| T11.2 | 日志面板 | 读取/过滤 | T4.2 | L2 | 可筛选 |
| T11.3 | 预览面板 | 文件/HTML 预览 | T11.1 | — | 可预览 |

## M7 体验

| ID | 任务 | 说明 | 依赖 | 接口 | 验收 |
| --- | --- | --- | --- | --- | --- |
| T12.1 | 命令面板 | ⌘K：导航/动作 | T5.2 | — | 可执行 |
| T13.1 | 中文化 | 文案/i18n 收口 | — | — | 全中文 |
| T13.2 | 移动端 | 响应式布局 | T5.2 | — | 小屏可用 |
| T13.3 | 登录/用户管理页 | 登录页 + 用户管理页（admin 可见） | T2.4,T3.1 | BFF | 仅 admin 可见管理页 |

## M8 future

| ID | 任务 | 说明 | 依赖 | 接口 | 验收 |
| --- | --- | --- | --- | --- | --- |
| T14.1 | AuthProvider 抽象 | 抽出接口，password 为实现之一 | T2.4 | — | 行为不变 |
| T14.2 | OIDC 接入 | provider + JIT 映射到本地 user/角色 | T14.1 | — | 可 OIDC 登录 |
| T15.1 | Skill UI 宿主 | iframe + postMessage RPC（见 24OS 协议） | T6.3 | — | 能挂 UI |
