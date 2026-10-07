import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app/build-app.js";
import { loadConfig } from "../src/config/env.js";
import { hashSessionToken } from "../src/modules/auth/session-cookie.js";
import { createPrismaClient } from "../src/plugins/prisma.js";

const config = loadConfig({ ...process.env, NODE_ENV: "test" });
const database = createPrismaClient(config.DATABASE_URL);
const app = await buildApp(config, database);
const PASSWORD = "Demo-Transport-2026!";
const OWN_SERVICE = "svc_nv_24081_real";
const OTHER_DRIVER_ORDER = "ord_driver_other_test";
const OTHER_DRIVER_SERVICE = "svc_driver_other_test";
const OTHER_TENANT_SERVICE = "svc_driver_other_tenant_test";
let driverToken = "";
let customerCookie = "";

async function login(
  email: string,
  mobile = false,
): Promise<{ token?: string; cookie?: string }> {
  const response = await app.inject({
    method: "POST",
    url: mobile ? "/api/v1/auth/mobile-login" : "/api/v1/auth/login",
    payload: { email, password: PASSWORD },
  });
  expect(response.statusCode).toBe(200);
  if (mobile) return { token: response.json().data.sessionToken };
  const raw = response.headers["set-cookie"];
  const cookie = (Array.isArray(raw) ? raw[0] : raw)?.split(";")[0];
  if (!cookie) throw new Error("El login web no devolvió cookie");
  return { cookie };
}

const bearer = () => ({ authorization: `Bearer ${driverToken}` });

beforeAll(async () => {
  await app.ready();
  await database.auditLog.deleteMany({
    where: { entityId: OWN_SERVICE, action: "SERVICE_DRIVER_ACCEPTED" },
  });
  await database.serviceEvent.deleteMany({
    where: { serviceId: OWN_SERVICE, type: "DRIVER_ACCEPTED" },
  });
  await database.assignment.update({
    where: { id: "asn_nv_24081_real" },
    data: { acceptedAt: null },
  });
  await database.service.update({
    where: { id: OWN_SERVICE },
    data: { status: "ASSIGNED" },
  });

  await database.order.create({
    data: {
      id: OTHER_DRIVER_ORDER,
      organizationId: "org_nova",
      carrierOrganizationId: "org_tvd",
      customerId: "cus_nova",
      createdByUserId: "u_cust",
      reference: "DRIVER-ISOLATION-TEST",
      originName: "Valencia",
      originAddress: "Valencia",
      originLat: 39.4699,
      originLng: -0.3763,
      destinationName: "Madrid",
      destinationAddress: "Madrid",
      destinationLat: 40.4168,
      destinationLng: -3.7038,
      cargo: "Carga de aislamiento",
      pallets: 1,
      plannedPickup: new Date(Date.now() + 3_600_000),
      plannedDelivery: new Date(Date.now() + 7_200_000),
      status: "ACCEPTED",
    },
  });
  await database.service.create({
    data: {
      id: OTHER_DRIVER_SERVICE,
      organizationId: "org_tvd",
      customerOrganizationId: "org_nova",
      customerId: "cus_nova",
      orderId: OTHER_DRIVER_ORDER,
      status: "ASSIGNED",
    },
  });
  await database.assignment.create({
    data: {
      organizationId: "org_tvd",
      serviceId: OTHER_DRIVER_SERVICE,
      driverId: "drv_ana",
      vehicleId: "veh_9012",
      assignedByUserId: "u_admin",
    },
  });
  await database.service.create({
    data: {
      id: OTHER_TENANT_SERVICE,
      organizationId: "org_other",
      customerOrganizationId: "org_other",
      customerId: "cus_other_tenant",
      orderId: "ord_other_private",
      status: "ASSIGNED",
    },
  });
  await database.assignment.create({
    data: {
      organizationId: "org_other",
      serviceId: OTHER_TENANT_SERVICE,
      driverId: "drv_other",
      vehicleId: "veh_other",
      assignedByUserId: "u_other",
    },
  });

  driverToken = (await login("conductor@demo.nexo.local", true)).token!;
  customerCookie = (await login("cliente@demo.nexo.local")).cookie!;
});

