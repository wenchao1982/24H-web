import type {
  AdminUser,
  AgentCatalogEntry,
  Artifact,
  FlowEdge,
  FlowNode,
  GitChange,
  GroupRoom,
  HermesProfile,
  KanbanBoard,
  LogLine,
  MarketMcp,
  MarketSkill,
  McpServerInfo,
  MemoryEntry,
  Message,
  MonitorMetric,
  MonitorProcess,
  ModelOption,
  NativeAgent,
  NotificationItem,
  ProjectInfo,
  SandboxSkill,
  SessionSummary,
  SettingsSection,
  TaskItem,
  ToolInfo,
  ToolsetInfo,
  UsageSummary,
  Workspace,
  WorkspaceFile,
} from "./types";

/**
 * 原生 agent 运行时（非角色扮演）。默认仅 Hermes agent。
 * 每个 agent 自带技能/MCP/工具；模型默认跟随全局，可覆盖。
 */
export const NATIVE_AGENTS: NativeAgent[] = [
  {
    id: "hermes",
    name: "Hermes agent",
    avatar: "H",
    runtime: "hermes",
    description: "官方原生智能体；读取后台技能、MCP、工具清单。",
    strengths: ["通用对话", "技能与工具编排", "后台清单读取"],
    version: "v0.21.3",
    status: "ready",
    isDefault: true,
    binaryPath: "~/.hermes/bin/hermes",
    model: null,
    skills: ["web-search", "doc-extract", "scheduler"],
    mcpServers: ["filesystem", "github"],
    toolsets: ["terminal", "files", "browser"],
  },
  {
    id: "claude-code",
    name: "Claude Code",
    avatar: "C",
    runtime: "claude-code",
    description: "Anthropic 官方 CLI 编码智能体。",
    strengths: ["代码编写", "重构", "代码评审"],
    version: "1.0.42",
    latestVersion: "1.0.55",
    status: "update-available",
    binaryPath: "~/.local/bin/claude",
    model: null,
    skills: ["code-review"],
    mcpServers: ["filesystem"],
    toolsets: ["terminal", "files"],
  },
  {
    id: "codex",
    name: "Codex",
    avatar: "X",
    runtime: "codex",
    description: "OpenAI Codex CLI 编码智能体。",
    strengths: ["代码生成", "补全"],
    version: "0.9.1",
    status: "ready",
    binaryPath: "~/.local/bin/codex",
    model: "gpt-5-codex",
    skills: [],
    mcpServers: [],
    toolsets: ["terminal"],
  },
  {
    id: "opencode",
    name: "OpenCode",
    avatar: "O",
    runtime: "opencode",
    description: "开源终端编码智能体。",
    strengths: ["终端编码", "多模型切换"],
    version: "0.6.4",
    status: "ready",
    binaryPath: "~/.local/bin/opencode",
    model: null,
    skills: ["review"],
    mcpServers: ["filesystem"],
    toolsets: ["terminal", "files", "browser"],
  },
  {
    id: "pi",
    name: "Pi",
    avatar: "P",
    runtime: "pi",
    description: "轻量个人智能体运行时。",
    strengths: ["轻量任务", "个人助理"],
    version: "0.2.0",
    status: "stopped",
    binaryPath: "~/.local/bin/pi",
    model: null,
    skills: [],
    mcpServers: [],
    toolsets: ["files"],
  },
];

/** 可安装的 agent 目录（智能体页「安装智能体」）。 */
export const AGENT_CATALOG: AgentCatalogEntry[] = [
  { runtime: "grok", name: "Grok CLI", description: "xAI Grok 终端智能体", install: "npm i -g @xai/grok-cli", installed: false },
  { runtime: "gemini-cli", name: "Gemini CLI", description: "Google Gemini 终端智能体", install: "npm i -g @google/gemini-cli", installed: false },
  { runtime: "aider", name: "Aider", description: "AI 结对编程 CLI", install: "pipx install aider-chat", installed: false },
  { runtime: "cursor-agent", name: "Cursor Agent", description: "Cursor 后台智能体", install: "curl -fsSL cursor.com/agent | sh", installed: false },
  { runtime: "amp", name: "Amp", description: "Sourcegraph Amp 智能体", install: "npm i -g @sourcegraph/amp", installed: false },
];

