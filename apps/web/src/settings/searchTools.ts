/**
 * M16 T23.8 搜索 / 抽取：`/api/hermes/tools/toolsets/web-search/config` 的容错解析。
 * 只暴露 provider 名与密钥「名称」，密钥值一律掩码，绝不回显。
 */

export interface WebSearchConfig {
  provider: string;
  /** 已配置密钥的名称列表（非值）。 */
  keyNames: string[];
  configured: boolean;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

export function normalizeWebSearch(payload: unknown): WebSearchConfig {
  const outer = asRecord(payload);
  const source = Object.keys(asRecord(outer.config)).length > 0 ? asRecord(outer.config) : outer;
  const provider =
    str(source.provider) ?? str(source.engine) ?? str(source.name) ?? str(source.toolset) ?? "";
  const keysValue = source.keys ?? source.api_keys ?? source.credentials ?? source.env;
  const keyNames: string[] = [];
  if (Array.isArray(keysValue)) {
    for (const entry of keysValue) {
      const name = str(entry) ?? str(asRecord(entry).name);
      if (name) {
        keyNames.push(name);
      }
    }
  } else if (keysValue && typeof keysValue === "object") {
    keyNames.push(...Object.keys(asRecord(keysValue)));
  }
  const enabled = source.enabled;
  const configured = typeof enabled === "boolean" ? enabled : provider !== "" || keyNames.length > 0;
  return { provider, keyNames, configured };
}

/** 掩码占位。 */
export function maskedKey(): string {
  return "••••••••";
}

/** 读取文档抽取开关（兼容多种配置路径）。 */
export function readDocumentExtraction(config: unknown): boolean {
  const record = asRecord(config);
  const direct = asRecord(record.document_extraction ?? record.documentExtraction);
  if (typeof direct.enabled === "boolean") {
    return direct.enabled;
  }
  const tools = asRecord(record.tools);
  const nested = asRecord(tools.document_extraction ?? tools.documentExtraction);
  return nested.enabled === true;
}
