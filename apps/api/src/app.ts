import Fastify, { type FastifyInstance } from "fastify";
import { catalogOptions, getProduct, products } from "./catalog.js";

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  app.get("/healthz", async () => ({ status: "ok" }));

  app.get("/readyz", async () => ({ status: "ok" }));

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