/** 技能市场。 */
export const MARKET_SKILLS: MarketSkill[] = [
  { id: "ms-1", name: "code-review", description: "按团队规范审查改动", author: "24h", installed: true },
  { id: "ms-2", name: "sql-analyst", description: "写 SQL 并解释口径", author: "community", installed: false },
  { id: "ms-3", name: "release-notes", description: "从提交生成发布说明", author: "community", installed: false },
  { id: "ms-4", name: "ui-screenshot", description: "网页截图与版式检查", author: "24h", installed: true },
];

/** MCP 市场。 */
export const MARKET_MCP: MarketMcp[] = [
  { id: "mm-1", name: "github", description: "仓库、Issue、PR", transport: "http", installed: true },
  { id: "mm-2", name: "postgres", description: "只读 SQL 查询", transport: "stdio", installed: false },
  { id: "mm-3", name: "playwright", description: "浏览器自动化", transport: "stdio", installed: false },
  { id: "mm-4", name: "filesystem", description: "工作区文件读写", transport: "stdio", installed: true },
];

export const MODELS: ModelOption[] = [
  { id: "deepseek-flash", provider: "deepseek", label: "DeepSeek Flash", badge: "Flash" },
  { id: "deepseek-v4-pro", provider: "deepseek", label: "DeepSeek V4 Pro", badge: "Pro" },
  { id: "claude-sonnet", provider: "anthropic", label: "Claude Sonnet" },
];

export const WORKSPACES: Workspace[] = [
  { id: "ws-24h", name: "24h-web", path: "~/projects/24h-web" },
  { id: "ws-notes", name: "notes", path: "~/notes" },
];

export const SESSIONS: SessionSummary[] = [
  { id: "s-1", title: "重构对话输入区 hero/docked", agentId: "hermes", updatedAt: "刚刚", running: true },
  { id: "s-2", title: "写一份 Q4 运营复盘", agentId: "claude-code", updatedAt: "2 小时前", pending: true },
  { id: "s-3", title: "分析上周用量与费用", agentId: "codex", updatedAt: "昨天", scheduled: true },
  { id: "s-4", title: "整理 MCP 配置排查记录", agentId: "hermes", updatedAt: "3 天前" },
];

export const MESSAGES: Message[] = [
  {
    id: "m-1",
    role: "user",
    text: "帮我看看对话页的 hero 态和 docked 态怎么切换比较自然？",
  },
  {
    id: "m-2",
    role: "assistant",
    text: "先确认两个状态的定义：hero 是空态（还没有会话或消息），docked 是有会话后输入区贴底常驻。",
    reasoning: true,
  },
  {
    id: "m-3",
    role: "assistant",
    text: "结论：让两态共用同一个 Composer 实例，只用 `data-variant` 切布局，这样切态不会丢草稿和附件。",
    tools: [
      { id: "t-1", name: "read_file", status: "done", detail: "apps/web/src/chat/Composer.tsx", result: "已读取 148 行" },
      { id: "t-2", name: "grep", status: "running", detail: "搜索 data-variant" },
    ],
    status: "streaming",
  },
  {
    id: "m-4",
    role: "assistant",
    text: "",
    request: {
      id: "r-1",
      kind: "approval",
      title: "运行命令前需要你确认",
      body: "npm run build:demo",
      options: ["允许一次", "始终允许", "拒绝"],
    },
  },
];

/* ---------- 群聊 ---------- */

export const GROUP_ROOMS: GroupRoom[] = [
  {
    id: "g-1",
    name: "发布就绪评审",
    members: ["hermes", "claude-code", "codex"],
    topic: "M18 Demo 定稿前最后一轮",
    updatedAt: "刚刚",
    needsYou: true,
  },
  {
    id: "g-2",
    name: "增长实验",
    members: ["claude-code", "codex"],
    topic: "Q4 转化率实验",
    updatedAt: "2 小时前",
  },
  {
    id: "g-3",
    name: "架构讨论",
    members: ["hermes", "codex"],
    topic: "WS 租户守卫边界",
    updatedAt: "昨天",
  },
];

