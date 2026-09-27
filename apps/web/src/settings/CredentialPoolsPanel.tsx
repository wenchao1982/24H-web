import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "../i18n";
import { loadConfig, saveConfigPath } from "./configForm";
import { maskKey, normalizeCredentialPools, type CredentialProvider } from "./credentialPools";

/** 设置 → 模型 → 凭证池（T23.5）：同 provider 多 key 轮换；密钥掩码展示，绝不回显明文。 */
export default function CredentialPoolsPanel() {
  const [providers, setProviders] = useState<CredentialProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState("");
  const [value, setValue] = useState("");
  const poolsRef = useRef<Record<string, unknown[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const state = normalizeCredentialPools(await loadConfig());
      poolsRef.current = state.pools;
      setProviders(state.providers);
      setProvider(state.providers[0]?.provider ?? "");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("credentialPools.error.load"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = () => {
    const name = provider.trim();
    if (name === "" || value === "") {
      setError(t("credentialPools.error.input"));
      return;
    }
    const next: Record<string, unknown[]> = { ...poolsRef.current };
    next[name] = [...(next[name] ?? []), value];
    setBusy(true);
    setSaved(false);
    void (async () => {
      try {
        await saveConfigPath("credential_pools", next);
        poolsRef.current = next;
        setProviders(
          Object.entries(next).map(([entry, list]) => ({ provider: entry, count: list.length })),
        );
        setValue("");
        setSaved(true);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("credentialPools.error.save"));
      } finally {
        setBusy(false);
      }
    })();
  };

  if (loading) {
    return <p className="empty">{t("credentialPools.loading")}</p>;
  }

  return (
    <div className="settings-section">
      <div className="card">
        <h3>{t("credentialPools.title")}</h3>
        <p className="muted">{t("credentialPools.hint")}</p>
        {error ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}

        {providers.length === 0 ? (
          <p className="empty">{t("credentialPools.empty")}</p>
        ) : (
          <ul className="toolset-list">
            {providers.map((entry) => (
              <li className="toolset-item" key={entry.provider}>
                <span className="skill-name">{entry.provider}</span>
                <span className="skill-desc muted" aria-label={t("credentialPools.masked", { provider: entry.provider })}>
                  {Array.from({ length: Math.min(entry.count, 5) }, () => maskKey()).join(" ")}
                </span>
                <span className="skill-desc muted">
                  {t("credentialPools.count", { count: entry.count })}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="row">
          <input
            aria-label={t("credentialPools.provider")}
            placeholder={t("credentialPools.providerPlaceholder")}
            value={provider}
            onChange={(event) => setProvider(event.target.value)}
          />
          <input
            aria-label={t("credentialPools.value")}
            type="password"
            placeholder={t("credentialPools.valuePlaceholder")}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <button className="primary" type="button" disabled={busy} onClick={save}>
            {t("credentialPools.save")}
          </button>
          {saved ? <span className="muted">{t("credentialPools.saved")}</span> : null}
        </div>
      </div>
    </div>
  );
}
