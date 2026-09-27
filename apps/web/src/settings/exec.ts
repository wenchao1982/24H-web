/**
 * 设置 → 高级 → 命令执行：L1 `cli.exec` / `shell.exec` 参数与结果解析。
 *
 * 字段以官方契约为准，缺失即降级为原始文本。
 */

export type ExecKind = "cli" | "shell";

export function execMethod(kind: ExecKind): string {
  return kind === "shell" ? "shell.exec" : "cli.exec";
}

export function execParams(command: string): Record<string, unknown> {
  return { command };
}

/** 容错解析执行结果：字符串 / `{output|stdout|result|text|stderr}`。 */
export function normalizeExecOutput(payload: unknown): string {
  if (typeof payload === "string") {
    return payload;
  }
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of ["output", "stdout", "result", "text", "stderr"]) {
      const value = record[key];
      if (typeof value === "string" && value !== "") {
        return value;
      }
    }
    const code = record.exit_code ?? record.code;
    if (typeof code === "number") {
      return `exit ${code}`;
    }
    return JSON.stringify(record, null, 2);
  }
  return "";
}
