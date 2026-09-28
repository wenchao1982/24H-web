import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";

export interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon = "info", title, description, action }: EmptyStateProps) {
  return (
    <div className="ds-empty">
      <span className="ds-empty__icon">
        <Icon name={icon} size={28} />
      </span>
      <span className="ds-empty__title">{title}</span>
      {description ? <span className="ds-empty__desc">{description}</span> : null}
      {action ? <div className="ds-empty__actions">{action}</div> : null}
    </div>
  );
}
