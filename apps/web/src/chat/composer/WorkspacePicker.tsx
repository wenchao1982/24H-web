import { t } from "../../i18n";

export interface WorkspacePickerProps {
  options: string[];
  value: string | null;
  disabled?: boolean;
  onSelect: (path: string | null) => void;
}

/**
 * 工作区选择控件（TASK-012 / REQ-012）。
 *
 * **controlled**：hero 写 `session.create{cwd, cwd_explicit:true}`，会话内发
 * `session.workspace.move{session_key}`，均由调用方决定；空值选项文案保持「工作区」。
 */
export default function WorkspacePicker({
  options,
  value,
  disabled = false,
  onSelect,
}: WorkspacePickerProps) {
  return (
    <div className="workspace-picker composer-pill">
      <select
        className="pill-select"
        aria-label={t("composer.workspace")}
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => onSelect(event.target.value === "" ? null : event.target.value)}
      >
        <option value="">{t("composer.workspace")}</option>
        {options.map((path) => (
          <option key={path} value={path}>
            {path}
          </option>
        ))}
      </select>
    </div>
  );
}
