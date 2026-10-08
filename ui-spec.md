# UI 规范（24H Web）

> chat-first、简洁、克制的中文工作台。完整设计见 [`docs/UI.md`](./docs/UI.md)。
> 实现 token 见 `apps/web/src/styles.css`（`--ds-*`）。

## 1. 全局

- **三栏 AppShell**：侧栏 · 主区 · 详情面板；面板可拖拽缩放，空间不足**让步链**先缩详情、再自动关闭。
- **无全局顶栏**：品牌/状态在侧栏品牌行；模型在输入框；面板开关在会话头。
- **对话 hero/docked 双态**：空态 hero（大标识 + 标题 + 三 pill + 大输入框 + 最近会话）与有会话/消息 docked（输入区贴底常驻）互斥；两态为**同一 `Composer` 实例**（以 `data-variant` 切布局），避免切换丢草稿与附件。
- **语音**：输入区含 mic（按住说话 STT）；TTS 朗读；**唤醒词常驻监听（默认关）**。打断可中止朗读/聆听。
- **一个强调色** `#4d6bfe`，仅用于主操作 / 激活态 / 运行指示。
- **`--ds-*` design token**（语义 alias）：`--ds-bg-base`、`--ds-surface-l1/l2`、`--ds-label-primary/secondary/tertiary`、`--ds-border-l1/l2`、`--ds-accent`。
- **发丝描边** 0.5px（10% / 12%）表层级；**圆角一律用 `--ds-radius-sm/md/lg/pill`**（`apps/web/src/styles.css`）。
- **正文 14px**（可调 12–17）；标题/摘要/表格低一档；小号文本与代码固定等宽。
- **主题** `light` / `dark` / `system`；首帧前注入所选配色，避免闪烁。
- 侧栏可折叠为 **56px 轨道**；不引 UI 库，手写 CSS。

## 2. 组件

| 组件 | 要点 |
| --- | --- |
| 侧栏 | 品牌行（`24H` + 版本徽标 + 核心灯/渠道点）· **分组+可折叠导航**（**工作台**：对话/群聊/任务/看板 · **智能体**：智能体/技能界面 · **编排**：编排 · **洞察**：用量/监控/记忆 · **工作区**：项目/文件）· 上下文列表 · 底部（设置/管理/账户/通知） |
| 详情面板 | 默认关闭；Tab：文件 / 预览 / 日志 / Git；可拖拽、可让步关闭、隐藏不销毁 |
| 输入框 | **hero/docked 双态同实例**；hero pill 行 = `智能体 · 工作区 · 模型`，docked 底行 = `＋ ｜ 权限模式 ｜ 弹性空位 ｜ 模型 ｜ 发送/停止`；`＋` 菜单 = `文件 / 图片 / PDF / 子代理 / 命令 / 上下文 / 人格 / 图片生成 / 工作区`（**docked 态经此切换工作区**，内联 select）；slash / `@` 引用 chip；上传三通道（点击 / 拖拽 / 粘贴）；发送↔停止主操作切换；繁忙 Enter=队列；乐观发送 + 失败合并还原；**不渲染语音与 git 分支 pill** |
| 会话头菜单 | 活动会话头 `···`：`连接 / 导入 / 导出 / 分享 / 重命名`（APG Menu Button，`Esc` 关闭并归还焦点） |
| 工具卡 | `tool.start / generating / complete` 折叠卡：名称 + 状态 + 结果 |
| 审批卡 | 服务端请求行内可处理 → 回包同一 `id`。Hermes 共 13 类：`approval` / `clarify` / `sudo` / `secret` / `vault.unlock_prompt` / `vault.save_login` / `vault.code` / `terminal.read` / `preview.read` / `window.read` / `preview.act` / `tour` / `display.install.sudo` |
| 表格 | 列表行只留 1–2 个关键字段；次要信息进 hover / 详情；数字格式化（k/M、%、相对时间） |
| 按钮 | 主操作=强调色；次级=描边；危险=红色；圆/胶囊配 `--ds-radius-pill` |

## 3. 逐页布局（一句话）

