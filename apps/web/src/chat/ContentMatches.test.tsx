/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContentMatches from "./ContentMatches";

describe("ContentMatches (C06)", () => {
  it("renders nothing when there are no matches", () => {
    const { container } = render(<ContentMatches matches={[]} onSelect={() => undefined} />);
    expect(container.querySelector(".content-matches")).toBeNull();
  });

  it("renders matches and selects on click", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ContentMatches
        matches={[{ id: "s1", title: "会话一", snippet: "命中片段", role: "user" }]}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByText("会话一")).toBeInTheDocument();
    expect(screen.getByText("命中片段")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /会话一/ }));
    expect(onSelect).toHaveBeenCalledWith("s1");
  });
});
