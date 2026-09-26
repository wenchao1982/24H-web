import { useState, type FormEvent } from "react";
import type { AgentSummary } from "./agents";

export type CreateProfileParams = {
  name: string;
  description?: string;
  clone_from?: string;
};

export interface AgentCreatePanelProps {
  mode: "new" | "clone";
  agents: AgentSummary[];
  defaultCloneFrom?: string;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit: (params: CreateProfileParams) => void;
}

/** 新建 / 克隆智能体表单（`profiles.create`）。 */
export default function AgentCreatePanel({
  mode,
  agents,
  defaultCloneFrom,
  busy = false,
  error = null,
  onCancel,
  onSubmit,
}: AgentCreatePanelProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cloneFrom, setCloneFrom] = useState(defaultCloneFrom ?? "");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) {
      return;
    }
    const params: CreateProfileParams = { name: trimmed };
    if (description.trim()) {
      params.description = description.trim();
    }
    if (mode === "clone" && cloneFrom) {
      params.clone_from = cloneFrom;
    }
    onSubmit(params);
  };

  return (
    <form className="card agent-create" onSubmit={submit}>
      <h3>{mode === "clone" ? "克隆智能体" : "新建智能体"}</h3>
      <div className="row">
        <input
          aria-label="智能体名称"
          placeholder="名称（小写 slug）"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <input
          aria-label="智能体描述"
          placeholder="描述（可选）"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        {mode === "clone" ? (
          <select
            aria-label="克隆来源"
            value={cloneFrom}
            onChange={(event) => setCloneFrom(event.target.value)}
          >
            <option value="">不克隆（全新）</option>
            {agents.map((agent) => (
              <option key={agent.name} value={agent.name}>
                {agent.displayName}
              </option>
            ))}
          </select>
        ) : null}
        <button className="primary" type="submit" disabled={busy}>
          {busy ? "创建中…" : "创建"}
        </button>
        <button type="button" className="ghost" onClick={onCancel}>
          取消
        </button>
      </div>
      {error ? (
        <p className="err" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
