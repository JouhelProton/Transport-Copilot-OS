import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Database } from "../../plugins/prisma.js";
import type { AppConfig } from "../../config/env.js";
import { createAuthenticate, requirePermission } from "../auth/auth.js";
import { conflict, forbidden, notFound } from "../../shared/errors.js";
import { presentService } from "../../shared/presenters.js";
import { idParamsSchema } from "../orders/schemas.js";
import { assignServiceSchema } from "./schemas.js";

const serviceInclude = {
  order: true,
  customer: true,
  assignments: {
    include: { driver: true, vehicle: true },
    orderBy: { assignedAt: "desc" as const },
  },
  events: { orderBy: { occurredAt: "asc" as const } },
} as const;

function serviceVisibility(auth: NonNullable<FastifyRequest["auth"]>) {
  if (auth.actorKind === "customer")
    return {
      customerOrganizationId: auth.organizationId,
      customerId: auth.customerId ?? "__none__",
    };
  if (auth.actorKind === "driver")
    return {
      organizationId: auth.organizationId,
      assignments: {
        some: {
          driverId: auth.driverId ?? "__none__",
          status: "ACTIVE" as const,
        },
      },
    };
  if (auth.actorKind === "transport")
    return { organizationId: auth.organizationId };
  throw forbidden();
}

export async function registerServiceRoutes(
  app: FastifyInstance,
  database: Database,
  config: AppConfig,
) {
  const authenticate = createAuthenticate(database, config);

  app.get("/services", { preHandler: authenticate }, async (request) => {
    requirePermission(request, "services:read");
    const services = await database.service.findMany({
      where: serviceVisibility(request.auth!),
      include: serviceInclude,
      orderBy: { createdAt: "desc" },
    });
    return { data: services.map(presentService) };
  });

  app.get("/services/:id", { preHandler: authenticate }, async (request) => {
    requirePermission(request, "services:read");
    const { id } = idParamsSchema.parse(request.params);
    const service = await database.service.findFirst({
      where: { id, ...serviceVisibility(request.auth!) },
      include: serviceInclude,
    });
    if (!service) throw notFound("Servicio");
    return { data: presentService(service) };
  });

  app.post(
    "/services/:id/assign",
    { preHandler: authenticate },
    async (request) => {
      const auth = requirePermission(request, "services:assign");
      const { id } = idParamsSchema.parse(request.params);
      const input = assignServiceSchema.parse(request.body);

      const [service, driver, vehicle] = await Promise.all([
        database.service.findFirst({
          where: { id, organizationId: auth.organizationId },
        }),
        database.driver.findFirst({
          where: {
            id: input.driverId,
            organizationId: auth.organizationId,
            status: "ACTIVE",
          },
        }),
        database.vehicle.findFirst({
          where: {
            id: input.vehicleId,
            organizationId: auth.organizationId,
            status: { not: "MAINTENANCE" },
          },
        }),
      ]);
      if (!service) throw notFound("Servicio");
      if (!driver) throw notFound("Conductor disponible");
      if (!vehicle) throw notFound("Vehículo disponible");

      const active = await database.assignment.findFirst({
        where: {
          serviceId: id,
          organizationId: auth.organizationId,
          status: "ACTIVE",
        },
      });
      if (active?.driverId === driver.id && active.vehicleId === vehicle.id)
        throw conflict(
          "ASSIGNMENT_UNCHANGED",
          "El servicio ya tiene esa asignación activa",
        );

      await database.$transaction(async (tx) => {
        await tx.assignment.updateMany({
          where: {
            serviceId: id,
            organizationId: auth.organizationId,
            status: "ACTIVE",
          },
          data: { status: "REPLACED", endedAt: new Date() },
        });
        const assignment = await tx.assignment.create({
          data: {
            organizationId: auth.organizationId,
            serviceId: id,
            driverId: driver.id,
            vehicleId: vehicle.id,
            assignedByUserId: auth.userId,
          },
        });
        await tx.service.update({
          where: { id },
          data: { status: "ASSIGNED" },
        });
        await tx.serviceEvent.create({
          data: {
            organizationId: auth.organizationId,
            serviceId: id,
            orderId: service.orderId,
            type: "DRIVER_ASSIGNED",
            entityType: "Service",
            entityId: id,
            actorUserId: auth.userId,
            correlationId: request.id,
            payload: { assignmentId: assignment.id, driverId: driver.id },
          },
        });
        await tx.serviceEvent.create({
          data: {
            organizationId: auth.organizationId,
            serviceId: id,
            orderId: service.orderId,
            type: "VEHICLE_ASSIGNED",
            entityType: "Service",
            entityId: id,
            actorUserId: auth.userId,
            correlationId: request.id,
            payload: { assignmentId: assignment.id, vehicleId: vehicle.id },
          },
        });
        await tx.auditLog.create({
          data: {
            organizationId: auth.organizationId,
            actorUserId: auth.userId,
            action: "SERVICE_ASSIGNED",
            entityType: "Service",
            entityId: id,
            requestId: request.id,
            metadata: {
              assignmentId: assignment.id,
              driverId: driver.id,
              vehicleId: vehicle.id,
            },
          },
        });
      });
      const assigned = await database.service.findUniqueOrThrow({
        where: { id },
        include: serviceInclude,
      });
      return { data: presentService(assigned) };
    },
  );
}
