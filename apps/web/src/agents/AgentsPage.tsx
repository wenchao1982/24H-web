import { useState } from "react";
import SkillsPanel from "./SkillsPanel";

interface TabDef {
  id: string;
  label: string;
}

const TABS: TabDef[] = [{ id: "skills", label: "技能" }];

/** 智能体页：技能 / 工具 / MCP / 插件 等子面板（M6）。 */
export default function AgentsPage() {
  const [tab, setTab] = useState<string>("skills");

  return (
    <div className="page agents-page">
      <div className="tabs" role="tablist" aria-label="智能体功能">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            className="tab-btn"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="tab-panel">
        {tab === "skills" ? <SkillsPanel /> : null}
      </div>
    </div>
  );
}
