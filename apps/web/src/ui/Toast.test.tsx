import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "./Toast";

function Probe() {
  const { show } = useToast();
  return (
    <button type="button" onClick={() => show("出错了", "error")}>
      触发
    </button>
  );
}

describe("Toast", () => {
  it("shows and annotates a toast", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Probe />
      </ToastProvider>,
    );

    await user.click(screen.getByRole("button", { name: "触发" }));

    const toast = screen.getByText("出错了");
    expect(toast).toBeInTheDocument();
    expect(toast).toHaveAttribute("data-kind", "error");
  });
});
