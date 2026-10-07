import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Role } from "../../generated/prisma/enums.js";
import type { AppConfig } from "../../config/env.js";
import type { Database } from "../../plugins/prisma.js";
import {
  forbidden,
  tooManyRequests,
  unauthorized,
} from "../../shared/errors.js";
import { createAuthenticate, readBearerToken } from "./auth.js";
import { hashPassword, verifyPassword } from "./password.js";
import { permissionsFor } from "./rbac.js";
import {
  createSessionToken,
  expiredSessionCookie,
  hashSessionToken,
  readCookie,
  sessionCookie,
} from "./session-cookie.js";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(255)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(256),
});
const switchOrganizationSchema = z.object({
  membershipId: z.string().min(1).max(64),
});
const INVALID_LOGIN = "Email o contraseña incorrectos";
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const DUMMY_PASSWORD_HASH = await hashPassword(
  "invalid-login-timing-placeholder",
);

interface Attempt {
  failures: number;
  resetAt: number;
}

function clientKey(request: FastifyRequest, email: string) {
  return `${request.ip}:${email}`;
}

function publicSession(
  auth: NonNullable<FastifyRequest["auth"]>,
  memberships: Array<{
    id: string;
    role: Role;
    organization: { id: string; name: string; kind: string };
  }>,
) {
  return {
    user: { id: auth.userId, name: auth.name, email: auth.email },
    activeMembership: {
      id: auth.membershipId,
      role: auth.role,
      organization: { id: auth.organizationId, name: auth.organizationName },
    },
    memberships: memberships.map((membership) => ({
      id: membership.id,
      role: membership.role,
      organization: membership.organization,
      permissions: permissionsFor(membership.role),
    })),
    permissions: auth.permissions,
    ...(auth.customerId ? { customerId: auth.customerId } : {}),
    ...(auth.driverId ? { driverId: auth.driverId } : {}),
    expiresAt: undefined,
  };
}

export async function registerAuthRoutes(
  app: FastifyInstance,
  database: Database,
  config: AppConfig,
) {
  const authenticate = createAuthenticate(database, config);
  const attempts = new Map<string, Attempt>();

  async function login(
    request: FastifyRequest,
    reply: FastifyReply,
    transport: "cookie" | "bearer",
  ) {
    const input = loginSchema.parse(request.body);
    const key = clientKey(request, input.email);
    const now = Date.now();
    if (attempts.size > 10_000) {
      for (const [storedKey, stored] of attempts)
        if (stored.resetAt <= now) attempts.delete(storedKey);
    }
    const attempt = attempts.get(key);
    if (attempt && attempt.failures >= MAX_FAILURES && attempt.resetAt > now)
      throw tooManyRequests();
    if (attempt && attempt.resetAt <= now) attempts.delete(key);

    const user = await database.user.findFirst({
      where: { email: { equals: input.email, mode: "insensitive" } },
      include: {
        customer: true,
        driver: true,
        memberships: {
          include: { organization: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    const valid = await verifyPassword(
      input.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!user || !valid) {
      const failures = (attempts.get(key)?.failures ?? 0) + 1;
      attempts.set(key, { failures, resetAt: now + WINDOW_MS });
      if (failures >= MAX_FAILURES) throw tooManyRequests();
      throw unauthorized(INVALID_LOGIN);
    }
    attempts.delete(key);
    const membership = user.memberships[0];
    if (!membership)
      throw forbidden("El usuario no tiene acceso a ninguna organización");

    const token = createSessionToken();
    const expiresAt = new Date(now + config.SESSION_TTL_HOURS * 60 * 60 * 1000);
    const created = await database.$transaction(async (tx) => {
      const session = await tx.session.create({
        data: {
          userId: user.id,
          currentMembershipId: membership.id,
          tokenHash: hashSessionToken(token),
          expiresAt,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: membership.organizationId,
          actorUserId: user.id,
          action: "SESSION_CREATED",
          entityType: "Session",
          entityId: session.id,
          requestId: request.id,
          metadata: { membershipId: membership.id, transport },
        },
      });
      return session;
    });
    if (transport === "cookie")
      reply.header("set-cookie", sessionCookie(config, token, expiresAt));
    return reply.send({
      data: {
        user: { id: user.id, name: user.name, email: user.email },
        activeMembership: {
          id: membership.id,
          role: membership.role,
          organization: membership.organization,
        },
        memberships: user.memberships.map((item) => ({
          id: item.id,
          role: item.role,
          organization: item.organization,
          permissions: permissionsFor(item.role),
        })),
        permissions: permissionsFor(membership.role),
        ...(user.customer ? { customerId: user.customer.id } : {}),
        ...(user.driver ? { driverId: user.driver.id } : {}),
        expiresAt: created.expiresAt.toISOString(),
        ...(transport === "bearer" ? { sessionToken: token } : {}),
      },
    });
  }

  app.post("/login", async (request, reply) => login(request, reply, "cookie"));

  app.post("/mobile-login", async (request, reply) =>
    login(request, reply, "bearer"),
  );

  app.post("/logout", async (request, reply) => {
    const token =
      readBearerToken(request.headers.authorization) ??
      readCookie(request.headers.cookie, config.SESSION_COOKIE_NAME);
    if (token) {
      await database.session.updateMany({
        where: { tokenHash: hashSessionToken(token), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    reply.header("set-cookie", expiredSessionCookie(config));
    return reply.code(204).send();
  });

  app.get("/me", { preHandler: authenticate }, async (request) => {
    const auth = request.auth!;
    const [memberships, session] = await Promise.all([
      database.membership.findMany({
        where: { userId: auth.userId },
        include: { organization: true },
        orderBy: { createdAt: "asc" },
      }),
      database.session.findUniqueOrThrow({
        where: { id: auth.sessionId },
        select: { expiresAt: true },
      }),
    ]);
    return {
      data: {
        ...publicSession(auth, memberships),
        expiresAt: session.expiresAt.toISOString(),
      },
    };
  });

  app.post(
    "/switch-organization",
    { preHandler: authenticate },
    async (request) => {
      const auth = request.auth!;
      const { membershipId } = switchOrganizationSchema.parse(request.body);
      const membership = await database.membership.findFirst({
        where: { id: membershipId, userId: auth.userId },
        include: { organization: true },
      });
      if (!membership)
        throw forbidden("La organización solicitada no pertenece al usuario");
      await database.$transaction([
        database.session.update({
          where: { id: auth.sessionId },
          data: { currentMembershipId: membership.id, lastUsedAt: new Date() },
        }),
        database.auditLog.create({
          data: {
            organizationId: membership.organizationId,
            actorUserId: auth.userId,
            action: "ACTIVE_ORGANIZATION_CHANGED",
            entityType: "Session",
            entityId: auth.sessionId,
            requestId: request.id,
            metadata: {
              previousMembershipId: auth.membershipId,
              membershipId: membership.id,
            },
          },
        }),
      ]);
      return {
        data: {
          membership: {
            id: membership.id,
            role: membership.role,
            organization: membership.organization,
          },
          permissions: permissionsFor(membership.role),
        },
      };
    },
  );
}