export const GROUP_MESSAGES: Message[] = [
  { id: "gm-1", role: "user", text: "@通用助手 帮我把 Demo 的四个核心屏过一遍，列出视觉不一致。" },
  {
    id: "gm-2",
    role: "assistant",
    text: "收到。我先看提交里的截图清单，再逐屏标注。",
  },
  {
    id: "gm-3",
    role: "assistant",
    text: "对齐结论：hero 标题层级、composer 描边、侧栏品牌三处与 Demo 仍不一致，建议回填。",
    tools: [{ id: "gt-1", name: "read_files", status: "done", detail: "docs/refs/demo-*.png", result: "8 张" }],
  },
];

/* ---------- 任务 ---------- */

export const TASKS: TaskItem[] = [
  {
    id: "t-1",
    name: "每日用量汇总",
    schedule: "0 9 * * *",
    status: "enabled",
    agentId: "analyst",
    last: "今天 09:00",
    next: "明天 09:00",
  },
  {
    id: "t-2",
    name: "周报草稿",
    schedule: "0 18 * * 5",
    status: "enabled",
    agentId: "writer",
    last: "上周五 18:00",
    next: "本周五 18:00",
  },
  {
    id: "t-3",
    name: "磁盘巡检",
    schedule: "*/30 * * * *",
    status: "paused",
    agentId: "default",
    last: "3 天前",
  },
];

/* ---------- 用量 ---------- */

export const USAGE: UsageSummary = {
  range: "近 30 天",
  totalTokens: 12_480_000,
  totalCostUsd: 38.42,
  cacheSavedUsd: 11.87,
  requests: 4_216,
  avgLatencyMs: 1_180,
  rows: [
    { model: "deepseek-v4-pro", provider: "deepseek", inputTokens: 5_120_000, outputTokens: 2_040_000, requests: 1_820, costUsd: 21.6, cacheHitRate: 62 },
    { model: "deepseek-flash", provider: "deepseek", inputTokens: 3_400_000, outputTokens: 1_220_000, requests: 2_050, costUsd: 9.12, cacheHitRate: 71 },
    { model: "claude-sonnet", provider: "anthropic", inputTokens: 480_000, outputTokens: 220_000, requests: 346, costUsd: 7.7, cacheHitRate: 38 },
  ],
  byAgent: [
    { agentId: "hermes", tokens: 6_120_000, costUsd: 15.4, requests: 2_240 },
    { agentId: "claude-code", tokens: 3_480_000, costUsd: 14.2, requests: 1_180 },
    { agentId: "codex", tokens: 2_880_000, costUsd: 8.82, requests: 796 },
  ],
};

/* ---------- 通知 ---------- */

export const NOTIFICATIONS: NotificationItem[] = [
  { id: "n-1", kind: "approval", title: "等待审批：发布就绪评审", detail: "通用助手请求运行 npm run build:demo", at: "刚刚", unread: true },
  { id: "n-2", kind: "clarify", title: "需要澄清：周报口径", detail: "写作智能体询问统计区间", at: "12 分钟前", unread: true },
  { id: "n-3", kind: "done", title: "任务完成：每日用量汇总", detail: "已生成 30 天费用报表", at: "今天 09:02", unread: false },
  { id: "n-4", kind: "error", title: "失败：磁盘巡检", detail: "上游连接超时（已暂停）", at: "3 天前", unread: false },
];

/* ---------- 管理 ---------- */

export const ADMIN_USERS: AdminUser[] = [
  { id: "u-1", username: "admin", displayName: "系统管理员", role: "super_admin", status: "active", profiles: ["default", "writer"] },
  { id: "u-2", username: "lisi", displayName: "李四", role: "admin", status: "active", profiles: ["default"] },
  { id: "u-3", username: "wangwu", displayName: "王五", role: "admin", status: "disabled", profiles: ["writer"] },
  { id: "u-4", username: "zhaoliu", displayName: "赵六", role: "admin", status: "active", profiles: [] },
];

