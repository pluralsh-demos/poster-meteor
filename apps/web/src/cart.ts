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

export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 10;
export const CUSTOM_TEXT_MAX = 60;

type CartStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const cartListeners = new Set<() => void>();

export function subscribeCart(listener: () => void): () => void {
  cartListeners.add(listener);
  return () => {
    cartListeners.delete(listener);
  };
}

function emitCart(storage: CartStore): void {
  if (storage !== localStorage) return;
  for (const listener of cartListeners) listener();
}

export function sameCartConfiguration(
  left: Pick<CartLine, "sku" | "size" | "frame" | "customText">,
  right: Pick<CartLine, "sku" | "size" | "frame" | "customText">,
): boolean {
  return (
    left.sku === right.sku &&
    left.size === right.size &&
    left.frame === right.frame &&
    (left.customText?.trim() ?? "") === (right.customText?.trim() ?? "")
  );
}

export type CartDraft = {
  sku: string;
  size: string;
  frame: string;
  quantity: number;
  allowsCustomText: boolean;
  customText?: string;
};

export type CartUpdate = { ok: true; lines: CartLine[] } | { ok: false; error: string };

function copyLine(line: CartLine, quantity: number, customText: string | undefined): CartLine {
  const next: CartLine = {
    sku: line.sku,
    size: line.size,
    frame: line.frame,
    quantity,
  };
  if (customText !== undefined && customText.length > 0) next.customText = customText;
  return next;
}

function writeCart(lines: CartLine[], storage: CartStore): CartUpdate {
  try {
    storage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
  } catch {
    return { ok: false, error: "The cart could not be saved in this browser." };
  }
  emitCart(storage);
  return { ok: true, lines };
}

/** Adds a line, merging one that matches sku, size, frame, and custom text. Quantity stays within 1–10. */
export function addToCart(draft: CartDraft, storage: CartStore = localStorage): CartUpdate {
  if (draft.sku.length === 0 || draft.size.length === 0 || draft.frame.length === 0) {
    return { ok: false, error: "Choose a poster, size, and frame." };
  }
  if (!Number.isInteger(draft.quantity) || draft.quantity < MIN_QUANTITY || draft.quantity > MAX_QUANTITY) {
    return { ok: false, error: "Quantity must be from 1 to 10." };
  }

  const text = draft.customText?.trim() ?? "";
  if (draft.allowsCustomText) {
    if (text.length < 1 || text.length > CUSTOM_TEXT_MAX) {
      return { ok: false, error: "Custom text is required and must be 60 characters or fewer." };
    }
  } else if (text.length > 0) {
    return { ok: false, error: "This poster does not take custom text." };
  }

  const line = copyLine(
    { sku: draft.sku, size: draft.size, frame: draft.frame, quantity: draft.quantity },
    draft.quantity,
    draft.allowsCustomText ? text : undefined,
  );
  const lines = readCart(storage);
  const index = lines.findIndex((entry) => sameCartConfiguration(entry, line));
  if (index === -1) {
    lines.push(line);
  } else {
    const current = lines[index];
    if (current === undefined) return { ok: false, error: "The cart could not be updated." };
    const quantity = Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, current.quantity + draft.quantity));
    lines[index] = copyLine(current, quantity, draft.allowsCustomText ? text : current.customText?.trim());
  }
  return writeCart(lines, storage);
}

export function updateCartQuantity(index: number, quantity: number, storage: CartStore = localStorage): CartUpdate {
  if (!Number.isInteger(quantity) || quantity < MIN_QUANTITY || quantity > MAX_QUANTITY) {
    return { ok: false, error: "Quantity must be from 1 to 10." };
  }
  const lines = readCart(storage);
  const current = lines[index];
  if (current === undefined) return { ok: false, error: "That poster is no longer in the cart." };
  lines[index] = copyLine(current, quantity, current.customText?.trim());
  return writeCart(lines, storage);
}

export function removeCartLine(index: number, storage: CartStore = localStorage): CartUpdate {
  const lines = readCart(storage);
  if (lines[index] === undefined) return { ok: false, error: "That poster is no longer in the cart." };
  lines.splice(index, 1);
  return writeCart(lines, storage);
}

export function clearCart(storage: CartStore = localStorage): void {
  storage.removeItem(CART_STORAGE_KEY);
  emitCart(storage);
}
