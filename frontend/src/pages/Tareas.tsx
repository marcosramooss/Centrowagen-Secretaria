import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, Clock, Plus, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { DemoPill, EmptyState, PageHeader } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import type { Task, TaskSummary } from "@/lib/types2";
import { cn } from "@/lib/utils";

const KINDS = ["Llamada", "Email", "WhatsApp", "Visita", "Prueba dinámica", "Entrega", "Seguimiento", "Otro"];
const PRIORITIES = ["alta", "media", "baja"];

function todayISO(serverToday?: string) {
  return serverToday ?? new Date().toISOString().slice(0, 10);
}

export default function Tareas() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"pendientes" | "vencidas" | "hoy" | "hechas" | "todas">("pendientes");
  const [form, setForm] = useState({
    title: "",
    kind: "Llamada",
    client_name: "",
    client_phone: "",
    vehicle_model: "",
    due_date: todayISO(),
    due_time: "",
    priority: "media",
    notes: "",
  });

  const tasks = useQuery({ queryKey: ["tasks"], queryFn: () => apiGet<Task[]>("/tasks"), retry: false });
  const summary = useQuery({ queryKey: ["tasks-summary"], queryFn: () => apiGet<TaskSummary>("/tasks/summary"), retry: false });

  function refresh() {
    void qc.invalidateQueries({ queryKey: ["tasks"] });
    void qc.invalidateQueries({ queryKey: ["tasks-summary"] });
  }

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiPost<Task>("/tasks", body),
    onSuccess: () => {
      toast.success("Recordatorio creado");
      setForm({ ...form, title: "", client_name: "", client_phone: "", vehicle_model: "", due_time: "", notes: "" });
      setOpen(false);
      refresh();
    },
    onError: () => toast.error("No se pudo crear el recordatorio"),
  });

  const toggle = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiPatch<Task>(`/tasks/${id}`, { status }),
    onSuccess: (t) => {
      toast.success(t.status === "hecha" ? "Tarea completada" : "Tarea reabierta");
      refresh();
    },
    onError: () => toast.error("No se pudo actualizar"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/tasks/${id}`),
    onSuccess: () => {
      toast.success("Recordatorio eliminado");
      refresh();
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  const all = tasks.data ?? [];
  const t = todayISO();
  const list = all.filter((x) => {
    if (filter === "todas") return true;
    if (filter === "hechas") return x.status === "hecha";
    if (x.status === "hecha") return false;
    if (filter === "vencidas") return x.due_date < t;
    if (filter === "hoy") return x.due_date === t;
    return true;
  });

  const s = summary.data;

  return (
    <div data-testid="tareas-page">
      <PageHeader
        title="🔔 Recordatorios y seguimiento"
        subtitle="Que ninguna oportunidad se quede sin llamar. Recibes además un resumen por email cada mañana a las 08:00."
        right={
          <div className="flex items-center gap-2">
            <DemoPill />
            <Button onClick={() => setOpen((o) => !o)} className="gap-2" data-testid="task-new-button">
              <Plus className="h-4 w-4" /> Nuevo recordatorio
            </Button>
          </div>
        }
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="tareas-kpis">
        <div className={cn("glass-card rounded-2xl p-4", (s?.overdue ?? 0) > 0 && "border-rose-500/40")}>
          <p className="text-[11px] uppercase tracking-wider text-rose-300">Vencidas</p>
          <p className="mt-1 text-2xl font-bold text-rose-300" data-testid="kpi-overdue">{s ? s.overdue : "—"}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-amber-300">Para hoy</p>
          <p className="mt-1 text-2xl font-bold text-amber-300" data-testid="kpi-today">{s ? s.today : "—"}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-slate-400">Próximos 7 días</p>
          <p className="mt-1 text-2xl font-bold text-white" data-testid="kpi-upcoming">{s ? s.upcoming : "—"}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[11px] uppercase tracking-wider text-emerald-300">Completadas</p>
          <p className="mt-1 text-2xl font-bold text-emerald-300" data-testid="kpi-done">{s ? s.done : "—"}</p>
        </div>
      </section>

      {open && (
        <form
          className="glass-panel mb-5 rounded-2xl p-5"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({ ...form, due_time: form.due_time || null });
          }}
          data-testid="task-create-form"
        >
          <h2 className="mb-3 text-base font-semibold text-white">Nuevo recordatorio</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5 lg:col-span-2">
              <Label className="text-xs">Qué hay que hacer</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Llamar para confirmar la financiación"
                required
                data-testid="task-title-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                <SelectTrigger data-testid="task-kind-select">
                  <SelectValue>{(v) => String(v)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k} value={k}>{k}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cliente</Label>
              <Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} data-testid="task-client-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Teléfono</Label>
              <Input value={form.client_phone} onChange={(e) => setForm({ ...form, client_phone: e.target.value })} data-testid="task-phone-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Vehículo</Label>
              <Input value={form.vehicle_model} onChange={(e) => setForm({ ...form, vehicle_model: e.target.value })} placeholder="T-Roc R-Line" data-testid="task-vehicle-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fecha</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} required data-testid="task-date-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Hora (opcional)</Label>
              <Input type="time" value={form.due_time} onChange={(e) => setForm({ ...form, due_time: e.target.value })} data-testid="task-time-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Prioridad</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger data-testid="task-priority-select">
                  <SelectValue>{(v) => String(v)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <Label className="text-xs">Notas</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} data-testid="task-notes-input" />
          </div>
          <div className="mt-3 flex gap-2">
            <Button type="submit" disabled={create.isPending} data-testid="task-submit-button">
              {create.isPending ? "Guardando…" : "Guardar recordatorio"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="task-cancel-button">
              Cancelar
            </Button>
          </div>
        </form>
      )}

      <div className="mb-4 flex flex-wrap gap-1.5" data-testid="tareas-filters">
        {([
          ["pendientes", "Pendientes"],
          ["vencidas", "Vencidas"],
          ["hoy", "Hoy"],
          ["hechas", "Completadas"],
          ["todas", "Todas"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs transition-colors duration-200",
              filter === key
                ? "border-sky-500/60 bg-sky-600/20 font-medium text-sky-300"
                : "border-slate-700/60 bg-slate-900/60 text-slate-400 hover:text-slate-200",
            )}
            data-testid={`tareas-filter-${key}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tasks.isError ? (
        <EmptyState title="No se han podido cargar los recordatorios" hint="Comprueba la conexión con el servidor." />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-7 w-7 text-sky-400" />}
          title="Sin recordatorios en esta vista"
          hint="Crea uno con «Nuevo recordatorio» para no perder ningún seguimiento."
        />
      ) : (
        <div className="space-y-2" data-testid="tareas-list">
          {list.map((x) => {
            const overdue = x.status !== "hecha" && x.due_date < t;
            const isToday = x.status !== "hecha" && x.due_date === t;
            return (
              <div
                key={x.id}
                className={cn(
                  "glass-card flex flex-wrap items-center gap-3 rounded-2xl p-4",
                  overdue && "border-rose-500/40",
                  isToday && "border-amber-500/40",
                  x.status === "hecha" && "opacity-60",
                )}
                data-testid={`task-row-${x.id}`}
              >
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => toggle.mutate({ id: x.id, status: x.status === "hecha" ? "pendiente" : "hecha" })}
                  className={cn(
                    "shrink-0 rounded-full border",
                    x.status === "hecha" ? "border-emerald-500/50 text-emerald-400" : "border-slate-600 text-slate-400",
                  )}
                  data-testid={`task-toggle-${x.id}`}
                  aria-label={x.status === "hecha" ? "Reabrir" : "Marcar como hecha"}
                >
                  {x.status === "hecha" ? <Undo2 className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                </Button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={cn("text-sm font-medium text-slate-100", x.status === "hecha" && "line-through")}>
                      {x.title}
                    </p>
                    <span className="rounded-full border border-slate-600/60 bg-slate-900/70 px-2 py-0.5 text-[10px] text-slate-300">
                      {x.kind}
                    </span>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                        x.priority === "alta"
                          ? "border-rose-500/40 bg-rose-500/15 text-rose-300"
                          : x.priority === "media"
                            ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                            : "border-slate-500/40 bg-slate-500/15 text-slate-300",
                      )}
                    >
                      {x.priority}
                    </span>
                    {overdue && (
                      <span className="rounded-full border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-300" data-testid={`task-overdue-${x.id}`}>
                        VENCIDA
                      </span>
                    )}
                    {isToday && (
                      <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                        HOY
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    <Clock className="mr-1 inline h-3 w-3" />
                    {fmtDate(x.due_date)}
                    {x.due_time ? ` · ${x.due_time}` : ""}
                    {x.client_name ? ` · ${x.client_name}` : ""}
                    {x.client_phone ? ` · ${x.client_phone}` : ""}
                    {x.vehicle_model ? ` · ${x.vehicle_model}` : ""}
                  </p>
                  {x.notes && <p className="mt-1 text-xs text-slate-400">{x.notes}</p>}
                </div>

                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => remove.mutate(x.id)}
                  data-testid={`task-delete-${x.id}`}
                  aria-label="Eliminar recordatorio"
                >
                  <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
