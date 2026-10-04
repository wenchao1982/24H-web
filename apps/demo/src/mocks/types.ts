/** Demo 领域类型（仅前端 mock，不对应后端 schema）。 */

export type Role = "user" | "assistant";

export interface Agent {
  id: string;
  name: string;
  /** 头像用首字母或 emoji 展示。 */
  avatar: string;
  model: string;
  version: string;
  /** 在线状态灯。 */
  online: boolean;
  soul: string;
  skills: string[];
  mcp: string[];
  toolsets: string[];
}

export interface ModelOption {
  id: string;
  provider: string;
  label: string;
  /** 如 "Flash"、"Pro"。 */
  badge?: string;
}

export interface Workspace {
  id: string;
  name: string;
  path: string;
}

export interface SessionSummary {
  id: string;
  title: string;
  agentId: string;
  updatedAt: string;
  /** 挂起交互（等待审批/回答）。 */
  pending?: boolean;
  /** 正在运行。 */
  running?: boolean;
  /** 有活动定时任务。 */
  scheduled?: boolean;
}

export type ToolStatus = "running" | "done" | "interrupted" | "error";

export interface ToolCall {
  id: string;
  name: string;
  status: ToolStatus;
  detail?: string;
  result?: string;
}

export type RequestKind = "approval" | "clarify" | "sudo" | "secret";

export interface ServerRequest {
  id: string;
  kind: RequestKind;
  title: string;
  body?: string;
  options?: string[];
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  /** 纯思考块。 */
  reasoning?: boolean;
  tools?: ToolCall[];
  request?: ServerRequest;
  /** 回合状态。 */
  status?: "streaming" | "complete" | "interrupted" | "error";
}

export interface GroupRoom {
  id: string;
  name: string;
  /** 成员 agent id。 */
  members: string[];
  topic: string;
  updatedAt: string;
  /** 有需要你处理的挂起项。 */
  needsYou?: boolean;
}

export interface TaskItem {
  id: string;
  name: string;
  schedule: string;
  status: "enabled" | "paused";
  agentId: string;
  last?: string;
  next?: string;
}

export interface UsageRow {
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  requests: number;
  costUsd: number;
  /** 缓存命中率 0–100。 */
  cacheHitRate: number;
}

export interface AgentUsage {
  agentId: string;
  tokens: number;
  costUsd: number;
  requests: number;
}

export interface MonitorMetric {
  label: string;
  value: number;
  unit: string;
  detail: string;
  health: "ok" | "warn" | "bad";
}

export interface MonitorProcess {
  name: string;
  cpu: number;
  mem: string;
  status: "running" | "idle";
}

export interface WorkspaceFile {
  path: string;
  name: string;
  kind: "folder" | "md" | "html" | "pdf" | "docx" | "csv" | "image" | "ts" | "json";
  size?: string;
  content?: string;
}

export interface UsageSummary {
  range: string;
  totalTokens: number;
  totalCostUsd: number;
  cacheSavedUsd: number;
  requests: number;
  avgLatencyMs: number;
  rows: UsageRow[];
  byAgent: AgentUsage[];
}

export type NotificationKind = "approval" | "clarify" | "done" | "error";

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  detail?: string;
  at: string;
  unread: boolean;
}

export interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  role: "super_admin" | "admin";
  status: "active" | "disabled";
  profiles: string[];
}

export interface SettingsSection {
  id: string;
  label: string;
  description: string;
}

export interface SandboxSkill {
  id: string;
  name: string;
  description: string;
}

export interface ToolsetInfo {
  name: string;
  description: string;
  enabled: boolean;
  toolCount: number;
}

export interface McpServerInfo {
  name: string;
  transport: "stdio" | "http" | "sse";
  status: "connected" | "disconnected";
  toolCount: number;
}

export interface ToolInfo {
  name: string;
  description: string;
  toolset: string;
}

export interface MemoryEntry {
  id: string;
  text: string;
  /** 记忆分类。 */
  category: "事实" | "偏好" | "项目" | "系统";
  /** 作用域：全局或某 agent。 */
  scope: string;
  source: string;
  at: string;
}

export interface ProjectInfo {
  id: string;
  name: string;
  description?: string;
  folders: string[];
  isDefault?: boolean;
  lastUsed?: string;
}

/** Hermes profile（= 智能体页 Hermes 分组）。 */
export interface HermesProfile {
  id: string;
  name: string;
  avatar: string;
  model: string;
  version: string;
  isDefault?: boolean;
  description: string;
  soul: string;
  skills: string[];
  mcp: string[];
  toolsets: string[];
}

export type KanbanColumn =
  | "triage"
  | "todo"
  | "scheduled"
  | "ready"
  | "running"
  | "blocked"
  | "review"
  | "done";

export interface KanbanCard {
  id: string;
  title: string;
  column: KanbanColumn;
  assignee: string;
  labels: string[];
  comments: number;
  attachments: number;
  run?: "idle" | "running" | "done" | "failed";
}

export interface KanbanBoard {
  id: string;
  name: string;
  cards: KanbanCard[];
}

export interface FlowNode {
  id: string;
  kind: "agent" | "decision" | "tool";
  label: string;
  x: number;
  y: number;
}

export interface FlowEdge {
  from: string;
  to: string;
  /** 该边携带上游输出注入下游（`{{node.output}}`）。 */
  inject?: boolean;
}

/** 原生 agent 运行时（非角色扮演）。 */
export interface NativeAgent {
  id: string;
  name: string;
  avatar: string;
  runtime: string;
  description: string;
  version: string;
  latestVersion?: string;
  status: "ready" | "update-available" | "stopped";
  /** 默认智能体（Hermes agent）。 */
  isDefault?: boolean;
  binaryPath: string;
  /** 能力描述（用于选择擅长该工作的智能体）。 */
  strengths: string[];
  /** 每 agent 模型覆盖；null = 跟随全局默认。 */
  model: string | null;
  skills: string[];
  mcpServers: string[];
  toolsets: string[];
}

export interface AgentCatalogEntry {
  runtime: string;
  name: string;
  description: string;
  install: string;
  installed: boolean;
}

export interface MarketSkill {
  id: string;
  name: string;
  description: string;
  author: string;
  installed: boolean;
}

export interface MarketMcp {
  id: string;
  name: string;
  description: string;
  transport: string;
  installed: boolean;
}

export interface Artifact {
  id: string;
  name: string;
  kind: "html" | "md" | "image" | "csv" | "other";
  size: string;
  at: string;
}

export interface LogLine {
  level: "info" | "warn" | "error";
  text: string;
  at: string;
}

export interface GitChange {
  status: "M" | "A" | "D" | "??";
  path: string;
}
