import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AppConfig } from "../../config/env.js";
import type { Database } from "../../plugins/prisma.js";
import { forbidden, notFound } from "../../shared/errors.js";
import { createAuthenticate, requirePermission } from "../auth/auth.js";
import { markGpsStale } from "./processor.js";

const idSchema = z.object({ id: z.string().min(1).max(128) });
const incidentParamsSchema = z.object({ serviceId: z.string().min(1).max(128), incidentId: z.string().min(1).max(128) });
const incidentType = z.enum(["DELAY", "BREAKDOWN", "LOADING_PROBLEM", "UNLOADING_PROBLEM", "WRONG_ADDRESS", "DOCUMENT_PROBLEM", "OTHER"]);
const incidentPriority = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const incidentStatus = z.enum(["OPEN", "IN_REVIEW", "RESOLVED", "CLOSED"]);
const createIncidentSchema = z.object({ type: incidentType, description: z.string().trim().min(5).max(2_000), priority: incidentPriority.default("MEDIUM") });
const updateIncidentSchema = z.object({ status: incidentStatus, priority: incidentPriority.optional(), note: z.string().trim().max(1_000).optional() });

const incidentInclude = { history: { orderBy: { changedAt: "asc" as const } }, reportedBy: { select: { id: true, name: true } } } as const;

function presentIncident(incident: any) {
  return {
    id: incident.id, serviceId: incident.serviceId, type: incident.type, description: incident.description,
    status: incident.status, priority: incident.priority, reportedAt: incident.reportedAt.toISOString(),
    resolvedAt: incident.resolvedAt?.toISOString() ?? null,
    reportedBy: incident.reportedBy,
    history: incident.history.map((item: any) => ({ id: item.id, fromStatus: item.fromStatus, toStatus: item.toStatus, note: item.note, changedByUserId: item.changedByUserId, changedAt: item.changedAt.toISOString() })),
  };
}

function requireCarrier(request: FastifyRequest) {
  const auth = request.auth!;
  if (auth.actorKind !== "transport") throw forbidden("Acceso reservado al transportista");
  return auth;
}

async function driverService(database: Database, request: FastifyRequest, id: string) {
  const auth = requirePermission(request, "driver:services:read");
  if (auth.role !== "DRIVER" || !auth.driverId) throw forbidden("Conductor no vinculado");
  const service = await database.service.findFirst({
    where: { id, organizationId: auth.organizationId, assignments: { some: { driverId: auth.driverId, status: "ACTIVE" } } },
  });
  if (!service) throw notFound("Servicio");
  return { auth, service };
}

