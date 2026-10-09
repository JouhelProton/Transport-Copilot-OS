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
      const startedAt = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const { token, headers, ...init } = requestOptions;
      try {
        const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
        const response = await fetchImplementation(`${baseUrl}/api/v1${path}`, {
          ...init,
          signal: controller.signal,
          headers: {
            accept: "application/json",
            ...(init.body && !isFormData ? { "content-type": "application/json" } : {}),
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            ...headers,
          },
        });
        if (!response.ok) {
          const rawBody = await response.text();
          const body = (() => { try { return JSON.parse(rawBody); } catch { return {}; } })() as {
            error?: { code?: string; message?: string; requestId?: string };
          };
          const kind: ApiErrorKind =
            response.status === 401
              ? "UNAUTHORIZED"
              : response.status === 403
                ? "FORBIDDEN"
              : response.status === 413
                ? "REQUEST"
                : response.status >= 500
                ? "SERVER"
                : "REQUEST";
          const requestId = body.error?.requestId ?? response.headers.get("x-request-id") ?? undefined;
          if (process.env.NODE_ENV !== "production") console.info("[NEXO API]", requestOptions.method ?? "GET", path, response.status, body.error?.code ?? "ok", `${Date.now() - startedAt}ms`, requestId ?? "-");
          throw new ApiError(
            body.error?.message ?? "No se ha podido completar la operación.",
            kind,
            response.status,
            body.error?.code,
            requestId,
          );
        }
        if (response.status === 204) return undefined as T;
        const rawBody = await response.text();
        if (!rawBody.trim()) return undefined as T;
        try {
          return JSON.parse(rawBody) as T;
        } catch {
          const requestId = response.headers.get("x-request-id") ?? undefined;
          if (process.env.NODE_ENV !== "production") console.info("[NEXO API]", requestOptions.method ?? "GET", path, "INVALID_JSON", `${Date.now() - startedAt}ms`, requestId ?? "-");
          throw new ApiError("El servidor respondió con un formato no válido.", "SERVER", response.status, "INVALID_JSON", requestId);
        }
      } catch (error) {
        if (error instanceof ApiError) throw error;
        if (error instanceof Error && error.name === "AbortError")
          throw new ApiError("El servidor ha tardado demasiado en responder.", "TIMEOUT");
        if (process.env.NODE_ENV !== "production") console.info("[NEXO API]", requestOptions.method ?? "GET", path, "NETWORK", `${Date.now() - startedAt}ms`);
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
  if (error.status === 413) return "El archivo supera el tamaño máximo permitido.";
  if (error.status === 415) return "El formato del archivo no está permitido.";
  if (error.status === 422) return "Los datos enviados no son válidos. Revísalos e inténtalo de nuevo.";
  if (error.status === 404) return "El recurso solicitado no existe en el servidor actual.";
  if (error.status === 500) return "El servidor no pudo procesar la operación. Conserva los datos y reintenta.";
  if (error.code === "POD_EVIDENCE_REQUIRED") return "Adjunta al menos una fotografía o justificante antes de enviar.";
  if (error.code === "POD_ALREADY_SUBMITTED") return "Este servicio ya tiene una prueba de entrega enviada.";
  if (error.code === "DUPLICATE_DOCUMENT") return "Esta evidencia ya está asociada a otra prueba de entrega.";
  if (["INVALID_FILE_CONTENT", "MIME_MISMATCH"].includes(error.code ?? "")) return "La imagen no tiene un formato válido. Selecciona otra fotografía.";
  const reference = error.requestId ? ` Referencia: ${error.requestId}.` : "";
  return `No hemos podido completar la operación.${reference}`;
}
