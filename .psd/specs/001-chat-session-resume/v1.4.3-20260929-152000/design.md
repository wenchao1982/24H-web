# Design (patch v1.4.3)
> Spec ID: 001-chat-session-resume | Version: v1.4.3-20260929-152000 | Parent: v1.4.2

## 1. Fix A — 终态复位
`ChatPage.tsx` 的 `message.complete` 处理（已按 runtime id 过滤）追加：
```ts
setRunning(false);
setStatus({ phase: "done" });
```
`done` 处理保留（前向兼容）。

## 2. Fix B — 思考过程块
`types.ts`：
```ts
// TranscriptItem 的 message 变体新增
reasoning?: boolean;

/** `message.complete` 是否仅把推理当作答复（text 与 reasoning 同文）。 */
export function isReasoningOnly(payload: Record<string, unknown>): boolean {
  const r = str(payload.reasoning);
  return !!r && r.trim() === deltaText(payload).trim();
}
```
`completeAssistant(items, text, id, reasoning = false)`：在封口/新建时写入 `reasoning: true`（仅当入参为真）。

`ChatPage.tsx`：
```ts
setItems((current) => completeAssistant(current, deltaText(payload), nextId(), isReasoningOnly(payload)));
```

`Transcript.tsx`：
```tsx
<div className="bubble" data-role={item.role}
     data-streaming={item.streaming}
     data-reasoning={item.reasoning ? "true" : undefined}>
  {item.reasoning ? <span className="bubble-label">思考过程</span> : null}
  {item.text}
</div>
```

`styles.css`：新增 `.bubble-label` 与 `.bubble[data-reasoning="true"]` 的弱化样式（使用 `--ds-*` token；不得引入 UI 库）。

## 3. 影响面
- 每轮结束输入框恢复可发送（消除「永远停止」）。
- 纯推理回合以「思考过程」块呈现，不再冒充正式答复。
- 不改 BFF、不改网关事件匹配逻辑。

## 4. 测试
- `ChatPage.test.tsx`：`message.complete` 后主按钮回到「发送」；`text===reasoning` 渲染 `data-reasoning="true"` + 「思考过程」；普通 `message.complete` 无该属性；`done` 仍复位。
- 既有流式用例不回归。
