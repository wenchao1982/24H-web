import { afterEach, describe, expect, it } from "vitest";
import {
  createTestContext,
  loginAndGetCookies,
  type TestContext,
} from "../test/helpers";
import { parseAuthStatus, type GhRunner } from "../integrations/github";

let ctx: TestContext | undefined;

afterEach(async () => {
  await ctx?.close();
  ctx = undefined;
});

function makeRunner(state: { connected: boolean; logins: string[] }): GhRunner {
  return async (args, input) => {
    if (args[0] === "auth" && args[1] === "status") {
      return state.connected
        ? {
            ok: true,
            code: 0,
            stdout: "Logged in to github.com account octocat (keyring)",
            stderr: "",
          }
        : { ok: false, code: 1, stdout: "", stderr: "You are not logged in" };
    }
    if (args[0] === "auth" && args[1] === "login") {
      state.logins.push(input ?? "");
      state.connected = true;
      return { ok: true, code: 0, stdout: "", stderr: "" };
    }
    return { ok: false, code: 1, stdout: "", stderr: "" };
  };
}

describe("parseAuthStatus", () => {
  it("extracts the account from gh output", () => {
    expect(parseAuthStatus("Logged in to github.com account octocat (keyring)", "")).toEqual({
      connected: true,
      username: "octocat",
    });
    expect(parseAuthStatus("", "You are not logged in")).toEqual({
      connected: false,
      username: null,
    });
  });
});

describe("GET /api/integrations/github", () => {
  it("reports the gh auth status without exposing a token", async () => {
    const state = { connected: false, logins: [] as string[] };
    ctx = await createTestContext({ githubRunner: makeRunner(state) });
    const { session } = await loginAndGetCookies(ctx.app);

    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/integrations/github",
      cookies: { "24h_session": session },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ connected: false, username: null });
  });

  it("requires authentication", async () => {
    ctx = await createTestContext({ githubRunner: makeRunner({ connected: false, logins: [] }) });
    const res = await ctx.app.inject({ method: "GET", url: "/api/integrations/github" });
    expect(res.statusCode).toBe(401);
  });
});

describe("POST /api/integrations/github", () => {
  it("connects with a token via gh auth login --with-token", async () => {
    const state = { connected: false, logins: [] as string[] };
    ctx = await createTestContext({ githubRunner: makeRunner(state) });
    const { session, csrf } = await loginAndGetCookies(ctx.app);

    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/integrations/github",
      cookies: { "24h_session": session, "24h_csrf": csrf },
      headers: { "x-csrf-token": csrf },
      payload: { action: "connect", token: "ghp_secret" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ connected: true, username: "octocat" });
    expect(state.logins).toEqual(["ghp_secret"]);
  });

  it("rejects an empty token with 400", async () => {
    ctx = await createTestContext({ githubRunner: makeRunner({ connected: false, logins: [] }) });
    const { session, csrf } = await loginAndGetCookies(ctx.app);

    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/integrations/github",
      cookies: { "24h_session": session, "24h_csrf": csrf },
      headers: { "x-csrf-token": csrf },
      payload: { action: "connect", token: "  " },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("INVALID_INPUT");
  });
});
