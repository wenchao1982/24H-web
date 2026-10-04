import { describe, expect, it } from "vitest";
import { isAllowedStreamPath } from "./proxy";

describe("isAllowedStreamPath (M20 /api/hermes/stream 白名单)", () => {
  it("allows the whitelisted Hermes stream paths", () => {
    for (const path of ["/api/events", "/api/plugins/kanban/events", "/api/audio/speak-stream"]) {
      expect(isAllowedStreamPath(path)).toBe(true);
    }
  });

  it("rejects everything else (open-proxy / SSRF guard)", () => {
    for (const path of [
      "/api/ws",
      "/api/pty",
      "/api/console",
      "https://evil.example/ws",
      "/api/events?x=1",
      "",
    ]) {
      expect(isAllowedStreamPath(path)).toBe(false);
    }
  });
});
