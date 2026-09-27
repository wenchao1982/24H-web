import { useCallback, useEffect, useState } from "react";
import { useGateway } from "./GatewayProvider";
import { t } from "../i18n";
import {
  listPersonalityArgs,
  normalizePersonalities,
  setPersonalityArgs,
  type PersonalityPreset,
} from "./personalities";

export interface PersonalityPanelProps {
  onClose?: () => void;
}

/** 对话侧 Personality 预设面板（T23.14）：经 `/personality` 列出并应用预设。 */
export default function PersonalityPanel({ onClose }: PersonalityPanelProps) {
  const gateway = useGateway();
  const [presets, setPresets] = useState<PersonalityPreset[]>([]);
  const [current, setCurrent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await gateway.connect().catch(() => undefined);
      const params = listPersonalityArgs();
      setPresets(normalizePersonalities(await gateway.request("slash.exec", params)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("personality.error.list"));
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  useEffect(() => {
    void load();
  }, [load]);

  const apply = (name: string) => {
    setBusy(name);
    void (async () => {
      try {
        await gateway.request("slash.exec", setPersonalityArgs(name));
        setCurrent(name);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("personality.error.set"));
      } finally {
        setBusy(null);
      }
    })();
  };

  return (
    <div className="card personality-panel">
      <div className="command-panel-head">
        <h3>{t("personality.title")}</h3>
        {onClose ? (
          <button type="button" className="ghost" aria-label={t("personality.close")} onClick={onClose}>
            ✕
          </button>
        ) : null}
      </div>
      <p className="muted">{t("personality.hint")}</p>
      {error ? (
        <p className="err" role="alert">
          {error}
        </p>
      ) : null}
      {current ? <p className="muted">{t("personality.current", { name: current })}</p> : null}
      {loading ? (
        <p className="empty">{t("personality.loading")}</p>
      ) : presets.length === 0 ? (
        <p className="empty">{t("personality.empty")}</p>
      ) : (
        <ul className="toolset-list">
          {presets.map((preset) => (
            <li className="toolset-item" key={preset.name}>
              <span className="skill-name">{preset.name}</span>
              {preset.description ? (
                <span className="skill-desc muted">{preset.description}</span>
              ) : null}
              <button
                type="button"
                className="primary"
                aria-label={t("personality.setOf", { name: preset.name })}
                disabled={busy === preset.name}
                onClick={() => apply(preset.name)}
              >
                {t("personality.set")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
