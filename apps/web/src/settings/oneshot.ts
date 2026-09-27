/**
 * 设置 → 高级 → 单次补全：L1 `llm.oneshot` 参数与结果解析。
 *
 * 字段以官方契约为准，缺失即降级为原始文本。
 */

export function oneshotParams(prompt: string, model?: string): Record<string, unknown> {
  const params: Record<string, unknown> = { prompt };
  if (model && model.trim() !== "") {
    params.model = model.trim();
  }
  return params;
}

/** 容错解析 `llm.oneshot` 返回：字符串 / `{text|output|completion|content|result}`。 */
export function normalizeOneshot(payload: unknown): string {
  if (typeof payload === "string") {
    return payload;
  }
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of ["text", "output", "completion", "content", "result", "message"]) {
      const value = record[key];
      if (typeof value === "string" && value !== "") {
        return value;
      }
    }
    return JSON.stringify(record);
  }
  return "";
}
