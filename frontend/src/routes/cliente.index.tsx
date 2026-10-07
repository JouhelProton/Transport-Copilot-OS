import { createFileRoute, Link } from "@tanstack/react-router";
import { ApiStatus } from "@/components/nexo/ApiStatus";
import { EmptyState, PageHeader, Panel } from "@/components/nexo/ui";
import { usePortalSession } from "@/lib/auth/use-portal";
import { useApiOrders } from "@/lib/api/operations";
import { fmtDateTime } from "@/lib/domain/projections";

export const Route = createFileRoute("/cliente/")({ component: CustomerHomePage });

function CustomerHomePage() {
  const session = usePortalSession();
  const orders = useApiOrders(session);
  const latest = orders.data?.[0];
  return (
    <div className="space-y-5">
      <PageHeader title="Resumen" subtitle="Estado operativo desde el backend" />
      {orders.isError ? (
        <EmptyState title="Backend no disponible" text={orders.error.message} />
      ) : latest ? (
        <Panel
          title="Último pedido"
          action={
            <Link to="/cliente/pedidos" className="text-sm text-primary">
              Ver todos →
            </Link>
          }
        >
          <div className="flex flex-wrap items-start justify-between gap-4 text-sm">
            <div>
              <p className="text-lg font-semibold">{latest.reference}</p>
              <p className="mt-1 text-muted-foreground">
                {latest.origin.name} → {latest.destination.name}
              </p>
              <p className="mt-1">
                {latest.cargo} · {latest.pallets} palets
              </p>
            </div>
            <div className="text-right">
              <ApiStatus status={latest.service?.status ?? latest.status} />
              <p className="mt-2 text-muted-foreground">
                Entrega {fmtDateTime(latest.plannedDelivery)}
              </p>
              {latest.service?.assignment && (
                <p className="mt-1">
                  {latest.service.assignment.driverName} · {latest.service.assignment.vehiclePlate}
                </p>
              )}
            </div>
          </div>
        </Panel>
      ) : orders.isPending ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <EmptyState title="Sin pedidos" text="Crea tu primer pedido para iniciar el flujo." />
      )}
      <Panel title="Módulos todavía en modo DEMO">
        <p className="text-sm text-muted-foreground">
          Seguimiento, mapas, incidencias, documentos y facturación conservan los datos de
          demostración hasta sus próximos hitos.
        </p>
      </Panel>
    </div>
  );
}
