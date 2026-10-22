import { parseCatalog, parseProductDetail, type Catalog, type CatalogProductDetail } from "./catalog";

export type OrderItem = {
  sku: string;
  size: string;
  frame: string;
  customText?: string | null;
  unitPrice: number;
  quantity?: number;
};

export type Order = {
  number: string;
  status: string;
  subtotal: number;
  total: number;
  items: OrderItem[];
};

export type OrderItemRequest = {
  sku: string;
  size: string;
  frame: string;
  customText?: string;
  quantity: number;
};

export type CreateOrderRequest = {
  email: string;
  shipTo: {
    name: string;
    line1: string;
    line2?: string;
    city: string;
    region: string;
    postalCode: string;
    country: string;
  };
  items: OrderItemRequest[];
  payment: {
    brand: string;
    last4: string;
  };
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "error" in body) {
      const error = (body as { error?: unknown }).error;
      if (typeof error === "string" && error.length > 0) return error;
    }
  } catch {
    // The body was not JSON.
  }
  return fallback;
}

function isOrder(value: unknown): value is Order {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.number === "string" &&
    typeof record.status === "string" &&
    typeof record.subtotal === "number" &&
    typeof record.total === "number" &&
    Array.isArray(record.items)
  );
}

export async function createOrder(order: CreateOrderRequest): Promise<Order> {
  const response = await fetch("/api/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(order),
  });
  if (!response.ok) {
    throw new ApiError(response.status, await readError(response, "We couldn't place your order"));
  }
  const body: unknown = await response.json();
  if (!isOrder(body)) throw new ApiError(response.status, "We couldn't place your order");
  return body;
}

export function isAbortError(cause: unknown): boolean {
  return cause instanceof Error && cause.name === "AbortError";
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

export async function fetchCatalog(signal?: AbortSignal): Promise<Catalog> {
  const response = await fetch("/api/products", {
    ...(signal === undefined ? {} : { signal }),
  });
  if (!response.ok) throw new ApiError(response.status, "The catalog did not load.");
  const catalog = parseCatalog(await readJson(response));
  if (catalog === undefined) throw new ApiError(response.status, "The catalog did not load.");
  return catalog;
}

export async function fetchProduct(sku: string, signal?: AbortSignal): Promise<CatalogProductDetail> {
  const response = await fetch(`/api/products/${encodeURIComponent(sku)}`, {
    ...(signal === undefined ? {} : { signal }),
  });
  if (response.status === 404) throw new ApiError(404, "We couldn't find that poster.");
  if (!response.ok) throw new ApiError(response.status, "The catalog did not load.");
  const product = parseProductDetail(await readJson(response));
  if (product === undefined) throw new ApiError(response.status, "The catalog did not load.");
  return product;
}

export async function fetchOrder(number: string, signal?: AbortSignal): Promise<Order> {
  const response = await fetch(`/api/orders/${encodeURIComponent(number)}`, {
    ...(signal === undefined ? {} : { signal }),
  });
  if (!response.ok) {
    const message =
      response.status === 404
        ? "We couldn't find that order."
        : await readError(response, "We couldn't load that order.");
    throw new ApiError(response.status, message);
  }
  const body: unknown = await response.json();
  if (!isOrder(body)) throw new ApiError(response.status, "We couldn't find that order.");
  return body;
}
