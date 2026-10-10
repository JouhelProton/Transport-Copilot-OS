import type * as Location from "expo-location";
import { authStorage } from "@/auth/storage";
import { driverApi } from "@/api/driver";
import {
  appendRejectedSamples,
  belongsToSession,
  enqueuePendingSample,
  mutatePendingSamples,
  readPendingSamples,
  type PendingTrackingSample,
} from "./queue";
import { classifySyncError, drainPendingSamples, normalizeOptionalSensorValue } from "./synchronizer";
import { trackingRuntimeStorage, type TrackingRuntimeContext } from "./runtime-storage";

export function createPendingSample(
  location: Location.LocationObject,
  context: TrackingRuntimeContext,
  random = Math.random,
): PendingTrackingSample {
  const recordedAt = new Date(location.timestamp).toISOString();
  return {
    serviceId: context.serviceId,
    trackingSessionId: context.trackingSessionId,
    queuedAt: new Date().toISOString(),
    attempts: 0,
    position: {
      sampleId: `${location.timestamp}-${random().toString(36).slice(2, 10)}`,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy ?? 999,
      heading: normalizeOptionalSensorValue(location.coords.heading),
      speed: normalizeOptionalSensorValue(location.coords.speed),
      recordedAt,
    },
  };
}

export function isUsableLocation(location: Location.LocationObject) {
  return Number.isFinite(location.timestamp) &&
    Number.isFinite(location.coords.latitude) && location.coords.latitude >= -90 && location.coords.latitude <= 90 &&
    Number.isFinite(location.coords.longitude) && location.coords.longitude >= -180 && location.coords.longitude <= 180;
}

export async function queueLocation(location: Location.LocationObject, context: TrackingRuntimeContext) {
  if (!isUsableLocation(location)) return null;
  const sample = createPendingSample(location, context);
  const dropped = await enqueuePendingSample(sample);
  if (dropped) {
    await appendRejectedSamples([{
      serviceId: dropped.serviceId,
      trackingSessionId: dropped.trackingSessionId,
      sampleId: dropped.position.sampleId,
      rejectedAt: new Date().toISOString(),
      reason: "QUEUE_LIMIT_REACHED",
      httpStatus: null,
    }]);
  }
  return sample;
}

export async function syncTrackingQueue(context: TrackingRuntimeContext, explicitToken?: string) {
  const token = explicitToken ?? await authStorage.get();
  if (!token) return { confirmed: 0, failure: classifySyncError(new Error("missing token")) };
  const snapshot = (await readPendingSamples()).filter((item) =>
    belongsToSession(item, context.serviceId, context.trackingSessionId),
  );
  if (snapshot.length === 0) return { confirmed: 0, failure: null };
  const result = await drainPendingSamples(snapshot, async (item) => {
    item.attempts += 1;
    await driverApi.sendTrackingPosition(token, context.serviceId, item.position);
  });
  const retained = new Set(result.pending.map((item) => item.position.sampleId));
  const attempted = new Set(snapshot.map((item) => item.position.sampleId));
  await mutatePendingSamples((all) => ({
    items: all.filter((item) => !attempted.has(item.position.sampleId) || retained.has(item.position.sampleId)),
    result: undefined,
  }));
  if (result.rejected.length) await appendRejectedSamples(result.rejected);
  return { confirmed: result.confirmed, failure: result.failure };
}

export async function invalidateTrackingContext(reason: string) {
  const context = await trackingRuntimeStorage.readContext();
  if (context) {
    const obsolete = (await readPendingSamples()).filter((item) =>
      belongsToSession(item, context.serviceId, context.trackingSessionId),
    );
    if (obsolete.length) {
      await appendRejectedSamples(obsolete.map((item) => ({
        serviceId: item.serviceId,
        trackingSessionId: item.trackingSessionId,
        sampleId: item.position.sampleId,
        rejectedAt: new Date().toISOString(),
        reason,
        httpStatus: null,
      })));
      const ids = new Set(obsolete.map((item) => item.position.sampleId));
      await mutatePendingSamples((all) => ({ items: all.filter((item) => !ids.has(item.position.sampleId)), result: undefined }));
    }
  }
  await trackingRuntimeStorage.clearContext();
}
