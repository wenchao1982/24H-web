import type { RequestKind } from "../chat/types";

/** 通知类型：挂起交互（需处理）或会话活动（有新动态）。 */
export type NotificationKind = "request" | "activity";

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  /** 关联会话（无则全局）。 */
  sessionId: string | null;
  requestKind?: RequestKind;
  title: string;
  detail?: string;
  unread: boolean;
  createdAt: number;
}
