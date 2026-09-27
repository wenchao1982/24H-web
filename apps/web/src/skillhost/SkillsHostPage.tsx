import { useEffect, useState } from "react";
import { t } from "../i18n";
import SkillHost from "./SkillHost";
import { listSkillUis, type SkillUiInfo } from "./skillhost";

/** 技能界面页：列出发现的 Skill UI，选中后在沙箱 iframe 中挂载。 */
export default function SkillsHostPage() {
  const [skills, setSkills] = useState<SkillUiInfo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const found = await listSkillUis();
        if (!active) {
          return;
        }
        setSkills(found);
        setSelected((current) => current ?? found[0]?.id ?? null);
        setError(null);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : t("skillhost.error.load"));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const activeSkill = skills.find((skill) => skill.id === selected) ?? null;

  return (
    <div className="page skill-host-page">
      <h2>{t("skillhost.pageTitle")}</h2>
      <p className="hint">{t("skillhost.hint")}</p>
      {error ? (
        <p className="err" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="empty">{t("skillhost.loading")}</p> : null}
      {!loading && skills.length === 0 ? (
        <p className="empty">{t("skillhost.empty")}</p>
      ) : null}
      {skills.length > 0 ? (
        <ul className="toolset-list">
          {skills.map((skill) => (
            <li className="toolset-item" key={skill.id}>
              <button
                type="button"
                className="session-item"
                data-active={skill.id === selected}
                onClick={() => setSelected(skill.id)}
              >
                {skill.title}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {activeSkill ? <SkillHost skill={activeSkill} /> : null}
    </div>
  );
}
