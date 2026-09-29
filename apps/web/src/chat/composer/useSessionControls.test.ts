/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useSessionControls } from "./useSessionControls";
import { createFakeGateway, type FakeGateway } from "../../test/fakeGateway";
import type { SessionIdentity } from "../types";

const CATALOG = {
  model: "m1",
  provider: "p",
  providers: [{ slug: "p", models: [{ id: "m1", label: "Model 1" }] }],
};
const ME = { profiles: ["p1"], default_profile: "p1" };
const IDENTITY: SessionIdentity = { storedId: "s1", runtimeId: "runtime:s1" };

function stubWorkspaces(): ReturnType<typeof vi.fn> {
  const mock = vi.fn(
    async () =>
      ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ workspaces: [] }),
      }) as Response,
  );
  vi.stubGlobal("fetch", mock);
  return mock;
}

interface Overrides {
  configSet?: (params: Record<string, unknown>) => unknown;
  sessionModel?: (params: Record<string, unknown>) => unknown;
}

function makeGateway(overrides: Overrides = {}): FakeGateway {
  return createFakeGateway((method, params) => {
    if (method === "model.options") {
      return params.session_id ? (overrides.sessionModel?.(params) ?? { model: null }) : CATALOG;
    }
    if (method === "config.set") {
      return overrides.configSet?.(params) ?? {};
    }
    return {};
  });
}

interface HookArgs {
  activeId: string | null;
  identity: SessionIdentity | null;
}

function renderControls(gateway: FakeGateway, args: HookArgs = { activeId: null, identity: null }) {
  const onError = vi.fn();
  const view = renderHook(() =>
    useSessionControls({
      gateway,
      activeId: args.activeId,
      identity: args.identity,
      running: false,
      me: ME,
      itemCount: 0,
      onError,
    }),
  );
  return { ...view, onError };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useSessionControls TASK-006C 模型两级语义", () => {
  it("hero 切模型：0 次 config.set，仅写待创建参数", async () => {
    stubWorkspaces();
    const gateway = makeGateway();
    const { result } = renderControls(gateway);
    await waitFor(() => expect(result.current.options.models).toHaveLength(1));

    await act(async () => {
      await result.current.selectModel("m-b");
    });

    expect(gateway.paramsOf("config.set")).toHaveLength(0);
    expect(result.current.selection.model).toBe("m-b");
  });

  it("会话内切模型：config.set 携带 runtime id", async () => {
    stubWorkspaces();
    const gateway = makeGateway();
    const { result } = renderControls(gateway, { activeId: "s1", identity: IDENTITY });
    await waitFor(() => expect(result.current.identityReady).toBe(true));

    await act(async () => {
      await result.current.selectModel("m-b");
    });

    expect(gateway.paramsOf("config.set")).toEqual([
      { key: "model", value: "m-b", session_id: "runtime:s1" },
    ]);
    expect(result.current.modelSwitch.status).toBe("idle");
  });

  it("deferred：message.complete 后 reconcileModel 以 profile+session_id 回正", async () => {
    stubWorkspaces();
    const gateway = makeGateway({
      configSet: () => ({ deferred: true }),
      sessionModel: () => ({ model: "m-b" }),
    });
    const { result, onError } = renderControls(gateway, { activeId: "s1", identity: IDENTITY });
    await waitFor(() => expect(result.current.identityReady).toBe(true));

    await act(async () => {
      await result.current.selectModel("m-b");
    });
    expect(result.current.modelSwitch.status).toBe("deferred");

    await act(async () => {
      await result.current.reconcileModel();
    });

    const reconcileCalls = gateway
      .paramsOf("model.options")
      .filter((params) => params.session_id === "runtime:s1");
    expect(reconcileCalls).toEqual([{ profile: "p1", session_id: "runtime:s1" }]);
    expect(result.current.selection.model).toBe("m-b");
    expect(result.current.modelSwitch.status).toBe("idle");
    expect(onError).not.toHaveBeenCalled();
  });

  it("deferred 回包 model 不一致：回滚选中态并提示「切换未生效」", async () => {
    stubWorkspaces();
    const gateway = makeGateway({
      configSet: () => ({ deferred: true }),
      sessionModel: () => ({ model: "other" }),
    });
    const { result, onError } = renderControls(gateway, { activeId: "s1", identity: IDENTITY });
    await waitFor(() => expect(result.current.identityReady).toBe(true));

    await act(async () => {
      await result.current.selectModel("m-b");
    });
    await act(async () => {
      await result.current.reconcileModel();
    });

    expect(result.current.selection.model).toBe("other");
    expect(result.current.modelSwitch.status).toBe("idle");
    expect(onError).toHaveBeenCalledWith("切换未生效");
  });

  it("confirm_required：首次不落库，确认后带 confirm_expensive_model 重发", async () => {
    stubWorkspaces();
    let call = 0;
    const gateway = makeGateway({
      configSet: () => {
        call += 1;
        return call === 1 ? { confirm_required: true, confirm_message: "昂贵" } : {};
      },
    });
    const { result } = renderControls(gateway, { activeId: "s1", identity: IDENTITY });
    await waitFor(() => expect(result.current.identityReady).toBe(true));

    await act(async () => {
      await result.current.selectModel("m-b");
    });
    expect(result.current.modelSwitch.status).toBe("confirm");
    if (result.current.modelSwitch.status === "confirm") {
      expect(result.current.modelSwitch.message).toBe("昂贵");
    }

    await act(async () => {
      await result.current.confirmModel();
    });

    expect(gateway.paramsOf("config.set")).toEqual([
      { key: "model", value: "m-b", session_id: "runtime:s1" },
      { key: "model", value: "m-b", session_id: "runtime:s1", confirm_expensive_model: true },
    ]);
    expect(result.current.modelSwitch.status).toBe("idle");
  });
});

