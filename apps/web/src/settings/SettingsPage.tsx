import { useState } from "react";
import KeysPanel from "./KeysPanel";
import ModelPanel from "./ModelPanel";
import AppearancePanel from "./AppearancePanel";
import ConfigPanel from "./ConfigPanel";
import ApprovalPanel from "./ApprovalPanel";
import OAuthPanel from "./OAuthPanel";
import GithubPanel from "./GithubPanel";
import ChannelsPanel from "./ChannelsPanel";
import IntegrationsPanel from "./IntegrationsPanel";
import AdvancedSettingsPanel from "./AdvancedSettingsPanel";
import UpgradePanel from "./UpgradePanel";
import VoicePanel from "./VoicePanel";
import SchemaSectionPanel from "./SchemaSectionPanel";
import { t, type TranslationKey } from "../i18n";

interface SectionDef {
  id: string;
  labelKey: TranslationKey;
  hintKey: TranslationKey;
}

const SECTIONS: SectionDef[] = [
  { id: "general", labelKey: "settings.section.general", hintKey: "settings.section.general.hint" },
  { id: "model", labelKey: "settings.section.keys", hintKey: "settings.section.keys.hint" },
  { id: "voice", labelKey: "settings.section.voice", hintKey: "settings.section.voice.hint" },
  { id: "config", labelKey: "settings.section.config", hintKey: "settings.section.config.hint" },
  {
    id: "approvals",
    labelKey: "settings.section.approvals",
    hintKey: "settings.section.approvals.hint",
  },
  { id: "oauth", labelKey: "settings.section.oauth", hintKey: "settings.section.oauth.hint" },
  { id: "github", labelKey: "settings.section.github", hintKey: "settings.section.github.hint" },
  { id: "channels", labelKey: "settings.section.channels", hintKey: "settings.section.channels.hint" },
  {
    id: "integrations",
    labelKey: "settings.section.integrations",
    hintKey: "settings.section.integrations.hint",
  },
  { id: "advanced", labelKey: "settings.section.advanced", hintKey: "settings.section.advanced.hint" },
  { id: "system", labelKey: "settings.section.system", hintKey: "settings.section.system.hint" },
];

/** 从 `?section=` 读取初始分区（品牌行核心灯可直达系统升级）。 */
function initialSection(): string {
  if (typeof window === "undefined") {
    return "general";
  }
  const requested = new URLSearchParams(window.location.search).get("section");
  return requested && SECTIONS.some((item) => item.id === requested) ? requested : "general";
}

/** 设置页：分区导航 + 分区详情（M6）。 */
export default function SettingsPage() {
  const [section, setSection] = useState<string>(initialSection);

  return (
    <div className="page settings-page">
      <nav className="settings-nav" aria-label={t("settings.aria")}>
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="settings-nav-btn"
            data-active={section === item.id}
            aria-current={section === item.id ? "page" : undefined}
            aria-label={t(item.labelKey)}
            onClick={() => setSection(item.id)}
          >
            <span className="settings-nav-label">{t(item.labelKey)}</span>
            <span className="settings-nav-hint">{t(item.hintKey)}</span>
          </button>
        ))}
      </nav>
      <div className="settings-content">
        {section === "general" ? <AppearancePanel /> : null}
        {section === "model" ? (
          <>
            <KeysPanel />
            <ModelPanel />
          </>
        ) : null}
        {section === "voice" ? (
          <>
            <VoicePanel />
            <SchemaSectionPanel
              titleKey="voice.ttsSection"
              hintKey="voice.ttsSectionHint"
              prefix="tts"
            />
            <SchemaSectionPanel
              titleKey="voice.sttSection"
              hintKey="voice.sttSectionHint"
              prefix="stt"
            />
          </>
        ) : null}
        {section === "config" ? <ConfigPanel /> : null}
        {section === "approvals" ? <ApprovalPanel /> : null}
        {section === "oauth" ? <OAuthPanel /> : null}
        {section === "github" ? <GithubPanel /> : null}
        {section === "channels" ? <ChannelsPanel /> : null}
        {section === "integrations" ? <IntegrationsPanel /> : null}
        {section === "advanced" ? <AdvancedSettingsPanel /> : null}
        {section === "system" ? <UpgradePanel /> : null}
      </div>
    </div>
  );
}
