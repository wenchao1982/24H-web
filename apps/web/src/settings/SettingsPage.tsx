import { useState } from "react";
import KeysPanel from "./KeysPanel";
import ModelPanel from "./ModelPanel";
import AppearancePanel from "./AppearancePanel";
import ConfigPanel from "./ConfigPanel";
import ApprovalPanel from "./ApprovalPanel";
import OAuthPanel from "./OAuthPanel";
import GithubPanel from "./GithubPanel";
import MonitorPanel from "./MonitorPanel";

interface SectionDef {
  id: string;
  label: string;
}

const SECTIONS: SectionDef[] = [
  { id: "keys", label: "模型与密钥" },
  { id: "model", label: "模型设置" },
  { id: "appearance", label: "外观" },
  { id: "config", label: "配置中心" },
  { id: "approvals", label: "审批策略" },
  { id: "oauth", label: "服务商登录" },
  { id: "github", label: "GitHub 集成" },
  { id: "monitor", label: "监控" },
];

/** 设置页：分区导航 + 分区详情（M6）。 */
export default function SettingsPage() {
  const [section, setSection] = useState<string>("keys");

  return (
    <div className="page settings-page">
      <nav className="settings-nav" aria-label="设置分区">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="settings-nav-btn"
            data-active={section === item.id}
            aria-current={section === item.id ? "page" : undefined}
            onClick={() => setSection(item.id)}
          >
            {item.label}
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
      </div>
    </div>
  );
}
