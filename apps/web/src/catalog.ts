export type CatalogProduct = {
  sku: string;
  name: string;
  customText: boolean;
};

export type CatalogSize = {
  id: string;
  priceCents: number;
};

export type CatalogFrame = {
  id: string;
  name: string;
  priceCents: number;
};

export type Catalog = {
  products: CatalogProduct[];
  sizes: CatalogSize[];
  frames: CatalogFrame[];
};

/** Mirrors the API catalog so checkout can render before that request returns. */
export const fallbackCatalog: Catalog = {
  products: [
    { sku: "PM-PERSEID", name: "Perseid Night", customText: false },
    { sku: "PM-LEONID", name: "Leonid Storm", customText: false },
    { sku: "PM-HALLEY", name: "Halley's Return", customText: false },
    { sku: "PM-STARMAP", name: "Custom Star Map (date + place line)", customText: true },
    { sku: "PM-NAMESTARS", name: "Name in the Stars", customText: true },
    { sku: "PM-NEBULA-LE", name: "Nebula by Ines Varga (limited-edition artist drop)", customText: false },
  ],
  sizes: [
    { id: "A3", priceCents: 2800 },
    { id: "A2", priceCents: 4200 },
    { id: "A1", priceCents: 6400 },
  ],
  frames: [
    { id: "none", name: "None", priceCents: 0 },
    { id: "black-oak", name: "Black Oak", priceCents: 3500 },
    { id: "white-ash", name: "White Ash", priceCents: 3500 },
  ],
};

export function isCatalog(value: unknown): value is Catalog {
  return parseCatalog(value) !== undefined;
}

export type CatalogProductDetail = CatalogProduct & {
  sizes: CatalogSize[];
  frames: CatalogFrame[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCatalogProduct(value: unknown): value is CatalogProduct {
  if (!isRecord(value)) return false;
  return (
    typeof value.sku === "string" &&
    value.sku.length > 0 &&
    typeof value.name === "string" &&
    value.name.length > 0 &&
    typeof value.customText === "boolean"
  );
}

function isCatalogSize(value: unknown): value is CatalogSize {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && value.id.length > 0 && typeof value.priceCents === "number" && Number.isInteger(value.priceCents);
}

function isCatalogFrame(value: unknown): value is CatalogFrame {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.name === "string" &&
    value.name.length > 0 &&
    typeof value.priceCents === "number" &&
    Number.isInteger(value.priceCents)
  );
}

function readSizes(value: unknown): CatalogSize[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const sizes: CatalogSize[] = [];
  for (const entry of value) {
    if (!isCatalogSize(entry)) return undefined;
    sizes.push({ id: entry.id, priceCents: entry.priceCents });
  }
  return sizes;
}

function readFrames(value: unknown): CatalogFrame[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const frames: CatalogFrame[] = [];
  for (const entry of value) {
    if (!isCatalogFrame(entry)) return undefined;
    frames.push({ id: entry.id, name: entry.name, priceCents: entry.priceCents });
  }
  return frames;
}

/** Catalog list from `GET /api/products`. Rejects a body the storefront should not paint. */
export function parseCatalog(value: unknown): Catalog | undefined {
  if (!isRecord(value)) return undefined;
  const sizes = readSizes(value.sizes);
  const frames = readFrames(value.frames);
  if (sizes === undefined || frames === undefined || !Array.isArray(value.products)) return undefined;
  const products: CatalogProduct[] = [];
  for (const entry of value.products) {
    if (!isCatalogProduct(entry)) return undefined;
    products.push({ sku: entry.sku, name: entry.name, customText: entry.customText });
  }
  return { products, sizes, frames };
}

/** One poster from `GET /api/products/:sku`, including the shared sizes and frames. */
export function parseProductDetail(value: unknown): CatalogProductDetail | undefined {
  if (!isRecord(value)) return undefined;
  const sizes = readSizes(value.sizes);
  const frames = readFrames(value.frames);
  if (!isCatalogProduct(value) || sizes === undefined || frames === undefined) return undefined;
  return {
    sku: value.sku,
    name: value.name,
    customText: value.customText,
    sizes,
    frames,
  };
}

export function productNeedsCustomText(catalog: Catalog, sku: string): boolean {
  return catalog.products.some((product) => product.sku === sku && product.customText);
}

export function unitPriceCents(
  catalog: { sizes: CatalogSize[]; frames: CatalogFrame[] },
  sizeId: string,
  frameId: string,
): number | undefined {
  const size = catalog.sizes.find((entry) => entry.id === sizeId);
  const frame = catalog.frames.find((entry) => entry.id === frameId);
  if (size === undefined || frame === undefined) return undefined;
  if (typeof size.priceCents !== "number" || typeof frame.priceCents !== "number") return undefined;
  return size.priceCents + frame.priceCents;
}
