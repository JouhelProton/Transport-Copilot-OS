/**
 * Mutaciones centralizadas y validadas (Zod) + control de permisos por rol y
 * organización. En modo real se moverán a server functions con RLS.
 */
import { z } from "zod";
import { commit, getState } from "./demo-backend";
import type { Session } from "@/lib/auth/session";
import type { DemoState, Role, ServiceEvent } from "./types";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const id = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();

function pushEvent(d: DemoState, e: Omit<ServiceEvent, "id" | "at">) {
  d.events.push({ ...e, id: id(), at: now() });
}
function audit(d: DemoState, s: Session, action: string, target: string) {
  d.audit.push({ id: id(), at: now(), actor: `${s.name} (${s.role})`, action, target });
}

function guard(s: Session | null, roles: Role[], serviceId: string) {
  if (!s) return { error: "Sesión no válida" } as const;
  if (!roles.includes(s.role)) return { error: "No tienes permisos para esta acción" } as const;
  const svc = getState().services.find((x) => x.id === serviceId);
  if (!svc) return { error: "Servicio no encontrado" } as const;
  const orgOk = s.role === "CUSTOMER" ? svc.customerOrgId === s.organizationId : svc.carrierOrgId === s.organizationId;
  if (!orgOk) return { error: "El servicio no pertenece a tu organización" } as const;
  if (s.role === "DRIVER" && svc.driverId !== s.driverId) return { error: "Este servicio no está asignado a ti" } as const;
  return { svc } as const;
}

const INTERNAL: Role[] = ["SUPER_ADMIN", "TRANSPORT_ADMIN", "DISPATCHER", "OPERATIONS"];

const incidentSchema = z.object({
  serviceId: z.string().min(1),
  type: z.enum(["RETRASO", "TEMPERATURA", "DAÑO", "DOCUMENTACION", "ACCESO", "OTRO"]),
  description: z.string().trim().min(5, "Describe la incidencia (mín. 5 caracteres)").max(1000),
});

export function reportIncident(s: Session | null, input: unknown): ActionResult {
  const p = incidentSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const g = guard(s, ["CUSTOMER", "DRIVER", ...INTERNAL], p.data.serviceId);
  if ("error" in g) return { ok: false, error: g.error! };
  commit((d) => {
    d.incidents.unshift({
      id: `INC-${id().slice(0, 5).toUpperCase()}`,
      serviceId: p.data.serviceId,
      organizationIds: [g.svc.carrierOrgId, g.svc.customerOrgId],
      type: p.data.type,
      description: p.data.description,
      reportedByRole: s!.role,
      reportedByName: s!.name,
      at: now(),
      status: "ABIERTA",
    });
    pushEvent(d, { serviceId: p.data.serviceId, type: "INCIDENCIA", message: `Incidencia (${p.data.type}) reportada: ${p.data.description}`, actorRole: s!.role, actorName: s!.name, visibility: "ALL" });
    audit(d, s!, "Incidencia creada", p.data.serviceId);
  });
  return { ok: true, message: "Incidencia registrada (simulación DEMO)" };
}

const commentSchema = z.object({ serviceId: z.string(), text: z.string().trim().min(2, "Escribe un comentario").max(500) });
export function addComment(s: Session | null, input: unknown): ActionResult {
  const p = commentSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const g = guard(s, ["CUSTOMER", ...INTERNAL], p.data.serviceId);
  if ("error" in g) return { ok: false, error: g.error! };
  commit((d) => pushEvent(d, { serviceId: p.data.serviceId, type: "COMENTARIO", message: p.data.text, actorRole: s!.role, actorName: s!.name, visibility: "ALL" }));
  return { ok: true, message: "Comentario añadido" };
}

