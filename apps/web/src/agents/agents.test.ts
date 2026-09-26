import { describe, expect, it } from "vitest";
import {
  agentInitial,
  MAX_AVATAR_BYTES,
  normalizeAgentDetail,
  normalizeAgentList,
  normalizeAvatar,
  validateAvatarDataUrl,
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

describe("normalizeAvatar", () => {
  it("reads a data URL from the REST/asset payload shapes", () => {
    expect(normalizeAvatar({ avatar: "data:image/png;base64,iVBORw0KGgo=" })).toBe(
      "data:image/png;base64,iVBORw0KGgo=",
    );
    expect(normalizeAvatar({ found: true, data: "data:image/jpeg;base64,abc" })).toBe(
      "data:image/jpeg;base64,abc",
    );
    expect(normalizeAvatar("data:image/png;base64,xyz")).toBe("data:image/png;base64,xyz");
  });

  it("returns null when there is no data URL", () => {
    expect(normalizeAvatar({ found: false })).toBeNull();
    expect(normalizeAvatar(null)).toBeNull();
    expect(normalizeAvatar("/tmp/avatar.png")).toBeNull();
  });
});

describe("validateAvatarDataUrl", () => {
  it("accepts small PNG/JPEG data URLs", () => {
    expect(validateAvatarDataUrl("data:image/png;base64,iVBORw0KGgo=")).toBeNull();
    expect(validateAvatarDataUrl("data:image/jpeg;base64,/9j/4A==")).toBeNull();
  });

  it("rejects non-PNG/JPEG and oversized payloads", () => {
    expect(validateAvatarDataUrl("data:image/gif;base64,R0lGOD")).toBe("头像需为 PNG 或 JPEG");
    expect(validateAvatarDataUrl("not-a-data-url")).toBe("头像需为 PNG 或 JPEG");
    const big = "A".repeat(Math.ceil((MAX_AVATAR_BYTES + 4) / 3) * 4);
    expect(validateAvatarDataUrl(`data:image/png;base64,${big}`)).toBe("头像不能超过 256KB");
  });
});
