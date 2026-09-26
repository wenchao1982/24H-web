/** 设置 → 模型 的规范化工具（宽松解析官方 `/api/model/*`）。 */

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

/** 当前模型：兼容 `{model}` / `{current}` / `{name}` / 纯字符串。 */
export function normalizeModelInfo(payload: unknown): string {
  if (typeof payload === "string") {
    return payload.trim();
  }
  const source = asRecord(payload);
  return readString(source, "model", "current", "current_model", "name", "id");
}

/** 可选模型列表：兼容字符串数组 / `{id,name}` / `{models:[...]}`。 */
export function normalizeModelOptions(payload: unknown): string[] {
  const raw = asRecord(payload);
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(raw.models)
      ? raw.models
      : Array.isArray(raw.options)
        ? raw.options
        : [];
  const out: string[] = [];
  for (const item of list) {
    if (typeof item === "string") {
      if (item.trim() !== "") {
        out.push(item.trim());
      }
    } else {
      const name = readString(asRecord(item), "id", "name", "model");
      if (name) {
        out.push(name);
      }
    }
  }
  return [...new Set(out)];
}

export interface MoaState {
  enabled: boolean;
  models: string[];
}

export function normalizeMoa(payload: unknown): MoaState {
  const source = asRecord(payload);
  const enabled =
    typeof source.enabled === "boolean"
      ? source.enabled
      : source.mode === "moa" || source.active === true;
  const models = Array.isArray(source.models)
    ? source.models.filter((item): item is string => typeof item === "string")
    : [];
  return { enabled, models };
}
