import { useCallback, useEffect, useState } from "react";
import { useGateway } from "../chat/GatewayProvider";
import { t } from "../i18n";
import { ConfirmDialog } from "../ui";
import {
  normalizeVaultEntries,
  vaultAddParams,
  vaultRemoveParams,
  type VaultEntry,
} from "./vault";

/** 设置 → 高级 → 密钥库：密钥仅掩码展示，支持新增/删除。连接器已独立（见集成 → 连接器）。 */
export default function VaultPanel() {
  const gateway = useGateway();
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<VaultEntry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEntries(normalizeVaultEntries(await gateway.request("vault.list", {})));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("vault.error.load"));
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = () => {
    const key = name.trim();
    if (!key || value === "") {
      return;
    }
    setBusy(true);
    void (async () => {
      try {
        await gateway.request("vault.add", vaultAddParams(key, value));
        setName("");
        setValue("");
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("vault.error.action"));
      } finally {
        setBusy(false);
      }
    })();
  };

  const confirmRemove = () => {
    const entry = pending;
    setPending(null);
    if (!entry) {
      return;
    }
    setBusy(true);
    void (async () => {
      try {
        await gateway.request("vault.remove", vaultRemoveParams(entry.name));
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("vault.error.action"));
      } finally {
        setBusy(false);
      }
    })();
  };

  if (loading) {
    return <p className="empty">{t("vault.loading")}</p>;
  }

  return (
    <div className="settings-section">
      <div className="card">
        <h3>{t("vault.title")}</h3>
        <p className="muted">{t("vault.hint")}</p>
        {error ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}

        <h4>{t("vault.entries")}</h4>
        {entries.length === 0 ? (
          <p className="empty">{t("vault.empty")}</p>
        ) : (
          <ul className="toolset-list">
            {entries.map((entry) => (
              <li className="toolset-item vault-item" key={entry.name}>
                <span className="skill-name">{entry.name}</span>
                <span className="skill-desc muted" aria-label={t("vault.maskedLabel", { name: entry.name })}>
                  ••••••••
                </span>
                <button
                  type="button"
                  className="danger"
                  disabled={busy}
                  aria-label={t("vault.removeAria", { name: entry.name })}
                  onClick={() => setPending(entry)}
                >
                  {t("vault.remove")}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="row">
          <input
            aria-label={t("vault.name")}
            placeholder={t("vault.namePlaceholder")}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <input
            type="password"
            aria-label={t("vault.value")}
            placeholder={t("vault.valuePlaceholder")}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <button
            type="button"
            className="primary"
            disabled={busy || name.trim() === "" || value === ""}
            aria-label={t("vault.add")}
            onClick={add}
          >
            {t("vault.add")}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={pending !== null}
        message={pending ? t("vault.confirm", { name: pending.name }) : ""}
        confirmLabel="确认删除"
        danger
        onConfirm={confirmRemove}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
