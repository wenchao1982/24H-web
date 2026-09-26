import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "../App";
import { SessionProvider } from "./SessionProvider";

type MeUser = {
  id: number;
  username: string;
  role: "super_admin" | "admin";
  must_change_password: boolean;
};

function mockFetch(me: MeUser | null): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/auth/me")) {
        if (me) {
          return { ok: true, status: 200, text: async () => JSON.stringify(me) } as Response;
        }
        return {
          ok: false,
          status: 401,
          text: async () => JSON.stringify({ error: "UNAUTHENTICATED", message: "未登录" }),
        } as Response;
      }
      return { ok: false, status: 404, text: async () => "" } as Response;
    }),
  );
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SessionProvider>
        <AppRoutes />
      </SessionProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("路由与登录守卫", () => {
  it("redirects unauthenticated visitors to the login page", async () => {
    mockFetch(null);
    renderAt("/chat");

    expect(await screen.findByRole("heading", { name: "登录" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "主导航" })).not.toBeInTheDocument();
  });

  it("renders the app shell for an authenticated user", async () => {
    mockFetch({ id: 1, username: "root", role: "super_admin", must_change_password: false });
    renderAt("/chat");

    expect(await screen.findByRole("navigation", { name: "主导航" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "对话" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "对话", level: 2 })).toBeInTheDocument();
  });

  it("shows the 管理 entry only to super_admin", async () => {
    mockFetch({ id: 1, username: "root", role: "super_admin", must_change_password: false });
    const superAdmin = renderAt("/chat");
    expect(await screen.findByRole("button", { name: "管理" })).toBeInTheDocument();
    superAdmin.unmount();

    mockFetch({ id: 2, username: "ops", role: "admin", must_change_password: false });
    renderAt("/chat");
    await screen.findByRole("navigation", { name: "主导航" });
    expect(screen.queryByRole("button", { name: "管理" })).not.toBeInTheDocument();
  });
});
