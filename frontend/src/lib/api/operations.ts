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
