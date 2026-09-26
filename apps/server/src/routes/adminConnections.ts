import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { Db } from "../db";
import { ApiError } from "../http/errors";
import { logAudit } from "../audit/repo";
import { requireSuperAdmin } from "../session/middleware";
import {
  createConnection,
  deleteConnection,
  listConnections,
  toConnectionView,
  updateConnection,
} from "../hermes/connections";

export interface AdminConnectionsOptions {
  db: Db;
}

function readString(body: unknown, key: string): string {
  if (body && typeof body === "object") {
    const value = (body as Record<string, unknown>)[key];
    if (typeof value === "string") {
      return value;
    }
  }
  return "";
}

function readOptionalString(body: unknown, key: string): string | undefined {
  if (body && typeof body === "object" && key in (body as Record<string, unknown>)) {
    const value = (body as Record<string, unknown>)[key];
    if (value !== null && typeof value !== "string") {
      throw new ApiError(400, "INVALID_INPUT", `${key} 必须是字符串`);
    }
    return value === null ? undefined : value.trim();
  }
  return undefined;
}

function readOptionalBoolean(body: unknown, key: string): boolean | undefined {
  if (body && typeof body === "object" && key in (body as Record<string, unknown>)) {
    const value = (body as Record<string, unknown>)[key];
    if (typeof value !== "boolean") {
      throw new ApiError(400, "INVALID_INPUT", `${key} 必须是布尔值`);
    }
    return value;
  }
  return undefined;
}

function normalizeLabel(value: string): string {
  const label = value.trim();
  if (label.length === 0 || label.length > 100) {
    throw new ApiError(400, "INVALID_INPUT", "label 不能为空且不超过 100 字符");
  }
  return label;
}

function normalizeUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ApiError(400, "INVALID_INPUT", "url 不是合法的地址");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ApiError(400, "INVALID_INPUT", "url 必须是 http/https");
  }
  return value.replace(/\/+$/, "");
}

function readIdParam(request: FastifyRequest): string {
  const id = (request.params as { id?: string }).id ?? "";
  if (id.trim() === "") {
    throw new ApiError(400, "INVALID_INPUT", "无效的连接 ID");
  }
  return id;
}

export const adminConnectionsRoutes: FastifyPluginAsync<AdminConnectionsOptions> = async (
  app,
  opts,
) => {
  const { db } = opts;

  app.get("/api/admin/connections", { preHandler: requireSuperAdmin }, async () =>
    listConnections(db),
  );

  app.post("/api/admin/connections", { preHandler: requireSuperAdmin }, async (request, reply) => {
    const label = normalizeLabel(readString(request.body, "label"));
    const url = normalizeUrl(readString(request.body, "url"));
    const token = readOptionalString(request.body, "token");
    const isDefault = readOptionalBoolean(request.body, "isDefault") ?? false;

    const row = createConnection(db, {
      label,
      url,
      token: token && token.length > 0 ? token : null,
      isDefault,
    });

    logAudit(db, {
      actorId: request.user?.id ?? null,
      action: "connection.create",
      targetType: "connection",
      targetId: row.id,
      ip: request.ip,
      detail: JSON.stringify({ label: row.label, url: row.url, isDefault: row.is_default === 1 }),
    });

    reply.status(201);
    return toConnectionView(row);
  });

  app.patch("/api/admin/connections/:id", { preHandler: requireSuperAdmin }, async (request) => {
    const id = readIdParam(request);

    const label = readOptionalString(request.body, "label");
    const url = readOptionalString(request.body, "url");
    const token = readOptionalString(request.body, "token");
    const isDefault = readOptionalBoolean(request.body, "isDefault");

    if (label === undefined && url === undefined && token === undefined && isDefault === undefined) {
      throw new ApiError(400, "INVALID_INPUT", "没有需要更新的字段");
    }

    const row = updateConnection(db, id, {
      ...(label !== undefined ? { label: normalizeLabel(label) } : {}),
      ...(url !== undefined ? { url: normalizeUrl(url) } : {}),
      ...(token !== undefined ? { token: token.length > 0 ? token : null } : {}),
      ...(isDefault !== undefined ? { isDefault } : {}),
    });

    if (!row) {
      throw new ApiError(404, "CONNECTION_NOT_FOUND", "连接不存在");
    }

    logAudit(db, {
      actorId: request.user?.id ?? null,
      action: "connection.update",
      targetType: "connection",
      targetId: row.id,
      ip: request.ip,
      detail: JSON.stringify({ label: row.label, url: row.url, isDefault: row.is_default === 1 }),
    });

    return toConnectionView(row);
  });

  app.delete("/api/admin/connections/:id", { preHandler: requireSuperAdmin }, async (request) => {
    const id = readIdParam(request);
    const removed = deleteConnection(db, id);
    if (!removed) {
      throw new ApiError(404, "CONNECTION_NOT_FOUND", "连接不存在");
    }

    logAudit(db, {
      actorId: request.user?.id ?? null,
      action: "connection.delete",
      targetType: "connection",
      targetId: id,
      ip: request.ip,
    });

    return { ok: true };
  });
};
