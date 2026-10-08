import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { EmptyState, PageHeader, Panel } from "@/components/nexo/ui";
import { usePortalSession } from "@/lib/auth/use-portal";
import { useApiIncidents, useUpdateIncident, type IncidentStatus } from "@/lib/api/operations";

export const Route = createFileRoute("/transportista/incidencias")({ component: Page });

function Page() {
  const session = usePortalSession();
  const incidents = useApiIncidents(session);
  const update = useUpdateIncident(session);
  const changeStatus = async (serviceId: string, incidentId: string, status: IncidentStatus) => {
    try {
      await update.mutateAsync({ serviceId, incidentId, status, note: "Estado actualizado desde el portal operativo" });
      toast.success("Incidencia actualizada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar la incidencia");
    }
  };
  return (
    <div>
      <PageHeader title="Incidencias operativas" subtitle="Comunicaciones persistidas por servicio" />
      {incidents.isError ? <p role="alert" className="mb-4 text-sm text-destructive">{incidents.error.message}</p> : null}
      {incidents.isLoading ? <p className="text-sm text-muted-foreground">Consultando incidencias…</p> : null}
      {incidents.data?.length ? <Panel><ul className="divide-y text-sm">{incidents.data.map((incident) => (
        <li key={incident.id} className="space-y-2 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link to="/transportista/servicios/$id" params={{ id: incident.serviceId }} className="font-semibold text-primary">{incident.type} · {incident.serviceId}</Link>
            <select aria-label={`Estado de ${incident.id}`} className="rounded-lg border bg-background px-3 py-2" value={incident.status} disabled={update.isPending} onChange={(event) => void changeStatus(incident.serviceId, incident.id, event.target.value as IncidentStatus)}>
              <option value="OPEN">Abierta</option><option value="IN_REVIEW">En revisión</option><option value="RESOLVED">Resuelta</option><option value="CLOSED">Cerrada</option>
            </select>
          </div>
          <p>{incident.description}</p>
          <p className="text-xs text-muted-foreground">Prioridad {incident.priority} · {incident.reportedBy.name} · {new Date(incident.reportedAt).toLocaleString("es-ES")}</p>
        </li>
      ))}</ul></Panel> : !incidents.isLoading ? <EmptyState title="Sin incidencias" text="Las incidencias comunicadas por conductores aparecerán aquí." /> : null}
    </div>
  );
}
