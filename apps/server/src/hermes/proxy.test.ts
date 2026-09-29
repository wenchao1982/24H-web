import type { AddressInfo } from "node:net";
import WebSocket, { WebSocketServer, type RawData } from "ws";
import { afterEach, describe, expect, it } from "vitest";
import { createTestContext, loginAndGetCookies, type TestContext } from "../test/helpers";
import { startMockHermes, type MockHermes } from "../test/mockHermes";
import { clearHermesTokenCache } from "./client";
import { createUser } from "../users/repo";

let ctx: TestContext | undefined;
let upstream: MockHermes | undefined;
let wss: WebSocketServer | undefined;
const clients: WebSocket[] = [];
const upstreamSockets: WebSocket[] = [];

afterEach(async () => {
  for (const client of clients.splice(0)) {
    client.terminate();
  }
  for (const socket of upstreamSockets.splice(0)) {
    socket.terminate();
  }
  await new Promise<void>((resolve) => {
    if (!wss) {
      resolve();
      return;
    }
    wss.close(() => resolve());
  });
  wss = undefined;
  await ctx?.close();
  ctx = undefined;
  if (upstream) {
    clearHermesTokenCache(upstream.baseUrl);
  }
  await upstream?.close();
  upstream = undefined;
});

function nextMessage(ws: WebSocket, timeoutMs = 3000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("timed out waiting for a websocket message"));
    }, timeoutMs);
    const onMessage = (data: RawData) => {
      cleanup();
      resolve(data.toString());
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      clearTimeout(timer);
      ws.off("message", onMessage);
      ws.off("error", onError);
    };
    ws.on("message", onMessage);
    ws.on("error", onError);
  });
}

interface MessageQueue {
  next(timeoutMs?: number): Promise<string>;
}

/** Collect every inbound frame so we can assert order without a listener race. */
function messageQueue(ws: WebSocket): MessageQueue {
  const queued: string[] = [];
  const waiters: Array<{
    resolve: (value: string) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }> = [];
  ws.on("message", (data: RawData) => {
    const value = data.toString();
    const waiter = waiters.shift();
    if (waiter) {
      clearTimeout(waiter.timer);
      waiter.resolve(value);
    } else {
      queued.push(value);
    }
  });
  return {
    next(timeoutMs = 3000) {
      const value = queued.shift();
      if (value !== undefined) {
        return Promise.resolve(value);
      }
      return new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => {
          const index = waiters.findIndex((entry) => entry.timer === timer);
          if (index >= 0) {
            waiters.splice(index, 1);
          }
          reject(new Error("timed out waiting for a websocket message"));
        }, timeoutMs);
        waiters.push({ resolve, reject, timer });
      });
    },
  };
}

