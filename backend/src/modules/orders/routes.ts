import type { FastifyInstance } from "fastify";
import type { Database } from "../../plugins/prisma.js";
import type { AppConfig } from "../../config/env.js";
import { createAuthenticate, requirePermission } from "../auth/auth.js";
import { conflict, forbidden, notFound } from "../../shared/errors.js";
import { presentOrder, presentService } from "../../shared/presenters.js";
import { createOrderSchema, idParamsSchema } from "./schemas.js";

const orderInclude = {
  customer: true,
  service: {
    include: { assignments: { include: { driver: true, vehicle: true } } },
  },
} as const;

function orderVisibility(auth: NonNullable<FastifyRequest["auth"]>) {
  if (auth.actorKind === "customer")
    return {
      organizationId: auth.organizationId,
      customerId: auth.customerId ?? "__none__",
    };
  if (auth.actorKind === "transport")
    return { carrierOrganizationId: auth.organizationId };
  throw forbidden();
}

import type { FastifyRequest } from "fastify";

export async function registerOrderRoutes(
  app: FastifyInstance,
  database: Database,
  config: AppConfig,
) {
  const authenticate = createAuthenticate(database, config);

  app.post("/orders", { preHandler: authenticate }, async (request, reply) => {
    const auth = requirePermission(request, "orders:create");
    const input = createOrderSchema.parse(request.body);

    const customer =
      auth.actorKind === "customer"
        ? await database.customer.findFirst({
            where: {
              id: auth.customerId ?? "__none__",
              customerOrganizationId: auth.organizationId,
              organizationId: input.carrierOrganizationId,
            },
          })
        : await database.customer.findFirst({
            where: {
              id: input.customerId ?? "__none__",
              organizationId: auth.organizationId,
            },
          });

    if (!customer)
      throw forbidden(
        "No existe una relación comercial autorizada con ese transportista",
      );
    if (
      auth.actorKind !== "customer" &&
      input.carrierOrganizationId !== auth.organizationId
    )
      throw forbidden(
        "El pedido debe dirigirse a tu organización transportista",
      );

    const correlationId = request.id;
    const orderId = await database.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          organizationId: customer.customerOrganizationId,
          carrierOrganizationId: customer.organizationId,
          customerId: customer.id,
          createdByUserId: auth.userId,
          reference: input.reference,
          originName: input.origin.name,
          originAddress: input.origin.address,
          originLat: input.origin.lat,
          originLng: input.origin.lng,
          destinationName: input.destination.name,
          destinationAddress: input.destination.address,
          destinationLat: input.destination.lat,
          destinationLng: input.destination.lng,
          cargo: input.cargo,
          pallets: input.pallets,
          ...(input.tempMin !== undefined ? { tempMin: input.tempMin } : {}),
          ...(input.tempMax !== undefined ? { tempMax: input.tempMax } : {}),
          plannedPickup: new Date(input.plannedPickup),
          plannedDelivery: new Date(input.plannedDelivery),
        },
      });
      await tx.serviceEvent.create({
        data: {
          organizationId: created.organizationId,
          orderId: created.id,
          type: "ORDER_CREATED",
          entityType: "Order",
          entityId: created.id,
          actorUserId: auth.userId,
          correlationId,
          payload: {
            reference: created.reference,
            carrierOrganizationId: created.carrierOrganizationId,
          },
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: created.organizationId,
          actorUserId: auth.userId,
          action: "ORDER_CREATED",
          entityType: "Order",
          entityId: created.id,
          requestId: request.id,
          metadata: {
            role: auth.role,
            carrierOrganizationId: created.carrierOrganizationId,
          },
        },
      });
      return created.id;
    });
    const order = await database.order.findUniqueOrThrow({
      where: { id: orderId },
      include: orderInclude,
    });

    return reply.code(201).send({ data: presentOrder(order) });
  });

  app.get("/orders", { preHandler: authenticate }, async (request) => {
    const auth = requirePermission(request, "orders:read");
    const orders = await database.order.findMany({
      where: orderVisibility(auth),
      include: orderInclude,
      orderBy: { createdAt: "desc" },
    });
    return { data: orders.map(presentOrder) };
  });

  app.get("/orders/:id", { preHandler: authenticate }, async (request) => {
    const auth = requirePermission(request, "orders:read");
    const { id } = idParamsSchema.parse(request.params);
    const order = await database.order.findFirst({
      where: { id, ...orderVisibility(auth) },
      include: orderInclude,
    });
    if (!order) throw notFound("Pedido");
    return { data: presentOrder(order) };
  });

  app.post(
    "/orders/:id/accept",
    { preHandler: authenticate },
    async (request, reply) => {
      const auth = requirePermission(request, "orders:accept");
      const { id } = idParamsSchema.parse(request.params);
      const existing = await database.order.findFirst({
        where: { id, carrierOrganizationId: auth.organizationId },
        include: { service: true },
      });
      if (!existing) throw notFound("Pedido");
      if (existing.status === "ACCEPTED" || existing.service)
        throw conflict("ORDER_ALREADY_ACCEPTED", "El pedido ya está aceptado");

      const serviceId = await database.$transaction(async (tx) => {
        await tx.order.update({
          where: { id },
          data: { status: "ACCEPTED", acceptedAt: new Date() },
        });
        const created = await tx.service.create({
          data: {
            organizationId: auth.organizationId,
            customerOrganizationId: existing.organizationId,
            customerId: existing.customerId,
            orderId: existing.id,
          },
        });
        await tx.serviceEvent.create({
          data: {
            organizationId: auth.organizationId,
            orderId: existing.id,
            serviceId: created.id,
            type: "ORDER_ACCEPTED",
            entityType: "Order",
            entityId: existing.id,
            actorUserId: auth.userId,
            correlationId: request.id,
            payload: { serviceId: created.id },
          },
        });
        await tx.serviceEvent.create({
          data: {
            organizationId: auth.organizationId,
            orderId: existing.id,
            serviceId: created.id,
            type: "SERVICE_CREATED",
            entityType: "Service",
            entityId: created.id,
            actorUserId: auth.userId,
            correlationId: request.id,
            payload: { orderId: existing.id },
          },
        });
        await tx.auditLog.create({
          data: {
            organizationId: auth.organizationId,
            actorUserId: auth.userId,
            action: "ORDER_ACCEPTED",
            entityType: "Order",
            entityId: existing.id,
            requestId: request.id,
            metadata: { serviceId: created.id, role: auth.role },
          },
        });
        return created.id;
      });
      const service = await database.service.findUniqueOrThrow({
        where: { id: serviceId },
        include: {
          order: true,
          customer: true,
          assignments: { include: { driver: true, vehicle: true } },
          events: true,
        },
      });

      return reply.code(201).send({ data: presentService(service) });
    },
  );
}
