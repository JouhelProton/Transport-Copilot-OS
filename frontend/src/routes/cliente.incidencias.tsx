import { createFileRoute } from "@tanstack/react-router";
import { EmptyState, PageHeader, Panel } from "@/components/nexo/ui";
import { IncidentForm } from "@/components/nexo/IncidentForm";
import { useCustomerServices, usePortalSession } from "@/lib/auth/use-portal";
import { useDemoState } from "@/lib/domain/demo-backend";
import { fmtDateTime } from "@/lib/domain/projections";

export const Route = createFileRoute("/cliente/incidencias")({ component: Page });
function Page() {
  const session = usePortalSession();
  const services = useCustomerServices();
  const incidents = useDemoState((s) => s.incidents.filter((i) => i.organizationIds.includes(session.organizationId)));
  const main = services.find((s) => s.id === "NV-24081") ?? services[0];
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <div>
        <PageHeader title="Incidencias" subtitle="Datos DEMO" />
        {incidents.length ? (
          <Panel><ul className="divide-y">{incidents.map((i) => (
            <li key={i.id} className="py-3 text-sm">
              <div className="flex justify-between gap-2"><strong>{i.serviceId} · {i.type}</strong><span className="rounded-full bg-muted px-2 text-xs">{i.status}</span></div>
              <p>{i.description}</p>
              <p className="text-xs text-muted-foreground">{i.reportedByName} · {fmtDateTime(i.at)}</p>
            </li>))}</ul></Panel>
        ) : <EmptyState title="Sin incidencias" text="Todo en orden." />}
      </div>
      {main && <Panel title={`Reportar en ${main.id}`}><IncidentForm serviceId={main.id} /></Panel>}
    </div>
  );
}
