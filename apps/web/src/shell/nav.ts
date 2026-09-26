export interface NavItem {
  id: string;
  label: string;
  icon: string;
  superAdminOnly?: boolean;
}

/** 一级导航（侧栏导航行）。 */
export const PRIMARY_NAV: NavItem[] = [
  { id: "chat", label: "对话", icon: "▤" },
  { id: "agents", label: "智能体", icon: "◈" },
  { id: "groups", label: "群聊", icon: "❏" },
  { id: "tasks", label: "任务", icon: "◷" },
  { id: "usage", label: "用量", icon: "◉" },
];

/** 侧栏底部固定项。 */
export const BOTTOM_NAV: NavItem[] = [
  { id: "settings", label: "设置", icon: "⚙" },
  { id: "admin", label: "管理", icon: "🛡", superAdminOnly: true },
  { id: "account", label: "账户", icon: "👤" },
  { id: "notifications", label: "通知", icon: "🔔" },
];
