import { useEffect, useState } from "react";
import type { ApiTrackingPosition, ApiTrackingSession } from "@/lib/api/operations";
import { fmtDateTime } from "@/lib/domain/projections";

export function trackingReceptionStatus(
  position: ApiTrackingPosition | null,
  now: number,
) {
  if (!position) return { label: "Sin datos", ageSeconds: null };
  const ageSeconds = Math.max(
    0,
    Math.round((now - new Date(position.receivedAt).getTime()) / 1_000),
  );
  return {
    label: ageSeconds <= 90 ? "Sincronizado" : "Desactualizado",
    ageSeconds,
  };
}

export function TrackingDiagnostics({
  position,
  historyCount,
  session,
}: {
  position: ApiTrackingPosition | null;
  historyCount: number;
  session: ApiTrackingSession | null;
}) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, []);
  const status = now
    ? trackingReceptionStatus(position, now)
    : position
      ? { label: "Comprobando", ageSeconds: null }
      : { label: "Sin datos", ageSeconds: null };

  return (
    <section aria-label="Diagnóstico de tracking" className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-semibold">Diagnóstico de recepción GPS</h3>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold">{status.label}</span>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div><dt className="text-muted-foreground">Seguimiento</dt><dd className="font-medium">{session?.status === "ACTIVE" ? "Activo" : "Detenido"}</dd></div>
        <div><dt className="text-muted-foreground">Última posición recibida</dt><dd className="font-medium">{position ? `${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}` : "Sin datos"}</dd></div>
        <div><dt className="text-muted-foreground">Hora de recepción</dt><dd className="font-medium">{position ? fmtDateTime(position.receivedAt) : "—"}</dd></div>
        <div><dt className="text-muted-foreground">Antigüedad</dt><dd className="font-medium">{status.ageSeconds === null ? "—" : `${status.ageSeconds} s`}</dd></div>
        <div><dt className="text-muted-foreground">Precisión</dt><dd className="font-medium">{position ? `${Math.round(position.accuracy)} m` : "—"}</dd></div>
        <div><dt className="text-muted-foreground">Muestras históricas</dt><dd className="font-medium">{historyCount}</dd></div>
      </dl>
    </section>
  );
}
