import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/nexo/ui";
import { usePortalSession } from "@/lib/auth/use-portal";
import { useDemoState } from "@/lib/domain/demo-backend";

export const Route = createFileRoute("/transportista/flota")({ component: Page });
function Page() {
  const s = usePortalSession();
  const vehicles = useDemoState((st) => st.vehicles.filter((v) => v.organizationId === s.organizationId));
  const drivers = useDemoState((st) => st.drivers.filter((v) => v.organizationId === s.organizationId));
  return (
    <div>
      <PageHeader title="Flota y conductores" subtitle="Datos DEMO" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Vehículos"><ul className="divide-y text-sm">{vehicles.map((v) => <li key={v.id} className="flex justify-between py-3"><span><strong>{v.plate}</strong> · {v.type}</span><span className="text-muted-foreground">{v.status}</span></li>)}</ul></Panel>
        <Panel title="Conductores"><ul className="divide-y text-sm">{drivers.map((d) => <li key={d.id} className="flex justify-between py-3"><span><strong>{d.name}</strong> · {d.license}</span><span className="text-muted-foreground">{d.phone} · {d.status}</span></li>)}</ul></Panel>
      </div>
    </div>
  );
}
