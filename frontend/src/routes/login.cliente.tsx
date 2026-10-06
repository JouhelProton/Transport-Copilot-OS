import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/components/nexo/LoginPage";
import { MOTIVOS, validateLoginSearch } from "@/lib/auth/guard";

export const Route = createFileRoute("/login/cliente")({
  validateSearch: validateLoginSearch,
  head: () => ({ meta: [
    { title: "Acceso cliente — Nexo · Transport AI OS" },
    { name: "description", content: "Acceso al portal de cliente/cargador de Nexo." },
    { property: "og:title", content: "Acceso cliente — Nexo" },
    { property: "og:description", content: "Acceso al portal de cliente/cargador de Nexo." },
  ] }),
  component: () => {
    const { motivo } = Route.useSearch();
    return <LoginPage portal="cliente" reason={motivo ? MOTIVOS[motivo] : undefined} />;
  },
});
