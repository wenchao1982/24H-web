/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useOptions } from "./useOptions";
import { createFakeGateway, type FakeGateway } from "../../test/fakeGateway";

const CATALOG = {
  model: "m1",
  provider: "p",
  providers: [{ slug: "p", models: [{ id: "m1", label: "Model 1" }] }],
};

function stubWorkspaces(): ReturnType<typeof vi.fn> {
  const mock = vi.fn(
    async () =>
      ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ workspaces: [{ path: "/w/a" }] }),
      }) as Response,
  );
  vi.stubGlobal("fetch", mock);
  return mock;
}

function catalogGateway(): FakeGateway {
  return createFakeGateway((method) => (method === "model.options" ? CATALOG : {}));
}

const ME = { profiles: ["p1"], default_profile: "p1" };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useOptions TASK-006B", () => {
  it("迁移缓存键：hero → storedId 同一逻辑会话只加载一次", async () => {
    const gateway = catalogGateway();
    const fetchMock = stubWorkspaces();
    const onError = vi.fn();
    const { result, rerender } = renderHook(
      (props: { activeId: string | null }) =>
        useOptions({ gateway, me: ME, activeId: props.activeId, profile: null, onError }),
      { initialProps: { activeId: null as string | null } },
    );

    await waitFor(() => expect(result.current.models).toHaveLength(1));
    expect(gateway.paramsOf("model.options")).toHaveLength(1);

    rerender({ activeId: "s1" });

    await waitFor(() => expect(result.current.workspaces).toEqual(["/w/a"]));
    expect(gateway.paramsOf("model.options")).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("已加载但无可用 profile 时不发起任何请求并报可读错误", async () => {
    const gateway = createFakeGateway();
    const fetchMock = stubWorkspaces();
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useOptions({
        gateway,
        me: { profiles: [], default_profile: null },
        activeId: null,
        profile: null,
        onError,
      }),
    );

    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(gateway.requests).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.loading.models).toBe(false);
    expect(result.current.loading.workspaces).toBe(false);
  });

  it("会话尚未加载（me:null）时不报错也不发起请求", () => {
    const gateway = createFakeGateway();
    const fetchMock = stubWorkspaces();
    const onError = vi.fn();

    renderHook(() => useOptions({ gateway, me: null, activeId: null, profile: null, onError }));

    expect(gateway.requests).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("model.options 与 workspaces 请求都携带非空 profile", async () => {
    const gateway = catalogGateway();
    const fetchMock = stubWorkspaces();

    const { result } = renderHook(() =>
      useOptions({ gateway, me: ME, activeId: null, profile: null, onError: vi.fn() }),
    );

    await waitFor(() => expect(result.current.models).toHaveLength(1));
    expect(gateway.paramsOf("model.options")[0]).toEqual({ profile: "p1" });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("profile=p1");
  });
});
