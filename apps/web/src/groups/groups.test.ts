import { describe, expect, it } from "vitest";
import { isGroupsSupported, normalizeMembers, normalizeMessages, normalizeRooms } from "./groups";

describe("groups normalizers", () => {
  it("normalizes rooms from array / {rooms} / {groups}", () => {
    expect(normalizeRooms([{ id: "r1", title: "房间一", members: ["a", "b"] }])).toEqual([
      {
        id: "r1",
        name: "房间一",
        members: [
          { id: "a", name: "a" },
          { id: "b", name: "b" },
        ],
        latest: "",
        messages: [],
      },
    ]);
    expect(normalizeRooms({ rooms: [{ room_id: "r2", name: "房间二" }] })[0]).toMatchObject({
      id: "r2",
      name: "房间二",
    });
    expect(normalizeRooms({ groups: [{ group_id: "g1" }] })[0]).toMatchObject({ id: "g1", name: "g1" });
    expect(normalizeRooms(null)).toEqual([]);
  });

  it("normalizes members from strings and objects", () => {
    expect(normalizeMembers(["alpha", { id: "b", name: "Beta" }, { agent: "gamma" }])).toEqual([
      { id: "alpha", name: "alpha" },
      { id: "b", name: "Beta" },
      { id: "gamma", name: "gamma" },
    ]);
  });

  it("normalizes messages and drops empty text", () => {
    expect(
      normalizeMessages([
        { id: "m1", sender: "a", text: "你好" },
        { author: "b", content: "收到" },
        { text: "   " },
      ]),
    ).toEqual([
      { id: "m1", sender: "a", text: "你好" },
      { id: "m1", sender: "b", text: "收到" },
    ]);
  });

  it("detects capability support", () => {
    expect(isGroupsSupported({ supported: true })).toBe(true);
    expect(isGroupsSupported({ available: false })).toBe(false);
    expect(isGroupsSupported({ supported: false })).toBe(false);
    expect(isGroupsSupported(null)).toBe(true);
  });
});
