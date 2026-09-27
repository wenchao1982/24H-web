import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProjectsPanel from "./ProjectsPanel";
import { normalizeProjects, PROJECT_STORAGE_KEY } from "./projects";

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
      (handler) =>
        url.split("?")[0].endsWith(handler.path) &&
        (!handler.method || handler.method === method),
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

const PROJECTS = {
  projects: [
    { id: "alpha", name: "Alpha", folders: ["/a", "/b"], default_dir: "/a" },
    { id: "beta", name: "Beta", folders: [] },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("ProjectsPanel T21.1 项目列表/切换", () => {
  it("renders projects from the API and persists the selected one", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch([{ path: "/api/hermes/projects", method: "GET", status: 200, body: PROJECTS }]),
    );
    const user = userEvent.setup();
    render(<ProjectsPanel />);

    const alpha = await screen.findByRole("button", { name: "选择项目 Alpha" });
    expect(screen.getByRole("button", { name: "选择项目 Beta" })).toBeInTheDocument();
    expect(screen.getByText("/a · /b")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "选择项目 Beta" }));

    expect(localStorage.getItem(PROJECT_STORAGE_KEY)).toBe("beta");
    expect(screen.getByRole("button", { name: "选择项目 Beta" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(alpha).toHaveAttribute("aria-pressed", "false");
  });

  it("restores the stored current project on mount", async () => {
    localStorage.setItem(PROJECT_STORAGE_KEY, "beta");
    vi.stubGlobal(
      "fetch",
      stubFetch([{ path: "/api/hermes/projects", method: "GET", status: 200, body: PROJECTS }]),
    );
    render(<ProjectsPanel />);

    expect(await screen.findByRole("button", { name: "选择项目 Beta" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "选择项目 Alpha" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("creates a project with the exact POST body", async () => {
    const fetchMock = stubFetch([
      { path: "/api/hermes/projects", method: "GET", status: 200, body: { projects: [] } },
      { path: "/api/hermes/projects", method: "POST", status: 200, body: { ok: true } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ProjectsPanel />);

    await user.click(await screen.findByRole("button", { name: "新建项目" }));
    await user.type(screen.getByLabelText("名称"), "Gamma");
    await user.type(screen.getByLabelText("文件夹"), "/x,/y");
    await user.type(screen.getByLabelText("默认目录"), "/x");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (entry) => (entry[1] as RequestInit | undefined)?.method === "POST",
      );
      expect(call).toBeTruthy();
      expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({
        name: "Gamma",
        folders: ["/x", "/y"],
        default_dir: "/x",
      });
    });
  });

  it("deletes a project via DELETE and PATCHes edits", async () => {
    const fetchMock = stubFetch([
      { path: "/api/hermes/projects", method: "GET", status: 200, body: PROJECTS },
      { path: "/api/hermes/projects/alpha", method: "DELETE", status: 200, body: { ok: true } },
      { path: "/api/hermes/projects/beta", method: "PATCH", status: 200, body: { ok: true } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ProjectsPanel />);

    await user.click(await screen.findByRole("button", { name: "删除项目 Alpha" }));
    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (entry) => String(entry[0]).endsWith("/api/hermes/projects/alpha"),
      );
      expect(call).toBeTruthy();
      expect((call?.[1] as RequestInit).method).toBe("DELETE");
    });

    await user.click(screen.getByRole("button", { name: "编辑项目 Beta" }));
    const nameInput = screen.getByLabelText("名称");
    await user.clear(nameInput);
    await user.type(nameInput, "Beta2");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (entry) =>
          String(entry[0]).endsWith("/api/hermes/projects/beta") &&
          (entry[1] as RequestInit | undefined)?.method === "PATCH",
      );
      expect(call).toBeTruthy();
      expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({
        name: "Beta2",
        folders: [],
        default_dir: "",
      });
    });
  });

  it("normalizeProjects tolerates array / items / dirs variants", () => {
    expect(normalizeProjects([{ slug: "s", title: "S", dirs: ["/x"] }])).toEqual([
      { id: "s", name: "S", folders: ["/x"], defaultDir: undefined },
    ]);
    expect(normalizeProjects({ items: [{ name: "n" }] })).toEqual([
      { id: "n", name: "n", folders: [], defaultDir: undefined },
    ]);
    expect(normalizeProjects(null)).toEqual([]);
  });
});
