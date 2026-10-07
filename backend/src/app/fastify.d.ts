import "fastify";
import type { AuthContext } from "../modules/auth/auth.js";

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}
