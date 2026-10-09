import * as Location from "expo-location";
import { AppState, type AppStateStatus } from "react-native";
import { driverApi } from "@/api/driver";
import {
  appendPendingSample,
  appendRejectedSamples,
  archiveLegacySamples,
  belongsToSession,
  readPendingSamples,
  readRejectedSamples,
  writePendingSamples,
  MAX_PENDING,
  type PendingTrackingSample,
} from "./queue";
import {
  classifySyncError,
  drainPendingSamples,
  normalizeOptionalSensorValue,
  retryDelayMs,
  type SyncFailure,
} from "./synchronizer";

export type TrackingState =
  | "OFF"
  | "REQUESTING_PERMISSION"
  | "PERMISSION_DENIED"
  | "LOCATING"
  | "ACTIVE"
  | "LOW_ACCURACY"
  | "OFFLINE"
  | "SYNC_PENDING"
  | "AUTH_ERROR"
  | "AUTHORIZATION_ERROR"
  | "SESSION_EXPIRED"
  | "SAMPLE_REJECTED"
  | "SERVER_UNAVAILABLE"
  | "STOPPED"
  | "ERROR";

export interface TrackingStatus {
  state: TrackingState;
  apiBaseUrl: string;
  trackingSessionId: string | null;
  lastAttemptAt: string | null;
  lastConfirmedAt: string | null;
  lastAccuracy: number | null;
  lastHttpStatus: number | null;
  pendingCount: number;
  rejectedCount: number;
  message: string | null;
}

type Listener = (status: TrackingStatus) => void;

function sampleId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function stateForFailure(failure: SyncFailure): TrackingState {
  if (failure.kind === "AUTHENTICATION") return "AUTH_ERROR";
  if (failure.kind === "AUTHORIZATION") return "AUTHORIZATION_ERROR";
  if (failure.kind === "SESSION_EXPIRED") return "SESSION_EXPIRED";
  if (failure.kind === "PERMANENT") return "SAMPLE_REJECTED";
  return failure.status !== null && failure.status >= 500
    ? "SERVER_UNAVAILABLE"
    : "OFFLINE";
}

export class TrackingController {
  private subscription: Location.LocationSubscription | null = null;
  private retryTimer: ReturnType<typeof setInterval> | null = null;
  private pending: PendingTrackingSample[] = [];
  private allPending: PendingTrackingSample[] = [];
  private listeners = new Set<Listener>();
  private flushPromise: Promise<void> | null = null;
  private consecutiveFailures = 0;
  private retryAfter = 0;
  private sessionId: string | null = null;
  private status: TrackingStatus = {
    state: "OFF",
    apiBaseUrl: process.env.EXPO_PUBLIC_API_URL?.trim() || "Sin configurar",
    trackingSessionId: null,
    lastAttemptAt: null,
    lastConfirmedAt: null,
    lastAccuracy: null,
    lastHttpStatus: null,
    pendingCount: 0,
    rejectedCount: 0,
    message: null,
  };
  private remoteActive = false;
  private appStateSubscription: { remove: () => void } | null = null;

