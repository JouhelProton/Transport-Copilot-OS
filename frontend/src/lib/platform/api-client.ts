import { authTransport } from "./auth-transport";
import { platform } from "./runtime";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string };
}

export async function apiFetch(path: string, init?: RequestInit, authenticated = true) {
  const requestInit = authenticated
    ? await authTransport.authenticatedInit(init)
    : authTransport.unauthenticatedInit(init);
  const response = await fetch(`${platform.apiBaseUrl()}/api/v1${path}`, {
    ...requestInit,
    headers: {
      ...(requestInit?.body ? { "content-type": "application/json" } : {}),
      ...requestInit?.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ErrorBody;
    throw new ApiRequestError(
      body.error?.message ?? `Error del backend (${response.status})`,
      response.status,
      body.error?.code,
    );
  }
  return response;
}
