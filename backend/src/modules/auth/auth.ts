import type { FastifyReply, FastifyRequest } from "fastify";
import type { Role } from "../../generated/prisma/enums.js";
import type { AppConfig } from "../../config/env.js";
import type { Database } from "../../plugins/prisma.js";
import { forbidden, unauthorized } from "../../shared/errors.js";
import { actorKind, permissionsFor, type Permission } from "./rbac.js";
import {
  expiredSessionCookie,
  hashSessionToken,
  readCookie,
} from "./session-cookie.js";

export interface AuthContext {
  sessionId: string;
  userId: string;
  name: string;
  email: string;
  membershipId: string;
  organizationId: string;
  organizationName: string;
  role: Role;
  permissions: Permission[];
  actorKind: "customer" | "driver" | "transport";
  customerId?: string;
  driverId?: string;
  mode: "COOKIE" | "BEARER";
}

export function readBearerToken(authorization: string | undefined) {
  if (!authorization) return undefined;
  const [scheme, token, ...extra] = authorization.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== "bearer" || !token || extra.length)
    return undefined;
  return token;
}

export function createAuthenticate(database: Database, config: AppConfig) {
  return async function authenticate(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const bearerToken = readBearerToken(request.headers.authorization);
    const rawToken =
      bearerToken ??
      readCookie(request.headers.cookie, config.SESSION_COOKIE_NAME);
    if (!rawToken) throw unauthorized();
    const now = new Date();
    const session = await database.session.findUnique({
      where: { tokenHash: hashSessionToken(rawToken) },
      include: {
        currentMembership: { include: { organization: true } },
        user: { include: { customer: true, driver: true } },
      },
    });
    if (!session || session.revokedAt || session.expiresAt <= now) {
      reply.header("set-cookie", expiredSessionCookie(config));
      throw unauthorized("La sesión no es válida o ha expirado");
    }
    if (session.currentMembership.userId !== session.userId) {
      reply.header("set-cookie", expiredSessionCookie(config));
      throw unauthorized("La sesión no es válida");
    }
    if (now.getTime() - session.lastUsedAt.getTime() > 5 * 60 * 1000)
      await database.session.update({
        where: { id: session.id },
        data: { lastUsedAt: now },
      });

    const membership = session.currentMembership;
    request.auth = {
      sessionId: session.id,
      userId: session.user.id,
      name: session.user.name,
      email: session.user.email,
      membershipId: membership.id,
      organizationId: membership.organizationId,
      organizationName: membership.organization.name,
      role: membership.role,
      permissions: permissionsFor(membership.role),
      actorKind: actorKind(membership.role),
      ...(session.user.customer
        ? { customerId: session.user.customer.id }
        : {}),
      ...(session.user.driver ? { driverId: session.user.driver.id } : {}),
      mode: bearerToken ? "BEARER" : "COOKIE",
    };
  };
}

export function requirePermission(
  request: FastifyRequest,
  permission: Permission,
) {
  if (!request.auth?.permissions.includes(permission)) throw forbidden();
  return request.auth;
}
