import type { Pool } from "pg";
import { Counter, Gauge, Histogram, Registry } from "prom-client";
import { envOr } from "./logging.js";

export type ApiMetrics = {
  registry: Registry;
  httpRequestsTotal: Counter<"route" | "status">;
  httpRequestDurationSeconds: Histogram<"route">;
  transactionsTotal: Counter<"result">;
  dbErrorsTotal: Counter<"sqlstate">;
};

type PoolLike = Pick<Pool, "totalCount" | "idleCount" | "waitingCount">;

export function createMetrics(getPool: () => PoolLike | undefined): ApiMetrics {
  const registry = new Registry();

  const httpRequestsTotal = new Counter({
    name: "http_requests_total",
    help: "Total HTTP requests",
    labelNames: ["route", "status"] as const,
    registers: [registry],
  });

  const httpRequestDurationSeconds = new Histogram({
    name: "http_request_duration_seconds",
    help: "HTTP request duration in seconds",
    labelNames: ["route"] as const,
    registers: [registry],
  });

  const transactionsTotal = new Counter({
    name: "transactions_total",
    help: "Checkout transactions by result",
    labelNames: ["result"] as const,
    registers: [registry],
  });

  new Gauge({
    name: "db_pool_connections",
    help: "Postgres pool connections by state",
    labelNames: ["state"] as const,
    registers: [registry],
    collect() {
      const pool = getPool();
      if (!pool) return;
      this.set({ state: "total" }, pool.totalCount);
      this.set({ state: "idle" }, pool.idleCount);
      this.set({ state: "waiting" }, pool.waitingCount);
    },
  });

  const dbErrorsTotal = new Counter({
    name: "db_errors_total",
    help: "Database errors by SQLSTATE",
    labelNames: ["sqlstate"] as const,
    registers: [registry],
  });

  const appBuildInfo = new Gauge({
    name: "app_build_info",
    help: "Application build information",
    labelNames: ["pack", "version", "git_sha"] as const,
    registers: [registry],
  });
  appBuildInfo.set(
    {
      pack: envOr("PACK", "poster-meteor"),
      version: envOr("VERSION", "dev"),
      git_sha: envOr("GIT_SHA", "unknown"),
    },
    1,
  );

  return {
    registry,
    httpRequestsTotal,
    httpRequestDurationSeconds,
    transactionsTotal,
    dbErrorsTotal,
  };
}
