import { describe, expect, it } from "vitest";
import { normalizeAgentOptions } from "./agentOptions";

describe("normalizeAgentOptions", () => {
  it("returns [] for null / undefined", () => {
    expect(normalizeAgentOptions(null)).toEqual([]);
    expect(normalizeAgentOptions(undefined)).toEqual([]);
  });

  it("returns [] when profiles is missing or not an array", () => {
    expect(normalizeAgentOptions({})).toEqual([]);
    expect(normalizeAgentOptions({ profiles: "p1" })).toEqual([]);
    expect(normalizeAgentOptions({ profiles: { 0: "p1" } })).toEqual([]);
    expect(normalizeAgentOptions({ profiles: null })).toEqual([]);
  });

  it("returns [] for an empty profiles array", () => {
    expect(normalizeAgentOptions({ profiles: [] })).toEqual([]);
  });

  it("marks profiles[0] as default when default_profile is absent", () => {
    expect(normalizeAgentOptions({ profiles: ["p1", "p2"] })).toEqual([
      { name: "p1", isDefault: true },
      { name: "p2", isDefault: false },
    ]);
  });

  it("marks the matching default_profile as default", () => {
    expect(normalizeAgentOptions({ profiles: ["p1", "p2"], default_profile: "p2" })).toEqual([
      { name: "p1", isDefault: false },
      { name: "p2", isDefault: true },
    ]);
  });

  it("falls back to profiles[0] when default_profile is not in the list", () => {
    expect(normalizeAgentOptions({ profiles: ["p1", "p2"], default_profile: "ghost" })).toEqual([
      { name: "p1", isDefault: true },
      { name: "p2", isDefault: false },
    ]);
  });

  it("falls back to profiles[0] when default_profile is not a string", () => {
    expect(normalizeAgentOptions({ profiles: ["p1", "p2"], default_profile: 42 })[0].isDefault).toBe(
      true,
    );
  });

  it("trims and dedupes names", () => {
    expect(
      normalizeAgentOptions({ profiles: [" p1 ", "p1", "p2", "", "  "] }),
    ).toEqual([
      { name: "p1", isDefault: true },
      { name: "p2", isDefault: false },
    ]);
  });

  it("skips non-string entries", () => {
    expect(
      normalizeAgentOptions({ profiles: ["p1", 42, null, { name: "p2" }, "p3"] }),
    ).toEqual([
      { name: "p1", isDefault: true },
      { name: "p3", isDefault: false },
    ]);
  });

  it("defaults to profiles[0] when default_profile only whitespace-matches", () => {
    expect(normalizeAgentOptions({ profiles: ["p1", "p2"], default_profile: " p2 " })).toEqual([
      { name: "p1", isDefault: false },
      { name: "p2", isDefault: true },
    ]);
  });

  it("never emits a name outside me.profiles", () => {
    const input = ["p1", "p2", "p1", ""];
    const options = normalizeAgentOptions({ profiles: input });
    for (const option of options) {
      expect(input.map((v) => v.trim())).toContain(option.name);
    }
    expect(options.filter((o) => o.isDefault)).toHaveLength(1);
  });
});
