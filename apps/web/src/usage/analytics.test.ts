import { describe, expect, it } from "vitest";
import { normalizeSystemStats, normalizeUsage, normalizeUsageByModel } from "./analytics";

describe("analytics normalizeSystemStats", () => {
  it("parses /api/system/stats (nested memory/disk + single process)", () => {
    const stats = normalizeSystemStats({
      cpu_percent: 6.5,
      memory: { total: 100, percent: 51.1 },
      disk: { total: 100, percent: 87.5 },
      process: { pid: 1234, rss: 10, num_threads: 17 },
      uptime_seconds: 423295,
      hermes_version: "0.21.5",
    });
    expect(stats.cpu).toBe(6.5);
    expect(stats.memory).toBe(51.1);
    expect(stats.disk).toBe(87.5);
    expect(stats.processes).toBe(1);
    expect(stats.uptime).toBe(423295);
    expect(stats.version).toBe("0.21.5");
  });

  it("parses /api/status (overall health)", () => {
    const stats = normalizeSystemStats({ overall: "degraded", version: "0.21.5" });
    expect(stats.health).toBe("degraded");
    expect(stats.version).toBe("0.21.5");
  });
});

describe("analytics normalizeUsage*", () => {
  it("reads totals and by-model rows", () => {
    expect(normalizeUsage({ totals: { sessions: 45, tokens: 100 } })).toMatchObject({
      sessions: 45,
      tokens: 100,
    });
    expect(normalizeUsageByModel({ models: [{ model: "x", tokens: 5, requests: 2 }] })).toEqual([
      { model: "x", tokens: 5, cost: 0, messages: 2, cacheRead: null, cacheHitRate: null },
    ]);
    expect(
      normalizeUsageByModel({
        models: [{ model: "y", input_tokens: 20, output_tokens: 5, cache_read_tokens: 80 }],
      }),
    ).toEqual([
      { model: "y", tokens: 25, cost: 0, messages: 0, cacheRead: 80, cacheHitRate: 80 },
    ]);
  });
});
