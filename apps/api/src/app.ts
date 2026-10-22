import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import { catalogOptions, getProduct, products } from "./catalog.js";
import { hostCookiesFor, rememberHostCookies, rejectUnsafeSetCookie } from "./cookies.js";
import { createPool, sqlStateOf } from "./db.js";
import { ContractLogController, logBase, routeTemplate } from "./logging.js";
import { createMetrics } from "./metrics.js";
import type { Pool } from "pg";

export type BuildAppOptions = {
  logStream?: FastifyServerOptions["logger"] extends infer Logger
    ? Logger extends { stream?: infer Stream }
      ? Stream
      : never
    : never;
};

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: {
      level: "info",
      base: logBase(),
      redact: ["req.headers.cookie", "req.headers.authorization", "authorization"],
      ...(options.logStream ? { stream: options.logStream } : {}),
    },
    logController: new ContractLogController(),
  });

  let pool: Pool | undefined;
  const metrics = createMetrics(() => pool);
  pool = createPool((err) => {
    const sqlstate = sqlStateOf(err);
    metrics.dbErrorsTotal.inc({ sqlstate });
    app.log.error({ err, sqlstate }, "postgres pool error");
  });

  app.decorateRequest("hostCookies", {
    getter() {
      return hostCookiesFor(this);
    },
  });

  app.addHook("onRequest", async (request) => {
    rememberHostCookies(request);
  });

  app.addHook("onSend", async (_request, reply, payload) => {
    rejectUnsafeSetCookie(reply);
    return payload;
  });

  app.addHook("onResponse", async (request, reply) => {
    const route = routeTemplate(request);
    metrics.httpRequestsTotal.inc({ route, status: String(reply.statusCode) });
    const seconds = reply.elapsedTime / 1000;
    metrics.httpRequestDurationSeconds.observe({ route }, Number.isFinite(seconds) ? seconds : 0);
  });

  if (pool) {
    app.addHook("onClose", async () => {
      await pool?.end();
    });
  }

  app.get("/healthz", async () => ({ status: "ok" }));

  app.get("/readyz", async () => ({ status: "ok" }));

  app.get("/metrics", async (_request, reply) => {
    reply.type(metrics.registry.contentType);
    return metrics.registry.metrics();
  });

  app.get("/api/products", async () => ({
    products,
    ...catalogOptions(),
  }));

  app.get<{ Params: { sku: string } }>("/api/products/:sku", async (request, reply) => {
    const product = getProduct(request.params.sku);
    if (!product) {
      return reply.code(404).send({ error: "Product not found" });
    }
    return { ...product, ...catalogOptions() };
  });

  return app;
}
