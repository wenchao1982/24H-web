import { t } from "../i18n";
import type { SlashCommand } from "./slash";

export interface SlashMenuProps {
  commands: SlashCommand[];
  activeIndex: number;
  onPick: (command: SlashCommand) => void;
}

/** 输入框 `/` 触发的命令菜单（T20.1）：过滤后的命令列表，点选即执行。 */
export default function SlashMenu({ commands, activeIndex, onPick }: SlashMenuProps) {
  if (commands.length === 0) {
    return null;
  }
  return (
    <ul className="slash-menu" role="listbox" aria-label={t("slash.menu")}>
      {commands.map((command, index) => (
        <li key={command.name} role="option" aria-selected={index === activeIndex}>
          <button
            type="button"
            className="slash-item"
            data-active={index === activeIndex}
            onMouseDown={(event) => {
              event.preventDefault();
              onPick(command);
            }}
          >
            <span className="slash-name">/{command.name}</span>
            <span className="slash-desc muted">
              {command.description || command.argsHint || ""}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
