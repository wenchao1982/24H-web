import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { useGateway } from "./GatewayProvider";
import { t } from "../i18n";
import { normalizeConfig } from "../settings/config";
import { normalizeContextResult, normalizeContextSources, type ContextSource } from "./contextFiles";

export interface ContextFilesPanelProps {
  onClose?: () => void;
}

/**
 * 对话侧上下文文件面板（T23.1）：优先 `slash.exec {command:'/context'}`，
 * 失败/为空时回退 `GET /api/hermes/config`，展示项目上下文文件与加载状态。
 */
export default function ContextFilesPanel({ onClose }: ContextFilesPanelProps) {
  const gateway = useGateway();
  const [sources, setSources] = useState<ContextSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let viaSlash: ContextSource[] = [];
    try {
      await gateway.connect().catch(() => undefined);
      viaSlash = normalizeContextResult(
        await gateway.request("slash.exec", { command: "/context", args: "" }),
      );
    } catch {
      // slash.exec 不可用：回退到 config。
    }
    if (viaSlash.length > 0) {
      setSources(viaSlash);
      setError(null);
      setLoading(false);
      return;
    }
    try {
      const fallback = normalizeContextSources(
        normalizeConfig(await api<unknown>("/api/hermes/config")),
      );
      setSources(fallback);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("context.error.load"));
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="card context-panel">
      <div className="command-panel-head">
        <h3>{t("context.title")}</h3>
        {onClose ? (
          <button type="button" className="ghost" aria-label={t("context.close")} onClick={onClose}>
            ✕
          </button>
        ) : null}
      </div>
      <p className="muted">{t("context.hint")}</p>
      {error ? (
        <p className="err" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="empty">{t("context.loading")}</p>
      ) : sources.length === 0 ? (
        <p className="empty">{t("context.empty")}</p>
      ) : (
        <ul className="toolset-list" aria-label={t("context.listLabel")}>
          {sources.map((source) => (
            <li className="toolset-item" key={source.path}>
              <span className="skill-name">{source.path}</span>
              <span
                className="skill-desc muted"
                data-loaded={source.loaded}
                aria-label={t("context.statusOf", { path: source.path })}
              >
                {source.loaded ? t("context.loaded") : t("context.notLoaded")}
              </span>
              {source.detail ? <span className="skill-desc muted">{source.detail}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
