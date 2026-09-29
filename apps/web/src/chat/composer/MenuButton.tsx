import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";

export interface MenuButtonProps {
  /** 触发元素的可见文案与可访问名（`aria-label`）。 */
  label: string;
  /** 菜单项渲染函数；`close` 关闭菜单（Esc 关闭时自动归还焦点）。 */
  children: (close: () => void) => ReactNode;
  /**
   * 触发元素的可见内容；缺省时回退为 `label`。
   * （仅用于让 `＋` / `···` 等图形触发保持可访问名与视觉分离。）
   */
  trigger?: ReactNode;
  /** 外部触发元素 ref；缺省时使用内部 ref。 */
  triggerRef?: RefObject<HTMLButtonElement | null>;
  className?: string;
  disabled?: boolean;
}

/**
 * WAI-ARIA APG Menu Button 手写原语（TASK-028 / REQ-016）。
 *
 * - 触发元素：`aria-haspopup="menu"` + `aria-expanded` + `aria-controls`（`useId()`）。
 * - `Enter`/`Space`（原生 click）与 `ArrowDown`/`ArrowUp` 打开并聚焦首项。
 * - 菜单内 `ArrowUp`/`ArrowDown` 循环、`Home`/`End`；`Esc` 关闭并归还焦点；`Tab` 关闭；点击外部关闭。
 * - 菜单容器 `role="menu"`；**子项由调用方**标注 `role="menuitem"`。
 */
export default function MenuButton({
  label,
  children,
  trigger,
  triggerRef,
  className,
  disabled = false,
}: MenuButtonProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const internalRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = triggerRef ?? internalRef;

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const closeAndRestoreFocus = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, [buttonRef]);

  const menuItems = useCallback((): HTMLElement[] => {
    const root = menuRef.current;
    if (!root) {
      return [];
    }
    return Array.from(root.querySelectorAll<HTMLElement>('[role="menuitem"]'));
  }, []);

  // 打开后聚焦首项（无子项时聚焦菜单容器）。
  useEffect(() => {
    if (!open) {
      return;
    }
    const first = menuItems()[0] ?? menuRef.current;
    first?.focus();
  }, [open, menuItems]);

  // 点击外部关闭。
  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open, buttonRef]);

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeAndRestoreFocus();
      return;
    }
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    const items = menuItems();
    if (items.length === 0) {
      return;
    }
    const active = document.activeElement as HTMLElement | null;
    const index = active ? items.indexOf(active) : -1;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        items[(index + 1 + items.length) % items.length].focus();
        break;
      case "ArrowUp":
        event.preventDefault();
        items[(index - 1 + items.length) % items.length].focus();
        break;
      case "Home":
        event.preventDefault();
        items[0].focus();
        break;
      case "End":
        event.preventDefault();
        items[items.length - 1].focus();
        break;
      default:
        break;
    }
  };

  return (
    <div className="menu-button">
      <button
        type="button"
        ref={buttonRef}
        className={["menu-button-trigger", className].filter(Boolean).join(" ")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={label}
        title={label}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setOpen((value) => !value);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!disabled) {
              setOpen(true);
            }
          }
        }}
      >
        {trigger ?? label}
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          tabIndex={-1}
          className="pill-menu"
          onKeyDown={handleMenuKeyDown}
        >
          {children(close)}
        </div>
      ) : null}
    </div>
  );
}
