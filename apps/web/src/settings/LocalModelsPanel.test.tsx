import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LocalModelsPanel from "./LocalModelsPanel";
import {
  buildLocalModelAction,
  normalizeCatalog,
  normalizeLocalModels,
  normalizeModelState,
} from "./localModels";

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

const STATUS = {
  models: [{ id: "llama3", name: "Llama 3", status: "stopped", size: "4.2 GB" }],
};

const CATALOG = {
  models: [
    { id: "qwen2", name: "Qwen2", size: "7 GB" },
    { id: "llama3", name: "Llama 3", installed: true },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LocalModelsPanel T18.1 本地模型", () => {
  it("renders installed models with state and the catalog", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch([
        { path: "/api/hermes/local-models/status", method: "GET", status: 200, body: STATUS },
        { path: "/api/hermes/local-models/catalog", method: "GET", status: 200, body: CATALOG },
      ]),
    );

    render(<LocalModelsPanel />);

    expect((await screen.findAllByText("Llama 3")).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText("Llama 3 状态")).toHaveTextContent("已停止");
    expect(screen.getByText("Qwen2")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "启动 Llama 3" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "下载 Llama 3" }),
    ).toBeDisabled();
  });

  it("posts the start action with the model id", async () => {
    const fetchMock = stubFetch([
      { path: "/api/hermes/local-models/status", method: "GET", status: 200, body: STATUS },
      { path: "/api/hermes/local-models/catalog", method: "GET", status: 200, body: CATALOG },
      { path: "/api/hermes/local-models/start", method: "POST", status: 200, body: { ok: true } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<LocalModelsPanel />);
    await screen.findAllByText("Llama 3");
    await user.click(screen.getByRole("button", { name: "启动 Llama 3" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (entry) =>
          String(entry[0]).endsWith("/api/hermes/local-models/start") &&
          (entry[1] as RequestInit | undefined)?.method === "POST",
      );
      expect(call).toBeTruthy();
      expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({ id: "llama3" });
    });
    expect(await screen.findByText("已启动 llama3")).toBeInTheDocument();
  });

  it("normalizes tolerant shapes and action bodies", () => {
    expect(normalizeModelState("RUNNING")).toBe("running");
    expect(normalizeModelState("pulling")).toBe("downloading");
    expect(normalizeModelState("idle")).toBe("stopped");
    expect(normalizeModelState("weird")).toBe("unknown");
    expect(normalizeLocalModels(["mistral"])).toEqual([
      { id: "mistral", name: "mistral", state: "unknown" },
    ]);
    expect(normalizeCatalog(null)).toEqual([]);
    expect(buildLocalModelAction("download", "qwen2")).toEqual({ id: "qwen2" });
  });
});
