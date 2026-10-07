import { apiClient, type ApiClient } from "./client";
import type {
  ApiDriverService,
  ApiEnvelope,
  MobileLoginPayload,
  SessionPayload,
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
  };
}

export type DriverApi = ReturnType<typeof createDriverApi>;
export const driverApi = createDriverApi();
