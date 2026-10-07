import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiStatus } from "@/components/nexo/ApiStatus";
import { EmptyState, PageHeader, Panel } from "@/components/nexo/ui";
import { usePortalSession } from "@/lib/auth/use-portal";
import { useApiOrders, useCreateOrder } from "@/lib/api/operations";
import { CARRIER_ORG } from "@/lib/domain/seed";
import { fmtTime } from "@/lib/domain/projections";

export const Route = createFileRoute("/cliente/pedidos")({ component: CustomerOrdersPage });

function localDate(hoursAhead: number) {
  const date = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function CustomerOrdersPage() {
  const session = usePortalSession();
  const orders = useApiOrders(session);
  const createOrder = useCreateOrder(session);
  const [form, setForm] = useState({
    reference: "",
    originName: "Valencia",
    originAddress: "Puerto de Valencia",
    originLat: "39.4699",
    originLng: "-0.3763",
    destinationName: "Madrid",
    destinationAddress: "Getafe, Madrid",
    destinationLat: "40.3057",
    destinationLng: "-3.7329",
    cargo: "",
    pallets: "1",
    plannedPickup: localDate(24),
    plannedDelivery: localDate(32),
  });

  const update = (field: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [field]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    createOrder.mutate(
      {
        carrierOrganizationId: CARRIER_ORG,
        reference: form.reference,
        origin: {
          name: form.originName,
          address: form.originAddress,
          lat: Number(form.originLat),
          lng: Number(form.originLng),
        },
        destination: {
          name: form.destinationName,
          address: form.destinationAddress,
          lat: Number(form.destinationLat),
          lng: Number(form.destinationLng),
        },
        cargo: form.cargo,
        pallets: Number(form.pallets),
        plannedPickup: new Date(form.plannedPickup).toISOString(),
        plannedDelivery: new Date(form.plannedDelivery).toISOString(),
      },
      {
        onSuccess: () => {
          toast.success("Pedido creado y guardado");
          setForm((current) => ({ ...current, reference: "", cargo: "" }));
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Pedidos" subtitle="Vertical conectada al backend · datos persistidos" />
      <Panel title="Crear pedido">
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit}>
          <Input
            required
            value={form.reference}
            onChange={(event) => update("reference", event.target.value)}
            placeholder="Referencia del cliente"
            aria-label="Referencia"
          />
          <Input
            required
            value={form.cargo}
            onChange={(event) => update("cargo", event.target.value)}
            placeholder="Mercancía"
            aria-label="Mercancía"
          />
          <Input
            required
            value={form.originName}
            onChange={(event) => update("originName", event.target.value)}
            placeholder="Origen"
            aria-label="Origen"
          />
          <Input
            required
            value={form.destinationName}
            onChange={(event) => update("destinationName", event.target.value)}
            placeholder="Destino"
            aria-label="Destino"
          />
          <Input
            required
            value={form.originAddress}
            onChange={(event) => update("originAddress", event.target.value)}
            placeholder="Dirección de recogida"
            aria-label="Dirección de recogida"
          />
          <Input
            required
            value={form.destinationAddress}
            onChange={(event) => update("destinationAddress", event.target.value)}
            placeholder="Dirección de entrega"
            aria-label="Dirección de entrega"
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              required
              type="number"
              step="any"
              value={form.originLat}
              onChange={(event) => update("originLat", event.target.value)}
              placeholder="Latitud origen"
              aria-label="Latitud origen"
            />
            <Input
              required
              type="number"
              step="any"
              value={form.originLng}
              onChange={(event) => update("originLng", event.target.value)}
              placeholder="Longitud origen"
              aria-label="Longitud origen"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              required
              type="number"
              step="any"
              value={form.destinationLat}
              onChange={(event) => update("destinationLat", event.target.value)}
              placeholder="Latitud destino"
              aria-label="Latitud destino"
            />
            <Input
              required
              type="number"
              step="any"
              value={form.destinationLng}
              onChange={(event) => update("destinationLng", event.target.value)}
              placeholder="Longitud destino"
              aria-label="Longitud destino"
            />
          </div>
          <Input
            required
            min="1"
            type="number"
            value={form.pallets}
            onChange={(event) => update("pallets", event.target.value)}
            placeholder="Palets"
            aria-label="Palets"
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              required
              type="datetime-local"
              value={form.plannedPickup}
              onChange={(event) => update("plannedPickup", event.target.value)}
              aria-label="Recogida planificada"
            />
            <Input
              required
              type="datetime-local"
              value={form.plannedDelivery}
              onChange={(event) => update("plannedDelivery", event.target.value)}
              aria-label="Entrega planificada"
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={createOrder.isPending}>
              {createOrder.isPending ? "Guardando…" : "Crear pedido"}
            </Button>
          </div>
        </form>
      </Panel>
      <Panel title="Mis pedidos">
        {orders.isPending ? (
          <p className="text-sm text-muted-foreground">Cargando pedidos…</p>
        ) : orders.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {orders.error.message}. Comprueba que el backend esté iniciado.
          </p>
        ) : orders.data?.length ? (
          <ul className="divide-y">
            {orders.data.map((order) => (
              <li
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
              >
                <span>
                  <strong>{order.reference}</strong> · {order.origin.name} →{" "}
                  {order.destination.name}
                </span>
                <span className="flex items-center gap-3">
                  Entrega {fmtTime(order.plannedDelivery)}{" "}
                  <ApiStatus status={order.service?.status ?? order.status} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Sin pedidos"
            text="Crea el primer pedido desde el formulario superior."
          />
        )}
      </Panel>
    </div>
  );
}
