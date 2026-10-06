import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/nexo/ui";
import { useDemoState } from "@/lib/domain/demo-backend";

export const Route = createFileRoute("/transportista/integraciones")({
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const list = useDemoState((st) => st.integrations);
  return (
    <div>
      <PageHeader
        title="Integraciones"
        subtitle="Estado de proveedores externos y fuentes de datos"
      />
      <div className="grid gap-4 md:grid-cols-2">
        {list.map((integration) => (
          <Panel key={integration.id}>
            <div className="flex justify-between">
              <strong>{integration.name}</strong>
              <span className="rounded bg-muted px-2 py-0.5 text-xs">{integration.status}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{integration.description}</p>
          </Panel>
        ))}
      </div>
    </div>
  );
}
