import { describe, expect, it } from "vitest";
import type { PoolClient } from "pg";
import { frames, getProduct, sizes } from "../src/catalog.js";
import {
  SEED_FIRST_NUMBER,
  SEED_ORDER_COUNT,
  SEED_SEQUENCE_VALUE,
  buildSeedOrders,
  seedOrders,
} from "../src/seed.js";

const FIXED_NOW = new Date("2026-10-22T16:00:00.000Z");
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function stubClient(orderCount: number): {
  client: PoolClient;
  queries: { sql: string; params?: unknown[] }[];
} {
  const queries: { sql: string; params?: unknown[] }[] = [];
  const client = {
    query: async (sql: string, params?: unknown[]) => {
      const text = String(sql);
      queries.push({ sql: text, ...(params === undefined ? {} : { params }) });
      if (orderCount > 0 && /insert|setval/i.test(text)) {
        throw new Error(`unexpected write: ${text}`);
      }
      if (text.includes("count(*)")) {
        return { rows: [{ count: orderCount }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  };
  return { client: client as unknown as PoolClient, queries };
}

describe("seed orders", () => {
  it("builds 2000 received orders from the live catalog prices", () => {
    const orders = buildSeedOrders(FIXED_NOW);
    expect(orders).toHaveLength(SEED_ORDER_COUNT);
    expect(orders[0]?.number).toBe("PM-10000");
    expect(orders.at(-1)?.number).toBe("PM-11999");
    expect(SEED_SEQUENCE_VALUE).toBe(11_999);
    expect(SEED_FIRST_NUMBER + SEED_ORDER_COUNT - 1).toBe(SEED_SEQUENCE_VALUE);

    const counts = new Map<string, number>();
    for (const order of orders) {
      counts.set(order.sku, (counts.get(order.sku) ?? 0) + 1);
      expect(order.status).toBe("received");
      expect(order.subtotal).toBe(order.total);
      expect(order.total).toBe(order.unitPrice);

      const size = sizes.find((entry) => entry.id === order.size);
      const frame = frames.find((entry) => entry.id === order.frame);
      expect(size).toBeDefined();
      expect(frame).toBeDefined();
      expect(order.unitPrice).toBe((size?.priceCents ?? 0) + (frame?.priceCents ?? 0));

      const product = getProduct(order.sku);
      expect(product).toBeDefined();
      if (product?.customText) {
        expect(order.customText).toEqual(expect.any(String));
        expect(order.customText?.length).toBeGreaterThan(0);
        expect(order.customText?.length).toBeLessThanOrEqual(60);
      } else {
        expect(order.customText).toBeNull();
      }
    }

    expect(Object.fromEntries(counts)).toEqual({
      "PM-PERSEID": 400,
      "PM-LEONID": 300,
      "PM-HALLEY": 300,
      "PM-STARMAP": 400,
      "PM-NAMESTARS": 400,
      "PM-NEBULA-LE": 200,
    });

    const numbers = orders.map((order) => order.number);
    expect(new Set(numbers).size).toBe(SEED_ORDER_COUNT);

    const oldest = orders[0]?.createdAt.getTime();
    const newest = orders.at(-1)?.createdAt.getTime();
    expect(oldest).toBe(FIXED_NOW.getTime() - YEAR_MS);
    expect(newest).toBe(FIXED_NOW.getTime());
    for (let index = 1; index < orders.length; index += 1) {
      const previous = orders[index - 1]?.createdAt.getTime() ?? 0;
      const current = orders[index]?.createdAt.getTime() ?? 0;
      expect(current).toBeGreaterThanOrEqual(previous);
    }
  });

  it("inserts nothing when the orders count is already non-zero", async () => {
    const { client, queries } = stubClient(3);
    const result = await seedOrders(client, { now: FIXED_NOW });

    expect(result.inserted).toBe(0);
    expect(queries.some((query) => /insert|setval/i.test(query.sql))).toBe(false);
    expect(queries.some((query) => query.sql.includes("count(*)"))).toBe(true);
  });

  it("inserts 2000 orders and leaves the sequence at PM-12000 when orders is empty", async () => {
    const { client, queries } = stubClient(0);
    const result = await seedOrders(client, { now: FIXED_NOW });

    expect(result.inserted).toBe(SEED_ORDER_COUNT);
    const insert = queries.find((query) => query.sql.includes("INSERT INTO orders"));
    expect(insert?.params?.[0]).toHaveLength(SEED_ORDER_COUNT);
    expect(insert?.params?.[0]).toEqual(
      Array.from({ length: SEED_ORDER_COUNT }, (_value, index) => `PM-${SEED_FIRST_NUMBER + index}`),
    );

    const sequence = queries.find((query) => query.sql.includes("setval"));
    expect(sequence?.params).toEqual([SEED_SEQUENCE_VALUE]);
  });
});
