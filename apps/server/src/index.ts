import Fastify from "fastify";
import { config } from "./config";
import { openDb } from "./db";
import { migrate } from "./db/migrate";
import { ensureFirstAdmin } from "./users/repo";

const app = Fastify({ logger: true });

const db = openDb(config.dbPath);
const dbVersion = migrate(db);
const admin = await ensureFirstAdmin(db);
app.log.info(
  { dbVersion, adminCreated: admin.created, adminUsername: admin.username },
  "database ready",
);

app.get("/health", async () => ({ ok: true }));

try {
  await app.listen({ port: config.port, host: "127.0.0.1" });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
