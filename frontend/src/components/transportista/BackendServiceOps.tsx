import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiStatus } from "@/components/nexo/ApiStatus";
import { Panel } from "@/components/nexo/ui";
import { usePortalSession } from "@/lib/auth/use-portal";
import {
  useApiDrivers,
  useApiVehicles,
  useAssignService,
  type ApiService,
} from "@/lib/api/operations";
import { fmtDateTime } from "@/lib/domain/projections";

export function BackendServiceOps({ service }: { service: ApiService }) {
  const session = usePortalSession();
  const drivers = useApiDrivers(session);
  const vehicles = useApiVehicles(session);
  const assign = useAssignService(session);
  const [driverId, setDriverId] = useState(service.assignment?.driverId ?? "");
  const [vehicleId, setVehicleId] = useState(service.assignment?.vehicleId ?? "");
  const selectClass = "h-10 w-full rounded-lg border bg-card px-3 text-sm";

  const confirmAssignment = () => {
    assign.mutate(
      { serviceId: service.id, driverId, vehicleId },
      {
        onSuccess: () => toast.success("Conductor y vehículo asignados"),
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <div className="grid gap-5 xl:grid-cols-5">
      <div className="space-y-5 xl:col-span-3">
        <Panel
          title={
            <span className="flex items-center gap-3">
              Servicio {service.id} <ApiStatus status={service.status} />
            </span>
          }
          action={
            <Link to="/transportista/servicios" className="text-sm text-primary">
              ← Volver
            </Link>
          }
        >
          <dl className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Pedido / referencia</dt>
              <dd className="font-medium">
                {service.orderId}
                <br />
                {service.reference}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Cliente</dt>
              <dd className="font-medium">{service.customerName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Mercancía</dt>
              <dd className="font-medium">
                {service.cargo} · {service.pallets} palets
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Ruta</dt>
              <dd className="font-medium">
                {service.origin.name} → {service.destination.name}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Entrega planificada</dt>
              <dd className="font-medium">{fmtDateTime(service.plannedDelivery)}</dd>
            </div>
          </dl>
        </Panel>

        <Panel title="Asignación real">
          <div className="grid gap-3 sm:grid-cols-3">
            <select
              className={selectClass}
              value={vehicleId}
              onChange={(event) => setVehicleId(event.target.value)}
              aria-label="Vehículo"
            >
              <option value="">Vehículo…</option>
              {(vehicles.data ?? []).map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.plate} · {vehicle.type}
                </option>
              ))}
            </select>
            <select
              className={selectClass}
              value={driverId}
              onChange={(event) => setDriverId(event.target.value)}
              aria-label="Conductor"
            >
              <option value="">Conductor…</option>
              {(drivers.data ?? []).map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name} · {driver.status}
                </option>
              ))}
            </select>
            <Button
              onClick={confirmAssignment}
              disabled={!driverId || !vehicleId || assign.isPending}
            >
              <CheckCircle2 className="h-4 w-4" />{" "}
              {assign.isPending
                ? "Guardando…"
                : service.assignment
                  ? "Reasignar"
                  : "Confirmar asignación"}
            </Button>
          </div>
          {service.assignment && (
            <p className="mt-3 text-sm text-success">
              Asignado a {service.assignment.driverName} · {service.assignment.vehiclePlate}
            </p>
          )}
        </Panel>

        <Panel title="Funciones todavía en modo DEMO">
          <p className="text-sm text-muted-foreground">
            Tracking, incidencias, documentos, POD y facturación siguen usando los datos de
            demostración hasta sus próximos hitos.
          </p>
        </Panel>
      </div>

      <Panel title="Eventos persistidos" className="xl:col-span-2">
        <ol className="space-y-4 text-sm">
          {service.events.map((event) => (
            <li key={event.id} className="border-l-2 border-primary/30 pl-3">
              <p className="font-medium">{event.type}</p>
              <p className="text-xs text-muted-foreground">{fmtDateTime(event.occurredAt)}</p>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}
