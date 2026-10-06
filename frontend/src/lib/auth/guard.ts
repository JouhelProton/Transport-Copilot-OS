import { redirect } from "@tanstack/react-router";
import { canAccess, getSession } from "./session";
import type { Portal } from "@/lib/domain/types";

const LOGIN = {
  cliente: "/login/cliente",
  transportista: "/login/transportista",
  conductor: "/login/conductor",
} as const;

/** Protección por sesión + rol + organización. Se ejecuta en cliente (ssr:false). */
export function portalGuard(portal: Portal) {
  return () => {
    const s = getSession();
    const to = LOGIN[portal];
    if (!s) throw redirect({ to, search: { motivo: "sesion" } });
    if (!canAccess(s, portal)) throw redirect({ to, search: { motivo: "rol" } });
    if (!s.organizationId) throw redirect({ to, search: { motivo: "org" } });
    return { session: s };
  };
}

export const MOTIVOS: Record<string, string> = {
  sesion: "Inicia sesión para acceder a este portal.",
  rol: "Tu usuario no tiene permisos para este portal. Accede desde el portal de tu rol.",
  org: "Tu usuario no tiene una organización asignada.",
};

export const validateLoginSearch = (s: Record<string, unknown>): { motivo?: string } =>
  typeof s.motivo === "string" ? { motivo: s.motivo } : {};
