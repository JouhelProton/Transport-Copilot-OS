import type { Prisma } from "../generated/prisma/client.js";

export type OrderRecord = Prisma.OrderGetPayload<{
  include: {
    customer: true;
    service: {
      include: { assignments: { include: { driver: true; vehicle: true } } };
    };
  };
}>;

export type ServiceRecord = Prisma.ServiceGetPayload<{
  include: {
    order: true;
    customer: true;
    assignments: { include: { driver: true; vehicle: true } };
    events: true;
  };
}>;

const number = (value: { toString(): string } | null) =>
  value === null ? null : Number(value.toString());

export function presentOrder(order: OrderRecord) {
  const assignment = order.service?.assignments.find(
    (item) => item.status === "ACTIVE",
  );
  return {
    id: order.id,
    organizationId: order.organizationId,
    carrierOrganizationId: order.carrierOrganizationId,
    customerId: order.customerId,
    customerName: order.customer.name,
    reference: order.reference,
    origin: {
      name: order.originName,
      address: order.originAddress,
      lat: number(order.originLat),
      lng: number(order.originLng),
    },
    destination: {
      name: order.destinationName,
      address: order.destinationAddress,
      lat: number(order.destinationLat),
      lng: number(order.destinationLng),
    },
    cargo: order.cargo,
    pallets: order.pallets,
    tempMin: number(order.tempMin),
    tempMax: number(order.tempMax),
    plannedPickup: order.plannedPickup.toISOString(),
    plannedDelivery: order.plannedDelivery.toISOString(),
    status: order.status,
    acceptedAt: order.acceptedAt?.toISOString() ?? null,
    service: order.service
      ? {
          id: order.service.id,
          status: order.service.status,
          assignment: assignment
            ? {
                driverId: assignment.driverId,
                driverName: assignment.driver.name,
                vehicleId: assignment.vehicleId,
                vehiclePlate: assignment.vehicle.plate,
              }
            : null,
        }
      : null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

export function presentService(service: ServiceRecord) {
  const assignment = service.assignments.find(
    (item) => item.status === "ACTIVE",
  );
  return {
    id: service.id,
    organizationId: service.organizationId,
    customerOrganizationId: service.customerOrganizationId,
    customerId: service.customerId,
    customerName: service.customer.name,
    orderId: service.orderId,
    reference: service.order.reference,
    origin: {
      name: service.order.originName,
      address: service.order.originAddress,
      lat: number(service.order.originLat),
      lng: number(service.order.originLng),
    },
    destination: {
      name: service.order.destinationName,
      address: service.order.destinationAddress,
      lat: number(service.order.destinationLat),
      lng: number(service.order.destinationLng),
    },
    cargo: service.order.cargo,
    pallets: service.order.pallets,
    tempMin: number(service.order.tempMin),
    tempMax: number(service.order.tempMax),
    plannedPickup: service.order.plannedPickup.toISOString(),
    plannedDelivery: service.order.plannedDelivery.toISOString(),
    status: service.status,
    assignment: assignment
      ? {
          id: assignment.id,
          driverId: assignment.driverId,
          driverName: assignment.driver.name,
          vehicleId: assignment.vehicleId,
          vehiclePlate: assignment.vehicle.plate,
          assignedAt: assignment.assignedAt.toISOString(),
          acceptedAt: assignment.acceptedAt?.toISOString() ?? null,
        }
      : null,
    events: service.events.map((event) => ({
      id: event.id,
      type: event.type,
      actorUserId: event.actorUserId,
      occurredAt: event.occurredAt.toISOString(),
      payload: event.payload,
    })),
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
  };
}

export function presentDriverService(service: ServiceRecord) {
  const full = presentService(service);
  return {
    id: full.id,
    orderId: full.orderId,
    reference: full.reference,
    origin: full.origin,
    destination: full.destination,
    cargo: full.cargo,
    pallets: full.pallets,
    tempMin: full.tempMin,
    tempMax: full.tempMax,
    plannedPickup: full.plannedPickup,
    plannedDelivery: full.plannedDelivery,
    status: full.status,
    assignment: full.assignment,
    events: full.events,
    updatedAt: full.updatedAt,
  };
}
