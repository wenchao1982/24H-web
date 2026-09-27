import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "../i18n";
import { loadConfig, saveConfigPath } from "./configForm";
import { applyHookToggle, normalizeHooks, type HookEntry, type HooksState } from "./hooks";

/** 设置 → 高级 → Event Hooks（T23.7）：列出 hooks 配置与 shell 钩子，支持启停。 */
export default function EventHooksPanel() {
  const [entries, setEntries] = useState<HookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const stateRef = useRef<HooksState>({ entries: [], raw: {}, form: "none" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const state = normalizeHooks(await loadConfig());
      stateRef.current = state;
      setEntries(state.entries);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("eventHooks.error.load"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (entry: HookEntry) => {
    const enabled = !entry.enabled;
    setBusy(entry.id);
    void (async () => {
      try {
        const raw = applyHookToggle(stateRef.current, entry.id, enabled);
        await saveConfigPath("hooks", raw);
        stateRef.current = { ...stateRef.current, raw };
        setEntries((current) =>
          current.map((item) => (item.id === entry.id ? { ...item, enabled } : item)),
        );
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("eventHooks.error.save"));
      } finally {
        setBusy(null);
      }
    })();
  };

  if (loading) {
    return <p className="empty">{t("eventHooks.loading")}</p>;
  }

  return (
    <div className="settings-section">
      <div className="card">
        <h3>{t("eventHooks.title")}</h3>
        <p className="muted">{t("eventHooks.hint")}</p>
        {error ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}
        {entries.length === 0 ? (
          <p className="empty">{t("eventHooks.empty")}</p>
        ) : (
          <ul className="toolset-list">
            {entries.map((entry) => (
              <li className="toolset-item" key={entry.id}>
                <label className="skill-toggle">
                  <input
                    type="checkbox"
                    aria-label={t("eventHooks.enable", { name: entry.name })}
                    checked={entry.enabled}
                    disabled={busy === entry.id}
                    onChange={() => toggle(entry)}
                  />
                </label>
                <span className="skill-name">{entry.name}</span>
                {entry.event ? (
                  <span className="skill-desc muted">{entry.event}</span>
                ) : null}
                {entry.shell ? (
                  <span className="skill-desc muted">{t("eventHooks.shell")}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
