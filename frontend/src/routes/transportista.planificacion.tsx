import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, Panel, StatusBadge } from "@/components/nexo/ui";
import { useCarrierServices } from "@/lib/auth/use-portal";
import { useDemoState } from "@/lib/domain/demo-backend";
import { fmtTime } from "@/lib/domain/projections";

export const Route = createFileRoute("/transportista/planificacion")({ component: Page });
function Page() {
  const services = useCarrierServices();
  const st = useDemoState((s) => s);
  return (
    <div>
      <PageHeader title="Planificación y asignación" subtitle="Abre un servicio para asignar o confirmar" />
      <div className="grid gap-4 md:grid-cols-3">{services.map((s) => (
        <Panel key={s.id}>
          <div className="flex justify-between"><strong>{s.id}</strong><StatusBadge status={s.status} /></div>
          <p className="mt-2 text-sm">{fmtTime(s.plannedPickup)} → {fmtTime(s.plannedDelivery)}</p>
          <p className="text-sm text-muted-foreground">{st.vehicles.find((v) => v.id === s.vehicleId)?.plate ?? "Sin vehículo"} · {st.drivers.find((d) => d.id === s.driverId)?.name ?? "Sin conductor"}</p>
          <p className="mt-1 text-xs">{s.assignmentConfirmed ? "Asignación confirmada" : "Pendiente de confirmar"}</p>
          <Link to="/transportista/servicios/$id" params={{ id: s.id }} className="mt-3 inline-block text-sm font-medium text-primary">Gestionar →</Link>
        </Panel>))}</div>
    </div>
  );
}
