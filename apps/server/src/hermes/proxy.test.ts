import type { AddressInfo } from "node:net";
import WebSocket, { WebSocketServer, type RawData } from "ws";
import { afterEach, describe, expect, it } from "vitest";
import { createTestContext, loginAndGetCookies, type TestContext } from "../test/helpers";
import { startMockHermes, type MockHermes } from "../test/mockHermes";
import { clearHermesTokenCache } from "./client";

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

function startEchoUpstream(): { urls: string[] } {
  const urls: string[] = [];
  wss = new WebSocketServer({ server: upstream!.server, path: "/api/ws" });
  wss.on("connection", (socket, request) => {
    upstreamSockets.push(socket);
    urls.push(request.url ?? "");
    socket.send("from-upstream");
    socket.on("message", (data) => {
      socket.send(`echo:${data.toString()}`);
    });
  });
  return { urls };
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

    client.send("from-client");
    expect(await nextMessage(client)).toBe("echo:from-client");
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
