import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, setUnauthorizedHandler } from "./client";

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

afterEach(() => {
  document.cookie = "24h_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  setUnauthorizedHandler(null);
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("echoes the 24h_csrf cookie on unsafe methods", async () => {
    document.cookie = "24h_csrf=tok-123; path=/";
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await api("/api/admin/users", { method: "POST", body: JSON.stringify({ username: "alice" }) });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/admin/users");
    expect(init.credentials).toBe("include");
    expect(init.method).toBe("POST");
    const headers = init.headers as Headers;
    expect(headers.get("x-csrf-token")).toBe("tok-123");
    expect(headers.get("content-type")).toBe("application/json");
  });

  it("does not attach the CSRF header on safe GET requests", async () => {
    document.cookie = "24h_csrf=tok-123; path=/";
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await api("/api/auth/me");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Headers).has("x-csrf-token")).toBe(false);
  });

  it("parses the error envelope into an ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(400, { error: "INVALID_INPUT", message: "用户名不能为空" }),
      ),
    );

    await expect(api("/api/admin/users")).rejects.toBeInstanceOf(ApiError);
    await expect(api("/api/admin/users")).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      code: "INVALID_INPUT",
      message: "用户名不能为空",
    });
  });

  it("invokes the global 401 handler", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(401, { error: "UNAUTHENTICATED", message: "未登录" })),
    );

    await expect(api("/api/auth/me")).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
