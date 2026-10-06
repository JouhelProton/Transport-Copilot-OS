import { useState } from "react";
import { Mail, MessageCircle, MessageSquarePlus, Phone, Thermometer, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { IncidentForm } from "@/components/nexo/IncidentForm";
import { MapView } from "@/components/nexo/MapView";
import { Timeline } from "@/components/nexo/Timeline";
import { DemoBadge, Panel, StatusBadge } from "@/components/nexo/ui";
import { addComment } from "@/lib/domain/actions";
import { useDemoState } from "@/lib/domain/demo-backend";
import { fmtTime, visibleEvents, type CustomerService } from "@/lib/domain/projections";
import { getSession, type Session } from "@/lib/auth/session";

export function CustomerServiceDetail({ svc, session }: { svc: CustomerService; session: Session }) {
  const events = useDemoState((s) => visibleEvents(s, svc.id, session));
  const carrier = useDemoState((s) => s.organizations.find((o) => o.id === svc.carrierOrgId));
  const [comment, setComment] = useState("");
  const [incOpen, setIncOpen] = useState(false);
  const simulate = (what: string) => toast.info(`Simulación DEMO: ${what}. No se ha enviado nada real.`);

  return (
    <div className="grid gap-5 xl:grid-cols-5">
      <div className="space-y-5 xl:col-span-3">
        <Panel title={<span className="flex items-center gap-3">Servicio {svc.id} <StatusBadge status={svc.status} /></span>} action={<span className="text-sm text-muted-foreground">Ref. {svc.customerRef}</span>}>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <Item k="Origen" v={svc.origin.name} />
            <Item k="Destino" v={svc.destination.name} />
            <Item k="Mercancía" v={`${svc.cargo} · ${svc.pallets} palets`} />
            {svc.tempMin !== undefined && <Item k="Temperatura" v={<span className="inline-flex items-center gap-1"><Thermometer className="h-4 w-4 text-primary" /> {svc.tempMin} – {svc.tempMax} °C</span>} />}
            <Item k="Recogida planificada / real" v={`${fmtTime(svc.plannedPickup)} / ${fmtTime(svc.actualPickup)}`} />
            <Item k={svc.actualDelivery ? "Entrega real" : "ETA"} v={<span className={svc.delayed ? "font-semibold text-warning-foreground" : "font-semibold text-success"}>{fmtTime(svc.actualDelivery ?? svc.eta ?? svc.plannedDelivery)} {svc.delayed && "· con retraso"}</span>} />
            <Item k="Entrega planificada" v={fmtTime(svc.plannedDelivery)} />
            <Item k="Transportista" v={carrier?.name} />
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => simulate(`llamada a ${carrier?.name}`)}><Phone className="h-4 w-4" /> Llamar</Button>
            <Button variant="outline" onClick={() => simulate("mensaje de WhatsApp")}><MessageCircle className="h-4 w-4" /> WhatsApp</Button>
            <Button variant="outline" onClick={() => simulate("email al transportista")}><Mail className="h-4 w-4" /> Email</Button>
            <Dialog open={incOpen} onOpenChange={setIncOpen}>
              <DialogTrigger asChild><Button><TriangleAlert className="h-4 w-4" /> Añadir incidencia</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nueva incidencia · {svc.id}</DialogTitle></DialogHeader>
                <IncidentForm serviceId={svc.id} onDone={() => setIncOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </Panel>
        <MapView services={[svc]} />
        {svc.status === "LISTO_FACTURAR" || svc.status === "POD_VALIDADO" ? (
          <Panel title="Servicio cerrado">
            <p className="text-sm">Entrega confirmada y POD validado por el transportista. Documentación disponible en Documentos.</p>
          </Panel>
        ) : null}
      </div>
      <div className="space-y-5 xl:col-span-2">
        <Panel title="Seguimiento del servicio"><Timeline events={events} /></Panel>
        <Panel title="Comentario al transportista">
          <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); const r = addComment(getSession(), { serviceId: svc.id, text: comment }); if (r.ok) { toast.success(r.message); setComment(""); } else toast.error(r.error); }}>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Escribe un comentario" rows={2} aria-label="Comentario" />
            <Button type="submit" variant="secondary" className="w-full"><MessageSquarePlus className="h-4 w-4" /> Enviar comentario</Button>
          </form>
        </Panel>
        <Panel title="Documentos permitidos">
          {svc.documents.length ? (
            <ul className="space-y-2 text-sm">{svc.documents.map((d) => <li key={d.id} className="flex items-center justify-between rounded-lg border px-3 py-2">{d.name} <DemoBadge /></li>)}</ul>
          ) : <p className="text-sm text-muted-foreground">Aún no hay documentos disponibles.</p>}
        </Panel>
      </div>
    </div>
  );
}

function Item({ k, v }: { k: string; v: React.ReactNode }) {
  return <div><dt className="text-muted-foreground">{k}</dt><dd className="mt-0.5 font-medium">{v ?? "—"}</dd></div>;
}
