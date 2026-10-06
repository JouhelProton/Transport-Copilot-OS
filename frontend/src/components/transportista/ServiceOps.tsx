import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Timeline } from "@/components/nexo/Timeline";
import { Panel, StatusBadge } from "@/components/nexo/ui";
import { assignService, reviewIncident, validatePod, type ActionResult } from "@/lib/domain/actions";
import { useDemoState } from "@/lib/domain/demo-backend";
import { canSeeFinance, fmtDateTime, fmtEur, fmtTime, visibleEvents } from "@/lib/domain/projections";
import type { Service } from "@/lib/domain/types";
import { getSession } from "@/lib/auth/session";
import { usePortalSession } from "@/lib/auth/use-portal";

export const notify = (r: ActionResult) => (r.ok ? toast.success(r.message) : toast.error(r.error));

export function ServiceOps({ svc }: { svc: Service }) {
  const session = usePortalSession();
  const events = useDemoState((s) => visibleEvents(s, svc.id, session));
  const incidents = useDemoState((s) => s.incidents.filter((i) => i.serviceId === svc.id));
  const vehicles = useDemoState((s) => s.vehicles.filter((v) => v.organizationId === session.organizationId));
  const drivers = useDemoState((s) => s.drivers.filter((v) => v.organizationId === session.organizationId));
  const [vehicleId, setVehicleId] = useState(svc.vehicleId ?? "");
  const [driverId, setDriverId] = useState(svc.driverId ?? "");
  const finance = canSeeFinance(session);
  const sel = "h-10 w-full rounded-lg border bg-card px-3 text-sm";

  return (
    <div className="grid gap-5 xl:grid-cols-5">
      <div className="space-y-5 xl:col-span-3">
        <Panel title={<span className="flex items-center gap-3">Servicio {svc.id} <StatusBadge status={svc.status} /></span>} action={<Link to="/transportista/servicios" className="text-sm text-primary">← Volver</Link>}>
          <dl className="grid gap-4 text-sm sm:grid-cols-3">
            <div><dt className="text-muted-foreground">Ruta</dt><dd className="font-medium">{svc.origin.name} → {svc.destination.name}</dd></div>
            <div><dt className="text-muted-foreground">Mercancía</dt><dd className="font-medium">{svc.cargo} · {svc.pallets} palets{svc.tempMin !== undefined && ` · ${svc.tempMin}–${svc.tempMax} °C`}</dd></div>
            <div><dt className="text-muted-foreground">Planificado / ETA</dt><dd className="font-medium">{fmtTime(svc.plannedDelivery)} / {fmtTime(svc.actualDelivery ?? svc.eta)}</dd></div>
            {finance ? (
              <div className="sm:col-span-3 rounded-lg bg-muted p-3"><span className="font-medium">Datos internos (solo roles autorizados):</span> precio {fmtEur(svc.price)} · coste {fmtEur(svc.cost)} · margen {fmtEur(svc.price - svc.cost)}. {svc.internalNotes}</div>
            ) : <p className="text-xs text-muted-foreground sm:col-span-3">Precio y costes ocultos para tu rol ({session.role}).</p>}
          </dl>
        </Panel>

        <Panel title="Asignación">
          <div className="grid gap-3 sm:grid-cols-3">
            <select className={sel} value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} aria-label="Vehículo">
              <option value="">Vehículo…</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate} · {v.type}</option>)}
            </select>
            <select className={sel} value={driverId} onChange={(e) => setDriverId(e.target.value)} aria-label="Conductor">
              <option value="">Conductor…</option>{drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <Button onClick={() => notify(assignService(getSession(), { serviceId: svc.id, vehicleId, driverId }))}>
              <CheckCircle2 className="h-4 w-4" /> {svc.assignmentConfirmed ? "Reasignar" : "Confirmar asignación"}
            </Button>
          </div>
          {svc.assignmentConfirmed && <p className="mt-2 text-sm text-success">Asignación confirmada.</p>}
        </Panel>

        <Panel title="POD">
          {svc.pod ? (
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <div><p className="font-medium">{svc.pod.fileName} <span className="text-muted-foreground">(muestra DEMO)</span></p><p className="text-muted-foreground">Recibe: {svc.pod.receiverName} · {fmtDateTime(svc.pod.at)}</p></div>
              {svc.pod.validated ? <span className="font-semibold text-success">Validado {fmtTime(svc.pod.validatedAt)}</span> :
                <Button onClick={() => notify(validatePod(getSession(), svc.id))}><FileCheck2 className="h-4 w-4" /> Validar POD</Button>}
            </div>
          ) : <p className="text-sm text-muted-foreground">El conductor aún no ha subido el POD.</p>}
          {svc.readyToInvoice && <p className="mt-3 rounded-lg bg-success/15 p-3 text-sm font-medium text-success">Listo para facturar · borrador BOR-{svc.id} creado (DEMO)</p>}
        </Panel>

        <Panel title={`Incidencias (${incidents.length})`}>
          {incidents.length ? (
            <ul className="space-y-3">{incidents.map((i) => (
              <li key={i.id} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{i.id} · {i.type}</span><span className="text-muted-foreground">{i.status} · {i.reportedByName}</span></div>
                <p className="mt-1">{i.description}</p>
                {i.status !== "RESUELTA" && <div className="mt-2 flex gap-2">
                  {i.status === "ABIERTA" && <Button size="sm" variant="outline" onClick={() => notify(reviewIncident(getSession(), i.id, "EN_REVISION"))}>Revisar</Button>}
                  <Button size="sm" variant="secondary" onClick={() => notify(reviewIncident(getSession(), i.id, "RESUELTA"))}>Resolver</Button>
                </div>}
              </li>))}</ul>
          ) : <p className="text-sm text-muted-foreground">Sin incidencias.</p>}
        </Panel>
      </div>
      <Panel title="Secuencia de eventos" className="xl:col-span-2"><Timeline events={events} /></Panel>
    </div>
  );
}
