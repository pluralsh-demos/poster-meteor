export const sizes = [
  { id: "A3", priceCents: 2800 },
  { id: "A2", priceCents: 4200 },
  { id: "A1", priceCents: 6400 },
] as const;

export const frames = [
  { id: "none", name: "None", priceCents: 0 },
  { id: "black-oak", name: "Black Oak", priceCents: 3500 },
  { id: "white-ash", name: "White Ash", priceCents: 3500 },
] as const;

export const products = [
  { sku: "PM-PERSEID", name: "Perseid Night", customText: false },
  { sku: "PM-LEONID", name: "Leonid Storm", customText: false },
  { sku: "PM-HALLEY", name: "Halley's Return", customText: false },
  {
    sku: "PM-STARMAP",
    name: "Custom Star Map (date + place line)",
    customText: true,
  },
  { sku: "PM-NAMESTARS", name: "Name in the Stars", customText: true },
  {
    sku: "PM-NEBULA-LE",
    name: "Nebula by Ines Varga (limited-edition artist drop)",
    customText: false,
  },
] as const;

export type Size = (typeof sizes)[number];
export type Frame = (typeof frames)[number];
export type Product = (typeof products)[number];
export type Sku = Product["sku"];

const productsBySku = new Map<string, Product>(
  products.map((product) => [product.sku, product]),
);

export function getProduct(sku: string): Product | undefined {
  return productsBySku.get(sku);
}

export function catalogOptions(): { sizes: readonly Size[]; frames: readonly Frame[] } {
  return { sizes, frames };
}