afterAll(async () => {
  await database.auditLog.deleteMany({
    where: { entityId: OWN_SERVICE, action: "SERVICE_DRIVER_ACCEPTED" },
  });
  await database.serviceEvent.deleteMany({
    where: { serviceId: OWN_SERVICE, type: "DRIVER_ACCEPTED" },
  });
  await database.assignment.update({
    where: { id: "asn_nv_24081_real" },
    data: { acceptedAt: null },
  });
  await database.service.update({
    where: { id: OWN_SERVICE },
    data: { status: "ASSIGNED" },
  });
  await database.assignment.deleteMany({
    where: { serviceId: { in: [OTHER_DRIVER_SERVICE, OTHER_TENANT_SERVICE] } },
  });
  await database.service.deleteMany({
    where: { id: { in: [OTHER_DRIVER_SERVICE, OTHER_TENANT_SERVICE] } },
  });
  await database.order.deleteMany({ where: { id: OTHER_DRIVER_ORDER } });
  await database.session.deleteMany();
  await database.auditLog.deleteMany({ where: { entityType: "Session" } });
  await app.close();
  await database.$disconnect();
});

describe("Driver Mobile Foundation", () => {
  it("rechaza a un usuario no autenticado", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/driver/services",
    });
    expect(response.statusCode).toBe(401);
  });

  it("impide a CUSTOMER utilizar endpoints Driver", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/driver/services",
      headers: { cookie: customerCookie },
    });
    expect(response.statusCode).toBe(403);
  });

  it("DRIVER obtiene únicamente sus servicios", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/driver/services",
      headers: bearer(),
    });
    expect(response.statusCode).toBe(200);
    expect(
      response.json().data.map((item: { id: string }) => item.id),
    ).toContain(OWN_SERVICE);
    expect(
      response.json().data.map((item: { id: string }) => item.id),
    ).not.toContain(OTHER_DRIVER_SERVICE);
  });

  it("DRIVER obtiene el detalle de su servicio", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/driver/services/${OWN_SERVICE}`,
      headers: bearer(),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      id: OWN_SERVICE,
      assignment: { driverId: "drv_miguel" },
    });
    expect(response.json().data).not.toHaveProperty("customerName");
  });

  it("DRIVER no obtiene un servicio de otro conductor", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/driver/services/${OTHER_DRIVER_SERVICE}`,
      headers: bearer(),
    });
    expect(response.statusCode).toBe(404);
  });

  it("DRIVER no obtiene un servicio de otro tenant", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/driver/services/${OTHER_TENANT_SERVICE}`,
      headers: bearer(),
    });
    expect(response.statusCode).toBe(404);
  });

  it("DRIVER acepta su servicio asignado", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/driver/services/${OWN_SERVICE}/accept`,
      headers: bearer(),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.status).toBe("DRIVER_ACCEPTED");
    expect(response.json().data.assignment.acceptedAt).toBeTruthy();
  });

  it("persiste exactamente un evento DRIVER_ACCEPTED", async () => {
    expect(
      await database.serviceEvent.count({
        where: { serviceId: OWN_SERVICE, type: "DRIVER_ACCEPTED" },
      }),
    ).toBe(1);
  });

  it("genera AuditLog de la aceptación", async () => {
    expect(
      await database.auditLog.count({
        where: {
          entityId: OWN_SERVICE,
          action: "SERVICE_DRIVER_ACCEPTED",
          actorUserId: "u_drv",
        },
      }),
    ).toBe(1);
  });

  it("la doble aceptación es idempotente", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/driver/services/${OWN_SERVICE}/accept`,
      headers: bearer(),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.status).toBe("DRIVER_ACCEPTED");
    expect(
      await database.serviceEvent.count({
        where: { serviceId: OWN_SERVICE, type: "DRIVER_ACCEPTED" },
      }),
    ).toBe(1);
    expect(
      await database.auditLog.count({
        where: { entityId: OWN_SERVICE, action: "SERVICE_DRIVER_ACCEPTED" },
      }),
    ).toBe(1);
  });

  it("rechaza una sesión móvil revocada", async () => {
    const token = (await login("conductor@demo.nexo.local", true)).token!;
    await database.session.update({
      where: { tokenHash: hashSessionToken(token) },
      data: { revokedAt: new Date() },
    });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/driver/services",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(401);
  });
});
