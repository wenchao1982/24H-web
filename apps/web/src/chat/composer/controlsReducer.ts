/**
 * 对话页控件状态的纯 reducer（TASK-006A）。
 *
 * 职责：管理 `selection{profile,model,cwd,yolo}` 与附件列表、发送单飞标志。
 * **不含任何 IO / RPC**——异步调用落在 `useSessionControls` 的 dispatch 外层。
 */

import type { PendingAttachment } from "./pendingAttachments";

export interface SessionSelection {
  profile: string | null;
  model: string | null;
  cwd: string | null;
  yolo: string;
}

export interface ControlsState {
  selection: SessionSelection;
  attachments: PendingAttachment[];
  /** single-flight 标志：发送进行中为 true，重复 `beginSend` 幂等。 */
  sending: boolean;
}

export type ControlsAction =
  | { type: "selectProfile"; profile: string | null }
  | { type: "selectModel"; model: string | null }
  | { type: "selectWorkspace"; cwd: string | null }
  | { type: "selectYolo"; yolo: string }
  | { type: "rollbackModel"; model: string | null }
  | { type: "rollbackYolo"; yolo: string }
  | { type: "attach"; items: PendingAttachment[] }
  | { type: "removeAttachment"; id: string }
  | { type: "clearAttachments" }
  | { type: "beginSend" }
  | { type: "endSend" }
  | { type: "resetForNewSession"; yolo?: string };

/**
 * 默认权限模式值：「默认审批」= **不开** yolo，故取 `"off"`（config key = `yolo`）。
 *
 * 依据（真机实测 + 源码）：`yolo` 只接受 `_BOOL_WORDS`（`server.py:1772-1774`：
 * `on/off/true/false/yes/no/1/0`）；任何不在表内的值（如 `"default"`）会走
 * `methods_config_set.py:278` 的 fallback `not is_session_yolo_enabled(skey)` —— 即**翻转**
 * 当前会话状态，导致点「默认」反而开启完全访问。**禁止使用 `"default"`。**
 */
export const DEFAULT_YOLO = "off";

export const initialControlsState: ControlsState = {
  selection: { profile: null, model: null, cwd: null, yolo: DEFAULT_YOLO },
  attachments: [],
  sending: false,
};

/** 附件去重键：`name + size + lastModified`（与 `pendingAttachments.dedupe` 同语义）。 */
function attachmentKey(file: File): string {
  return `${file.name}\u0000${file.size}\u0000${file.lastModified}`;
}

function mergeAttachments(
  current: PendingAttachment[],
  incoming: PendingAttachment[],
): PendingAttachment[] {
  if (incoming.length === 0) {
    return current;
  }
  const seen = new Set(current.map((item) => attachmentKey(item.file)));
  const merged = current.slice();
  for (const item of incoming) {
    const key = attachmentKey(item.file);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(item);
  }
  return merged.length === current.length ? current : merged;
}

export function controlsReducer(state: ControlsState, action: ControlsAction): ControlsState {
  switch (action.type) {
    case "selectProfile":
      return { ...state, selection: { ...state.selection, profile: action.profile } };
    case "selectModel":
      return { ...state, selection: { ...state.selection, model: action.model } };
    case "selectWorkspace":
      return { ...state, selection: { ...state.selection, cwd: action.cwd } };
    case "selectYolo":
      return { ...state, selection: { ...state.selection, yolo: action.yolo } };
    case "rollbackModel":
      return { ...state, selection: { ...state.selection, model: action.model } };
    case "rollbackYolo":
      return { ...state, selection: { ...state.selection, yolo: action.yolo } };
    case "attach":
      return { ...state, attachments: mergeAttachments(state.attachments, action.items) };
    case "removeAttachment": {
      const next = state.attachments.filter((item) => item.id !== action.id);
      return next.length === state.attachments.length ? state : { ...state, attachments: next };
    }
    case "clearAttachments":
      return state.attachments.length === 0 ? state : { ...state, attachments: [] };
    case "beginSend":
      // single-flight：已在发送中则保持同一引用，React 会跳过无变化的更新。
      return state.sending ? state : { ...state, sending: true };
    case "endSend":
      return state.sending ? { ...state, sending: false } : state;
    case "resetForNewSession":
      return {
        selection: {
          profile: null,
          model: null,
          cwd: null,
          yolo: action.yolo ?? DEFAULT_YOLO,
        },
        attachments: [],
        sending: false,
      };
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
