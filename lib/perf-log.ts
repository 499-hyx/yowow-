import { AsyncLocalStorage } from "node:async_hooks";
import { performance } from "node:perf_hooks";

type PerfState = {
  name: string;
  startedAt: number;
  tursoQueries: number;
  queryKinds: Record<string, number>;
};

const storage = new AsyncLocalStorage<PerfState>();

function enabled(): boolean {
  return process.env.PR7_PERF_LOG === "1";
}

function queryKind(sql: string): string {
  const normalized = sql.replace(/\s+/g, " ").trim();
  if (normalized.includes(" key IN ")) return "batch-by-keys";
  if (normalized.includes(" key LIKE ")) return "list-by-like";
  if (normalized.includes("SELECT key, body")) return "list-docs";
  if (normalized.includes("SELECT key")) return "list-keys";
  if (normalized.includes("SELECT body")) return "get-doc";
  return "other";
}

export function recordTursoQuery(sql: string): void {
  if (!enabled()) return;
  const state = storage.getStore();
  if (!state) return;
  const kind = queryKind(sql);
  state.tursoQueries += 1;
  state.queryKinds[kind] = (state.queryKinds[kind] ?? 0) + 1;
}

export async function withPerfSpan<T>(name: string, fn: () => Promise<T>): Promise<T> {
  if (!enabled()) return fn();
  const state: PerfState = {
    name,
    startedAt: performance.now(),
    tursoQueries: 0,
    queryKinds: {},
  };
  return storage.run(state, async () => {
    try {
      return await fn();
    } finally {
      const totalMs = Math.round(performance.now() - state.startedAt);
      const details = Object.entries(state.queryKinds)
        .map(([kind, count]) => `${kind}:${count}`)
        .join(",");
      console.log(
        `[PR7_PERF] ${state.name} total_ms=${totalMs} turso_queries=${state.tursoQueries} query_kinds=${details || "none"}`,
      );
    }
  });
}
