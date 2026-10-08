import * as SecureStore from "expo-secure-store";
import type { TrackingPosition } from "@/types/api";

export type PendingPosition = Omit<
  TrackingPosition,
  "id" | "serviceId" | "driverId" | "receivedAt" | "source"
>;

const STORAGE_KEY = "nexo.driver.tracking.queue.v1";
const MAX_PENDING = 100;

export async function readPendingPositions(): Promise<PendingPosition[]> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as PendingPosition[]).slice(-MAX_PENDING) : [];
  } catch {
    return [];
  }
}

export async function writePendingPositions(items: PendingPosition[]) {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(items.slice(-MAX_PENDING)));
}

export async function clearPendingPositions() {
  await SecureStore.deleteItemAsync(STORAGE_KEY);
}

export function appendPending(items: PendingPosition[], item: PendingPosition) {
  if (items.some((existing) => existing.sampleId === item.sampleId)) return items;
  return [...items, item].slice(-MAX_PENDING);
}
