import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";
import { useNotifications } from "./NotificationsProvider";

export interface NotificationsBellProps {
  /** 点击某条通知：跳转到对应会话（无会话则空）。 */
  onSelect?: (sessionId: string | null) => void;
}

/** 侧栏底部通知铃：未读徽标 + 挂起/活动聚合面板。 */
export default function NotificationsBell({ onSelect }: NotificationsBellProps) {
  const { items, unread, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const select = (id: string, sessionId: string | null) => {
    markRead(id);
    setOpen(false);
    onSelect?.(sessionId);
  };

  return (
    <div className="notifications" ref={rootRef}>
      <button
        type="button"
        className="nav-btn notifications-btn"
        aria-label={t("nav.notifications")}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-active={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="nav-icon" aria-hidden="true">
          🔔
        </span>
        <span className="nav-label">{t("nav.notifications")}</span>
        {unread > 0 ? (
          <span className="notifications-badge" data-testid="notifications-badge" aria-hidden="true">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="notifications-panel" role="dialog" aria-label={t("notifications.title")}>
          <div className="notifications-head">
            <span className="notifications-head-title">{t("notifications.title")}</span>
            {unread > 0 ? (
              <button type="button" className="ghost" onClick={markAllRead}>
                {t("notifications.markAllRead")}
              </button>
            ) : null}
          </div>
          {items.length === 0 ? (
            <p className="empty">{t("notifications.empty")}</p>
          ) : (
            <ul className="notifications-list">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="notification-item"
                    data-unread={item.unread}
                    data-kind={item.kind}
                    onClick={() => select(item.id, item.sessionId)}
                  >
                    <span className="notification-item-title">{item.title}</span>
                    {item.detail ? (
                      <span className="notification-item-detail">{item.detail}</span>
                    ) : null}
                    {item.sessionId ? (
                      <span className="notification-item-session">{item.sessionId}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
