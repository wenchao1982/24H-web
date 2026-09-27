import { describe, expect, it } from "vitest";
import {
  buildMemberInputs,
  isGroupsSupported,
  newIdentifier,
  normalizeCapabilities,
  normalizeLogEvents,
  normalizeMembers,
  normalizeMessages,
  normalizeRoomState,
  normalizeRooms,
} from "./groups";

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

  it("normalizes capabilities and honours driver:false", () => {
    expect(normalizeCapabilities({ driver: true, methods: ["groups.create", 3, ""] })).toEqual({
      driver: true,
      methods: ["groups.create"],
    });
    expect(isGroupsSupported({ driver: false })).toBe(false);
  });

  it("normalizes a room from groups.state", () => {
    expect(
      normalizeRoomState({
        room: { room_id: "r9", name: "值守", members: [{ member_id: "ops", profile: "ops", handle: "ops" }] },
      }),
    ).toMatchObject({
      id: "r9",
      name: "值守",
      members: [{ id: "ops", name: "ops", handle: "ops", profile: "ops" }],
    });
    expect(normalizeRoomState(null)).toBeNull();
  });

  it("normalizes groups.log events into speaker + text and drops control events", () => {
    expect(
      normalizeLogEvents({
        events: [
          {
            event_id: "e1",
            kind: "message.user",
            actor: { kind: "user", id: "desktop" },
            payload: { text: "大家好", thread_id: "t1" },
          },
          {
            event_id: "e2",
            kind: "message.member",
            actor: { kind: "member", id: "ops", display_name: "运维" },
            payload: { member_id: "ops", text: "收到", thread_id: "t1" },
          },
          { event_id: "e3", kind: "turn.started", actor: { kind: "gateway", id: "gw" }, payload: {} },
        ],
      }),
    ).toEqual([
      { id: "e1", sender: "我", text: "大家好" },
      { id: "e2", sender: "运维", text: "收到" },
    ]);
  });

  it("builds member inputs from profiles (dedup + reserved handle)", () => {
    expect(
      buildMemberInputs([
        { name: "planner", displayName: "规划者" },
        { name: "planner" },
        { name: "all" },
        { name: "reviewer" },
      ]),
    ).toEqual([
      { member_id: "planner", profile: "planner", handle: "planner", display_name: "规划者" },
      { member_id: "all", profile: "all", handle: "all-member" },
      { member_id: "reviewer", profile: "reviewer", handle: "reviewer" },
    ]);
  });

  it("generates contract-safe identifiers", () => {
    const id = newIdentifier("room");
    expect(id).toMatch(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
    expect(newIdentifier("event")).not.toBe(id);
  });
});
