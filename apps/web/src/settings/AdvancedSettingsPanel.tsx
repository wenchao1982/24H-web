import { useState } from "react";
import LocalModelsPanel from "./LocalModelsPanel";
import PairingPanel from "./PairingPanel";
import PortalPanel from "./PortalPanel";
import { t, type TranslationKey } from "../i18n";

interface TabDef {
  id: string;
  labelKey: TranslationKey;
}

const TABS: TabDef[] = [
  { id: "local-models", labelKey: "advanced.tab.localModels" },
  { id: "pairing", labelKey: "advanced.tab.pairing" },
  { id: "portal", labelKey: "advanced.tab.portal" },
];

/** 设置 → 高级：本地模型 / 配对 / 运维 / 网关工具等子分区。 */
export default function AdvancedSettingsPanel() {
  const [tab, setTab] = useState<string>("local-models");

  return (
    <div className="settings-section">
      <nav className="segmented" aria-label={t("advanced.tabsAria")}>
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
      {tab === "local-models" ? <LocalModelsPanel /> : null}
      {tab === "pairing" ? <PairingPanel /> : null}
      {tab === "portal" ? <PortalPanel /> : null}
    </div>
  );
}
