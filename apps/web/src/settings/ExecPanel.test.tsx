import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ExecPanel from "./ExecPanel";
import { GatewayProvider } from "../chat/GatewayProvider";
import { createFakeGateway, type FakeGateway } from "../test/fakeGateway";
import { execMethod, execParams, normalizeExecOutput } from "./exec";

function renderPanel(gateway: FakeGateway) {
  return render(
    <GatewayProvider gateway={gateway}>
      <ExecPanel />
    </GatewayProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ExecPanel T18.8 命令执行", () => {
  it("runs a shell command after confirmation and renders output", async () => {
    const gateway = createFakeGateway((method) =>
      method === "shell.exec" ? { stdout: "hello\n" } : {},
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPanel(gateway);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Shell" }));
    await user.type(screen.getByLabelText("命令"), "echo hello");
    await user.click(screen.getByRole("button", { name: "执行" }));

    await waitFor(() => {
      expect(gateway.paramsOf("shell.exec")).toEqual([{ command: "echo hello" }]);
    });
    expect(await screen.findByText(/hello/)).toBeInTheDocument();
  });

  it("does not execute when the confirmation is dismissed", async () => {
    const gateway = createFakeGateway(() => ({}));
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderPanel(gateway);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("命令"), "rm -rf /");
    await user.click(screen.getByRole("button", { name: "执行" }));
    expect(gateway.requests).toHaveLength(0);
  });

  it("maps kinds and normalizes output", () => {
    expect(execMethod("cli")).toBe("cli.exec");
    expect(execMethod("shell")).toBe("shell.exec");
    expect(execParams("ls")).toEqual({ command: "ls" });
    expect(normalizeExecOutput({ output: "ok" })).toBe("ok");
    expect(normalizeExecOutput("raw")).toBe("raw");
    expect(normalizeExecOutput({ exit_code: 1 })).toBe("exit 1");
  });
});
