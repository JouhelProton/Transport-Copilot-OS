import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { Prisma } from "../generated/prisma/client.js";
import { ZodError } from "zod";
import type { AppConfig } from "../config/env.js";
import { AppError } from "../shared/errors.js";
import { createPrismaClient, type Database } from "../plugins/prisma.js";
import { registerOrderRoutes } from "../modules/orders/routes.js";
import { registerServiceRoutes } from "../modules/services/routes.js";
import { registerResourceRoutes } from "../modules/resources/routes.js";
import { registerAuthRoutes } from "../modules/auth/routes.js";
import { registerDriverRoutes } from "../modules/driver/routes.js";
import { registerTrackingRoutes } from "../modules/tracking/routes.js";
import { registerOperationsRoutes } from "../modules/operations/routes.js";
import { registerDocumentRoutes } from "../modules/documents/routes.js";
import { forbidden } from "../shared/errors.js";

export async function buildApp(config: AppConfig, providedDatabase?: Database) {
  const database =
    providedDatabase ??
    createPrismaClient(config.DATABASE_URL, {
      connectionTimeoutMs: config.DATABASE_CONNECT_TIMEOUT_MS,
      queryTimeoutMs: config.DATABASE_QUERY_TIMEOUT_MS,
    });
  const app = Fastify({
    logger:
      config.NODE_ENV === "test"
        ? false
        : {
            level: config.LOG_LEVEL,
            redact: [
              "req.headers.cookie",
              "req.headers.authorization",
              "request.headers.cookie",
              "request.headers.authorization",
              "password",
              "*.password",
            ],
          },
    bodyLimit: Math.max(256 * 1024, config.DOCUMENT_MAX_BYTES + 512 * 1024),
    requestIdHeader: "x-request-id",
  });

  const allowedOrigins = [config.CORS_ORIGIN, ...config.MOBILE_CORS_ORIGINS];
  await app.register(cors, {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowedHeaders: ["content-type", "x-request-id", "authorization"],
  });
  await app.register(multipart, {
    limits: {
      fileSize: config.DOCUMENT_MAX_BYTES,
      files: 5,
      fields: 12,
      parts: 17,
    },
  });

  app.addHook("onRequest", async (request) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return;
    const origin = request.headers.origin;
    const fetchSite = request.headers["sec-fetch-site"];
    if (origin && !allowedOrigins.includes(origin))
      throw forbidden("Origen de la petición no permitido");
    const isMobileLogin = request.url === "/api/v1/auth/mobile-login";
    const hasBearer = request.headers.authorization
      ?.toLowerCase()
      .startsWith("bearer ");
    if (fetchSite === "cross-site" && !hasBearer && !isMobileLogin)
      throw forbidden("Petición cross-site no permitida");
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "transport-copilot-backend",
  }));

  app.get("/ready", async (request, reply) => {
    try {
      await database.$queryRaw`SELECT 1`;
      return { status: "ok", service: "transport-copilot-backend", database: "ready", features: { documentsPod: true } };
    } catch (error) {
      request.log.error({ err: error }, "Database readiness check failed");
      return reply.code(503).send({
        status: "unavailable",
        service: "transport-copilot-backend",
        database: "unavailable",
      });
    }
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      request.log.warn(
        {
          requestId: request.id,
          method: request.method,
          url: request.url,
          validationPaths: error.issues.map((issue) => issue.path.join(".")),
        },
        "Request validation rejected",
      );
      return reply.code(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "La petición no es válida",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
          requestId: request.id,
        },
      });
    }
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          requestId: request.id,
        },
      });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return reply.code(409).send({
          error: {
            code: "CONFLICT",
            message: "Ya existe un registro con esos datos",
            details: [],
            requestId: request.id,
          },
        });
      }
      if (["P1001", "P1002", "P2024"].includes(error.code)) {
        request.log.error(
          { err: error, requestId: request.id },
          "Database request unavailable",
        );
        return reply.code(503).send({
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "Servicio temporalmente no disponible",
            details: [],
            requestId: request.id,
          },
        });
      }
    }

    const fastifyStatus = (error as { statusCode?: unknown }).statusCode;
    if (
      typeof fastifyStatus === "number" &&
      fastifyStatus >= 400 &&
      fastifyStatus < 500
    ) {
      const responseCode =
        fastifyStatus === 415
          ? "UNSUPPORTED_MEDIA_TYPE"
          : fastifyStatus === 429
            ? "RATE_LIMITED"
            : "REQUEST_ERROR";
      request.log.warn(
        {
          requestId: request.id,
          method: request.method,
          url: request.url,
          statusCode: fastifyStatus,
          code: (error as { code?: unknown }).code,
        },
        "HTTP request rejected",
      );
      return reply.code(fastifyStatus).send({
        error: {
          code: responseCode,
          message:
            fastifyStatus === 415
              ? "El tipo de contenido de la petición no es compatible"
              : "La petición no se ha podido procesar",
          details: [],
          requestId: request.id,
        },
      });
    }

    request.log.error(
      { err: error, requestId: request.id },
      "Unhandled request error",
    );
    return reply.code(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "Error interno del servidor",
        details: [],
        requestId: request.id,
      },
    });
  });

  await app.register(
    async (api) => {
      await api.register(
        async (auth) => registerAuthRoutes(auth, database, config),
        {
          prefix: "/auth",
        },
      );
      await registerOrderRoutes(api, database, config);
      await registerServiceRoutes(api, database, config);
      await registerResourceRoutes(api, database, config);
      await registerDriverRoutes(api, database, config);
      await registerTrackingRoutes(api, database, config);
      await registerOperationsRoutes(api, database, config);
      await registerDocumentRoutes(api, database, config);
    },
    { prefix: "/api/v1" },
  );

  app.setNotFoundHandler((request, reply) => {
    void reply.code(404).send({
      error: {
        code: "ROUTE_NOT_FOUND",
        message: "Ruta no encontrada",
        details: [],
        requestId: request.id,
      },
    });
  });

  app.addHook("onClose", async () => {
    if (!providedDatabase) await database.$disconnect();
  });

  return app;
}
