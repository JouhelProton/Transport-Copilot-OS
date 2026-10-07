import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bell, Bot, Building2, ClipboardList, FileCheck2, MapPinned, PhoneOff, Receipt, Route as RouteIcon, Smartphone, Truck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DemoBadge, Logo } from "@/components/nexo/ui";
import hero from "@/assets/hero-truck.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Transport Copilot OS — Plataforma operativa de transporte" },
      { name: "description", content: "Conecta cargador, transportista y conductor en un único flujo: seguimiento, POD, incidencias y facturación." },
      { property: "og:title", content: "Transport Copilot OS" },
      { property: "og:description", content: "Una plataforma, tres portales: cliente, transportista y conductor." },
    ],
  }),
  component: Landing,
});

const ROLES = [
  { to: "/login/cliente", icon: Building2, title: "Soy cliente", text: "Cargador o empresa que envía mercancía. Sigue tus envíos y descarga documentos." },
  { to: "/login/transportista", icon: Truck, title: "Soy transportista", text: "Tráfico, operaciones y contabilidad. Planifica, asigna, valida y factura." },
  { to: "/login/conductor", icon: Smartphone, title: "Soy conductor", text: "App móvil: tu servicio, llegada, incidencias, entrega y POD." },
] as const;

const BENEFITS = [
  { icon: PhoneOff, title: "Menos llamadas de seguimiento", text: "El cliente ve estado y ETA sin llamar a tráfico." },
  { icon: MapPinned, title: "Visibilidad de viajes", text: "Posición, hitos y retrasos en un solo lugar." },
  { icon: FileCheck2, title: "Documentos y POD", text: "Carta de porte, DeCA y prueba de entrega digitalizadas." },
  { icon: TriangleAlert, title: "Incidencias trazables", text: "Cada incidencia queda registrada con su secuencia de eventos." },
  { icon: Bot, title: "Automatización de tareas", text: "Reglas como “POD validado → listo para facturar”." },
  { icon: Bell, title: "Un único servicio compartido", text: "Mismo ID y mismos datos para los tres perfiles, con permisos." },
];

const FLOW = [
  { icon: ClipboardList, label: "Pedido" },
  { icon: Truck, label: "Asignación" },
  { icon: RouteIcon, label: "Seguimiento" },
  { icon: FileCheck2, label: "Entrega / POD" },
  { icon: Receipt, label: "Facturación" },
];

function Landing() {
  return (
    <div>
      <header className="relative overflow-hidden bg-ink text-ink-foreground">
        <img src={hero} alt="" width={1600} height={1008} className="absolute inset-0 h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-hero opacity-80" />
        <div className="relative mx-auto max-w-6xl px-5">
          <nav className="flex items-center justify-between py-5">
            <Logo light />
            <Button asChild variant="secondary"><Link to="/acceso">Acceder al portal</Link></Button>
          </nav>
          <div className="max-w-2xl py-20 sm:py-28">
            <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-muted">Plataforma SaaS B2B de transporte</p>
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">El sistema operativo que conecta cargador, transportista y conductor.</h1>
            <p className="mt-5 text-lg text-ink-muted">Un único flujo para cada servicio: desde el pedido hasta la factura, con seguimiento, documentos e incidencias compartidos y con permisos por rol.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 px-6 text-base"><Link to="/acceso">Acceder al portal <ArrowRight className="h-4 w-4" /></Link></Button>
              <Button asChild size="lg" variant="outline" className="h-12 border-ink-muted bg-transparent px-6 text-base text-ink-foreground hover:bg-ink-foreground/10 hover:text-ink-foreground">
                <Link to="/acceso" search={{ demo: true }}>Probar la demo</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-16" aria-labelledby="roles">
        <h2 id="roles" className="text-2xl font-semibold">Tres portales, un mismo servicio</h2>
        <p className="mt-2 text-muted-foreground">Cada perfil entra por su propio acceso y solo ve lo que le corresponde.</p>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {ROLES.map((r) => (
            <Link key={r.to} to={r.to} className="group rounded-2xl border bg-card p-6 shadow-card transition hover:-translate-y-0.5 hover:border-primary">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary"><r.icon className="h-6 w-6" /></span>
              <h3 className="mt-4 text-lg font-semibold">{r.title}</h3>
              <p className="mt-2 text-muted-foreground">{r.text}</p>
              <span className="mt-4 inline-flex items-center gap-1 font-medium text-primary">Ir a mi acceso <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y bg-card py-16" aria-labelledby="flujo">
        <div className="mx-auto max-w-6xl px-5">
          <h2 id="flujo" className="text-2xl font-semibold">Un flujo de principio a fin</h2>
          <ol className="mt-10 grid gap-4 sm:grid-cols-5">
            {FLOW.map((f, i) => (
              <li key={f.label} className="relative flex flex-col items-center text-center">
                {i < FLOW.length - 1 && <span className="absolute left-1/2 top-7 hidden h-0.5 w-full bg-border sm:block" aria-hidden />}
                <span className="relative grid h-14 w-14 place-items-center rounded-full bg-ink text-ink-foreground"><f.icon className="h-6 w-6" /></span>
                <span className="mt-3 text-xs font-semibold text-muted-foreground">Paso {i + 1}</span>
                <span className="font-semibold">{f.label}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16" aria-labelledby="beneficios">
        <h2 id="beneficios" className="text-2xl font-semibold">Beneficios</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b) => (
            <div key={b.title} className="rounded-xl border bg-card p-5">
              <b.icon className="h-6 w-6 text-success" />
              <h3 className="mt-3 font-semibold">{b.title}</h3>
              <p className="mt-1 text-muted-foreground">{b.text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 text-sm text-muted-foreground">
          <Logo />
          <span className="flex items-center gap-2"><DemoBadge /> Entorno de demostración. Empresas y datos ficticios.</span>
        </div>
      </footer>
    </div>
  );
}
