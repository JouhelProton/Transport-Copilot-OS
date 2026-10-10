import Constants from "expo-constants";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { driverApi } from "@/api/driver";
import { BACKGROUND_LOCATION_TASK } from "./background-task";
import { invalidateTrackingContext, queueLocation, syncTrackingQueue } from "./engine";
import { appendRejectedSamples, archiveLegacySamples, belongsToSession, mutatePendingSamples, readPendingSamples, readRejectedSamples } from "./queue";
import { diagnosticsToStatus, trackingRuntimeStorage, type TrackingRuntimeContext } from "./runtime-storage";
import { classifySyncError, retryDelayMs, type SyncFailure } from "./synchronizer";
import { backgroundRecoveryProblem, decideTrackingMode, shouldInvalidateForFailure } from "./lifecycle";

export type TrackingState = "OFF" | "REQUESTING_PERMISSION" | "PERMISSION_DENIED" | "BACKGROUND_UNAVAILABLE" | "LOCATING" | "ACTIVE" | "LOW_ACCURACY" | "OFFLINE" | "SYNC_PENDING" | "STOPPING" | "OTHER_SERVICE_ACTIVE" | "AUTH_ERROR" | "AUTHORIZATION_ERROR" | "SESSION_EXPIRED" | "SAMPLE_REJECTED" | "SERVER_UNAVAILABLE" | "STOPPED" | "ERROR";

export interface TrackingStatus {
  state: TrackingState;
  apiBaseUrl: string;
  trackingSessionId: string | null;
  activeServiceId: string | null;
  mode: TrackingRuntimeContext["mode"] | null;
  lastAttemptAt: string | null;
  lastConfirmedAt: string | null;
  lastCapturedAt: string | null;
  lastAccuracy: number | null;
  lastHttpStatus: number | null;
  pendingCount: number;
  rejectedCount: number;
  message: string | null;
}

type Listener = (status: TrackingStatus) => void;

const initialStatus: TrackingStatus = {
  state: "OFF",
  apiBaseUrl: process.env.EXPO_PUBLIC_API_URL?.trim() || "Sin configurar",
  trackingSessionId: null,
  activeServiceId: null,
  mode: null,
  lastAttemptAt: null,
  lastConfirmedAt: null,
  lastCapturedAt: null,
  lastAccuracy: null,
  lastHttpStatus: null,
  pendingCount: 0,
  rejectedCount: 0,
  message: null,
};

function stateForFailure(failure: SyncFailure): TrackingState {
  if (failure.kind === "AUTHENTICATION") return "AUTH_ERROR";
  if (failure.kind === "AUTHORIZATION") return "AUTHORIZATION_ERROR";
  if (failure.kind === "SESSION_EXPIRED") return "SESSION_EXPIRED";
  if (failure.kind === "PERMANENT") return "SAMPLE_REJECTED";
  return failure.status !== null && failure.status >= 500 ? "SERVER_UNAVAILABLE" : "OFFLINE";
}

export function isExpoGoRuntime() {
  return Constants.appOwnership === "expo" || Constants.expoVersion !== null;
}

export function backgroundLocationOptions(): Location.LocationTaskOptions {
  return {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 30_000,
    distanceInterval: 50,
    deferredUpdatesInterval: 30_000,
    deferredUpdatesDistance: 50,
    activityType: Location.ActivityType.AutomotiveNavigation,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "NEXO Driver · seguimiento activo",
      notificationBody: "Compartiendo la ubicación del servicio que has iniciado.",
      notificationColor: "#3157D5",
      killServiceOnDestroy: true,
    },
  };
}

async function stopNativeLocationTask() {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK))
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  } catch {
    // Expo Go does not register a native background task.
  }
}

export async function stopTrackingBeforeLogout(token: string | null) {
  const context = await trackingRuntimeStorage.readContext();
  await stopNativeLocationTask();
  if (context && token) {
    await syncTrackingQueue(context, token).catch(() => undefined);
    await driverApi.stopTracking(token, context.serviceId).catch(() => undefined);
  }
  await invalidateTrackingContext("LOGOUT");
  await trackingRuntimeStorage.clearDiagnostics();
}

