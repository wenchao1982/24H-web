/**
 * 对话 → 图片生成：L1 `image.generate` 结果的容错解析。
 *
 * 支持 `url` / `image_url` / `images[0]` / `b64_json` / 纯字符串 等形态。
 */

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function fromString(value: string): string {
  if (/^(https?:|data:|blob:)/.test(value)) {
    return value;
  }
  return `data:image/png;base64,${value}`;
}

/** 从 `image.generate` 结果中提取可渲染的图片地址（data/URL），失败返回 null。 */
export function normalizeGeneratedImage(payload: unknown): string | null {
  if (typeof payload === "string") {
    const value = str(payload);
    return value ? fromString(value) : null;
  }
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const direct =
    str(record.url) ??
    str(record.image_url) ??
    str(record.image) ??
    str(record.src) ??
    str(record.output_url);
  if (direct) {
    return fromString(direct);
  }
  const nested = record.images ?? record.data ?? record.results;
  if (Array.isArray(nested) && nested.length > 0) {
    return normalizeGeneratedImage(nested[0]);
  }
  const base64 = str(record.b64_json) ?? str(record.base64);
  return base64 ? fromString(base64) : null;
}

export function imageParams(prompt: string): Record<string, unknown> {
  return { prompt };
}
