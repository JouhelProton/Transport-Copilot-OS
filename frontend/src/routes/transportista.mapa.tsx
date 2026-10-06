import { createFileRoute } from "@tanstack/react-router";
import { MapView } from "@/components/nexo/MapView";
import { PageHeader } from "@/components/nexo/ui";
import { useCarrierServices } from "@/lib/auth/use-portal";

export const Route = createFileRoute("/transportista/mapa")({
  component: CarrierMapPage,
});

function CarrierMapPage() {
  const services = useCarrierServices();
  return (
    <div>
      <PageHeader
        title="Mapa"
        subtitle="Google Maps con posiciones recibidas por la plataforma (datos DEMO)"
      />
      <MapView services={services} height="h-[560px]" />
    </div>
  );
}
