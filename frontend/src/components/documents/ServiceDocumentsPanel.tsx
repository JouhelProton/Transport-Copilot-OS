import { useState } from "react";
import { CheckCircle2, Download, Eye, FileText, History, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/nexo/ui";
import type { Session } from "@/lib/auth/session";
import {
  downloadDocument,
  previewDocument,
  useServiceDocuments,
  useServicePod,
  useUpdateDocumentStatus,
  useUpdatePodStatus,
  useUploadDocument,
  useGenerateDocument,
  type ApiDocument,
  type DocumentStatus,
  type DocumentType,
  type PodStatus,
} from "@/lib/api/operations";
import { fmtDateTime } from "@/lib/domain/projections";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<DocumentType, string> = {
  DELIVERY_NOTE: "Albarán",
  CMR: "Carta de porte / CMR",
  POD: "Justificante de entrega",
  DELIVERY_PHOTO: "Fotografía de entrega",
  SERVICE_ATTACHMENT: "Adjunto del servicio",
};

const STATUS_LABEL: Record<DocumentStatus | PodStatus, string> = {
  PENDING: "Pendiente",
  UPLOADED: "Subido",
  SUBMITTED: "Enviado",
  IN_REVIEW: "En revisión",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
};

function StatusPill({ status }: { status: DocumentStatus | PodStatus }) {
  return (
    <span className={cn(
      "rounded-full px-2.5 py-1 text-xs font-semibold",
      status === "APPROVED" && "bg-success/15 text-success",
      status === "REJECTED" && "bg-destructive/10 text-destructive",
      !["APPROVED", "REJECTED"].includes(status) && "bg-primary/10 text-primary",
    )}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function DocumentActions({ document }: { document: ApiDocument }) {
  const run = async (mode: "download" | "preview") => {
    try {
      await (mode === "download" ? downloadDocument(document) : previewDocument(document));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo abrir el documento");
    }
  };
  return (
    <span className="flex gap-1">
      {(document.mimeType.startsWith("image/") || document.mimeType === "application/pdf") && (
        <Button size="sm" variant="ghost" onClick={() => void run("preview")} aria-label={`Vista previa de ${document.originalName}`}><Eye className="h-4 w-4" /></Button>
      )}
      <Button size="sm" variant="outline" onClick={() => void run("download")}><Download className="h-4 w-4" /> Descargar</Button>
    </span>
  );
}

export function ServiceDocumentsPanel({ session, serviceId, canManage = false }: { session: Session; serviceId: string; canManage?: boolean }) {
  const documents = useServiceDocuments(session, serviceId);
  const pod = useServicePod(session, serviceId);
  const upload = useUploadDocument(session, serviceId);
  const generate = useGenerateDocument(session, serviceId);
  const updateDocument = useUpdateDocumentStatus(session, serviceId);
  const updatePod = useUpdatePodStatus(session, serviceId);
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<DocumentType>("DELIVERY_NOTE");
  const [visibility, setVisibility] = useState<"SHARED" | "INTERNAL">("SHARED");
  const [reason, setReason] = useState("");

  const submit = () => {
    if (!file) return;
    upload.mutate({ file, type, visibility }, {
      onSuccess: () => { setFile(null); toast.success("Documento almacenado de forma segura"); },
      onError: (error) => toast.error(error.message),
    });
  };

  const validateDocument = (documentId: string, status: "IN_REVIEW" | "APPROVED" | "REJECTED") => {
    if (status === "REJECTED" && reason.trim().length < 3) { toast.error("Indica el motivo del rechazo"); return; }
    updateDocument.mutate({ documentId, status, ...(reason.trim() ? { reason: reason.trim() } : {}) }, {
      onSuccess: () => { setReason(""); toast.success("Estado documental actualizado"); },
      onError: (error) => toast.error(error.message),
    });
  };

  const validatePod = (status: "IN_REVIEW" | "APPROVED" | "REJECTED") => {
    if (status === "REJECTED" && reason.trim().length < 3) { toast.error("Indica el motivo del rechazo"); return; }
    updatePod.mutate({ status, ...(reason.trim() ? { reason: reason.trim() } : {}) }, {
      onSuccess: () => { setReason(""); toast.success("POD actualizado"); },
      onError: (error) => toast.error(error.message),
    });
  };

  const generateDocument = (type: "DELIVERY_NOTE" | "POD") => generate.mutate(type, {
    onSuccess: () => toast.success(type === "POD" ? "Justificante de entrega generado" : "Albarán generado"),
    onError: (error) => toast.error(error.message),
  });

  return (
    <Panel title="Documentos y prueba de entrega">
      <div className="space-y-5">
        {canManage && (
          <div className="grid gap-3 rounded-xl border bg-muted/30 p-4 md:grid-cols-[1fr_180px_150px_auto]">
            <input className="min-w-0 rounded-lg border bg-card px-3 py-2 text-sm" type="file" accept="application/pdf,image/jpeg,image/png,image/heic,image/heif" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            <select className="rounded-lg border bg-card px-3 py-2 text-sm" value={type} onChange={(event) => setType(event.target.value as DocumentType)}>{Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <select className="rounded-lg border bg-card px-3 py-2 text-sm" value={visibility} onChange={(event) => setVisibility(event.target.value as "SHARED" | "INTERNAL")}><option value="SHARED">Compartido</option><option value="INTERNAL">Interno</option></select>
            <Button disabled={!file || upload.isPending} onClick={submit}><Upload className="h-4 w-4" /> {upload.isPending ? "Subiendo…" : "Subir"}</Button>
          </div>
        )}

        {canManage && <div className="flex flex-wrap gap-2 rounded-xl border border-dashed p-4"><span className="mr-2 self-center text-sm font-medium text-muted-foreground">Generar documento operativo:</span><Button variant="outline" disabled={generate.isPending} onClick={() => generateDocument("DELIVERY_NOTE")}><FileText className="h-4 w-4" /> Albarán</Button><Button variant="outline" disabled={generate.isPending || !pod.data} onClick={() => generateDocument("POD")}><CheckCircle2 className="h-4 w-4" /> Justificante POD</Button></div>}

        {canManage && <input className="w-full rounded-lg border bg-card px-3 py-2 text-sm" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo para un posible rechazo" maxLength={500} />}

        {documents.isLoading ? <p className="text-sm text-muted-foreground">Cargando documentos…</p> : documents.isError ? <p role="alert" className="text-sm text-destructive">{documents.error.message}</p> : documents.data?.length ? (
          <ul className="space-y-3">
            {documents.data.map((document) => (
              <li key={document.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><FileText className="h-5 w-5" /></span><div className="min-w-0"><p className="truncate font-semibold">{document.originalName}</p><p className="text-xs text-muted-foreground">{TYPE_LABEL[document.type]} · {(document.sizeBytes / 1024).toFixed(1)} KB · {fmtDateTime(document.uploadedAt)}</p><p className="mt-1 font-mono text-[10px] text-muted-foreground" title={document.sha256}>SHA-256 {document.sha256.slice(0, 16)}…</p></div></div>
                  <div className="flex flex-wrap items-center gap-2"><StatusPill status={document.status} /><DocumentActions document={document} /></div>
                </div>
                {canManage && <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => validateDocument(document.id, "IN_REVIEW")}>Revisar</Button><Button size="sm" variant="outline" onClick={() => validateDocument(document.id, "APPROVED")}><CheckCircle2 className="h-4 w-4" /> Aprobar</Button><Button size="sm" variant="outline" onClick={() => validateDocument(document.id, "REJECTED")}><XCircle className="h-4 w-4" /> Rechazar</Button></div>}
                {!!document.history.length && <details className="mt-3 text-xs text-muted-foreground"><summary className="cursor-pointer font-medium"><History className="mr-1 inline h-3.5 w-3.5" /> Historial ({document.history.length})</summary><ul className="mt-2 space-y-1">{document.history.map((item) => <li key={item.id}>{fmtDateTime(item.changedAt)} · {STATUS_LABEL[item.toStatus]} · {item.changedBy.name}{item.reason ? ` · ${item.reason}` : ""}</li>)}</ul></details>}
              </li>
            ))}
          </ul>
        ) : <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Todavía no hay documentos reales asociados a este servicio.</p>}

        <div className="rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold tracking-widest text-primary">PROOF OF DELIVERY</p><h3 className="mt-1 font-semibold">Prueba de entrega</h3></div>{pod.data ? <StatusPill status={pod.data.status} /> : <StatusPill status="PENDING" />}</div>
          {pod.data ? <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><p><span className="text-muted-foreground">Conductor:</span> {pod.data.driver.name}</p><p><span className="text-muted-foreground">Entrega:</span> {fmtDateTime(pod.data.deliveredAt)}</p><p><span className="text-muted-foreground">Receptor:</span> {pod.data.receiverName || "No indicado"}</p><p><span className="text-muted-foreground">Verificación:</span> <code>{pod.data.verificationCode}</code></p>{pod.data.observations && <p className="sm:col-span-2"><span className="text-muted-foreground">Observaciones:</span> {pod.data.observations}</p>}</div> : <p className="mt-3 text-sm text-muted-foreground">El conductor todavía no ha enviado una prueba de entrega.</p>}
          {canManage && pod.data && <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => validatePod("IN_REVIEW")}>Marcar en revisión</Button><Button size="sm" variant="outline" onClick={() => validatePod("APPROVED")}><CheckCircle2 className="h-4 w-4" /> Aprobar POD</Button><Button size="sm" variant="outline" onClick={() => validatePod("REJECTED")}><XCircle className="h-4 w-4" /> Rechazar POD</Button></div>}
          {!!pod.data?.history.length && <details className="mt-3 text-xs text-muted-foreground"><summary className="cursor-pointer font-medium">Historial del POD ({pod.data.history.length})</summary><ul className="mt-2 space-y-1">{pod.data.history.map((item) => <li key={item.id}>{fmtDateTime(item.changedAt)} · {STATUS_LABEL[item.toStatus]} · {item.changedBy.name}{item.reason ? ` · ${item.reason}` : ""}</li>)}</ul></details>}
        </div>
      </div>
    </Panel>
  );
}