export async function registerOperationsRoutes(app: FastifyInstance, database: Database, config: AppConfig) {
  const authenticate = createAuthenticate(database, config);

  app.post("/driver/services/:id/incidents", { preHandler: authenticate }, async (request, reply) => {
    requirePermission(request, "driver:incidents:create");
    const { id } = idSchema.parse(request.params);
    const { auth, service } = await driverService(database, request, id);
    const input = createIncidentSchema.parse(request.body);
    const incident = await database.$transaction(async (tx) => {
      const created = await tx.operationalIncident.create({ data: { organizationId: auth.organizationId, serviceId: id, type: input.type, description: input.description, priority: input.priority, reportedByUserId: auth.userId } });
      await tx.incidentHistory.create({ data: { organizationId: auth.organizationId, incidentId: created.id, changedByUserId: auth.userId, toStatus: "OPEN", note: "Incidencia comunicada por el conductor" } });
      await tx.serviceEvent.create({ data: { organizationId: auth.organizationId, serviceId: id, orderId: service.orderId, type: "INCIDENT_CREATED", entityType: "OperationalIncident", entityId: created.id, actorUserId: auth.userId, correlationId: request.id, payload: { type: input.type, priority: input.priority } } });
      await tx.internalNotification.upsert({ where: { organizationId_dedupeKey: { organizationId: auth.organizationId, dedupeKey: `incident:${created.id}` } }, update: {}, create: { organizationId: auth.organizationId, serviceId: id, type: "INCIDENT_CREATED", title: "Nueva incidencia", message: input.description, dedupeKey: `incident:${created.id}` } });
      await tx.auditLog.create({ data: { organizationId: auth.organizationId, actorUserId: auth.userId, action: "INCIDENT_CREATED", entityType: "OperationalIncident", entityId: created.id, requestId: request.id, metadata: { serviceId: id, type: input.type, priority: input.priority } } });
      return created;
    });
    const full = await database.operationalIncident.findUniqueOrThrow({ where: { id: incident.id }, include: incidentInclude });
    return reply.code(201).send({ data: presentIncident(full) });
  });

  app.get("/driver/services/:id/incidents", { preHandler: authenticate }, async (request) => {
    const { id } = idSchema.parse(request.params);
    await driverService(database, request, id);
    const incidents = await database.operationalIncident.findMany({ where: { serviceId: id }, include: incidentInclude, orderBy: { reportedAt: "desc" } });
    return { data: incidents.map(presentIncident) };
  });

  app.get("/incidents", { preHandler: authenticate }, async (request) => {
    requirePermission(request, "incidents:read");
    const auth = requireCarrier(request);
    const incidents = await database.operationalIncident.findMany({ where: { organizationId: auth.organizationId }, include: incidentInclude, orderBy: [{ status: "asc" }, { reportedAt: "desc" }] });
    return { data: incidents.map(presentIncident) };
  });

  app.patch("/services/:serviceId/incidents/:incidentId", { preHandler: authenticate }, async (request) => {
    const auth = requirePermission(request, "incidents:manage");
    requireCarrier(request);
    const { serviceId, incidentId } = incidentParamsSchema.parse(request.params);
    const input = updateIncidentSchema.parse(request.body);
    const incident = await database.operationalIncident.findFirst({ where: { id: incidentId, serviceId, organizationId: auth.organizationId } });
    if (!incident) throw notFound("Incidencia");
    await database.$transaction(async (tx) => {
      await tx.operationalIncident.update({ where: { id: incidentId }, data: { status: input.status, ...(input.priority ? { priority: input.priority } : {}), resolvedAt: ["RESOLVED", "CLOSED"].includes(input.status) ? new Date() : null } });
      await tx.incidentHistory.create({ data: { organizationId: auth.organizationId, incidentId, changedByUserId: auth.userId, fromStatus: incident.status, toStatus: input.status, ...(input.note ? { note: input.note } : {}) } });
      await tx.serviceEvent.create({ data: { organizationId: auth.organizationId, serviceId, type: "INCIDENT_UPDATED", entityType: "OperationalIncident", entityId: incidentId, actorUserId: auth.userId, correlationId: request.id, payload: { from: incident.status, to: input.status, priority: input.priority ?? incident.priority } } });
      await tx.auditLog.create({ data: { organizationId: auth.organizationId, actorUserId: auth.userId, action: "INCIDENT_UPDATED", entityType: "OperationalIncident", entityId: incidentId, requestId: request.id, metadata: { serviceId, from: incident.status, to: input.status } } });
    });
    const updated = await database.operationalIncident.findUniqueOrThrow({ where: { id: incidentId }, include: incidentInclude });
    return { data: presentIncident(updated) };
  });

  app.get("/services/:id/intelligence", { preHandler: authenticate }, async (request) => {
    const auth = requirePermission(request, "operations:read");
    requireCarrier(request);
    const { id } = idSchema.parse(request.params);
    const service = await database.service.findFirst({ where: { id, organizationId: auth.organizationId }, include: { etaEstimate: true, operationalState: true, geofences: { include: { events: { orderBy: { recordedAt: "desc" }, take: 20 } } }, incidents: { include: incidentInclude } } });
    if (!service) throw notFound("Servicio");
    await markGpsStale(database, config, id);
    const refreshed = await database.service.findUniqueOrThrow({ where: { id }, include: { etaEstimate: true, operationalState: true, geofences: { include: { events: { orderBy: { recordedAt: "desc" }, take: 20 } } }, incidents: { include: incidentInclude } } });
    return { data: { eta: refreshed.etaEstimate, state: refreshed.operationalState, geofences: refreshed.geofences, incidents: refreshed.incidents.map(presentIncident) } };
  });

  app.get("/operations/exceptions", { preHandler: authenticate }, async (request) => {
    const auth = requirePermission(request, "operations:read");
    requireCarrier(request);
    const services = await database.service.findMany({ where: { organizationId: auth.organizationId }, include: { order: true, customer: true, currentPosition: true, etaEstimate: true, operationalState: true, incidents: { where: { status: { in: ["OPEN", "IN_REVIEW"] } } }, assignments: { where: { status: "ACTIVE" }, include: { driver: true, vehicle: true } } }, orderBy: { updatedAt: "desc" } });
    for (const service of services) await markGpsStale(database, config, service.id);
    const states = await database.serviceOperationalState.findMany({ where: { organizationId: auth.organizationId } });
    const byService = new Map(states.map((state) => [state.serviceId, state]));
    return { data: services.map((service) => ({
      id: service.id, reference: service.order.reference, customerName: service.customer.name, status: service.status,
      plannedDelivery: service.order.plannedDelivery.toISOString(), assignment: service.assignments[0] ? { driverName: service.assignments[0].driver.name, vehiclePlate: service.assignments[0].vehicle.plate } : null,
      currentPosition: service.currentPosition ? { latitude: Number(service.currentPosition.latitude), longitude: Number(service.currentPosition.longitude), accuracy: Number(service.currentPosition.accuracy), recordedAt: service.currentPosition.recordedAt.toISOString() } : null,
      eta: service.etaEstimate ? { status: service.etaEstimate.status, estimatedArrival: service.etaEstimate.estimatedArrival?.toISOString() ?? null, calculatedAt: service.etaEstimate.calculatedAt.toISOString(), source: service.etaEstimate.source } : null,
      operationalState: byService.get(service.id) ?? null,
      openIncidents: service.incidents.length,
    })) };
  });

  app.get("/notifications", { preHandler: authenticate }, async (request) => {
    const auth = requirePermission(request, "notifications:read");
    requireCarrier(request);
    const notifications = await database.internalNotification.findMany({ where: { organizationId: auth.organizationId }, orderBy: { createdAt: "desc" }, take: 100 });
    return { data: notifications };
  });

  app.patch("/notifications/:id/read", { preHandler: authenticate }, async (request) => {
    const auth = requirePermission(request, "notifications:read");
    requireCarrier(request);
    const { id } = idSchema.parse(request.params);
    const result = await database.internalNotification.updateMany({ where: { id, organizationId: auth.organizationId }, data: { readAt: new Date() } });
    if (!result.count) throw notFound("Notificación");
    return { data: { read: true } };
  });
}
