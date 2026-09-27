import JsonConfigPanel from "./JsonConfigPanel";

/** 设置 → 模型 → Provider 路由（T23.3）：`provider_routing` 的 JSON 读写。 */
export default function ProviderRoutingPanel() {
  return (
    <JsonConfigPanel
      path="provider_routing"
      titleKey="providerRouting.title"
      hintKey="providerRouting.hint"
    />
  );
}
