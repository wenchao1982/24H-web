import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useGateway } from "../chat/GatewayProvider";
import { t } from "../i18n";
import {
  normalizeProjects,
  parseFolders,
  readStoredProject,
  storeProject,
  type Project,
} from "./projects";

/** 项目 = 工作区。经 L1 `projects.*` RPC（无 L2 REST）：列表 / 切换 / 新建 / 编辑 / 删除。 */
export default function ProjectsPanel() {
  const gateway = useGateway();
  const [projects, setProjects] = useState<Project[]>([]);
  const [current, setCurrent] = useState<string | null>(() => readStoredProject());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [foldersText, setFoldersText] = useState("");
  const [defaultDir, setDefaultDir] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProjects(normalizeProjects(await gateway.request("projects.list", {})));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("projects.error.load"));
    } finally {
      setLoading(false);
    }
  }, [gateway]);

  useEffect(() => {
    void load();
  }, [load]);

  const select = (id: string) => {
    setCurrent(id);
    storeProject(id);
  };

  const openCreate = () => {
    setEditingId(null);
    setName("");
    setFoldersText("");
    setDefaultDir("");
    setFormOpen(true);
  };

  const openEdit = (project: Project) => {
    setEditingId(project.id);
    setName(project.name);
    setFoldersText(project.folders.join("\n"));
    setDefaultDir(project.defaultDir ?? "");
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t("projects.error.save"));
      return;
    }
    const folders = parseFolders(foldersText);
    const primary = defaultDir.trim();
    setBusy(true);
    void (async () => {
      try {
        if (editingId) {
          await gateway.request("projects.update", { id: editingId, name: trimmedName });
          const existing = projects.find((project) => project.id === editingId);
          const oldSet = new Set(existing?.folders ?? []);
          const newSet = new Set(folders);
          for (const folder of oldSet) {
            if (!newSet.has(folder)) {
              await gateway.request("projects.remove_folder", { id: editingId, path: folder });
            }
          }
          for (const folder of newSet) {
            if (!oldSet.has(folder)) {
              await gateway.request("projects.add_folder", { id: editingId, path: folder });
            }
          }
        } else {
          await gateway.request("projects.create", {
            name: trimmedName,
            folders,
            ...(primary ? { primary_path: primary } : {}),
          });
        }
        closeForm();
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("projects.error.save"));
      } finally {
        setBusy(false);
      }
    })();
  };

  const remove = (project: Project) => {
    setBusy(true);
    void (async () => {
      try {
        await gateway.request("projects.delete", { id: project.id });
        if (current === project.id) {
          setCurrent(null);
          storeProject(null);
        }
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("projects.error.delete"));
      } finally {
        setBusy(false);
      }
    })();
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
        <div className="row">
          <button type="button" className="primary" onClick={openCreate}>
            {t("projects.new")}
          </button>
        </div>
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
                  <button
                    type="button"
                    className="ghost"
                    aria-label={t("projects.editAria", { name: project.name })}
                    onClick={() => openEdit(project)}
                  >
                    {t("projects.edit")}
                  </button>
                  <button
                    type="button"
                    className="danger"
                    aria-label={t("projects.deleteAria", { name: project.name })}
                    disabled={busy}
                    onClick={() => remove(project)}
                  >
                    {t("projects.delete")}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {formOpen ? (
        <div className="card">
          <h3>{editingId ? t("projects.edit") : t("projects.new")}</h3>
          <form onSubmit={submit}>
            <label className="config-row">
              <span>{t("projects.name")}</span>
              <input
                aria-label={t("projects.name")}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="config-row">
              <span>{t("projects.folders")}</span>
              <textarea
                className="project-folders"
                aria-label={t("projects.folders")}
                placeholder={t("projects.foldersHint")}
                value={foldersText}
                onChange={(event) => setFoldersText(event.target.value)}
              />
            </label>
            <label className="config-row">
              <span>{t("projects.defaultDir")}</span>
              <input
                aria-label={t("projects.defaultDir")}
                value={defaultDir}
                onChange={(event) => setDefaultDir(event.target.value)}
              />
            </label>
            <div className="row">
              <button type="submit" className="primary" disabled={busy}>
                {t("projects.save")}
              </button>
              <button type="button" className="ghost" onClick={closeForm}>
                {t("projects.cancel")}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
