import { Link, Navigate, useNavigate } from "@tanstack/react-router";
import { LogOut, RotateCcw, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { auth, useSession } from "@/lib/auth/session";
import { resetDemo, useDemoState } from "@/lib/domain/demo-backend";
import { DemoBadge, Logo } from "./ui";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

export function PortalShell({
  portalName,
  nav,
  children,
}: {
  portalName: string;
  nav: NavItem[];
  children: ReactNode;
}) {
  const session = useSession();
  const navigate = useNavigate();
  const signOut = async () => {
    await auth.signOut();
    navigate({ to: "/", replace: true });
  };
  if (!session) return <Navigate to="/" replace />;
  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="p-5">
          <Logo light />
        </div>
        <p className="px-5 pb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
          {portalName}
        </p>
        <nav className="flex-1 space-y-0.5 px-3" aria-label={portalName}>
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.exact }}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
            >
              <n.icon className="h-4.5 w-4.5" aria-hidden /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-4 text-sm">
          <p className="font-medium text-sidebar-accent-foreground">{session?.name}</p>
          <p className="text-xs text-ink-muted">
            {session?.role} · {session?.organizationName}
          </p>
          {session.memberships.length > 1 && (
            <select
              aria-label="Organización activa"
              className="mt-3 w-full rounded border border-sidebar-border bg-sidebar px-2 py-1.5 text-xs"
              value={session.membershipId}
              onChange={async (event) => {
                await auth.switchOrganization(event.target.value);
                toast.success("Organización activa actualizada");
              }}
            >
              {session.memberships.map((membership) => (
                <option key={membership.id} value={membership.id}>
                  {membership.organization.name} · {membership.role}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={signOut}
            className="mt-3 flex items-center gap-2 text-ink-muted hover:text-sidebar-accent-foreground"
          >
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-8">
            <div className="lg:hidden">
              <Logo />
            </div>
            <div className="hidden items-center gap-2 lg:flex">
              <span className="text-sm text-muted-foreground">{portalName}</span>
              <DemoBadge label="Entorno DEMO" />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  resetDemo();
                  toast.success("Datos DEMO restablecidos");
                }}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                title="Reinicia el flujo de demostración"
              >
                <RotateCcw className="h-4 w-4" />{" "}
                <span className="hidden sm:inline">Reiniciar demo</span>
              </button>
              <button
                onClick={signOut}
                className="rounded-lg border p-1.5 lg:hidden"
                aria-label="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden" aria-label={portalName}>
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: n.exact }}
                className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground"
                activeProps={{ className: "bg-ink text-ink-foreground" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
