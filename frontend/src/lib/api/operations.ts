import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@/lib/auth/session";
import { apiFetch } from "@/lib/platform/api-client";

export interface ApiLocation {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface ApiAssignment {
  id?: string;
  driverId: string;
  driverName: string;
  vehicleId: string;
  vehiclePlate: string;
  assignedAt?: string;
  acceptedAt?: string | null;
}

export interface ApiOrder {
  id: string;
  organizationId: string;
  carrierOrganizationId: string;
  customerId: string;
  customerName: string;
  reference: string;
  origin: ApiLocation;
  destination: ApiLocation;
  cargo: string;
  pallets: number;
  tempMin: number | null;
  tempMax: number | null;
  plannedPickup: string;
  plannedDelivery: string;
  status: "SUBMITTED" | "ACCEPTED";
  acceptedAt: string | null;
  service: { id: string; status: ServiceStatus; assignment: ApiAssignment | null } | null;
  createdAt: string;
  updatedAt: string;
}

export type ServiceStatus = "PLANNED" | "ASSIGNED" | "DRIVER_ACCEPTED";

export interface ApiTrackingPosition {
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

export interface ApiTrackingSession {
  id: string;
  serviceId: string;
  driverId: string;
  status: "ACTIVE" | "STOPPED" | "EXPIRED";
  startedAt: string;
  stoppedAt: string | null;
  stopReason: string | null;
}

export type DelayLevel = "ON_TIME" | "RISK" | "CONFIRMED" | "DATA_INSUFFICIENT";
export type IncidentStatus = "OPEN" | "IN_REVIEW" | "RESOLVED" | "CLOSED";
export type IncidentPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ApiIncident {
  id: string;
  serviceId: string;
  type: string;
  description: string;
  status: IncidentStatus;
  priority: IncidentPriority;
  reportedAt: string;
  resolvedAt: string | null;
  reportedBy: { id: string; name: string };
  history: Array<{ id: string; fromStatus: IncidentStatus | null; toStatus: IncidentStatus; note: string | null; changedAt: string }>;
}

export interface ApiOperationalException {
  id: string;
  reference: string;
  customerName: string;
  status: ServiceStatus;
  plannedDelivery: string;
  assignment: { driverName: string; vehiclePlate: string } | null;
  currentPosition: { latitude: number; longitude: number; accuracy: number; recordedAt: string } | null;
  eta: { status: "AVAILABLE" | "UNAVAILABLE"; estimatedArrival: string | null; calculatedAt: string; source: string } | null;
  operationalState: { delayLevel: DelayLevel; delayMinutes: number | null; gpsStale: boolean; noProgress: boolean; reasons: string[]; assessedAt: string } | null;
  openIncidents: number;
}

export interface ApiServiceIntelligence {
  eta: { status: "AVAILABLE" | "UNAVAILABLE"; estimatedArrival: string | null; durationSeconds: number | null; distanceMeters: number | null; calculatedAt: string; source: string; unavailableReason: string | null } | null;
  state: { delayLevel: DelayLevel; delayMinutes: number | null; gpsStale: boolean; noProgress: boolean; reasons: string[]; assessedAt: string } | null;
  geofences: Array<{ id: string; kind: "ORIGIN" | "DESTINATION"; radiusMeters: number; isInside: boolean; lastTransitionAt: string | null; events: Array<{ id: string; kind: "ENTERED" | "EXITED"; recordedAt: string }> }>;
  incidents: ApiIncident[];
}

export interface ApiService {
  id: string;
  organizationId: string;
  customerOrganizationId: string;
  customerId: string;
  customerName: string;
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
  events: Array<{
    id: string;
    type: string;
    actorUserId: string | null;
    occurredAt: string;
    payload: unknown;
  }>;
  createdAt: string;
  updatedAt: string;
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
  events: ApiService["events"];
  updatedAt: string;
}

export interface ApiDriver {
  id: string;
  name: string;
  phone: string;
  license: string;
  status: "ACTIVE" | "RESTING";
}

export interface ApiVehicle {
  id: string;
  plate: string;
  type: string;
  reefer: boolean;
  status: "AVAILABLE" | "IN_SERVICE" | "MAINTENANCE";
}

export interface CreateOrderInput {
  carrierOrganizationId: string;
  reference: string;
  origin: ApiLocation;
  destination: ApiLocation;
  cargo: string;
  pallets: number;
  tempMin?: number;
  tempMax?: number;
  plannedPickup: string;
  plannedDelivery: string;
}

async function apiRequest<T>(session: Session, path: string, init?: RequestInit): Promise<T> {
  void session;
  const response = await apiFetch(path, init);
  return response.json() as Promise<T>;
}

const enabledInBrowser = () => typeof window !== "undefined";

export function useApiOrders(session: Session) {
  return useQuery({
    queryKey: ["api", session.organizationId, session.userId, "orders"],
    queryFn: () =>
      apiRequest<{ data: ApiOrder[] }>(session, "/orders").then((result) => result.data),
    enabled: enabledInBrowser(),
    refetchOnWindowFocus: true,
  });
}

export function useApiServices(session: Session) {
  return useQuery({
    queryKey: ["api", session.organizationId, session.userId, "services"],
    queryFn: () =>
      apiRequest<{ data: ApiService[] }>(session, "/services").then((result) => result.data),
    enabled: enabledInBrowser(),
    refetchOnWindowFocus: true,
  });
}

export function useDriverApiServices(session: Session, online: boolean) {
  return useQuery({
    queryKey: ["api", session.organizationId, session.userId, "driver-services"],
    queryFn: () =>
      apiRequest<{ data: ApiDriverService[] }>(session, "/driver/services").then(
        (result) => result.data,
      ),
    enabled: enabledInBrowser() && online,
    retry: false,
    refetchOnWindowFocus: true,
  });
}

export function useDriverApiService(session: Session, serviceId: string, online: boolean) {
  return useQuery({
    queryKey: ["api", session.organizationId, session.userId, "driver-services", serviceId],
    queryFn: () =>
      apiRequest<{ data: ApiDriverService }>(session, `/driver/services/${serviceId}`).then(
        (result) => result.data,
      ),
    enabled: enabledInBrowser() && online,
    retry: false,
  });
}

export function useCarrierTracking(session: Session, serviceId: string) {
  return useQuery({
    queryKey: ["api", session.organizationId, "tracking", serviceId, "current"],
    queryFn: () =>
      apiRequest<{ data: { current: ApiTrackingPosition | null; session: ApiTrackingSession | null } }>(
        session,
        `/services/${serviceId}/tracking/current`,
      ).then((result) => result.data),
    enabled: enabledInBrowser() && Boolean(serviceId),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    retry: false,
  });
}

export function useCarrierTrackingHistory(session: Session, serviceId: string) {
  return useQuery({
    queryKey: ["api", session.organizationId, "tracking", serviceId, "history"],
    queryFn: () =>
      apiRequest<{ data: ApiTrackingPosition[] }>(
        session,
        `/services/${serviceId}/tracking/history?limit=500`,
      ).then((result) => result.data),
    enabled: enabledInBrowser() && Boolean(serviceId),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    retry: false,
  });
}

export function useOperationalExceptions(session: Session) {
  return useQuery({
    queryKey: ["api", session.organizationId, "operations", "exceptions"],
    queryFn: () => apiRequest<{ data: ApiOperationalException[] }>(session, "/operations/exceptions").then((result) => result.data),
    enabled: enabledInBrowser(),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    retry: false,
  });
}

export function useServiceIntelligence(session: Session, serviceId: string) {
  return useQuery({
    queryKey: ["api", session.organizationId, "intelligence", serviceId],
    queryFn: () => apiRequest<{ data: ApiServiceIntelligence }>(session, `/services/${serviceId}/intelligence`).then((result) => result.data),
    enabled: enabledInBrowser() && Boolean(serviceId),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    retry: false,
  });
}

export function useApiIncidents(session: Session) {
  return useQuery({
    queryKey: ["api", session.organizationId, "incidents"],
    queryFn: () => apiRequest<{ data: ApiIncident[] }>(session, "/incidents").then((result) => result.data),
    enabled: enabledInBrowser(),
    retry: false,
  });
}

export function useUpdateIncident(session: Session) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ serviceId, incidentId, status, priority, note }: { serviceId: string; incidentId: string; status: IncidentStatus; priority?: IncidentPriority; note?: string }) =>
      apiRequest<{ data: ApiIncident }>(session, `/services/${serviceId}/incidents/${incidentId}`, {
        method: "PATCH",
        body: JSON.stringify({ status, ...(priority ? { priority } : {}), ...(note ? { note } : {}) }),
      }).then((result) => result.data),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["api", session.organizationId, "incidents"] }),
        queryClient.invalidateQueries({ queryKey: ["api", session.organizationId, "operations", "exceptions"] }),
      ]);
    },
  });
}

