import { randomBytes } from "node:crypto";
import WebSocket from "ws";
import { ApiError } from "../http/errors";
import { getHermesToken, hermesUpstream } from "./client";

const ONESHOT_TIMEOUT_MS = 60_000;

export interface OneshotResult {
  text: string;
  via: "gateway";
}

/**
 * L1 `llm.oneshot` 薄封装：经 `hermes serve` 的 `/api/ws` 发一条 JSON-RPC 请求。
 * token 只在服务端使用，永不回传客户端。
 */
export async function llmOneshot(
  baseUrl: string,
  params: { prompt: string; model?: string },
): Promise<OneshotResult> {
  const upstream = hermesUpstream({ hermesBaseUrl: baseUrl });
  const token = await getHermesToken(upstream.baseUrl);
  const socket = new WebSocket(
    `${upstream.wsBaseUrl}/api/ws?token=${encodeURIComponent(token)}`,
  );
  const id = randomBytes(8).toString("hex");

  return new Promise<OneshotResult>((resolve, reject) => {
    const finish = (action: () => void) => {
      clearTimeout(timer);
      try {
        socket.close();
      } catch {
        // ignore
      }
      action();
    };

    const timer = setTimeout(() => {
      finish(() => reject(new ApiError(504, "LLM_ONESHOT_TIMEOUT", "单次补全超时")));
    }, ONESHOT_TIMEOUT_MS);

    socket.on("open", () => {
      const request = {
        jsonrpc: "2.0",
        id,
        method: "llm.oneshot",
        params: params.model ? { prompt: params.prompt, model: params.model } : { prompt: params.prompt },
      };
      socket.send(JSON.stringify(request));
    });

    socket.on("message", (data) => {
      let message: { id?: unknown; result?: unknown; error?: { message?: string } };
      try {
        message = JSON.parse(data.toString()) as typeof message;
      } catch {
        return;
      }
      if (message.id !== id) {
        return;
      }
      if (message.error) {
        const detail = message.error.message ?? "单次补全失败";
        finish(() => reject(new ApiError(502, "LLM_ONESHOT_FAILED", detail)));
        return;
      }
      const result = (message.result ?? {}) as { text?: unknown };
      finish(() =>
        resolve({ text: typeof result.text === "string" ? result.text : "", via: "gateway" }),
      );
    });

    socket.on("error", () => {
      finish(() => reject(new ApiError(502, "HERMES_UNREACHABLE", "无法连接 Hermes 网关")));
    });
  });
}
