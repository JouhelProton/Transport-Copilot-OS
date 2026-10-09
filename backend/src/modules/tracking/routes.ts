import { z } from "zod";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AppConfig } from "../../config/env.js";
import type { Database } from "../../plugins/prisma.js";
import { conflict, forbidden, notFound } from "../../shared/errors.js";
import { createAuthenticate, requirePermission } from "../auth/auth.js";
import { processOperationalPosition } from "../operations/processor.js";

const positionSchema = z.object({
  sampleId: z.string().trim().min(1).max(128),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracy: z.number().finite().min(0).max(5_000),
  heading: z.number().finite().min(-1).max(360).nullable().optional().transform((value) => value !== null && value !== undefined && value < 0 ? null : value),
  speed: z.number().finite().min(-1).max(100).nullable().optional().transform((value) => value !== null && value !== undefined && value < 0 ? null : value),
  recordedAt: z.coerce.date(),
});

const historyQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(1_000).default(500),
});

const trackingServiceInclude = {
  assignments: {
    where: { status: "ACTIVE" as const },
    select: { driverId: true },
  },
} as const;

function positionView(position: {
  id: string;
  serviceId: string;
  driverId: string;
  latitude: unknown;
  longitude: unknown;
  accuracy: unknown;
  heading: unknown;
  speed: unknown;
  recordedAt: Date;
  receivedAt: Date;
  source: string;
  sampleId: string;
}) {
  return {
    id: position.id,
    serviceId: position.serviceId,
    driverId: position.driverId,
    latitude: Number(position.latitude),
    longitude: Number(position.longitude),
    accuracy: Number(position.accuracy),
    heading: position.heading === null ? null : Number(position.heading),
    speed: position.speed === null ? null : Number(position.speed),
    recordedAt: position.recordedAt.toISOString(),
    receivedAt: position.receivedAt.toISOString(),
    source: position.source,
    sampleId: position.sampleId,
  };
}

function sessionView(session: {
  id: string;
  serviceId: string;
  driverId: string;
  status: string;
  startedAt: Date;
  stoppedAt: Date | null;
  stopReason: string | null;
}) {
  return {
    id: session.id,
    serviceId: session.serviceId,
    driverId: session.driverId,
    status: session.status,
    startedAt: session.startedAt.toISOString(),
    stoppedAt: session.stoppedAt?.toISOString() ?? null,
    stopReason: session.stopReason,
  };
}

function driverAuth(request: FastifyRequest) {
  const auth = requirePermission(request, "driver:services:read");
  if (auth.role !== "DRIVER" || !auth.driverId)
    throw forbidden("El usuario no está vinculado a un conductor activo");
  return auth as typeof auth & { driverId: string };
}

async function driverService(
  database: Database,
  request: FastifyRequest,
  id: string,
) {
  const auth = driverAuth(request);
  const service = await database.service.findFirst({
    where: {
      id,
      organizationId: auth.organizationId,
      assignments: { some: { driverId: auth.driverId, status: "ACTIVE" } },
    },
    include: trackingServiceInclude,
  });
  if (!service) throw notFound("Servicio");
  return { auth, service };
}

function assertPositionTime(recordedAt: Date, now = Date.now()) {
  if (recordedAt.getTime() > now + 2 * 60 * 1000)
    throw conflict("POSITION_IN_FUTURE", "La posición tiene una fecha futura no válida");
  if (recordedAt.getTime() < now - 24 * 60 * 60 * 1000)
    throw conflict("POSITION_TOO_OLD", "La posición es demasiado antigua");
}

