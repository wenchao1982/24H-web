import ConfigFieldsPanel, { type ConfigFieldDef } from "./ConfigFieldsPanel";

const FIELDS: ConfigFieldDef[] = [
  { path: "deliverable.enabled", labelKey: "deliverable.enabled", type: "boolean" },
];

/** 设置 → 渠道 → Deliverable（T23.13）：产物作为附件投递开关。 */
export default function DeliverablePanel() {
  return (
    <ConfigFieldsPanel titleKey="deliverable.title" hintKey="deliverable.hint" fields={FIELDS} />
  );
}
