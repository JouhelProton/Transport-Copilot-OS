import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app/build-app.js";
import { loadConfig } from "../src/config/env.js";
import { createPrismaClient, type Database } from "../src/plugins/prisma.js";
import { UnavailableEtaProvider } from "../src/modules/operations/eta-provider.js";
import { distanceMeters, evaluateDelay, geofenceTransition, needsEtaRefresh } from "../src/modules/operations/intelligence.js";
import { processOperationalPosition } from "../src/modules/operations/processor.js";

const config = loadConfig({ ...process.env, NODE_ENV: "test", GOOGLE_ROUTES_API_KEY: undefined });
const database = createPrismaClient(config.DATABASE_URL);
const app = await buildApp(config, database);
const serviceId = "svc_nv_24081_real";
const password = "Demo-Transport-2026!";

async function login(email: string) {
  const response = await app.inject({ method: "POST", url: "/api/v1/auth/mobile-login", payload: { email, password } });
  expect(response.statusCode).toBe(200);
  return { authorization: `Bearer ${response.json().data.sessionToken}` };
}

async function cleanup() {
  await database.incidentHistory.deleteMany({ where: { incident: { serviceId } } });
  await database.operationalIncident.deleteMany({ where: { serviceId } });
  await database.internalNotification.deleteMany({ where: { serviceId } });
  await database.geofenceEvent.deleteMany({ where: { serviceId } });
  await database.serviceGeofence.deleteMany({ where: { serviceId } });
  await database.etaEstimate.deleteMany({ where: { serviceId } });
  await database.serviceOperationalState.deleteMany({ where: { serviceId } });
  await database.serviceEvent.deleteMany({ where: { serviceId, type: { in: ["ETA_UPDATED", "DELAY_STATUS_CHANGED", "GEOFENCE_ENTERED", "GEOFENCE_EXITED", "INCIDENT_CREATED", "INCIDENT_UPDATED"] } } });
  await database.auditLog.deleteMany({ where: { entityType: "OperationalIncident" } });
}

beforeAll(async () => { await app.ready(); await cleanup(); });
afterAll(async () => { await cleanup(); await database.session.deleteMany(); await database.auditLog.deleteMany({ where: { entityType: "Session" } }); await app.close(); await database.$disconnect(); });

describe("reglas de Operations Intelligence", () => {
  it("calcula distancia y refresca ETA por movimiento significativo", () => {
    expect(distanceMeters({ latitude: 39.4699, longitude: -0.3763 }, { latitude: 40.4168, longitude: -3.7038 })).toBeGreaterThan(300_000);
    expect(needsEtaRefresh({ calculatedAt: new Date(), previousOrigin: { latitude: 39.46, longitude: -0.37 }, currentOrigin: { latitude: 40.41, longitude: -3.7 }, now: new Date(), minimumMinutes: 5, movementMeters: 5_000 })).toBe(true);
  });

  it("acepta ETA válida y detecta retraso confirmado", () => {
    const now = new Date("2026-01-01T10:00:00Z");
    const result = evaluateDelay({ estimatedArrival: new Date("2026-01-01T12:00:00Z"), plannedDelivery: new Date("2026-01-01T11:00:00Z"), gpsRecordedAt: now, now, gpsStaleMinutes: 5, confirmedMinutes: 30, noProgress: false });
    expect(result).toMatchObject({ level: "CONFIRMED", delayMinutes: 60, gpsStale: false });
  });

  it("distingue ETA no disponible y GPS desactualizado", () => {
    const now = new Date("2026-01-01T10:00:00Z");
    const result = evaluateDelay({ estimatedArrival: null, plannedDelivery: now, gpsRecordedAt: new Date("2026-01-01T09:00:00Z"), now, gpsStaleMinutes: 5, confirmedMinutes: 30, noProgress: false });
    expect(result.level).toBe("DATA_INSUFFICIENT");
    expect(result.reasons).toEqual(expect.arrayContaining(["GPS_STALE", "ETA_UNAVAILABLE"]));
  });

  it("detecta entrada y salida de geofence con histéresis", () => {
    expect(geofenceTransition({ wasInside: false, distance: 100, accuracy: 10, radius: 250, maximumAccuracy: 100 })).toBe("ENTERED");
    expect(geofenceTransition({ wasInside: true, distance: 350, accuracy: 10, radius: 250, maximumAccuracy: 100 })).toBe("EXITED");
  });

  it("ignora geofence con precisión insuficiente", () => {
    expect(geofenceTransition({ wasInside: false, distance: 10, accuracy: 150, radius: 250, maximumAccuracy: 100 })).toBeNull();
  });

  it("declara ETA externa no disponible sin clave", async () => {
    await expect(new UnavailableEtaProvider().calculate({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 1 }, new Date())).resolves.toMatchObject({ available: false, reason: "GOOGLE_ROUTES_API_KEY_NOT_CONFIGURED" });
  });
});

