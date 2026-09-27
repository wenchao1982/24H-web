/**
 * 设置 → 高级 → 运维：doctor / backup / import / dump 的请求体与结果解析。
 *
 * 字段以官方契约为准（`/api/ops/*`），缺失即降级为原始文本。
 */

export const OPS_ACTIONS = ["doctor", "backup", "import", "dump"] as const;

export type OpsAction = (typeof OPS_ACTIONS)[number];

export interface OpsResult {
  status: string;
  output: string;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/** 构造 `POST /api/hermes/ops/<action>` 的请求体（import 可带路径）。 */
export function buildOpsBody(action: OpsAction, path?: string): Record<string, unknown> {
  if (action === "import" && path && path.trim() !== "") {
    return { path: path.trim() };
  }
  return {};
}

/** 容错解析运维结果：字符串 / `{status, output|report|message|result}` / 其它对象。 */
export function normalizeOpsResult(payload: unknown): OpsResult {
  if (typeof payload === "string") {
    return { status: "ok", output: payload };
  }
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const output =
      str(record.output) ??
      str(record.report) ??
      str(record.message) ??
      str(record.result);
    if (output) {
      return { status: str(record.status) ?? "ok", output };
    }
    return { status: str(record.status) ?? "ok", output: JSON.stringify(record, null, 2) };
  }
  return { status: "ok", output: "" };
}
