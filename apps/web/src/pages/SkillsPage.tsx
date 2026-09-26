import { useEffect, useState } from "react";
import { api } from "../api/rest";

type SkillRow = { name: string; description?: string; enabled?: boolean; category?: string };

export default function SkillsPage() {
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api<{ skills?: SkillRow[] } | SkillRow[]>("/api/skills")
      .then((data) => setSkills(Array.isArray(data) ? data : (data.skills ?? [])))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  };

  useEffect(load, []);

  const toggle = async (row: SkillRow) => {
    try {
      await api("/api/skills/toggle", {
        method: "PUT",
        body: JSON.stringify({ name: row.name, enabled: !row.enabled }),
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div>
      <div className="card">
        <h3>技能</h3>
        {error && <p className="err">{error}</p>}
        {skills.length === 0 && <p className="muted">暂无技能或尚未加载。</p>}
        {skills.map((row) => (
          <div key={row.name} className="row">
            <span style={{ flex: 1 }}>
              {row.name}
              {row.description ? <span className="muted"> — {row.description}</span> : null}
            </span>
            <button type="button" onClick={() => void toggle(row)}>
              {row.enabled === false ? "启用" : "禁用"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
