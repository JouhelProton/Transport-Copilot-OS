import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/components/nexo/LoginPage";
import { MOTIVOS, validateLoginSearch } from "@/lib/auth/guard";

export const Route = createFileRoute("/login/conductor")({
  validateSearch: validateLoginSearch,
  head: () => ({ meta: [
    { title: "Acceso NEXO Driver — NEXO Copilot" },
    { name: "description", content: "Acceso a la app del conductor: servicio, llegada, entrega y POD." },
    { property: "og:title", content: "Acceso NEXO Driver — NEXO Copilot" },
    { property: "og:description", content: "Acceso a NEXO Driver, la aplicación móvil de NEXO Copilot." },
  ] }),
  component: () => {
    const { motivo } = Route.useSearch();
    return <LoginPage portal="conductor" reason={motivo ? MOTIVOS[motivo] : undefined} />;
  },
});
