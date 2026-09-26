import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "../App";
import { api } from "../api/client";
import { SessionProvider } from "./SessionProvider";

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("全局 401", () => {
  it("clears the session and redirects to /login when api returns 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/api/auth/me")) {
          return jsonResponse(200, {
            id: 1,
            username: "root",
            role: "super_admin",
            must_change_password: false,
            profiles: [],
            default_profile: null,
          });
        }
        if (url.endsWith("/api/boom")) {
          return jsonResponse(401, { error: "UNAUTHENTICATED", message: "登录已过期" });
        }
        return jsonResponse(404, {});
      }),
    );

    render(
      <MemoryRouter initialEntries={["/chat"]}>
        <SessionProvider>
          <AppRoutes />
        </SessionProvider>
      </MemoryRouter>,
    );

    await screen.findByRole("navigation", { name: "主导航" });

    await act(async () => {
      await api("/api/boom").catch(() => undefined);
    });

    expect(await screen.findByRole("heading", { name: "登录" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "主导航" })).not.toBeInTheDocument();
  });
});
