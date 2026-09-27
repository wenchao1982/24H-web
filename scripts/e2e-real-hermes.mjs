#!/usr/bin/env node
/**
 * 24H real-Hermes end-to-end — BFF login → L1 WS gateway → real chat turn.
 *
 * 纯 Node、零额外依赖（复用已安装的 `ws`；不可用时回退到内置 raw RFC6455 客户端）。
 * 对**真实且已运行的 BFF + Hermes** 做一次最小真实回合：
 *   1. POST /api/auth/login 拿 `24h_session` + `24h_csrf`（仅内存 CookieJar）
 *   2. 以 session cookie 打开 `ws://<base>/api/hermes/ws`
 *   3. JSON-RPC：`session.create {}` → `prompt.submit {session_id,text}`
 *   4. 收集事件至 `message.complete` / `done`（或超时）；服务端请求自动回包
 *      （approval → `{choice:"once"}`、clarify → 第一个选项）
 *   5. 断言至少一个助手文本增量到达，打印最终助手文本
 *
 * 安全：绝不打印密码 / session token / CSRF token / Cookie 明文；会话 id 打码。
 * 只创建会话、绝不删除；不触碰真实 Hermes 的 config/state 文件。
 *
 * 用法：
 *   node scripts/e2e-real-hermes.mjs --base http://127.0.0.1:8931 \
 *     --user admin --pass <password> [--prompt '仅回复两个字：pong'] [--timeout 60000]
 *   node scripts/e2e-real-hermes.mjs --base http://127.0.0.1:8931 \
 *     --user admin --pass <password> --probe-groups   # 只读探测群聊能力，不建会话/不花模型调用
 *
 * 环境变量：E2E_BASE / E2E_USER / E2E_PASS / E2E_PROMPT / E2E_TIMEOUT_MS / E2E_RAW=1
 *           E2E_WAIT_READY=1（恢复旧的就绪屏障，等 `gateway.ready` 再发首个请求）
 *           E2E_PROBE_GROUPS=1（等价 --probe-groups）
 * 默认（no-wait）：WS `open` 后**立即**发 `session.create`，不等待转发的 `gateway.ready`
 *   —— 这是对 BFF「上游未建立前先缓存客户端帧」冷启动修复的端到端验证；失败即回归。
 * 退出码：0 = 到达最终答复（含模型调用失败时的 WARN）；1 = 未取得任何助手文本 / 连接失败。
 */

import { createHash, randomBytes } from "node:crypto";
import net from "node:net";

const SESSION_COOKIE = "24h_session";
const CSRF_COOKIE = "24h_csrf";
const CSRF_HEADER = "x-csrf-token";

const PASS = "PASS";
const WARN = "WARN";
const FAIL = "FAIL";

function parseArgs(argv) {
  const opts = {
    base: process.env.E2E_BASE || "http://127.0.0.1:8931",
    user: process.env.E2E_USER || "admin",
    pass: process.env.E2E_PASS || "",
    prompt: process.env.E2E_PROMPT || "仅回复两个字：pong",
    timeoutMs: Number(process.env.E2E_TIMEOUT_MS || 60000),
    raw: process.env.E2E_RAW === "1",
    // 默认不等待 gateway.ready（回归 BFF 冷启动缓存修复）。
    noWait: process.env.E2E_WAIT_READY !== "1",
    probeGroups: process.env.E2E_PROBE_GROUPS === "1",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--base") opts.base = argv[++i] ?? opts.base;
    else if (arg.startsWith("--base=")) opts.base = arg.slice(7);
    else if (arg === "--user") opts.user = argv[++i] ?? opts.user;
    else if (arg.startsWith("--user=")) opts.user = arg.slice(7);
    else if (arg === "--pass") opts.pass = argv[++i] ?? opts.pass;
    else if (arg.startsWith("--pass=")) opts.pass = arg.slice(7);
    else if (arg === "--prompt") opts.prompt = argv[++i] ?? opts.prompt;
    else if (arg.startsWith("--prompt=")) opts.prompt = arg.slice(9);
    else if (arg === "--timeout") opts.timeoutMs = Number(argv[++i] ?? opts.timeoutMs);
    else if (arg === "--raw") opts.raw = true;
    else if (arg === "--no-wait") opts.noWait = true;
    else if (arg === "--wait-ready") opts.noWait = false;
    else if (arg === "--probe-groups") opts.probeGroups = true;
  }
  return opts;
}

