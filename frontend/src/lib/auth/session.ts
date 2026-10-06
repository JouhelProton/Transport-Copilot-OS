/**
 * Autenticación DEMO — claramente separada de la autenticación real.
 * La futura autenticación real (Lovable Cloud) implementará `AuthProvider`
 * con contraseñas gestionadas solo por el proveedor y roles en tabla aparte.
 */
import { useSyncExternalStore } from "react";
import { z } from "zod";
import { getState } from "@/lib/domain/demo-backend";
import { PORTAL_ROLES, type Portal, type Role } from "@/lib/domain/types";

export interface Session {
  userId: string;
  name: string;
  email: string;
  role: Role;
  organizationId: string;
  driverId?: string;
  mode: "DEMO";
}

export interface AuthProvider {
  signIn(portal: Portal, email: string, password: string): Promise<{ ok: true; session: Session } | { ok: false; error: string }>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<{ ok: boolean; message: string }>;
}

const KEY = "nexo-demo-session";
const listeners = new Set<() => void>();
let cached: Session | null | undefined;

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  if (cached !== undefined) return cached;
  try {
    cached = JSON.parse(window.sessionStorage.getItem(KEY) ?? "null");
  } catch {
    cached = null;
  }
  return cached ?? null;
}

function setSession(s: Session | null) {
  cached = s;
  if (s) window.sessionStorage.setItem(KEY, JSON.stringify(s));
  else window.sessionStorage.removeItem(KEY);
  listeners.forEach((l) => l());
}

export function useSession() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getSession,
    () => null,
  );
}

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Introduce tu email o usuario").max(255),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").max(128),
});

export function canAccess(session: Session | null, portal: Portal) {
  return !!session && PORTAL_ROLES[portal].includes(session.role);
}

export const demoAuth: AuthProvider = {
  async signIn(portal, email, password) {
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const user = getState().users.find((u) => u.email.toLowerCase() === parsed.data.email.toLowerCase());
    if (!user) return { ok: false, error: "No existe un usuario DEMO con ese email." };
    if (!PORTAL_ROLES[portal].includes(user.role))
      return { ok: false, error: "Este usuario no tiene permisos para este portal. Usa el acceso correspondiente a tu rol." };
    const session: Session = {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      driverId: user.driverId,
      mode: "DEMO",
    };
    setSession(session);
    return { ok: true, session };
  },
  async signOut() {
    setSession(null);
  },
  async requestPasswordReset() {
    return { ok: true, message: "Modo DEMO: no se envía ningún email. Con la autenticación real recibirás un enlace de recuperación." };
  },
};
