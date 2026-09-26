import { describe, expect, it } from "vitest";
import { groupByCategory, normalizeSkills, UNCATEGORIZED } from "./skills";

describe("normalizeSkills", () => {
  it("reads skills from { skills: [...] } and normalizes fields", () => {
    const result = normalizeSkills({
      skills: [
        { name: "web_search", description: "联网搜索", category: "检索", enabled: true },
        { name: "ppt", disabled: true, category: "创作" },
      ],
    });
    expect(result).toEqual([
      { name: "web_search", description: "联网搜索", category: "检索", enabled: true },
      { name: "ppt", description: "", category: "创作", enabled: false },
    ]);
  });

  it("accepts a bare array and drops entries without an identifier", () => {
    const result = normalizeSkills([
      { name: "a" },
      { description: "无名字" },
      { id: "b", enabled: true },
    ]);
    expect(result.map((skill) => skill.name)).toEqual(["a", "b"]);
    expect(result[0].category).toBe(UNCATEGORIZED);
  });

  it("returns [] for unexpected payloads", () => {
    expect(normalizeSkills(null)).toEqual([]);
    expect(normalizeSkills({ skills: "nope" })).toEqual([]);
  });
});

describe("groupByCategory", () => {
  it("groups by category keeping first-seen order and sorting 未分类 last", () => {
    const groups = groupByCategory(
      normalizeSkills([
        { name: "a", category: "甲" },
        { name: "b", category: "乙" },
        { name: "c" },
        { name: "d", category: "甲" },
      ]),
    );
    expect(groups.map((group) => group.category)).toEqual(["甲", "乙", UNCATEGORIZED]);
    expect(groups[0].skills.map((skill) => skill.name)).toEqual(["a", "d"]);
  });
});
