import { Pool } from "pg";

export function readPoolMax(): number {
  const raw = process.env.POOL_MAX;
  if (raw === undefined || raw === "") return 8;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return 8;
  return parsed;
}

export function sqlStateOf(err: unknown): string {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = err.code;
    if (typeof code === "string" && code.length > 0) return code;
  }
  return "unknown";
}

/** Opens a pool when DATABASE_URL is set. Does not connect or run queries. */
export function createPool(onError: (err: Error) => void): Pool | undefined {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return undefined;

  const pool = new Pool({
    connectionString: databaseUrl,
    max: readPoolMax(),
  });
  pool.on("error", onError);
  return pool;
}
