import { spawn } from "node:child_process";
import { ApiError } from "../http/errors";

export interface GhResult {
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
}

/** 可注入的 `gh` 执行器（测试传入假实现，绝不真的登录）。 */
export type GhRunner = (args: string[], input?: string) => Promise<GhResult>;

/** 默认执行器：`spawn("gh", args, { shell: false })`，禁止 shell 注入。 */
export function spawnGh(args: string[], input?: string): Promise<GhResult> {
  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn("gh", args, { shell: false });
    } catch {
      resolve({ ok: false, code: null, stdout: "", stderr: "无法启动 gh" });
      return;
    }

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr += String(chunk);
    });
    child.on("error", () => {
      resolve({ ok: false, code: null, stdout, stderr: stderr || "无法启动 gh" });
    });
    child.on("close", (code) => {
      resolve({ ok: code === 0, code, stdout, stderr });
    });

    if (input !== undefined) {
      child.stdin?.write(input);
    }
    child.stdin?.end();
  });
}

export interface GithubStatus {
  connected: boolean;
  username: string | null;
}

/** 解析 `gh auth status` 输出（成功/失败均可能出现在 stdout/stderr）。 */
export function parseAuthStatus(stdout: string, stderr: string): GithubStatus {
  const text = `${stdout}\n${stderr}`;
  const match = /Logged in to \S+ (?:account )?(\S+)/i.exec(text);
  if (!match) {
    return { connected: false, username: null };
  }
  return { connected: true, username: match[1] ?? null };
}

export async function getGithubStatus(run: GhRunner = spawnGh): Promise<GithubStatus> {
  const result = await run(["auth", "status"]);
  return parseAuthStatus(result.stdout, result.stderr);
}

export async function githubConnect(run: GhRunner, token: string): Promise<GithubStatus> {
  const value = token.trim();
  if (value === "") {
    throw new ApiError(400, "INVALID_INPUT", "token 不能为空");
  }
  const result = await run(["auth", "login", "--with-token"], value);
  if (!result.ok) {
    throw new ApiError(502, "GH_LOGIN_FAILED", result.stderr.trim() || "GitHub 登录失败");
  }
  return getGithubStatus(run);
}

export interface GhRepo {
  name: string;
}

/** 列出仓库（失败时返回空数组，不抛出）。 */
export async function listGithubRepos(run: GhRunner = spawnGh): Promise<GhRepo[]> {
  const result = await run(["repo", "list", "--json", "name", "--limit", "30"]);
  if (!result.ok) {
    return [];
  }
  try {
    const parsed = JSON.parse(result.stdout) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : null))
      .filter((item): item is Record<string, unknown> => item !== null)
      .map((item) => ({ name: typeof item.name === "string" ? item.name : "" }))
      .filter((repo) => repo.name !== "");
  } catch {
    return [];
  }
}
