import type { AddressInfo } from "node:net";
import WebSocket, { WebSocketServer, type RawData } from "ws";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestContext, loginAndGetCookies, type TestContext } from "../test/helpers";
import { startMockHermes, type MockHermes } from "../test/mockHermes";
import { clearHermesTokenCache } from "./client";
import {
  WS_MAX_PAYLOAD,
  WS_MAX_PENDING_BYTES,
  WS_MAX_PENDING_COUNT,
  WS_QUEUE_FACTOR,
} from "./proxy";
import { createUser } from "../users/repo";

/**
 * REQ-018 / REQ-018b / REQ-023 端到端「真实体量」测试：经 BFF WS 代理，用 mock 上游
 * （无需真 Hermes）。每个用例都会用实测字节数与耗时上报，不预设行为。
 *
 * 关键常量（与 `proxy.ts` 对齐，直接从模块导入避免漂移）：
 * - `WS_MAX_PAYLOAD = 16 MiB`（客户端接入侧 + 上游侧两个 socket）
 * - `WS_MAX_PENDING_COUNT = 256`（队列**条数**上限；独立于字节预算）
 * - `WS_QUEUE_FACTOR = 4`（仅字节系数）
 * - `WS_MAX_PENDING_BYTES = WS_QUEUE_FACTOR × WS_MAX_PAYLOAD = 64 MiB`（**字节**上限）
 */

const MIB = 1024 * 1024;
const MAX_PAYLOAD = WS_MAX_PAYLOAD;
const MAX_PENDING_BYTES = WS_MAX_PENDING_BYTES;
const MAX_PENDING_COUNT = WS_MAX_PENDING_COUNT;
const TEST_TIMEOUT_MS = 30_000;

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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate: () => boolean, label: string, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`timed out waiting for ${label}`);
    }
    await delay(10);
  }
}

function wsAddress(app: TestContext["app"]): string {
  const address = app.server.address() as AddressInfo;
  return `ws://127.0.0.1:${address.port}`;
}

function waitForOpen(ws: WebSocket, timeoutMs = 5000): Promise<void> {
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

function waitForClose(ws: WebSocket, timeoutMs = 15000): Promise<{ code: number; reason: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out waiting for close")), timeoutMs);
    ws.once("close", (code, reason) => {
      clearTimeout(timer);
      resolve({ code, reason: reason.toString() });
    });
  });
}

interface MessageQueue {
  next(timeoutMs?: number): Promise<string>;
}

/** Collect inbound frames so assertions never race the listener. */
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

interface ConnectedClient {
  client: WebSocket;
  messages: MessageQueue;
  received: string[];
}

async function connect(session: string): Promise<ConnectedClient> {
  const client = new WebSocket(`${wsAddress(ctx!.app)}/api/hermes/ws`, {
    headers: { cookie: `24h_session=${session}` },
  });
  clients.push(client);
  client.on("error", () => {
    // Keep an error listener attached so a mid-test socket error cannot crash the runner.
  });
  const received: string[] = [];
  client.on("message", (data: RawData) => received.push(data.toString()));
  const messages = messageQueue(client);
  await waitForOpen(client);
  return { client, messages, received };
}

interface RecordingUpstream {
  urls: string[];
  frames: string[];
  connected: Promise<void>;
}

/** Upstream that records inbound frames (no echo) and signals when the bridge connects. */
function startRecordingUpstream(): RecordingUpstream {
  const urls: string[] = [];
  const frames: string[] = [];
  let release: () => void = () => {};
  const connected = new Promise<void>((resolve) => {
    release = resolve;
  });
  wss = new WebSocketServer({ server: upstream!.server, path: "/api/ws" });
  wss.on("connection", (socket, request) => {
    upstreamSockets.push(socket);
    urls.push(request.url ?? "");
    release();
    socket.on("message", (data: RawData) => {
      frames.push(data.toString());
    });
  });
  return { urls, frames, connected };
}

const PNG_MAGIC = Buffer.from("89504e470d0a1a0a", "hex");

/** Valid PNG magic + zero padding, base64-encoded to the requested raw size. */
function buildPngBase64(rawBytes: number): string {
  const raw = Buffer.alloc(rawBytes, 0);
  PNG_MAGIC.copy(raw, 0);
  return raw.toString("base64");
}

function buildImageFrame(id: number, base64: string): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    id,
    method: "image.attach_bytes",
    params: { content_base64: base64, filename: "large.png" },
  });
}

function buildBulkFrame(id: number, padChars: number): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    id,
    method: "cron.manage",
    params: { pad: "A".repeat(padChars) },
  });
}

