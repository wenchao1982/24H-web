import { useState, type FormEvent } from "react";
import type { AgentDetail } from "./agents";

export type ConfigureProfileParams = {
  name: string;
  soul?: string;
  model?: string;
  provider?: string;
  disabled_skills?: string[];
};

export interface AgentEditPanelProps {
  agent: AgentDetail;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSave: (params: ConfigureProfileParams) => void;
}

/** 编辑智能体：SOUL / 模型 / 服务商 / 技能启停（`profiles.configure`）。 */
export default function AgentEditPanel({
  agent,
  busy = false,
  error = null,
  onCancel,
  onSave,
}: AgentEditPanelProps) {
  const [soul, setSoul] = useState(agent.soul);
  const [model, setModel] = useState(agent.model);
  const [provider, setProvider] = useState(agent.provider);
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(agent.skills.map((skill) => [skill.name, skill.enabled])),
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busy) {
      return;
    }
    const params: ConfigureProfileParams = {
      name: agent.name,
      soul,
      disabled_skills: agent.skills
        .filter((skill) => !enabled[skill.name])
        .map((skill) => skill.name),
    };
    const nextModel = model.trim();
    const nextProvider = provider.trim();
    const modelChanged =
      nextModel !== agent.model.trim() || nextProvider !== agent.provider.trim();
    if (nextModel && nextProvider && modelChanged) {
      params.model = nextModel;
      params.provider = nextProvider;
    }
    onSave(params);
  };

  return (
    <form className="card agent-edit" onSubmit={submit}>
      <h3>编辑智能体：{agent.displayName}</h3>

      <label className="agent-field">
        <span>SOUL</span>
        <textarea
          aria-label="SOUL 内容"
          className="agent-soul-input"
          value={soul}
          onChange={(event) => setSoul(event.target.value)}
        />
      </label>

      <div className="row">
        <input
          aria-label="模型服务商"
          placeholder="服务商（provider）"
          value={provider}
          onChange={(event) => setProvider(event.target.value)}
        />
        <input
          aria-label="模型名称"
          placeholder="模型（model）"
          value={model}
          onChange={(event) => setModel(event.target.value)}
        />
      </div>

      {agent.skills.length > 0 ? (
        <fieldset className="agent-skills-edit">
          <legend>技能</legend>
          {agent.skills.map((skill) => (
            <label key={skill.name} className="skill-toggle">
              <input
                type="checkbox"
                aria-label={`启用技能 ${skill.name}`}
                checked={enabled[skill.name] ?? skill.enabled}
                onChange={(event) =>
                  setEnabled((current) => ({ ...current, [skill.name]: event.target.checked }))
                }
              />
              <span>{skill.name}</span>
            </label>
          ))}
        </fieldset>
      ) : null}

      {error ? (
        <p className="err" role="alert">
          {error}
        </p>
      ) : null}

      <div className="row">
        <button className="primary" type="submit" disabled={busy}>
          {busy ? "保存中…" : "保存"}
        </button>
        <button type="button" className="ghost" onClick={onCancel}>
          取消
        </button>
      </div>
    </form>
  );
}
