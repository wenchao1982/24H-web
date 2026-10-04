/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import { getAutoRead, setAutoRead } from "./autoread";

afterEach(() => {
  window.localStorage.clear();
});

describe("autoread pref (M19)", () => {
  it("defaults to off and round-trips", () => {
    expect(getAutoRead()).toBe(false);
    setAutoRead(true);
    expect(getAutoRead()).toBe(true);
    setAutoRead(false);
    expect(getAutoRead()).toBe(false);
  });
});
