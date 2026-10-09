export type ApiErrorKind =
  | "CONFIGURATION"
  | "TIMEOUT"
  | "NETWORK"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "SERVER"
  | "REQUEST";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly kind: ApiErrorKind,
    public readonly status?: number,
    public readonly code?: string,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type FetchImplementation = typeof fetch;

interface ClientOptions {
  baseUrl?: string;
  fetchImplementation?: FetchImplementation;
  timeoutMs?: number;
}

interface RequestOptions extends RequestInit {
  token?: string | null;
}

function normalizedBaseUrl(configured?: string) {
  const value = configured?.trim().replace(/\/$/, "");
  if (!value)
    throw new ApiError(
      "Falta configurar la dirección segura del servidor.",
      "CONFIGURATION",
    );
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ApiError("La dirección del servidor no es válida.", "CONFIGURATION");
  }
  if (parsed.protocol !== "https:")
    throw new ApiError("La aplicación requiere un servidor HTTPS.", "CONFIGURATION");
  return value;
}

export function configuredApiBaseUrl() {
  return normalizedBaseUrl(process.env.EXPO_PUBLIC_API_URL);
}

export function createApiClient(options: ClientOptions = {}) {
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const timeoutMs = options.timeoutMs ?? 12_000;

  return {
    async request<T>(path: string, requestOptions: RequestOptions = {}): Promise<T> {
      const baseUrl = normalizedBaseUrl(
        options.baseUrl ?? process.env.EXPO_PUBLIC_API_URL,
      );
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const { token, headers, ...init } = requestOptions;
      try {
        const response = await fetchImplementation(`${baseUrl}/api/v1${path}`, {
          ...init,
          signal: controller.signal,
          headers: {
            accept: "application/json",
            ...(init.body ? { "content-type": "application/json" } : {}),
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            ...headers,
          },
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as {
            error?: { code?: string; message?: string; requestId?: string };
          };
          const kind: ApiErrorKind =
            response.status === 401
              ? "UNAUTHORIZED"
              : response.status === 403
                ? "FORBIDDEN"
                : response.status >= 500
                  ? "SERVER"
                  : "REQUEST";
          throw new ApiError(
            body.error?.message ?? "No se ha podido completar la operación.",
            kind,
            response.status,
            body.error?.code,
            body.error?.requestId,
          );
        }
        if (response.status === 204) return undefined as T;
        return (await response.json()) as T;
      } catch (error) {
        if (error instanceof ApiError) throw error;
        if (error instanceof Error && error.name === "AbortError")
          throw new ApiError("El servidor ha tardado demasiado en responder.", "TIMEOUT");
        throw new ApiError("No se puede conectar con el servidor.", "NETWORK");
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
export const apiClient = createApiClient();

export function friendlyApiMessage(error: unknown) {
  if (!(error instanceof ApiError)) return "Ha ocurrido un error temporal.";
  if (error.kind === "TIMEOUT") return "El servidor está tardando. Vuelve a intentarlo.";
  if (error.kind === "NETWORK") return "No podemos conectar con el servidor.";
  if (error.kind === "UNAUTHORIZED") return "Tu sesión ha caducado. Inicia sesión de nuevo.";
  if (error.kind === "FORBIDDEN") return "Tu usuario no tiene acceso a esta operación.";
  if (error.kind === "CONFIGURATION") return error.message;
  return "No hemos podido completar la operación. Inténtalo de nuevo.";
}
