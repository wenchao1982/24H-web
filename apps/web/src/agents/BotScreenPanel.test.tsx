/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import BotScreenPanel from "./BotScreenPanel";
import { GatewayProvider } from "../chat/GatewayProvider";
import { createFakeGateway } from "../test/fakeGateway";
import { normalizeBotScreens } from "./botScreen";

describe("BotScreenPanel T23.18 Bot Screen", () => {
  it("renders an unsupported state when the gateway rejects", async () => {
    const gateway = createFakeGateway(() => {
      throw new Error("unknown method");
    });
    render(
      <GatewayProvider gateway={gateway}>
        <BotScreenPanel />
      </GatewayProvider>,
    );
    expect(await screen.findByText("当前内核未开放 Bot 屏幕能力。")).toBeInTheDocument();
  });

  it("renders available bot screens", async () => {
    const gateway = createFakeGateway((method) =>
      method === "groups.list" ? { screens: [{ name: "screen-1", status: "running" }] } : {},
    );
    render(
      <GatewayProvider gateway={gateway}>
        <BotScreenPanel />
      </GatewayProvider>,
    );
    expect(await screen.findByText("screen-1")).toBeInTheDocument();
    expect(screen.getByText("running")).toBeInTheDocument();
  });
});

describe("botScreen normalizer", () => {
  it("normalizes screens", () => {
    expect(normalizeBotScreens({ groups: ["a", { title: "b", state: "idle" }] })).toEqual([
      { name: "a", status: "", detail: "" },
      { name: "b", status: "idle", detail: "" },
    ]);
    expect(normalizeBotScreens(null)).toEqual([]);
  });
});
