import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Camera, FileText, LocateFixed, MapPinCheck, Phone, QrCode, Thermometer, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IncidentForm } from "@/components/nexo/IncidentForm";
import { MapView } from "@/components/nexo/MapView";
import { DemoBadge, EmptyState, Panel, StatusBadge } from "@/components/nexo/ui";
import { completeDelivery, driverArrived, shareLocation, type ActionResult } from "@/lib/domain/actions";
import { fmtTime } from "@/lib/domain/projections";
import { getSession } from "@/lib/auth/session";
import { useDriverServices } from "@/lib/auth/use-portal";

export const Route = createFileRoute("/conductor/")({ component: Page });
const notify = (r: ActionResult) => (r.ok ? toast.success(r.message) : toast.error(r.error));

function Page() {
  const services = useDriverServices();
  const svc = services.find((s) => !["POD_VALIDADO", "LISTO_FACTURAR"].includes(s.status)) ?? services[0];
  const [receiver, setReceiver] = useState("");
  const [file, setFile] = useState<string>();
  const [podErr, setPodErr] = useState<string>();
  const [incOpen, setIncOpen] = useState(false);
  const [podOpen, setPodOpen] = useState(false);
  if (!svc) return <EmptyState title="Sin servicios asignados" text="Operaciones te asignará el próximo servicio." />;

  const share = () => {
    if (!("geolocation" in navigator)) { notify(shareLocation(getSession(), svc.id)); return; }
    navigator.geolocation.getCurrentPosition(
      () => notify(shareLocation(getSession(), svc.id)), // DEMO: no se usa la posición real
      () => { toast.info("Permiso denegado. Se envía ubicación DEMO simulada."); notify(shareLocation(getSession(), svc.id)); },
      { timeout: 5000 },
    );
  };
  const closed = ["ENTREGADO", "POD_VALIDADO", "LISTO_FACTURAR"].includes(svc.status);

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Servicio actual</span><StatusBadge status={svc.status} /></div>
        <p className="mt-1 font-display text-2xl font-semibold">{svc.id}</p>
        <p className="mt-2 text-base"><strong>{svc.origin.name.split(" —")[0]}</strong> → <strong>{svc.destination.name.split(" —")[0]}</strong></p>
        <p className="text-sm text-muted-foreground">{svc.destination.address} · entrega {fmtTime(svc.plannedDelivery)}</p>
        <p className="mt-2 flex items-center gap-1.5 text-sm"><Thermometer className="h-4 w-4 text-primary" /> {svc.cargo} · {svc.pallets} palets{svc.tempMin !== undefined && ` · ${svc.tempMin}–${svc.tempMax} °C`}</p>
      </Panel>

      {svc.status === "EN_RUTA" || svc.status === "ASIGNADO" ? (
        <Button className="h-16 w-full bg-success text-lg text-success-foreground hover:bg-success/90" onClick={() => notify(driverArrived(getSession(), svc.id))}><MapPinCheck className="h-6 w-6" /> He llegado a destino</Button>
      ) : svc.status === "EN_DESTINO" ? (
        <Drawer open={podOpen} onOpenChange={setPodOpen}>
          <DrawerTrigger asChild><Button className="h-16 w-full text-lg"><Camera className="h-6 w-6" /> Entregar y subir POD</Button></DrawerTrigger>
          <DrawerContent>
            <DrawerHeader><DrawerTitle>Entrega y POD · {svc.id}</DrawerTitle></DrawerHeader>
            <form className="space-y-4 p-4" onSubmit={(e) => { e.preventDefault(); const r = completeDelivery(getSession(), { serviceId: svc.id, receiverName: receiver, fileName: file ?? "" }); if (!r.ok) return setPodErr(r.error); notify(r); setPodOpen(false); }}>
              <div className="space-y-1.5"><Label htmlFor="rec">Nombre de quien recibe</Label><Input id="rec" className="h-12" value={receiver} onChange={(e) => setReceiver(e.target.value)} /></div>
              <div className="space-y-2">
                <Label htmlFor="pod">Foto o PDF del POD</Label>
                <Input id="pod" type="file" accept="image/*,application/pdf" capture="environment" onChange={(e) => setFile(e.target.files?.[0]?.name)} />
                <Button type="button" variant="outline" className="w-full" onClick={() => setFile("POD-muestra-NV-24081.pdf")}>Usar POD de muestra DEMO</Button>
                {file && <p className="text-sm">Archivo: {file}</p>}
              </div>
              {podErr && <p role="alert" className="text-sm text-destructive">{podErr}</p>}
              <Button type="submit" className="h-12 w-full text-base" disabled={!file}>Confirmar entrega</Button>
              <p className="text-xs text-muted-foreground">DEMO: el archivo no se sube a ningún servidor; solo se registra su nombre.</p>
            </form>
          </DrawerContent>
        </Drawer>
      ) : (
        <div className="rounded-xl bg-success/15 p-4 text-center font-semibold text-success">Entrega completada{svc.pod?.validated ? " · POD validado" : " · POD pendiente de validar"}</div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Drawer open={incOpen} onOpenChange={setIncOpen}>
          <DrawerTrigger asChild><Button variant="outline" className="h-14 text-base"><TriangleAlert className="h-5 w-5" /> Incidencia</Button></DrawerTrigger>
          <DrawerContent><DrawerHeader><DrawerTitle>Nueva incidencia</DrawerTitle></DrawerHeader><div className="p-4"><IncidentForm serviceId={svc.id} large onDone={() => setIncOpen(false)} /></div></DrawerContent>
        </Drawer>
        <Button variant="outline" className="h-14 text-base" onClick={() => toast.info("Simulación DEMO: llamada a operaciones no realizada.")}><Phone className="h-5 w-5" /> Operaciones</Button>
        <Button variant="outline" className="col-span-2 h-14 text-base" onClick={share} disabled={closed}><LocateFixed className="h-5 w-5" /> Compartir ubicación</Button>
      </div>
      <p className="text-xs text-muted-foreground">La ubicación se envía una sola vez al pulsar. El navegador no permite seguimiento GPS en segundo plano. En DEMO se usa una posición simulada.</p>

      <MapView services={[svc]} height="h-56" />

      <Panel title="Documentos">
        <ul className="space-y-2">
          <li className="flex items-center justify-between rounded-lg border p-3"><span className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Carta de porte</span><DemoBadge /></li>
          <li className="flex items-center justify-between rounded-lg border p-3"><span className="flex items-center gap-2"><QrCode className="h-5 w-5 text-primary" /> DeCA / QR</span><DemoBadge /></li>
        </ul>
        <div className="mt-3 grid place-items-center rounded-lg border bg-card p-4" aria-label="QR DEMO">
          <div className="grid grid-cols-8 gap-0.5">{Array.from({ length: 64 }).map((_, i) => <span key={i} className={`h-3 w-3 ${(i * 7 + (i >> 3)) % 3 ? "bg-ink" : "bg-card"}`} />)}</div>
          <p className="mt-2 text-xs text-muted-foreground">QR ilustrativo DEMO — no válido</p>
        </div>
      </Panel>
    </div>
  );
}
