import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { t } from "../i18n";
import { normalizeComputerUse, type ComputerUseStatus } from "./computerUse";

const STATUS_PATH = "/api/hermes/tools/computer-use/status";
const GRANT_PATH = "/api/hermes/tools/computer-use/permissions/grant";

/** 设置 → 高级 → Computer Use（T23.12）：查看状态并授予权限。 */
export default function ComputerUsePanel() {
  const [status, setStatus] = useState<ComputerUseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(normalizeComputerUse(await api<unknown>(STATUS_PATH)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("computerUse.error.load"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grant = () => {
    setBusy(true);
    void (async () => {
      try {
        await api(GRANT_PATH, {
          method: "POST",
          body: JSON.stringify({ permission: "computer_use" }),
        });
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("computerUse.error.grant"));
      } finally {
        setBusy(false);
      }
    })();
  };

  if (loading) {
    return <p className="empty">{t("computerUse.loading")}</p>;
  }

  return (
    <div className="settings-section">
      <div className="card">
        <h3>{t("computerUse.title")}</h3>
        <p className="muted">{t("computerUse.hint")}</p>
        {error ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}
        {status ? (
          <>
            <p aria-label={t("computerUse.availableLabel")}>
              {status.available ? t("computerUse.available") : t("computerUse.unavailable")}
            </p>
            <p aria-label={t("computerUse.grantedLabel")}>
              {status.granted ? t("computerUse.granted") : t("computerUse.notGranted")}
            </p>
            {status.permissions.length > 0 ? (
              <ul className="toolset-list">
                {status.permissions.map((permission) => (
                  <li className="toolset-item" key={permission}>
                    <span className="skill-name">{permission}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {status.detail ? <p className="muted">{status.detail}</p> : null}
          </>
        ) : (
          <p className="empty">{t("computerUse.empty")}</p>
        )}
        <div className="row">
          <button
            className="primary"
            type="button"
            disabled={busy || status?.granted === true}
            onClick={grant}
          >
            {t("computerUse.grant")}
          </button>
        </div>
      </div>
    </div>
  );
}
