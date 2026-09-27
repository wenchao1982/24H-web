import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChannelsPanel from "./ChannelsPanel";
import { buildPlatformBody, isSecretKey, normalizePlatforms } from "./channels";

interface StubRoute {
  path: string;
  method?: string;
  status: number;
  body: unknown;
}

function stubFetch(handlers: StubRoute[]) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    const hit = handlers.find(
      (handler) =>
        url.split("?")[0].endsWith(handler.path) &&
        (!handler.method || handler.method === method),
    );
    if (!hit) {
      return { ok: false, status: 404, text: async () => "" } as Response;
    }
    return {
      ok: hit.status >= 200 && hit.status < 300,
      status: hit.status,
      text: async () => JSON.stringify(hit.body),
    } as Response;
  });
}

const PLATFORMS = {
  platforms: [
    {
      id: "telegram",
      name: "Telegram",
      enabled: false,
      config: { bot_token: "super-secret-token", mode: "poll" },
    },
    {
      id: "discord",
      name: "Discord",
      enabled: true,
      config: { application_id: "123" },
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ChannelsPanel T17.2 渠道", () => {
  it("renders platforms and never renders secret values", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch([{ path: "/api/hermes/messaging/platforms", method: "GET", status: 200, body: PLATFORMS }]),
    );
    render(<ChannelsPanel />);

    expect(await screen.findByText("Telegram")).toBeInTheDocument();
    expect(screen.getByText("Discord")).toBeInTheDocument();
    expect(screen.getByLabelText("启用 Telegram")).not.toBeChecked();
    expect(screen.getByLabelText("启用 Discord")).toBeChecked();

    expect(screen.queryByText("super-secret-token")).not.toBeInTheDocument();
    expect(screen.getByText("••••••••")).toBeInTheDocument();
  });

  it("saves the right PUT body and omits blank secrets", async () => {
    const fetchMock = stubFetch([
      { path: "/api/hermes/messaging/platforms", method: "GET", status: 200, body: PLATFORMS },
      { path: "/api/hermes/messaging/platforms/telegram", method: "PUT", status: 200, body: { ok: true } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ChannelsPanel />);
    await screen.findByText("Telegram");

    await user.click(screen.getByLabelText("启用 Telegram"));
    await user.click(screen.getAllByRole("button", { name: "保存" })[0]!);

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (entry) =>
          String(entry[0]).endsWith("/api/hermes/messaging/platforms/telegram") &&
          (entry[1] as RequestInit | undefined)?.method === "PUT",
      );
      expect(call).toBeTruthy();
      expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({
        enabled: true,
        config: { mode: "poll" },
      });
    });
  });

  it("sends a new secret value when provided", async () => {
    const fetchMock = stubFetch([
      { path: "/api/hermes/messaging/platforms", method: "GET", status: 200, body: PLATFORMS },
      { path: "/api/hermes/messaging/platforms/telegram", method: "PUT", status: 200, body: { ok: true } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ChannelsPanel />);
    await screen.findByText("Telegram");

    await user.type(screen.getByLabelText("bot_token 新值"), "new-token");
    await user.click(screen.getAllByRole("button", { name: "保存" })[0]!);

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (entry) =>
          String(entry[0]).endsWith("/api/hermes/messaging/platforms/telegram") &&
          (entry[1] as RequestInit | undefined)?.method === "PUT",
      );
      expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({
        enabled: false,
        config: { bot_token: "new-token", mode: "poll" },
      });
    });
  });

  it("normalizes platforms and classifies secret keys", () => {
    expect(normalizePlatforms([{ platform: "slack", active: true }])).toEqual([
      { id: "slack", name: "slack", enabled: true, fields: [] },
    ]);
    expect(normalizePlatforms(null)).toEqual([]);
    expect(isSecretKey("bot_token")).toBe(true);
    expect(isSecretKey("mode")).toBe(false);
    expect(buildPlatformBody(true, { a: "1", b: "  " })).toEqual({
      enabled: true,
      config: { a: "1" },
    });
  });
});
