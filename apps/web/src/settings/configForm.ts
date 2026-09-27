/** M16 通用：配置中心（`/api/hermes/config`）的读写与 JSON 展示工具。 */

import { api } from "../api/client";
import { buildPatch, normalizeConfig, readPath } from "./config";

/** 读取并解包 `GET /api/hermes/config`。 */
export async function loadConfig(): Promise<Record<string, unknown>> {
  return normalizeConfig(await api<unknown>("/api/hermes/config"));
}

/** 以扁平点路径写入配置（`PUT /api/hermes/config`）。 */
export async function saveConfigPath(path: string, value: unknown): Promise<void> {
  await api("/api/hermes/config", {
    method: "PUT",
    body: JSON.stringify(buildPatch({ [path]: value })),
  });
}

/** 读取某点路径的配置值。 */
export function configValue(
  config: Record<string, unknown>,
  path: string,
): unknown {
  return readPath(config, path);
}

/** 安全地把任意值格式化为 2 空格缩进 JSON。 */
export function formatJson(value: unknown): string {
  if (value === undefined) {
    return "{}";
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}
