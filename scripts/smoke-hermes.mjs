#!/usr/bin/env node
/**
 * 24H acceptance smoke — 真实 Hermes / BFF 只读冒烟。
 *
 * 纯 Node、零依赖；对**已经在运行的 BFF** 只发 GET/POST 登录，不写入业务数据、
 * 不调用模型、不改动任何持久化状态（登录会更新 last_login，属预期）。
 *
 * 用法：
 *   node scripts/smoke-hermes.mjs [--base http://127.0.0.1:8931] [--start-hermes]
 *
 * 环境变量：
 *   OS_SMOKE_BASE         BFF 地址（默认 http://127.0.0.1:8931）
 *   OS_SMOKE_USER         管理员用户名（默认 admin）
 *   OS_SMOKE_PASS         管理员密码（必填，缺失则 step 2+ 失败）
 *   OS_SMOKE_INSTANCE_ID  BFF 实例/provider 标识（可选，仅用于展示）
 *   OS_SMOKE_START_HERMES=1 / --start-hermes
 *                         启动一个**隔离**的 hermes serve（全新临时 HERMES_HOME，
 *                         绝不触碰 ~/.hermes）；步骤 4/5 仍经 BFF 上游判定。
 *   OS_SMOKE_HERMES_CLI   hermes CLI 路径（默认 hermes）
 *   OS_SMOKE_HERMES_PORT  隔离 Hermes 端口（默认 9119）
 *   OS_SMOKE_HERMES_TIMEOUT_MS 等待就绪超时（默认 20000）
 *
 * 退出码：0 = 无硬失败；1 = 至少一个硬失败（Hermes 未连接等软检查记为 WARN，不影响退出码）。
 * 绝不打印密码 / session token / CSRF token 明文。
 */

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PASS = "PASS";
const WARN = "WARN";
const FAIL = "FAIL";

const DEFAULT_BASE = "http://127.0.0.1:8931";
const SESSION_COOKIE = "24h_session";
const CSRF_COOKIE = "24h_csrf";
const CSRF_HEADER = "x-csrf-token";

const results = [];

function record(step, status, detail = "") {
  results.push({ step, status });
  const suffix = detail ? ` — ${detail}` : "";
  console.log(`[${status}] ${step}${suffix}`);
}

function summary() {
  const count = (status) => results.filter((r) => r.status === status).length;
  const failed = count(FAIL);
  console.log("");
  console.log(
    `Summary: ${count(PASS)} PASS, ${count(WARN)} WARN, ${count(FAIL)} FAIL` +
      (failed > 0 ? "  (hard failures present)" : ""),
  );
  return failed === 0 ? 0 : 1;
}

function parseArgs(argv) {
  const opts = { base: "", startHermes: process.env.OS_SMOKE_START_HERMES === "1", help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      opts.help = true;
    } else if (arg === "--start-hermes") {
      opts.startHermes = true;
    } else if (arg === "--base") {
      opts.base = argv[i + 1] ?? "";
      i += 1;
    } else if (arg.startsWith("--base=")) {
      opts.base = arg.slice("--base=".length);
    }
  }
  return opts;
}

function printHelp() {
  console.log(
    [
      "24H acceptance smoke (read-only against a running BFF)",
      "",
      "Usage: node scripts/smoke-hermes.mjs [--base URL] [--start-hermes]",
      "",
      "Env: OS_SMOKE_BASE, OS_SMOKE_USER, OS_SMOKE_PASS,",
      "     OS_SMOKE_START_HERMES=1, OS_SMOKE_HERMES_CLI, OS_SMOKE_HERMES_PORT",
    ].join("\n"),
  );
}

/** 极简 cookie jar：全局 fetch 不管理 cookie，手动捕获并回送。 */
class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  absorb(response) {
    const setCookies =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : [];
    for (const raw of setCookies) {
      const pair = raw.split(";")[0] ?? "";
      const eq = pair.indexOf("=");
      if (eq > 0) {
        this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
    }
  }

