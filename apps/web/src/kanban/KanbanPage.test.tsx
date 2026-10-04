import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import KanbanPage from "./KanbanPage";
import { BOARD_COLUMNS, normalizeBoard, normalizeBoardList, normalizeTaskDetail } from "./kanban";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("kanban normalizeBoard", () => {
  it("buckets columns[].tasks and always fills the 8 columns", () => {
    const board = normalizeBoard({
      columns: [
        { name: "todo", tasks: [{ id: "t1", title: "A", status: "todo" }] },
        { name: "running", tasks: [{ id: "t2", title: "B" }] },
      ],
      assignees: ["hermes"],
    });
    expect(board.columns.todo.map((task) => task.id)).toEqual(["t1"]);
    expect(board.columns.running.map((task) => task.id)).toEqual(["t2"]);
    for (const column of BOARD_COLUMNS) {
      expect(Array.isArray(board.columns[column])).toBe(true);
    }
    expect(board.assignees).toEqual(["hermes"]);
  });

  it("falls back to top-level tasks and coerces unknown status to todo", () => {
    const board = normalizeBoard({ tasks: [{ id: "x", title: "X", status: "weird" }] });
    expect(board.columns.todo.map((task) => task.id)).toEqual(["x"]);
  });

  it("drops entries without an id", () => {
    const board = normalizeBoard({ columns: [{ name: "todo", tasks: [{ title: "no id" }] }] });
    expect(board.columns.todo).toHaveLength(0);
  });
});

describe("kanban normalizeTaskDetail", () => {
  it("normalizes task/comments/attachments/runs/links tolerantly", () => {
    const detail = normalizeTaskDetail({
      task: { id: "t1", title: "T", status: "ready", assignee: "hermes" },
      comments: [{ id: "c1", author: "alice", body: "hi" }],
      attachments: [{ id: "a1", filename: "x.png", size: 12 }],
      runs: [{ id: 7, status: "done", summary: "ok" }],
      links: { parents: ["p1"], children: [] },
      link_tasks: [{ id: "p1", title: "Parent", status: "done" }],
    });
    expect(detail.task).toMatchObject({ id: "t1", status: "ready" });
    expect(detail.comments).toEqual([{ id: "c1", author: "alice", body: "hi" }]);
    expect(detail.attachments[0]).toMatchObject({ id: "a1", filename: "x.png", size: 12 });
    expect(detail.runs[0]).toMatchObject({ id: "7", status: "done" });
    expect(detail.links).toEqual({ parents: ["p1"], children: [] });
    expect(detail.linkTasks[0]).toMatchObject({ id: "p1", title: "Parent" });
  });

  it("returns an empty detail on garbage", () => {
    expect(normalizeTaskDetail(null).task).toBeNull();
    expect(normalizeTaskDetail("nope").comments).toEqual([]);
  });
});

describe("kanban normalizeBoardList", () => {
  it("normalizes boards + current", () => {
    const list = normalizeBoardList({
      boards: [
        { slug: "default", name: "Default", total: 3, is_current: true },
        { slug: "q4", total: 1 },
      ],
      current: "default",
    });
    expect(list.current).toBe("default");
    expect(list.boards).toEqual([
      { slug: "default", name: "Default", total: 3, isCurrent: true },
      { slug: "q4", name: "q4", total: 1, isCurrent: false },
    ]);
  });

  it("tolerates garbage", () => {
    expect(normalizeBoardList(null).boards).toEqual([]);
  });
});

describe("KanbanPage", () => {
  it("renders the 8 columns and creates a task", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.includes("/plugins/kanban/board") && method === "GET") {
        return jsonResponse({
          columns: [
            {
              name: "todo",
              tasks: [{ id: "t1", title: "已有任务", status: "todo", assignee: "hermes" }],
            },
          ],
          assignees: ["hermes"],
        });
      }
      if (url.includes("/plugins/kanban/tasks") && method === "POST") {
        return jsonResponse({ task: { id: "t2" } });
      }
      if (url.includes("/plugins/kanban/tasks/t1") && method === "GET") {
        return jsonResponse({
          task: { id: "t1", title: "已有任务", status: "todo", assignee: "hermes" },
          comments: [{ id: "c1", author: "alice", body: "第一条评论" }],
          attachments: [],
          runs: [],
          links: { parents: [], children: [] },
          link_tasks: [],
        });
      }
      return { ok: false, status: 404, text: async () => "" } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<KanbanPage />);

    expect(await screen.findByText("已有任务")).toBeInTheDocument();
    for (const name of ["Triage", "Todo", "Scheduled", "Ready", "Running", "Blocked", "Review", "Done"]) {
      expect(screen.getByRole("region", { name })).toBeInTheDocument();
    }

    await user.type(screen.getByLabelText("新任务标题"), "新任务");
    await user.click(screen.getByRole("button", { name: "新建任务" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find((entry) =>
        String(entry[0]).includes("/plugins/kanban/tasks"),
      );
      expect(call).toBeTruthy();
      expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({ title: "新任务" });
    });
  });

  it("opens task detail when a card is clicked", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.includes("/plugins/kanban/board") && method === "GET") {
        return jsonResponse({
          columns: [{ name: "todo", tasks: [{ id: "t1", title: "已有任务", status: "todo" }] }],
        });
      }
      if (url.includes("/plugins/kanban/tasks/t1") && method === "GET") {
        return jsonResponse({
          task: { id: "t1", title: "已有任务", status: "todo" },
          comments: [{ id: "c1", author: "alice", body: "第一条评论" }],
          attachments: [],
          runs: [],
          links: { parents: [], children: [] },
          link_tasks: [],
        });
      }
      return { ok: false, status: 404, text: async () => "" } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<KanbanPage />);

    await user.click(await screen.findByRole("button", { name: "已有任务" }));

    expect(await screen.findByRole("complementary", { name: "任务详情" })).toBeInTheDocument();
    expect(await screen.findByText("第一条评论")).toBeInTheDocument();
  });

  it("switches boards via ?board=", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/plugins/kanban/boards")) {
        return jsonResponse({
          boards: [
            { slug: "default", name: "Default", total: 1, is_current: true },
            { slug: "q4", name: "Q4", total: 1, is_current: false },
          ],
          current: "default",
        });
      }
      if (url.includes("?board=q4")) {
        return jsonResponse({
          columns: [{ name: "todo", tasks: [{ id: "q1", title: "Q4 任务", status: "todo" }] }],
        });
      }
      if (url.includes("/plugins/kanban/board")) {
        return jsonResponse({
          columns: [{ name: "todo", tasks: [{ id: "d1", title: "默认任务", status: "todo" }] }],
        });
      }
      return { ok: false, status: 404, text: async () => "" } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<KanbanPage />);

    expect(await screen.findByText("默认任务")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /Q4/ }));
    expect(await screen.findByText("Q4 任务")).toBeInTheDocument();
  });
});
