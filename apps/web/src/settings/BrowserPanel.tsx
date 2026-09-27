import { useCallback, useEffect, useState } from "react";
import { useGateway } from "../chat/GatewayProvider";
import { t } from "../i18n";
import { browserParams, normalizeBrowserStatus, type BrowserAction, type BrowserStatus } from "./browser";

/** 设置 → 高级 → 浏览器控制：L1 `browser.manage` 状态 / 连接 / 断开。 */
export default function BrowserPanel() {
  const gateway = useGateway();
  const [status, setStatus] = useState<BrowserStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<BrowserAction | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(
        normalizeBrowserStatus(await gateway.request("browser.manage", browserParams("status"))),
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("browser.error.load"));
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = (action: BrowserAction) => {
    setBusy(action);
    void (async () => {
      try {
        setStatus(
          normalizeBrowserStatus(await gateway.request("browser.manage", browserParams(action))),
        );
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("browser.error.action"));
      } finally {
        setBusy(null);
      }
    })();
  };

  if (loading) {
    return <p className="empty">{t("browser.loading")}</p>;
  }

  return (
    <div className="settings-section">
      <div className="card">
        <h3>{t("browser.title")}</h3>
        <p className="muted">{t("browser.hint")}</p>
        {error ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}
        <p aria-label={t("browser.stateLabel")}>
          {status?.connected ? t("browser.connected") : t("browser.disconnected")}
        </p>
        {status?.engine ? <p className="muted">{t("browser.engine", { engine: status.engine })}</p> : null}
        {status?.url ? <p className="muted">{t("browser.url", { url: status.url })}</p> : null}
        {status?.message ? <p className="muted">{status.message}</p> : null}
        <div className="row">
          <button
            type="button"
            className="primary"
            disabled={busy !== null || status?.connected === true}
            aria-label={t("browser.connect")}
            onClick={() => run("connect")}
          >
            {t("browser.connect")}
          </button>
          <button
            type="button"
            className="ghost"
            disabled={busy !== null || status?.connected !== true}
            aria-label={t("browser.disconnect")}
            onClick={() => run("disconnect")}
          >
            {t("browser.disconnect")}
          </button>
        </div>
      </div>
    </div>
  );
}
