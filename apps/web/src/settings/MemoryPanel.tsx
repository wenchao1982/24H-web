import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { t } from "../i18n";
import { normalizeMemory, type MemoryState } from "./memory";

const MEMORY_PATH = "/api/hermes/memory";

/** 设置 → 集成 → 记忆：提供方切换 + 占用概览 + 重置。 */
export default function MemoryPanel() {
  const [state, setState] = useState<MemoryState>({ provider: "", providers: [], entries: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setState(normalizeMemory(await api<unknown>(MEMORY_PATH)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("memory.error.load"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const switchProvider = (provider: string) => {
    setBusy(true);
    setSaved(false);
    void (async () => {
      try {
        await api(`${MEMORY_PATH}/provider`, {
          method: "PUT",
          body: JSON.stringify({ provider }),
        });
        setState((current) => ({ ...current, provider }));
        setSaved(true);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("memory.error.provider"));
      } finally {
        setBusy(false);
      }
    })();
  };

  const reset = () => {
    setBusy(true);
    setSaved(false);
    void (async () => {
      try {
        await api(`${MEMORY_PATH}/reset`, { method: "POST" });
        setState((current) => ({ ...current, entries: [] }));
        setSaved(true);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("memory.error.reset"));
      } finally {
        setBusy(false);
      }
    })();
  };

  if (loading) {
    return <p className="empty">{t("memory.loading")}</p>;
  }

  return (
    <div className="settings-section">
      <div className="card">
        <h3>{t("memory.title")}</h3>
        <p className="muted">{t("memory.hint")}</p>
        {error ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}

        <label className="config-row">
          <span>{t("memory.provider")}</span>
          <select
            aria-label={t("memory.selectProvider")}
            value={state.provider}
            disabled={busy}
            onChange={(event) => switchProvider(event.target.value)}
          >
            {state.provider && !state.providers.some((entry) => entry.id === state.provider) ? (
              <option value={state.provider}>{state.provider}</option>
            ) : null}
            {state.providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
          {saved ? <span className="muted">{t("memory.saved")}</span> : null}
        </label>

        <h4>{t("memory.sizes")}</h4>
        {state.entries.length === 0 ? (
          <p className="empty">{t("memory.empty")}</p>
        ) : (
          <ul className="toolset-list">
            {state.entries.map((entry) => (
              <li className="toolset-item" key={entry.label}>
                <span className="skill-name">{entry.label}</span>
                <span className="skill-desc muted">{entry.value}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="row">
          <button type="button" className="danger" disabled={busy} onClick={reset}>
            {t("memory.reset")}
          </button>
        </div>
      </div>
    </div>
  );
}
