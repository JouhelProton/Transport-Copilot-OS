import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/nexo/ui";
import { ServiceOps } from "@/components/transportista/ServiceOps";
import { useCarrierServices } from "@/lib/auth/use-portal";

export const Route = createFileRoute("/transportista/servicios/$id")({ component: Page });
function Page() {
  const { id } = Route.useParams();
  const svc = useCarrierServices().find((s) => s.id === id);
  return svc ? <ServiceOps svc={svc} /> : <EmptyState title="Servicio no encontrado" text="No existe o no pertenece a tu organización." />;
}
