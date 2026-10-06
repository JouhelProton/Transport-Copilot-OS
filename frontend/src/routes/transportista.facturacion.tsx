import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Panel } from "@/components/nexo/ui";
import { usePortalSession } from "@/lib/auth/use-portal";
import { useDemoState } from "@/lib/domain/demo-backend";
import { canSeeFinance, fmtEur } from "@/lib/domain/projections";

export const Route = createFileRoute("/transportista/facturacion")({ component: Page });
function Page() {
  const s = usePortalSession();
  const ready = useDemoState((st) => st.services.filter((x) => x.carrierOrgId === s.organizationId && x.readyToInvoice));
  const finance = canSeeFinance(s);
  return (
    <div>
      <PageHeader title="Facturación" subtitle="Servicios listos para facturar" />
      {ready.length ? <Panel><ul className="divide-y text-sm">{ready.map((x) => (
        <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><span><strong>{x.id}</strong> · borrador BOR-{x.id}</span>
          <span className="flex items-center gap-3">{finance ? fmtEur(x.price) : "Importe oculto para tu rol"}
            <Button size="sm" variant="outline" onClick={() => toast.info("Simulación DEMO: no se emite ninguna factura real.")}>Emitir (simulado)</Button></span></li>))}</ul></Panel>
        : <EmptyState title="Nada listo para facturar" text="Valida un POD y la automatización marcará el servicio aquí." />}
    </div>
  );
}
