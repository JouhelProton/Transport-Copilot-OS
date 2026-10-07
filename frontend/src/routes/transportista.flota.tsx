import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/nexo/ui";
import { usePortalSession } from "@/lib/auth/use-portal";
import { useApiDrivers, useApiVehicles } from "@/lib/api/operations";

export const Route = createFileRoute("/transportista/flota")({ component: FleetPage });

function FleetPage() {
  const session = usePortalSession();
  const vehicles = useApiVehicles(session);
  const drivers = useApiDrivers(session);
  return (
    <div>
      <PageHeader title="Flota y conductores" subtitle="Datos operativos del backend" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Vehículos">
          {vehicles.isError ? (
            <p className="text-sm text-destructive">{vehicles.error.message}</p>
          ) : (
            <ul className="divide-y text-sm">
              {(vehicles.data ?? []).map((vehicle) => (
                <li key={vehicle.id} className="flex justify-between py-3">
                  <span>
                    <strong>{vehicle.plate}</strong> · {vehicle.type}
                  </span>
                  <span className="text-muted-foreground">{vehicle.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Conductores">
          {drivers.isError ? (
            <p className="text-sm text-destructive">{drivers.error.message}</p>
          ) : (
            <ul className="divide-y text-sm">
              {(drivers.data ?? []).map((driver) => (
                <li key={driver.id} className="flex justify-between py-3">
                  <span>
                    <strong>{driver.name}</strong> · {driver.license}
                  </span>
                  <span className="text-muted-foreground">
                    {driver.phone} · {driver.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
