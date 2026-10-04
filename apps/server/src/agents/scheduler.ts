import { join } from "node:path";
import type { Db } from "../db";
import { logAudit } from "../audit/repo";
import { CODING_AGENTS } from "./definitions";
import { checkAgentUpdate, installAgent } from "./installer";
import type { AgentsDeps } from "./registry";
import { loadPolicies } from "./updatePolicy";
import { spawnCommand } from "./runner";

const DEFAULT_INTERVAL_MS = 60_000;
const DEFAULT_RECHECK_MS = 6 * 60 * 60_000;
const DEFAULT_IDLE_MS = 60_000;

export interface AgentSchedulerOptions {
  db: Db;
  agentsDir: string;
  stateDir: string;
  /** 可注入依赖（测试）。 */
  deps?: AgentsDeps;
  intervalMs?: number;
  recheckMs?: number;
  idleMs?: number;
  now?: () => number;
  /** 运行中判定（M22 暂无外部运行管理器 → 恒 false）。 */
  isBusy?: (id: string) => boolean;
}

/**
 * 外部 agent 自动更新调度器（M22）：
 * 60s 巡检；`checkedAt` > 6h 才重查；命中可用后**空闲 60s** 才安装；运行中/busy 跳过；
 * 安装写 `audit(agents.auto_update)`；策略缺失/损坏 → fail-closed（`loadPolicies` 全 false）。
 */
export class AgentScheduler {
  private readonly deps: AgentsDeps;
  private readonly now: () => number;
  private readonly intervalMs: number;
  private readonly recheckMs: number;
  private readonly idleMs: number;
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;
  private readonly lastCheck = new Map<string, number>();
  private readonly availableSince = new Map<string, number>();

  constructor(private readonly opts: AgentSchedulerOptions) {
    this.deps =
      opts.deps ??
      ({
        managedDir: opts.agentsDir,
        managedBin: join(opts.agentsDir, "bin"),
        runner: spawnCommand,
      } satisfies AgentsDeps);
    this.now = opts.now ?? (() => Date.now());
    this.intervalMs = opts.intervalMs ?? DEFAULT_INTERVAL_MS;
    this.recheckMs = opts.recheckMs ?? DEFAULT_RECHECK_MS;
    this.idleMs = opts.idleMs ?? DEFAULT_IDLE_MS;
  }

  /** 单次巡检（测试直接调用）。 */
  async tick(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      const policies = await loadPolicies(this.opts.stateDir);
      for (const definition of CODING_AGENTS) {
        if (!definition.packageName) {
          continue;
        }
        if (!policies[definition.id]?.autoUpdate) {
          this.availableSince.delete(definition.id);
          continue;
        }
        if (this.opts.isBusy?.(definition.id)) {
          this.availableSince.delete(definition.id);
          continue;
        }

        const now = this.now();
        const last = this.lastCheck.get(definition.id);
        if (last === undefined || now - last >= this.recheckMs) {
          try {
            const check = await checkAgentUpdate(definition.id, this.deps);
            this.lastCheck.set(definition.id, now);
            if (!check.updateAvailable) {
              this.availableSince.delete(definition.id);
              continue;
            }
            this.availableSince.set(definition.id, now);
          } catch {
            continue;
          }
        }

        const since = this.availableSince.get(definition.id);
        if (since === undefined || now - since < this.idleMs) {
          continue;
        }
        try {
          const result = await installAgent(definition.id, this.deps);
          this.availableSince.delete(definition.id);
          this.lastCheck.set(definition.id, now);
          logAudit(this.opts.db, {
            actorId: null,
            action: "agents.auto_update",
            targetType: "agent",
            targetId: definition.id,
            detail: JSON.stringify({ version: result.version }),
          });
        } catch {
          // 下次 tick 重试
        }
      }
    } finally {
      this.running = false;
    }
  }

  start(): void {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}
