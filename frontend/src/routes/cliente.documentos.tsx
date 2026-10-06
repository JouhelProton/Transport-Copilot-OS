import { createFileRoute } from "@tanstack/react-router";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DemoBadge, EmptyState, PageHeader, Panel } from "@/components/nexo/ui";
import { useCustomerServices } from "@/lib/auth/use-portal";
import { fmtDateTime } from "@/lib/domain/projections";

export const Route = createFileRoute("/cliente/documentos")({ component: Page });
function Page() {
  const docs = useCustomerServices().flatMap((s) => s.documents.map((d) => ({ ...d, serviceId: s.id })));
  return (
    <div>
      <PageHeader title="Documentos" subtitle="Solo documentos compartidos contigo · DEMO" />
      {docs.length ? (
        <Panel>
          <ul className="divide-y">
            {docs.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /><strong>{d.name}</strong> · {d.serviceId} · {fmtDateTime(d.createdAt)}</span>
                <span className="flex items-center gap-2"><DemoBadge /><Button size="sm" variant="outline" onClick={() => toast.success(`Descarga simulada de ${d.name}. En DEMO no se genera archivo real.`)}><Download className="h-4 w-4" /> Descargar</Button></span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : <EmptyState title="Sin documentos" text="El POD aparecerá aquí cuando el transportista lo valide." />}
    </div>
  );
}
