export type ServiceStatus = "PLANNED" | "ASSIGNED" | "DRIVER_ACCEPTED";

export interface ApiLocation {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface ApiAssignment {
  id: string;
  driverId: string;
  driverName: string;
  vehicleId: string;
  vehiclePlate: string;
  assignedAt: string;
  acceptedAt: string | null;
}

export interface ApiDriverService {
  id: string;
  orderId: string;
  reference: string;
  origin: ApiLocation;
  destination: ApiLocation;
  cargo: string;
  pallets: number;
  tempMin: number | null;
  tempMax: number | null;
  plannedPickup: string;
  plannedDelivery: string;
  status: ServiceStatus;
  assignment: ApiAssignment | null;
  events: {
    id: string;
    type: string;
    actorUserId: string | null;
    occurredAt: string;
    payload: unknown;
  }[];
  updatedAt: string;
}

export interface SessionMembership {
  id: string;
  role: string;
  organization: { id: string; name: string; kind?: "CARRIER" | "SHIPPER" };
  permissions: string[];
}

export interface SessionPayload {
  user: { id: string; name: string; email: string };
  activeMembership: SessionMembership;
  memberships: SessionMembership[];
  permissions: string[];
  expiresAt: string;
  driverId?: string;
}

export interface MobileLoginPayload extends SessionPayload {
  sessionToken: string;
}

export interface ApiEnvelope<T> {
  data: T;
}

export type TrackingSessionStatus = "ACTIVE" | "STOPPED" | "EXPIRED";

export interface TrackingSession {
  id: string;
  serviceId: string;
  driverId: string;
  status: TrackingSessionStatus;
  startedAt: string;
  stoppedAt: string | null;
  stopReason: string | null;
}

export interface TrackingPosition {
  id: string;
  serviceId: string;
  driverId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  recordedAt: string;
  receivedAt: string;
  source: string;
  sampleId: string;
}

export interface TrackingSnapshot {
  session: TrackingSession | null;
  current: TrackingPosition | null;
  history: TrackingPosition[];
}

export type IncidentType = "DELAY" | "BREAKDOWN" | "LOADING_PROBLEM" | "UNLOADING_PROBLEM" | "WRONG_ADDRESS" | "DOCUMENT_PROBLEM" | "OTHER";
export type IncidentPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface DriverIncident {
  id: string;
  serviceId: string;
  type: IncidentType;
  description: string;
  status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "CLOSED";
  priority: IncidentPriority;
  reportedAt: string;
}
