import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { queueLocation, syncTrackingQueue, invalidateTrackingContext } from "./engine";
import { readPendingSamples } from "./queue";
import { trackingRuntimeStorage } from "./runtime-storage";

export const BACKGROUND_LOCATION_TASK = "nexo-driver-background-location-v1";

type LocationTaskData = { locations?: Location.LocationObject[] };

async function executeLocationTask(locations: Location.LocationObject[]) {
  const context = await trackingRuntimeStorage.readContext();
  if (!context || context.stopRequestedAt) return;
  const ordered = [...locations].sort((left, right) => left.timestamp - right.timestamp);
  for (const location of ordered) await queueLocation(location, context);
  const last = ordered.at(-1);
  const attemptedAt = new Date().toISOString();
  const previous = await trackingRuntimeStorage.readDiagnostics();
  const result = await syncTrackingQueue(context);
  const failure = result.failure;
  const pending = (await readPendingSamples()).filter((item) => item.trackingSessionId === context.trackingSessionId).length;
  if (failure && ["AUTHENTICATION", "AUTHORIZATION", "SESSION_EXPIRED"].includes(failure.kind)) {
    if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK))
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    await invalidateTrackingContext(failure.kind);
  }
  await trackingRuntimeStorage.writeDiagnostics({
    state: failure ? (failure.kind === "AUTHENTICATION" ? "AUTH_ERROR" : failure.kind === "AUTHORIZATION" ? "AUTHORIZATION_ERROR" : failure.kind === "SESSION_EXPIRED" ? "SESSION_EXPIRED" : failure.kind === "PERMANENT" ? "SAMPLE_REJECTED" : "OFFLINE") : pending ? "SYNC_PENDING" : "ACTIVE",
    lastAttemptAt: attemptedAt,
    lastConfirmedAt: result.confirmed ? new Date().toISOString() : previous?.lastConfirmedAt ?? null,
    lastCapturedAt: last ? new Date(last.timestamp).toISOString() : null,
    lastAccuracy: last?.coords.accuracy ?? null,
    lastHttpStatus: failure?.status ?? (result.confirmed ? 200 : null),
    message: failure?.message ?? (pending ? "GPS activo. Hay posiciones pendientes de sincronizar." : "GPS activo en segundo plano y sincronizado."),
  });
}

if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
  TaskManager.defineTask<LocationTaskData>(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      const current = await trackingRuntimeStorage.readDiagnostics();
      await trackingRuntimeStorage.writeDiagnostics({
        state: "ERROR",
        lastAttemptAt: new Date().toISOString(),
        lastConfirmedAt: current?.lastConfirmedAt ?? null,
        lastCapturedAt: current?.lastCapturedAt ?? null,
        lastAccuracy: current?.lastAccuracy ?? null,
        lastHttpStatus: null,
        message: "iOS no pudo entregar una actualización de ubicación.",
      });
      return;
    }
    await executeLocationTask(data?.locations ?? []);
  });
}

export { executeLocationTask };
