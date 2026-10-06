import { createFileRoute, Link } from "@tanstack/react-router";
import { EmptyState, PageHeader, Panel } from "@/components/nexo/ui";
import { usePortalSession } from "@/lib/auth/use-portal";
import { useDemoState } from "@/lib/domain/demo-backend";
import { fmtDateTime } from "@/lib/domain/projections";

export const Route = createFileRoute("/transportista/incidencias")({ component: Page });
function Page() {
  const s = usePortalSession();
  const list = useDemoState((st) => st.incidents.filter((i) => i.organizationIds.includes(s.organizationId)));
  return (
    <div>
      <PageHeader title="Incidencias" />
      {list.length ? <Panel><ul className="divide-y text-sm">{list.map((i) => (
        <li key={i.id} className="py-3"><div className="flex flex-wrap justify-between gap-2"><Link to="/transportista/servicios/$id" params={{ id: i.serviceId }} className="font-semibold text-primary">{i.id} · {i.serviceId}</Link><span>{i.status}</span></div>
          <p>{i.type}: {i.description}</p><p className="text-xs text-muted-foreground">{i.reportedByName} · {fmtDateTime(i.at)}</p></li>))}</ul></Panel>
        : <EmptyState title="Sin incidencias" text="Cuando cliente o conductor reporten una incidencia aparecerá aquí." />}
    </div>
  );
}
