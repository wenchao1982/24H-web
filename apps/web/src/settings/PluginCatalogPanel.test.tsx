/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PluginCatalogPanel from "./PluginCatalogPanel";
import { GatewayProvider } from "../chat/GatewayProvider";
import { createFakeGateway } from "../test/fakeGateway";
import { normalizePluginCatalog } from "./pluginCatalog";

describe("PluginCatalogPanel T23.15 Plugin Catalog", () => {
  it("browses the catalog and installs a plugin", async () => {
    let installed = false;
    const gateway = createFakeGateway((method, params) => {
      if (method !== "plugins.manage") {
        return {};
      }
      if (params.action === "install") {
        installed = true;
        return {};
      }
      return {
        plugins: [{ name: "hello", description: "示例插件", version: "1.0", installed }],
      };
    });
    render(
      <GatewayProvider gateway={gateway}>
        <PluginCatalogPanel />
      </GatewayProvider>,
    );

    const install = await screen.findByRole("button", { name: "安装插件 hello" });
    expect(screen.getByText("示例插件")).toBeInTheDocument();
    expect(screen.getByText("1.0")).toBeInTheDocument();

    await userEvent.setup().click(install);

    await waitFor(() => {
      expect(gateway.paramsOf("plugins.manage")).toContainEqual({
        action: "install",
        name: "hello",
      });
    });
    expect(await screen.findByText("已安装")).toBeInTheDocument();
  });
});

describe("pluginCatalog normalizer", () => {
  it("normalizes catalog entries", () => {
    expect(
      normalizePluginCatalog({ catalog: ["a", { name: "b", summary: "B", enabled: true }] }),
    ).toEqual([
      { name: "a", description: "", version: "", installed: false },
      { name: "b", description: "B", version: "", installed: true },
    ]);
    expect(normalizePluginCatalog(null)).toEqual([]);
  });
});
