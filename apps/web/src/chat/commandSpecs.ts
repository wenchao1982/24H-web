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
  {
    command: "loop",
    titleKey: "loop.title",
    inputKey: "loop.input",
    actions: [
      { id: "start", labelKey: "loop.action.start", args: "start", kind: "primary", withInput: true },
      { id: "status", labelKey: "loop.action.status", args: "status" },
      { id: "pause", labelKey: "loop.action.pause", args: "pause" },
      { id: "resume", labelKey: "loop.action.resume", args: "resume" },
      { id: "stop", labelKey: "loop.action.stop", args: "stop", kind: "danger" },
    ],
  },
  {
    command: "heartbeat",
    titleKey: "heartbeat.title",
    inputKey: "heartbeat.input",
    actions: [
      {
        id: "start",
        labelKey: "heartbeat.action.start",
        args: "start",
        kind: "primary",
        withInput: true,
      },
      { id: "status", labelKey: "heartbeat.action.status", args: "status" },
      { id: "pause", labelKey: "heartbeat.action.pause", args: "pause" },
      { id: "resume", labelKey: "heartbeat.action.resume", args: "resume" },
      { id: "stop", labelKey: "heartbeat.action.stop", args: "stop", kind: "danger" },
    ],
  },
  {
    command: "plan",
    titleKey: "plan.title",
    inputKey: "plan.input",
    actions: [
      { id: "run", labelKey: "plan.action.run", args: "run", kind: "primary", withInput: true },
      { id: "status", labelKey: "plan.action.status", args: "status" },
      { id: "list", labelKey: "plan.action.list", args: "list" },
    ],
  },
  {
    command: "review",
    titleKey: "review.title",
    inputKey: "review.input",
    actions: [
      { id: "run", labelKey: "review.action.run", args: "run", kind: "primary" },
      { id: "status", labelKey: "review.action.status", args: "status" },
    ],
  },
  {
    command: "branch",
    titleKey: "branch.title",
    inputKey: "branch.input",
    actions: [
      {
        id: "create",
        labelKey: "branch.action.create",
        args: "create",
        kind: "primary",
        withInput: true,
      },
      { id: "list", labelKey: "branch.action.list", args: "list" },
    ],
  },
  {
    command: "fork",
    titleKey: "fork.title",
    inputKey: "fork.input",
    actions: [
      { id: "run", labelKey: "fork.action.run", args: "run", kind: "primary", withInput: true },
      { id: "list", labelKey: "fork.action.list", args: "list" },
    ],
  },
  {
    command: "undo",
    titleKey: "undo.title",
    actions: [{ id: "run", labelKey: "undo.action.run", args: "run", kind: "primary" }],
  },
  {
    command: "retry",
    titleKey: "retry.title",
    actions: [{ id: "run", labelKey: "retry.action.run", args: "run", kind: "primary" }],
  },
  {
    command: "rollback",
    titleKey: "rollback.title",
    inputKey: "rollback.input",
    actions: [
      { id: "list", labelKey: "rollback.action.list", args: "list" },
      {
        id: "restore",
        labelKey: "rollback.action.restore",
        args: "restore",
        kind: "primary",
        withInput: true,
      },
    ],
  },
  {
    command: "snapshot",
    titleKey: "snapshot.title",
    inputKey: "snapshot.input",
    actions: [
      { id: "create", labelKey: "snapshot.action.create", args: "create", kind: "primary" },
      {
        id: "restore",
        labelKey: "snapshot.action.restore",
        args: "restore",
        withInput: true,
      },
      { id: "prune", labelKey: "snapshot.action.prune", args: "prune", kind: "danger" },
      { id: "list", labelKey: "snapshot.action.list", args: "list" },
    ],
  },
  {
    command: "bg",
    titleKey: "bg.title",
    inputKey: "bg.input",
    actions: [
      { id: "run", labelKey: "bg.action.run", args: "run", kind: "primary", withInput: true },
      { id: "status", labelKey: "bg.action.status", args: "status" },
    ],
  },
  {
    command: "btw",
    titleKey: "btw.title",
    inputKey: "btw.input",
    actions: [
      { id: "ask", labelKey: "btw.action.ask", args: "ask", kind: "primary", withInput: true },
      { id: "status", labelKey: "btw.action.status", args: "status" },
    ],
  },
  {
    command: "queue",
    titleKey: "queue.title",
    inputKey: "queue.input",
    actions: [
      { id: "add", labelKey: "queue.action.add", args: "add", kind: "primary", withInput: true },
      { id: "list", labelKey: "queue.action.list", args: "list" },
      { id: "clear", labelKey: "queue.action.clear", args: "clear", kind: "danger" },
    ],
  },
  {
    command: "steer",
    titleKey: "steer.title",
    inputKey: "steer.input",
    actions: [
      { id: "send", labelKey: "steer.action.send", args: "send", kind: "primary", withInput: true },
    ],
  },
  {
    command: "busy",
    titleKey: "busy.title",
    actions: [
      { id: "queue", labelKey: "busy.action.queue", args: "queue" },
      { id: "steer", labelKey: "busy.action.steer", args: "steer" },
      { id: "interrupt", labelKey: "busy.action.interrupt", args: "interrupt", kind: "danger" },
    ],
  },
  {
    command: "compress",
    titleKey: "compress.title",
    actions: [
      { id: "run", labelKey: "compress.action.run", args: "run", kind: "primary" },
      { id: "status", labelKey: "compress.action.status", args: "status" },
    ],
  },
  {
    command: "skills",
    titleKey: "skillwrite.title",
    inputKey: "skillwrite.input",
    actions: [
      { id: "pending", labelKey: "skillwrite.action.pending", args: "pending" },
      {
        id: "approve",
        labelKey: "skillwrite.action.approve",
        args: "approve",
        kind: "primary",
        withInput: true,
      },
      {
        id: "reject",
        labelKey: "skillwrite.action.reject",
        args: "reject",
        kind: "danger",
        withInput: true,
      },
      { id: "on", labelKey: "skillwrite.action.on", args: "approval on" },
      { id: "off", labelKey: "skillwrite.action.off", args: "approval off" },
    ],
  },
  {
    command: "memory",
    titleKey: "memwrite.title",
    inputKey: "memwrite.input",
    actions: [
      { id: "pending", labelKey: "memwrite.action.pending", args: "pending" },
      {
        id: "approve",
        labelKey: "memwrite.action.approve",
        args: "approve",
        kind: "primary",
        withInput: true,
      },
      {
        id: "reject",
        labelKey: "memwrite.action.reject",
        args: "reject",
        kind: "danger",
        withInput: true,
      },
      { id: "on", labelKey: "memwrite.action.on", args: "approval on" },
      { id: "off", labelKey: "memwrite.action.off", args: "approval off" },
    ],
  },
  {
    command: "bundles",
    titleKey: "bundles.title",
    inputKey: "bundles.input",
    actions: [
      { id: "list", labelKey: "bundles.action.list", args: "list" },
      {
        id: "run",
        labelKey: "bundles.action.run",
        args: "run",
        kind: "primary",
        withInput: true,
      },
    ],
  },
  {
    command: "suggestions",
    titleKey: "suggestions.title",
    inputKey: "suggestions.input",
    actions: [
      { id: "catalog", labelKey: "suggestions.action.catalog", args: "catalog" },
      {
        id: "accept",
        labelKey: "suggestions.action.accept",
        args: "accept",
        kind: "primary",
        withInput: true,
      },
      {
        id: "dismiss",
        labelKey: "suggestions.action.dismiss",
        args: "dismiss",
        kind: "danger",
        withInput: true,
      },
    ],
  },
  {
    command: "blueprint",
    titleKey: "blueprint.title",
    inputKey: "blueprint.input",
    actions: [
      { id: "list", labelKey: "blueprint.action.list", args: "list" },
      {
        id: "create",
        labelKey: "blueprint.action.create",
        args: "create",
        kind: "primary",
        withInput: true,
      },
    ],
  },
  {
    command: "reload",
    titleKey: "reload.title",
    actions: [{ id: "run", labelKey: "reload.action.run", args: "run", kind: "primary" }],
  },
  {
    command: "reload-mcp",
    titleKey: "reloadMcp.title",
    actions: [{ id: "run", labelKey: "reloadMcp.action.run", args: "run", kind: "primary" }],
  },
  {
    command: "reload-skills",
    titleKey: "reloadSkills.title",
    actions: [{ id: "run", labelKey: "reloadSkills.action.run", args: "run", kind: "primary" }],
  },
  {
    command: "init",
    titleKey: "init.title",
    actions: [{ id: "run", labelKey: "init.action.run", args: "run", kind: "primary" }],
  },
  {
    command: "fast",
    titleKey: "fast.title",
    actions: [
      { id: "enable", labelKey: "fast.action.enable", args: "on", kind: "primary" },
      { id: "disable", labelKey: "fast.action.disable", args: "off" },
      { id: "status", labelKey: "fast.action.status", args: "status" },
    ],
  },
  {
    command: "reasoning",
    titleKey: "reasoning.title",
    actions: [
      { id: "low", labelKey: "reasoning.action.low", args: "low" },
      { id: "medium", labelKey: "reasoning.action.medium", args: "medium" },
      { id: "high", labelKey: "reasoning.action.high", args: "high" },
      { id: "status", labelKey: "reasoning.action.status", args: "status" },
    ],
  },
  {
    command: "egress",
    titleKey: "egress.title",
    actions: [{ id: "status", labelKey: "egress.action.status", args: "status" }],
  },
  {
    command: "worktree",
    titleKey: "worktree.title",
    inputKey: "worktree.input",
    actions: [
      { id: "list", labelKey: "worktree.action.list", args: "list" },
      {
        id: "new",
        labelKey: "worktree.action.new",
        args: "new",
        kind: "primary",
        withInput: true,
      },
    ],
  },
];

export function specForCommand(command: string): SlashCommandSpec | undefined {
  const name = command.replace(/^\//, "");
  return SLASH_COMMAND_SPECS.find((spec) => spec.command === name);
}
