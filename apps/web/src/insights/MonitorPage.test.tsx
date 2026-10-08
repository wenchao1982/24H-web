import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import MonitorPage from "./MonitorPage";

function stubFetch(routes: { path: string; body: unknown }[]) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const hit = routes.find((route) => url.split("?")[0].endsWith(route.path));
    return {
      ok: !!hit,
      status: hit ? 200 : 404,
      text: async () => JSON.stringify(hit ? hit.body : {}),
    } as Response;
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MonitorPage (M23)", () => {
  it("renders CPU/memory/disk/process and health from system stats + status", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch([
        {
          path: "/api/hermes/system/stats",
          body: { cpu_percent: 12.4, memory: { percent: 55 }, disk: { percent: 71 }, process: { pid: 1 } },
        },
        { path: "/api/hermes/status", body: { overall: "ok", version: "v0.21.3" } },
      ]),
    );

    render(<MonitorPage />);

    expect(await screen.findByLabelText("CPU 使用率")).toHaveTextContent("12%");
    expect(screen.getByLabelText("内存使用率")).toHaveTextContent("55%");
    expect(screen.getByLabelText("磁盘使用率")).toHaveTextContent("71%");
    expect(screen.getByLabelText("进程数")).toHaveTextContent("1");
    expect(screen.getByLabelText("监控健康")).toHaveTextContent("ok");
    expect(screen.getByLabelText("版本")).toHaveTextContent("v0.21.3");
  });
});
