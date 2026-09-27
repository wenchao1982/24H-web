import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { GatewayProvider } from "../chat/GatewayProvider";
import { createFakeGateway, type FakeGateway } from "../test/fakeGateway";
import NotificationsBell from "./NotificationsBell";
import { NotificationsProvider } from "./NotificationsProvider";

function renderBell(gateway: FakeGateway, onSelect?: (sessionId: string | null) => void) {
  return render(
    <GatewayProvider gateway={gateway}>
      <NotificationsProvider>
        <NotificationsBell onSelect={onSelect} />
      </NotificationsProvider>
    </GatewayProvider>,
  );
}

describe("NotificationsBell T22.1 未读/挂起聚合", () => {
  it("does not show a badge with no notifications", () => {
    const gateway = createFakeGateway();
    renderBell(gateway);
    expect(screen.queryByTestId("notifications-badge")).not.toBeInTheDocument();
  });

  it("shows an unread badge and lists a pending approval", async () => {
    const gateway = createFakeGateway();
    renderBell(gateway);

    act(() => {
      gateway.emitServerRequest("approval", {
        session_id: "s1",
        prompt: "是否允许执行该命令？",
        options: ["once", "deny"],
      });
    });

    expect(screen.getByTestId("notifications-badge")).toHaveTextContent("1");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "通知" }));

    const panel = screen.getByRole("dialog", { name: "通知" });
    expect(panel).toBeInTheDocument();
    expect(screen.getByText("等待审批")).toBeInTheDocument();
    expect(screen.getByText("是否允许执行该命令？")).toBeInTheDocument();
  });

  it("navigates to the session and clears the unread item on click", async () => {
    const gateway = createFakeGateway();
    const onSelect = vi.fn();
    renderBell(gateway, onSelect);

    act(() => {
      gateway.emitServerRequest("clarify", { session_id: "s2", question: "选择哪个环境？" });
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "通知" }));
    await user.click(screen.getByText("等待回答"));

    expect(onSelect).toHaveBeenCalledWith("s2");
    expect(screen.queryByTestId("notifications-badge")).not.toBeInTheDocument();
  });

  it("aggregates session activity from done events", async () => {
    const gateway = createFakeGateway();
    renderBell(gateway);

    act(() => {
      gateway.emit("done", { session_id: "s3" });
    });

    expect(screen.getByTestId("notifications-badge")).toHaveTextContent("1");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "通知" }));
    expect(screen.getByText("会话有新动态")).toBeInTheDocument();
  });

  it("does not clobber other server-request subscribers (multiplex)", () => {
    const gateway = createFakeGateway();
    const other = vi.fn();
    gateway.onServerRequest("approval", other);
    renderBell(gateway);

    act(() => {
      gateway.emitServerRequest("approval", { session_id: "s1", prompt: "允许？" });
    });

    expect(other).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("notifications-badge")).toHaveTextContent("1");
  });
});
