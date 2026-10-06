// Proyecciones por rol: cada portal recibe solo lo que puede ver.
import type { Session } from "@/lib/auth/session";
import { FINANCE_ROLES, type DemoState, type Service } from "./types";

export type CustomerService = Omit<Service, "price" | "cost" | "internalNotes" | "documents"> & {
  documents: Service["documents"];
};

export function customerServices(s: DemoState, session: Session): CustomerService[] {
  return s.services
    .filter((x) => x.customerOrgId === session.organizationId)
    .map(({ price: _p, cost: _c, internalNotes: _n, ...rest }) => ({
      ...rest,
      documents: rest.documents.filter((d) => d.visibleToCustomer),
    }));
}

export function carrierServices(s: DemoState, session: Session) {
  return s.services.filter((x) => x.carrierOrgId === session.organizationId);
}

export function driverServices(s: DemoState, session: Session) {
  return s.services.filter((x) => x.carrierOrgId === session.organizationId && x.driverId === session.driverId);
}

export function visibleEvents(s: DemoState, serviceId: string, session: Session) {
  const internal = session.role !== "CUSTOMER";
  return s.events
    .filter((e) => e.serviceId === serviceId && (internal || e.visibility === "ALL"))
    .sort((a, b) => b.at.localeCompare(a.at));
}

export const canSeeFinance = (session: Session | null) => !!session && FINANCE_ROLES.includes(session.role);

export const fmtTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "—";
export const fmtDateTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
export const fmtEur = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
