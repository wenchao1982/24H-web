import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AccountPage from "./AccountPage";
import { SessionProvider, type SessionUser } from "../auth/SessionProvider";

const admin: SessionUser = {
  id: 1,
  username: "admin",
  role: "super_admin",
  must_change_password: false,
  profiles: ["default"],
  default_profile: "default",
};

const calls: { method: string; url: string; body: unknown }[] = [];

function stubFetch() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : null });
    const body =
      url.endsWith("/api/auth/me") ? admin : { ok: true, username: "admin" };
    return { ok: true, status: 200, text: async () => JSON.stringify(body) } as Response;
  });
}

function renderPage() {
  return render(
    <SessionProvider initialUser={admin}>
      <AccountPage />
    </SessionProvider>,
  );
}

afterEach(() => {
  calls.length = 0;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AccountPage (M23) 自助资料", () => {
  it("shows role and assigned profiles read-only", () => {
    vi.stubGlobal("fetch", stubFetch());
    renderPage();
    expect(screen.getByText("超级管理员")).toBeInTheDocument();
    expect(screen.getAllByText("default")).toHaveLength(2);
  });

  it("renames the username via PATCH /api/auth/profile", async () => {
    vi.stubGlobal("fetch", stubFetch());
    renderPage();
    const user = userEvent.setup();
    const input = screen.getByLabelText("用户名");
    await user.clear(input);
    await user.type(input, "admin2");
    await user.click(screen.getAllByRole("button", { name: "保存" })[0]);

    await waitFor(() => {
      expect(calls.some((c) => c.method === "PATCH" && c.url.endsWith("/api/auth/profile"))).toBe(
        true,
      );
    });
    expect(screen.getByText("已保存")).toBeInTheDocument();
  });

  it("changes the password via POST /api/auth/change-password", async () => {
    vi.stubGlobal("fetch", stubFetch());
    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("当前密码"), "old-pass-123");
    await user.type(screen.getByLabelText("新密码"), "new-pass-123");
    await user.click(screen.getAllByRole("button", { name: "保存" })[1]);

    await waitFor(() => {
      expect(
        calls.some(
          (c) =>
            c.method === "POST" &&
            c.url.endsWith("/api/auth/change-password") &&
            (c.body as { newPassword?: string }).newPassword === "new-pass-123",
        ),
      ).toBe(true);
    });
    expect(screen.getByText("密码已更新")).toBeInTheDocument();
  });
});
