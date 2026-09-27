import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import BillingPanel from "./BillingPanel";
import { GatewayProvider } from "../chat/GatewayProvider";
import { createFakeGateway, type FakeGateway } from "../test/fakeGateway";
import { normalizeBilling } from "./billing";

function renderPanel(gateway: FakeGateway) {
  return render(
    <GatewayProvider gateway={gateway}>
      <BillingPanel />
    </GatewayProvider>,
  );
}

function stubPortal(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(body),
    })) as unknown as typeof fetch,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BillingPanel T18.14 计费/套餐", () => {
  it("renders billing state and the portal plan", async () => {
    stubPortal({ plan: "Pro", status: "active", usage: { used: 1, limit: 10 } });
    const gateway = createFakeGateway((method) => {
      if (method === "billing.state") {
        return { plan: "Pro", status: "active", seats: 5, balance: { amount: 20, currency: "USD" } };
      }
      if (method === "subscription.status") {
        return {};
      }
      return {};
    });
    renderPanel(gateway);

    expect(await screen.findByText("5")).toBeInTheDocument();
    expect(screen.getAllByText("Pro").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("active").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("20 USD")).toBeInTheDocument();
    expect(screen.getByLabelText("门户套餐概览")).toHaveTextContent("Pro");
  });

  it("shows an empty state when nothing is returned", async () => {
    stubPortal({});
    const gateway = createFakeGateway(() => ({}));
    renderPanel(gateway);
    expect(await screen.findByText("暂无计费信息。")).toBeInTheDocument();
  });

  it("normalizes tolerant shapes", () => {
    expect(normalizeBilling({ plan: "Free" })).toEqual({ plan: "Free" });
    expect(normalizeBilling({ subscription: { plan: "Team", seats: "3" } })).toEqual({
      plan: "Team",
      seats: 3,
    });
    expect(normalizeBilling({ balance: "credits: 10" })).toEqual({ balance: "credits: 10" });
  });
});
