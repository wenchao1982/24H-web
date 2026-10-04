/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GatewayProvider } from "../chat/GatewayProvider";
import { createFakeGateway } from "../test/fakeGateway";
import OrchestrationPage from "./OrchestrationPage";

function renderPage(
  gateway = createFakeGateway((method) =>
    method === "delegation.status"
      ? {
          active: [{ id: "s1", name: "研究员", status: "running", depth: 0 }],
          paused: false,
          max_spawn_depth: 3,
        }
      : {},
  ),
) {
  return render(
    <GatewayProvider gateway={gateway}>
      <OrchestrationPage />
    </GatewayProvider>,
  );
}

describe("OrchestrationPage (M21)", () => {
  it("renders canvas nodes and the delegation run panel", async () => {
    renderPage();

    expect(await screen.findByRole("button", { name: /研究员/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /编码/ })).toBeInTheDocument();

    const run = await screen.findByRole("complementary", { name: "运行视图" });
    expect(within(run).getByText("研究员")).toBeInTheDocument();
  });

  it("adds and edits a node", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("button", { name: /研究员/ });

    await user.click(screen.getByRole("button", { name: "添加节点" }));
    const added = screen.getByRole("button", { name: /新节点/ });
    expect(added).toBeInTheDocument();

    const field = screen.getByLabelText("节点名称");
    await user.clear(field);
    await user.type(field, "发布");
    expect(screen.getByRole("button", { name: /发布/ })).toBeInTheDocument();
  });
});
