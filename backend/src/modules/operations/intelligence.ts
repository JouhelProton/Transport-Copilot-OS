export type Coordinates = { latitude: number; longitude: number };

const EARTH_RADIUS_METERS = 6_371_000;
const radians = (degrees: number) => (degrees * Math.PI) / 180;

export function distanceMeters(a: Coordinates, b: Coordinates) {
  const dLat = radians(b.latitude - a.latitude);
  const dLng = radians(b.longitude - a.longitude);
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h)));
}

export function needsEtaRefresh(input: {
  calculatedAt?: Date | null;
  previousOrigin?: Coordinates | null;
  currentOrigin: Coordinates;
  now: Date;
  minimumMinutes: number;
  movementMeters: number;
}) {
  if (!input.calculatedAt || !input.previousOrigin) return true;
  if (input.now.getTime() - input.calculatedAt.getTime() >= input.minimumMinutes * 60_000) return true;
  return distanceMeters(input.previousOrigin, input.currentOrigin) >= input.movementMeters;
}

export function geofenceTransition(input: {
  wasInside: boolean;
  distance: number;
  accuracy: number;
  radius: number;
  maximumAccuracy: number;
}) {
  if (input.accuracy > input.maximumAccuracy) return null;
  if (!input.wasInside && input.distance + input.accuracy <= input.radius) return "ENTERED" as const;
  if (input.wasInside && input.distance - input.accuracy >= input.radius + 50) return "EXITED" as const;
  return null;
}

export function evaluateDelay(input: {
  estimatedArrival: Date | null;
  plannedDelivery: Date;
  gpsRecordedAt: Date | null;
  now: Date;
  gpsStaleMinutes: number;
  confirmedMinutes: number;
  noProgress: boolean;
}) {
  const gpsStale = !input.gpsRecordedAt || input.now.getTime() - input.gpsRecordedAt.getTime() > input.gpsStaleMinutes * 60_000;
  const reasons: string[] = [];
  if (gpsStale) reasons.push("GPS_STALE");
  if (input.noProgress) reasons.push("NO_PROGRESS");
  if (!input.estimatedArrival) reasons.push("ETA_UNAVAILABLE");
  if (gpsStale || !input.estimatedArrival)
    return { level: "DATA_INSUFFICIENT" as const, delayMinutes: null, gpsStale, reasons };
  const delayMinutes = Math.max(0, Math.ceil((input.estimatedArrival.getTime() - input.plannedDelivery.getTime()) / 60_000));
  if (delayMinutes >= input.confirmedMinutes) reasons.push("ETA_CONFIRMED_DELAY");
  else if (delayMinutes > 0 || input.noProgress) reasons.push("ETA_DELAY_RISK");
  return {
    level: delayMinutes >= input.confirmedMinutes ? "CONFIRMED" as const : delayMinutes > 0 || input.noProgress ? "RISK" as const : "ON_TIME" as const,
    delayMinutes,
    gpsStale,
    reasons,
  };
}
