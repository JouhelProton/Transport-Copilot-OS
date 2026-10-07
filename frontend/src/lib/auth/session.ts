import { useSyncExternalStore } from "react";
import { z } from "zod";
import { PORTAL_ROLES, type Portal, type Role } from "@/lib/domain/types";

export type Permission =
  | "orders:create"
  | "orders:read"
  | "orders:accept"
  | "services:read"
  | "services:assign"
  | "drivers:read"
  | "vehicles:read";

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
}

interface ApiErrorBody {
  error?: { message?: string };
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
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
  const response = await fetch(`${API_BASE}/api/v1/auth${path}`, {
    ...init,
    credentials: "include",
    headers: { ...(init?.body ? { "content-type": "application/json" } : {}), ...init?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new Error(body.error?.message ?? `Error de autenticación (${response.status})`);
  }
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
    .catch(() => {
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
      const session = normalize(data);
      if (!canAccess(session, portal)) {
        await authRequest<void>("/logout", { method: "POST" });
        publish(null);
        return { ok: false as const, error: "Este usuario no tiene permisos para este portal." };
      }
      publish(session);
      const verifiedSession = await ensureSession(true);
      if (!verifiedSession)
        return { ok: false as const, error: "No se pudo verificar la sesión creada" };
      return { ok: true as const, session: verifiedSession };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "No se pudo iniciar sesión",
      };
    }
  },
  async signOut() {
    try {
      await authRequest<void>("/logout", { method: "POST" });
    } finally {
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
