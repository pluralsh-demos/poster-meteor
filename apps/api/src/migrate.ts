import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Pool, type PoolClient } from "pg";

const MIGRATIONS_LOCK = "poster-meteor-migrate";

const schemaMigrationsSql = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
`;

export function migrationsDirectory(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "../migrations");
}

export async function listMigrationFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

/** Applies pending SQL files in filename order. Already recorded files are skipped. */
export async function applyMigrations(client: PoolClient, directory: string): Promise<string[]> {
  await client.query("SELECT pg_advisory_lock(hashtextextended($1, 0))", [MIGRATIONS_LOCK]);
  const applied: string[] = [];
  try {
    const filenames = await listMigrationFiles(directory);
    for (const filename of filenames) {
      await client.query("BEGIN");
      try {
        await client.query(schemaMigrationsSql);
        const existing = await client.query<{ filename: string }>(
          "SELECT filename FROM schema_migrations WHERE filename = $1",
          [filename],
        );
        if ((existing.rowCount ?? 0) > 0) {
          await client.query("COMMIT");
          continue;
        }

        const sql = await readFile(join(directory, filename), "utf8");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename]);
        await client.query("COMMIT");
        applied.push(filename);
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // The connection may already be unusable.
        }
        throw new Error(`migration ${filename} failed`, { cause: error });
      }
    }
    return applied;
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [MIGRATIONS_LOCK]);
    } catch {
      // Ending the session releases the lock.
    }
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exitCode = 1;
    return;
  }

  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    const client = await pool.connect();
    try {
      const applied = await applyMigrations(client, migrationsDirectory());
      if (applied.length === 0) {
        console.log("migrate up to date");
      } else {
        for (const filename of applied) {
          console.log(`applied ${filename}`);
        }
      }
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

function invokedDirectly(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  return import.meta.url === pathToFileURL(resolve(entry)).href;
}

if (invokedDirectly()) {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
