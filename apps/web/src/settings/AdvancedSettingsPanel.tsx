import { useState } from "react";
import LocalModelsPanel from "./LocalModelsPanel";
import PairingPanel from "./PairingPanel";
import PortalPanel from "./PortalPanel";
import OpsPanel from "./OpsPanel";
import BrowserPanel from "./BrowserPanel";
import VoicePanel from "./VoicePanel";
import ExecPanel from "./ExecPanel";
import QuickCompletePanel from "./QuickCompletePanel";
import ProjectFactsPanel from "./ProjectFactsPanel";
import HandoffPanel from "./HandoffPanel";
import ForeignSessionPanel from "./ForeignSessionPanel";
import VaultPanel from "./VaultPanel";
import BillingPanel from "./BillingPanel";
import LearningPanel from "./LearningPanel";
import ApiServerPanel from "./ApiServerPanel";
import EventHooksPanel from "./EventHooksPanel";
import SearchExtractionPanel from "./SearchExtractionPanel";
import { t, type TranslationKey } from "../i18n";

interface TabDef {
  id: string;
  labelKey: TranslationKey;
}

const TABS: TabDef[] = [
  { id: "local-models", labelKey: "advanced.tab.localModels" },
  { id: "pairing", labelKey: "advanced.tab.pairing" },
  { id: "portal", labelKey: "advanced.tab.portal" },
  { id: "ops", labelKey: "advanced.tab.ops" },
  { id: "browser", labelKey: "advanced.tab.browser" },
  { id: "voice", labelKey: "advanced.tab.voice" },
  { id: "exec", labelKey: "advanced.tab.exec" },
  { id: "oneshot", labelKey: "advanced.tab.oneshot" },
  { id: "facts", labelKey: "advanced.tab.facts" },
  { id: "handoff", labelKey: "advanced.tab.handoff" },
  { id: "foreign", labelKey: "advanced.tab.foreign" },
  { id: "vault", labelKey: "advanced.tab.vault" },
  { id: "billing", labelKey: "advanced.tab.billing" },
  { id: "learning", labelKey: "advanced.tab.learning" },
  { id: "api-server", labelKey: "advanced.tab.apiServer" },
  { id: "event-hooks", labelKey: "advanced.tab.eventHooks" },
  { id: "search-tools", labelKey: "advanced.tab.searchTools" },
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
      {tab === "ops" ? <OpsPanel /> : null}
      {tab === "browser" ? <BrowserPanel /> : null}
      {tab === "voice" ? <VoicePanel /> : null}
      {tab === "exec" ? <ExecPanel /> : null}
      {tab === "oneshot" ? <QuickCompletePanel /> : null}
      {tab === "facts" ? <ProjectFactsPanel /> : null}
      {tab === "handoff" ? <HandoffPanel /> : null}
      {tab === "foreign" ? <ForeignSessionPanel /> : null}
      {tab === "vault" ? <VaultPanel /> : null}
      {tab === "billing" ? <BillingPanel /> : null}
      {tab === "learning" ? <LearningPanel /> : null}
      {tab === "api-server" ? <ApiServerPanel /> : null}
      {tab === "event-hooks" ? <EventHooksPanel /> : null}
      {tab === "search-tools" ? <SearchExtractionPanel /> : null}
    </div>
  );
}
