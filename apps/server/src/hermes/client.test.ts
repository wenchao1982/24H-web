import { afterEach, describe, expect, it } from "vitest";
import { startMockHermes, type MockHermes } from "../test/mockHermes";
import { clearHermesTokenCache, getHermesToken, hermesUpstream } from "./client";

let upstream: MockHermes | undefined;

afterEach(async () => {
  if (upstream) {
    clearHermesTokenCache(upstream.baseUrl);
  }
  await upstream?.close();
  upstream = undefined;
});

describe("hermesUpstream", () => {
  it("derives http/https and ws/wss base urls", () => {
    expect(hermesUpstream({ hermesBaseUrl: "http://127.0.0.1:9119/" })).toEqual({
      baseUrl: "http://127.0.0.1:9119",
      wsBaseUrl: "ws://127.0.0.1:9119",
    });
    expect(hermesUpstream({ hermesBaseUrl: "https://hermes.example" }).wsBaseUrl).toBe(
      "wss://hermes.example",
    );
  });

  it("honours an explicit connection override", () => {
    expect(hermesUpstream({ hermesBaseUrl: "http://127.0.0.1:9119" }, "http://10.0.0.5:9000")).toEqual({
      baseUrl: "http://10.0.0.5:9000",
      wsBaseUrl: "ws://10.0.0.5:9000",
    });
  });
});

describe("getHermesToken", () => {
  it("extracts the session token and caches it (no second fetch)", async () => {
    upstream = await startMockHermes({ token: "tok-abc-123" });
    clearHermesTokenCache(upstream.baseUrl);

    const first = await getHermesToken(upstream.baseUrl);
    expect(first).toBe("tok-abc-123");
    expect(upstream.requests).toHaveLength(1);

    const second = await getHermesToken(upstream.baseUrl);
    expect(second).toBe("tok-abc-123");
    expect(upstream.requests).toHaveLength(1);
  });

  it("refetches when force is set", async () => {
    upstream = await startMockHermes({ token: "tok-abc-123" });
    clearHermesTokenCache(upstream.baseUrl);

    await getHermesToken(upstream.baseUrl);
    await getHermesToken(upstream.baseUrl, { force: true });
    expect(upstream.requests).toHaveLength(2);
  });

  it("throws a clear error when the token is absent", async () => {
    upstream = await startMockHermes();
    upstream.setHandler(({ res, request }) => {
      if (request.path === "/") {
        res.setHeader("content-type", "text/html");
        res.end("<html><body>no token here</body></html>");
        return true;
      }
      return false;
    });
    clearHermesTokenCache(upstream.baseUrl);

    await expect(getHermesToken(upstream.baseUrl)).rejects.toMatchObject({
      status: 502,
      code: "HERMES_TOKEN_MISSING",
    });
  });

  it("throws HERMES_UNREACHABLE when the upstream is down", async () => {
    upstream = await startMockHermes();
    const baseUrl = upstream.baseUrl;
    await upstream.close();
    upstream = undefined;
    clearHermesTokenCache(baseUrl);

    await expect(getHermesToken(baseUrl)).rejects.toMatchObject({
      status: 502,
      code: "HERMES_UNREACHABLE",
    });
  });
});
