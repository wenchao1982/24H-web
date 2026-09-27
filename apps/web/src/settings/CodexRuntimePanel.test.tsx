/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CodexRuntimePanel from "./CodexRuntimePanel";
import { GatewayProvider } from "../chat/GatewayProvider";
import { createFakeGateway } from "../test/fakeGateway";

describe("CodexRuntimePanel T23.16 Codex 运行时", () => {
  it("toggles codex runtime via slash.exec and shows the result", async () => {
    const gateway = createFakeGateway((method) =>
      method === "slash.exec" ? { text: "codex runtime enabled" } : {},
    );
    render(
      <GatewayProvider gateway={gateway}>
        <CodexRuntimePanel />
      </GatewayProvider>,
    );

    await userEvent.setup().click(screen.getByRole("button", { name: "启用 Codex 运行时" }));

    await waitFor(() => {
      expect(gateway.paramsOf("slash.exec")).toEqual([
        { command: "/codex-runtime", args: "on" },
      ]);
    });
    expect(await screen.findByText("codex runtime enabled")).toBeInTheDocument();
  });
});
