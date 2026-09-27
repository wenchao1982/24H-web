/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PersonalityPanel from "./PersonalityPanel";
import { GatewayProvider } from "./GatewayProvider";
import { createFakeGateway } from "../test/fakeGateway";
import {
  listPersonalityArgs,
  normalizePersonalities,
  setPersonalityArgs,
} from "./personalities";

describe("PersonalityPanel T23.14 Personality 预设", () => {
  it("lists presets via /personality list and applies one", async () => {
    const gateway = createFakeGateway((method, params) => {
      if (method === "slash.exec" && params.args === "list") {
        return { presets: [{ name: "friendly", description: "友好" }] };
      }
      return {};
    });
    render(
      <GatewayProvider gateway={gateway}>
        <PersonalityPanel />
      </GatewayProvider>,
    );

    const apply = await screen.findByRole("button", { name: "应用人格 friendly" });
    expect(screen.getByText("友好")).toBeInTheDocument();
    expect(gateway.paramsOf("slash.exec")).toEqual([{ command: "/personality", args: "list" }]);

    await userEvent.setup().click(apply);

    await waitFor(() => {
      expect(gateway.paramsOf("slash.exec")).toEqual([
        { command: "/personality", args: "list" },
        { command: "/personality", args: "friendly" },
      ]);
    });
    expect(await screen.findByText("当前人格：friendly")).toBeInTheDocument();
  });
});

describe("personalities helper", () => {
  it("normalizes presets and builds slash params", () => {
    expect(normalizePersonalities({ personalities: ["a", { id: "b", summary: "B" }] })).toEqual([
      { name: "a", description: "" },
      { name: "b", description: "B" },
    ]);
    expect(normalizePersonalities(null)).toEqual([]);
    expect(listPersonalityArgs()).toEqual({ command: "/personality", args: "list" });
    expect(setPersonalityArgs("x")).toEqual({ command: "/personality", args: "x" });
  });
});
