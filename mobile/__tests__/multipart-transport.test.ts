import { multipartFetch } from "@/api/multipart-transport";

describe("native POD multipart transport", () => {
  const original = globalThis.XMLHttpRequest;
  afterEach(() => { globalThis.XMLHttpRequest = original; });

  test("passes URI form data unchanged and retains HTTP failure details", async () => {
    const form = new FormData();
    form.append("file", { uri: "file:///photo.png", name: "photo.png", type: "image/png" } as unknown as Blob);
    const headers: Record<string, string> = {};
    const xhr = {
      status: 409, responseText: '{"error":{"code":"POD_ALREADY_SUBMITTED"}}',
      open: jest.fn(), setRequestHeader: (name: string, value: string) => { headers[name] = value; },
      getAllResponseHeaders: () => "content-type: application/json\r\nx-request-id: pod-test",
      onload: () => {}, send: jest.fn(),
    };
    xhr.send.mockImplementation((body) => { expect(body).toBe(form); xhr.onload(); });
    globalThis.XMLHttpRequest = jest.fn(() => xhr) as unknown as typeof XMLHttpRequest;
    const response = await multipartFetch("https://api.example.test/pod", { method: "POST", body: form, headers: { authorization: "Bearer test" } });
    expect(response.status).toBe(409);
    expect(response.headers.get("x-request-id")).toBe("pod-test");
    expect(await response.json()).toEqual({ error: { code: "POD_ALREADY_SUBMITTED" } });
    expect(headers["content-type"]).toBeUndefined();
    expect(headers.authorization).toBe("Bearer test");
  });

  test("aborts without sending when the request was cancelled", async () => {
    const xhr = { open: jest.fn(), abort: jest.fn(), send: jest.fn() };
    globalThis.XMLHttpRequest = jest.fn(() => xhr) as unknown as typeof XMLHttpRequest;
    const controller = new AbortController(); controller.abort();
    await expect(multipartFetch("https://api.example.test/pod", { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(xhr.send).not.toHaveBeenCalled();
  });
});
