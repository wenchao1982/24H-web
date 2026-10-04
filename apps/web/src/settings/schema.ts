/**
 * 配置 schema（C04）：`GET /api/hermes/config/schema` →
 * `{ fields: { "<dot.path>": { type, description, category, options? } }, category_order }`。
 * 设置面板据此**动态生成**字段，避免硬编码错误 path/类型。
 */
import { api } from "../api/client";
import type { ConfigFieldDef, ConfigFieldType } from "./ConfigFieldsPanel";

export interface ConfigSchemaField {
  type: string;
  description: string;
  category: string;
  options?: string[];
}

export interface ConfigSchema {
  fields: Record<string, ConfigSchemaField>;
  categoryOrder: string[];
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** 容错归一化 schema 响应。 */
export function normalizeConfigSchema(raw: unknown): ConfigSchema {
  const out: ConfigSchema = { fields: {}, categoryOrder: [] };
  if (!raw || typeof raw !== "object") {
    return out;
  }
  const record = raw as Record<string, unknown>;
  const fields = record.fields;
  if (fields && typeof fields === "object") {
    for (const [path, entry] of Object.entries(fields as Record<string, unknown>)) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const field = entry as Record<string, unknown>;
      const options = Array.isArray(field.options)
        ? field.options.filter((option): option is string => typeof option === "string")
        : undefined;
      out.fields[path] = {
        type: str(field.type) ?? "string",
        description: str(field.description) ?? path,
        category: str(field.category) ?? "general",
        ...(options && options.length > 0 ? { options } : {}),
      };
    }
  }
  if (Array.isArray(record.category_order)) {
    out.categoryOrder = record.category_order.filter(
      (entry): entry is string => typeof entry === "string",
    );
  }
  return out;
}

export async function fetchConfigSchema(): Promise<ConfigSchema> {
  return normalizeConfigSchema(await api<unknown>("/api/hermes/config/schema"));
}

function fieldType(field: ConfigSchemaField): ConfigFieldType {
  if (field.options && field.options.length > 0) {
    return "select";
  }
  if (field.type === "boolean") {
    return "boolean";
  }
  if (field.type === "integer" || field.type === "number" || field.type === "float") {
    return "number";
  }
  return "string";
}

/** 取某前缀（含自身）下的 schema 字段，转成面板可渲染的字段定义。 */
export function schemaFieldsForPrefix(schema: ConfigSchema, prefix: string): ConfigFieldDef[] {
  const out: ConfigFieldDef[] = [];
  for (const [path, field] of Object.entries(schema.fields)) {
    if (path !== prefix && !path.startsWith(`${prefix}.`)) {
      continue;
    }
    out.push({
      path,
      label: field.description,
      type: fieldType(field),
      ...(field.options ? { options: field.options } : {}),
    });
  }
  return out;
}
