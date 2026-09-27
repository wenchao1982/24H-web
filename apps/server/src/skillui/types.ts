/** 命令式 Skill UI 协议 id（见 24OS/docs/SKILL_UI_PROTOCOL.md）。 */
export const SKILL_UI_PROTOCOL = "24os-skill-ui/1";

export interface SkillUiManifest {
  protocol: typeof SKILL_UI_PROTOCOL;
  id: string;
  title: string;
  entry: string;
  host: "iframe";
  capabilities: string[];
  permissions: string[];
  size?: { width?: number; height?: number };
}

/** 对外暴露的 Skill UI 描述（不含磁盘路径）。 */
export interface SkillUiInfo {
  id: string;
  title: string;
  entry: string;
  host: "iframe";
  capabilities: string[];
  permissions: string[];
  size?: { width?: number; height?: number };
}

/** 内部发现结果：描述 + 绝对 `ui/` 根目录。 */
export interface DiscoveredSkillUi {
  info: SkillUiInfo;
  uiRoot: string;
}
