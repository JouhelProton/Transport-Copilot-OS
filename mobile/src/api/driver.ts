import { apiClient, type ApiClient } from "./client";
import type {
  ApiDriverService,
  ApiEnvelope,
  MobileLoginPayload,
  SessionPayload,
  TrackingPosition,
  TrackingSession,
  TrackingSnapshot,
} from "@/types/api";

export function createDriverApi(client: ApiClient = apiClient) {
  return {
    async mobileLogin(email: string, password: string) {
      const response = await client.request<ApiEnvelope<MobileLoginPayload>>(
        "/auth/mobile-login",
        { method: "POST", body: JSON.stringify({ email, password }) },
      );
      return response.data;
    },
    async me(token: string) {
      const response = await client.request<ApiEnvelope<SessionPayload>>("/auth/me", {
        token,
      });
      return response.data;
    },
    async logout(token: string) {
      await client.request<void>("/auth/logout", { method: "POST", token });
    },
    async services(token: string) {
      const response = await client.request<ApiEnvelope<ApiDriverService[]>>(
        "/driver/services",
        { token },
      );
      return response.data;
    },
    async service(token: string, id: string) {
      const response = await client.request<ApiEnvelope<ApiDriverService>>(
        `/driver/services/${encodeURIComponent(id)}`,
        { token },
      );
      return response.data;
    },
    async acceptService(token: string, id: string) {
      const response = await client.request<ApiEnvelope<ApiDriverService>>(
        `/driver/services/${encodeURIComponent(id)}/accept`,
        { method: "POST", token },
      );
      return response.data;
    },
    async startTracking(token: string, id: string) {
      const response = await client.request<ApiEnvelope<TrackingSession>>(
        `/driver/services/${encodeURIComponent(id)}/tracking/start`,
        { method: "POST", token },
      );
      return response.data;
    },
    async sendTrackingPosition(
      token: string,
      id: string,
      position: Omit<TrackingPosition, "id" | "serviceId" | "driverId" | "receivedAt" | "source">,
    ) {
      const response = await client.request<
        ApiEnvelope<{ accepted: boolean; duplicate: boolean; stale: boolean; current: TrackingPosition | null }>
      >(`/driver/services/${encodeURIComponent(id)}/tracking/positions`, {
        method: "POST",
        token,
        body: JSON.stringify(position),
      });
      return response.data;
    },
    async stopTracking(token: string, id: string) {
      const response = await client.request<
        ApiEnvelope<{ stopped: boolean; session: TrackingSession | null }>
      >(`/driver/services/${encodeURIComponent(id)}/tracking/stop`, {
        method: "POST",
        token,
      });
      return response.data;
    },
    async tracking(token: string, id: string) {
      const response = await client.request<ApiEnvelope<TrackingSnapshot>>(
        `/driver/services/${encodeURIComponent(id)}/tracking`,
        { token },
      );
      return response.data;
    },
  };
}

export type DriverApi = ReturnType<typeof createDriverApi>;
export const driverApi = createDriverApi();
