import type { FastifyInstance } from "fastify";
import type { Database } from "../../plugins/prisma.js";
import {
  createAuthenticate,
  requireRoles,
  TRANSPORT_ROLES,
} from "../auth/auth.js";

export async function registerResourceRoutes(
  app: FastifyInstance,
  database: Database,
) {
  const authenticate = createAuthenticate(database);

  app.get("/drivers", { preHandler: authenticate }, async (request) => {
    const auth = requireRoles(request, TRANSPORT_ROLES);
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
    const auth = requireRoles(request, TRANSPORT_ROLES);
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
