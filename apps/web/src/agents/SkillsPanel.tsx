import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../api/client";
import {
  groupByCategory,
  normalizeHubSkills,
  normalizeSkills,
  type HubSkillEntry,
  type SkillEntry,
} from "./skills";

/** 智能体页「技能」面板：按类别分组展示 + hub 安装。 */
export default function SkillsPanel() {
  const [skills, setSkills] = useState<SkillEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [hubQuery, setHubQuery] = useState("");
  const [hubResults, setHubResults] = useState<HubSkillEntry[] | null>(null);
  const [hubBusy, setHubBusy] = useState<string | null>(null);

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

  const toggle = useCallback(async (skill: SkillEntry) => {
    const enabled = !skill.enabled;
    setBusy(skill.name);
    try {
      await api("/api/hermes/skills/toggle", {
        method: "PUT",
        body: JSON.stringify({ name: skill.name, enabled }),
      });
      setSkills((current) =>
        current.map((entry) =>
          entry.name === skill.name ? { ...entry, enabled } : entry,
        ),
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "切换技能失败");
    } finally {
      setBusy(null);
    }
  }, []);

  const searchHub = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      const query = hubQuery.trim();
      if (!query) {
        setHubResults(null);
        return;
      }
      try {
        const payload = await api<unknown>(
          `/api/hermes/skills/hub?q=${encodeURIComponent(query)}`,
        );
        setHubResults(normalizeHubSkills(payload));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "搜索技能失败");
      }
    },
    [hubQuery],
  );

  const install = useCallback(
    async (entry: HubSkillEntry) => {
      setHubBusy(entry.name);
      try {
        await api("/api/hermes/skills", {
          method: "POST",
          body: JSON.stringify({ name: entry.name }),
        });
        setHubResults((current) =>
          current ? current.filter((item) => item.name !== entry.name) : current,
        );
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "安装技能失败");
      } finally {
        setHubBusy(null);
      }
    },
    [load],
  );

  return (
    <div className="skills">
      {error ? <p className="err">{error}</p> : null}

      <form className="skill-hub" onSubmit={searchHub}>
        <div className="row">
          <input
            aria-label="搜索技能市场"
            placeholder="搜索技能市场"
            value={hubQuery}
            onChange={(event) => setHubQuery(event.target.value)}
          />
          <button className="ghost" type="submit">
            搜索
          </button>
        </div>
      </form>

      {hubResults !== null ? (
        hubResults.length === 0 ? (
          <p className="empty">未找到匹配的技能。</p>
        ) : (
          <ul className="skill-list">
            {hubResults.map((entry) => (
              <li className="skill-item" key={entry.name}>
                <span className="skill-name">{entry.name}</span>
                {entry.description ? (
                  <span className="skill-desc muted">{entry.description}</span>
                ) : null}
                <button
                  type="button"
                  className="ghost"
                  disabled={hubBusy === entry.name}
                  onClick={() => void install(entry)}
                >
                  安装
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {loading ? (
        <p className="empty">加载技能中…</p>
      ) : skills.length === 0 ? (
        <p className="empty">暂无技能。</p>
      ) : (
        groupByCategory(skills).map((group) => (
          <section className="skill-group" key={group.category}>
            <h3 className="skill-group-title">{group.category}</h3>
            <ul className="skill-list">
              {group.skills.map((skill) => (
                <li className="skill-item" key={skill.name}>
                  <label className="skill-toggle">
                    <input
                      type="checkbox"
                      aria-label={`启用 ${skill.name}`}
                      checked={skill.enabled}
                      disabled={busy === skill.name}
                      onChange={() => void toggle(skill)}
                    />
                  </label>
                  <span className="skill-name">{skill.name}</span>
                  {skill.description ? (
                    <span className="skill-desc muted">{skill.description}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
