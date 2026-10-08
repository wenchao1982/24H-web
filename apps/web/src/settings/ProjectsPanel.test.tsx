import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProjectsPanel from "./ProjectsPanel";
import { GatewayProvider } from "../chat/GatewayProvider";
import { createFakeGateway } from "../test/fakeGateway";
import { normalizeProjects, PROJECT_STORAGE_KEY } from "./projects";

const PROJECTS = {
  projects: [
    { id: "alpha", name: "Alpha", folders: ["/a", "/b"], primary_path: "/a" },
    { id: "beta", name: "Beta", folders: [] },
  ],
};

function impl(method: string): unknown {
  if (method === "projects.list") {
    return PROJECTS;
  }
  return {};
}

function renderPanel(implFn = impl) {
  const gateway = createFakeGateway(implFn);
  render(
    <GatewayProvider gateway={gateway}>
      <ProjectsPanel />
    </GatewayProvider>,
  );
  return gateway;
}

afterEach(() => {
  localStorage.clear();
});

describe("ProjectsPanel (L1 projects.* RPC)", () => {
  it("renders projects from projects.list and persists the selected one", async () => {
    renderPanel();
    await screen.findByRole("button", { name: "选择项目 Alpha" });
    expect(screen.getByRole("button", { name: "选择项目 Beta" })).toBeInTheDocument();
    expect(screen.getByText("/a · /b")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "选择项目 Beta" }));
    expect(localStorage.getItem(PROJECT_STORAGE_KEY)).toBe("beta");
  });

  it("restores the stored current project on mount", async () => {
    localStorage.setItem(PROJECT_STORAGE_KEY, "beta");
    renderPanel();
    expect(await screen.findByRole("button", { name: "选择项目 Beta" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("creates a project via projects.create", async () => {
    const gateway = renderPanel();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "新建项目" }));
    await user.type(screen.getByLabelText("名称"), "Gamma");
    await user.type(screen.getByLabelText("文件夹"), "/x,/y");
    await user.type(screen.getByLabelText("默认目录"), "/x");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      const call = gateway.requests.find((entry) => entry.method === "projects.create");
      expect(call?.params).toEqual({ name: "Gamma", folders: ["/x", "/y"], primary_path: "/x" });
    });
  });

  it("deletes and edits via projects.delete / projects.update", async () => {
    const gateway = renderPanel();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "删除项目 Alpha" }));
    await waitFor(() => {
      expect(
        gateway.requests.some(
          (entry) => entry.method === "projects.delete" && entry.params.id === "alpha",
        ),
      ).toBe(true);
    });

    await user.click(screen.getByRole("button", { name: "编辑项目 Beta" }));
    const nameInput = screen.getByLabelText("名称");
    await user.clear(nameInput);
    await user.type(nameInput, "Beta2");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(
        gateway.requests.some(
          (entry) =>
            entry.method === "projects.update" &&
            entry.params.id === "beta" &&
            entry.params.name === "Beta2",
        ),
      ).toBe(true);
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
