import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AppConfig } from "../../config/env.js";
import type { Database } from "../../plugins/prisma.js";
import { conflict, forbidden, notFound } from "../../shared/errors.js";
import { presentDriverService } from "../../shared/presenters.js";
import { createAuthenticate, requirePermission } from "../auth/auth.js";
import { idParamsSchema } from "../orders/schemas.js";

const driverServiceInclude = {
  order: true,
  customer: true,
  assignments: {
    include: { driver: true, vehicle: true },
    orderBy: { assignedAt: "desc" as const },
  },
  events: { orderBy: { occurredAt: "asc" as const } },
} as const;

function requireDriver(
  request: FastifyRequest,
): NonNullable<FastifyRequest["auth"]> & { driverId: string } {
  const auth = request.auth;
  if (auth?.role !== "DRIVER" || !auth.driverId)
    throw forbidden("El usuario no está vinculado a un conductor activo");
  return auth as NonNullable<FastifyRequest["auth"]> & { driverId: string };
}

function assignedTo(driverId: string, organizationId: string) {
  return {
    organizationId,
    assignments: {
      some: { driverId, status: "ACTIVE" as const },
    },
  };
}

export async function registerDriverRoutes(
  app: FastifyInstance,
  database: Database,
  config: AppConfig,
) {
  const authenticate = createAuthenticate(database, config);

  app.get("/driver/services", { preHandler: authenticate }, async (request) => {
    requirePermission(request, "driver:services:read");
    const auth = requireDriver(request);
    const driver = await database.driver.findFirst({
      where: {
        id: auth.driverId,
        userId: auth.userId,
        organizationId: auth.organizationId,
        status: "ACTIVE",
      },
    });
    if (!driver)
      throw forbidden("El usuario no está vinculado a un conductor activo");
    const services = await database.service.findMany({
      where: assignedTo(driver.id, auth.organizationId),
      include: driverServiceInclude,
      orderBy: { createdAt: "desc" },
    });
    return { data: services.map(presentDriverService) };
  });

  app.get(
    "/driver/services/:id",
    { preHandler: authenticate },
    async (request) => {
      requirePermission(request, "driver:services:read");
      const auth = requireDriver(request);
      const { id } = idParamsSchema.parse(request.params);
      const service = await database.service.findFirst({
        where: { id, ...assignedTo(auth.driverId, auth.organizationId) },
        include: driverServiceInclude,
      });
      if (!service) throw notFound("Servicio");
      return { data: presentDriverService(service) };
    },
  );

  app.post(
    "/driver/services/:id/accept",
    { preHandler: authenticate },
    async (request) => {
      requirePermission(request, "driver:services:accept");
      const auth = requireDriver(request);
      const { id } = idParamsSchema.parse(request.params);
      const service = await database.service.findFirst({
        where: { id, ...assignedTo(auth.driverId, auth.organizationId) },
        include: { assignments: true },
      });
      if (!service) throw notFound("Servicio");
      const assignment = service.assignments.find(
        (item) => item.status === "ACTIVE" && item.driverId === auth.driverId,
      );
      if (!assignment) throw notFound("Servicio");

      if (service.status === "DRIVER_ACCEPTED") {
        const current = await database.service.findUniqueOrThrow({
          where: { id },
          include: driverServiceInclude,
        });
        return { data: presentDriverService(current) };
      }
      if (service.status !== "ASSIGNED")
        throw conflict(
          "SERVICE_NOT_ASSIGNED",
          "El servicio no está pendiente de aceptación",
        );

      await database.$transaction(async (tx) => {
        const accepted = await tx.service.updateMany({
          where: {
            id,
            organizationId: auth.organizationId,
            status: "ASSIGNED",
          },
          data: { status: "DRIVER_ACCEPTED" },
        });
        if (accepted.count === 0) {
          const current = await tx.service.findUnique({ where: { id } });
          if (current?.status === "DRIVER_ACCEPTED") return;
          throw conflict(
            "SERVICE_STATE_CHANGED",
            "El servicio ha cambiado y no puede aceptarse",
          );
        }
        const acceptedAt = new Date();
        const assignmentUpdated = await tx.assignment.updateMany({
          where: {
            id: assignment.id,
            driverId: auth.driverId,
            organizationId: auth.organizationId,
            status: "ACTIVE",
          },
          data: { acceptedAt },
        });
        if (assignmentUpdated.count !== 1)
          throw conflict(
            "ASSIGNMENT_STATE_CHANGED",
            "La asignación ha cambiado y no puede aceptarse",
          );
        await tx.serviceEvent.create({
          data: {
            organizationId: auth.organizationId,
            serviceId: id,
            orderId: service.orderId,
            type: "DRIVER_ACCEPTED",
            entityType: "Service",
            entityId: id,
            actorUserId: auth.userId,
            correlationId: request.id,
            payload: {
              assignmentId: assignment.id,
              driverId: auth.driverId,
              acceptedAt: acceptedAt.toISOString(),
            },
          },
        });
        await tx.auditLog.create({
          data: {
            organizationId: auth.organizationId,
            actorUserId: auth.userId,
            action: "SERVICE_DRIVER_ACCEPTED",
            entityType: "Service",
            entityId: id,
            requestId: request.id,
            metadata: {
              assignmentId: assignment.id,
              driverId: auth.driverId,
            },
          },
        });
      });

      const accepted = await database.service.findUniqueOrThrow({
        where: { id },
        include: driverServiceInclude,
      });
      return { data: presentDriverService(accepted) };
    },
  );
}
