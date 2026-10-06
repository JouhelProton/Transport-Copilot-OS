import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyState, PageHeader, Panel, StatusBadge } from "@/components/nexo/ui";
import { useCarrierServices } from "@/lib/auth/use-portal";
import { fmtTime } from "@/lib/domain/projections";
import { STATUS_LABEL, type ServiceStatus } from "@/lib/domain/types";

export const Route = createFileRoute("/transportista/servicios/")({ component: Page });
function Page() {
  const services = useCarrierServices();
  const [q, setQ] = useState("");
  const [st, setSt] = useState<"" | ServiceStatus>("");
  const list = services.filter((s) => (!st || s.status === st) && `${s.id} ${s.customerRef} ${s.cargo} ${s.origin.name} ${s.destination.name}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageHeader title="Pedidos y servicios" subtitle="Busca y filtra · datos DEMO" />
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-60 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por ID, referencia, mercancía, ciudad…" className="h-10 pl-9" aria-label="Buscar" /></div>
        <select value={st} onChange={(e) => setSt(e.target.value as ServiceStatus | "")} className="h-10 rounded-lg border bg-card px-3 text-sm" aria-label="Filtrar por estado">
          <option value="">Todos los estados</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {list.length ? (
        <Panel className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-muted-foreground"><tr>{["ID", "Ref. cliente", "Ruta", "Mercancía", "ETA", "Estado"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
            <tbody className="divide-y">{list.map((s) => (
              <tr key={s.id} className="hover:bg-muted/50">
                <td className="px-4 py-3"><Link to="/transportista/servicios/$id" params={{ id: s.id }} className="font-semibold text-primary">{s.id}</Link></td>
                <td className="px-4 py-3">{s.customerRef}</td>
                <td className="px-4 py-3">{s.origin.name.split(" —")[0]} → {s.destination.name.split(" —")[0]}</td>
                <td className="px-4 py-3">{s.cargo} · {s.pallets} pal.</td>
                <td className="px-4 py-3">{fmtTime(s.eta ?? s.plannedDelivery)}</td>
                <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
              </tr>))}</tbody>
          </table>
        </Panel>
      ) : <EmptyState title="Sin resultados" text="Prueba con otra búsqueda o filtro." />}
    </div>
  );
}
