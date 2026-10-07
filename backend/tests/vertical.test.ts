import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app/build-app.js";
import { loadConfig } from "../src/config/env.js";
import { createPrismaClient } from "../src/plugins/prisma.js";

const config = loadConfig({ ...process.env, NODE_ENV: "test" });
const database = createPrismaClient(config.DATABASE_URL);
const app = await buildApp(config, database);

const PASSWORD = "Demo-Transport-2026!";
let customerHeaders: { cookie: string };
let carrierHeaders: { cookie: string };
let otherHeaders: { cookie: string };
let driverHeaders: { authorization: string };
let createdOrderId = "";
let createdServiceId = "";

beforeAll(async () => {
  await app.ready();
  const authenticate = async (email: string) => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email, password: PASSWORD },
    });
    expect(response.statusCode).toBe(200);
    const raw = response.headers["set-cookie"];
    const cookie = (Array.isArray(raw) ? raw[0] : raw)?.split(";")[0];
    if (!cookie) throw new Error("Login sin cookie");
    return { cookie };
  };
  customerHeaders = await authenticate("cliente@demo.nexo.local");
  carrierHeaders = await authenticate("admin@demo.nexo.local");
  otherHeaders = await authenticate("norte@demo.nexo.local");
  const driverLogin = await app.inject({
    method: "POST",
    url: "/api/v1/auth/mobile-login",
    payload: { email: "conductor@demo.nexo.local", password: PASSWORD },
  });
  expect(driverLogin.statusCode).toBe(200);
  driverHeaders = {
    authorization: `Bearer ${driverLogin.json().data.sessionToken}`,
  };
});

afterAll(async () => {
  if (createdServiceId) {
    await database.auditLog.deleteMany({
      where: { entityId: { in: [createdOrderId, createdServiceId] } },
    });
    await database.serviceEvent.deleteMany({
      where: {
        OR: [{ orderId: createdOrderId }, { serviceId: createdServiceId }],
      },
    });
    await database.assignment.deleteMany({
      where: { serviceId: createdServiceId },
    });
    await database.service.deleteMany({ where: { id: createdServiceId } });
  }
  if (createdOrderId) {
    await database.auditLog.deleteMany({ where: { entityId: createdOrderId } });
    await database.serviceEvent.deleteMany({
      where: { orderId: createdOrderId },
    });
    await database.order.deleteMany({ where: { id: createdOrderId } });
  }
  await database.session.deleteMany();
  await database.auditLog.deleteMany({ where: { entityType: "Session" } });
  await app.close();
  await database.$disconnect();
});

