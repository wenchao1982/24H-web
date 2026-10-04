import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGateway } from "./GatewayProvider";
import { api } from "../api/client";
import { isSessionNotFound } from "../api/ws";
import { useMediaQuery } from "../shell/useMediaQuery";
import { useDetails } from "../shell/details-context";
import { useOptionalSession } from "../auth/SessionProvider";
import { Icon } from "../ui/icons";
import { t } from "../i18n";
import SessionList from "./SessionList";
import Transcript from "./Transcript";
import Composer from "./Composer";
import StatusBar from "./StatusBar";
import ServerRequestCard from "./ServerRequestCard";
import SubagentsPanel from "./SubagentsPanel";
import ImageGenAction from "./ImageGenAction";
import CommandPanel from "./CommandPanel";
import ContextFilesPanel from "./ContextFilesPanel";
import PersonalityPanel from "./PersonalityPanel";
import SessionHeaderMenu from "./SessionHeaderMenu";
import HeroIntro from "./HeroIntro";
import { ComposerControls, useSessionControls, type UploadPanelKind } from "./composer";
import { useVoice } from "../voice/useVoice";
import VoiceOverlay from "../voice/VoiceOverlay";
import { getAutoRead } from "../voice/autoread";
import ContentMatches from "./ContentMatches";
import { searchSessions, type SessionContentMatch } from "./sessionSearch";
import { normalizeCatalog, slashResultText, type SlashCommand } from "./slash";
import {
  appendDelta,
  appendInterruptedNotice,
  completeAssistant,
  deltaText,
  errorText,
  isReasoningOnly,
  matchesRuntime,
  normalizeCreatedIdentity,
  normalizeHistoryMessages,
  normalizeReplayed,
  normalizeResumedId,
  normalizeSessions,
  parseStatus,
  settleTools,
  toolDetail,
  toolId,
  toolName,
  toolResult,
  turnStatus,
  upsertTool,
  REQUEST_KINDS,
  type PendingRequest,
  type SessionIdentity,
  type SessionSummary,
  type StatusInfo,
  type TranscriptItem,
} from "./types";

type ResolvedSession = { runtimeId: string; items: TranscriptItem[] };

/** 读取本地文件文本（用于导入会话）。 */
function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("读取失败"));
    reader.readAsText(file);
  });
}

