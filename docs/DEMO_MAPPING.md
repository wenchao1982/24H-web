# Demo → Production 映射表（M18）

> 用途：把 `apps/demo`（Tailwind + Radix）已定稿的视觉语言，逐条翻译回 `apps/web` 的
> **手写 CSS + `--ds-*` token**（AGENTS.md §8：生产不引 UI 库）。
> Demo 只作**设计参照**，代码不直接复用；回填时**只改样式/结构**，不改业务逻辑与可访问名。

## 1. 颜色 token

| Demo（Tailwind theme） | Production（`apps/web/src/styles.css`） |
| --- | --- |
| `bg-bg` | `--ds-bg-base` |
| `bg-s1` | `--ds-surface-l1` |
| `bg-s2` | `--ds-surface-l2` |
| `bg-s3` | `--ds-surface-l3` |
| `text-label-1` | `--ds-label-primary` |
| `text-label-2` | `--ds-label-secondary` |
| `text-label-3` | `--ds-label-tertiary` |
| `border-line-1` | `--ds-border-l1` |
| `border-line-2` | `--ds-border-l2` |
| `bg-accent` / `text-accent` | `--ds-accent` |
| `bg-accent-weak` | `--ds-accent-weak` |
| `hover:bg-accent-strong` | `--ds-accent-strong` |
| `text-danger` / `warning` / `success` | `--ds-danger` / `--ds-warning` / `--ds-success` |

## 2. 形状 / 文字

| Demo | Production |
| --- | --- |
| `rounded-sm` / `md` / `lg` / `pill` | `--ds-radius-sm/md/lg/pill` |
| `text-[13px]`（正文小一号） | `--ds-font-size-sm`（13px） |
| `text-[11px]/[10px]`（元信息/徽标） | `10px / 11px` 字面量（既有约定） |
| `font-mono` | `--ds-font-mono` |
| `h-8`（行高 32） | `--ds-row-h` |
| `h-12`（头部 48） | `--ds-header-h` |
| 发丝描边 `border-line-1` | `var(--ds-hairline) solid var(--ds-border-l1)` |

## 3. 组件 / 屏幕映射

| Demo 文件 | Production 对应 | 回填要点 |
| --- | --- | --- |
| `components/AppFrame.tsx` | `shell/AppShell.tsx` | 三栏几何保持；仅视觉（边框/底色/间距） |
| `components/Sidebar.tsx` | `shell/Sidebar.tsx` + `.sidebar/.brand/.nav-*` | **新建会话**主按钮、品牌 logo、**分区+可折叠分组 IA**、会话行 meta/状态点 |
| `components/Logo.tsx` | `ui/icons.tsx`（新增 `brand`）+ `.brand-mark` | 用正式 SVG 替换文字 `24H` |
| `components/Composer.tsx` | `chat/Composer.tsx` + `chat/composer/*` + `.composer-*` | hero pill 行 / docked 底行；仅视觉与圆角/阴影 |
| `components/Transcript.tsx` | `chat/Transcript.tsx` + `chat/ToolCard.tsx` + `chat/ServerRequestCard.tsx` | 气泡/思考块/工具卡状态色/审批卡 |
| `screens/ChatHero.tsx` | `chat/HeroIntro.tsx` + `chat/ChatPage.tsx`（hero 态） | 大标识+标题+Preview、最近会话网格 |
| `screens/ChatDocked.tsx` | `chat/ChatPage.tsx`（docked 态） | 会话头 + transcript + 贴底输入 |
| `screens/Login.tsx` | `pages/LoginPage.tsx` + `.login-*` | 居中卡片、品牌、首登改密 |
| `screens/AgentManager.tsx` | `agents/AgentList.tsx` + `AgentDetail.tsx` + 各 Panel | 列表头像/版本灯、详情 Tab 视觉（方案 C 分组） |
| `screens/Groups.tsx` | `groups/GroupChatPage.tsx` | 房间卡 + 成员头像 + 多 agent 对话 |
| `screens/Tasks.tsx` | `tasks/TasksPage.tsx` | 左列表 + Cron 详情/操作/运行记录 + 蓝图/投递目标 |
| `screens/Kanban.tsx` | `kanban/KanbanPage.tsx` | 8 列 `BOARD_COLUMNS` + 卡片/详情 + dispatch |
| `screens/Orchestration.tsx` | `orchestration/OrchestrationPage.tsx` | 画布 + `{{node.output}}` 注入 + 运行子代理树 |
| `screens/Usage.tsx` | `usage/UsagePage.tsx` | 指标卡 + 占比条 + 费用表 |
| `screens/Monitor.tsx` | `insights/MonitorPanel` | 本机 CPU/内存/磁盘/进程 + 后端健康 |
| `screens/SkillHost.tsx` | `settings/ToolsetsPanel` + `agents/McpPanel` + `skillui/*` | 技能宿主 / 工具集 / MCP / 工具 |
| `screens/Memory.tsx` | `settings/MemoryPanel.tsx` | provider 选择 + 记忆条目 |
| `screens/Projects.tsx` | `settings/ProjectsPanel.tsx` | 具名多文件夹工作区 |
| `screens/Files.tsx` | `shell/DetailsPanel.tsx`（文件/预览/日志/Git） | 文件树 + 内容预览 + Git 评审/发布 |
| `screens/Settings.tsx` | `settings/SettingsPage.tsx` | 分区列表 + 分区详情（含语音/连接器） |
| `screens/Admin.tsx` | `pages/AdminUsersPage.tsx` | 用户表 / 审计 / 运维 |
| `screens/Notifications.tsx` | `notifications/*` | 未读聚合 + 偏好 |
| `components/Pill.tsx` | `chat/composer/ComposerControls.tsx` | pill 外观 + 徽标 |