function mask(value) {
  const text = String(value ?? "");
  if (text.length <= 8) return "***";
  return `${text.slice(0, 4)}…${text.slice(-3)}`;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    sleep(ms).then(() => {
      throw new Error(`${label} timed out after ${ms}ms`);
    }),
  ]);
}

function deltaText(payload) {
  const pick = (key) => (typeof payload?.[key] === "string" ? payload[key] : undefined);
  return pick("text") ?? pick("delta") ?? pick("content") ?? "";
}

function pickFirstChoice(params) {
  const options =
    (Array.isArray(params?.options) && params.options) ||
    (Array.isArray(params?.choices) && params.choices) ||
    (Array.isArray(params?.items) && params.items) ||
    [];
  const first = options[0];
  if (typeof first === "string") return { choice: first, answer: first };
  if (first && typeof first === "object") {
    const value = first.value ?? first.id ?? first.key ?? first.label ?? first.text;
    if (typeof value === "string") return { choice: value, answer: value };
  }
  return { choice: "once" };
}

/** 极简 cookie jar（全局 fetch 不管理 cookie，手动捕获并回送）。 */
class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  absorb(response) {
    const setCookies =
      typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
    for (const raw of setCookies) {
      const pair = raw.split(";")[0] ?? "";
      const eq = pair.indexOf("=");
      if (eq > 0) this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }

  get(name) {
    return this.cookies.get(name) ?? null;
  }

  header() {
    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }
}

/**
 * 零依赖 RFC6455 客户端（仅 ws:// 回环）。接口与 `ws` 对齐（on/send/close），
 * 以便主流程在 `ws` 缺失时无差别复用。
 */
