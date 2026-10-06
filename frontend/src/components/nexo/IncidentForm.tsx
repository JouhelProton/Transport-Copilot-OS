import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { reportIncident } from "@/lib/domain/actions";
import { getSession } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

const TYPES = [
  ["RETRASO", "Retraso"],
  ["TEMPERATURA", "Temperatura"],
  ["DAÑO", "Daño en mercancía"],
  ["DOCUMENTACION", "Documentación"],
  ["ACCESO", "Acceso / muelle"],
  ["OTRO", "Otro"],
] as const;

export function IncidentForm({ serviceId, onDone, large }: { serviceId: string; onDone?: () => void; large?: boolean }) {
  const [type, setType] = useState<(typeof TYPES)[number][0]>("RETRASO");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string>();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const r = reportIncident(getSession(), { serviceId, type, description });
        if (!r.ok) return setError(r.error);
        toast.success(r.message);
        setDescription("");
        setError(undefined);
        onDone?.();
      }}
    >
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Tipo de incidencia</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TYPES.map(([v, l]) => (
            <button type="button" key={v} onClick={() => setType(v)} aria-pressed={type === v} className={cn("rounded-lg border px-3 text-sm font-medium", large ? "py-3" : "py-2", type === v ? "border-primary bg-primary/10 text-primary" : "bg-card")}>
              {l}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor={`desc-${serviceId}`}>Descripción</Label>
        <Textarea id={`desc-${serviceId}`} value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Describe lo ocurrido" aria-invalid={!!error} />
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      </div>
      <Button type="submit" className={cn("w-full", large && "h-12 text-base")}>Enviar incidencia</Button>
      <p className="text-xs text-muted-foreground">Simulación DEMO: se registra en el sistema compartido, no se envía ningún aviso real.</p>
    </form>
  );
}