export function useApiDrivers(session: Session) {
  return useQuery({
    queryKey: ["api", session.organizationId, "drivers"],
    queryFn: () =>
      apiRequest<{ data: ApiDriver[] }>(session, "/drivers").then((result) => result.data),
    enabled: enabledInBrowser(),
  });
}

export function useApiVehicles(session: Session) {
  return useQuery({
    queryKey: ["api", session.organizationId, "vehicles"],
    queryFn: () =>
      apiRequest<{ data: ApiVehicle[] }>(session, "/vehicles").then((result) => result.data),
    enabled: enabledInBrowser(),
  });
}

function useRefreshOperations(session: Session) {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["api", session.organizationId, session.userId, "orders"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["api", session.organizationId, session.userId, "services"],
      }),
    ]);
  };
}

export function useCreateOrder(session: Session) {
  const refresh = useRefreshOperations(session);
  return useMutation({
    mutationFn: (input: CreateOrderInput) =>
      apiRequest<{ data: ApiOrder }>(session, "/orders", {
        method: "POST",
        body: JSON.stringify(input),
      }).then((result) => result.data),
    onSuccess: refresh,
  });
}

export function useAcceptOrder(session: Session) {
  const refresh = useRefreshOperations(session);
  return useMutation({
    mutationFn: (orderId: string) =>
      apiRequest<{ data: ApiService }>(session, `/orders/${orderId}/accept`, {
        method: "POST",
      }).then((result) => result.data),
    onSuccess: refresh,
  });
}

export function useAssignService(session: Session) {
  const refresh = useRefreshOperations(session);
  return useMutation({
    mutationFn: ({
      serviceId,
      driverId,
      vehicleId,
    }: {
      serviceId: string;
      driverId: string;
      vehicleId: string;
    }) =>
      apiRequest<{ data: ApiService }>(session, `/services/${serviceId}/assign`, {
        method: "POST",
        body: JSON.stringify({ driverId, vehicleId }),
      }).then((result) => result.data),
    onSuccess: refresh,
  });
}

export function useAcceptDriverService(session: Session) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (serviceId: string) =>
      apiRequest<{ data: ApiDriverService }>(session, `/driver/services/${serviceId}/accept`, {
        method: "POST",
      }).then((result) => result.data),
    onSuccess: async (service) => {
      queryClient.setQueryData(
        ["api", session.organizationId, session.userId, "driver-services", service.id],
        service,
      );
      await queryClient.invalidateQueries({
        queryKey: ["api", session.organizationId, session.userId, "driver-services"],
      });
    },
  });
}
