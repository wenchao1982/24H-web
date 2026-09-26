import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DetailsPanel, { type DetailsTab } from "./DetailsPanel";

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

function Harness() {
  const [tab, setTab] = useState<DetailsTab>("files");
  return <DetailsPanel tab={tab} onTabChange={setTab} />;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DetailsPanel T11 面板联动", () => {
  it("opens a file in the files tab then previews it in the preview tab", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch([
        {
          path: "/api/hermes/files",
          method: "GET",
          status: 200,
          body: { files: [{ name: "notes.txt", path: "notes.txt", type: "file" }] },
        },
        {
          path: "/api/hermes/files/read",
          method: "GET",
          status: 200,
          body: { content: "hello world", path: "notes.txt" },
        },
      ]),
    );
    const user = userEvent.setup();

    render(<Harness />);

    await user.click(await screen.findByRole("button", { name: /notes\.txt/ }));
    await user.click(screen.getByRole("tab", { name: "预览" }));

    expect(await screen.findByLabelText("预览内容")).toHaveTextContent("hello world");
  });
});
