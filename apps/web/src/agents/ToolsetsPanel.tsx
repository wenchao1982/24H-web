import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { withProfile } from "./agents";
import { formatToolsetConfig, normalizeToolsets, type ToolsetEntry } from "./toolsets";

export interface ToolsetsPanelProps {
  /** 作用到该 profile（省略则为全局默认 profile）。 */
  profile?: string;
}

/** 智能体页「工具」面板：查看/启停 toolset 并展开配置。 */
export default function ToolsetsPanel({ profile }: ToolsetsPanelProps) {
  const [toolsets, setToolsets] = useState<ToolsetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [configName, setConfigName] = useState<string | null>(null);
  const [configText, setConfigText] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await api<unknown>(withProfile("/api/hermes/tools/toolsets", profile));
      setToolsets(normalizeToolsets(payload));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载工具集失败");
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = useCallback(
    async (toolset: ToolsetEntry) => {
      const enabled = !toolset.enabled;
      setBusy(toolset.name);
      try {
        await api(
          withProfile(`/api/hermes/tools/toolsets/${encodeURIComponent(toolset.name)}`, profile),
          {
            method: "PUT",
            body: JSON.stringify({ enabled }),
          },
        );
        setToolsets((current) =>
          current.map((entry) =>
            entry.name === toolset.name ? { ...entry, enabled } : entry,
          ),
        );
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "切换工具集失败");
      } finally {
        setBusy(null);
      }
    },
    [profile],
  );

  const openConfig = useCallback(
    async (toolset: ToolsetEntry) => {
      if (configName === toolset.name) {
        setConfigName(null);
        return;
      }
      setBusy(toolset.name);
      try {
        const payload = await api<unknown>(
          withProfile(
            `/api/hermes/tools/toolsets/${encodeURIComponent(toolset.name)}/config`,
            profile,
          ),
        );
        setConfigText(formatToolsetConfig(payload));
        setConfigName(toolset.name);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载配置失败");
      } finally {
        setBusy(null);
      }
    },
    [configName, profile],
  );

  if (loading) {
    return <p className="empty">加载工具集中…</p>;
  }

  return (
    <div className="toolsets">
      {error ? <p className="err">{error}</p> : null}
      {toolsets.length === 0 ? (
        <p className="empty">暂无工具集。</p>
      ) : (
        <ul className="toolset-list">
          {toolsets.map((toolset) => (
            <li className="toolset-item ds-card-row" key={toolset.name}>
              <label className="skill-toggle">
                <input
                  type="checkbox"
                  aria-label={`启用工具集 ${toolset.name}`}
                  checked={toolset.enabled}
                  disabled={busy === toolset.name}
                  onChange={() => void toggle(toolset)}
                />
              </label>
              <span className="skill-name">{toolset.name}</span>
              {toolset.description ? (
                <span className="skill-desc muted">{toolset.description}</span>
              ) : null}
              <button type="button" className="ghost" onClick={() => void openConfig(toolset)}>
                {configName === toolset.name ? "收起配置" : "配置"}
              </button>
              {configName === toolset.name ? (
                <pre className="toolset-config">{configText}</pre>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
