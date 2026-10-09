import { createApiClient } from "@/api/client";
import { createDriverApi } from "@/api/driver";
import * as transport from "@/api/multipart-transport";

describe("all mobile uploads use native multipart", () => {
  afterEach(() => jest.restoreAllMocks());

  test("document and POD uploads both bypass the Expo file converter", async () => {
    const send = jest.spyOn(transport, "multipartFetch").mockImplementation(async () => new Response(JSON.stringify({ data: { id: "confirmed" } }), { status: 201 }));
    const api = createDriverApi(createApiClient({ baseUrl: "https://api.example.test" }));
    const file = { uri: "file:///evidence.png", name: "evidence.png", type: "image/png" };
    await expect(api.uploadDocument("test-token", "svc", { type: "DELIVERY_PHOTO", file })).resolves.toEqual({ id: "confirmed" });
    await expect(api.submitPod("test-token", "svc", { deliveredAt: new Date().toISOString(), files: [file] })).resolves.toEqual({ id: "confirmed" });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls.map(([url]) => url)).toEqual([
      "https://api.example.test/api/v1/driver/services/svc/documents",
      "https://api.example.test/api/v1/driver/services/svc/pod",
    ]);
    for (const [, options] of send.mock.calls) {
      expect(options?.body).toBeInstanceOf(FormData);
      expect(new Headers(options?.headers).get("authorization")).toBe("Bearer test-token");
      expect(new Headers(options?.headers).has("content-type")).toBe(false);
    }
  });
});
