/**
 * 由官方 `hermes dashboard` 注入到 index.html 的运行时变量。
 * 见 hermes_cli/web_server_dashboard.py#_serve_index。
 */
declare global {
  interface Window {
    __HERMES_SESSION_TOKEN__?: string;
    __HERMES_BASE_PATH__?: string;
    __HERMES_AUTH_REQUIRED__?: boolean;
  }
}

export const BASE: string = window.__HERMES_BASE_PATH__ ?? "";
/** 未启用 auth gate 时才有值；gated 模式靠 cookie + /api/auth/ws-ticket。 */
export const TOKEN: string | undefined = window.__HERMES_SESSION_TOKEN__;
export const AUTH_REQUIRED: boolean = window.__HERMES_AUTH_REQUIRED__ === true;
