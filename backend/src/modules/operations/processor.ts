import type { AppConfig } from "../../config/env.js";
import type { Database } from "../../plugins/prisma.js";
import { createEtaProvider, type EtaProvider } from "./eta-provider.js";
import { distanceMeters, evaluateDelay, geofenceTransition, needsEtaRefresh } from "./intelligence.js";

type PositionInput = {
  latitude: number;
  longitude: number;
  accuracy: number;
  recordedAt: Date;
};

async function notify(
  database: Database,
  input: { organizationId: string; serviceId: string; type: "DELAY_DETECTED" | "INCIDENT_CREATED" | "ARRIVAL_DETECTED" | "GPS_STALE"; title: string; message: string; dedupeKey: string },
) {
  return database.internalNotification.upsert({
    where: { organizationId_dedupeKey: { organizationId: input.organizationId, dedupeKey: input.dedupeKey } },
    update: {},
    create: input,
  });
}

export async function processOperationalPosition(
  database: Database,
  config: AppConfig,
  serviceId: string,
  position: PositionInput,
  requestId: string,
  provider: EtaProvider = createEtaProvider(config),
) {
  const service = await database.service.findUnique({
    where: { id: serviceId },
    include: { order: true, etaEstimate: true, operationalState: true, geofences: true },
  });
  if (!service) return null;

  if (service.geofences.length === 0) {
    await database.serviceGeofence.createMany({
      data: [
        { organizationId: service.organizationId, serviceId, kind: "ORIGIN", latitude: service.order.originLat, longitude: service.order.originLng, radiusMeters: config.GEOFENCE_RADIUS_METERS },
        { organizationId: service.organizationId, serviceId, kind: "DESTINATION", latitude: service.order.destinationLat, longitude: service.order.destinationLng, radiusMeters: config.GEOFENCE_RADIUS_METERS },
      ],
      skipDuplicates: true,
    });
  }

  const geofences = await database.serviceGeofence.findMany({ where: { serviceId } });
  for (const geofence of geofences) {
    const distance = distanceMeters(position, { latitude: Number(geofence.latitude), longitude: Number(geofence.longitude) });
    const transition = geofenceTransition({
      wasInside: geofence.isInside,
      distance,
      accuracy: position.accuracy,
      radius: geofence.radiusMeters,
      maximumAccuracy: config.GEOFENCE_MAX_ACCURACY_METERS,
    });
    if (!transition) continue;
    const changed = await database.serviceGeofence.updateMany({
      where: { id: geofence.id, isInside: geofence.isInside },
      data: { isInside: transition === "ENTERED", lastTransitionAt: position.recordedAt },
    });
    if (!changed.count) continue;
    const event = await database.geofenceEvent.create({
      data: {
        organizationId: service.organizationId,
        serviceId,
        geofenceId: geofence.id,
        kind: transition,
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
        distanceMeters: distance,
        recordedAt: position.recordedAt,
      },
    });
    await database.serviceEvent.create({
      data: {
        organizationId: service.organizationId,
        serviceId,
        orderId: service.orderId,
        type: transition === "ENTERED" ? "GEOFENCE_ENTERED" : "GEOFENCE_EXITED",
        entityType: "GeofenceEvent",
        entityId: event.id,
        correlationId: requestId,
        payload: { kind: geofence.kind, distanceMeters: distance, accuracy: position.accuracy },
      },
    });
    if (transition === "ENTERED") {
      await notify(database, {
        organizationId: service.organizationId,
        serviceId,
        type: "ARRIVAL_DETECTED",
        title: `Llegada detectada a ${geofence.kind === "ORIGIN" ? "origen" : "destino"}`,
        message: `El GPS ha entrado en la geofence de ${geofence.kind.toLowerCase()}. Requiere confirmación operativa.`,
        dedupeKey: `geofence:${event.id}`,
      });
    }
  }

  const now = new Date();
  let eta = service.etaEstimate;
  if (needsEtaRefresh({
    calculatedAt: eta?.calculatedAt ?? null,
    previousOrigin: eta?.originLat == null || eta.originLng == null ? null : { latitude: Number(eta.originLat), longitude: Number(eta.originLng) },
    currentOrigin: position,
    now,
    minimumMinutes: config.ETA_REFRESH_MINUTES,
    movementMeters: config.ETA_MOVEMENT_METERS,
  })) {
    const result = await provider.calculate(position, { latitude: Number(service.order.destinationLat), longitude: Number(service.order.destinationLng) }, now);
    eta = await database.etaEstimate.upsert({
      where: { serviceId },
      update: result.available ? {
        status: "AVAILABLE", estimatedArrival: result.estimatedArrival, durationSeconds: result.durationSeconds, distanceMeters: result.distanceMeters,
        calculatedAt: now, source: result.source, unavailableReason: null, originLat: position.latitude, originLng: position.longitude,
      } : {
        status: "UNAVAILABLE", estimatedArrival: null, durationSeconds: null, distanceMeters: null,
        calculatedAt: now, source: result.source, unavailableReason: result.reason, originLat: position.latitude, originLng: position.longitude,
      },
      create: {
        organizationId: service.organizationId, serviceId, status: result.available ? "AVAILABLE" : "UNAVAILABLE",
        estimatedArrival: result.available ? result.estimatedArrival : null,
        durationSeconds: result.available ? result.durationSeconds : null,
        distanceMeters: result.available ? result.distanceMeters : null,
        calculatedAt: now, source: result.source, unavailableReason: result.available ? null : result.reason,
        originLat: position.latitude, originLng: position.longitude,
      },
    });
    await database.serviceEvent.create({
      data: {
        organizationId: service.organizationId, serviceId, orderId: service.orderId, type: "ETA_UPDATED",
        entityType: "EtaEstimate", entityId: eta.id, correlationId: requestId,
        payload: { status: eta.status, source: eta.source, estimatedArrival: eta.estimatedArrival?.toISOString() ?? null },
      },
    });
  }

  const comparison = await database.locationHistory.findFirst({
    where: { serviceId, recordedAt: { lte: new Date(position.recordedAt.getTime() - config.NO_PROGRESS_MINUTES * 60_000) } },
    orderBy: { recordedAt: "desc" },
  });
  const noProgress = comparison
    ? distanceMeters(position, { latitude: Number(comparison.latitude), longitude: Number(comparison.longitude) }) < 200
    : false;
  const assessment = evaluateDelay({
    estimatedArrival: eta?.status === "AVAILABLE" ? eta.estimatedArrival : null,
    plannedDelivery: service.order.plannedDelivery,
    gpsRecordedAt: position.recordedAt,
    now,
    gpsStaleMinutes: config.GPS_STALE_MINUTES,
    confirmedMinutes: config.DELAY_CONFIRMED_MINUTES,
    noProgress,
  });
  const previousLevel = service.operationalState?.delayLevel;
  const state = await database.serviceOperationalState.upsert({
    where: { serviceId },
    update: { delayLevel: assessment.level, delayMinutes: assessment.delayMinutes, gpsStale: assessment.gpsStale, noProgress, reasons: assessment.reasons, assessedAt: now },
    create: { organizationId: service.organizationId, serviceId, delayLevel: assessment.level, delayMinutes: assessment.delayMinutes, gpsStale: assessment.gpsStale, noProgress, reasons: assessment.reasons, assessedAt: now },
  });
  if (previousLevel !== state.delayLevel) {
    await database.serviceEvent.create({
      data: {
        organizationId: service.organizationId, serviceId, orderId: service.orderId, type: "DELAY_STATUS_CHANGED",
        entityType: "ServiceOperationalState", entityId: state.id, correlationId: requestId,
        payload: { from: previousLevel ?? null, to: state.delayLevel, delayMinutes: state.delayMinutes, reasons: assessment.reasons },
      },
    });
  }
  if (state.delayLevel === "RISK" || state.delayLevel === "CONFIRMED") {
    const bucket = Math.floor(now.getTime() / (30 * 60_000));
    await notify(database, {
      organizationId: service.organizationId, serviceId, type: "DELAY_DETECTED",
      title: state.delayLevel === "CONFIRMED" ? "Retraso confirmado" : "Riesgo de retraso",
      message: state.delayMinutes == null ? "El servicio requiere revisión." : `Desviación estimada: ${state.delayMinutes} min.`,
      dedupeKey: `delay:${serviceId}:${state.delayLevel}:${bucket}`,
    });
  }
  return { eta, state };
}

export async function markGpsStale(database: Database, config: AppConfig, serviceId: string, now = new Date()) {
  const service = await database.service.findUnique({ where: { id: serviceId }, include: { currentPosition: true, operationalState: true } });
  if (!service) return null;
  const stale = !service.currentPosition || now.getTime() - service.currentPosition.recordedAt.getTime() > config.GPS_STALE_MINUTES * 60_000;
  if (!stale) return service.operationalState;
  const state = await database.serviceOperationalState.upsert({
    where: { serviceId },
    update: { delayLevel: "DATA_INSUFFICIENT", gpsStale: true, reasons: ["GPS_STALE"], assessedAt: now },
    create: { organizationId: service.organizationId, serviceId, delayLevel: "DATA_INSUFFICIENT", gpsStale: true, noProgress: false, reasons: ["GPS_STALE"], assessedAt: now },
  });
  const bucket = Math.floor(now.getTime() / (30 * 60_000));
  await notify(database, {
    organizationId: service.organizationId, serviceId, type: "GPS_STALE", title: "GPS desactualizado",
    message: "No se ha recibido una posición reciente del conductor.", dedupeKey: `gps-stale:${serviceId}:${bucket}`,
  });
  return state;
}
