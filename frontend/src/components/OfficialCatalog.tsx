import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Car, Check, ExternalLink, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiGet, apiPost } from "@/lib/api";
import type { OfficialCatalog as Catalog, OfficialModel } from "@/lib/catalog";
import { useMe } from "@/lib/session";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const SOURCES = ["https://www.volkswagen.es/es/modelos.html", "https://www.volkswagen-comerciales.es/es/modelos.html"];

function Photo({ model, context }: { model: OfficialModel; context: string }) {
  const [failed, setFailed] = useState(false);
  return <div className="relative flex aspect-[2/1] items-center justify-center overflow-hidden rounded-xl bg-[#142131]" data-testid={`${context}-photo-${model.id}`}>
    {model.image && !failed ? <img src={model.image} alt={`Volkswagen ${model.name}, imagen oficial de gama`} referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105" onError={() => setFailed(true)} /> :
      <a href={model.detail_url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-3 p-5 text-sm text-slate-300 hover:text-sky-300" data-testid={`${context}-photo-fallback-${model.id}`}><Car size={36} strokeWidth={1} />Fotografía no disponible · Ver en Volkswagen<ExternalLink size={14} /></a>}
  </div>;
}

export default function OfficialCatalog() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("todos");
  const [fuel, setFuel] = useState("");
  const [selected, setSelected] = useState<OfficialModel | null>(null);
  const catalog = useQuery({ queryKey: ["official-catalog"], queryFn: () => apiGet<Catalog>("/catalog/official"), retry: false });
  const refresh = useMutation({
    mutationFn: () => apiPost<Catalog>("/catalog/refresh"),
    onSuccess: (data) => { qc.setQueryData(["official-catalog"], data); toast.success(`${data.models.length} modelos consultados en Volkswagen España`); },
    onError: () => toast.error("No se pudo actualizar la gama. Se conserva la última consulta y los enlaces oficiales."),
  });
  const all = catalog.data?.models ?? [];
  const models = all.filter(m => (category === "todos" || m.category === category) && (!fuel || m.fuels.includes(fuel)) && `${m.name} ${m.body_types.join(" ")}`.toLocaleLowerCase("es").includes(q.toLocaleLowerCase("es").trim()));
  return <section data-testid="official-catalog">
    <header className="mb-7 flex flex-wrap items-end justify-between gap-6 border-b border-slate-800 pb-7">
      <div className="max-w-2xl">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-[.23em] text-sky-400" data-testid="catalog-eyebrow">Volkswagen España / Centrowagen</p>
        <h1 className="font-heading text-4xl font-medium tracking-tight md:text-5xl" data-testid="catalog-title">Una gama. Todas las posibilidades.</h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-400" data-testid="catalog-description">Turismos y vehículos comerciales, desde sus fuentes oficiales. Características de gama para orientar la conversación; condiciones comerciales solo desde tus archivos.</p>
      </div>
      {me?.role === "admin" && <Button variant="outline" className="min-h-11 gap-2" disabled={refresh.isPending} onClick={() => refresh.mutate()} data-testid="catalog-refresh-button"><RefreshCw size={15} className={refresh.isPending ? "animate-spin" : ""} />{refresh.isPending ? "Consultando Volkswagen…" : all.length ? "Actualizar desde VW" : "Cargar gama oficial"}</Button>}
    </header>

    <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-4">
      <div className="flex items-center gap-2 text-xs text-emerald-300" data-testid="catalog-provenance"><ShieldCheck size={17} />{catalog.data?.checked_at ? "Origen: catálogo oficial Volkswagen" : "Consulta directa a Volkswagen España"}</div>
      <span className="text-xs text-slate-400" data-testid="catalog-checked-date">Última consulta: {catalog.data?.checked_at ? fmtDate(catalog.data.checked_at) : "Pendiente"}</span>
      <div className="ml-auto flex flex-wrap gap-4">{SOURCES.map((url, i) => <a href={url} key={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-sky-300 transition-colors hover:text-white" data-testid={`catalog-source-${i}`}>{i ? "VW Comerciales" : "VW Turismos"}<ArrowUpRight size={14} /></a>)}</div>
    </div>
    <div className="mb-6 flex flex-wrap items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/30 p-4" data-testid="catalog-auto-sync"><RefreshCw size={16} className="mt-0.5 text-sky-400" /><div><p className="text-xs text-slate-200" data-testid="catalog-auto-schedule">Actualización automática · {catalog.data?.automatic_schedule ?? "Diariamente a las 08:00 · Europe/Madrid"}</p><p className="mt-1 text-xs text-slate-400" data-testid="catalog-auto-next">{catalog.data?.next_sync_at ? `Próxima consulta prevista: ${fmtDateTime(catalog.data.next_sync_at)}. ` : ""}Los nuevos modelos se incorporan desde Volkswagen, sin modificar tus precios ni tu stock.</p></div></div>
    {(catalog.isError || refresh.isError || catalog.data?.stale || catalog.data?.sync_status === "error") && <p role="status" className="mb-5 rounded-lg border border-amber-800/60 bg-amber-950/20 p-3 text-sm text-amber-200" data-testid="catalog-source-warning">{catalog.data?.sync_error || (catalog.data?.stale ? "Consulta de hace más de 7 días. Actualiza la fuente antes de asesorar al cliente." : "No se pudo consultar el servidor o Volkswagen. Utiliza los enlaces oficiales; los datos anteriores no son una consulta en directo.")}</p>}
    {catalog.data?.warnings.map((warning, i) => <p key={warning} className="mb-4 text-sm text-slate-400" data-testid={`catalog-warning-${i}`}>{warning}</p>)}

    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap gap-1 rounded-lg border border-slate-800 bg-slate-950/40 p-1" data-testid="catalog-category-filter">
        {[["todos", "Toda la gama"], ["turismos", "Turismos"], ["comerciales", "Comerciales"]].map(([value, label]) => <button key={value} type="button" aria-pressed={category === value} onClick={() => setCategory(value)} className={cn("min-h-10 rounded-md px-4 text-sm transition-colors", category === value ? "bg-slate-700/60 text-white" : "text-slate-400 hover:text-white")} data-testid={`catalog-filter-${value}`}>{label}</button>)}
      </div>
      <div className="flex w-full gap-2 sm:w-auto">
        <div className="relative min-w-0 flex-1"><Search size={15} className="absolute left-3 top-3 text-slate-500" /><Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar modelo…" aria-label="Buscar modelo oficial" className="h-10 pl-9 sm:w-52" data-testid="catalog-search-input" /></div>
        <select value={fuel} onChange={e => setFuel(e.target.value)} className="max-w-40 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-slate-300" aria-label="Motorización" data-testid="catalog-fuel-filter"><option value="">Motorización</option>{[...new Set(all.flatMap(m => m.fuels))].sort().map(f => <option key={f}>{f}</option>)}</select>
      </div>
    </div>
    <div className="mb-4 flex items-center justify-between gap-3"><p className="text-xs text-slate-400" data-testid="catalog-model-count"><strong className="font-mono text-white">{models.length}</strong> modelos y familias de gama</p><Link to="/archivos?seccion=catalogo" className="text-xs text-sky-300 hover:underline" data-testid="catalog-import-link">Completar datos del concesionario ↗</Link></div>
    <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3" data-testid="catalog-model-grid">
      {models.map((m, i) => <article key={m.id} className="group animate-fade-up overflow-hidden rounded-2xl border border-slate-800 bg-[#0e1725] p-3 transition-[border-color,transform] duration-200 hover:-translate-y-1 hover:border-slate-600" style={{ animationDelay: `${Math.min(i * 40, 240)}ms` }} data-testid={`official-model-${m.id}`}>
        <Photo model={m} context="card" />
        <div className="p-3 pb-2">
          <div className="mb-2 flex items-center justify-between gap-2"><p className="text-[10px] uppercase tracking-[.16em] text-slate-400" data-testid={`catalog-category-${m.id}`}>{m.category === "turismos" ? "Volkswagen Turismos" : "Volkswagen Comerciales"}</p><Check size={14} className="text-emerald-400" aria-label="Listado en fuente oficial" /></div>
          <h2 className="text-2xl font-medium tracking-tight text-white" data-testid={`catalog-name-${m.id}`}>{m.name}</h2>
          <p className="mt-2 min-h-10 text-xs leading-5 text-slate-400" data-testid={`catalog-fuels-${m.id}`}>{m.fuels.join(" · ") || "Motorización: consultar ficha oficial"}</p>
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-800 pt-3"><button type="button" onClick={() => setSelected(m)} className="min-h-10 text-sm text-slate-100 transition-colors hover:text-sky-300" data-testid={`catalog-detail-${m.id}`}>Características <span aria-hidden>→</span></button><a href={m.detail_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1 text-xs text-sky-300 transition-colors hover:text-white" data-testid={`catalog-link-${m.id}`}>Web oficial<ArrowUpRight size={14} /></a></div>
        </div>
      </article>)}
    </div>
    {!models.length && <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-14 text-center" data-testid="catalog-empty"><Car className="mx-auto mb-4 text-slate-500" size={34} /><h2 className="text-xl">{all.length ? "Sin modelos con estos filtros" : "Tu catálogo empieza en la fuente oficial"}</h2><p className="mt-2 text-sm text-slate-400">{all.length ? "Prueba con otro modelo o motorización." : "Carga la gama desde Volkswagen o consulta sus webs oficiales. No se muestran datos de ejemplo."}</p></div>}
    <p className="mt-7 max-w-4xl text-xs leading-5 text-slate-500" data-testid="catalog-disclaimer">Fotografías oficiales de gama, no de unidades en stock. Los acabados y motores pueden variar; no se deducen combinaciones, equipamientos, precios ni disponibilidad. La consulta es diaria, no instantánea: depende de que las webs oficiales estén disponibles. La fecha indica la última consulta correcta, no una homologación independiente.</p>

    <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl" data-testid="catalog-detail-dialog">
        {selected && <><DialogHeader><DialogTitle className="text-3xl" data-testid="catalog-detail-title">Volkswagen {selected.name}</DialogTitle><DialogDescription data-testid="catalog-detail-description">Características publicadas en la gama oficial · {fmtDate(catalog.data?.checked_at)}</DialogDescription></DialogHeader>
          <Photo key={selected.id} model={selected} context="detail" />
          <dl className="divide-y divide-slate-800">{[["Carrocería", selected.body_types.join(" · ")], ["Motorizaciones", selected.fuels.join(" · ")], ["Transmisiones", selected.transmissions.join(" · ")], ["Potencias publicadas", selected.power_cv.map(p => `${p} CV`).join(" · ")], ["Acabados publicados", selected.trims.join(" · ")]].map(([name, value], i) => <div className="grid grid-cols-[1fr_1.7fr] gap-4 py-3 text-sm" key={name} data-testid={`catalog-detail-spec-${i}`}><dt className="text-slate-400">{name}</dt><dd className="text-slate-100">{value || "No consta en la fuente consultada"}</dd></div>)}</dl>
          <p className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-xs leading-5 text-slate-400" data-testid="catalog-detail-caveat">Datos agregados de gama: no implican que cada motor esté disponible con cada acabado. Precio, autonomía, equipamiento y entrega deben confirmarse para la versión concreta.</p>
          <a href={selected.detail_url} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm text-white transition-colors hover:bg-blue-700" data-testid="catalog-detail-official-link">Consultar en Volkswagen <ExternalLink size={15} /></a></>}
      </DialogContent>
    </Dialog>
  </section>;
}