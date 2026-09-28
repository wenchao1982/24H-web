import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AdminUsersPage from "./AdminUsersPage";
import { AppRoutes } from "../App";
import { SessionProvider } from "../auth/SessionProvider";
import { ToastProvider } from "../ui/Toast";

interface StubRoute {
  path: string;
  method?: string;
  status: number;
  body: unknown;
}

function jsonResponse(hit: StubRoute): Response {
  return {
    ok: hit.status >= 200 && hit.status < 300,
    status: hit.status,
    text: async () => JSON.stringify(hit.body),
  } as Response;
}

function stubFetch(handlers: StubRoute[]) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    const hit = handlers.find(
      (handler) => url.endsWith(handler.path) && (!handler.method || handler.method === method),
    );
    if (!hit) {
      return { ok: false, status: 404, text: async () => "" } as Response;
    }
    return jsonResponse(hit);
  });
}

const alice = {
  id: 2,
  username: "alice",
  role: "admin" as const,
  status: "active" as const,
  profiles: ["default"],
  default_profile: "default",
  must_change_password: 0,
};

const bob = {
  id: 3,
  username: "bob",
  role: "super_admin" as const,
  status: "disabled" as const,
  profiles: [],
  default_profile: null,
  must_change_password: 1,
};

function renderPage() {
  return render(
    <ToastProvider>
      <AdminUsersPage />
    </ToastProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AdminUsersPage", () => {
  it("renders the user list with roles, status and profiles", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch([{ path: "/api/admin/users", method: "GET", status: 200, body: [alice, bob] }]),
    );
    renderPage();

    const row = (await screen.findByText("alice")).closest("tr") as HTMLTableRowElement;
    expect(within(row).getByText("启用")).toBeInTheDocument();
    expect(within(row).getByText("default")).toBeInTheDocument();
    expect((within(row).getByLabelText("角色 alice") as HTMLSelectElement).value).toBe("admin");

    const bobRow = screen.getByText("bob").closest("tr") as HTMLTableRowElement;
    expect(within(bobRow).getByText("禁用")).toBeInTheDocument();
    expect((within(bobRow).getByLabelText("角色 bob") as HTMLSelectElement).value).toBe(
      "super_admin",
    );
  });

  it("creates a user with the exact request body", async () => {
    const fetchMock = stubFetch([
      { path: "/api/admin/users", method: "GET", status: 200, body: [alice] },
      { path: "/api/admin/users", method: "POST", status: 201, body: { ...alice, id: 4 } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("alice");
    await user.type(screen.getByLabelText("新用户名"), "carol");
    await user.type(screen.getByLabelText("新密码"), "secret123");
    await user.selectOptions(screen.getByLabelText("新角色"), "super_admin");
    await user.click(screen.getByRole("button", { name: "创建" }));

    const createCall = fetchMock.mock.calls.find(
      (call) => (call[1] as RequestInit | undefined)?.method === "POST",
    );
    expect(createCall).toBeTruthy();
    expect(String(createCall?.[0])).toContain("/api/admin/users");
    expect(JSON.parse(String((createCall?.[1] as RequestInit).body))).toEqual({
      username: "carol",
      password: "secret123",
      role: "super_admin",
    });
    expect((screen.getByLabelText("新用户名") as HTMLInputElement).value).toBe("");
  });

  it("deletes a user via DELETE after confirmation", async () => {
    const fetchMock = stubFetch([
      { path: "/api/admin/users", method: "GET", status: 200, body: [alice] },
      { path: "/api/admin/users/2", method: "DELETE", status: 200, body: { ok: true } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderPage();

    const row = (await screen.findByText("alice")).closest("tr") as HTMLTableRowElement;
    await user.click(within(row).getByRole("button", { name: "删除" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "确认删除" }));

    const deleteCall = fetchMock.mock.calls.find(
      (call) => (call[1] as RequestInit | undefined)?.method === "DELETE",
    );
    expect(deleteCall).toBeTruthy();
    expect(String(deleteCall?.[0])).toContain("/api/admin/users/2");
  });
});

function renderAppAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SessionProvider>
        <AppRoutes />
      </SessionProvider>
    </MemoryRouter>,
  );
}

describe("RequireSuperAdmin", () => {
  it("redirects an admin away from /admin/users back to /chat", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch([
        {
          path: "/api/auth/me",
          status: 200,
          body: { id: 2, username: "alice", role: "admin", must_change_password: false },
        },
      ]),
    );

    renderAppAt("/admin/users");

    expect(await screen.findByRole("heading", { name: "对话", level: 2 })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "新建用户" })).not.toBeInTheDocument();
  });
});
