import type { FastifyReply, FastifyRequest } from "fastify";

const HOST_PREFIX = "__Host-";
const ALLOWED_ATTRIBUTES = new Set(["secure", "path", "httponly"]);

/**
 * Cookie names this API is allowed to read. Empty until a later ticket
 * sets an application cookie. Inbound cookies outside this set are ignored,
 * including cookies scoped to `.plural.sh` (those cannot use the __Host- prefix).
 */
export const APP_HOST_COOKIE_NAMES: ReadonlySet<string> = new Set();

export class HostCookieError extends Error {
  statusCode = 500;

  constructor(message: string) {
    super(message);
    this.name = "HostCookieError";
  }
}

const cookiesForRequest = new WeakMap<FastifyRequest, Readonly<Record<string, string>>>();

declare module "fastify" {
  interface FastifyRequest {
    hostCookies: Readonly<Record<string, string>>;
  }
}

export function hostCookiesFor(request: FastifyRequest): Readonly<Record<string, string>> {
  return cookiesForRequest.get(request) ?? {};
}

export function readHostCookies(
  header: string | undefined,
  allowedNames: ReadonlySet<string> = APP_HOST_COOKIE_NAMES,
): Record<string, string> {
  if (!header || allowedNames.size === 0) return {};

  const cookies: Record<string, string> = {};
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const name = trimmed.slice(0, eq).trim();
    if (!name.startsWith(HOST_PREFIX) || !allowedNames.has(name)) continue;
    cookies[name] = trimmed.slice(eq + 1).trim();
  }
  return cookies;
}

export function assertHostSetCookie(header: string): void {
  const parts = header
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const pair = parts[0];
  if (!pair) {
    throw new HostCookieError("Set-Cookie is empty");
  }

  const eq = pair.indexOf("=");
  if (eq <= 0) {
    throw new HostCookieError("Set-Cookie is missing a name");
  }
  const name = pair.slice(0, eq).trim();
  if (!name.startsWith(HOST_PREFIX)) {
    throw new HostCookieError("Set-Cookie name must use the __Host- prefix");
  }

  let secure = false;
  let path: string | undefined;
  for (const attribute of parts.slice(1)) {
    const split = attribute.indexOf("=");
    const attrName = (split === -1 ? attribute : attribute.slice(0, split)).trim().toLowerCase();
    const attrValue = split === -1 ? "" : attribute.slice(split + 1).trim();
    if (attrName === "domain") {
      throw new HostCookieError("Set-Cookie must not include a Domain attribute");
    }
    if (!ALLOWED_ATTRIBUTES.has(attrName)) {
      throw new HostCookieError(`Set-Cookie attribute ${attrName} is not allowed`);
    }
    if (attrName === "secure") secure = true;
    if (attrName === "path") path = attrValue;
  }

  if (!secure) {
    throw new HostCookieError("Set-Cookie must include Secure");
  }
  if (path !== "/") {
    throw new HostCookieError("Set-Cookie Path must be /");
  }
}

export function hostSetCookie(
  name: string,
  value: string,
  options?: { httpOnly?: boolean },
): string {
  if (!name.startsWith(HOST_PREFIX)) {
    throw new HostCookieError("Set-Cookie name must use the __Host- prefix");
  }
  if (/[\r\n;]/.test(name) || /[\r\n;]/.test(value)) {
    throw new HostCookieError("Set-Cookie name or value is invalid");
  }
  const httpOnly = options?.httpOnly !== false;
  const header = `${name}=${value}; Secure; Path=/${httpOnly ? "; HttpOnly" : ""}`;
  assertHostSetCookie(header);
  return header;
}

function cookieHeaderValue(header: string | string[] | undefined): string | undefined {
  if (Array.isArray(header)) return header.join("; ");
  return header;
}

function serializeHostCookies(cookies: Readonly<Record<string, string>>): string | undefined {
  const names = Object.keys(cookies);
  if (names.length === 0) return undefined;
  return names.map((name) => `${name}=${cookies[name]}`).join("; ");
}

/** Keep only this app's __Host- cookies on the request. Other cookies are dropped. */
export function rememberHostCookies(
  request: FastifyRequest,
  allowedNames: ReadonlySet<string> = APP_HOST_COOKIE_NAMES,
): void {
  const cookies = readHostCookies(cookieHeaderValue(request.headers.cookie), allowedNames);
  cookiesForRequest.set(request, cookies);
  const header = serializeHostCookies(cookies);
  if (header === undefined) {
    delete request.raw.headers.cookie;
  } else {
    request.raw.headers.cookie = header;
  }
}

export function rejectUnsafeSetCookie(reply: FastifyReply): void {
  const current = reply.getHeader("set-cookie");
  if (current === undefined) return;

  const values = (Array.isArray(current) ? current : [current]).map((value) => String(value));
  reply.removeHeader("set-cookie");
  for (const value of values) {
    assertHostSetCookie(value);
  }
  for (const value of values) {
    reply.header("set-cookie", value);
  }
}
