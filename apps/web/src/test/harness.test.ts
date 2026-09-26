import { describe, expect, it } from "vitest";

describe("web test harness", () => {
  it("runs in jsdom with jest-dom matchers", () => {
    const el = document.createElement("div");
    el.textContent = "24H";
    document.body.appendChild(el);
    expect(el).toBeInTheDocument();
    expect(el).toHaveTextContent("24H");
  });
});
