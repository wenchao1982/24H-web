import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { openDb, type Db } from "../db";
import { migrate } from "../db/migrate";
import { ensureFirstAdmin } from "../users/repo";
import { buildApp } from "../http/app";

export const TEST_ADMIN_USERNAME = "admin";
export const TEST_ADMIN_PASSWORD = "test-admin-password";

export interface TestContext {
  app: FastifyInstance;
  db: Db;
  dir: string;
  close: () => Promise<void>;
}

export async function createTestContext(): Promise<TestContext> {
  const dir = mkdtempSync(join(tmpdir(), "24h-test-"));
  const db = openDb(join(dir, "test.db"));
  migrate(db);

  process.env.OS_ADMIN_USER = TEST_ADMIN_USERNAME;
  process.env.OS_ADMIN_PASSWORD = TEST_ADMIN_PASSWORD;
  await ensureFirstAdmin(db);

  const app = buildApp(db, { logger: false });

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
