import { useState } from "react";
import ChatPage from "./pages/ChatPage";
import SettingsPage from "./pages/SettingsPage";
import SkillsPage from "./pages/SkillsPage";

type Tab = "chat" | "skills" | "settings";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "chat", label: "对话" },
  { id: "skills", label: "技能" },
  { id: "settings", label: "设置" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("chat");

  return (
    <div className="app">
      <nav className="rail">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? "active" : ""}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="main">
        <header className="topbar">
          <strong>24H Web</strong>
          <span className="muted">面向中文用户的 Hermes 工作台</span>
        </header>
        <main className="content">
          {tab === "chat" && <ChatPage />}
          {tab === "skills" && <SkillsPage />}
          {tab === "settings" && <SettingsPage />}
        </main>
      </div>
    </div>
  );
}
