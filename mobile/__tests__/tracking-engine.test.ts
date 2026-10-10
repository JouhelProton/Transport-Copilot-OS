const mockSecureValues = new Map<string, string>();

jest.mock("expo-secure-store", () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
  getItemAsync: jest.fn(async (key: string) => mockSecureValues.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => { mockSecureValues.set(key, value); }),
  deleteItemAsync: jest.fn(async (key: string) => { mockSecureValues.delete(key); }),
}));
jest.mock("@/auth/storage", () => ({ authStorage: { get: jest.fn(async () => "opaque-token") } }));
jest.mock("@/api/driver", () => ({ driverApi: { sendTrackingPosition: jest.fn() } }));

import { ApiError } from "@/api/client";
import { driverApi } from "@/api/driver";
import { createPendingSample, isUsableLocation, queueLocation, syncTrackingQueue } from "@/tracking/engine";
import { enqueuePendingSample, MAX_PENDING, readPendingSamples } from "@/tracking/queue";
import type { TrackingRuntimeContext } from "@/tracking/runtime-storage";

const mockSendTrackingPosition = driverApi.sendTrackingPosition as jest.Mock;

const context: TrackingRuntimeContext = {
  serviceId: "svc-1",
  trackingSessionId: "track-1",
  startedAt: "2026-10-10T08:00:00.000Z",
  mode: "BACKGROUND",
  stopRequestedAt: null,
};

function location(timestamp = Date.parse("2026-10-10T08:01:00.000Z")) {
  return {
    timestamp,
    coords: { latitude: 39.47, longitude: -0.37, accuracy: 12, altitude: null, altitudeAccuracy: null, heading: -1, speed: -1 },
  };
}

beforeEach(() => {
  mockSecureValues.clear();
  mockSendTrackingPosition.mockReset();
});

describe("background tracking engine", () => {
  test("keeps captured time distinct from queue time", () => {
    const sample = createPendingSample(location(), context, () => 0.25);
    expect(sample.position.recordedAt).toBe("2026-10-10T08:01:00.000Z");
    expect(sample.queuedAt).not.toBe("");
  });

  test("normalizes unavailable heading and speed", () => {
    const sample = createPendingSample(location(), context, () => 0.25);
    expect(sample.position.heading).toBeNull();
    expect(sample.position.speed).toBeNull();
  });

  test("rejects malformed coordinates before persistence", () => {
    expect(isUsableLocation({ ...location(), coords: { ...location().coords, latitude: 91 } })).toBe(false);
  });

  test("persists a location with service and session context", async () => {
    await queueLocation(location(), context);
    expect(await readPendingSamples()).toEqual([
      expect.objectContaining({ serviceId: "svc-1", trackingSessionId: "track-1" }),
    ]);
  });

  test("deduplicates repeated sample ids", async () => {
    const sample = createPendingSample(location(), context, () => 0.25);
    await enqueuePendingSample(sample);
    await enqueuePendingSample(sample);
    expect(await readPendingSamples()).toHaveLength(1);
  });

  test("bounds the offline queue", async () => {
    for (let index = 0; index < MAX_PENDING + 3; index += 1) {
      await enqueuePendingSample(createPendingSample(location(Date.now() + index), context, () => index / 1000));
    }
    expect(await readPendingSamples()).toHaveLength(MAX_PENDING);
  });

  test("removes confirmed samples only after the backend accepts them", async () => {
    await queueLocation(location(), context);
    expect(await readPendingSamples()).toEqual([expect.objectContaining({ serviceId: "svc-1", trackingSessionId: "track-1" })]);
    mockSendTrackingPosition.mockResolvedValue({ accepted: true });
    const result = await syncTrackingQueue(context, "opaque-token");
    expect(result.confirmed).toBe(1);
    expect(await readPendingSamples()).toHaveLength(0);
  });

  test("keeps samples through a temporary network outage", async () => {
    await queueLocation(location(), context);
    mockSendTrackingPosition.mockRejectedValue(new ApiError("offline", "NETWORK"));
    const result = await syncTrackingQueue(context, "opaque-token");
    expect(result.failure?.kind).toBe("TEMPORARY");
    expect(await readPendingSamples()).toHaveLength(1);
  });

  test("does not send samples belonging to another service or session", async () => {
    await queueLocation(location(), { ...context, serviceId: "svc-2", trackingSessionId: "track-2" });
    mockSendTrackingPosition.mockResolvedValue({ accepted: true });
    await syncTrackingQueue(context, "opaque-token");
    expect(mockSendTrackingPosition).not.toHaveBeenCalled();
    expect(await readPendingSamples()).toHaveLength(1);
  });

  test("preserves the original sample id on retry", async () => {
    await queueLocation(location(), context);
    const id = (await readPendingSamples())[0]!.position.sampleId;
    expect(id).toBeTruthy();
    mockSendTrackingPosition.mockRejectedValueOnce(new ApiError("offline", "NETWORK")).mockResolvedValueOnce({ accepted: true });
    await syncTrackingQueue(context, "opaque-token");
    await syncTrackingQueue(context, "opaque-token");
    expect(mockSendTrackingPosition.mock.calls[0]?.[2].sampleId).toBe(id);
    expect(mockSendTrackingPosition.mock.calls[1]?.[2].sampleId).toBe(id);
  });
});
