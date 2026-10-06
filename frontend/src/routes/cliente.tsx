import { createFileRoute, Outlet } from "@tanstack/react-router";
import { FileText, LayoutDashboard, MapPinned, Package, Receipt, TriangleAlert } from "lucide-react";
import { PortalShell } from "@/components/nexo/PortalShell";
import { portalGuard } from "@/lib/auth/guard";

export const Route = createFileRoute("/cliente")({
  ssr: false,
  beforeLoad: portalGuard("cliente"),
  head: () => ({ meta: [
    { title: "Portal cliente — Nexo" },
    { name: "description", content: "Portal del cliente: envíos, seguimiento, documentos e incidencias." },
    { property: "og:title", content: "Portal cliente — Nexo" },
    { property: "og:description", content: "Portal del cliente de Nexo." },
    { name: "robots", content: "noindex" },
  ] }),
  component: () => (
    <PortalShell portalName="Portal cliente" nav={[
      { to: "/cliente", label: "Resumen", icon: LayoutDashboard, exact: true },
      { to: "/cliente/pedidos", label: "Pedidos", icon: Package },
      { to: "/cliente/seguimiento", label: "Seguimiento", icon: MapPinned },
      { to: "/cliente/documentos", label: "Documentos", icon: FileText },
      { to: "/cliente/incidencias", label: "Incidencias", icon: TriangleAlert },
      { to: "/cliente/facturacion", label: "Facturación", icon: Receipt },
    ]}>
      <Outlet />
    </PortalShell>
  ),
});
