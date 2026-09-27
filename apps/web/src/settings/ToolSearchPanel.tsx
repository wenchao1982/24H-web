import ConfigFieldsPanel, { type ConfigFieldDef } from "./ConfigFieldsPanel";

const FIELDS: ConfigFieldDef[] = [
  { path: "tool_search.enabled", labelKey: "toolSearch.enabled", type: "boolean" },
];

/** 设置 → 高级 → Tool Search（T23.10）：工具延迟加载开关。 */
export default function ToolSearchPanel() {
  return (
    <ConfigFieldsPanel titleKey="toolSearch.title" hintKey="toolSearch.hint" fields={FIELDS} />
  );
}
