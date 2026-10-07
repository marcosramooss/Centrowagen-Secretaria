import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Download, FileSpreadsheet, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, PageHeader } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiDelete, apiGet, apiPatch, apiPost, apiPostForm } from "@/lib/api";
import { eur } from "@/lib/format";
import { useMe } from "@/lib/session";
import type { FinancingOffer, PriceEntry, Promotion, StockUnit, Vehicle } from "@/lib/types";
import type { ImportResult } from "@/lib/catalog";
import DataImportPanel from "@/components/DataImportPanel";
import { Link } from "react-router-dom";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FieldType = "text" | "number" | "textarea" | "list" | "checkbox" | "vehicle" | "date";

interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  hint?: string;
}

type EntityKey = "vehicles" | "stock" | "prices" | "financing" | "promotions";

interface Row {
  id: string;
  [key: string]: unknown;
}

interface EntityDef {
  key: EntityKey;
  label: string;
  path: string;
  queryKey: string;
  fields: FieldDef[];
  columns: { name: string; label: string; money?: boolean }[];
}

const ENTITIES: EntityDef[] = [
  {
    key: "vehicles",
    label: "Vehículos",
    path: "/vehicles",
    queryKey: "vehicles",
    fields: [
      { name: "model", label: "Modelo", type: "text", required: true, hint: "Golf, T-Roc, Tiguan, ID.4…" },
      { name: "trim", label: "Acabado", type: "text" },
      { name: "body_type", label: "Carrocería", type: "text", hint: "SUV, Compacto, Berlina, Familiar" },
      { name: "engine", label: "Motor", type: "text", hint: "1.5 TSI 150 CV" },
      { name: "fuel", label: "Combustible", type: "text", hint: "Gasolina, Diésel, Híbrido, Eléctrico" },
      { name: "power_cv", label: "Potencia (CV)", type: "number" },
      { name: "transmission", label: "Cambio", type: "text", hint: "Manual, DSG, Automático" },
      { name: "drivetrain", label: "Tracción", type: "text" },
      { name: "consumption", label: "Consumo", type: "number", hint: "l/100 km (o kWh/100 km)" },
      { name: "co2_g", label: "CO₂ (g/km)", type: "number" },
      { name: "electric_range_km", label: "Autonomía eléctrica (km)", type: "number" },
      { name: "trunk_l", label: "Maletero (l)", type: "number" },
      { name: "seats", label: "Plazas", type: "number" },
      { name: "equipment", label: "Equipamiento", type: "list", hint: "Separa cada elemento con ;" },
      { name: "image", label: "Foto (URL)", type: "text", hint: "URL de la fotografía exacta. Si no está confirmada, déjala vacía" },
      { name: "source", label: "Fuente", type: "text" },
      { name: "source_url", label: "URL de la fuente", type: "text" },
    ],
    columns: [
      { name: "model", label: "Modelo" },
      { name: "trim", label: "Acabado" },
      { name: "engine", label: "Motor" },
      { name: "fuel", label: "Combustible" },
      { name: "power_cv", label: "CV" },
    ],
  },
  {
    key: "stock",
    label: "Stock",
    path: "/stock",
    queryKey: "stock",
    fields: [
      { name: "vehicle_id", label: "Vehículo del catálogo", type: "vehicle", required: true },
      { name: "stock_number", label: "Nº de stock", type: "text", required: true },
      { name: "model", label: "Modelo", type: "text", required: true },
      { name: "trim", label: "Acabado", type: "text" },
      { name: "engine", label: "Motor", type: "text" },
      { name: "power", label: "Potencia (CV)", type: "number" },
      { name: "transmission", label: "Cambio", type: "text" },
      { name: "exterior_color", label: "Color exterior", type: "text" },
      { name: "interior_color", label: "Color interior", type: "text" },
      { name: "vin", label: "VIN / bastidor", type: "text" },
      { name: "options", label: "Opciones", type: "list", hint: "Separa con ;" },
      { name: "pvp", label: "PVP", type: "number" },
      { name: "promotional_price", label: "Precio promocional", type: "number" },
      { name: "financing_price", label: "Precio financiado", type: "number" },
      { name: "availability", label: "Disponibilidad", type: "text", hint: "Entrega inmediata / En tránsito / Bajo pedido / Reservado" },
      { name: "location", label: "Ubicación", type: "text" },
      { name: "delivery_estimate", label: "Plazo de entrega", type: "text" },
    ],
    columns: [
      { name: "stock_number", label: "Nº" },
      { name: "model", label: "Modelo" },
      { name: "trim", label: "Acabado" },
      { name: "exterior_color", label: "Color" },
      { name: "pvp", label: "PVP", money: true },
      { name: "availability", label: "Estado" },
    ],
  },
  {
    key: "prices",
    label: "Precios",
    path: "/prices",
    queryKey: "prices",
    fields: [
      { name: "vehicle_id", label: "Vehículo", type: "vehicle", required: true },
      { name: "base_price", label: "PVP base", type: "number", required: true },
      { name: "promotional_price", label: "Precio promocional", type: "number" },
      { name: "financing_price", label: "Precio financiado", type: "number" },
      { name: "discount", label: "Descuento (%)", type: "number" },
      { name: "campaign", label: "Campaña", type: "text" },
      { name: "valid_from", label: "Válido desde", type: "date" },
      { name: "valid_until", label: "Válido hasta", type: "date" },
      { name: "source", label: "Fuente", type: "text" },
    ],
    columns: [
      { name: "vehicle_id", label: "Vehículo" },
      { name: "base_price", label: "PVP", money: true },
      { name: "promotional_price", label: "Promo", money: true },
      { name: "campaign", label: "Campaña" },
    ],
  },
  {
    key: "financing",
    label: "Financiación",
    path: "/financing",
    queryKey: "financing",
    fields: [
      { name: "vehicle_id", label: "Vehículo (opcional)", type: "vehicle" },
      { name: "campaign", label: "Campaña", type: "text", required: true },
      { name: "entry_payment", label: "Entrada", type: "number", required: true },
      { name: "financed_amount", label: "Importe financiado", type: "number", required: true },
      { name: "monthly_payment", label: "Cuota mensual", type: "number", required: true },
      { name: "number_of_payments", label: "Nº de cuotas", type: "number", required: true },
      { name: "final_payment", label: "Última cuota", type: "number" },
      { name: "tin", label: "TIN (%)", type: "number", required: true },
      { name: "tae", label: "TAE (%)", type: "number", required: true },
      { name: "opening_fee", label: "Comisión de apertura", type: "number" },
      { name: "total_amount", label: "Total adeudado", type: "number" },
      { name: "conditions", label: "Condiciones", type: "textarea" },
      { name: "valid_from", label: "Válido desde", type: "date" },
      { name: "valid_until", label: "Válido hasta", type: "date" },
      { name: "source", label: "Fuente", type: "text" },
    ],
    columns: [
      { name: "campaign", label: "Campaña" },
      { name: "monthly_payment", label: "Cuota", money: true },
      { name: "number_of_payments", label: "Cuotas" },
      { name: "tae", label: "TAE" },
      { name: "valid_until", label: "Hasta" },
    ],
  },
  {
    key: "promotions",
    label: "Promociones",
    path: "/promotions",
    queryKey: "promotions",
    fields: [
      { name: "name", label: "Nombre de la campaña", type: "text", required: true },
      { name: "model", label: "Modelo", type: "text", required: true, hint: "Escribe «Todos» si aplica a toda la gama" },
      { name: "description", label: "Descripción", type: "textarea" },
      { name: "discount", label: "Descuento", type: "text", hint: "2.000 € / 8%" },
      { name: "conditions", label: "Condiciones", type: "textarea" },
      { name: "financing_required", label: "Requiere financiación", type: "checkbox" },
      { name: "valid_from", label: "Válido desde", type: "date" },
      { name: "valid_until", label: "Válido hasta", type: "date" },
      { name: "source", label: "Fuente", type: "text" },
    ],
    columns: [
      { name: "name", label: "Campaña" },
      { name: "model", label: "Modelo" },
      { name: "discount", label: "Descuento" },
      { name: "valid_until", label: "Hasta" },
      { name: "status", label: "Estado" },
    ],
  },
];

