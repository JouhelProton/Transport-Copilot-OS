import { createFileRoute, Navigate, Outlet, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { DemoBadge, Logo } from "@/components/nexo/ui";
import { portalGuard } from "@/lib/auth/guard";
import { auth, useSession } from "@/lib/auth/session";

export const Route = createFileRoute("/conductor")({
  ssr: false,
  beforeLoad: portalGuard("conductor"),
  head: () => ({
    meta: [
      { title: "App conductor — Nexo" },
      {
        name: "description",
        content: "App del conductor: servicio actual, llegada, incidencias, entrega y POD.",
      },
      { property: "og:title", content: "App conductor — Nexo" },
      { property: "og:description", content: "App móvil del conductor de Nexo." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Layout,
});

function Layout() {
  const s = useSession();
  const navigate = useNavigate();
  if (!s) return <Navigate to="/" replace />;
  return (
    <div className="mx-auto min-h-screen max-w-lg bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-4 py-3">
        <Logo to="/conductor" />
        <div className="flex items-center gap-2">
          <DemoBadge />
          <button
            aria-label="Cerrar sesión"
            className="rounded-lg border p-2"
            onClick={async () => {
              await auth.signOut();
              navigate({ to: "/", replace: true });
            }}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>
      <p className="px-4 pt-4 text-sm text-muted-foreground">Hola, {s?.name}</p>
      <main className="p-4">
        <Outlet />
      </main>
    </div>
  );
}