## 3.1 菜单 IA v2（Demo 新结构，待回填时同步基线）

```
工作台：对话 · 群聊 · 任务 · 看板
智能体：智能体            ← 方案 C 混合：Hermes(=profile) / 外部 agent(原生安装)
编排  ：编排              ← 画布 {{node.output}} + 运行子代理树
洞察  ：用量 · 监控 · 记忆
工作区：项目 · 文件
底部  ：设置 · 管理 · 账户 · 通知（+ 语音：composer mic + 设置>语音）
```

**智能体（方案 C 混合）**：左列表分组 **Hermes**（= profile：SOUL/技能/工具/MCP/插件/Bot 屏幕/市场）与 **外部 agent**（Claude Code/Codex/OpenCode/Pi/Grok/DSH：原生安装 + 版本/检查更新/删除/自动更新 + 外部会话）。外部 agent 由 BFF `coding-agents` 安装管理（`npm -g --prefix` 受管目录 + PATH 提升；`super_admin` + 审计 + 白名单 + 固定版本；禁 `curl|sh`）。

**设置分区（对接 Hermes 接口）**：通用（外观/字号/语言）· 模型与密钥（`/api/model/*`、`/api/providers/oauth/*`、`/api/config`: routing/fallback/credential_pools）· 渠道（`/api/messaging/*`、deliverable）· **语音**（STT/TTS 提供方 + 自动朗读 + 唤醒词；`voice.*`/`wake.*`）· 集成（**连接器**（独立于密钥库，`connectors.list`）/ 记忆 / Webhooks / 插件 / Plugin Catalog / GitHub）· 数据与目录（`/api/files`、`/api/sessions/import|export`）· 连接（`/api/admin/connections`）· 系统（`/api/system/*`、`/api/ops/*`、approvals）· 高级（`/api/config` + `/api/tools/*`：api_server/hooks/tool_search/lsp/deliverable/subscription/computer-use、本地模型、配对）。**监控移入洞察**。

**去重**：`管理>系统运维` 并入 `设置>系统`；`设置>用量/项目` 上移为一级；技能市场 / MCP 市场只放智能体详情，不设独立菜单。

**智能体（重定义）**：不是角色扮演，而是**原生 agent 运行时**（默认仅 `Hermes agent`；
可安装 Claude Code / Codex / OpenCode / Pi / Grok …）。每个 agent 详情 Tab：概览（版本/检查更新/更新/卸载/启停/模型覆盖）· 技能 · MCP · 工具 · 市场。模型默认全局（设置>模型与密钥），建会话/入房间时可选。

**右侧功能面板**：`components/DetailsDock.tsx` → 生产 `shell/DetailsPanel.tsx`（关联对话工作区：文件树 + HTML/PDF/Word/MD/CSV/图片预览；附加 产物/日志/**Git（状态/差异/评审发布）**）。

> 依据 `docs/INTERFACES.md` 功能域；生产侧栏当前为平铺结构（UI.md §3），回填时需同步 `ui-spec.md`/`UI.md`。

## 4. 交互映射（Demo 均已 mock 演示）

| 交互 | Production 接线（已存在，勿改语义） |
| --- | --- |
| 主题日/夜 | `settings/theme.ts` + `AppShell` `toggleTheme` |
| 侧栏折叠 / 详情开关 | `AppShell` `collapsed` / `details-context.tsx` |
| 会话行 运行/挂起点 | `SessionSummary.running/pending`（`chat/types.ts`） |
| 模型 pill / 权限 pill | `composer/ModelPicker` / `PermissionPicker` |
| 工具卡状态色 | `ToolCard` status（running/done/interrupted/error） |
| 审批/澄清卡 | `ServerRequestCard`（回包同一 `id`） |

## 5. 回填顺序与红线

1. 壳层/侧栏 → 登录 → 对话 hero → 对话 docked → 智能体。
2. 每屏：只动 `styles.css` + 必要的 JSX 结构；**不改**可访问名 / 测试锁定的文案 / RPC 载荷。
3. 每屏后 `npm run check` 必须全绿；截图对照 `docs/refs/demo-*.png` 复核。
4. 完成后更新 `task-list.md` M18 状态。
