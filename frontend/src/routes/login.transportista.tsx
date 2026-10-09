import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/components/nexo/LoginPage";
import { MOTIVOS, validateLoginSearch } from "@/lib/auth/guard";

export const Route = createFileRoute("/login/transportista")({
  validateSearch: validateLoginSearch,
  head: () => ({ meta: [
    { title: "Acceso transportista — NEXO Copilot" },
    { name: "description", content: "Acceso al portal operativo de la empresa transportista." },
    { property: "og:title", content: "Acceso transportista — NEXO Copilot" },
    { property: "og:description", content: "Acceso al portal operativo de la empresa transportista." },
  ] }),
  component: () => {
    const { motivo } = Route.useSearch();
    return <LoginPage portal="transportista" reason={motivo ? MOTIVOS[motivo] : undefined} />;
  },
});
