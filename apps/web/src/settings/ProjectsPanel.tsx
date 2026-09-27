import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { t } from "../i18n";
import { normalizeProjects, readStoredProject, storeProject, type Project } from "./projects";

/** 设置 → 项目：项目列表与「当前项目」切换（本地持久化）。 */
export default function ProjectsPanel() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [current, setCurrent] = useState<string | null>(() => readStoredProject());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProjects(normalizeProjects(await api<unknown>("/api/hermes/projects")));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("projects.error.load"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const select = (id: string) => {
    setCurrent(id);
    storeProject(id);
  };

  if (loading) {
    return <p className="empty">{t("projects.loading")}</p>;
  }

  return (
    <div className="settings-section">
      <div className="card">
        <h3>{t("projects.title")}</h3>
        <p className="muted">{t("projects.hint")}</p>
        {error ? <p className="err">{error}</p> : null}
        {projects.length === 0 ? (
          <p className="empty">{t("projects.empty")}</p>
        ) : (
          <ul className="project-list">
            {projects.map((project) => {
              const active = current === project.id;
              return (
                <li className="project-item" key={project.id}>
                  <button
                    type="button"
                    className="project-btn"
                    data-active={active}
                    aria-pressed={active}
                    aria-label={t("projects.select", { name: project.name })}
                    onClick={() => select(project.id)}
                  >
                    <span className="skill-name">{project.name}</span>
                    <span className="skill-desc muted">
                      {project.folders.length > 0
                        ? project.folders.join(" · ")
                        : project.defaultDir ?? t("projects.noFolders")}
                    </span>
                    {active ? <span className="project-current">{t("projects.current")}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
