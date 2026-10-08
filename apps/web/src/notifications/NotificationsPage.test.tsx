import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { GatewayProvider } from "../chat/GatewayProvider";
import { createFakeGateway } from "../test/fakeGateway";
import { NotificationsProvider } from "./NotificationsProvider";
import NotificationsPage from "./NotificationsPage";

function renderPage(gateway = createFakeGateway()) {
  return render(
    <MemoryRouter initialEntries={["/notifications"]}>
      <GatewayProvider gateway={gateway}>
        <NotificationsProvider>
          <Routes>
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/chat" element={<div>chat-route</div>} />
          </Routes>
        </NotificationsProvider>
      </GatewayProvider>
    </MemoryRouter>,
  );
}

describe("NotificationsPage (M23) 通知中心", () => {
  it("lists an aggregated request and marks all read", async () => {
    const gateway = createFakeGateway();
    renderPage(gateway);
    act(() => {
      gateway.emitServerRequest("approval", { session_id: "s1", prompt: "允许？" });
    });

    expect(screen.getByText("等待审批")).toBeInTheDocument();
    expect(screen.getByText("允许？")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "全部已读" }));
    expect(screen.queryByRole("button", { name: "全部已读" })).not.toBeInTheDocument();
  });

  it("navigates to the session on click", async () => {
    const gateway = createFakeGateway();
    renderPage(gateway);
    act(() => {
      gateway.emitServerRequest("clarify", { session_id: "s2", question: "哪个环境？" });
    });

    const user = userEvent.setup();
    await user.click(screen.getByText("等待回答"));
    expect(screen.getByText("chat-route")).toBeInTheDocument();
  });
});
