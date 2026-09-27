/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EventHooksPanel from "./EventHooksPanel";
import { applyHookToggle, normalizeHooks } from "./hooks";

interface Call {
  method: string;
  body: string | null;
}

function stubFetch(config: unknown): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit = {}) => {
      const method = (init.method ?? "GET").toUpperCase();
      calls.push({ method, body: typeof init.body === "string" ? init.body : null });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(method === "GET" ? { config } : {}),
      };
    }) as unknown as typeof fetch,
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("EventHooksPanel T23.7 Event Hooks", () => {
  it("lists hooks and toggles enabled", async () => {
    const calls = stubFetch({
      hooks: { notify: { event: "app.installed", enabled: true, command: "echo hi" } },
    });
    render(<EventHooksPanel />);

    expect(await screen.findByText("notify")).toBeInTheDocument();
    expect(screen.getByText("app.installed")).toBeInTheDocument();
    expect(screen.getByText("shell")).toBeInTheDocument();
    const toggle = screen.getByLabelText("启用钩子 notify");
    expect(toggle).toBeChecked();

    await userEvent.setup().click(toggle);

    await waitFor(() => {
      const put = calls.find((call) => call.method === "PUT");
      expect(put).toBeTruthy();
      const parsed = JSON.parse(put?.body ?? "{}") as {
        hooks?: { notify?: { enabled?: boolean; command?: string } };
      };
      expect(parsed.hooks?.notify?.enabled).toBe(false);
      expect(parsed.hooks?.notify?.command).toBe("echo hi");
    });
  });
});

describe("hooks normalizer", () => {
  it("handles object, array and boolean forms", () => {
    expect(normalizeHooks({ hooks: { a: true } }).entries).toEqual([
      { id: "a", name: "a", event: "", enabled: true, shell: false },
    ]);
    expect(
      normalizeHooks({ hooks: [{ name: "b", event: "x", disabled: true }] }).entries,
    ).toEqual([{ id: "0", name: "b", event: "x", enabled: false, shell: false }]);
    expect(normalizeHooks({}).entries).toEqual([]);
  });

  it("applies toggles for object and array forms", () => {
    const objectState = normalizeHooks({ hooks: { a: { enabled: true } } });
    expect(applyHookToggle(objectState, "a", false)).toEqual({ a: { enabled: false } });

    const arrayState = normalizeHooks({ hooks: [{ name: "b", enabled: true }] });
    expect(applyHookToggle(arrayState, "0", false)).toEqual([{ name: "b", enabled: false }]);
  });
});
