import { ApiError } from "@/api/client";
import type { DriverApi } from "@/api/driver";
import { AuthService, DriverRoleError } from "@/auth/service";
import type { AuthStorage } from "@/auth/storage";
import type { SessionPayload } from "@/types/api";

function driverSession(role = "DRIVER"): SessionPayload {
  return { user: { id: "user-1", name: "Joel", email: "driver@example.test" }, activeMembership: { id: "m-1", role, organization: { id: "org-1", name: "Carrier" }, permissions: [] }, memberships: [], permissions: [], expiresAt: new Date(Date.now() + 60_000).toISOString(), driverId: role === "DRIVER" ? "driver-1" : undefined };
}

function setup() {
  let stored: string | null = null;
  const storage: AuthStorage = { get: jest.fn(async () => stored), set: jest.fn(async (token) => { stored = token; }), clear: jest.fn(async () => { stored = null; }) };
  const api = { mobileLogin: jest.fn(async () => ({ ...driverSession(), sessionToken: "opaque" })), me: jest.fn(async () => driverSession()), logout: jest.fn(async () => undefined), services: jest.fn(), service: jest.fn(), acceptService: jest.fn() } as unknown as jest.Mocked<DriverApi>;
  return { service: new AuthService(api, storage), api, storage, setStored(value: string | null) { stored = value; } };
}

describe("AuthService", () => {
  test("stores only the verified opaque DRIVER session", async () => {
    const { service, api, storage } = setup();
    await expect(service.login(" DRIVER@EXAMPLE.TEST ", "secret")).resolves.toMatchObject({ token: "opaque" });
    expect(api.mobileLogin).toHaveBeenCalledWith("driver@example.test", "secret");
    expect(storage.set).toHaveBeenCalledWith("opaque");
  });

  test("rejects a non-driver and revokes the issued session", async () => {
    const { service, api, storage } = setup();
    api.me.mockResolvedValueOnce(driverSession("CUSTOMER"));
    await expect(service.login("customer@example.test", "secret")).rejects.toBeInstanceOf(DriverRoleError);
    expect(api.logout).toHaveBeenCalledWith("opaque");
    expect(storage.set).not.toHaveBeenCalled();
  });

  test("clears an expired stored session", async () => {
    const { service, api, storage, setStored } = setup(); setStored("expired");
    api.me.mockRejectedValueOnce(new ApiError("expired", "UNAUTHORIZED", 401));
    await expect(service.restore()).rejects.toMatchObject({ kind: "UNAUTHORIZED" });
    expect(storage.clear).toHaveBeenCalled();
  });

  test("retains a stored session on temporary network failure", async () => {
    const { service, api, storage, setStored } = setup(); setStored("still-valid");
    api.me.mockRejectedValueOnce(new ApiError("network", "NETWORK"));
    await expect(service.restore()).rejects.toMatchObject({ kind: "NETWORK" });
    expect(storage.clear).not.toHaveBeenCalled();
  });

  test("logout always clears local secure storage", async () => {
    const { service, api, storage } = setup(); api.logout.mockRejectedValueOnce(new Error("offline"));
    await expect(service.logout("opaque")).resolves.toBeUndefined();
    expect(storage.clear).toHaveBeenCalled();
  });
});
