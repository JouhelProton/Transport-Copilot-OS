import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/components/nexo/LoginPage";
import { MOTIVOS, validateLoginSearch } from "@/lib/auth/guard";

export const Route = createFileRoute("/login/cliente")({
  validateSearch: validateLoginSearch,
  head: () => ({ meta: [
    { title: "Acceso cliente — NEXO Copilot" },
    { name: "description", content: "Acceso al portal de cliente de NEXO Copilot, Transport Copilot OS." },
    { property: "og:title", content: "Acceso cliente — NEXO Copilot" },
    { property: "og:description", content: "Acceso al portal de cliente de NEXO Copilot, Transport Copilot OS." },
  ] }),
  component: () => {
    const { motivo } = Route.useSearch();
    return <LoginPage portal="cliente" reason={motivo ? MOTIVOS[motivo] : undefined} />;
  },
});
