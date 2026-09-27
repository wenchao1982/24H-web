import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
