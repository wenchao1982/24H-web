/** BFF 统一错误结构（见 apps/server/src/http/errors.ts）。 */
export interface ApiErrorEnvelope {
  error: string;
  message: string;
}

/** 由 BFF 的 `{ error, message }` 信封构造的强类型错误。 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export const CSRF_COOKIE = "24h_csrf";
export const CSRF_HEADER = "x-csrf-token";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** 读取同名 cookie（同源，SPA 可读；会话 cookie 为 HttpOnly 不可读）。 */
export function readCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const entry = part.trim();
    if (entry.startsWith(prefix)) {
      return decodeURIComponent(entry.slice(prefix.length));
    }
  }
  return null;
}

export type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

/** 注入全局 401 处理（清会话 + 跳登录）。 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

export function getUnauthorizedHandler(): UnauthorizedHandler | null {
  return unauthorizedHandler;
}

/**
 * 调 BFF 的唯一 REST 入口：同源 cookie 认证；非安全方法回显 CSRF 双提交令牌。
 * 失败时抛 `ApiError`（从 `{ error, message }` 解析）；401 额外触发全局处理器。
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);

  if (UNSAFE_METHODS.has(method)) {
    const csrf = readCookie(CSRF_COOKIE);
    if (csrf) {
      headers.set(CSRF_HEADER, csrf);
    }
  }
  if (init.body != null && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(path, {
    credentials: "include",
    ...init,
    method,
    headers,
  });

  if (response.status === 401) {
    unauthorizedHandler?.();
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const envelope = (payload ?? {}) as Partial<ApiErrorEnvelope>;
    const code = typeof envelope.error === "string" ? envelope.error : "HTTP_ERROR";
    const message =
      typeof envelope.message === "string" ? envelope.message : `请求失败（${response.status}）`;
    throw new ApiError(response.status, code, message);
  }

  return payload as T;
}
