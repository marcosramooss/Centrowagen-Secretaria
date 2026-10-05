import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { DemoPill, EmptyState, PageHeader } from "@/components/bits";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiGet } from "@/lib/api";
import { eur, eur2, fmtDate } from "@/lib/format";
import type { FinancingOffer, Vehicle } from "@/lib/types";

function monthlyPayment(financed: number, tinPct: number, months: number, final: number): number {
  const i = tinPct / 100 / 12;
  if (months <= 0) return 0;
  if (i <= 0) return (financed - final) / months;
  const pvFinal = final / (1 + i) ** months;
  return ((financed - pvFinal) * i) / (1 - (1 + i) ** -months);
}

export default function Financiacion() {
  const offers = useQuery({ queryKey: ["financing"], queryFn: () => apiGet<FinancingOffer[]>("/financing"), retry: false });
  const vehicles = useQuery({ queryKey: ["vehicles"], queryFn: () => apiGet<Vehicle[]>("/vehicles"), retry: false });

  const [price, setPrice] = useState("35020");
  const [entry, setEntry] = useState("6000");
  const [months, setMonths] = useState("48");
  const [tin, setTin] = useState("6.95");
  const [final, setFinal] = useState("11000");

  const vmap = useMemo(() => {
    const m = new Map<string, Vehicle>();
    for (const v of vehicles.data ?? []) m.set(v.id, v);
    return m;
  }, [vehicles.data]);

  const financed = Math.max(0, Number(price || 0) - Number(entry || 0));
  const sim = monthlyPayment(financed, Number(tin || 0), Number(months || 0), Number(final || 0));
  const totalDue = Number(entry || 0) + sim * Math.max(0, Number(months || 0) - (Number(final) > 0 ? 1 : 0)) + Number(final || 0);

  return (
    <div data-testid="financiacion-page">
      <PageHeader
        title="💳 Financiación"
        subtitle="Planes de Volkswagen Financial Services registrados y simulador de cuota."
        right={<DemoPill />}
      />

      <div className="mb-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4" data-testid="financiacion-warning">
        <p className="text-sm text-amber-200">
          ⚠️ Las condiciones mostradas corresponden a la información disponible y deben verificarse antes de
          presentarlas como oferta definitiva al cliente.
        </p>
      </div>

      {/* Simulator */}
      <section className="glass-panel mb-6 rounded-2xl p-5" data-testid="financiacion-simulator">
        <h2 className="mb-4 text-base font-semibold text-white">🧮 Simulador de cuota</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Precio (€)" value={price} onChange={setPrice} testId="sim-price-input" />
          <Field label="Entrada (€)" value={entry} onChange={setEntry} testId="sim-entry-input" />
          <Field label="Nº de cuotas" value={months} onChange={setMonths} testId="sim-months-input" />
          <Field label="TIN (%)" value={tin} onChange={setTin} step="0.01" testId="sim-tin-input" />
          <Field label="Última cuota (€)" value={final} onChange={setFinal} testId="sim-final-input" />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4">
            <p className="text-[11px] uppercase tracking-wider text-sky-300">Cuota estimada</p>
            <p className="mt-1 text-2xl font-semibold text-sky-200" data-testid="sim-monthly-result">
              {Number.isFinite(sim) ? eur2(sim) : "—"}<span className="text-sm text-slate-400">/mes</span>
            </p>
          </div>
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-400">Importe financiado</p>
            <p className="mt-1 text-xl font-semibold text-slate-100">{eur(financed)}</p>
          </div>
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-400">Total adeudado (aprox.)</p>
            <p className="mt-1 text-xl font-semibold text-slate-100">{Number.isFinite(totalDue) ? eur(totalDue) : "—"}</p>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Cálculo orientativo sin comisiones ni seguros. La cuota definitiva la fija Volkswagen Financial Services.
        </p>
      </section>

      {/* Registered plans */}
      <h2 className="mb-3 text-base font-semibold text-white">Planes registrados</h2>
      {offers.isError ? (
        <EmptyState title="No se han podido cargar los planes" hint="Comprueba la conexión con el servidor." />
      ) : (offers.data ?? []).length === 0 ? (
        <EmptyState title="Sin planes de financiación registrados" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="financiacion-plans">
          {(offers.data ?? []).map((f) => {
            const v = f.vehicle_id ? vmap.get(f.vehicle_id) : null;
            return (
              <div key={f.id} className="glass-card rounded-2xl p-5" data-testid={`financing-card-${f.id}`}>
                <p className="text-[11px] uppercase tracking-wider text-sky-400">
                  {v ? `${v.model} ${v.trim}` : "Campaña general"}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-100">{f.campaign}</p>
                <p className="mt-3 text-3xl font-semibold text-sky-300">
                  {eur2(f.monthly_payment)}<span className="text-sm text-slate-400">/mes</span>
                </p>
                <dl className="mt-3 space-y-1.5 text-xs">
                  <Pair k="Entrada" v={eur(f.entry_payment)} />
                  <Pair k="Nº de cuotas" v={String(f.number_of_payments)} />
                  <Pair k="Última cuota" v={f.final_payment ? eur(f.final_payment) : "—"} />
                  <Pair k="TIN" v={`${f.tin}%`} />
                  <Pair k="TAE" v={`${f.tae}%`} />
                  <Pair k="Comisión de apertura" v={f.opening_fee != null ? eur(f.opening_fee) : "—"} />
                  <Pair k="Importe financiado" v={f.financed_amount ? eur(f.financed_amount) : "—"} />
                  <Pair k="Total adeudado" v={f.total_amount ? eur(f.total_amount) : "—"} />
                  <Pair k="Vigencia" v={`${fmtDate(f.valid_from)} → ${fmtDate(f.valid_until)}`} />
                </dl>
                {f.conditions && <p className="mt-3 text-[11px] text-slate-300">{f.conditions}</p>}
                <p className="mt-2 text-[10px] text-slate-500">📚 {f.source} · 📅 {fmtDate(f.last_updated)}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({
  label, value, onChange, step, testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
  testId: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type="number" step={step} value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId} />
    </div>
  );
}

function Pair({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-800/60 pb-1 last:border-0">
      <dt className="text-slate-400">{k}</dt>
      <dd className="font-medium text-slate-200">{v}</dd>
    </div>
  );
}
