import { createFileRoute } from "@tanstack/react-router";
import { ServiceDocumentsPanel } from "@/components/documents/ServiceDocumentsPanel";
import { EmptyState, PageHeader } from "@/components/nexo/ui";
import { useApiServices } from "@/lib/api/operations";
import { usePortalSession } from "@/lib/auth/use-portal";

export const Route = createFileRoute("/cliente/documentos")({ component: Page });

function Page() {
  const session = usePortalSession();
  const services = useApiServices(session);
  return (
    <div>
      <PageHeader title="Documentos" subtitle="Documentos compartidos y POD aprobados de tus servicios" />
      {services.isLoading ? <p className="text-sm text-muted-foreground">Cargando servicios…</p> : services.isError ? <p role="alert" className="text-sm text-destructive">{services.error.message}</p> : services.data?.length ? <div className="space-y-5">{services.data.map((service) => <div key={service.id}><p className="mb-2 text-sm font-semibold text-muted-foreground">{service.reference} · {service.origin.name} → {service.destination.name}</p><ServiceDocumentsPanel session={session} serviceId={service.id} /></div>)}</div> : <EmptyState title="Sin documentos" text="El POD aparecerá aquí cuando el transportista lo apruebe." />}
    </div>
  );
}
