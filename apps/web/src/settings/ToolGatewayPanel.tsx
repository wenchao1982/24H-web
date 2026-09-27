import ConfigFieldsPanel, { type ConfigFieldDef } from "./ConfigFieldsPanel";

const FIELDS: ConfigFieldDef[] = [
  { path: "tool_gateway.web", labelKey: "toolGateway.web", type: "boolean" },
  { path: "tool_gateway.image", labelKey: "toolGateway.image", type: "boolean" },
  { path: "tool_gateway.tts", labelKey: "toolGateway.tts", type: "boolean" },
  { path: "tool_gateway.browser", labelKey: "toolGateway.browser", type: "boolean" },
];

/** 设置 → 高级 → Tool Gateway（T23.9）：Nous Portal 工具网关（web/image/TTS/browser）。 */
export default function ToolGatewayPanel() {
  return (
    <ConfigFieldsPanel titleKey="toolGateway.title" hintKey="toolGateway.hint" fields={FIELDS} />
  );
}