/* ---------- 设置 ---------- */

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: "general", label: "通用", description: "外观、字号、语言与默认行为" },
  { id: "model", label: "模型与密钥", description: "模型选择、路由、回退与凭证池" },
  { id: "channels", label: "渠道", description: "消息渠道与交付方式" },
  { id: "integrations", label: "集成", description: "Webhooks、插件与 GitHub" },
  { id: "data", label: "数据与目录", description: "工作区目录与数据管理" },
  { id: "connections", label: "连接", description: "Hermes 实例注册与探活" },
  { id: "system", label: "系统", description: "升级、系统运维与审批策略" },
  { id: "advanced", label: "高级", description: "API Server、Event Hooks、Tool Gateway 等" },
];

/* ---------- 技能界面 ---------- */

export const SANDBOX_SKILLS: SandboxSkill[] = [
  { id: "hello-ui", name: "hello-ui", description: "最小技能 UI 示例" },
  { id: "usage-board", name: "usage-board", description: "用量看板技能" },
  { id: "release-notes", name: "release-notes", description: "发布说明生成器" },
];

/* ---------- 工具与 MCP ---------- */

export const TOOLSETS: ToolsetInfo[] = [
  { name: "terminal", description: "执行 shell 命令与进程管理", enabled: true, toolCount: 6 },
  { name: "files", description: "读写工作区文件", enabled: true, toolCount: 5 },
  { name: "browser", description: "浏览器操作与抓取", enabled: true, toolCount: 8 },
  { name: "web-search", description: "联网搜索", enabled: false, toolCount: 2 },
  { name: "computer-use", description: "桌面控制", enabled: false, toolCount: 3 },
];

export const MCP_SERVERS: McpServerInfo[] = [
  { name: "filesystem", transport: "stdio", status: "connected", toolCount: 12 },
  { name: "github", transport: "http", status: "connected", toolCount: 24 },
  { name: "postgres", transport: "stdio", status: "disconnected", toolCount: 5 },
];

export const TOOLS: ToolInfo[] = [
  { name: "shell.exec", description: "在会话工作区执行命令", toolset: "terminal" },
  { name: "cli.exec", description: "执行已注册的 CLI 命令", toolset: "terminal" },
  { name: "fs.read", description: "读取文件", toolset: "files" },
  { name: "fs.write", description: "写入文件", toolset: "files" },
  { name: "browser.open", description: "打开 URL", toolset: "browser" },
  { name: "browser.screenshot", description: "网页截图", toolset: "browser" },
];

/* ---------- 记忆 ---------- */

export const MEMORY_PROVIDERS = ["local", "vector", "none"] as const;

export const MEMORY_ENTRIES: MemoryEntry[] = [
  { id: "mem-1", text: "用户偏好中文回答，先结论后细节。", category: "偏好", scope: "全局", source: "对话提炼", at: "今天" },
  { id: "mem-2", text: "主项目位于 ~/projects/24h-web，使用 npm workspaces。", category: "项目", scope: "hermes", source: "项目事实", at: "昨天" },
  { id: "mem-3", text: "演示环境的核心版本为 v0.21.3。", category: "系统", scope: "全局", source: "系统", at: "3 天前" },
  { id: "mem-4", text: "团队要求 PR 必须通过 npm run check 且无新增 lint 告警。", category: "事实", scope: "claude-code", source: "显式添加", at: "5 天前" },
];

/* ---------- 项目 ---------- */

export const PROJECTS: ProjectInfo[] = [
  {
    id: "p-1",
    name: "24h-web",
    description: "24H Web 主仓库与共享类型",
    folders: ["/work/24h-web", "/work/shared-types"],
    isDefault: true,
    lastUsed: "刚刚",
  },
  { id: "p-2", name: "notes", description: "个人笔记与草稿", folders: ["/home/me/notes"], lastUsed: "昨天" },
  { id: "p-3", name: "data", description: "分析与导出产物", folders: ["/data/analytics", "/data/exports", "/data/raw"], lastUsed: "3 天前" },
];

