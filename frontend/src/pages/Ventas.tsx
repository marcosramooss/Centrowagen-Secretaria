import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DemoPill, EmptyState, PageHeader } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { eur, eur2, fmtDate } from "@/lib/format";
import type { Sale, SalesSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUSES = ["Reserva", "Cerrada", "Entregada", "Cancelada"];

export default function Ventas() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    client_name: "",
    vehicle_model: "",
    stock_number: "",
    pvp: "",
    discount: "0",
    status: "Reserva",
    notes: "",
  });

  const sales = useQuery({ queryKey: ["sales"], queryFn: () => apiGet<Sale[]>("/sales"), retry: false });
  const summary = useQuery({ queryKey: ["sales-summary"], queryFn: () => apiGet<SalesSummary>("/sales/summary"), retry: false });

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiPost<Sale>("/sales", body),
    onSuccess: () => {
      toast.success("Venta registrada");
      setForm({ client_name: "", vehicle_model: "", stock_number: "", pvp: "", discount: "0", status: "Reserva", notes: "" });
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["sales"] });
      void qc.invalidateQueries({ queryKey: ["sales-summary"] });
      void qc.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: () => toast.error("No se pudo registrar la venta"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/sales/${id}`),
    onSuccess: () => {
      toast.success("Venta eliminada");
      void qc.invalidateQueries({ queryKey: ["sales"] });
      void qc.invalidateQueries({ queryKey: ["sales-summary"] });
      void qc.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: () => toast.error("No se pudo eliminar la venta"),
  });

  const s = summary.data;
  const progress = s && s.monthly_target > 0 ? Math.min(100, (s.month_pvp / s.monthly_target) * 100) : 0;

  return (
    <div data-testid="ventas-page">
      <PageHeader
        title="📋 Ventas & Comisiones"
        subtitle="Registra tus operaciones y consulta la comisión estimada del mes y del año."
        right={
          <div className="flex items-center gap-2">
            <DemoPill />
            <Button onClick={() => setOpen((o) => !o)} className="gap-2" data-testid="sale-new-button">
              <Plus className="h-4 w-4" /> Registrar venta
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="ventas-kpis">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-slate-400">Ventas del mes</p>
          <p className="mt-1 text-2xl font-bold text-white" data-testid="kpi-month-sales">{s ? s.month_sales : "—"}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-slate-400">Facturación del mes</p>
          <p className="mt-1 text-2xl font-bold text-white" data-testid="kpi-month-pvp">{s ? eur(s.month_pvp) : "—"}</p>
        </div>
        <div className="glass-card rounded-2xl border-emerald-500/30 p-4">
          <p className="text-[11px] uppercase tracking-wider text-emerald-300">Comisión estimada (mes)</p>
          <p className="mt-1 text-2xl font-bold text-emerald-300" data-testid="kpi-month-commission">
            {s ? eur2(s.month_commission) : "—"}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">Tasa aplicada: {s ? `${s.commission_rate}%` : "—"}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-slate-400">Comisión acumulada (año)</p>
          <p className="mt-1 text-2xl font-bold text-white" data-testid="kpi-year-commission">
            {s ? eur2(s.year_commission) : "—"}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">{s ? `${s.year_sales} operaciones` : ""}</p>
        </div>
      </section>

      {/* Target */}
      {s && s.monthly_target > 0 && (
        <section className="glass-panel mb-5 rounded-2xl p-5" data-testid="ventas-target">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <p className="text-sm font-medium text-slate-200">Objetivo mensual del punto de venta</p>
            <p className="text-sm text-slate-400">
              <span className="text-price">{eur(s.month_pvp)}</span> de {eur(s.monthly_target)}
            </p>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-[width] duration-500"
              style={{ width: `${progress}%` }}
              data-testid="ventas-target-bar"
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{progress.toFixed(1)}% del objetivo alcanzado</p>
        </section>
      )}

      {/* New sale form */}
      {open && (
        <form
          className="glass-panel mb-5 rounded-2xl p-5"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({
              client_name: form.client_name,
              vehicle_model: form.vehicle_model,
              stock_number: form.stock_number || null,
              pvp: Number(form.pvp || 0),
              discount: Number(form.discount || 0),
              status: form.status,
              notes: form.notes,
            });
          }}
          data-testid="sale-create-form"
        >
          <h2 className="mb-3 text-base font-semibold text-white">Nueva venta</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Cliente</Label>
              <Input
                value={form.client_name}
                onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                required
                data-testid="sale-client-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Vehículo</Label>
              <Input
                value={form.vehicle_model}
                onChange={(e) => setForm({ ...form, vehicle_model: e.target.value })}
                placeholder="T-Roc R-Line 1.5 TSI DSG"
                required
                data-testid="sale-vehicle-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nº de stock (opcional)</Label>
              <Input
                value={form.stock_number}
                onChange={(e) => setForm({ ...form, stock_number: e.target.value })}
                placeholder="CB-1033"
                data-testid="sale-stock-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">PVP (€)</Label>
              <Input
                type="number"
                value={form.pvp}
                onChange={(e) => setForm({ ...form, pvp: e.target.value })}
                required
                data-testid="sale-pvp-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descuento (€)</Label>
              <Input
                type="number"
                value={form.discount}
                onChange={(e) => setForm({ ...form, discount: e.target.value })}
                data-testid="sale-discount-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Estado</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger data-testid="sale-status-select">
                  <SelectValue>{(v) => String(v)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((st) => (
                    <SelectItem key={st} value={st}>{st}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <Label className="text-xs">Notas</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              data-testid="sale-notes-input"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <Button type="submit" disabled={create.isPending} data-testid="sale-submit-button">
              {create.isPending ? "Guardando…" : "Guardar venta"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="sale-cancel-button">
              Cancelar
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            La comisión se calcula sobre el importe neto (PVP − descuento) con la tasa configurada en Configuración.
          </p>
        </form>
      )}

      {/* Sales table */}
      {sales.isError ? (
        <EmptyState title="No se han podido cargar las ventas" hint="Comprueba la conexión con el servidor." />
      ) : (sales.data ?? []).length === 0 ? (
        <EmptyState title="Sin ventas registradas" hint="Registra tu primera operación con «Registrar venta»." />
      ) : (
        <div className="glass-panel rounded-2xl p-2" data-testid="ventas-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Vehículo</TableHead>
                <TableHead>Nº stock</TableHead>
                <TableHead className="text-right">PVP</TableHead>
                <TableHead className="text-right">Dto.</TableHead>
                <TableHead className="text-right">Comisión</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(sales.data ?? []).map((v) => (
                <TableRow key={v.id} data-testid={`sale-row-${v.id}`}>
                  <TableCell className="text-xs text-slate-400">{fmtDate(v.sale_date)}</TableCell>
                  <TableCell className="font-medium text-slate-100">{v.client_name}</TableCell>
                  <TableCell className="text-slate-300">{v.vehicle_model}</TableCell>
                  <TableCell className="font-mono text-xs text-slate-400">{v.stock_number ?? "—"}</TableCell>
                  <TableCell className="text-right text-slate-200">{eur(v.pvp)}</TableCell>
                  <TableCell className="text-right text-slate-400">{v.discount ? eur(v.discount) : "—"}</TableCell>
                  <TableCell className="text-right"><span className="text-price">{eur2(v.commission_estimated)}</span></TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        v.status === "Entregada"
                          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                          : v.status === "Cerrada"
                            ? "border-sky-500/40 bg-sky-500/15 text-sky-300"
                            : v.status === "Cancelada"
                              ? "border-rose-500/40 bg-rose-500/15 text-rose-300"
                              : "border-amber-500/40 bg-amber-500/15 text-amber-300",
                      )}
                    >
                      {v.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-400">{v.seller_name}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => remove.mutate(v.id)}
                      data-testid={`sale-delete-${v.id}`}
                      aria-label="Eliminar venta"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        ⚠️ La comisión mostrada es una ESTIMACIÓN con DATOS DE DEMOSTRACIÓN. La liquidación real la determina la
        dirección del concesionario.
      </p>
    </div>
  );
}