/** Build a `cron.manage` frame whose UTF-8 frame length is exactly `targetBytes` (ASCII padding). */
function buildBulkFrameExactSize(id: number, targetBytes: number): string {
  const overhead = Buffer.byteLength(
    JSON.stringify({ jsonrpc: "2.0", id, method: "cron.manage", params: { pad: "" } }),
  );
  const padChars = targetBytes - overhead;
  if (padChars < 0) {
    throw new Error("targetBytes too small for the frame envelope");
  }
  return JSON.stringify({
    jsonrpc: "2.0",
    id,
    method: "cron.manage",
    params: { pad: "A".repeat(padChars) },
  });
}

describe("WS proxy large payload (REQ-018 / REQ-018b / REQ-023)", () => {
  it("pins the queue limits: byte budget = WS_QUEUE_FACTOR × maxPayload, count independent", () => {
    expect(MAX_PENDING_BYTES).toBe(WS_QUEUE_FACTOR * MAX_PAYLOAD);
    expect(MAX_PENDING_COUNT).toBe(256);
    expect(MAX_PENDING_COUNT).not.toBe(WS_QUEUE_FACTOR);
  });

  it(
    "forwards a ~13.3MB PNG attachment frame within the 16 MiB maxPayload window",
    async () => {
      upstream = await startMockHermes({ token: "ws-large-ok-token" });
      ctx = await createTestContext({ hermesBaseUrl: upstream.baseUrl });
      const { session } = await seedAdmin(["alpha"]);
      await ctx.app.listen({ port: 0, host: "127.0.0.1" });
      const up = startRecordingUpstream();
      const { client } = await connect(session);
      await up.connected;

      // 10 MiB raw bytes -> ~13.33 MiB base64 string.
      let payload: string = buildPngBase64(10 * MIB);
      const frame: string = buildImageFrame(1, payload);
      const frameBytes = Buffer.byteLength(frame);
      expect(frameBytes).toBeGreaterThan(13 * MIB);
      expect(frameBytes).toBeLessThan(MAX_PAYLOAD);

      const started = performance.now();
      client.send(frame);
      await waitFor(() => up.frames.length === 1, "upstream to receive the large frame", 15000);
      const elapsedMs = performance.now() - started;

      const forwarded = JSON.parse(up.frames[0]) as {
        params: { content_base64: string; profile?: string };
      };
      const forwardedBytes = Buffer.byteLength(up.frames[0]);
      expect(forwarded.params.content_base64.length).toBe(payload.length);
      expect(forwarded.params.profile).toBe("alpha");
      expect(up.urls).toHaveLength(1);

      console.log(
        `[largePayload] case1 frame=${frameBytes}B payload=${payload.length}B forwarded=${forwardedBytes}B elapsed=${elapsedMs.toFixed(1)}ms`,
      );

      // Release the large buffers immediately.
      payload = "";
      up.frames.length = 0;
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "rejects a frame larger than maxPayload and never forwards it",
    async () => {
      upstream = await startMockHermes({ token: "ws-oversize-token" });
      ctx = await createTestContext({ hermesBaseUrl: upstream.baseUrl });
      const { session } = await seedAdmin(["alpha"]);
      await ctx.app.listen({ port: 0, host: "127.0.0.1" });
      const up = startRecordingUpstream();
      const { client, received } = await connect(session);
      await up.connected;

      const frame = JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "ping",
        params: { pad: "A".repeat(MAX_PAYLOAD + 4096) },
      });
      const frameBytes = Buffer.byteLength(frame);
      expect(frameBytes).toBeGreaterThan(MAX_PAYLOAD);

      const started = performance.now();
      const closed = waitForClose(client, 15000);
      client.send(frame);
      const info = await closed;
      const elapsedMs = performance.now() - started;
      await delay(100);

      expect(up.frames).toHaveLength(0);

      console.log(
        `[largePayload] case2 frame=${frameBytes}B close=${info.code}${
          info.reason ? ` reason=${info.reason}` : ""
        } messages=${received.length} elapsed=${elapsedMs.toFixed(1)}ms`,
      );

      // `ws` rejects an over-maxPayload message with close code 1009 (message too big).
      expect(info.code).toBe(1009);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "enforces the pending queue COUNT limit with many small frames (REQ-018b)",
    async () => {
      upstream = await startMockHermes({ token: "ws-queue-count-token" });
      let tokenRequested = false;
      // Hang the token fetch: the bridge never opens the upstream socket, so every
      // guarded frame accumulates in the in-memory `pending` queue.
      upstream.setHandler(({ request }) => {
        if (request.method === "GET" && request.path === "/") {
          tokenRequested = true;
          return true;
        }
        return false;
      });
      ctx = await createTestContext({ hermesBaseUrl: upstream.baseUrl });
      const { session } = await seedAdmin(["alpha"]);
      await ctx.app.listen({ port: 0, host: "127.0.0.1" });
      const { client, messages } = await connect(session);
      await waitFor(() => tokenRequested, "the token fetch to hang", 5000);

      // Small injected frames: the count limit (256) must trip before the byte budget.
      const perFrame = buildBulkFrame(1, 64);
      const frameBytes = Buffer.byteLength(perFrame);
      expect(frameBytes).toBeLessThan(1024);

      const closed = waitForClose(client, 20000);
      let sawClose = false;
      void closed.then(() => {
        sawClose = true;
      });

      const started = performance.now();
      let sent = 0;
      let attemptedBytes = 0;
      // Attempt well past the count limit; the loop stops when the connection closes.
      for (let i = 0; i < MAX_PENDING_COUNT + 40; i += 1) {
        if (client.readyState !== WebSocket.OPEN || sawClose) {
          break;
        }
        client.send(perFrame);
        sent += 1;
        attemptedBytes += frameBytes;
        await delay(10);
      }

      const info = await closed;
      const elapsedMs = performance.now() - started;
      const overflow = JSON.parse(await messages.next(5000));

      // The (WS_MAX_PENDING_COUNT + 1)-th frame trips the count limit.
      expect(sent).toBe(MAX_PENDING_COUNT + 1);
      // Count, not bytes: attempted bytes stay far below the byte budget.
      expect(attemptedBytes).toBeLessThan(MAX_PENDING_BYTES);
      expect(info.code).toBe(1013);
      expect(info.reason).toBe("QUEUE_OVERFLOW");
      expect(overflow.error.data.code).toBe("INVALID_FRAME");

      console.log(
        `[largePayload] case3a countLimit=${MAX_PENDING_COUNT} frame=${frameBytes}B sent=${sent} attempted=${attemptedBytes}B (${(
          attemptedBytes / MIB
        ).toFixed(3)}MiB) byteBudget=${MAX_PENDING_BYTES}B close=${info.code}/${info.reason} elapsed=${elapsedMs.toFixed(
          1,
        )}ms`,
      );
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "accepts 5 small frames during a cold start (count-limit regression guard)",
    async () => {
      upstream = await startMockHermes({ token: "ws-cold-start-token" });
      let tokenRequested = false;
      upstream.setHandler(({ request }) => {
        if (request.method === "GET" && request.path === "/") {
          tokenRequested = true;
          return true;
        }
        return false;
      });
      ctx = await createTestContext({ hermesBaseUrl: upstream.baseUrl });
      const { session } = await seedAdmin(["alpha"]);
      await ctx.app.listen({ port: 0, host: "127.0.0.1" });
      const { client, received } = await connect(session);
      await waitFor(() => tokenRequested, "the token fetch to hang", 5000);

      const started = performance.now();
      const frames: string[] = [];
      for (let i = 0; i < 5; i += 1) {
        const frame = buildBulkFrame(100 + i, 64);
        frames.push(frame);
        client.send(frame);
        await delay(20);
      }
      await delay(400);
      const elapsedMs = performance.now() - started;

      // Old behaviour (WS_QUEUE_FACTOR reused as count limit) rejected the 5th frame.
      expect(client.readyState).toBe(WebSocket.OPEN);
      expect(received).toHaveLength(0);

      console.log(
        `[largePayload] case3c coldStart frames=${frames.length} accepted=${frames.length} frameBytes=${Buffer.byteLength(
          frames[0],
        )}B received=${received.length} stillOpen=${client.readyState === WebSocket.OPEN} elapsed=${elapsedMs.toFixed(
          1,
        )}ms`,
      );
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "enforces the byte budget (REQ-018b) on the 4th large frame, far below the count limit",
    async () => {
      upstream = await startMockHermes({ token: "ws-byte-budget-token" });
      let tokenRequested = false;
      upstream.setHandler(({ request }) => {
        if (request.method === "GET" && request.path === "/") {
          tokenRequested = true;
          return true;
        }
        return false;
      });
      ctx = await createTestContext({ hermesBaseUrl: upstream.baseUrl });
      // A long profile name maximises the bytes the guard appends on injection, so
      // four near-maxPayload frames exceed the 64 MiB byte budget while the count
      // limit (256) is nowhere near. With short names the byte limit still wins here.
      const longProfile = "p".repeat(2000);
      const { session } = await seedAdmin([longProfile]);
      await ctx.app.listen({ port: 0, host: "127.0.0.1" });
      const { client, messages } = await connect(session);
      await waitFor(() => tokenRequested, "the token fetch to hang", 5000);

      const targetBytes = MAX_PAYLOAD - 1024;
      const perFrame = buildBulkFrameExactSize(1, targetBytes);
      const frameBytes = Buffer.byteLength(perFrame);
      expect(frameBytes).toBe(targetBytes);
      // Guarded (injected) size per frame = frame + `,"profile":"<name>"`.
      const guardedFrameBytes = frameBytes + longProfile.length + 12;
      expect(guardedFrameBytes * 3).toBeLessThanOrEqual(MAX_PENDING_BYTES);
      expect(guardedFrameBytes * 4).toBeGreaterThan(MAX_PENDING_BYTES);
      expect(4).toBeLessThan(MAX_PENDING_COUNT);

      const closed = waitForClose(client, 20000);
      let sawClose = false;
      void closed.then(() => {
        sawClose = true;
      });

      const started = performance.now();
      let sent = 0;
      let attemptedBytes = 0;
      for (let i = 0; i < 6; i += 1) {
        if (client.readyState !== WebSocket.OPEN || sawClose) {
          break;
        }
        client.send(perFrame);
        sent += 1;
        attemptedBytes += frameBytes;
        await delay(300);
      }

      const info = await closed;
      const elapsedMs = performance.now() - started;
      const overflow = JSON.parse(await messages.next(5000));

      // The 4th frame must be the byte-budget trigger (count limit would allow 256).
      expect(sent).toBe(4);
      expect(info.code).toBe(1013);
      expect(info.reason).toBe("QUEUE_OVERFLOW");
      expect(overflow.error.data.code).toBe("INVALID_FRAME");

      console.log(
        `[largePayload] case3b frame=${frameBytes}B guarded≈${guardedFrameBytes}B sent=${sent} attempted=${attemptedBytes}B byteBudget=${MAX_PENDING_BYTES}B countLimit=${MAX_PENDING_COUNT} close=${info.code}/${info.reason} elapsed=${elapsedMs.toFixed(
          1,
        )}ms`,
      );
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "rejects a 13MB non-image payload at real volume without full-frame decoding (REQ-023)",
    async () => {
      upstream = await startMockHermes({ token: "ws-attach-large-bad-token" });
      ctx = await createTestContext({ hermesBaseUrl: upstream.baseUrl });
      const { session } = await seedAdmin(["alpha"]);
      await ctx.app.listen({ port: 0, host: "127.0.0.1" });
      const up = startRecordingUpstream();
      const { client, messages } = await connect(session);
      await up.connected;

      const payload = "A".repeat(13 * MIB);
      const frame = buildImageFrame(4, payload);
      const frameBytes = Buffer.byteLength(frame);

      const spy = vi.spyOn(Buffer, "from");
      let reply: { error?: { data?: { code?: string } } } | undefined;
      let elapsedMs = 0;
      let maxBase64Arg = 0;
      let base64Calls = 0;
      try {
        const started = performance.now();
        client.send(frame);
        reply = JSON.parse(await messages.next(15000)) as {
          error?: { data?: { code?: string } };
        };
        elapsedMs = performance.now() - started;

        const calls = spy.mock.calls as unknown as unknown[][];
        const base64ArgLengths = calls
          .filter((call) => typeof call[0] === "string" && call[1] === "base64")
          .map((call) => (call[0] as string).length);
        base64Calls = base64ArgLengths.length;
        maxBase64Arg = base64ArgLengths.reduce((max, value) => Math.max(max, value), 0);
      } finally {
        spy.mockRestore();
      }

      expect(reply?.error?.data?.code).toBe("INVALID_ATTACHMENT_TYPE");
      expect(up.frames).toHaveLength(0);
      // Only a <=48-char base64 prefix is ever decoded; the 13 MiB body is not.
      expect(base64Calls).toBeGreaterThan(0);
      expect(maxBase64Arg).toBeLessThanOrEqual(48);

      console.log(
        `[largePayload] case4 frame=${frameBytes}B payload=${payload.length}B base64Calls=${base64Calls} maxDecodedChars=${maxBase64Arg} (<=48) elapsed=${elapsedMs.toFixed(
          1,
        )}ms`,
      );
    },
    TEST_TIMEOUT_MS,
  );
});