describe("persistencia, incidencias y aislamiento", () => {
  it("persiste ETA válida, llegada y deduplica notificaciones", async () => {
    const provider = { calculate: async () => ({ available: true as const, estimatedArrival: new Date(Date.now() + 60 * 60_000), durationSeconds: 3600, distanceMeters: 350_000, source: "TEST_PROVIDER" }) };
    const position = { latitude: 39.4699, longitude: -0.3763, accuracy: 5, recordedAt: new Date() };
    await processOperationalPosition(database, config, serviceId, position, "test-ops-1", provider);
    await processOperationalPosition(database, config, serviceId, position, "test-ops-2", provider);
    expect(await database.etaEstimate.findUnique({ where: { serviceId } })).toMatchObject({ status: "AVAILABLE", source: "TEST_PROVIDER" });
    expect(await database.geofenceEvent.count({ where: { serviceId, kind: "ENTERED" } })).toBe(1);
    expect(await database.internalNotification.count({ where: { serviceId, type: "ARRIVAL_DETECTED" } })).toBe(1);
  });

  it("permite incidencia al conductor asignado y crea notificación", async () => {
    const headers = await login("conductor@demo.nexo.local");
    const response = await app.inject({ method: "POST", url: `/api/v1/driver/services/${serviceId}/incidents`, headers, payload: { type: "BREAKDOWN", description: "Pérdida de presión en un neumático", priority: "HIGH" } });
    expect(response.statusCode).toBe(201);
    expect(response.json().data).toMatchObject({ type: "BREAKDOWN", status: "OPEN", priority: "HIGH" });
    expect(await database.internalNotification.count({ where: { serviceId, type: "INCIDENT_CREATED" } })).toBe(1);
  });

  it("rechaza incidencias de servicios no asignados", async () => {
    const headers = await login("conductor@demo.nexo.local");
    const response = await app.inject({ method: "POST", url: "/api/v1/driver/services/servicio-ajeno/incidents", headers, payload: { type: "OTHER", description: "Intento fuera de asignación" } });
    expect(response.statusCode).toBe(404);
  });

  it("permite al operador gestionar la incidencia", async () => {
    const incident = await database.operationalIncident.findFirstOrThrow({ where: { serviceId } });
    const headers = await login("operaciones@demo.nexo.local");
    const response = await app.inject({ method: "PATCH", url: `/api/v1/services/${serviceId}/incidents/${incident.id}`, headers, payload: { status: "IN_REVIEW", note: "Taller avisado" } });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.status).toBe("IN_REVIEW");
    expect(response.json().data.history).toHaveLength(2);
  });

  it("mantiene aislamiento multiempresa", async () => {
    const incident = await database.operationalIncident.findFirstOrThrow({ where: { serviceId } });
    const headers = await login("norte@demo.nexo.local");
    const response = await app.inject({ method: "PATCH", url: `/api/v1/services/${serviceId}/incidents/${incident.id}`, headers, payload: { status: "CLOSED" } });
    expect(response.statusCode).toBe(404);
  });

  it("expone panel de excepciones y notificaciones al transportista", async () => {
    const headers = await login("admin@demo.nexo.local");
    const exceptions = await app.inject({ method: "GET", url: "/api/v1/operations/exceptions", headers });
    const notifications = await app.inject({ method: "GET", url: "/api/v1/notifications", headers });
    expect(exceptions.statusCode).toBe(200);
    expect(exceptions.json().data.some((item: { id: string }) => item.id === serviceId)).toBe(true);
    expect(notifications.statusCode).toBe(200);
    expect(notifications.json().data.length).toBeGreaterThan(0);
  });

  it("devuelve 503 cuando PostgreSQL no está disponible", async () => {
    const unavailableDatabase = { $queryRaw: async () => { throw new Error("offline"); }, $disconnect: async () => {} } as unknown as Database;
    const isolated = await buildApp(config, unavailableDatabase);
    const response = await isolated.inject({ method: "GET", url: "/ready" });
    expect(response.statusCode).toBe(503);
    await isolated.close();
  });
});
