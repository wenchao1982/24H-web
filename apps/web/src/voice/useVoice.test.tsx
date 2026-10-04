/** @vitest-environment jsdom */
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { GatewayProvider } from "../chat/GatewayProvider";
import { createFakeGateway } from "../test/fakeGateway";
import { useVoice } from "./useVoice";

function setup(onTranscript = vi.fn()) {
  const gateway = createFakeGateway((method) =>
    method === "voice.record" ? { status: "recording" } : {},
  );
  const wrapper = ({ children }: { children: ReactNode }) => (
    <GatewayProvider gateway={gateway}>{children}</GatewayProvider>
  );
  const { result } = renderHook(() => useVoice({ onTranscript }), { wrapper });
  return { gateway, result, onTranscript };
}

describe("useVoice (M19)", () => {
  it("toggles voice.record start/stop", async () => {
    const { gateway, result } = setup();

    await act(async () => {
      result.current.toggle();
    });
    expect(gateway.paramsOf("voice.record")).toEqual([{ action: "start" }]);

    await act(async () => {
      result.current.toggle();
    });
    expect(gateway.paramsOf("voice.record")).toEqual([
      { action: "start" },
      { action: "stop" },
    ]);
  });

  it("forwards voice.transcript text (ignoring stop phrases)", () => {
    const { gateway, onTranscript } = setup();

    act(() => {
      gateway.emit("voice.transcript", { text: "  你好世界  " });
    });
    act(() => {
      gateway.emit("voice.transcript", { text: "停止", stop_phrase: true });
    });

    expect(onTranscript).toHaveBeenCalledTimes(1);
    expect(onTranscript).toHaveBeenCalledWith("你好世界");
  });

  it("accumulates voice.transcript during a listening session", async () => {
    const { gateway, result } = setup();

    await act(async () => {
      result.current.toggle();
    });
    act(() => {
      gateway.emit("voice.transcript", { text: "你好" });
    });
    act(() => {
      gateway.emit("voice.transcript", { text: "世界" });
    });

    expect(result.current.transcript).toBe("你好 世界");
  });

  it("speaks text via voice.tts", async () => {
    const { gateway, result } = setup();

    await act(async () => {
      result.current.speak("  你好  ");
    });

    expect(gateway.paramsOf("voice.tts")).toEqual([{ text: "你好" }]);
  });

  it("clears listening on voice.interrupted (barge-in)", async () => {
    const { gateway, result } = setup();

    await act(async () => {
      result.current.toggle();
    });
    expect(result.current.listening).toBe(true);

    act(() => {
      gateway.emit("voice.interrupted", {});
    });
    expect(result.current.listening).toBe(false);
  });
});