  constructor(private readonly token: string, private readonly serviceId: string) {
    this.appStateSubscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (
          (nextState === "background" || nextState === "inactive") &&
          this.remoteActive
        ) {
          void this.stop();
        }
      },
    );
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  private update(patch: Partial<TrackingStatus>) {
    this.status = { ...this.status, ...patch };
    this.listeners.forEach((listener) => listener(this.status));
  }

  async start() {
    if (this.subscription) return;
    this.update({ state: "REQUESTING_PERMISSION", message: null });
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      this.update({
        state: "PERMISSION_DENIED",
        message: "Permiso de ubicación denegado. Actívalo en Ajustes para compartir el GPS.",
      });
      return;
    }
    try {
      const session = await driverApi.startTracking(this.token, this.serviceId);
      this.sessionId = session.id;
      this.remoteActive = true;
      const legacyCount = await archiveLegacySamples();
      this.allPending = await readPendingSamples();
      const obsolete = this.allPending.filter(
        (item) => !belongsToSession(item, this.serviceId, session.id),
      );
      if (obsolete.length > 0) {
        await appendRejectedSamples(
          obsolete.map((item) => ({
            serviceId: item.serviceId,
            trackingSessionId: item.trackingSessionId,
            sampleId: item.position.sampleId,
            rejectedAt: new Date().toISOString(),
            reason: "SESSION_CHANGED",
            httpStatus: null,
          })),
        );
        this.allPending = this.allPending.filter((item) =>
          belongsToSession(item, this.serviceId, session.id),
        );
        await writePendingSamples(this.allPending);
      }
      this.pending = [...this.allPending];
      const rejectedCount = (await readRejectedSamples()).length;
      this.update({
        state: "LOCATING",
        trackingSessionId: session.id,
        pendingCount: this.pending.length,
        rejectedCount,
        message:
          legacyCount > 0
            ? `${legacyCount} muestras antiguas se conservaron como rechazadas porque no tenían sesión asociada.`
            : null,
      });
      this.subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 15_000,
          distanceInterval: 100,
          mayShowUserSettingsDialog: true,
        },
        (location) => void this.handleLocation(location),
      );
      this.retryTimer = setInterval(() => void this.flush(), 2_000);
      this.update({ state: this.pending.length ? "SYNC_PENDING" : "ACTIVE" });
      await this.flush();
    } catch (error) {
      await this.stopLocal();
      this.remoteActive = false;
      const failure = classifySyncError(error);
      const state = failure.kind === "PERMANENT" ? "ERROR" : stateForFailure(failure);
      this.update({
        state,
        lastHttpStatus: failure.status,
        message: failure.message,
      });
    }
  }

  private async handleLocation(location: Location.LocationObject) {
    if (!this.sessionId) return;
    const position = {
      sampleId: sampleId(),
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy ?? 999,
      heading: normalizeOptionalSensorValue(location.coords.heading),
      speed: normalizeOptionalSensorValue(location.coords.speed),
      recordedAt: new Date(location.timestamp).toISOString(),
    };
    const item: PendingTrackingSample = {
      serviceId: this.serviceId,
      trackingSessionId: this.sessionId,
      queuedAt: new Date().toISOString(),
      attempts: 0,
      position,
    };
    if (this.pending.length >= MAX_PENDING) {
      const overflow = this.pending.shift()!;
      this.allPending = this.allPending.filter(
        (queued) => queued.position.sampleId !== overflow.position.sampleId,
      );
      await appendRejectedSamples([{
        serviceId: overflow.serviceId,
        trackingSessionId: overflow.trackingSessionId,
        sampleId: overflow.position.sampleId,
        rejectedAt: new Date().toISOString(),
        reason: "QUEUE_LIMIT_REACHED",
        httpStatus: null,
      }]);
    }
    this.pending = appendPendingSample(this.pending, item);
    this.allPending = appendPendingSample(this.allPending, item);
    await writePendingSamples(this.allPending);
    this.update({
      state: "SYNC_PENDING",
      lastAccuracy: position.accuracy,
      pendingCount: this.pending.length,
      message: "GPS activo. Esperando confirmación del servidor.",
    });
    await this.flush();
  }

  private flush() {
    if (this.flushPromise) return this.flushPromise;
    this.flushPromise = this.performFlush().finally(() => {
      this.flushPromise = null;
    });
    return this.flushPromise;
  }

  private async performFlush() {
    if (!this.sessionId || this.pending.length === 0) {
      this.update({ pendingCount: this.pending.length });
      return;
    }
    if (Date.now() < this.retryAfter) return;
    const attemptedAt = new Date().toISOString();
    this.update({ lastAttemptAt: attemptedAt });
    const result = await drainPendingSamples(this.pending, async (item) => {
      item.attempts += 1;
      await driverApi.sendTrackingPosition(
        this.token,
        this.serviceId,
        item.position,
      );
    });
    this.pending = result.pending;
    this.allPending = this.allPending.filter((item) =>
      this.pending.some(
        (pending) => pending.position.sampleId === item.position.sampleId,
      ),
    );
    await writePendingSamples(this.allPending);
    if (result.rejected.length > 0) await appendRejectedSamples(result.rejected);

    if (!result.failure) {
      this.consecutiveFailures = 0;
      this.retryAfter = 0;
      this.update({
        state: "ACTIVE",
        lastConfirmedAt:
          result.confirmed > 0 ? new Date().toISOString() : this.status.lastConfirmedAt,
        lastHttpStatus: result.confirmed > 0 ? 200 : this.status.lastHttpStatus,
        pendingCount: 0,
        rejectedCount: (await readRejectedSamples()).length,
        message: "GPS activo y sincronizado con el servidor.",
      });
      return;
    }

    const failure = result.failure;
    if (failure.kind === "TEMPORARY") {
      this.consecutiveFailures += 1;
      this.retryAfter = Date.now() + retryDelayMs(this.consecutiveFailures);
    } else {
      this.consecutiveFailures = 0;
      this.retryAfter = 0;
    }
    if (["AUTHENTICATION", "AUTHORIZATION", "SESSION_EXPIRED"].includes(failure.kind)) {
      await this.stopLocal();
      this.remoteActive = false;
    }
    this.update({
      state: stateForFailure(failure),
      lastHttpStatus: failure.status,
      pendingCount: this.pending.length,
      rejectedCount: (await readRejectedSamples()).length,
      message:
        failure.kind === "TEMPORARY"
          ? `${failure.message} Las muestras permanecen en cola y se reintentará automáticamente.`
          : failure.message,
    });
  }

  async stop() {
    await this.flush();
    if (this.pending.length > 0) {
      this.update({
        state: "SYNC_PENDING",
        message: "Hay muestras pendientes. El seguimiento seguirá activo hasta poder confirmarlas.",
      });
      return;
    }
    try {
      await driverApi.stopTracking(this.token, this.serviceId);
      this.remoteActive = false;
      await this.stopLocal();
      this.update({ state: "STOPPED", pendingCount: 0, message: null });
    } catch (error) {
      this.update({
        state: "ERROR",
        message: error instanceof Error ? error.message : "No se pudo detener el seguimiento.",
      });
    }
  }

  async dispose() {
    await this.flush();
    if (this.remoteActive && this.pending.length === 0) {
      try {
        await driverApi.stopTracking(this.token, this.serviceId);
      } catch {
        // La sesión remota caducará y la próxima apertura reconciliará su estado.
      }
      this.remoteActive = false;
    }
    await this.stopLocal();
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
  }

  private async stopLocal() {
    if (this.retryTimer) clearInterval(this.retryTimer);
    this.retryTimer = null;
    this.subscription?.remove();
    this.subscription = null;
  }
}
