import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { DemoPill, EmptyState, PageHeader } from "@/components/bits";
import { apiGet } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import type { Argumentario as Arg } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function Argumentario() {
  const args = useQuery({ queryKey: ["argumentario"], queryFn: () => apiGet<Arg[]>("/argumentario"), retry: false });
  const all = args.data ?? [];
  const [model, setModel] = useState<string | null>(null);
  const current = all.find((a) => a.model === model) ?? all[0] ?? null;

  return (
    <div data-testid="argumentario-page">
      <PageHeader
        title="🎯 Argumentario"
        subtitle="Puntos fuertes, cliente ideal, objeciones habituales y preguntas para detectar necesidades."
        right={<DemoPill />}
      />

      {args.isError ? (
        <EmptyState title="No se ha podido cargar el argumentario" hint="Comprueba la conexión con el servidor." />
      ) : all.length === 0 ? (
        <EmptyState title="Sin argumentario registrado" />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-1.5" data-testid="argumentario-models">
            {all.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setModel(a.model)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs transition-colors duration-200",
                  current?.model === a.model
                    ? "border-sky-500/60 bg-sky-600/20 font-medium text-sky-300"
                    : "border-slate-700/60 bg-slate-900/60 text-slate-400 hover:text-slate-200",
                )}
                data-testid={`argumentario-model-${a.model}`}
              >
                {a.model}
              </button>
            ))}
          </div>

          {current && (
            <div className="grid gap-4 lg:grid-cols-2" data-testid="argumentario-detail">
              <div className="space-y-4">
                <Block title="Puntos fuertes" testId="argumentario-strong-points">
                  <ul className="space-y-2">
                    {current.strong_points.map((p) => (
                      <li key={p} className="flex gap-2 text-sm text-slate-200">
                        <span className="text-emerald-400">✓</span> {p}
                      </li>
                    ))}
                  </ul>
                </Block>

                <Block title="Cliente ideal" testId="argumentario-ideal-customer">
                  <p className="text-sm text-slate-200">{current.ideal_customer}</p>
                </Block>

                <Block title="Argumentos de venta" testId="argumentario-sales-arguments">
                  <ul className="space-y-2">
                    {current.sales_arguments.map((p) => (
                      <li key={p} className="flex gap-2 text-sm text-slate-200">
                        <span className="text-sky-400">→</span> {p}
                      </li>
                    ))}
                  </ul>
                </Block>

                <Block title="Preguntas para detectar necesidades" testId="argumentario-discovery">
                  <ul className="space-y-2">
                    {current.discovery_questions.map((p) => (
                      <li key={p} className="flex gap-2 text-sm text-slate-200">
                        <span className="text-amber-400">?</span> {p}
                      </li>
                    ))}
                  </ul>
                </Block>
              </div>

              <div className="space-y-4">
                <Block title="Objeciones habituales y respuestas" testId="argumentario-objections">
                  <div className="space-y-3">
                    {current.objections.map((o, i) => (
                      <div key={i} className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-3.5">
                        <p className="text-sm font-medium text-amber-300">«{o.objection}»</p>
                        <p className="mt-1.5 text-sm leading-relaxed text-slate-200">{o.response}</p>
                      </div>
                    ))}
                  </div>
                </Block>

                <Block title="Diferencias frente a otros modelos" testId="argumentario-differences">
                  <ul className="space-y-2">
                    {current.differences.map((p) => (
                      <li key={p} className="flex gap-2 text-sm text-slate-200">
                        <span className="text-slate-500">•</span> {p}
                      </li>
                    ))}
                  </ul>
                </Block>

                <p className="text-[11px] text-slate-500">
                  📚 {current.source} · 📅 Actualizado {fmtDate(current.last_updated)} · Nunca realices afirmaciones
                  falsas sobre la competencia.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Block({ title, children, testId }: { title: string; children: React.ReactNode; testId: string }) {
  return (
    <section className="glass-panel rounded-2xl p-5" data-testid={testId}>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-sky-300">{title}</h3>
      {children}
    </section>
  );
}
