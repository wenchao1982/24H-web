/**
 * 看板（Hermes Kanban 插件，L2 `/api/plugins/kanban/*` 经 BFF `/api/hermes/*` 代理）。
 * 字段以官方为准（`plugins/kanban/dashboard/plugin_api.py`），缺失即降级。
 */
import { api } from "../api/client";

/** `kanban_db.VALID_STATUSES`（与插件 `BOARD_COLUMNS` 同步）。 */
export const BOARD_COLUMNS = [
  "triage",
  "todo",
  "scheduled",
  "ready",
  "running",
  "blocked",
  "review",
  "done",
] as const;

export type KanbanStatus = (typeof BOARD_COLUMNS)[number];

export interface KanbanTask {
  id: string;
  title: string;
  status: KanbanStatus;
  assignee: string | null;
  priority: number;
  latestSummary: string | null;
}

export interface KanbanBoard {
  columns: Record<KanbanStatus, KanbanTask[]>;
  assignees: string[];
  latestEventId: number | null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function normalizeStatus(value: unknown): KanbanStatus {
  const raw = str(value);
  return (BOARD_COLUMNS as readonly string[]).includes(raw ?? "")
    ? (raw as KanbanStatus)
    : "todo";
}

export function normalizeTask(raw: unknown): KanbanTask | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const id = str(record.id) ?? str(record.task_id);
  if (!id) {
    return null;
  }
  return {
    id,
    title: str(record.title) ?? id,
    status: normalizeStatus(record.status),
    assignee: str(record.assignee),
    priority: typeof record.priority === "number" ? record.priority : 0,
    latestSummary: str(record.latest_summary) ?? str(record.latestSummary) ?? str(record.result),
  };
}

/** 容错归一化 `GET /board`：优先 `columns[].tasks`，回退顶层 `tasks[]` 按 status 分桶。 */
export function normalizeBoard(raw: unknown): KanbanBoard {
  const columns: Record<KanbanStatus, KanbanTask[]> = Object.fromEntries(
    BOARD_COLUMNS.map((name) => [name, [] as KanbanTask[]]),
  ) as Record<KanbanStatus, KanbanTask[]>;

  let assignees: string[] = [];
  let latestEventId: number | null = null;

  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    if (Array.isArray(record.assignees)) {
      assignees = record.assignees.filter((entry): entry is string => typeof entry === "string");
    }
    if (typeof record.latest_event_id === "number") {
      latestEventId = record.latest_event_id;
    }

    if (Array.isArray(record.columns)) {
      for (const column of record.columns) {
        if (!column || typeof column !== "object") {
          continue;
        }
        const col = column as Record<string, unknown>;
        const status = normalizeStatus(col.name);
        const tasks = Array.isArray(col.tasks) ? col.tasks : [];
        for (const entry of tasks) {
          const task = normalizeTask(entry);
          if (task) {
            columns[status].push({ ...task, status });
          }
        }
      }
      return { columns, assignees, latestEventId };
    }

    const topTasks = Array.isArray(record.tasks) ? record.tasks : [];
    for (const entry of topTasks) {
      const task = normalizeTask(entry);
      if (task) {
        columns[task.status].push(task);
      }
    }
  }

  return { columns, assignees, latestEventId };
}

const BASE = "/api/hermes/plugins/kanban";

export interface KanbanBoardSummary {
  slug: string;
  name: string;
  total: number;
  isCurrent: boolean;
}

export interface KanbanBoardList {
  boards: KanbanBoardSummary[];
  current: string | null;
}

/** 容错归一化 `GET /boards`（`{boards:[{slug,name,total,is_current}], current}`）。 */
export function normalizeBoardList(raw: unknown): KanbanBoardList {
  const out: KanbanBoardList = { boards: [], current: null };
  if (!raw || typeof raw !== "object") {
    return out;
  }
  const record = raw as Record<string, unknown>;
  out.current = str(record.current);
  if (Array.isArray(record.boards)) {
    out.boards = record.boards.flatMap((entry) => {
      if (!entry || typeof entry !== "object") {
        return [];
      }
      const board = entry as Record<string, unknown>;
      const slug = str(board.slug);
      if (!slug) {
        return [];
      }
      return [
        {
          slug,
          name: str(board.name) ?? slug,
          total: typeof board.total === "number" ? board.total : 0,
          isCurrent: board.is_current === true,
        },
      ];
    });
  }
  return out;
}

export async function fetchBoards(): Promise<KanbanBoardList> {
  return normalizeBoardList(await api<unknown>(`${BASE}/boards`));
}

export async function fetchBoard(slug?: string | null): Promise<KanbanBoard> {
  const query = slug ? `?board=${encodeURIComponent(slug)}` : "";
  return normalizeBoard(await api<unknown>(`${BASE}/board${query}`));
}

