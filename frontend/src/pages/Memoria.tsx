import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Brain, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DemoPill, EmptyState, PageHeader } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { useMe } from "@/lib/session";
import type { MemoryItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  "Preferencias del vendedor",
  "Procedimientos",
  "Argumentarios",
  "Información comercial",
  "FAQ",
  "Datos recurrentes",
];

const IMPORTANCE = ["alta", "media", "baja"];

export default function Memoria() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const isAdmin = me?.role === "admin";
  const [filter, setFilter] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [importance, setImportance] = useState("media");

  const memory = useQuery({ queryKey: ["memory"], queryFn: () => apiGet<MemoryItem[]>("/memory"), retry: false });

  const create = useMutation({
    mutationFn: (body: { content: string; category: string; importance: string }) => apiPost<MemoryItem>("/memory", body),
    onSuccess: () => {
      toast.success("SecretarIA ha aprendido este dato");
      setContent("");
      void qc.invalidateQueries({ queryKey: ["memory"] });
      void qc.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: () => toast.error("No se pudo guardar en memoria"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiDelete(`/memory/${id}`),
    onSuccess: () => {
      toast.success("Memoria eliminada");
      void qc.invalidateQueries({ queryKey: ["memory"] });
      void qc.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  const all = memory.data ?? [];
  const categories = useMemo(() => [...new Set(all.map((m) => m.category))].sort(), [all]);
  const list = filter ? all.filter((m) => m.category === filter) : all;

  return (
    <div data-testid="memoria-page">
      <PageHeader
        title="🧠 Memoria de SecretarIA"
        subtitle="Todo lo que SecretarIA tiene en cuenta al responder. Es consultable y editable — nada es opaco."
        right={<DemoPill />}
      />

      {isAdmin && (
        <form
          className="glass-panel mb-5 rounded-2xl p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!content.trim()) return;
            create.mutate({ content: content.trim(), category, importance });
          }}
          data-testid="memory-create-form"
        >
          <h2 className="mb-3 text-base font-semibold text-white">Añadir a la memoria</h2>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            placeholder="Ej.: Antes de cualquier oferta, comprobar el stock real y la vigencia de la campaña."
            data-testid="memory-content-input"
          />
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Categoría</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger data-testid="memory-category-select">
                  <SelectValue>{(v) => String(v)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Importancia</Label>
              <Select value={importance} onValueChange={setImportance}>
                <SelectTrigger data-testid="memory-importance-select">
                  <SelectValue>{(v) => String(v)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {IMPORTANCE.map((i) => (
                    <SelectItem key={i} value={i}>{i}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full gap-2" disabled={create.isPending} data-testid="memory-save-button">
                <Plus className="h-4 w-4" /> Guardar
              </Button>
            </div>
          </div>
        </form>
      )}

      <div className="mb-5 flex flex-wrap gap-1.5" data-testid="memoria-filters">
        <button
          type="button"
          onClick={() => setFilter("")}
          className={cn(
            "rounded-full border px-3 py-1 text-xs transition-colors duration-200",
            !filter ? "border-sky-500/60 bg-sky-600/20 font-medium text-sky-300" : "border-slate-700/60 bg-slate-900/60 text-slate-400 hover:text-slate-200",
          )}
          data-testid="memoria-filter-all"
        >
          Todas
        </button>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFilter(filter === c ? "" : c)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors duration-200",
              filter === c ? "border-sky-500/60 bg-sky-600/20 font-medium text-sky-300" : "border-slate-700/60 bg-slate-900/60 text-slate-400 hover:text-slate-200",
            )}
            data-testid={`memoria-filter-${c}`}
          >
            {c}
          </button>
        ))}
      </div>

      {memory.isError ? (
        <EmptyState title="No se ha podido cargar la memoria" hint="Comprueba la conexión con el servidor." />
      ) : list.length === 0 ? (
        <EmptyState icon={<Brain className="h-7 w-7 text-sky-400" />} title="Sin registros en memoria" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="memoria-grid">
          {list.map((m) => (
            <div key={m.id} className="glass-card rounded-2xl p-4" data-testid={`memory-card-${m.id}`}>
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wider text-sky-400">{m.category}</span>
                <div className="flex items-center gap-1">
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                      m.importance === "alta"
                        ? "border-rose-500/40 bg-rose-500/15 text-rose-300"
                        : m.importance === "media"
                          ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                          : "border-slate-500/40 bg-slate-500/15 text-slate-300",
                    )}
                  >
                    {m.importance}
                  </span>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => remove.mutate(m.id)}
                      data-testid={`memory-delete-${m.id}`}
                      aria-label="Eliminar memoria"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                    </Button>
                  )}
                </div>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-200">{m.content}</p>
              <p className="mt-3 text-[10px] text-slate-500">📅 Actualizado {fmtDateTime(m.updated_at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
