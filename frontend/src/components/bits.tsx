import type { ReactNode } from "react";

import { fmtDate } from "@/lib/format";
import type { PromoStatus, SourceRef } from "@/lib/types";

export function DemoPill({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-300 ${className}`}
      data-testid="demo-data-pill"
    >
      Datos de demostración
    </span>
  );
}

export function SourcePill({ source }: { source: SourceRef }) {
  const dot = source.estado === "🟢" ? "bg-emerald-400" : "bg-amber-400";
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 overflow-hidden rounded-full border border-cyan-500/30 bg-slate-800/80 px-2.5 py-1 font-mono text-xs text-cyan-300"
      data-testid="source-pill"
      title={`${source.name} · actualizado ${source.updated}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      <span className="truncate">📚 {source.name} · 📅 {source.updated}</span>
    </span>
  );
}

const PROMO_STYLES: Record<PromoStatus, { label: string; cls: string }> = {
  activa: { label: "Activa", cls: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300" },
  proxima: { label: "Próxima a caducar", cls: "border-amber-500/40 bg-amber-500/15 text-amber-300" },
  programada: { label: "Programada", cls: "border-sky-500/40 bg-sky-500/15 text-sky-300" },
  finalizada: { label: "Finalizada", cls: "border-rose-500/40 bg-rose-500/15 text-rose-300" },
};

export function PromoBadge({ status }: { status: PromoStatus }) {
  const s = PROMO_STYLES[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${s.cls}`} data-testid={`promo-status-${status}`}>
      {s.label}
    </span>
  );
}

export function AvailabilityBadge({ value }: { value: string }) {
  const cls =
    value === "Entrega inmediata"
      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
      : value === "Reservado"
        ? "border-rose-500/40 bg-rose-500/15 text-rose-300"
        : value === "En tránsito"
          ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
          : "border-slate-500/40 bg-slate-500/15 text-slate-300";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`} data-testid="stock-availability-badge">
      {value}
    </span>
  );
}

export function StaleWarning({ lastUpdated }: { lastUpdated: string | null | undefined }) {
  if (!lastUpdated) return null;
  const t = new Date(lastUpdated).getTime();
  if (Number.isNaN(t)) return null;
  const days = (Date.now() - t) / 86400000;
  if (days <= 45) return null;
  return (
    <span className="text-xs font-medium text-amber-400" data-testid="stale-warning">
      🟡 Información posiblemente desactualizada
    </span>
  );
}

export function EmptyState({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="glass-panel flex flex-col items-center justify-center gap-2 rounded-2xl p-10 text-center" data-testid="empty-state">
      {icon}
      <p className="font-medium text-slate-200">{title}</p>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4" data-testid="page-header">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export { fmtDate };
