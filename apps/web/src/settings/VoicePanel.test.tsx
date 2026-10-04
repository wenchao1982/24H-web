import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VoicePanel from "./VoicePanel";
import { GatewayProvider } from "../chat/GatewayProvider";
import { createFakeGateway, type FakeGateway } from "../test/fakeGateway";
import { normalizeTtsResult, normalizeVoiceStatus, wakeStartParams } from "./voice";

function renderPanel(gateway: FakeGateway) {
  return render(
    <GatewayProvider gateway={gateway}>
      <VoicePanel />
    </GatewayProvider>,
  );
}

function impl(method: string): unknown {
  if (method === "wake.status") {
    return { available: true, enabled: false, listening: false, provider: "elevenlabs" };
  }
  if (method === "voice.tts") {
    return { url: "https://x/a.mp3" };
  }
  return {};
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("VoicePanel T18.7 语音（C04 订正：wake.status/start/stop）", () => {
  it("reads wake.status and toggles the wake word via wake.start", async () => {
    const gateway = createFakeGateway(impl);
    renderPanel(gateway);

    expect(await screen.findByLabelText("语音状态")).toHaveTextContent("唤醒词已关闭");
    expect(screen.getByLabelText("语音状态")).toHaveTextContent("elevenlabs");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "切换唤醒词" }));
    await waitFor(() => {
      expect(gateway.paramsOf("wake.start")).toEqual([{ surface: "gui", persist: true }]);
      expect(screen.getByLabelText("语音状态")).toHaveTextContent("唤醒词已开启");
    });
  });

  it("speaks via voice.tts", async () => {
    const gateway = createFakeGateway(impl);
    renderPanel(gateway);
    await screen.findByLabelText("语音状态");
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("输入要朗读的文本"), "你好");
    await user.click(screen.getByRole("button", { name: "朗读" }));
    await waitFor(() => {
      expect(gateway.paramsOf("voice.tts")).toEqual([{ text: "你好" }]);
    });
    expect(await screen.findByLabelText("合成完成")).toBeInTheDocument();
  });

  it("normalizes tolerant shapes", () => {
    expect(
      normalizeVoiceStatus({ available: true, enabled: true, listening: true, provider: "x" }),
    ).toEqual({ available: true, wake: true, listening: true, voice: "x" });
    expect(normalizeVoiceStatus(null)).toEqual({
      available: false,
      wake: false,
      listening: false,
    });
    expect(normalizeTtsResult({ audio_url: "https://x/a.mp3" })).toBe("https://x/a.mp3");
    expect(wakeStartParams()).toEqual({ surface: "gui", persist: true });
  });
});
