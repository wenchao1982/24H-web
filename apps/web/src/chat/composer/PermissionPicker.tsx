import { t, type TranslationKey } from "../../i18n";

export interface PermissionOption {
  value: string;
  labelKey: TranslationKey;
}

/**
 * 权限模式选项（REQ-013）。
 *
 * `yolo` 为会话级 config key；`default`（默认审批）/ `on`（自动批准）均为 setter 接受的布尔词
 * （`server.py:1772-1774 _BOOL_WORDS` / `methods_config_set.py:263-288` 的 `_set_yolo`）。
 */
export const PERMISSION_OPTIONS: PermissionOption[] = [
  { value: "default", labelKey: "composer.permission.default" },
  { value: "on", labelKey: "composer.permission.auto" },
];

export interface PermissionPickerProps {
  value: string;
  disabled?: boolean;
  onSelect: (mode: string) => void;
}

/**
 * 权限模式选择控件（TASK-012 / REQ-013）。
 *
 * **controlled**：调用方发 `config.set{key:"yolo", scope:"session"}` 并在失败时回滚选中态。
 */
export default function PermissionPicker({
  value,
  disabled = false,
  onSelect,
}: PermissionPickerProps) {
  return (
    <div className="permission-picker composer-pill">
      <select
        className="pill-select"
        aria-label={t("composer.permission")}
        value={value}
        disabled={disabled}
        onChange={(event) => onSelect(event.target.value)}
      >
        {PERMISSION_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {t(option.labelKey)}
          </option>
        ))}
      </select>
    </div>
  );
}
