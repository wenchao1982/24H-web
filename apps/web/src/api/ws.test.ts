import { describe, expect, it } from "vitest";
import { wsUrl } from "./ws";

describe("wsUrl", () => {
  it("maps an http origin to ws", () => {
    expect(wsUrl("http://localhost:5173")).toBe("ws://localhost:5173/api/hermes/ws");
  });

  it("maps an https origin to wss", () => {
    expect(wsUrl("https://work.example.com")).toBe("wss://work.example.com/api/hermes/ws");
  });

  it("honours a base path", () => {
    expect(wsUrl("http://localhost:5173", "/24h")).toBe("ws://localhost:5173/24h/api/hermes/ws");
  });
});
