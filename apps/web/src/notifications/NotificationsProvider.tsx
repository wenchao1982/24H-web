import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useGateway } from "../chat/GatewayProvider";
import { requestPrompt, type RequestKind } from "../chat/types";
import { t, type TranslationKey } from "../i18n";
import {
  markAllRead as markAllReadItems,
  markRead as markReadItem,
  pushNotification,
  unreadCount as countUnread,
  upsertActivity,
} from "./store";
import type { NotificationItem } from "./types";

const REQUEST_KINDS: RequestKind[] = ["approval", "clarify", "sudo", "secret", "mcp.setup"];

const REQUEST_TITLE: Record<RequestKind, TranslationKey> = {
  approval: "notifications.request.approval",
  clarify: "notifications.request.clarify",
  sudo: "notifications.request.sudo",
  secret: "notifications.request.secret",
  "mcp.setup": "notifications.request.mcp.setup",
};

function sessionIdOf(payload: Record<string, unknown>): string | null {
  const raw = payload.session_id ?? payload.sessionId ?? payload.session;
  return typeof raw === "string" && raw.trim() !== "" ? raw : null;
}

export interface NotificationsContextValue {
  items: NotificationItem[];
  unread: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue>({
  items: [],
  unread: 0,
  markRead: () => undefined,
  markAllRead: () => undefined,
});

/**
 * 通知中心（纯客户端）：订阅网关的挂起请求（审批/澄清/sudo/secret/MCP）与
 * `done` 活动事件，聚合为未读通知；点击直达会话。无后端依赖。
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const gateway = useGateway();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const seqRef = useRef(0);

  useEffect(() => {
    const unsubscribes = REQUEST_KINDS.map((kind) =>
      gateway.onServerRequest(kind, (params) => {
        const sessionId = sessionIdOf(params);
        setItems((current) =>
          pushNotification(current, {
            id: `request:${kind}:${seqRef.current++}`,
            kind: "request",
            requestKind: kind,
            sessionId,
            title: t(REQUEST_TITLE[kind]),
            detail: requestPrompt(params),
            unread: true,
            createdAt: Date.now(),
          }),
        );
      }),
    );
    unsubscribes.push(
      gateway.on("done", (payload) => {
        const sessionId = sessionIdOf(payload);
        setItems((current) =>
          upsertActivity(current, {
            id: `activity:${sessionId ?? "global"}`,
            sessionId,
            title: t("notifications.activity.done"),
            createdAt: Date.now(),
          }),
        );
      }),
    );
    return () => {
      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }
    };
  }, [gateway]);

  const markRead = useCallback((id: string) => setItems((cur) => markReadItem(cur, id)), []);
  const markAllRead = useCallback(() => setItems((cur) => markAllReadItems(cur)), []);

  const value = useMemo<NotificationsContextValue>(
    () => ({ items, unread: countUnread(items), markRead, markAllRead }),
    [items, markRead, markAllRead],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

/** 取通知中心；无 Provider 时返回空默认值（纯展示）。 */
export function useNotifications(): NotificationsContextValue {
  return useContext(NotificationsContext);
}
