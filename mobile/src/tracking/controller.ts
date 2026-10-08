import * as Location from "expo-location";
import { AppState, type AppStateStatus } from "react-native";
import { ApiError } from "@/api/client";
import { driverApi } from "@/api/driver";
import { appendPending, clearPendingPositions, readPendingPositions, writePendingPositions, type PendingPosition } from "./queue";

export type TrackingState =
  | "OFF"
  | "REQUESTING_PERMISSION"
  | "LOCATING"
  | "ACTIVE"
  | "LOW_ACCURACY"
  | "OFFLINE"
  | "SYNC_PENDING"
  | "SESSION_EXPIRED"
  | "STOPPED"
  | "ERROR";

export interface TrackingStatus {
  state: TrackingState;
  lastSentAt: string | null;
  lastAccuracy: number | null;
  pendingCount: number;
  message: string | null;
}

type Listener = (status: TrackingStatus) => void;

function sampleId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export class TrackingController {
  private subscription: Location.LocationSubscription | null = null;
  private retryTimer: ReturnType<typeof setInterval> | null = null;
  private pending: PendingPosition[] = [];
  private listeners = new Set<Listener>();
  private status: TrackingStatus = {
    state: "OFF",
    lastSentAt: null,
    lastAccuracy: null,
    pendingCount: 0,
    message: null,
  };
  private remoteActive = false;
  private appStateSubscription: { remove: () => void } | null = null;

  constructor(private readonly token: string, private readonly serviceId: string) {
    this.appStateSubscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if ((nextState === "background" || nextState === "inactive") && this.remoteActive) {
        void this.stop();
      }
    });
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
      this.update({ state: "ERROR", message: "Necesitamos permiso de ubicación para iniciar el seguimiento." });
      return;
    }
    try {
      await driverApi.startTracking(this.token, this.serviceId);
      this.remoteActive = true;
      this.pending = await readPendingPositions();
      this.update({ state: "LOCATING", pendingCount: this.pending.length });
      this.subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 15_000,
          distanceInterval: 100,
          mayShowUserSettingsDialog: true,
        },
        (location) => void this.handleLocation(location),
      );
      this.retryTimer = setInterval(() => void this.flush(), 15_000);
      this.update({ state: "ACTIVE" });
      await this.flush();
    } catch (error) {
      await this.stopLocal();
      this.remoteActive = false;
      if (error instanceof ApiError && error.kind === "UNAUTHORIZED") {
        this.update({ state: "SESSION_EXPIRED", message: "Tu sesión ha caducado. Inicia sesión de nuevo." });
      } else {
        this.update({ state: "ERROR", message: "No se pudo iniciar el seguimiento. Vuelve a intentarlo." });
      }
    }
  }

  private async handleLocation(location: Location.LocationObject) {
    const position: PendingPosition = {
      sampleId: sampleId(),
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy ?? 999,
      heading: location.coords.heading,
      speed: location.coords.speed,
      recordedAt: new Date(location.timestamp).toISOString(),
    };
    this.update({
      state: position.accuracy > 500 ? "LOW_ACCURACY" : "ACTIVE",
      lastAccuracy: position.accuracy,
    });
    this.pending = appendPending(this.pending, position);
    await writePendingPositions(this.pending);
    await this.flush();
  }

  private async flush() {
    if (this.pending.length === 0) {
      this.update({ pendingCount: 0 });
      return;
    }
    while (this.pending.length > 0) {
      const item = this.pending[0]!;
      try {
        await driverApi.sendTrackingPosition(this.token, this.serviceId, item);
        this.pending = this.pending.slice(1);
        await writePendingPositions(this.pending);
        this.update({ lastSentAt: new Date().toISOString(), pendingCount: this.pending.length, state: this.pending.length ? "SYNC_PENDING" : "ACTIVE" });
      } catch (error) {
        if (error instanceof ApiError && error.kind === "UNAUTHORIZED") {
          await this.stopLocal();
          this.remoteActive = false;
          this.update({ state: "SESSION_EXPIRED", message: "Tu sesión ha caducado. Inicia sesión de nuevo." });
        } else {
          this.update({ state: "OFFLINE", pendingCount: this.pending.length, message: "Guardado en cola. Se sincronizará al recuperar la conexión." });
        }
        return;
      }
    }
  }

  async stop() {
    try {
      await this.flush();
      await driverApi.stopTracking(this.token, this.serviceId);
      this.remoteActive = false;
      await clearPendingPositions();
      this.pending = [];
      await this.stopLocal();
      this.update({ state: "STOPPED", pendingCount: 0, message: null });
    } catch {
      this.update({ state: "ERROR", message: "No se pudo detener el seguimiento. Vuelve a intentarlo." });
    }
  }

  async dispose() {
    if (this.remoteActive) {
      try {
        await driverApi.stopTracking(this.token, this.serviceId);
      } catch {
        // The server will reject stale positions once the session expires.
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
