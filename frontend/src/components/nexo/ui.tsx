import { Link } from "@tanstack/react-router";
import { FlaskConical, Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { STATUS_LABEL, type ServiceStatus } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export function Logo({ light = false, to = "/" }: { light?: boolean; to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2.5" aria-label="Nexo · Transport AI OS — inicio">
      <span className={cn("grid h-9 w-9 place-items-center rounded-lg font-display text-lg font-bold", light ? "bg-primary text-primary-foreground" : "bg-ink text-ink-foreground")}>
        N
      </span>
      <span className="leading-tight">
        <span className={cn("block font-display text-base font-semibold", light ? "text-ink-foreground" : "text-foreground")}>Nexo</span>
        <span className={cn("block text-xs", light ? "text-ink-muted" : "text-muted-foreground")}>Transport AI OS</span>
      </span>
    </Link>
  );
}

export function DemoBadge({ label = "DEMO", className }: { label?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-demo px-2.5 py-0.5 text-xs font-semibold text-demo-foreground", className)}>
      <FlaskConical className="h-3.5 w-3.5" aria-hidden /> {label}
    </span>
  );
}

const STATUS_STYLE: Record<ServiceStatus, string> = {
  PLANIFICADO: "bg-muted text-muted-foreground",
  ASIGNADO: "bg-accent text-accent-foreground",
  EN_RUTA: "bg-primary/10 text-primary",
  EN_DESTINO: "bg-warning/20 text-warning-foreground",
  ENTREGADO: "bg-success/15 text-success",
  POD_VALIDADO: "bg-success/15 text-success",
  LISTO_FACTURAR: "bg-success text-success-foreground",
};

export function StatusBadge({ status }: { status: ServiceStatus }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_STYLE[status])}>{STATUS_LABEL[status]}</span>;
}

export function Panel({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border bg-card p-5 shadow-card", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ label, value, icon, tone = "default" }: { label: string; value: ReactNode; icon: ReactNode; tone?: "default" | "warn" | "ok" | "bad" }) {
  const t = { default: "bg-primary/10 text-primary", warn: "bg-warning/20 text-warning-foreground", ok: "bg-success/15 text-success", bad: "bg-destructive/10 text-destructive" }[tone];
  return (
    <div className="rounded-xl border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={cn("grid h-9 w-9 place-items-center rounded-lg", t)}>{icon}</span>
      </div>
      <div className="mt-2 font-display text-2xl font-semibold">{value}</div>
    </div>
  );
}

export function EmptyState({ title, text }: { title: string; text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-10 text-center">
      <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden />
      <p className="mt-3 font-medium">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
