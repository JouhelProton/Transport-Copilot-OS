import { cn } from "@/lib/utils";

const labels: Record<string, string> = {
  SUBMITTED: "Pendiente",
  ACCEPTED: "Aceptado",
  PLANNED: "Planificado",
  ASSIGNED: "Asignado",
};

export function ApiStatus({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        status === "ASSIGNED" || status === "ACCEPTED"
          ? "bg-success/15 text-success"
          : "bg-warning/15 text-warning-foreground",
      )}
    >
      {labels[status] ?? status}
    </span>
  );
}
