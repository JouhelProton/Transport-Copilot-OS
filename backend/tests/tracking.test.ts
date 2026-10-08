import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app/build-app.js";
import { loadConfig } from "../src/config/env.js";
import { createPrismaClient } from "../src/plugins/prisma.js";

const config = loadConfig({ ...process.env, NODE_ENV: "test" });
const database = createPrismaClient(config.DATABASE_URL);
const app = await buildApp(config, database);
const serviceId = "svc_nv_24081_real";
const password = "Demo-Transport-2026!";

async function login(email: string) {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/mobile-login",
    payload: { email, password },
  });
  expect(response.statusCode).toBe(200);
  return response.json().data.sessionToken as string;
}

function bearer(token: string) {
  return { authorization: `Bearer ${token}` };
}

beforeAll(async () => {
  await app.ready();
  await database.locationHistory.deleteMany({ where: { serviceId } });
  await database.currentPosition.deleteMany({ where: { serviceId } });
  await database.trackingSession.deleteMany({ where: { serviceId } });
});

afterAll(async () => {
  await database.locationHistory.deleteMany({ where: { serviceId } });
  await database.currentPosition.deleteMany({ where: { serviceId } });
  await database.trackingSession.deleteMany({ where: { serviceId } });
  await database.serviceEvent.deleteMany({
    where: {
      serviceId,
      type: { in: ["TRACKING_STARTED", "TRACKING_STOPPED", "TRACKING_EXPIRED"] },
    },
  });
  await database.auditLog.deleteMany({
    where: { entityType: "TrackingSession", entityId: { not: "" } },
  });
  await database.service.update({ where: { id: serviceId }, data: { status: "ASSIGNED" } });
  await database.assignment.updateMany({
    where: { serviceId, status: "ACTIVE" },
    data: { acceptedAt: null },
  });
  await app.close();
  await database.$disconnect();
});

