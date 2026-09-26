import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LoginPage from "./LoginPage";
import { SessionProvider } from "../auth/SessionProvider";

interface StubRoute {
  path: string;
  method?: string;
  status: number;
  body: unknown;
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
    return {
      ok: hit.status >= 200 && hit.status < 300,
      status: hit.status,
      text: async () => JSON.stringify(hit.body),
    } as Response;
  });
}

const meUnauthenticated: StubRoute = {
  path: "/api/auth/me",
  status: 401,
  body: { error: "UNAUTHENTICATED", message: "未登录" },
};

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <SessionProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/chat" element={<div>已进入应用</div>} />
        </Routes>
      </SessionProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LoginPage", () => {
  it("submits credentials and navigates into the app", async () => {
    const fetchMock = stubFetch([
      meUnauthenticated,
      {
        path: "/api/auth/login",
        method: "POST",
        status: 200,
        body: { user: { id: 1, username: "alice", role: "admin", must_change_password: false } },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText("用户名"), "alice");
    await user.type(screen.getByLabelText("密码"), "secret123");
    await user.click(screen.getByRole("button", { name: "登录" }));

    expect(await screen.findByText("已进入应用")).toBeInTheDocument();

    const loginCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).endsWith("/api/auth/login"),
    );
    expect(loginCall).toBeTruthy();
    const init = loginCall?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({ username: "alice", password: "secret123" });
  });

  it("shows the server error on invalid credentials", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch([
        meUnauthenticated,
        {
          path: "/api/auth/login",
          method: "POST",
          status: 401,
          body: { error: "INVALID_CREDENTIALS", message: "用户名或密码错误" },
        },
      ]),
    );
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText("用户名"), "alice");
    await user.type(screen.getByLabelText("密码"), "wrong");
    await user.click(screen.getByRole("button", { name: "登录" }));

    expect(await screen.findByText("用户名或密码错误")).toBeInTheDocument();
  });

  it("routes a first-login user through the change-password step", async () => {
    const fetchMock = stubFetch([
      meUnauthenticated,
      {
        path: "/api/auth/login",
        method: "POST",
        status: 200,
        body: { user: { id: 1, username: "alice", role: "admin", must_change_password: true } },
      },
      { path: "/api/auth/change-password", method: "POST", status: 200, body: { ok: true } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText("用户名"), "alice");
    await user.type(screen.getByLabelText("密码"), "secret123");
    await user.click(screen.getByRole("button", { name: "登录" }));

    expect(await screen.findByRole("heading", { name: "修改密码" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("新密码"), "brandnew123");
    await user.click(screen.getByRole("button", { name: "修改密码" }));

    expect(await screen.findByText("已进入应用")).toBeInTheDocument();
    const changeCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).endsWith("/api/auth/change-password"),
    );
    expect(changeCall).toBeTruthy();
    const init = changeCall?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      oldPassword: "secret123",
      newPassword: "brandnew123",
    });
  });
});
