/** 记忆（L2 `/api/memory*`）响应规范化。 */

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
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

export interface MemoryEntry {
  label: string;
  value: string;
}

export interface MemoryProvider {
  id: string;
  name: string;
}

export interface MemoryState {
  provider: string;
  providers: MemoryProvider[];
  entries: MemoryEntry[];
}

function normalizeEntries(value: unknown): MemoryEntry[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        const source = asRecord(item);
        const label = readString(source, "label", "name", "id", "key");
        const raw = source.value ?? source.size ?? source.count ?? source.bytes;
        if (!label || raw == null) {
          return null;
        }
        return { label, value: String(raw) };
      })
      .filter((entry): entry is MemoryEntry => entry !== null);
  }
  const source = asRecord(value);
  return Object.entries(source).map(([label, raw]) => ({ label, value: String(raw) }));
}

function normalizeProviders(value: unknown): MemoryProvider[] {
  const out: MemoryProvider[] = [];
  for (const item of asArray(value)) {
    if (typeof item === "string" && item.trim() !== "") {
      out.push({ id: item.trim(), name: item.trim() });
      continue;
    }
    const source = asRecord(item);
    const id = readString(source, "id", "name", "provider");
    if (id) {
      out.push({ id, name: readString(source, "label", "display_name", "displayName", "name") || id });
    }
  }
  return out;
}

export function normalizeMemory(payload: unknown): MemoryState {
  const source = asRecord(payload);
  const providers = normalizeProviders(source.providers ?? source.available_providers);
  const provider =
    readString(source, "provider", "active_provider", "activeProvider", "backend") ||
    providers[0]?.id ||
    "";
  const entries = normalizeEntries(
    source.sizes ?? source.stats ?? source.stores ?? source.entries ?? source.usage,
  );
  return { provider, providers, entries };
}
