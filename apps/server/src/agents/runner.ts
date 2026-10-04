import { spawn } from "node:child_process";
import { delimiter } from "node:path";

export interface CommandResult {
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
}

export interface CommandOptions {
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}

/** 可注入的命令执行器（测试传入假实现，绝不真的安装）。 */
export type CommandRunner = (
  cmd: string,
  args: string[],
  options?: CommandOptions,
) => Promise<CommandResult>;

/** 默认执行器：`spawn(cmd, args, { shell: false })`，禁止 shell 注入。 */
export function spawnCommand(
  cmd: string,
  args: string[],
  options: CommandOptions = {},
): Promise<CommandResult> {
  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(cmd, args, { shell: false, ...(options.env ? { env: options.env } : {}) });
    } catch {
      resolve({ ok: false, code: null, stdout: "", stderr: `无法启动 ${cmd}` });
      return;
    }

    let stdout = "";
    let stderr = "";
    const timer =
      options.timeoutMs && options.timeoutMs > 0
        ? setTimeout(() => {
            child.kill();
          }, options.timeoutMs)
        : undefined;

    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr += String(chunk);
    });
    child.on("error", () => {
      if (timer) {
        clearTimeout(timer);
      }
      resolve({ ok: false, code: null, stdout, stderr: stderr || `无法启动 ${cmd}` });
    });
    child.on("close", (code) => {
      if (timer) {
        clearTimeout(timer);
      }
      resolve({ ok: code === 0, code, stdout, stderr });
    });
  });
}

/** 把受管 bin 目录前置到 PATH 最前（防系统旧版遮蔽更新）。 */
export function withManagedPath(base: NodeJS.ProcessEnv, managedBin: string): NodeJS.ProcessEnv {
  const key = Object.keys(base).find((entry) => entry.toLowerCase() === "path") ?? "PATH";
  const entries = (base[key] ?? "").split(delimiter).filter(Boolean);
  const identity = (value: string) => (process.platform === "win32" ? value.toLowerCase() : value);
  return {
    ...base,
    [key]: [managedBin, ...entries.filter((entry) => identity(entry) !== identity(managedBin))].join(
      delimiter,
    ),
  };
}
