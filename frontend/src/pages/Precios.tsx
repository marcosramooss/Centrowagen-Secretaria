import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { DemoPill, EmptyState, PageHeader, StaleWarning } from "@/components/bits";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiGet } from "@/lib/api";
import { eur, fmtDate } from "@/lib/format";
import type { PriceEntry, Vehicle } from "@/lib/types";

export default function Precios() {
  const prices = useQuery({ queryKey: ["prices"], queryFn: () => apiGet<PriceEntry[]>("/prices"), retry: false });
  const vehicles = useQuery({ queryKey: ["vehicles"], queryFn: () => apiGet<Vehicle[]>("/vehicles"), retry: false });

  const vmap = useMemo(() => {
    const m = new Map<string, Vehicle>();
    for (const v of vehicles.data ?? []) m.set(v.id, v);
    return m;
  }, [vehicles.data]);

  const rows = (prices.data ?? []).map((p) => ({ p, v: vmap.get(p.vehicle_id) }));
  const lastUpdate = (prices.data ?? []).reduce<string | null>(
    (acc, p) => (!acc || p.last_updated > acc ? p.last_updated : acc),
    null,
  );

  return (
    <div data-testid="precios-page">
      <PageHeader
        title="💰 Precios & Tarifas"
        subtitle={lastUpdate ? `Última actualización de precios: ${fmtDate(lastUpdate)}` : "Tarifa oficial y precios de campaña"}
        right={<DemoPill />}
      />

      {prices.isError ? (
        <EmptyState title="No se han podido cargar las tarifas" hint="Comprueba la conexión con el servidor." />
      ) : rows.length === 0 ? (
        <EmptyState title="Sin tarifas registradas" hint="Las tarifas oficiales se cargarán desde la documentación." />
      ) : (
        <div className="glass-panel rounded-2xl p-2" data-testid="precios-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Modelo</TableHead>
                <TableHead>Versión</TableHead>
                <TableHead className="text-right">PVP</TableHead>
                <TableHead className="text-right">Promocional</TableHead>
                <TableHead className="text-right">Con financiación</TableHead>
                <TableHead className="text-right">Dto.</TableHead>
                <TableHead>Campaña</TableHead>
                <TableHead>Vigencia</TableHead>
                <TableHead>Fuente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ p, v }) => (
                <TableRow key={p.id} data-testid={`price-row-${p.id}`}>
                  <TableCell className="font-medium text-slate-100">
                    {v ? (
                      <Link to={`/vehiculos/${v.id}`} className="hover:text-sky-400">
                        {v.model}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-slate-300">{v?.trim ?? "—"}</TableCell>
                  <TableCell className="text-right"><span className="text-price">{eur(p.base_price)}</span></TableCell>
                  <TableCell className="text-right">
                    {p.promotional_price ? <span className="text-price">{eur(p.promotional_price)}</span> : <span className="text-xs text-slate-500">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {p.financing_price ? <span className="text-price">{eur(p.financing_price)}</span> : <span className="text-xs text-slate-500">—</span>}
                  </TableCell>
                  <TableCell className="text-right text-sm text-emerald-300">{p.discount ? `${p.discount}%` : "—"}</TableCell>
                  <TableCell className="text-xs text-slate-300">{p.campaign ?? "—"}</TableCell>
                  <TableCell className="text-xs text-slate-400">
                    {fmtDate(p.valid_from)} → {fmtDate(p.valid_until)}
                  </TableCell>
                  <TableCell className="text-[11px] text-slate-500">
                    <div className="flex flex-col gap-0.5">
                      <span>📚 {p.source}</span>
                      <span>📅 {fmtDate(p.last_updated)}</span>
                      <span className="text-amber-300" data-testid={`price-verification-${p.id}`}>{p.verification_status === "verified" ? "Revisado" : "Pendiente de verificación"}</span>
                      <StaleWarning lastUpdated={p.last_updated} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Los precios registrados deben contrastarse con la tarifa oficial vigente antes de
        presentarlos al cliente.
      </p>
    </div>
  );
}
