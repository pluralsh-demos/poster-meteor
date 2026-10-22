import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Pool, type PoolClient } from "pg";
import { frames, getProduct, sizes, type Sku } from "./catalog.js";

const SEED_LOCK = "poster-meteor-seed";

/** Historical orders inserted when `orders` is empty. */
export const SEED_ORDER_COUNT = 2000;

/** First seeded order number is `PM-10000`; the last is `PM-11999`. */
export const SEED_FIRST_NUMBER = 10_000;

/**
 * `setval` target. `is_called` stays true, so the next `nextval` is 12000
 * and the next checkout number is `PM-12000`.
 */
export const SEED_SEQUENCE_VALUE = SEED_FIRST_NUMBER + SEED_ORDER_COUNT - 1;

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Draft catalog weights (relative popularity). Counts are exact for 2000 orders:
 * 400, 300, 300, 400, 400, 200.
 */
const SKU_WEIGHTS: readonly { sku: Sku; weight: number }[] = [
  { sku: "PM-PERSEID", weight: 20 },
  { sku: "PM-LEONID", weight: 15 },
  { sku: "PM-HALLEY", weight: 15 },
  { sku: "PM-STARMAP", weight: 20 },
  { sku: "PM-NAMESTARS", weight: 20 },
  { sku: "PM-NEBULA-LE", weight: 10 },
];

const STAR_MAP_LINES = [
  "14 June 2019 · Lisbon, Portugal",
  "3 March 2016 · Kyoto, Japan",
  "21 December 2018 · Reykjavik",
  "9 August 2020 · Melbourne",
] as const;

const NAME_LINES = [
  "Meet me under the stars",
  "For June, who looked up",
  "The night we met",
  "Always, in this sky",
] as const;

const BUYERS = [
  "Avery Chen",
  "Noah Ibarra",
  "Mina Okonkwo",
  "Elena Varga",
  "Jonah Ellis",
  "Priya Shah",
  "Chris Adeyemi",
  "Lila Moreau",
] as const;

const PLACES = [
  { city: "Portland", region: "OR", postalCode: "97205", country: "US" },
  { city: "Lisbon", region: "Lisboa", postalCode: "1200-109", country: "PT" },
  { city: "Kyoto", region: "Kyoto", postalCode: "600-8216", country: "JP" },
  { city: "Melbourne", region: "VIC", postalCode: "3000", country: "AU" },
  { city: "Reykjavik", region: "Capital", postalCode: "101", country: "IS" },
] as const;

export type SeedShipTo = {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
};

export type SeedOrder = {
  number: string;
  email: string;
  shipTo: SeedShipTo;
  status: "received";
  subtotal: number;
  total: number;
  createdAt: Date;
  sku: Sku;
  size: (typeof sizes)[number]["id"];
  frame: (typeof frames)[number]["id"];
  customText: string | null;
  unitPrice: number;
};

const insertSql = `
  WITH input AS (
    SELECT
      number,
      email,
      ship_to::jsonb AS ship_to,
      subtotal,
      total,
      created_at::timestamptz AS created_at,
      sku,
      size,
      frame,
      NULLIF(custom_text, '') AS custom_text,
      unit_price
    FROM unnest(
      $1::text[],
      $2::text[],
      $3::text[],
      $4::int[],
      $5::int[],
      $6::text[],
      $7::text[],
      $8::text[],
      $9::text[],
      $10::text[],
      $11::int[]
    ) AS t(
      number,
      email,
      ship_to,
      subtotal,
      total,
      created_at,
      sku,
      size,
      frame,
      custom_text,
      unit_price
    )
  ),
  inserted AS (
    INSERT INTO orders (
      number,
      email,
      ship_to,
      status,
      subtotal,
      tax,
      total,
      levy_ref,
      created_at,
      updated_at
    )
    SELECT
      number,
      email,
      ship_to,
      'received',
      subtotal,
      NULL,
      total,
      NULL,
      created_at,
      created_at
    FROM input
    RETURNING id, number
  )
  INSERT INTO order_items (order_id, sku, size, frame, custom_text, unit_price)
  SELECT inserted.id, input.sku, input.size, input.frame, input.custom_text, input.unit_price
  FROM inserted
  JOIN input ON input.number = inserted.number
`;

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(values: T[], random: () => number): T[] {
  const copy = values.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const current = copy[index];
    const other = copy[swap];
    if (current === undefined || other === undefined) continue;
    copy[index] = other;
    copy[swap] = current;
  }
  return copy;
}

