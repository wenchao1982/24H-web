import { afterEach, describe, expect, it } from "vitest";
import {
  applyTheme,
  isTheme,
  readStoredTheme,
  resolveTheme,
  storeTheme,
  THEME_STORAGE_KEY,
} from "./theme";

afterEach(() => {
  localStorage.clear();
});

describe("theme", () => {
  it("defaults to system and reads a stored theme", () => {
    expect(readStoredTheme()).toBe("system");
    storeTheme("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(readStoredTheme()).toBe("dark");
  });

  it("ignores invalid stored values", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "neon");
    expect(readStoredTheme()).toBe("system");
    expect(isTheme("neon")).toBe(false);
  });

  it("resolves system against prefers-color-scheme", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
  });

  it("applies the resolved theme to data-theme", () => {
    const root = document.createElement("div");
    expect(applyTheme("dark", root)).toBe("dark");
    expect(root.dataset.theme).toBe("dark");
    applyTheme("light", root);
    expect(root.dataset.theme).toBe("light");
  });
});
