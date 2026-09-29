import { t } from "../../i18n";
import type { AgentOption } from "./agentOptions";

export interface AgentPickerProps {
  options: AgentOption[];
  value: string | null;
  variant: "hero" | "docked";
  onSelect: (name: string | null) => void;
  disabled?: boolean;
}

/**
 * 智能体（Hermes profile）选择控件（TASK-011 / REQ-002 / REQ-014）。
 *
 * **controlled**：选项恒由调用方传入 `me.profiles` 归一化结果，**绝不回退** `profiles.list`。
 * hero 可选；docked **只读**并提示「切换将新建会话」（A1）。
 */
export default function AgentPicker({
  options,
  value,
  variant,
  onSelect,
  disabled = false,
}: AgentPickerProps) {
  const docked = variant === "docked";
  const readOnly = docked || disabled;

  return (
    <div className="agent-picker composer-pill" data-readonly={readOnly}>
      <select
        className="pill-select"
        aria-label={t("composer.agent")}
        value={value ?? ""}
        disabled={readOnly}
        onChange={(event) => onSelect(event.target.value === "" ? null : event.target.value)}
      >
        <option value="">{t("composer.agent")}</option>
        {options.map((option) => (
          <option key={option.name} value={option.name}>
            {option.isDefault ? `${option.name}（默认）` : option.name}
          </option>
        ))}
      </select>
      {docked ? (
        <span className="sync-banner" role="status">
          {t("composer.agent.switchNew")}
        </span>
      ) : null}
    </div>
  );
}
