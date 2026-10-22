import { Writable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";

const METRIC_NAMES = [
  "http_requests_total",
  "http_request_duration_seconds",
  "transactions_total",
  "db_pool_connections",
  "db_errors_total",
  "app_build_info",
] as const;

const CUSTOM_TEXT_SKUS = new Set(["PM-STARMAP", "PM-NAMESTARS"]);

type EnvName = "DATABASE_URL" | "PACK" | "VERSION" | "GIT_SHA";

const envBackup: Partial<Record<EnvName, string | undefined>> = {};

function rememberEnv(name: EnvName): void {
  envBackup[name] = process.env[name];
}

function restoreEnv(name: EnvName): void {
  const previous = envBackup[name];
  if (previous === undefined) delete process.env[name];
  else process.env[name] = previous;
}

function captureLogs(): { stream: Writable; text: () => string } {
  const chunks: Buffer[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      callback();
    },
  });
  return {
    stream,
    text: () => Buffer.concat(chunks).toString("utf8"),
  };
}

const discardLogs = new Writable({
  write(_chunk, _encoding, callback) {
    callback();
  },
});

describe("poster meteor api", () => {
  let app: FastifyInstance | undefined;

  beforeEach(() => {
    rememberEnv("DATABASE_URL");
    rememberEnv("PACK");
    rememberEnv("VERSION");
    rememberEnv("GIT_SHA");
    delete process.env.DATABASE_URL;
    process.env.PACK = "poster-meteor";
    process.env.VERSION = "dev";
    process.env.GIT_SHA = "unknown";
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
    restoreEnv("DATABASE_URL");
    restoreEnv("PACK");
    restoreEnv("VERSION");
    restoreEnv("GIT_SHA");
  });

  it("returns six products, custom-text flags, sizes, frames, and 404 for an unknown sku", async () => {
    app = buildApp({ logStream: discardLogs });

    const list = await app.inject({ method: "GET", url: "/api/products" });
    expect(list.statusCode).toBe(200);
    const body = list.json<{
      products: { sku: string; name: string; customText: boolean }[];
      sizes: { id: string; priceCents: number }[];
      frames: { id: string; priceCents: number }[];
    }>();

    expect(body.products.map((product) => product.sku)).toEqual([
      "PM-PERSEID",
      "PM-LEONID",
      "PM-HALLEY",
      "PM-STARMAP",
      "PM-NAMESTARS",
      "PM-NEBULA-LE",
    ]);
    expect(body.products).toHaveLength(6);
    for (const product of body.products) {
      expect(product.name.length).toBeGreaterThan(0);
      expect(product.customText).toBe(CUSTOM_TEXT_SKUS.has(product.sku));
    }

    expect(body.sizes).toEqual([
      { id: "A3", priceCents: 2800 },
      { id: "A2", priceCents: 4200 },
      { id: "A1", priceCents: 6400 },
    ]);
    expect(body.frames).toEqual([
      { id: "none", name: "None", priceCents: 0 },
      { id: "black-oak", name: "Black Oak", priceCents: 3500 },
      { id: "white-ash", name: "White Ash", priceCents: 3500 },
    ]);

    const starMap = await app.inject({ method: "GET", url: "/api/products/PM-STARMAP" });
    expect(starMap.statusCode).toBe(200);
    expect(starMap.json()).toMatchObject({ sku: "PM-STARMAP", customText: true });

    const missing = await app.inject({ method: "GET", url: "/api/products/PM-UNKNOWN" });
    expect(missing.statusCode).toBe(404);
  });

  it("returns 200 from /healthz and /readyz with no database", async () => {
    expect(process.env.DATABASE_URL).toBeUndefined();
    app = buildApp({ logStream: discardLogs });

    const health = await app.inject({ method: "GET", url: "/healthz" });
    const ready = await app.inject({ method: "GET", url: "/readyz" });

    expect(health.statusCode).toBe(200);
    expect(ready.statusCode).toBe(200);
    expect(health.json()).toEqual({ status: "ok" });
    expect(ready.json()).toEqual({ status: "ok" });
  });

  it("exposes the telemetry series and app_build_info labels", async () => {
    app = buildApp({ logStream: discardLogs });

    const response = await app.inject({ method: "GET", url: "/metrics" });
    expect(response.statusCode).toBe(200);

    for (const name of METRIC_NAMES) {
      expect(response.body).toContain(`# TYPE ${name}`);
    }
    expect(response.body).toContain(
      'app_build_info{pack="poster-meteor",version="dev",git_sha="unknown"} 1',
    );
  });

  it("logs the telemetry contract and redacts an inbound cookie", async () => {
    const logs = captureLogs();
    app = buildApp({ logStream: logs.stream });

    const response = await app.inject({
      method: "GET",
      url: "/api/products/PM-PERSEID",
      headers: { cookie: "session=secret" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain("secret");

    const text = logs.text();
    expect(text).not.toContain("secret");

    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as Record<string, unknown>);

    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line.pack).toBe("poster-meteor");
      expect(line.service).toBe("api");
      expect(line.route).toBe("/api/products/:sku");
      expect(line.ref).toBe("");
    }
  });
});
