import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
  DATABASE_CONNECT_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(60_000)
    .default(5_000),
  DATABASE_QUERY_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(120_000)
    .default(15_000),
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  CORS_ORIGIN: z.string().url().default("http://127.0.0.1:4176"),
  MOBILE_CORS_ORIGINS: z
    .string()
    .default("capacitor://localhost,https://localhost")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  SESSION_COOKIE_NAME: z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/)
    .default("transport_copilot_session"),
  SESSION_TTL_HOURS: z.coerce
    .number()
    .int()
    .min(1)
    .max(24 * 30)
    .default(8),
  GOOGLE_ROUTES_API_KEY: z.string().trim().min(1).optional(),
  ETA_REFRESH_MINUTES: z.coerce.number().int().min(1).max(60).default(5),
  ETA_MOVEMENT_METERS: z.coerce.number().int().min(100).max(50_000).default(5_000),
  GPS_STALE_MINUTES: z.coerce.number().int().min(1).max(120).default(5),
  NO_PROGRESS_MINUTES: z.coerce.number().int().min(5).max(240).default(20),
  DELAY_CONFIRMED_MINUTES: z.coerce.number().int().min(1).max(240).default(30),
  GEOFENCE_RADIUS_METERS: z.coerce.number().int().min(50).max(5_000).default(250),
  GEOFENCE_MAX_ACCURACY_METERS: z.coerce.number().min(5).max(1_000).default(100),
  DOCUMENT_STORAGE_ROOT: z.string().trim().min(1).default(".local-data/documents"),
  DOCUMENT_MAX_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .max(25 * 1024 * 1024)
    .default(10 * 1024 * 1024),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  return envSchema.parse(source);
}
