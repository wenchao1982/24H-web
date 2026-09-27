import type { TranslationKey } from "../i18n";

export interface NavItem {
  id: string;
  /** 文案字典 key（渲染时经 `t()` 解析）。 */
  labelKey: TranslationKey;
  icon: string;
  superAdminOnly?: boolean;
}

/** 一级导航（侧栏导航行）。 */
export const PRIMARY_NAV: NavItem[] = [
  { id: "chat", labelKey: "nav.chat", icon: "▤" },
  { id: "agents", labelKey: "nav.agents", icon: "◈" },
  { id: "groups", labelKey: "nav.groups", icon: "❏" },
  { id: "tasks", labelKey: "nav.tasks", icon: "◷" },
  { id: "usage", labelKey: "nav.usage", icon: "◉" },
];

/** 侧栏底部固定项。 */
export const BOTTOM_NAV: NavItem[] = [
  { id: "settings", labelKey: "nav.settings", icon: "⚙" },
  { id: "admin", labelKey: "nav.admin", icon: "🛡", superAdminOnly: true },
  { id: "account", labelKey: "nav.account", icon: "👤" },
  { id: "notifications", labelKey: "nav.notifications", icon: "🔔" },
];
