import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TrackingDiagnostics, trackingReceptionStatus } from "@/components/transportista/TrackingDiagnostics";
import type { ApiTrackingPosition } from "@/lib/api/operations";

const position: ApiTrackingPosition = {
  id: "position-1",
  serviceId: "service-1",
  driverId: "driver-1",
  latitude: 39.4699,
  longitude: -0.3763,
  accuracy: 18,
  heading: null,
  speed: null,
  recordedAt: "2026-10-08T15:00:00.000Z",
  receivedAt: "2026-10-08T15:00:01.000Z",
  source: "MOBILE_GPS",
  sampleId: "sample-1",
};

describe("Tracking diagnostics", () => {
  it("classifies fresh, stale and missing positions independently from Google Maps", () => {
    expect(trackingReceptionStatus(null, Date.now()).label).toBe("Sin datos");
    expect(trackingReceptionStatus(position, new Date(position.receivedAt).getTime() + 30_000).label).toBe("Sincronizado");
    expect(trackingReceptionStatus(position, new Date(position.receivedAt).getTime() + 120_000).label).toBe("Desactualizado");
  });

  it("renders GPS details without mounting a map", () => {
    render(<TrackingDiagnostics position={position} historyCount={3} session={null} />);
    expect(screen.getByRole("region", { name: "Diagnóstico de tracking" })).toBeTruthy();
    expect(screen.getByText("39.469900, -0.376300")).toBeTruthy();
    expect(screen.getByText("18 m")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });
});
