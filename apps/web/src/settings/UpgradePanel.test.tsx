import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UpgradePanel from "./UpgradePanel";
import { normalizeUpdate, normalizeVersion, updateParams } from "./systemUpdate";

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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("UpgradePanel T18.16 系统升级", () => {
  it("renders core/web versions and requests an update", async () => {
    const fetchMock = stubFetch([
      {
        path: "/api/system/version",
        method: "GET",
        status: 200,
        body: { ok: true, core: "1.4.2", web: "0.1.0" },
      },
      {
        path: "/api/system/update",
        method: "POST",
        status: 200,
        body: { status: "unsupported", message: "请在主机侧由运维执行升级。" },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<UpgradePanel />);

    expect(await screen.findByLabelText("核心版本")).toHaveTextContent("1.4.2");
    expect(screen.getByLabelText("Web 版本")).toHaveTextContent("0.1.0");

    await user.click(screen.getByRole("button", { name: "升级" }));
    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (entry) =>
          String(entry[0]).endsWith("/api/system/update") &&
          (entry[1] as RequestInit | undefined)?.method === "POST",
      );
      expect(call).toBeTruthy();
      expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({ action: "apply" });
    });
    expect(await screen.findByLabelText("升级结果")).toHaveTextContent(
      "请在主机侧由运维执行升级。",
    );
  });

  it("normalizes tolerant shapes", () => {
    expect(normalizeVersion({ ok: true, core: "1", web: "2" })).toEqual({
      ok: true,
      core: "1",
      web: "2",
    });
    expect(normalizeVersion(null)).toEqual({ ok: false, core: null, web: null });
    expect(normalizeUpdate({ status: "queued" })).toEqual({ status: "queued", message: "" });
    expect(updateParams("queue")).toEqual({ action: "queue" });
  });
});
