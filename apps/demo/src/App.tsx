import { useEffect, useState } from "react";
import { AppFrame } from "./components/AppFrame";
import type { ScreenId } from "./components/Sidebar";
import { DemoControls } from "./DemoControls";
import { Account } from "./screens/Account";
import { Admin } from "./screens/Admin";
import { AgentManager } from "./screens/AgentManager";
import { ChatDocked } from "./screens/ChatDocked";
import { ChatHero } from "./screens/ChatHero";
import { Files } from "./screens/Files";
import { Groups } from "./screens/Groups";
import { Kanban } from "./screens/Kanban";
import { Login } from "./screens/Login";
import { Memory } from "./screens/Memory";
import { Monitor } from "./screens/Monitor";
import { Notifications } from "./screens/Notifications";
import { Orchestration } from "./screens/Orchestration";
import { Projects } from "./screens/Projects";
import { Settings } from "./screens/Settings";
import { Tasks } from "./screens/Tasks";
import { Usage } from "./screens/Usage";

export default function App() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [screen, setScreen] = useState<ScreenId>("chat-hero");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  if (screen === "login") {
    return (
      <>
        <Login />
        <DemoControls
          screen={screen}
          onScreen={setScreen}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      </>
    );
  }

  return (
    <>
      <AppFrame active={screen} onNavigate={setScreen} theme={theme} onToggleTheme={toggleTheme}>
        {screen === "chat-hero" ? <ChatHero /> : null}
        {screen === "chat-docked" ? <ChatDocked /> : null}
        {screen === "agents" ? <AgentManager /> : null}
        {screen === "groups" ? <Groups /> : null}
        {screen === "tasks" ? <Tasks /> : null}
        {screen === "kanban" ? <Kanban /> : null}
        {screen === "orchestration" ? <Orchestration /> : null}
        {screen === "usage" ? <Usage /> : null}
        {screen === "monitor" ? <Monitor /> : null}
        {screen === "memory" ? <Memory /> : null}
        {screen === "projects" ? <Projects /> : null}
        {screen === "files" ? <Files /> : null}
        {screen === "settings" ? <Settings theme={theme} onTheme={setTheme} /> : null}
        {screen === "admin" ? <Admin /> : null}
        {screen === "account" ? <Account /> : null}
        {screen === "notifications" ? <Notifications /> : null}
      </AppFrame>
      <DemoControls
        screen={screen}
        onScreen={setScreen}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    </>
  );
}
