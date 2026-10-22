const CUSTOM_ART_SKUS = new Set(["PM-STARMAP", "PM-NAMESTARS"]);

/** Public URL for a copied poster file. Folder name is the SKU in lowercase. */
export function posterUrl(sku: string, file: string): string {
  return `/posters/${sku.toLowerCase()}/${file}`;
}

export function catalogThumbUrl(sku: string): string {
  return posterUrl(sku, "thumb.webp");
}

/** Star Map and Name in the Stars use the blank sheet once custom text has a value. */
export function hasCustomTextOverlay(sku: string, customText: string | undefined): boolean {
  return CUSTOM_ART_SKUS.has(sku) && (customText ?? "").trim().length > 0;
}

export function previewImageUrl(sku: string, customText: string | undefined): string {
  const file = hasCustomTextOverlay(sku, customText) ? "hero-blank.webp" : "hero.webp";
  return posterUrl(sku, file);
}

/** Wood swatches sit beside the frame choices. Unframed has no swatch. */
export function frameSwatchUrl(frameId: string): string | undefined {
  if (frameId === "black-oak" || frameId === "white-ash") return `/posters/swatches/${frameId}.webp`;
  return undefined;
}