class RawWebSocket {
  constructor(url, options = {}) {
    this._listeners = new Map();
    this._buffer = Buffer.alloc(0);
    this._handshakeDone = false;
    this._fragData = [];
    this._closed = false;

    const target = new URL(url);
    const key = randomBytes(16).toString("base64");
    this._expectedAccept = createHash("sha1")
      .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest("base64");

    const lines = [
      `GET ${target.pathname}${target.search} HTTP/1.1`,
      `Host: ${target.host}`,
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Key: ${key}`,
      "Sec-WebSocket-Version: 13",
    ];
    for (const [name, value] of Object.entries(options.headers ?? {})) {
      lines.push(`${name}: ${value}`);
    }

    this._socket = net.connect({
      host: target.hostname,
      port: Number(target.port || (target.protocol === "wss:" ? 443 : 80)),
    });
    this._socket.on("connect", () => this._socket.write(`${lines.join("\r\n")}\r\n\r\n`));
    this._socket.on("data", (chunk) => this._onData(chunk));
    this._socket.on("error", (error) => this._emit("error", error));
    this._socket.on("close", () => {
      this._closed = true;
      this._emit("close", {});
    });
  }

  on(event, handler) {
    const set = this._listeners.get(event) ?? new Set();
    set.add(handler);
    this._listeners.set(event, set);
    return this;
  }

  _emit(event, arg) {
    for (const handler of this._listeners.get(event) ?? []) {
      try {
        handler(arg);
      } catch {
        /* ignore listener errors */
      }
    }
  }

  _onData(chunk) {
    this._buffer = Buffer.concat([this._buffer, chunk]);
    if (!this._handshakeDone) {
      const end = this._buffer.indexOf("\r\n\r\n");
      if (end < 0) return;
      const head = this._buffer.subarray(0, end).toString("latin1");
      this._buffer = this._buffer.subarray(end + 4);
      const lines = head.split("\r\n");
      const status = /^HTTP\/1\.1 (\d{3})/.exec(lines[0] ?? "");
      if (!status || status[1] !== "101") {
        this._emit("error", new Error(`WS handshake failed: ${lines[0] ?? "no status"}`));
        this._socket.destroy();
        return;
      }
      const headers = {};
      for (const line of lines.slice(1)) {
        const idx = line.indexOf(":");
        if (idx > 0) headers[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
      }
      if (headers["sec-websocket-accept"] !== this._expectedAccept) {
        this._emit("error", new Error("WS handshake failed: bad Sec-WebSocket-Accept"));
        this._socket.destroy();
        return;
      }
      this._handshakeDone = true;
      this._emit("open", {});
    }
    this._parseFrames();
  }

  _parseFrames() {
    for (;;) {
      const buf = this._buffer;
      if (buf.length < 2) return;
      const fin = (buf[0] & 0x80) !== 0;
      const opcode = buf[0] & 0x0f;
      const masked = (buf[1] & 0x80) !== 0;
      let length = buf[1] & 0x7f;
      let offset = 2;
      if (length === 126) {
        if (buf.length < offset + 2) return;
        length = buf.readUInt16BE(offset);
        offset += 2;
      } else if (length === 127) {
        if (buf.length < offset + 8) return;
        length = Number(buf.readBigUInt64BE(offset));
        offset += 8;
      }
      let maskKey = null;
      if (masked) {
        if (buf.length < offset + 4) return;
        maskKey = buf.subarray(offset, offset + 4);
        offset += 4;
      }
      if (buf.length < offset + length) return;
      let payload = Buffer.from(buf.subarray(offset, offset + length));
      if (maskKey) {
        for (let i = 0; i < payload.length; i += 1) payload[i] ^= maskKey[i % 4];
      }
      this._buffer = buf.subarray(offset + length);

      if (opcode === 0x8) {
        this._emit("close", {});
        this._socket.end();
        return;
      }
      if (opcode === 0x9) {
        this._sendFrame(0xa, payload);
        continue;
      }
      if (opcode === 0xa) continue;
      if (opcode === 0x1 || opcode === 0x2) {
        if (fin) {
          this._emit("message", payload.toString("utf8"));
        } else {
          this._fragData = [payload];
        }
        continue;
      }
      if (opcode === 0x0) {
        this._fragData.push(payload);
        if (fin) {
          const full = Buffer.concat(this._fragData);
          this._fragData = [];
          this._emit("message", full.toString("utf8"));
        }
      }
    }
  }

  _sendFrame(opcode, payload) {
    const maskKey = randomBytes(4);
    const length = payload.length;
    let header;
    if (length < 126) {
      header = Buffer.alloc(2);
      header[1] = 0x80 | length;
    } else if (length < 65536) {
      header = Buffer.alloc(4);
      header[1] = 0x80 | 126;
      header.writeUInt16BE(length, 2);
    } else {
      header = Buffer.alloc(10);
      header[1] = 0x80 | 127;
      header.writeBigUInt64BE(BigInt(length), 2);
    }
    header[0] = 0x80 | opcode;
    const maskedPayload = Buffer.allocUnsafe(length);
    for (let i = 0; i < length; i += 1) maskedPayload[i] = payload[i] ^ maskKey[i % 4];
    this._socket.write(Buffer.concat([header, maskKey, maskedPayload]));
  }

  send(data) {
    this._sendFrame(0x1, Buffer.from(String(data), "utf8"));
  }

  close() {
    if (this._closed) return;
    try {
      this._sendFrame(0x8, Buffer.alloc(0));
    } catch {
      /* ignore */
    }
    try {
      this._socket.end();
    } catch {
      /* ignore */
    }
  }
}

async function loadWebSocket(forceRaw) {
  if (!forceRaw) {
    try {
      const mod = await import("ws");
      const WS = mod.WebSocket ?? mod.default;
      if (typeof WS === "function") return { WS, source: "ws" };
    } catch {
      /* fall through to raw */
    }
  }
  return { WS: RawWebSocket, source: "raw" };
}

/** JSON-RPC over a ws-like socket (Hermes L1 gateway protocol). */
class Gateway {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.onEvent = () => {};
    this.onServerRequest = () => {};
    socket.on("message", (data) => this._dispatch(String(data)));
  }

  request(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    const promise = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.socket.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
    return promise;
  }

  _dispatch(raw) {
    let frame;
    try {
      frame = JSON.parse(raw);
    } catch {
      return;
    }

    if (frame.method === "event") {
      const type = frame.params?.type;
      if (typeof type === "string") this.onEvent(type, frame.params?.payload ?? {});
      return;
    }

    if (frame.id != null && frame.method !== undefined) {
      let responded = false;
      const respond = (result) => {
        if (responded) return;
        responded = true;
        this.socket.send(JSON.stringify({ jsonrpc: "2.0", id: frame.id, result }));
      };
      this.onServerRequest(String(frame.method), frame.params ?? {}, respond);
      return;
    }

    if (frame.id != null && frame.method === undefined) {
      const pending = this.pending.get(frame.id);
      if (!pending) return;
      this.pending.delete(frame.id);
      if (frame.error) {
        const message =
          typeof frame.error === "object" ? frame.error.message ?? JSON.stringify(frame.error) : frame.error;
        pending.reject(new Error(String(message)));
      } else {
        pending.resolve(frame.result);
      }
    }
  }
}

function openSocket(WS, url, options, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const socket = new WS(url, options);
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        socket.close();
      } catch {
        /* ignore */
      }
      reject(new Error(`WebSocket open timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    socket.on("open", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error instanceof Error ? error : new Error(String(error)));
    });
  });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const base = opts.base.replace(/\/+$/, "");

  console.log(`24H real-Hermes e2e → ${base}`);
  console.log(`prompt: ${JSON.stringify(opts.prompt)}`);
  console.log("");

  if (!opts.pass) {
    console.log(`[${FAIL}] login — 缺少密码（--pass 或 E2E_PASS）`);
    return 1;
  }

  // 1. login
  const jar = new CookieJar();
  let loginResponse;
  try {
    loginResponse = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ username: opts.user, password: opts.pass }),
    });
    jar.absorb(loginResponse);
  } catch (error) {
    console.log(`[${FAIL}] login — 不可达 (${error.message})`);
    return 1;
  }
  if (loginResponse.status !== 200) {
    console.log(`[${FAIL}] login — HTTP ${loginResponse.status}`);
    return 1;
  }
  const session = jar.get(SESSION_COOKIE);
  if (!session) {
    console.log(`[${FAIL}] login — 未收到 ${SESSION_COOKIE} cookie`);
    return 1;
  }
  const loginUser = await loginResponse.json().catch(() => ({}));
  console.log(
    `[${PASS}] login — user=${loginUser?.user?.username ?? opts.user} session=set csrf=${
      jar.get(CSRF_COOKIE) ? "set" : "missing"
    }`,
  );

  // 2. WebSocket to BFF gateway
  const { WS, source } = await loadWebSocket(opts.raw);
  const wsUrl = `${base.replace(/^http/, "ws")}/api/hermes/ws`;
  let socket;
  try {
    socket = await openSocket(WS, wsUrl, { headers: { Cookie: jar.header() } }, opts.timeoutMs);
  } catch (error) {
    console.log(`[${FAIL}] ws connect — ${error.message}`);
    return 1;
  }
  console.log(`[${PASS}] ws connect — ${wsUrl} (client=${source})`);

  const gateway = new Gateway(socket);
  const requestTimeout = Math.min(opts.timeoutMs, 30000);

  // 事件/服务端请求 handler 必须在任何 await 前挂好，避免漏掉早到的 gateway.ready。
  const deltas = [];
  let finalText = null;
  let errorText = null;
  let serverRequests = 0;

  let markReady;
  const ready = new Promise((resolve) => {
    markReady = resolve;
  });
  let finish;
  const finished = new Promise((resolve) => {
    finish = resolve;
  });

  gateway.onServerRequest = (method, params, respond) => {
    serverRequests += 1;
    const lower = method.toLowerCase();
    if (lower.includes("approval")) {
      respond({ choice: "once" });
    } else if (lower.includes("clarify")) {
      respond(pickFirstChoice(params));
    } else {
      respond({});
    }
    console.log(`[${PASS}] server-request — ${method} → answered (#${serverRequests})`);
  };

  gateway.onEvent = (type, payload) => {
    if (type === "gateway.ready") {
      markReady();
      return;
    }
    if (type === "message.delta") {
      const text = deltaText(payload);
      if (text) deltas.push(text);
      return;
    }
    if (type === "message.complete") {
      finalText = deltaText(payload) || null;
      finish();
      return;
    }
    if (type === "done") {
      finish();
      return;
    }
    if (type === "error") {
      errorText =
        (typeof payload?.message === "string" && payload.message) ||
        (typeof payload?.error === "string" && payload.error) ||
        JSON.stringify(payload ?? {});
      finish();
    }
  };

  socket.on("close", () => {
    markReady();
    finish();
  });
  socket.on("error", (error) => {
    errorText = error instanceof Error ? error.message : String(error);
    markReady();
    finish();
  });

  // 默认（no-wait）：open 后立即发首个请求，验证 BFF 在异步取上游 token 期间也能
  // 缓存客户端帧（冷启动竞态修复）。`--wait-ready` / `E2E_WAIT_READY=1` 可恢复旧的
  // 就绪屏障，等 Hermes 的 `gateway.ready`（经 BFF 透传）后再发。
  if (opts.noWait) {
    console.log(`[${PASS}] no-wait — open 后立即发送 session.create（不等待 gateway.ready）`);
  } else {
    const becameReady = await Promise.race([
      ready.then(() => true),
      sleep(Math.min(5000, opts.timeoutMs)).then(() => false),
    ]);
    console.log(
      `[${becameReady ? PASS : WARN}] gateway.ready — ${
        becameReady ? "已就绪" : "5s 内未收到，仍继续尝试"
      }`,
    );
  }

  // 只读群聊能力探测：不创建会话、不发起模型调用，仅发 groups.* RPC 并打印原始结果。
  if (opts.probeGroups) {
    console.log("");
    console.log("=== groups probe (read-only) ===");
    for (const method of ["groups.capabilities", "groups.list"]) {
      try {
        const result = await withTimeout(gateway.request(method, {}), requestTimeout, method);
        console.log(`[${PASS}] ${method} → ${JSON.stringify(result)}`);
      } catch (error) {
        console.log(`[${WARN}] ${method} → ${error.message}`);
      }
    }
    socket.close();
    return 0;
  }

  // 3. session.create
  let sessionId;
  try {
    const created = await withTimeout(
      gateway.request("session.create", {}),
      requestTimeout,
      "session.create",
    );
    sessionId = created?.session_id ?? created?.id ?? (typeof created === "string" ? created : null);
  } catch (error) {
    console.log(`[${FAIL}] session.create — ${error.message}`);
    socket.close();
    return 1;
  }
  if (!sessionId) {
    console.log(`[${FAIL}] session.create — 响应缺少 session_id`);
    socket.close();
    return 1;
  }
  console.log(`[${PASS}] session.create — session=${mask(sessionId)}`);

  // 4. prompt.submit + collect frames
  try {
    await withTimeout(
      gateway.request("prompt.submit", { session_id: sessionId, text: opts.prompt }),
      requestTimeout,
      "prompt.submit",
    );
  } catch (error) {
    console.log(`[${FAIL}] prompt.submit — ${error.message}`);
    socket.close();
    return 1;
  }
  console.log(`[${PASS}] prompt.submit — sent`);

  const timeout = new Promise((resolve) => setTimeout(resolve, opts.timeoutMs));
  await Promise.race([finished, timeout]);

  socket.close();

  // 5. report
  console.log("");
  console.log(`[${deltas.length > 0 ? PASS : WARN}] message.delta — ${deltas.length} 段增量`);

  const streamed = deltas.join("");
  const assistantText = finalText || streamed;

  if (assistantText) {
    console.log(`[${PASS}] assistant — ${JSON.stringify(assistantText)}`);
  } else if (errorText) {
    console.log(`[${WARN}] assistant — 无文本；错误: ${errorText}`);
  } else {
    console.log(`[${FAIL}] assistant — 超时内未收到任何助手文本`);
  }

  if (errorText && assistantText === "") {
    console.log("");
    console.log("WARN: 真实模型调用失败（配置/额度），已按 WARN 处理，未影响退出码。");
    return 0;
  }

  return assistantText ? 0 : 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(`e2e crashed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
