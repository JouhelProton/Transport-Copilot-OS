import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Building2, Smartphone, Truck } from "lucide-react";
import { DemoBadge, Logo } from "@/components/nexo/ui";

export const Route = createFileRoute("/acceso")({
  validateSearch: (s: Record<string, unknown>): { demo?: boolean } => ({ demo: s.demo === true || s.demo === "true" ? true : undefined }),
  head: () => ({
    meta: [
      { title: "Elige tu acceso — Transport Copilot OS" },
      { name: "description", content: "Selecciona tu portal: cliente, transportista o conductor." },
      { property: "og:title", content: "Elige tu acceso — Transport Copilot OS" },
      { property: "og:description", content: "Selecciona tu portal: cliente, transportista o conductor." },
    ],
  }),
  component: Acceso,
});

const OPTIONS = [
  { to: "/login/cliente", icon: Building2, title: "Soy cliente", text: "Portal del cargador" },
  { to: "/login/transportista", icon: Truck, title: "Soy transportista", text: "Portal operativo" },
  { to: "/login/conductor", icon: Smartphone, title: "Soy conductor", text: "App móvil" },
] as const;

function Acceso() {
  const { demo } = Route.useSearch();
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-5 py-8">
        <Logo />
        <div className="py-14 text-center">
          <h1 className="text-3xl font-semibold">¿Cómo quieres acceder?</h1>
          <p className="mt-2 text-muted-foreground">Elige el acceso de tu rol. Cada portal es independiente.</p>
          {demo && (
            <div className="mx-auto mt-6 max-w-xl rounded-xl border border-dashed bg-demo/30 p-4 text-left text-sm">
              <DemoBadge label="Recorrido DEMO" />
              <p className="mt-2">Flujo sugerido sobre el servicio <strong>NV-24081</strong>: 1) cliente informa incidencia → 2) transportista revisa y confirma asignación → 3) conductor confirma llegada y 4) entrega con POD → 5) transportista valida POD → 6) “listo para facturar” → 7) cliente ve el cierre. Usa el acceso guiado DEMO de cada portal.</p>
            </div>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {OPTIONS.map((o) => (
            <Link key={o.to} to={o.to} className="group flex flex-col items-center rounded-2xl border bg-card p-8 text-center shadow-card transition hover:border-primary">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-ink text-ink-foreground"><o.icon className="h-7 w-7" /></span>
              <span className="mt-4 text-lg font-semibold">{o.title}</span>
              <span className="text-sm text-muted-foreground">{o.text}</span>
              <ArrowRight className="mt-4 h-5 w-5 text-primary transition group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
