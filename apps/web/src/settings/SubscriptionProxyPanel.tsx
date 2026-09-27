import JsonConfigPanel from "./JsonConfigPanel";

/** 设置 → 高级 → Subscription Proxy（T23.17）：订阅代理配置的 JSON 读写。 */
export default function SubscriptionProxyPanel() {
  return (
    <JsonConfigPanel
      path="subscription_proxy"
      titleKey="subscriptionProxy.title"
      hintKey="subscriptionProxy.hint"
    />
  );
}
