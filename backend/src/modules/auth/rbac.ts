import type { Role } from "../../generated/prisma/enums.js";

export const PERMISSIONS = [
  "orders:create",
  "orders:read",
  "orders:accept",
  "services:read",
  "services:assign",
  "drivers:read",
  "vehicles:read",
  "driver:services:read",
  "driver:services:accept",
  "incidents:read",
  "incidents:manage",
  "driver:incidents:create",
  "operations:read",
  "notifications:read",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL = [...PERMISSIONS];
const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  SUPER_ADMIN: ALL,
  TRANSPORT_ADMIN: ALL,
  DISPATCHER: ALL,
  OPERATIONS: [
    "orders:create",
    "orders:read",
    "orders:accept",
    "services:read",
    "drivers:read",
    "vehicles:read",
    "incidents:read",
    "incidents:manage",
    "operations:read",
    "notifications:read",
  ],
  ACCOUNTING: ["orders:read", "services:read"],
  DRIVER: ["driver:services:read", "driver:services:accept", "driver:incidents:create"],
  CUSTOMER: ["orders:create", "orders:read", "services:read"],
};

export const permissionsFor = (role: Role): Permission[] => [
  ...ROLE_PERMISSIONS[role],
];
export function actorKind(role: Role): "customer" | "driver" | "transport" {
  if (role === "CUSTOMER") return "customer";
  if (role === "DRIVER") return "driver";
  return "transport";
}
