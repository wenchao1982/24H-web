import { useCallback, useEffect, useState } from "react";
import { t, type TranslationKey } from "../i18n";
import { configValue, formatJson, loadConfig, saveConfigPath } from "./configForm";

export interface JsonConfigPanelProps {
  /** 配置点路径，如 `provider_routing`。 */
  path: string;
  titleKey: TranslationKey;
  hintKey: TranslationKey;
}

/**
 * M16 通用 JSON 配置面板：读取某点路径的 config.yaml 字段，允许以 JSON 编辑并保存。
 * 用于 provider_routing / fallback / lsp / subscription_proxy 等结构不固定的配置。
 */
export default function JsonConfigPanel({ path, titleKey, hintKey }: JsonConfigPanelProps) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const config = await loadConfig();
      setText(formatJson(configValue(config, path)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("configForm.error.load"));
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setError(t("configForm.error.json"));
      return;
    }
    setBusy(true);
    setSaved(false);
    void (async () => {
      try {
        await saveConfigPath(path, parsed);
        setSaved(true);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("configForm.error.save"));
      } finally {
        setBusy(false);
      }
    })();
  };

  if (loading) {
    return <p className="empty">{t("configForm.loading")}</p>;
  }

  return (
    <div className="settings-section">
      <div className="card">
        <h3>{t(titleKey)}</h3>
        <p className="muted">{t(hintKey)}</p>
        {error ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}
        <textarea
          className="config-json"
          aria-label={t(titleKey)}
          rows={12}
          spellCheck={false}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setSaved(false);
          }}
        />
        <div className="row">
          <button className="primary" type="button" disabled={busy} onClick={save}>
            {t("configForm.save")}
          </button>
          {saved ? <span className="muted">{t("configForm.saved")}</span> : null}
        </div>
      </div>
    </div>
  );
}
