import { describe, expect, it } from "vitest";
import { buildPatch, normalizeConfig, readPath } from "./config";

describe("config helpers", () => {
  it("unwraps { config } envelopes", () => {
    expect(normalizeConfig({ config: { a: 1 } })).toEqual({ a: 1 });
    expect(normalizeConfig({ a: 1 })).toEqual({ a: 1 });
  });

  it("reads dotted paths, returning undefined when missing", () => {
    const config = { api_server: { enabled: true } };
    expect(readPath(config, "api_server.enabled")).toBe(true);
    expect(readPath(config, "lsp.enabled")).toBeUndefined();
    expect(readPath(config, "api_server")).toEqual({ enabled: true });
  });

  it("builds nested patches from dotted keys", () => {
    expect(
      buildPatch({ "api_server.enabled": true, "tool_search.enabled": false }),
    ).toEqual({ api_server: { enabled: true }, tool_search: { enabled: false } });
  });
});
