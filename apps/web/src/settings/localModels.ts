/**
 * 设置 → 高级 → 本地模型：状态 / 模型库的容错解析与动作请求体。
 *
 * 字段以官方契约为准（`/api/local-models/*`），缺失即降级。
 */

export type LocalModelState = "running" | "stopped" | "downloading" | "unknown";

export interface LocalModel {
  id: string;
  name: string;
  state: LocalModelState;
  size?: string;
}

export interface LocalModelCatalogEntry {
  id: string;
  name: string;
  size?: string;
  installed: boolean;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function pickList(payload: unknown, keys: string[]): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of keys) {
      if (Array.isArray(record[key])) {
        return record[key] as unknown[];
      }
    }
  }
  return [];
}

export function normalizeModelState(value: unknown): LocalModelState {
  const raw = String(value ?? "").toLowerCase();
  if (raw.includes("run") || raw.includes("active") || raw.includes("load")) {
    return "running";
  }
  if (raw.includes("download") || raw.includes("pull") || raw.includes("progress")) {
    return "downloading";
  }
  if (raw.includes("stop") || raw.includes("idle") || raw.includes("eject")) {
    return "stopped";
  }
  return "unknown";
}

/** `GET /api/hermes/local-models/status` 的容错解析。 */
export function normalizeLocalModels(payload: unknown): LocalModel[] {
  return pickList(payload, ["models", "installed", "items"]).flatMap((entry): LocalModel[] => {
    if (typeof entry === "string") {
      return [{ id: entry, name: entry, state: "unknown" as const }];
    }
    if (!entry || typeof entry !== "object") {
      return [];
    }
    const record = entry as Record<string, unknown>;
    const id = str(record.id) ?? str(record.name) ?? str(record.model);
    if (!id) {
      return [];
    }
    return [
      {
        id,
        name: str(record.name) ?? id,
        state: normalizeModelState(record.status ?? record.state),
        size: str(record.size) ?? str(record.size_human) ?? str(record.download_size),
      },
    ];
  });
}

/** `GET /api/hermes/local-models/catalog` 的容错解析。 */
export function normalizeCatalog(payload: unknown): LocalModelCatalogEntry[] {
  return pickList(payload, ["models", "catalog", "items"]).flatMap((entry): LocalModelCatalogEntry[] => {
    if (typeof entry === "string") {
      return [{ id: entry, name: entry, installed: false }];
    }
    if (!entry || typeof entry !== "object") {
      return [];
    }
    const record = entry as Record<string, unknown>;
    const id = str(record.id) ?? str(record.name) ?? str(record.model);
    if (!id) {
      return [];
    }
    return [
      {
        id,
        name: str(record.name) ?? id,
        size: str(record.size) ?? str(record.size_human),
        installed: record.installed === true || normalizeModelState(record.status) !== "unknown",
      },
    ];
  });
}

export type LocalModelAction = "download" | "start" | "eject";

/** 构造 `POST /api/hermes/local-models/<action>` 的请求体。 */
export function buildLocalModelAction(
  _action: LocalModelAction,
  id: string,
): Record<string, unknown> {
  return { id };
}

/** 动作成功后的提示文案键（用于 `t()`）。 */
export function modelStateKey(state: LocalModelState): string {
  switch (state) {
    case "running":
      return "localModels.state.running";
    case "downloading":
      return "localModels.state.downloading";
    case "stopped":
      return "localModels.state.stopped";
    default:
      return "localModels.state.unknown";
  }
}
