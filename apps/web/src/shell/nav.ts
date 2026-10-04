import type { TranslationKey } from "../i18n";
import type { IconName } from "../ui/icons";

export interface NavItem {
  id: string;
  /** 文案字典 key（渲染时经 `t()` 解析）。 */
  labelKey: TranslationKey;
  icon: IconName;
  superAdminOnly?: boolean;
}

/** 一级导航（侧栏导航行）。 */
export const PRIMARY_NAV: NavItem[] = [
  { id: "chat", labelKey: "nav.chat", icon: "chat" },
  { id: "agents", labelKey: "nav.agents", icon: "agents" },
  { id: "groups", labelKey: "nav.groups", icon: "groups" },
  { id: "tasks", labelKey: "nav.tasks", icon: "tasks" },
  { id: "kanban", labelKey: "nav.kanban", icon: "kanban" },
  { id: "orchestration", labelKey: "nav.orchestration", icon: "workflow" },
  { id: "usage", labelKey: "nav.usage", icon: "usage" },
  { id: "skillhost", labelKey: "nav.skillhost", icon: "skillhost" },
];

/** 侧栏底部固定项。 */
export const BOTTOM_NAV: NavItem[] = [
  { id: "settings", labelKey: "nav.settings", icon: "settings" },
  { id: "admin", labelKey: "nav.admin", icon: "admin", superAdminOnly: true },
  { id: "account", labelKey: "nav.account", icon: "account" },
];