- **对话**：hero/docked 双态——空态 hero（大标识 + 标题 + 三 pill + 大输入框 + 最近会话），有会话/消息 docked（会话头 + transcript + 贴底常驻输入框）；侧栏为会话列表。
  - 控件：hero pill 行 `智能体 · 工作区 · 模型`；底行 `＋ ｜ 权限模式 ｜（弹性空位）｜ 模型 ｜ 发送/停止`；`＋` 菜单 = `文件 / 图片 / PDF / 子代理 / 命令 / 上下文 / 人格 / 图片生成 / 工作区`（**docked 态经此切换工作区**，内联 select）；**不渲染语音与 git 分支 pill**；会话头 `···` 菜单 = `连接 / 导入 / 导出 / 分享 / 重命名`。
  - 选中会话即恢复（`session.resume`）；恢复完成前输入区按身份未就绪处理。
  - 错误直接透传网关 message（如 `session not found`），不吞错。
  - 重命名/删除**非活动行**不得打扰当前活动会话。
  - 停止即中断：主操作回「发送」，出现「已中断」提示，悬挂工具卡结算为「已中断」，**不显示「完成」**。
- **智能体（方案 C 混合）**：左列表分两组——**Hermes**（= profile：SOUL / 技能 / 工具 / MCP / 插件 / Bot 屏幕 / 市场）与**外部 agent**（Claude Code / Codex / OpenCode / Pi / Grok / DSH：原生安装 + 版本 / 检查更新 / 删除 / 自动更新 + 各自配置 + 外部会话）。外部 agent 卡片：logo · vendor · `Installed` · 版本 · Settings · Check for update · Delete · Automatic updates 开关；由 BFF `coding-agents` 安装管理。
- **群聊**：侧栏房间列表（成员数·最新·needs-you）→ 主区多 agent 对话（@成员 / @用户 / 线程）+ 成员增删改 + Bot 回传。
- **任务**：侧栏任务列表 → 主区 Cron 详情 + 新增/编辑/暂停/恢复/删除/立即运行 + blueprints/投递目标/失败事件。
- **看板**：列 = Hermes `BOARD_COLUMNS`（`triage/todo/scheduled/ready/running/blocked/review/done`，8 列）；卡片 = 标题 + 指派 agent/profile + 标签/附件数 + run 状态；详情含评论/链接/附件/估算；操作 dispatch / 终止 run / 回收 / board 导入导出。
- **编排**：画布（节点 = agent/子代理/工具/判定，边 = 委托 + **上游输出注入下游** `{{node.output}}`）；运行视图（子代理树 / MoA）；导入导出走 `spawn_tree.*`。
- **用量**：无侧栏列表；概览卡片 + 缓存命中率 + 按智能体对比 + 按模型费用 + **计费/订阅/充值**。
- **监控**：独立页——本机 CPU/内存/磁盘/进程 + 后端健康。
- **记忆**：独立页——分类 / 作用域 / 提供方 / 图谱。
- **项目（工作区）**：独立页——具名多文件夹工作区列表/切换/新建/编辑/删除。
- **文件**：独立页——工作区文件树 + 预览。
- **设置**：分区列表 → 分区详情（通用（外观/字号/**语言**）/ 模型与密钥 / 渠道 / 集成（含连接器）/ 数据与目录 / 连接 / 系统 / 高级 / **语音**）。
- **管理**（仅 `super_admin`）：分区列表 → 用户与角色 / 审计（系统运维已并入 `设置>系统`）。
- **通知**：独立页——未读/挂起聚合列表 + 全部已读 + 偏好；带 `sessionId` 项直达会话。
- **账户**：独立页——自助资料（用户名/显示名/角色/profile）+ 改用户名 + 改密 + 头像。

## 4. 详细设计

- 完整交互、响应式、快捷键、视觉风格：[`docs/UI.md`](./docs/UI.md)

## 5. 前端 Demo（M18）

- 独立高保真 Demo 落在 `apps/demo`（mock 数据、不碰后端），用于**先定稿视觉语言再回填**生产页。
- Demo 内**允许引入 UI 库**（Tailwind v4 + Radix + lucide + cva/clsx）以快速出效果；
  **回填 `apps/web` 时仍须遵守 §1「不引 UI 库、手写 CSS + `--ds-*`」**，即 Demo 是设计参照而非直接复用代码。
- Demo 独立验证 `check:demo`，**不进** 根 `npm run check`；首轮范围 = 核心 4 屏（见 `task-list.md` M18）；
  现覆盖 18 屏，并反向补登生产能力：Git **评审/发布**、Cron **蓝图/投递目标/失败事件**、设置 **语音分区 + 连接器分组（独立于密钥库）**、看板 **8 列**。
