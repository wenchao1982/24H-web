import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WebhooksPanel from "./WebhooksPanel";
import { buildWebhookBody, normalizeEvents, normalizeWebhooks } from "./webhooks";

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

const WEBHOOKS = {
  webhooks: [
    { name: "deploy", url: "https://example.com/deploy", events: ["cron.changed"], enabled: true },
    { name: "alert", url: "https://example.com/alert", enabled: false },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("WebhooksPanel T17.4 Webhooks", () => {
  it("renders webhooks with events and enabled state", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch([{ path: "/api/hermes/webhooks", method: "GET", status: 200, body: WEBHOOKS }]),
    );
    render(<WebhooksPanel />);

    expect(await screen.findByText("deploy")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/deploy")).toBeInTheDocument();
    expect(screen.getByText("cron.changed")).toBeInTheDocument();
    expect(screen.getByText("alert")).toBeInTheDocument();
    expect(screen.getByText("全部事件")).toBeInTheDocument();
    expect(screen.getByLabelText("启用 deploy")).toBeChecked();
    expect(screen.getByLabelText("启用 alert")).not.toBeChecked();
  });

  it("creates a webhook with the right POST body", async () => {
    const fetchMock = stubFetch([
      { path: "/api/hermes/webhooks", method: "GET", status: 200, body: { webhooks: [] } },
      { path: "/api/hermes/webhooks", method: "POST", status: 200, body: { ok: true } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<WebhooksPanel />);
    await screen.findByText("暂无 Webhook。");

    await user.type(screen.getByLabelText("名称"), "notify");
    await user.type(screen.getByLabelText("回调地址"), "https://example.com/notify");
    await user.type(screen.getByLabelText("事件"), "a, b");
    await user.click(screen.getByRole("button", { name: "新建" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (entry) =>
          String(entry[0]).endsWith("/api/hermes/webhooks") &&
          (entry[1] as RequestInit | undefined)?.method === "POST",
      );
      expect(call).toBeTruthy();
      expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({
        name: "notify",
        url: "https://example.com/notify",
        events: ["a", "b"],
      });
    });
  });

  it("toggles and deletes via PUT/DELETE", async () => {
    const fetchMock = stubFetch([
      { path: "/api/hermes/webhooks", method: "GET", status: 200, body: WEBHOOKS },
      { path: "/api/hermes/webhooks/deploy", method: "PUT", status: 200, body: { ok: true } },
      { path: "/api/hermes/webhooks/alert", method: "DELETE", status: 200, body: { ok: true } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<WebhooksPanel />);
    await screen.findByText("deploy");

    await user.click(screen.getByLabelText("启用 deploy"));
    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (entry) =>
          String(entry[0]).endsWith("/api/hermes/webhooks/deploy") &&
          (entry[1] as RequestInit | undefined)?.method === "PUT",
      );
      expect(call).toBeTruthy();
      expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({ enabled: false });
    });

    await user.click(screen.getByRole("button", { name: "删除 Webhook alert" }));
    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (entry) =>
          String(entry[0]).endsWith("/api/hermes/webhooks/alert") &&
          (entry[1] as RequestInit | undefined)?.method === "DELETE",
      );
      expect(call).toBeTruthy();
    });
    await waitFor(() => expect(screen.queryByText("alert")).not.toBeInTheDocument());
  });

  it("normalizes webhooks and events", () => {
    expect(normalizeWebhooks([{ hook: "h", target: "u", event_types: "x,y" }])).toEqual([
      { name: "h", url: "u", events: ["x", "y"], enabled: true },
    ]);
    expect(normalizeWebhooks(null)).toEqual([]);
    expect(normalizeEvents(["a", " ", "b"])).toEqual(["a", "b"]);
    expect(buildWebhookBody({ name: "n", url: "u", events: [] })).toEqual({ name: "n", url: "u" });
  });
});
