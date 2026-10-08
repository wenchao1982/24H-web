import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TasksPage from "./TasksPage";

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

const TWO_JOBS = {
  jobs: [
    {
      id: "daily-report",
      schedule: "0 9 * * *",
      next_run: "2026-09-28T09:00:00Z",
      last_status: "ok",
      enabled: true,
    },
    { id: "cleanup", schedule: "*/30 * * * *", last_status: "error", enabled: false },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TasksPage T9.1 任务列表（列表 + 详情）", () => {
  it("lists jobs and shows the selected job detail", async () => {
    vi.stubGlobal("fetch", stubFetch([{ path: "/api/hermes/cron/jobs", method: "GET", status: 200, body: TWO_JOBS }]));
    const user = userEvent.setup();
    render(<TasksPage />);

    expect((await screen.findAllByText("daily-report")).length).toBeGreaterThan(0);
    expect(screen.getByText("cleanup")).toBeInTheDocument();
    expect(screen.getAllByText("0 9 * * *").length).toBeGreaterThan(0);

    // 详情默认选中第一个任务。
    expect(screen.getByText("2026-09-28T09:00:00Z")).toBeInTheDocument();
    expect(screen.getByText("ok")).toBeInTheDocument();
    expect(screen.getByText("已启用")).toBeInTheDocument();

    // 选中第二个任务 → 状态切到已暂停。
    await user.click(screen.getByText("cleanup"));
    expect(screen.getByText("已暂停")).toBeInTheDocument();
  });

  it("shows an empty state and a graceful error state", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch([{ path: "/api/hermes/cron/jobs", method: "GET", status: 200, body: { jobs: [] } }]),
    );
    render(<TasksPage />);
    expect(await screen.findByText("暂无定时任务。")).toBeInTheDocument();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 502,
        text: async () => JSON.stringify({ error: "HERMES_UNREACHABLE", message: "无法连接 Hermes 上游" }),
      })) as unknown as typeof fetch,
    );
    render(<TasksPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("无法连接 Hermes 上游");
  });
});

describe("TasksPage T9.2 任务操作", () => {
  it("pauses the selected job via POST /cron/jobs/:id/pause", async () => {
    const fetchMock = stubFetch([
      { path: "/api/hermes/cron/jobs", method: "GET", status: 200, body: TWO_JOBS },
      { path: "/api/hermes/cron/jobs/daily-report/pause", method: "POST", status: 200, body: { ok: true } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<TasksPage />);
    await screen.findAllByText("daily-report");
    await user.click(screen.getByRole("button", { name: "暂停" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (entry) =>
          String(entry[0]).endsWith("/api/hermes/cron/jobs/daily-report/pause") &&
          (entry[1] as RequestInit | undefined)?.method === "POST",
      );
      expect(call).toBeTruthy();
    });
  });

  it("creates a job from the modal with the exact POST body", async () => {
    const fetchMock = stubFetch([
      { path: "/api/hermes/cron/jobs", method: "GET", status: 200, body: TWO_JOBS },
      { path: "/api/hermes/cron/jobs", method: "POST", status: 201, body: { ok: true } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<TasksPage />);
    await screen.findAllByText("daily-report");
    await user.click(screen.getByRole("button", { name: "新建" }));
    await user.type(screen.getByLabelText("任务名称"), "weekly");
    await user.type(screen.getByLabelText("任务计划"), "0 0 * * 1");
    await user.click(screen.getByRole("button", { name: "新增" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (entry) =>
          String(entry[0]).endsWith("/api/hermes/cron/jobs") &&
          (entry[1] as RequestInit | undefined)?.method === "POST",
      );
      expect(call).toBeTruthy();
      expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({
        name: "weekly",
        schedule: "0 0 * * 1",
      });
    });
  });
});
