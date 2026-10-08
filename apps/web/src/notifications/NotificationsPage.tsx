import { useNavigate } from "react-router-dom";
import { t } from "../i18n";
import { useNotifications } from "./NotificationsProvider";

/** 独立页：通知中心——未读/挂起聚合 + 全部已读；带 `sessionId` 项直达会话。 */
export default function NotificationsPage() {
  const { items, unread, markRead, markAllRead } = useNotifications();
  const navigate = useNavigate();

  const open = (id: string, sessionId: string | null) => {
    markRead(id);
    if (sessionId) {
      navigate(`/chat?session=${encodeURIComponent(sessionId)}`);
    }
  };

  return (
    <div className="page notifications-page">
      <div className="page-head">
        <h2 className="page-title">{t("notifications.title")}</h2>
        {unread > 0 ? (
          <button type="button" className="ghost" onClick={markAllRead}>
            {t("notifications.markAllRead")}
          </button>
        ) : null}
      </div>
      <p className="muted">{t("notifications.hint")}</p>

      {items.length === 0 ? (
        <p className="empty">{t("notifications.empty")}</p>
      ) : (
        <ul className="notifications-list notifications-page-list">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="notification-item"
                data-unread={item.unread}
                data-kind={item.kind}
                onClick={() => open(item.id, item.sessionId)}
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
  );
}
