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

const CAPS = {
  driver: true,
  methods: [
    "groups.create",
    "groups.list",
    "groups.state",
    "groups.send",
    "groups.rename",
    "groups.log",
    "groups.disband",
  ],
};

const PROFILES = {
  profiles: [
    { name: "planner", display_name: "规划者" },
    { name: "reviewer" },
  ],
};

const ROOM_MEMBERS = [
  { member_id: "planner", profile: "planner", handle: "planner", display_name: "规划者" },
  { member_id: "reviewer", profile: "reviewer", handle: "reviewer" },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GroupChatPage T17.1 群聊（官方 groups.*）", () => {
  it("renders rooms, loads the room state/log and shows speaker + text", async () => {
    const gateway = createFakeGateway((method) => {
      if (method === "groups.capabilities") return CAPS;
      if (method === "groups.list") {
        return { rooms: [{ room_id: "r1", name: "发布协调", members: ROOM_MEMBERS }] };
      }
      if (method === "profiles.list") return PROFILES;
      if (method === "groups.state") {
        return { room: { room_id: "r1", name: "发布协调", members: ROOM_MEMBERS } };
      }
      if (method === "groups.log") {
        return {
          events: [
            {
              event_id: "e1",
              kind: "message.user",
              actor: { kind: "user", id: "desktop" },
              payload: { text: "先拆分任务", thread_id: "t1" },
            },
            {
              event_id: "e2",
              kind: "message.member",
              actor: { kind: "member", id: "reviewer", display_name: "复核员" },
              payload: { member_id: "reviewer", text: "我来复核", thread_id: "t1" },
            },
          ],
        };
      }
      return {};
    });
    renderPage(gateway);

    expect(await screen.findByRole("button", { name: "打开房间 发布协调" })).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "打开房间 发布协调" }));

    expect(await screen.findByText("先拆分任务")).toBeInTheDocument();
    expect(await screen.findByText("我来复核")).toBeInTheDocument();
    expect(screen.getByText("复核员：")).toBeInTheDocument();
    expect(gateway.paramsOf("groups.state")).toEqual([{ room_id: "r1" }]);
    expect(gateway.paramsOf("groups.log")).toContainEqual({ room_id: "r1", since_seq: 0 });
    expect(screen.getByRole("button", { name: "提及 @planner" })).toBeInTheDocument();
  });

  it("creates a room with the selected members via groups.create", async () => {
    const gateway = createFakeGateway((method) => {
      if (method === "groups.capabilities") return CAPS;
      if (method === "groups.list") return { rooms: [] };
      if (method === "profiles.list") return PROFILES;
      return {};
    });
    renderPage(gateway);
    await screen.findByText("暂无房间。");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "新建" }));
    await user.click(screen.getByRole("checkbox", { name: "选择成员 planner" }));
    await user.click(screen.getByRole("checkbox", { name: "选择成员 reviewer" }));
    await user.type(screen.getByLabelText("房间名称"), "新房间");
    await user.click(screen.getByRole("button", { name: "新建房间" }));

    await waitFor(() => {
      expect(gateway.paramsOf("groups.create")).toHaveLength(1);
    });
    const call = gateway.paramsOf("groups.create")[0] as {
      room_id: string;
      name: string;
      members: unknown;
    };
    expect(call.name).toBe("新房间");
    expect(call.room_id).toMatch(/^room-/);
    expect(call.members).toEqual([
      { member_id: "planner", profile: "planner", handle: "planner", display_name: "规划者" },
      { member_id: "reviewer", profile: "reviewer", handle: "reviewer" },
    ]);
  });

  it("sends a message through groups.send with the room and text payload", async () => {
    const gateway = createFakeGateway((method) => {
      if (method === "groups.capabilities") return CAPS;
      if (method === "groups.list") {
        return { rooms: [{ room_id: "r1", name: "发布协调", members: ROOM_MEMBERS }] };
      }
      if (method === "profiles.list") return PROFILES;
      if (method === "groups.state") {
        return { room: { room_id: "r1", name: "发布协调", members: ROOM_MEMBERS } };
      }
      if (method === "groups.log") return { events: [] };
      return {};
    });
    renderPage(gateway);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "打开房间 发布协调" }));
    await user.type(screen.getByLabelText("输入消息，@成员 提及"), "@all 报到");
    await user.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(gateway.paramsOf("groups.send")).toHaveLength(1);
    });
    const call = gateway.paramsOf("groups.send")[0] as {
      room_id: string;
      event_id: string;
      payload: { text: string; thread_id: string };
    };
    expect(call.room_id).toBe("r1");
    expect(call.payload.text).toBe("@all 报到");
    expect(call.payload.thread_id).toBeTruthy();
    expect(call.event_id).toMatch(/^event-/);
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
    expect(screen.queryByRole("button", { name: "发送" })).not.toBeInTheDocument();
  });
});
