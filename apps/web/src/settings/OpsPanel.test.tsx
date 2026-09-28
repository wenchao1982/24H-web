import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OpsPanel from "./OpsPanel";
import { buildOpsBody, normalizeOpsResult } from "./ops";

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
  vi.restoreAllMocks();
});

describe("OpsPanel T18.4 运维", () => {
  it("runs doctor after confirmation and renders the report", async () => {
    const fetchMock = stubFetch([
      {
        path: "/api/hermes/ops/doctor",
        method: "POST",
        status: 200,
        body: { status: "ok", report: "全部检查通过" },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<OpsPanel />);
    await user.click(screen.getByRole("button", { name: "运行系统诊断" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "确认执行" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (entry) =>
          String(entry[0]).endsWith("/api/hermes/ops/doctor") &&
          (entry[1] as RequestInit | undefined)?.method === "POST",
      );
      expect(call).toBeTruthy();
    });
    expect(await screen.findByText("全部检查通过")).toBeInTheDocument();
  });

  it("does not call the endpoint when the confirmation is dismissed", async () => {
    const fetchMock = stubFetch([]);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<OpsPanel />);
    await user.click(screen.getByRole("button", { name: "运行备份" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("builds bodies and normalizes results", () => {
    expect(buildOpsBody("doctor")).toEqual({});
    expect(buildOpsBody("import", " /tmp/b ")).toEqual({ path: "/tmp/b" });
    expect(normalizeOpsResult("done")).toEqual({ status: "ok", output: "done" });
    expect(normalizeOpsResult({ status: "warn", message: "有问题" })).toEqual({
      status: "warn",
      output: "有问题",
    });
  });
});
