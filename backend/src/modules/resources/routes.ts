import type { FastifyInstance } from "fastify";
import type { Database } from "../../plugins/prisma.js";
import type { AppConfig } from "../../config/env.js";
import { createAuthenticate, requirePermission } from "../auth/auth.js";

export async function registerResourceRoutes(
  app: FastifyInstance,
  database: Database,
  config: AppConfig,
) {
  const authenticate = createAuthenticate(database, config);

  app.get("/drivers", { preHandler: authenticate }, async (request) => {
    const auth = requirePermission(request, "drivers:read");
    const drivers = await database.driver.findMany({
      where: { organizationId: auth.organizationId },
      orderBy: { name: "asc" },
    });
    return {
      data: drivers.map((driver) => ({
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        license: driver.license,
        status: driver.status,
      })),
    };
  });

  app.get("/vehicles", { preHandler: authenticate }, async (request) => {
    const auth = requirePermission(request, "vehicles:read");
    const vehicles = await database.vehicle.findMany({
      where: { organizationId: auth.organizationId },
      orderBy: { plate: "asc" },
    });
    return {
      data: vehicles.map((vehicle) => ({
        id: vehicle.id,
        plate: vehicle.plate,
        type: vehicle.type,
        reefer: vehicle.reefer,
        status: vehicle.status,
      })),
    };
  });
}
