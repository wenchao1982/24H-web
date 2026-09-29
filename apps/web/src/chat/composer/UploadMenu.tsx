import { useRef, useState } from "react";
import { t } from "../../i18n";
import MenuButton from "./MenuButton";

/** `＋` 菜单后五项打开的面板（TASK-013）。 */
export type UploadPanelKind =
  | "subagents"
  | "commands"
  | "context"
  | "personality"
  | "image";

export interface UploadMenuProps {
  onAttachFiles: (files: File[]) => void;
  onOpenPanel: (kind: UploadPanelKind) => void;
  /** 工作区选项（目录路径）；由调用方注入（hero 与会话内共用）。 */
  workspaceOptions?: string[];
  workspaceValue?: string | null;
  /** 选择工作区：会话内走 `session.workspace.move{session_key}`（stored id）。 */
  onSelectWorkspace?: (path: string | null) => void;
  disabled?: boolean;
}

/**
 * `＋` 上传菜单（TASK-013 / REQ-005 / REQ-007 / REQ-016）。
 *
 * 前三项（文件 / 图片 / PDF）触发**浏览器**文件选择器（`<input type="file">`，按 `accept` 区分）；
 * 后五项调用 `onOpenPanel(kind)`。隐藏 input 用 `visually-hidden`（**不得** `display:none`），
 * 文件/图片/PDF 由可聚焦的 `role="menuitem"` 按钮触发（WCAG 2.5.7）。
 * **controlled**：仅把选中的 `File[]` 交回调用方（chip 暂存 / 延迟绑定由 `useSessionControls` 负责）。
 */
export default function UploadMenu({
  onAttachFiles,
  onOpenPanel,
  workspaceOptions = [],
  workspaceValue = null,
  onSelectWorkspace,
  disabled = false,
}: UploadMenuProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  const finishSelection = (input: HTMLInputElement) => {
    const files = input.files ? Array.from(input.files) : [];
    if (files.length > 0) {
      onAttachFiles(files);
    }
    input.value = "";
  };

  return (
    <div className="upload-menu">
      <MenuButton
        label={t("composer.upload.add")}
        trigger="＋"
        className="composer-attach"
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
                fileRef.current?.click();
              }}
            >
              {t("composer.upload.file")}
            </button>
            <button
              type="button"
              role="menuitem"
              className="pill-menu-item"
              onClick={() => {
                close();
                imageRef.current?.click();
              }}
            >
              {t("composer.upload.image")}
            </button>
            <button
              type="button"
              role="menuitem"
              className="pill-menu-item"
              onClick={() => {
                close();
                pdfRef.current?.click();
              }}
            >
              {t("composer.upload.pdf")}
            </button>
            <button
              type="button"
              role="menuitem"
              className="pill-menu-item"
              onClick={() => {
                close();
                onOpenPanel("subagents");
              }}
            >
              {t("composer.upload.subagents")}
            </button>
            <button
              type="button"
              role="menuitem"
              className="pill-menu-item"
              onClick={() => {
                close();
                onOpenPanel("commands");
              }}
            >
              {t("composer.upload.commands")}
            </button>
            <button
              type="button"
              role="menuitem"
              className="pill-menu-item"
              onClick={() => {
                close();
                onOpenPanel("context");
              }}
            >
              {t("composer.upload.context")}
            </button>
            <button
              type="button"
              role="menuitem"
              className="pill-menu-item"
              onClick={() => {
                close();
                onOpenPanel("personality");
              }}
            >
              {t("composer.upload.personality")}
            </button>
            <button
              type="button"
              role="menuitem"
              className="pill-menu-item"
              onClick={() => {
                close();
                onOpenPanel("image");
              }}
            >
              {t("composer.upload.imagegen")}
            </button>
            <button
              type="button"
              role="menuitem"
              className="pill-menu-item"
              aria-expanded={workspaceOpen}
              onClick={() => setWorkspaceOpen((value) => !value)}
            >
              {t("composer.upload.workspace")}
            </button>
            {workspaceOpen ? (
              <select
                className="pill-select upload-workspace-select"
                aria-label={t("composer.workspace")}
                value={workspaceValue ?? ""}
                onChange={(event) => {
                  close();
                  onSelectWorkspace?.(event.target.value === "" ? null : event.target.value);
                }}
              >
                <option value="">{t("composer.workspace.placeholder")}</option>
                {workspaceOptions.map((path) => (
                  <option key={path} value={path}>
                    {path}
                  </option>
                ))}
              </select>
            ) : null}
          </>
        )}
      </MenuButton>

      <input
        ref={fileRef}
        type="file"
        multiple
        className="visually-hidden"
        aria-label={t("composer.upload.file")}
        onChange={(event) => finishSelection(event.currentTarget)}
      />
      <input
        ref={imageRef}
        type="file"
        multiple
        accept="image/*"
        className="visually-hidden"
        aria-label={t("composer.upload.image")}
        onChange={(event) => finishSelection(event.currentTarget)}
      />
      <input
        ref={pdfRef}
        type="file"
        multiple
        accept="application/pdf"
        className="visually-hidden"
        aria-label={t("composer.upload.pdf")}
        onChange={(event) => finishSelection(event.currentTarget)}
      />
    </div>
  );
}
