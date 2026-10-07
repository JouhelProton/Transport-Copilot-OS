import { createFileRoute } from "@tanstack/react-router";
import { BackendServiceOps } from "@/components/transportista/BackendServiceOps";
import { EmptyState } from "@/components/nexo/ui";
import { usePortalSession } from "@/lib/auth/use-portal";
import { useApiServices } from "@/lib/api/operations";

export const Route = createFileRoute("/transportista/servicios/$id")({
  component: CarrierServicePage,
});

function CarrierServicePage() {
  const { id } = Route.useParams();
  const session = usePortalSession();
  const services = useApiServices(session);
  const service = services.data?.find((item) => item.id === id);

  if (services.isPending)
    return <p className="text-sm text-muted-foreground">Cargando servicio…</p>;
  if (services.isError)
    return <EmptyState title="No se pudo cargar el servicio" text={services.error.message} />;
  return service ? (
    <BackendServiceOps service={service} />
  ) : (
    <EmptyState title="Servicio no encontrado" text="No existe o no pertenece a tu organización." />
  );
}