type FormState = Record<string, string | boolean>;

function toForm(entity: EntityDef, row: Row | null): FormState {
  const state: FormState = {};
  for (const f of entity.fields) {
    const value = row ? row[f.name] : undefined;
    if (f.type === "checkbox") {
      state[f.name] = Boolean(value);
    } else if (f.type === "list") {
      state[f.name] = Array.isArray(value) ? (value as string[]).join("; ") : "";
    } else {
      state[f.name] = value === null || value === undefined ? "" : String(value);
    }
  }
  return state;
}

function toPayload(entity: EntityDef, state: FormState): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const f of entity.fields) {
    const raw = state[f.name];
    if (f.type === "checkbox") {
      payload[f.name] = Boolean(raw);
      continue;
    }
    const text = String(raw ?? "").trim();
    if (!text) continue;
    if (f.type === "number") {
      const num = Number(text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(text) ? text.replace(/\./g, "") : text);
      if (!Number.isNaN(num)) payload[f.name] = num;
    } else if (f.type === "list") {
      payload[f.name] = text.split(";").map((p) => p.trim()).filter(Boolean);
    } else {
      payload[f.name] = text;
    }
  }
  return payload;
}

export default function GestionDatos() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const isAdmin = me?.role === "admin";
  const [tab, setTab] = useState<EntityKey>("vehicles");
  const entity = ENTITIES.find((e) => e.key === tab) ?? ENTITIES[0];

  const [editing, setEditing] = useState<Row | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>({});

  const { data: rows = [], isLoading } = useQuery({
    queryKey: [entity.queryKey, "gestion"],
    queryFn: () => apiGet<Row[]>(entity.path),
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles", "gestion-options"],
    queryFn: () => apiGet<Vehicle[]>("/vehicles"),
  });

  const vehicleLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of vehicles) map.set(v.id, `${v.model} ${v.trim}`.trim());
    return map;
  }, [vehicles]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: [entity.queryKey] });
    void qc.invalidateQueries({ queryKey: ["stats"] });
  };

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      editing ? apiPatch<Row>(`${entity.path}/${editing.id}`, payload) : apiPost<Row>(entity.path, payload),
    onSuccess: () => {
      toast.success(editing ? "Registro actualizado" : "Registro creado");
      setFormOpen(false);
      setEditing(null);
      invalidate();
    },
    onError: (e) => {
      const detail = (e as { body?: { detail?: unknown } })?.body?.detail;
      toast.error(typeof detail === "string" ? detail : "No se pudo guardar. Revisa los campos obligatorios.");
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete<{ ok: boolean }>(`${entity.path}/${id}`),
    onSuccess: () => {
      toast.success("Registro eliminado");
      invalidate();
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  const openForm = (row: Row | null) => {
    setEditing(row);
    setForm(toForm(entity, row));
    setFormOpen(true);
  };

  return (
    <div data-testid="gestion-page">
      <PageHeader
        title="Gestión de datos"
        subtitle="Tu información comercial, sin ejemplos ni cifras inventadas. Carga documentación real y revisa su procedencia."
      />

      {!isAdmin && (
        <div className="mb-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200" data-testid="gestion-no-admin">
          ⚠️ Solo un perfil ADMIN puede crear o modificar datos. Como vendedor puedes consultarlos en el resto de secciones.
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4"><p className="text-sm text-slate-400" data-testid="gestion-files-guidance">Para cargar Excel, CSV o PDF, utiliza el Centro de archivos. Aquí puedes editar registros individualmente.</p><Link to="/archivos" className={buttonVariants({ variant: "outline" })} data-testid="gestion-files-link">Ir al Centro de archivos</Link></div>

      <div className="mb-4 flex flex-wrap gap-2" data-testid="gestion-tabs">
        {ENTITIES.map((e) => (
          <button
            key={e.key}
            type="button"
            onClick={() => {
              setTab(e.key);
              setFormOpen(false);
              setEditing(null);
            }}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm transition-colors duration-200",
              tab === e.key
                ? "border-sky-500/60 bg-sky-600/20 font-medium text-sky-200"
                : "border-slate-700/60 bg-slate-900/50 text-slate-400 hover:text-slate-100",
            )}
            data-testid={`gestion-tab-${e.key}`}
          >
            {e.label}
          </button>
        ))}
      </div>

      <div className="glass-panel rounded-2xl p-5" data-testid="gestion-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">{entity.label}</h2>
            <p className="text-xs text-muted-foreground" data-testid="gestion-count">
              {rows.length} registro{rows.length === 1 ? "" : "s"} en la base de datos
            </p>
          </div>
          <Button className="gap-2" disabled={!isAdmin} onClick={() => openForm(null)} data-testid="gestion-new-button">
            <Plus className="h-4 w-4" /> Nuevo registro
          </Button>
        </div>

        {formOpen && (
          <form
            className="mt-4 rounded-2xl border border-sky-500/30 bg-slate-900/60 p-4"
            onSubmit={(ev) => {
              ev.preventDefault();
              const payload = toPayload(entity, form);
              const missing = entity.fields.filter((f) => f.required && payload[f.name] === undefined);
              if (missing.length) {
                toast.error(`Falta: ${missing.map((m) => m.label).join(", ")}`);
                return;
              }
              save.mutate(payload);
            }}
            data-testid="gestion-form"
          >
            <p className="mb-3 text-sm font-medium text-sky-200">
              {editing ? "Editar registro" : `Nuevo registro de ${entity.label.toLowerCase()}`}
            </p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {entity.fields.map((f) => (
                <div key={f.name} className={cn("space-y-1.5", f.type === "textarea" && "md:col-span-2 xl:col-span-3")}>
                  <Label className="text-xs">
                    {f.label}
                    {f.required && <span className="ml-1 text-rose-400">*</span>}
                  </Label>
                  {f.type === "vehicle" ? (
                    <select
                      value={String(form[f.name] ?? "")}
                      onChange={(ev) => setForm((s) => ({ ...s, [f.name]: ev.target.value }))}
                      className="h-9 w-full rounded-md border border-slate-700/60 bg-slate-950/70 px-2.5 text-sm text-slate-100 outline-none transition-colors duration-200 focus:border-sky-500"
                      data-testid={`gestion-field-${f.name}`}
                    >
                      <option value="">— Selecciona un vehículo —</option>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.model} {v.trim}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "textarea" ? (
                    <textarea
                      value={String(form[f.name] ?? "")}
                      onChange={(ev) => setForm((s) => ({ ...s, [f.name]: ev.target.value }))}
                      rows={3}
                      className="w-full rounded-md border border-slate-700/60 bg-slate-950/70 p-2.5 text-sm text-slate-100 outline-none transition-colors duration-200 focus:border-sky-500"
                      data-testid={`gestion-field-${f.name}`}
                    />
                  ) : f.type === "checkbox" ? (
                    <label className="flex h-9 items-center gap-2 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={Boolean(form[f.name])}
                        onChange={(ev) => setForm((s) => ({ ...s, [f.name]: ev.target.checked }))}
                        className="h-3.5 w-3.5 accent-sky-500"
                        data-testid={`gestion-field-${f.name}`}
                      />
                      Sí
                    </label>
                  ) : (
                    <Input
                      type={f.type === "date" ? "date" : "text"}
                      inputMode={f.type === "number" ? "decimal" : undefined}
                      value={String(form[f.name] ?? "")}
                      onChange={(ev) => setForm((s) => ({ ...s, [f.name]: ev.target.value }))}
                      data-testid={`gestion-field-${f.name}`}
                    />
                  )}
                  {f.hint && <p className="text-[10px] text-muted-foreground">{f.hint}</p>}
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <Button type="submit" className="glow-accent" disabled={save.isPending} data-testid="gestion-save-button">
                {save.isPending ? "Guardando…" : "Guardar"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setFormOpen(false);
                  setEditing(null);
                }}
                data-testid="gestion-cancel-button"
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {isLoading ? (
          <p className="mt-6 text-sm text-muted-foreground">Cargando…</p>
        ) : rows.length === 0 ? (
          <div className="mt-5">
            <EmptyState
              icon={<Database className="h-7 w-7 text-sky-400" />}
              title={`Todavía no hay ${entity.label.toLowerCase()} en la base de datos`}
              hint="Crea el primer registro o importa el archivo oficial del concesionario."
            />
          </div>
        ) : (
          <div className="mt-5 max-h-[520px] overflow-auto rounded-xl border border-slate-700/60">
            <table className="w-full min-w-[640px] text-sm" data-testid="gestion-table">
              <thead className="sticky top-0 bg-slate-900/95">
                <tr>
                  {entity.columns.map((c) => (
                    <th key={c.name} className="p-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-slate-400">
                      {c.label}
                    </th>
                  ))}
                  <th className="p-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-slate-400">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-800/60" data-testid={`gestion-row-${row.id}`}>
                    {entity.columns.map((c) => {
                      const value = row[c.name];
                      const text =
                        c.name === "vehicle_id"
                          ? (vehicleLabel.get(String(value ?? "")) ?? "Campaña general")
                          : c.money
                            ? eur(typeof value === "number" ? value : null)
                            : value === null || value === undefined || value === ""
                              ? "—"
                              : String(value);
                      return (
                        <td key={c.name} className="p-2.5 text-slate-200">
                          {text}
                        </td>
                      );
                    })}
                    <td className="p-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={!isAdmin}
                          onClick={() => openForm(row)}
                          data-testid={`gestion-edit-${row.id}`}
                          aria-label="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={!isAdmin || remove.isPending}
                          onClick={() => {
                            if (window.confirm("¿Eliminar este registro?")) remove.mutate(row.id);
                          }}
                          data-testid={`gestion-delete-${row.id}`}
                          aria-label="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ImportPanel({ isAdmin, onDone }: { isAdmin: boolean; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<"vehicles" | "stock">("vehicles");
  const [result, setResult] = useState<ImportResult | null>(null);

  const doImport = useMutation({
    mutationFn: (form: FormData) => apiPostForm<ImportResult>(`/import/${kind}`, form),
    onSuccess: (r) => {
      setResult(r);
      toast.success(`${r.created} creados · ${r.updated} actualizados`);
      onDone();
    },
    onError: (e) => {
      const detail = (e as { body?: { detail?: string } })?.body?.detail;
      toast.error(detail ?? "No se pudo importar el archivo");
    },
  });

  return (
    <div className="glass-panel mb-5 rounded-2xl p-5" data-testid="import-panel">
      <div className="flex items-center gap-2">
        <FileSpreadsheet className="h-5 w-5 text-sky-400" />
        <h2 className="text-base font-semibold text-white">Importar datos oficiales (Excel o CSV)</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        El catálogo se empareja por modelo + acabado y el stock por nº de unidad: lo que ya existe se actualiza, lo nuevo
        se crea. Para las tarifas con previsualización usa «Importar tarifa».
      </p>

      <form
        className="mt-4 grid gap-3 lg:grid-cols-4"
        onSubmit={(ev) => {
          ev.preventDefault();
          const file = fileRef.current?.files?.[0];
          if (!file) {
            toast.error("Selecciona un archivo Excel o CSV");
            return;
          }
          const form = new FormData();
          form.append("file", file);
          doImport.mutate(form);
        }}
        data-testid="import-form"
      >
        <div className="space-y-1.5">
          <Label className="text-xs">Qué importas</Label>
          <select
            value={kind}
            onChange={(ev) => setKind(ev.target.value as "vehicles" | "stock")}
            className="h-9 w-full rounded-md border border-slate-700/60 bg-slate-950/70 px-2.5 text-sm text-slate-100 focus:border-sky-500"
            data-testid="import-kind-select"
          >
            <option value="vehicles">Catálogo de vehículos</option>
            <option value="stock">Unidades de stock</option>
          </select>
        </div>
        <div className="space-y-1.5 lg:col-span-2">
          <Label className="text-xs">Archivo (.xlsx o .csv)</Label>
          <Input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xlsm,.xls,.csv"
            disabled={!isAdmin}
            className="file:mr-3 file:rounded-md file:border-0 file:bg-sky-600/30 file:px-3 file:py-1 file:text-xs file:text-sky-200"
            data-testid="import-file-input"
          />
        </div>
        <div className="flex items-end gap-2">
          <Button type="submit" className="gap-2" disabled={!isAdmin || doImport.isPending} data-testid="import-submit-button">
            <Upload className="h-4 w-4" /> {doImport.isPending ? "Importando…" : "Importar"}
          </Button>
          <a
            href={`/api/import/template/${kind}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-700/60 px-3 text-xs text-slate-300 transition-colors duration-200 hover:border-sky-500/50 hover:text-white"
            data-testid="import-template-link"
          >
            <Download className="h-3.5 w-3.5" /> Plantilla
          </a>
        </div>
      </form>

      {result && (
        <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4" data-testid="import-result">
          <p className="text-sm text-emerald-200">
            «{result.filename}»: {result.created} creados, {result.updated} actualizados, {result.skipped} ignorados.
          </p>
          <ul className="mt-2 max-h-48 space-y-1 overflow-auto">
            {result.rows.map((r) => (
              <li key={r.row} className="text-[11px] text-slate-300">
                Fila {r.row} · {r.label || "—"} · <b>{r.action}</b>
                {r.message ? ` · ${r.message}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
