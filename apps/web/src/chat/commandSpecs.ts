import type { TranslationKey } from "../i18n";

/** 命令面板里的预设动作（T20.2+）：点按即向 `slash.exec` 发送 `args`。 */
export interface SlashActionSpec {
  /** 稳定 id，用于测试与 key。 */
  id: string;
  labelKey: TranslationKey;
  /** 发送给 `slash.exec` 的参数前缀。 */
  args: string;
  kind?: "primary" | "danger";
  /** 为真时需附带输入框内容（`args + " " + input`）。 */
  withInput?: boolean;
}

/** 单个会话命令的面板描述。 */
export interface SlashCommandSpec {
  /** 不含 `/`，如 `goal`。 */
  command: string;
  titleKey: TranslationKey;
  /** 输入框标签（可选）。 */
  inputKey?: TranslationKey;
  actions: SlashActionSpec[];
}

/** M15 会话命令的面板清单（按任务增量扩充）。 */
export const SLASH_COMMAND_SPECS: SlashCommandSpec[] = [
  {
    command: "goal",
    titleKey: "goal.title",
    inputKey: "goal.input",
    actions: [
      { id: "set", labelKey: "goal.action.set", args: "set", kind: "primary", withInput: true },
      { id: "status", labelKey: "goal.action.status", args: "status" },
      { id: "pause", labelKey: "goal.action.pause", args: "pause" },
      { id: "resume", labelKey: "goal.action.resume", args: "resume" },
      { id: "clear", labelKey: "goal.action.clear", args: "clear", kind: "danger" },
    ],
  },
  {
    command: "subgoal",
    titleKey: "subgoal.title",
    inputKey: "subgoal.input",
    actions: [
      { id: "add", labelKey: "subgoal.action.add", args: "add", kind: "primary", withInput: true },
      { id: "status", labelKey: "subgoal.action.status", args: "status" },
      { id: "clear", labelKey: "subgoal.action.clear", args: "clear", kind: "danger" },
    ],
  },
];

export function specForCommand(command: string): SlashCommandSpec | undefined {
  const name = command.replace(/^\//, "");
  return SLASH_COMMAND_SPECS.find((spec) => spec.command === name);
}
