import { t } from "../../i18n";
import type { ModelOption } from "./modelCatalog";

/**
 * 模型切换状态机（REQ-009 / REQ-010 / REQ-011）。
 *
 * - `idle`：无进行中的切换。
 * - `pending`：已发出 `config.set`，等待回包。
 * - `deferred`：回合运行中被 stash 到下一回合（提示「将于下一回合生效」）。
 * - `confirm`：网关回 `confirm_required`，等待用户二次确认（尚未落库）。
 * - `error`：切换失败，透传网关 message。
 */
export type ModelSwitchState =
  | { status: "idle" }
  | { status: "pending"; target: string }
  | { status: "deferred"; target: string }
  | { status: "confirm"; target: string; message?: string }
  | { status: "error"; target: string; message: string };

export interface ModelPickerProps {
  options: ModelOption[];
  value: string | null;
  current: { model: string | null; provider: string | null };
  disabled?: boolean;
  switchState: ModelSwitchState;
  onSelect: (model: string) => void;
  onConfirm: () => void;
  onCancelConfirm: () => void;
}

/**
 * 模型选择控件（TASK-010 / REQ-009 / REQ-010 / REQ-011）。
 *
 * **controlled**：只接 props + 回调，不发任何 RPC（两级语义由调用方决定）。
 * `capabilities.fast` → 只读 `Flash` 徽标；`deferred` → 提示槽；`confirm` → `role="alertdialog"`。
 */
export default function ModelPicker({
  options,
  value,
  current,
  disabled = false,
  switchState,
  onSelect,
  onConfirm,
  onCancelConfirm,
}: ModelPickerProps) {
  const selected = value ?? current.model ?? "";
  const selectedOption = options.find((option) => option.id === selected);
  const flash = selectedOption?.capabilities.fast === true;
  const hasSelection = options.some((option) => option.id === selected);

  return (
    <div className="model-picker composer-pill" data-active={switchState.status !== "idle"}>
      <select
        className="pill-select"
        aria-label={t("composer.model")}
        value={hasSelection ? selected : ""}
        disabled={disabled}
        onChange={(event) => onSelect(event.target.value)}
      >
        {hasSelection ? null : <option value="">{t("composer.model")}</option>}
        {options.map((option) => (
          <option key={`${option.provider}::${option.id}`} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>

      {flash ? (
        <span className="model-flash-badge" title={t("composer.model.flash")}>
          {t("composer.model.flash")}
        </span>
      ) : null}

      {switchState.status === "deferred" ? (
        <p className="sync-banner" role="status" aria-live="polite">
          {t("composer.model.deferred")}
        </p>
      ) : null}

      {switchState.status === "error" ? (
        <p className="sync-banner" role="alert">
          {switchState.message}
        </p>
      ) : null}

      {switchState.status === "confirm" ? (
        <div
          className="model-confirm"
          role="alertdialog"
          aria-modal="true"
          aria-label={t("composer.model.confirmTitle")}
        >
          <p className="model-confirm-message">
            {switchState.message ?? t("composer.model.confirmTitle")}
          </p>
          <div className="model-confirm-actions">
            <button type="button" className="primary" onClick={onConfirm}>
              {t("composer.model.confirmYes")}
            </button>
            <button type="button" className="ghost" onClick={onCancelConfirm}>
              {t("composer.model.confirmNo")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
