import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Database } from "../../plugins/prisma.js";
import type { Role } from "../../generated/prisma/enums.js";
import { forbidden, unauthorized } from "../../shared/errors.js";

const devHeaders = z.object({
  "x-dev-user-id": z.string().min(1),
  "x-organization-id": z.string().min(1),
});

export interface AuthContext {
  userId: string;
  name: string;
  email: string;
  organizationId: string;
  role: Role;
  customerId?: string;
  driverId?: string;
  mode: "DEV";
}

export function createAuthenticate(database: Database) {
  return async function authenticate(
    request: FastifyRequest,
    _reply: FastifyReply,
  ) {
    const parsed = devHeaders.safeParse(request.headers);
    if (!parsed.success)
      throw unauthorized("Faltan las cabeceras de autenticación DEV");

    const membership = await database.membership.findFirst({
      where: {
        userId: parsed.data["x-dev-user-id"],
        organizationId: parsed.data["x-organization-id"],
      },
      include: {
        user: { include: { customer: true, driver: true } },
      },
    });
    if (!membership)
      throw unauthorized("Usuario, organización o membresía DEV no válidos");

    request.auth = {
      userId: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
      organizationId: membership.organizationId,
      role: membership.role,
      ...(membership.user.customer
        ? { customerId: membership.user.customer.id }
        : {}),
      ...(membership.user.driver
        ? { driverId: membership.user.driver.id }
        : {}),
      mode: "DEV",
    };
  };
}

export function requireRoles(request: FastifyRequest, roles: readonly Role[]) {
  if (!request.auth || !roles.includes(request.auth.role)) throw forbidden();
  return request.auth;
}

export const TRANSPORT_ROLES: readonly Role[] = [
  "SUPER_ADMIN",
  "TRANSPORT_ADMIN",
  "DISPATCHER",
  "OPERATIONS",
  "ACCOUNTING",
];

export const ORDER_ACCEPT_ROLES: readonly Role[] = [
  "SUPER_ADMIN",
  "TRANSPORT_ADMIN",
  "DISPATCHER",
  "OPERATIONS",
];

export const ASSIGN_ROLES: readonly Role[] = [
  "SUPER_ADMIN",
  "TRANSPORT_ADMIN",
  "DISPATCHER",
];
