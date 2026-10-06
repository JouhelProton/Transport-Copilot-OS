import { createFileRoute } from "@tanstack/react-router";
import { Switch } from "@/components/ui/switch";
import { PageHeader, Panel } from "@/components/nexo/ui";
import { toggleAutomation } from "@/lib/domain/actions";
import { useDemoState } from "@/lib/domain/demo-backend";
import { getSession } from "@/lib/auth/session";
import { notify } from "@/components/transportista/ServiceOps";

export const Route = createFileRoute("/transportista/automatizaciones")({ component: () => {
  const list = useDemoState((st) => st.automations);
  return <div><PageHeader title="Automatizaciones" subtitle="Reglas sobre el stream de eventos (solo administradores pueden cambiarlas)" />
    <div className="space-y-3">{list.map((a) => <Panel key={a.id}><div className="flex items-center justify-between gap-4"><div><p className="font-semibold">{a.name}</p><p className="text-sm text-muted-foreground">Cuando: {a.trigger} → {a.action}</p></div>
      <Switch checked={a.enabled} onCheckedChange={() => notify(toggleAutomation(getSession(), a.id))} aria-label={a.name} /></div></Panel>)}</div></div>;
} });
