import { describe, expect, it } from "vitest";
import type { PendingAttachment } from "./pendingAttachments";
import {
  DEFAULT_YOLO,
  controlsReducer,
  initialControlsState,
  type ControlsState,
} from "./controlsReducer";

function attachment(name: string, size = 1, lastModified = 0): PendingAttachment {
  return {
    id: `${name}:${size}:${lastModified}`,
    kind: "file",
    file: { name, size, lastModified } as File,
    name,
    size,
  };
}

function withSelection(overrides: Partial<ControlsState["selection"]>): ControlsState {
  return { ...initialControlsState, selection: { ...initialControlsState.selection, ...overrides } };
}

describe("initialControlsState", () => {
  it("starts with an empty, non-sending selection", () => {
    expect(initialControlsState).toEqual({
      selection: { profile: null, model: null, cwd: null, yolo: DEFAULT_YOLO },
      attachments: [],
      sending: false,
    });
  });

  it("DEFAULT_YOLO is off（默认审批不开 yolo；禁用 default 以免网关翻转）", () => {
    expect(DEFAULT_YOLO).toBe("off");
  });
});

describe("controlsReducer selection actions", () => {
  it("selectProfile updates only the profile", () => {
    const next = controlsReducer(initialControlsState, { type: "selectProfile", profile: "p1" });
    expect(next.selection).toEqual({ ...initialControlsState.selection, profile: "p1" });
    expect(next.attachments).toBe(initialControlsState.attachments);
  });

  it("selectProfile accepts null", () => {
    const next = controlsReducer(withSelection({ profile: "p1" }), {
      type: "selectProfile",
      profile: null,
    });
    expect(next.selection.profile).toBeNull();
  });

  it("selectModel updates only the model", () => {
    const next = controlsReducer(initialControlsState, { type: "selectModel", model: "m-b" });
    expect(next.selection.model).toBe("m-b");
    expect(next.selection.profile).toBeNull();
  });

  it("selectWorkspace updates only the cwd", () => {
    const next = controlsReducer(initialControlsState, {
      type: "selectWorkspace",
      cwd: "/w/a",
    });
    expect(next.selection.cwd).toBe("/w/a");
  });

  it("selectYolo updates only the permission mode", () => {
    const next = controlsReducer(initialControlsState, { type: "selectYolo", yolo: "on" });
    expect(next.selection.yolo).toBe("on");
  });

  it("rollbackModel restores a prior value with no residue", () => {
    const selected = controlsReducer(initialControlsState, { type: "selectModel", model: "m-b" });
    const rolledBack = controlsReducer(selected, { type: "rollbackModel", model: null });
    expect(rolledBack.selection.model).toBeNull();
    expect(rolledBack.selection).toEqual(initialControlsState.selection);
  });

  it("rollbackModel can restore a concrete previous model", () => {
    const start = withSelection({ model: "m-a" });
    const selected = controlsReducer(start, { type: "selectModel", model: "m-b" });
    const rolledBack = controlsReducer(selected, { type: "rollbackModel", model: "m-a" });
    expect(rolledBack.selection.model).toBe("m-a");
  });

  it("rollbackYolo restores the prior mode", () => {
    const selected = controlsReducer(initialControlsState, { type: "selectYolo", yolo: "on" });
    const rolledBack = controlsReducer(selected, { type: "rollbackYolo", yolo: DEFAULT_YOLO });
    expect(rolledBack.selection.yolo).toBe(DEFAULT_YOLO);
  });
});

describe("controlsReducer attachment actions", () => {
  it("attach appends new attachments", () => {
    const a = attachment("a.txt");
    const b = attachment("b.txt");
    const next = controlsReducer(initialControlsState, { type: "attach", items: [a, b] });
    expect(next.attachments).toEqual([a, b]);
  });

  it("attach dedupes by name+size+lastModified across calls", () => {
    const first = attachment("a.txt", 10, 100);
    const duplicate = attachment("a.txt", 10, 100);
    const state = controlsReducer(initialControlsState, { type: "attach", items: [first] });
    const next = controlsReducer(state, { type: "attach", items: [duplicate] });
    expect(next.attachments).toEqual([first]);
    expect(next.attachments).toHaveLength(1);
  });

  it("attach keeps files whose lastModified differs", () => {
    const a = attachment("a.txt", 10, 100);
    const b = attachment("a.txt", 10, 200);
    const next = controlsReducer(initialControlsState, { type: "attach", items: [a, b] });
    expect(next.attachments).toEqual([a, b]);
  });

  it("attach does not mutate the previous state", () => {
    const state = controlsReducer(initialControlsState, { type: "attach", items: [attachment("a")] });
    const next = controlsReducer(state, { type: "attach", items: [attachment("b")] });
    expect(state.attachments).toHaveLength(1);
    expect(next.attachments).toHaveLength(2);
  });

  it("removeAttachment removes by id and ignores unknown ids", () => {
    const a = attachment("a");
    const b = attachment("b");
    const state = controlsReducer(initialControlsState, { type: "attach", items: [a, b] });
    expect(controlsReducer(state, { type: "removeAttachment", id: a.id }).attachments).toEqual([b]);
    expect(controlsReducer(state, { type: "removeAttachment", id: "nope" })).toBe(state);
  });

  it("clearAttachments empties the list", () => {
    const state = controlsReducer(initialControlsState, {
      type: "attach",
      items: [attachment("a")],
    });
    expect(controlsReducer(state, { type: "clearAttachments" }).attachments).toEqual([]);
    expect(controlsReducer(initialControlsState, { type: "clearAttachments" })).toBe(
      initialControlsState,
    );
  });
});

describe("controlsReducer single-flight flag", () => {
  it("beginSend sets sending=true", () => {
    expect(controlsReducer(initialControlsState, { type: "beginSend" }).sending).toBe(true);
  });

  it("beginSend is idempotent while sending (same reference)", () => {
    const first = controlsReducer(initialControlsState, { type: "beginSend" });
    const second = controlsReducer(first, { type: "beginSend" });
    expect(second).toBe(first);
    expect(second.sending).toBe(true);
  });

  it("endSend clears the flag and is idempotent when idle", () => {
    const sending = controlsReducer(initialControlsState, { type: "beginSend" });
    const ended = controlsReducer(sending, { type: "endSend" });
    expect(ended.sending).toBe(false);
    expect(controlsReducer(ended, { type: "endSend" })).toBe(ended);
  });
});

describe("controlsReducer resetForNewSession", () => {
  it("resets selection, attachments and sending flag", () => {
    const dirty: ControlsState = {
      selection: { profile: "p1", model: "m-b", cwd: "/w/a", yolo: "on" },
      attachments: [attachment("a")],
      sending: true,
    };
    const next = controlsReducer(dirty, { type: "resetForNewSession" });
    expect(next).toEqual({
      selection: { profile: null, model: null, cwd: null, yolo: DEFAULT_YOLO },
      attachments: [],
      sending: false,
    });
  });

  it("preserves an explicitly provided yolo", () => {
    const next = controlsReducer(initialControlsState, {
      type: "resetForNewSession",
      yolo: "on",
    });
    expect(next.selection.yolo).toBe("on");
  });
});
