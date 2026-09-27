import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultSkillRoots, findRepoRoot } from "./paths";

const tempDirs: string[] = [];

function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("findRepoRoot", () => {
  it("walks up to the directory containing examples/skills", () => {
    const root = tempDir("findrepo-skills-");
    mkdirSync(join(root, "examples", "skills"), { recursive: true });
    const nested = join(root, "apps", "server", "src", "skillui");
    mkdirSync(nested, { recursive: true });

    expect(findRepoRoot(nested)).toBe(root);
  });

  it("walks up to the package.json named 24h-web when examples/skills is absent", () => {
    const root = tempDir("findrepo-pkg-");
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "24h-web" }));
    const nested = join(root, "apps", "server", "dist");
    mkdirSync(nested, { recursive: true });

    expect(findRepoRoot(nested)).toBe(root);
  });

  it("prefers examples/skills over a parent package.json named 24h-web", () => {
    const root = tempDir("findrepo-prefer-");
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "24h-web" }));
    const inner = join(root, "packages", "inner");
    mkdirSync(join(inner, "examples", "skills"), { recursive: true });

    expect(findRepoRoot(inner)).toBe(inner);
  });

  it("falls back to the starting directory when nothing matches", () => {
    const root = tempDir("findrepo-fallback-");
    const nested = join(root, "a", "b");
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "not-24h-web" }));

    expect(findRepoRoot(nested)).toBe(resolve(nested));
  });
});

describe("defaultSkillRoots", () => {
  it("points at the repo's examples/skills directory", () => {
    const roots = defaultSkillRoots();
    expect(roots.length).toBeGreaterThan(0);
    expect(roots[0]).toBe(resolve(findRepoRoot(process.cwd()), "examples", "skills"));
  });

  it("returns unique existing directories", () => {
    const roots = defaultSkillRoots();
    expect(new Set(roots).size).toBe(roots.length);
    for (const root of roots) {
      expect(root.endsWith("examples/skills")).toBe(true);
    }
  });
});
