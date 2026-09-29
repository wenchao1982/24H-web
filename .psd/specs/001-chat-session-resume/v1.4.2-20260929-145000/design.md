# Design (patch v1.4.2): handler 注册可注销 + 连接幂等
> Spec ID: 001-chat-session-resume | Version: v1.4.2-20260929-145000 | Parent: v1.4.1

## 1. API 变更
```ts
export type Unsubscribe = () => void;
export interface Gateway {
  connect(url?: string): Promise<void>;
  request<T = unknown>(method: string, params?: GatewayEventPayload): Promise<T>;
  on(type: string, handler: GatewayEventHandler): Unsubscribe;               // 新增返回值
  onServerRequest(method: string, handler: GatewayServerRequestHandler): Unsubscribe; // 新增返回值
  close(): void;
}
```
`GatewayClient.on`：
```ts
on(type, handler): Unsubscribe {
  const set = this.handlers.get(type) ?? new Set();
  set.add(handler);
  this.handlers.set(type, set);
  return () => {
    set.delete(handler);
    if (set.size === 0) this.handlers.delete(type);
  };
}
```
`onServerRequest` 同构。

## 2. 连接幂等
```ts
private connectPromise: Promise<void> | null = null;
connect(url = wsUrl(location.origin)): Promise<void> {
  if (this.connectPromise) return this.connectPromise;
  const p = /* 既有实现 */;
  this.connectPromise = p.catch((e) => { this.connectPromise = null; throw e; });
  return this.connectPromise;
}
close() { this.ws?.close(); this.ws = null; this.connectPromise = null; }
```

## 3. effect cleanup
`ChatPage.tsx`：
```ts
useEffect(() => {
  const offs = [
    gateway.on("message.delta", ...),
    gateway.on("message.complete", ...),
    /* tool.*, thinking, done, error */
  ];
  return () => offs.forEach((off) => off());
}, [activePair, gateway, nextId]);

useEffect(() => {
  const offs = REQUEST_KINDS.map((kind) => gateway.onServerRequest(kind, ...));
  return () => offs.forEach((off) => off());
}, [gateway, nextId]);
```
`NotificationsProvider.tsx` 同样处理 `onServerRequest` 与 `on("done")`。

## 4. 影响面
- 修复 StrictMode 下的重复气泡与 handler 累积；
- 修复每挂载 2 次 `connect()` 造成的多 WebSocket 泄漏；
- 生产构建亦受益于连接幂等（不再多开 socket）。

## 5. 测试
- `ChatPage.strictmode.test.tsx`：StrictMode 下 `message.complete` 注册一次、气泡一个（由失败转为通过）。
- `ws.test.ts`：二次 `connect()` 仅一个 WebSocket；`on()` 返回的 unsubscribe 生效。
