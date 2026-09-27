import { useState } from "react";
import { useGateway } from "../chat/GatewayProvider";
import { slashResultText } from "../chat/slash";
import { t } from "../i18n";

type Action = "on" | "off" | "status";

/** 设置 → 高级 → Codex Runtime（T23.16）：经 `/codex-runtime` 切换运行时。 */
export default function CodexRuntimePanel() {
  const gateway = useGateway();
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);

  const run = (action: Action) => {
    setBusy(action);
    setError(null);
    void (async () => {
      try {
        await gateway.connect().catch(() => undefined);
        const payload = await gateway.request("slash.exec", {
          command: "/codex-runtime",
          args: action,
        });
        setResult(slashResultText(payload) || t("codexRuntime.done", { action }));
      } catch (err) {
        setError(err instanceof Error ? err.message : t("codexRuntime.error"));
      } finally {
        setBusy(null);
      }
    })();
  };

  return (
    <div className="settings-section">
      <div className="card">
        <h3>{t("codexRuntime.title")}</h3>
        <p className="muted">{t("codexRuntime.hint")}</p>
        {error ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}
        <div className="row">
          <button
            type="button"
            className="primary"
            disabled={busy !== null}
            onClick={() => run("on")}
          >
            {t("codexRuntime.enable")}
          </button>
          <button type="button" className="ghost" disabled={busy !== null} onClick={() => run("off")}>
            {t("codexRuntime.disable")}
          </button>
          <button
            type="button"
            className="ghost"
            disabled={busy !== null}
            onClick={() => run("status")}
          >
            {t("codexRuntime.status")}
          </button>
        </div>
        {busy ? <p className="muted">{t("codexRuntime.loading")}</p> : null}
        {result ? (
          <pre className="command-result" aria-label={t("codexRuntime.result")}>
            {result}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
