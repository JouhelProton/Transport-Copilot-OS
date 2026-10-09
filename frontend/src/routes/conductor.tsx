import { createFileRoute, Navigate, Outlet, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/nexo/ui";
import { portalGuard } from "@/lib/auth/guard";
import { auth, useSession } from "@/lib/auth/session";

export const Route = createFileRoute("/conductor")({
  ssr: false,
  beforeLoad: portalGuard("conductor"),
  head: () => ({
    meta: [
      { title: "NEXO Driver — Transport Copilot OS" },
      {
        name: "description",
        content: "App del conductor: servicio actual, llegada, incidencias, entrega y POD.",
      },
      { property: "og:title", content: "NEXO Driver — Transport Copilot OS" },
      { property: "og:description", content: "NEXO Driver, la aplicación móvil de NEXO Copilot para conductores." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Layout,
});

function Layout() {
  const { session: guardedSession } = Route.useRouteContext();
  const s = useSession() ?? guardedSession;
  const navigate = useNavigate();
  if (!s) return <Navigate to="/" replace />;
  return (
    <div className="driver-app-shell mx-auto min-h-screen max-w-lg bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-card/95 px-4 py-3 backdrop-blur">
        <Logo to="/conductor" />
        <div className="flex items-center gap-2">
          <button
            aria-label="Cerrar sesión"
            className="rounded-lg border p-2"
            onClick={async () => {
              await auth.signOut();
              navigate({ to: "/login/conductor", replace: true });
            }}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>
      <p className="px-4 pt-4 text-sm text-muted-foreground">Hola, {s?.name}</p>
      <main className="p-4 pb-8">
        <Outlet />
      </main>
    </div>
  );
}
