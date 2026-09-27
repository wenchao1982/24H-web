import { t } from "../i18n";
import type { PathSuggestion } from "./references";

export interface ReferenceMenuProps {
  paths: PathSuggestion[];
  activeIndex: number;
  onPick: (path: string) => void;
}

/** 输入框 `@` 触发的上下文引用菜单（T23.2）：点选即插入引用 chip。 */
export default function ReferenceMenu({ paths, activeIndex, onPick }: ReferenceMenuProps) {
  if (paths.length === 0) {
    return null;
  }
  return (
    <ul className="slash-menu" role="listbox" aria-label={t("reference.menu")}>
      {paths.map((item, index) => (
        <li key={item.path} role="option" aria-selected={index === activeIndex}>
          <button
            type="button"
            className="slash-item"
            data-active={index === activeIndex}
            onMouseDown={(event) => {
              event.preventDefault();
              onPick(item.path);
            }}
          >
            <span className="slash-name">{item.isDir ? `${item.path}/` : item.path}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
