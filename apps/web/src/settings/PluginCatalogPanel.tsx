import { useCallback, useEffect, useState } from "react";
import { useGateway } from "../chat/GatewayProvider";
import { t } from "../i18n";
import { normalizePluginCatalog, type PluginCatalogEntry } from "./pluginCatalog";

/** 设置 → 集成 → 插件目录（T23.15）：经 `plugins.manage` 浏览并安装插件。 */
export default function PluginCatalogPanel() {
  const gateway = useGateway();
  const [entries, setEntries] = useState<PluginCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await gateway.connect().catch(() => undefined);
      const result = await gateway.request("plugins.manage", { action: "catalog" });
      setEntries(normalizePluginCatalog(result));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pluginCatalog.error.load"));
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  useEffect(() => {
    void load();
  }, [load]);

  const install = (name: string) => {
    setBusy(name);
    void (async () => {
      try {
        await gateway.request("plugins.manage", { action: "install", name });
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("pluginCatalog.error.install"));
      } finally {
        setBusy(null);
      }
    })();
  };

  if (loading) {
    return <p className="empty">{t("pluginCatalog.loading")}</p>;
  }

  return (
    <div className="settings-section">
      <div className="card">
        <h3>{t("pluginCatalog.title")}</h3>
        <p className="muted">{t("pluginCatalog.hint")}</p>
        {error ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}
        {entries.length === 0 ? (
          <p className="empty">{t("pluginCatalog.empty")}</p>
        ) : (
          <ul className="toolset-list">
            {entries.map((entry) => (
              <li className="toolset-item" key={entry.name}>
                <span className="skill-name">{entry.name}</span>
                {entry.version ? (
                  <span className="skill-desc muted">{entry.version}</span>
                ) : null}
                {entry.description ? (
                  <span className="skill-desc muted">{entry.description}</span>
                ) : null}
                <button
                  type="button"
                  className="primary"
                  aria-label={t("pluginCatalog.installOf", { name: entry.name })}
                  disabled={entry.installed || busy === entry.name}
                  onClick={() => install(entry.name)}
                >
                  {entry.installed ? t("pluginCatalog.installed") : t("pluginCatalog.install")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
