import { useCallback, useEffect, useState } from "react";
import { useGateway } from "./GatewayProvider";
import { t } from "../i18n";
import { normalizePaused, normalizeSubagents, normalizeTail, type Subagent } from "./subagents";

export interface SubagentsPanelProps {
  sessionId: string | null;
  onClose?: () => void;
}

/** 对话内子代理观测/控制面板（T17.5）：列表 + 尾部输出 + 中断/指点/暂停委派。 */
export default function SubagentsPanel({ sessionId, onClose }: SubagentsPanelProps) {
  const gateway = useGateway();
  const [children, setChildren] = useState<Subagent[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tail, setTail] = useState("");
  const [steerText, setSteerText] = useState("");
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sessionId) {
      setChildren([]);
      return;
    }
    setLoading(true);
    try {
      setChildren(normalizeSubagents(await gateway.request("subagent.list", { session_id: sessionId })));
      try {
        setPaused(normalizePaused(await gateway.request("delegation.status", { session_id: sessionId })));
      } catch {
        // delegation.status 不可用时忽略
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("subagents.error.load"));
    } finally {
      setLoading(false);
    }
  }, [gateway, sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openTail = useCallback(
    async (child: Subagent) => {
      setSelected(child.id);
      setTail("");
      try {
        setTail(normalizeTail(await gateway.request("subagent.tail", { subagent_id: child.id })));
      } catch (err) {
        setError(err instanceof Error ? err.message : t("subagents.error.control"));
      }
    },
    [gateway],
  );

  const interrupt = useCallback(
    async (child: Subagent) => {
      try {
        await gateway.request("subagent.interrupt", { subagent_id: child.id });
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("subagents.error.control"));
      }
    },
    [gateway, load],
  );

  const steer = useCallback(async () => {
    const text = steerText.trim();
    if (!selected || !text) {
      return;
    }
    try {
      await gateway.request("subagent.steer", { subagent_id: selected, text });
      setSteerText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("subagents.error.control"));
    }
  }, [gateway, selected, steerText]);

  const togglePause = useCallback(async () => {
    const next = !paused;
    try {
      await gateway.request("delegation.pause", { paused: next });
      setPaused(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("subagents.error.control"));
    }
  }, [gateway, paused]);

  if (!sessionId) {
    return (
      <div className="card subagents-panel">
        <h3>{t("subagents.title")}</h3>
        <p className="empty">{t("subagents.selectSession")}</p>
      </div>
    );
  }

  return (
    <div className="card subagents-panel">
      <div className="subagents-head">
        <h3>{t("subagents.title")}</h3>
        <button type="button" className="ghost" disabled={loading} onClick={() => void load()}>
          {t("subagents.refresh")}
        </button>
        <label className="config-row">
          <input
            type="checkbox"
            aria-label={t("subagents.pause")}
            checked={paused}
            onChange={() => void togglePause()}
          />
          <span>{t("subagents.pause")}</span>
        </label>
        {onClose ? (
          <button type="button" className="ghost" aria-label={t("subagents.close")} onClick={onClose}>
            ✕
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="err" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="empty">{t("subagents.loading")}</p> : null}
      {!loading && children.length === 0 ? (
        <p className="empty">{t("subagents.empty")}</p>
      ) : null}
      {children.length > 0 ? (
        <ul className="toolset-list">
          {children.map((child) => (
            <li className="toolset-item" key={child.id}>
              <button
                type="button"
                className="session-item"
                data-active={child.id === selected}
                aria-label={t("subagents.tailAria", { name: child.name })}
                onClick={() => void openTail(child)}
              >
                {child.name}
                {child.status ? ` · ${child.status}` : ""}
              </button>
              {child.latest ? <span className="skill-desc muted">{child.latest}</span> : null}
              <button
                type="button"
                className="danger"
                disabled={child.status === "stopped"}
                onClick={() => void interrupt(child)}
              >
                {t("subagents.interrupt")}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {selected ? (
        <div className="subagents-tail">
          <pre className="toolset-config">{tail || t("subagents.noTail")}</pre>
          <div className="row">
            <input
              aria-label={t("subagents.steerPlaceholder")}
              placeholder={t("subagents.steerPlaceholder")}
              value={steerText}
              onChange={(event) => setSteerText(event.target.value)}
            />
            <button type="button" className="primary" onClick={() => void steer()}>
              {t("subagents.steer")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
