import ConfigFieldsPanel, { type ConfigFieldDef } from "./ConfigFieldsPanel";

const FIELDS: ConfigFieldDef[] = [
  { path: "api_server.enabled", labelKey: "apiServer.enabled", type: "boolean" },
  {
    path: "api_server.port",
    labelKey: "apiServer.port",
    type: "number",
    placeholderKey: "apiServer.portPlaceholder",
  },
];

/** 设置 → 高级 → API Server（T23.6）：OpenAI 兼容端点开关与端口。 */
export default function ApiServerPanel() {
  return (
    <ConfigFieldsPanel titleKey="apiServer.title" hintKey="apiServer.hint" fields={FIELDS} />
  );
}