export async function registerTrackingRoutes(
  app: FastifyInstance,
  database: Database,
  config: AppConfig,
) {
  const authenticate = createAuthenticate(database, config);

  app.post(
    "/driver/services/:id/tracking/start",
    { preHandler: authenticate },
    async (request, reply) => {
      const { auth, service } = await driverService(
        database,
        request,
        (request.params as { id: string }).id,
      );
      requirePermission(request, "driver:services:accept");
      if (!["ASSIGNED", "DRIVER_ACCEPTED"].includes(service.status))
        throw conflict("TRACKING_NOT_ALLOWED", "El servicio no permite iniciar seguimiento");

      const active = await database.trackingSession.findFirst({
        where: { serviceId: service.id, status: "ACTIVE" },
      });
      if (active && active.driverId !== auth.driverId)
        throw conflict("TRACKING_ALREADY_ACTIVE", "El servicio ya tiene otro seguimiento activo");
      if (active) {
        request.log.info({ requestId: request.id, organizationId: auth.organizationId, serviceId: service.id, trackingSessionId: active.id, outcome: "already_active" }, "Tracking session confirmed");
        return reply.send({ data: sessionView(active) });
      }

      const session = await database.$transaction(async (tx) => {
        const created = await tx.trackingSession.create({
          data: {
            organizationId: auth.organizationId,
            serviceId: service.id,
            driverId: auth.driverId,
          },
        });
        await tx.serviceEvent.create({
          data: {
            organizationId: auth.organizationId,
            serviceId: service.id,
            orderId: service.orderId,
            type: "TRACKING_STARTED",
            entityType: "TrackingSession",
            entityId: created.id,
            actorUserId: auth.userId,
            correlationId: request.id,
            payload: { driverId: auth.driverId, source: "MOBILE_GPS" },
          },
        });
        await tx.auditLog.create({
          data: {
            organizationId: auth.organizationId,
            actorUserId: auth.userId,
            action: "TRACKING_STARTED",
            entityType: "TrackingSession",
            entityId: created.id,
            requestId: request.id,
            metadata: { serviceId: service.id, driverId: auth.driverId },
          },
        });
        return created;
      });
      request.log.info({ requestId: request.id, organizationId: auth.organizationId, serviceId: service.id, trackingSessionId: session.id, outcome: "started" }, "Tracking session confirmed");
      return reply.code(201).send({ data: sessionView(session) });
    },
  );

  app.post(
    "/driver/services/:id/tracking/positions",
    { preHandler: authenticate },
    async (request) => {
      const { auth, service } = await driverService(
        database,
        request,
        (request.params as { id: string }).id,
      );
      const input = positionSchema.parse(request.body);
      assertPositionTime(input.recordedAt);
      const session = await database.trackingSession.findFirst({
        where: { serviceId: service.id, driverId: auth.driverId, status: "ACTIVE" },
      });
      if (!session)
        throw conflict("TRACKING_NOT_ACTIVE", "Inicia el seguimiento antes de enviar posiciones");

      const receivedAt = new Date();
      const saved = await database.$transaction(async (tx) => {
        const inserted = await tx.locationHistory.createMany({
          data: [{
            organizationId: auth.organizationId,
            serviceId: service.id,
            driverId: auth.driverId,
            latitude: input.latitude,
            longitude: input.longitude,
            accuracy: input.accuracy,
            heading: input.heading ?? null,
            speed: input.speed ?? null,
            recordedAt: input.recordedAt,
            receivedAt,
            sampleId: input.sampleId,
          }],
          skipDuplicates: true,
        });
        const currentBefore = await tx.currentPosition.findUnique({ where: { serviceId: service.id } });
        if (inserted.count === 0)
          return { duplicate: true, stale: false, current: currentBefore };
        const stale = currentBefore ? input.recordedAt <= currentBefore.recordedAt : false;
        if (stale) return { duplicate: false, stale: true, current: currentBefore };
        const current = await tx.currentPosition.upsert({
          where: { serviceId: service.id },
          create: {
            organizationId: auth.organizationId,
            serviceId: service.id,
            driverId: auth.driverId,
            latitude: input.latitude,
            longitude: input.longitude,
            accuracy: input.accuracy,
            heading: input.heading ?? null,
            speed: input.speed ?? null,
            recordedAt: input.recordedAt,
            receivedAt,
            sampleId: input.sampleId,
          },
          update: {
            driverId: auth.driverId,
            latitude: input.latitude,
            longitude: input.longitude,
            accuracy: input.accuracy,
            heading: input.heading ?? null,
            speed: input.speed ?? null,
            recordedAt: input.recordedAt,
            receivedAt,
            sampleId: input.sampleId,
          },
        });
        return { duplicate: false, stale: false, current };
      });
      if (!saved.duplicate && !saved.stale)
        await processOperationalPosition(database, config, service.id, input, request.id);
      request.log.info({ requestId: request.id, organizationId: auth.organizationId, serviceId: service.id, trackingSessionId: session.id, sampleId: input.sampleId, outcome: saved.duplicate ? "duplicate" : saved.stale ? "accepted_stale" : "accepted" }, "Tracking position processed");
      return { data: { accepted: true, duplicate: saved.duplicate, stale: saved.stale, current: saved.current ? positionView(saved.current) : null } };
    },
  );

  app.post(
    "/driver/services/:id/tracking/stop",
    { preHandler: authenticate },
    async (request) => {
      const { auth, service } = await driverService(
        database,
        request,
        (request.params as { id: string }).id,
      );
      requirePermission(request, "driver:services:accept");
      const session = await database.trackingSession.findFirst({
        where: { serviceId: service.id, driverId: auth.driverId, status: "ACTIVE" },
      });
      if (!session) return { data: { stopped: false, session: null } };
      const stoppedAt = new Date();
      const updated = await database.$transaction(async (tx) => {
        const result = await tx.trackingSession.update({
          where: { id: session.id },
          data: { status: "STOPPED", stoppedAt, stopReason: "DRIVER_REQUEST" },
        });
        await tx.serviceEvent.create({
          data: {
            organizationId: auth.organizationId,
            serviceId: service.id,
            orderId: service.orderId,
            type: "TRACKING_STOPPED",
            entityType: "TrackingSession",
            entityId: result.id,
            actorUserId: auth.userId,
            correlationId: request.id,
            payload: { driverId: auth.driverId, reason: "DRIVER_REQUEST" },
          },
        });
        await tx.auditLog.create({
          data: {
            organizationId: auth.organizationId,
            actorUserId: auth.userId,
            action: "TRACKING_STOPPED",
            entityType: "TrackingSession",
            entityId: result.id,
            requestId: request.id,
            metadata: { serviceId: service.id, reason: "DRIVER_REQUEST" },
          },
        });
        return result;
      });
      request.log.info({ requestId: request.id, organizationId: auth.organizationId, serviceId: service.id, trackingSessionId: updated.id, outcome: "stopped" }, "Tracking session stopped");
      return { data: { stopped: true, session: sessionView(updated) } };
    },
  );

  app.get(
    "/driver/services/:id/tracking",
    { preHandler: authenticate },
    async (request) => {
      const { auth, service } = await driverService(
        database,
        request,
        (request.params as { id: string }).id,
      );
      const [session, current, history] = await Promise.all([
        database.trackingSession.findFirst({ where: { serviceId: service.id, driverId: auth.driverId }, orderBy: { startedAt: "desc" } }),
        database.currentPosition.findUnique({ where: { serviceId: service.id } }),
        database.locationHistory.findMany({ where: { serviceId: service.id, driverId: auth.driverId }, orderBy: { recordedAt: "desc" }, take: 500 }),
      ]);
      return { data: { session: session ? sessionView(session) : null, current: current ? positionView(current) : null, history: history.map(positionView) } };
    },
  );

  async function carrierService(request: FastifyRequest, id: string) {
    const auth = requirePermission(request, "services:read");
    if (auth.actorKind !== "transport") throw forbidden("El seguimiento GPS solo está disponible para el transportista");
    const service = await database.service.findFirst({ where: { id, organizationId: auth.organizationId } });
    if (!service) throw notFound("Servicio");
    return { auth, service };
  }

  app.get("/services/:id/tracking/current", { preHandler: authenticate }, async (request) => {
    const { service } = await carrierService(request, (request.params as { id: string }).id);
    const [current, session] = await Promise.all([
      database.currentPosition.findUnique({ where: { serviceId: service.id } }),
      database.trackingSession.findFirst({ where: { serviceId: service.id }, orderBy: { startedAt: "desc" } }),
    ]);
    return { data: { current: current ? positionView(current) : null, session: session ? sessionView(session) : null } };
  });

  app.get("/services/:id/tracking/history", { preHandler: authenticate }, async (request) => {
    const { service } = await carrierService(request, (request.params as { id: string }).id);
    const query = historyQuerySchema.parse(request.query);
    const history = await database.locationHistory.findMany({
      where: {
        serviceId: service.id,
        ...(query.from || query.to ? { recordedAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } } : {}),
      },
      orderBy: { recordedAt: "asc" },
      take: query.limit,
    });
    return { data: history.map(positionView) };
  });
}
