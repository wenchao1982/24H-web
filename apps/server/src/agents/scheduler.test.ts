import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDb, type Db } from "../db";
import { migrate } from "../db/migrate";
import { AgentScheduler } from "./scheduler";
import { setPolicy } from "./updatePolicy";
import type { CommandRunner } from "./runner";
import type { AgentsDeps } from "./registry";

function makeRunner(): { runner: CommandRunner; calls: string[][] } {
  const calls: string[][] = [];
  const runner: CommandRunner = async (cmd, args) => {
    calls.push([cmd, ...args]);
    if (cmd === "claude") return { ok: true, code: 0, stdout: "1.0.42", stderr: "" };
    if (cmd === "npm" && args[0] === "view") return { ok: true, code: 0, stdout: "1.0.55", stderr: "" };
    if (cmd === "npm") return { ok: true, code: 0, stdout: "", stderr: "" };
    return { ok: false, code: 1, stdout: "", stderr: "not found" };
  };
  return { runner, calls };
}

describe("AgentScheduler", () => {
  const dirs: string[] = [];
  const dbs: Db[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
    for (const db of dbs.splice(0)) {
      db.close();
    }
  });

  function setup(): { dir: string; db: Db; deps: AgentsDeps; calls: string[][] } {
    const dir = mkdtempSync(join(tmpdir(), "24h-sched-"));
    dirs.push(dir);
    const db = openDb(join(dir, "s.db"));
    migrate(db);
    dbs.push(db);
    const { runner, calls } = makeRunner();
    const deps: AgentsDeps = { managedDir: join(dir, "agents"), managedBin: join(dir, "agents", "bin"), runner };
    return { dir, db, deps, calls };
  }

  it("does nothing when auto-update is off", async () => {
    const { dir, db, deps, calls } = setup();
    const scheduler = new AgentScheduler({ db, agentsDir: deps.managedDir, stateDir: dir, deps, now: () => 0 });
    await scheduler.tick();
    expect(calls).toHaveLength(0);
  });

  it("waits for the idle window before auto-installing an available update", async () => {
    const { dir, db, deps, calls } = setup();
    await setPolicy(dir, "claude-code", true);
    let now = 0;
    const scheduler = new AgentScheduler({
      db,
      agentsDir: deps.managedDir,
      stateDir: dir,
      deps,
      now: () => now,
    });

    await scheduler.tick(); // 检测到可用，开始计时；尚未安装
    expect(calls.some((call) => call[0] === "npm" && call[1] === "install")).toBe(false);

    now = 30_000;
    await scheduler.tick(); // 空闲不足 60s → 不安装
    expect(calls.some((call) => call[0] === "npm" && call[1] === "install")).toBe(false);

    now = 61_000;
    await scheduler.tick(); // 空闲达标 → 安装
    expect(calls.some((call) => call[0] === "npm" && call[1] === "install")).toBe(true);

    const audit = db
      .prepare("SELECT action, target_id FROM audit WHERE action = ?")
      .all("agents.auto_update") as { action: string; target_id: string }[];
    expect(audit).toEqual([{ action: "agents.auto_update", target_id: "claude-code" }]);
  });
});
