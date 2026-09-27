import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { t } from "../i18n";
import {
  normalizeCurator,
  normalizeGraph,
  type CuratorItem,
  type LearningGraph,
} from "./learning";

const CURATOR_PATH = "/api/hermes/curator";
const GRAPH_PATH = "/api/hermes/learning/graph";

/** 设置 → 高级 → 学习/策展：展示学习策展条目与学习旅程图。 */
export default function LearningPanel() {
  const [curator, setCurator] = useState<CuratorItem[]>([]);
  const [graph, setGraph] = useState<LearningGraph>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [curatorRaw, graphRaw] = await Promise.all([
        api<unknown>(CURATOR_PATH).catch(() => null),
        api<unknown>(GRAPH_PATH).catch(() => null),
      ]);
      setCurator(normalizeCurator(curatorRaw));
      setGraph(normalizeGraph(graphRaw));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("learning.error.load"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="empty">{t("learning.loading")}</p>;
  }

  const labelOf = (id: string) =>
    graph.nodes.find((node) => node.id === id)?.label ?? id;

  return (
    <div className="settings-section">
      <div className="card">
        <h3>{t("learning.title")}</h3>
        <p className="muted">{t("learning.hint")}</p>
        {error ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}

        <h4>{t("learning.curatorTitle")}</h4>
        {curator.length === 0 ? (
          <p className="empty">{t("learning.empty")}</p>
        ) : (
          <ul className="toolset-list">
            {curator.map((item, index) => (
              <li className="toolset-item learning-item" key={`${item.title}-${index}`}>
                <span className="skill-name">{item.title}</span>
                {item.kind ? <span className="skill-desc muted">{item.kind}</span> : null}
                {item.summary ? <span className="skill-desc muted">{item.summary}</span> : null}
                {item.at ? <span className="skill-desc muted">{item.at}</span> : null}
              </li>
            ))}
          </ul>
        )}

        <h4>{t("learning.graphTitle")}</h4>
        {graph.nodes.length === 0 ? (
          <p className="empty">{t("learning.graphEmpty")}</p>
        ) : (
          <>
            <ul className="toolset-list">
              {graph.nodes.map((node) => (
                <li className="toolset-item" key={node.id}>
                  <span className="skill-name">{node.label}</span>
                  {node.kind ? <span className="skill-desc muted">{node.kind}</span> : null}
                </li>
              ))}
            </ul>
            {graph.edges.length > 0 ? (
              <ul className="learning-edges">
                {graph.edges.map((edge, index) => (
                  <li key={`${edge.from}-${edge.to}-${index}`}>
                    {labelOf(edge.from)} → {labelOf(edge.to)}
                    {edge.label ? ` (${edge.label})` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
