import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_PACKAGE_NAME = "24h-web";

function packageNameOf(dir: string): string | null {
  try {
    const raw = readFileSync(join(dir, "package.json"), "utf8");
    const data = JSON.parse(raw) as { name?: unknown };
    return typeof data.name === "string" ? data.name : null;
  } catch {
    return null;
  }
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * 从 `startDir` 向上查找仓库根：优先包含 `examples/skills` 的目录，
 * 其次 `package.json` 中 `name === "24h-web"` 的目录；到文件系统根为止。
 * 找不到时回退到解析后的起始目录。
 *
 * 这样无论从源码（`apps/server/src/...`）还是打包产物（`apps/server/dist/...`）
 * 运行，都能解析到同一个仓库根。
 */
export function findRepoRoot(startDir: string): string {
  const start = resolve(startDir);
  const fsRoot = parse(start).root;
  let current = start;

  for (;;) {
    if (existsSync(join(current, "examples", "skills"))) {
      return current;
    }
    if (packageNameOf(current) === REPO_PACKAGE_NAME) {
      return current;
    }
    if (current === fsRoot) {
      return start;
    }
    current = dirname(current);
  }
}

/**
 * 应用根目录。esbuild 在 `format: "esm"` / `platform: "node"` 下保留
 * `import.meta.url` 为**输出文件** URL，故此处对 `dist/server.mjs` 同样成立。
 */
export const APP_ROOT = findRepoRoot(dirname(fileURLToPath(import.meta.url)));

/**
 * 默认 Skill UI 扫描根：仓库内 `examples/skills` 优先，其次当前工作目录下的同名目录
 * （存在且与前者不同时）。两者都不存在时仍返回 APP_ROOT 候选，交由发现器跳过。
 */
export function defaultSkillRoots(): string[] {
  const candidates: string[] = [resolve(APP_ROOT, "examples", "skills")];
  const cwdCandidate = resolve(process.cwd(), "examples", "skills");
  if (cwdCandidate !== candidates[0]) {
    candidates.push(cwdCandidate);
  }

  const existing = candidates.filter(isDirectory);
  return existing.length > 0 ? existing : [candidates[0]!];
}
