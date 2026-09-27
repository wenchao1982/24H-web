import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";
import { useNotifications } from "./NotificationsProvider";
import {
  badgeVisible,
  playNotificationSound,
  readNotificationPrefs,
  storeNotificationPrefs,
  type NotificationPreferences,
} from "./preferences";

export interface NotificationsBellProps {
  /** 点击某条通知：跳转到对应会话（无会话则空）。 */
  onSelect?: (sessionId: string | null) => void;
}

/** 侧栏底部通知铃：未读徽标 + 挂起/活动聚合面板 + 本地偏好。 */
export default function NotificationsBell({ onSelect }: NotificationsBellProps) {
  const { items, unread, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPreferences>(() => readNotificationPrefs());
  const rootRef = useRef<HTMLDivElement>(null);
  const prevUnread = useRef(unread);

  const updatePrefs = (patch: Partial<NotificationPreferences>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      storeNotificationPrefs(next);
      return next;
    });
  };

  // 新通知到达且启用提示音时播放（无 WebAudio 时静默）。
  useEffect(() => {
    if (unread > prevUnread.current && prefs.enabled && prefs.sound && !prefs.dnd) {
      playNotificationSound();
    }
    prevUnread.current = unread;
  }, [unread, prefs]);

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

  const showBadge = unread > 0 && badgeVisible(prefs);

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
        {showBadge ? (
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

          {!prefs.enabled ? (
            <p className="empty">{t("notifications.disabled")}</p>
          ) : items.length === 0 ? (
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

          <div className="notifications-prefs">
            <span className="notifications-prefs-title">{t("notifications.prefs.title")}</span>
            <label>
              <input
                type="checkbox"
                checked={prefs.enabled}
                aria-label={t("notifications.prefs.enabled")}
                onChange={(event) => updatePrefs({ enabled: event.target.checked })}
              />
              {t("notifications.prefs.enabled")}
            </label>
            <label>
              <input
                type="checkbox"
                checked={prefs.sound}
                aria-label={t("notifications.prefs.sound")}
                onChange={(event) => updatePrefs({ sound: event.target.checked })}
              />
              {t("notifications.prefs.sound")}
            </label>
            <label>
              <input
                type="checkbox"
                checked={prefs.dnd}
                aria-label={t("notifications.prefs.dnd")}
                onChange={(event) => updatePrefs({ dnd: event.target.checked })}
              />
              {t("notifications.prefs.dnd")}
            </label>
          </div>
        </div>
      ) : null}
    </div>
  );
}
