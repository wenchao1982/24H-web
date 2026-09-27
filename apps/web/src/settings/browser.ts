/**
 * 设置 → 高级 → 浏览器控制：L1 `browser.manage` 的状态解析。
 *
 * 字段以官方契约为准，缺失即降级。
 */

export type BrowserAction = "status" | "connect" | "disconnect";

export interface BrowserStatus {
  connected: boolean;
  url?: string;
  engine?: string;
  message?: string;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

export function browserParams(action: BrowserAction): Record<string, unknown> {
  return { action };
}

/** 容错解析 `browser.manage` 返回：布尔 / `{connected|active|running}` / `{status}`。 */
export function normalizeBrowserStatus(payload: unknown): BrowserStatus {
  if (typeof payload === "boolean") {
    return { connected: payload };
  }
  if (!payload || typeof payload !== "object") {
    return { connected: false };
  }
  const record = payload as Record<string, unknown>;
  const raw = String(record.status ?? "").toLowerCase();
  const connected =
    record.connected === true ||
    record.active === true ||
    record.running === true ||
    raw === "connected" ||
    raw === "active" ||
    raw === "running";
  const status: BrowserStatus = { connected };
  const url = str(record.url) ?? str(record.target);
  if (url) {
    status.url = url;
  }
  const engine = str(record.engine) ?? str(record.backend);
  if (engine) {
    status.engine = engine;
  }
  const message = str(record.message) ?? str(record.error);
  if (message) {
    status.message = message;
  }
  return status;
}
