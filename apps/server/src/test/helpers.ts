import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { openDb, type Db } from "../db";
import { migrate } from "../db/migrate";
import { ensureFirstAdmin } from "../users/repo";
import { buildApp, type SkillHostOptions } from "../http/app";
import type { GhRunner } from "../integrations/github";

export const TEST_ADMIN_USERNAME = "admin";
export const TEST_ADMIN_PASSWORD = "test-admin-password";

export function parseCookies(
  setCookie: string | string[] | undefined,
): Record<string, string> {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const out: Record<string, string> = {};
  for (const entry of list) {
    const pair = entry.split(";")[0];
    const index = pair.indexOf("=");
    if (index > 0) {
      out[pair.slice(0, index)] = pair.slice(index + 1);
    }
  }
  return out;
}

export function loginAndGetCookies(
  app: FastifyInstance,
  username = TEST_ADMIN_USERNAME,
  password = TEST_ADMIN_PASSWORD,
): Promise<{ session: string; csrf: string }> {
  return app
    .inject({ method: "POST", url: "/api/auth/login", payload: { username, password } })
    .then((res) => {
      const cookies = parseCookies(res.headers["set-cookie"]);
      return { session: cookies["24h_session"], csrf: cookies["24h_csrf"] };
    });
}

export interface TestContext {
  app: FastifyInstance;
  db: Db;
  dir: string;
  close: () => Promise<void>;
}

export async function createTestContext(
  options: { hermesBaseUrl?: string; githubRunner?: GhRunner; skillHost?: SkillHostOptions } = {},
): Promise<TestContext> {
  const dir = mkdtempSync(join(tmpdir(), "24h-test-"));
  const db = openDb(join(dir, "test.db"));
  migrate(db);

  process.env.OS_ADMIN_USER = TEST_ADMIN_USERNAME;
  process.env.OS_ADMIN_PASSWORD = TEST_ADMIN_PASSWORD;
  await ensureFirstAdmin(db);

  const app = buildApp(db, {
    logger: false,
    ...(options.hermesBaseUrl ? { hermesBaseUrl: options.hermesBaseUrl } : {}),
    ...(options.githubRunner ? { githubRunner: options.githubRunner } : {}),
    ...(options.skillHost ? { skillHost: options.skillHost } : {}),
  });

  return {
    app,
    db,
    dir,
    close: async () => {
      await app.close();
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
