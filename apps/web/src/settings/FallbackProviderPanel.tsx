import JsonConfigPanel from "./JsonConfigPanel";

/** 设置 → 模型 → 回退 Provider（T23.4）：`fallback` 的 JSON 读写（主备降级 / 辅助任务降级）。 */
export default function FallbackProviderPanel() {
  return (
    <JsonConfigPanel
      path="fallback"
      titleKey="fallback.title"
      hintKey="fallback.hint"
    />
  );
}
