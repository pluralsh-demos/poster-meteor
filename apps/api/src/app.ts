import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
  type FastifyServerOptions,
} from "fastify";
import type { Pool } from "pg";
import { catalogOptions, getProduct, products } from "./catalog.js";
import { hostCookiesFor, rememberHostCookies, rejectUnsafeSetCookie } from "./cookies.js";
import { createPool, sqlStateOf } from "./db.js";
import { ContractLogController, logBase, routeTemplate } from "./logging.js";
import { createMetrics } from "./metrics.js";
import {
  ORDERS_UNAVAILABLE,
  detachPayment,
  placeOrder,
  readOrder,
  type OrderDb,
  type OrderQueryResult,
} from "./orders.js";

export type BuildAppOptions = {
  logStream?: FastifyServerOptions["logger"] extends infer Logger
    ? Logger extends { stream?: infer Stream }
      ? Stream
      : never
    : never;
  /** When set, checkout uses this database instead of DATABASE_URL. */
  pool?: OrderDb;
};

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: {
      level: "info",
      base: logBase(),
      redact: [
        "req.headers.cookie",
        "req.headers.authorization",
        "authorization",
        "req.body.payment",
        "body.payment",
        "payment",
      ],
      ...(options.logStream ? { stream: options.logStream } : {}),
    },
    logController: new ContractLogController(),
  });

  let ownedPool: Pool | undefined;
  const metrics = createMetrics(() => {
    if (ownedPool) return ownedPool;
    const injected = options.pool;
    if (!injected) return undefined;
    const { totalCount, idleCount, waitingCount } = injected;
    if (
      typeof totalCount !== "number" ||
      typeof idleCount !== "number" ||
      typeof waitingCount !== "number"
    ) {
      return undefined;
    }
    return { totalCount, idleCount, waitingCount };
  });
  ownedPool =
    options.pool === undefined
      ? createPool((err) => {
          const sqlstate = sqlStateOf(err);
          metrics.dbErrorsTotal.inc({ sqlstate });
          app.log.error({ err, sqlstate }, "postgres pool error");
        })
      : undefined;
  const orders = options.pool ?? (ownedPool ? toOrderDb(ownedPool) : undefined);

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

  if (ownedPool) {
    const pool = ownedPool;
    app.addHook("onClose", async () => {
      await pool.end();
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

  app.post("/api/orders", async (request, reply) => {
    if (!orders) {
      detachPayment(request.body);
      return reply.code(503).send({ error: ORDERS_UNAVAILABLE });
    }
    const result = await placeOrder(orders, request.body, request.log, metrics);
    if (!result.ok) {
      return reply.code(result.status).send({ error: result.error });
    }
    bindOrderRef(request, reply, result.order.number);
    request.log.info("order created");
    return reply.code(201).send(result.order);
  });

  app.get<{ Params: { number: string } }>("/api/orders/:number", async (request, reply) => {
    if (!orders) {
      return reply.code(503).send({ error: ORDERS_UNAVAILABLE });
    }
    bindOrderRef(request, reply, request.params.number);
    const result = await readOrder(orders, request.params.number, request.log, metrics);
    if (!result.ok) {
      return reply.code(result.status).send({ error: result.error });
    }
    return result.order;
  });

  return app;
}

function toOrderDb(pool: Pool): OrderDb {
  return {
    async connect() {
      const client = await pool.connect();
      return {
        async query<T = Record<string, unknown>>(
          sql: string,
          params?: unknown[],
        ): Promise<OrderQueryResult<T>> {
          const result = await client.query(sql, params);
          return { rows: result.rows as T[], rowCount: result.rowCount };
        },
        release() {
          client.release();
        },
      };
    },
  };
}

function bindOrderRef(request: FastifyRequest, reply: FastifyReply, ref: string): void {
  const child = request.log.child({ ref });
  request.log = child;
  reply.log = child;
}
