/** 会话全文检索（FTS5）：`GET /api/hermes/sessions/search?q=`（BFF 泛代理）。字段以官方为准，缺失降级。 */
import { api } from "../api/client";

export interface SessionContentMatch {
  id: string;
  title: string;
  snippet: string;
  role: string | null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** 容错归一化 `{ results: [...] }`；按 id 去重（压缩谱系已由服务端合并，这里再防重）。 */
export function normalizeSearchResults(raw: unknown): SessionContentMatch[] {
  if (!raw || typeof raw !== "object") {
    return [];
  }
  const results = (raw as { results?: unknown }).results;
  if (!Array.isArray(results)) {
    return [];
  }
  const seen = new Set<string>();
  const out: SessionContentMatch[] = [];
  for (const entry of results) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const id = str(record.id);
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push({
      id,
      title: str(record.title) ?? id,
      snippet: str(record.snippet) ?? str(record.preview) ?? "",
      role: str(record.role),
    });
  }
  return out;
}

export async function searchSessions(query: string): Promise<SessionContentMatch[]> {
  const q = query.trim();
  if (!q) {
    return [];
  }
  const raw = await api<unknown>(`/api/hermes/sessions/search?q=${encodeURIComponent(q)}`);
  return normalizeSearchResults(raw);
}
