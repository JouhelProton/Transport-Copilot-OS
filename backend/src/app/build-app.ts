import Fastify from "fastify";
import cors from "@fastify/cors";
import { Prisma } from "../generated/prisma/client.js";
import { ZodError } from "zod";
import type { AppConfig } from "../config/env.js";
import { AppError } from "../shared/errors.js";
import { createPrismaClient, type Database } from "../plugins/prisma.js";
import { registerOrderRoutes } from "../modules/orders/routes.js";
import { registerServiceRoutes } from "../modules/services/routes.js";
import { registerResourceRoutes } from "../modules/resources/routes.js";

export async function buildApp(config: AppConfig, providedDatabase?: Database) {
  const database = providedDatabase ?? createPrismaClient(config.DATABASE_URL);
  const app = Fastify({
    logger: config.NODE_ENV === "test" ? false : { level: config.LOG_LEVEL },
    bodyLimit: 256 * 1024,
    requestIdHeader: "x-request-id",
  });

  await app.register(cors, {
    origin: config.CORS_ORIGIN,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: [
      "content-type",
      "x-dev-user-id",
      "x-organization-id",
      "x-request-id",
    ],
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "transport-copilot-backend",
  }));

  await app.register(
    async (api) => {
      await registerOrderRoutes(api, database);
      await registerServiceRoutes(api, database);
      await registerResourceRoutes(api, database);
    },
    { prefix: "/api/v1" },
  );

  app.setNotFoundHandler((request, reply) => {
    void reply
      .code(404)
      .send({
        error: {
          code: "ROUTE_NOT_FOUND",
          message: "Ruta no encontrada",
          details: [],
          requestId: request.id,
        },
      });
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
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
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return reply.code(409).send({
        error: {
          code: "CONFLICT",
          message: "Ya existe un registro con esos datos",
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
        message:
          config.NODE_ENV === "production"
            ? "Error interno del servidor"
            : "Error interno del servidor",
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
