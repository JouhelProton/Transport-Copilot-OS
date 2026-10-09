import { useSyncExternalStore } from "react";
import { z } from "zod";
import { PORTAL_ROLES, type Portal, type Role } from "@/lib/domain/types";
import { apiFetch, ApiRequestError } from "@/lib/platform/api-client";
import { authTransport } from "@/lib/platform/auth-transport";

export type Permission =
  | "orders:create"
  | "orders:read"
  | "orders:accept"
  | "services:read"
  | "services:assign"
  | "drivers:read"
  | "vehicles:read"
  | "driver:services:read"
  | "driver:services:accept"
  | "documents:read"
  | "documents:write"
  | "documents:validate"
  | "pod:read"
  | "pod:validate"
  | "driver:documents:read"
  | "driver:documents:write"
  | "driver:pod:submit";

export interface SessionMembership {
  id: string;
  role: Role;
  organization: { id: string; name: string; kind?: "CARRIER" | "SHIPPER" };
  permissions: Permission[];
}

export interface Session {
  userId: string;
  name: string;
  email: string;
  membershipId: string;
  role: Role;
  organizationId: string;
  organizationName: string;
  permissions: Permission[];
  memberships: SessionMembership[];
  expiresAt: string;
  customerId?: string;
  driverId?: string;
  mode: "SESSION";
}

interface AuthPayload {
  user: { id: string; name: string; email: string };
  activeMembership: SessionMembership;
  memberships: SessionMembership[];
  permissions: Permission[];
  expiresAt: string;
  customerId?: string;
  driverId?: string;
  sessionToken?: string;
}
const listeners = new Set<() => void>();
let current: Session | null = null;
let pendingLoad: Promise<Session | null> | null = null;

function publish(session: Session | null) {
  current = session;
  listeners.forEach((listener) => listener());
}

function normalize(data: AuthPayload): Session {
  return {
    userId: data.user.id,
    name: data.user.name,
    email: data.user.email,
    membershipId: data.activeMembership.id,
    role: data.activeMembership.role,
    organizationId: data.activeMembership.organization.id,
    organizationName: data.activeMembership.organization.name,
    permissions: data.permissions,
    memberships: data.memberships,
    expiresAt: data.expiresAt,
    ...(data.customerId ? { customerId: data.customerId } : {}),
    ...(data.driverId ? { driverId: data.driverId } : {}),
    mode: "SESSION",
  };
}

async function authRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const login = path === "/login";
  const resolvedPath = login ? authTransport.loginPath : path;
  const response = await apiFetch(`/auth${resolvedPath}`, init, !login);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const loginSchema = z.object({
  email: z.string().trim().email("Introduce un email válido").max(255),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(256),
});

export function getSession() {
  return current;
}

export async function ensureSession(force = false): Promise<Session | null> {
  if (current && !force) return current;
  if (pendingLoad) return pendingLoad;
  pendingLoad = authRequest<{ data: AuthPayload }>("/me")
    .then(({ data }) => {
      const session = normalize(data);
      publish(session);
      return session;
    })
    .catch(async (error) => {
      if (error instanceof ApiRequestError && error.status === 401) await authTransport.clear();
      publish(null);
      return null;
    })
    .finally(() => {
      pendingLoad = null;
    });
  return pendingLoad;
}

export function useSession() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => null,
  );
}

export function canAccess(session: Session | null, portal: Portal) {
  return !!session && PORTAL_ROLES[portal].includes(session.role);
}

export const auth = {
  async signIn(portal: Portal, email: string, password: string) {
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
    try {
      const { data } = await authRequest<{ data: AuthPayload }>("/login", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      await authTransport.persistLoginToken(data.sessionToken);
      const session = normalize(data);
      if (!canAccess(session, portal)) {
        await authRequest<void>("/logout", { method: "POST" });
        await authTransport.clear();
        publish(null);
        return { ok: false as const, error: "Este usuario no tiene permisos para este portal." };
      }
      publish(session);
      const verifiedSession = await ensureSession(true);
      if (!verifiedSession)
        return { ok: false as const, error: "No se pudo verificar la sesión creada" };
      return { ok: true as const, session: verifiedSession };
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) await authTransport.clear();
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "No se pudo iniciar sesión",
      };
    }
  },
  async signOut() {
    try {
      await authRequest<void>("/logout", { method: "POST" });
    } catch {
      // Sin red no se puede revocar todavía; el token local sí se elimina.
    } finally {
      await authTransport.clear();
      publish(null);
    }
  },
  async switchOrganization(membershipId: string) {
    await authRequest("/switch-organization", {
      method: "POST",
      body: JSON.stringify({ membershipId }),
    });
    return ensureSession(true);
  },
  async requestPasswordReset() {
    return {
      ok: false,
      message: "La recuperación de contraseña se habilitará en un hito posterior.",
    };
  },
};

export const DEV_ACCOUNTS: Record<Portal, Array<{ name: string; email: string; role: Role }>> = {
  cliente: [{ name: "Laura Pérez", email: "cliente@demo.nexo.local", role: "CUSTOMER" }],
  transportista: [
    { name: "Andrés Martí", email: "admin@demo.nexo.local", role: "TRANSPORT_ADMIN" },
    { name: "Sara Ruiz", email: "trafico@demo.nexo.local", role: "DISPATCHER" },
  ],
  conductor: [{ name: "Miguel García", email: "conductor@demo.nexo.local", role: "DRIVER" }],
};

export const DEV_PASSWORD = "Demo-Transport-2026!";