/* ---------- 右侧功能面板 ---------- */

export const DOCK_FILES = [
  "apps",
  "apps/demo",
  "apps/demo/src/App.tsx",
  "apps/demo/src/styles.css",
  "apps/web",
  "apps/web/src/ChatPage.tsx",
  "docs",
  "docs/INTERFACES.md",
  "package.json",
];

export const ARTIFACTS: Artifact[] = [
  { id: "a-1", name: "usage-report.html", kind: "html", size: "84 KB", at: "刚刚" },
  { id: "a-2", name: "q4-summary.md", kind: "md", size: "6 KB", at: "2 小时前" },
  { id: "a-3", name: "cost-chart.png", kind: "image", size: "128 KB", at: "昨天" },
  { id: "a-4", name: "tokens.csv", kind: "csv", size: "12 KB", at: "昨天" },
];

export const LOG_LINES: LogLine[] = [
  { level: "info", text: "ws proxy ready (profile=default)", at: "10:02:11" },
  { level: "info", text: "session.resume stored=st_812 runtime=rt_45", at: "10:02:12" },
  { level: "info", text: "prompt.submit -> streaming", at: "10:02:13" },
  { level: "warn", text: "profile fallback applied (no explicit profile)", at: "10:02:14" },
  { level: "info", text: "tool.start shell.exec", at: "10:02:15" },
  { level: "error", text: "tool.complete shell.exec exit=1", at: "10:02:18" },
];

export const GIT_CHANGES: GitChange[] = [
  { status: "M", path: "apps/web/src/styles.css" },
  { status: "M", path: "apps/web/src/ui/icons.tsx" },
  { status: "A", path: "apps/demo/src/screens/AgentManager.tsx" },
  { status: "??", path: "docs/refs/demo-*.png" },
];

/* ---------- 监控 ---------- */

export const MONITOR_METRICS: MonitorMetric[] = [
  { label: "CPU", value: 34, unit: "%", detail: "8 核", health: "ok" },
  { label: "内存", value: 62, unit: "%", detail: "9.9 / 16 GB", health: "warn" },
  { label: "磁盘", value: 71, unit: "%", detail: "355 / 500 GB", health: "warn" },
  { label: "进程", value: 3, unit: "", detail: "2 运行 / 1 空闲", health: "ok" },
];

export const MONITOR_PROCESSES: MonitorProcess[] = [
  { name: "hermes serve", cpu: 12.4, mem: "412 MB", status: "running" },
  { name: "node server.mjs", cpu: 3.1, mem: "128 MB", status: "running" },
  { name: "postgres", cpu: 0.4, mem: "220 MB", status: "idle" },
];

/* ---------- Hermes profiles（= 智能体页 Hermes 分组） ---------- */

export const HERMES_PROFILES: HermesProfile[] = [
  {
    id: "default",
    name: "default",
    avatar: "H",
    model: "deepseek-flash",
    version: "v0.21.3",
    isDefault: true,
    description: "团队默认租户：通用研发与运营",
    soul: "你是 24H 工作台的通用智能体，帮助用户完成日常研发与运营任务。",
    skills: ["web-search", "doc-extract", "scheduler"],
    mcp: ["filesystem", "github"],
    toolsets: ["terminal", "files", "browser"],
  },
  {
    id: "growth",
    name: "growth",
    avatar: "G",
    model: "deepseek-v4-pro",
    version: "v0.21.3",
    description: "增长团队租户：写作与实验",
    soul: "你是增长团队助手，擅长把零散信息组织成结构化方案。",
    skills: ["outline", "polish", "chart"],
    mcp: ["filesystem"],
    toolsets: ["files", "browser"],
  },
];

/* ---------- 看板 Kanban（固定 4 列） ---------- */

