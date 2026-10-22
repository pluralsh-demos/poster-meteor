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
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return Array.isArray(record.products) && Array.isArray(record.sizes) && Array.isArray(record.frames);
}

export function productNeedsCustomText(catalog: Catalog, sku: string): boolean {
  return catalog.products.some((product) => product.sku === sku && product.customText);
}

export function unitPriceCents(catalog: Catalog, sizeId: string, frameId: string): number | undefined {
  const size = catalog.sizes.find((entry) => entry.id === sizeId);
  const frame = catalog.frames.find((entry) => entry.id === frameId);
  if (size === undefined || frame === undefined) return undefined;
  if (typeof size.priceCents !== "number" || typeof frame.priceCents !== "number") return undefined;
  return size.priceCents + frame.priceCents;
}