export class TrackingController {
  private listeners = new Set<Listener>();
  private status: TrackingStatus = { ...initialStatus };
  private foregroundSubscription: Location.LocationSubscription | null = null;
  private retryTimer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;
  private consecutiveFailures = 0;
  private retryAfter = 0;
  private tickPromise: Promise<void> | null = null;
  private lastRemoteCheckAt = 0;

  constructor(private readonly token: string, private readonly serviceId: string) {
    void this.restore();
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

  private async restore() {
    const [context, diagnostics, pending, rejected] = await Promise.all([
      trackingRuntimeStorage.readContext(), trackingRuntimeStorage.readDiagnostics(), readPendingSamples(), readRejectedSamples(),
    ]);
    if (this.disposed) return;
    const sessionPending = context ? pending.filter((item) => belongsToSession(item, context.serviceId, context.trackingSessionId)).length : 0;
    this.update(diagnosticsToStatus(context, diagnostics, sessionPending, rejected.length));
    if (!context) return;
    if (context.serviceId !== this.serviceId) {
      this.update({ state: "OTHER_SERVICE_ACTIVE", message: "Ya existe un seguimiento activo para otro servicio. Detén ese seguimiento antes de iniciar uno nuevo." });
      return;
    }
    if (context.mode === "BACKGROUND") {
      const permission = await Location.getBackgroundPermissionsAsync();
      const registered = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => false);
      const recoveryProblem = backgroundRecoveryProblem({
        mode: context.mode,
        permissionGranted: permission.status === "granted",
        taskRegistered: registered,
      });
      if (recoveryProblem === "BACKGROUND_PERMISSION_REVOKED") {
        await stopNativeLocationTask();
        await driverApi.stopTracking(this.token, context.serviceId).catch(() => undefined);
        await invalidateTrackingContext(recoveryProblem);
        this.update({ state: "PERMISSION_DENIED", trackingSessionId: null, message: "El permiso de ubicación en segundo plano fue revocado. El seguimiento se ha detenido." });
        return;
      }
      if (recoveryProblem === "NATIVE_TASK_INTERRUPTED") {
        await driverApi.stopTracking(this.token, context.serviceId).catch(() => undefined);
        await invalidateTrackingContext(recoveryProblem);
        this.update({ state: "BACKGROUND_UNAVAILABLE", trackingSessionId: null, message: "La tarea de ubicación ya no estaba activa. Inicia el seguimiento de nuevo." });
        return;
      }
    }
    if (!await this.reconcileRemote(context)) return;
    if (context.mode === "FOREGROUND_EXPO_GO" && !context.stopRequestedAt) await this.startForegroundWatch(context);
    this.startRetryLoop();
    await this.tick();
  }

