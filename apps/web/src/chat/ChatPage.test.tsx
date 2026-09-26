import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChatPage from "./ChatPage";
import { GatewayProvider } from "./GatewayProvider";
import { createFakeGateway, type FakeGateway } from "../test/fakeGateway";

const SESSIONS = {
  sessions: [
    { id: "s1", title: "第一会话" },
    { id: "s2", title: "部署排查" },
  ],
};

function renderChat(gateway: FakeGateway) {
  return render(
    <GatewayProvider gateway={gateway}>
      <ChatPage />
    </GatewayProvider>,
  );
}

describe("ChatPage T6.1 会话列表", () => {
  it("renders sessions returned by session.list", async () => {
    const gateway = createFakeGateway((method) =>
      method === "session.list" ? SESSIONS : {},
    );
    renderChat(gateway);

    expect(await screen.findByText("第一会话")).toBeInTheDocument();
    expect(screen.getByText("部署排查")).toBeInTheDocument();
  });

  it("filters sessions by title", async () => {
    const gateway = createFakeGateway((method) =>
      method === "session.list" ? SESSIONS : {},
    );
    renderChat(gateway);
    await screen.findByText("第一会话");

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("会话搜索"), "部署");

    expect(screen.queryByText("第一会话")).not.toBeInTheDocument();
    expect(screen.getByText("部署排查")).toBeInTheDocument();
  });

  it("selects a session from the list", async () => {
    const gateway = createFakeGateway((method) =>
      method === "session.list" ? SESSIONS : {},
    );
    renderChat(gateway);
    const item = await screen.findByRole("button", { name: "第一会话" });

    const user = userEvent.setup();
    await user.click(item);

    expect(screen.getByRole("button", { name: "第一会话" })).toHaveAttribute(
      "data-active",
      "true",
    );
    expect(screen.getByRole("heading", { name: "第一会话" })).toBeInTheDocument();
  });
});

describe("ChatPage T6.2 新建会话", () => {
  it("calls session.create and selects the new session", async () => {
    const gateway = createFakeGateway((method) => {
      if (method === "session.list") {
        return SESSIONS;
      }
      if (method === "session.create") {
        return { session_id: "s3" };
      }
      return {};
    });
    renderChat(gateway);
    await screen.findByText("第一会话");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "新建会话" }));

    expect(gateway.paramsOf("session.create")).toHaveLength(1);
    expect(await screen.findByRole("heading", { name: "新会话" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新会话" })).toHaveAttribute("data-active", "true");
  });
});
