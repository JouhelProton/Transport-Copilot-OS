import { describe, expect, it } from "vitest";
import { nextVehicleHeading, trackingMapStatus } from "@/components/transportista/LiveTrackingMap";
import type { ApiTrackingPosition, ApiTrackingSession } from "@/lib/api/operations";

const position = (recordedAt: string, heading: number | null = null): ApiTrackingPosition => ({ id: "p", serviceId: "s", driverId: "d", latitude: 40, longitude: -3, accuracy: 8, heading, speed: 10, recordedAt, receivedAt: recordedAt, source: "MOBILE_GPS", sampleId: "sample" });
const session = (status: ApiTrackingSession["status"]): ApiTrackingSession => ({ id: "t", serviceId: "s", driverId: "d", status, startedAt: "2026-01-01T00:00:00Z", stoppedAt: null, stopReason: null });

describe("NEXO truck marker", () => {
  it("distinguishes missing, live, stale and stopped tracking", () => {
    const now = new Date("2026-10-09T12:00:00Z").getTime();
    expect(trackingMapStatus(null, session("ACTIVE"), now).tone).toBe("none");
    expect(trackingMapStatus(position("2026-10-09T11:59:30Z"), session("ACTIVE"), now).tone).toBe("live");
    expect(trackingMapStatus(position("2026-10-09T11:57:00Z"), session("ACTIVE"), now).tone).toBe("stale");
    expect(trackingMapStatus(position("2026-10-09T11:59:30Z"), session("STOPPED"), now).tone).toBe("stopped");
  });

  it("keeps the last heading when absent and smooths wrap-around", () => {
    expect(nextVehicleHeading(82, null)).toBe(82);
    expect(nextVehicleHeading(null, null)).toBe(0);
    expect(nextVehicleHeading(350, 10)).toBeCloseTo(3);
  });
});
