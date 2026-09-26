/** M5 对话核心的共享类型与宽容的网关结果归一化（字段以官方契约为准，缺失即降级）。 */

export interface SessionSummary {
  id: string;
  title: string;
  updatedAt?: string;
}

export type ToolStatus = "start" | "generating" | "complete";

export type RequestKind = "approval" | "clarify" | "sudo" | "secret" | "mcp.setup";

export interface PendingRequest {
  id: string;
  kind: RequestKind;
  params: Record<string, unknown>;
  answered?: boolean;
  answer?: string;
}

export interface StatusInfo {
  phase: "thinking" | "done" | "error";
  contextPercent?: number;
  tokens?: number;
  tps?: number;
  error?: string;
}

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  method: "image.attach" | "pdf.attach" | "file.attach";
}

export type TranscriptItem =
  | { kind: "message"; id: string; role: "user" | "assistant"; text: string; streaming?: boolean }
  | {
      kind: "tool";
      id: string;
      name: string;
      status: ToolStatus;
      detail?: string;
      result?: string;
    }
  | { kind: "notice"; id: string; level: "done" | "error"; text: string };

/** 非空字符串或 undefined。 */
function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function num(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function arr(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

/** `session.list` 的容错解析：支持数组 / `{sessions}` / `{items}` / `{active}`。 */
export function normalizeSessions(result: unknown): SessionSummary[] {
  const raw =
    Array.isArray(result) || !result || typeof result !== "object"
      ? result
      : ((result as Record<string, unknown>).sessions ??
        (result as Record<string, unknown>).items ??
        (result as Record<string, unknown>).active ??
        []);
  return arr(raw).flatMap((entry) => {
    const id = str(entry.session_id) ?? str(entry.id);
    if (!id) {
      return [];
    }
    return [
      {
        id,
        title: str(entry.title) ?? str(entry.name) ?? str(entry.summary) ?? "未命名会话",
        updatedAt: str(entry.updated_at) ?? str(entry.updatedAt),
      },
    ];
  });
}

/** 提取 `session.create` 返回的会话 id。 */
export function normalizeCreatedId(result: unknown): string | null {
  if (!result || typeof result !== "object") {
    return null;
  }
  const record = result as Record<string, unknown>;
  return str(record.session_id) ?? str(record.id) ?? str(record.session?.toString()) ?? null;
}

/** `message.delta` / `message.complete` 的增量文本。 */
export function deltaText(payload: Record<string, unknown>): string {
  return str(payload.text) ?? str(payload.delta) ?? str(payload.content) ?? "";
}

export function isSameSession(payload: Record<string, unknown>, activeId: string | null): boolean {
  const id = str(payload.session_id) ?? str(payload.sessionId);
  return !id || id === activeId;
}

/** 追加增量文本：续写末尾的流式助手气泡，否则新建一个。 */
export function appendDelta(
  items: TranscriptItem[],
  text: string,
  id: string,
): TranscriptItem[] {
  const last = items[items.length - 1];
  if (last && last.kind === "message" && last.role === "assistant" && last.streaming) {
    return [...items.slice(0, -1), { ...last, text: last.text + text }];
  }
  return [...items, { kind: "message", id, role: "assistant", text, streaming: true }];
}

/** 收尾流式助手气泡；补齐最终文本。 */
export function completeAssistant(
  items: TranscriptItem[],
  text: string,
  id: string,
): TranscriptItem[] {
  const last = items[items.length - 1];
  if (last && last.kind === "message" && last.role === "assistant" && last.streaming) {
    return [...items.slice(0, -1), { ...last, text: text || last.text, streaming: false }];
  }
  if (text) {
    return [...items, { kind: "message", id, role: "assistant", text, streaming: false }];
  }
  return items;
}

/** `tool.*` 事件的工具名。 */
export function toolName(payload: Record<string, unknown>): string {
  return str(payload.name) ?? str(payload.tool) ?? str(payload.tool_name) ?? "工具";
}

/** `tool.*` 事件的调用 id（没有则回退到工具名，仍可合并同类卡片）。 */
export function toolId(payload: Record<string, unknown>): string {
  return str(payload.id) ?? str(payload.call_id) ?? str(payload.tool_call_id) ?? toolName(payload);
}

/** `thinking` 事件的状态数值（上下文 % / tokens / tok/s）。 */
export function parseStatus(payload: Record<string, unknown>): Omit<StatusInfo, "phase"> {
  const context = payload.context ?? payload.context_usage ?? payload.usage;
  const contextPercent =
    num(payload.context_percent) ??
    num(payload.contextPercent) ??
    num(payload.percent) ??
    (context && typeof context === "object"
      ? num((context as Record<string, unknown>).percent)
      : undefined) ??
    (context && typeof context === "object"
      ? num((context as Record<string, unknown>).percent_used)
      : undefined);
  return {
    contextPercent,
    tokens: num(payload.tokens) ?? num(payload.total_tokens),
    tps: num(payload.tps) ?? num(payload.tokens_per_second),
  };
}