function waitForOpen(ws: WebSocket, timeoutMs = 3000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out waiting for open")), timeoutMs);
    ws.once("open", () => {
      clearTimeout(timer);
      resolve();
    });
    ws.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function wsAddress(app: TestContext["app"]): string {
  const address = app.server.address() as AddressInfo;
  return `ws://127.0.0.1:${address.port}`;
}

function startEchoUpstream(): { urls: string[]; frames: string[] } {
  const urls: string[] = [];
  const frames: string[] = [];
  wss = new WebSocketServer({ server: upstream!.server, path: "/api/ws" });
  wss.on("connection", (socket, request) => {
    upstreamSockets.push(socket);
    urls.push(request.url ?? "");
    socket.send("from-upstream");
    socket.on("message", (data) => {
      frames.push(data.toString());
      socket.send(`echo:${data.toString()}`);
    });
  });
  return { urls, frames };
}

describe("GET /api/hermes/ws", () => {
  it("authenticates with the session cookie and pipes frames both ways", async () => {
    upstream = await startMockHermes({ token: "ws-token-1" });
    ctx = await createTestContext({ hermesBaseUrl: upstream.baseUrl });
    const { session } = await loginAndGetCookies(ctx.app);
    await ctx.app.listen({ port: 0, host: "127.0.0.1" });

    const upstreamState = startEchoUpstream();

    const client = new WebSocket(`${wsAddress(ctx.app)}/api/hermes/ws`, {
      headers: { cookie: `24h_session=${session}` },
    });
    clients.push(client);
    const firstFrame = nextMessage(client);
    await waitForOpen(client);

    expect(await firstFrame).toBe("from-upstream");
    expect(upstreamState.urls[0]).toBe("/api/ws?token=ws-token-1");

    const request = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping", params: {} });
    client.send(request);
    expect(await nextMessage(client)).toBe(`echo:${request}`);
  });

  it("forwards a client frame sent before the upstream connects (cold-start race)", async () => {
    upstream = await startMockHermes({ token: "ws-race-token" });
    // Delay serving the session token so the upstream WebSocket is only opened
    // *after* the client has already sent its first frame.
    upstream.setHandler(({ request, res }) => {
      if (request.method === "GET" && request.path === "/") {
        setTimeout(() => {
          res.setHeader("content-type", "text/html");
          res.end(
            `<html><body><script>window.__HERMES_SESSION_TOKEN__="ws-race-token";</script></body></html>`,
          );
        }, 300);
        return true;
      }
      return false;
    });
    ctx = await createTestContext({ hermesBaseUrl: upstream.baseUrl });
    const { session } = await loginAndGetCookies(ctx.app);
    await ctx.app.listen({ port: 0, host: "127.0.0.1" });

    const upstreamState = startEchoUpstream();

    const client = new WebSocket(`${wsAddress(ctx.app)}/api/hermes/ws`, {
      headers: { cookie: `24h_session=${session}` },
    });
    clients.push(client);
    const messages = messageQueue(client);
    await waitForOpen(client);

    // Send immediately, without waiting for the upstream to connect.
    const request = JSON.stringify({ jsonrpc: "2.0", id: 7, method: "ping", params: {} });
    client.send(request);

    expect(await messages.next()).toBe("from-upstream");
    expect(await messages.next()).toBe(`echo:${request}`);
    expect(upstreamState.urls[0]).toBe("/api/ws?token=ws-race-token");
  });

  it("closes the connection when no session cookie is provided", async () => {
    upstream = await startMockHermes();
    ctx = await createTestContext({ hermesBaseUrl: upstream.baseUrl });
    await ctx.app.listen({ port: 0, host: "127.0.0.1" });

    const client = new WebSocket(`${wsAddress(ctx.app)}/api/hermes/ws`);
    clients.push(client);

    const outcome = await new Promise<string>((resolve) => {
      const done = (value: string) => resolve(value);
      client.once("open", () => done("open"));
      client.once("error", () => done("error"));
      client.once("unexpected-response", () => done("unexpected-response"));
      client.once("close", () => done("close"));
    });

    expect(outcome).not.toBe("open");
    expect(upstream.requests).toHaveLength(0);
  });
});

describe("profile guard over WS", () => {
  async function seedAdmin(profiles: string[]): Promise<{ session: string; csrf: string }> {
    const user = await createUser(ctx!.db, {
      username: "ws-admin",
      password: "ws-admin-password-123",
      role: "admin",
    });
    const insert = ctx!.db.prepare(
      "INSERT INTO user_profiles (user_id, profile_name, is_default, created_at) VALUES (?, ?, 1, ?)",
    );
    for (const profile of profiles) {
      insert.run(user.id, profile, Date.now());
    }
    return loginAndGetCookies(ctx!.app, "ws-admin", "ws-admin-password-123");
  }

  async function connect(
    session: string,
  ): Promise<{ client: WebSocket; messages: MessageQueue }> {
    const client = new WebSocket(`${wsAddress(ctx!.app)}/api/hermes/ws`, {
      headers: { cookie: `24h_session=${session}` },
    });
    clients.push(client);
    const messages = messageQueue(client);
    await waitForOpen(client);
    return { client, messages };
  }

  async function boot(
    token: string,
    seed: () => Promise<{ session: string; csrf: string }>,
  ): Promise<{ upstreamState: { urls: string[]; frames: string[] }; client: WebSocket; messages: MessageQueue }> {
    upstream = await startMockHermes({ token });
    ctx = await createTestContext({ hermesBaseUrl: upstream.baseUrl });
    const { session } = await seed();
    await ctx.app.listen({ port: 0, host: "127.0.0.1" });
    const upstreamState = startEchoUpstream();
    const { client, messages } = await connect(session);
    expect(await messages.next()).toBe("from-upstream");
    return { upstreamState, client, messages };
  }

  it("rejects a frame for an unassigned profile with the same id and never forwards it", async () => {
    const { upstreamState, client, messages } = await boot("ws-guard-token", () =>
      seedAdmin(["alpha"]),
    );

    const frame = JSON.stringify({
      jsonrpc: "2.0",
      id: 42,
      method: "session.create",
      params: { profile: "px" },
    });
    client.send(frame);

    const reply = JSON.parse(await messages.next());
    expect(reply.id).toBe(42);
    expect(reply.error.code).toBe(403);
    expect(reply.error.data.code).toBe("PROFILE_FORBIDDEN");
    expect(upstreamState.frames).toHaveLength(0);
  });

  it("forwards the same frame for a super_admin", async () => {
    const { upstreamState, client, messages } = await boot("ws-super-token", () =>
      loginAndGetCookies(ctx!.app),
    );

    const frame = JSON.stringify({
      jsonrpc: "2.0",
      id: 43,
      method: "session.create",
      params: { profile: "px" },
    });
    client.send(frame);

    expect(await messages.next()).toBe(`echo:${frame}`);
    expect(upstreamState.frames).toEqual([frame]);
  });

  it("injects the default profile for a non-exempt method", async () => {
    const { upstreamState, client, messages } = await boot("ws-inject-token", () =>
      seedAdmin(["alpha"]),
    );

    const frame = JSON.stringify({
      jsonrpc: "2.0",
      id: 44,
      method: "cron.manage",
      params: {},
    });
    client.send(frame);
    await messages.next();

    const forwarded = JSON.parse(upstreamState.frames[0]);
    expect(forwarded.params.profile).toBe("alpha");
  });

  it("does not inject for an exempt `_SessionScoped` method carrying a session_id (tools.list would 4000)", async () => {
    const { upstreamState, client, messages } = await boot("ws-exempt-token", () =>
      seedAdmin(["alpha"]),
    );

    const frame = JSON.stringify({
      jsonrpc: "2.0",
      id: 45,
      method: "tools.list",
      params: { session_id: "runtime:s1" },
    });
    client.send(frame);
    await messages.next();

    expect(upstreamState.frames[0]).not.toContain("profile");
    expect(JSON.parse(upstreamState.frames[0]).params.profile).toBeUndefined();
  });

  it("rejects `tools.list` without session_id (R24 fail-closed, never forwards)", async () => {
    const { upstreamState, client, messages } = await boot("ws-session-scoped-token", () =>
      seedAdmin(["alpha"]),
    );

    const frame = JSON.stringify({
      jsonrpc: "2.0",
      id: 46,
      method: "tools.list",
      params: {},
    });
    client.send(frame);
    const reply = await messages.next();

    expect(upstreamState.frames).toHaveLength(0);
    expect(reply).toContain("PROFILE_FORBIDDEN");
    expect(reply).toContain(String(46));
  });

  it("forwards a client response frame unchanged", async () => {
    const { upstreamState, client, messages } = await boot("ws-response-token", () =>
      seedAdmin(["alpha"]),
    );

    const frame = JSON.stringify({ id: 9, result: { choice: "once" } });
    client.send(frame);
    await messages.next();

    expect(upstreamState.frames[0]).toBe(frame);
    expect(JSON.parse(upstreamState.frames[0])).toEqual({ id: 9, result: { choice: "once" } });
  });
});
