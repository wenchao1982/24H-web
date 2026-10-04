import { useCallback, useEffect, useState } from "react";
import { useGateway } from "../chat/GatewayProvider";
import {
  deserializeFlow,
  normalizeDelegation,
  planExecution,
  serializeFlow,
  type DelegationTree,
  type ExecutionStep,
  type Flow,
  type FlowKind,
  type FlowNode,
} from "./flow";

const DEFAULT_FLOW: Flow = {
  nodes: [
    { id: "n-1", kind: "agent", label: "研究员", x: 40, y: 40 },
    { id: "n-2", kind: "agent", label: "编码", x: 260, y: 40 },
    { id: "n-3", kind: "decision", label: "评审通过？", x: 260, y: 160 },
  ],
  edges: [
    { from: "n-1", to: "n-2", inject: true },
    { from: "n-2", to: "n-3", inject: true },
  ],
};

const SUBAGENT_EVENTS = [
  "subagent.spawn_requested",
  "subagent.start",
  "subagent.progress",
  "subagent.tool",
  "subagent.complete",
];

/** 可视化编排（M21）：画布 + 变量注入 `{{node.output}}` + 运行视图（委派树）。 */
export default function OrchestrationPage() {
  const gateway = useGateway();
  const [flow, setFlow] = useState<Flow>(DEFAULT_FLOW);
  const [selectedId, setSelectedId] = useState<string | null>("n-1");
  const [tree, setTree] = useState<DelegationTree | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [plan, setPlan] = useState<ExecutionStep[]>([]);
  const [spawnPath, setSpawnPath] = useState("");
  const [ioMessage, setIoMessage] = useState<string | null>(null);
  const [ioBusy, setIoBusy] = useState(false);
  const [snapshots, setSnapshots] = useState<string[]>([]);

  const refreshRun = useCallback(async () => {
    try {
      await gateway.connect().catch(() => undefined);
      const result = await gateway.request("delegation.status", {});
      setTree(normalizeDelegation(result));
      setRunError(null);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "无法读取委派状态");
      setTree(null);
    }
  }, [gateway]);

  useEffect(() => {
    void refreshRun();
    const unsubscribes = SUBAGENT_EVENTS.map((name) =>
      gateway.on(name, () => {
        void refreshRun();
      }),
    );
    return () => {
      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }
    };
  }, [gateway, refreshRun]);

  const nodeById = (id: string) => flow.nodes.find((node) => node.id === id);

  const withGateway = async <T,>(fn: () => Promise<T>): Promise<T> => {
    await gateway.connect().catch(() => undefined);
    return fn();
  };

  const exportFlow = async () => {
    setIoBusy(true);
    setIoMessage(null);
    try {
      const result = await withGateway(() =>
        gateway.request("spawn_tree.save", { subagents: serializeFlow(flow).subagents }),
      );
      const path =
        result && typeof result === "object" && typeof (result as { path?: unknown }).path === "string"
          ? (result as { path: string }).path
          : null;
      setIoMessage(path ? `已保存：${path}` : "已保存编排");
    } catch (err) {
      setIoMessage(err instanceof Error ? err.message : "导出失败");
    } finally {
      setIoBusy(false);
    }
  };

  const importFlow = async () => {
    if (spawnPath.trim() === "") {
      return;
    }
    setIoBusy(true);
    setIoMessage(null);
    try {
      const result = await withGateway(() =>
        gateway.request("spawn_tree.load", { path: spawnPath.trim() }),
      );
      const loaded = deserializeFlow(result);
      if (loaded.nodes.length === 0) {
        setIoMessage("快照无可识别节点");
        return;
      }
      setFlow(loaded);
      setSelectedId(loaded.nodes[0].id);
      setPlan([]);
      setIoMessage(`已载入 ${loaded.nodes.length} 个节点`);
    } catch (err) {
      setIoMessage(err instanceof Error ? err.message : "导入失败");
    } finally {
      setIoBusy(false);
    }
  };

  const listFlows = async () => {
    setIoBusy(true);
    setIoMessage(null);
    try {
      const result = await withGateway(() => gateway.request("spawn_tree.list", {}));
      const record = result && typeof result === "object" ? (result as Record<string, unknown>) : {};
      const raw = Array.isArray(result)
        ? result
        : Array.isArray(record.trees)
          ? record.trees
          : Array.isArray(record.items)
            ? record.items
            : [];
      const paths = raw.flatMap((entry) => {
        if (typeof entry === "string") {
          return [entry];
        }
        if (entry && typeof entry === "object") {
          const value = (entry as Record<string, unknown>).path ?? (entry as Record<string, unknown>).name;
          return typeof value === "string" ? [value] : [];
        }
        return [];
      });
      setSnapshots(paths);
      if (paths.length === 0) {
        setIoMessage("无已保存快照");
      }
    } catch (err) {
      setIoMessage(err instanceof Error ? err.message : "读取快照失败");
    } finally {
      setIoBusy(false);
    }
  };

  const buildPlan = () => {
    const outputs: Record<string, string> = {};
    for (const node of flow.nodes) {
      outputs[node.id] = `[${node.label} 输出]`;
    }
    setPlan(planExecution(flow, outputs));
  };

  const updateLabel = (label: string) => {
    if (!selectedId) {
      return;
    }
    setFlow((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.id === selectedId ? { ...node, label } : node)),
    }));
  };

  const setKind = (kind: FlowKind) => {
    if (!selectedId) {
      return;
    }
    setFlow((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.id === selectedId ? { ...node, kind } : node)),
    }));
  };

  const updatePrompt = (prompt: string) => {
    if (!selectedId) {
      return;
    }
    setFlow((current) => ({
      ...current,
      nodes: current.nodes.map((node) =>
        node.id === selectedId ? { ...node, prompt: prompt === "" ? undefined : prompt } : node,
      ),
    }));
  };

  const addNode = () => {
    const id = `n-${Date.now()}`;
    const node: FlowNode = { id, kind: "agent", label: "新节点", x: 40 + flow.nodes.length * 20, y: 40 };
    setFlow((current) => ({ ...current, nodes: [...current.nodes, node] }));
    setSelectedId(id);
  };

  const removeNode = (id: string) => {
    setFlow((current) => ({
      nodes: current.nodes.filter((node) => node.id !== id),
      edges: current.edges.filter((edge) => edge.from !== id && edge.to !== id),
    }));
    setSelectedId((current) => (current === id ? null : current));
  };

  return (
    <div className="orchestration-page">
      <div className="orchestration-toolbar">
        <h1 className="orchestration-title">编排</h1>
        <span className="muted">变量注入</span>
        <code className="orchestration-var">{"{{node.output}}"}</code>
        <button type="button" className="ghost" onClick={addNode}>
          添加节点
        </button>
        <button type="button" className="ghost" onClick={() => void refreshRun()}>
          刷新运行
        </button>
        <button type="button" className="ghost" disabled={ioBusy} onClick={() => void exportFlow()}>
          导出
        </button>
        <button type="button" className="ghost" disabled={ioBusy} onClick={() => void listFlows()}>
          列表
        </button>
        <button type="button" className="ghost" onClick={buildPlan}>
          规划
        </button>
      </div>

      <div className="orchestration-body">
        <div className="orchestration-canvas-wrap">
          <div className="orchestration-canvas">
            <svg className="orchestration-edges" aria-hidden="true">
              {flow.edges.map((edge) => {
                const from = nodeById(edge.from);
                const to = nodeById(edge.to);
                if (!from || !to) {
                  return null;
                }
                const x1 = from.x + 120;
                const y1 = from.y + 20;
                const x2 = to.x;
                const y2 = to.y + 20;
                return (
                  <g key={`${edge.from}-${edge.to}`}>
                    <path
                      d={`M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`}
                      fill="none"
                      stroke="var(--ds-border-l2)"
                      strokeWidth="1.5"
                      markerEnd="url(#orchestration-arrow)"
                    />
                    {edge.inject ? (
                      <text
                        x={(x1 + x2) / 2}
                        y={(y1 + y2) / 2 - 6}
                        textAnchor="middle"
                        className="orchestration-edge-label"
                        fontSize="10"
                      >
                        {"{{node.output}}"}
                      </text>
                    ) : null}
                  </g>
                );
              })}
              <defs>
                <marker
                  id="orchestration-arrow"
                  markerWidth="8"
                  markerHeight="8"
                  refX="6"
                  refY="4"
                  orient="auto"
                >
                  <path d="M0,0 L8,4 L0,8 z" fill="var(--ds-border-l2)" />
                </marker>
              </defs>
            </svg>

            {flow.nodes.map((node) => (
              <button
                key={node.id}
                type="button"
                className="orchestration-node"
                data-kind={node.kind}
                data-active={selectedId === node.id}
                style={{ left: node.x, top: node.y }}
                onClick={() => setSelectedId(node.id)}
              >
                <span className="orchestration-node-kind">
                  {node.kind === "agent" ? "agent" : node.kind === "decision" ? "判定" : "工具"}
                </span>
                <span className="orchestration-node-label">{node.label}</span>
              </button>
            ))}
          </div>

          {selectedId && nodeById(selectedId) ? (
            <div className="orchestration-inspector">
              <p className="orchestration-inspector-title">节点属性</p>
              <label className="orchestration-field">
                <span>名称</span>
                <input
                  aria-label="节点名称"
                  value={nodeById(selectedId)?.label ?? ""}
                  onChange={(event) => updateLabel(event.target.value)}
                />
              </label>
              <label className="orchestration-field">
                <span>类型</span>
                <select
                  aria-label="节点类型"
                  value={nodeById(selectedId)?.kind ?? "agent"}
                  onChange={(event) => setKind(event.target.value as FlowKind)}
                >
                  <option value="agent">agent</option>
                  <option value="decision">判定</option>
                  <option value="tool">工具</option>
                </select>
              </label>
              <label className="orchestration-field">
                <span>提示词</span>
                <textarea
                  aria-label="节点提示词"
                  rows={3}
                  value={nodeById(selectedId)?.prompt ?? ""}
                  onChange={(event) => updatePrompt(event.target.value)}
                  placeholder={"可引用上游输出，如 基于 {{node.output}}"}
                />
              </label>
              <button
                type="button"
                className="ghost danger"
                onClick={() => removeNode(selectedId)}
              >
                删除节点
              </button>
            </div>
          ) : null}
        </div>

        <aside className="orchestration-run" aria-label="运行视图">
          <div className="orchestration-run-head">
            <h2 className="orchestration-run-title">运行视图</h2>
            {tree ? (
              <span className="muted">
                {tree.paused ? "已暂停" : "运行中"} · {tree.active.length}
              </span>
            ) : null}
          </div>
          {runError ? (
            <p className="err" role="alert">
              {runError}
            </p>
          ) : tree && tree.active.length > 0 ? (
            <ul className="orchestration-tree">
              {tree.active.map((sub) => (
                <li key={sub.id} style={{ paddingLeft: sub.depth * 14 }}>
                  <i className="dot" data-on={sub.status === "running"} aria-hidden="true" />
                  {sub.name}
                  <span className="muted">{sub.status}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">暂无活动子代理。</p>
          )}

          <div className="orchestration-io">
            <p className="orchestration-inspector-title">导入（spawn_tree.load）</p>
            <div className="orchestration-io-row">
              <input
                aria-label="快照路径"
                placeholder="快照路径"
                value={spawnPath}
                onChange={(event) => setSpawnPath(event.target.value)}
              />
              <button
                type="button"
                className="ghost"
                disabled={ioBusy || spawnPath.trim() === ""}
                onClick={() => void importFlow()}
              >
                导入
              </button>
            </div>
            {ioMessage ? <p className="muted">{ioMessage}</p> : null}
            {snapshots.length > 0 ? (
              <ul className="orchestration-plan-list">
                {snapshots.map((path) => (
                  <li key={path}>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        setSpawnPath(path);
                        setIoMessage(null);
                      }}
                    >
                      选用
                    </button>{" "}
                    {path}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {plan.length > 0 ? (
            <div className="orchestration-plan">
              <p className="orchestration-inspector-title">执行规划（变量注入）</p>
              <ol className="orchestration-plan-list">
                {plan.map((step) => (
                  <li key={step.nodeId}>
                    <strong>{step.label}</strong>
                    {step.inputs.length > 0 ? (
                      <span className="muted"> ← {step.inputs.join(", ")}</span>
                    ) : null}
                    <pre className="orchestration-plan-prompt">
                      {step.resolved === "" ? "（无提示词）" : step.resolved}
                    </pre>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
