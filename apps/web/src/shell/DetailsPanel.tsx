import { useState, type ReactNode } from "react";
import FilesPanel from "../details/FilesPanel";
import PreviewPanel from "../details/PreviewPanel";
import LogsPanel from "../details/LogsPanel";
import GitPanel from "../details/GitPanel";
import { t, type TranslationKey } from "../i18n";

export const DETAILS_TABS = [
  { id: "files", labelKey: "details.tab.files" },
  { id: "preview", labelKey: "details.tab.preview" },
  { id: "logs", labelKey: "details.tab.logs" },
  { id: "git", labelKey: "details.tab.git" },
] as const satisfies ReadonlyArray<{ id: string; labelKey: TranslationKey }>;

export type DetailsTab = (typeof DETAILS_TABS)[number]["id"];

export interface DetailsPanelProps {
  tab: DetailsTab;
  onTabChange: (tab: DetailsTab) => void;
  onClose?: () => void;
  children?: ReactNode;
}

export default function DetailsPanel({ tab, onTabChange, onClose, children }: DetailsPanelProps) {
  const [previewPath, setPreviewPath] = useState<string | null>(null);

  const renderTab = (): ReactNode => {
    switch (tab) {
      case "files":
        return <FilesPanel onSelect={setPreviewPath} />;
      case "preview":
        return <PreviewPanel path={previewPath} />;
      case "logs":
        return <LogsPanel />;
      case "git":
        return <GitPanel />;
      default:
        return <p className="empty">{t("details.empty")}</p>;
    }
  };

  return (
    <aside className="details" aria-label={t("details.aria")}>
      <div className="details-tabs" role="tablist" aria-label={t("details.tabsAria")}>
        {DETAILS_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            className="tab-btn"
            aria-selected={tab === item.id}
            onClick={() => onTabChange(item.id)}
          >
            {t(item.labelKey)}
          </button>
        ))}
        <button
          type="button"
          className="icon-btn details-close"
          aria-label={t("details.close")}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="details-body" role="tabpanel">
        {children ?? renderTab()}
      </div>
    </aside>
  );
}
