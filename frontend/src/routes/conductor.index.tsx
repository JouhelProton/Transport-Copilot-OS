import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CalendarClock, ChevronRight, CloudOff, MapPin, RefreshCw, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiStatus } from "@/components/nexo/ApiStatus";
import { EmptyState, Panel } from "@/components/nexo/ui";
import { usePortalSession } from "@/lib/auth/use-portal";
import { auth } from "@/lib/auth/session";
import { useDriverApiServices } from "@/lib/api/operations";
import { ApiRequestError } from "@/lib/platform/api-client";
import { useOnlineStatus } from "@/lib/platform/connectivity";
import { fmtDateTime } from "@/lib/domain/projections";

export const Route = createFileRoute("/conductor/")({ component: DriverHome });

function DriverHome() {
  const session = usePortalSession();
  const online = useOnlineStatus();
  const services = useDriverApiServices(session, online);
  const navigate = useNavigate();
  const error = services.error;

  if (!online && !services.data)
    return (
      <DriverMessage
        icon={<CloudOff className="h-8 w-8" />}
        title="Sin conexión"
        text="Conéctate a Internet para consultar tus servicios. No se enviará ninguna acción sin confirmación del servidor."
      />
    );
  if (services.isPending)
    return (
      <div aria-live="polite" className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Cargando tus servicios…</p>
        {[0, 1].map((item) => (
          <div key={item} className="h-40 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    );
  if (error instanceof ApiRequestError && error.status === 401)
    return (
      <DriverMessage
        title="La sesión ha caducado"
        text="Vuelve a iniciar sesión para continuar."
        action={
          <Button
            className="h-12 w-full text-base"
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
  if (error instanceof ApiRequestError && error.status === 403)
    return (
      <DriverMessage
        title="Acceso no autorizado"
        text="Tu usuario no está vinculado a un conductor activo. Contacta con operaciones."
      />
    );
  if (services.isError)
    return (
      <DriverMessage
        title="No hemos podido cargar tus servicios"
        text="Puede ser un problema temporal. Comprueba tu conexión y vuelve a intentarlo."
        action={
          <Button variant="outline" className="h-12 w-full" onClick={() => services.refetch()}>
            <RefreshCw className="h-5 w-5" /> Reintentar
          </Button>
        }
      />
    );

  return (
    <div className="space-y-4">
      {!online && (
        <div
          className="flex items-center gap-2 rounded-xl bg-warning/20 p-3 text-sm font-medium"
          role="status"
        >
          <CloudOff className="h-5 w-5" /> Sin conexión · información guardada en pantalla
        </div>
      )}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Operativa</p>
        <h1 className="mt-1 text-2xl font-semibold">Mis servicios</h1>
      </div>
      {services.data?.length ? (
        <ul className="space-y-3">
          {services.data.map((service) => (
            <li key={service.id}>
              <Link
                to="/conductor/$id"
                params={{ id: service.id }}
                className="block rounded-2xl border bg-card p-4 shadow-card transition active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{service.reference}</p>
                    <p className="mt-1 font-display text-lg font-semibold">{service.origin.name}</p>
                    <p className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" /> {service.destination.name}
                    </p>
                  </div>
                  <ChevronRight className="mt-2 h-6 w-6 text-muted-foreground" />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <ApiStatus status={service.status} />
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarClock className="h-4 w-4" /> {fmtDateTime(service.plannedPickup)}
                  </span>
                </div>
                <p className="mt-3 flex items-center gap-2 border-t pt-3 text-sm font-medium">
                  <Truck className="h-4 w-4 text-primary" />
                  {service.assignment?.vehiclePlate ?? "Vehículo pendiente"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="Sin servicios asignados"
          text="Operaciones te avisará cuando tengas un nuevo servicio."
        />
      )}
    </div>
  );
}

function DriverMessage({
  icon,
  title,
  text,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <Panel className="mt-8 p-6 text-center">
      {icon && <div className="mx-auto mb-3 w-fit text-muted-foreground">{icon}</div>}
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </Panel>
  );
}
