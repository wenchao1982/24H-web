import SchemaSectionPanel from "./SchemaSectionPanel";

/** 设置 → 高级 → API Server（T23.6）：OpenAI 兼容端点（schema 驱动，C04）。 */
export default function ApiServerPanel() {
  return (
    <SchemaSectionPanel
      titleKey="apiServer.title"
      hintKey="apiServer.hint"
      prefix="gateway.api_server"
    />
  );
}
