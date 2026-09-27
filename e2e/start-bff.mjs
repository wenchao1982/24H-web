// e2e BFF launcher: creates a fresh temp SQLite DB per run, then spawns the
// bundled server. The temp directory is deleted when the process exits.
// Invoked by playwright.config.ts as part of the BFF webServer command.
import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const serverEntry = resolve(repoRoot, "apps/server/dist/server.mjs");

// Sweep leftovers from previous runs (Playwright may SIGKILL the process tree,
// bypassing the cleanup handlers below).
for (const entry of readdirSync(tmpdir(), { withFileTypes: true })) {
  if (entry.isDirectory() && entry.name.startsWith("24h-e2e-")) {
    try {
      rmSync(join(tmpdir(), entry.name), { recursive: true, force: true });
    } catch {
      // best effort
    }
  }
}

const tmpDir = mkdtempSync(join(tmpdir(), "24h-e2e-"));
const dbPath = join(tmpDir, "e2e.db");

const env = {
  ...process.env,
  DB_PATH: dbPath,
  PORT: process.env.PORT ?? "4599",
  HOST: process.env.HOST ?? "127.0.0.1",
  OS_ADMIN_PASSWORD: process.env.OS_ADMIN_PASSWORD ?? "e2e-pass-123",
};

const child = spawn(process.execPath, [serverEntry], { env, stdio: "inherit" });

let cleaned = false;
function cleanup() {
  if (cleaned) {
    return;
  }
  cleaned = true;
  try {
    child.kill("SIGTERM");
  } catch {
    // already gone
  }
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // best effort
  }
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    cleanup();
    process.exit(0);
  });
}
process.on("exit", cleanup);

child.on("exit", (code, signal) => {
  cleanup();
  process.exit(code ?? (signal ? 1 : 0));
});
child.on("error", (error) => {
  console.error("[start-bff] failed to spawn server:", error);
  cleanup();
  process.exit(1);
});
