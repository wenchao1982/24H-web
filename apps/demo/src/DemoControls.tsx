import { Moon, Sun } from "lucide-react";
import type { ScreenId } from "./components/Sidebar";
import { cn } from "./lib/cn";

const SCREENS: { id: ScreenId; label: string }[] = [
  { id: "login", label: "登录" },
  { id: "chat-hero", label: "Hero" },
  { id: "chat-docked", label: "Docked" },
];

export interface DemoControlsProps {
  screen: ScreenId;
  onScreen: (id: ScreenId) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

/** 悬浮演示条（仅 Demo，不进生产）：顶部分段切屏 + 主题。 */
export function DemoControls({ screen, onScreen, theme, onToggleTheme }: DemoControlsProps) {
  return (
    <div
      data-demo-controls
      className="fixed left-1/2 top-2 z-50 flex -translate-x-1/2 items-center gap-0.5 rounded-pill border border-line-1 bg-s1/90 p-0.5 shadow-[0_4px_16px_rgb(15_17_21_/_10%)] backdrop-blur"
    >
      <span className="px-2 font-mono text-[10px] uppercase tracking-wide text-label-3">Demo</span>
      {SCREENS.map((s) => (
        <button
          key={s.id}
          type="button"
          data-demo-screen={s.id}
          onClick={() => onScreen(s.id)}
          className={cn(
            "rounded-pill px-2.5 py-1 text-[12px] transition-colors",
            screen === s.id
              ? "bg-accent-weak font-medium text-accent"
              : "text-label-2 hover:bg-s2 hover:text-label-1",
          )}
        >
          {s.label}
        </button>
      ))}
      <div className="mx-0.5 h-4 w-px bg-line-1" />
      <button
        type="button"
        data-demo-theme
        onClick={onToggleTheme}
        aria-label="切换主题"
        className="flex h-6 w-6 items-center justify-center rounded-pill text-label-2 hover:bg-s2 hover:text-label-1"
      >
        {theme === "dark" ? <Moon size={14} /> : <Sun size={14} />}
      </button>
    </div>
  );
}
