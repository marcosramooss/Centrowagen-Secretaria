import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { DemoPill, EmptyState, PageHeader } from "@/components/bits";
import { Input } from "@/components/ui/input";
import { apiGet } from "@/lib/api";
import { eur, fmtDate } from "@/lib/format";
import type { PriceEntry, Vehicle } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function Vehiculos() {
  const [q, setQ] = useState("");
  const [body, setBody] = useState<string>("");
  const [fuel, setFuel] = useState<string>("");

  const vehicles = useQuery({ queryKey: ["vehicles"], queryFn: () => apiGet<Vehicle[]>("/vehicles"), retry: false });
  const prices = useQuery({ queryKey: ["prices"], queryFn: () => apiGet<PriceEntry[]>("/prices"), retry: false });

  const priceMap = useMemo(() => {
    const m = new Map<string, PriceEntry>();
    for (const p of prices.data ?? []) m.set(p.vehicle_id, p);
    return m;
  }, [prices.data]);

  const all = vehicles.data ?? [];
  const bodies = useMemo(() => [...new Set(all.map((v) => v.body_type))].sort(), [all]);
  const fuels = useMemo(() => [...new Set(all.map((v) => v.fuel))].sort(), [all]);

  const list = all.filter((v) => {
    if (body && v.body_type !== body) return false;
    if (fuel && v.fuel !== fuel) return false;
    if (q) {
      const blob = `${v.model} ${v.trim} ${v.engine ?? ""} ${v.fuel} ${v.body_type}`.toLowerCase();
      if (!q.toLowerCase().split(/\s+/).every((t) => blob.includes(t))) return false;
    }
    return true;
  });

  return (
    <div data-testid="vehiculos-page">
      <PageHeader
        title="🚗 Vehículos"
        subtitle="Catálogo de la gama Volkswagen con tarifa, fuente y fecha de actualización."
        right={<DemoPill />}
      />

      <div className="glass-panel mb-5 rounded-2xl p-4" data-testid="vehiculos-filters">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Busca por modelo, acabado, motor o combustible…"
            className="pl-9"
            data-testid="vehiculos-search-input"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <FilterChip active={!body && !fuel} onClick={() => { setBody(""); setFuel(""); }} testId="vehiculos-filter-all">
            Todos
          </FilterChip>
          {bodies.map((b) => (
            <FilterChip key={b} active={body === b} onClick={() => setBody(body === b ? "" : b)} testId={`vehiculos-filter-body-${b}`}>
              {b}
            </FilterChip>
          ))}
          {fuels.map((f) => (
            <FilterChip key={f} active={fuel === f} onClick={() => setFuel(fuel === f ? "" : f)} testId={`vehiculos-filter-fuel-${f}`}>
              {f}
            </FilterChip>
          ))}
        </div>
      </div>

      {vehicles.isError ? (
        <EmptyState title="No se ha podido cargar el catálogo" hint="Comprueba la conexión con el servidor." />
      ) : list.length === 0 ? (
        <EmptyState title="Sin vehículos con esos criterios" hint="Prueba a quitar algún filtro." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="vehiculos-grid">
          {list.map((v) => {
            const p = priceMap.get(v.id);
            const shown = p?.promotional_price ?? p?.base_price ?? null;
            return (
              <Link
                key={v.id}
                to={`/vehiculos/${v.id}`}
                className="glass-card group overflow-hidden rounded-2xl"
                data-testid={`vehicle-card-${v.id}`}
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-slate-900">
                  {v.image && (
                    <img
                      src={v.image}
                      alt={`${v.model} ${v.trim}`}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                      loading="lazy"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 to-transparent" aria-hidden />
                  {v.fuel === "Eléctrico" && (
                    <span className="absolute left-3 top-3 rounded-full border border-cyan-500/40 bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-200">
                      ⚡ Eléctrico
                    </span>
                  )}
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="text-sm font-bold tracking-tight text-white">
                      {v.brand} {v.model}
                    </p>
                    <p className="truncate text-xs text-slate-300">{v.trim} · {v.engine}</p>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
                    <span>🚗 {v.power_cv ?? "—"} CV</span>
                    <span>⚙️ {v.transmission?.split(" ")[0]}</span>
                    <span>⛽ {v.fuel}</span>
                    {v.electric_range_km && <span>🔋 {v.electric_range_km} km</span>}
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">
                        {p?.promotional_price ? "Precio promocional" : "PVP"}
                      </p>
                      <p className="text-price text-lg">{eur(shown)}</p>
                    </div>
                    {p?.promotional_price && p.base_price > p.promotional_price && (
                      <p className="text-xs text-slate-500 line-through">{eur(p.base_price)}</p>
                    )}
                  </div>
                  <p className="mt-2 truncate text-[10px] text-slate-500">
                    📚 {v.source} · 📅 {fmtDate(v.last_updated)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors duration-200",
        active
          ? "border-sky-500/60 bg-sky-600/20 font-medium text-sky-300"
          : "border-slate-700/60 bg-slate-900/60 text-slate-400 hover:text-slate-200",
      )}
      data-testid={testId}
    >
      {children}
    </button>
  );
}
