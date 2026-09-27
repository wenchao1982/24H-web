import { useState } from "react";
import { useGateway } from "../chat/GatewayProvider";
import { t } from "../i18n";
import { normalizeOneshot, oneshotParams } from "./oneshot";

/** 设置 → 高级 → 单次补全：输入提示词，经 L1 `llm.oneshot` 快速补全。 */
export default function QuickCompletePanel() {
  const gateway = useGateway();
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("");
  const [output, setOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complete = () => {
    const value = prompt.trim();
    if (!value || loading) {
      return;
    }
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        setOutput(normalizeOneshot(await gateway.request("llm.oneshot", oneshotParams(value, model))));
      } catch (err) {
        setError(err instanceof Error ? err.message : t("oneshot.error"));
      } finally {
        setLoading(false);
      }
    })();
  };

  return (
    <div className="settings-section">
      <div className="card">
        <h3>{t("oneshot.title")}</h3>
        <p className="muted">{t("oneshot.hint")}</p>
        {error ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}
        <label className="config-row">
          <span>{t("oneshot.model")}</span>
          <input
            aria-label={t("oneshot.model")}
            placeholder={t("oneshot.modelPlaceholder")}
            value={model}
            onChange={(event) => setModel(event.target.value)}
          />
        </label>
        <textarea
          className="oneshot-prompt"
          aria-label={t("oneshot.prompt")}
          placeholder={t("oneshot.placeholder")}
          rows={3}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
        <div className="row">
          <button
            type="button"
            className="primary"
            disabled={loading || prompt.trim() === ""}
            aria-label={t("oneshot.run")}
            onClick={complete}
          >
            {t("oneshot.run")}
          </button>
        </div>
        {loading ? <p className="empty">{t("oneshot.loading")}</p> : null}
        {output !== null ? (
          <pre className="toolset-config oneshot-output">{output || t("oneshot.empty")}</pre>
        ) : null}
      </div>
    </div>
  );
}
