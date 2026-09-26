import { useCallback, useEffect, useState } from "react";
import { useGateway } from "../chat/GatewayProvider";
import { normalizePlugins, type PluginEntry } from "./plugins";

/** 智能体页「插件」面板：经 L1 网关 `plugins.manage` 列表/启停。 */
export default function PluginsPanel() {
  const gateway = useGateway();
  const [plugins, setPlugins] = useState<PluginEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await gateway.connect().catch(() => undefined);
      const result = await gateway.request("plugins.manage", { action: "list" });
      setPlugins(normalizePlugins(result));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载插件失败");
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = useCallback(
    async (plugin: PluginEntry) => {
      const enabled = !plugin.enabled;
      setBusy(plugin.name);
      try {
        await gateway.request("plugins.manage", {
          action: enabled ? "enable" : "disable",
          name: plugin.name,
        });
        setPlugins((current) =>
          current.map((entry) =>
            entry.name === plugin.name ? { ...entry, enabled } : entry,
          ),
        );
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "切换插件失败");
      } finally {
        setBusy(null);
      }
    },
    [gateway],
  );

  if (loading) {
    return <p className="empty">加载插件中…</p>;
  }

  return (
    <div className="plugins">
      {error ? <p className="err">{error}</p> : null}
      {plugins.length === 0 ? (
        <p className="empty">暂无插件。</p>
      ) : (
        <ul className="toolset-list">
          {plugins.map((plugin) => (
            <li className="toolset-item" key={plugin.name}>
              <label className="skill-toggle">
                <input
                  type="checkbox"
                  aria-label={`启用插件 ${plugin.name}`}
                  checked={plugin.enabled}
                  disabled={busy === plugin.name}
                  onChange={() => void toggle(plugin)}
                />
              </label>
              <span className="skill-name">{plugin.name}</span>
              {plugin.version ? (
                <span className="skill-desc muted">{plugin.version}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
