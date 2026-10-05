import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";

import { DemoPill, PageHeader } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiGet } from "@/lib/api";
import { eur, eur2 } from "@/lib/format";
import type { FinancingOffer, PriceEntry, Promotion, Vehicle } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX = 4;

interface RowDef {
  label: string;
  get: (ctx: { v: Vehicle; price?: PriceEntry; fin?: FinancingOffer; promos: Promotion[] }) => string;
  better?: "low" | "high";
  numeric?: (ctx: { v: Vehicle; price?: PriceEntry; fin?: FinancingOffer }) => number | null;
}

const ROWS: RowDef[] = [
  { label: "Precio (PVP)", get: ({ price }) => eur(price?.base_price), better: "low", numeric: ({ price }) => price?.base_price ?? null },
  { label: "Precio promocional", get: ({ price }) => (price?.promotional_price ? eur(price.promotional_price) : "⚠️ No disponible"), better: "low", numeric: ({ price }) => price?.promotional_price ?? null },
  { label: "Cuota desde", get: ({ fin }) => (fin ? `${eur2(fin.monthly_payment)}/mes` : "⚠️ No disponible"), better: "low", numeric: ({ fin }) => fin?.monthly_payment ?? null },
  { label: "Motor", get: ({ v }) => v.engine ?? "—" },
  { label: "Potencia", get: ({ v }) => (v.power_cv ? `${v.power_cv} CV` : "—"), better: "high", numeric: ({ v }) => v.power_cv },
  { label: "Cambio", get: ({ v }) => v.transmission ?? "—" },
  { label: "Tracción", get: ({ v }) => v.drivetrain ?? "—" },
  { label: "Combustible", get: ({ v }) => v.fuel },
  { label: "Consumo", get: ({ v }) => (v.consumption ? `${v.consumption} ${v.fuel === "Eléctrico" ? "kWh/100 km" : "l/100 km"}` : "—"), better: "low", numeric: ({ v }) => v.consumption },
  { label: "Emisiones CO₂", get: ({ v }) => (v.co2_g != null ? `${v.co2_g} g/km` : "—"), better: "low", numeric: ({ v }) => v.co2_g },
  { label: "Autonomía eléctrica", get: ({ v }) => (v.electric_range_km ? `${v.electric_range_km} km` : "—"), better: "high", numeric: ({ v }) => v.electric_range_km },
  { label: "Maletero", get: ({ v }) => (v.trunk_l ? `${v.trunk_l} l` : "—"), better: "high", numeric: ({ v }) => v.trunk_l },
  { label: "Plazas", get: ({ v }) => String(v.seats ?? "—") },
  { label: "Largo", get: ({ v }) => (v.dimensions?.length_mm ? `${v.dimensions.length_mm} mm` : "—") },
  { label: "Distancia entre ejes", get: ({ v }) => (v.dimensions?.wheelbase_mm ? `${v.dimensions.wheelbase_mm} mm` : "—"), better: "high", numeric: ({ v }) => v.dimensions?.wheelbase_mm ?? null },
  { label: "Equipamiento (nº de elementos)", get: ({ v }) => String(v.equipment.length), better: "high", numeric: ({ v }) => v.equipment.length },
  { label: "Promociones vigentes", get: ({ promos }) => (promos.length ? promos.map((p) => p.discount ?? p.name).join(" · ") : "⚠️ Ninguna confirmada") },
];