  get(name) {
    return this.cookies.get(name) ?? null;
  }

  header() {
    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }
}

async function http(jar, path, options = {}) {
  const { base, method = "GET", body, headers = {} } = options;
  const reqHeaders = { accept: "application/json", ...headers };
  if (jar) {
    const cookie = jar.header();
    if (cookie && !reqHeaders.cookie) {
      reqHeaders.cookie = cookie;
    }
  }
  let payload;
  if (body !== undefined) {
    reqHeaders["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  let response;
  try {
    response = await fetch(new URL(path, base).toString(), {
      method,
      headers: reqHeaders,
      body: payload,
      redirect: "manual",
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  if (jar) {
    jar.absorb(response);
  }
  const text = await response.text();
  let json;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
  }
  return { status: response.status, ok: response.ok, json, text };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 可选：启动一个全新 HERMES_HOME 的隔离 hermes serve（不触碰真实 home）。 */
async function maybeStartHermes(opts) {
  if (!opts.startHermes) {
    return null;
  }
  const cli = process.env.OS_SMOKE_HERMES_CLI || "hermes";
  const port = Number(process.env.OS_SMOKE_HERMES_PORT || 9119);
  const home = mkdtempSync(join(tmpdir(), "24h-smoke-hermes-"));
  const child = spawn(cli, ["serve", "--host", "127.0.0.1", "--port", String(port)], {
    env: { ...process.env, HERMES_HOME: home },
    stdio: "ignore",
  });
  child.on("error", () => {});

  let stopped = false;
  const stop = () => {
    if (stopped) {
      return;
    }
    stopped = true;
    try {
      child.kill("SIGTERM");
    } catch {
      /* ignore */
    }
    try {
      rmSync(home, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  };
  process.on("exit", stop);

  const timeoutMs = Number(process.env.OS_SMOKE_HERMES_TIMEOUT_MS || 20000);
  const deadline = Date.now() + timeoutMs;
  const probe = `http://127.0.0.1:${port}/api/status`;
  while (Date.now() < deadline) {
    try {
      await fetch(probe, { signal: AbortSignal.timeout(1500) });
      record(
        "0. start-isolated-hermes",
        PASS,
        `${cli} serve ready on 127.0.0.1:${port} (temp HERMES_HOME)`,
      );
      return { stop };
    } catch {
      await sleep(500);
    }
  }
  record("0. start-isolated-hermes", WARN, `${cli} serve not ready within ${timeoutMs}ms`);
  return { stop };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return 0;
  }

  const base = (opts.base || process.env.OS_SMOKE_BASE || DEFAULT_BASE).replace(/\/+$/, "");
  const username = process.env.OS_SMOKE_USER || "admin";
  const password = process.env.OS_SMOKE_PASS || "";

  console.log(`24H acceptance smoke → ${base}`);
  if (process.env.OS_SMOKE_INSTANCE_ID) {
    console.log(`instance: ${process.env.OS_SMOKE_INSTANCE_ID}`);
  }
  console.log("");

  const hermes = await maybeStartHermes(opts);
  try {
    // 1. health
    const health = await http(null, "/health", { base });
    if (health.error) {
      record("1. GET /health", FAIL, `unreachable (${health.error})`);
    } else if (health.status === 200 && health.json?.ok === true) {
      record("1. GET /health", PASS);
    } else {
      record("1. GET /health", FAIL, `HTTP ${health.status}`);
    }

    // 2. login
    const jar = new CookieJar();
    let csrf = null;
    if (!password) {
      record("2. POST /api/auth/login", FAIL, "missing OS_SMOKE_PASS (admin credentials required)");
    } else {
      const login = await http(jar, "/api/auth/login", {
        base,
        method: "POST",
        body: { username, password },
      });
      if (login.error) {
        record("2. POST /api/auth/login", FAIL, `unreachable (${login.error})`);
      } else if (login.status === 200 && login.json?.user?.username) {
        csrf = jar.get(CSRF_COOKIE);
        const hasSession = Boolean(jar.get(SESSION_COOKIE));
        record(
          "2. POST /api/auth/login",
          PASS,
          `user=${login.json.user.username} session=${hasSession ? "set" : "missing"} csrf=${
            csrf ? "set" : "missing"
          }`,
        );
      } else {
        record("2. POST /api/auth/login", FAIL, `HTTP ${login.status}`);
      }
    }

    const authHeaders = csrf ? { [CSRF_HEADER]: csrf } : {};
    const authed = csrf !== null || jar.get(SESSION_COOKIE) !== null;

    // 3. me
    if (!authed) {
      record("3. GET /api/auth/me", FAIL, "skipped (no session)");
    } else {
      const me = await http(jar, "/api/auth/me", { base, headers: authHeaders });
      if (me.error) {
        record("3. GET /api/auth/me", FAIL, `unreachable (${me.error})`);
      } else if (me.status === 200 && me.json?.username) {
        record("3. GET /api/auth/me", PASS, `username=${me.json.username} role=${me.json.role}`);
      } else {
        record("3. GET /api/auth/me", FAIL, `HTTP ${me.status}`);
      }
    }

    // 4. Hermes health (soft: ok=false → WARN; 5xx/transport → FAIL)
    if (!authed) {
      record("4. GET /api/hermes/health", FAIL, "skipped (no session)");
    } else {
      const hh = await http(jar, "/api/hermes/health", { base, headers: authHeaders });
      if (hh.error) {
        record("4. GET /api/hermes/health", FAIL, `unreachable (${hh.error})`);
      } else if (hh.status >= 500) {
        record("4. GET /api/hermes/health", FAIL, `HTTP ${hh.status}`);
      } else if (hh.status === 200 && hh.json?.ok === true) {
        record("4. GET /api/hermes/health", PASS, `Hermes connected${hh.json.version ? ` v${hh.json.version}` : ""}`);
      } else if (hh.status === 200) {
        record("4. GET /api/hermes/health", WARN, "Hermes not connected (ok=false) — soft check");
      } else {
        record("4. GET /api/hermes/health", FAIL, `HTTP ${hh.status}`);
      }
    }

    // 5. Hermes status via proxy (soft: upstream unreachable → WARN)
    if (!authed) {
      record("5. GET /api/hermes/status", FAIL, "skipped (no session)");
    } else {
      const st = await http(jar, "/api/hermes/status", { base, headers: authHeaders });
      if (st.error) {
        record("5. GET /api/hermes/status", FAIL, `unreachable (${st.error})`);
      } else if (st.status === 200) {
        record("5. GET /api/hermes/status", PASS, "proxied to Hermes /api/status");
      } else if (st.status >= 500) {
        record("5. GET /api/hermes/status", WARN, `HTTP ${st.status} — Hermes upstream unreachable (soft)`);
      } else {
        record("5. GET /api/hermes/status", FAIL, `HTTP ${st.status}`);
      }
    }

    // 6. admin users (super_admin only)
    if (!authed) {
      record("6. GET /api/admin/users", FAIL, "skipped (no session)");
    } else {
      const users = await http(jar, "/api/admin/users", { base, headers: authHeaders });
      if (users.error) {
        record("6. GET /api/admin/users", FAIL, `unreachable (${users.error})`);
      } else if (users.status === 200 && Array.isArray(users.json)) {
        record("6. GET /api/admin/users", PASS, `${users.json.length} user(s)`);
      } else {
        record("6. GET /api/admin/users", FAIL, `HTTP ${users.status}`);
      }
    }
  } finally {
    if (hermes) {
      hermes.stop();
    }
  }

  return summary();
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(`smoke crashed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
