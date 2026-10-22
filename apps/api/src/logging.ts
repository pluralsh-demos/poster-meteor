import { hostname } from "node:os";
import { LogController, type FastifyReply, type FastifyRequest } from "fastify";
import { rememberHostCookies } from "./cookies.js";

export function envOr(name: string, fallback: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  return value;
}

export function logBase(): {
  pid: number;
  hostname: string;
  pack: string;
  service: "api";
  route: string;
  ref: string;
} {
  return {
    pid: process.pid,
    hostname: hostname(),
    pack: envOr("PACK", "poster-meteor"),
    service: "api",
    route: "",
    ref: "",
  };
}

export function routeTemplate(request: FastifyRequest): string {
  return request.routeOptions.url ?? "";
}

export class ContractLogController extends LogController {
  override incomingRequest(request: FastifyRequest, reply: FastifyReply): void {
    rememberHostCookies(request);
    const child = request.log.child({ route: routeTemplate(request), ref: "" });
    request.log = child;
    reply.log = child;
    super.incomingRequest(request, reply);
  }
}