export default function Comparador() {
  const [selected, setSelected] = useState<string[]>([]);
  const vehicles = useQuery({ queryKey: ["vehicles"], queryFn: () => apiGet<Vehicle[]>("/vehicles"), retry: false });
  const prices = useQuery({ queryKey: ["prices"], queryFn: () => apiGet<PriceEntry[]>("/prices"), retry: false });
  const fins = useQuery({ queryKey: ["financing"], queryFn: () => apiGet<FinancingOffer[]>("/financing"), retry: false });
  const promos = useQuery({ queryKey: ["promotions"], queryFn: () => apiGet<Promotion[]>("/promotions"), retry: false });

  const all = vehicles.data ?? [];
  const priceMap = useMemo(() => new Map((prices.data ?? []).map((p) => [p.vehicle_id, p])), [prices.data]);
  const finMap = useMemo(() => {
    const m = new Map<string, FinancingOffer>();
    for (const f of (fins.data ?? []).slice().sort((a, b) => a.monthly_payment - b.monthly_payment)) {
      if (f.vehicle_id && !m.has(f.vehicle_id)) m.set(f.vehicle_id, f);
    }
    return m;
  }, [fins.data]);

  const columns = selected
    .map((id) => all.find((v) => v.id === id))
    .filter((v): v is Vehicle => Boolean(v))
    .map((v) => ({
      v,
      price: priceMap.get(v.id),
      fin: finMap.get(v.id),
      promos: (promos.data ?? []).filter(
        (p) => p.status !== "finalizada" && (p.model === v.model || p.model === "Todos"),
      ),
    }));

  const available = all.filter((v) => !selected.includes(v.id));

  return (
    <div data-testid="comparador-page">
      <PageHeader
        title="📊 Comparador"
        subtitle={`Compara hasta ${MAX} vehículos. Las mejores cifras de cada fila se resaltan en verde.`}
        right={<DemoPill />}
      />

      <div className="glass-panel mb-5 flex flex-wrap items-center gap-2 rounded-2xl p-4" data-testid="comparador-picker">
        <Select
          value=""
          onValueChange={(id) => {
            if (id && selected.length < MAX && !selected.includes(id)) setSelected((s) => [...s, id]);
          }}
        >
          <SelectTrigger className="w-full sm:w-[320px]" data-testid="compare-add-vehicle-btn">
            <SelectValue>{() => (selected.length >= MAX ? `Máximo ${MAX} vehículos` : "Añadir vehículo a la comparativa")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {available.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.model} {v.trim} · {v.engine}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selected.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setSelected([])} data-testid="compare-clear-button">
            Vaciar comparativa
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{selected.length} / {MAX}</span>
      </div>

      {columns.length === 0 ? (
        <div className="glass-panel flex flex-col items-center gap-3 rounded-2xl p-12 text-center" data-testid="comparador-empty">
          <Plus className="h-7 w-7 text-sky-400" />
          <p className="font-medium text-slate-200">Añade vehículos para comparar</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Selecciona entre 2 y {MAX} versiones de la gama para ver precio, motor, consumo, equipamiento y promociones
            en paralelo.
          </p>
        </div>
      ) : (
        <div className="glass-panel overflow-x-auto rounded-2xl" data-testid="comparador-table">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-slate-900/95 p-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                  Característica
                </th>
                {columns.map(({ v }) => (
                  <th key={v.id} className="min-w-[180px] border-l border-slate-800/60 p-3 text-left align-top">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white">{v.model}</p>
                        <p className="truncate text-[11px] text-slate-400">{v.trim}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setSelected((s) => s.filter((id) => id !== v.id))}
                        data-testid={`compare-remove-${v.id}`}
                        aria-label={`Quitar ${v.model}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {v.image && (
                      <img src={v.image} alt="" className="mt-2 h-20 w-full rounded-lg object-cover" loading="lazy" />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => {
                const values = columns.map((c) => (row.numeric ? row.numeric(c) : null));
                const valid = values.filter((n): n is number => n != null);
                let best: number | null = null;
                if (row.better && valid.length > 1) {
                  best = row.better === "low" ? Math.min(...valid) : Math.max(...valid);
                }
                return (
                  <tr key={row.label} className="border-t border-slate-800/60" data-testid={`compare-row-${row.label}`}>
                    <td className="sticky left-0 z-10 bg-slate-900/95 p-3 text-xs font-medium text-slate-400">
                      {row.label}
                    </td>
                    {columns.map((c, i) => {
                      const isBest = best != null && values[i] === best;
                      return (
                        <td
                          key={c.v.id}
                          className={cn(
                            "border-l border-slate-800/60 p-3 text-slate-200",
                            isBest && "bg-emerald-500/10 font-semibold text-emerald-300",
                          )}
                        >
                          {row.get(c)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        ⚠️ DATOS DE DEMOSTRACIÓN. Las diferencias resaltadas son orientativas y no sustituyen la ficha técnica oficial.
      </p>
    </div>
  );
}
