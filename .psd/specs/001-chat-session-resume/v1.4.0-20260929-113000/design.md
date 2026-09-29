# Design: 会话身份对与有界自动 resume
> Spec ID: 001-chat-session-resume | Phase: design | Workflow: bugfix | Version: v1.4.0-20260929-113000 | Parent: v1.3.0

## 1. 不变量
| ID | 说明 |
| --- | --- |
| ID-1 | `runtimeId` 仅来自 resume/create 回包；`normalizeResumedId` 只接受 `session_id`；失败即失败（禁止 fail-open） |
| ID-2 | 任何 runtime-id RPC 前必须 `identity != null && identity.storedId === activeIdRef.current` |
| ID-3 | 提交 `setIdentity` 前必须复核 `activeIdRef.current === storedId`（乱序守卫；create 同样适用） |
| ID-4 | 同一 storedId 的并发 resume 去重（in-flight promise） |
| ID-5 | 逐行操作与活动身份解耦（REQ-009） |
| ID-6 | `resume` 入参恒为 stored id；`delete` 用 stored id；`workspace.move` 用 `session_key` |

## 2. 身份模型
```ts
export interface SessionIdentity { storedId: string; runtimeId: string; }
```
| 来源 | storedId | runtimeId |
| --- | --- | --- |
| `session.list` 行 | `id` | —（resume 后取得） |
| `session.resume` 回包 | 请求入参 | `session_id` |
| `session.create` 回包 | `stored_session_id` | `session_id` |

## 3. 关键实现（ChatPage.tsx）
```ts
const activePair = () => {
  const p = identityRef.current;
  return p && p.storedId === activeIdRef.current ? p : null;   // ID-2
};

const resumeRuntime = useCallback(async (storedId: string): Promise<string> => {   // ID-1/ID-4
  const inflight = attachInFlightRef.current.get(storedId);
  if (inflight) return inflight;
  const p = (async () => {
    const result = await gateway.request("session.resume", { session_id: storedId });
    const runtimeId = normalizeResumedId(result);               // 仅 session_id
    if (!runtimeId) throw new Error("会话恢复失败：响应缺少 session_id");
    return runtimeId;
  })();
  attachInFlightRef.current.set(storedId, p);
  try { return await p; } finally { attachInFlightRef.current.delete(storedId); }
}, [gateway]);

const attachSession = useCallback(async (storedId: string): Promise<SessionIdentity> => {
  const runtimeId = await resumeRuntime(storedId);
  const pair = { storedId, runtimeId };
  if (activeIdRef.current === storedId) { setIdentity(pair); identityRef.current = pair; }   // ID-3
  return pair;
}, [resumeRuntime]);

const selectSession = useCallback((id: string) => {
  setActiveId(id); activeIdRef.current = id; setItems([]);
  setIdentity(null); identityRef.current = null;                 // 同步清空（ID-2）
  attachSession(id).catch(() => { if (activeIdRef.current === id) setError("无法恢复会话"); });
}, [attachSession]);
```
- `onResume={(id) => selectSession(id)}`；删除旧 `resumeSession`（REQ-010）。
- `createSession`（REQ-006，含 ID-3）：
```ts
const ids = normalizeCreatedIdentity(await gateway.request("session.create", {}));
if (!ids) { setError("无法新建会话"); return; }
setActiveId(ids.storedId); activeIdRef.current = ids.storedId;   // 先确立目标
setIdentity(ids); identityRef.current = ids;                     // 回包即身份（零 resume）
setSessions(cur => cur.some(s => s.id === ids.storedId) ? cur : [{ id: ids.storedId, title: "新会话" }, ...cur]);
setItems([]);
```
- `renameSession(targetStoredId, title)`（REQ-009）：
```ts
const active = activePair();
const runtimeId =
  active && active.storedId === targetStoredId
    ? active.runtimeId                       // T === A：复用现身份，不重 resume
    : await resumeRuntime(targetStoredId);   // T !== A：临时取目标 runtime，不提交 identity
await gateway.request("session.title", { session_id: runtimeId, title });
setSessions(cur => cur.map(s => s.id === targetStoredId ? { ...s, title } : s));
```
- `deleteSession(targetStoredId)`：`session.delete { session_id: targetStoredId }`（stored）。
- `handleSend`：`activePair()` 为空则 `attachSession(activeIdRef.current)`；守卫后再发；4001 用发送时 storedId 重试一次；切换则丢弃并 `setRunning(false)`。
- `handleStop` / 附件（`file.attach`/`image.attach`/`image.attach_bytes`/`pdf.attach`/`clipboard.paste`）/ `SubagentsPanel sessionId`：一律 `activePair()?.runtimeId`；为空则不动作。
- 事件匹配（ID-1 的 camelCase 回退，REQ-011）：
```ts
export function matchesRuntime(payload: Record<string, unknown>, runtimeId: string | null): boolean {
  const id = payload.session_id ?? payload.sessionId;
  return typeof runtimeId === "string" && id === runtimeId;
}
```
  终止事件：`done`/`error` 若无 `session_id` 与 `sessionId`，仅 `setRunning(false)`（不 append）——单会话假设下避免卡死。
