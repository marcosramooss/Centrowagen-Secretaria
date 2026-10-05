import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";

import { DemoPill, PageHeader } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiPost, apiPostForm } from "@/lib/api";
import { eur } from "@/lib/format";
import { useMe } from "@/lib/session";
import type { TariffApplyResult, TariffPreview, TariffRow } from "@/lib/types2";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<TariffRow["status"], { label: string; cls: string }> = {
  actualizable: { label: "Se actualizará", cls: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300" },
  nueva: { label: "No está en catálogo", cls: "border-amber-500/40 bg-amber-500/15 text-amber-300" },
  no_reconocida: { label: "No reconocida", cls: "border-rose-500/40 bg-rose-500/15 text-rose-300" },
};

export default function ImportarTarifas() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const isAdmin = me?.role === "admin";
  const fileRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState("Tarifa Volkswagen");
  const [updateStock, setUpdateStock] = useState(true);
  const [preview, setPreview] = useState<TariffPreview | null>(null);
  const [result, setResult] = useState<TariffApplyResult | null>(null);

  const doPreview = useMutation({
    mutationFn: (form: FormData) => apiPostForm<TariffPreview>("/tariff/preview", form),
    onSuccess: (p) => {
      setPreview(p);
      setResult(null);
      toast.success(`${p.total_rows} filas leídas de ${p.filename}`);
    },
    onError: (e) => {
      const detail = (e as { body?: { detail?: string } })?.body?.detail;
      toast.error(detail ?? "No se pudo leer el archivo");
    },
  });

  const doApply = useMutation({
    mutationFn: () => apiPost<TariffApplyResult>("/tariff/apply", { source, update_stock: updateStock, rows: preview?.rows ?? [] }),
    onSuccess: (r) => {
      setResult(r);
      setPreview(null);
      toast.success(`${r.prices_updated + r.prices_created} tarifas aplicadas`);
      void qc.invalidateQueries({ queryKey: ["prices"] });
      void qc.invalidateQueries({ queryKey: ["stock"] });
      void qc.invalidateQueries({ queryKey: ["vehicles"] });
      void qc.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: () => toast.error("No se pudo aplicar la tarifa"),
  });

  return (
    <div data-testid="importar-page">
      <PageHeader
        title="⬆️ Importar tarifa oficial"
        subtitle="Sube el Excel o CSV de tarifas: emparejo por modelo y acabado, te muestro el resumen y solo escribo cuando confirmas."
        right={<DemoPill />}
      />

      {!isAdmin && (
        <div className="mb-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200" data-testid="importar-no-admin">
          ⚠️ Solo un perfil ADMIN puede importar tarifas. Pide acceso a la dirección del concesionario.
        </div>
      )}

      <form
        className="glass-panel mb-5 rounded-2xl p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const file = fileRef.current?.files?.[0];
          if (!file) {
            toast.error("Selecciona un archivo Excel o CSV");
            return;
          }
          const form = new FormData();
          form.append("file", file);
          doPreview.mutate(form);
        }}
        data-testid="tariff-upload-form"
      >
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="space-y-1.5 lg:col-span-2">
            <Label className="text-xs">Archivo de tarifa (.xlsx o .csv)</Label>
            <Input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xlsm,.xls,.csv"
              disabled={!isAdmin}
              className="file:mr-3 file:rounded-md file:border-0 file:bg-sky-600/30 file:px-3 file:py-1 file:text-xs file:text-sky-200"
              data-testid="tariff-file-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Fuente que se registrará</Label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} disabled={!isAdmin} data-testid="tariff-source-input" />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={updateStock}
              onChange={(e) => setUpdateStock(e.target.checked)}
              className="h-3.5 w-3.5 accent-sky-500"
              data-testid="tariff-update-stock-checkbox"
            />
            Actualizar también el PVP de las unidades en stock
          </label>
          <Button type="submit" className="gap-2" disabled={!isAdmin || doPreview.isPending} data-testid="tariff-preview-button">
            <Upload className="h-4 w-4" /> {doPreview.isPending ? "Leyendo…" : "Previsualizar cambios"}
          </Button>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          El archivo debe tener una cabecera con al menos <b>Modelo</b> y <b>PVP</b>. Reconozco además Acabado,
          Promocional, Financiado, Descuento y Campaña. Acepta importes en formato español (35.020,50).
        </p>
      </form>

      {result && (
        <div className="glass-panel mb-5 rounded-2xl border-emerald-500/30 p-5" data-testid="tariff-apply-result">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">Tarifa aplicada</h2>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <Stat label="Tarifas actualizadas" value={result.prices_updated} tone="emerald" />
            <Stat label="Tarifas creadas" value={result.prices_created} tone="sky" />
            <Stat label="Unidades de stock" value={result.stock_updated} tone="sky" />
            <Stat label="Filas ignoradas" value={result.skipped} tone="slate" />
          </div>
          <ul className="mt-3 space-y-1">
            {result.messages.map((m, i) => (
              <li key={i} className="text-xs text-slate-300">• {m}</li>
            ))}
          </ul>
        </div>
      )}

      {preview && (
        <div className="glass-panel rounded-2xl p-5" data-testid="tariff-preview-panel">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">Resumen de «{preview.filename}»</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Columnas detectadas: {Object.entries(preview.detected_columns).map(([k, v]) => `${k} → "${v}"`).join(" · ")}
              </p>
            </div>
            <Button
              onClick={() => doApply.mutate()}
              className="glow-accent gap-2"
              disabled={preview.updatable === 0 || doApply.isPending}
              data-testid="tariff-apply-button"
            >
              <CheckCircle2 className="h-4 w-4" />
              {doApply.isPending ? "Aplicando…" : `Confirmar y aplicar (${preview.updatable})`}
            </Button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <Stat label="Filas leídas" value={preview.total_rows} tone="slate" />
            <Stat label="Se actualizarán" value={preview.updatable} tone="emerald" />
            <Stat label="Fuera de catálogo" value={preview.new_rows} tone="amber" />
            <Stat label="No reconocidas" value={preview.unrecognized} tone="rose" />
          </div>

          {preview.updatable === 0 && (
            <p className="mt-3 text-xs text-amber-300">
              ⚠️ Ninguna fila coincide con el catálogo actual, así que no hay nada que aplicar. Revisa que los nombres de
              modelo y acabado coincidan con los del catálogo.
            </p>
          )}

          <div className="mt-4 max-h-[460px] overflow-auto rounded-xl border border-slate-700/60">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="sticky top-0 bg-slate-900/95">
                <tr>
                  {["Fila", "Modelo", "Acabado", "PVP nuevo", "PVP actual", "Promocional", "Estado", "Detalle"].map((h) => (
                    <th key={h} className="p-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-slate-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.row} className="border-t border-slate-800/60" data-testid={`tariff-row-${r.row}`}>
                    <td className="p-2.5 font-mono text-[11px] text-slate-500">{r.row}</td>
                    <td className="p-2.5 font-medium text-slate-100">{r.model || "—"}</td>
                    <td className="p-2.5 text-slate-300">{r.trim || "—"}</td>
                    <td className="p-2.5"><span className="text-price">{eur(r.base_price)}</span></td>
                    <td className="p-2.5 text-slate-400">{r.current_price != null ? eur(r.current_price) : "—"}</td>
                    <td className="p-2.5 text-slate-400">{r.promotional_price != null ? eur(r.promotional_price) : "—"}</td>
                    <td className="p-2.5">
                      <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", STATUS_STYLES[r.status].cls)}>
                        {STATUS_STYLES[r.status].label}
                      </span>
                    </td>
                    <td className="p-2.5 text-[11px] text-slate-400">{r.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!preview && !result && (
        <div className="glass-panel flex flex-col items-center gap-3 rounded-2xl p-12 text-center" data-testid="importar-empty">
          <FileSpreadsheet className="h-8 w-8 text-sky-400" />
          <p className="font-medium text-slate-200">Sube la tarifa oficial para empezar</p>
          <p className="max-w-lg text-sm text-muted-foreground">
            Nada se escribe en la base de datos hasta que revises el resumen y pulses «Confirmar y aplicar». Las filas
            que no reconozca se te muestran, pero nunca se aplican solas.
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "emerald" | "amber" | "rose" | "sky" | "slate" }) {
  const cls = {
    emerald: "text-emerald-300",
    amber: "text-amber-300",
    rose: "text-rose-300",
    sky: "text-sky-300",
    slate: "text-white",
  }[tone];
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-3">
      <p className="text-[11px] uppercase tracking-wider text-slate-400">{label}</p>
      <p className={cn("mt-0.5 text-xl font-bold", cls)}>{value}</p>
    </div>
  );
}
