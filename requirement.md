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
| 对话 | 流式对话（工具卡 / 思考 / 挂起卡）、会话列表/搜索/新建、**hero/docked 双态**、精简控件（三 pill：智能体 · 工作区 · 模型 + 底行；`＋` 菜单含工作区入口）、**本会话模型覆盖**、上传三通道（点击 / 拖拽 / 粘贴）、slash 命令、@ 引用、断线重放；**不做语音与 git 分支 pill** |
| 智能体 | agent 列表/详情、SOUL（人设）、模型、Skills（启停/安装/编辑/`/learn`）、MCP、Toolsets、头像、上下文文件 |
| 群聊 | 房间列表 + 多 agent 对话（@成员 / @用户 / 线程） |
| 任务 | Cron 任务列表 + 新增/暂停/恢复/删除/立即运行 |
| 用量 | 概览卡片 + 按模型 token/费用 |
| 设置 | 模型与密钥、渠道、用量、监控、集成、数据与目录、项目、连接、系统/高级 |
| 管理 | 用户与角色、审计、系统运维（仅 `super_admin`） |
| 通知 | 未读/挂起聚合（审批/回答/完成/失败）+ 偏好 |
| 项目 | 具名多文件夹工作区：列表/切换/新建/编辑/删除 |

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

- ❌ **Kanban 状态列看板**
- ❌ **可视化编排画布**（节点 = agent；Ekko 式上游输出注入下游）
- ❌ 本地多模态 **设备端**能力（语音/图像生成等设备相关，后续按需）
- ❌ 自研 agent/编排内核（一律复用官方 Hermes）

## 7. 详细需求

- 接口清单（BFF / Hermes L1 / L2）：[`docs/INTERFACES.md`](./docs/INTERFACES.md)
- 界面设计与功能分布：[`docs/UI.md`](./docs/UI.md)
- 任务拆解：[`docs/TASKS.md`](./docs/TASKS.md)
