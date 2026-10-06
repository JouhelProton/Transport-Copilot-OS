import { createFileRoute } from "@tanstack/react-router";
import { EmptyState, PageHeader, Panel, StatusBadge } from "@/components/nexo/ui";
import { useCustomerServices } from "@/lib/auth/use-portal";
import { fmtTime } from "@/lib/domain/projections";

export const Route = createFileRoute("/cliente/pedidos")({ component: Page });
function Page() {
  const services = useCustomerServices();
  return (
    <div>
      <PageHeader title="Pedidos" subtitle="Datos DEMO" />
      {services.length ? (
        <Panel>
          <ul className="divide-y">
            {services.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span><strong>{s.id}</strong> · {s.origin.name} → {s.destination.name}</span>
                <span className="flex items-center gap-3">ETA {fmtTime(s.actualDelivery ?? s.eta ?? s.plannedDelivery)} <StatusBadge status={s.status} /> {s.documents.length} docs</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : <EmptyState title="Sin datos" />}
    </div>
  );
}
