import { t } from "../i18n";
import ProjectsPanel from "../settings/ProjectsPanel";

/** 独立页：项目（工作区）——具名多文件夹工作区。 */
export default function ProjectsPage() {
  return (
    <div className="page projects-page">
      <h2 className="page-title">{t("page.projects")}</h2>
      <ProjectsPanel />
    </div>
  );
}
