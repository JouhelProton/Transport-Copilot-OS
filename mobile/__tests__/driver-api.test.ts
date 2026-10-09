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

  test("submits POD evidence as multipart without exposing file paths in JSON", async () => {
    const request = jest.fn(async () => ({ data: { id: "pod-1" } }));
    const api = createDriverApi({ request } as unknown as ApiClient);
    await api.submitPod("token", "svc/1", {
      deliveredAt: "2026-10-09T12:00:00.000Z",
      observations: "Entrega correcta",
      files: [{ uri: "file:///evidence.jpg", name: "evidence.jpg", type: "image/jpeg" }],
    });
    const [path, options] = request.mock.calls[0] as unknown as [string, RequestInit & { token: string }];
    expect(path).toBe("/driver/services/svc%2F1/pod");
    expect(options.method).toBe("POST");
    expect(options.token).toBe("token");
    expect(options.body).toBeInstanceOf(FormData);
  });

  test("exposes the service documents flow as authenticated multipart requests", async () => {
    const request = jest.fn(async () => ({ data: [] }));
    const api = createDriverApi({ request } as unknown as ApiClient);
    await api.documents("token", "svc/1");
    await api.uploadDocument("token", "svc/1", { type: "DELIVERY_PHOTO", file: { uri: "file:///photo.jpg", name: "photo.jpg", type: "image/jpeg" } });
    expect(request).toHaveBeenNthCalledWith(1, "/driver/services/svc%2F1/documents", { token: "token" });
    const [, options] = request.mock.calls[1] as unknown as [string, RequestInit & { token: string }];
    expect(options.method).toBe("POST");
    expect(options.token).toBe("token");
    expect(options.body).toBeInstanceOf(FormData);
  });
});
