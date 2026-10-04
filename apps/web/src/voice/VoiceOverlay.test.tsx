/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VoiceOverlay from "./VoiceOverlay";

describe("VoiceOverlay (M19)", () => {
  it("renders the live transcript and stops", async () => {
    const onStop = vi.fn();
    render(<VoiceOverlay transcript="你好世界" onStop={onStop} />);

    expect(screen.getByRole("dialog", { name: "语音" })).toBeInTheDocument();
    expect(screen.getByText("你好世界")).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: "停止" }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("shows a placeholder when the transcript is empty", () => {
    render(<VoiceOverlay transcript="" onStop={() => undefined} />);
    expect(screen.getByText("…")).toBeInTheDocument();
  });
});
