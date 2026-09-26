/** Git 面板数据规范化（宽松解析官方 `/api/git/*`）。 */

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readString(source: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }
  return "";
}

export interface GitFileChange {
  path: string;
  status: string;
}

export interface GitStatus {
  branch: string;
  clean: boolean;
  changes: GitFileChange[];
}

/** Git 状态：兼容 `{files|changes|entries:[...]}`。 */
export function normalizeGitStatus(payload: unknown): GitStatus {
  const root = asRecord(payload);
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(root.files)
      ? root.files
      : Array.isArray(root.changes)
        ? root.changes
        : Array.isArray(root.entries)
          ? root.entries
          : [];
  const changes: GitFileChange[] = [];
  for (const item of list) {
    const source = asRecord(item);
    const path = readString(source, "path", "file", "name");
    const code =
      readString(source, "status", "state", "code", "working_dir", "index") ||
      readString(source, "status_code");
    if (!path) {
      continue;
    }
    changes.push({ path, status: code });
  }
  return {
    branch: readString(root, "branch", "current", "head"),
    clean: typeof root.clean === "boolean" ? root.clean : changes.length === 0,
    changes,
  };
}

/** Git 差异：兼容纯字符串与 `{diff|patch}`。 */
export function normalizeGitDiff(payload: unknown): string {
  if (typeof payload === "string") {
    return payload;
  }
  const source = asRecord(payload);
  return readString(source, "diff", "patch", "content");
}
