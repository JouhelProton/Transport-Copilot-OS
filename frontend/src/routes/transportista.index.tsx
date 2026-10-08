import { createFileRoute, Link } from "@tanstack/react-router";
import { AlarmClock, MapPinOff, Route as RouteIcon, TriangleAlert, Truck } from "lucide-react";
import { EmptyState, Kpi, PageHeader, Panel } from "@/components/nexo/ui";
import { usePortalSession } from "@/lib/auth/use-portal";
import { useOperationalExceptions, type ApiOperationalException } from "@/lib/api/operations";

export const Route = createFileRoute("/transportista/")({ component: Page });

function attentionScore(service: ApiOperationalException) {
  if (service.operationalState?.delayLevel === "CONFIRMED") return 5;
  if (service.openIncidents > 0) return 4;
  if (service.operationalState?.delayLevel === "RISK") return 3;
  if (service.operationalState?.gpsStale) return 2;
  if (!service.eta || service.eta.status !== "AVAILABLE") return 1;
  return 0;
}

function fmt(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }) : "No disponible";
}

function Page() {
  const session = usePortalSession();
  const query = useOperationalExceptions(session);
  const services = [...(query.data ?? [])].sort((a, b) => attentionScore(b) - attentionScore(a));
  const delayed = services.filter((item) => ["RISK", "CONFIRMED"].includes(item.operationalState?.delayLevel ?? ""));
  const stale = services.filter((item) => item.operationalState?.gpsStale);
  const incidents = services.filter((item) => item.openIncidents > 0);
  const withoutEta = services.filter((item) => !item.eta || item.eta.status !== "AVAILABLE");

  return (
    <div className="space-y-6">
      <PageHeader title="Panel de excepciones" subtitle="Servicios reales que requieren decisión operativa" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi label="Servicios" value={services.length} icon={<Truck className="h-5 w-5" />} />
        <Kpi label="Retraso o riesgo" value={delayed.length} icon={<AlarmClock className="h-5 w-5" />} tone="warn" />
        <Kpi label="Con incidencias" value={incidents.length} icon={<TriangleAlert className="h-5 w-5" />} tone="bad" />
        <Kpi label="GPS desactualizado" value={stale.length} icon={<MapPinOff className="h-5 w-5" />} tone="warn" />
        <Kpi label="Sin ETA" value={withoutEta.length} icon={<RouteIcon className="h-5 w-5" />} />
      </div>
      <Panel title="Atención operativa">
        {query.isLoading ? <p className="text-sm text-muted-foreground">Consultando operaciones…</p> : null}
        {query.isError ? <p role="alert" className="text-sm text-destructive">No se pudo consultar el panel: {query.error.message}</p> : null}
        {!query.isLoading && !query.isError && services.length === 0 ? <EmptyState title="Sin servicios activos" text="Los servicios aparecerán aquí al ser creados." /> : null}
        {services.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="py-3">Servicio</th><th>Conductor</th><th>ETA</th><th>Estado operativo</th><th>Incidencias</th><th>Último GPS</th></tr></thead>
              <tbody className="divide-y">{services.map((service) => (
                <tr key={service.id} className="align-top">
                  <td className="py-4"><Link to="/transportista/servicios/$id" params={{ id: service.id }} className="font-semibold text-primary hover:underline">{service.reference}</Link><p className="text-xs text-muted-foreground">{service.customerName}</p></td>
                  <td className="py-4">{service.assignment?.driverName ?? "Sin asignar"}<p className="text-xs text-muted-foreground">{service.assignment?.vehiclePlate ?? "—"}</p></td>
                  <td className="py-4">{fmt(service.eta?.estimatedArrival)}<p className="text-xs text-muted-foreground">{service.eta?.source ?? "Sin proveedor"}</p></td>
                  <td className="py-4"><span className="font-semibold">{service.operationalState?.delayLevel ?? "DATA_INSUFFICIENT"}</span>{service.operationalState?.delayMinutes != null ? <p className="text-xs text-muted-foreground">{service.operationalState.delayMinutes} min</p> : null}</td>
                  <td className="py-4">{service.openIncidents}</td>
                  <td className="py-4">{fmt(service.currentPosition?.recordedAt)}{service.operationalState?.gpsStale ? <p className="text-xs font-semibold text-warning-foreground">Desactualizado</p> : null}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
