import type { NotificationItem } from "./types";

const LIMIT = 50;

export function unreadCount(items: NotificationItem[]): number {
  return items.filter((item) => item.unread).length;
}

/** 按 id 去重后前置插入（超出上限截断）。 */
export function pushNotification(
  items: NotificationItem[],
  next: NotificationItem,
): NotificationItem[] {
  if (items.some((item) => item.id === next.id)) {
    return items;
  }
  return [next, ...items].slice(0, LIMIT);
}

/**
 * 同一会话的活动通知合并为一条（保持单条、更新为未读并置顶）。
 * `request` 类不合并（每条挂起交互都需单独处理）。
 */
export function upsertActivity(
  items: NotificationItem[],
  next: Omit<NotificationItem, "kind" | "unread">,
): NotificationItem[] {
  const rest = items.filter(
    (item) => !(item.kind === "activity" && item.sessionId === next.sessionId),
  );
  const activity: NotificationItem = { ...next, kind: "activity", unread: true };
  return [activity, ...rest].slice(0, LIMIT);
}

export function markRead(items: NotificationItem[], id: string): NotificationItem[] {
  return items.map((item) => (item.id === id ? { ...item, unread: false } : item));
}

export function markAllRead(items: NotificationItem[]): NotificationItem[] {
  return items.map((item) => (item.unread ? { ...item, unread: false } : item));
}
