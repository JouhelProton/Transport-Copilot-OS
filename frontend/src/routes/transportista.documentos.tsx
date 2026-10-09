import { createFileRoute } from "@tanstack/react-router";
import { ServiceDocumentsPanel } from "@/components/documents/ServiceDocumentsPanel";
import { EmptyState, PageHeader } from "@/components/nexo/ui";
import { useApiServices } from "@/lib/api/operations";
import { usePortalSession } from "@/lib/auth/use-portal";

export const Route = createFileRoute("/transportista/documentos")({ component: Page });

function Page() {
  const session = usePortalSession();
  const services = useApiServices(session);
  return (
    <div>
      <PageHeader title="Documentos y POD" subtitle="Archivos privados, validación operativa y evidencias por servicio" />
      {services.isLoading ? <p className="text-sm text-muted-foreground">Cargando servicios…</p> : services.isError ? <p role="alert" className="text-sm text-destructive">{services.error.message}</p> : services.data?.length ? <div className="space-y-5">{services.data.map((service) => <div key={service.id}><p className="mb-2 text-sm font-semibold text-muted-foreground">{service.reference} · {service.customerName}</p><ServiceDocumentsPanel session={session} serviceId={service.id} canManage /></div>)}</div> : <EmptyState title="Sin servicios" text="Los documentos se organizan dentro de cada servicio." />}
    </div>
  );
}
