import { createDriverApi } from "@/api/driver";
import type { ApiClient } from "@/api/client";

describe("Driver API", () => {
  test("uses the existing driver endpoints for list, detail and acceptance", async () => {
    const request = jest.fn(async () => ({ data: { id: "svc-1" } }));
    const api = createDriverApi({ request } as unknown as ApiClient);
    await api.services("token"); await api.service("token", "svc/1"); await api.acceptService("token", "svc/1");
    expect(request).toHaveBeenNthCalledWith(1, "/driver/services", { token: "token" });
    expect(request).toHaveBeenNthCalledWith(2, "/driver/services/svc%2F1", { token: "token" });
    expect(request).toHaveBeenNthCalledWith(3, "/driver/services/svc%2F1/accept", { method: "POST", token: "token" });
  });
});
