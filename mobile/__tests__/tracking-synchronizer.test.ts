import { ApiError } from "@/api/client";
import type { PendingTrackingSample } from "@/tracking/queue";
import {
  drainPendingSamples,
  normalizeOptionalSensorValue,
  retryDelayMs,
} from "@/tracking/synchronizer";
import { belongsToSession } from "@/tracking/queue";

function sample(sampleId = "sample-1"): PendingTrackingSample {
  return {
    serviceId: "service-1",
    trackingSessionId: "tracking-1",
    queuedAt: "2026-10-08T15:00:00.000Z",
    attempts: 0,
    position: {
      sampleId,
      latitude: 39.47,
      longitude: -0.37,
      accuracy: 18,
      heading: null,
      speed: null,
      recordedAt: "2026-10-08T15:00:00.000Z",
    },
  };
}

describe("tracking synchronizer", () => {
  test("normalizes unavailable iOS heading and speed sentinels", () => {
    expect(normalizeOptionalSensorValue(-1)).toBeNull();
    expect(normalizeOptionalSensorValue(null)).toBeNull();
    expect(normalizeOptionalSensorValue(12.5)).toBe(12.5);
  });

  test("removes a sample only after server confirmation", async () => {
    const send = jest.fn(async (_item: PendingTrackingSample) => ({ accepted: true }));
    const result = await drainPendingSamples([sample()], send);
    expect(result.pending).toHaveLength(0);
    expect(result.confirmed).toBe(1);
    expect(send.mock.calls[0]?.[0].position.sampleId).toBe("sample-1");
  });

  test("keeps the same sample after a temporary network failure and succeeds on retry", async () => {
    const original = sample();
    const failed = await drainPendingSamples(
      [original],
      async () => { throw new ApiError("Sin red", "NETWORK"); },
    );
    expect(failed.pending[0]?.position.sampleId).toBe("sample-1");
    expect(failed.failure?.kind).toBe("TEMPORARY");
    const retried = await drainPendingSamples(failed.pending, async () => ({ accepted: true }));
    expect(retried.pending).toHaveLength(0);
    expect(retried.confirmed).toBe(1);
  });

  test("archives a permanently rejected sample instead of retrying forever", async () => {
    const result = await drainPendingSamples(
      [sample()],
      async () => { throw new ApiError("La petición no es válida", "REQUEST", 400, "VALIDATION_ERROR"); },
    );
    expect(result.pending).toHaveLength(0);
    expect(result.rejected).toEqual([
      expect.objectContaining({ sampleId: "sample-1", reason: "VALIDATION_ERROR", httpStatus: 400 }),
    ]);
    expect(result.failure?.kind).toBe("PERMANENT");
  });

  test("retains a sample when the tracking session has expired", async () => {
    const result = await drainPendingSamples(
      [sample()],
      async () => { throw new ApiError("Inicia seguimiento", "REQUEST", 409, "TRACKING_NOT_ACTIVE"); },
    );
    expect(result.pending).toHaveLength(1);
    expect(result.failure?.kind).toBe("SESSION_EXPIRED");
  });

  test("does not mix samples between services or sessions", () => {
    const item = sample();
    expect(belongsToSession(item, "service-1", "tracking-1")).toBe(true);
    expect(belongsToSession(item, "service-2", "tracking-1")).toBe(false);
    expect(belongsToSession(item, "service-1", "tracking-2")).toBe(false);
  });

  test("uses bounded exponential backoff", () => {
    expect(retryDelayMs(1)).toBe(2_000);
    expect(retryDelayMs(2)).toBe(4_000);
    expect(retryDelayMs(99)).toBe(30_000);
  });
});
