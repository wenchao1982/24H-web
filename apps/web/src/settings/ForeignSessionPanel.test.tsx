import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ForeignSessionPanel from "./ForeignSessionPanel";
import { GatewayProvider } from "../chat/GatewayProvider";
import { createFakeGateway, type FakeGateway } from "../test/fakeGateway";
import {
  foreignParams,
  normalizeForeignPreview,
  normalizeForeignSessions,
} from "./foreignSessions";

function renderPanel(gateway: FakeGateway) {
  return render(
    <GatewayProvider gateway={gateway}>
      <ForeignSessionPanel />
    </GatewayProvider>,
  );
}

function impl(method: string): unknown {
  if (method === "session.foreign.list") {
    return { sessions: [{ id: "f1", title: "旧会话", source: "codex" }] };
  }
  if (method === "session.foreign.preview") {
    return { text: "历史内容" };
  }
  return {};
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ForeignSessionPanel T18.12 外部会话导入", () => {
  it("lists, previews and imports an external session", async () => {
    const gateway = createFakeGateway(impl);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPanel(gateway);

    const item = await screen.findByRole("button", { name: "预览外部会话 旧会话" });
    expect(item).toHaveTextContent("codex");

    const user = userEvent.setup();
    await user.click(item);
    expect(await screen.findByText("历史内容")).toBeInTheDocument();
    expect(gateway.paramsOf("session.foreign.preview")).toEqual([{ id: "f1" }]);

    await user.click(screen.getByRole("button", { name: "导入外部会话 旧会话" }));
    await waitFor(() => {
      expect(gateway.paramsOf("session.foreign.import")).toEqual([{ id: "f1" }]);
    });
    expect(await screen.findByText("已导入「旧会话」")).toBeInTheDocument();
  });

  it("normalizes tolerant shapes", () => {
    expect(normalizeForeignSessions([{ session_id: "z", name: "Z" }])).toEqual([
      { id: "z", title: "Z" },
    ]);
    expect(normalizeForeignSessions(["plain"])).toEqual([{ id: "plain", title: "plain" }]);
    expect(normalizeForeignSessions(null)).toEqual([]);
    expect(normalizeForeignPreview("raw")).toBe("raw");
    expect(foreignParams("f1")).toEqual({ id: "f1" });
  });
});
