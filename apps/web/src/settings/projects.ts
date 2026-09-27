/**
 * 设置 → 项目：项目模型、容错解析与「当前项目」本地持久化。
 *
 * 项目 = 具名多文件夹工作区（`project.*`）。字段以官方契约为准，缺失即降级。
 */

export interface Project {
  id: string;
  name: string;
  /** 项目包含的文件夹（多文件夹工作区）。 */
  folders: string[];
  /** 默认目录（新建会话/文件浏览的落点）。 */
  defaultDir?: string;
}

export const PROJECT_STORAGE_KEY = "24h.project";

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function strList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    if (typeof entry === "string") {
      return [entry];
    }
    if (entry && typeof entry === "object") {
      const record = entry as Record<string, unknown>;
      const path = str(record.path) ?? str(record.dir) ?? str(record.folder) ?? str(record.name);
      return path ? [path] : [];
    }
    return [];
  });
}

/** `GET /api/hermes/projects` 的容错解析：数组 / `{projects}` / `{items}`。 */
export function normalizeProjects(payload: unknown): Project[] {
  const raw =
    Array.isArray(payload) || !payload || typeof payload !== "object"
      ? payload
      : ((payload as Record<string, unknown>).projects ??
        (payload as Record<string, unknown>).items ??
        []);
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }
    const record = entry as Record<string, unknown>;
    const id = str(record.id) ?? str(record.slug) ?? str(record.name);
    if (!id) {
      return [];
    }
    return [
      {
        id,
        name: str(record.name) ?? str(record.title) ?? id,
        folders: strList(record.folders ?? record.dirs ?? record.paths),
        defaultDir: str(record.default_dir) ?? str(record.defaultDir) ?? str(record.root),
      },
    ];
  });
}

export function readStoredProject(storage: Storage | undefined = globalThis.localStorage): string | null {
  if (!storage) {
    return null;
  }
  try {
    return storage.getItem(PROJECT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeProject(
  id: string | null,
  storage: Storage | undefined = globalThis.localStorage,
): void {
  if (!storage) {
    return;
  }
  try {
    if (id) {
      storage.setItem(PROJECT_STORAGE_KEY, id);
    } else {
      storage.removeItem(PROJECT_STORAGE_KEY);
    }
  } catch {
    // 存储不可用时忽略
  }
}
