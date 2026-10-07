import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/components/nexo/LoginPage";
import { MOTIVOS, validateLoginSearch } from "@/lib/auth/guard";

export const Route = createFileRoute("/login/cliente")({
  validateSearch: validateLoginSearch,
  head: () => ({ meta: [
    { title: "Acceso cliente — Transport Copilot OS" },
    { name: "description", content: "Acceso al portal de cliente/cargador de Transport Copilot OS." },
    { property: "og:title", content: "Acceso cliente — Transport Copilot OS" },
    { property: "og:description", content: "Acceso al portal de cliente/cargador de Transport Copilot OS." },
  ] }),
  component: () => {
    const { motivo } = Route.useSearch();
    return <LoginPage portal="cliente" reason={motivo ? MOTIVOS[motivo] : undefined} />;
  },
});