describe("useSessionControls TASK-006C 附件与发送", () => {
  it("attach 不触发任何 RPC", async () => {
    stubWorkspaces();
    const gateway = makeGateway();
    const { result } = renderControls(gateway);
    await waitFor(() => expect(result.current.options.models).toHaveLength(1));
    const before = gateway.requests.length;

    act(() => {
      result.current.attach([new File(["hello"], "a.txt", { type: "text/plain" })]);
    });

    expect(gateway.requests.length).toBe(before);
    expect(result.current.attachments).toHaveLength(1);
  });

  it("send single-flight：并发两次只发一次 session.create", async () => {
    stubWorkspaces();
    const gateway = makeGateway();
    const { result } = renderControls(gateway);
    await waitFor(() => expect(result.current.options.models).toHaveLength(1));

    await act(async () => {
      const first = result.current.send("你好");
      const second = result.current.send("你好");
      expect(second).toBe(first);
      await Promise.all([first, second]);
    });

    expect(gateway.paramsOf("session.create")).toHaveLength(1);
    expect(gateway.paramsOf("prompt.submit")).toEqual([
      { text: "你好", session_id: "runtime:new" },
    ]);
  });

  it("buildCreateParams：未选目录时省略 cwd_explicit", async () => {
    stubWorkspaces();
    const gateway = makeGateway();
    const { result } = renderControls(gateway);
    await waitFor(() => expect(result.current.options.models).toHaveLength(1));

    expect(result.current.buildCreateParams()).not.toHaveProperty("cwd_explicit");

    await act(async () => {
      await result.current.selectWorkspace("/w/a");
    });
    expect(result.current.buildCreateParams()).toEqual({ cwd: "/w/a", cwd_explicit: true });
  });

  it("会话内切工作区用 stored id 发 session.workspace.move", async () => {
    stubWorkspaces();
    const gateway = makeGateway();
    const { result } = renderControls(gateway, { activeId: "s1", identity: IDENTITY });
    await waitFor(() => expect(result.current.identityReady).toBe(true));

    await act(async () => {
      await result.current.selectWorkspace("/w/b");
    });

    expect(gateway.paramsOf("session.workspace.move")).toEqual([
      { session_key: "s1", cwd: "/w/b" },
    ]);
  });
});
