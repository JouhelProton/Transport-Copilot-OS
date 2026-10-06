import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/nexo/ui";
import { usePortalSession } from "@/lib/auth/use-portal";
import { useDemoState } from "@/lib/domain/demo-backend";

export const Route = createFileRoute("/transportista/clientes")({ component: () => {
  const s = usePortalSession();
  const list = useDemoState((st) => st.customers.filter((c) => c.organizationId === s.organizationId));
  return <div><PageHeader title="Clientes" subtitle="Clientes ficticios DEMO" /><Panel><ul className="divide-y text-sm">{list.map((c) => <li key={c.id} className="flex justify-between py-3"><strong>{c.name}</strong><span className="text-muted-foreground">{c.contact}</span></li>)}</ul></Panel></div>;
} });
