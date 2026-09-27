/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SkillHost from "./SkillHost";
import type { SkillUiInfo } from "./skillhost";

const skill: SkillUiInfo = {
  id: "hello-ui",
  title: "Hello UI",
  entry: "index.html",
  host: "iframe",
  capabilities: ["callModel"],
  permissions: ["model:call"],
};

function stubInvoke(body: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(body),
    })) as unknown as typeof fetch,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("SkillHost", () => {
  it("mounts a sandboxed iframe and sends host.init on load", () => {
    render(<SkillHost skill={skill} />);

    const iframe = screen.getByTitle("Hello UI") as HTMLIFrameElement;
    expect(iframe.getAttribute("sandbox")).toBe("allow-scripts");
    expect(iframe.getAttribute("src")).toBe("/skill-ui/hello-ui/index.html");

    const contentWindow = iframe.contentWindow;
    expect(contentWindow).not.toBeNull();
    const postSpy = vi.spyOn(contentWindow as Window, "postMessage");

    fireEvent.load(iframe);

    expect(postSpy).toHaveBeenCalledWith(
      expect.objectContaining({ __24os: true, type: "host.init" }),
      "*",
    );
  });

  it("brokers a postMessage RPC request to the BFF and replies by id", async () => {
    stubInvoke({ ok: true, result: { text: "hi" } });
    render(<SkillHost skill={skill} />);

    const iframe = screen.getByTitle("Hello UI") as HTMLIFrameElement;
    const contentWindow = iframe.contentWindow as Window;
    const postSpy = vi.spyOn(contentWindow, "postMessage");

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { __24os: true, id: "req-1", method: "callModel", params: { prompt: "hi" } },
        source: contentWindow,
      }),
    );

    await waitFor(() =>
      expect(postSpy).toHaveBeenCalledWith(
        expect.objectContaining({ __24os: true, id: "req-1", ok: true, result: { text: "hi" } }),
        "*",
      ),
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/skill-host/invoke",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("ignores messages from a different source", async () => {
    stubInvoke({ ok: true, result: {} });
    render(<SkillHost skill={skill} />);

    const iframe = screen.getByTitle("Hello UI") as HTMLIFrameElement;
    const postSpy = vi.spyOn(iframe.contentWindow as Window, "postMessage");

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { __24os: true, id: "req-2", method: "callModel", params: { prompt: "x" } },
        source: window,
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(postSpy).not.toHaveBeenCalled();
  });
});
