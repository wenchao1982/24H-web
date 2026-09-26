import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PreviewPanel from "./PreviewPanel";

function stubRead(body: unknown) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  })) as unknown as typeof fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PreviewPanel T11.3 预览面板", () => {
  it("renders a text file preview", async () => {
    vi.stubGlobal("fetch", stubRead({ content: "hello world", path: "notes.txt" }));

    render(<PreviewPanel path="notes.txt" />);

    expect(await screen.findByLabelText("预览内容")).toHaveTextContent("hello world");
  });

  it("renders HTML in a sandboxed iframe", async () => {
    vi.stubGlobal(
      "fetch",
      stubRead({ content: "<!doctype html><html><body><h1>Hi</h1></body></html>" }),
    );

    render(<PreviewPanel path="index.html" />);

    const frame = (await screen.findByTitle("预览 index.html")) as HTMLIFrameElement;
    expect(frame.tagName).toBe("IFRAME");
    expect(frame).toHaveAttribute("sandbox", "");
    expect(frame.getAttribute("srcdoc")).toContain("<h1>Hi</h1>");
  });

  it("prompts to choose a file when none is selected", () => {
    vi.stubGlobal("fetch", stubRead({}));
    render(<PreviewPanel path={null} />);
    expect(screen.getByText("请选择文件以预览。")).toBeInTheDocument();
  });
});
