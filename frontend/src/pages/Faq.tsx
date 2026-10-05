import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Search } from "lucide-react";

import { DemoPill, EmptyState, PageHeader } from "@/components/bits";
import { Input } from "@/components/ui/input";
import { apiGet } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import type { FaqItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function Faq() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const faq = useQuery({ queryKey: ["faq"], queryFn: () => apiGet<FaqItem[]>("/faq"), retry: false });
  const all = faq.data ?? [];
  const categories = useMemo(() => [...new Set(all.map((f) => f.category))].sort(), [all]);

  const list = all.filter((f) => {
    if (category && f.category !== category) return false;
    if (q) {
      const blob = `${f.question} ${f.answer} ${f.category}`.toLowerCase();
      return q.toLowerCase().split(/\s+/).every((t) => blob.includes(t));
    }
    return true;
  });

  return (
    <div data-testid="faq-page">
      <PageHeader
        title="❓ Preguntas frecuentes"
        subtitle="Base de conocimiento comercial del concesionario, con fuente y fecha de cada respuesta."
        right={<DemoPill />}
      />

      <div className="glass-panel mb-5 rounded-2xl p-4" data-testid="faq-filters">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Busca una pregunta: garantía, batería, entrega, My Way…"
            className="pl-9"
            data-testid="faq-search-input"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCategory("")}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors duration-200",
              !category ? "border-sky-500/60 bg-sky-600/20 font-medium text-sky-300" : "border-slate-700/60 bg-slate-900/60 text-slate-400 hover:text-slate-200",
            )}
            data-testid="faq-category-all"
          >
            Todas
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(category === c ? "" : c)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors duration-200",
                category === c ? "border-sky-500/60 bg-sky-600/20 font-medium text-sky-300" : "border-slate-700/60 bg-slate-900/60 text-slate-400 hover:text-slate-200",
              )}
              data-testid={`faq-category-${c}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {faq.isError ? (
        <EmptyState title="No se ha podido cargar la base de conocimiento" hint="Comprueba la conexión con el servidor." />
      ) : list.length === 0 ? (
        <EmptyState title="Sin preguntas con esos criterios" />
      ) : (
        <div className="space-y-2" data-testid="faq-list">
          {list.map((f) => (
            <div key={f.id} className="glass-panel overflow-hidden rounded-2xl" data-testid={`faq-item-${f.id}`}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 p-4 text-left"
                onClick={() => setOpen(open === f.id ? null : f.id)}
                data-testid={`faq-toggle-${f.id}`}
              >
                <span className="min-w-0">
                  <span className="block text-[10px] uppercase tracking-wider text-sky-400">{f.category}</span>
                  <span className="mt-0.5 block text-sm font-medium text-slate-100">{f.question}</span>
                </span>
                <ChevronDown
                  className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200", open === f.id && "rotate-180")}
                />
              </button>
              {open === f.id && (
                <div className="border-t border-slate-800/60 px-4 py-3" data-testid={`faq-answer-${f.id}`}>
                  <p className="text-sm leading-relaxed text-slate-200">{f.answer}</p>
                  <p className="mt-2 text-[10px] text-slate-500">📚 {f.source} · 📅 {fmtDate(f.last_updated)}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