/** 导出 board 为便携归档（服务端写入并返回路径）。 */
export async function exportBoard(slug: string): Promise<unknown> {
  return api(`${BASE}/boards/${encodeURIComponent(slug)}/export`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

/** 从归档导入为新 board（archive 为服务端可见路径）。 */
export function importBoard(input: {
  archive: string;
  slug?: string;
  switch?: boolean;
}): Promise<unknown> {
  return api(`${BASE}/boards/import`, { method: "POST", body: JSON.stringify(input) });
}

/** 订阅/退订任务到某平台 home 频道。 */
export function subscribeHome(taskId: string, platform: string): Promise<unknown> {
  return api(
    `${BASE}/tasks/${encodeURIComponent(taskId)}/home-subscribe/${encodeURIComponent(platform)}`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export function unsubscribeHome(taskId: string, platform: string): Promise<unknown> {
  return api(
    `${BASE}/tasks/${encodeURIComponent(taskId)}/home-subscribe/${encodeURIComponent(platform)}`,
    { method: "DELETE" },
  );
}

export function createTask(input: {
  title: string;
  assignee?: string;
  body?: string;
}): Promise<unknown> {
  return api(`${BASE}/tasks`, { method: "POST", body: JSON.stringify(input) });
}

export function updateTaskStatus(id: string, status: KanbanStatus): Promise<unknown> {
  return api(`${BASE}/tasks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function deleteTask(id: string): Promise<unknown> {
  return api(`${BASE}/tasks/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function dispatch(): Promise<unknown> {
  return api(`${BASE}/dispatch`, { method: "POST", body: JSON.stringify({}) });
}

export interface KanbanComment {
  id: string;
  author: string | null;
  body: string;
}

export interface KanbanAttachment {
  id: string;
  filename: string;
  size: number | null;
}

export interface KanbanRun {
  id: string;
  status: string | null;
  outcome: string | null;
  summary: string | null;
}

export interface KanbanLinkTask {
  id: string;
  title: string;
  status: string;
}

export interface KanbanTaskDetail {
  task: KanbanTask | null;
  comments: KanbanComment[];
  attachments: KanbanAttachment[];
  runs: KanbanRun[];
  links: { parents: string[]; children: string[] };
  linkTasks: KanbanLinkTask[];
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

/** 容错归一化 `GET /tasks/:id`（`{task,comments,attachments,runs,links,link_tasks}`）。 */
export function normalizeTaskDetail(raw: unknown): KanbanTaskDetail {
  const detail: KanbanTaskDetail = {
    task: null,
    comments: [],
    attachments: [],
    runs: [],
    links: { parents: [], children: [] },
    linkTasks: [],
  };
  if (!raw || typeof raw !== "object") {
    return detail;
  }
  const record = raw as Record<string, unknown>;
  detail.task = normalizeTask(record.task);

  if (Array.isArray(record.comments)) {
    detail.comments = record.comments.flatMap((entry) => {
      if (!entry || typeof entry !== "object") {
        return [];
      }
      const c = entry as Record<string, unknown>;
      const id = str(c.id);
      if (!id) {
        return [];
      }
      return [{ id, author: str(c.author) ?? str(c.created_by), body: str(c.body) ?? str(c.text) ?? "" }];
    });
  }
  if (Array.isArray(record.attachments)) {
    detail.attachments = record.attachments.flatMap((entry) => {
      if (!entry || typeof entry !== "object") {
        return [];
      }
      const a = entry as Record<string, unknown>;
      const id = str(a.id);
      if (!id) {
        return [];
      }
      return [{ id, filename: str(a.filename) ?? id, size: typeof a.size === "number" ? a.size : null }];
    });
  }
  if (Array.isArray(record.runs)) {
    detail.runs = record.runs.flatMap((entry) => {
      if (!entry || typeof entry !== "object") {
        return [];
      }
      const r = entry as Record<string, unknown>;
      const id = str(r.id) ?? (typeof r.id === "number" ? String(r.id) : null);
      if (!id) {
        return [];
      }
      return [{ id, status: str(r.status), outcome: str(r.outcome), summary: str(r.summary) }];
    });
  }
  if (record.links && typeof record.links === "object") {
    const links = record.links as Record<string, unknown>;
    detail.links = { parents: stringList(links.parents), children: stringList(links.children) };
  }
  if (Array.isArray(record.link_tasks)) {
    detail.linkTasks = record.link_tasks.flatMap((entry) => {
      if (!entry || typeof entry !== "object") {
        return [];
      }
      const t = entry as Record<string, unknown>;
      const id = str(t.id);
      if (!id) {
        return [];
      }
      return [{ id, title: str(t.title) ?? id, status: str(t.status) ?? "todo" }];
    });
  }
  return detail;
}

export async function fetchTask(id: string): Promise<KanbanTaskDetail> {
  const raw = await api<unknown>(`${BASE}/tasks/${encodeURIComponent(id)}`);
  return normalizeTaskDetail(raw);
}
