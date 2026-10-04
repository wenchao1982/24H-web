import { useEffect, useRef } from "react";

/**
 * 订阅 Hermes 事件流（经 BFF `/api/hermes/stream`，白名单路径）。
 * 仅作「有新事件 → 触发回调」的信号；载荷由调用方按需重新拉取（简单、健壮）。
 * 环境无 WebSocket（如测试/SSR）时静默跳过。
 */
export function useHermesStream(path: string, onEvent: () => void): void {
  const callback = useRef(onEvent);
  callback.current = onEvent;

  useEffect(() => {
    if (typeof window === "undefined" || typeof WebSocket === "undefined") {
      return;
    }
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/api/hermes/stream?path=${encodeURIComponent(path)}`;
    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch {
      return;
    }
    socket.onmessage = () => callback.current();
    return () => {
      try {
        socket.close();
      } catch {
        // ignore
      }
    };
  }, [path]);
}
