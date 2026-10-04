import os from "node:os";
import path from "node:path";

const dbPath = process.env.DB_PATH ?? "data/24h.db";

export const config = {
  port: Number(process.env.PORT ?? 8931),
  hermesBaseUrl: process.env.HERMES_BASE_URL ?? "http://127.0.0.1:9119",
  dbPath,
  /** 外部 agent 原生安装目录（host 级；`npm -g --prefix`）。 */
  agentsDir: process.env.AGENTS_DIR ?? path.join(os.homedir(), ".24h", "agents"),
  /** BFF 状态目录（策略文件等）。 */
  stateDir: process.env.STATE_DIR ?? path.dirname(dbPath),
};
