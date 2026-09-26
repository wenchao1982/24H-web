export const config = {
  port: Number(process.env.PORT ?? 8931),
  hermesBaseUrl: process.env.HERMES_BASE_URL ?? "http://127.0.0.1:9119",
  dbPath: process.env.DB_PATH ?? "data/24h.db",
};
