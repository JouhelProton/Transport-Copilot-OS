import * as SecureStore from "expo-secure-store";
import type { TrackingPosition } from "@/types/api";

export type PendingPosition = Omit<
  TrackingPosition,
  "id" | "serviceId" | "driverId" | "receivedAt" | "source"
>;

export interface PendingTrackingSample {
  serviceId: string;
  trackingSessionId: string;
  queuedAt: string;
  attempts: number;
  position: PendingPosition;
}

export interface RejectedTrackingSample {
  serviceId: string | null;
  trackingSessionId: string | null;
  sampleId: string;
  rejectedAt: string;
  reason: string;
  httpStatus: number | null;
}

const STORAGE_KEY = "nexo.driver.tracking.queue.v2";
const REJECTED_KEY = "nexo.driver.tracking.rejected.v1";
const LEGACY_STORAGE_KEY = "nexo.driver.tracking.queue.v1";
export const MAX_PENDING = 100;
export const MAX_REJECTED = 50;
let mutationChain: Promise<void> = Promise.resolve();

function secureOptions() {
  return { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
}

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = mutationChain.then(operation, operation);
  mutationChain = result.then(() => undefined, () => undefined);
  return result;
}

async function readArray<T>(key: string): Promise<T[]> {
  try {
    const raw = await SecureStore.getItemAsync(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export async function readPendingSamples(): Promise<PendingTrackingSample[]> {
  return (await readArray<PendingTrackingSample>(STORAGE_KEY)).slice(-MAX_PENDING);
}

export async function writePendingSamples(items: PendingTrackingSample[]) {
  await serialize(() => SecureStore.setItemAsync(
    STORAGE_KEY,
    JSON.stringify(items.slice(-MAX_PENDING)),
    secureOptions(),
  ));
}

export function mutatePendingSamples<T>(
  mutation: (items: PendingTrackingSample[]) => { items: PendingTrackingSample[]; result: T },
) {
  return serialize(async () => {
    const current = (await readArray<PendingTrackingSample>(STORAGE_KEY)).slice(-MAX_PENDING);
    const next = mutation(current);
    await SecureStore.setItemAsync(
      STORAGE_KEY,
      JSON.stringify(next.items.slice(-MAX_PENDING)),
      secureOptions(),
    );
    return next.result;
  });
}

export async function readRejectedSamples(): Promise<RejectedTrackingSample[]> {
  return (await readArray<RejectedTrackingSample>(REJECTED_KEY)).slice(-MAX_REJECTED);
}

export async function appendRejectedSamples(items: RejectedTrackingSample[]) {
  const existing = await readRejectedSamples();
  await serialize(() => SecureStore.setItemAsync(
    REJECTED_KEY,
    JSON.stringify([...existing, ...items].slice(-MAX_REJECTED)),
    secureOptions(),
  ));
}

export function enqueuePendingSample(item: PendingTrackingSample) {
  return mutatePendingSamples((items) => {
    if (items.some((existing) => existing.position.sampleId === item.position.sampleId))
      return { items, result: null };
    const combined = [...items, item];
    const dropped = combined.length > MAX_PENDING ? combined[0]! : null;
    return { items: combined.slice(-MAX_PENDING), result: dropped };
  });
}

export async function archiveLegacySamples() {
  const legacy = await readArray<PendingPosition>(LEGACY_STORAGE_KEY);
  if (legacy.length === 0) return 0;
  await appendRejectedSamples(
    legacy.map((position) => ({
      serviceId: null,
      trackingSessionId: null,
      sampleId: position.sampleId,
      rejectedAt: new Date().toISOString(),
      reason: "LEGACY_CONTEXT_UNKNOWN",
      httpStatus: null,
    })),
  );
  await SecureStore.deleteItemAsync(LEGACY_STORAGE_KEY);
  return legacy.length;
}

export function appendPendingSample(
  items: PendingTrackingSample[],
  item: PendingTrackingSample,
) {
  if (items.some((existing) => existing.position.sampleId === item.position.sampleId))
    return items;
  return [...items, item].slice(-MAX_PENDING);
}

export function belongsToSession(
  item: PendingTrackingSample,
  serviceId: string,
  trackingSessionId: string,
) {
  return item.serviceId === serviceId && item.trackingSessionId === trackingSessionId;
}
