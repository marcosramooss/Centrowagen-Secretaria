import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { DemoPill, EmptyState, PageHeader, PromoBadge } from "@/components/bits";
import { apiGet } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import type { Promotion } from "@/lib/types";
import { cn } from "@/lib/utils";

const TABS: { key: string; label: string }[] = [
  { key: "vigentes", label: "Vigentes" },
  { key: "activa", label: "🟢 Activas" },
  { key: "proxima", label: "🟡 Próximas a caducar" },
  { key: "finalizada", label: "🔴 Finalizadas" },
  { key: "todas", label: "Todas" },
];

export default function Promociones() {
  const [tab, setTab] = useState("vigentes");
  const promos = useQuery({ queryKey: ["promotions"], queryFn: () => apiGet<Promotion[]>("/promotions"), retry: false });

  const all = promos.data ?? [];
  const list = all.filter((p) => {
    if (tab === "todas") return true;
    if (tab === "vigentes") return p.status === "activa" || p.status === "proxima" || p.status === "programada";
    return p.status === tab;
  });

  return (
    <div data-testid="promociones-page">
      <PageHeader
        title="🔥 Promociones"
        subtitle="Campañas oficiales y de concesionario. El estado se calcula con la fecha de hoy — las finalizadas nunca se muestran como actuales."
        right={<DemoPill />}
      />

      <div className="mb-5 flex flex-wrap gap-1.5" data-testid="promociones-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs transition-colors duration-200",
              tab === t.key
                ? "border-sky-500/60 bg-sky-600/20 font-medium text-sky-300"
                : "border-slate-700/60 bg-slate-900/60 text-slate-400 hover:text-slate-200",
            )}
            data-testid={`promociones-tab-${t.key}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {promos.isError ? (
        <EmptyState title="No se han podido cargar las promociones" hint="Comprueba la conexión con el servidor." />
      ) : list.length === 0 ? (
        <EmptyState title="Sin promociones en esta categoría" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="promociones-grid">
          {list.map((p) => (
            <div
              key={p.id}
              className={cn("glass-card rounded-2xl p-5", p.status === "finalizada" && "opacity-60")}
              data-testid={`promo-card-${p.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-sky-400">{p.model}</p>
                  <h3 className="mt-0.5 text-base font-semibold text-white">{p.name}</h3>
                </div>
                <PromoBadge status={p.status} />
              </div>

              <p className="mt-2 text-sm text-slate-300">{p.description}</p>

              {p.discount && (
                <p className="mt-3 text-2xl font-semibold text-emerald-300" data-testid={`promo-discount-${p.id}`}>
                  {p.discount}
                </p>
              )}

              <div className="mt-3 space-y-1 text-xs text-slate-400">
                <p>📅 Vigencia: {fmtDate(p.valid_from)} → {fmtDate(p.valid_until)}</p>
                <p>{p.financing_required ? "💳 Requiere financiación con VWFS" : "💳 Sin financiación obligatoria"}</p>
              </div>

              {p.conditions && (
                <p className="mt-3 rounded-lg border border-slate-700/50 bg-slate-900/40 p-2.5 text-[11px] text-slate-300">
                  {p.conditions}
                </p>
              )}

              <p className="mt-3 text-[10px] text-slate-500">📚 {p.source} · 📅 Actualizada {fmtDate(p.last_updated)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