describe("live GPS tracking", () => {
  it("autoriza al conductor, persiste posición y deduplica muestras", async () => {
    const token = await login("conductor@demo.nexo.local");
    const started = await app.inject({
      method: "POST",
      url: `/api/v1/driver/services/${serviceId}/tracking/start`,
      headers: bearer(token),
    });
    expect(started.statusCode).toBe(201);
    expect(started.json().data.status).toBe("ACTIVE");

    const recordedAt = new Date().toISOString();
    const position = await app.inject({
      method: "POST",
      url: `/api/v1/driver/services/${serviceId}/tracking/positions`,
      headers: bearer(token),
      payload: {
        sampleId: "sample-tracking-1",
        latitude: 39.4699,
        longitude: -0.3763,
        accuracy: 8.4,
        heading: 42,
        speed: 18.2,
        recordedAt,
      },
    });
    expect(position.statusCode).toBe(200);
    expect(position.json().data.current.latitude).toBe(39.4699);

    const duplicate = await app.inject({
      method: "POST",
      url: `/api/v1/driver/services/${serviceId}/tracking/positions`,
      headers: bearer(token),
      payload: {
        sampleId: "sample-tracking-1",
        latitude: 39.5,
        longitude: -0.4,
        accuracy: 10,
        recordedAt,
      },
    });
    expect(duplicate.statusCode).toBe(200);
    expect(duplicate.json().data.duplicate).toBe(true);

    const older = await app.inject({
      method: "POST",
      url: `/api/v1/driver/services/${serviceId}/tracking/positions`,
      headers: bearer(token),
      payload: {
        sampleId: "sample-tracking-older",
        latitude: 39.4,
        longitude: -0.5,
        accuracy: 12,
        recordedAt: new Date(Date.now() - 30_000).toISOString(),
      },
    });
    expect(older.statusCode).toBe(200);
    expect(older.json().data.stale).toBe(true);
    expect(older.json().data.current.latitude).toBe(39.4699);

    const current = await app.inject({
      method: "GET",
      url: `/api/v1/driver/services/${serviceId}/tracking`,
      headers: bearer(token),
    });
    expect(current.statusCode).toBe(200);
    expect(current.json().data.history).toHaveLength(2);

    const stopped = await app.inject({
      method: "POST",
      url: `/api/v1/driver/services/${serviceId}/tracking/stop`,
      headers: bearer(token),
    });
    expect(stopped.statusCode, stopped.body).toBe(200);
  });

  it("rechaza posiciones inválidas o futuras y no permite acceso cross-tenant", async () => {
    const driverToken = await login("conductor@demo.nexo.local");
    const invalid = await app.inject({
      method: "POST",
      url: `/api/v1/driver/services/${serviceId}/tracking/positions`,
      headers: bearer(driverToken),
      payload: {
        sampleId: "invalid",
        latitude: 91,
        longitude: 0,
        accuracy: 2,
        recordedAt: new Date().toISOString(),
      },
    });
    expect(invalid.statusCode).toBe(400);

    const future = await app.inject({
      method: "POST",
      url: `/api/v1/driver/services/${serviceId}/tracking/positions`,
      headers: bearer(driverToken),
      payload: {
        sampleId: "future",
        latitude: 40,
        longitude: -3,
        accuracy: 2,
        recordedAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      },
    });
    expect(future.statusCode).toBe(409);

    const otherTenant = await login("norte@demo.nexo.local");
    const hidden = await app.inject({
      method: "GET",
      url: `/api/v1/services/${serviceId}/tracking/current`,
      headers: bearer(otherTenant),
    });
    expect(hidden.statusCode).toBe(404);
  });

  it("expone el current al transportista, no al cliente, y detiene el tracking", async () => {
    const driverToken = await login("conductor@demo.nexo.local");
    const started = await app.inject({
      method: "POST",
      url: `/api/v1/driver/services/${serviceId}/tracking/start`,
      headers: bearer(driverToken),
    });
    expect(started.statusCode).toBe(201);

    const carrierToken = await login("admin@demo.nexo.local");
    const current = await app.inject({
      method: "GET",
      url: `/api/v1/services/${serviceId}/tracking/current`,
      headers: bearer(carrierToken),
    });
    expect(current.statusCode).toBe(200);
    expect(current.json().data.session.status).toBe("ACTIVE");

    const customerToken = await login("cliente@demo.nexo.local");
    const forbidden = await app.inject({
      method: "GET",
      url: `/api/v1/services/${serviceId}/tracking/current`,
      headers: bearer(customerToken),
    });
    expect(forbidden.statusCode).toBe(403);

    const stopped = await app.inject({
      method: "POST",
      url: `/api/v1/driver/services/${serviceId}/tracking/stop`,
      headers: bearer(driverToken),
    });
    expect(stopped.statusCode, stopped.body).toBe(200);
    expect(stopped.json().data.session.status).toBe("STOPPED");

    const afterStop = await app.inject({
      method: "POST",
      url: `/api/v1/driver/services/${serviceId}/tracking/positions`,
      headers: bearer(driverToken),
      payload: {
        sampleId: "after-stop",
        latitude: 40,
        longitude: -3,
        accuracy: 5,
        recordedAt: new Date().toISOString(),
      },
    });
    expect(afterStop.statusCode).toBe(409);
  });

  it("expira el seguimiento al cerrar sesión móvil", async () => {
    const token = await login("conductor@demo.nexo.local");
    const started = await app.inject({
      method: "POST",
      url: `/api/v1/driver/services/${serviceId}/tracking/start`,
      headers: bearer(token),
    });
    expect(started.statusCode).toBe(201);
    const logout = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: bearer(token),
    });
    expect(logout.statusCode).toBe(204);
    const expired = await database.trackingSession.findFirst({
      where: { serviceId, status: "EXPIRED" },
    });
    expect(expired?.stopReason).toBe("SESSION_REVOKED");
  });
});
