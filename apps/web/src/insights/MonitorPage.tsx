import { t } from "../i18n";
import MonitorPanel from "../settings/MonitorPanel";

/** 独立页：监控（本机 CPU/内存/磁盘/进程 + 后端健康）。 */
export default function MonitorPage() {
  return (
    <div className="page monitor-page">
      <h2 className="page-title">{t("page.monitor")}</h2>
      <MonitorPanel />
    </div>
  );
}
