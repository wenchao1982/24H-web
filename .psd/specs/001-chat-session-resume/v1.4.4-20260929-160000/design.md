# Design (patch v1.4.4)
> Spec ID: 001-chat-session-resume | Version: v1.4.4-20260929-160000 | Parent: v1.4.3

## 1. 数据来源
`session.resume` 回包的 `messages`（投影、展示就绪）。不回用 L2（原始行、形状不同）。

## 2. `types.ts`
```ts
/** `session.resume` 回包 messages → transcript 项（历史渲染）。 */
export function normalizeHistoryMessages(result: unknown): TranscriptItem[] {
  if (!result || typeof result !== "object") return [];
  const raw = (result as Record<string, unknown>).messages;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    if (row.display_kind === "hidden") return [];
    const role = typeof row.role === "string" ? row.role : "";
    const text = str(row.text) ?? (typeof row.content === "string" ? row.content : "");
    const id = `h${str(row.row_id) ?? index}`;
    if (role === "user") return text ? [{ kind: "message", id, role: "user", text } as TranscriptItem] : [];
    if (role === "assistant") {
      if (!text) return [];
      const reasoning = typeof row.reasoning === "string" ? row.reasoning : undefined;
      const reason = !!reasoning && reasoning.trim() === text.trim();
      return [{ kind: "message", id, role: "assistant", text, ...(reason ? { reasoning: true } : {}) } as TranscriptItem];
    }
    if (role === "tool") {
      const name = str(row.name) ?? "工具";
      return [{ kind: "tool", id, name, status: "complete", detail: str(row.context) } as TranscriptItem];
    }
    return [];
  });
}
```

## 3. `ChatPage.tsx`
- 内部类型 `ResolvedSession = { runtimeId: string; items: TranscriptItem[] }`；`attachInFlightRef` 改存 `Map<string, Promise<ResolvedSession>>`。
- `resumeSession(storedId)`：去重；resume 后返回 `{ runtimeId, items: normalizeHistoryMessages(result) }`；`normalizeResumedId` 为空则抛错。
- `attachSession(storedId, applyHistory = false)`：
  ```ts
  const resolved = await resumeSession(storedId);
  const pair = { storedId, runtimeId: resolved.runtimeId };
  if (activeIdRef.current === storedId) {       // ID-3 守卫
    setIdentity(pair); identityRef.current = pair;
    if (applyHistory) setItems(resolved.items);
  }
  return pair;
  ```
- `selectSession` / `?session=` 深链：`attachSession(id, true)`（先同步 `setItems([])`）。
- `handleSend` 的补充 attach：`attachSession(storedId)`（**applyHistory=false**，绝不覆盖当前 transcript）。
- `renameSession`：改用 `resumeSession(targetStoredId)` 取 `runtimeId`（不提交 identity、不写历史）。

## 4. 影响面
- 点选历史会话即显示历史；实时事件在其后追加。
- 不发送时不做额外请求；不新增依赖；BFF 不改。

## 5. 测试
- `ChatPage.test.tsx`：历史渲染（user+assistant）、`text===reasoning` 历史行、工具行、乱序守卫、发送不覆盖/不重复。
- 既有用例：fake 默认 resume 无 `messages` → 行为不变。