- `session.events.since` effect：deps `[identity?.runtimeId, activeId, gateway]`；开头 `if (!identity || identity.storedId !== activeId) return;`；请求 `{session_id: identity.runtimeId}`。
- `workspace.move`：`{ session_key: storedId, cwd }`（ID-6）。
- `?session=` 深链 effect：等价 `selectSession(target)`（REQ-007）。

## 4. types.ts
```ts
export function normalizeResumedId(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  return str((result as Record<string, unknown>).session_id) ?? null;      // 不得 ?? id
}
export function normalizeCreatedIdentity(result: unknown): SessionIdentity | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  const storedId = str(r.stored_session_id); const runtimeId = str(r.session_id);
  return storedId && runtimeId ? { storedId, runtimeId } : null;           // 两者缺一不可
}
export function matchesRuntime(payload: Record<string, unknown>, runtimeId: string | null): boolean {
  const id = payload.session_id ?? payload.sessionId;
  return typeof runtimeId === "string" && id === runtimeId;
}
```
> 注：客户端**不强制** `runtimeId !== storedId`。该性质由服务端保证（`methods_session.py:65-67` 运行时 id 为 `uuid4().hex[:8]`），客户端唯一要求是 R 取自回包。

## 5. ws.ts
rejection 附带 `code`；`isSessionNotFound(error)` = `code===4001 || /session not found/i`。

## 6. 测试辅助与既有用例订正（必做，否则 `check` 红）
- `fakeGateway` 默认（当测试 handler 未给出非空结果时生效）：`session.resume` → `{ session_id: "runtime:" + 请求 stored id }`（刻意 R≠S）；`session.create` → `{ session_id: "runtime:new", stored_session_id: "stored:new" }`。
- **既有断言订正**（改为 runtime id）：`prompt.submit`(`ChatPage.test.tsx:108`)、`session.interrupt`(`:245`)、`session.title`(`:295`)、`session.events.since`(`:351`)、`file.attach`(`:368`)、`subagent.list`(`:546`)。
- **`session.resume`(`:308`) 断言保持 stored id 不变**（其入参即 stored id）——仅其 fake 回包需返回 `session_id`。
- **`session.create` 用例(`:78-91`)必须补齐 `stored_session_id`**，否则 `normalizeCreatedIdentity` 返回 null → 新建失败断言红。
- `workspace.move`(`:515`) 断言改为 `session_key`。

## 7. 错误处理
| 场景 | 行为 |
| --- | --- |
| resume 缺 `session_id` | identity=null，报错；不用 stored id 继续 |
| resume 返回 4001 | 不递归；报错 |
| 迟到响应（含 create） | 丢弃（ID-3） |
| submit 4001 | 发送时 storedId resume + 一次重试 |
| 重试期间切换 | 丢弃；`setRunning(false)` |
| 非 4001 | 不重试，直接提示 |
| identity 为空 | send/stop/attach/subagents 不动作或禁用并提示 |
| 终止事件无 id | `setRunning(false)`，不 append |
