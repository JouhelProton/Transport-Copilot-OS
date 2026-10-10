import * as SecureStore from "expo-secure-store";
import type { TrackingState, TrackingStatus } from "./controller";

const CONTEXT_KEY = "nexo.driver.tracking.context.v1";
const DIAGNOSTICS_KEY = "nexo.driver.tracking.diagnostics.v1";

export interface TrackingRuntimeContext {
  serviceId: string;
  trackingSessionId: string;
  startedAt: string;
  mode: "BACKGROUND" | "FOREGROUND_EXPO_GO";
  stopRequestedAt: string | null;
}

export interface TrackingDiagnostics {
  state: TrackingState;
  lastAttemptAt: string | null;
  lastConfirmedAt: string | null;
  lastCapturedAt: string | null;
  lastAccuracy: number | null;
  lastHttpStatus: number | null;
  message: string | null;
}

const access = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await SecureStore.getItemAsync(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

export const trackingRuntimeStorage = {
  readContext: () => readJson<TrackingRuntimeContext>(CONTEXT_KEY),
  writeContext: (context: TrackingRuntimeContext) =>
    SecureStore.setItemAsync(CONTEXT_KEY, JSON.stringify(context), access),
  clearContext: () => SecureStore.deleteItemAsync(CONTEXT_KEY),
  readDiagnostics: () => readJson<TrackingDiagnostics>(DIAGNOSTICS_KEY),
  writeDiagnostics: (diagnostics: TrackingDiagnostics) =>
    SecureStore.setItemAsync(DIAGNOSTICS_KEY, JSON.stringify(diagnostics), access),
  clearDiagnostics: () => SecureStore.deleteItemAsync(DIAGNOSTICS_KEY),
};

export function diagnosticsToStatus(
  context: TrackingRuntimeContext | null,
  diagnostics: TrackingDiagnostics | null,
  pendingCount: number,
  rejectedCount: number,
): Partial<TrackingStatus> {
  return {
    state: diagnostics?.state ?? (context ? "SYNC_PENDING" : "OFF"),
    trackingSessionId: context?.trackingSessionId ?? null,
    lastAttemptAt: diagnostics?.lastAttemptAt ?? null,
    lastConfirmedAt: diagnostics?.lastConfirmedAt ?? null,
    lastCapturedAt: diagnostics?.lastCapturedAt ?? null,
    lastAccuracy: diagnostics?.lastAccuracy ?? null,
    lastHttpStatus: diagnostics?.lastHttpStatus ?? null,
    pendingCount,
    rejectedCount,
    mode: context?.mode ?? null,
    activeServiceId: context?.serviceId ?? null,
    message: diagnostics?.message ?? null,
  };
}