describe("vertical pedido → servicio → asignación", () => {
  it("responde al health check", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok" });
  });

  it("ejecuta el flujo completo y mantiene el aislamiento multi-tenant", async () => {
    const suffix = Date.now().toString(36);
    const pickup = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const delivery = new Date(pickup.getTime() + 8 * 60 * 60 * 1000);

    const created = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: customerHeaders,
      payload: {
        carrierOrganizationId: "org_tvd",
        reference: `TEST-${suffix}`,
        origin: {
          name: "Valencia",
          address: "Puerto de Valencia",
          lat: 39.4699,
          lng: -0.3763,
        },
        destination: {
          name: "Madrid",
          address: "Getafe",
          lat: 40.3057,
          lng: -3.7329,
        },
        cargo: "Carga de prueba",
        pallets: 12,
        plannedPickup: pickup.toISOString(),
        plannedDelivery: delivery.toISOString(),
      },
    });
    expect(created.statusCode).toBe(201);
    createdOrderId = created.json().data.id;

    const carrierOrders = await app.inject({
      method: "GET",
      url: "/api/v1/orders",
      headers: carrierHeaders,
    });
    expect(carrierOrders.statusCode).toBe(200);
    expect(
      carrierOrders
        .json()
        .data.some((order: { id: string }) => order.id === createdOrderId),
    ).toBe(true);

    const hiddenFromOtherTenant = await app.inject({
      method: "GET",
      url: `/api/v1/orders/${createdOrderId}`,
      headers: otherHeaders,
    });
    expect(hiddenFromOtherTenant.statusCode).toBe(404);

    const accepted = await app.inject({
      method: "POST",
      url: `/api/v1/orders/${createdOrderId}/accept`,
      headers: carrierHeaders,
    });
    expect(accepted.statusCode).toBe(201);
    createdServiceId = accepted.json().data.id;
    expect(accepted.json().data.status).toBe("PLANNED");

    const assigned = await app.inject({
      method: "POST",
      url: `/api/v1/services/${createdServiceId}/assign`,
      headers: carrierHeaders,
      payload: { driverId: "drv_miguel", vehicleId: "veh_9012" },
    });
    expect(assigned.statusCode).toBe(200);
    expect(assigned.json().data).toMatchObject({
      status: "ASSIGNED",
      assignment: { driverId: "drv_miguel", vehicleId: "veh_9012" },
    });

    const driverServices = await app.inject({
      method: "GET",
      url: "/api/v1/driver/services",
      headers: driverHeaders,
    });
    expect(driverServices.statusCode).toBe(200);
    expect(
      driverServices
        .json()
        .data.some(
          (service: { id: string }) => service.id === createdServiceId,
        ),
    ).toBe(true);

    const driverDetail = await app.inject({
      method: "GET",
      url: `/api/v1/driver/services/${createdServiceId}`,
      headers: driverHeaders,
    });
    expect(driverDetail.statusCode).toBe(200);
    expect(driverDetail.json().data.status).toBe("ASSIGNED");

    const driverAccepted = await app.inject({
      method: "POST",
      url: `/api/v1/driver/services/${createdServiceId}/accept`,
      headers: driverHeaders,
    });
    expect(driverAccepted.statusCode).toBe(200);
    expect(driverAccepted.json().data).toMatchObject({
      status: "DRIVER_ACCEPTED",
      assignment: { driverId: "drv_miguel" },
    });
    expect(driverAccepted.json().data.assignment.acceptedAt).toBeTruthy();

    const carrierService = await app.inject({
      method: "GET",
      url: `/api/v1/services/${createdServiceId}`,
      headers: carrierHeaders,
    });
    expect(carrierService.statusCode).toBe(200);
    expect(carrierService.json().data.status).toBe("DRIVER_ACCEPTED");

    const customerOrder = await app.inject({
      method: "GET",
      url: `/api/v1/orders/${createdOrderId}`,
      headers: customerHeaders,
    });
    expect(customerOrder.statusCode).toBe(200);
    expect(customerOrder.json().data.service).toMatchObject({
      id: createdServiceId,
      status: "DRIVER_ACCEPTED",
    });

    const hiddenService = await app.inject({
      method: "GET",
      url: `/api/v1/services/${createdServiceId}`,
      headers: otherHeaders,
    });
    expect(hiddenService.statusCode).toBe(404);

    const eventTypes = await database.serviceEvent.findMany({
      where: { serviceId: createdServiceId },
      select: { type: true },
    });
    expect(eventTypes.map((event) => event.type)).toEqual(
      expect.arrayContaining([
        "ORDER_ACCEPTED",
        "SERVICE_CREATED",
        "DRIVER_ASSIGNED",
        "VEHICLE_ASSIGNED",
        "DRIVER_ACCEPTED",
      ]),
    );
    const audit = await database.auditLog.findMany({
      where: { entityId: { in: [createdOrderId, createdServiceId] } },
    });
    expect(audit.map((entry) => entry.action)).toEqual(
      expect.arrayContaining([
        "ORDER_CREATED",
        "ORDER_ACCEPTED",
        "SERVICE_ASSIGNED",
        "SERVICE_DRIVER_ACCEPTED",
      ]),
    );
  });
});
