import { useCallback, useEffect, useState } from "react";
import { useGateway } from "../chat/GatewayProvider";
import { t } from "../i18n";
import {
  normalizeTtsResult,
  normalizeVoiceStatus,
  ttsParams,
  wakeStartParams,
  wakeStatusParams,
  wakeStopParams,
  type VoiceStatus,
} from "./voice";

/** 设置 → 高级 → 语音：唤醒词开关 + 状态 + 语音合成。 */
export default function VoicePanel() {
  const gateway = useGateway();
  const [status, setStatus] = useState<VoiceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [audio, setAudio] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(normalizeVoiceStatus(await gateway.request("wake.status", wakeStatusParams())));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("voice.error.load"));
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleWake = async () => {
    const next = !(status?.wake ?? false);
    setBusy(true);
    try {
      await gateway.request(
        next ? "wake.start" : "wake.stop",
        next ? wakeStartParams() : wakeStopParams(),
      );
      setStatus((current) => (current ? { ...current, wake: next } : current));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("voice.error.action"));
    } finally {
      setBusy(false);
    }
  };

  const speak = async () => {
    const value = text.trim();
    if (!value) {
      return;
    }
    setBusy(true);
    try {
      const result = await gateway.request("voice.tts", ttsParams(value));
      setAudio(normalizeTtsResult(result));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("voice.error.action"));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="empty">{t("voice.loading")}</p>;
  }

  return (
    <div className="settings-section">
      <div className="card">
        <h3>{t("voice.title")}</h3>
        <p className="muted">{t("voice.hint")}</p>
        {error ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}
        <p aria-label={t("voice.stateLabel")}>
          {status?.wake ? t("voice.wakeOn") : t("voice.wakeOff")}
          {status?.listening ? ` · ${t("voice.listening")}` : ""}
          {status?.voice ? ` · ${status.voice}` : ""}
        </p>
        <div className="row">
          <button
            type="button"
            className="primary"
            disabled={busy || status?.available === false}
            aria-pressed={status?.wake === true}
            aria-label={t("voice.wakeToggle")}
            onClick={() => void toggleWake()}
          >
            {status?.wake ? t("voice.disableWake") : t("voice.enableWake")}
          </button>
        </div>
      </div>

      <div className="card">
        <h4>{t("voice.ttsTitle")}</h4>
        <div className="row">
          <input
            aria-label={t("voice.ttsPlaceholder")}
            placeholder={t("voice.ttsPlaceholder")}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <button
            type="button"
            className="ghost"
            disabled={busy || text.trim() === ""}
            aria-label={t("voice.speak")}
            onClick={() => void speak()}
          >
            {t("voice.speak")}
          </button>
        </div>
        {audio ? (
          <p className="muted" aria-label={t("voice.ttsReady")}>
            {t("voice.ttsReady")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
