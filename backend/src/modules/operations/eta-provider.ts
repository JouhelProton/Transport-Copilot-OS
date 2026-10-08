import type { AppConfig } from "../../config/env.js";
import type { Coordinates } from "./intelligence.js";

export type EtaResult =
  | { available: true; estimatedArrival: Date; durationSeconds: number; distanceMeters: number; source: string }
  | { available: false; source: string; reason: string };

export interface EtaProvider {
  calculate(origin: Coordinates, destination: Coordinates, now: Date): Promise<EtaResult>;
}

export class UnavailableEtaProvider implements EtaProvider {
  async calculate(_origin: Coordinates, _destination: Coordinates, _now: Date): Promise<EtaResult> {
    return { available: false, source: "NONE", reason: "GOOGLE_ROUTES_API_KEY_NOT_CONFIGURED" };
  }
}

export class GoogleRoutesEtaProvider implements EtaProvider {
  constructor(private readonly apiKey: string) {}

  async calculate(origin: Coordinates, destination: Coordinates, now: Date): Promise<EtaResult> {
    try {
      const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": this.apiKey,
          "x-goog-fieldmask": "routes.duration,routes.distanceMeters",
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: origin.latitude, longitude: origin.longitude } } },
          destination: { location: { latLng: { latitude: destination.latitude, longitude: destination.longitude } } },
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_AWARE",
          departureTime: now.toISOString(),
        }),
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) return { available: false, source: "GOOGLE_ROUTES", reason: `HTTP_${response.status}` };
      const body = await response.json() as { routes?: Array<{ duration?: string; distanceMeters?: number }> };
      const route = body.routes?.[0];
      const durationSeconds = route?.duration ? Math.round(Number.parseFloat(route.duration)) : NaN;
      if (!route || !Number.isFinite(durationSeconds) || !Number.isFinite(route.distanceMeters))
        return { available: false, source: "GOOGLE_ROUTES", reason: "NO_ROUTE" };
      return {
        available: true,
        estimatedArrival: new Date(now.getTime() + durationSeconds * 1_000),
        durationSeconds,
        distanceMeters: route.distanceMeters!,
        source: "GOOGLE_ROUTES_TRAFFIC_AWARE",
      };
    } catch {
      return { available: false, source: "GOOGLE_ROUTES", reason: "PROVIDER_UNAVAILABLE" };
    }
  }
}

export function createEtaProvider(config: AppConfig): EtaProvider {
  return config.GOOGLE_ROUTES_API_KEY
    ? new GoogleRoutesEtaProvider(config.GOOGLE_ROUTES_API_KEY)
    : new UnavailableEtaProvider();
}
