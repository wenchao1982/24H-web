import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createTestContext, loginAndGetCookies, type TestContext } from "../test/helpers";
import type { CommandRunner } from "./runner";

function makeRunner(): { runner: CommandRunner; calls: string[][] } {
  const calls: string[][] = [];
  const runner: CommandRunner = async (cmd, args) => {
    calls.push([cmd, ...args]);
    if (cmd === "claude") {
      return { ok: true, code: 0, stdout: "1.0.42", stderr: "" };
    }
    if (cmd === "npm" && args[0] === "view") {
      return { ok: true, code: 0, stdout: "1.0.55", stderr: "" };
    }
    if (cmd === "npm") {
      return { ok: true, code: 0, stdout: "", stderr: "" };
    }
    return { ok: false, code: 1, stdout: "", stderr: "not found" };
  };
  return { runner, calls };
}

describe("agents routes (M22)", () => {
  let ctx: TestContext | null = null;
  const dirs: string[] = [];
  afterEach(async () => {
    if (ctx) {
      await ctx.close();
      ctx = null;
    }
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  async function setup(runner: CommandRunner): Promise<string> {
    const dir = mkdtempSync(join(tmpdir(), "24h-agents-"));
    dirs.push(dir);
    ctx = await createTestContext({ agentsRunner: runner, agentsDir: dir, stateDir: dir });
    return dir;
  }

  it("requires authentication", async () => {
    const { runner } = makeRunner();
    await setup(runner);
    const res = await ctx!.app.inject({ method: "GET", url: "/api/agents" });
    expect(res.statusCode).toBe(401);
  });

  it("lists agents (with installable flags) for an authenticated user", async () => {
    const { runner } = makeRunner();
    await setup(runner);
    const { session, csrf } = await loginAndGetCookies(ctx!.app);
    const res = await ctx!.app.inject({
      method: "GET",
      url: "/api/agents",
      cookies: { "24h_session": session, "24h_csrf": csrf },
    });
    expect(res.statusCode).toBe(200);
    const agents = res.json().agents as { id: string; installable: boolean }[];
    expect(agents.find((agent) => agent.id === "claude-code")).toMatchObject({
      installable: true,
    });
    expect(agents.find((agent) => agent.id === "pi")).toMatchObject({ installable: false });
  });

  it("installs as super_admin, writes audit, and refuses non-installable agents", async () => {
    const { runner, calls } = makeRunner();
    await setup(runner);
    const { session, csrf } = await loginAndGetCookies(ctx!.app);
    const headers = { "x-csrf-token": csrf };
    const cookies = { "24h_session": session, "24h_csrf": csrf };

    const install = await ctx!.app.inject({
      method: "POST",
      url: "/api/agents/claude-code/install",
      cookies,
      headers,
    });
    expect(install.statusCode).toBe(200);
    expect(install.json()).toMatchObject({ installed: true, version: "1.0.42" });
    expect(calls.some((call) => call[0] === "npm" && call[1] === "install")).toBe(true);

    const audit = ctx!.db
      .prepare("SELECT action, target_id FROM audit WHERE action = ?")
      .all("agents.install") as { action: string; target_id: string }[];
    expect(audit).toEqual([{ action: "agents.install", target_id: "claude-code" }]);

    const pi = await ctx!.app.inject({
      method: "POST",
      url: "/api/agents/pi/install",
      cookies,
      headers,
    });
    expect(pi.statusCode).toBe(400);
    expect(pi.json().error).toBe("AGENT_NOT_INSTALLABLE");
  });

  it("manages update policy and rejects unsafe agents", async () => {
    const { runner } = makeRunner();
    await setup(runner);
    const { session, csrf } = await loginAndGetCookies(ctx!.app);
    const headers = { "x-csrf-token": csrf };
    const cookies = { "24h_session": session, "24h_csrf": csrf };

    const enable = await ctx!.app.inject({
      method: "PUT",
      url: "/api/agents/claude-code/update-policy",
      cookies,
      headers,
      payload: { enabled: true },
    });
    expect(enable.statusCode).toBe(200);
    expect(enable.json().policies["claude-code"]).toEqual({ autoUpdate: true });

    const unsafe = await ctx!.app.inject({
      method: "PUT",
      url: "/api/agents/pi/update-policy",
      cookies,
      headers,
      payload: { enabled: true },
    });
    expect(unsafe.statusCode).toBe(400);
    expect(unsafe.json().error).toBe("AGENT_NOT_SAFE_MANAGED");
  });

  it("checks updates and uninstalls", async () => {
    const { runner } = makeRunner();
    await setup(runner);
    const { session, csrf } = await loginAndGetCookies(ctx!.app);
    const headers = { "x-csrf-token": csrf };
    const cookies = { "24h_session": session, "24h_csrf": csrf };

    const check = await ctx!.app.inject({
      method: "POST",
      url: "/api/agents/claude-code/check-update",
      cookies,
      headers,
    });
    expect(check.statusCode).toBe(200);
    expect(check.json()).toMatchObject({ updateAvailable: true, latestVersion: "1.0.55" });

    const remove = await ctx!.app.inject({
      method: "DELETE",
      url: "/api/agents/claude-code",
      cookies,
      headers,
    });
    expect(remove.statusCode).toBe(200);
  });
});
