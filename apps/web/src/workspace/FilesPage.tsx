import { t } from "../i18n";
import FilesPanel from "../details/FilesPanel";

/** 独立页：文件——工作区文件树 + 预览。 */
export default function FilesPage() {
  return (
    <div className="page files-page">
      <h2 className="page-title">{t("page.files")}</h2>
      <FilesPanel />
    </div>
  );
}
