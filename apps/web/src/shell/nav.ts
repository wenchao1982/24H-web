import type { TranslationKey } from "../i18n";
import type { IconName } from "../ui/icons";

export interface NavItem {
  id: string;
  /** 文案字典 key（渲染时经 `t()` 解析）。 */
  labelKey: TranslationKey;
  icon: IconName;
  superAdminOnly?: boolean;
}

/** 侧栏一级分组（Demo IA v2）：组标题 + 组内导航项。 */
export interface NavGroup {
  id: string;
  labelKey: TranslationKey;
  items: NavItem[];
}

/** 分组导航（工作台 / 智能体 / 编排 / 洞察 / 工作区）。 */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "workbench",
    labelKey: "nav.group.workbench",
    items: [
      { id: "chat", labelKey: "nav.chat", icon: "chat" },
      { id: "groups", labelKey: "nav.groups", icon: "groups" },
      { id: "tasks", labelKey: "nav.tasks", icon: "tasks" },
      { id: "kanban", labelKey: "nav.kanban", icon: "kanban" },
    ],
  },
  {
    id: "agents",
    labelKey: "nav.group.agents",
    items: [
      { id: "agents", labelKey: "nav.agents", icon: "agents" },
      { id: "skillhost", labelKey: "nav.skillhost", icon: "skillhost" },
    ],
  },
  {
    id: "orchestrate",
    labelKey: "nav.group.orchestrate",
    items: [{ id: "orchestration", labelKey: "nav.orchestration", icon: "workflow" }],
  },
  {
    id: "insights",
    labelKey: "nav.group.insights",
    items: [
      { id: "usage", labelKey: "nav.usage", icon: "usage" },
      { id: "monitor", labelKey: "nav.monitor", icon: "monitor" },
      { id: "memory", labelKey: "nav.memory", icon: "memory" },
    ],
  },
  {
    id: "workspace",
    labelKey: "nav.group.workspace",
    items: [
      { id: "projects", labelKey: "nav.projects", icon: "projects" },
      { id: "files", labelKey: "nav.files", icon: "files" },
    ],
  },
];

/** 扁平化一级导航（兼容既有消费方：路由/标签映射/测试）。 */
export const PRIMARY_NAV: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

/** 侧栏底部固定项。 */
export const BOTTOM_NAV: NavItem[] = [
  { id: "settings", labelKey: "nav.settings", icon: "settings" },
  { id: "admin", labelKey: "nav.admin", icon: "admin", superAdminOnly: true },
  { id: "account", labelKey: "nav.account", icon: "account" },
];
