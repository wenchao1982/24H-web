import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestContext, loginAndGetCookies, type TestContext } from "../test/helpers";

let ctx: TestContext | undefined;
let skillsDir: string;
let workspaceDir: string;

function writeSkill(root: string, id: string, manifest: unknown, files: Record<string, string>): void {
  const ui = join(root, id, "ui");
  mkdirSync(ui, { recursive: true });
  writeFileSync(join(ui, "manifest.json"), JSON.stringify(manifest));
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(ui, name), content);
  }
}

beforeEach(async () => {
  skillsDir = mkdtempSync(join(tmpdir(), "skillui-skills-"));
  workspaceDir = mkdtempSync(join(tmpdir(), "skillui-ws-"));

  writeSkill(
    skillsDir,
    "hello-ui",
    {
      protocol: "24os-skill-ui/1",
      id: "hello-ui",
      title: "Hello UI",
      entry: "index.html",
      host: "iframe",
      capabilities: ["callModel", "notify"],
      permissions: ["model:call"],
    },
    {
      "index.html": "<!doctype html><title>hi</title><script src=\"main.js\"></script>",
      "main.js": "console.log('hi')",
    },
  );

  writeSkill(
    skillsDir,
    "bad-protocol",
    { protocol: "unknown/9", id: "bad-protocol", title: "x", entry: "index.html", host: "iframe", capabilities: [], permissions: [] },
    { "index.html": "<!doctype html>" },
  );

  ctx = await createTestContext({
    skillHost: {
      roots: [skillsDir],
      workspaceRoot: workspaceDir,
      callModel: async ({ prompt }) => ({ text: `echo:${prompt}`, via: "stub" }),
    },
  });
});

afterEach(async () => {
  await ctx?.close();
  ctx = undefined;
  rmSync(skillsDir, { recursive: true, force: true });
  rmSync(workspaceDir, { recursive: true, force: true });
});

describe("GET /api/skill-uis", () => {
  it("discovers skills that ship a ui/manifest.json and ignores invalid protocols", async () => {
    const { session } = await loginAndGetCookies(ctx!.app);

    const res = await ctx!.app.inject({
      method: "GET",
      url: "/api/skill-uis",
      cookies: { "24h_session": session },
    });

    expect(res.statusCode).toBe(200);
    const skills = res.json().skills as { id: string; capabilities: string[] }[];
    expect(skills.map((s) => s.id)).toEqual(["hello-ui"]);
    expect(skills[0].capabilities).toEqual(["callModel", "notify"]);
  });

  it("rejects unauthenticated access with 401", async () => {
    const res = await ctx!.app.inject({ method: "GET", url: "/api/skill-uis" });
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /skill-ui/:id/*", () => {
  it("serves manifest assets with CSP and nosniff", async () => {
    const res = await ctx!.app.inject({ method: "GET", url: "/skill-ui/hello-ui/index.html" });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(String(res.headers["content-security-policy"])).toContain("default-src 'none'");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("rejects path traversal outside the ui root", async () => {
    const res = await ctx!.app.inject({
      method: "GET",
      url: "/skill-ui/hello-ui/..%2f..%2f..%2fpackage.json",
    });

    expect(res.statusCode).toBe(404);
  });

  it("rejects disallowed extensions", async () => {
    const res = await ctx!.app.inject({ method: "GET", url: "/skill-ui/hello-ui/main.js.bak" });
    expect(res.statusCode).toBe(404);
  });

  it("returns 404 for an unknown skill", async () => {
    const res = await ctx!.app.inject({ method: "GET", url: "/skill-ui/nope/index.html" });
    expect(res.statusCode).toBe(404);
  });
});

describe("POST /api/skill-host/invoke", () => {
  it("rejects a capability not declared in the manifest with 403", async () => {
    const { session, csrf } = await loginAndGetCookies(ctx!.app);

    const res = await ctx!.app.inject({
      method: "POST",
      url: "/api/skill-host/invoke",
      cookies: { "24h_session": session, "24h_csrf": csrf },
      headers: { "x-csrf-token": csrf },
      payload: { skillId: "hello-ui", method: "readFile", params: { path: "a.txt" } },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("FORBIDDEN");
  });

  it("rejects a method outside the host whitelist with 403", async () => {
    const { session, csrf } = await loginAndGetCookies(ctx!.app);

    const res = await ctx!.app.inject({
      method: "POST",
      url: "/api/skill-host/invoke",
      cookies: { "24h_session": session, "24h_csrf": csrf },
      headers: { "x-csrf-token": csrf },
      payload: { skillId: "hello-ui", method: "runTool", params: {} },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("FORBIDDEN");
  });

  it("runs a declared notify capability", async () => {
    const { session, csrf } = await loginAndGetCookies(ctx!.app);

    const res = await ctx!.app.inject({
      method: "POST",
      url: "/api/skill-host/invoke",
      cookies: { "24h_session": session, "24h_csrf": csrf },
      headers: { "x-csrf-token": csrf },
      payload: { skillId: "hello-ui", method: "notify", params: { message: "hi" } },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, result: { ok: true } });
  });

  it("brokers callModel through the injected adapter", async () => {
    const { session, csrf } = await loginAndGetCookies(ctx!.app);

    const res = await ctx!.app.inject({
      method: "POST",
      url: "/api/skill-host/invoke",
      cookies: { "24h_session": session, "24h_csrf": csrf },
      headers: { "x-csrf-token": csrf },
      payload: { skillId: "hello-ui", method: "callModel", params: { prompt: "hi" } },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, result: { text: "echo:hi", via: "stub" } });
  });
});

describe("resolveSkillAsset (direct)", () => {
  it("keeps reads inside the ui root", async () => {
    const { resolveSkillAsset } = await import("../skillui/discover");
    const uiRoot = join(skillsDir, "hello-ui", "ui");
    expect(resolveSkillAsset(uiRoot, "main.js")?.contentType).toContain("text/javascript");
    expect(resolveSkillAsset(uiRoot, "../index.html")).toBeNull();
    expect(resolveSkillAsset(uiRoot, "main.js.bak")).toBeNull();
  });
});
