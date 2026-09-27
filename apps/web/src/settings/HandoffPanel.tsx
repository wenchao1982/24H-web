import { useCallback, useEffect, useState } from "react";
import { useGateway } from "../chat/GatewayProvider";
import { t } from "../i18n";
import { handoffFailParams, normalizeHandoff, type HandoffState } from "./handoff";

/** 设置 → 高级 → 交接：查看交接状态，必要时标记失败。 */
export default function HandoffPanel() {
  const gateway = useGateway();
  const [state, setState] = useState<HandoffState | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setState(normalizeHandoff(await gateway.request("handoff.state", {})));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("handoff.error.load"));
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  useEffect(() => {
    void load();
  }, [load]);

  const fail = () => {
    if (!window.confirm(t("handoff.confirm"))) {
      return;
    }
    setBusy(true);
    void (async () => {
      try {
        await gateway.request("handoff.fail", handoffFailParams(reason));
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("handoff.error.action"));
      } finally {
        setBusy(false);
      }
    })();
  };

  if (loading) {
    return <p className="empty">{t("handoff.loading")}</p>;
  }

  return (
    <div className="settings-section">
      <div className="card">
        <h3>{t("handoff.title")}</h3>
        <p className="muted">{t("handoff.hint")}</p>
        {error ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}
        <p aria-label={t("handoff.stateLabel")}>
          {state?.active ? t("handoff.active") : t("handoff.inactive")}
          {state?.next ? ` · ${t("handoff.next", { next: state.next })}` : ""}
        </p>
        {state?.reason ? <p className="muted">{state.reason}</p> : null}
        <label className="config-row">
          <span>{t("handoff.failReason")}</span>
          <input
            aria-label={t("handoff.failReason")}
            placeholder={t("handoff.failPlaceholder")}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <div className="row">
          <button
            type="button"
            className="danger"
            disabled={busy || state?.active !== true}
            aria-label={t("handoff.fail")}
            onClick={fail}
          >
            {t("handoff.fail")}
          </button>
        </div>
      </div>
    </div>
  );
}