export function reviewIncident(s: Session | null, incidentId: string, status: "EN_REVISION" | "RESUELTA"): ActionResult {
  const inc = getState().incidents.find((i) => i.id === incidentId);
  if (!inc) return { ok: false, error: "Incidencia no encontrada" };
  const g = guard(s, INTERNAL, inc.serviceId);
  if ("error" in g) return { ok: false, error: g.error! };
  commit((d) => {
    const i = d.incidents.find((x) => x.id === incidentId)!;
    i.status = status;
    pushEvent(d, { serviceId: inc.serviceId, type: "INCIDENCIA_" + status, message: `Incidencia ${incidentId} ${status === "RESUELTA" ? "resuelta" : "en revisión por tráfico"}`, actorRole: s!.role, actorName: s!.name, visibility: "ALL" });
    audit(d, s!, `Incidencia → ${status}`, incidentId);
  });
  return { ok: true, message: status === "RESUELTA" ? "Incidencia resuelta" : "Incidencia en revisión" };
}

const assignSchema = z.object({ serviceId: z.string(), vehicleId: z.string().min(1, "Selecciona vehículo"), driverId: z.string().min(1, "Selecciona conductor") });
export function assignService(s: Session | null, input: unknown): ActionResult {
  const p = assignSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const g = guard(s, ["SUPER_ADMIN", "TRANSPORT_ADMIN", "DISPATCHER"], p.data.serviceId);
  if ("error" in g) return { ok: false, error: g.error! };
  commit((d) => {
    const svc = d.services.find((x) => x.id === p.data.serviceId)!;
    const veh = d.vehicles.find((v) => v.id === p.data.vehicleId);
    const drv = d.drivers.find((v) => v.id === p.data.driverId);
    svc.vehicleId = p.data.vehicleId;
    svc.driverId = p.data.driverId;
    svc.assignmentConfirmed = true;
    if (svc.status === "PLANIFICADO") svc.status = "ASIGNADO";
    pushEvent(d, { serviceId: svc.id, type: "ASIGNACION_CONFIRMADA", message: `Asignación confirmada: ${veh?.plate} · ${drv?.name}`, actorRole: s!.role, actorName: s!.name, visibility: "ALL" });
    audit(d, s!, "Asignación confirmada", svc.id);
  });
  return { ok: true, message: "Asignación confirmada" };
}

export function driverArrived(s: Session | null, serviceId: string): ActionResult {
  const g = guard(s, ["DRIVER"], serviceId);
  if ("error" in g) return { ok: false, error: g.error! };
  if (!["EN_RUTA", "ASIGNADO"].includes(g.svc.status)) return { ok: false, error: "La llegada ya fue registrada" };
  commit((d) => {
    const svc = d.services.find((x) => x.id === serviceId)!;
    svc.status = "EN_DESTINO";
    svc.progress = 1;
    svc.position = { lat: svc.destination.lat, lng: svc.destination.lng, simulated: true, at: now() };
    pushEvent(d, { serviceId, type: "LLEGADA", message: `Conductor en destino: ${svc.destination.name}`, actorRole: "DRIVER", actorName: s!.name, visibility: "ALL" });
  });
  return { ok: true, message: "Llegada confirmada (simulación DEMO)" };
}

const podSchema = z.object({ serviceId: z.string(), receiverName: z.string().trim().min(2, "Indica quién recibe").max(100), fileName: z.string().min(1) });
export function completeDelivery(s: Session | null, input: unknown): ActionResult {
  const p = podSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const g = guard(s, ["DRIVER"], p.data.serviceId);
  if ("error" in g) return { ok: false, error: g.error! };
  if (g.svc.status !== "EN_DESTINO") return { ok: false, error: "Primero confirma la llegada a destino" };
  commit((d) => {
    const svc = d.services.find((x) => x.id === p.data.serviceId)!;
    svc.status = "ENTREGADO";
    svc.actualDelivery = now();
    svc.delayed = false;
    svc.pod = { fileName: p.data.fileName, receiverName: p.data.receiverName, at: now(), validated: false };
    svc.documents.push({ id: id(), name: `POD ${svc.id} (muestra DEMO)`, type: "POD", visibleToCustomer: false, createdAt: now() });
    pushEvent(d, { serviceId: svc.id, type: "ENTREGA", message: `Entrega completada. Recibe: ${p.data.receiverName}. POD subido`, actorRole: "DRIVER", actorName: s!.name, visibility: "ALL" });
  });
  return { ok: true, message: "Entrega registrada y POD subido (DEMO)" };
}

