import type { ReactNode } from "react";
import FilesPanel from "../details/FilesPanel";

export const DETAILS_TABS = [
  { id: "files", label: "文件" },
  { id: "preview", label: "预览" },
  { id: "logs", label: "日志" },
  { id: "git", label: "Git" },
] as const;

export type DetailsTab = (typeof DETAILS_TABS)[number]["id"];

export interface DetailsPanelProps {
  tab: DetailsTab;
  onTabChange: (tab: DetailsTab) => void;
  onClose?: () => void;
  children?: ReactNode;
}

export default function DetailsPanel({ tab, onTabChange, onClose, children }: DetailsPanelProps) {
  return (
    <aside className="details" aria-label="详情面板">
      <div className="details-tabs" role="tablist" aria-label="详情标签">
        {DETAILS_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            className="tab-btn"
            aria-selected={tab === item.id}
            onClick={() => onTabChange(item.id)}
          >
            {item.label}
          </button>
        ))}
        <button type="button" className="icon-btn details-close" aria-label="收起详情面板" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="details-body" role="tabpanel">
        {children ?? renderTab(tab)}
      </div>
    </aside>
  );
}

function renderTab(tab: DetailsTab): ReactNode {
  switch (tab) {
    case "files":
      return <FilesPanel />;
    default:
      return <p className="empty">暂无内容</p>;
  }
}
