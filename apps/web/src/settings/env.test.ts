import { describe, expect, it } from "vitest";
import { ENV_KEY_PATTERN, normalizeEnvNames } from "./env";

describe("normalizeEnvNames", () => {
  it("reads names from a keys array and never values", () => {
    expect(
      normalizeEnvNames({
        keys: [
          { name: "OPENAI_API_KEY", value: "sk-secret" },
          { name: "ANTHROPIC_API_KEY" },
        ],
      }),
    ).toEqual(["ANTHROPIC_API_KEY", "OPENAI_API_KEY"]);
  });

  it("reads names from an env object and a bare string array", () => {
    expect(normalizeEnvNames({ env: { B: "x", A: "y" } })).toEqual(["A", "B"]);
    expect(normalizeEnvNames(["Z_KEY", "A_KEY"])).toEqual(["A_KEY", "Z_KEY"]);
  });

  it("dedupes and drops blanks", () => {
    expect(normalizeEnvNames(["A", "A", "", "  "])).toEqual(["A"]);
  });

  it("validates key names", () => {
    expect(ENV_KEY_PATTERN.test("OPENAI_API_KEY")).toBe(true);
    expect(ENV_KEY_PATTERN.test("lower")).toBe(false);
    expect(ENV_KEY_PATTERN.test("1BAD")).toBe(false);
  });
});
