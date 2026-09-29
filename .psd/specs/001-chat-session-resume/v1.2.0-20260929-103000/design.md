# Design: 会话身份对 (stored id / runtime id) 与有界自动 resume
> Spec ID: 001-chat-session-resume | Phase: design | Workflow: bugfix | Version: v1.2.0-20260929-103000 | Parent: v1.1.0

## 1. 系统架构 (mermaid)
```mermaid
graph TD
    UI[ChatPage] -->|selectSession(S)| RESET[同步清空 identity]
    RESET --> ATT[attachSession S]
    ATT -->|de-dup in-flight| GW[GatewayClient]
    GW -->|session.resume{session_id:S}| BFF[BFF 透明代理] --> H[hermes serve]
    H -->|{session_id:R, resumed:S}| GW
    GW -->|code+message on error| ATT
    ATT -->|守卫 identity.storedId===activeId| ID[(identity {S,R})]
    ID --> SEND[prompt.submit{session_id:R}]
    ID --> RPC[其他 session-scoped RPC 按矩阵]
    H -->|event{session_id:R}| GW --> FILT[matchesRuntime 严格过滤] --> UI
```

## 2. 时序图 (mermaid)
```mermaid
sequenceDiagram
    participant U as User
    participant C as ChatPage
    participant G as GatewayClient
    participant H as Hermes
    U->>C: 点击历史会话 S
    C->>C: activeId=S; identity=null (同步)
    C->>G: session.resume {session_id:S}
    G->>H: (经 BFF)
    H-->>G: {session_id:R, resumed:S}
    G-->>C: R
    C->>C: 守卫 activeId===S ? identity={S,R} : 丢弃
    U->>C: 发送
    C->>G: prompt.submit {session_id:R}
    alt 4001
        G-->>C: reject{code:4001}
        C->>G: session.resume{session_id:<发送时S>} (一次)
        G-->>C: {session_id:R2}
        C->>G: prompt.submit{session_id:R2}
    end
    H-->>G: event message.delta{session_id:R2}
    G-->>C: matchesRuntime -> 渲染
```

## 3. 身份模型
```ts
export interface SessionIdentity {
  storedId: string;  // session.list 的 id：列表 key / 高亮 / resume 入参 / delete
  runtimeId: string; // session.resume|create 回包 session_id：所有 session-scoped RPC + 事件过滤
}
```
| 不变式 | 说明 |
| --- | --- |
| ID-1 | `runtimeId` 必须来自 resume/create 回包；归一化失败即失败（禁止 fail-open） |
| ID-2 | 任何 session-scoped RPC 发出前必须 `identity != null && identity.storedId === activeIdRef.current` |
| ID-3 | 提交 `setIdentity` 前必须复核 `activeIdRef.current === storedId`（乱序守卫） |
| ID-4 | 同一 storedId 的并发 attach 必须去重（in-flight promise） |

## 4. 代码改动
### 4.1 `apps/web/src/chat/types.ts`
- 新增 `normalizeResumedId(result): string | null` → `session_id ?? id ?? null`（**不得**回退 stored id）。
- 新增严格匹配 `matchesRuntime(payload, runtimeId): boolean` → `typeof payload.session_id === "string" && payload.session_id === runtimeId`（缺 `session_id` 返回 false）。
- `isSameSession` 保留但不用于会话事件过滤（或标注 deprecated）。

### 4.2 `apps/web/src/api/ws.ts`
```ts
if (frame.error) {
  const err = new Error(String(frame.error.message ?? frame.error));
  (err as Error & { code?: number }).code = frame.error.code;
  pending.reject(err);
}
```
新增 `export function isSessionNotFound(error: unknown): boolean`（`code === 4001` 或 `/session not found/i`）。

### 4.3 `apps/web/src/chat/ChatPage.tsx`
- 状态：`activeId`(stored, 高亮) / `identity: SessionIdentity | null` / `activeIdRef` / `identityRef` / `attachInFlightRef`。
- `selectSession(S)`：
  ```ts
  setActiveId(S); activeIdRef.current = S; setItems([]);
  setIdentity(null); identityRef.current = null;           // 同步清空（ID-2）
  attachSession(S).catch(() => { if (activeIdRef.current === S) setError("无法恢复会话"); });
  ```
