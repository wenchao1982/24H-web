import SchemaSectionPanel from "./SchemaSectionPanel";

/** 设置 → 高级 → Tool Search（T23.10）：工具延迟加载（schema 驱动，C04）。 */
export default function ToolSearchPanel() {
  return (
    <SchemaSectionPanel
      titleKey="toolSearch.title"
      hintKey="toolSearch.hint"
      prefix="tools.tool_search"
    />
  );
}
