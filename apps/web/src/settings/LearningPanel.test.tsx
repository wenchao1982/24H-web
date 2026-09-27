import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import LearningPanel from "./LearningPanel";
import { normalizeCurator, normalizeGraph } from "./learning";

interface StubRoute {
  path: string;
  body: unknown;
}

function stubFetch(handlers: StubRoute[]) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const hit = handlers.find((handler) => url.split("?")[0].endsWith(handler.path));
    if (!hit) {
      return { ok: false, status: 404, text: async () => "" } as Response;
    }
    return { ok: true, status: 200, text: async () => JSON.stringify(hit.body) } as Response;
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LearningPanel T18.15 学习/策展", () => {
  it("renders the curator items and the learning journey graph", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch([
        {
          path: "/api/hermes/curator",
          body: { items: [{ title: "命名规范", kind: "lesson", summary: "使用 kebab-case" }] },
        },
        {
          path: "/api/hermes/learning/graph",
          body: {
            nodes: [
              { id: "a", label: "基础" },
              { id: "b", label: "进阶" },
            ],
            edges: [{ from: "a", to: "b", label: "前置" }],
          },
        },
      ]),
    );

    render(<LearningPanel />);

    expect(await screen.findByText("命名规范")).toBeInTheDocument();
    expect(screen.getByText("使用 kebab-case")).toBeInTheDocument();
    expect(screen.getByText("基础")).toBeInTheDocument();
    expect(screen.getByText("进阶")).toBeInTheDocument();
    expect(screen.getByText("基础 → 进阶 (前置)")).toBeInTheDocument();
  });

  it("normalizes tolerant shapes", () => {
    expect(normalizeCurator(["lesson"])).toEqual([{ title: "lesson" }]);
    expect(normalizeCurator({ lessons: [{ name: "L", type: "tip" }] })).toEqual([
      { title: "L", kind: "tip", summary: undefined, at: undefined },
    ]);
    expect(normalizeGraph({ nodes: ["a"], edges: [{ source: "a", target: "a" }] })).toEqual({
      nodes: [{ id: "a", label: "a", kind: undefined }],
      edges: [{ from: "a", to: "a", label: undefined }],
    });
  });
});
