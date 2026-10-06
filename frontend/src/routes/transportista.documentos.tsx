import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/nexo/ui";
import { useCarrierServices } from "@/lib/auth/use-portal";

export const Route = createFileRoute("/transportista/documentos")({ component: Page });
function Page() {
  const services = useCarrierServices();
  return (
    <div>
      <PageHeader title="Documentos y POD" />
      <Panel><ul className="divide-y text-sm">{services.flatMap((s) => s.documents.map((d) => (
        <li key={d.id} className="flex flex-wrap justify-between gap-2 py-3"><span>{d.name}</span>
          <span className="flex gap-3 text-muted-foreground">{d.visibleToCustomer ? "Visible para cliente" : "Interno"}
            {d.type === "POD" && s.pod && !s.pod.validated && <Link to="/transportista/servicios/$id" params={{ id: s.id }} className="font-medium text-primary">Validar POD</Link>}</span></li>)))}</ul></Panel>
    </div>
  );
}
