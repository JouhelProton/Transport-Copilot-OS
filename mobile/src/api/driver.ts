import { apiClient, type ApiClient } from "./client";
import type {
  ApiDriverService,
  ApiEnvelope,
  MobileLoginPayload,
  SessionPayload,
  TrackingPosition,
  TrackingSession,
  TrackingSnapshot,
  DriverIncident,
  IncidentPriority,
  IncidentType,
  DriverPod,
  DriverDocument,
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
    async createIncident(token: string, id: string, input: { type: IncidentType; description: string; priority: IncidentPriority }) {
      const response = await client.request<ApiEnvelope<DriverIncident>>(
        `/driver/services/${encodeURIComponent(id)}/incidents`,
        { method: "POST", token, body: JSON.stringify(input) },
      );
      return response.data;
    },
    async pod(token: string, id: string) {
      const response = await client.request<ApiEnvelope<DriverPod | null>>(
        `/driver/services/${encodeURIComponent(id)}/pod`,
        { token },
      );
      return response.data;
    },
    async documents(token: string, id: string) {
      const response = await client.request<ApiEnvelope<DriverDocument[]>>(
        `/driver/services/${encodeURIComponent(id)}/documents`,
        { token },
      );
      return response.data;
    },
    async uploadDocument(token: string, id: string, input: { type: DriverDocument["type"]; file: { uri: string; name: string; type: string } }) {
      const form = new FormData();
      form.append("type", input.type);
      form.append("file", input.file as unknown as Blob);
      const response = await client.request<ApiEnvelope<DriverDocument>>(
        `/driver/services/${encodeURIComponent(id)}/documents`,
        { method: "POST", token, body: form },
      );
      return response.data;
    },
    async submitPod(token: string, id: string, input: { deliveredAt: string; receiverName?: string; observations?: string; files: { uri: string; name: string; type: string }[] }) {
      const form = new FormData();
      form.append("deliveredAt", input.deliveredAt);
      if (input.receiverName) form.append("receiverName", input.receiverName);
      if (input.observations) form.append("observations", input.observations);
      for (const file of input.files)
        form.append("file", file as unknown as Blob);
      const response = await client.request<ApiEnvelope<DriverPod>>(
        `/driver/services/${encodeURIComponent(id)}/pod`,
        { method: "POST", token, body: form },
      );
      return response.data;
    },
  };
}

export type DriverApi = ReturnType<typeof createDriverApi>;
export const driverApi = createDriverApi();
