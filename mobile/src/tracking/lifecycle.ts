import type { SyncFailureKind } from "./synchronizer";

export type TrackingModeDecision =
  | { mode: "FOREGROUND_EXPO_GO"; reason: null }
  | { mode: "BACKGROUND"; reason: null }
  | { mode: null; reason: "BACKGROUND_UNAVAILABLE" | "PERMISSION_DENIED" };

export function decideTrackingMode(input: {
  expoGo: boolean;
  taskManagerAvailable: boolean;
  backgroundPermissionGranted: boolean;
}): TrackingModeDecision {
  if (input.expoGo) return { mode: "FOREGROUND_EXPO_GO", reason: null };
  if (!input.taskManagerAvailable) return { mode: null, reason: "BACKGROUND_UNAVAILABLE" };
  if (!input.backgroundPermissionGranted) return { mode: null, reason: "PERMISSION_DENIED" };
  return { mode: "BACKGROUND", reason: null };
}

export function backgroundRecoveryProblem(input: {
  mode: "BACKGROUND" | "FOREGROUND_EXPO_GO";
  permissionGranted: boolean;
  taskRegistered: boolean;
}) {
  if (input.mode !== "BACKGROUND") return null;
  if (!input.permissionGranted) return "BACKGROUND_PERMISSION_REVOKED" as const;
  if (!input.taskRegistered) return "NATIVE_TASK_INTERRUPTED" as const;
  return null;
}

export function shouldInvalidateForFailure(kind: SyncFailureKind) {
  return kind === "AUTHENTICATION" || kind === "AUTHORIZATION" || kind === "SESSION_EXPIRED";
}
