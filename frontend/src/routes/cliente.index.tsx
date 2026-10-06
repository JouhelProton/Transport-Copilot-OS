import { createFileRoute } from "@tanstack/react-router";
import { CustomerServiceDetail } from "@/components/cliente/CustomerServiceDetail";
import { EmptyState, PageHeader } from "@/components/nexo/ui";
import { useCustomerServices, usePortalSession } from "@/lib/auth/use-portal";

export const Route = createFileRoute("/cliente/")({ component: Page });
function Page() {
  const session = usePortalSession();
  const services = useCustomerServices();
  const main = services.find((s) => s.id === "NV-24081") ?? services[0];
  return (
    <div>
      <PageHeader title="Resumen" subtitle={`${services.length} servicios · datos DEMO`} />
      {main ? <CustomerServiceDetail svc={main} session={session} /> : <EmptyState title="Sin servicios" />}
    </div>
  );
}