/** Exact weight counts, then a fixed shuffle so popularity is mixed across the year. */
export function seedSkus(count = SEED_ORDER_COUNT): Sku[] {
  const totalWeight = SKU_WEIGHTS.reduce((sum, entry) => sum + entry.weight, 0);
  const skus: Sku[] = [];
  for (const entry of SKU_WEIGHTS) {
    const copies = Math.round((count * entry.weight) / totalWeight);
    for (let index = 0; index < copies; index += 1) skus.push(entry.sku);
  }
  if (skus.length !== count) {
    throw new Error(`seed weights produced ${skus.length} orders, expected ${count}`);
  }
  return shuffle(skus, mulberry32(5310));
}

function customTextFor(sku: Sku, index: number): string | null {
  const product = getProduct(sku);
  if (!product?.customText) return null;
  const lines = sku === "PM-STARMAP" ? STAR_MAP_LINES : NAME_LINES;
  const line = lines[index % lines.length];
  if (line === undefined || line.length === 0 || line.length > 60) {
    throw new Error(`custom text for ${sku} is missing or longer than 60 characters`);
  }
  return line;
}

function shipToFor(index: number, name: string): SeedShipTo {
  const place = PLACES[index % PLACES.length];
  if (place === undefined) throw new Error("seed places are empty");
  const shipTo: SeedShipTo = {
    name,
    line1: `${100 + (index % 80)} Observatory Ave`,
    city: place.city,
    region: place.region,
    postalCode: place.postalCode,
    country: place.country,
  };
  if (index % 5 === 0) shipTo.line2 = `Apt ${(index % 9) + 1}`;
  return shipTo;
}

/**
 * One line per order. Unit price is the live catalog: size cents plus the flat
 * frame price. Draft base prices and the custom-text surcharge are not applied.
 */
export function buildSeedOrders(now: Date): SeedOrder[] {
  const skus = seedSkus();
  const random = mulberry32(5311);
  const end = now.getTime();
  const start = end - YEAR_MS;
  const orders: SeedOrder[] = [];

  for (let index = 0; index < skus.length; index += 1) {
    const sku = skus[index];
    if (sku === undefined) throw new Error(`missing sku at ${index}`);
    const size = sizes[Math.floor(random() * sizes.length)];
    const frame = frames[Math.floor(random() * frames.length)];
    if (size === undefined || frame === undefined) throw new Error("catalog sizes or frames are empty");

    const unitPrice = size.priceCents + frame.priceCents;
    const sequence = SEED_FIRST_NUMBER + index;
    const name = BUYERS[index % BUYERS.length] ?? "Poster Meteor";
    const createdAt = new Date(start + ((end - start) * index) / (SEED_ORDER_COUNT - 1));

    orders.push({
      number: `PM-${sequence}`,
      email: `buyer.${sequence}@example.com`,
      shipTo: shipToFor(index, name),
      status: "received",
      subtotal: unitPrice,
      total: unitPrice,
      createdAt,
      sku,
      size: size.id,
      frame: frame.id,
      customText: customTextFor(sku, index),
      unitPrice,
    });
  }

  return orders;
}

function seedParameters(orders: readonly SeedOrder[]): unknown[] {
  return [
    orders.map((order) => order.number),
    orders.map((order) => order.email),
    orders.map((order) => JSON.stringify(order.shipTo)),
    orders.map((order) => order.subtotal),
    orders.map((order) => order.total),
    orders.map((order) => order.createdAt.toISOString()),
    orders.map((order) => order.sku),
    orders.map((order) => order.size),
    orders.map((order) => order.frame),
    orders.map((order) => order.customText ?? ""),
    orders.map((order) => order.unitPrice),
  ];
}

/** Inserts 2000 orders when `orders` is empty. A later run inserts nothing. */
export async function seedOrders(
  client: PoolClient,
  options: { now?: Date } = {},
): Promise<{ inserted: number }> {
  const now = options.now ?? new Date();
  await client.query("BEGIN");
  try {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [SEED_LOCK]);
    const existing = await client.query<{ count: string | number }>(
      "SELECT count(*)::int AS count FROM orders",
    );
    const count = Number(existing.rows[0]?.count ?? 0);
    if (count > 0) {
      await client.query("COMMIT");
      return { inserted: 0 };
    }

    const orders = buildSeedOrders(now);
    await client.query(insertSql, seedParameters(orders));
    await client.query("SELECT setval('order_number_seq', $1)", [SEED_SEQUENCE_VALUE]);
    await client.query("COMMIT");
    return { inserted: orders.length };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The connection may already be unusable.
    }
    throw error;
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
      const { inserted } = await seedOrders(client);
      if (inserted === 0) {
        console.log("seed skipped; orders already present");
      } else {
        console.log(`seeded ${inserted} orders`);
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
