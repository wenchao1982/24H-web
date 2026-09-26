import { useState } from "react";
import KeysPanel from "./KeysPanel";
import ModelPanel from "./ModelPanel";
import AppearancePanel from "./AppearancePanel";
import ConfigPanel from "./ConfigPanel";

interface SectionDef {
  id: string;
  label: string;
}

const SECTIONS: SectionDef[] = [
  { id: "keys", label: "模型与密钥" },
  { id: "model", label: "模型设置" },
  { id: "appearance", label: "外观" },
  { id: "config", label: "配置中心" },
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
      </div>
    </div>
  );
}
