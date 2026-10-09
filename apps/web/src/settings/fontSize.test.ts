import { afterEach, describe, expect, it } from "vitest";
import {
  applyFontSize,
  DEFAULT_FONT_SIZE,
  FONT_SIZE_KEY,
  readStoredFontSize,
  storeFontSize,
} from "./fontSize";

afterEach(() => {
  localStorage.clear();
});

describe("fontSize (M23)", () => {
  it("defaults to 14 and round-trips with clamping", () => {
    expect(readStoredFontSize()).toBe(DEFAULT_FONT_SIZE);
    storeFontSize(16);
    expect(localStorage.getItem(FONT_SIZE_KEY)).toBe("16");
    expect(readStoredFontSize()).toBe(16);
    storeFontSize(99);
    expect(readStoredFontSize()).toBe(17);
  });

  it("applies scaled font-size tokens to the root", () => {
    const root = document.createElement("div");
    applyFontSize(15, root);
    expect(root.style.getPropertyValue("--ds-font-size")).toBe("15px");
    expect(root.style.getPropertyValue("--ds-font-size-sm")).toBe("14px");
    expect(root.style.getPropertyValue("--ds-font-size-xs")).toBe("13px");
  });
});
