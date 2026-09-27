import { useState } from "react";
import KeysPanel from "./KeysPanel";
import ModelPanel from "./ModelPanel";
import AppearancePanel from "./AppearancePanel";
import ConfigPanel from "./ConfigPanel";
import ApprovalPanel from "./ApprovalPanel";
import OAuthPanel from "./OAuthPanel";
import GithubPanel from "./GithubPanel";
import MonitorPanel from "./MonitorPanel";
import ProjectsPanel from "./ProjectsPanel";
import ChannelsPanel from "./ChannelsPanel";
import IntegrationsPanel from "./IntegrationsPanel";
import { t, type TranslationKey } from "../i18n";

interface SectionDef {
  id: string;
  labelKey: TranslationKey;
}

const SECTIONS: SectionDef[] = [
  { id: "keys", labelKey: "settings.section.keys" },
  { id: "model", labelKey: "settings.section.model" },
  { id: "appearance", labelKey: "settings.section.appearance" },
  { id: "config", labelKey: "settings.section.config" },
  { id: "approvals", labelKey: "settings.section.approvals" },
  { id: "oauth", labelKey: "settings.section.oauth" },
  { id: "github", labelKey: "settings.section.github" },
  { id: "monitor", labelKey: "settings.section.monitor" },
  { id: "channels", labelKey: "settings.section.channels" },
  { id: "integrations", labelKey: "settings.section.integrations" },
  { id: "projects", labelKey: "settings.section.projects" },
];

/** 设置页：分区导航 + 分区详情（M6）。 */
export default function SettingsPage() {
  const [section, setSection] = useState<string>("keys");

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
            onClick={() => setSection(item.id)}
          >
            {t(item.labelKey)}
          </button>
        ))}
      </nav>
      <div className="settings-content">
        {section === "keys" ? <KeysPanel /> : null}
        {section === "model" ? <ModelPanel /> : null}
        {section === "appearance" ? <AppearancePanel /> : null}
        {section === "config" ? <ConfigPanel /> : null}
        {section === "approvals" ? <ApprovalPanel /> : null}
        {section === "oauth" ? <OAuthPanel /> : null}
        {section === "github" ? <GithubPanel /> : null}
        {section === "monitor" ? <MonitorPanel /> : null}
        {section === "channels" ? <ChannelsPanel /> : null}
        {section === "integrations" ? <IntegrationsPanel /> : null}
        {section === "projects" ? <ProjectsPanel /> : null}
      </div>
    </div>
  );
}
