import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CODING_AGENTS, findDefinition } from "./definitions";
import { detectAgent, listAgents, parseVersion, type AgentsDeps } from "./registry";
import { checkAgentUpdate, installAgent, uninstallAgent } from "./installer";
import { loadPolicies, policyPath, setPolicy } from "./updatePolicy";
import { withManagedPath, type CommandRunner } from "./runner";

const DIR = "/tmp/managed";
const deps = (runner: CommandRunner): AgentsDeps => ({
  managedDir: DIR,
  managedBin: join(DIR, "bin"),
  runner,
});

describe("agents/runner", () => {
  it("prepends the managed bin without duplicating it", () => {
    const env = withManagedPath({ PATH: `/usr/bin:${join(DIR, "bin")}:/bin` }, join(DIR, "bin"));
    expect(env.PATH?.split(":").slice(0, 2)).toEqual([join(DIR, "bin"), "/usr/bin"]);
    expect(env.PATH?.split(":").filter((p) => p === join(DIR, "bin"))).toHaveLength(1);
  });
});

describe("agents/registry", () => {
  it("parses a semver from mixed output", () => {
    expect(parseVersion("1.0.42 (Claude Code)")).toBe("1.0.42");
    expect(parseVersion("codex-cli 0.9.1")).toBe("0.9.1");
    expect(parseVersion("no version here")).toBeNull();
  });

  it("detects installed agents via --version and reports the rest as not installed", async () => {
    const runner: CommandRunner = async (cmd) => {
      if (cmd === "claude") return { ok: true, code: 0, stdout: "1.0.42", stderr: "" };
      return { ok: false, code: 1, stdout: "", stderr: "not found" };
    };
    const claude = await detectAgent(findDefinition("claude-code")!, deps(runner));
    expect(claude).toMatchObject({ installed: true, version: "1.0.42", installable: true });
    const codex = await detectAgent(findDefinition("codex")!, deps(runner));
    expect(codex).toMatchObject({ installed: false, version: null });
  });

  it("lists every registered agent", async () => {
    const runner: CommandRunner = async () => ({ ok: false, code: 1, stdout: "", stderr: "" });
    expect(await listAgents(deps(runner))).toHaveLength(CODING_AGENTS.length);
  });
});

describe("agents/installer", () => {
  const recordingRunner = (): { runner: CommandRunner; calls: string[][] } => {
    const calls: string[][] = [];
    const runner: CommandRunner = async (cmd, args) => {
      calls.push([cmd, ...args]);
      if (cmd === "npm" && args[0] === "install") return { ok: true, code: 0, stdout: "", stderr: "" };
      if (cmd === "npm" && args[0] === "uninstall") return { ok: true, code: 0, stdout: "", stderr: "" };
      if (cmd === "npm" && args[0] === "view") return { ok: true, code: 0, stdout: "1.0.55", stderr: "" };
      if (cmd === "claude") return { ok: true, code: 0, stdout: "1.0.42", stderr: "" };
      return { ok: false, code: 1, stdout: "", stderr: "not found" };
    };
    return { runner, calls };
  };

  it("installs via npm -g --prefix into the managed dir and detects the result", async () => {
    const { runner, calls } = recordingRunner();
    const status = await installAgent("claude-code", deps(runner));
    expect(status).toMatchObject({ installed: true, version: "1.0.42" });
    expect(calls[0]).toEqual([
      "npm",
      "install",
      "-g",
      "--prefix",
      DIR,
      "@anthropic-ai/claude-code@latest",
    ]);
  });

  it("refuses agents without a known package", async () => {
    const { runner } = recordingRunner();
    await expect(installAgent("pi", deps(runner))).rejects.toMatchObject({
      code: "AGENT_NOT_INSTALLABLE",
    });
  });

  it("uninstalls via npm -g --prefix", async () => {
    const { runner, calls } = recordingRunner();
    await uninstallAgent("codex", deps(runner));
    expect(calls[0]).toEqual(["npm", "uninstall", "-g", "--prefix", DIR, "@openai/codex"]);
  });

  it("reports an available update when npm view differs from the installed version", async () => {
    const { runner } = recordingRunner();
    const check = await checkAgentUpdate("claude-code", deps(runner));
    expect(check).toMatchObject({
      installed: true,
      currentVersion: "1.0.42",
      latestVersion: "1.0.55",
      updateAvailable: true,
    });
  });
});

describe("agents/updatePolicy", () => {
  const dirs: string[] = [];
  const makeDir = async (): Promise<string> => {
    const dir = await mkdtemp(join(tmpdir(), "24h-agents-"));
    dirs.push(dir);
    return dir;
  };
  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("fails closed to manual updates when the policy file is absent", async () => {
    const dir = await makeDir();
    const policies = await loadPolicies(dir);
    expect(policies["claude-code"]?.autoUpdate).toBe(false);
    expect(Object.values(policies).every((p) => p.autoUpdate === false)).toBe(true);
  });

  it("persists autoUpdate with 0600 and refuses unsafe agents", async () => {
    const dir = await makeDir();
    const policies = await setPolicy(dir, "claude-code", true);
    expect(policies["claude-code"]?.autoUpdate).toBe(true);
    const raw = JSON.parse(await readFile(policyPath(dir), "utf8")) as Record<string, unknown>;
    expect(raw["claude-code"]).toEqual({ autoUpdate: true });

    await expect(setPolicy(dir, "pi", true)).rejects.toMatchObject({
      code: "AGENT_NOT_SAFE_MANAGED",
    });
    await expect(setPolicy(dir, "nope", false)).rejects.toMatchObject({ code: "AGENT_UNKNOWN" });
  });
});
