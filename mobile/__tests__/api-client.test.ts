import { ApiError, createApiClient, friendlyApiMessage } from "@/api/client";

describe("API client", () => {
  test("sends bearer credentials and parses JSON", async () => {
    const fetchMock = jest.fn(async () => new Response(JSON.stringify({ data: { ok: true } }), { status: 200, headers: { "content-type": "application/json" } }));
    const client = createApiClient({ baseUrl: "https://api.example.test", fetchImplementation: fetchMock as typeof fetch });
    await expect(client.request("/driver/services", { token: "opaque-session" })).resolves.toEqual({ data: { ok: true } });
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/api/v1/driver/services", expect.objectContaining({ headers: expect.objectContaining({ authorization: "Bearer opaque-session" }) }));
  });

  test("maps an expired session without exposing server details", async () => {
    const fetchMock = jest.fn(async () => new Response(JSON.stringify({ error: { code: "SESSION_EXPIRED", message: "expired" } }), { status: 401 }));
    const client = createApiClient({ baseUrl: "https://api.example.test", fetchImplementation: fetchMock as typeof fetch });
    await expect(client.request("/auth/me")).rejects.toMatchObject({ kind: "UNAUTHORIZED", status: 401 });
    expect(friendlyApiMessage(new ApiError("raw", "UNAUTHORIZED", 401))).toBe("Tu sesión ha caducado. Inicia sesión de nuevo.");
  });

  test("rejects insecure and missing API URLs", async () => {
    await expect(createApiClient({ baseUrl: "http://localhost:3000" }).request("/auth/me")).rejects.toMatchObject({ kind: "CONFIGURATION" });
    await expect(createApiClient({ baseUrl: "" }).request("/auth/me")).rejects.toMatchObject({ kind: "CONFIGURATION" });
  });

  test("maps network failures", async () => {
    const fetchMock = jest.fn(async () => { throw new Error("socket secret"); });
    const client = createApiClient({ baseUrl: "https://api.example.test", fetchImplementation: fetchMock as typeof fetch });
    await expect(client.request("/driver/services")).rejects.toMatchObject({ kind: "NETWORK" });
  });

  test("does not classify an invalid successful response as a network failure", async () => {
    const fetchMock = jest.fn(async () => new Response("not-json", { status: 201, headers: { "x-request-id": "req-pod-1" } }));
    const client = createApiClient({ baseUrl: "https://api.example.test", fetchImplementation: fetchMock as typeof fetch });
    await expect(client.request("/driver/services/svc/pod", { method: "POST" })).rejects.toMatchObject({ kind: "SERVER", code: "INVALID_JSON", requestId: "req-pod-1" });
  });

  test("shows the backend request reference for an actionable HTTP failure", () => {
    expect(friendlyApiMessage(new ApiError("conflict", "REQUEST", 409, "CONFLICT", "req-pod-2"))).toBe(
      "No hemos podido completar la operación. Referencia: req-pod-2.",
    );
  });

  test("preserves HTTP status when reading the response body fails", async () => {
    const fetchMock = jest.fn(async () => ({ ok: true, status: 201, text: async () => { throw new Error("body unavailable"); } } as unknown as Response));
    const client = createApiClient({ baseUrl: "https://api.example.test", fetchImplementation: fetchMock as typeof fetch });
    await expect(client.request("/driver/services/svc/pod", { method: "POST" })).rejects.toMatchObject({ kind: "SERVER", status: 201, code: "RESPONSE_READ_FAILED" });
  });
});
