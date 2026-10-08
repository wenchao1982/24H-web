# 需求（24H Web）

> 企业多用户的 **Hermes web 工作台**：自有 SPA + 自有 BFF + 官方 Hermes 后端。
> 本文为**精简业务基线**；详细需求见 [`docs/INTERFACES.md`](./docs/INTERFACES.md)、[`docs/UI.md`](./docs/UI.md)。

## 1. 目标

- 面向**企业多用户**：管理员在界面里管理用户/权限；普通用户只看到被授权的 agent 与会话。
- **不自研 agent 能力**：对话 / 会话 / 工具 / 技能 / 配置复用官方 Hermes。
- 认证 / 用户 / 角色 / 租户 / 代理由 **BFF** 承担；浏览器**永不持有** Hermes token。

## 2. 角色

| 角色 | 说明 |
| --- | --- |
| `super_admin` | 全权；管理用户与角色、分配 profile、查看审计、系统升级/运维 |
| `admin` | 仅被分配的 profile（租户边界）；无管理入口 |
| 普通用户 | 即 `admin` 语义：登录后只见自己的会话与授权 agent |

- 两级角色：`super_admin` | `admin`；HITL 机制见 [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)。

## 3. 核心页面与功能

| 页面 | 功能 |
| --- | --- |
| 对话 | 流式对话（工具卡 / 思考 / 挂起卡）、会话列表/搜索（**含全文检索**）/新建、**hero/docked 双态**、精简控件（三 pill：智能体 · 工作区 · 模型 + 底行）、**本会话模型覆盖**、上传三通道、slash 命令、@ 引用、断线重放、多 profile 自访问（REQ-020）、**语音**（按住说话 STT · TTS 朗读 · 唤醒词常驻默认关）；不做 git 分支 pill |
| 智能体 | **混合（方案 C）**：左列表分两组——**Hermes**（= profile：SOUL / 技能 / 工具 / MCP / 插件 / Bot 屏幕 / 市场）与**外部 agent**（`Claude Code / Codex / OpenCode / Pi / Grok / DSH`：**原生安装** + 版本 / 检查更新 / 删除 / **自动更新** + 各自配置 + 外部会话导入）。外部 agent 由 **BFF `coding-agents` 模块**在主安装/管理（`super_admin`）；Hermes 侧只做会话导入（`session.foreign.*`）与注册（`import-agent`） |
| 档案 | Hermes **profile** 管理（租户/人设 SOUL、模型、资产、导入导出）——即智能体页 **Hermes 分组**；原「智能体=人设」概念归此 |
| 群聊 | 房间列表 + 多 agent 对话（@成员 / @用户 / 线程）+ **成员增删改** + Bot 回传（bot_relay） |
| 任务 | Cron 任务列表 + 新增/编辑/暂停/恢复/删除/立即运行 + **blueprints / 投递目标 / 失败事件** |
| 看板 | **Kanban（插件）**：列对齐 Hermes `BOARD_COLUMNS` = `triage/todo/scheduled/ready/running/blocked/review/done`（8 列）、卡片指派 agent/profile、附件/评论/链接、`dispatch` 触发 worker、run 终止/回收、board 导入导出、home 订阅 |
| 编排 | **可视化编排画布**（节点 = agent/子代理/工具/判定，边 = 委托与**上游输出注入下游**，语义 `{{node.output}}` 变量替换）；运行视图（子代理树 / MoA）；导入导出走 `spawn_tree.*`；**自建执行层，复用 Hermes 内核** |
| 用量 | 概览卡片 + 缓存命中率 + 按智能体对比 + 按模型 token/费用 + **计费/订阅/充值**（`billing.*`/`subscription.*`/`usage.bars`） |
| 监控 | **独立页** `/monitor`：本机 CPU/内存/磁盘/进程 + 后端健康（封装 `MonitorPanel`） |
| 记忆 | **独立页** `/memory`：分类 / 作用域 / 提供方 / 图谱（封装 `MemoryPanel`） |
| 项目（工作区） | **独立页** `/projects`：具名多文件夹工作区——列表/切换/新建/编辑/删除（封装 `ProjectsPanel`） |
| 文件 | **独立页** `/files`：工作区文件树 + 读取预览（封装 `FilesPanel`） |
| 设置 | 通用（外观/字号/**语言**）· 模型与密钥 · 渠道 · 集成（含**连接器**）· 数据与目录 · 连接 · 系统 · 高级 · **语音** |
| 管理 | 用户与角色 · 审计（仅 `super_admin`；系统运维并入 `设置>系统`） |
| 通知 | **独立页** `/notifications`：未读/挂起聚合（审批/回答/完成/失败）+ 全部已读 + 偏好；铃铛点击带 `sessionId` 直达会话 |
| 账户 | **独立页** `/account`：自助资料（用户名/显示名/角色/已分配 profile）+ 改用户名 + 改密 + 头像 |

### 3.1 对话：历史会话恢复（stored id / runtime id）

- **点选即 attach**：点选或 `?session=` 深链进入历史会话时，以 stored id 调 `session.resume` 取得 runtime id，建立身份对 `{storedId, runtimeId}`；此后会话域 RPC 与事件匹配一律用 runtime id。
- **有界自动恢复**：`prompt.submit` 返回 4001（`session not found`）时，以**发送时**的 stored id 重新 resume 并重试**恰好一次**；重试仍失败才提示网关错误。
- **身份矩阵**：`session.resume` 入参、`session.delete`、`session.workspace.move`（字段名 `session_key`）用 stored id；`prompt.submit` / `session.interrupt` / `session.title` / 附件（file/image/pdf/clipboard）/ `subagent.*` / `session.events.since` 用 runtime id。
- **逐行隔离**：对非活动行重命名/删除不得改写当前活动会话身份；重命名目标即活动会话时复用现身份，不重复 resume。
- **新建零 resume**：`session.create` 以回包 `stored_session_id` 作 storedId、`session_id` 作 runtimeId，列表项 id 用 stored。
- **错误透传**：resume/submit 失败展示网关真实 message；归一化缺失 `session_id` 即报错，禁止回退 stored id。
- **多 profile 自访问（REQ-020）**：前端在**显式选择**智能体（`selection.profile !== null`）时，会话域请求（`session.list` / `session.most_recent` / `session.resume` / `session.events.since`）shall 携带 `params.profile = selection.profile`，使多 profile 用户可访问**非默认** profile 的会话；未显式选择时不上送，由 BFF 按 REQ-017 注入 `default_profile`。
- **打断收尾**：回合运行中点「停止」时以 **runtime id** 调 `session.interrupt`；打断后网关仍会回传 `message.complete`，其 `status="interrupted"`（`text` 可能为空）。前端须据 `status` 结算悬挂工具卡、把状态相位置为「已中断」，并保留被打断回合已生成的部分文本。

## 4. 关键表单字段

- **登录**：`username` + `password`；支持 OIDC SSO（可选）。
- **建用户**：`username`、`display_name`、初始口令、`role`（`super_admin`/`admin`）、`status`（`active`/`disabled`）。
- **分配 profile**：勾选 Hermes profile 列表 + 指定 `default_profile`（租户边界）。
- **Keys**：`/api/env` 键名 + 值；**只回键名、永不回显明文**。
- **模型**：模型选择 / 保存 key / MoA / provider 路由 / 回退 / 凭证池。

## 5. 边界场景

- **首登强制改密**：初始 `super_admin` 登录后必须先改密，否则其他接口不可用。
- **登录限流**：连续失败累计触发锁定（`login_attempts` → 429 `LOGIN_LOCKED`）。
- **profile 越权**：非 `super_admin` 访问未分配 profile → **403 `PROFILE_FORBIDDEN`**。
- **上游断开**：`hermes serve` 不可达 → 502 `HERMES_UNREACHABLE` + 降级提示，前端不崩。
- **CSRF**：cookie 会话下所有写操作需同源 + `x-csrf-token`，跨站写被拒。
- **保护最后一个 active `super_admin`**：拒绝删除/降级/禁用（409 `LAST_SUPER_ADMIN`）。

## 6. 不做的功能清单

- ❌ **自研 agent 内核**（对话/会话/工具/技能/模型一律复用官方 Hermes）
- ❌ **自研编排内核**：可视化编排为**自建执行层**，底层复用 `spawn_tree.*` / `delegation.*` / `subagent.*` / MoA / groups，不重写 Hermes 内核
- ❌ 本地多模态 **设备端**能力（本地图像生成等设备相关，后续按需；语音**已纳入**，见 §3）

> 已撤销的旧排除项（现纳入）：Kanban 看板（看板）、可视化编排画布（编排）、语音/唤醒/TTS/STT（对话·语音）。

## 7. 详细需求

- 接口清单（BFF / Hermes L1 / L2）：[`docs/INTERFACES.md`](./docs/INTERFACES.md)
- 界面设计与功能分布：[`docs/UI.md`](./docs/UI.md)
- 任务拆解：[`docs/TASKS.md`](./docs/TASKS.md)
