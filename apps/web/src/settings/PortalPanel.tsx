import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { t } from "../i18n";
import { formatUsage, normalizePortal, type PortalInfo } from "./portal";

const PORTAL_PATH = "/api/hermes/portal";

/** 设置 → 高级 → 门户：Plan / 用量入口（只读）。 */
export default function PortalPanel() {
  const [portal, setPortal] = useState<PortalInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPortal(normalizePortal(await api<unknown>(PORTAL_PATH)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("portal.error.load"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="empty">{t("portal.loading")}</p>;
  }

  return (
    <div className="settings-section">
      <div className="card">
        <h3>{t("portal.title")}</h3>
        <p className="muted">{t("portal.hint")}</p>
        {error ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}
        {portal ? (
          <>
            <dl className="portal-info">
              <dt>{t("portal.plan")}</dt>
              <dd>{portal.plan}</dd>
              {portal.status ? (
                <>
                  <dt>{t("portal.status")}</dt>
                  <dd>{portal.status}</dd>
                </>
              ) : null}
              {portal.renewsAt ? (
                <>
                  <dt>{t("portal.renews")}</dt>
                  <dd>{portal.renewsAt}</dd>
                </>
              ) : null}
              {portal.usage ? (
                <>
                  <dt>{t("portal.usage")}</dt>
                  <dd>{formatUsage(portal.usage)}</dd>
                </>
              ) : null}
            </dl>
            <div className="row">
              <a className="primary" href="/usage">
                {t("portal.openUsage")}
              </a>
            </div>
          </>
        ) : (
          <p className="empty">{t("portal.empty")}</p>
        )}
      </div>
    </div>
  );
}
