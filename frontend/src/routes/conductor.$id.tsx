import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  CloudOff,
  MapPin,
  Package,
  RefreshCw,
  Thermometer,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { ApiStatus } from "@/components/nexo/ApiStatus";
import { EmptyState, Panel } from "@/components/nexo/ui";
import { Button } from "@/components/ui/button";
import { usePortalSession } from "@/lib/auth/use-portal";
import { auth } from "@/lib/auth/session";
import { useAcceptDriverService, useDriverApiService } from "@/lib/api/operations";
import { ApiRequestError } from "@/lib/platform/api-client";
import { useOnlineStatus } from "@/lib/platform/connectivity";
import { fmtDateTime } from "@/lib/domain/projections";

export const Route = createFileRoute("/conductor/$id")({ component: DriverServiceDetail });

function DriverServiceDetail() {
  const { id } = Route.useParams();
  const session = usePortalSession();
  const online = useOnlineStatus();
  const service = useDriverApiService(session, id, online);
  const accept = useAcceptDriverService(session);
  const navigate = useNavigate();

  if (!online && !service.data)
    return <State title="Sin conexión" text="Conéctate a Internet para abrir este servicio." />;
  if (service.isPending)
    return <p className="py-8 text-center text-sm text-muted-foreground">Cargando servicio…</p>;
  if (service.error instanceof ApiRequestError && service.error.status === 401)
    return (
      <State
        title="La sesión ha caducado"
        text="Vuelve a iniciar sesión para continuar."
        action={
          <Button
            className="h-12 w-full"
            onClick={async () => {
              await auth.signOut();
              navigate({ to: "/login/conductor", replace: true });
            }}
          >
            Iniciar sesión
          </Button>
        }
      />
    );
  if (service.error instanceof ApiRequestError && [403, 404].includes(service.error.status))
    return (
      <State title="Servicio no disponible" text="No existe o no está asignado a tu conductor." />
    );
  if (service.isError)
    return (
      <State
        title="Error temporal"
        text="No hemos podido cargar el servicio."
        action={
          <Button variant="outline" className="h-12 w-full" onClick={() => service.refetch()}>
            <RefreshCw className="h-5 w-5" /> Reintentar
          </Button>
        }
      />
    );
  const item = service.data;
  if (!item) return <EmptyState title="Servicio no encontrado" text="No está disponible." />;
  const accepted = item.status === "DRIVER_ACCEPTED";

  const acceptService = () => {
    if (!online) return;
    accept.mutate(item.id, {
      onSuccess: () => toast.success("Servicio aceptado"),
      onError: (error) =>
        toast.error(
          error instanceof ApiRequestError && error.status === 401
            ? "La sesión ha caducado"
            : "No se ha podido aceptar. Vuelve a intentarlo.",
        ),
    });
  };

  return (
    <div className="space-y-4">
      <Link
        to="/conductor"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary"
      >
        <ArrowLeft className="h-5 w-5" /> Mis servicios
      </Link>
      {!online && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl bg-warning/20 p-3 text-sm font-medium"
        >
          <CloudOff className="h-5 w-5" /> Sin conexión · acciones desactivadas
        </div>
      )}
      <Panel className="rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Referencia</p>
            <h1 className="mt-1 text-2xl font-semibold">{item.reference}</h1>
          </div>
          <ApiStatus status={item.status} />
        </div>
        <div className="mt-5 space-y-4 border-t pt-5">
          <Detail
            icon={<MapPin />}
            label="Origen"
            value={`${item.origin.name} · ${item.origin.address}`}
          />
          <Detail
            icon={<MapPin />}
            label="Destino"
            value={`${item.destination.name} · ${item.destination.address}`}
          />
          <Detail
            icon={<CalendarClock />}
            label="Recogida planificada"
            value={fmtDateTime(item.plannedPickup)}
          />
          <Detail
            icon={<CalendarClock />}
            label="Entrega planificada"
            value={fmtDateTime(item.plannedDelivery)}
          />
          <Detail
            icon={<Package />}
            label="Mercancía"
            value={`${item.cargo} · ${item.pallets} palets`}
          />
          {item.tempMin !== null && (
            <Detail
              icon={<Thermometer />}
              label="Temperatura"
              value={`${item.tempMin}–${item.tempMax} °C`}
            />
          )}
          <Detail
            icon={<Truck />}
            label="Vehículo"
            value={item.assignment?.vehiclePlate ?? "Pendiente"}
          />
        </div>
      </Panel>
      {accepted ? (
        <div className="rounded-2xl bg-success/15 p-5 text-center text-success" role="status">
          <CheckCircle2 className="mx-auto h-8 w-8" />
          <p className="mt-2 text-lg font-semibold">Servicio aceptado</p>
          <p className="mt-1 text-sm">Operaciones ya tiene confirmación.</p>
        </div>
      ) : (
        <Button
          className="h-16 w-full rounded-2xl text-lg font-semibold"
          disabled={!online || accept.isPending}
          onClick={acceptService}
        >
          {accept.isPending ? "Confirmando…" : "Aceptar servicio"}
        </Button>
      )}
      <p className="px-2 text-center text-xs leading-5 text-muted-foreground">
        El viaje y el seguimiento GPS se habilitarán en el siguiente hito.
      </p>
    </div>
  );
}

function Detail({
  icon,
  label,
  value,
}: {
  icon: React.ReactElement;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3 [&_svg]:mt-0.5 [&_svg]:h-5 [&_svg]:w-5 [&_svg]:shrink-0 [&_svg]:text-primary">
      <span>{icon}</span>
      <div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm font-medium leading-5">{value}</p>
      </div>
    </div>
  );
}

function State({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <Panel className="mt-8 p-6 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </Panel>
  );
}
