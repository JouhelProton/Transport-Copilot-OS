import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiStatus } from "@/components/nexo/ApiStatus";
import { EmptyState, PageHeader, Panel } from "@/components/nexo/ui";
import { usePortalSession } from "@/lib/auth/use-portal";
import { useAcceptOrder, useApiOrders, useApiServices } from "@/lib/api/operations";
import { fmtTime } from "@/lib/domain/projections";

export const Route = createFileRoute("/transportista/servicios/")({
  component: CarrierServicesPage,
});

function CarrierServicesPage() {
  const session = usePortalSession();
  const orders = useApiOrders(session);
  const services = useApiServices(session);
  const accept = useAcceptOrder(session);
  const [query, setQuery] = useState("");
  const pending = orders.data?.filter((order) => order.status === "SUBMITTED") ?? [];
  const filtered = (services.data ?? []).filter((service) =>
    `${service.id} ${service.reference} ${service.cargo} ${service.origin.name} ${service.destination.name}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  const acceptOrder = (orderId: string) => {
    accept.mutate(orderId, {
      onSuccess: () => toast.success("Pedido aceptado y servicio creado"),
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pedidos y servicios"
        subtitle="Vertical conectada al backend · PostgreSQL"
      />
      <Panel title={`Pedidos pendientes (${pending.length})`}>
        {orders.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {orders.error.message}
          </p>
        ) : pending.length ? (
          <ul className="divide-y text-sm">
            {pending.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span>
                  <strong>{order.reference}</strong> · {order.customerName} · {order.origin.name} →{" "}
                  {order.destination.name}
                </span>
                <Button size="sm" onClick={() => acceptOrder(order.id)} disabled={accept.isPending}>
                  Aceptar y crear servicio
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No hay pedidos pendientes.</p>
        )}
      </Panel>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por ID, referencia, mercancía o ciudad…"
          className="h-10 pl-9"
          aria-label="Buscar"
        />
      </div>
      {services.isPending ? (
        <p className="text-sm text-muted-foreground">Cargando servicios…</p>
      ) : services.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {services.error.message}. Comprueba que el backend esté iniciado.
        </p>
      ) : filtered.length ? (
        <Panel className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-muted-foreground">
              <tr>
                {["Servicio", "Ref. cliente", "Ruta", "Mercancía", "Entrega", "Estado"].map(
                  (heading) => (
                    <th key={heading} className="px-4 py-3 font-medium">
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((service) => (
                <tr key={service.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <Link
                      to="/transportista/servicios/$id"
                      params={{ id: service.id }}
                      className="font-semibold text-primary"
                    >
                      {service.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{service.reference}</td>
                  <td className="px-4 py-3">
                    {service.origin.name} → {service.destination.name}
                  </td>
                  <td className="px-4 py-3">
                    {service.cargo} · {service.pallets} pal.
                  </td>
                  <td className="px-4 py-3">{fmtTime(service.plannedDelivery)}</td>
                  <td className="px-4 py-3">
                    <ApiStatus status={service.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ) : (
        <EmptyState title="Sin servicios" text="Acepta un pedido para crear el primer servicio." />
      )}
    </div>
  );
}
