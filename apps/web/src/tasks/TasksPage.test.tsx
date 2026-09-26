import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TasksPage T9.1 任务列表", () => {
  it("renders cron jobs with schedule/next run/last status/enabled", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch([
        {
          path: "/api/hermes/cron/jobs",
          method: "GET",
          status: 200,
          body: {
            jobs: [
              {
                id: "daily-report",
                schedule: "0 9 * * *",
                next_run: "2026-09-28T09:00:00Z",
                last_status: "ok",
                enabled: true,
              },
              {
                id: "cleanup",
                schedule: "*/30 * * * *",
                next_run: "2026-09-27T10:00:00Z",
                last_status: "error",
                enabled: false,
              },
            ],
          },
        },
      ]),
    );

    render(<TasksPage />);

    expect(await screen.findByText("daily-report")).toBeInTheDocument();
    expect(screen.getByText("0 9 * * *")).toBeInTheDocument();
    expect(screen.getByText("2026-09-28T09:00:00Z")).toBeInTheDocument();
    expect(screen.getByText("ok")).toBeInTheDocument();
    expect(screen.getByText("cleanup")).toBeInTheDocument();
    expect(screen.getByText("已启用")).toBeInTheDocument();
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
