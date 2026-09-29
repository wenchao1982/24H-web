/**
 * WS `model.options` → 结构化模型目录（TASK-007 / REQ-002 / REQ-009 / REQ-012 / REQ-019）。
 *
 * 与 `settings/model.ts#normalizeModelOptions` **解耦**：后者只产出扁平 `string[]`，
 * 拿不到 `providers[].models` 与 `capabilities[model].fast`（`Flash` 徽标来源）。
 *
 * 原则：任意输入（null / 数组 / 字符串 / 嵌套垃圾）**不得抛异常**；缺失字段**不臆造**。
 */

export interface ModelCapabilities {
  fast?: boolean;
  reasoning?: boolean;
}

export interface ModelOption {
  id: string;
  provider: string;
  label: string;
  capabilities: ModelCapabilities;
  authenticated: boolean;
}

export interface ModelCatalog {
  options: ModelOption[];
  current: { model: string | null; provider: string | null };
}

interface ParsedModel {
  id: string;
  label?: string;
  provider?: string;
  authenticated?: boolean;
  capabilities?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** 非空字符串或 null。 */
function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function bool(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function providerName(record: Record<string, unknown>): string {
  return (
    str(record.slug) ?? str(record.id) ?? str(record.name) ?? str(record.provider) ?? ""
  );
}

/** 解析单个模型条目（string 或对象 `id|name|model`）；无 id 返回 null（不臆造）。 */
function parseModel(raw: unknown): ParsedModel | null {
  if (typeof raw === "string") {
    const id = str(raw);
    return id ? { id } : null;
  }
  const record = asRecord(raw);
  if (!record) {
    return null;
  }
  const id = str(record.id) ?? str(record.name) ?? str(record.model);
  if (!id) {
    return null;
  }
  const parsed: ParsedModel = { id };
  const label = str(record.label) ?? str(record.display_name);
  if (label) {
    parsed.label = label;
  }
  const provider = str(record.provider);
  if (provider) {
    parsed.provider = provider;
  }
  const authenticated = bool(record.authenticated);
  if (authenticated !== undefined) {
    parsed.authenticated = authenticated;
  }
  if (record.capabilities !== undefined) {
    parsed.capabilities = record.capabilities;
  }
  return parsed;
}

function normalizeCapabilities(raw: unknown): ModelCapabilities {
  const record = asRecord(raw);
  if (!record) {
    return {};
  }
  const capabilities: ModelCapabilities = {};
  const fast = bool(record.fast);
  if (fast !== undefined) {
    capabilities.fast = fast;
  }
  const reasoning = bool(record.reasoning);
  if (reasoning !== undefined) {
    capabilities.reasoning = reasoning;
  }
  return capabilities;
}

export function normalizeModelCatalog(payload: unknown): ModelCatalog {
  const empty: ModelCatalog = { options: [], current: { model: null, provider: null } };
  const root = asRecord(payload);
  if (!root) {
    return empty;
  }

  const options: ModelOption[] = [];
  const seen = new Set<string>();
  const push = (option: ModelOption): void => {
    const key = `${option.provider}::${option.id}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    options.push(option);
  };

  const providers = Array.isArray(root.providers) ? root.providers : [];
  for (const rawProvider of providers) {
    const provider = asRecord(rawProvider);
    if (!provider) {
      continue;
    }
    const name = providerName(provider);
    const providerAuthenticated = bool(provider.authenticated);
    const capabilitiesMap = asRecord(provider.capabilities);
    const models = Array.isArray(provider.models) ? provider.models : [];
    for (const rawModel of models) {
      const parsed = parseModel(rawModel);
      if (!parsed) {
        continue;
      }
      const capsRaw = capabilitiesMap ? capabilitiesMap[parsed.id] : undefined;
      push({
        id: parsed.id,
        provider: name,
        label: parsed.label ?? parsed.id,
        capabilities: normalizeCapabilities(capsRaw),
        authenticated: providerAuthenticated ?? parsed.authenticated ?? false,
      });
    }
  }

  const topModels = Array.isArray(root.models)
    ? root.models
    : Array.isArray(root.options)
      ? root.options
      : [];
  for (const rawModel of topModels) {
    const parsed = parseModel(rawModel);
    if (!parsed) {
      continue;
    }
    push({
      id: parsed.id,
      provider: parsed.provider ?? "",
      label: parsed.label ?? parsed.id,
      capabilities: normalizeCapabilities(parsed.capabilities),
      authenticated: parsed.authenticated ?? false,
    });
  }

  return {
    options,
    current: { model: str(root.model), provider: str(root.provider) },
  };
}
