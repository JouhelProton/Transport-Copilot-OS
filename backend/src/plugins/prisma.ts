import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

export interface DatabaseTimeouts {
  connectionTimeoutMs?: number;
  queryTimeoutMs?: number;
}

export function createPrismaClient(
  connectionString: string,
  timeouts: DatabaseTimeouts = {},
) {
  const connectionTimeoutMillis = timeouts.connectionTimeoutMs ?? 5_000;
  const queryTimeout = timeouts.queryTimeoutMs ?? 15_000;
  const adapter = new PrismaPg({
    connectionString,
    connectionTimeoutMillis,
    query_timeout: queryTimeout,
    statement_timeout: queryTimeout,
  });
  return new PrismaClient({ adapter });
}

export type Database = ReturnType<typeof createPrismaClient>;
