import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Bot, Building2, CalendarClock, FileText, LayoutDashboard, Map, Package, Plug, Receipt, TriangleAlert, Truck } from "lucide-react";
import { PortalShell } from "@/components/nexo/PortalShell";
import { portalGuard } from "@/lib/auth/guard";

export const Route = createFileRoute("/transportista")({
  ssr: false,
  beforeLoad: portalGuard("transportista"),
  head: () => ({ meta: [
    { title: "Portal transportista — Nexo" },
    { name: "description", content: "Portal operativo de la empresa transportista." },
    { property: "og:title", content: "Portal transportista — Nexo" },
    { property: "og:description", content: "Portal operativo de la empresa transportista." },
    { name: "robots", content: "noindex" },
  ] }),
  component: () => (
    <PortalShell portalName="Portal transportista" nav={[
      { to: "/transportista", label: "Panel", icon: LayoutDashboard, exact: true },
      { to: "/transportista/servicios", label: "Pedidos y servicios", icon: Package },
      { to: "/transportista/planificacion", label: "Planificación", icon: CalendarClock },
      { to: "/transportista/mapa", label: "Mapa", icon: Map },
      { to: "/transportista/flota", label: "Flota y conductores", icon: Truck },
      { to: "/transportista/documentos", label: "Documentos / POD", icon: FileText },
      { to: "/transportista/incidencias", label: "Incidencias", icon: TriangleAlert },
      { to: "/transportista/facturacion", label: "Facturación", icon: Receipt },
      { to: "/transportista/clientes", label: "Clientes", icon: Building2 },
      { to: "/transportista/automatizaciones", label: "Automatizaciones", icon: Bot },
      { to: "/transportista/integraciones", label: "Integraciones", icon: Plug },
    ]}>
      <Outlet />
    </PortalShell>
  ),
});


