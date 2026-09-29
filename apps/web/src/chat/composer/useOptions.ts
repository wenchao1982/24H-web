/**
 * 对话页控件选项加载（TASK-006B / REQ-002 / REQ-012 / REQ-019）。
 *
 * - `agents` = `normalizeAgentOptions(me)`（只认 `me.profiles`，绝不回退 `profiles.list`）。
 * - `models` = WS `model.options{profile}` → `normalizeModelCatalog`。
 * - `workspaces` = `GET /api/hermes/chat/workspaces?profile=<name>` → `normalizeWorkspaces`。
 *
 * 缓存键 `<sessionKey>::<profile>`（`sessionKey ∈ {"__hero__"} ∪ storedId`）：
 * 同一 `(sessionKey, profile)` 组合一次页面生命周期内加载 ≤ 1 次。
 * **create 成功后按 hero 键迁移到 storedId 键而不重载**（REQ-005 / NFR）。
 * 无可用 profile（未选且 `default_profile` 为空）时**不发起任何请求**并报可读错误（REQ-019 / REQ-012）。
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api/client";
import { t } from "../../i18n";
import type { Gateway } from "../../api/ws";
import { normalizeWorkspaces } from "../types";
import { normalizeAgentOptions, type AgentOption } from "./agentOptions";
import { normalizeModelCatalog, type ModelOption } from "./modelCatalog";

export interface OptionsState {
  agents: AgentOption[];
  models: ModelOption[];
  workspaces: string[];
  loading: { agents: boolean; models: boolean; workspaces: boolean };
}

export interface UseOptionsArgs {
  gateway: Gateway;
  me: { profiles: string[]; default_profile: string | null } | null;
  activeId: string | null;
  /** 当前选择的 profile（null 表示未显式选择，加载时回退 `default_profile`）。 */
  profile: string | null;
  onError: (message: string) => void;
}

interface CacheEntry {
  models: ModelOption[];
  workspaces: string[];
}

export const HERO_SESSION_KEY = "__hero__";

function cacheKey(sessionKey: string, profile: string): string {
  return `${sessionKey}::${profile}`;
}

function errorMessage(error: unknown): string {
  return String((error as Error)?.message ?? error ?? "加载失败");
}

export function useOptions({
  gateway,
  me,
  activeId,
  profile,
  onError,
}: UseOptionsArgs): OptionsState {
  const sessionKey = activeId ?? HERO_SESSION_KEY;
  const profileName = profile ?? me?.default_profile ?? null;
  const agents = useMemo(() => normalizeAgentOptions(me), [me]);

  const [models, setModels] = useState<ModelOption[]>([]);
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [loading, setLoading] = useState({ models: false, workspaces: false });

  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const inFlightRef = useRef<Map<string, Promise<CacheEntry | null>>>(new Map());
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const previousKeyRef = useRef<{ sessionKey: string; profile: string | null }>({
    sessionKey,
    profile: profileName,
  });

  // create 成功：把 hero 键迁移到 storedId 键，避免同一逻辑会话加载两次。
  useEffect(() => {
    const previous = previousKeyRef.current;
    if (
      previous.sessionKey === HERO_SESSION_KEY &&
      sessionKey !== HERO_SESSION_KEY &&
      profileName !== null &&
      profileName === previous.profile
    ) {
      const from = cacheKey(HERO_SESSION_KEY, profileName);
      const to = cacheKey(sessionKey, profileName);
      const entry = cacheRef.current.get(from);
      if (entry) {
        cacheRef.current.set(to, entry);
        cacheRef.current.delete(from);
      }
      const pending = inFlightRef.current.get(from);
      if (pending) {
        inFlightRef.current.set(to, pending);
      }
    }
    previousKeyRef.current = { sessionKey, profile: profileName };
  }, [sessionKey, profileName]);

  useEffect(() => {
    let alive = true;
    if (profileName === null) {
      setLoading({ models: false, workspaces: false });
      setModels([]);
      setWorkspaces([]);
      // `me === null` 表示会话尚未加载（非「已加载但无 profile」）；仅后者报错。
      if (me !== null) {
        onErrorRef.current(t("composer.errors.noProfile"));
      }
      return () => {
        alive = false;
      };
    }

    const key = cacheKey(sessionKey, profileName);
    const cached = cacheRef.current.get(key);
    if (cached) {
      setModels(cached.models);
      setWorkspaces(cached.workspaces);
      setLoading({ models: false, workspaces: false });
      return () => {
        alive = false;
      };
    }

    const existing = inFlightRef.current.get(key);
    const pending =
      existing ??
      (async (): Promise<CacheEntry | null> => {
        try {
          const [modelResult, workspaceResult] = await Promise.all([
            gateway.request("model.options", { profile: profileName }),
            api<unknown>(`/api/hermes/chat/workspaces?profile=${encodeURIComponent(profileName)}`),
          ]);
          return {
            models: normalizeModelCatalog(modelResult).options,
            workspaces: normalizeWorkspaces(workspaceResult),
          };
        } catch (error) {
          onErrorRef.current(errorMessage(error));
          return null;
        }
      })();

    if (!existing) {
      inFlightRef.current.set(key, pending);
      void pending.finally(() => {
        inFlightRef.current.delete(key);
      });
    }

    setLoading({ models: true, workspaces: true });
    void pending.then((entry) => {
      if (!alive || !entry) {
        return;
      }
      cacheRef.current.set(key, entry);
      setModels(entry.models);
      setWorkspaces(entry.workspaces);
      setLoading({ models: false, workspaces: false });
    });

    return () => {
      alive = false;
    };
  }, [gateway, sessionKey, profileName]);

  return {
    agents,
    models,
    workspaces,
    loading: {
      agents: me === null,
      models: loading.models,
      workspaces: loading.workspaces,
    },
  };
}
