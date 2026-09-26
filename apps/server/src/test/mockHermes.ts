import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

export interface MockRequest {
  method: string;
  path: string;
  query: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

export interface MockResponseContext {
  req: IncomingMessage;
  res: ServerResponse;
  request: MockRequest;
}

/** Return `true` to mark the request as handled and skip the default echo. */
export type MockHandler = (ctx: MockResponseContext) => boolean | void;

export interface MockHermes {
  server: Server;
  baseUrl: string;
  wsBaseUrl: string;
  token: string;
  requests: MockRequest[];
  setHandler(handler: MockHandler | null): void;
  close(): Promise<void>;
}

export interface MockHermesOptions {
  token?: string;
  version?: string;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", () => resolve(""));
  });
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/**
 * Start a local mock of `hermes serve`: `GET /` serves the session token HTML,
 * `/api/status` reports healthy, and every other request is echoed back as JSON
 * (including the received `x-hermes-session-token` header). Tests may override
 * the behaviour via `setHandler`.
 */
export async function startMockHermes(options: MockHermesOptions = {}): Promise<MockHermes> {
  const token = options.token ?? "mock-hermes-token";
  const version = options.version ?? "9.9.9";
  const requests: MockRequest[] = [];
  let handler: MockHandler | null = null;

  const server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", "http://localhost");
      const body = await readBody(req);
      const request: MockRequest = {
        method: req.method ?? "GET",
        path: url.pathname,
        query: url.search,
        headers: req.headers,
        body,
      };
      requests.push(request);

      if (handler && handler({ req, res, request }) === true) {
        return;
      }

      if (request.method === "GET" && request.path === "/") {
        res.setHeader("content-type", "text/html");
        res.end(
          `<html><body><script>window.__HERMES_SESSION_TOKEN__="${token}";</script></body></html>`,
        );
        return;
      }

      if (request.path === "/api/status") {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ ok: true, version }));
        return;
      }

      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          method: request.method,
          path: request.path,
          url: req.url,
          body: body.length > 0 ? safeParse(body) : null,
          token: req.headers["x-hermes-session-token"] ?? null,
        }),
      );
    })();
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    server,
    baseUrl,
    wsBaseUrl: baseUrl.replace("http", "ws"),
    token,
    requests,
    setHandler(next) {
      handler = next;
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  };
}
