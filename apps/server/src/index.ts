import { config } from "./config";
import { openDb } from "./db";
import { migrate } from "./db/migrate";
import { ensureFirstAdmin } from "./users/repo";
import { buildApp } from "./http/app";

const db = openDb(config.dbPath);
const dbVersion = migrate(db);
const admin = await ensureFirstAdmin(db);

const app = buildApp(db);
app.log.info(
  { dbVersion, adminCreated: admin.created, adminUsername: admin.username },
  "database ready",
);

try {
  await app.listen({ port: config.port, host: "127.0.0.1" });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
