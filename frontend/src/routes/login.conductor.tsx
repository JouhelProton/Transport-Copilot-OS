import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/components/nexo/LoginPage";
import { MOTIVOS, validateLoginSearch } from "@/lib/auth/guard";

export const Route = createFileRoute("/login/conductor")({
  validateSearch: validateLoginSearch,
  head: () => ({ meta: [
    { title: "Acceso conductor — Transport Copilot OS" },
    { name: "description", content: "Acceso a la app del conductor: servicio, llegada, entrega y POD." },
    { property: "og:title", content: "Acceso conductor — Transport Copilot OS" },
    { property: "og:description", content: "Acceso a la app del conductor de Transport Copilot OS." },
  ] }),
  component: () => {
    const { motivo } = Route.useSearch();
    return <LoginPage portal="conductor" reason={motivo ? MOTIVOS[motivo] : undefined} />;
  },
});
