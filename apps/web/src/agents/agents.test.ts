import { describe, expect, it } from "vitest";
import {
  agentInitial,
  normalizeAgentDetail,
  normalizeAgentList,
} from "./agents";

describe("normalizeAgentList", () => {
  it("reads profiles from { profiles: [...] } and normalizes fields", () => {
    const result = normalizeAgentList({
      profiles: [
        {
          name: "writer",
          display_name: "写作",
          description: "文案助手",
          model: "gpt-4o",
          provider: "openai",
          is_default: true,
          skill_count: 3,
          has_avatar: true,
          worker_session: { id: "s1" },
        },
        { name: "coder" },
      ],
    });
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      name: "writer",
      displayName: "写作",
      description: "文案助手",
      model: "gpt-4o",
      provider: "openai",
      isDefault: true,
      skillCount: 3,
      hasAvatar: true,
      status: "active",
    });
    expect(result[1]).toMatchObject({ name: "coder", status: "idle", isDefault: false });
  });

  it("accepts a bare array and drops entries without a name", () => {
    const result = normalizeAgentList([{ name: "a" }, { description: "无名字" }]);
    expect(result.map((agent) => agent.name)).toEqual(["a"]);
  });

  it("returns [] for unexpected payloads", () => {
    expect(normalizeAgentList(null)).toEqual([]);
    expect(normalizeAgentList({ profiles: "nope" })).toEqual([]);
  });
});

describe("normalizeAgentDetail", () => {
  it("maps soul/model/skills/mcp and derives disabled_skills", () => {
    const result = normalizeAgentDetail({
      name: "writer",
      description: "文案",
      soul: "# 人设",
      model: { provider: "openai", default: "gpt-4o" },
      skills: [
        { name: "web_search", enabled: true },
        { name: "ppt", enabled: false },
      ],
      mcp_servers: [{ name: "filesystem", enabled: true, transport: "stdio" }],
    });
    expect(result.provider).toBe("openai");
    expect(result.model).toBe("gpt-4o");
    expect(result.soul).toBe("# 人设");
    expect(result.disabledSkills).toEqual(["ppt"]);
    expect(result.mcpServers[0]).toEqual({
      name: "filesystem",
      enabled: true,
      transport: "stdio",
    });
  });

  it("accepts an explicit disabled_skills list and a bare model string", () => {
    const result = normalizeAgentDetail({
      name: "x",
      model: "claude-3",
      skills: [{ name: "a", enabled: true }],
      disabled_skills: ["b"],
    });
    expect(result.model).toBe("claude-3");
    expect(result.disabledSkills).toEqual(["b"]);
  });
});

describe("agentInitial", () => {
  it("falls back to ? for blank names and upper-cases otherwise", () => {
    expect(agentInitial("writer")).toBe("W");
    expect(agentInitial("  ")).toBe("?");
  });
});
