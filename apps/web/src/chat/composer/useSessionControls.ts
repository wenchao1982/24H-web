/**
 * 对话页会话控件状态机 + RPC 编排（TASK-006C / REQ-002 / REQ-005 / REQ-009 / REQ-011 / REQ-012 / REQ-013 / REQ-014 / REQ-019 / REQ-010a）。
 *
 * 设计要点：
 * - `selection` + `attachments` 由纯 `controlsReducer` 持有（无 IO）；RPC 落在 dispatch 外层。
 * - `modelSwitch` 用 `useState` 承载模型控件的异步分支（pending / deferred / confirm / error）。
 * - `options` 由 `useOptions` 加载（缓存键 + profile 租户上下文）。
 * - `attach` **0 RPC**（REQ-005）；`send` 为 **single-flight**（REQ-006）。
 * - 身份矩阵：`workspace.move` 用 **stored id**；`config.set` / `attach*` / `prompt.submit` 用 **runtime id**（REQ-014）。
 */

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { t } from "../../i18n";
import type { Gateway } from "../../api/ws";
import { normalizeCreatedIdentity, type SessionIdentity } from "../types";
import {
  controlsReducer,
  initialControlsState,
  type SessionSelection,
} from "./controlsReducer";
import {
  createPendingAttachment,
  dedupe,
  readAsDataUrl,
  screenFiles,
  type PendingAttachment,
} from "./pendingAttachments";
import { normalizeModelCatalog } from "./modelCatalog";
import { useOptions, type OptionsState } from "./useOptions";
import { deriveComposerVariant, type ComposerVariant } from "./variant";
import type { ModelSwitchState } from "./ModelPicker";

export type { ModelSwitchState };

export interface UseSessionControlsArgs {
  gateway: Gateway;
  /** 当前活动会话 stored id（hero 态为 null）。 */
  activeId: string | null;
  identity: SessionIdentity | null;
  running: boolean;
  me: { profiles: string[]; default_profile: string | null } | null;
  itemCount: number;
  onError: (message: string) => void;
}

export type SendOutcome =
  | { ok: true }
  | { ok: false; message: string; stage: "create" | "attach" | "submit" };

export interface CreateParams {
  profile?: string;
  cwd?: string;
  cwd_explicit?: true;
  model?: string;
}

export interface SessionControls {
  variant: ComposerVariant;
  identityReady: boolean;
  selection: SessionSelection;
  options: OptionsState;
  modelSwitch: ModelSwitchState;
  confirmModel(): Promise<void>;
  cancelModelConfirm(): void;
  attachments: PendingAttachment[];
  attach(files: File[]): void;
  removeAttachment(id: string): void;
  clearAttachments(): void;
  /** 逐条 `attach*`，fail-fast；由 `send` 内部调用，也可单独使用。 */
  uploadAll(runtimeId: string): Promise<void>;
  /** 发送编排入口；single-flight：进行中重复调用返回同一 Promise，不重复 `session.create`。 */
  send(text: string): Promise<SendOutcome>;
  selectProfile(name: string | null): void;
  selectModel(name: string): Promise<void>;
  selectWorkspace(path: string | null): Promise<void>;
  selectYolo(mode: string): Promise<void>;
  buildCreateParams(): CreateParams;
  /** 由 ChatPage 在收到该会话 `message.complete` 时调用；仅 `deferred` 时发 RPC（REQ-010a）。 */
  reconcileModel(): Promise<void>;
  resetForNewSession(): void;
}

function errorMessage(error: unknown): string {
  return String((error as Error)?.message ?? error ?? "操作失败");
}

function attachmentKey(file: File): string {
  return `${file.name}\u0000${file.size}\u0000${file.lastModified}`;
}

