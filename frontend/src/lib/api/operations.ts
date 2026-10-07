import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@/lib/auth/session";

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
  service: { id: string; status: "PLANNED" | "ASSIGNED"; assignment: ApiAssignment | null } | null;
  createdAt: string;
  updatedAt: string;
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
  status: "PLANNED" | "ASSIGNED";
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

interface ApiErrorBody {
  error?: { message?: string };
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");

async function apiRequest<T>(session: Session, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}/api/v1${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new Error(body.error?.message ?? `Error del backend (${response.status})`);
  }
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
