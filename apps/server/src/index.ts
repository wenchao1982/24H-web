import { config } from "./config";
import { openDb } from "./db";
import { migrate } from "./db/migrate";
import { ensureFirstAdmin } from "./users/repo";
import { buildApp } from "./http/app";
import { AgentScheduler } from "./agents/scheduler";

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

// M22：外部 agent 自动更新调度器（60s 巡检；策略缺省关闭）。
const scheduler = new AgentScheduler({
  db,
  agentsDir: config.agentsDir,
  stateDir: config.stateDir,
});
scheduler.start();
app.log.info("agent update scheduler started");