  async start() {
    const existing = await trackingRuntimeStorage.readContext();
    if (existing) {
      if (existing.serviceId !== this.serviceId) {
        this.update({ state: "OTHER_SERVICE_ACTIVE", activeServiceId: existing.serviceId, message: "Detén primero el seguimiento del otro servicio." });
        return;
      }
      await this.restore();
      return;
    }
    this.update({ state: "REQUESTING_PERMISSION", message: "El seguimiento solo se activa para este servicio y puedes detenerlo en cualquier momento." });
    const foregroundPermission = await Location.requestForegroundPermissionsAsync();
    if (foregroundPermission.status !== "granted") {
      this.update({ state: "PERMISSION_DENIED", message: "Permite la ubicación mientras usas la app para iniciar el seguimiento." });
      return;
    }
    const expoGo = isExpoGoRuntime();
    const taskManagerAvailable = expoGo ? false : await TaskManager.isAvailableAsync();
    const backgroundPermission = expoGo || !taskManagerAvailable
      ? null
      : await Location.requestBackgroundPermissionsAsync();
    const modeDecision = decideTrackingMode({
      expoGo,
      taskManagerAvailable,
      backgroundPermissionGranted: backgroundPermission?.status === "granted",
    });
    if (!modeDecision.mode) {
      if (modeDecision.reason === "BACKGROUND_UNAVAILABLE") {
        this.update({ state: "BACKGROUND_UNAVAILABLE", message: "Esta instalación no incluye la capacidad nativa de seguimiento en segundo plano." });
        return;
      }
      this.update({ state: "PERMISSION_DENIED", message: "Para continuar con la pantalla bloqueada, selecciona «Siempre» en el permiso de ubicación." });
      return;
    }
    try {
      const session = await driverApi.startTracking(this.token, this.serviceId);
      await this.archiveObsoleteSamples(session.id);
      const context: TrackingRuntimeContext = {
        serviceId: this.serviceId,
        trackingSessionId: session.id,
        startedAt: session.startedAt,
        mode: modeDecision.mode,
        stopRequestedAt: null,
      };
      await trackingRuntimeStorage.writeContext(context);
      await trackingRuntimeStorage.writeDiagnostics({
        state: "LOCATING", lastAttemptAt: null, lastConfirmedAt: null, lastCapturedAt: null,
        lastAccuracy: null, lastHttpStatus: 201,
        message: expoGo ? "Expo Go: seguimiento de prueba solo mientras NEXO Driver permanece visible." : "Seguimiento en segundo plano activo para este servicio.",
      });
      if (modeDecision.mode === "FOREGROUND_EXPO_GO") await this.startForegroundWatch(context);
      else await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, backgroundLocationOptions());
      this.update({
        state: "ACTIVE", trackingSessionId: session.id, activeServiceId: this.serviceId, mode: context.mode,
        message: expoGo ? "Modo Expo Go: mantén la app abierta para enviar posiciones." : "GPS activo en segundo plano. iOS mostrará el indicador de ubicación.",
      });
      this.startRetryLoop();
    } catch (error) {
      await stopNativeLocationTask();
      await trackingRuntimeStorage.clearContext();
      const failure = classifySyncError(error);
      this.update({ state: stateForFailure(failure), lastHttpStatus: failure.status, message: failure.message });
    }
  }

  private async archiveObsoleteSamples(sessionId: string) {
    await archiveLegacySamples();
    const all = await readPendingSamples();
    const obsolete = all.filter((item) => !belongsToSession(item, this.serviceId, sessionId));
    if (!obsolete.length) return;
    await appendRejectedSamples(obsolete.map((item) => ({
      serviceId: item.serviceId, trackingSessionId: item.trackingSessionId, sampleId: item.position.sampleId,
      rejectedAt: new Date().toISOString(), reason: "SESSION_CHANGED", httpStatus: null,
    })));
    const ids = new Set(obsolete.map((item) => item.position.sampleId));
    await mutatePendingSamples((items) => ({ items: items.filter((item) => !ids.has(item.position.sampleId)), result: undefined }));
  }

  private async startForegroundWatch(context: TrackingRuntimeContext) {
    if (this.foregroundSubscription || this.disposed) return;
    this.foregroundSubscription = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 15_000, distanceInterval: 100, mayShowUserSettingsDialog: true },
      (location) => void this.captureForeground(location, context),
    );
  }

  private async captureForeground(location: Location.LocationObject, context: TrackingRuntimeContext) {
    const sample = await queueLocation(location, context);
    if (!sample) return;
    await trackingRuntimeStorage.writeDiagnostics({
      state: "SYNC_PENDING", lastAttemptAt: this.status.lastAttemptAt, lastConfirmedAt: this.status.lastConfirmedAt,
      lastCapturedAt: sample.position.recordedAt, lastAccuracy: sample.position.accuracy,
      lastHttpStatus: this.status.lastHttpStatus, message: "GPS activo. Esperando confirmación del servidor.",
    });
    await this.tick();
  }

  private startRetryLoop() {
    if (!this.retryTimer) this.retryTimer = setInterval(() => void this.tick(), 3_000);
  }

  private tick() {
    if (this.tickPromise) return this.tickPromise;
    this.tickPromise = this.performTick().finally(() => { this.tickPromise = null; });
    return this.tickPromise;
  }

  private async performTick() {
    const context = await trackingRuntimeStorage.readContext();
    if (!context || context.serviceId !== this.serviceId || Date.now() < this.retryAfter) return;
    if (Date.now() - this.lastRemoteCheckAt > 60_000 && !await this.reconcileRemote(context)) return;
    const attemptedAt = new Date().toISOString();
    const result = await syncTrackingQueue(context, this.token);
    const [pending, rejected, previous] = await Promise.all([readPendingSamples(), readRejectedSamples(), trackingRuntimeStorage.readDiagnostics()]);
    const pendingCount = pending.filter((item) => belongsToSession(item, context.serviceId, context.trackingSessionId)).length;
    if (result.failure) {
      const failure = result.failure;
      if (failure.kind === "TEMPORARY") {
        this.consecutiveFailures += 1;
        this.retryAfter = Date.now() + retryDelayMs(this.consecutiveFailures);
      } else if (shouldInvalidateForFailure(failure.kind)) {
        await stopNativeLocationTask();
        this.foregroundSubscription?.remove();
        this.foregroundSubscription = null;
        await invalidateTrackingContext(failure.kind);
      }
      const diagnostics = {
        state: stateForFailure(failure), lastAttemptAt: attemptedAt, lastConfirmedAt: previous?.lastConfirmedAt ?? null,
        lastCapturedAt: previous?.lastCapturedAt ?? null, lastAccuracy: previous?.lastAccuracy ?? null,
        lastHttpStatus: failure.status,
        message: failure.kind === "TEMPORARY" ? `${failure.message} Las posiciones permanecen en cola.` : failure.message,
      };
      await trackingRuntimeStorage.writeDiagnostics(diagnostics);
      this.update({ ...diagnostics, pendingCount, rejectedCount: rejected.length });
      return;
    }
    this.consecutiveFailures = 0;
    this.retryAfter = 0;
    if (context.stopRequestedAt && pendingCount === 0) {
      await driverApi.stopTracking(this.token, context.serviceId);
      await trackingRuntimeStorage.clearContext();
      await trackingRuntimeStorage.clearDiagnostics();
      this.update({ ...initialStatus, state: "STOPPED", message: "Seguimiento detenido y sesión cerrada en el servidor." });
      return;
    }
    const diagnostics = {
      state: pendingCount ? "SYNC_PENDING" as const : "ACTIVE" as const,
      lastAttemptAt: attemptedAt,
      lastConfirmedAt: result.confirmed ? new Date().toISOString() : previous?.lastConfirmedAt ?? null,
      lastCapturedAt: previous?.lastCapturedAt ?? null,
      lastAccuracy: previous?.lastAccuracy ?? null,
      lastHttpStatus: result.confirmed ? 200 : previous?.lastHttpStatus ?? null,
      message: pendingCount ? "GPS activo. Hay posiciones pendientes de sincronizar." : context.mode === "BACKGROUND" ? "GPS activo en segundo plano y sincronizado." : "GPS activo en primer plano y sincronizado.",
    };
    await trackingRuntimeStorage.writeDiagnostics(diagnostics);
    this.update({ ...diagnostics, pendingCount, rejectedCount: rejected.length });
  }

  private async reconcileRemote(context: TrackingRuntimeContext) {
    try {
      const remote = await driverApi.tracking(this.token, context.serviceId);
      this.lastRemoteCheckAt = Date.now();
      if (remote.session?.status === "ACTIVE" && remote.session.id === context.trackingSessionId) return true;
      await stopNativeLocationTask();
      this.foregroundSubscription?.remove();
      this.foregroundSubscription = null;
      await invalidateTrackingContext("REMOTE_SESSION_ENDED");
      this.update({ state: "SESSION_EXPIRED", trackingSessionId: null, message: "El backend confirmó que este seguimiento ya no está autorizado." });
      return false;
    } catch (error) {
      const failure = classifySyncError(error);
      if (shouldInvalidateForFailure(failure.kind)) {
        await stopNativeLocationTask();
        this.foregroundSubscription?.remove();
        this.foregroundSubscription = null;
        await invalidateTrackingContext(failure.kind);
        this.update({ state: stateForFailure(failure), trackingSessionId: null, message: failure.message });
        return false;
      }
      // A temporary outage must not discard the authorized local session or its queue.
      return true;
    }
  }

  async stop() {
    const context = await trackingRuntimeStorage.readContext();
    if (!context || context.serviceId !== this.serviceId) return;
    await trackingRuntimeStorage.writeContext({ ...context, stopRequestedAt: new Date().toISOString() });
    await stopNativeLocationTask();
    this.foregroundSubscription?.remove();
    this.foregroundSubscription = null;
    this.update({ state: "STOPPING", message: "Captura detenida. Cerrando la cola y la sesión del servidor." });
    await this.tick();
  }

  async dispose() {
    this.disposed = true;
    if (this.retryTimer) clearInterval(this.retryTimer);
    this.retryTimer = null;
    this.foregroundSubscription?.remove();
    this.foregroundSubscription = null;
    this.listeners.clear();
  }
}
