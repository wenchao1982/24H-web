import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { groupByCategory, normalizeSkills, type SkillEntry } from "./skills";

/** 智能体页「技能」面板：按类别分组展示 `GET /api/hermes/skills`。 */
export default function SkillsPanel() {
  const [skills, setSkills] = useState<SkillEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await api<unknown>("/api/hermes/skills");
      setSkills(normalizeSkills(payload));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载技能失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="empty">加载技能中…</p>;
  }
  if (error) {
    return <p className="err">{error}</p>;
  }
  if (skills.length === 0) {
    return <p className="empty">暂无技能。</p>;
  }

  return (
    <div className="skills">
      {groupByCategory(skills).map((group) => (
        <section className="skill-group" key={group.category}>
          <h3 className="skill-group-title">{group.category}</h3>
          <ul className="skill-list">
            {group.skills.map((skill) => (
              <li className="skill-item" key={skill.name}>
                <span className="skill-name">{skill.name}</span>
                {skill.description ? (
                  <span className="skill-desc muted">{skill.description}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
