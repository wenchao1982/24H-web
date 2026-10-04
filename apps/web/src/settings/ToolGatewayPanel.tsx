import SchemaSectionPanel from "./SchemaSectionPanel";

/**
 * 设置 → 高级 → Tool Gateway（T23.9）。
 * 注：Hermes 当前版本无 `tool_gateway.*` 配置键（C04 同源订正）；托管工具网关由 Nous 订阅/
 * toolset 默认驱动。本面板 schema 驱动，无匹配字段时显示说明而非无效开关。
 */
export default function ToolGatewayPanel() {
  return (
    <SchemaSectionPanel
      titleKey="toolGateway.title"
      hintKey="toolGateway.hint"
      prefix="tool_gateway"
    />
  );
}