export function validatePod(s: Session | null, serviceId: string): ActionResult {
  const g = guard(s, ["SUPER_ADMIN", "TRANSPORT_ADMIN", "OPERATIONS", "DISPATCHER"], serviceId);
  if ("error" in g) return { ok: false, error: g.error! };
  if (!g.svc.pod) return { ok: false, error: "No hay POD para validar" };
  if (g.svc.pod.validated) return { ok: false, error: "El POD ya está validado" };
  commit((d) => {
    const svc = d.services.find((x) => x.id === serviceId)!;
    svc.pod!.validated = true;
    svc.pod!.validatedAt = now();
    svc.status = "POD_VALIDADO";
    svc.documents.forEach((doc) => doc.type === "POD" && (doc.visibleToCustomer = true));
    pushEvent(d, { serviceId, type: "POD_VALIDADO", message: "POD validado por operaciones", actorRole: s!.role, actorName: s!.name, visibility: "ALL" });
    audit(d, s!, "POD validado", serviceId);
    // Automatización: POD validado → listo para facturar
    const auto = d.automations.find((a) => a.id === "au1");
    if (auto?.enabled) {
      svc.status = "LISTO_FACTURAR";
      svc.readyToInvoice = true;
      d.invoices.push({ id: `BOR-${svc.id}`, serviceId, customerOrgId: svc.customerOrgId, amount: svc.price, status: "BORRADOR", demo: true });
      pushEvent(d, { serviceId, type: "LISTO_FACTURAR", message: "Automatización: servicio listo para facturar", actorRole: "SYSTEM", actorName: "Automatización", visibility: "INTERNAL" });
      pushEvent(d, { serviceId, type: "CERRADO", message: "Servicio cerrado. Documentación disponible", actorRole: "SYSTEM", actorName: "Sistema", visibility: "ALL" });
    }
  });
  return { ok: true, message: "POD validado. Automatización ejecutada (DEMO)" };
}

export function toggleAutomation(s: Session | null, automationId: string): ActionResult {
  if (!s || !["SUPER_ADMIN", "TRANSPORT_ADMIN"].includes(s.role)) return { ok: false, error: "Solo administradores pueden cambiar automatizaciones" };
  commit((d) => {
    const a = d.automations.find((x) => x.id === automationId);
    if (a) a.enabled = !a.enabled;
  });
  return { ok: true, message: "Automatización actualizada" };
}

export function shareLocation(s: Session | null, serviceId: string, coords?: { lat: number; lng: number }): ActionResult {
  const g = guard(s, ["DRIVER"], serviceId);
  if ("error" in g) return { ok: false, error: g.error! };
  commit((d) => {
    const svc = d.services.find((x) => x.id === serviceId)!;
    const sim = !coords;
    const pr = Math.min(0.95, svc.progress + 0.1);
    svc.progress = svc.status === "EN_RUTA" ? pr : svc.progress;
    const pos = coords ?? {
      lat: svc.origin.lat + (svc.destination.lat - svc.origin.lat) * svc.progress,
      lng: svc.origin.lng + (svc.destination.lng - svc.origin.lng) * svc.progress,
    };
    svc.position = { ...pos, simulated: sim, at: now() };
    pushEvent(d, { serviceId, type: "POSICION", message: sim ? "Posición DEMO simulada actualizada" : "Posición compartida por el conductor", actorRole: "DRIVER", actorName: s!.name, visibility: "INTERNAL" });
  });
  return { ok: true, message: coords ? "Ubicación compartida una vez (no en segundo plano)" : "Ubicación DEMO simulada enviada" };
}
