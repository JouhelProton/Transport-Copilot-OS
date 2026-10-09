import { ApiError } from "@/api/client";
import type {
  PendingTrackingSample,
  RejectedTrackingSample,
} from "./queue";

export type SyncFailureKind =
  | "TEMPORARY"
  | "AUTHENTICATION"
  | "AUTHORIZATION"
  | "SESSION_EXPIRED"
  | "PERMANENT";

export interface SyncFailure {
  kind: SyncFailureKind;
  message: string;
  status: number | null;
  code: string | null;
}

export interface DrainResult {
  pending: PendingTrackingSample[];
  rejected: RejectedTrackingSample[];
  confirmed: number;
  failure: SyncFailure | null;
}

export function normalizeOptionalSensorValue(value: number | null) {
  return value === null || !Number.isFinite(value) || value < 0 ? null : value;
}

export function classifySyncError(error: unknown): SyncFailure {
  if (!(error instanceof ApiError)) {
    return { kind: "TEMPORARY", message: "Error temporal de sincronización.", status: null, code: null };
  }
  if (error.status === 401)
    return { kind: "AUTHENTICATION", message: "La sesión del conductor ha caducado.", status: 401, code: error.code ?? null };
  if (error.status === 403)
    return { kind: "AUTHORIZATION", message: "El conductor no está autorizado para este servicio.", status: 403, code: error.code ?? null };
  if (error.status === 409 && ["TRACKING_NOT_ACTIVE", "TRACKING_ALREADY_ACTIVE"].includes(error.code ?? ""))
    return { kind: "SESSION_EXPIRED", message: "La sesión de seguimiento ya no está activa.", status: 409, code: error.code ?? null };
  if (error.kind === "NETWORK" || error.kind === "TIMEOUT" || error.kind === "SERVER" || (error.status !== undefined && error.status >= 500))
    return { kind: "TEMPORARY", message: error.message, status: error.status ?? null, code: error.code ?? null };
  return { kind: "PERMANENT", message: error.message, status: error.status ?? null, code: error.code ?? null };
}

export function retryDelayMs(failures: number) {
  return Math.min(30_000, 2_000 * 2 ** Math.max(0, failures - 1));
}

export async function drainPendingSamples(
  items: PendingTrackingSample[],
  send: (item: PendingTrackingSample) => Promise<unknown>,
): Promise<DrainResult> {
  const pending = [...items];
  const rejected: RejectedTrackingSample[] = [];
  let confirmed = 0;
  let permanentFailure: SyncFailure | null = null;
  while (pending.length > 0) {
    const item = pending[0]!;
    try {
      await send(item);
      pending.shift();
      confirmed += 1;
    } catch (error) {
      const failure = classifySyncError(error);
      if (failure.kind !== "PERMANENT") return { pending, rejected, confirmed, failure };
      permanentFailure = failure;
      pending.shift();
      rejected.push({
        serviceId: item.serviceId,
        trackingSessionId: item.trackingSessionId,
        sampleId: item.position.sampleId,
        rejectedAt: new Date().toISOString(),
        reason: failure.code ?? "SAMPLE_REJECTED",
        httpStatus: failure.status,
      });
    }
  }
  return { pending, rejected, confirmed, failure: permanentFailure };
}
