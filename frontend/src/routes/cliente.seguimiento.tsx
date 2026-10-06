import { createFileRoute } from "@tanstack/react-router";
import { EmptyState, PageHeader, Panel, StatusBadge } from "@/components/nexo/ui";
import { MapView } from "@/components/nexo/MapView";
import { useCustomerServices } from "@/lib/auth/use-portal";
import { fmtTime } from "@/lib/domain/projections";

export const Route = createFileRoute("/cliente/seguimiento")({ component: Page });
function Page() {
  const services = useCustomerServices();
  if (!services.length)
    return <EmptyState title="Sin envíos activos" text="Cuando tengas envíos aparecerán aquí." />;
  return (
    <div className="space-y-5">
      <PageHeader title="Seguimiento" subtitle="Google Maps · posición simulada · datos DEMO" />
      <MapView services={services.filter((s) => s.position)} height="h-80" />
      <div className="grid gap-4 md:grid-cols-2">
        {services.map((s) => (
          <Panel key={s.id}>
            <div className="flex items-center justify-between">
              <strong>{s.id}</strong>
              <StatusBadge status={s.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {s.origin.name.split(" —")[0]} → {s.destination.name.split(" —")[0]}
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary"
                style={{ width: `${Math.round(s.progress * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-sm">
              {s.actualDelivery
                ? `Entregado ${fmtTime(s.actualDelivery)}`
                : `ETA ${fmtTime(s.eta ?? s.plannedDelivery)}`}
              {s.delayed && <span className="ml-2 font-semibold text-destructive">Retraso</span>}
            </p>
          </Panel>
        ))}
      </div>
    </div>
  );
}
