import Fastify from "fastify";
import { config } from "./config";

const app = Fastify({ logger: true });

app.get("/health", async () => ({ ok: true }));

try {
  await app.listen({ port: config.port, host: "127.0.0.1" });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
