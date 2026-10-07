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
