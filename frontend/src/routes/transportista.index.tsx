import { createFileRoute, Link } from "@tanstack/react-router";
import { AlarmClock, FileClock, Receipt, Route as RouteIcon, TriangleAlert, Truck } from "lucide-react";
import { Kpi, PageHeader, Panel, StatusBadge } from "@/components/nexo/ui";
import { MapView } from "@/components/nexo/MapView";
import { useCarrierServices } from "@/lib/auth/use-portal";
import { useDemoState } from "@/lib/domain/demo-backend";
import { fmtTime } from "@/lib/domain/projections";

export const Route = createFileRoute("/transportista/")({ component: Page });
function Page() {
  const services = useCarrierServices();
  const openInc = useDemoState((s) => s.incidents.filter((i) => i.status !== "RESUELTA").length);
  return (
    <div className="space-y-6">
      <PageHeader title="Panel operativo" subtitle="Transportes Valencia Demo · datos DEMO" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <Kpi label="Servicios hoy" value={services.length} icon={<Truck className="h-5 w-5" />} />
        <Kpi label="En ruta" value={services.filter((s) => s.status === "EN_RUTA").length} icon={<RouteIcon className="h-5 w-5" />} />
        <Kpi label="Retrasos" value={services.filter((s) => s.delayed).length} icon={<AlarmClock className="h-5 w-5" />} tone="warn" />
        <Kpi label="Incidencias abiertas" value={openInc} icon={<TriangleAlert className="h-5 w-5" />} tone="bad" />
        <Kpi label="POD pendientes" value={services.filter((s) => s.pod && !s.pod.validated).length} icon={<FileClock className="h-5 w-5" />} tone="warn" />
        <Kpi label="Listo para facturar" value={services.filter((s) => s.readyToInvoice).length} icon={<Receipt className="h-5 w-5" />} tone="ok" />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Servicios de hoy">
          <ul className="divide-y">{services.map((s) => (
            <li key={s.id}><Link to="/transportista/servicios/$id" params={{ id: s.id }} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm hover:text-primary">
              <span><strong>{s.id}</strong> · {s.origin.name.split(" —")[0]} → {s.destination.name.split(" —")[0]}</span>
              <span className="flex items-center gap-2">{fmtTime(s.eta ?? s.plannedDelivery)} <StatusBadge status={s.status} /></span>
            </Link></li>))}</ul>
        </Panel>
        <MapView services={services.filter((s) => s.position)} height="h-96" />
      </div>
    </div>
  );
}
