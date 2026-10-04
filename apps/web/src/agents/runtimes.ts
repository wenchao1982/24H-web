import { api } from "../api/client";

/** 外部 agent 运行时状态（BFF `GET /api/agents`）。 */
export interface AgentRuntime {
  id: string;
  name: string;
  vendor: string;
  bin: string;
  packageName: string | null;
  installable: boolean;
  installed: boolean;
  version: string | null;
}

export interface AgentCatalogEntry {
  id: string;
  name: string;
  vendor: string;
  bin: string;
  packageName: string | null;
  installable: boolean;
  installCommand: string | null;
}

export interface UpdateCheck {
  id: string;
  installed: boolean;
  currentVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean;
}

export type PolicyMap = Record<string, { autoUpdate: boolean }>;

export async function listRuntimes(): Promise<AgentRuntime[]> {
  const payload = await api<{ agents?: AgentRuntime[] }>("/api/agents");
  return Array.isArray(payload.agents) ? payload.agents : [];
}

export async function listCatalog(): Promise<AgentCatalogEntry[]> {
  const payload = await api<{ catalog?: AgentCatalogEntry[] }>("/api/agents/catalog");
  return Array.isArray(payload.catalog) ? payload.catalog : [];
}

export function installRuntime(id: string): Promise<AgentRuntime> {
  return api<AgentRuntime>(`/api/agents/${encodeURIComponent(id)}/install`, { method: "POST" });
}

export function removeRuntime(id: string): Promise<AgentRuntime> {
  return api<AgentRuntime>(`/api/agents/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function checkRuntimeUpdate(id: string): Promise<UpdateCheck> {
  return api<UpdateCheck>(`/api/agents/${encodeURIComponent(id)}/check-update`, { method: "POST" });
}

export async function getUpdatePolicies(): Promise<PolicyMap> {
  const payload = await api<{ policies?: PolicyMap }>("/api/agents/update-policy");
  return payload.policies ?? {};
}

export async function setUpdatePolicy(id: string, enabled: boolean): Promise<PolicyMap> {
  const payload = await api<{ policies?: PolicyMap }>(
    `/api/agents/${encodeURIComponent(id)}/update-policy`,
    { method: "PUT", body: JSON.stringify({ enabled }) },
  );
  return payload.policies ?? {};
}
