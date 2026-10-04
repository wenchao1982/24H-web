import { useState } from "react";
import MemoryPanel from "./MemoryPanel";
import WebhooksPanel from "./WebhooksPanel";
import PluginCatalogPanel from "./PluginCatalogPanel";
import ConnectorsPanel from "./ConnectorsPanel";
import { t, type TranslationKey } from "../i18n";

interface TabDef {
  id: string;
  labelKey: TranslationKey;
}

const TABS: TabDef[] = [
  { id: "memory", labelKey: "integrations.tab.memory" },
  { id: "connectors", labelKey: "integrations.tab.connectors" },
  { id: "webhooks", labelKey: "integrations.tab.webhooks" },
  { id: "plugins", labelKey: "integrations.tab.plugins" },
];

/** 设置 → 集成：记忆 / Webhooks / 插件目录等子分区。 */
export default function IntegrationsPanel() {
  const [tab, setTab] = useState<string>("memory");

  return (
    <div className="settings-section">
      <nav className="segmented" aria-label={t("integrations.tabsAria")}>
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="segmented-btn"
            data-active={tab === item.id}
            aria-current={tab === item.id ? "page" : undefined}
            onClick={() => setTab(item.id)}
          >
            {t(item.labelKey)}
          </button>
        ))}
      </nav>
      {tab === "memory" ? <MemoryPanel /> : null}
      {tab === "connectors" ? <ConnectorsPanel /> : null}
      {tab === "webhooks" ? <WebhooksPanel /> : null}
      {tab === "plugins" ? <PluginCatalogPanel /> : null}
    </div>
  );
}
