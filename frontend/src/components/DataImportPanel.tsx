import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Download, FileSpreadsheet, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiPost, apiPostForm, ApiError } from "@/lib/api";
import type { ImportPreview, ImportResult } from "@/lib/catalog";

function errorMessage(e: unknown): string {
  const detail = e instanceof ApiError ? (e.body as { detail?: unknown })?.detail : null;
  return typeof detail === "string" ? detail : "No se pudo procesar el archivo. Revisa su formato.";
}
const readable = (value: unknown) => value == null || value === "" ? "—" : Array.isArray(value) ? value.join(" · ") : String(value);

export default function DataImportPanel({ isAdmin, fixedKind }: { isAdmin: boolean; fixedKind?: "vehicles" | "stock" }) {
  const qc = useQueryClient();
  const ref = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<"vehicles" | "stock">(fixedKind ?? "vehicles");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const reset = () => { setPreview(null); setResult(null); setConfirmed(false); };
  const upload = useMutation({ mutationFn: (data: FormData) => apiPostForm<ImportPreview>(`/import/${kind}/preview`, data), onSuccess: setPreview, onError: e => toast.error(errorMessage(e)) });
  const apply = useMutation({
    mutationFn: () => apiPost<ImportResult>("/import/apply", { preview_id: preview?.id, confirm: true }),
    onSuccess: data => { setResult(data); setPreview(null); setConfirmed(false); toast.success("Importación guardada. Datos pendientes de verificación comercial."); for (const key of ["vehicles", "stock", "prices", "stats"]) void qc.invalidateQueries({ queryKey: [key] }); },
    onError: e => toast.error(errorMessage(e)),
  });
  return <section className="mb-7 overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/60" data-testid="data-import-panel">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 p-5"><div><h2 className="flex items-center gap-2 text-xl" data-testid="data-import-title"><FileSpreadsheet size={20} className="text-sky-400" />{kind === "vehicles" ? "Cargar versiones del catálogo" : "Cargar unidades de stock"}</h2><p className="mt-2 text-xs text-slate-400" data-testid="data-import-description">01 · Carga tu archivo &nbsp; / &nbsp; 02 · Revisa cada cambio &nbsp; / &nbsp; 03 · Confirma</p></div>{!fixedKind && <div className="flex gap-4 text-xs text-sky-300"><Link to="/archivos?seccion=tarifas" className="hover:underline" data-testid="import-tariffs-link">Tarifas ↗</Link><Link to="/archivos?seccion=documentos" className="hover:underline" data-testid="import-documents-link">PDF y documentos ↗</Link></div>}</div>
    <form className="p-5" data-testid="data-import-form" onSubmit={e => { e.preventDefault(); reset(); const file = ref.current?.files?.[0]; if (!file) return toast.error("Selecciona un Excel o CSV"); const form = new FormData(); form.append("file", file); upload.mutate(form); }}>
      <div className={`grid items-end gap-4 ${fixedKind ? "md:grid-cols-[1fr_auto]" : "md:grid-cols-[1fr_2fr_auto]"}`}>{!fixedKind && <div><Label htmlFor="data-kind" data-testid="data-import-kind-label">Tipo de información</Label><select id="data-kind" value={kind} disabled={upload.isPending || apply.isPending} onChange={e => { setKind(e.target.value as "vehicles" | "stock"); reset(); }} className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm" data-testid="data-import-kind"><option value="vehicles">Catálogo del concesionario</option><option value="stock">Unidades de stock</option></select></div>}
        <div><Label htmlFor="data-file" data-testid="data-import-file-label">Archivo Excel (.xlsx) o CSV · máximo 10 MB</Label><Input id="data-file" type="file" ref={ref} accept=".xlsx,.xlsm,.csv" disabled={!isAdmin || upload.isPending || apply.isPending} onChange={reset} className="mt-2 h-11" data-testid="data-import-file" /></div>
        <Button type="submit" className="h-11 gap-2" disabled={!isAdmin || upload.isPending || apply.isPending} data-testid="data-import-preview-button"><Upload size={16} />{upload.isPending ? "Leyendo…" : "Previsualizar"}</Button></div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4"><p className="max-w-xl text-xs leading-5 text-slate-400" data-testid="data-import-rules">Catálogo: modelo + acabado. Stock: número de unidad y versión exacta. Las celdas vacías conservan los datos existentes. Primero importa las versiones y después su stock.</p><a href={`/api/import/template/${kind}`} className="inline-flex min-h-10 items-center gap-2 text-xs text-sky-300 transition-colors hover:text-white" data-testid="data-import-template"><Download size={14} />Plantilla vacía, sin datos demo</a></div>
    </form>
    {preview && <div className="border-t border-slate-800 p-5" data-testid="data-import-preview"><h3 className="text-lg" data-testid="data-import-preview-title">Revisión de {preview.filename}</h3><p className="my-2 text-sm text-slate-300" data-testid="data-import-preview-counts">{preview.valid_rows} filas válidas · {preview.rejected_rows} rechazadas. Ningún dato comercial se ha guardado.</p><p className="mb-4 text-xs text-slate-400" data-testid="data-import-columns">Columnas: {Object.values(preview.detected_columns).join(" · ")}</p>
      <div className="max-h-96 overflow-auto rounded-lg border border-slate-800"><table className="w-full min-w-[650px] text-left text-xs" data-testid="data-import-table"><thead className="sticky top-0 bg-slate-950 text-slate-400"><tr><th className="p-3">Fila / registro</th><th className="p-3">Resultado</th><th className="p-3">Valores antes → después</th></tr></thead><tbody>{preview.rows.map(r => <tr className="border-t border-slate-800" key={r.row} data-testid={`data-import-row-${r.row}`}><td className="p-3">{r.row} · {r.label || "Sin identificar"}</td><td className="p-3"><span className={r.action === "rechazada" ? "text-rose-300" : "text-sky-300"}>{r.action}</span><p className="mt-1 max-w-64 text-slate-400">{r.message}</p></td><td className="p-3 text-slate-300">{Object.entries(r.changes).filter(([k]) => !["verification_status", "source"].includes(k)).map(([key, change]) => <p key={key} data-testid={`data-import-change-${r.row}-${key.replaceAll("_", "-")}`}><span className="text-slate-500">{key}:</span> {readable(change.antes)} → {readable(change.después)}</p>)}</td></tr>)}</tbody></table></div>
      <label className="mt-4 flex items-start gap-2 text-sm text-slate-300"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-1 accent-sky-500" data-testid="data-import-confirm-checkbox" />He revisado los cambios. Confirmo guardar las filas válidas como pendientes de verificación comercial.</label>
      <div className="mt-4 flex flex-wrap gap-3"><Button disabled={!isAdmin || !confirmed || !preview.valid_rows || apply.isPending} onClick={() => apply.mutate()} data-testid="data-import-apply-button">{apply.isPending ? "Guardando…" : `Confirmar ${preview.valid_rows} filas`}</Button><Button variant="outline" disabled={apply.isPending} onClick={reset} data-testid="data-import-cancel-button">Descartar vista previa</Button></div>
    </div>}
    {result && <div className="border-t border-emerald-900/40 bg-emerald-950/20 p-5" data-testid="data-import-result"><p className="flex items-center gap-2 text-sm text-emerald-300"><ShieldCheck size={17} />{result.created} registros creados · {result.updated} actualizados</p><p className="mt-2 text-xs text-slate-400">Archivo, usuario y fecha registrados. Importar no equivale a verificar; no se incorporan automáticamente como evidencia confirmada para la IA.</p></div>}
  </section>;
}