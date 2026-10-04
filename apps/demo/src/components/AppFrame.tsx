import { useState, type ReactNode } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { Sidebar, type ScreenId } from "./Sidebar";
import { DetailsDock } from "./DetailsDock";

export interface AppFrameProps {
  active: ScreenId;
  onNavigate: (id: ScreenId) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  children: ReactNode;
}

/** Demo 版三栏 AppFrame（侧栏 + 主区 + 右侧功能面板）。 */
export function AppFrame({
  active,
  onNavigate,
  theme,
  onToggleTheme,
  children,
}: AppFrameProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [dockOpen, setDockOpen] = useState(false);

  return (
    <div className="flex h-full w-full overflow-hidden bg-bg text-label-1">
      <Sidebar
        active={active}
        onNavigate={onNavigate}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      {dockOpen ? <DetailsDock onClose={() => setDockOpen(false)} /> : null}
      <div className="flex h-full w-8 shrink-0 flex-col items-center border-l border-line-1 bg-s2 pt-3">
        <button
          type="button"
          onClick={() => setDockOpen((v) => !v)}
          aria-label={dockOpen ? "关闭功能面板" : "打开功能面板"}
          aria-pressed={dockOpen}
          title={dockOpen ? "关闭功能面板" : "打开功能面板"}
          className="flex h-9 w-7 items-center justify-center rounded-md text-label-3 transition-colors hover:bg-s3 hover:text-label-1"
        >
          {dockOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
        </button>
        {!dockOpen ? (
          <span className="mt-1 select-none text-[10px] tracking-widest text-label-3 [writing-mode:vertical-rl]">
            面板
          </span>
        ) : null}
      </div>
    </div>
  );
}
