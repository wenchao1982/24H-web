import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VaultPanel from "./VaultPanel";
import { GatewayProvider } from "../chat/GatewayProvider";
import { createFakeGateway, type FakeGateway } from "../test/fakeGateway";
import {
  normalizeConnectors,
  normalizeVaultEntries,
  vaultAddParams,
  vaultRemoveParams,
} from "./vault";

function renderPanel(gateway: FakeGateway) {
  return render(
    <GatewayProvider gateway={gateway}>
      <VaultPanel />
    </GatewayProvider>,
  );
}

function impl(method: string): unknown {
  if (method === "vault.list") {
    return { entries: [{ name: "OPENAI_API_KEY", value: "sk-super-secret" }] };
  }
  if (method === "connectors.list") {
    return { connectors: [{ name: "github", connected: true }] };
  }
  return {};
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("VaultPanel T18.13 密钥库/连接器", () => {
  it("lists entries masked and never renders the secret value", async () => {
    const gateway = createFakeGateway(impl);
    renderPanel(gateway);

    expect(await screen.findByText("OPENAI_API_KEY")).toBeInTheDocument();
    expect(screen.getByLabelText("OPENAI_API_KEY 掩码值")).toHaveTextContent("••••••••");
    expect(screen.queryByText("sk-super-secret")).not.toBeInTheDocument();
    expect(screen.getByText("github")).toBeInTheDocument();
    expect(screen.getByText("已连接")).toBeInTheDocument();
  });

  it("adds and removes a vault entry", async () => {
    const gateway = createFakeGateway(impl);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPanel(gateway);
    await screen.findByText("OPENAI_API_KEY");
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("密钥名称"), "NEW_KEY");
    await user.type(screen.getByLabelText("密钥值"), "secret-value");
    await user.click(screen.getByRole("button", { name: "添加" }));
    await waitFor(() => {
      expect(gateway.paramsOf("vault.add")).toEqual([
        { name: "NEW_KEY", value: "secret-value" },
      ]);
    });

    await user.click(screen.getByRole("button", { name: "删除密钥 OPENAI_API_KEY" }));
    await waitFor(() => {
      expect(gateway.paramsOf("vault.remove")).toEqual([{ name: "OPENAI_API_KEY" }]);
    });
  });

  it("normalizes tolerant shapes and drops plaintext values", () => {
    expect(normalizeVaultEntries([{ name: "A", value: "nope" }])).toEqual([{ name: "A" }]);
    expect(normalizeVaultEntries(["B"])).toEqual([{ name: "B" }]);
    expect(normalizeVaultEntries(null)).toEqual([]);
    expect(normalizeConnectors([{ id: "slack", state: "disconnected" }])).toEqual([
      { name: "slack", status: "disconnected" },
    ]);
    expect(vaultAddParams(" K ", "v")).toEqual({ name: "K", value: "v" });
    expect(vaultRemoveParams("K")).toEqual({ name: "K" });
  });
});