/** 去掉 data URL 前缀，仅保留 base64 正文（image/pdf 契约要求纯 base64）。 */
function base64Body(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

export function useSessionControls(args: UseSessionControlsArgs): SessionControls {
  const { gateway, activeId, identity, me, itemCount, onError } = args;
  const [state, dispatch] = useReducer(controlsReducer, initialControlsState);
  const [modelSwitch, setModelSwitch] = useState<ModelSwitchState>({ status: "idle" });

  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const selectionRef = useRef(state.selection);
  selectionRef.current = state.selection;
  const attachmentsRef = useRef(state.attachments);
  attachmentsRef.current = state.attachments;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const modelSwitchRef = useRef(modelSwitch);
  modelSwitchRef.current = modelSwitch;

  const createdUrlsRef = useRef<Set<string>>(new Set());
  const sendPromiseRef = useRef<Promise<SendOutcome> | null>(null);
  const previousModelRef = useRef<string | null>(null);

  const identityReady = activeId !== null && identity?.storedId === activeId;

  const options = useOptions({
    gateway,
    me,
    activeId,
    profile: state.selection.profile,
    onError,
  });

  const revokeAll = useCallback(() => {
    for (const url of createdUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    createdUrlsRef.current.clear();
  }, []);

  useEffect(() => () => revokeAll(), [revokeAll]);

  const attach = useCallback((files: File[]) => {
    const { accepted, errors } = screenFiles(files, attachmentsRef.current.length);
    if (errors.length > 0) {
      onErrorRef.current(errors.join("；"));
    }
    const existing = new Set(attachmentsRef.current.map((item) => attachmentKey(item.file)));
    const unique = dedupe(accepted).filter((file) => !existing.has(attachmentKey(file)));
    if (unique.length === 0) {
      return;
    }
    const items = unique.map((file) => {
      const item = createPendingAttachment(file);
      if (item.previewUrl) {
        createdUrlsRef.current.add(item.previewUrl);
      }
      return item;
    });
    dispatch({ type: "attach", items });
  }, []);

  const removeAttachment = useCallback((id: string) => {
    const item = attachmentsRef.current.find((entry) => entry.id === id);
    if (item?.previewUrl && createdUrlsRef.current.has(item.previewUrl)) {
      URL.revokeObjectURL(item.previewUrl);
      createdUrlsRef.current.delete(item.previewUrl);
    }
    dispatch({ type: "removeAttachment", id });
  }, []);

  const clearAttachments = useCallback(() => {
    for (const item of attachmentsRef.current) {
      if (item.previewUrl && createdUrlsRef.current.has(item.previewUrl)) {
        URL.revokeObjectURL(item.previewUrl);
        createdUrlsRef.current.delete(item.previewUrl);
      }
    }
    dispatch({ type: "clearAttachments" });
  }, []);

  const uploadAll = useCallback(
    async (runtimeId: string) => {
      for (const item of attachmentsRef.current) {
        let dataUrl: string;
        try {
          dataUrl = await readAsDataUrl(item.file);
        } catch (error) {
          throw new Error(errorMessage(error));
        }
        try {
          if (item.kind === "image") {
            await gateway.request("image.attach_bytes", {
              session_id: runtimeId,
              content_base64: base64Body(dataUrl),
              filename: item.name,
            });
          } else if (item.kind === "pdf") {
            await gateway.request("pdf.attach", {
              session_id: runtimeId,
              content_base64: base64Body(dataUrl),
              filename: item.name,
            });
          } else {
            await gateway.request("file.attach", {
              session_id: runtimeId,
              data_url: dataUrl,
              name: item.name,
            });
          }
        } catch (error) {
          throw new Error(errorMessage(error));
        }
      }
    },
    [gateway],
  );

  const buildCreateParams = useCallback((): CreateParams => {
    const selection = selectionRef.current;
    const params: CreateParams = {};
    if (selection.profile) {
      params.profile = selection.profile;
    }
    if (selection.cwd) {
      params.cwd = selection.cwd;
      params.cwd_explicit = true;
    }
    if (selection.model) {
      params.model = selection.model;
    }
    return params;
  }, []);

  const send = useCallback(
    (text: string): Promise<SendOutcome> => {
      if (sendPromiseRef.current) {
        return sendPromiseRef.current;
      }
      const promise = (async (): Promise<SendOutcome> => {
        dispatch({ type: "beginSend" });
        try {
          const storedId = activeIdRef.current;
          let runtimeId: string;
          if (storedId === null) {
            const params = buildCreateParams();
            let result: unknown;
            try {
              result = await gateway.request("session.create", { ...params });
            } catch (error) {
              return { ok: false, stage: "create", message: errorMessage(error) };
            }
            const identityPair = normalizeCreatedIdentity(result);
            if (!identityPair) {
              return { ok: false, stage: "create", message: t("composer.errors.createFailed") };
            }
            runtimeId = identityPair.runtimeId;
          } else {
            const pair = identityRef.current;
            if (!pair || pair.storedId !== storedId) {
              return { ok: false, stage: "create", message: t("composer.errors.notReady") };
            }
            runtimeId = pair.runtimeId;
          }

          try {
            await uploadAll(runtimeId);
          } catch (error) {
            return { ok: false, stage: "attach", message: errorMessage(error) };
          }

          try {
            await gateway.request("prompt.submit", { text, session_id: runtimeId });
          } catch (error) {
            return { ok: false, stage: "submit", message: errorMessage(error) };
          }

          clearAttachments();
          return { ok: true };
        } finally {
          dispatch({ type: "endSend" });
          sendPromiseRef.current = null;
        }
      })();
      sendPromiseRef.current = promise;
      return promise;
    },
    [buildCreateParams, clearAttachments, gateway, uploadAll],
  );

  const selectProfile = useCallback((name: string | null) => {
    dispatch({ type: "selectProfile", profile: name });
  }, []);

  const selectModel = useCallback(
    async (name: string) => {
      previousModelRef.current = selectionRef.current.model;
      dispatch({ type: "selectModel", model: name });

      const storedId = activeIdRef.current;
      if (storedId === null) {
        // hero：仅写待创建参数，0 RPC（REQ-009）。
        return;
      }
      const pair = identityRef.current;
      if (!pair || pair.storedId !== storedId) {
        onErrorRef.current(t("composer.errors.notReady"));
        return;
      }

      setModelSwitch({ status: "pending", target: name });
      try {
        const result = await gateway.request<Record<string, unknown>>("config.set", {
          key: "model",
          value: name,
          session_id: pair.runtimeId,
        });
        if (result?.confirm_required === true) {
          setModelSwitch({
            status: "confirm",
            target: name,
            ...(typeof result.confirm_message === "string"
              ? { message: result.confirm_message }
              : {}),
          });
        } else if (result?.deferred === true) {
          setModelSwitch({ status: "deferred", target: name });
        } else {
          setModelSwitch({ status: "idle" });
        }
      } catch (error) {
        setModelSwitch({ status: "error", target: name, message: errorMessage(error) });
        onErrorRef.current(errorMessage(error));
      }
    },
    [gateway],
  );

  const confirmModel = useCallback(async () => {
    const current = modelSwitchRef.current;
    const target = current.status === "confirm" ? current.target : selectionRef.current.model;
    if (!target) {
      return;
    }
    const storedId = activeIdRef.current;
    const pair = identityRef.current;
    if (storedId === null || !pair || pair.storedId !== storedId) {
      onErrorRef.current(t("composer.errors.notReady"));
      return;
    }
    setModelSwitch({ status: "pending", target });
    try {
      const result = await gateway.request<Record<string, unknown>>("config.set", {
        key: "model",
        value: target,
        session_id: pair.runtimeId,
        confirm_expensive_model: true,
      });
      if (result?.deferred === true) {
        setModelSwitch({ status: "deferred", target });
      } else {
        setModelSwitch({ status: "idle" });
      }
    } catch (error) {
      setModelSwitch({ status: "error", target, message: errorMessage(error) });
      onErrorRef.current(errorMessage(error));
    }
  }, [gateway]);

  const cancelModelConfirm = useCallback(() => {
    dispatch({ type: "rollbackModel", model: previousModelRef.current });
    setModelSwitch({ status: "idle" });
  }, []);

  const reconcileModel = useCallback(async () => {
    const current = modelSwitchRef.current;
    if (current.status !== "deferred") {
      return;
    }
    const storedId = activeIdRef.current;
    const pair = identityRef.current;
    if (storedId === null || !pair || pair.storedId !== storedId) {
      return;
    }
    const profile = selectionRef.current.profile ?? me?.default_profile ?? null;
    if (!profile) {
      return;
    }
    try {
      const result = await gateway.request("model.options", {
        profile,
        session_id: pair.runtimeId,
      });
      const actual = normalizeModelCatalog(result).current.model;
      if (actual && actual === current.target) {
        setModelSwitch({ status: "idle" });
        return;
      }
      dispatch({ type: "rollbackModel", model: actual ?? previousModelRef.current });
      setModelSwitch({ status: "idle" });
      onErrorRef.current(t("composer.model.switchFailed"));
    } catch (error) {
      setModelSwitch({ status: "error", target: current.target, message: errorMessage(error) });
      onErrorRef.current(errorMessage(error));
    }
  }, [gateway, me]);

  const selectWorkspace = useCallback(
    async (path: string | null) => {
      const previous = selectionRef.current.cwd;
      dispatch({ type: "selectWorkspace", cwd: path });

      const storedId = activeIdRef.current;
      if (storedId === null || path === null) {
        return;
      }
      try {
        await gateway.request("session.workspace.move", { session_key: storedId, cwd: path });
      } catch (error) {
        dispatch({ type: "selectWorkspace", cwd: previous });
        onErrorRef.current(errorMessage(error));
      }
    },
    [gateway],
  );

  const selectYolo = useCallback(
    async (mode: string) => {
      const previous = selectionRef.current.yolo;
      dispatch({ type: "selectYolo", yolo: mode });

      const storedId = activeIdRef.current;
      const pair = identityRef.current;
      if (storedId === null || !pair || pair.storedId !== storedId) {
        return;
      }
      try {
        // `mode` 即 config value 原样上送（UI「默认审批」→"off"、「自动批准」→"on"）。
        // **不得**二次映射为 "default"：它不在 `_BOOL_WORDS`（server.py:1772-1774），
        // 会触发 `methods_config_set.py:278` 的翻转 fallback 而意外开启 yolo。
        await gateway.request("config.set", {
          key: "yolo",
          value: mode,
          session_id: pair.runtimeId,
          scope: "session",
        });
      } catch (error) {
        dispatch({ type: "rollbackYolo", yolo: previous });
        onErrorRef.current(errorMessage(error));
      }
    },
    [gateway],
  );

  const resetForNewSession = useCallback(() => {
    revokeAll();
    dispatch({ type: "resetForNewSession" });
  }, [revokeAll]);

  return {
    variant: deriveComposerVariant({ activeId, itemCount }),
    identityReady,
    selection: state.selection,
    options,
    modelSwitch,
    confirmModel,
    cancelModelConfirm,
    attachments: state.attachments,
    attach,
    removeAttachment,
    clearAttachments,
    uploadAll,
    send,
    selectProfile,
    selectModel,
    selectWorkspace,
    selectYolo,
    buildCreateParams,
    reconcileModel,
    resetForNewSession,
  };
}
