import { t } from "../i18n";
import MenuButton from "./composer/MenuButton";

export interface SessionHeaderMenuProps {
  onConnect?: () => void;
  onImport?: () => void;
  onExport?: () => void;
  onShare?: () => void;
  onRename?: () => void;
  disabled?: boolean;
}

/**
 * 会话头 `···` 菜单（TASK-014 / REQ-004 / REQ-016）。
 *
 * 恰 5 项：`连接 / 导入 / 导出 / 分享 / 重命名`；复用 `MenuButton` 的 APG 键盘语义。
 * **controlled**：回调由调用方注入（重命名走 `session.title{runtimeId}`、分享沿用 `?session=<storedId>`）。
 */
export default function SessionHeaderMenu({
  onConnect,
  onImport,
  onExport,
  onShare,
  onRename,
  disabled = false,
}: SessionHeaderMenuProps) {
  return (
    <MenuButton
      label={t("composer.header.menu")}
      trigger="···"
      className="session-header-menu-btn"
      disabled={disabled}
    >
      {(close) => (
        <>
          <button
            type="button"
            role="menuitem"
            className="pill-menu-item"
            onClick={() => {
              close();
              onConnect?.();
            }}
          >
            {t("composer.header.connect")}
          </button>
          <button
            type="button"
            role="menuitem"
            className="pill-menu-item"
            onClick={() => {
              close();
              onImport?.();
            }}
          >
            {t("composer.header.import")}
          </button>
          <button
            type="button"
            role="menuitem"
            className="pill-menu-item"
            onClick={() => {
              close();
              onExport?.();
            }}
          >
            {t("composer.header.export")}
          </button>
          <button
            type="button"
            role="menuitem"
            className="pill-menu-item"
            onClick={() => {
              close();
              onShare?.();
            }}
          >
            {t("composer.header.share")}
          </button>
          <button
            type="button"
            role="menuitem"
            className="pill-menu-item"
            onClick={() => {
              close();
              onRename?.();
            }}
          >
            {t("composer.header.rename")}
          </button>
        </>
      )}
    </MenuButton>
  );
}
