import type { ServiceEvent } from "@/lib/domain/types";
import { fmtDateTime } from "@/lib/domain/projections";
import { cn } from "@/lib/utils";

export function Timeline({ events }: { events: ServiceEvent[] }) {
  if (!events.length) return <p className="text-sm text-muted-foreground">Sin eventos todavía.</p>;
  return (
    <ol className="relative space-y-4 border-l-2 border-border pl-5">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className={cn("absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-card", e.type.includes("INCIDENCIA") || e.type === "RETRASO" ? "bg-warning" : e.type === "LISTO_FACTURAR" || e.type === "POD_VALIDADO" || e.type === "CERRADO" ? "bg-success" : "bg-primary")} />
          <p className="text-sm font-medium">{e.message}</p>
          <p className="text-xs text-muted-foreground">
            {fmtDateTime(e.at)} · {e.actorName}
            {e.visibility === "INTERNAL" && <span className="ml-2 rounded bg-muted px-1.5 py-0.5">Interno</span>}
          </p>
        </li>
      ))}
    </ol>
  );
}
