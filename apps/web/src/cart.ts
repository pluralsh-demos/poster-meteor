/** Key written by the storefront cart. Checkout only reads it. */
export const CART_STORAGE_KEY = "poster-meteor.cart";

export type CartLine = {
  sku: string;
  size: string;
  frame: string;
  customText?: string;
  quantity: number;
};

export function defaultCartLine(): CartLine {
  return { sku: "PM-PERSEID", size: "A3", frame: "none", quantity: 1 };
}

function parseLine(value: unknown): CartLine | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.sku !== "string" || record.sku.length === 0) return undefined;
  if (typeof record.size !== "string" || record.size.length === 0) return undefined;
  if (typeof record.frame !== "string" || record.frame.length === 0) return undefined;
  if (typeof record.quantity !== "number" || !Number.isInteger(record.quantity)) return undefined;

  const line: CartLine = {
    sku: record.sku,
    size: record.size,
    frame: record.frame,
    quantity: record.quantity,
  };
  if (typeof record.customText === "string") line.customText = record.customText;
  return line;
}

/** Lines stored by the catalog cart. An empty or unreadable value is an empty cart. */
export function readCart(storage: Pick<Storage, "getItem"> = localStorage): CartLine[] {
  try {
    const raw = storage.getItem(CART_STORAGE_KEY);
    if (raw === null || raw.trim() === "") return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      const line = parseLine(entry);
      return line === undefined ? [] : [line];
    });
  } catch {
    return [];
  }
}

export function checkoutLines(storage?: Pick<Storage, "getItem">): CartLine[] {
  const stored = storage === undefined ? readCart() : readCart(storage);
  return stored.length > 0 ? stored : [defaultCartLine()];
}
