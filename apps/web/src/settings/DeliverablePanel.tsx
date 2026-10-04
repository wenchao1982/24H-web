import SchemaSectionPanel from "./SchemaSectionPanel";

/**
 * 设置 → 渠道 → Deliverable（T23.13）。
 * 注：Hermes 当前版本无 `deliverable.*` 配置键（C04 订正）；本面板 schema 驱动，
 * 无匹配字段时显示说明而非无效开关。
 */
export default function DeliverablePanel() {
  return (
    <SchemaSectionPanel
      titleKey="deliverable.title"
      hintKey="deliverable.hint"
      prefix="deliverable"
    />
  );
}
