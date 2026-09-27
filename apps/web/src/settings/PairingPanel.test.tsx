import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PairingPanel from "./PairingPanel";
import {
  buildPairingAction,
  normalizePairingDevices,
  normalizePairingState,
  normalizeSshOwnership,
} from "./pairing";

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

const PAIRING = {
  pending: [{ id: "dev1", name: "iPhone", status: "pending", kind: "ios" }],
  paired: [{ id: "dev2", name: "Laptop", last_seen: "刚刚" }],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PairingPanel T18.2 配对与设备", () => {
  it("renders pending/paired devices and the SSH ownership", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch([
        { path: "/api/hermes/pairing", method: "GET", status: 200, body: PAIRING },
        {
          path: "/api/hermes/ssh/ownership",
          method: "GET",
          status: 200,
          body: { owner: "alice", fingerprint: "SHA256:abc" },
        },
      ]),
    );

    render(<PairingPanel />);

    expect(await screen.findByText("iPhone")).toBeInTheDocument();
    expect(screen.getByText("Laptop")).toBeInTheDocument();
    expect(screen.getByLabelText("iPhone 状态")).toHaveTextContent("等待批准");
    expect(screen.getByLabelText("Laptop 状态")).toHaveTextContent("已配对");
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("SHA256:abc")).toBeInTheDocument();
  });

  it("approves a pending device with the right body", async () => {
    const fetchMock = stubFetch([
      { path: "/api/hermes/pairing", method: "GET", status: 200, body: PAIRING },
      { path: "/api/hermes/ssh/ownership", method: "GET", status: 200, body: { owner: "alice" } },
      { path: "/api/hermes/pairing/approve", method: "POST", status: 200, body: { ok: true } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<PairingPanel />);
    await screen.findByText("iPhone");
    await user.click(screen.getByRole("button", { name: "批准 iPhone" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (entry) =>
          String(entry[0]).endsWith("/api/hermes/pairing/approve") &&
          (entry[1] as RequestInit | undefined)?.method === "POST",
      );
      expect(call).toBeTruthy();
      expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({ id: "dev1" });
    });
  });

  it("normalizes tolerant shapes", () => {
    expect(normalizePairingState("awaiting")).toBe("pending");
    expect(normalizePairingState("approved")).toBe("paired");
    expect(normalizePairingState("revoked")).toBe("revoked");
    expect(normalizePairingDevices(["abc"])).toEqual([
      { id: "abc", name: "abc", state: "unknown" },
    ]);
    expect(normalizePairingDevices({ paired: [{ device_id: "z", status: "active" }] })).toEqual([
      { id: "z", name: "z", state: "paired" },
    ]);
    expect(normalizeSshOwnership({ username: "bob" })).toEqual({ owner: "bob" });
    expect(normalizeSshOwnership(null)).toBeNull();
    expect(buildPairingAction("dev1")).toEqual({ id: "dev1" });
  });
});
