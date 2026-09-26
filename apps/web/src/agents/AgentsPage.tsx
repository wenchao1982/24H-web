import { useState, type FormEvent } from "react";
import { useGateway } from "../chat/GatewayProvider";
import SkillsPanel from "./SkillsPanel";
import ToolsetsPanel from "./ToolsetsPanel";
import McpPanel from "./McpPanel";
import PluginsPanel from "./PluginsPanel";

interface TabDef {
  id: string;
  label: string;
}

const TABS: TabDef[] = [
  { id: "skills", label: "技能" },
  { id: "toolsets", label: "工具" },
  { id: "mcp", label: "MCP" },
  { id: "plugins", label: "插件" },
];

/** 智能体页：技能 / 工具 / MCP / 插件 等子面板 + 经验→Skill（/learn）（M6）。 */
export default function AgentsPage() {
  const gateway = useGateway();
  const [tab, setTab] = useState<string>("skills");
  const [learnArgs, setLearnArgs] = useState("");
  const [learnBusy, setLearnBusy] = useState(false);
  const [learnMsg, setLearnMsg] = useState<string | null>(null);

  const runLearn = async (event: FormEvent) => {
    event.preventDefault();
    const args = learnArgs.trim();
    if (!args || learnBusy) {
      return;
    }
    setLearnBusy(true);
    setLearnMsg(null);
    try {
      await gateway.connect().catch(() => undefined);
      await gateway.request("slash.exec", { command: "/learn", args });
      setLearnMsg("已提交生成技能");
    } catch {
      setLearnMsg("生成技能失败");
    } finally {
      setLearnBusy(false);
    }
  };

  return (
    <div className="page agents-page">
      <form className="card learn-action" onSubmit={runLearn}>
        <div className="row">
          <input
            aria-label="学习来源"
            placeholder="从经验/来源生成技能（/learn）"
            value={learnArgs}
            onChange={(event) => setLearnArgs(event.target.value)}
          />
          <button className="primary" type="submit" disabled={learnBusy}>
            生成技能
          </button>
        </div>
        {learnMsg ? <p className="muted">{learnMsg}</p> : null}
      </form>

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
        {tab === "toolsets" ? <ToolsetsPanel /> : null}
        {tab === "mcp" ? <McpPanel /> : null}
        {tab === "plugins" ? <PluginsPanel /> : null}
      </div>
    </div>
  );
}
