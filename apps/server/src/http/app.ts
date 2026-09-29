import { randomUUID } from "node:crypto";
import cookie from "@fastify/cookie";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance } from "fastify";
import type { Db } from "../db";
import { registerErrorHandler } from "./errors";
import { registerCsrfGuard } from "./csrf";
import { config } from "../config";
import { authRoutes } from "../routes/auth";
import { adminRoutes } from "../routes/admin";
import { adminConnectionsRoutes } from "../routes/adminConnections";
import { hermesRoutes } from "../routes/hermes";
import { systemRoutes } from "../routes/system";
import { hermesWsRoutes, WS_MAX_PAYLOAD } from "../hermes/proxy";
import { integrationsRoutes } from "../routes/integrations";
import { skillUiRoutes } from "../routes/skillUi";
import type { GhRunner } from "../integrations/github";
import { defaultSkillRoots } from "../skillui/discover";
import { defaultWorkspaceRoot, type CallModelFn } from "../skillui/broker";
import { llmOneshot } from "../hermes/oneshot";
import { registerSessionMiddleware } from "../session/middleware";

export interface SkillHostOptions {
  roots?: string[];
  workspaceRoot?: string;
  callModel?: CallModelFn;
}

export interface BuildAppOptions {
  logger?: boolean;
  hermesBaseUrl?: string;
  githubRunner?: GhRunner;
  skillHost?: SkillHostOptions;
}

export function buildApp(db: Db, options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: options.logger ?? true,
    genReqId: (req) => {
      const header = req.headers["x-request-id"];
      return typeof header === "string" && header.length > 0 ? header : randomUUID();
    },
  });

  app.addHook("onSend", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });

  app.register(cookie);
  // REQ-018：显式设 maxPayload（作用于客户端接入侧 socket；上游侧见 hermes/proxy.ts）。
  app.register(websocket, { options: { maxPayload: WS_MAX_PAYLOAD } });

  app.decorate("db", db);
  registerErrorHandler(app);
  registerCsrfGuard(app);
  registerSessionMiddleware(app, db);

  app.register(authRoutes, { db });
  app.register(adminRoutes, { db });
  app.register(adminConnectionsRoutes, { db });
  app.register(hermesRoutes, {
    db,
    defaultBaseUrl: options.hermesBaseUrl ?? config.hermesBaseUrl,
  });
  app.register(systemRoutes, {
    db,
    defaultBaseUrl: options.hermesBaseUrl ?? config.hermesBaseUrl,
  });
  app.register(hermesWsRoutes, {
    db,
    defaultBaseUrl: options.hermesBaseUrl ?? config.hermesBaseUrl,
  });
  app.register(integrationsRoutes, {
    db,
    ...(options.githubRunner ? { githubRunner: options.githubRunner } : {}),
  });

  const hermesBaseUrl = options.hermesBaseUrl ?? config.hermesBaseUrl;
  const workspaceRoot = options.skillHost?.workspaceRoot ?? defaultWorkspaceRoot();
  app.register(skillUiRoutes, {
    roots: options.skillHost?.roots ?? defaultSkillRoots(),
    deps: {
      workspaceRoot,
      callModel: options.skillHost?.callModel ?? ((input) => llmOneshot(hermesBaseUrl, input)),
    },
  });

  app.get("/health", async () => ({ ok: true }));

  return app;
}
