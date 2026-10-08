import { t } from "../i18n";
import MemoryPanel from "../settings/MemoryPanel";

/** 独立页：记忆（分类 / 作用域 / 提供方 / 图谱）。 */
export default function MemoryPage() {
  return (
    <div className="page memory-page">
      <h2 className="page-title">{t("page.memory")}</h2>
      <MemoryPanel />
    </div>
  );
}
