// Modelo de dominio compartido por los tres portales.
// Entidades preparadas (algunas solo tipadas, para la futura base de datos).
export type Role =
  | "SUPER_ADMIN"
  | "TRANSPORT_ADMIN"
  | "DISPATCHER"
  | "OPERATIONS"
  | "ACCOUNTING"
  | "DRIVER"
  | "CUSTOMER";

export type Portal = "cliente" | "transportista" | "conductor";

export const PORTAL_ROLES: Record<Portal, Role[]> = {
  cliente: ["CUSTOMER"],
  transportista: ["SUPER_ADMIN", "TRANSPORT_ADMIN", "DISPATCHER", "OPERATIONS", "ACCOUNTING"],
  conductor: ["DRIVER"],
};

export const FINANCE_ROLES: Role[] = ["SUPER_ADMIN", "TRANSPORT_ADMIN", "ACCOUNTING"];

export interface Organization { id: string; name: string; kind: "CARRIER" | "SHIPPER"; demo: true }
export interface User { id: string; name: string; email: string; role: Role; organizationId: string; driverId?: string }
export interface Driver { id: string; organizationId: string; name: string; phone: string; license: string; status: "ACTIVO" | "DESCANSO" }
export interface Vehicle { id: string; organizationId: string; plate: string; type: string; reefer: boolean; status: "EN_RUTA" | "DISPONIBLE" | "TALLER" }
export interface Customer { id: string; organizationId: string; customerOrgId: string; name: string; contact: string }

export type ServiceStatus =
  | "PLANIFICADO"
  | "ASIGNADO"
  | "EN_RUTA"
  | "EN_DESTINO"
  | "ENTREGADO"
  | "POD_VALIDADO"
  | "LISTO_FACTURAR";

export interface Location { name: string; address: string; lat: number; lng: number }
export interface DocumentRef { id: string; name: string; type: "CARTA_PORTE" | "DECA" | "POD" | "FACTURA" | "ALBARAN"; visibleToCustomer: boolean; createdAt: string }
export interface POD { fileName: string; receiverName: string; at: string; validated: boolean; validatedAt?: string }

/** Servicio (Order + Trip unificado en la demo). Un solo ID visible en los tres portales. */
export interface Service {
  id: string;
  carrierOrgId: string;
  customerOrgId: string;
  customerRef: string;
  origin: Location;
  destination: Location;
  cargo: string;
  pallets: number;
  tempMin?: number;
  tempMax?: number;
  plannedPickup: string;
  actualPickup?: string;
  plannedDelivery: string;
  eta?: string;
  actualDelivery?: string;
  status: ServiceStatus;
  assignmentConfirmed: boolean;
  vehicleId?: string;
  driverId?: string;
  position?: { lat: number; lng: number; simulated: boolean; at: string };
  progress: number; // 0..1
  delayed: boolean;
  // Datos internos — NUNCA se exponen al cliente
  price: number;
  cost: number;
  internalNotes: string;
  documents: DocumentRef[];
  pod?: POD;
  readyToInvoice: boolean;
}

export interface Incident {
  id: string;
  serviceId: string;
  organizationIds: string[];
  type: "RETRASO" | "TEMPERATURA" | "DAÑO" | "DOCUMENTACION" | "ACCESO" | "OTRO";
  description: string;
  reportedByRole: Role;
  reportedByName: string;
  at: string;
  status: "ABIERTA" | "EN_REVISION" | "RESUELTA";
}

export interface ServiceEvent {
  id: string;
  serviceId: string;
  type: string;
  message: string;
  actorRole: Role | "SYSTEM";
  actorName: string;
  at: string;
  visibility: "ALL" | "INTERNAL";
}

export interface Invoice { id: string; serviceId: string; customerOrgId: string; amount: number; status: "BORRADOR" | "EMITIDA"; demo: true }
export interface Automation { id: string; name: string; trigger: string; action: string; enabled: boolean }
export interface Integration { id: string; name: string; status: "PENDIENTE" | "SIMULADA" | "NO_CONFIGURADA"; description: string }
export interface AuditLog { id: string; at: string; actor: string; action: string; target: string }

export interface DemoState {
  version: number;
  organizations: Organization[];
  users: User[];
  drivers: Driver[];
  vehicles: Vehicle[];
  customers: Customer[];
  services: Service[];
  incidents: Incident[];
  events: ServiceEvent[];
  invoices: Invoice[];
  automations: Automation[];
  integrations: Integration[];
  audit: AuditLog[];
}

export const STATUS_LABEL: Record<ServiceStatus, string> = {
  PLANIFICADO: "Planificado",
  ASIGNADO: "Asignado",
  EN_RUTA: "En ruta",
  EN_DESTINO: "En destino",
  ENTREGADO: "Entregado",
  POD_VALIDADO: "POD validado",
  LISTO_FACTURAR: "Listo para facturar",
};
