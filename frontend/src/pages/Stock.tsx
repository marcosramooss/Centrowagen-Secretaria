import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LayoutGrid, Search, Table2 } from "lucide-react";

import { AvailabilityBadge, DemoPill, EmptyState, PageHeader } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiGet } from "@/lib/api";
import { eur, fmtDateTime } from "@/lib/format";
import type { StockUnit, Vehicle } from "@/lib/types";

const ANY = "__any__";

export default function Stock() {
  const [view, setView] = useState<"cards" | "table">("cards");
  const [q, setQ] = useState("");
  const [model, setModel] = useState(ANY);
  const [fuel, setFuel] = useState(ANY);
  const [transmission, setTransmission] = useState(ANY);
  const [color, setColor] = useState(ANY);
  const [availability, setAvailability] = useState(ANY);
  const [maxPrice, setMaxPrice] = useState("");
  const [minPower, setMinPower] = useState("");

  const stock = useQuery({ queryKey: ["stock"], queryFn: () => apiGet<StockUnit[]>("/stock"), retry: false });
  const vehicles = useQuery({ queryKey: ["vehicles"], queryFn: () => apiGet<Vehicle[]>("/vehicles"), retry: false });

  const vmap = useMemo(() => {
    const m = new Map<string, Vehicle>();
    for (const v of vehicles.data ?? []) m.set(v.id, v);
    return m;
  }, [vehicles.data]);

  const all = stock.data ?? [];
  const opts = useMemo(
    () => ({
      models: [...new Set(all.map((u) => u.model))].sort(),
      fuels: [...new Set((vehicles.data ?? []).map((v) => v.fuel))].sort(),
      transmissions: [...new Set(all.map((u) => u.transmission ?? "").filter(Boolean))].sort(),
      colors: [...new Set(all.map((u) => u.exterior_color).filter(Boolean))].sort(),
      availabilities: [...new Set(all.map((u) => u.availability))].sort(),
    }),
    [all, vehicles.data],
  );

  const list = all.filter((u) => {
    const v = vmap.get(u.vehicle_id);
    if (model !== ANY && u.model !== model) return false;
    if (fuel !== ANY && v?.fuel !== fuel) return false;
    if (transmission !== ANY && u.transmission !== transmission) return false;
    if (color !== ANY && u.exterior_color !== color) return false;
    if (availability !== ANY && u.availability !== availability) return false;
    const price = u.promotional_price ?? u.pvp;
    if (maxPrice && (price == null || price > Number(maxPrice))) return false;
    if (minPower && (u.power == null || u.power < Number(minPower))) return false;
    if (q) {
      const blob = `${u.model} ${u.trim} ${u.engine ?? ""} ${u.exterior_color} ${u.stock_number} ${u.availability} ${u.location}`.toLowerCase();
      if (!q.toLowerCase().split(/\s+/).every((t) => blob.includes(t))) return false;
    }
    return true;
  });

  const lastSync = all.reduce<string | null>((acc, u) => (!acc || u.last_updated > acc ? u.last_updated : acc), null);

  function reset() {
    setQ(""); setModel(ANY); setFuel(ANY); setTransmission(ANY);
    setColor(ANY); setAvailability(ANY); setMaxPrice(""); setMinPower("");
  }

  return (
    <div data-testid="stock-page">
      <PageHeader
        title="📦 Stock"
        subtitle={lastSync ? `Última actualización del stock: ${fmtDateTime(lastSync)}` : "Unidades del punto de venta"}
        right={
          <div className="flex items-center gap-2">
            <DemoPill />
            <div className="flex items-center gap-0.5 rounded-full border border-slate-700/60 bg-slate-900/70 p-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                className={view === "cards" ? "bg-sky-600/30 text-sky-300" : ""}
                onClick={() => setView("cards")}
                data-testid="stock-view-cards-button"
                aria-label="Vista tarjetas"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className={view === "table" ? "bg-sky-600/30 text-sky-300" : ""}
                onClick={() => setView("table")}
                data-testid="stock-view-table-button"
                aria-label="Vista tabla"
              >
                <Table2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        }
      />

      <div className="glass-panel mb-5 rounded-2xl p-4" data-testid="stock-filters">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="SUV automático blanco, entrega inmediata, nº de stock…"
            className="pl-9"
            data-testid="stock-search-input"
          />
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <FilterSelect label="Modelo" value={model} onChange={setModel} options={opts.models} testId="stock-filter-model-select" />
          <FilterSelect label="Combustible" value={fuel} onChange={setFuel} options={opts.fuels} testId="stock-filter-fuel-select" />
          <FilterSelect label="Cambio" value={transmission} onChange={setTransmission} options={opts.transmissions} testId="stock-filter-transmission-select" />
          <FilterSelect label="Color" value={color} onChange={setColor} options={opts.colors} testId="stock-filter-color-select" />
          <FilterSelect label="Disponibilidad" value={availability} onChange={setAvailability} options={opts.availabilities} testId="stock-filter-availability-select" />
          <Input
            type="number"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="Precio máx. (€)"
            data-testid="stock-filter-max-price-input"
          />
          <Input
            type="number"
            value={minPower}
            onChange={(e) => setMinPower(e.target.value)}
            placeholder="Potencia mín. (CV)"
            data-testid="stock-filter-min-power-input"
          />
          <Button variant="outline" onClick={reset} data-testid="stock-filter-reset-button">
            Limpiar filtros
          </Button>
        </div>

        <p className="mt-3 text-xs text-muted-foreground" data-testid="stock-result-count">
          {list.length} de {all.length} unidades
        </p>
      </div>

      {stock.isError ? (
        <EmptyState title="No se ha podido cargar el stock" hint="Comprueba la conexión con el servidor." />
      ) : list.length === 0 ? (
        <EmptyState title="Sin unidades con esos criterios" hint="Prueba a ampliar el precio máximo o quitar filtros." />
      ) : view === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="stock-cards">
          {list.map((u) => {
            const v = vmap.get(u.vehicle_id);
            return (
              <div key={u.id} className="glass-card overflow-hidden rounded-2xl" data-testid={`stock-card-${u.stock_number}`}>
                <div className="relative aspect-[16/10] bg-slate-900">
                  {v?.image && <img src={v.image} alt={`${u.model} ${u.trim}`} className="h-full w-full object-cover" loading="lazy" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 to-transparent" aria-hidden />
                  <span className="absolute left-3 top-3 rounded-full border border-slate-600/60 bg-slate-950/80 px-2 py-0.5 font-mono text-[10px] text-slate-300">
                    Nº {u.stock_number}
                  </span>
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="text-sm font-bold text-white">{u.model} {u.trim}</p>
                    <p className="truncate text-xs text-slate-300">{u.engine}</p>
                  </div>
                </div>
                <div className="space-y-2 p-4">
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
                    <span>🎨 {u.exterior_color}</span>
                    <span>⚙️ {u.transmission?.split(" ")[0]}</span>
                    <span>🚗 {u.power ?? "—"} CV</span>
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <p className="text-price text-lg">{eur(u.promotional_price ?? u.pvp)}</p>
                    <AvailabilityBadge value={u.availability} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    📍 {u.location} · Entrega: {u.delivery_estimate ?? "—"}
                  </p>
                  <Link to={`/vehiculos/${u.vehicle_id}`}>
                    <Button variant="outline" size="sm" className="w-full" data-testid={`stock-detail-button-${u.stock_number}`}>
                      Ver ficha
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-panel rounded-2xl p-2" data-testid="stock-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Versión</TableHead>
                <TableHead>Motor</TableHead>
                <TableHead>Cambio</TableHead>
                <TableHead>Color</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((u) => (
                <TableRow key={u.id} data-testid={`stock-row-${u.stock_number}`}>
                  <TableCell className="font-mono text-xs text-slate-400">{u.stock_number}</TableCell>
                  <TableCell className="font-medium text-slate-100">{u.model}</TableCell>
                  <TableCell className="text-slate-300">{u.trim}</TableCell>
                  <TableCell className="text-slate-300">{u.engine}</TableCell>
                  <TableCell className="text-slate-300">{u.transmission?.split(" ")[0]}</TableCell>
                  <TableCell className="text-slate-300">{u.exterior_color}</TableCell>
                  <TableCell className="text-right"><span className="text-price">{eur(u.promotional_price ?? u.pvp)}</span></TableCell>
                  <TableCell><AvailabilityBadge value={u.availability} /></TableCell>
                  <TableCell>
                    <Link to={`/vehiculos/${u.vehicle_id}`} className="text-xs text-sky-400 hover:underline">
                      Ficha
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  testId: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger data-testid={testId}>
        <SelectValue>{(v) => (v === ANY || !v ? label : String(v))}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{label}: todos</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
