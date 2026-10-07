import type { FastifyInstance } from "fastify";
import type { Database } from "../../plugins/prisma.js";
import {
  createAuthenticate,
  ORDER_ACCEPT_ROLES,
  requireRoles,
  TRANSPORT_ROLES,
} from "../auth/auth.js";
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
  if (auth.role === "CUSTOMER")
    return {
      organizationId: auth.organizationId,
      customerId: auth.customerId ?? "__none__",
    };
  if (TRANSPORT_ROLES.includes(auth.role))
    return { carrierOrganizationId: auth.organizationId };
  throw forbidden();
}

import type { FastifyRequest } from "fastify";

export async function registerOrderRoutes(
  app: FastifyInstance,
  database: Database,
) {
  const authenticate = createAuthenticate(database);

  app.post("/orders", { preHandler: authenticate }, async (request, reply) => {
    const auth = requireRoles(request, ["CUSTOMER", ...TRANSPORT_ROLES]);
    const input = createOrderSchema.parse(request.body);

    const customer =
      auth.role === "CUSTOMER"
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
      auth.role !== "CUSTOMER" &&
      input.carrierOrganizationId !== auth.organizationId
    )
      throw forbidden(
        "El pedido debe dirigirse a tu organización transportista",
      );

    const correlationId = request.id;
    const order = await database.$transaction(async (tx) => {
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
      return tx.order.findUniqueOrThrow({
        where: { id: created.id },
        include: orderInclude,
      });
    });

    return reply.code(201).send({ data: presentOrder(order) });
  });

  app.get("/orders", { preHandler: authenticate }, async (request) => {
    const auth = request.auth!;
    const orders = await database.order.findMany({
      where: orderVisibility(auth),
      include: orderInclude,
      orderBy: { createdAt: "desc" },
    });
    return { data: orders.map(presentOrder) };
  });

  app.get("/orders/:id", { preHandler: authenticate }, async (request) => {
    const auth = request.auth!;
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
      const auth = requireRoles(request, ORDER_ACCEPT_ROLES);
      const { id } = idParamsSchema.parse(request.params);
      const existing = await database.order.findFirst({
        where: { id, carrierOrganizationId: auth.organizationId },
        include: { service: true },
      });
      if (!existing) throw notFound("Pedido");
      if (existing.status === "ACCEPTED" || existing.service)
        throw conflict("ORDER_ALREADY_ACCEPTED", "El pedido ya está aceptado");

      const service = await database.$transaction(async (tx) => {
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
        await tx.serviceEvent.createMany({
          data: [
            {
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
            {
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
          ],
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
        return tx.service.findUniqueOrThrow({
          where: { id: created.id },
          include: {
            order: true,
            customer: true,
            assignments: { include: { driver: true, vehicle: true } },
            events: true,
          },
        });
      });

      return reply.code(201).send({ data: presentService(service) });
    },
  );
}
