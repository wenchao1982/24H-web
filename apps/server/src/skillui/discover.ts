import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import {
  SKILL_UI_PROTOCOL,
  type DiscoveredSkillUi,
  type SkillUiInfo,
  type SkillUiManifest,
} from "./types";

const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const ENTRY_PATTERN = /^[a-zA-Z0-9_./-]+\.html$/;

/** 解析 `OS_SKILL_ROOTS`（逗号分隔）；未设置时回退仓库内 `examples/skills`。 */
export function defaultSkillRoots(env: NodeJS.ProcessEnv = process.env): string[] {
  const configured = (env.OS_SKILL_ROOTS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
  if (configured.length > 0) {
    return configured.map((entry) => resolve(entry));
  }
  return [fileURLToPath(new URL("../../../../examples/skills", import.meta.url))];
}

function parseManifest(raw: string): SkillUiManifest | null {
  let data: Partial<SkillUiManifest>;
  try {
    data = JSON.parse(raw) as Partial<SkillUiManifest>;
  } catch {
    return null;
  }

  if (!data || data.protocol !== SKILL_UI_PROTOCOL) {
    return null;
  }
  if (typeof data.id !== "string" || !ID_PATTERN.test(data.id)) {
    return null;
  }
  if (typeof data.title !== "string" || data.title.trim() === "") {
    return null;
  }
  if (typeof data.entry !== "string" || !ENTRY_PATTERN.test(data.entry)) {
    return null;
  }
  if (data.host !== "iframe") {
    return null;
  }
  if (!Array.isArray(data.capabilities) || !data.capabilities.every((c) => typeof c === "string")) {
    return null;
  }
  if (!Array.isArray(data.permissions) || !data.permissions.every((p) => typeof p === "string")) {
    return null;
  }

  const manifest: SkillUiManifest = {
    protocol: SKILL_UI_PROTOCOL,
    id: data.id,
    title: data.title.trim(),
    entry: data.entry,
    host: "iframe",
    capabilities: [...data.capabilities],
    permissions: [...data.permissions],
  };
  if (data.size && typeof data.size === "object") {
    manifest.size = {
      ...(typeof data.size.width === "number" ? { width: data.size.width } : {}),
      ...(typeof data.size.height === "number" ? { height: data.size.height } : {}),
    };
  }
  return manifest;
}

function toInfo(manifest: SkillUiManifest): SkillUiInfo {
  return {
    id: manifest.id,
    title: manifest.title,
    entry: manifest.entry,
    host: manifest.host,
    capabilities: manifest.capabilities,
    permissions: manifest.permissions,
    ...(manifest.size ? { size: manifest.size } : {}),
  };
}

/**
 * 扫描根目录下的 `<root>/<skill>/ui/manifest.json`，按出现顺序去重（同名 id 先到先得）。
 * 无法读取的根 / 条目直接跳过（不抛错）。
 */
export function discoverSkillUis(roots: string[]): DiscoveredSkillUi[] {
  const found = new Map<string, DiscoveredSkillUi>();

  for (const root of roots) {
    let entries: string[];
    try {
      entries = readdirSync(root);
    } catch {
      continue;
    }

    for (const name of entries) {
      if (found.has(name)) {
        continue;
      }
      const uiRoot = resolve(root, name, "ui");
      let raw: string;
      try {
        raw = readFileSync(resolve(uiRoot, "manifest.json"), "utf8");
      } catch {
        continue;
      }
      const manifest = parseManifest(raw);
      if (!manifest || found.has(manifest.id)) {
        continue;
      }
      found.set(manifest.id, { info: toInfo(manifest), uiRoot });
    }
  }

  return [...found.values()];
}

export function findSkillUi(roots: string[], id: string): DiscoveredSkillUi | null {
  return discoverSkillUis(roots).find((skill) => skill.info.id === id) ?? null;
}

const CONTENT_TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json; charset=utf-8",
  png: "image/png",
  svg: "image/svg+xml",
  woff2: "font/woff2",
  yaml: "text/yaml; charset=utf-8",
  yml: "text/yaml; charset=utf-8",
  md: "text/markdown; charset=utf-8",
};

export interface ResolvedAsset {
  absolutePath: string;
  contentType: string;
}

/**
 * 解析静态资源相对路径：必须落在 `uiRoot` 内且扩展名在白名单。
 * 越界 / 非法返回 null（调用方 404）。
 */
export function resolveSkillAsset(uiRoot: string, relativePath: string): ResolvedAsset | null {
  const cleaned = relativePath.replace(/^\/+/, "");
  if (cleaned === "" || cleaned.includes("\0")) {
    return null;
  }

  const absolutePath = resolve(uiRoot, cleaned);
  const prefix = uiRoot.endsWith("/") ? uiRoot : `${uiRoot}/`;
  if (absolutePath !== uiRoot && !absolutePath.startsWith(prefix)) {
    return null;
  }

  const dot = absolutePath.lastIndexOf(".");
  if (dot < 0) {
    return null;
  }
  const ext = absolutePath.slice(dot + 1).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) {
    return null;
  }

  return { absolutePath, contentType };
}