- `attachSession(S): Promise<SessionIdentity>`：in-flight 去重；`session.resume{session_id:S}`；`normalizeResumedId` 为 null → `throw`；仅在 `activeIdRef.current === S` 时提交 `identity`（ID-3）；返回身份对。
- `createSession()`：`session.create` → `normalizeCreatedId` → `setActiveId(C); activeIdRef.current=C; identity={storedId:C, runtimeId:C}; setIdentity(...)`；**零 resume**（REQ-006）。
- `handleSend(text)`：
  ```ts
  const storedId = activeIdRef.current; if (!storedId) return;
  let pair = identityRef.current;
  if (!pair || pair.storedId !== storedId) {
    try { pair = await attachSession(storedId); } catch { setError("无法恢复会话"); return; }
  }
  if (activeIdRef.current !== storedId) return;             // 已切换：丢弃
  const payload = { session_id: pair.runtimeId, text, ...(attachments.length ? {attachments: ...} : {}) };
  gateway.request("prompt.submit", payload).catch(async (error) => {
    if (isSessionNotFound(error)) {
      const next = await attachSession(storedId).catch(() => null);   // 发送时 storedId，一次
      if (next && activeIdRef.current === storedId) {
        return gateway.request("prompt.submit", { ...payload, session_id: next.runtimeId })
          .catch((e) => { setRunning(false); setError(String((e as Error)?.message ?? "发送失败")); });
      }
    }
    setRunning(false);
    setError(String((error as Error)?.message ?? "发送失败"));
  });
  ```
- 事件过滤：`matchesRuntime(payload, identityRef.current?.runtimeId ?? null)` 且 `identityRef.current?.storedId === activeIdRef.current`。
- `session.events.since` effect：`useEffect(..., [identity?.runtimeId, activeId, gateway])`；开头 `if (!identity || identity.storedId !== activeId) return;`；请求 `{session_id: identity.runtimeId}`（REQ-002）。
- `renameSession`：`session.title{session_id: identityRef.current.runtimeId, title}`（REQ-002 / F3）。
- `handleStop`：`session.interrupt{session_id: identityRef.current.runtimeId}`。
- 附件：`file.attach{session_id: runtimeId}`。
- `subagent.list`：`{session_id: runtimeId}`（F5）。
- `workspace.move`：`{session_key: storedId, cwd}`（F4，注意字段名）。
- `?session=` 深链 effect：与 `selectSession` 相同（清空 + attach）（REQ-007）。
- `session.delete`：保持 stored id（`activeId`）。

### 4.4 测试辅助
`apps/web/src/test/fakeGateway.ts`（或等价）新增 `session.resume` 默认应答 `{ session_id: <runtime> }`，否则既有 ChatPage 用例在 `selectSession` 后会因归一化失败而报错。

### 4.5 BFF
无改动。

## 5. 错误处理
| 场景 | 行为 |
| --- | --- |
| resume 归一化失败 | identity=null，报真实错误；不得用 stored id 继续 |
| resume 返回 4001 | 不递归；报错 |
| 迟到响应 | 丢弃（ID-3） |
| submit 4001 | 发送时 storedId resume + 一次重试 |
| 用户在重试期间切换 | 丢弃重试结果；`setRunning(false)` |
| 非 4001 | 不重试，直接提示 |

## 6. 测试策略
- `ChatPage.test.tsx`：选中→resume→身份对；各 RPC 身份矩阵；4001 以发送时 storedId 恢复一次；归一化失败报错；乱序不覆盖；create 零 resume；`?session=` attach；缺 `session_id` 事件不放行。
- `ws.test.ts`：rejection 带 `code`；`isSessionNotFound` 4001 与文案回退。
- 真机：`node scripts/e2e-real-hermes.mjs`；手工验证「点选历史会话→发送→回复」，网关无 4001 WARN；重命名/移动工作区亦通过。
- 回归：`npm run check`。

## 7. 附带发现 (F2, 可选)
选中会话时 `setItems([])` 且不加载历史 → 看不到往期消息。`session.resume` 已返回 `messages`（或 `defer_history:true` + L2 `GET /api/sessions/:id/messages`）。REQ-008（low, Ask First）。