export default function ChatPage() {
  const gateway = useGateway();
  const details = useDetails();
  const session = useOptionalSession();
  const narrow = useMediaQuery("(max-width: 900px)");
  const [view, setView] = useState<"list" | "chat">("list");
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [identity, setIdentity] = useState<SessionIdentity | null>(null);
  const [filter, setFilter] = useState("");
  const [contentMatches, setContentMatches] = useState<SessionContentMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [items, setItems] = useState<TranscriptItem[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<StatusInfo | null>(null);
  const [searchResults, setSearchResults] = useState<SessionSummary[] | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [subagentsOpen, setSubagentsOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [personalityOpen, setPersonalityOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [commands, setCommands] = useState<SlashCommand[]>([]);

  const activeIdRef = useRef<string | null>(null);
  const identityRef = useRef<SessionIdentity | null>(null);
  const attachInFlightRef = useRef<Map<string, Promise<ResolvedSession>>>(new Map());
  const respondersRef = useRef(new Map<string, (result: Record<string, unknown>) => void>());
  const importInputRef = useRef<HTMLInputElement>(null);
  const sendingRef = useRef(false);
  const seqRef = useRef(0);
  const nextId = useCallback(() => `i${seqRef.current++}`, []);

  const me = useMemo(() => {
    const user = session?.user;
    if (!user) {
      return null;
    }
    return { profiles: user.profiles ?? [], default_profile: user.default_profile ?? null };
  }, [session?.user]);

  const controls = useSessionControls({
    gateway,
    activeId,
    identity,
    running,
    me,
    itemCount: items.length,
    onError: (message) => setError(message),
  });
  const selectionProfile = controls.selection.profile;
  const { buildCreateParams, uploadAll, clearAttachments } = controls;

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // 窄屏：选中会话后切到 transcript 视图。
  useEffect(() => {
    if (narrow && activeId) {
      setView("chat");
    }
  }, [narrow, activeId]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        await gateway.connect();
      } catch {
        // 连接失败仍尝试调用（可能此前已连接）
      }
      try {
        const params = selectionProfile ? { profile: selectionProfile } : {};
        const result = await gateway.request("session.list", params);
        if (alive) {
          setSessions(normalizeSessions(result));
        }
      } catch {
        if (alive) {
          setError("无法加载会话列表");
        }
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [gateway, selectionProfile]);

  // T20.1 命令目录：`commands.catalog` 为唯一来源。
  //
  // 原「为空时回退 `complete.slash`」已移除：该回退在本 effect（挂载时、hero 态）发起，
  // 恒无合法 `session_id` —— `complete.slash` 属 R24 `_SessionScoped` 方法，缺 `session_id`
  // 被 BFF fail-closed 拒绝；且其契约 `CompleteSlashParams` 仅声明 `text` / `session_id`
  // （`extra="forbid"`），原载荷 `{ prefix: "/" }` 会判 4000。故该回退既非法（契约）又必然
  // 403（租户守卫），属死路径；`commands.catalog` 已覆盖命令目录。
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        await gateway.connect().catch(() => undefined);
        const catalog = normalizeCatalog(await gateway.request("commands.catalog", {}));
        if (catalog.length > 0 && alive) {
          setCommands(catalog);
        }
      } catch {
        // 命令目录不可用时静默降级（输入框仍可发送普通消息）
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [gateway]);

  const activePair = useCallback((): SessionIdentity | null => {
    const pair = identityRef.current;
    return pair && pair.storedId === activeIdRef.current ? pair : null;
  }, []);

  const reconcileModel = controls.reconcileModel;
  useEffect(() => {
    const unsubscribes = [
      gateway.on("message.delta", (payload) => {
        const pair = activePair();
        if (!pair || !matchesRuntime(payload, pair.runtimeId)) {
          return;
        }
        const text = deltaText(payload);
        if (text) {
          setItems((current) => appendDelta(current, text, nextId()));
        }
      }),
      gateway.on("message.complete", (payload) => {
        const pair = activePair();
        if (!pair || !matchesRuntime(payload, pair.runtimeId)) {
          return;
        }
        const outcome = turnStatus(payload);
        setItems((current) => {
          const sealed = completeAssistant(
            current,
            deltaText(payload),
            nextId(),
            isReasoningOnly(payload),
          );
          if (outcome === "complete") {
            return sealed;
          }
          const settled = settleTools(sealed, outcome === "error" ? "complete" : "interrupted");
          return outcome === "interrupted"
            ? appendInterruptedNotice(settled, nextId())
            : settled;
        });
        setRunning(false);
        if (outcome === "interrupted") {
          setStatus({ phase: "interrupted" });
        } else if (outcome === "error") {
          setStatus({ phase: "error", error: errorText(payload) });
        } else {
          setStatus({ phase: "done" });
        }
        // REQ-010a：回合结束后以 `model.options{profile, session_id}` 回正模型。
        void reconcileModel();
      }),
      gateway.on("tool.start", (payload) => {
        const pair = activePair();
        if (!pair || !matchesRuntime(payload, pair.runtimeId)) {
          return;
        }
        setItems((current) =>
          upsertTool(current, toolId(payload), toolName(payload), "start", {
            detail: toolDetail(payload),
          }),
        );
      }),
      gateway.on("tool.generating", (payload) => {
        const pair = activePair();
        if (!pair || !matchesRuntime(payload, pair.runtimeId)) {
          return;
        }
        setItems((current) =>
          upsertTool(current, toolId(payload), toolName(payload), "generating", {
            detail: toolDetail(payload),
          }),
        );
      }),
      gateway.on("tool.complete", (payload) => {
        const pair = activePair();
        if (!pair || !matchesRuntime(payload, pair.runtimeId)) {
          return;
        }
        setItems((current) =>
          upsertTool(current, toolId(payload), toolName(payload), "complete", {
            result: toolResult(payload),
          }),
        );
      }),
      gateway.on("thinking", (payload) => {
        const pair = activePair();
        if (!pair || !matchesRuntime(payload, pair.runtimeId)) {
          return;
        }
        setStatus({ phase: "thinking", ...parseStatus(payload) });
      }),
      gateway.on("done", (payload) => {
        const pair = activePair();
        const hasId = payload.session_id != null || payload.sessionId != null;
        if (hasId && (!pair || !matchesRuntime(payload, pair.runtimeId))) {
          return;
        }
        setRunning(false);
        setStatus({ phase: "done" });
      }),
      gateway.on("error", (payload) => {
        const pair = activePair();
        const hasId = payload.session_id != null || payload.sessionId != null;
        if (hasId && (!pair || !matchesRuntime(payload, pair.runtimeId))) {
          return;
        }
        setRunning(false);
        setStatus({ phase: "error", error: errorText(payload) });
        if (hasId) {
          setItems((current) => [
            ...current,
            { kind: "notice", id: nextId(), level: "error", text: errorText(payload) },
          ]);
        }
      }),
    ];
    return () => {
      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }
    };
  }, [activePair, gateway, nextId, reconcileModel]);

  useEffect(() => {
    const unsubscribes = REQUEST_KINDS.map((kind) =>
      gateway.onServerRequest(kind, (params, respond, requestId) => {
        const id = nextId();
        respondersRef.current.set(id, respond);
        setPending((current) => [...current, { id, kind, params, rpcId: requestId }]);
      }),
    );
    // 后端撤回挂起请求（timeout/interrupted/shutdown/resolved/session_closed）→ 清除对应卡。
    unsubscribes.push(
      gateway.on("request.cancel", (payload) => {
        const cancelId =
          typeof payload.id === "string" ? payload.id : String(payload.id ?? "");
        if (!cancelId) {
          return;
        }
        setPending((current) =>
          current.filter((entry) => {
            const hit = entry.rpcId === cancelId || entry.params.request_id === cancelId;
            if (hit) {
              respondersRef.current.delete(entry.id);
            }
            return !hit;
          }),
        );
      }),
    );
    return () => {
      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }
    };
  }, [gateway, nextId]);

  // 断线重放：切换会话时拉取待处理服务端请求快照，重新渲染卡片。
  useEffect(() => {
    if (!identity || identity.storedId !== activeId) {
      return;
    }
    let alive = true;
    const params = selectionProfile
      ? { session_id: identity.runtimeId, profile: selectionProfile }
      : { session_id: identity.runtimeId };
    gateway
      .request("session.events.since", params)
      .then((result) => {
        if (!alive) {
          return;
        }
        const replayed = normalizeReplayed(result);
        if (replayed.length === 0) {
          return;
        }
        setPending((current) => {
          const ids = new Set(current.map((entry) => entry.id));
          return [...current, ...replayed.filter((entry) => !ids.has(entry.id))];
        });
      })
      .catch(() => {
        // 重放失败不阻断对话
      });
    return () => {
      alive = false;
    };
  }, [identity?.runtimeId, activeId, selectionProfile, gateway]);

  const resumeSession = useCallback(
    async (storedId: string): Promise<ResolvedSession> => {
      const inflight = attachInFlightRef.current.get(storedId);
      if (inflight) {
        return inflight;
      }
      const promise = (async (): Promise<ResolvedSession> => {
        const params = selectionProfile
          ? { session_id: storedId, profile: selectionProfile }
          : { session_id: storedId };
        const result = await gateway.request("session.resume", params);
        const runtimeId = normalizeResumedId(result);
        if (!runtimeId) {
          throw new Error("会话恢复失败：响应缺少 session_id");
        }
        return { runtimeId, items: normalizeHistoryMessages(result) };
      })();
      attachInFlightRef.current.set(storedId, promise);
      try {
        return await promise;
      } finally {
        attachInFlightRef.current.delete(storedId);
      }
    },
    [gateway, selectionProfile],
  );

  const attachSession = useCallback(
    async (storedId: string, applyHistory = false): Promise<SessionIdentity> => {
      const { runtimeId, items } = await resumeSession(storedId);
      const pair: SessionIdentity = { storedId, runtimeId };
      if (activeIdRef.current === storedId) {
        setIdentity(pair);
        identityRef.current = pair;
        if (applyHistory) {
          setItems(items);
        }
      }
      return pair;
    },
    [resumeSession],
  );

  const selectSession = useCallback(
    (id: string) => {
      setActiveId(id);
      activeIdRef.current = id;
      setItems([]);
      setIdentity(null);
      identityRef.current = null;
      attachSession(id, true).catch(() => {
        if (activeIdRef.current === id) {
          setError("无法恢复会话");
        }
      });
    },
    [attachSession],
  );

  const createSession = useCallback(async () => {
    try {
      const ids = normalizeCreatedIdentity(await gateway.request("session.create", {}));
      if (!ids) {
        setError("无法新建会话");
        return;
      }
      setActiveId(ids.storedId);
      activeIdRef.current = ids.storedId;
      setIdentity(ids);
      identityRef.current = ids;
      setSessions((current) =>
        current.some((session) => session.id === ids.storedId)
          ? current
          : [{ id: ids.storedId, title: "新会话" }, ...current],
      );
      setItems([]);
    } catch {
      setError("无法新建会话");
    }
  }, [gateway]);

  const renameSession = useCallback(
    async (targetStoredId: string, title: string) => {
      try {
        const active = activePair();
        const runtimeId =
          active && active.storedId === targetStoredId
            ? active.runtimeId
            : (await resumeSession(targetStoredId)).runtimeId;
        await gateway.request("session.title", { session_id: runtimeId, title });
        setSessions((current) =>
          current.map((session) =>
            session.id === targetStoredId ? { ...session, title } : session,
          ),
        );
      } catch {
        setError("重命名失败");
      }
    },
    [activePair, gateway, resumeSession],
  );

  const deleteSession = useCallback(
    async (id: string) => {
      try {
        await gateway.request("session.delete", { session_id: id });
        setSessions((current) => current.filter((session) => session.id !== id));
        setActiveId((current) => (current === id ? null : current));
      } catch {
        setError("删除失败");
      }
    },
    [gateway],
  );

  const linkedRef = useRef(false);
  // 通知中心直达：`/chat?session=<id>` 选中该会话（仅一次，等价点选路径）。
  useEffect(() => {
    if (linkedRef.current || sessions.length === 0 || typeof window === "undefined") {
      return;
    }
    const target = new URLSearchParams(window.location.search).get("session");
    if (target && sessions.some((session) => session.id === target)) {
      linkedRef.current = true;
      selectSession(target);
    }
  }, [selectSession, sessions]);

  const pruneSessions = useCallback(async () => {
    try {
      await api("/api/hermes/sessions/prune", { method: "POST", body: JSON.stringify({}) });
      const params = selectionProfile ? { profile: selectionProfile } : {};
      const result = await gateway.request("session.list", params);
      setSessions(normalizeSessions(result));
    } catch {
      setError("清理失败");
    }
  }, [gateway, selectionProfile]);

  const bulkDeleteSessions = useCallback(async (ids: string[]) => {
    if (ids.length === 0) {
      return;
    }
    try {
      await api("/api/hermes/sessions/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ ids }),
      });
      setSessions((current) => current.filter((session) => !ids.includes(session.id)));
      setActiveId((current) => (current && ids.includes(current) ? null : current));
    } catch {
      setError("批量删除失败");
    }
  }, []);

  const handleSend = useCallback(
    (text: string): Promise<boolean> => {
      if (sendingRef.current) {
        // single-flight：发送进行中忽略重复触发（不产生第 2 次 session.create）。
        return Promise.resolve(true);
      }
      sendingRef.current = true;
      const msg = (error: unknown) => String((error as Error)?.message ?? "发送失败");
      return (async (): Promise<boolean> => {
        const storedId = activeIdRef.current;
        if (storedId === null) {
          // hero：延迟绑定 create → attach* → submit（REQ-006）。
          let result: unknown;
          try {
            result = await gateway.request("session.create", { ...buildCreateParams() });
          } catch (createError) {
            setError(msg(createError));
            return false;
          }
          const ids = normalizeCreatedIdentity(result);
          if (!ids) {
            setError("无法新建会话");
            return false;
          }
          setActiveId(ids.storedId);
          activeIdRef.current = ids.storedId;
          setIdentity(ids);
          identityRef.current = ids;
          setSessions((current) =>
            current.some((session) => session.id === ids.storedId)
              ? current
              : [{ id: ids.storedId, title: "新会话" }, ...current],
          );
          setItems((current) => [
            ...current,
            { kind: "message", id: nextId(), role: "user", text },
          ]);
          setRunning(true);
          setStatus({ phase: "thinking" });
          try {
            await uploadAll(ids.runtimeId);
          } catch (attachError) {
            setRunning(false);
            setError(msg(attachError));
            return false;
          }
          try {
            await gateway.request("prompt.submit", { text, session_id: ids.runtimeId });
          } catch (submitError) {
            setRunning(false);
            setError(msg(submitError));
            return false;
          }
          clearAttachments();
          return true;
        }

        setItems((current) => [
          ...current,
          { kind: "message", id: nextId(), role: "user", text },
        ]);
        setRunning(true);
        setStatus({ phase: "thinking" });
        let pair = activePair();
        if (!pair) {
          try {
            pair = await attachSession(storedId);
          } catch {
            setRunning(false);
            setError("无法恢复会话");
            return false;
          }
        }
        if (activeIdRef.current !== storedId) {
          setRunning(false);
          return true;
        }
        try {
          await uploadAll(pair.runtimeId);
        } catch (attachError) {
          setRunning(false);
          setError(msg(attachError));
          return false;
        }
        try {
          await gateway.request("prompt.submit", { text, session_id: pair.runtimeId });
          clearAttachments();
          return true;
        } catch (submitError) {
          if (!isSessionNotFound(submitError)) {
            setRunning(false);
            setError(msg(submitError));
            return false;
          }
          const next = await attachSession(storedId).catch(() => null);
          if (next && activeIdRef.current === storedId) {
            try {
              await gateway.request("prompt.submit", { text, session_id: next.runtimeId });
              clearAttachments();
              return true;
            } catch (retryError) {
              setRunning(false);
              setError(msg(retryError));
              return false;
            }
          }
          setRunning(false);
          if (activeIdRef.current !== storedId) {
            return true;
          }
          setError(msg(submitError));
          return false;
        }
      })().finally(() => {
        sendingRef.current = false;
      });
    },
    [
      activePair,
      attachSession,
      buildCreateParams,
      clearAttachments,
      gateway,
      nextId,
      uploadAll,
    ],
  );

  const handleStop = useCallback(() => {
    const pair = activePair();
    if (!pair) {
      return;
    }
    gateway
      .request("session.interrupt", { session_id: pair.runtimeId })
      .then((result) => {
        // 回包 {status:"interrupted"|"not_interrupted"}：not_interrupted 表示会话已不在运行，静默即可。
        void result;
      })
      .catch(() => {
        setError("无法中断");
      })
      .finally(() => setRunning(false));
  }, [activePair, gateway]);

  // T20.1 执行 slash 命令：`slash.exec {command, args}`，结果作为完成提示追加到 transcript。
  const handleSlash = useCallback(
    (command: string, args: string) => {
      const label = args ? `/${command} ${args}` : `/${command}`;
      setItems((current) => [
        ...current,
        { kind: "message", id: nextId(), role: "user", text: label },
      ]);
      setError(null);
      gateway
        .request("slash.exec", { command: `/${command}`, args })
        .then((result) => {
          const text = slashResultText(result) || t("slash.done", { command: `/${command}` });
          setItems((current) => [
            ...current,
            { kind: "notice", id: nextId(), level: "done", text },
          ]);
        })
        .catch(() => setError(t("slash.error")));
    },
    [gateway, nextId],
  );

  const handleOpenPanel = useCallback((kind: UploadPanelKind) => {
    if (kind === "subagents") {
      setSubagentsOpen(true);
    } else if (kind === "commands") {
      setCommandOpen(true);
    } else if (kind === "context") {
      setContextOpen(true);
    } else if (kind === "personality") {
      setPersonalityOpen(true);
    } else if (kind === "image") {
      setImageOpen(true);
    }
  }, []);

  const exportSession = useCallback(async () => {
    const sessionId = activeIdRef.current;
    if (!sessionId) {
      return;
    }
    try {
      await api("/api/hermes/sessions/export", {
        method: "POST",
        body: JSON.stringify({ session_id: sessionId }),
      });
    } catch {
      setError("导出失败");
    }
  }, []);

  const importSession = useCallback(
    async (file: File) => {
      try {
        const text = await readFileText(file);
        await api("/api/hermes/sessions/import", { method: "POST", body: text });
        const params = selectionProfile ? { profile: selectionProfile } : {};
        const result = await gateway.request("session.list", params);
        setSessions(normalizeSessions(result));
      } catch {
        setError("导入失败");
      }
    },
    [gateway, selectionProfile],
  );

  const shareSession = useCallback(async () => {
    const sessionId = activeIdRef.current;
    if (!sessionId) {
      return;
    }
    const link = `${location.origin}${location.pathname}?session=${encodeURIComponent(sessionId)}`;
    try {
      await navigator.clipboard?.writeText(link);
    } catch {
      // 剪贴板不可用时仅展示链接
    }
    setShareLink(link);
  }, []);

  const answerRequest = useCallback(
    (requestId: string, result: Record<string, unknown>) => {
      const respond = respondersRef.current.get(requestId);
      respond?.(result);
      respondersRef.current.delete(requestId);
      const value = result.choice ?? result.answer ?? result.value;
      const label = typeof value === "string" ? value : "已提交";
      setPending((current) =>
        current.map((entry) =>
          entry.id === requestId ? { ...entry, answered: true, answer: label } : entry,
        ),
      );
    },
    [],
  );

  // 会话搜索：防抖后走 L1 `session.list {q}`（BFF→L1/L2）。
  useEffect(() => {
    const query = filter.trim();
    if (query === "") {
      setSearchResults(null);
      return;
    }
    const handle = setTimeout(() => {
      const params = selectionProfile
        ? { q: query, profile: selectionProfile }
        : { q: query };
      gateway
        .request("session.list", params)
        .then((result) => setSearchResults(normalizeSessions(result)))
        .catch(() => setSearchResults(null));
    }, 250);
    return () => clearTimeout(handle);
  }, [filter, gateway, selectionProfile]);

  const visible = useMemo(() => {
    if (searchResults !== null) {
      return searchResults;
    }
    const query = filter.trim().toLowerCase();
    if (!query) {
      return sessions;
    }
    return sessions.filter((session) => session.title.toLowerCase().includes(query));
  }, [searchResults, sessions, filter]);

  const active = sessions.find((session) => session.id === activeId) ?? null;

  const startRename = useCallback(() => {
    if (!active) {
      return;
    }
    setRenameDraft(active.title);
    setRenaming(true);
  }, [active]);

  const submitRename = useCallback(() => {
    const storedId = activeIdRef.current;
    const title = renameDraft.trim();
    setRenaming(false);
    if (storedId && title) {
      void renameSession(storedId, title);
    }
  }, [renameDraft, renameSession]);

  // C06 会话全文检索（FTS5）：标题过滤之外，防抖查询 `/api/sessions/search`。
  useEffect(() => {
    const q = filter.trim();
    if (!q) {
      setContentMatches([]);
      return;
    }
    let alive = true;
    const timer = setTimeout(() => {
      searchSessions(q)
        .then((matches) => {
          if (alive) {
            setContentMatches(matches);
          }
        })
        .catch(() => {
          if (alive) {
            setContentMatches([]);
          }
        });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [filter]);

  // M19 语音：按住说话 → voice.transcript → 直接发送（与手输同一 handleSend 路径）。
  const voice = useVoice({
    sessionId: () => activePair()?.runtimeId ?? null,
    onTranscript: (text) => {
      void handleSend(text);
    },
  });

  // M19 自动朗读：message.complete 时按本地偏好朗读助手文本（值经 ref 取，避免重订阅）。
  const speakRef = useRef<(text: string) => void>(() => undefined);
  speakRef.current = voice.speak;
  useEffect(() => {
    return gateway.on("message.complete", (payload) => {
      if (!getAutoRead()) {
        return;
      }
      const text = typeof payload.text === "string" ? payload.text : "";
      if (text) {
        speakRef.current(text);
      }
    });
  }, [gateway]);

  return (
    <div className="chat" data-narrow={narrow} data-view={view}>
      <aside className="chat-list">
        <SessionList
          sessions={visible}
          activeId={activeId}
          filter={filter}
          onFilterChange={setFilter}
          onSelect={selectSession}
          onCreate={createSession}
          onRename={renameSession}
          onDelete={deleteSession}
          onResume={(id) => selectSession(id)}
          onPrune={pruneSessions}
          onBulkDelete={bulkDeleteSessions}
        />
        <ContentMatches matches={contentMatches} onSelect={selectSession} />
      </aside>

      <section className="chat-main" data-variant={controls.variant}>
        {narrow && active ? (
          <button
            type="button"
            className="ghost chat-back"
            aria-label={t("chat.backToList")}
            onClick={() => setView("list")}
          >
            ‹ {t("chat.showList")}
          </button>
        ) : null}
        {error ? <p className="err chat-error">{error}</p> : null}
        {notice ? (
          <p className="muted chat-notice" role="status">
            {notice}
          </p>
        ) : null}
        <div className="chat-header">
          <h2 className="chat-title">{active ? active.title : "对话"}</h2>
          <div className="chat-header-actions">
            {active ? (
              <SessionHeaderMenu
                onConnect={() => setNotice(t("composer.header.connectUnavailable"))}
                onImport={() => importInputRef.current?.click()}
                onExport={() => void exportSession()}
                onShare={() => void shareSession()}
                onRename={startRename}
              />
            ) : null}
            <button
              type="button"
              className="icon-btn"
              aria-label={details.open ? t("shell.closeDetails") : t("shell.openDetails")}
              aria-pressed={details.open}
              onClick={details.toggle}
            >
              <Icon name="panel" />
            </button>
          </div>
        </div>
        {renaming && active ? (
          <form
            className="chat-rename"
            onSubmit={(event) => {
              event.preventDefault();
              submitRename();
            }}
          >
            <input
              className="chat-rename-input"
              aria-label={`重命名 ${active.title}`}
              value={renameDraft}
              onChange={(event) => setRenameDraft(event.target.value)}
            />
            <button type="submit" className="ghost">
              {t("composer.rename.confirm")}
            </button>
            <button type="button" className="ghost" onClick={() => setRenaming(false)}>
              {t("composer.rename.cancel")}
            </button>
          </form>
        ) : null}
        <input
          ref={importInputRef}
          type="file"
          className="visually-hidden"
          aria-label="导入会话"
          accept=".json,application/json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void importSession(file);
            }
            event.target.value = "";
          }}
        />
        {shareLink ? <p className="muted chat-share">{shareLink}</p> : null}
        {subagentsOpen ? (
          <SubagentsPanel
            sessionId={activePair()?.runtimeId ?? null}
            onClose={() => setSubagentsOpen(false)}
          />
        ) : null}
        {imageOpen ? <ImageGenAction onClose={() => setImageOpen(false)} /> : null}
        {contextOpen ? <ContextFilesPanel onClose={() => setContextOpen(false)} /> : null}
        {personalityOpen ? (
          <PersonalityPanel onClose={() => setPersonalityOpen(false)} />
        ) : null}
        {commandOpen ? (
          <CommandPanel
            onClose={() => setCommandOpen(false)}
            onResult={(text) =>
              setItems((current) => [
                ...current,
                { kind: "notice", id: nextId(), level: "done", text },
              ])
            }
          />
        ) : null}
        {controls.variant === "hero" ? (
          <HeroIntro sessions={sessions} onSelect={selectSession} />
        ) : (
          <>
            <Transcript items={items} onSpeak={voice.speak} />
            {pending.length > 0 ? (
              <div className="pending-requests">
                {pending.map((request) => (
                  <ServerRequestCard
                    key={request.id}
                    request={request}
                    onRespond={(result) => answerRequest(request.id, result)}
                  />
                ))}
              </div>
            ) : null}
          </>
        )}
        <Composer
          variant={controls.variant}
          running={running}
          onSend={handleSend}
          onStop={handleStop}
          attachments={controls.attachments}
          onAttach={controls.attach}
          onAttachFiles={controls.attach}
          onRemoveAttachment={controls.removeAttachment}
          attachmentCount={controls.attachments.length}
          commands={commands}
          onSlash={handleSlash}
          controls={({ canSend, submit }) => (
            <ComposerControls
              variant={controls.variant}
              agentOptions={controls.options.agents}
              agentValue={controls.selection.profile}
              onSelectAgent={controls.selectProfile}
              agentDisabled={running}
              workspaceOptions={controls.options.workspaces}
              workspaceValue={controls.selection.cwd}
              onSelectWorkspace={(path) => void controls.selectWorkspace(path)}
              modelOptions={controls.options.models}
              modelValue={controls.selection.model}
              modelCurrent={{ model: controls.selection.model, provider: null }}
              modelSwitch={controls.modelSwitch}
              onSelectModel={(model) => void controls.selectModel(model)}
              onConfirmModel={() => void controls.confirmModel()}
              onCancelModelConfirm={controls.cancelModelConfirm}
              modelDisabled={controls.variant === "docked" && !controls.identityReady}
              permissionValue={controls.selection.yolo}
              onSelectPermission={(mode) => void controls.selectYolo(mode)}
              permissionDisabled={controls.variant === "docked" && !controls.identityReady}
              onAttachFiles={controls.attach}
              onOpenPanel={handleOpenPanel}
              uploadDisabled={controls.variant === "docked" && !controls.identityReady}
              running={running}
              canSend={canSend}
              onSend={submit}
              onStop={handleStop}
              onMicToggle={voice.toggle}
              listening={voice.listening}
            />
          )}
        />
        <StatusBar status={status} />
        {voice.listening ? (
          <VoiceOverlay transcript={voice.transcript} onStop={voice.stop} />
        ) : null}
      </section>
    </div>
  );
}
