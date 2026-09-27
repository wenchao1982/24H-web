import { describe, expect, it } from "vitest";
import {
  markAllRead,
  markRead,
  pushNotification,
  unreadCount,
  upsertActivity,
} from "./store";
import type { NotificationItem } from "./types";

function item(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: "n1",
    kind: "request",
    sessionId: "s1",
    title: "等待审批",
    unread: true,
    createdAt: 1,
    ...overrides,
  };
}

describe("notifications store", () => {
  it("counts and clears unread", () => {
    const items = [item({ id: "a" }), item({ id: "b", unread: false })];
    expect(unreadCount(items)).toBe(1);
    expect(markRead(items, "a").every((entry) => !entry.unread)).toBe(true);
    expect(markAllRead(items).every((entry) => !entry.unread)).toBe(true);
  });

  it("dedupes by id and keeps requests distinct", () => {
    const first = pushNotification([], item({ id: "a" }));
    const again = pushNotification(first, item({ id: "a" }));
    expect(again).toHaveLength(1);
    const second = pushNotification(again, item({ id: "b" }));
    expect(second).toHaveLength(2);
  });

  it("merges activity per session into one unread item", () => {
    const activity = { id: "activity:s1", sessionId: "s1", title: "会话有新动态", createdAt: 1 };
    const one = upsertActivity([], activity);
    const two = upsertActivity(one, { ...activity, createdAt: 2 });
    expect(two).toHaveLength(1);
    expect(two[0].kind).toBe("activity");
    expect(two[0].unread).toBe(true);
    expect(two[0].createdAt).toBe(2);
  });
});
