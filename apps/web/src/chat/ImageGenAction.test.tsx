import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ImageGenAction from "./ImageGenAction";
import { GatewayProvider } from "./GatewayProvider";
import { createFakeGateway, type FakeGateway } from "../test/fakeGateway";
import { imageParams, normalizeGeneratedImage } from "./imageGen";

function renderAction(gateway: FakeGateway) {
  return render(
    <GatewayProvider gateway={gateway}>
      <ImageGenAction />
    </GatewayProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ImageGenAction T18.6 图片生成", () => {
  it("generates an image from the prompt via the gateway", async () => {
    const gateway = createFakeGateway((method) =>
      method === "image.generate" ? { url: "https://example.com/cat.png" } : {},
    );
    renderAction(gateway);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("图片提示词"), "一只猫");
    await user.click(screen.getByRole("button", { name: "生成" }));

    await waitFor(() => {
      expect(gateway.paramsOf("image.generate")).toEqual([{ prompt: "一只猫" }]);
    });
    const img = await screen.findByRole("img", { name: "生成的图片" });
    expect(img).toHaveAttribute("src", "https://example.com/cat.png");
  });

  it("shows an error when no image is returned", async () => {
    const gateway = createFakeGateway(() => ({}));
    renderAction(gateway);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("图片提示词"), "空");
    await user.click(screen.getByRole("button", { name: "生成" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("未返回图片。");
  });

  it("normalizes tolerant shapes", () => {
    expect(normalizeGeneratedImage({ url: "https://x/y.png" })).toBe("https://x/y.png");
    expect(normalizeGeneratedImage({ images: [{ image_url: "https://x/z.png" }] })).toBe(
      "https://x/z.png",
    );
    expect(normalizeGeneratedImage({ b64_json: "QUJD" })).toBe("data:image/png;base64,QUJD");
    expect(normalizeGeneratedImage("https://x/a.png")).toBe("https://x/a.png");
    expect(normalizeGeneratedImage(null)).toBeNull();
    expect(imageParams("hi")).toEqual({ prompt: "hi" });
  });
});
