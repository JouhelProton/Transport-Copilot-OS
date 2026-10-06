import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DemoBadge, EmptyState, PageHeader, Panel } from "@/components/nexo/ui";
import { usePortalSession } from "@/lib/auth/use-portal";
import { useDemoState } from "@/lib/domain/demo-backend";
import { fmtEur } from "@/lib/domain/projections";

export const Route = createFileRoute("/cliente/facturacion")({ component: Page });
function Page() {
  const session = usePortalSession();
  const invoices = useDemoState((s) => s.invoices.filter((i) => i.customerOrgId === session.organizationId));
  return (
    <div>
      <PageHeader title="Facturación" subtitle="Facturas · DEMO, sin valor fiscal" />
      {invoices.length ? (
        <Panel><ul className="divide-y">{invoices.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
            <span><strong>{i.id}</strong> · servicio {i.serviceId} · {i.status === "BORRADOR" ? "Pendiente de emisión" : "Emitida"}</span>
            <span className="flex items-center gap-3">{fmtEur(i.amount)} <DemoBadge /><Button size="sm" variant="outline" onClick={() => toast.success("Descarga simulada. No se emiten facturas reales.")}>PDF</Button></span>
          </li>))}</ul></Panel>
      ) : <EmptyState title="Sin facturas" text="Los servicios validados se facturan desde el portal del transportista." />}
    </div>
  );
}