export const KANBAN_BOARDS: KanbanBoard[] = [
  {
    id: "b-1",
    name: "发布就绪",
    cards: [
      { id: "k-1", title: "菜单 IA v2 定稿", column: "done", assignee: "hermes", labels: ["设计"], comments: 3, attachments: 2, run: "done" },
      { id: "k-2", title: "外部 agent 原生安装方案", column: "running", assignee: "claude-code", labels: ["后端", "安全"], comments: 5, attachments: 1, run: "running" },
      { id: "k-3", title: "编排 {{node.output}} 执行器", column: "ready", assignee: "codex", labels: ["编排"], comments: 1, attachments: 0, run: "idle" },
      { id: "k-4", title: "语音 mic + 浮层", column: "todo", assignee: "hermes", labels: ["前端"], comments: 0, attachments: 0, run: "idle" },
      { id: "k-5", title: "会话全文检索（FTS5）", column: "scheduled", assignee: "codex", labels: ["后端"], comments: 2, attachments: 0, run: "idle" },
      { id: "k-6", title: "看板 board 导入导出", column: "review", assignee: "hermes", labels: ["插件"], comments: 4, attachments: 3, run: "idle" },
      { id: "k-7", title: "Git review / PR 面板", column: "blocked", assignee: "claude-code", labels: ["集成"], comments: 2, attachments: 1, run: "idle" },
    ],
  },
  {
    id: "b-2",
    name: "Q4 增长",
    cards: [
      { id: "k-8", title: "归因口径对齐", column: "triage", assignee: "hermes", labels: ["分析"], comments: 1, attachments: 0, run: "idle" },
      { id: "k-9", title: "落地页 A/B", column: "todo", assignee: "claude-code", labels: ["前端"], comments: 0, attachments: 0, run: "idle" },
    ],
  },
];

/* ---------- 编排画布（M21） ---------- */

export const FLOW_NODES: FlowNode[] = [
  { id: "n-1", kind: "agent", label: "研究员", x: 60, y: 60 },
  { id: "n-2", kind: "agent", label: "编码", x: 300, y: 60 },
  { id: "n-3", kind: "decision", label: "评审通过？", x: 300, y: 200 },
  { id: "n-4", kind: "tool", label: "发布", x: 540, y: 130 },
];

export const FLOW_EDGES: FlowEdge[] = [
  { from: "n-1", to: "n-2", inject: true },
  { from: "n-2", to: "n-3", inject: true },
  { from: "n-3", to: "n-4" },
];

/* ---------- 对话工作区文件（右侧面板） ---------- */

export const WORKSPACE_FILES: WorkspaceFile[] = [
  { path: "src", name: "src", kind: "folder" },
  { path: "src/App.tsx", name: "App.tsx", kind: "ts", size: "6 KB", content: "export default function App() {\n  return <AgentManager />;\n}\n" },
  { path: "src/styles.css", name: "styles.css", kind: "ts", size: "12 KB", content: ":root {\n  --ds-accent: #4d6bfe;\n  --ds-radius-lg: 16px;\n}\n" },
  { path: "docs", name: "docs", kind: "folder" },
  { path: "docs/summary.md", name: "summary.md", kind: "md", size: "6 KB", content: "# 发布摘要\n\n- 菜单 IA v2\n- 智能体重定义\n- 右侧工作区面板\n" },
  { path: "report.html", name: "report.html", kind: "html", size: "84 KB" },
  { path: "spec.pdf", name: "spec.pdf", kind: "pdf", size: "220 KB" },
  { path: "proposal.docx", name: "proposal.docx", kind: "docx", size: "32 KB" },
  { path: "tokens.csv", name: "tokens.csv", kind: "csv", size: "12 KB", content: "model,input,output,cost\ndeepseek-v4-pro,5120000,2040000,21.60\ndeepseek-flash,3400000,1220000,9.12\nclaude-sonnet,480000,220000,7.70\n" },
  { path: "chart.png", name: "chart.png", kind: "image", size: "128 KB" },
  { path: "README.md", name: "README.md", kind: "md", size: "2 KB", content: "# 24H Web\n\n企业多用户 Hermes 工作台。\n" },
];
