import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GroupChatPage from "./GroupChatPage";
import { GatewayProvider } from "../chat/GatewayProvider";
import { createFakeGateway, type FakeGateway } from "../test/fakeGateway";

function renderPage(gateway: FakeGateway) {
  return render(
    <GatewayProvider gateway={gateway}>
      <GroupChatPage />
    </GatewayProvider>,
  );
}

const ROOMS = {
  rooms: [
    {
      id: "r1",
      name: "发布协调",
      members: ["planner", "reviewer"],
      messages: [{ id: "m1", sender: "planner", text: "先拆分任务" }],
    },
    { id: "r2", name: "运维值守", members: ["ops"] },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GroupChatPage T17.1 群聊", () => {
  it("renders rooms and a room transcript with members from groups.* responses", async () => {
    const gateway = createFakeGateway((method) => {
      if (method === "groups.capabilities") {
        return { supported: true };
      }
      if (method === "groups.list") {
        return ROOMS;
      }
      if (method === "groups.messages") {
        return { messages: [{ id: "m2", sender: "reviewer", text: "我来复核" }] };
      }
      return {};
    });
    renderPage(gateway);

    expect(await screen.findByRole("button", { name: "打开房间 发布协调" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "打开房间 运维值守" })).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "打开房间 发布协调" }));

    expect(await screen.findByText("我来复核")).toBeInTheDocument();
    expect(gateway.paramsOf("groups.messages")).toEqual([{ room_id: "r1" }]);
    expect(screen.getByRole("button", { name: "提及 @planner" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "提及 @reviewer" })).toBeInTheDocument();
  });

  it("creates a room via groups.create", async () => {
    const gateway = createFakeGateway((method) => {
      if (method === "groups.capabilities") {
        return { supported: true };
      }
      if (method === "groups.list") {
        return { rooms: [] };
      }
      return {};
    });
    renderPage(gateway);
    await screen.findByText("暂无房间。");

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("房间名称"), "新房间");
    await user.click(screen.getByRole("button", { name: "新建房间" }));

    await waitFor(() => {
      expect(gateway.paramsOf("groups.create")).toEqual([{ name: "新房间" }]);
    });
  });

  it("shows an informative empty state when groups.* is unsupported", async () => {
    const gateway = createFakeGateway((method) => {
      if (method === "groups.capabilities") {
        throw new Error("method not found");
      }
      return {};
    });
    renderPage(gateway);

    expect(
      await screen.findByText("当前 Hermes 未启用群聊（groups.*），升级核心或开启后重试。"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "新建房间" })).not.toBeInTheDocument();
  });
});
