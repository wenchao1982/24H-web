import { t, type TranslationKey } from "../../i18n";

export interface PermissionOption {
  value: string;
  labelKey: TranslationKey;
}

/**
 * 权限模式选项（REQ-013）。
 *
 * `yolo` 为会话级 config key，**只接受 `_BOOL_WORDS` 中的词**（`server.py:1772-1774`：
 * `on/off/true/false/yes/no/1/0`）。语义映射：
 * - UI「默认审批」（按审批策略，**不开** yolo）→ `"off"`
 * - UI「自动批准」（全自动，**开** yolo）→ `"on"`
 *
 * **禁止使用 `"default"`**：它不在 `_BOOL_WORDS` 内，会命中 `methods_config_set.py:278` 的
 * fallback `not is_session_yolo_enabled(skey)`（**翻转**当前状态），使「默认」意外开启完全访问。
 */
export const PERMISSION_OPTIONS: PermissionOption[] = [
  { value: "off", labelKey: "composer.permission.default" },
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
