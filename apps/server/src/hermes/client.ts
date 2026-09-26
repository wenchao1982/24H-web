import { ApiError } from "../http/errors";

export interface HermesUpstreamConfig {
  hermesBaseUrl: string;
}

export interface HermesUpstream {
  baseUrl: string;
  wsBaseUrl: string;
}

const TOKEN_TTL_MS = 60_000;
const TOKEN_PATTERN = /window\.__HERMES_SESSION_TOKEN__\s*=\s*"([^"]+)"/;

interface TokenCacheEntry {
  token: string;
  expiresAt: number;
}

const tokenCache = new Map<string, TokenCacheEntry>();

function normalizeBase(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

function toWsBase(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return normalizeBase(url.toString());
}

/**
 * Resolve the upstream Hermes base URLs. `overrideBaseUrl` lets the caller
 * point at a managed connection instead of the configured default.
 */
export function hermesUpstream(
  config: HermesUpstreamConfig,
  overrideBaseUrl?: string | null,
): HermesUpstream {
  const base = normalizeBase(overrideBaseUrl ?? config.hermesBaseUrl);
  return { baseUrl: base, wsBaseUrl: toWsBase(base) };
}

export function clearHermesTokenCache(baseUrl?: string): void {
  if (baseUrl === undefined) {
    tokenCache.clear();
    return;
  }
  tokenCache.delete(normalizeBase(baseUrl));
}

/**
 * Discover (and cache) the Hermes session token. The token is served by the
 * upstream root page and is never returned to clients.
 */
export async function getHermesToken(
  baseUrl: string,
  options: { force?: boolean } = {},
): Promise<string> {
  const key = normalizeBase(baseUrl);
  const now = Date.now();

  if (!options.force) {
    const cached = tokenCache.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.token;
    }
  }

  let response: Response;
  try {
    response = await fetch(`${key}/`, { redirect: "follow" });
  } catch {
    throw new ApiError(502, "HERMES_UNREACHABLE", "无法连接 Hermes 上游");
  }

  if (!response.ok) {
    throw new ApiError(502, "HERMES_UNREACHABLE", `Hermes 上游返回 ${response.status}`);
  }

  const html = await response.text();
  const match = TOKEN_PATTERN.exec(html);
  if (!match) {
    throw new ApiError(502, "HERMES_TOKEN_MISSING", "无法从 Hermes 页面提取会话令牌");
  }

  const token = match[1];
  tokenCache.set(key, { token, expiresAt: now + TOKEN_TTL_MS });
  return token;
}
