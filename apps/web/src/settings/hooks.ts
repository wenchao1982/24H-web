/**
 * M16 T23.7 Event Hooks：解析 `hooks` 配置为可管理的钩子列表。
 * 兼容数组（`[{name,event,enabled}]`）与对象（`{name: {...}}`）两种形态，并识别 shell 钩子。
 */

export interface HookEntry {
  /** 稳定 id（对象形态为 key，数组形态为索引）。 */
  id: string;
  name: string;
  event: string;
  enabled: boolean;
  shell: boolean;
}

export interface HooksState {
  entries: HookEntry[];
  raw: unknown;
  form: "array" | "object" | "none";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function readEntry(id: string, name: string, source: Record<string, unknown>): HookEntry {
  const enabled = source.enabled !== false && source.disabled !== true;
  const shell =
    source.shell === true ||
    source.type === "shell" ||
    source.kind === "shell" ||
    typeof source.command === "string";
  return {
    id,
    name,
    event: str(source.event) ?? str(source.on) ?? str(source.trigger) ?? "",
    enabled,
    shell,
  };
}

/** 从完整 config 中提取 hooks。 */
export function normalizeHooks(config: unknown): HooksState {
  const raw = asRecord(config).hooks;
  if (Array.isArray(raw)) {
    const entries = raw.map((item, index) => {
      const source = asRecord(item);
      return readEntry(String(index), str(source.name) ?? `hook-${index}`, source);
    });
    return { entries, raw, form: "array" };
  }
  if (raw && typeof raw === "object") {
    const record = asRecord(raw);
    const entries = Object.entries(record).map(([name, value]) => {
      const source = asRecord(value);
      if (typeof value === "boolean") {
        return { id: name, name, event: "", enabled: value, shell: false };
      }
      return readEntry(name, name, source);
    });
    return { entries, raw, form: "object" };
  }
  return { entries: [], raw: raw ?? {}, form: "none" };
}

/** 依据当前 state 生成切换 enabled 后的新 hooks 原始值。 */
export function applyHookToggle(state: HooksState, id: string, enabled: boolean): unknown {
  if (state.form === "array") {
    const list = Array.isArray(state.raw) ? [...state.raw] : [];
    return list.map((item, index) => {
      const source = asRecord(item);
      return String(index) === id ? { ...source, enabled } : item;
    });
  }
  const record = asRecord(state.raw);
  const current = record[id];
  if (typeof current === "boolean") {
    return { ...record, [id]: enabled };
  }
  return { ...record, [id]: { ...asRecord(current), enabled } };
}
