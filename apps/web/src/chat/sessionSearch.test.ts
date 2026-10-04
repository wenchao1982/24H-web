/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { normalizeSearchResults } from "./sessionSearch";

describe("normalizeSearchResults (C06 /api/sessions/search)", () => {
  it("normalizes results and falls back to preview for snippet", () => {
    const matches = normalizeSearchResults({
      results: [
        { id: "s1", title: "会话一", snippet: "命中片段", role: "user" },
        { id: "s2", title: "会话二", preview: "预览文本" },
      ],
    });
    expect(matches[0]).toEqual({ id: "s1", title: "会话一", snippet: "命中片段", role: "user" });
    expect(matches[1]).toMatchObject({ id: "s2", snippet: "预览文本" });
  });

  it("dedupes by id and drops entries without an id", () => {
    const matches = normalizeSearchResults({
      results: [{ id: "s1", title: "A" }, { id: "s1", title: "B" }, { title: "no id" }],
    });
    expect(matches).toHaveLength(1);
    expect(matches[0]?.title).toBe("A");
  });

  it("tolerates garbage", () => {
    expect(normalizeSearchResults(null)).toEqual([]);
    expect(normalizeSearchResults({ results: "nope" })).toEqual([]);
  });
});
